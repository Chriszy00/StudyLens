/**
 * Session Manager - Handles JWT token validation and refresh
 * 
 * WHY THIS EXISTS:
 * ================
 * Supabase JWTs expire after 1 hour by default. When users leave the app
 * idle (especially with the tab in background), browsers throttle/suspend
 * JavaScript timers, which can prevent Supabase's auto-refresh from firing.
 * 
 * FIX v5: CONNECTION WARM-UP ON VISIBILITY CHANGE
 * ===============================================
 * When returning from idle, HTTP/2 connections to Supabase can be stale.
 * This causes requests to hang indefinitely. The fix is to:
 * 1. Detect when the tab becomes visible again
 * 2. "Warm up" the connection with a lightweight ping
 * 3. Only then allow queries to proceed
 * 
 * The session cache is ONLY populated by AuthContext's onAuthStateChange listener
 * getValidSession() NEVER calls Supabase - it only reads the cache
 */

import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'

// How many seconds before expiry should we proactively refresh?
const EXPIRY_BUFFER_SECONDS = 300 // 5 minutes

// Cached session - ONLY set by AuthContext, NEVER by getValidSession
let cachedSession: Session | null = null
let cacheTimestamp: number = 0

// Lock for refresh operations only (not for getValidSession!)
let refreshInProgress = false
let refreshPromise: Promise<Session | null> | null = null

// Connection warm-up state
let lastWarmUpTime = 0
let warmUpInProgress = false
let warmUpPromise: Promise<boolean> | null = null
const WARM_UP_COOLDOWN_MS = 30000 // Don't warm up more than once per 30 seconds

/**
 * Check if a session's access token is expired or about to expire
 */
export function isSessionExpired(session: Session | null, bufferSeconds = EXPIRY_BUFFER_SECONDS): boolean {
    if (!session) return true

    const expiresAt = session.expires_at
    if (!expiresAt) {
        console.warn('⚠️ [SessionManager] Session has no expires_at, assuming expired')
        return true
    }

    const now = Math.floor(Date.now() / 1000) // Current time in seconds
    const timeUntilExpiry = expiresAt - now

    // Only log if it's close to expiring (avoid spam)
    if (timeUntilExpiry < 600) { // Less than 10 minutes
        console.log(`🔐 [SessionManager] Token expires in ${timeUntilExpiry}s (buffer: ${bufferSeconds}s)`)
    }

    return timeUntilExpiry < bufferSeconds
}

/**
 * Warm up the Supabase connection
 * 
 * WHY THIS EXISTS:
 * When the browser tab is backgrounded/idle, HTTP/2 connections go stale.
 * When you return, requests on these stale connections hang indefinitely.
 * 
 * This function makes a lightweight "ping" request to Supabase to:
 * 1. Close any stale connections
 * 2. Establish a fresh connection
 * 3. Verify the connection is working
 * 
 * Returns true if warm-up succeeded, false if it failed (but we continue anyway)
 */
export async function warmUpConnection(): Promise<boolean> {
    const now = Date.now()
    
    // Don't warm up too frequently
    if (now - lastWarmUpTime < WARM_UP_COOLDOWN_MS) {
        console.log('🔌 [SessionManager] Skipping warm-up (cooldown)')
        return true
    }
    
    // If warm-up already in progress, wait for it
    if (warmUpInProgress && warmUpPromise) {
        console.log('🔌 [SessionManager] Waiting for existing warm-up...')
        return warmUpPromise
    }
    
    warmUpInProgress = true
    console.log('🔌 [SessionManager] Warming up Supabase connection...')
    
    warmUpPromise = (async (): Promise<boolean> => {
        try {
            // Use a very short timeout - we just want to ping, not wait forever
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 3000)
            
            // Lightweight query - just check if we can reach Supabase
            // This forces a new TCP connection if the old one is stale
            const { error } = await supabase
                .from('documents')
                .select('id')
                .limit(1)
                .abortSignal(controller.signal)
            
            clearTimeout(timeoutId)
            
            if (error) {
                // PGRST116 = "no rows" which is fine - connection worked
                if (error.code === 'PGRST116') {
                    console.log('🔌 [SessionManager] ✅ Connection warm-up successful (no rows)')
                    lastWarmUpTime = now
                    return true
                }
                console.warn('🔌 [SessionManager] ⚠️ Warm-up query returned error:', error.message)
                // Still mark as warmed up - the connection attempt was made
                lastWarmUpTime = now
                return false
            }
            
            console.log('🔌 [SessionManager] ✅ Connection warm-up successful')
            lastWarmUpTime = now
            return true
            
        } catch (err) {
            const error = err as Error
            if (error.name === 'AbortError') {
                console.warn('🔌 [SessionManager] ⚠️ Warm-up timed out (connection may be stale)')
            } else {
                console.warn('🔌 [SessionManager] ⚠️ Warm-up failed:', error.message)
            }
            // Still update timestamp to avoid rapid retries
            lastWarmUpTime = now
            return false
        } finally {
            warmUpInProgress = false
            warmUpPromise = null
        }
    })()
    
    return warmUpPromise
}

/**
 * Get the cached session - DOES NOT CALL SUPABASE
 * 
 * This is the main function to use before Supabase queries.
 * It returns the cached session immediately without any async operations.
 * 
 * If session is null or expired, the caller should either:
 * - Let the request fail and handle auth error
 * - Trigger a refresh via refreshSession()
 */
export function getValidSession(): Session | null {
    if (!cachedSession) {
        console.log('🔐 [SessionManager] No cached session available')
        return null
    }
    
    // Check if session is expired
    if (isSessionExpired(cachedSession, 60)) { // Use shorter buffer for reads
        console.log('🔐 [SessionManager] Cached session is expired')
        // Don't return null - let the caller try with the expired token
        // Supabase might still accept it, or RLS will reject and we'll get an auth error
    }
    
    return cachedSession
}

/**
 * Async version that will attempt a refresh if needed
 * Use this for critical operations like uploads
 */
export async function ensureValidSession(): Promise<Session | null> {
    // First, check cached session
    if (cachedSession && !isSessionExpired(cachedSession)) {
        console.log('🔐 [SessionManager] Using valid cached session')
        return cachedSession
    }
    
    // If no session or expired, try to refresh
    console.log('🔐 [SessionManager] Session needs refresh')
    return refreshSession()
}

/**
 * Refresh the session - WITH TIMEOUT PROTECTION
 * 
 * This is the ONLY function that calls Supabase auth methods directly.
 * It has timeout protection to prevent indefinite hangs.
 */
export async function refreshSession(): Promise<Session | null> {
    // If refresh already in progress, wait for it (with timeout)
    if (refreshInProgress && refreshPromise) {
        console.log('🔐 [SessionManager] Waiting for existing refresh...')
        try {
            return await Promise.race([
                refreshPromise,
                new Promise<null>((resolve) => 
                    setTimeout(() => {
                        console.warn('⚠️ [SessionManager] Refresh wait timed out')
                        resolve(null)
                    }, 5000)
                )
            ])
        } catch {
            return cachedSession
        }
    }
    
    refreshInProgress = true
    console.log('🔐 [SessionManager] Refreshing session...')
    
    refreshPromise = (async (): Promise<Session | null> => {
        try {
            // Create a timeout promise
            const timeoutPromise = new Promise<null>((resolve) => {
                setTimeout(() => {
                    console.warn('⚠️ [SessionManager] Refresh operation timed out after 10s')
                    resolve(null)
                }, 10000) // 10 second timeout
            })
            
            // Race between refresh and timeout
            const result = await Promise.race([
                supabase.auth.refreshSession(),
                timeoutPromise.then(() => ({ data: { session: null }, error: new Error('Timeout') }))
            ])
            
            if ('error' in result && result.error) {
                console.error('❌ [SessionManager] Refresh failed:', result.error.message)
                return cachedSession // Return stale session as fallback
            }
            
            if ('data' in result && result.data?.session) {
                console.log('✅ [SessionManager] Session refreshed successfully')
                // Update cache
                cachedSession = result.data.session
                cacheTimestamp = Date.now()
                return result.data.session
            }
            
            console.warn('⚠️ [SessionManager] Refresh returned no session')
            return cachedSession
            
        } catch (err) {
            console.error('❌ [SessionManager] Refresh error:', err)
            return cachedSession // Return stale session as fallback
        } finally {
            refreshInProgress = false
            refreshPromise = null
        }
    })()
    
    return refreshPromise
}

/**
 * Set the session cache - CALLED BY AUTHCONTEXT ONLY
 * 
 * This is the ONLY way the session cache should be populated.
 * AuthContext calls this when it receives a session from Supabase's
 * onAuthStateChange listener.
 */
export function setSessionCache(session: Session | null): void {
    cachedSession = session
    cacheTimestamp = Date.now()
    if (session) {
        console.log('🔐 [SessionManager] Session cache set (expires:', 
            new Date((session.expires_at || 0) * 1000).toISOString(), ')')
    } else {
        console.log('🔐 [SessionManager] Session cache cleared')
    }
}

/**
 * Clear the cached session (call on sign out)
 */
export function clearSessionCache(): void {
    cachedSession = null
    cacheTimestamp = 0
    console.log('🔐 [SessionManager] Session cache cleared')
}

/**
 * Check if an error is an authentication error
 */
export function isAuthError(error: Error | unknown): boolean {
    if (!error) return false

    const message = error instanceof Error ? error.message : String(error)
    const lowerMessage = message.toLowerCase()

    const authPatterns = [
        'jwt expired',
        'token expired',
        'invalid jwt',
        'not authenticated',
        'unauthorized',
        '401',
        '403',
        'invalid claim',
        'session expired',
        'refresh_token_not_found',
    ]

    return authPatterns.some(pattern => lowerMessage.includes(pattern))
}

/**
 * Visibility refresh - RE-ENABLED with connection warm-up
 * 
 * When the tab becomes visible after being hidden (user returns from idle),
 * we warm up the Supabase connection to prevent stale connection hangs.
 * 
 * This is critical for fixing the "infinite loading after idle" bug.
 */
export function setupVisibilityRefresh(): () => void {
    console.log('🔐 [SessionManager] Setting up visibility refresh with connection warm-up')
    
    let lastHiddenTime = 0
    const MIN_HIDDEN_TIME_MS = 30000 // Only warm up if hidden for > 30 seconds
    
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            lastHiddenTime = Date.now()
            console.log('🔐 [SessionManager] Tab hidden')
        } else if (document.visibilityState === 'visible') {
            const hiddenDuration = Date.now() - lastHiddenTime
            console.log(`🔐 [SessionManager] Tab visible (was hidden for ${Math.round(hiddenDuration / 1000)}s)`)
            
            // Only warm up if hidden for a significant time
            if (lastHiddenTime > 0 && hiddenDuration > MIN_HIDDEN_TIME_MS) {
                console.log('🔌 [SessionManager] Triggering connection warm-up after idle...')
                warmUpConnection().catch(err => {
                    console.warn('🔌 [SessionManager] Warm-up error (non-fatal):', err)
                })
            }
        }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        console.log('🔐 [SessionManager] Visibility listener removed')
    }
}
