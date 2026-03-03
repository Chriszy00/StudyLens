import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"
import {
    useDueFlashcards,
    useRecordReview,
    useStartSession,
    useEndSession,
} from "@/hooks"

export function FlashcardsPage() {
    const navigate = useNavigate()

    const [currentIndex, setCurrentIndex] = useState(0)
    const [isFlipped, setIsFlipped] = useState(false)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [results, setResults] = useState<{ correct: number; incorrect: number }>({ correct: 0, incorrect: 0 })
    const [isComplete, setIsComplete] = useState(false)
    const [startTime, setStartTime] = useState<number>(Date.now())

    const {
        data: dueCards = [],
        isLoading,
        error,
    } = useDueFlashcards()

    const reviewMutation = useRecordReview()
    const startSessionMutation = useStartSession()
    const endSessionMutation = useEndSession()

    // Start a review session when due cards load
    useEffect(() => {
        if (dueCards.length > 0 && !sessionId && !startSessionMutation.isPending) {
            startSessionMutation.mutate(
                { documentId: dueCards[0].document_id, sessionType: 'review' },
                { onSuccess: (session) => setSessionId(session.id) }
            )
        }
    }, [dueCards, sessionId, startSessionMutation])

    async function handleRating(quality: number) {
        if (!dueCards[currentIndex]) return

        const timeSpent = Date.now() - startTime
        const card = dueCards[currentIndex]

        try {
            await reviewMutation.mutateAsync({
                cardId: card.id,
                quality,
                sessionId: sessionId || undefined,
                timeMs: timeSpent,
            })

            if (quality >= 3) {
                setResults(prev => ({ ...prev, correct: prev.correct + 1 }))
            } else {
                setResults(prev => ({ ...prev, incorrect: prev.incorrect + 1 }))
            }

            if (currentIndex < dueCards.length - 1) {
                setCurrentIndex(prev => prev + 1)
                setIsFlipped(false)
                setStartTime(Date.now())
            } else {
                if (sessionId) {
                    endSessionMutation.mutate({
                        sessionId,
                        cardsStudied: dueCards.length,
                        correctCount: results.correct + (quality >= 3 ? 1 : 0),
                    })
                }
                setIsComplete(true)
            }
        } catch (err) {
            console.error("Error recording review:", err)
        }
    }

    const currentCard = dueCards[currentIndex]
    const progress = dueCards.length > 0 ? ((currentIndex + 1) / dueCards.length) * 100 : 0

    // Loading state
    if (isLoading) {
        return (
            <PageWrapper>
                <Header
                    title="Review Due Cards"
                    showBack
                    onBack={() => navigate("/deck")}
                    rightAction={<div className="h-4 w-16 bg-[var(--muted)] rounded animate-pulse" />}
                />
                <div className="py-8 max-w-2xl mx-auto">
                    <div className="mb-8">
                        <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                            <div className="h-full bg-primary/30 rounded-full animate-pulse" style={{ width: '30%' }} />
                        </div>
                    </div>
                    <div className="min-h-[300px] bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-lg overflow-hidden">
                        <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
                            <div className="w-12 h-12 bg-primary/20 rounded-full mb-6 animate-pulse" />
                            <div className="space-y-3 w-full max-w-md">
                                <div className="h-6 bg-[var(--muted)] rounded w-full animate-pulse" />
                                <div className="h-6 bg-[var(--muted)] rounded w-3/4 mx-auto animate-pulse" />
                                <div className="h-6 bg-[var(--muted)] rounded w-1/2 mx-auto animate-pulse" />
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 grid grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="py-4 px-2 bg-[var(--muted)] rounded-xl animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                                <div className="h-6 w-6 bg-[var(--muted)]/70 rounded-full mx-auto mb-2" />
                                <div className="h-3 w-10 bg-[var(--muted)]/70 rounded mx-auto" />
                            </div>
                        ))}
                    </div>
                    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[var(--card)] px-6 py-3 rounded-full shadow-lg border border-[var(--border)] flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-[var(--muted-foreground)]">Loading due cards...</span>
                    </div>
                </div>
            </PageWrapper>
        )
    }

    // Error state
    if (error) {
        return (
            <PageWrapper>
                <Header title="Review Due Cards" showBack onBack={() => navigate("/deck")} />
                <div className="flex flex-col items-center justify-center py-20 gap-6 max-w-md mx-auto text-center">
                    <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                    <p className="text-red-500">
                        {error instanceof Error ? error.message : "Failed to load due cards"}
                    </p>
                    <button
                        onClick={() => navigate("/deck")}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm"
                    >
                        Back to Decks
                    </button>
                </div>
            </PageWrapper>
        )
    }

    // No cards due -- all caught up!
    if (dueCards.length === 0) {
        return (
            <PageWrapper>
                <Header title="Review Due Cards" showBack onBack={() => navigate("/deck")} />
                <div className="flex flex-col items-center justify-center py-20 gap-6 max-w-md mx-auto text-center">
                    <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-emerald-600 text-5xl">
                            check_circle
                        </span>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold">You're All Caught Up!</h2>
                        <p className="text-[var(--muted-foreground)]">
                            No flashcards are due for review right now. Great job staying on top of your studies!
                        </p>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20 text-left">
                        <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5">info</span>
                        <p className="text-sm text-[var(--muted-foreground)]">
                            <strong className="text-[var(--foreground)]">How SM-2 works:</strong> Cards
                            you rated "Good" or "Easy" won't appear again for a while. The better you know
                            a card, the longer the interval before it comes back.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <button
                            onClick={() => navigate("/deck")}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                        >
                            <span className="material-symbols-outlined">dashboard</span>
                            Back to Decks
                        </button>
                        <button
                            onClick={() => navigate("/library")}
                            className="w-full px-6 py-3 border border-[var(--border)] rounded-xl font-semibold hover:bg-[var(--muted)] transition-colors"
                        >
                            Go to Library
                        </button>
                    </div>
                </div>
            </PageWrapper>
        )
    }

    // Session complete
    if (isComplete) {
        const accuracy = dueCards.length > 0
            ? Math.round((results.correct / dueCards.length) * 100)
            : 0

        return (
            <PageWrapper>
                <Header title="Review Complete" showBack onBack={() => navigate("/deck")} />
                <div className="flex flex-col items-center justify-center py-20 gap-6">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-5xl text-primary">celebration</span>
                    </div>

                    <h2 className="text-2xl font-bold">Great job!</h2>
                    <p className="text-[var(--muted-foreground)]">You've reviewed all your due cards</p>

                    <div className="grid grid-cols-3 gap-6 mt-4">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-primary">{dueCards.length}</p>
                            <p className="text-sm text-[var(--muted-foreground)]">Cards Reviewed</p>
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
                            onClick={() => navigate("/deck")}
                            className="px-6 py-3 border border-[var(--border)] rounded-xl font-semibold hover:bg-[var(--muted)]"
                        >
                            Back to Decks
                        </button>
                        <button
                            onClick={() => navigate("/library")}
                            className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90"
                        >
                            Go to Library
                        </button>
                    </div>
                </div>
            </PageWrapper>
        )
    }

    // Active review session
    return (
        <PageWrapper>
            <Header
                title="Review Due Cards"
                showBack
                onBack={() => navigate("/deck")}
                rightAction={
                    <span className="text-sm text-[var(--muted-foreground)]">
                        {currentIndex + 1} / {dueCards.length}
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
                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-primary text-lg">touch_app</span>
                                <p className="text-center font-semibold text-primary">
                                    Rate Your Recall
                                </p>
                            </div>
                            <p className="text-center text-xs text-[var(--muted-foreground)]">
                                How well did you remember this? Tap a button below to continue.
                            </p>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <button
                                onClick={() => handleRating(1)}
                                disabled={reviewMutation.isPending}
                                className="py-4 px-2 bg-red-100 hover:bg-red-200 hover:scale-105 text-red-700 rounded-xl font-medium transition-all flex flex-col items-center gap-1 disabled:opacity-50 shadow-sm hover:shadow-md"
                            >
                                <span className="material-symbols-outlined">sentiment_very_dissatisfied</span>
                                <span className="text-xs">Forgot</span>
                            </button>
                            <button
                                onClick={() => handleRating(2)}
                                disabled={reviewMutation.isPending}
                                className="py-4 px-2 bg-orange-100 hover:bg-orange-200 hover:scale-105 text-orange-700 rounded-xl font-medium transition-all flex flex-col items-center gap-1 disabled:opacity-50 shadow-sm hover:shadow-md"
                            >
                                <span className="material-symbols-outlined">sentiment_dissatisfied</span>
                                <span className="text-xs">Hard</span>
                            </button>
                            <button
                                onClick={() => handleRating(4)}
                                disabled={reviewMutation.isPending}
                                className="py-4 px-2 bg-blue-100 hover:bg-blue-200 hover:scale-105 text-blue-700 rounded-xl font-medium transition-all flex flex-col items-center gap-1 disabled:opacity-50 shadow-sm hover:shadow-md"
                            >
                                <span className="material-symbols-outlined">sentiment_satisfied</span>
                                <span className="text-xs">Good</span>
                            </button>
                            <button
                                onClick={() => handleRating(5)}
                                disabled={reviewMutation.isPending}
                                className="py-4 px-2 bg-emerald-100 hover:bg-emerald-200 hover:scale-105 text-emerald-700 rounded-xl font-medium transition-all flex flex-col items-center gap-1 disabled:opacity-50 shadow-sm hover:shadow-md"
                            >
                                <span className="material-symbols-outlined">sentiment_very_satisfied</span>
                                <span className="text-xs">Easy</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Progress tracker */}
                <div className="mt-8 flex justify-center gap-8">
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full">
                        <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                        <span className="text-sm font-medium text-emerald-700">{results.correct} Knew it</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full">
                        <span className="material-symbols-outlined text-amber-500 text-sm">refresh</span>
                        <span className="text-sm font-medium text-amber-700">{results.incorrect} Needs practice</span>
                    </div>
                </div>
            </div>
        </PageWrapper>
    )
}
