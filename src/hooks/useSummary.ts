/**
 * Custom React Query hooks for AI summaries
 * 
 * This hook demonstrates POLLING - a technique where we repeatedly
 * fetch data at intervals to check for updates. This is useful when:
 * - Server is processing something asynchronously
 * - We need real-time-ish updates without WebSockets
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSummary, processDocument, type AIProcessingOptions } from '@/services/ai'

// ============================================
// QUERY KEYS
// ============================================
export const summaryKeys = {
    all: ['summaries'] as const,
    detail: (documentId: string) => [...summaryKeys.all, documentId] as const,
}

// ============================================
// QUERIES
// ============================================

/**
 * Fetch AI summary for a document with automatic polling during processing
 * 
 * KEY CONCEPT: Dynamic refetchInterval
 * ------------------------------------
 * When the document is being processed (status: 'processing' or 'pending'),
 * we poll every 1.5 seconds to check if it's done. Once complete, we stop.
 * 
 * @param documentId - Document UUID (null/undefined disables query)
 * 
 * @example
 * const { data: summary, isLoading } = useSummary(documentId)
 */
export function useSummary(documentId: string | null | undefined) {
    // 🔍 DIAGNOSTIC LOGGING - Remove after debugging
    console.log('🔍 [useSummary] Hook called with documentId:', documentId)
    console.log('🔍 [useSummary] enabled condition (!!documentId):', !!documentId)

    return useQuery({
        queryKey: summaryKeys.detail(documentId || ''),
        queryFn: async () => {
            console.log('🔍 [useSummary] queryFn EXECUTING for documentId:', documentId)
            const result = await getSummary(documentId!)
            console.log('🔍 [useSummary] queryFn RESULT:', result ? `Got summary (status: ${result.processing_status})` : 'No summary')
            return result
        },
        enabled: !!documentId,

        // CRITICAL: Don't cache null results as "fresh"
        // This ensures we keep polling even if first fetch returns null
        staleTime: 0,

        // Dynamic polling based on processing status
        refetchInterval: (query) => {
            const data = query.state.data
            const status = data?.processing_status

            // If no data yet, poll every 2s (summary might be being created)
            if (!data) {
                console.log('🔍 [useSummary] No data yet, polling...')
                return 2000
            }

            // Poll every 1.5s while processing
            if (status === 'processing' || status === 'pending') {
                console.log('🔍 [useSummary] Processing in progress, polling...')
                return 1500
            }

            // Stop polling when complete or failed
            console.log('🔍 [useSummary] Processing complete, stopping poll')
            return false
        },
        // Don't refetch on window focus while processing
        refetchOnWindowFocus: (query) => {
            const status = query.state.data?.processing_status
            return status !== 'processing' && status !== 'pending'
        },
    })
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Trigger AI processing for a document with configurable options
 * After mutation, the summary query will start polling for results
 */
export function useProcessDocument() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({
            documentId,
            options
        }: {
            documentId: string
            options?: AIProcessingOptions
        }) => processDocument(documentId, options),

        onMutate: async ({ documentId }) => {
            // Cancel any outgoing refetches so they don't overwrite optimistic update
            await queryClient.cancelQueries({
                queryKey: summaryKeys.detail(documentId)
            })
        },

        onSuccess: (_data, { documentId }) => {
            console.log('✅ [useProcessDocument] Mutation succeeded, invalidating cache')

            // Invalidate and immediately refetch to show new data
            queryClient.invalidateQueries({
                queryKey: summaryKeys.detail(documentId)
            })

            // Also invalidate the "all summaries" key
            queryClient.invalidateQueries({
                queryKey: summaryKeys.all
            })
        },

        onError: (error) => {
            console.error('❌ [useProcessDocument] Mutation failed:', error)
        }
    })
}

