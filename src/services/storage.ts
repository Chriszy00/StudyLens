import { supabase, getSupabaseStorageKey, isTokenExpired, ensureFreshSession, warmConnection, isAuthError } from '@/lib/supabase'

const BUCKET_NAME = 'documents'

export interface UploadResult {
    path: string
    url: string
}

export interface UploadProgressInfo {
    stage: 'reading' | 'connecting' | 'uploading' | 'processing' | 'complete' | 'error'
    percent: number
    bytesUploaded?: number
    totalBytes?: number
    message: string
    speed?: string
    timeRemaining?: string
}

export type UploadProgressCallback = (progress: UploadProgressInfo) => void

export interface UploadOptions {
    userId?: string
    onProgress?: UploadProgressCallback
    abortSignal?: AbortSignal
}

// ---------------------------------------------------------------------------
// Token helpers — reads the Supabase access token directly from localStorage
// so uploads can bypass the Supabase JS client (and its Web Lock contention).
// ---------------------------------------------------------------------------

function getAccessTokenDirect(): string | null {
    try {
        const storageKey = getSupabaseStorageKey()
        const stored = localStorage.getItem(storageKey)
        if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.access_token) {
                return parsed.access_token
            }
        }
    } catch { /* localStorage unavailable or corrupt */ }
    return null
}

/**
 * Returns a valid (non-expired) access token for raw fetch uploads.
 * If the localStorage token is expired, triggers a deduplicated session
 * refresh, then re-reads. Throws if no valid token can be obtained.
 */
async function getValidAccessToken(): Promise<string> {
    let token = getAccessTokenDirect()

    if (token && !isTokenExpired(token)) {
        return token
    }

    console.log('[Storage] Token expired or missing — refreshing session before upload')
    const session = await ensureFreshSession()
    if (session) {
        return session.access_token
    }

    token = getAccessTokenDirect()
    if (token && !isTokenExpired(token)) {
        return token
    }

    throw new Error('Your session has expired — please log in again')
}

/**
 * Gets the current user ID from the session. Used to build the storage path.
 */
async function getUserId(providedUserId?: string): Promise<string> {
    if (providedUserId) return providedUserId

    const session = await ensureFreshSession()
    if (!session?.user) {
        throw new Error('Not authenticated. Please sign in again.')
    }
    return session.user.id
}

// ---------------------------------------------------------------------------
// Raw fetch upload — completely bypasses the Supabase JS client (and its
// internal getSession() Web Lock) to avoid deadlocks after the tab has been
// backgrounded. Uses AbortSignal.timeout() for genuine cancellation.
// ---------------------------------------------------------------------------
const RAW_UPLOAD_TIMEOUT_MS = 30_000

async function uploadWithRawFetch(
    filePath: string,
    file: File | Blob,
    accessToken: string,
    options: { cacheControl: string; upsert: boolean; contentType: string }
): Promise<{ data: { path: string } | null; error: { message: string } | null }> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    try {
        const response = await fetch(
            `${supabaseUrl}/storage/v1/object/${BUCKET_NAME}/${filePath}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': supabaseKey,
                    'cache-control': options.cacheControl,
                    'x-upsert': String(options.upsert),
                },
                body: file,
                signal: AbortSignal.timeout(RAW_UPLOAD_TIMEOUT_MS),
            }
        )

        if (!response.ok) {
            const body = await response.json().catch(() => ({ message: response.statusText }))
            return { data: null, error: { message: body.message || body.error || response.statusText } }
        }

        const body = await response.json()
        const returnedKey: string = body.Key ?? ''
        const path = returnedKey.startsWith(`${BUCKET_NAME}/`)
            ? returnedKey.slice(BUCKET_NAME.length + 1)
            : returnedKey

        return { data: { path: path || filePath }, error: null }
    } catch (err) {
        if (err instanceof DOMException && err.name === 'TimeoutError') {
            throw new Error('UPLOAD_TIMEOUT')
        }
        throw err
    }
}

// ---------------------------------------------------------------------------
// Public upload functions
// ---------------------------------------------------------------------------

/**
 * Upload a file to Supabase Storage using raw fetch (bypasses client lock).
 *
 * Flow:
 *  1. Get a valid (non-expired) access token
 *  2. Warm the HTTP connection (detect dead sockets)
 *  3. Upload with a 30s timeout
 *  4. If the upload times out -> warm connection again -> retry once
 */
export async function uploadFile(file: File, userId?: string): Promise<UploadResult> {
    const userIdToUse = await getUserId(userId)

    let accessToken: string
    try {
        accessToken = await getValidAccessToken()
    } catch (authErr) {
        throw authErr as Error
    }

    await warmConnection()

    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${userIdToUse}/${timestamp}_${sanitizedName}`

    const uploadOptions = { cacheControl: '3600', upsert: false, contentType: file.type }

    let data: { path: string } | null = null
    let error: { message: string } | null = null

    try {
        const result = await uploadWithRawFetch(filePath, file, accessToken, uploadOptions)
        data = result.data
        error = result.error
    } catch (err) {
        if (err instanceof Error && err.message === 'UPLOAD_TIMEOUT') {
            console.warn('[Storage] Upload timed out — warming connection and retrying...')
            await warmConnection()

            try {
                const retryResult = await uploadWithRawFetch(filePath, file, accessToken, { ...uploadOptions, upsert: true })
                data = retryResult.data
                error = retryResult.error
            } catch (retryErr) {
                const msg = retryErr instanceof Error ? retryErr.message : 'Unknown error'
                throw new Error(
                    msg === 'UPLOAD_TIMEOUT'
                        ? 'Upload timed out. Please check your connection and try again.'
                        : msg
                )
            }
        } else {
            throw err
        }
    }

    if (error) {
        throw new Error(error.message)
    }

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data!.path)

    return { path: data!.path, url: publicUrl }
}

/**
 * Upload a file with progress updates and cancellation support.
 * Uses raw fetch to bypass the Supabase client's internal Web Lock.
 */
export async function uploadFileWithProgress(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    const { userId, onProgress, abortSignal } = options
    const uploadStartTime = Date.now()

    let progressSimulatorInterval: ReturnType<typeof setInterval> | null = null
    let simulatedProgress = 25

    const reportProgress = (progress: UploadProgressInfo) => {
        onProgress?.(progress)
    }

    const cleanupInterval = () => {
        if (progressSimulatorInterval) {
            clearInterval(progressSimulatorInterval)
            progressSimulatorInterval = null
        }
    }

    if (abortSignal?.aborted) {
        throw new Error('Upload cancelled')
    }

    try {
        // Stage 1: Preparing
        reportProgress({
            stage: 'reading',
            percent: 5,
            message: 'Preparing file for upload',
            totalBytes: file.size,
        })

        if (abortSignal?.aborted) throw new Error('Upload cancelled')

        reportProgress({
            stage: 'reading',
            percent: 15,
            message: 'File ready for upload',
            totalBytes: file.size,
        })

        // Stage 2: Connecting — get token + warm connection
        if (abortSignal?.aborted) throw new Error('Upload cancelled')

        reportProgress({
            stage: 'connecting',
            percent: 20,
            message: 'Connecting to cloud storage',
            totalBytes: file.size,
        })

        const userIdToUse = await getUserId(userId)
        let accessToken: string
        try {
            accessToken = await getValidAccessToken()
        } catch (authErr) {
            throw authErr as Error
        }

        await warmConnection()

        reportProgress({
            stage: 'connecting',
            percent: 25,
            message: 'Connection established',
            totalBytes: file.size,
        })

        // Stage 3: Uploading
        if (abortSignal?.aborted) throw new Error('Upload cancelled')

        const timestamp = Date.now()
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filePath = `${userIdToUse}/${timestamp}_${sanitizedName}`

        const MAX_RETRIES = 3
        let lastError: Error | null = null

        // Start progress simulator
        simulatedProgress = 25
        progressSimulatorInterval = setInterval(() => {
            if (abortSignal?.aborted) {
                cleanupInterval()
                return
            }

            const remaining = 90 - simulatedProgress
            const increment = Math.max(0.5, remaining * 0.05)
            simulatedProgress = Math.min(90, simulatedProgress + increment)

            const elapsed = (Date.now() - uploadStartTime) / 1000
            const speed = file.size / 1024 / elapsed
            const estimatedRemaining = ((100 - simulatedProgress) / simulatedProgress) * elapsed

            reportProgress({
                stage: 'uploading',
                percent: Math.round(simulatedProgress),
                bytesUploaded: Math.round((simulatedProgress / 100) * file.size),
                totalBytes: file.size,
                message: 'Uploading to cloud',
                speed: speed > 1024 ? `${(speed / 1024).toFixed(1)} MB/s` : `${speed.toFixed(0)} KB/s`,
                timeRemaining: estimatedRemaining > 60
                    ? `~${Math.round(estimatedRemaining / 60)}m remaining`
                    : `~${Math.round(estimatedRemaining)}s remaining`,
            })
        }, 500)

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 1) {
                    const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 10000)
                    reportProgress({
                        stage: 'uploading',
                        percent: simulatedProgress,
                        message: `Retrying upload (attempt ${attempt})...`,
                        totalBytes: file.size,
                    })
                    await new Promise(resolve => setTimeout(resolve, backoffMs))
                }

                if (abortSignal?.aborted) throw new Error('Upload cancelled')

                const result = await uploadWithRawFetch(
                    filePath,
                    file,
                    accessToken,
                    { cacheControl: '3600', upsert: attempt > 1, contentType: file.type }
                )

                if (result.error) throw new Error(result.error.message)
                if (!result.data) throw new Error('Upload succeeded but no data returned')

                cleanupInterval()

                // Stage 4: Finalizing
                reportProgress({
                    stage: 'processing',
                    percent: 95,
                    bytesUploaded: file.size,
                    totalBytes: file.size,
                    message: 'Finalizing upload',
                })

                const { data: { publicUrl } } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(result.data.path)

                const totalTime = Date.now() - uploadStartTime
                const avgSpeed = file.size / 1024 / (totalTime / 1000)

                // Stage 5: Complete
                reportProgress({
                    stage: 'complete',
                    percent: 100,
                    bytesUploaded: file.size,
                    totalBytes: file.size,
                    message: 'Upload complete!',
                    speed: avgSpeed > 1024 ? `${(avgSpeed / 1024).toFixed(1)} MB/s` : `${avgSpeed.toFixed(0)} KB/s`,
                })

                return { path: result.data.path, url: publicUrl }

            } catch (err) {
                const error = err as Error
                lastError = error

                if (abortSignal?.aborted || error.message === 'Upload cancelled') {
                    throw new Error('Upload cancelled')
                }

                if (error.message === 'UPLOAD_TIMEOUT' && attempt < MAX_RETRIES) {
                    console.warn('[Storage] Upload timed out — warming connection before retry...')
                    await warmConnection()
                    continue
                }

                if (isAuthError(error) && attempt < MAX_RETRIES) {
                    console.log('[Storage] Auth error — refreshing token before retry...')
                    try {
                        accessToken = await getValidAccessToken()
                    } catch {
                        throw new Error('Session expired. Please sign in again.')
                    }
                    continue
                }

                if (attempt === MAX_RETRIES) {
                    throw lastError
                }
            }
        }

        throw lastError || new Error('Upload failed')

    } catch (err) {
        cleanupInterval()

        const error = err as Error

        reportProgress({
            stage: 'error',
            percent: 0,
            message: error.message === 'Upload cancelled' ? 'Upload cancelled by user' : (error.message || 'Upload failed'),
            totalBytes: file.size,
        })

        throw error
    }
}

// ---------------------------------------------------------------------------
// Non-upload storage operations — these go through the Supabase client
// (which now has resilientFetch, so they won't hang).
// ---------------------------------------------------------------------------

export async function getSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, 3600)

    if (error) throw error
    return data.signedUrl
}

export async function deleteFile(path: string): Promise<void> {
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path])

    if (error) throw error
}

export async function extractTextFromFile(file: File): Promise<string> {
    if (file.type === 'text/plain') {
        return await file.text()
    }

    if (file.type === 'application/pdf') {
        return `[PDF content from: ${file.name}]\n\nNote: Full PDF text extraction will be available after AI pipeline is implemented.`
    }

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return `[DOCX content from: ${file.name}]\n\nNote: Full DOCX text extraction will be available after AI pipeline is implemented.`
    }

    throw new Error(`Unsupported file type: ${file.type}`)
}

export function getAllowedFileTypes(): string[] {
    return [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
    ]
}

export function validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 25 * 1024 * 1024
    const allowedTypes = getAllowedFileTypes()

    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Invalid file type. Please upload a PDF, DOCX, or TXT file.' }
    }

    if (file.size > maxSize) {
        return { valid: false, error: 'File is too large. Maximum size is 25MB.' }
    }

    return { valid: true }
}
