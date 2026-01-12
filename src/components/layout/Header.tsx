import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface HeaderProps {
    title: ReactNode
    showBack?: boolean
    onBack?: () => void
    rightAction?: React.ReactNode
    className?: string
}

export function Header({ title, showBack = false, onBack, rightAction, className }: HeaderProps) {
    return (
        <header className={cn(
            "sticky top-0 z-50 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]",
            className
        )}>
            <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
                <div className="flex shrink-0 items-center justify-start gap-4">
                    {showBack && (
                        <button
                            onClick={onBack}
                            className="p-2 rounded-full hover:bg-[var(--muted)] transition-colors text-primary"
                        >
                            <span className="material-symbols-outlined">arrow_back_ios</span>
                        </button>
                    )}
                    {typeof title === 'string' ? (
                        <h2 className="text-xl font-bold leading-tight tracking-tight">
                            {title}
                        </h2>
                    ) : (
                        <div className="flex items-center">
                            {title}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    {rightAction}
                </div>
            </div>
        </header>
    )
}
