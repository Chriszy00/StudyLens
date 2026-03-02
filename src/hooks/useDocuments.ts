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

export const documentKeys = {
    all: ['documents'] as const,
    lists: () => [...documentKeys.all, 'list'] as const,
    list: (filter: DocumentFilter) => [...documentKeys.lists(), filter] as const,
    details: () => [...documentKeys.all, 'detail'] as const,
    detail: (id: string) => [...documentKeys.details(), id] as const,
}

export function useDocuments(filter: DocumentFilter = 'all') {
    return useQuery({
        queryKey: documentKeys.list(filter),
        queryFn: async ({ signal }) => {
            if (signal?.aborted) {
                throw new Error('Query cancelled')
            }
            return getDocuments(filter, signal)
        },
        refetchOnMount: 'always',
        staleTime: 1000 * 5,
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    })
}

export function useDocument(id: string | null | undefined) {
    return useQuery({
        queryKey: documentKeys.detail(id || ''),
        queryFn: async ({ signal }) => {
            return getDocument(id!, signal)
        },
        enabled: !!id,
    })
}

export function useCreateDocument() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (document: Omit<DocumentInsert, 'user_id'>) => {
            return createDocument(document)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
        },
    })
}

export function useUpdateDocument() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: DocumentUpdate }) =>
            updateDocument(id, updates),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) })
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
        },
    })
}

export function useDeleteDocument() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => deleteDocument(id),
        onSuccess: (_, id) => {
            queryClient.removeQueries({ queryKey: documentKeys.detail(id) })
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
        },
    })
}

export function useToggleStar() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, isStarred }: { id: string; isStarred: boolean }) =>
            toggleStar(id, isStarred),
        onMutate: async ({ id, isStarred }) => {
            await queryClient.cancelQueries({ queryKey: documentKeys.lists() })

            const previousLists = queryClient.getQueriesData({ queryKey: documentKeys.lists() })

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
            if (context?.previousLists) {
                context.previousLists.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
        },
    })
}
