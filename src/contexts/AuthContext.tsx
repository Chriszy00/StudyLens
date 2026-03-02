import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, clearStaleSession, getSupabaseStorageKey } from '@/lib/supabase'
import type { User, Session, AuthError, AuthChangeEvent } from '@supabase/supabase-js'

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error'

interface AuthContextType {
    user: User | null
    session: Session | null
    loading: boolean
    status: AuthStatus
    error: string | null
    signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
    signInWithGoogle: () => Promise<{ error: AuthError | null }>
    signOut: () => Promise<void>
    retryAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const INIT_TIMEOUT_MS = 10_000

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState<AuthStatus>('idle')
    const [error, setError] = useState<string | null>(null)

    const queryClient = useQueryClient()
    const profileCreateInFlightRef = useRef(false)

    const retryAuth = useCallback(async () => {
        setLoading(true)
        setStatus('loading')
        setError(null)

        try {
            const { data: { session: freshSession } } = await Promise.race([
                supabase.auth.getSession(),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Authentication timed out')), INIT_TIMEOUT_MS)
                ),
            ])
            setSession(freshSession)
            setUser(freshSession?.user ?? null)
            setStatus(freshSession ? 'authenticated' : 'unauthenticated')
        } catch (err) {
            setError((err as Error).message)
            setStatus('error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        // -----------------------------------------------------------------
        // 1. Initial session restoration — with a hard timeout so the
        //    loading screen never hangs.
        // -----------------------------------------------------------------
        setStatus('loading')

        Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Initial getSession timeout')), INIT_TIMEOUT_MS)
            ),
        ])
            .then(({ data: { session: initialSession } }) => {
                setSession(initialSession)
                setUser(initialSession?.user ?? null)

                if (initialSession?.user) {
                    console.log('[Auth] Session loaded on init', {
                        userId: initialSession.user.id.slice(0, 8) + '...',
                    })
                } else {
                    console.log('[Auth] No session on init')
                    try {
                        const key = getSupabaseStorageKey()
                        if (localStorage.getItem(key)) {
                            clearStaleSession()
                        }
                    } catch { /* localStorage unavailable */ }
                }

                setStatus(initialSession ? 'authenticated' : 'unauthenticated')
                setLoading(false)
            })
            .catch((err) => {
                console.error('[Auth] getSession() failed on init:', err)
                clearStaleSession()
                setSession(null)
                setUser(null)
                setError((err as Error).message)
                setStatus('error')
                setLoading(false)
            })

        // -----------------------------------------------------------------
        // 2. Auth state change listener — handles SIGNED_IN, TOKEN_REFRESHED,
        //    SIGNED_OUT, etc. We skip INITIAL_SESSION because getSession()
        //    above already handled init.
        // -----------------------------------------------------------------
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, newSession: Session | null) => {
                if (event === 'INITIAL_SESSION') {
                    return
                }

                console.log(`[Auth] Auth state change: ${event}`, {
                    hasSession: !!newSession,
                    userId: newSession?.user?.id?.slice(0, 8) ?? 'none',
                })

                setSession(newSession)
                setUser(newSession?.user ?? null)
                setStatus(newSession ? 'authenticated' : 'unauthenticated')
                setError(null)

                // Auto-create profile on sign-in (deduped to prevent concurrent inserts)
                if (event === 'SIGNED_IN' && newSession?.user && !profileCreateInFlightRef.current) {
                    profileCreateInFlightRef.current = true
                    try {
                        const { data: existingProfile } = await Promise.race([
                            supabase
                                .from('profiles')
                                .select('id')
                                .eq('id', newSession.user.id)
                                .single(),
                            new Promise<{ data: null }>((resolve) =>
                                setTimeout(() => resolve({ data: null }), 5000)
                            ),
                        ])

                        if (!existingProfile) {
                            await supabase.from('profiles').insert({
                                id: newSession.user.id,
                                full_name: newSession.user.user_metadata?.full_name || null,
                                avatar_url: newSession.user.user_metadata?.avatar_url || null,
                            })
                        }
                    } catch {
                        // Non-critical: profile will be created on next sign-in
                    } finally {
                        profileCreateInFlightRef.current = false
                    }
                }

                if (event === 'TOKEN_REFRESHED') {
                    console.log('[Auth] Token refreshed — invalidating query caches')
                    queryClient.invalidateQueries()
                }

                if (event === 'SIGNED_OUT') {
                    console.log('[Auth] Signed out — clearing all cached data')
                    queryClient.clear()
                    clearStaleSession()
                }

                setLoading(false)
            }
        )

        // -----------------------------------------------------------------
        // 3. Session-expired event listener — dispatched by main.tsx when
        //    ensureFreshSession() fails. Triggers full local logout.
        // -----------------------------------------------------------------
        const handleSessionExpired = () => {
            console.log('[Auth] Session expired event received — performing full logout')
            supabase.auth.signOut().catch(() => {})
            setUser(null)
            setSession(null)
            setStatus('unauthenticated')
            queryClient.clear()
            clearStaleSession()
        }
        window.addEventListener('supabase:session-expired', handleSessionExpired)

        return () => {
            subscription.unsubscribe()
            window.removeEventListener('supabase:session-expired', handleSessionExpired)
        }
    }, [queryClient])

    const signUp = async (email: string, password: string, fullName?: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName },
            },
        })
        return { error }
    }

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error }
    }

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/library`,
            },
        })
        return { error }
    }

    const signOut = async () => {
        // Clear local state FIRST so the UI updates instantly.
        // The server-side signout runs in the background — if we awaited it,
        // a dead TCP connection could freeze the logout button for 15+ seconds.
        setUser(null)
        setSession(null)
        setStatus('unauthenticated')
        queryClient.clear()
        clearStaleSession()

        supabase.auth.signOut().catch((err) => {
            console.warn('[Auth] Server-side signOut failed (local state already cleared):', err)
        })
    }

    return (
        <AuthContext.Provider value={{
            user, session, loading, status, error,
            signUp, signIn, signInWithGoogle, signOut, retryAuth
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
