import { supabase, ensureFreshSession } from '@/lib/supabase'
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
 * Get all documents for the current user with optional filtering.
 * Timeout and dead-socket handling is done by the resilient fetch wrapper in supabase.ts.
 */
export async function getDocuments(
    filter: DocumentFilter = 'all',
): Promise<DocumentWithMeta[]> {
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
        case 'recent': {
            const sevenDaysAgo = new Date()
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
            query = query.gte('created_at', sevenDaysAgo.toISOString())
            break
        }
    }

    const { data, error } = await query

    if (error) {
        throw error
    }

    return (data || []).map(doc => ({
        ...doc,
        original_text: null,
        original_filename: null,
        tags: null,
        image_url: null,
        readTime: doc.read_time_minutes ? `${doc.read_time_minutes} min read` : 'Quick read',
        formattedDate: formatDate(doc.created_at),
    })) as unknown as DocumentWithMeta[]
}

/**
 * Get a single document by ID.
 */
export async function getDocument(id: string): Promise<Document | null> {
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        if (error.code === 'PGRST116') {
            return null
        }
        throw error
    }

    return data
}

/**
 * Create a new document.
 * Gets user ID from the current session via ensureFreshSession().
 */
export async function createDocument(document: Omit<DocumentInsert, 'user_id'>): Promise<Document> {
    const session = await ensureFreshSession()
    if (!session?.user) {
        throw new Error('Not authenticated. Please sign in again.')
    }

    const { data, error } = await supabase
        .from('documents')
        .insert({
            ...document,
            user_id: session.user.id,
        })
        .select()
        .single()

    if (error) {
        throw error
    }

    return data
}

export async function updateDocument(id: string, updates: DocumentUpdate): Promise<Document> {
    const { data, error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        throw error
    }

    return data
}

export async function deleteDocument(id: string): Promise<void> {
    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

    if (error) {
        throw error
    }
}

export async function toggleStar(id: string, isStarred: boolean): Promise<void> {
    await updateDocument(id, { is_starred: isStarred })
}

function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

export function estimateReadTime(text: string): number {
    const wordsPerMinute = 200
    const words = text.trim().split(/\s+/).length
    return Math.max(1, Math.ceil(words / wordsPerMinute))
}
