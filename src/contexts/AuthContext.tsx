import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// ============================================
// CONSTANTS
// ============================================
// Timeout for getSession() - prevents eternal loading spinners
const AUTH_TIMEOUT_MS = 5000

// LocalStorage key pattern for Supabase auth token
// Format: sb-{projectRef}-auth-token
const getStorageKey = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    // Extract project ref from URL (e.g., "zpepkrkpvujqrhnktbfe" from https://zpepkrkpvujqrhnktbfe.supabase.co)
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || ''
    return `sb-${projectRef}-auth-token`
}

// ============================================
// TYPES
// ============================================
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

// ============================================
// HELPER: Check localStorage for cached session
// ============================================
function getCachedSession(): { session: Session | null; user: User | null } {
    try {
        const storageKey = getStorageKey()
        const cached = localStorage.getItem(storageKey)

        if (!cached) {
            console.log('🔐 [AuthContext] No cached session in localStorage')
            return { session: null, user: null }
        }

        const parsed = JSON.parse(cached)

        // Check if the token is expired
        const expiresAt = parsed.expires_at
        const now = Math.floor(Date.now() / 1000) // Current time in seconds

        if (expiresAt && now >= expiresAt) {
            console.log('🔐 [AuthContext] Cached session expired, will refresh')
            // Don't clear it - Supabase will try to refresh with the refresh_token
            return { session: null, user: null }
        }

        // Reconstruct a minimal session object from cached data
        const cachedSession: Session = {
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
            expires_at: parsed.expires_at,
            expires_in: parsed.expires_in,
            token_type: parsed.token_type || 'bearer',
            user: parsed.user,
        }

        console.log('🔐 [AuthContext] ✅ Found valid cached session for:', parsed.user?.email)
        return { session: cachedSession, user: parsed.user }
    } catch (error) {
        console.warn('🔐 [AuthContext] Error reading cached session:', error)
        return { session: null, user: null }
    }
}

// ============================================
// HELPER: getSession with timeout
// ============================================
async function getSessionWithTimeout(timeoutMs: number): Promise<{ session: Session | null; error: Error | null }> {
    return Promise.race([
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                return { session: null, error: new Error(error.message) }
            }
            return { session, error: null }
        }),
        new Promise<{ session: null; error: Error }>((resolve) =>
            setTimeout(() => {
                console.warn('🔐 [AuthContext] ⚠️ getSession() timed out after', timeoutMs, 'ms')
                resolve({ session: null, error: new Error('Authentication timed out. Please check your connection.') })
            }, timeoutMs)
        )
    ])
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState<AuthStatus>('idle')
    const [error, setError] = useState<string | null>(null)

    // ============================================
    // RETRY AUTH FUNCTION
    // ============================================
    const retryAuth = useCallback(async () => {
        console.log('🔐 [AuthContext] 🔄 Retrying authentication...')
        setLoading(true)
        setStatus('loading')
        setError(null)

        const { session: freshSession, error: sessionError } = await getSessionWithTimeout(AUTH_TIMEOUT_MS)

        if (sessionError) {
            console.error('🔐 [AuthContext] ❌ Retry failed:', sessionError.message)
            setError(sessionError.message)
            setStatus('error')
            setLoading(false)
            return
        }

        setSession(freshSession)
        setUser(freshSession?.user ?? null)
        setStatus(freshSession ? 'authenticated' : 'unauthenticated')
        setLoading(false)
        console.log('🔐 [AuthContext] ✅ Retry successful:', freshSession ? 'authenticated' : 'unauthenticated')
    }, [])

    // ============================================
    // INITIALIZATION EFFECT
    // ============================================
    useEffect(() => {
        let isMounted = true

        async function initializeAuth() {
            console.log('🔐 [AuthContext] 🚀 Initializing authentication...')
            setStatus('loading')

            // STEP 1: Check localStorage for cached session (INSTANT!)
            const { session: cachedSession, user: cachedUser } = getCachedSession()

            if (cachedSession && cachedUser) {
                // Show cached data immediately for faster perceived performance
                console.log('🔐 [AuthContext] ⚡ Using cached session for instant render')
                if (isMounted) {
                    setSession(cachedSession)
                    setUser(cachedUser)
                    setStatus('authenticated')
                    setLoading(false)
                }
            }

            // STEP 2: Verify with Supabase in background (with timeout protection)
            console.log('🔐 [AuthContext] 🔍 Verifying session with Supabase...')
            const { session: freshSession, error: sessionError } = await getSessionWithTimeout(AUTH_TIMEOUT_MS)

            if (!isMounted) return

            if (sessionError) {
                console.error('🔐 [AuthContext] ❌ Session verification failed:', sessionError.message)

                // If we had a cached session but verification failed, keep using cached
                // (could be a temporary network issue)
                if (cachedSession && cachedUser) {
                    console.log('🔐 [AuthContext] ℹ️ Keeping cached session despite verification failure')
                    setError('Unable to verify session. Using cached credentials.')
                    // Don't change status - user can still use the app
                } else {
                    setError(sessionError.message)
                    setStatus('error')
                    setSession(null)
                    setUser(null)
                }
                setLoading(false)
                return
            }

            // STEP 3: Update with verified session
            console.log('🔐 [AuthContext] ✅ Session verified:', freshSession ? 'authenticated' : 'unauthenticated')
            setSession(freshSession)
            setUser(freshSession?.user ?? null)
            setStatus(freshSession ? 'authenticated' : 'unauthenticated')
            setError(null)
            setLoading(false)
        }

        initializeAuth()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('🔐 [AuthContext] Auth state changed:', event)
                setSession(session)
                setUser(session?.user ?? null)
                setStatus(session ? 'authenticated' : 'unauthenticated')
                setError(null)
                setLoading(false)

                // Create profile on sign up
                if (event === 'SIGNED_IN' && session?.user) {
                    const { data: existingProfile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('id', session.user.id)
                        .single()

                    if (!existingProfile) {
                        await supabase.from('profiles').insert({
                            id: session.user.id,
                            full_name: session.user.user_metadata?.full_name || null,
                            avatar_url: session.user.user_metadata?.avatar_url || null,
                        })
                    }
                }

                // Clear status on sign out
                if (event === 'SIGNED_OUT') {
                    setStatus('unauthenticated')
                }
            }
        )

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])

    const signUp = async (email: string, password: string, fullName?: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        })
        return { error }
    }

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
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
        console.log('AuthContext: signOut initiated')
        try {
            // Attempt to sign out from Supabase with a timeout
            // If the network call hangs, we don't want to block the user
            const { error } = await Promise.race([
                supabase.auth.signOut(),
                new Promise<{ error: null }>((resolve) =>
                    setTimeout(() => {
                        console.log('AuthContext: signOut timed out, forcing local cleanup')
                        resolve({ error: null })
                    }, 2000)
                )
            ])

            if (error) {
                console.error('AuthContext: Supabase signOut returned error:', error)
            } else {
                console.log('AuthContext: supabase.auth.signOut completed')
            }
        } catch (error) {
            console.error('AuthContext: Error during supabase.auth.signOut', error)
        } finally {
            // Force clear state to ensure immediate UI update
            console.log('AuthContext: clearing local session and user state')
            setSession(null)
            setUser(null)
            // Optional: Manually clear any persisted session from localStorage if needed
            // This is a failsafe if Supabase client internal storage clearing failed
            localStorage.removeItem(`sb-${import.meta.env.VITE_SUPABASE_URL?.split('//')[1].split('.')[0]}-auth-token`)
        }
    }

    return (
        <AuthContext.Provider value={{ user, session, loading, status, error, signUp, signIn, signInWithGoogle, signOut, retryAuth }}>
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
