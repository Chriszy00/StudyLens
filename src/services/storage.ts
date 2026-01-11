import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'documents'

export interface UploadResult {
    path: string
    url: string
}

/**
 * Upload a file to Supabase Storage
 * Files are stored in user-specific folders: {user_id}/{filename}
 */
export async function uploadFile(file: File): Promise<UploadResult> {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('User not authenticated')
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${user.id}/${timestamp}_${sanitizedName}`

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        })

    if (error) {
        console.error('Error uploading file:', error)
        throw error
    }

    // Get the public URL (if bucket is public) or signed URL
    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path)

    return {
        path: data.path,
        url: publicUrl,
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
