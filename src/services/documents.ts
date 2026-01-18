import { supabase } from '@/lib/supabase'
import { ensureValidSession, getValidSession, isAuthError, warmUpConnection } from '@/lib/sessionManager'
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
 * Get the current user ID with session validation
 */
async function getCurrentUserId(): Promise<string> {
    const now = Date.now()

    if (cachedUserId && (now - cacheTimestamp) < CACHE_DURATION_MS) {
        return cachedUserId
    }

    console.log('📚 [Documents] Validating session...')
    const session = await ensureValidSession()

    if (!session?.user) {
        console.error('❌ [Documents] No valid session after validation')
        throw new Error('Not authenticated. Please sign in again.')
    }

    cachedUserId = session.user.id
    cacheTimestamp = now
    console.log('✅ [Documents] Session validated')

    return cachedUserId
}

/**
 * Lightweight session check for read operations
 */
function ensureReadSession(): void {
    const session = getValidSession()
    if (!session) {
        throw new Error('Session expired. Please refresh the page.')
    }
}

/**
 * Get all documents for the current user with optional filtering
 * 
 * FIX v5: Uses AbortController to ACTUALLY cancel timed-out requests
 * This prevents old requests from blocking new ones after returning from idle.
 */
export async function getDocuments(
    filter: DocumentFilter = 'all',
    signal?: AbortSignal  // Optional: pass React Query's abort signal
): Promise<DocumentWithMeta[]> {
    console.log(`📚 [getDocuments] Called with filter: "${filter}"`)
    const startTime = Date.now()

    // Validate session before making the query
    try {
        ensureReadSession()
    } catch (sessionError) {
        console.error('📚 [getDocuments] Session validation failed:', sessionError)
        throw sessionError
    }

    // If we already have an external abort signal and it's aborted, bail early
    if (signal?.aborted) {
        throw new Error('Request aborted')
    }

    // Configuration
    const QUERY_TIMEOUT_MS = 10000 // Reduced to 10 seconds (was 15)
    const MAX_RETRIES = 2

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // Create AbortController for THIS attempt
        const abortController = new AbortController()
        
        // If external signal is provided, abort our controller when it aborts
        const externalAbortHandler = () => abortController.abort()
        signal?.addEventListener('abort', externalAbortHandler)
        
        // Set timeout to abort the request
        const timeoutId = setTimeout(() => {
            console.log(`📚 [getDocuments] Aborting query for "${filter}" after ${QUERY_TIMEOUT_MS}ms`)
            abortController.abort()
        }, QUERY_TIMEOUT_MS)

        try {
            // Build a FRESH query for each attempt (important!)
            let query = supabase
                .from('documents')
                .select('id, title, type, storage_path, created_at, updated_at, is_starred, is_draft, read_time_minutes, user_id')
                .order('created_at', { ascending: false })

            switch (filter) {
                case 'starred':
                    console.log('📚 [getDocuments] Applying starred filter')
                    query = query.eq('is_starred', true)
                    break
                case 'drafts':
                    console.log('📚 [getDocuments] Applying drafts filter')
                    query = query.eq('is_draft', true)
                    break
                case 'recent':
                    const sevenDaysAgo = new Date()
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
                    console.log('📚 [getDocuments] Applying recent filter (since:', sevenDaysAgo.toISOString(), ')')
                    query = query.gte('created_at', sevenDaysAgo.toISOString())
                    break
                default:
                    console.log('📚 [getDocuments] No filter applied (all documents)')
            }

            console.log('📚 [getDocuments] Executing Supabase query...')
            
            // Execute with abort signal
            const { data, error } = await query.abortSignal(abortController.signal)
            
            // Clear timeout since we got a response
            clearTimeout(timeoutId)
            signal?.removeEventListener('abort', externalAbortHandler)

            const elapsed = Date.now() - startTime
            console.log(`📚 [getDocuments] Query completed in ${elapsed}ms`)

            if (error) {
                console.error(`📚 [getDocuments] ❌ Error for filter "${filter}":`, error)
                
                if (isAuthError(error) && attempt < MAX_RETRIES) {
                    console.log('📚 [getDocuments] Auth error detected, refreshing session for retry...')
                    const { refreshSession } = await import('@/lib/sessionManager')
                    await refreshSession()
                    continue
                }
                throw error
            }

            console.log(`📚 [getDocuments] ✅ Got ${data?.length || 0} documents for filter "${filter}"`)

            return (data || []).map(doc => ({
                ...doc,
                original_text: null,
                original_filename: null,
                tags: null,
                image_url: null,
                readTime: doc.read_time_minutes ? `${doc.read_time_minutes} min read` : 'Quick read',
                formattedDate: formatDate(doc.created_at),
            })) as unknown as DocumentWithMeta[]

        } catch (err) {
            // Clean up
            clearTimeout(timeoutId)
            signal?.removeEventListener('abort', externalAbortHandler)
            
            const elapsed = Date.now() - startTime
            const error = err as Error
            lastError = error
            
            // Check if it was aborted
            if (error.name === 'AbortError' || error.message.includes('aborted')) {
                console.log(`📚 [getDocuments] Query aborted for "${filter}" after ${elapsed}ms (attempt ${attempt})`)
                
                // If it was a timeout abort (not external), warm up connection and retry
                if (!signal?.aborted && attempt < MAX_RETRIES) {
                    console.log('📚 [getDocuments] Timeout detected - warming up connection before retry...')
                    await warmUpConnection()
                    continue
                }
                
                throw new Error(`Query for "${filter}" was cancelled`)
            }
            
            console.error(`📚 [getDocuments] ❌ Exception after ${elapsed}ms (attempt ${attempt}):`, error.message)
            
            if (isAuthError(error) && attempt < MAX_RETRIES) {
                console.log('📚 [getDocuments] Auth error detected, refreshing session for retry...')
                const { refreshSession } = await import('@/lib/sessionManager')
                await refreshSession()
                continue
            }
            
            if (attempt === MAX_RETRIES) {
                throw error
            }
        }
    }

    throw lastError || new Error('getDocuments failed after retries')
}

/**
 * Get a single document by ID
 */
export async function getDocument(id: string, signal?: AbortSignal): Promise<Document | null> {
    console.log('📄 [getDocument] Called with id:', id)
    const startTime = Date.now()

    try {
        ensureReadSession()
    } catch (sessionError) {
        console.error('📄 [getDocument] Session validation failed:', sessionError)
        throw sessionError
    }

    // Create abort controller with timeout
    const abortController = new AbortController()
    const externalAbortHandler = () => abortController.abort()
    signal?.addEventListener('abort', externalAbortHandler)
    
    const timeoutId = setTimeout(() => {
        console.log('📄 [getDocument] Aborting query after 10s')
        abortController.abort()
    }, 10000)

    try {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('id', id)
            .single()
            .abortSignal(abortController.signal)

        clearTimeout(timeoutId)
        signal?.removeEventListener('abort', externalAbortHandler)

        console.log('📄 [getDocument] Supabase query completed in', Date.now() - startTime, 'ms')

        if (error) {
            console.error('📄 [getDocument] Error:', error)
            
            if (isAuthError(error)) {
                throw new Error('Session expired. Please refresh the page.')
            }
            
            return null
        }

        console.log('📄 [getDocument] Returning document:', data?.title)
        return data
    } catch (err) {
        clearTimeout(timeoutId)
        signal?.removeEventListener('abort', externalAbortHandler)
        
        const error = err as Error
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
            // Timeout detected - trigger connection warm-up for next request
            console.log('📄 [getDocument] Timeout detected - triggering connection warm-up...')
            warmUpConnection().catch(() => {}) // Fire and forget
            throw new Error('Document fetch was cancelled')
        }
        throw error
    }
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
