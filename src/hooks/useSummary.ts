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
        queryFn: async ({ signal }) => {
            console.log('🔍 [useSummary] queryFn EXECUTING for documentId:', documentId)
            // FIX: Pass the abort signal to getSummary
            const result = await getSummary(documentId!, signal)
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
 * 
 * OPTIMISTIC UPDATE: When we start processing, immediately set status to 'processing'
 * in the cache. This ensures the polling starts right away, and the UI shows a loading state.
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
            console.log('🔄 [useProcessDocument] Starting mutation, setting optimistic processing state')

            // Cancel any outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({
                queryKey: summaryKeys.detail(documentId)
            })

            // Snapshot the previous value
            const previousSummary = queryClient.getQueryData(summaryKeys.detail(documentId))

            // OPTIMISTIC UPDATE: Set status to 'processing' immediately
            // This ensures the refetchInterval sees 'processing' and starts polling!
            queryClient.setQueryData(summaryKeys.detail(documentId), (old: unknown) => {
                if (old && typeof old === 'object') {
                    return {
                        ...old,
                        processing_status: 'processing',
                        error_message: null
                    }
                }
                // If no previous data, create a minimal processing stub
                return {
                    processing_status: 'processing',
                    short_summary: null,
                    detailed_summary: null,
                    bullet_points: null,
                    keywords: null,
                    study_questions: null,
                    citations: null,
                }
            })

            // Return context for rollback
            return { previousSummary }
        },

        onSuccess: (_data, { documentId }) => {
            console.log('✅ [useProcessDocument] Mutation succeeded - polling will continue until status changes')

            // Don't set cache to 'completed' here!
            // The edge function is still processing. The polling will pick up the real status.
            // Just invalidate to trigger a fresh fetch
            queryClient.invalidateQueries({
                queryKey: summaryKeys.detail(documentId)
            })

            // Also invalidate the "all summaries" key
            queryClient.invalidateQueries({
                queryKey: summaryKeys.all
            })
        },

        onError: (error, { documentId }, context) => {
            console.error('❌ [useProcessDocument] Mutation failed:', error)

            // Rollback to previous state on error
            if (context?.previousSummary) {
                queryClient.setQueryData(summaryKeys.detail(documentId), context.previousSummary)
            }
        }
    })
}

