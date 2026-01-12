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
            console.log('🔍 [useSummary] queryFn RESULT:', result ? 'Got summary' : 'No summary')
            return result
        },
        enabled: !!documentId,
        // Dynamic polling based on processing status
        refetchInterval: (query) => {
            const status = query.state.data?.processing_status
            // Poll every 1.5s while processing, stop when done
            return (status === 'processing' || status === 'pending') ? 1500 : false
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
 * @example
 * const processMutation = useProcessDocument()
 * 
 * // With default options (all enabled)
 * processMutation.mutate({ documentId: 'xxx' })
 * 
 * // With custom options
 * processMutation.mutate({
 *   documentId: 'xxx',
 *   options: {
 *     generateShortSummary: true,
 *     generateDetailedSummary: false,
 *     extractKeywords: true,
 *     generateQuestions: false,
 *   }
 * })
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
        onSuccess: (_, { documentId }) => {
            // Invalidate summary to trigger refetch (which will start polling)
            queryClient.invalidateQueries({
                queryKey: summaryKeys.detail(documentId)
            })
        },
    })
}

