import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"
import { uploadFile, extractTextFromFile, validateFile } from "@/services/storage"
import { estimateReadTime } from "@/services/documents"
import { useCreateDocument } from "@/hooks"
import { useAuth } from "@/contexts/AuthContext"

type SummaryType = "short" | "detailed" | "study_notes"

export function UploadPage() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const createDocumentMutation = useCreateDocument()

    // Form state
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [textContent, setTextContent] = useState("")
    const [title, setTitle] = useState("")
    const [summaryType, setSummaryType] = useState<SummaryType>("short")

    // Settings
    const [keywordExtraction, setKeywordExtraction] = useState(true)
    const [summaryMetrics, setSummaryMetrics] = useState(true)
    const [studyQuestions, setStudyQuestions] = useState(false)

    // UI state
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [uploadProgress, setUploadProgress] = useState<string>("")

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const validation = validateFile(file)
        if (!validation.valid) {
            setError(validation.error || "Invalid file")
            return
        }

        setSelectedFile(file)
        setError(null)

        // Auto-fill title from filename if empty
        if (!title) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
            setTitle(nameWithoutExt)
        }
    }

    const handleAnalyze = async () => {
        // Validation
        if (!selectedFile && !textContent.trim()) {
            setError("Please select a file or paste some text")
            return
        }

        if (!title.trim()) {
            setError("Please enter a title for your document")
            return
        }

        const startTime = Date.now()
        console.log('🚀 Starting document creation...')

        try {
            setLoading(true)
            setError(null)

            let storagePath: string | undefined
            let originalText: string
            let originalFilename: string | undefined

            if (selectedFile) {
                // Upload file - now shows better progress since file is read into memory first
                console.log('📤 Uploading file:', selectedFile.name)
                setUploadProgress("Reading file into memory...")

                // Short delay to show the reading message (the actual read happens in uploadFile)
                await new Promise(resolve => setTimeout(resolve, 100))
                setUploadProgress("Uploading to cloud storage...")

                const uploadStart = Date.now()
                const uploadResult = await uploadFile(selectedFile, user?.id)
                console.log(`✅ File uploaded in ${Date.now() - uploadStart}ms`)
                storagePath = uploadResult.path
                originalFilename = selectedFile.name

                // Extract text from file
                console.log('📝 Extracting text...')
                setUploadProgress("Extracting text...")
                const extractStart = Date.now()
                originalText = await extractTextFromFile(selectedFile)
                console.log(`✅ Text extracted in ${Date.now() - extractStart}ms, length: ${originalText.length}`)
            } else {
                console.log('📝 Using pasted text, length:', textContent.trim().length)
                originalText = textContent.trim()
            }

            // Create document record
            console.log('💾 Creating document record in Supabase...')
            setUploadProgress("Creating document...")
            const createStart = Date.now()
            const document = await createDocumentMutation.mutateAsync({
                title: title.trim(),
                type: summaryType,
                original_filename: originalFilename,
                storage_path: storagePath,
                original_text: originalText,
                read_time_minutes: estimateReadTime(originalText),
                is_draft: true, // Mark as draft until AI processing is complete
            })
            console.log(`✅ Document created in ${Date.now() - createStart}ms, ID:`, document.id)

            console.log(`🎉 Total time: ${Date.now() - startTime}ms`)

            // Navigate to analysis page with document ID and processing options
            // The options tell the AI what to generate
            const params = new URLSearchParams({
                id: document.id,
                keywords: keywordExtraction.toString(),
                metrics: summaryMetrics.toString(),
                questions: studyQuestions.toString(),
                autoProcess: 'true', // Signal to auto-start processing
            })
            navigate(`/analysis?${params.toString()}`)
        } catch (err) {
            console.error("❌ Error creating document:", err)
            console.error(`⏱️ Failed after ${Date.now() - startTime}ms`)
            setError(err instanceof Error ? err.message : "Failed to create document")
        } finally {
            setLoading(false)
            setUploadProgress("")
        }
    }

    const handleClearFile = () => {
        setSelectedFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    return (
        <PageWrapper>
            <Header
                title="New Analysis"
                showBack
                onBack={() => navigate("/library")}
                rightAction={
                    <button className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-primary">
                        <span className="material-symbols-outlined">history</span>
                        <span className="text-sm font-medium">Recent</span>
                    </button>
                }
            />

            <div className="py-8">
                {/* Headline */}
                <div className="text-center mb-8">
                    <h2 className="tracking-tight text-3xl font-bold leading-tight pb-2">
                        Academic Input
                    </h2>
                    <p className="text-[var(--muted-foreground)] text-lg font-normal leading-normal max-w-2xl mx-auto">
                        Select a file or paste your research notes to generate a summary.
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="max-w-5xl mx-auto mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm flex items-center gap-3">
                        <span className="material-symbols-outlined">error</span>
                        {error}
                        <button onClick={() => setError(null)} className="ml-auto hover:text-red-700">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {/* Left Column - Input Methods */}
                    <div className="space-y-6">
                        {/* Document Title */}
                        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm p-5">
                            <label className="block">
                                <span className="text-sm font-medium mb-2 block">Document Title</span>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full h-12 px-4 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                    placeholder="Enter a title for your document"
                                />
                            </label>
                        </div>

                        {/* Upload Zone */}
                        <div
                            className={`flex flex-col items-center gap-6 rounded-xl border-2 border-dashed px-8 py-12 transition-colors ${selectedFile
                                ? "border-primary bg-primary/5"
                                : "border-[var(--border)] bg-[var(--card)]/50 hover:border-primary/50 hover:bg-primary/5"
                                }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.docx,.txt"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            {selectedFile ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="bg-primary/10 p-5 rounded-full">
                                        <span className="material-symbols-outlined text-primary text-4xl">description</span>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold">{selectedFile.name}</p>
                                        <p className="text-[var(--muted-foreground)] text-sm">
                                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleClearFile}
                                        className="text-red-500 text-sm font-medium hover:underline"
                                    >
                                        Remove file
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="bg-primary/10 p-5 rounded-full">
                                            <span className="material-symbols-outlined text-primary text-4xl">cloud_upload</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <p className="text-xl font-bold leading-tight tracking-tight text-center">
                                                Upload Document
                                            </p>
                                            <p className="text-[var(--muted-foreground)] text-sm font-normal leading-normal text-center">
                                                PDF, DOCX, or TXT (Max 25MB)
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-8 bg-primary text-white text-sm font-bold shadow-sm active:scale-95 transition-transform"
                                    >
                                        Select File
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-4">
                            <div className="h-[1px] flex-1 bg-[var(--border)]" />
                            <span className="text-[var(--muted-foreground)] text-sm font-bold uppercase tracking-[0.1em]">
                                OR
                            </span>
                            <div className="h-[1px] flex-1 bg-[var(--border)]" />
                        </div>

                        {/* Text Input */}
                        <div className="relative rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                            <textarea
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                className="w-full h-60 p-5 bg-transparent border-none rounded-xl placeholder:text-[var(--muted-foreground)]/60 focus:ring-0 resize-none text-base"
                                placeholder="Paste your lecture notes, essay, or research text here..."
                                disabled={!!selectedFile}
                            />
                            {textContent && (
                                <div className="absolute bottom-3 right-3 text-xs text-[var(--muted-foreground)]">
                                    {textContent.split(/\s+/).length} words
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Settings & Action */}
                    <div className="space-y-6">
                        {/* Summary Type Selection */}
                        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-visible">
                            <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                                <h3 className="text-lg font-bold">Summary Type</h3>
                                <p className="text-sm text-[var(--muted-foreground)]">Choose how to summarize your content</p>
                            </div>
                            <div className="p-4 grid grid-cols-3 gap-3">
                                {[
                                    {
                                        value: "short",
                                        label: "Short",
                                        icon: "📄",
                                        tooltip: "A concise 2-3 paragraph summary highlighting only the key points. Best for quick review and understanding the main ideas."
                                    },
                                    {
                                        value: "detailed",
                                        label: "Detailed",
                                        icon: "📘",
                                        tooltip: "A comprehensive summary covering all major topics and supporting details. Best for thorough understanding and exam preparation."
                                    },
                                    {
                                        value: "study_notes",
                                        label: "Study Notes",
                                        icon: "📌",
                                        tooltip: "Formatted study notes with bullet points, definitions, and organized sections. Best for active learning and revision."
                                    },
                                ].map((type) => (
                                    <div key={type.value} className="relative group">
                                        <button
                                            onClick={() => setSummaryType(type.value as SummaryType)}
                                            className={`w-full flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${summaryType === type.value
                                                ? "border-primary bg-primary/5"
                                                : "border-[var(--border)] hover:border-primary/50"
                                                }`}
                                        >
                                            <span className="text-2xl">{type.icon}</span>
                                            <span className="text-sm font-medium">{type.label}</span>
                                        </button>
                                        {/* Tooltip - positioned below to prevent overflow */}
                                        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-[var(--foreground)] text-[var(--background)] text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-52 text-center shadow-lg pointer-events-none">
                                            {type.tooltip}
                                            {/* Arrow pointing up */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[var(--foreground)]" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Analysis Settings */}
                        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                                <h3 className="text-lg font-bold">
                                    Analysis Settings
                                </h3>
                                <p className="text-sm text-[var(--muted-foreground)]">Configure what to extract from your content</p>
                            </div>

                            <div className="divide-y divide-[var(--border)]">
                                {/* Keyword Extraction */}
                                <div className="flex items-center justify-between p-5">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <span className="material-symbols-outlined text-primary">key_visualizer</span>
                                        </div>
                                        <div>
                                            <span className="font-medium block">Keyword Extraction</span>
                                            <span className="text-sm text-[var(--muted-foreground)]">Identify key terms and concepts</span>
                                        </div>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={keywordExtraction}
                                            onChange={(e) => setKeywordExtraction(e.target.checked)}
                                        />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>

                                {/* Summary Metrics */}
                                <div className="flex items-center justify-between p-5">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <span className="material-symbols-outlined text-primary">analytics</span>
                                        </div>
                                        <div>
                                            <span className="font-medium block">Summary Metrics</span>
                                            <span className="text-sm text-[var(--muted-foreground)]">Show compression & coverage stats</span>
                                        </div>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={summaryMetrics}
                                            onChange={(e) => setSummaryMetrics(e.target.checked)}
                                        />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>

                                {/* Study Questions */}
                                <div className="flex items-center justify-between p-5">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <span className="material-symbols-outlined text-primary">quiz</span>
                                        </div>
                                        <div>
                                            <span className="font-medium block">Study Question Generation</span>
                                            <span className="text-sm text-[var(--muted-foreground)]">Create questions from content</span>
                                        </div>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={studyQuestions}
                                            onChange={(e) => setStudyQuestions(e.target.checked)}
                                        />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* CTA Button */}
                        <button
                            onClick={handleAnalyze}
                            disabled={loading || (!selectedFile && !textContent.trim())}
                            className="w-full flex items-center justify-center gap-3 rounded-xl h-14 bg-primary text-white text-lg font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>{uploadProgress || "Processing..."}</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">auto_awesome</span>
                                    <span>Analyze & Summarize</span>
                                </>
                            )}
                        </button>
                        <p className="text-[var(--muted-foreground)] text-xs font-medium text-center uppercase tracking-widest">
                            Powered by StudyLens AI
                        </p>
                    </div>
                </div>
            </div>
        </PageWrapper>
    )
}
