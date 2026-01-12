/**
 * Admin Route Protection Component
 * 
 * This component wraps routes that should only be accessible to admin users.
 * It checks the user's admin status and redirects non-admins to the library.
 * 
 * HOW IT WORKS:
 * 1. First checks if user is authenticated (handled by ProtectedRoute wrapper)
 * 2. Then checks if user is in the admin_users table
 * 3. If not an admin, shows access denied message and redirects
 */

import { Navigate } from 'react-router-dom'
import { useAdmin } from '@/contexts/AdminContext'
import { useAuth } from '@/contexts/AuthContext'

interface AdminRouteProps {
    children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
    const { user, loading: authLoading } = useAuth()
    const { isAdmin, isCheckingAdmin } = useAdmin()

    // Show loading while checking authentication or admin status
    if (authLoading || isCheckingAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--muted-foreground)] text-sm">Verifying access...</p>
                </div>
            </div>
        )
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Navigate to="/login" replace />
    }

    // Show access denied if not an admin
    if (!isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-red-500 text-4xl">
                            gpp_bad
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold mb-3">Access Denied</h1>
                    <p className="text-[var(--muted-foreground)] mb-6">
                        You don't have permission to access this page. 
                        Admin privileges are required to view this content.
                    </p>
                    <a
                        href="#/library"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Return to Library
                    </a>
                </div>
            </div>
        )
    }

    // User is authenticated and is an admin
    return <>{children}</>
}

