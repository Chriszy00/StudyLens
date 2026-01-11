import { useNavigate } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"

export function DeckOverviewPage() {
    const navigate = useNavigate()

    return (
        <PageWrapper>
            <Header
                title="Intro to Macroeconomics"
                showBack
                onBack={() => navigate("/library")}
                rightAction={
                    <button className="p-2 rounded-full hover:bg-[var(--muted)] transition-colors">
                        <span className="material-symbols-outlined">more_vert</span>
                    </button>
                }
            />

            <div className="py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Practice Mode Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Headline & Summary */}
                        <div>
                            <h2 className="tracking-tight text-3xl font-bold leading-tight pb-2">
                                Practice Mode
                            </h2>
                            <p className="text-[var(--muted-foreground)] text-lg font-normal leading-normal">
                                You have 23 cards left to master in this deck.
                            </p>
                        </div>

                        {/* Chart Section */}
                        <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[var(--muted-foreground)] text-sm font-medium">
                                        Learning Distribution
                                    </p>
                                    <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">trending_up</span> 12% this week
                                    </span>
                                </div>
                                <p className="text-4xl font-bold leading-tight">35 Cards</p>

                                {/* Progress Bar */}
                                <div className="flex h-4 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                                    <div className="bg-emerald-500" style={{ width: "34%" }} />
                                    <div className="bg-primary" style={{ width: "23%" }} />
                                    <div className="bg-slate-300 dark:bg-slate-600" style={{ width: "43%" }} />
                                </div>

                                {/* Legend */}
                                <div className="grid grid-cols-3 gap-4 pt-4">
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10">
                                        <span className="size-3 rounded-full bg-emerald-500" />
                                        <div>
                                            <p className="text-[var(--muted-foreground)] text-xs font-medium">Mastered</p>
                                            <p className="font-bold text-lg">12</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10">
                                        <span className="size-3 rounded-full bg-primary" />
                                        <div>
                                            <p className="text-[var(--muted-foreground)] text-xs font-medium">Reviewing</p>
                                            <p className="font-bold text-lg">8</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-200 dark:bg-slate-700">
                                        <span className="size-3 rounded-full bg-slate-400" />
                                        <div>
                                            <p className="text-[var(--muted-foreground)] text-xs font-medium">New</p>
                                            <p className="font-bold text-lg">15</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex flex-col gap-2 rounded-xl p-5 bg-[var(--card)] border border-[var(--border)] shadow-sm">
                                <div className="flex items-center gap-2 text-primary">
                                    <span className="material-symbols-outlined text-xl">timer</span>
                                </div>
                                <p className="text-xl font-bold leading-tight">15 mins</p>
                                <p className="text-[var(--muted-foreground)] text-xs font-medium">Estimated time</p>
                            </div>
                            <div className="flex flex-col gap-2 rounded-xl p-5 bg-[var(--card)] border border-[var(--border)] shadow-sm">
                                <div className="flex items-center gap-2 text-primary">
                                    <span className="material-symbols-outlined text-xl">bolt</span>
                                </div>
                                <p className="text-xl font-bold leading-tight">4 Days</p>
                                <p className="text-[var(--muted-foreground)] text-xs font-medium">Daily Streak</p>
                            </div>
                            <div className="flex flex-col gap-2 rounded-xl p-5 bg-[var(--card)] border border-[var(--border)] shadow-sm">
                                <div className="flex items-center gap-2 text-primary">
                                    <span className="material-symbols-outlined text-xl">target</span>
                                </div>
                                <p className="text-xl font-bold leading-tight">85%</p>
                                <p className="text-[var(--muted-foreground)] text-xs font-medium">Accuracy</p>
                            </div>
                            <div className="flex flex-col gap-2 rounded-xl p-5 bg-[var(--card)] border border-[var(--border)] shadow-sm">
                                <div className="flex items-center gap-2 text-primary">
                                    <span className="material-symbols-outlined text-xl">schedule</span>
                                </div>
                                <p className="text-xl font-bold leading-tight">2.5 hrs</p>
                                <p className="text-[var(--muted-foreground)] text-xs font-medium">Total time</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Actions */}
                    <div className="space-y-4">
                        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                                <h3 className="font-bold">Quick Actions</h3>
                            </div>
                            <div className="divide-y divide-[var(--border)]">
                                <button className="flex w-full items-center justify-between p-4 hover:bg-[var(--muted)]/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[var(--muted-foreground)]">settings</span>
                                        <span className="font-medium">Practice Settings</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[var(--muted-foreground)]">chevron_right</span>
                                </button>
                                <button className="flex w-full items-center justify-between p-4 hover:bg-[var(--muted)]/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[var(--muted-foreground)]">shuffle</span>
                                        <span className="font-medium">Shuffle Cards</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[var(--muted-foreground)]">chevron_right</span>
                                </button>
                                <button className="flex w-full items-center justify-between p-4 hover:bg-[var(--muted)]/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[var(--muted-foreground)]">restart_alt</span>
                                        <span className="font-medium">Reset Progress</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[var(--muted-foreground)]">chevron_right</span>
                                </button>
                            </div>
                        </div>

                        {/* Start Practice Button */}
                        <button
                            onClick={() => navigate("/flashcards")}
                            className="flex w-full items-center justify-center gap-2 bg-primary text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined">play_circle</span>
                            <span>Start Practice</span>
                        </button>
                    </div>
                </div>
            </div>
        </PageWrapper>
    )
}
