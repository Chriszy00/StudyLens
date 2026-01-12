import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
    children: React.ReactNode
}

/**
 * ProtectedRoute with Triple-Threat Loading Solution:
 * 1. Skeleton Loading - Better visual feedback than a spinner
 * 2. Error State - Shows errors with retry button
 * 3. Timeout Protection - Won't hang forever (handled in AuthContext)
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, loading, status, error, retryAuth } = useAuth()
    const location = useLocation()

    // LOADING STATE - Show a skeleton instead of just a spinner
    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--background)]">
                {/* Skeleton Header */}
                <div className="h-16 bg-[var(--card)] border-b border-[var(--border)] px-6 flex items-center justify-between">
                    <div className="h-8 w-32 bg-[var(--muted)] rounded-lg animate-pulse" />
                    <div className="h-10 w-10 bg-[var(--muted)] rounded-full animate-pulse" />
                </div>

                {/* Skeleton Content */}
                <div className="p-6 space-y-6">
                    {/* Search Bar Skeleton */}
                    <div className="h-12 max-w-xl bg-[var(--muted)] rounded-xl animate-pulse" />

                    {/* Filter Pills Skeleton */}
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="h-10 w-24 bg-[var(--muted)] rounded-full animate-pulse"
                                style={{ animationDelay: `${i * 100}ms` }}
                            />
                        ))}
                    </div>

                    {/* Card Grid Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div
                                key={i}
                                className="bg-[var(--card)] rounded-xl overflow-hidden border border-[var(--border)]"
                                style={{ animationDelay: `${i * 100}ms` }}
                            >
                                <div className="h-32 bg-[var(--muted)] animate-pulse" />
                                <div className="p-5 space-y-3">
                                    <div className="h-6 w-3/4 bg-[var(--muted)] rounded animate-pulse" />
                                    <div className="h-4 w-1/2 bg-[var(--muted)] rounded animate-pulse" />
                                    <div className="flex gap-2 pt-2">
                                        <div className="h-10 flex-1 bg-[var(--muted)] rounded-lg animate-pulse" />
                                        <div className="h-10 flex-1 bg-[var(--muted)] rounded-lg animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Loading Indicator Overlay */}
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[var(--card)] px-6 py-3 rounded-full shadow-lg border border-[var(--border)] flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-[var(--muted-foreground)]">Loading your library...</span>
                </div>
            </div>
        )
    }

    // ERROR STATE - Show error with retry button
    if (status === 'error' && !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
                <div className="flex flex-col items-center gap-6 max-w-md text-center p-6">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-red-500">cloud_off</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold mb-2">Connection Problem</h2>
                        <p className="text-[var(--muted-foreground)] mb-2">
                            {error || 'Unable to connect to the server.'}
                        </p>
                        <p className="text-[var(--muted-foreground)] text-sm">
                            This might be a temporary issue. Please check your internet connection and try again.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={retryAuth}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                        >
                            <span className="material-symbols-outlined">refresh</span>
                            Try Again
                        </button>
                        <button
                            onClick={() => window.location.href = '/#/login'}
                            className="flex items-center gap-2 px-6 py-3 border border-[var(--border)] rounded-xl font-semibold hover:bg-[var(--muted)] transition-colors"
                        >
                            <span className="material-symbols-outlined">login</span>
                            Login
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // NOT AUTHENTICATED - Redirect to login
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // AUTHENTICATED - Render children
    return <>{children}</>
}
