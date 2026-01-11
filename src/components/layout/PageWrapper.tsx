import { cn } from "@/lib/utils"

interface PageWrapperProps {
    children: React.ReactNode
    className?: string
    hasBottomNav?: boolean
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl" | "full"
}

const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
    "6xl": "max-w-6xl",
    full: "max-w-full",
}

export function PageWrapper({
    children,
    className,
    hasBottomNav = false,
    maxWidth = "6xl"
}: PageWrapperProps) {
    return (
        <div className={cn(
            "min-h-screen w-full bg-[var(--background)]",
            className
        )}>
            <div className={cn(
                "mx-auto px-6",
                maxWidthClasses[maxWidth],
                hasBottomNav && "pb-24"
            )}>
                {children}
            </div>
        </div>
    )
}
