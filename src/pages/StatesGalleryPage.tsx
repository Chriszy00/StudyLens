import { useNavigate } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"

export function StatesGalleryPage() {
    const navigate = useNavigate()

    return (
        <PageWrapper>
            <Header title="UI State Gallery" showBack onBack={() => navigate("/library")} />

            <div className="py-8">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold mb-2">Empty & Error States</h2>
                    <p className="text-[var(--muted-foreground)]">
                        Examples of how the application handles various edge cases and error conditions.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Empty State */}
                    <div className="bg-[var(--card)] rounded-xl shadow-sm border border-[var(--border)] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30">
                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                                Empty State
                            </span>
                        </div>
                        <div className="flex flex-col px-6 py-10 items-center gap-6">
                            <div className="flex items-center justify-center w-24 h-24 bg-primary/5 rounded-full">
                                <span className="material-symbols-outlined text-primary/40 text-5xl">
                                    auto_stories
                                </span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <p className="text-xl font-bold leading-tight tracking-tight text-center">
                                    Your Library is Empty
                                </p>
                                <p className="text-[var(--muted-foreground)] text-sm font-normal leading-normal text-center max-w-[220px]">
                                    Start by adding your first academic paper or textbook.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate("/upload")}
                                className="flex items-center justify-center gap-2 rounded-lg h-10 px-5 bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all"
                            >
                                <span className="material-symbols-outlined text-lg">add</span>
                                Start New Session
                            </button>
                        </div>
                    </div>

                    {/* Upload Error */}
                    <div className="bg-[var(--card)] rounded-xl shadow-sm border border-[var(--border)] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30">
                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                                Error State
                            </span>
                        </div>
                        <div className="p-6">
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 flex items-center justify-center rounded-lg shrink-0">
                                    <span className="material-symbols-outlined text-red-500 text-2xl">cloud_off</span>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-red-500 text-sm">error</span>
                                            <p className="text-base font-bold leading-tight">Upload Interrupted</p>
                                        </div>
                                        <p className="text-[var(--muted-foreground)] text-sm">
                                            Please check your connection and try again.
                                        </p>
                                    </div>
                                    <button className="flex items-center gap-2 rounded-lg h-8 px-3 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-sm font-semibold w-fit transition-colors">
                                        <span className="material-symbols-outlined text-base">refresh</span>
                                        Retry Upload
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Warning State */}
                    <div className="bg-[var(--card)] rounded-xl shadow-sm border border-[var(--border)] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30">
                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                                Warning State
                            </span>
                        </div>
                        <div className="p-6">
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center rounded-lg shrink-0">
                                    <span className="material-symbols-outlined text-amber-600 text-2xl">short_text</span>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-amber-600 text-sm">warning</span>
                                            <p className="text-base font-bold leading-tight">More Context Needed</p>
                                        </div>
                                        <p className="text-[var(--muted-foreground)] text-sm">
                                            At least 100 words required for accurate summary.
                                        </p>
                                    </div>
                                    <button className="flex items-center gap-2 rounded-lg h-8 px-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 text-sm font-semibold w-fit transition-colors">
                                        Add More Text
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Success State */}
                    <div className="bg-[var(--card)] rounded-xl shadow-sm border border-[var(--border)] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30">
                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                                Success State
                            </span>
                        </div>
                        <div className="p-6">
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center rounded-lg shrink-0">
                                    <span className="material-symbols-outlined text-emerald-600 text-2xl">check_circle</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-base font-bold leading-tight">Analysis Complete</p>
                                        </div>
                                        <p className="text-[var(--muted-foreground)] text-sm">
                                            Your summary has been generated successfully.
                                        </p>
                                    </div>
                                    <button className="flex items-center gap-2 rounded-lg h-8 px-3 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 text-sm font-semibold w-fit transition-colors">
                                        View Results
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Toast */}
                    <div className="bg-[var(--card)] rounded-xl shadow-sm border border-[var(--border)] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30">
                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                                Info Toast
                            </span>
                        </div>
                        <div className="p-6">
                            <div className="p-4 bg-[var(--muted)] rounded-lg border border-primary/20 flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">info</span>
                                <p className="text-sm font-medium">
                                    Tip: Drag and drop PDF files for faster analysis.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Loading State */}
                    <div className="bg-[var(--card)] rounded-xl shadow-sm border border-[var(--border)] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30">
                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                                Loading State
                            </span>
                        </div>
                        <div className="flex flex-col px-6 py-10 items-center gap-4">
                            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <p className="text-[var(--muted-foreground)] text-sm font-medium">
                                Analyzing your document...
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </PageWrapper>
    )
}
