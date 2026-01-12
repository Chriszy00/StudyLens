import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
    user: User | null
    session: Session | null
    loading: boolean
    signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
    signInWithGoogle: () => Promise<{ error: AuthError | null }>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setSession(session)
                setUser(session?.user ?? null)
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
            }
        )

        return () => subscription.unsubscribe()
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
        <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
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
