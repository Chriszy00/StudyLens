/**
 * Custom React Query hooks for document data fetching
 * 
 * WHY CUSTOM HOOKS?
 * -----------------
 * 1. Reusability: Use the same query logic across multiple components
 * 2. Encapsulation: Query keys, options, and error handling in one place
 * 3. Testing: Easier to mock and test in isolation
 * 4. Maintainability: Change query logic in one place, updates everywhere
 * 5. Type Safety: TypeScript types defined once and reused
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    getDocuments,
    getDocument,
    createDocument,
    updateDocument,
    deleteDocument,
    toggleStar,
    type DocumentFilter,
    type DocumentWithMeta,
} from '@/services/documents'
import type { Database } from '@/lib/database.types'

type DocumentInsert = Database['public']['Tables']['documents']['Insert']
type DocumentUpdate = Database['public']['Tables']['documents']['Update']

// ============================================
// QUERY KEYS
// ============================================
// Centralized query keys prevent typos and make refactoring easier
export const documentKeys = {
    all: ['documents'] as const,
    lists: () => [...documentKeys.all, 'list'] as const,
    list: (filter: DocumentFilter) => [...documentKeys.lists(), filter] as const,
    details: () => [...documentKeys.all, 'detail'] as const,
    detail: (id: string) => [...documentKeys.details(), id] as const,
}

// ============================================
// QUERIES
// ============================================

/**
 * Fetch all documents with optional filtering
 * 
 * @param filter - 'all' | 'starred' | 'drafts' | 'recent'
 * @returns Query result with documents array
 * 
 * @example
 * const { data: documents, isLoading } = useDocuments('starred')
 */
export function useDocuments(filter: DocumentFilter = 'all') {
    console.log('📚 [useDocuments] Hook called with filter:', filter)

    const query = useQuery({
        queryKey: documentKeys.list(filter),
        queryFn: async () => {
            console.log('📚 [useDocuments] 🔄 FETCHING documents from Supabase...')
            const result = await getDocuments(filter)
            console.log('📚 [useDocuments] ✅ Fetched', result.length, 'documents')
            return result
        },
        // IMPORTANT: Always refetch when component mounts to ensure fresh data
        // This is crucial for seeing newly uploaded documents
        refetchOnMount: 'always',
        // Keep stale time low for document lists - we want fresh data
        staleTime: 1000 * 5, // 5 seconds (was 2 minutes - too long!)
    })

    console.log('📚 [useDocuments] Query state:', {
        status: query.status,
        fetchStatus: query.fetchStatus,
        dataLength: query.data?.length ?? 0,
        isStale: query.isStale,
    })

    return query
}

/**
 * Fetch a single document by ID
 * 
 * @param id - Document UUID (null/undefined will disable the query)
 * @returns Query result with document data
 * 
 * @example
 * const { data: document } = useDocument(documentId)
 */
export function useDocument(id: string | null | undefined) {
    // 🔍 DIAGNOSTIC LOGGING - Remove after debugging
    console.log('🔍 [useDocument] Hook called with id:', id)
    console.log('🔍 [useDocument] enabled condition (!!id):', !!id)

    return useQuery({
        queryKey: documentKeys.detail(id || ''),
        queryFn: async () => {
            console.log('🔍 [useDocument] queryFn EXECUTING for id:', id)
            const result = await getDocument(id!)
            console.log('🔍 [useDocument] queryFn RESULT:', result ? `Document: ${result.title}` : 'No document')
            return result
        },
        enabled: !!id, // Only fetch if we have an ID
    })
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new document
 * Automatically invalidates the documents list on success
 * 
 * @example
 * const createMutation = useCreateDocument()
 * createMutation.mutate({ title: 'My Doc', type: 'short', ... })
 */
export function useCreateDocument() {
    const queryClient = useQueryClient()
    console.log('🆕 [useCreateDocument] Hook initialized')

    return useMutation({
        mutationFn: async (document: Omit<DocumentInsert, 'user_id'>) => {
            console.log('🆕 [useCreateDocument] 🚀 MUTATION STARTED - creating document:', document.title)
            const result = await createDocument(document)
            console.log('🆕 [useCreateDocument] ✅ Document created with ID:', result.id)
            return result
        },
        onSuccess: (data) => {
            console.log('🆕 [useCreateDocument] 🎯 onSuccess triggered!')
            console.log('🆕 [useCreateDocument] 📋 Invalidating query key:', documentKeys.lists())

            // Log current cache state before invalidation
            const cachedQueries = queryClient.getQueriesData({ queryKey: documentKeys.lists() })
            console.log('🆕 [useCreateDocument] 📦 Cache BEFORE invalidation:', cachedQueries.length, 'queries cached')

            // Invalidate all document lists to show the new document
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() })

            console.log('🆕 [useCreateDocument] ✅ Cache invalidation dispatched')
        },
        onError: (error) => {
            console.error('🆕 [useCreateDocument] ❌ Mutation FAILED:', error)
        },
    })
}

/**
 * Update an existing document
 * Invalidates both the specific document and all lists
 * 
 * @example
 * const updateMutation = useUpdateDocument()
 * updateMutation.mutate({ id: 'xxx', updates: { title: 'New Title' } })
 */
export function useUpdateDocument() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: DocumentUpdate }) =>
            updateDocument(id, updates),
        onSuccess: (_, { id }) => {
            // Invalidate this specific document
            queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) })
            // Also invalidate lists (starred status might change which list it appears in)
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
        },
    })
}

/**
 * Delete a document
 * Removes from cache and invalidates lists
 * 
 * @example
 * const deleteMutation = useDeleteDocument()
 * deleteMutation.mutate('document-id')
 */
export function useDeleteDocument() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => deleteDocument(id),
        onSuccess: (_, id) => {
            // Remove from cache immediately
            queryClient.removeQueries({ queryKey: documentKeys.detail(id) })
            // Refresh all lists
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
        },
    })
}

/**
 * Toggle star status on a document
 * Uses optimistic updates for instant UI feedback
 * 
 * @example
 * const starMutation = useToggleStar()
 * starMutation.mutate({ id: 'xxx', isStarred: true })
 */
export function useToggleStar() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, isStarred }: { id: string; isStarred: boolean }) =>
            toggleStar(id, isStarred),
        // Optimistic update - update UI before server confirms
        onMutate: async ({ id, isStarred }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: documentKeys.lists() })

            // Snapshot current value for rollback
            const previousLists = queryClient.getQueriesData({ queryKey: documentKeys.lists() })

            // Optimistically update all document lists
            queryClient.setQueriesData(
                { queryKey: documentKeys.lists() },
                (old: DocumentWithMeta[] | undefined) =>
                    old?.map(doc =>
                        doc.id === id ? { ...doc, is_starred: isStarred } : doc
                    )
            )

            return { previousLists }
        },
        onError: (_, __, context) => {
            // Rollback on error
            if (context?.previousLists) {
                context.previousLists.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
        },
        onSettled: () => {
            // Refetch to ensure we're in sync
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
        },
    })
}
