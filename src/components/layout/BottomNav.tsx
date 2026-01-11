import { cn } from "@/lib/utils"
import { Link, useLocation } from "react-router-dom"

interface NavItem {
    icon: string
    label: string
    path: string
    filled?: boolean
}

interface BottomNavProps {
    items: NavItem[]
    showFab?: boolean
    onFabClick?: () => void
    className?: string
}

export function BottomNav({ items, showFab = false, onFabClick, className }: BottomNavProps) {
    const location = useLocation()

    return (
        <div className={cn("fixed bottom-0 inset-x-0 z-50", className)}>
            {showFab && (
                <div className="flex justify-center -mb-8 relative z-30">
                    <button
                        onClick={onFabClick}
                        className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined text-3xl">add</span>
                    </button>
                </div>
            )}
            <nav className={cn(
                "bg-[var(--card)]/80 backdrop-blur-xl border-t border-[var(--border)]",
                showFab ? "pt-8 pb-6" : "py-3",
                "px-6 flex justify-around items-center"
            )}>
                {items.map((item) => {
                    const isActive = location.pathname === item.path
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex flex-col items-center gap-1 transition-colors",
                                isActive ? "text-primary" : "text-[var(--muted-foreground)] hover:text-primary"
                            )}
                        >
                            <span
                                className="material-symbols-outlined"
                                style={isActive && item.filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            >
                                {item.icon}
                            </span>
                            <span className={cn(
                                "text-[10px]",
                                isActive ? "font-bold" : "font-medium"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}
