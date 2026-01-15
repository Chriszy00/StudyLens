import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"
import { useDocuments } from "@/hooks"
import type { DocumentWithMeta, DocumentFilter } from "@/services/documents"

const filters: { label: string; value: DocumentFilter }[] = [
    { label: "All Sessions", value: "all" },
    { label: "Starred", value: "starred" },
    { label: "Drafts", value: "drafts" },
    { label: "Recent", value: "recent" },
]

// Color configuration for each summary type
// Each type gets a distinct gradient and icon for quick visual identification
const typeConfig: Record<string, {
    icon: string;
    label: string;
    gradient: string;
    iconBg: string;
}> = {
    short: {
        icon: "bolt",
        label: "Quick Summary",
        gradient: "linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #5eead4 100%)",
        iconBg: "rgba(255, 255, 255, 0.2)"
    },
    detailed: {
        icon: "menu_book",
        label: "Detailed Overview",
        gradient: "linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #a5b4fc 100%)",
        iconBg: "rgba(255, 255, 255, 0.2)"
    },
    study_notes: {
        icon: "school",
        label: "Study Notes",
        gradient: "linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fcd34d 100%)",
        iconBg: "rgba(255, 255, 255, 0.2)"
    },
}

export function LibraryPage() {
    const [activeFilter, setActiveFilter] = useState<DocumentFilter>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const navigate = useNavigate()

    // Use our custom hook instead of raw useQuery
    // This encapsulates the query key and fetch logic
    const { data: documents = [], isLoading: loading, isError: error, refetch: handleRetry, dataUpdatedAt } = useDocuments(activeFilter)

    // 🔍 DIAGNOSTIC: Log when LibraryPage mounts/updates
    useEffect(() => {
        console.log('📖 [LibraryPage] Component MOUNTED')
        return () => console.log('📖 [LibraryPage] Component UNMOUNTED')
    }, [])

    useEffect(() => {
        console.log('📖 [LibraryPage] Documents updated:', {
            count: documents.length,
            titles: documents.map(d => d.title),
            dataUpdatedAt: new Date(dataUpdatedAt).toISOString(),
        })
    }, [documents, dataUpdatedAt])

    // Filter documents by search query
    const filteredDocuments = documents.filter((doc: DocumentWithMeta) =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )



    return (
        <PageWrapper>
            <Header
                title={
                    <img
                        src="/studylens3.png"
                        alt="StudyLens"
                        className="h-12"
                    />
                }
                rightAction={
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate("/upload")}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            New Analysis
                        </button>
                        <button
                            onClick={() => navigate("/settings")}
                            className="p-2 rounded-full hover:bg-[var(--muted)] transition-colors"
                        >
                            <span className="material-symbols-outlined">account_circle</span>
                        </button>
                    </div>
                }
            />

            <div className="py-6">
                {/* Search and Filters Row */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
                    {/* Search Bar */}
                    <label className="relative flex items-center group flex-1 max-w-xl">
                        <div className="absolute left-4 text-[var(--muted-foreground)] group-focus-within:text-primary transition-colors">
                            <span className="material-symbols-outlined">search</span>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm focus:ring-2 focus:ring-primary text-base placeholder:text-[var(--muted-foreground)]"
                            placeholder="Search summaries or keywords"
                        />
                    </label>

                    {/* Filter Pills */}
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                        {filters.map((filter) => (
                            <button
                                key={filter.value}
                                onClick={() => setActiveFilter(filter.value)}
                                className={`flex h-10 shrink-0 items-center justify-center px-5 rounded-full text-sm font-medium transition-colors ${activeFilter === filter.value
                                    ? "bg-primary text-white"
                                    : "bg-[var(--card)] text-[var(--muted-foreground)] shadow-sm border border-[var(--border)] hover:border-primary/50"
                                    }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Loading State - Skeleton Grid */}
                {loading && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div
                                    key={i}
                                    className="flex flex-col rounded-xl shadow-sm border border-[var(--border)] bg-[var(--card)] overflow-hidden"
                                    style={{ animationDelay: `${i * 100}ms` }}
                                >
                                    {/* Header Skeleton */}
                                    <div className="relative w-full h-32 bg-[var(--muted)] animate-pulse">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-14 h-14 bg-[var(--muted)]/70 rounded-full animate-pulse" />
                                        </div>
                                    </div>
                                    {/* Content Skeleton */}
                                    <div className="p-5 space-y-3">
                                        <div className="h-5 bg-[var(--muted)] rounded w-3/4 animate-pulse" />
                                        <div className="h-4 bg-[var(--muted)] rounded w-1/2 animate-pulse" />
                                        <div className="flex gap-2 pt-2">
                                            <div className="h-6 bg-[var(--muted)] rounded-md w-16 animate-pulse" />
                                            <div className="h-6 bg-[var(--muted)] rounded-md w-16 animate-pulse" />
                                        </div>
                                        <div className="flex gap-2 mt-auto pt-2">
                                            <div className="h-10 flex-1 bg-[var(--muted)] rounded-lg animate-pulse" />
                                            <div className="h-10 flex-1 bg-[var(--muted)] rounded-lg animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Loading Indicator */}
                        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[var(--card)] px-6 py-3 rounded-full shadow-lg border border-[var(--border)] flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-[var(--muted-foreground)]">Loading your library...</span>
                        </div>
                    </>
                )}

                {/* Error State */}
                {error && !loading && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                        <p className="text-red-500">Failed to load documents. Please try again.</p>
                        <button
                            onClick={() => handleRetry()}
                            className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && filteredDocuments.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-4xl text-primary">folder_open</span>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold mb-2">No documents yet</h3>
                            <p className="text-[var(--muted-foreground)] mb-4">
                                {searchQuery ? "No documents match your search." : "Upload your first document to get started!"}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={() => navigate("/upload")}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                                >
                                    <span className="material-symbols-outlined">add</span>
                                    Upload Document
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Summary Cards Grid */}
                {!loading && !error && filteredDocuments.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredDocuments.map((doc) => {
                            const typeInfo = typeConfig[doc.type] || typeConfig.short
                            return (
                                <div
                                    key={doc.id}
                                    className="flex flex-col rounded-xl shadow-sm border border-[var(--border)] bg-[var(--card)] overflow-hidden hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
                                >
                                    {/* Color-coded Header by Summary Type */}
                                    <div
                                        className="relative w-full h-32 flex items-center justify-center"
                                        style={{ background: typeInfo.gradient }}
                                    >
                                        {/* Decorative pattern overlay */}
                                        <div className="absolute inset-0 opacity-10">
                                            <div className="absolute top-2 left-4 w-16 h-16 rounded-full bg-white/30" />
                                            <div className="absolute bottom-0 right-8 w-24 h-24 rounded-full bg-white/20 -mb-12" />
                                        </div>

                                        {/* Center content */}
                                        <div className="relative flex flex-col items-center gap-2 text-white">
                                            <div
                                                className="w-14 h-14 rounded-full flex items-center justify-center"
                                                style={{ backgroundColor: typeInfo.iconBg }}
                                            >
                                                <span className="material-symbols-outlined text-3xl">{typeInfo.icon}</span>
                                            </div>
                                            <span className="text-xs font-bold uppercase tracking-widest opacity-90">
                                                {typeInfo.label}
                                            </span>
                                        </div>

                                        {/* Starred badge */}
                                        {doc.is_starred && (
                                            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-amber-300">star</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="p-5 space-y-3 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-lg font-bold leading-snug line-clamp-2">{doc.title}</h3>
                                            <button className="text-[var(--muted-foreground)] hover:text-primary shrink-0 ml-2">
                                                <span className="material-symbols-outlined">more_vert</span>
                                            </button>
                                        </div>

                                        <div className="flex flex-col gap-2 flex-1">
                                            <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-sm">
                                                <span className="material-symbols-outlined text-base">calendar_today</span>
                                                <span>{doc.formattedDate} • {doc.readTime}</span>
                                            </div>

                                            {doc.tags && doc.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {doc.tags.slice(0, 3).map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2 mt-auto">
                                            <button
                                                onClick={() => navigate(`/analysis?id=${doc.id}`)}
                                                className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-sm">visibility</span>
                                                Summary
                                            </button>
                                            <button
                                                onClick={() => navigate(`/analysis?id=${doc.id}#study`)}
                                                className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg border border-primary text-primary font-semibold text-sm hover:bg-primary/10 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-sm">school</span>
                                                Study
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </PageWrapper>
    )
}
