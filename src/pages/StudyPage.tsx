import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"
import {
    useFlashcards,
    useGenerateFlashcards,
    useRecordReview,
    useStartSession,
    useEndSession,
} from "@/hooks"

/**
 * StudyPage - Flashcard Study Mode
 * 
 * ARCHITECTURE NOTES (for learning):
 * ----------------------------------
 * This component demonstrates the CORRECT way to handle data that might
 * not exist yet. We use:
 * 
 * 1. useFlashcards (QUERY) - Only READS existing flashcards
 * 2. useGenerateFlashcards (MUTATION) - Only CREATES new flashcards
 * 
 * The useEffect at the bottom checks if cards need to be generated
 * and triggers the mutation. This is much safer than generating inside
 * the query, because:
 * - Queries can refetch anytime (window focus, error retry, etc.)
 * - Mutations only run when WE explicitly call them
 */

export function StudyPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const documentId = searchParams.get("id")

    const [currentIndex, setCurrentIndex] = useState(0)
    const [isFlipped, setIsFlipped] = useState(false)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [results, setResults] = useState<{ correct: number; incorrect: number }>({ correct: 0, incorrect: 0 })
    const [isComplete, setIsComplete] = useState(false)
    const [startTime, setStartTime] = useState<number>(Date.now())
    const [hasAttemptedGeneration, setHasAttemptedGeneration] = useState(false)

    // STEP 1: Fetch existing flashcards (READ-ONLY)
    const {
        data: flashcards = [],
        isLoading: isLoadingCards,
        error: cardsError,
        fetchStatus: cardsFetchStatus,
        status: cardsStatus,
    } = useFlashcards(documentId)

    // STEP 2: Mutation for generating flashcards (WRITE)
    const generateMutation = useGenerateFlashcards()

    // STEP 3: Mutation for recording reviews
    const reviewMutation = useRecordReview()

    // STEP 4: Session management
    const startSessionMutation = useStartSession()
    const endSessionMutation = useEndSession()

    // 🔍 DIAGNOSTIC LOGGING - Remove after debugging
    console.log('🃏 [StudyPage] ===== RENDER =====')
    console.log('🃏 [StudyPage] documentId from URL:', documentId, '| Type:', typeof documentId)
    console.log('🃏 [StudyPage] Query enabled condition (!!documentId):', !!documentId)
    console.log('🃏 [StudyPage] Flashcards Query State:', {
        isLoading: isLoadingCards,
        error: cardsError?.message || null,
        fetchStatus: cardsFetchStatus,
        status: cardsStatus,
        flashcardsCount: flashcards.length,
    })
    console.log('🃏 [StudyPage] Generate Mutation State:', {
        isPending: generateMutation.isPending,
        isSuccess: generateMutation.isSuccess,
        isError: generateMutation.isError,
        error: generateMutation.error?.message || null,
    })
    console.log('🃏 [StudyPage] hasAttemptedGeneration:', hasAttemptedGeneration)
    console.log('🃏 [StudyPage] Combined loading state:', isLoadingCards || generateMutation.isPending)

    // STEP 5: Generate cards if they don't exist
    // This useEffect is the KEY to solving the query/mutation problem
    useEffect(() => {
        if (
            documentId &&
            flashcards.length === 0 &&
            !isLoadingCards &&
            !generateMutation.isPending &&
            !generateMutation.isSuccess &&
            !hasAttemptedGeneration &&
            !cardsError
        ) {
            setHasAttemptedGeneration(true)
            generateMutation.mutate(documentId)
        }
    }, [documentId, flashcards, isLoadingCards, generateMutation, hasAttemptedGeneration, cardsError])

    // Start session when cards are loaded
    useEffect(() => {
        if (flashcards.length > 0 && !sessionId && documentId && !startSessionMutation.isPending) {
            startSessionMutation.mutate(
                { documentId, sessionType: 'learn' },
                { onSuccess: (session) => setSessionId(session.id) }
            )
        }
    }, [flashcards, sessionId, documentId, startSessionMutation])

    async function handleRating(quality: number) {
        if (!flashcards[currentIndex]) return

        const timeSpent = Date.now() - startTime
        const card = flashcards[currentIndex]

        try {
            // Record the review using mutation
            await reviewMutation.mutateAsync({
                cardId: card.id,
                quality,
                sessionId: sessionId || undefined,
                timeMs: timeSpent,
            })

            // Update results
            if (quality >= 3) {
                setResults(prev => ({ ...prev, correct: prev.correct + 1 }))
            } else {
                setResults(prev => ({ ...prev, incorrect: prev.incorrect + 1 }))
            }

            // Move to next card or complete
            if (currentIndex < flashcards.length - 1) {
                setCurrentIndex(prev => prev + 1)
                setIsFlipped(false)
                setStartTime(Date.now())
            } else {
                // Session complete
                if (sessionId) {
                    endSessionMutation.mutate({
                        sessionId,
                        cardsStudied: flashcards.length,
                        correctCount: results.correct + (quality >= 3 ? 1 : 0),
                    })
                }
                setIsComplete(true)
            }
        } catch (err) {
            console.error("Error recording review:", err)
        }
    }

    const currentCard = flashcards[currentIndex]
    const progress = flashcards.length > 0 ? ((currentIndex + 1) / flashcards.length) * 100 : 0

    // Loading state - either fetching cards or generating them
    const loading = isLoadingCards || generateMutation.isPending

    // Error state
    const error = cardsError || generateMutation.error

    if (loading) {
        return (
            <PageWrapper>
                <Header
                    title="Study Mode"
                    showBack
                    onBack={() => navigate(-1)}
                    rightAction={
                        <div className="h-4 w-16 bg-[var(--muted)] rounded animate-pulse" />
                    }
                />
                <div className="py-8 max-w-2xl mx-auto">
                    {/* Skeleton Progress Bar */}
                    <div className="mb-8">
                        <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary/30 rounded-full animate-pulse"
                                style={{ width: '30%' }}
                            />
                        </div>
                    </div>

                    {/* Skeleton Flashcard */}
                    <div className="min-h-[300px] bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-lg overflow-hidden">
                        {/* Difficulty Badge Skeleton */}
                        <div className="absolute top-4 right-4">
                            <div className="h-6 w-16 bg-[var(--muted)] rounded-full animate-pulse" />
                        </div>

                        {/* Card Content Skeleton */}
                        <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
                            <div className="w-12 h-12 bg-primary/20 rounded-full mb-6 animate-pulse" />
                            <div className="space-y-3 w-full max-w-md">
                                <div className="h-6 bg-[var(--muted)] rounded w-full animate-pulse" />
                                <div className="h-6 bg-[var(--muted)] rounded w-3/4 mx-auto animate-pulse" />
                                <div className="h-6 bg-[var(--muted)] rounded w-1/2 mx-auto animate-pulse" />
                            </div>
                            <div className="h-4 w-32 bg-[var(--muted)] rounded mt-8 animate-pulse" />
                        </div>
                    </div>

                    {/* Skeleton Rating Buttons */}
                    <div className="mt-8 space-y-4">
                        <div className="h-4 w-48 bg-[var(--muted)] rounded mx-auto animate-pulse" />
                        <div className="grid grid-cols-4 gap-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className="py-4 px-2 bg-[var(--muted)] rounded-xl animate-pulse"
                                    style={{ animationDelay: `${i * 100}ms` }}
                                >
                                    <div className="h-6 w-6 bg-[var(--muted)]/70 rounded-full mx-auto mb-2" />
                                    <div className="h-3 w-10 bg-[var(--muted)]/70 rounded mx-auto" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Loading Message */}
                    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[var(--card)] px-6 py-3 rounded-full shadow-lg border border-[var(--border)] flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-[var(--muted-foreground)]">
                            {generateMutation.isPending
                                ? "Generating flashcards..."
                                : "Loading flashcards..."}
                        </span>
                    </div>
                </div>
            </PageWrapper>
        )
    }

    if (error) {
        // Check if error is specifically about no summary
        const isMissingSummary = error instanceof Error &&
            (error.message.includes('No summary found') ||
                error.message.includes('No study questions'))

        return (
            <PageWrapper>
                <Header title="Study Mode" showBack onBack={() => navigate(-1)} />
                <div className="flex flex-col items-center justify-center py-20 gap-6 max-w-md mx-auto text-center">
                    {isMissingSummary ? (
                        <>
                            {/* Friendly illustration */}
                            <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-600 text-5xl">
                                    auto_stories
                                </span>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-xl font-bold">Generate a Summary First</h2>
                                <p className="text-[var(--muted-foreground)]">
                                    This document hasn't been analyzed yet. Generate an AI summary to create flashcards for studying.
                                </p>
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-col gap-3 w-full max-w-xs">
                                <button
                                    onClick={() => navigate(`/analysis?id=${documentId}`)}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                                >
                                    <span className="material-symbols-outlined">auto_awesome</span>
                                    Generate Summary
                                </button>
                                <button
                                    onClick={() => navigate(-1)}
                                    className="w-full px-6 py-3 border border-[var(--border)] rounded-xl font-semibold hover:bg-[var(--muted)] transition-colors"
                                >
                                    Go Back
                                </button>
                            </div>

                            {/* Info box */}
                            <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20 text-left">
                                <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5">info</span>
                                <p className="text-sm text-[var(--muted-foreground)]">
                                    <strong className="text-[var(--foreground)]">Tip:</strong> After generating a summary, the AI will create study questions that become your flashcards.
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Generic error state */}
                            <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                            <p className="text-red-500">
                                {error instanceof Error ? error.message : "Failed to load flashcards"}
                            </p>
                            <button
                                onClick={() => navigate(-1)}
                                className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm"
                            >
                                Go Back
                            </button>
                        </>
                    )}
                </div>
            </PageWrapper>
        )
    }

    if (isComplete) {
        const accuracy = flashcards.length > 0
            ? Math.round((results.correct / flashcards.length) * 100)
            : 0

        return (
            <PageWrapper>
                <Header title="Session Complete" showBack onBack={() => navigate("/library")} />
                <div className="flex flex-col items-center justify-center py-20 gap-6">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-5xl text-primary">celebration</span>
                    </div>

                    <h2 className="text-2xl font-bold">Great job!</h2>
                    <p className="text-[var(--muted-foreground)]">You've completed this study session</p>

                    <div className="grid grid-cols-3 gap-6 mt-4">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-primary">{flashcards.length}</p>
                            <p className="text-sm text-[var(--muted-foreground)]">Cards Studied</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-bold text-emerald-500">{results.correct}</p>
                            <p className="text-sm text-[var(--muted-foreground)]">Correct</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-bold text-amber-500">{accuracy}%</p>
                            <p className="text-sm text-[var(--muted-foreground)]">Accuracy</p>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-6">
                        <button
                            onClick={() => navigate("/library")}
                            className="px-6 py-3 border border-[var(--border)] rounded-xl font-semibold hover:bg-[var(--muted)]"
                        >
                            Back to Library
                        </button>
                        <button
                            onClick={() => {
                                setCurrentIndex(0)
                                setIsFlipped(false)
                                setResults({ correct: 0, incorrect: 0 })
                                setIsComplete(false)
                                setStartTime(Date.now())
                            }}
                            className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90"
                        >
                            Study Again
                        </button>
                    </div>
                </div>
            </PageWrapper>
        )
    }

    return (
        <PageWrapper>
            <Header
                title="Study Mode"
                showBack
                onBack={() => navigate(-1)}
                rightAction={
                    <span className="text-sm text-[var(--muted-foreground)]">
                        {currentIndex + 1} / {flashcards.length}
                    </span>
                }
            />

            <div className="py-8 max-w-2xl mx-auto">
                {/* Progress bar */}
                <div className="mb-8">
                    <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Flashcard */}
                {currentCard && (
                    <div
                        className={`
                            relative min-h-[300px] bg-[var(--card)] rounded-2xl border border-[var(--border)] 
                            shadow-lg cursor-pointer transition-all duration-300 
                            ${isFlipped ? 'bg-primary/5' : ''}
                        `}
                        onClick={() => setIsFlipped(!isFlipped)}
                    >
                        {/* Difficulty badge */}
                        <div className="absolute top-4 right-4">
                            <span className={`
                                px-3 py-1 rounded-full text-xs font-medium
                                ${currentCard.difficulty === 'easy' ? 'bg-green-100 text-green-700' : ''}
                                ${currentCard.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' : ''}
                                ${currentCard.difficulty === 'hard' ? 'bg-red-100 text-red-700' : ''}
                            `}>
                                {currentCard.difficulty}
                            </span>
                        </div>

                        {/* Card content */}
                        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
                            {!isFlipped ? (
                                <>
                                    <span className="material-symbols-outlined text-primary text-3xl mb-4">help</span>
                                    <h3 className="text-xl font-medium leading-relaxed">{currentCard.front}</h3>
                                    <p className="text-sm text-[var(--muted-foreground)] mt-6">
                                        Tap to reveal answer
                                    </p>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-emerald-500 text-3xl mb-4">lightbulb</span>
                                    <p className="text-lg leading-relaxed">{currentCard.back}</p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Rating buttons (only show when flipped) */}
                {isFlipped && (
                    <div className="mt-8 space-y-4">
                        <p className="text-center text-sm text-[var(--muted-foreground)]">
                            How well did you know this?
                        </p>
                        <div className="grid grid-cols-4 gap-3">
                            <button
                                onClick={() => handleRating(1)}
                                disabled={reviewMutation.isPending}
                                className="py-4 px-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-medium transition-colors flex flex-col items-center gap-1 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined">sentiment_very_dissatisfied</span>
                                <span className="text-xs">Again</span>
                            </button>
                            <button
                                onClick={() => handleRating(2)}
                                disabled={reviewMutation.isPending}
                                className="py-4 px-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl font-medium transition-colors flex flex-col items-center gap-1 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined">sentiment_dissatisfied</span>
                                <span className="text-xs">Hard</span>
                            </button>
                            <button
                                onClick={() => handleRating(4)}
                                disabled={reviewMutation.isPending}
                                className="py-4 px-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-medium transition-colors flex flex-col items-center gap-1 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined">sentiment_satisfied</span>
                                <span className="text-xs">Good</span>
                            </button>
                            <button
                                onClick={() => handleRating(5)}
                                disabled={reviewMutation.isPending}
                                className="py-4 px-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl font-medium transition-colors flex flex-col items-center gap-1 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined">sentiment_very_satisfied</span>
                                <span className="text-xs">Easy</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Results so far */}
                <div className="mt-8 flex justify-center gap-8">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-sm">{results.correct} correct</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-sm">{results.incorrect} to review</span>
                    </div>
                </div>
            </div>
        </PageWrapper>
    )
}

