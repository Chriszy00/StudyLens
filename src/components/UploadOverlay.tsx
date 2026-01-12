import { useEffect, useState } from 'react'

export interface UploadProgress {
    stage: 'reading' | 'connecting' | 'uploading' | 'processing' | 'complete' | 'error'
    percent: number
    bytesUploaded?: number
    totalBytes?: number
    message: string
    speed?: string // e.g., "1.2 MB/s"
    timeRemaining?: string // e.g., "~5s remaining"
}

interface UploadOverlayProps {
    isVisible: boolean
    fileName: string
    fileSize: number
    progress: UploadProgress
    onCancel: () => void
}

export function UploadOverlay({ isVisible, fileName, fileSize, progress, onCancel }: UploadOverlayProps) {
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [dots, setDots] = useState('')

    // Animated dots for loading states
    useEffect(() => {
        if (progress.stage !== 'complete' && progress.stage !== 'error') {
            const interval = setInterval(() => {
                setDots(d => d.length >= 3 ? '' : d + '.')
            }, 500)
            return () => clearInterval(interval)
        }
    }, [progress.stage])

    if (!isVisible) return null

    const getStageIcon = () => {
        switch (progress.stage) {
            case 'reading':
                return 'file_open'
            case 'connecting':
                return 'wifi'
            case 'uploading':
                return 'cloud_upload'
            case 'processing':
                return 'auto_awesome'
            case 'complete':
                return 'check_circle'
            case 'error':
                return 'error'
            default:
                return 'hourglass_empty'
        }
    }

    const getStageColor = () => {
        switch (progress.stage) {
            case 'complete':
                return 'text-green-500'
            case 'error':
                return 'text-red-500'
            default:
                return 'text-primary'
        }
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    const handleCancelClick = () => {
        if (progress.stage === 'uploading') {
            setShowCancelConfirm(true)
        } else {
            onCancel()
        }
    }

    const confirmCancel = () => {
        setShowCancelConfirm(false)
        onCancel()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop with blur */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => progress.stage === 'error' && onCancel()}
            />

            {/* Modal */}
            <div className="relative bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-6 py-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-[var(--background)] ${getStageColor()}`}>
                            <span className={`material-symbols-outlined text-2xl ${progress.stage === 'uploading' ? 'animate-pulse' : ''}`}>
                                {getStageIcon()}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold truncate">{fileName}</h3>
                            <p className="text-sm text-[var(--muted-foreground)]">
                                {formatBytes(fileSize)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-4">
                    {/* Status Message */}
                    <div className="text-center">
                        <p className="text-lg font-medium">
                            {progress.message}{progress.stage !== 'complete' && progress.stage !== 'error' ? dots : ''}
                        </p>
                        {progress.speed && (
                            <p className="text-sm text-[var(--muted-foreground)] mt-1">
                                {progress.speed} • {progress.timeRemaining || 'Calculating...'}
                            </p>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="h-3 bg-[var(--muted)] rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ease-out ${progress.stage === 'error'
                                        ? 'bg-red-500'
                                        : progress.stage === 'complete'
                                            ? 'bg-green-500'
                                            : 'bg-gradient-to-r from-primary to-primary/70'
                                    }`}
                                style={{
                                    width: `${progress.percent}%`,
                                    boxShadow: progress.stage === 'uploading' ? '0 0 10px var(--primary)' : 'none'
                                }}
                            />
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-[var(--muted-foreground)]">
                                {progress.bytesUploaded !== undefined
                                    ? `${formatBytes(progress.bytesUploaded)} / ${formatBytes(progress.totalBytes || fileSize)}`
                                    : progress.stage === 'reading' ? 'Preparing file...' : ''
                                }
                            </span>
                            <span className="font-medium">{Math.round(progress.percent)}%</span>
                        </div>
                    </div>

                    {/* Stage indicators */}
                    <div className="flex justify-center gap-2 pt-2">
                        {['reading', 'connecting', 'uploading', 'processing'].map((stage, index) => {
                            const stages = ['reading', 'connecting', 'uploading', 'processing']
                            const currentIndex = stages.indexOf(progress.stage)
                            const isComplete = index < currentIndex || progress.stage === 'complete'
                            const isCurrent = stage === progress.stage

                            return (
                                <div
                                    key={stage}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${isComplete
                                            ? 'bg-green-500'
                                            : isCurrent
                                                ? 'bg-primary animate-pulse scale-125'
                                                : 'bg-[var(--muted)]'
                                        }`}
                                    title={stage.charAt(0).toUpperCase() + stage.slice(1)}
                                />
                            )
                        })}
                    </div>
                </div>

                {/* Footer with Cancel Button */}
                <div className="px-6 py-4 bg-[var(--muted)]/30 border-t border-[var(--border)]">
                    {showCancelConfirm ? (
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-[var(--muted-foreground)]">Cancel upload?</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowCancelConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-[var(--muted)] transition-colors"
                                >
                                    No, continue
                                </button>
                                <button
                                    onClick={confirmCancel}
                                    className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                >
                                    Yes, cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleCancelClick}
                            disabled={progress.stage === 'complete'}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${progress.stage === 'complete'
                                    ? 'bg-green-500/10 text-green-500 cursor-default'
                                    : progress.stage === 'error'
                                        ? 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)]/80'
                                        : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-red-500/10 hover:text-red-500'
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">
                                {progress.stage === 'complete' ? 'check' : progress.stage === 'error' ? 'close' : 'cancel'}
                            </span>
                            <span>
                                {progress.stage === 'complete'
                                    ? 'Upload Complete!'
                                    : progress.stage === 'error'
                                        ? 'Close'
                                        : 'Cancel Upload'
                                }
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
