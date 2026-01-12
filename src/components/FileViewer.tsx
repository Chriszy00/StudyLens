import { useState, useEffect } from 'react'
import { getSignedUrl } from '@/services/storage'

interface FileViewerProps {
    storagePath: string | null
    filename: string | null
    className?: string
}

export function FileViewer({ storagePath, filename, className = '' }: FileViewerProps) {
    const [url, setUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!storagePath) {
            setLoading(false)
            return
        }

        const fetchUrl = async () => {
            try {
                // Get signed URL ensuring access to private files
                const signedUrl = await getSignedUrl(storagePath)
                setUrl(signedUrl)
            } catch (err) {
                console.error('Error getting file URL:', err)
                setError('Error loading file')
            } finally {
                setLoading(false)
            }
        }

        fetchUrl()
    }, [storagePath])

    if (loading) {
        return (
            <div className={`flex items-center justify-center bg-[var(--muted)]/20 ${className}`}>
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-[var(--muted-foreground)]">Loading file...</span>
                </div>
            </div>
        )
    }

    if (error || !url) {
        return (
            <div className={`flex items-center justify-center bg-red-50 dark:bg-red-900/10 ${className}`}>
                <div className="flex flex-col items-center gap-2 text-center p-4">
                    <span className="material-symbols-outlined text-red-400 text-3xl">broken_image</span>
                    <p className="text-sm text-red-500 font-medium">{error || 'File not available'}</p>
                </div>
            </div>
        )
    }

    // Determine file type
    const isPdf = filename?.toLowerCase().endsWith('.pdf')
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename || '')

    // For PDFs, use iframe (browser built-in viewer)
    if (isPdf) {
        return (
            <iframe
                src={`${url}#toolbar=0&view=FitH`}
                className={`w-full h-full bg-white ${className}`}
                title={filename || 'PDF Viewer'}
            />
        )
    }

    // For images, use img tag
    if (isImage) {
        return (
            <div className={`flex items-center justify-center bg-black/5 overflow-auto ${className}`}>
                <img
                    src={url}
                    alt={filename || 'Document Image'}
                    className="max-w-full max-h-full object-contain"
                />
            </div>
        )
    }

    // For other files (DOCX, etc), we can't easily embed without external services.
    // Show a download/open button instead.
    return (
        <div className={`flex flex-col items-center justify-center bg-[var(--muted)]/20 gap-4 ${className}`}>
            <div className="w-16 h-16 bg-[var(--background)] rounded-full flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-3xl text-primary">description</span>
            </div>
            <div className="text-center">
                <p className="font-medium mb-1">Cannot preview this file type</p>
                <p className="text-sm text-[var(--muted-foreground)] mb-4">{filename}</p>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                    <span className="material-symbols-outlined text-lg">open_in_new</span>
                    Open File
                </a>
            </div>
        </div>
    )
}
