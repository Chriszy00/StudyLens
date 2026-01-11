import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from '@tanstack/react-query'
import { Header, PageWrapper } from "@/components/layout"
import { getDocuments, type DocumentWithMeta, type DocumentFilter } from "@/services/documents"

const filters: { label: string; value: DocumentFilter }[] = [
    { label: "All Sessions", value: "all" },
    { label: "Starred", value: "starred" },
    { label: "Drafts", value: "drafts" },
    { label: "Recent", value: "recent" },
]

const typeConfig: Record<string, { emoji: string; label: string }> = {
    short: { emoji: "📄", label: "Short" },
    detailed: { emoji: "📘", label: "Detailed" },
    study_notes: { emoji: "📌", label: "Study Notes" },
}

const defaultImages = [
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=200&fit=crop",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=200&fit=crop",
    "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=400&h=200&fit=crop",
    "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=200&fit=crop",
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=400&h=200&fit=crop",
]

export function LibraryPage() {
    const [activeFilter, setActiveFilter] = useState<DocumentFilter>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const navigate = useNavigate()

    const { data: documents = [], isLoading: loading, isError: error, refetch: handleRetry } = useQuery({
        queryKey: ['documents', activeFilter],
        queryFn: () => getDocuments(activeFilter)
    })

    // Filter documents by search query
    const filteredDocuments = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    // Get random image for documents without one
    const getImage = (doc: DocumentWithMeta, index: number) => {
        return doc.image_url || defaultImages[index % defaultImages.length]
    }

    return (
        <PageWrapper>
            <Header
                title="Study Library"
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

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-[var(--muted-foreground)] text-sm">Loading documents...</p>
                        </div>
                    </div>
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
                        {filteredDocuments.map((doc, index) => {
                            const typeInfo = typeConfig[doc.type] || typeConfig.short
                            return (
                                <div
                                    key={doc.id}
                                    className="flex flex-col rounded-xl shadow-sm border border-[var(--border)] bg-[var(--card)] overflow-hidden hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
                                >
                                    {/* Image */}
                                    <div
                                        className="relative w-full h-40 bg-center bg-cover"
                                        style={{ backgroundImage: `url("${getImage(doc, index)}")` }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-[var(--card)]/90 backdrop-blur rounded-full shadow-sm border border-[var(--border)]">
                                            <span className="text-sm leading-none">{typeInfo.emoji}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-wide">
                                                {typeInfo.label}
                                            </span>
                                        </div>
                                        {doc.is_starred && (
                                            <div className="absolute top-3 right-3">
                                                <span className="material-symbols-outlined text-amber-500">star</span>
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
                                                onClick={() => navigate(`/study?id=${doc.id}`)}
                                                className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg border border-primary text-primary font-semibold text-sm hover:bg-primary/10 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-sm">style</span>
                                                Flashcards
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
