import { useNavigate } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"
import {
    useAllFlashcardDecks,
    useStudyStats,
    useOverallMastery,
    useDueFlashcards,
} from "@/hooks"

function formatRelativeDate(dateStr: string | null): string {
    if (!dateStr) return "Never"
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
}

export function DeckOverviewPage() {
    const navigate = useNavigate()

    const { data: decks = [], isLoading: decksLoading } = useAllFlashcardDecks()
    const { data: stats } = useStudyStats()
    const { data: mastery } = useOverallMastery()
    const { data: dueCards = [] } = useDueFlashcards()

    const totalCards = decks.reduce((sum, d) => sum + d.totalCards, 0)
    const totalDue = dueCards.length

    // Empty state -- no flashcards at all yet
    if (!decksLoading && decks.length === 0) {
        return (
            <PageWrapper>
                <Header
                    title="Flashcard Decks"
                    showBack
                    onBack={() => navigate("/library")}
                />
                <div className="flex flex-col items-center justify-center py-20 gap-6 max-w-md mx-auto text-center">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-5xl text-primary">
                            style
                        </span>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold">No Flashcard Decks Yet</h2>
                        <p className="text-[var(--muted-foreground)]">
                            Upload a document and generate an AI summary to automatically create flashcards.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <button
                            onClick={() => navigate("/upload")}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                        >
                            <span className="material-symbols-outlined">upload_file</span>
                            Upload a Document
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

    // Loading skeleton
    if (decksLoading) {
        return (
            <PageWrapper>
                <Header
                    title="Flashcard Decks"
                    showBack
                    onBack={() => navigate("/library")}
                />
                <div className="py-8 space-y-6">
                    {/* Stats skeleton */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="rounded-xl p-5 bg-[var(--card)] border border-[var(--border)] animate-pulse">
                                <div className="h-4 w-8 bg-[var(--muted)] rounded mb-3" />
                                <div className="h-7 w-16 bg-[var(--muted)] rounded mb-2" />
                                <div className="h-3 w-20 bg-[var(--muted)] rounded" />
                            </div>
                        ))}
                    </div>
                    {/* Deck list skeleton */}
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="rounded-xl p-5 bg-[var(--card)] border border-[var(--border)] animate-pulse">
                                <div className="h-5 w-48 bg-[var(--muted)] rounded mb-3" />
                                <div className="h-4 w-32 bg-[var(--muted)] rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </PageWrapper>
        )
    }

    const masteredTotal = decks.reduce((s, d) => s + d.masteredCards, 0)
    const learningTotal = decks.reduce((s, d) => s + d.learningCards, 0)
    const newTotal = decks.reduce((s, d) => s + d.newCards, 0)
    const masteredPct = totalCards > 0 ? Math.round((masteredTotal / totalCards) * 100) : 0
    const learningPct = totalCards > 0 ? Math.round((learningTotal / totalCards) * 100) : 0
    const newPct = totalCards > 0 ? 100 - masteredPct - learningPct : 0

    return (
        <PageWrapper>
            <Header
                title="Flashcard Decks"
                showBack
                onBack={() => navigate("/library")}
                rightAction={
                    <button
                        onClick={() => navigate("/flashcards")}
                        className="p-2 rounded-full hover:bg-[var(--muted)] transition-colors"
                        title="Review due cards"
                    >
                        <span className="material-symbols-outlined">play_circle</span>
                    </button>
                }
            />

            <div className="py-8 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-2 rounded-xl p-5 bg-[var(--card)] border border-[var(--border)] shadow-sm">
                        <div className="flex items-center gap-2 text-primary">
                            <span className="material-symbols-outlined text-xl">style</span>
                        </div>
                        <p className="text-xl font-bold leading-tight">{totalCards}</p>
                        <p className="text-[var(--muted-foreground)] text-xs font-medium">Total Cards</p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl p-5 bg-[var(--card)] border border-[var(--border)] shadow-sm">
                        <div className="flex items-center gap-2 text-amber-500">
                            <span className="material-symbols-outlined text-xl">pending_actions</span>
                        </div>
                        <p className="text-xl font-bold leading-tight">{totalDue}</p>
                        <p className="text-[var(--muted-foreground)] text-xs font-medium">Due Today</p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl p-5 bg-[var(--card)] border border-[var(--border)] shadow-sm">
                        <div className="flex items-center gap-2 text-emerald-500">
                            <span className="material-symbols-outlined text-xl">target</span>
                        </div>
                        <p className="text-xl font-bold leading-tight">{stats?.averageAccuracy ?? 0}%</p>
                        <p className="text-[var(--muted-foreground)] text-xs font-medium">Accuracy</p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl p-5 bg-[var(--card)] border border-[var(--border)] shadow-sm">
                        <div className="flex items-center gap-2 text-primary">
                            <span className="material-symbols-outlined text-xl">bolt</span>
                        </div>
                        <p className="text-xl font-bold leading-tight">{stats?.streakDays ?? 0}</p>
                        <p className="text-[var(--muted-foreground)] text-xs font-medium">Day Streak</p>
                    </div>
                </div>

                {/* Mastery Distribution */}
                {totalCards > 0 && (
                    <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[var(--muted-foreground)] text-sm font-medium">
                                Card Mastery Distribution
                            </p>
                            {mastery && mastery.totalConcepts > 0 && (
                                <span className="text-primary text-sm font-bold">
                                    {mastery.averageMastery}% avg
                                </span>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="flex h-4 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                            {masteredPct > 0 && <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${masteredPct}%` }} />}
                            {learningPct > 0 && <div className="bg-primary transition-all duration-500" style={{ width: `${learningPct}%` }} />}
                            {newPct > 0 && <div className="bg-slate-300 dark:bg-slate-600 transition-all duration-500" style={{ width: `${newPct}%` }} />}
                        </div>

                        {/* Legend */}
                        <div className="grid grid-cols-3 gap-4 pt-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10">
                                <span className="size-3 rounded-full bg-emerald-500" />
                                <div>
                                    <p className="text-[var(--muted-foreground)] text-xs font-medium">Mastered</p>
                                    <p className="font-bold text-lg">{masteredTotal}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10">
                                <span className="size-3 rounded-full bg-primary" />
                                <div>
                                    <p className="text-[var(--muted-foreground)] text-xs font-medium">Learning</p>
                                    <p className="font-bold text-lg">{learningTotal}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-200 dark:bg-slate-700">
                                <span className="size-3 rounded-full bg-slate-400" />
                                <div>
                                    <p className="text-[var(--muted-foreground)] text-xs font-medium">New</p>
                                    <p className="font-bold text-lg">{newTotal}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Review Due Cards CTA */}
                {totalDue > 0 && (
                    <button
                        onClick={() => navigate("/flashcards")}
                        className="flex w-full items-center justify-center gap-3 bg-primary text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbols-outlined">play_circle</span>
                        <span>Review {totalDue} Due Card{totalDue !== 1 ? 's' : ''}</span>
                    </button>
                )}

                {/* Deck List */}
                <div className="space-y-2">
                    <h3 className="text-lg font-bold px-1">Your Decks</h3>
                    <div className="space-y-3">
                        {decks.map(deck => {
                            const deckMasteredPct = deck.totalCards > 0
                                ? Math.round((deck.masteredCards / deck.totalCards) * 100)
                                : 0

                            return (
                                <button
                                    key={deck.documentId}
                                    onClick={() => navigate(`/study?id=${deck.documentId}`)}
                                    className="w-full text-left bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 hover:border-primary/40 hover:shadow-md transition-all active:scale-[0.99]"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-base truncate">
                                                {deck.documentTitle}
                                            </h4>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-[var(--muted-foreground)]">
                                                <span>{deck.totalCards} card{deck.totalCards !== 1 ? 's' : ''}</span>
                                                <span className="text-[var(--border)]">|</span>
                                                <span>Studied {formatRelativeDate(deck.lastStudiedAt)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            {deck.dueCards > 0 && (
                                                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                                                    {deck.dueCards} due
                                                </span>
                                            )}
                                            <span className="material-symbols-outlined text-[var(--muted-foreground)]">
                                                chevron_right
                                            </span>
                                        </div>
                                    </div>

                                    {/* Mini progress bar */}
                                    <div className="mt-3 flex items-center gap-3">
                                        <div className="flex-1 h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 transition-all duration-300"
                                                style={{ width: `${deckMasteredPct}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-medium text-[var(--muted-foreground)] w-10 text-right">
                                            {deckMasteredPct}%
                                        </span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </PageWrapper>
    )
}
