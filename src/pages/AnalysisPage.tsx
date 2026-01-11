import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Header, PageWrapper } from "@/components/layout"
import { getDocument } from "@/services/documents"
import { getSummary, processDocument, type StudyQuestion } from "@/services/ai"

const summaryTabs = ["Short", "Detailed", "Bullets"]

export function AnalysisPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const documentId = searchParams.get("id")
    const queryClient = useQueryClient()

    const [activeTab, setActiveTab] = useState("Short")
    const [highlightKeywords, setHighlightKeywords] = useState(true)

    // Document Query
    const { data: document, isLoading: isLoadingDoc, isError: isDocError } = useQuery({
        queryKey: ['document', documentId],
        queryFn: () => getDocument(documentId!),
        enabled: !!documentId
    })

    // Summary Query with Polling
    const { data: summary, isLoading: isLoadingSummary, error: summaryError } = useQuery({
        queryKey: ['summary', documentId],
        queryFn: () => getSummary(documentId!),
        enabled: !!documentId,
        refetchInterval: (query) => {
            const status = query.state.data?.processing_status
            return (status === 'processing' || status === 'pending') ? 1500 : false
        }
    })

    // Generate Summary Mutation
    const generateMutation = useMutation({
        mutationFn: () => processDocument(documentId!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['summary', documentId] })
        }
    })

    const handleGenerateSummary = () => {
        if (!documentId) return
        generateMutation.mutate()
    }

    const isLoading = isLoadingDoc || isLoadingSummary
    const error = isDocError ? "Failed to load document" : (summaryError ? "Failed to load summary" : null)

    // Derived values
    const documentTitle = document?.title || "Loading..."
    const originalText = document?.original_text || "No text content available"

    // Determine if processing (either local mutation or server status)
    const isProcessing = generateMutation.isPending ||
        summary?.processing_status === 'processing' ||
        summary?.processing_status === 'pending'

    // Render keywords with highlights
    function renderTextWithKeywords(text: string) {
        if (!highlightKeywords || !summary?.keywords?.length) {
            return <span>{text}</span>
        }

        const keywords = summary.keywords
        let result = text

        // Simple highlight - wrap keywords in spans
        keywords.forEach(keyword => {
            const regex = new RegExp(`(${keyword})`, 'gi')
            result = result.replace(regex, '|||$1|||')
        })

        const parts = result.split('|||')

        return (
            <>
                {parts.map((part, i) => {
                    const isKeyword = keywords.some(k =>
                        k.toLowerCase() === part.toLowerCase()
                    )
                    return isKeyword ? (
                        <span key={i} className="bg-primary/20 text-primary px-1 rounded font-medium">
                            {part}
                        </span>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                })}
            </>
        )
    }

    // Get current summary content based on active tab
    function getCurrentSummaryContent() {
        if (!summary) return null

        switch (activeTab) {
            case "Short":
                return summary.short_summary || "No short summary available"
            case "Detailed":
                return summary.detailed_summary || "No detailed summary available"
            case "Bullets":
                return summary.bullet_points?.length
                    ? summary.bullet_points
                    : ["No bullet points available"]
            default:
                return null
        }
    }

    if (isLoading) {
        return (
            <PageWrapper>
                <Header title="Loading..." showBack onBack={() => navigate("/library")} />
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-[var(--muted-foreground)]">Loading document...</p>
                    </div>
                </div>
            </PageWrapper>
        )
    }

    if (error && !summary) {
        return (
            <PageWrapper>
                <Header title="Error" showBack onBack={() => navigate("/library")} />
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                    <p className="text-red-500">{error}</p>
                    <button
                        onClick={() => navigate("/library")}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm"
                    >
                        Back to Library
                    </button>
                </div>
            </PageWrapper>
        )
    }

    return (
        <PageWrapper>
            <Header
                title={documentTitle}
                showBack
                onBack={() => navigate("/library")}
                rightAction={
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors">
                            <span className="material-symbols-outlined text-lg">download</span>
                            Export PDF
                        </button>
                        <button className="p-2 rounded-full hover:bg-[var(--muted)] text-primary">
                            <span className="material-symbols-outlined">share</span>
                        </button>
                    </div>
                }
            />

            <div className="py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Source Document */}
                    <div className="lg:col-span-1">
                        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden sticky top-24">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-lg">description</span>
                                    <span className="text-sm font-bold uppercase tracking-wider">Source Document</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--muted-foreground)]">Highlight</span>
                                    <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                        <input
                                            type="checkbox"
                                            checked={highlightKeywords}
                                            onChange={(e) => setHighlightKeywords(e.target.checked)}
                                        />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                            </div>

                            <div className="p-5 max-h-[60vh] overflow-y-auto hide-scrollbar">
                                <div className="text-[var(--muted-foreground)] text-sm leading-relaxed whitespace-pre-wrap">
                                    {renderTextWithKeywords(originalText.substring(0, 2000))}
                                    {originalText.length > 2000 && (
                                        <span className="text-primary">... [truncated for display]</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Summary & Analysis */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* No Summary - Generate Button */}
                        {!summary || summary.processing_status === 'pending' || summary.processing_status === 'failed' ? (
                            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm p-8 text-center">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-3xl text-primary">auto_awesome</span>
                                </div>
                                <h3 className="text-xl font-bold mb-2">Generate AI Summary</h3>
                                <p className="text-[var(--muted-foreground)] mb-6">
                                    Use AI to analyze this document and generate summaries, keywords, and study questions.
                                </p>
                                <button
                                    onClick={handleGenerateSummary}
                                    disabled={isProcessing}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {isProcessing ? (
                                        <>
                                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined">auto_awesome</span>
                                            Generate Summary
                                        </>
                                    )}
                                </button>
                                {(error || summary?.error_message || generateMutation.error) && (
                                    <p className="text-red-500 mt-4 text-sm">
                                        {error || summary?.error_message || generateMutation.error?.message}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Summary Section */}
                                <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
                                    {/* Tabs */}
                                    <div className="flex border-b border-[var(--border)] px-5 gap-6">
                                        {summaryTabs.map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 transition-colors ${activeTab === tab
                                                    ? "border-b-primary text-primary"
                                                    : "border-b-transparent text-[var(--muted-foreground)] hover:text-primary"
                                                    }`}
                                            >
                                                <p className="text-sm font-bold tracking-wide">{tab}</p>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-6">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-primary">auto_awesome</span>
                                            <h4 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                                                AI Summary
                                            </h4>
                                        </div>

                                        {activeTab === "Bullets" ? (
                                            <ul className="space-y-2">
                                                {(getCurrentSummaryContent() as string[]).map((point, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <span className="material-symbols-outlined text-primary text-sm mt-1">check_circle</span>
                                                        <span>{point}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-base font-normal leading-relaxed">
                                                {getCurrentSummaryContent() as string}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-[var(--card)] p-5 rounded-xl border border-[var(--border)] shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary">compress</span>
                                                <p className="text-sm text-[var(--muted-foreground)] font-medium">
                                                    Compression Ratio
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <span className="text-3xl font-bold text-primary">
                                                {summary.compression_ratio || 0}%
                                            </span>
                                            <span className="material-symbols-outlined text-emerald-500 text-lg mb-1">
                                                trending_down
                                            </span>
                                            <span className="text-emerald-500 text-sm font-medium mb-1">
                                                {(summary.compression_ratio || 0) > 70 ? "Excellent" : "Good"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[var(--muted-foreground)] mt-2">
                                            Original reduced by {summary.compression_ratio || 0}%
                                        </p>
                                    </div>

                                    <div className="bg-[var(--card)] p-5 rounded-xl border border-[var(--border)] shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary">key</span>
                                                <p className="text-sm text-[var(--muted-foreground)] font-medium">
                                                    Keyword Coverage
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <span className="text-3xl font-bold text-primary">
                                                {summary.keyword_coverage || 0}%
                                            </span>
                                            <span className="material-symbols-outlined text-emerald-500 text-lg mb-1">
                                                check_circle
                                            </span>
                                            <span className="text-emerald-500 text-sm font-medium mb-1">Complete</span>
                                        </div>
                                        <p className="text-xs text-[var(--muted-foreground)] mt-2">Key concepts preserved</p>
                                    </div>
                                </div>

                                {/* Keywords */}
                                {summary.keywords && summary.keywords.length > 0 && (
                                    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
                                        <div className="flex items-center gap-2 px-6 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                                            <span className="material-symbols-outlined text-primary">key</span>
                                            <h4 className="text-sm font-bold uppercase tracking-wider">Keywords</h4>
                                        </div>
                                        <div className="p-6 flex flex-wrap gap-2">
                                            {summary.keywords.map((keyword, i) => (
                                                <span
                                                    key={i}
                                                    className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
                                                >
                                                    {keyword}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Study Questions */}
                                {summary.study_questions && (summary.study_questions as StudyQuestion[]).length > 0 && (
                                    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
                                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary">quiz</span>
                                                <h4 className="text-sm font-bold uppercase tracking-wider">Study Questions</h4>
                                            </div>
                                            <button
                                                onClick={() => navigate(`/study?id=${documentId}`)}
                                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-lg">school</span>
                                                Study Flashcards
                                            </button>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            {(summary.study_questions as StudyQuestion[]).map((q, i) => (
                                                <details key={i} className="group">
                                                    <summary className="flex gap-4 p-4 bg-primary/5 rounded-xl border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer list-none">
                                                        <div className="size-8 rounded-full bg-primary text-white text-sm flex items-center justify-center shrink-0 font-bold">
                                                            {i + 1}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-base font-medium">{q.question}</p>
                                                            <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                                                q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-red-100 text-red-700'
                                                                }`}>
                                                                {q.difficulty}
                                                            </span>
                                                        </div>
                                                        <span className="material-symbols-outlined text-primary group-open:rotate-180 transition-transform">
                                                            expand_more
                                                        </span>
                                                    </summary>
                                                    <div className="mt-2 ml-12 p-4 bg-[var(--muted)]/50 rounded-lg text-[var(--muted-foreground)]">
                                                        <strong>Answer:</strong> {q.answer}
                                                    </div>
                                                </details>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </PageWrapper>
    )
}
