import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useQuery } from '@tanstack/react-query'
import { Header, PageWrapper } from "@/components/layout"
import {
    generateFlashcardsFromDocument,
    getFlashcards,
    recordCardReview,
    startStudySession,
    endStudySession
} from "@/services/learning"

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

    const { data: flashcards = [], isLoading: loading, error } = useQuery({
        queryKey: ['flashcards', documentId],
        queryFn: async () => {
            if (!documentId) throw new Error("No document ID provided")
            // Try to get existing flashcards
            let cards = await getFlashcards(documentId)

            // If no cards exist, generate them
            if (cards.length === 0) {
                cards = await generateFlashcardsFromDocument(documentId)
            }
            return cards
        },
        enabled: !!documentId,
        refetchOnWindowFocus: false, // Don't refetch while studying
        staleTime: Infinity, // Keep cards fresh for the session
    })

    // Start session when cards are loaded
    useEffect(() => {
        if (flashcards.length > 0 && !sessionId && documentId) {
            startStudySession(documentId, 'learn')
                .then(s => setSessionId(s.id))
                .catch(console.error)
        }
    }, [flashcards, sessionId, documentId])

    async function handleRating(quality: number) {
        if (!flashcards[currentIndex]) return

        const timeSpent = Date.now() - startTime
        const card = flashcards[currentIndex]

        try {
            // Record the review
            await recordCardReview(card.id, quality, sessionId || undefined, timeSpent)

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
                    await endStudySession(
                        sessionId,
                        flashcards.length,
                        results.correct + (quality >= 3 ? 1 : 0)
                    )
                }
                setIsComplete(true)
            }
        } catch (err) {
            console.error("Error recording review:", err)
        }
    }

    const currentCard = flashcards[currentIndex]
    const progress = flashcards.length > 0 ? ((currentIndex + 1) / flashcards.length) * 100 : 0

    if (loading) {
        return (
            <PageWrapper>
                <Header title="Study Mode" showBack onBack={() => navigate(-1)} />
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-[var(--muted-foreground)]">Loading flashcards...</p>
                    </div>
                </div>
            </PageWrapper>
        )
    }

    if (error) {
        return (
            <PageWrapper>
                <Header title="Study Mode" showBack onBack={() => navigate(-1)} />
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                    <p className="text-red-500 text-center">{error.message}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm"
                    >
                        Go Back
                    </button>
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
                                className="py-4 px-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-medium transition-colors flex flex-col items-center gap-1"
                            >
                                <span className="material-symbols-outlined">sentiment_very_dissatisfied</span>
                                <span className="text-xs">Again</span>
                            </button>
                            <button
                                onClick={() => handleRating(2)}
                                className="py-4 px-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl font-medium transition-colors flex flex-col items-center gap-1"
                            >
                                <span className="material-symbols-outlined">sentiment_dissatisfied</span>
                                <span className="text-xs">Hard</span>
                            </button>
                            <button
                                onClick={() => handleRating(4)}
                                className="py-4 px-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-medium transition-colors flex flex-col items-center gap-1"
                            >
                                <span className="material-symbols-outlined">sentiment_satisfied</span>
                                <span className="text-xs">Good</span>
                            </button>
                            <button
                                onClick={() => handleRating(5)}
                                className="py-4 px-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl font-medium transition-colors flex flex-col items-center gap-1"
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
