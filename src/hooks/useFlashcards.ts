/**
 * Custom React Query hooks for flashcards and study sessions
 * 
 * IMPORTANT PATTERN: Separating Queries from Mutations
 * ----------------------------------------------------
 * Previously, the StudyPage was generating flashcards INSIDE a query.
 * This is problematic because:
 * 1. Queries should be IDEMPOTENT (calling them multiple times = same result)
 * 2. If React Query refetches (on focus, error retry, etc.), it would regenerate cards!
 * 3. Mutations are for operations that CHANGE data
 * 
 * The fix: useFlashcards only READS, useGenerateFlashcards only CREATES
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import {
    getFlashcards,
    getDueFlashcards,
    generateFlashcardsFromDocument,
    recordCardReview,
    startStudySession,
    endStudySession,
    getStudyStats,
    getOverallMastery,
    getAllFlashcardDecks,
} from '@/services/learning'

// ============================================
// QUERY KEYS
// ============================================
export const flashcardKeys = {
    all: ['flashcards'] as const,
    byDocument: (documentId: string) => [...flashcardKeys.all, documentId] as const,
}

export const sessionKeys = {
    all: ['study-sessions'] as const,
    active: (documentId: string) => [...sessionKeys.all, 'active', documentId] as const,
}

export const deckKeys = {
    all: ['decks'] as const,
    due: ['flashcards', 'due'] as const,
    stats: ['study-stats'] as const,
    mastery: ['overall-mastery'] as const,
}

// ============================================
// QUERIES
// ============================================

/**
 * Fetch existing flashcards for a document
 * This is a PURE READ operation - no side effects!
 * 
 * IMPORTANT: Uses AuthContext's cached user to avoid getSession() hangs!
 * 
 * @param documentId - Document UUID
 * @returns Query result with flashcards array
 * 
 * @example
 * const { data: flashcards = [] } = useFlashcards(documentId)
 */
export function useFlashcards(documentId: string | null | undefined) {
    // Get user from AuthContext (cached, no network call!)
    const { user } = useAuth()

    // 🔍 DIAGNOSTIC LOGGING - Remove after debugging
    console.log('🔍 [useFlashcards] Hook called with documentId:', documentId, 'user:', user?.id?.substring(0, 8) || 'null')
    console.log('🔍 [useFlashcards] enabled condition (!!documentId && !!user):', !!documentId && !!user)

    return useQuery({
        queryKey: flashcardKeys.byDocument(documentId || ''),
        queryFn: async () => {
            console.log('🔍 [useFlashcards] queryFn EXECUTING for documentId:', documentId, 'with userId:', user?.id?.substring(0, 8))
            // Pass the user ID from AuthContext to avoid getSession() hang!
            const result = await getFlashcards(documentId!, user!.id)
            console.log('🔍 [useFlashcards] queryFn RESULT:', result.length, 'flashcards')
            return result
        },
        // Only fetch when we have BOTH documentId AND user
        enabled: !!documentId && !!user,
        // Don't refetch during study session - cards shouldn't change mid-study
        refetchOnWindowFocus: false,
        staleTime: Infinity, // Cards are fresh for the entire session
    })
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Generate flashcards for a document
 * This is a MUTATION because it CREATES new data
 * 
 * IMPORTANT: Uses AuthContext's cached user to avoid getSession() hangs!
 * 
 * WHY THIS IS SEPARATE FROM THE QUERY:
 * - If a user studies, loses focus, and comes back, we DON'T want to regenerate cards
 * - The component decides WHEN to generate (e.g., only if cards.length === 0)
 * - We have full control over error handling and loading states
 * 
 * @example
 * const generateMutation = useGenerateFlashcards()
 * 
 * useEffect(() => {
 *   if (flashcards.length === 0 && documentId) {
 *     generateMutation.mutate(documentId)
 *   }
 * }, [flashcards, documentId])
 */
export function useGenerateFlashcards() {
    const queryClient = useQueryClient()
    const { user } = useAuth()

    return useMutation({
        mutationFn: (documentId: string) => {
            // Pass the user ID from AuthContext to avoid getSession() hang!
            return generateFlashcardsFromDocument(documentId, user?.id)
        },
        onSuccess: (newCards, documentId) => {
            // Update the cache directly with the new cards
            // This is faster than invalidating + refetching
            queryClient.setQueryData(flashcardKeys.byDocument(documentId), newCards)
        },
    })
}

/**
 * Record a card review (user's rating)
 * 
 * @example
 * const reviewMutation = useRecordReview()
 * reviewMutation.mutate({ cardId: 'xxx', quality: 4, sessionId: 'yyy', timeMs: 5000 })
 */
export function useRecordReview() {
    const { user } = useAuth()

    // Note: We don't invalidate queries here because reviews
    // are recorded for analytics, they don't change the cards
    return useMutation({
        mutationFn: ({
            cardId,
            quality,
            sessionId,
            timeMs,
        }: {
            cardId: string
            quality: number
            sessionId?: string
            timeMs?: number
        }) => recordCardReview(cardId, quality, sessionId, timeMs, user?.id),
    })
}

/**
 * Start a study session
 * 
 * @example
 * const startSession = useStartSession()
 * const session = await startSession.mutateAsync({ documentId: 'xxx', sessionType: 'learn' })
 */
export function useStartSession() {
    const { user } = useAuth()

    return useMutation({
        mutationFn: ({
            documentId,
            sessionType,
        }: {
            documentId: string
            sessionType: 'learn' | 'review' | 'quiz'
        }) => startStudySession(documentId, sessionType, user?.id),
    })
}

/**
 * End a study session with results
 * 
 * @example
 * const endSession = useEndSession()
 * endSession.mutate({ sessionId: 'xxx', cardsStudied: 10, correctCount: 8 })
 */
export function useEndSession() {
    return useMutation({
        mutationFn: ({
            sessionId,
            cardsStudied,
            correctCount,
        }: {
            sessionId: string
            cardsStudied: number
            correctCount: number
        }) => endStudySession(sessionId, cardsStudied, correctCount),
    })
}

// ============================================
// DECK & STATS QUERIES
// ============================================

/**
 * Fetch all flashcards that are due for review (across all documents).
 * Used by the FlashcardsPage for cross-document review sessions.
 */
export function useDueFlashcards() {
    const { user } = useAuth()

    return useQuery({
        queryKey: deckKeys.due,
        queryFn: () => getDueFlashcards(undefined, user!.id),
        enabled: !!user,
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 2,
    })
}

/**
 * Fetch study statistics (total cards studied, accuracy, streak).
 * Used by the DeckOverviewPage for the stats grid.
 */
export function useStudyStats() {
    const { user } = useAuth()

    return useQuery({
        queryKey: deckKeys.stats,
        queryFn: () => getStudyStats(user!.id),
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    })
}

/**
 * Fetch overall mastery breakdown (mastered / learning / needs work).
 * Used by the DeckOverviewPage mastery distribution bar.
 */
export function useOverallMastery() {
    const { user } = useAuth()

    return useQuery({
        queryKey: deckKeys.mastery,
        queryFn: () => getOverallMastery(user!.id),
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    })
}

/**
 * Fetch all flashcard decks grouped by document.
 * Each deck includes card counts, due counts, and mastery breakdown.
 */
export function useAllFlashcardDecks() {
    const { user } = useAuth()

    return useQuery({
        queryKey: deckKeys.all,
        queryFn: () => getAllFlashcardDecks(user!.id),
        enabled: !!user,
        staleTime: 1000 * 60 * 2,
    })
}
