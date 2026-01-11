import { useNavigate } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"

export function MethodologyPage() {
    const navigate = useNavigate()

    return (
        <PageWrapper>
            <Header
                title="How it Works"
                showBack
                onBack={() => navigate("/library")}
                rightAction={
                    <button className="p-2 rounded-full hover:bg-[var(--muted)] text-primary">
                        <span className="material-symbols-outlined">info</span>
                    </button>
                }
            />

            <div className="py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Process */}
                    <div className="lg:col-span-2">
                        {/* Headline */}
                        <div className="mb-8">
                            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-2">
                                Academic Integrity First
                            </p>
                            <h1 className="tracking-tight text-4xl font-bold leading-tight mb-4">
                                Our AI Pipeline
                            </h1>
                            <p className="text-[var(--muted-foreground)] text-lg font-normal leading-relaxed max-w-2xl">
                                A multi-stage pipeline designed for academic rigor. Every summary maintains
                                original source integrity through a transparent three-step process.
                            </p>
                        </div>

                        {/* Timeline Steps */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Step 1 */}
                            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white mb-4">
                                    <span className="material-symbols-outlined text-2xl">description</span>
                                </div>
                                <span className="text-xs font-bold text-primary uppercase tracking-wider">Step 1</span>
                                <h3 className="text-xl font-bold leading-tight mt-2 mb-3">Document Parsing</h3>
                                <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
                                    Analyzes hierarchy and semantic structure from PDFs. Our OCR engine
                                    identifies headers, citations, and footnotes.
                                </p>
                                <div className="mt-4 inline-flex items-center gap-2 text-xs font-mono bg-[var(--muted)] p-2 rounded text-[var(--muted-foreground)]">
                                    <span className="material-symbols-outlined text-sm">terminal</span>
                                    <span>Structure preservation</span>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white mb-4">
                                    <span className="material-symbols-outlined text-2xl">key</span>
                                </div>
                                <span className="text-xs font-bold text-primary uppercase tracking-wider">Step 2</span>
                                <h3 className="text-xl font-bold leading-tight mt-2 mb-3">Keyword Extraction</h3>
                                <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
                                    Identifies core academic concepts using NLP. Builds a graph of related
                                    terminologies for thematic consistency.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                                        NLP ENGINE
                                    </span>
                                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                                        SEMANTIC
                                    </span>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white mb-4">
                                    <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                                </div>
                                <span className="text-xs font-bold text-primary uppercase tracking-wider">Step 3</span>
                                <h3 className="text-xl font-bold leading-tight mt-2 mb-3">Summary Generation</h3>
                                <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
                                    Synthesizes findings using specialized LLM weights optimized for
                                    formal academic writing and objective reporting.
                                </p>
                                <div className="mt-4 inline-flex items-center gap-2 text-xs font-mono bg-[var(--muted)] p-2 rounded text-[var(--muted-foreground)]">
                                    <span className="material-symbols-outlined text-sm">psychology</span>
                                    <span>LLM optimized</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Responsible AI */}
                    <div className="space-y-6">
                        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                                <h3 className="text-lg font-bold">Limitations & Responsible AI</h3>
                            </div>
                            <div className="p-5 space-y-5">
                                <div className="flex gap-4">
                                    <div className="p-2 bg-primary/10 rounded-lg h-fit">
                                        <span className="material-symbols-outlined text-primary">error</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1">Context Boundaries</h4>
                                        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                                            Cannot process documents exceeding 200,000 tokens. No external web-crawling.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="p-2 bg-primary/10 rounded-lg h-fit">
                                        <span className="material-symbols-outlined text-primary">gavel</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1">Ethical Use Policy</h4>
                                        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                                            For study aid only. Not for bypassing plagiarism detection or generating submissions.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="p-2 bg-primary/10 rounded-lg h-fit">
                                        <span className="material-symbols-outlined text-primary">security</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1">Data Privacy</h4>
                                        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                                            Documents processed securely. Not used for training future models.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CTA */}
                        <button
                            onClick={() => navigate("/upload")}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg"
                        >
                            <span>Start New Summary</span>
                            <span className="material-symbols-outlined">add_circle</span>
                        </button>
                        <p className="text-center text-xs text-[var(--muted-foreground)]">
                            Version 2.4.0 (StudyLens Build)
                        </p>
                    </div>
                </div>
            </div>
        </PageWrapper>
    )
}
