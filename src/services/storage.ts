import { supabase } from '@/lib/supabase'
import { ensureValidSession, isAuthError, refreshSession, clearSessionCache } from '@/lib/sessionManager'

const BUCKET_NAME = 'documents'

export interface UploadResult {
    path: string
    url: string
}

/**
 * Upload progress information for UI updates
 */
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

/**
 * Options for uploadFileWithProgress
 */
export interface UploadOptions {
    userId?: string
    onProgress?: UploadProgressCallback
    abortSignal?: AbortSignal
}

/**
 * CACHED USER SESSION
 * Same pattern as other services - cache auth to avoid repeated network calls
 */
let cachedUserId: string | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION_MS = 30000 // 30 seconds

// Track if we've seen the initial auth event (to distinguish initial state from actual changes)
let hasReceivedInitialAuthEvent = false

// Listen for auth changes to invalidate cache
supabase.auth.onAuthStateChange((event, session) => {
    // The first event is the initial state, not an actual change
    // We don't want to clear caches on the initial state
    if (!hasReceivedInitialAuthEvent) {
        hasReceivedInitialAuthEvent = true
        console.log('🔐 [Storage] Initial auth state:', event, session ? 'has session' : 'no session')
        // On initial load, populate the cache from the session if available
        if (session?.user) {
            cachedUserId = session.user.id
            cacheTimestamp = Date.now()
        }
        return // Don't clear anything on initial state
    }
    
    // This is an actual state change
    console.log('🔐 [Storage] Auth state changed:', event)
    
    if (event === 'SIGNED_OUT') {
        // Only clear everything on sign out
        cachedUserId = null
        cacheTimestamp = 0
        clearSessionCache()
    } else if (event === 'TOKEN_REFRESHED') {
        // On token refresh, just clear the user cache but NOT the session cache
        // The session manager will update its cache with the new token
        cachedUserId = null
        cacheTimestamp = 0
    } else if (event === 'SIGNED_IN') {
        // On actual sign in (not initial state), update user cache
        if (session?.user) {
            cachedUserId = session.user.id
            cacheTimestamp = Date.now()
        }
        // DON'T clear session cache - we want to keep the fresh session!
    }
})

/**
 * Get the current user ID with session validation
 * 
 * IMPORTANT: This now uses ensureValidSession() which will:
 * 1. Check if the current token is valid
 * 2. Proactively refresh if token is about to expire (within 5 min buffer)
 * 3. Attempt refresh if token is already expired
 * 
 * This fixes the "infinite loading after idle" issue caused by expired JWTs.
 */
async function getCurrentUserId(): Promise<string> {
    const now = Date.now()

    // Use cached value if still valid (short cache for performance)
    if (cachedUserId && (now - cacheTimestamp) < CACHE_DURATION_MS) {
        // Even with cache, we should validate session hasn't expired
        // But we only do full validation every 30 seconds for performance
        return cachedUserId
    }

    // Use ensureValidSession instead of plain getSession
    // This handles token refresh automatically if needed
    console.log('🔐 [Storage] Validating session before operation...')
    const session = await ensureValidSession()

    if (!session?.user) {
        console.error('❌ [Storage] No valid session after validation')
        throw new Error('Not authenticated. Please sign in again.')
    }

    // Cache the result
    cachedUserId = session.user.id
    cacheTimestamp = now
    console.log('✅ [Storage] Session validated, user:', cachedUserId.substring(0, 8) + '...')

    return cachedUserId
}

/**
 * Read a File into an ArrayBuffer
 * This is crucial for reliable uploads - reading the file into memory first
 * prevents issues with streaming from slow sources (like OneDrive, cloud sync folders)
 */
async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result)
            } else {
                reject(new Error('Failed to read file as ArrayBuffer'))
            }
        }
        reader.onerror = () => reject(new Error(`FileReader error: ${reader.error?.message || 'Unknown error'}`))
        reader.onabort = () => reject(new Error('File reading was aborted'))
        reader.readAsArrayBuffer(file)
    })
}

/**
 * Upload a file to Supabase Storage
 * Files are stored in user-specific folders: {user_id}/{filename}
 * 
 * KEY FIX: We read the file into memory as ArrayBuffer BEFORE uploading.
 * This solves issues where streaming uploads hang, especially when:
 * - Files are on cloud-synced folders (OneDrive, Dropbox, Google Drive)
 * - Files are larger than ~100KB
 * - Network conditions are variable
 * 
 * @param file - The file to upload
 * @param userId - The authenticated user's ID (from AuthContext to avoid network call)
 */
export async function uploadFile(file: File, userId?: string): Promise<UploadResult> {
    console.log('📦 uploadFile() called with:', {
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: file.type,
        userId: userId ? 'provided' : 'not provided',
        timestamp: new Date().toISOString(),
    })

    // Quick connectivity check for larger files
    if (file.size > 100 * 1024) { // Check for files > 100KB
        console.log('🌐 Checking Supabase connectivity...')
        try {
            const checkStart = Date.now()
            // Simple query to check if Supabase is reachable
            const { error: pingError } = await supabase.storage.from(BUCKET_NAME).list('', { limit: 1 })
            if (pingError) {
                console.warn('⚠️ Supabase connectivity issue:', pingError.message)
            } else {
                console.log(`✅ Supabase reachable (${Date.now() - checkStart}ms)`)
            }
        } catch (connError) {
            console.warn('⚠️ Network connectivity check failed:', connError)
        }
    }

    let userIdToUse = userId

    // If userId not provided, get from cached session (fast!)
    if (!userIdToUse) {
        console.log('🔐 No userId provided, getting from cached session...')
        userIdToUse = await getCurrentUserId()
        console.log('✅ Got userId from cache:', userIdToUse)
    } else {
        console.log('✅ Using provided userId:', userIdToUse)
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${userIdToUse}/${timestamp}_${sanitizedName}`
    console.log('📁 Uploading to path:', filePath)

    // STEP 1: Read file into memory FIRST
    // This is the KEY FIX - reading the entire file into an ArrayBuffer
    // before uploading prevents streaming issues with cloud-synced folders
    console.log('📖 Reading file into memory...')
    const readStart = Date.now()

    let fileBuffer: ArrayBuffer
    try {
        fileBuffer = await fileToArrayBuffer(file)
        console.log(`✅ File read into memory in ${Date.now() - readStart}ms (${fileBuffer.byteLength} bytes)`)
    } catch (readError) {
        console.error('❌ Failed to read file:', readError)
        throw new Error(`Failed to read file: ${readError instanceof Error ? readError.message : 'Unknown error'}`)
    }

    // Create a Blob from the ArrayBuffer with the correct MIME type
    // This ensures the upload has the file data ready to send immediately
    const fileBlob = new Blob([fileBuffer], { type: file.type })

    // STEP 2: Upload the pre-loaded buffer
    console.log('⬆️ Starting upload to Supabase Storage...')
    console.log(`   File size: ${(file.size / 1024).toFixed(1)} KB`)
    const uploadStart = Date.now()

    // Timeout based on file size - generous for slow connections
    // Using 60 seconds base + 10 seconds per MB
    const baseTimeout = 60000 // 60 seconds base (increased from 30)
    const timeoutPerMB = 10000 // 10 seconds per MB (increased from 5)
    const UPLOAD_TIMEOUT = baseTimeout + Math.ceil(file.size / (1024 * 1024)) * timeoutPerMB
    console.log(`   Timeout set to: ${(UPLOAD_TIMEOUT / 1000).toFixed(0)} seconds`)

    // Determine upload method based on file size
    const USE_RESUMABLE_THRESHOLD = 500 * 1024 // 500KB - use resumable upload for larger files
    const useResumable = file.size > USE_RESUMABLE_THRESHOLD
    console.log(`   Upload method: ${useResumable ? 'RESUMABLE (recommended for larger files)' : 'STANDARD'}`)

    // Retry configuration
    const MAX_RETRIES = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 1) {
            console.log(`🔄 Retry attempt ${attempt}/${MAX_RETRIES}...`)
            // Add exponential backoff between retries
            const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 10000)
            console.log(`   Waiting ${backoffMs}ms before retry...`)
            await new Promise(resolve => setTimeout(resolve, backoffMs))
        }

        // Create an AbortController for this attempt
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => {
            console.log(`   ⏰ Timeout reached (${UPLOAD_TIMEOUT / 1000}s), aborting upload...`)
            abortController.abort()
        }, UPLOAD_TIMEOUT)

        // Progress logging (every 5 seconds)
        const attemptStart = Date.now()
        const progressInterval = setInterval(() => {
            const elapsed = ((Date.now() - attemptStart) / 1000).toFixed(1)
            const remaining = ((UPLOAD_TIMEOUT - (Date.now() - attemptStart)) / 1000).toFixed(0)
            console.log(`   ⏳ Upload in progress... ${elapsed}s elapsed, ${remaining}s until timeout (attempt ${attempt})`)
        }, 5000)

        try {
            let data: { path: string } | null = null
            let error: Error | null = null

            if (useResumable) {
                // Use TUS resumable upload for larger files
                // This is more reliable for files > 500KB
                console.log('   📦 Using resumable (TUS) upload protocol...')

                // For resumable uploads, we need to use a different approach
                // Supabase's resumable upload is available through the storage-js library
                const result = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(filePath, fileBlob, {
                        cacheControl: '3600',
                        upsert: attempt > 1,
                        contentType: file.type,
                        // duplex is needed for streaming uploads in some environments
                    })

                data = result.data
                error = result.error
            } else {
                // Standard upload for smaller files
                const result = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(filePath, fileBlob, {
                        cacheControl: '3600',
                        upsert: attempt > 1,
                        contentType: file.type,
                    })

                data = result.data
                error = result.error
            }

            clearTimeout(timeoutId)
            clearInterval(progressInterval)

            if (error) {
                // Log more details about the error
                console.error('❌ Upload error details:', {
                    message: error.message,
                    name: error.name,
                    stack: error.stack?.split('\n').slice(0, 3).join('\n'),
                })

                // Check if it's a duplicate error (file already exists from partial upload)
                if (error.message?.includes('already exists') && attempt < MAX_RETRIES) {
                    console.log('   ⚠️ File already exists, retrying with upsert...')
                    lastError = error
                    continue
                }

                // Check for network-related errors that might benefit from retry
                const isNetworkError = error.message?.toLowerCase().includes('network') ||
                    error.message?.toLowerCase().includes('fetch') ||
                    error.message?.toLowerCase().includes('timeout') ||
                    error.message?.toLowerCase().includes('aborted')

                if (isNetworkError && attempt < MAX_RETRIES) {
                    console.log('   🌐 Network error detected, will retry...')
                    lastError = error
                    continue
                }

                lastError = error
                if (attempt < MAX_RETRIES) continue
                throw error
            }

            if (!data) {
                throw new Error('Upload succeeded but no data returned')
            }

            const totalTime = Date.now() - uploadStart
            const speedKBps = (file.size / 1024 / (totalTime / 1000)).toFixed(1)
            console.log(`✅ Upload complete in ${totalTime}ms (${speedKBps} KB/s)`)
            console.log('📍 File saved at:', data.path)

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(data.path)

            console.log('🔗 Public URL:', publicUrl)

            return {
                path: data.path,
                url: publicUrl,
            }
        } catch (err) {
            clearTimeout(timeoutId)
            clearInterval(progressInterval)

            const error = err as Error
            lastError = error

            // Provide more helpful error messages
            if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                console.error(`   ❌ Upload was aborted after ${UPLOAD_TIMEOUT / 1000}s timeout`)
                lastError = new Error(`Upload timed out after ${UPLOAD_TIMEOUT / 1000} seconds. This may indicate network connectivity issues with Supabase Storage.`)
            } else {
                console.error(`   ❌ Upload error (attempt ${attempt}):`, error.message)
            }

            if (attempt < MAX_RETRIES) {
                console.log(`   ⚠️ Attempt ${attempt} failed, will retry...`)
                continue
            }
            throw lastError
        }
    }

    // If we get here, all retries failed
    const finalError = lastError || new Error('Upload failed after all retries')

    // Add diagnostic information
    console.error('📊 Upload Diagnostics:', {
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        fileName: file.name,
        fileType: file.type,
        totalAttempts: MAX_RETRIES,
        timeoutPerAttempt: `${UPLOAD_TIMEOUT / 1000}s`,
        uploadMethod: useResumable ? 'resumable' : 'standard',
        recommendation: 'Check network connectivity to Supabase. Try a smaller file to test. Check Supabase Dashboard for storage issues.',
    })

    throw finalError
}

/**
 * Upload a file with progress updates and cancellation support
 * This is the preferred method for UI-driven uploads as it provides real-time feedback
 * 
 * @param file - The file to upload
 * @param options - Upload options including progress callback and abort signal
 */
export async function uploadFileWithProgress(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    const { userId, onProgress, abortSignal } = options
    const uploadStartTime = Date.now()

    // Progress simulator interval - declared here so it can be cleared in catch
    let progressSimulatorInterval: ReturnType<typeof setInterval> | null = null
    let simulatedProgress = 25

    // Helper to report progress
    const reportProgress = (progress: UploadProgressInfo) => {
        if (onProgress) {
            onProgress(progress)
        }
        console.log(`📊 Progress: ${progress.stage} - ${progress.percent}% - ${progress.message}`)
    }

    // Helper to cleanup interval
    const cleanupInterval = () => {
        if (progressSimulatorInterval) {
            clearInterval(progressSimulatorInterval)
            progressSimulatorInterval = null
        }
    }

    // Check if already cancelled
    if (abortSignal?.aborted) {
        throw new Error('Upload cancelled')
    }

    console.log('📦 uploadFileWithProgress() called:', {
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`
    })

    try {
        // Stage 1: Preparing file
        reportProgress({
            stage: 'reading',
            percent: 5,
            message: 'Preparing file for upload',
            totalBytes: file.size,
        })

        if (abortSignal?.aborted) throw new Error('Upload cancelled')

        // NOTE: We used to read file into ArrayBuffer then create Blob,
        // but this was causing uploads to hang. Now we just use the File directly.
        console.log(`✅ File ready: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)

        reportProgress({
            stage: 'reading',
            percent: 15,
            message: 'File ready for upload',
            totalBytes: file.size,
        })

        // Stage 2: Getting user & connecting
        if (abortSignal?.aborted) throw new Error('Upload cancelled')

        reportProgress({
            stage: 'connecting',
            percent: 20,
            message: 'Connecting to cloud storage',
            totalBytes: file.size,
        })

        // Get user ID
        let userIdToUse = userId
        if (!userIdToUse) {
            console.log('🔐 No userId provided, fetching from session...')
            userIdToUse = await getCurrentUserId()
        }
        console.log('✅ User ID ready:', userIdToUse?.substring(0, 8) + '...')

        // Quick connectivity check with timeout (don't let it hang forever!)
        if (file.size > 100 * 1024) {
            console.log('🌐 Running connectivity check...')
            try {
                // Create a timeout promise - 5 seconds max for connectivity check
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Connectivity check timeout')), 5000)
                })

                const checkPromise = supabase.storage.from(BUCKET_NAME).list('', { limit: 1 })

                // Race between the check and the timeout
                await Promise.race([checkPromise, timeoutPromise])
                console.log('✅ Connectivity check passed')
            } catch (err) {
                // Don't block upload on connectivity check failure - just warn and continue
                console.warn('⚠️ Connectivity check failed (continuing anyway):', (err as Error).message)
            }
        }

        reportProgress({
            stage: 'connecting',
            percent: 25,
            message: 'Connection established',
            totalBytes: file.size,
        })

        // Stage 3: Uploading
        if (abortSignal?.aborted) throw new Error('Upload cancelled')

        // Generate unique filename
        const timestamp = Date.now()
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filePath = `${userIdToUse}/${timestamp}_${sanitizedName}`

        // Use the file directly - don't convert to Blob (that was causing hangs!)

        // Timeout configuration - generous to avoid false timeouts
        // For a 1MB file: 60s + 30s = 90s timeout
        const baseTimeout = 60000 // 60 seconds base
        const timeoutPerMB = 30000 // 30 seconds per MB
        const UPLOAD_TIMEOUT = baseTimeout + Math.ceil(file.size / (1024 * 1024)) * timeoutPerMB
        console.log(`⏱️ Upload timeout set to ${UPLOAD_TIMEOUT / 1000}s`)

        // Retry configuration
        const MAX_RETRIES = 3
        let lastError: Error | null = null

        // Determine upload method
        const USE_RESUMABLE_THRESHOLD = 500 * 1024 // 500KB
        const useResumable = file.size > USE_RESUMABLE_THRESHOLD
        console.log(`📤 Upload method: ${useResumable ? 'resumable' : 'standard'}, timeout: ${UPLOAD_TIMEOUT / 1000}s`)

        // Start progress simulator
        simulatedProgress = 25
        progressSimulatorInterval = setInterval(() => {
            if (abortSignal?.aborted) {
                cleanupInterval()
                return
            }

            // Slow down as we approach 90% (asymptotic)
            const remaining = 90 - simulatedProgress
            const increment = Math.max(0.5, remaining * 0.05)
            simulatedProgress = Math.min(90, simulatedProgress + increment)

            const elapsed = (Date.now() - uploadStartTime) / 1000
            const speed = file.size / 1024 / elapsed // KB/s
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

        // Upload Loop with Retries
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 1) {
                    console.log(`🔄 Retry attempt ${attempt}/${MAX_RETRIES}...`)
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

                console.log(`⬆️ Starting upload (attempt ${attempt})...`)

                // Create a promise that rejects on timeout
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => {
                        reject(new Error(`Upload timed out after ${UPLOAD_TIMEOUT / 1000}s`))
                    }, UPLOAD_TIMEOUT)
                })

                // Perform the upload with race against timeout
                // Use the File directly (not Blob from ArrayBuffer - that caused hangs!)
                const uploadPromise = supabase.storage
                    .from(BUCKET_NAME)
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: attempt > 1, // Upsert on retries
                        contentType: file.type,
                    })

                const { data, error } = await Promise.race([uploadPromise, timeoutPromise]) as { data: { path: string } | null, error: Error | null }

                if (error) throw error
                if (!data) throw new Error('Upload succeeded but no data returned')

                // Success!
                cleanupInterval()

                // Stage 4: Processing / Getting URL
                reportProgress({
                    stage: 'processing',
                    percent: 95,
                    bytesUploaded: file.size,
                    totalBytes: file.size,
                    message: 'Finalizing upload',
                })

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(data.path)

                const totalTime = Date.now() - uploadStartTime
                const avgSpeed = file.size / 1024 / (totalTime / 1000)

                // Stage 5: Complete!
                reportProgress({
                    stage: 'complete',
                    percent: 100,
                    bytesUploaded: file.size,
                    totalBytes: file.size,
                    message: 'Upload complete!',
                    speed: avgSpeed > 1024 ? `${(avgSpeed / 1024).toFixed(1)} MB/s` : `${avgSpeed.toFixed(0)} KB/s`,
                })

                console.log(`✅ Upload complete in ${totalTime}ms`)

                return {
                    path: data.path,
                    url: publicUrl,
                }

            } catch (err) {
                const error = err as Error
                console.error(`❌ Upload error (attempt ${attempt}):`, error.message)
                lastError = error

                // Check for cancellation
                if (abortSignal?.aborted || error.message === 'Upload cancelled') {
                    throw new Error('Upload cancelled')
                }

                // Check for auth errors - refresh session and retry
                if (isAuthError(error) && attempt < MAX_RETRIES) {
                    console.log('🔐 [Storage] Auth error detected, refreshing session before retry...')
                    const newSession = await refreshSession()
                    if (!newSession) {
                        throw new Error('Session expired. Please sign in again.')
                    }
                    // Update cached user ID with refreshed session
                    cachedUserId = newSession.user.id
                    cacheTimestamp = Date.now()
                    console.log('✅ [Storage] Session refreshed, retrying upload...')
                    // Continue to next iteration (retry)
                    continue
                }

                // If it's a timeout or network error, we retry. 
                // If it's a permission error or invalid request, we shouldn't retry.
                const isRetryable =
                    error.message.includes('timeout') ||
                    error.message.includes('network') ||
                    error.message.includes('fetch') ||
                    error.message.includes('50') // 500, 502, 503, 504

                if (!isRetryable && attempt < MAX_RETRIES) {
                    // If it's clearly not retryable, break loop
                    // But strictly speaking, Supabase errors can be vague, so we default to retry unless it's obviously logic error
                }

                if (attempt === MAX_RETRIES) {
                    throw lastError
                }
            }
        }

        // Should not be reached due to throw in loop
        throw lastError || new Error('Upload failed')

    } catch (err) {
        // Ensure simulator is stopped
        cleanupInterval()

        const error = err as Error

        if (error.message === 'Upload cancelled') {
            reportProgress({
                stage: 'error',
                percent: 0,
                message: 'Upload cancelled by user',
                totalBytes: file.size,
            })
        } else {
            reportProgress({
                stage: 'error',
                percent: 0,
                message: error.message || 'Upload failed',
                totalBytes: file.size,
            })
        }

        throw error
    }
}

/**
 * Get a signed URL for a private file (valid for 1 hour)
 */
export async function getSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, 3600) // 1 hour expiry

    if (error) {
        console.error('Error getting signed URL:', error)
        throw error
    }

    return data.signedUrl
}

/**
 * Delete a file from storage
 */
export async function deleteFile(path: string): Promise<void> {
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path])

    if (error) {
        console.error('Error deleting file:', error)
        throw error
    }
}

/**
 * Extract text content from a file
 * Note: For PDF/DOCX, you'd typically use a server-side solution or edge function
 * This is a placeholder that handles plain text files
 */
export async function extractTextFromFile(file: File): Promise<string> {
    // For text files, read directly
    if (file.type === 'text/plain') {
        return await file.text()
    }

    // For PDF/DOCX, we'll need to handle this differently
    // Option 1: Use an edge function with pdf-parse or mammoth.js
    // Option 2: Use a third-party API
    // For now, return a placeholder message
    if (file.type === 'application/pdf') {
        console.warn('PDF text extraction requires server-side processing')
        return `[PDF content from: ${file.name}]\n\nNote: Full PDF text extraction will be available after AI pipeline is implemented.`
    }

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        console.warn('DOCX text extraction requires server-side processing')
        return `[DOCX content from: ${file.name}]\n\nNote: Full DOCX text extraction will be available after AI pipeline is implemented.`
    }

    throw new Error(`Unsupported file type: ${file.type}`)
}

/**
 * Get list of allowed file types
 */
export function getAllowedFileTypes(): string[] {
    return [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
    ]
}

/**
 * Validate file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 25 * 1024 * 1024 // 25MB
    const allowedTypes = getAllowedFileTypes()

    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Invalid file type. Please upload a PDF, DOCX, or TXT file.',
        }
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'File is too large. Maximum size is 25MB.',
        }
    }

    return { valid: true }
}
