import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"
import { FileViewer } from "@/components/FileViewer"
import { useDocument, useSummary, useProcessDocument } from "@/hooks"
import { useAdmin } from "@/contexts/AdminContext"
import type { StudyQuestion } from "@/services/ai"

const summaryTabs = ["Short", "Detailed", "Bullets"]

export function AnalysisPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const documentId = searchParams.get("id")

    // Admin context - check if summary feature is enabled
    const { settings, isLoadingSettings } = useAdmin()
    const isSummaryEnabled = settings?.summary_enabled !== false // Default to true if settings not loaded

    // State for full screen file viewer
    const [showFileViewer, setShowFileViewer] = useState(false)

    // Read processing options from URL params (set by UploadPage)
    const autoProcess = searchParams.get("autoProcess") === "true"
    const extractKeywords = searchParams.get("keywords") !== "false" // default true
    // Note: showMetrics param controls UI display only - metrics are always calculated by backend
    const generateQuestions = searchParams.get("questions") === "true" // default false

    const [activeTab, setActiveTab] = useState("Short")
    const [highlightKeywords, setHighlightKeywords] = useState(true)
    const [viewMode, setViewMode] = useState<'text' | 'file'>('file')

    // Track if we've already triggered auto-processing
    const hasAutoProcessed = useRef(false)

    // Use custom hooks instead of raw useQuery/useMutation
    // Document Query
    const { data: document, isLoading: isLoadingDoc, isError: isDocError, fetchStatus: docFetchStatus, status: docStatus } = useDocument(documentId)

    // Summary Query with Polling (polling is handled inside useSummary hook)
    const { data: summary, isLoading: isLoadingSummary, error: summaryError, fetchStatus: summaryFetchStatus, status: summaryStatus } = useSummary(documentId)

    // Generate Summary Mutation
    const generateMutation = useProcessDocument()

    // 🔍 DIAGNOSTIC LOGGING - Remove after debugging
    console.log('📄 [AnalysisPage] ===== RENDER =====')
    console.log('📄 [AnalysisPage] documentId from URL:', documentId, '| Type:', typeof documentId)
    console.log('📄 [AnalysisPage] Query enabled condition (!!documentId):', !!documentId)
    console.log('📄 [AnalysisPage] Document Query State:', {
        isLoading: isLoadingDoc,
        isError: isDocError,
        fetchStatus: docFetchStatus,
        status: docStatus,
        hasData: !!document,
        documentTitle: document?.title || 'N/A'
    })
    console.log('📄 [AnalysisPage] Summary Query State:', {
        isLoading: isLoadingSummary,
        error: summaryError?.message || null,
        fetchStatus: summaryFetchStatus,
        status: summaryStatus,
        hasData: !!summary,
        processingStatus: summary?.processing_status || 'N/A'
    })
    console.log('📄 [AnalysisPage] Combined isLoading:', isLoadingDoc || isLoadingSummary)

    // Set default active tab based on document type
    useEffect(() => {
        if (document?.type) {
            switch (document.type) {
                case 'short':
                    setActiveTab('Short')
                    break
                case 'detailed':
                    setActiveTab('Detailed')
                    break
                case 'study_notes':
                    setActiveTab('Bullets')
                    break
            }
        }

        // Default to text view if no file is available
        if (document && !document.storage_path) {
            setViewMode('text')
        }
    }, [document?.type, document?.storage_path])

    // Auto-trigger processing for new documents (coming from UploadPage)
    // Only triggers if summary feature is enabled by admin
    useEffect(() => {
        if (
            autoProcess &&
            documentId &&
            !hasAutoProcessed.current &&
            !summary && // No existing summary
            !generateMutation.isPending &&
            !isLoadingSummary &&
            !isLoadingSettings && // Wait for settings to load
            isSummaryEnabled // Only process if summary feature is enabled
        ) {
            hasAutoProcessed.current = true
            console.log('🚀 Auto-triggering AI processing with options:', {
                extractKeywords,
                generateQuestions,
            })

            // Trigger AI processing with user's selected options
            generateMutation.mutate({
                documentId,
                options: {
                    generateShortSummary: true,
                    generateDetailedSummary: true,
                    extractKeywords,
                    generateQuestions,
                },
            }, {
                onSuccess: (data) => {
                    if (data.wasChunked) {
                        console.log(`📊 Document processed in ${data.chunksProcessed} chunks`)
                        setChunkingInfo({
                            wasChunked: true,
                            chunksProcessed: data.chunksProcessed || 0,
                            wasTruncated: data.wasTruncated || false,
                            originalLength: data.originalLength || 0,
                        })
                    }
                }
            })
        }
    }, [autoProcess, documentId, summary, generateMutation, isLoadingSummary, extractKeywords, generateQuestions, isLoadingSettings, isSummaryEnabled])

    // State for chunking information (to show user warnings/info)
    const [chunkingInfo, setChunkingInfo] = useState<{
        wasChunked: boolean
        chunksProcessed: number
        wasTruncated: boolean
        originalLength: number
    } | null>(null)

    const handleGenerateSummary = () => {
        if (!documentId) return
        generateMutation.mutate({
            documentId,
            options: {
                generateShortSummary: true,
                generateDetailedSummary: true,
                extractKeywords: true,
                generateQuestions: true,
            },
        }, {
            onSuccess: (data) => {
                if (data.wasChunked) {
                    setChunkingInfo({
                        wasChunked: true,
                        chunksProcessed: data.chunksProcessed || 0,
                        wasTruncated: data.wasTruncated || false,
                        originalLength: data.originalLength || 0,
                    })
                }
            }
        })
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

    // Render detailed summary with formatted sections
    function renderDetailedSummary(text: string) {
        // Section headers and their icons/colors
        const sectionConfig: Record<string, { icon: string; color: string; label: string }> = {
            'INTRODUCTION': { icon: 'play_circle', color: 'text-blue-500', label: 'Introduction' },
            'CORE CONCEPTS': { icon: 'hub', color: 'text-purple-500', label: 'Core Concepts' },
            'KEY COMPONENTS': { icon: 'settings', color: 'text-emerald-500', label: 'Key Components' },
            'APPLICATIONS': { icon: 'apps', color: 'text-orange-500', label: 'Applications' },
            'CONNECTIONS': { icon: 'share', color: 'text-cyan-500', label: 'Connections' },
            'KEY TAKEAWAYS': { icon: 'lightbulb', color: 'text-amber-500', label: 'Key Takeaways' },
        }

        // Try to parse sections
        const sectionRegex = /\*\*([A-Z\s]+):\*\*\s*/g
        const sections: Array<{ header: string; content: string }> = []
        let match

        // Clone regex for exec
        const regex = new RegExp(sectionRegex)
        const matches: Array<{ header: string; start: number; end: number }> = []

        while ((match = regex.exec(text)) !== null) {
            matches.push({
                header: match[1].trim(),
                start: match.index,
                end: match.index + match[0].length
            })
        }

        // If no sections found, render as formatted paragraphs
        if (matches.length === 0) {
            // Split by double newlines and render as paragraphs
            const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
            return (
                <div className="space-y-4">
                    {paragraphs.map((para, i) => (
                        <p key={i} className="text-base leading-relaxed">
                            {para.trim()}
                        </p>
                    ))}
                </div>
            )
        }

        // Extract content between headers
        for (let i = 0; i < matches.length; i++) {
            const contentStart = matches[i].end
            const contentEnd = i < matches.length - 1 ? matches[i + 1].start : text.length
            const content = text.substring(contentStart, contentEnd).trim()
            sections.push({ header: matches[i].header, content })
        }

        return (
            <div className="space-y-5">
                {sections.map((section, i) => {
                    const config = sectionConfig[section.header] || {
                        icon: 'article',
                        color: 'text-primary',
                        label: section.header.charAt(0) + section.header.slice(1).toLowerCase()
                    }
                    return (
                        <div key={i} className="group">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`material-symbols-outlined text-lg ${config.color}`}>
                                    {config.icon}
                                </span>
                                <h5 className={`text-sm font-bold uppercase tracking-wide ${config.color}`}>
                                    {config.label}
                                </h5>
                            </div>
                            <p className="text-base leading-relaxed pl-7 border-l-2 border-[var(--border)] ml-2">
                                {section.content}
                            </p>
                        </div>
                    )
                })}
            </div>
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
                {/* Chunking Info Banner - Shows when document was processed in multiple parts */}
                {chunkingInfo?.wasChunked && (
                    <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${chunkingInfo.wasTruncated
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-blue-500/10 border-blue-500/30'
                        }`}>
                        <span className={`material-symbols-outlined text-xl ${chunkingInfo.wasTruncated ? 'text-amber-500' : 'text-blue-500'
                            }`}>
                            {chunkingInfo.wasTruncated ? 'warning' : 'info'}
                        </span>
                        <div className="flex-1">
                            <h4 className={`font-semibold text-sm ${chunkingInfo.wasTruncated ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'
                                }`}>
                                {chunkingInfo.wasTruncated ? 'Large Document - Partial Analysis' : 'Multi-Section Analysis'}
                            </h4>
                            <p className="text-sm text-[var(--muted-foreground)] mt-1">
                                {chunkingInfo.wasTruncated ? (
                                    <>
                                        Your document ({Math.round(chunkingInfo.originalLength / 1000)}K characters)
                                        was too large to analyze completely. We processed the first {chunkingInfo.chunksProcessed} sections
                                        to generate this summary. Some content at the end may not be included.
                                    </>
                                ) : (
                                    <>
                                        Your document was analyzed in {chunkingInfo.chunksProcessed} sections
                                        and combined into a comprehensive summary covering the entire content.
                                    </>
                                )}
                            </p>
                        </div>
                        <button
                            onClick={() => setChunkingInfo(null)}
                            className="p-1 hover:bg-black/10 rounded-full transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg text-[var(--muted-foreground)]">close</span>
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Source Document */}
                    <div className="lg:col-span-1">
                        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden sticky top-24 h-[60vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30 shrink-0">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-lg">description</span>
                                    <span className="text-sm font-bold uppercase tracking-wider">Source Document</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Existing Highlight Toggle - only show in text mode */}
                                    {viewMode === 'text' && (
                                        <>
                                            <span className="text-xs text-[var(--muted-foreground)]">Highlight</span>
                                            <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={highlightKeywords}
                                                    onChange={(e) => setHighlightKeywords(e.target.checked)}
                                                />
                                                <span className="toggle-slider" />
                                            </label>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* View Mode Tabs (if file exists) */}
                            {document?.storage_path && (
                                <div className="flex border-b border-[var(--border)] shrink-0">
                                    <button
                                        onClick={() => setViewMode('file')}
                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${viewMode === 'file'
                                            ? 'bg-primary/5 text-primary border-b-2 border-primary'
                                            : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                                            }`}
                                    >
                                        Original File
                                    </button>
                                    <button
                                        onClick={() => setViewMode('text')}
                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${viewMode === 'text'
                                            ? 'bg-primary/5 text-primary border-b-2 border-primary'
                                            : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                                            }`}
                                    >
                                        Extracted Text
                                    </button>
                                </div>
                            )}

                            <div className="flex-1 overflow-hidden relative">
                                {viewMode === 'file' && document?.storage_path ? (
                                    <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-[var(--muted)]/10">
                                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
                                            <span className="material-symbols-outlined text-3xl">description</span>
                                        </div>
                                        <h4 className="text-sm font-bold mb-1">
                                            {document.original_filename || document.title}
                                        </h4>
                                        <p className="text-xs text-[var(--muted-foreground)] mb-4">
                                            View the original document in full screen
                                        </p>
                                        <button
                                            onClick={() => setShowFileViewer(true)}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm"
                                        >
                                            <span className="material-symbols-outlined">fullscreen</span>
                                            View Document
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-5 h-full overflow-y-auto hide-scrollbar">
                                        <div className="text-[var(--muted-foreground)] text-sm leading-relaxed whitespace-pre-wrap">
                                            {renderTextWithKeywords(originalText.substring(0, 2000))}
                                            {originalText.length > 2000 && (
                                                <span className="text-primary">... [truncated for display]</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Full Screen File Viewer Modal */}
                    {showFileViewer && document?.storage_path && (
                        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
                            {/* Toolbar */}
                            <div className="flex items-center justify-between px-4 py-3 bg-black/50 text-white border-b border-white/10 shrink-0">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="p-2 bg-white/10 rounded-lg">
                                        <span className="material-symbols-outlined text-white">description</span>
                                    </div>
                                    <div className="overflow-hidden">
                                        <h3 className="font-medium truncate max-w-md">
                                            {document.original_filename || document.title}
                                        </h3>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowFileViewer(false)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            {/* Viewer Content */}
                            <div className="flex-1 overflow-hidden p-4 md:p-8">
                                <div className="w-full h-full bg-white rounded-xl shadow-2xl overflow-hidden mx-auto max-w-5xl">
                                    <FileViewer
                                        storagePath={document.storage_path}
                                        filename={document.original_filename || document.title}
                                        className="w-full h-full"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Right Column - Summary & Analysis */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* No Summary - Generate Button or Disabled Message */}
                        {!summary || summary.processing_status === 'pending' || summary.processing_status === 'failed' ? (
                            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm p-8 text-center">
                                {/* Check if summary feature is disabled by admin */}
                                {!isSummaryEnabled ? (
                                    <>
                                        {/* Summary Feature Disabled Message */}
                                        <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <span className="material-symbols-outlined text-4xl text-amber-500">pause_circle</span>
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">AI Summary Temporarily Unavailable</h3>
                                        <p className="text-[var(--muted-foreground)] mb-4 max-w-md mx-auto">
                                            The AI summary feature is currently paused to manage system resources.
                                            Your document has been saved successfully and you can access it anytime from your library.
                                        </p>
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 max-w-md mx-auto mb-6">
                                            <div className="flex items-start gap-3 text-left">
                                                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-lg mt-0.5">info</span>
                                                <div>
                                                    <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">What you can still do:</p>
                                                    <ul className="text-sm text-amber-600 dark:text-amber-400 mt-1 space-y-1">
                                                        <li>• View and read your uploaded document</li>
                                                        <li>• Upload more documents to your library</li>
                                                        <li>• Access existing summaries from other documents</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-sm text-[var(--muted-foreground)] mb-4">
                                            Check back later or contact your administrator for more information.
                                        </p>
                                        <button
                                            onClick={() => navigate('/library')}
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90"
                                        >
                                            <span className="material-symbols-outlined">arrow_back</span>
                                            Back to Library
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {/* Normal Generate Summary UI */}
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
                                            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                                                <div className="flex items-start gap-3">
                                                    <span className="material-symbols-outlined text-red-500 text-xl mt-0.5">error</span>
                                                    <div className="flex-1">
                                                        <p className="text-red-700 dark:text-red-400 font-medium">
                                                            {(() => {
                                                                // Get the error message
                                                                const rawError = error || summary?.error_message || generateMutation.error?.message || 'Unknown error'
                                                                console.error('🔴 AI Processing Error:', rawError)

                                                                // Check if it's a technical error that needs translation
                                                                if (rawError.includes('Edge Function') || rawError.includes('non-2xx')) {
                                                                    return 'Our AI service is temporarily unavailable. Please wait a moment and try again.'
                                                                }
                                                                if (rawError.includes('timeout') || rawError.includes('Timeout')) {
                                                                    return 'The request took too long. Please try again with a smaller document.'
                                                                }
                                                                if (rawError.includes('network') || rawError.includes('Network')) {
                                                                    return 'Unable to connect to the server. Please check your internet connection.'
                                                                }

                                                                return rawError
                                                            })()}
                                                        </p>
                                                        <p className="text-red-600/70 dark:text-red-400/70 text-sm mt-1">
                                                            Click "Generate Summary" to try again
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
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
                                            <ul className="space-y-3">
                                                {(getCurrentSummaryContent() as string[]).map((point, i) => (
                                                    <li key={i} className="flex items-start gap-3 p-3 bg-[var(--muted)]/30 rounded-lg">
                                                        <span className="material-symbols-outlined text-primary text-lg mt-0.5">check_circle</span>
                                                        <span className="text-base leading-relaxed">{point}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : activeTab === "Detailed" ? (
                                            renderDetailedSummary(getCurrentSummaryContent() as string)
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
