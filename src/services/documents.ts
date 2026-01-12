import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Document = Database['public']['Tables']['documents']['Row']
type DocumentInsert = Database['public']['Tables']['documents']['Insert']
type DocumentUpdate = Database['public']['Tables']['documents']['Update']

export type DocumentFilter = 'all' | 'starred' | 'drafts' | 'recent'

export interface DocumentWithMeta extends Document {
    readTime: string
    formattedDate: string
}

/**
 * CACHED USER SESSION
 * Same pattern as learning.ts - cache auth to avoid repeated network calls
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
 * Get all documents for the current user with optional filtering
 */
export async function getDocuments(filter: DocumentFilter = 'all'): Promise<DocumentWithMeta[]> {
    let query = supabase
        .from('documents')
        .select('id, title, type, storage_path, created_at, updated_at, is_starred, is_draft, read_time_minutes, user_id')
        .order('created_at', { ascending: false })

    switch (filter) {
        case 'starred':
            query = query.eq('is_starred', true)
            break
        case 'drafts':
            query = query.eq('is_draft', true)
            break
        case 'recent':
            // Last 7 days
            const sevenDaysAgo = new Date()
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
            query = query.gte('created_at', sevenDaysAgo.toISOString())
            break
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching documents:', error)
        throw error
    }

    // Map to DocumentWithMeta and handle missing original_text
    return (data || []).map(doc => ({
        ...doc,
        // Map back to expected properties if needed, or update interfaces
        // The Document interface expects 'type' and 'storage_path' from database types
        // But let's check if DocumentWithMeta expects 'file_type' or 'file_path'?
        // DocumentWithMeta extends Document
        // Database Document Row has: type, storage_path, original_text
        // So we strictly follow the database schema now.

        // Ensure missing properties are handled if TS complains
        original_text: null, // content not fetched
        original_filename: null, // not fetched in list
        tags: null, // not fetched in list
        image_url: null, // not fetched in list

        readTime: doc.read_time_minutes ? `${doc.read_time_minutes} min read` : 'Quick read',
        formattedDate: formatDate(doc.created_at),
    })) as unknown as DocumentWithMeta[]
}

/**
 * Get a single document by ID
 */
export async function getDocument(id: string): Promise<Document | null> {
    console.log('📄 [getDocument] Called with id:', id)
    const startTime = Date.now()

    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single()

    console.log('📄 [getDocument] Supabase query completed in', Date.now() - startTime, 'ms')

    if (error) {
        console.error('📄 [getDocument] Error:', error)
        return null
    }

    console.log('📄 [getDocument] Returning document:', data?.title)
    return data
}

/**
 * Create a new document
 */
export async function createDocument(document: Omit<DocumentInsert, 'user_id'>): Promise<Document> {
    const userId = await getCurrentUserId()

    const { data, error } = await supabase
        .from('documents')
        .insert({
            ...document,
            user_id: userId,
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating document:', error)
        throw error
    }

    return data
}

/**
 * Update an existing document
 */
export async function updateDocument(id: string, updates: DocumentUpdate): Promise<Document> {
    const { data, error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        console.error('Error updating document:', error)
        throw error
    }

    return data
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting document:', error)
        throw error
    }
}

/**
 * Toggle star status on a document
 */
export async function toggleStar(id: string, isStarred: boolean): Promise<void> {
    await updateDocument(id, { is_starred: isStarred })
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

/**
 * Estimate read time based on text content
 */
export function estimateReadTime(text: string): number {
    const wordsPerMinute = 200
    const words = text.trim().split(/\s+/).length
    return Math.max(1, Math.ceil(words / wordsPerMinute))
}
