import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageWrapper } from "@/components/layout"

export function FlashcardsPage() {
    const navigate = useNavigate()
    const [currentCard, setCurrentCard] = useState(3)
    const totalCards = 10
    const [isFlipped, setIsFlipped] = useState(false)

    const progress = (currentCard / totalCards) * 100

    const handlePrevious = () => {
        if (currentCard > 1) {
            setCurrentCard(currentCard - 1)
            setIsFlipped(false)
        }
    }

    const handleNext = () => {
        if (currentCard < totalCards) {
            setCurrentCard(currentCard + 1)
            setIsFlipped(false)
        }
    }

    return (
        <PageWrapper maxWidth="4xl">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
                <div className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
                    <button
                        onClick={() => navigate("/deck")}
                        className="flex items-center gap-2 p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                        <span className="font-medium">Exit</span>
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="text-center">
                            <p className="text-sm font-medium text-[var(--muted-foreground)]">
                                Biology: Molecular Genetics
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-lg font-bold">{currentCard} / {totalCards}</span>
                        <button className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors text-primary">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                    </div>
                </div>
                {/* Progress Bar */}
                <div className="h-1 bg-primary/20">
                    <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </header>

            {/* Main Flashcard Area */}
            <main className="flex flex-col items-center justify-center py-12 px-6 min-h-[calc(100vh-200px)]">
                <div className="w-full max-w-2xl">
                    <div className="bg-[var(--card)] rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden">
                        {/* Image Area */}
                        <div
                            className="w-full h-64 bg-center bg-no-repeat bg-cover relative"
                            style={{
                                backgroundImage: `url("https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&h=400&fit=crop")`,
                            }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-[var(--card)] to-transparent" />
                        </div>

                        {/* Card Content */}
                        <div className="p-8 text-center">
                            <span className="text-primary text-xs font-bold uppercase tracking-widest mb-4 block">
                                {isFlipped ? "Answer" : "Question"}
                            </span>
                            <h3 className="text-2xl font-bold leading-relaxed mb-8">
                                {isFlipped
                                    ? "DNA contains deoxyribose sugar and thymine, while RNA contains ribose sugar and uracil. DNA is double-stranded, RNA is single-stranded."
                                    : "What are the primary differences between DNA and RNA nucleotide structures?"}
                            </h3>

                            <button
                                onClick={() => setIsFlipped(!isFlipped)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl h-14 px-8 bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all"
                            >
                                <span>{isFlipped ? "Show Question" : "Flip to see Answer"}</span>
                                <span className="material-symbols-outlined">sync</span>
                            </button>
                            <p className="text-[var(--muted-foreground)] text-sm mt-4">
                                Generated from your uploaded lecture notes
                            </p>
                        </div>
                    </div>

                    {/* Navigation Controls */}
                    <div className="flex justify-between items-center mt-8 gap-4">
                        <button
                            onClick={handlePrevious}
                            disabled={currentCard === 1}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl h-14 px-6 bg-[var(--card)] border border-[var(--border)] text-base font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary/50"
                        >
                            <span className="material-symbols-outlined">arrow_back_ios</span>
                            <span>Previous</span>
                        </button>

                        <div className="flex gap-2">
                            <button className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors" title="Need more practice">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                            <button className="p-3 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors" title="Almost there">
                                <span className="material-symbols-outlined">remove</span>
                            </button>
                            <button className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors" title="Got it!">
                                <span className="material-symbols-outlined">check</span>
                            </button>
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={currentCard === totalCards}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl h-14 px-6 bg-primary text-white text-base font-bold transition-all active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
                        >
                            <span>Next Card</span>
                            <span className="material-symbols-outlined">arrow_forward_ios</span>
                        </button>
                    </div>
                </div>
            </main>
        </PageWrapper>
    )
}
