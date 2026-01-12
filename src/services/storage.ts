import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'documents'

export interface UploadResult {
    path: string
    url: string
}

/**
 * CACHED USER SESSION
 * Same pattern as other services - cache auth to avoid repeated network calls
 */
let cachedUserId: string | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION_MS = 30000 // 30 seconds

// Listen for auth changes to invalidate cache
supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        cachedUserId = null
        cacheTimestamp = 0
    }
})

/**
 * Get the current user ID with caching
 */
async function getCurrentUserId(): Promise<string> {
    const now = Date.now()
    
    // Use cached value if still valid
    if (cachedUserId && (now - cacheTimestamp) < CACHE_DURATION_MS) {
        return cachedUserId
    }
    
    // Get fresh session
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
        console.error('Auth error:', error)
        throw new Error('Authentication error')
    }
    
    if (!session?.user) {
        throw new Error('Not authenticated')
    }
    
    // Cache the result
    cachedUserId = session.user.id
    cacheTimestamp = now
    
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
    })

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

    // Timeout based on file size - but now it should be MUCH faster since file is in memory
    // Using 30 seconds base + 5 seconds per MB (generous for slow connections)
    const baseTimeout = 30000 // 30 seconds base
    const timeoutPerMB = 5000 // 5 seconds per MB
    const UPLOAD_TIMEOUT = baseTimeout + Math.ceil(file.size / (1024 * 1024)) * timeoutPerMB
    console.log(`   Timeout set to: ${(UPLOAD_TIMEOUT / 1000).toFixed(0)} seconds`)

    // Retry configuration
    const MAX_RETRIES = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 1) {
            console.log(`🔄 Retry attempt ${attempt}/${MAX_RETRIES}...`)
        }

        // Create a timeout promise for this attempt
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Upload timed out after ${UPLOAD_TIMEOUT / 1000} seconds (attempt ${attempt}/${MAX_RETRIES})`))
            }, UPLOAD_TIMEOUT)
        })

        // Progress logging (every 5 seconds now since uploads should be faster)
        const attemptStart = Date.now()
        const progressInterval = setInterval(() => {
            const elapsed = ((Date.now() - attemptStart) / 1000).toFixed(1)
            console.log(`   ⏳ Upload in progress... ${elapsed}s elapsed (attempt ${attempt})`)
        }, 5000)

        try {
            // Race between upload and timeout
            // Upload the Blob (which has the file data already in memory)
            const { data, error } = await Promise.race([
                supabase.storage
                    .from(BUCKET_NAME)
                    .upload(filePath, fileBlob, {
                        cacheControl: '3600',
                        upsert: attempt > 1, // Allow upsert on retries
                        contentType: file.type, // Explicitly set content type
                    }),
                timeoutPromise,
            ]) as { data: { path: string } | null; error: Error | null }

            clearInterval(progressInterval)

            if (error) {
                // Check if it's a duplicate error (file already exists from partial upload)
                if (error.message?.includes('already exists') && attempt < MAX_RETRIES) {
                    console.log('   ⚠️ File already exists, retrying with upsert...')
                    lastError = error
                    continue
                }
                console.error('❌ Upload error:', error)
                lastError = error
                if (attempt < MAX_RETRIES) continue
                throw error
            }

            if (!data) {
                throw new Error('Upload succeeded but no data returned')
            }

            const totalTime = Date.now() - uploadStart
            console.log(`✅ Upload complete in ${totalTime}ms (${(file.size / 1024 / (totalTime / 1000)).toFixed(1)} KB/s)`)
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
            clearInterval(progressInterval)
            lastError = err as Error

            if (attempt < MAX_RETRIES) {
                console.log(`   ⚠️ Attempt ${attempt} failed, waiting before retry...`)
                await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2s before retry
                continue
            }
            throw err
        }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Upload failed after all retries')
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
