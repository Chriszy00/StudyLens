import { useState, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"
import { useSummary } from "@/hooks"
import type { StudyQuestion } from "@/services/ai"

/**
 * QuizPage - Multiple Choice Quiz Mode
 * 
 * This page presents study questions as multiple choice questions.
 * Unlike flashcards (self-assessment), this mode tests actual knowledge
 * by requiring users to select the correct answer from options.
 * 
 * HOW IT WORKS:
 * 1. Takes study questions from the document summary
 * 2. Generates 3 distractor answers using parts of other answers
 * 3. Randomizes option order
 * 4. Tracks correct/incorrect answers
 * 5. Shows a results summary at the end
 */

interface QuizQuestion {
    question: string
    correctAnswer: string
    options: string[]
    difficulty: 'easy' | 'medium' | 'hard'
}

export function QuizPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const documentId = searchParams.get("id")

    // Fetch the summary which contains study_questions
    const { data: summary, isLoading, error } = useSummary(documentId)

    const [currentIndex, setCurrentIndex] = useState(0)
    const [selectedOption, setSelectedOption] = useState<string | null>(null)
    const [hasAnswered, setHasAnswered] = useState(false)
    const [results, setResults] = useState<{ correct: number; incorrect: number }>({ correct: 0, incorrect: 0 })
    const [isComplete, setIsComplete] = useState(false)
    const [answers, setAnswers] = useState<boolean[]>([])

    // Convert study questions to quiz format with MCQ options
    const quizQuestions: QuizQuestion[] = useMemo(() => {
        if (!summary?.study_questions) return []

        const questions = summary.study_questions as StudyQuestion[]

        return questions.map((q, idx) => {
            // Get the correct answer
            const correctAnswer = q.answer

            // Generate distractor options from other answers
            const otherAnswers = questions
                .filter((_, i) => i !== idx)
                .map(other => other.answer)
                .slice(0, 3)

            // If we don't have enough distractors, create generic ones
            while (otherAnswers.length < 3) {
                const genericOptions = [
                    "This statement is incorrect based on the document.",
                    "None of the above options are correct.",
                    "The document does not address this topic.",
                ]
                otherAnswers.push(genericOptions[otherAnswers.length])
            }

            // Combine and shuffle options
            const allOptions = [correctAnswer, ...otherAnswers]
            const shuffledOptions = shuffleArray(allOptions)

            return {
                question: q.question,
                correctAnswer,
                options: shuffledOptions,
                difficulty: q.difficulty,
            }
        })
    }, [summary?.study_questions])

    // Fisher-Yates shuffle
    function shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
    }

    const currentQuestion = quizQuestions[currentIndex]
    const progress = quizQuestions.length > 0 ? ((currentIndex + 1) / quizQuestions.length) * 100 : 0

    function handleSelectOption(option: string) {
        if (hasAnswered) return
        setSelectedOption(option)
    }

    function handleSubmitAnswer() {
        if (!selectedOption || !currentQuestion) return

        const isCorrect = selectedOption === currentQuestion.correctAnswer
        setHasAnswered(true)
        setAnswers(prev => [...prev, isCorrect])

        if (isCorrect) {
            setResults(prev => ({ ...prev, correct: prev.correct + 1 }))
        } else {
            setResults(prev => ({ ...prev, incorrect: prev.incorrect + 1 }))
        }
    }

    function handleNextQuestion() {
        if (currentIndex < quizQuestions.length - 1) {
            setCurrentIndex(prev => prev + 1)
            setSelectedOption(null)
            setHasAnswered(false)
        } else {
            setIsComplete(true)
        }
    }

    // Loading state
    if (isLoading) {
        return (
            <PageWrapper>
                <Header
                    title="Quiz Mode"
                    showBack
                    onBack={() => navigate(-1)}
                />
                <div className="py-8 max-w-2xl mx-auto">
                    {/* Skeleton */}
                    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-8">
                        <div className="space-y-4">
                            <div className="h-6 bg-[var(--muted)] rounded animate-pulse w-3/4" />
                            <div className="h-4 bg-[var(--muted)] rounded animate-pulse w-1/2" />
                            <div className="space-y-3 mt-8">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-14 bg-[var(--muted)] rounded-xl animate-pulse" />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[var(--card)] px-6 py-3 rounded-full shadow-lg border border-[var(--border)] flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-[var(--muted-foreground)]">Loading quiz...</span>
                    </div>
                </div>
            </PageWrapper>
        )
    }

    // Error or no questions
    if (error || quizQuestions.length === 0) {
        return (
            <PageWrapper>
                <Header title="Quiz Mode" showBack onBack={() => navigate(-1)} />
                <div className="flex flex-col items-center justify-center py-20 gap-6 max-w-md mx-auto text-center">
                    <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-amber-600 text-5xl">
                            quiz
                        </span>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold">No Quiz Questions Available</h2>
                        <p className="text-[var(--muted-foreground)]">
                            This document doesn't have study questions yet. Generate an AI summary first to create quiz questions.
                        </p>
                    </div>
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
                </div>
            </PageWrapper>
        )
    }

    // Complete state
    if (isComplete) {
        const accuracy = quizQuestions.length > 0
            ? Math.round((results.correct / quizQuestions.length) * 100)
            : 0

        const getPerformanceMessage = () => {
            if (accuracy >= 80) return { text: "Excellent!", emoji: "🎉", color: "text-emerald-600" }
            if (accuracy >= 60) return { text: "Good Job!", emoji: "👍", color: "text-blue-600" }
            if (accuracy >= 40) return { text: "Keep Practicing!", emoji: "💪", color: "text-amber-600" }
            return { text: "Don't Give Up!", emoji: "📚", color: "text-red-600" }
        }

        const performance = getPerformanceMessage()

        return (
            <PageWrapper>
                <Header title="Quiz Complete" showBack onBack={() => navigate("/library")} />
                <div className="flex flex-col items-center justify-center py-20 gap-6 max-w-md mx-auto">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-5xl">{performance.emoji}</span>
                    </div>

                    <h2 className={`text-2xl font-bold ${performance.color}`}>{performance.text}</h2>
                    <p className="text-[var(--muted-foreground)]">You've completed the quiz!</p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-6 mt-4 w-full">
                        <div className="text-center p-4 bg-[var(--card)] rounded-xl border border-[var(--border)]">
                            <p className="text-3xl font-bold text-primary">{quizQuestions.length}</p>
                            <p className="text-xs text-[var(--muted-foreground)] mt-1">Questions</p>
                        </div>
                        <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <p className="text-3xl font-bold text-emerald-600">{results.correct}</p>
                            <p className="text-xs text-emerald-600 mt-1">Correct</p>
                        </div>
                        <div className="text-center p-4 bg-[var(--card)] rounded-xl border border-[var(--border)]">
                            <p className="text-3xl font-bold text-amber-500">{accuracy}%</p>
                            <p className="text-xs text-[var(--muted-foreground)] mt-1">Accuracy</p>
                        </div>
                    </div>

                    {/* Answers breakdown */}
                    <div className="w-full mt-4">
                        <p className="text-sm font-medium text-[var(--muted-foreground)] mb-3">Answer breakdown:</p>
                        <div className="flex gap-1">
                            {answers.map((correct, idx) => (
                                <div
                                    key={idx}
                                    className={`flex-1 h-3 rounded-full ${correct ? 'bg-emerald-500' : 'bg-red-400'}`}
                                    title={`Q${idx + 1}: ${correct ? 'Correct' : 'Incorrect'}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 mt-6 w-full">
                        <button
                            onClick={() => navigate("/library")}
                            className="flex-1 px-6 py-3 border border-[var(--border)] rounded-xl font-semibold hover:bg-[var(--muted)] transition-colors"
                        >
                            Back to Library
                        </button>
                        <button
                            onClick={() => {
                                setCurrentIndex(0)
                                setSelectedOption(null)
                                setHasAnswered(false)
                                setResults({ correct: 0, incorrect: 0 })
                                setIsComplete(false)
                                setAnswers([])
                            }}
                            className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </PageWrapper>
        )
    }

    return (
        <PageWrapper>
            <Header
                title="Quiz Mode"
                showBack
                onBack={() => navigate(-1)}
                rightAction={
                    <span className="text-sm text-[var(--muted-foreground)]">
                        {currentIndex + 1} / {quizQuestions.length}
                    </span>
                }
            />

            <div className="py-8 max-w-2xl mx-auto">
                {/* Progress bar */}
                <div className="mb-8">
                    <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-amber-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Question Card */}
                {currentQuestion && (
                    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-lg overflow-hidden">
                        {/* Question Header */}
                        <div className="px-6 py-4 bg-[var(--muted)]/30 border-b border-[var(--border)]">
                            <div className="flex items-center justify-between">
                                <span className={`
                                    px-3 py-1 rounded-full text-xs font-medium
                                    ${currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-700' : ''}
                                    ${currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' : ''}
                                    ${currentQuestion.difficulty === 'hard' ? 'bg-red-100 text-red-700' : ''}
                                `}>
                                    {currentQuestion.difficulty}
                                </span>
                                <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                                    <span className="material-symbols-outlined text-amber-500 text-lg">fact_check</span>
                                    <span>Multiple Choice</span>
                                </div>
                            </div>
                        </div>

                        {/* Question */}
                        <div className="p-6">
                            <h3 className="text-xl font-semibold leading-relaxed mb-6">
                                {currentQuestion.question}
                            </h3>

                            {/* Options */}
                            <div className="space-y-3">
                                {currentQuestion.options.map((option, idx) => {
                                    const isSelected = selectedOption === option
                                    const isCorrect = option === currentQuestion.correctAnswer
                                    const showCorrect = hasAnswered && isCorrect
                                    const showIncorrect = hasAnswered && isSelected && !isCorrect

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelectOption(option)}
                                            disabled={hasAnswered}
                                            className={`
                                                w-full text-left p-4 rounded-xl border-2 transition-all
                                                ${!hasAnswered && isSelected
                                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                                    : !hasAnswered && !isSelected
                                                        ? 'border-[var(--border)] hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
                                                        : ''
                                                }
                                                ${showCorrect ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : ''}
                                                ${showIncorrect ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
                                                ${hasAnswered && !showCorrect && !showIncorrect ? 'border-[var(--border)] opacity-50' : ''}
                                            `}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`
                                                    w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-bold text-sm
                                                    ${!hasAnswered && isSelected ? 'bg-amber-500 text-white' : ''}
                                                    ${!hasAnswered && !isSelected ? 'bg-[var(--muted)] text-[var(--muted-foreground)]' : ''}
                                                    ${showCorrect ? 'bg-emerald-500 text-white' : ''}
                                                    ${showIncorrect ? 'bg-red-500 text-white' : ''}
                                                    ${hasAnswered && !showCorrect && !showIncorrect ? 'bg-[var(--muted)] text-[var(--muted-foreground)]' : ''}
                                                `}>
                                                    {hasAnswered && showCorrect ? (
                                                        <span className="material-symbols-outlined text-lg">check</span>
                                                    ) : hasAnswered && showIncorrect ? (
                                                        <span className="material-symbols-outlined text-lg">close</span>
                                                    ) : (
                                                        String.fromCharCode(65 + idx)
                                                    )}
                                                </div>
                                                <span className="flex-1">{option}</span>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Answer Feedback */}
                        {hasAnswered && (
                            <div className={`
                                px-6 py-4 border-t
                                ${selectedOption === currentQuestion.correctAnswer
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                }
                            `}>
                                <div className="flex items-start gap-3">
                                    <span className={`material-symbols-outlined text-2xl ${selectedOption === currentQuestion.correctAnswer ? 'text-emerald-600' : 'text-red-600'
                                        }`}>
                                        {selectedOption === currentQuestion.correctAnswer ? 'check_circle' : 'cancel'}
                                    </span>
                                    <div>
                                        <p className={`font-semibold ${selectedOption === currentQuestion.correctAnswer ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                                            }`}>
                                            {selectedOption === currentQuestion.correctAnswer ? 'Correct!' : 'Incorrect'}
                                        </p>
                                        <p className="text-sm text-[var(--muted-foreground)] mt-1">
                                            <strong>Answer:</strong> {currentQuestion.correctAnswer}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="mt-6 flex justify-center">
                    {!hasAnswered ? (
                        <button
                            onClick={handleSubmitAnswer}
                            disabled={!selectedOption}
                            className="px-8 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">check</span>
                            Submit Answer
                        </button>
                    ) : (
                        <button
                            onClick={handleNextQuestion}
                            className="px-8 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
                        >
                            {currentIndex < quizQuestions.length - 1 ? (
                                <>
                                    Next Question
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </>
                            ) : (
                                <>
                                    See Results
                                    <span className="material-symbols-outlined">emoji_events</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Progress Stats */}
                <div className="mt-8 flex justify-center gap-6">
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full">
                        <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                        <span className="text-sm font-medium text-emerald-700">{results.correct} Correct</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-full">
                        <span className="material-symbols-outlined text-red-500 text-sm">cancel</span>
                        <span className="text-sm font-medium text-red-700">{results.incorrect} Wrong</span>
                    </div>
                </div>
            </div>
        </PageWrapper>
    )
}
