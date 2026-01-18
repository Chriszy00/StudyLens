import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App'

// Initialize Capacitor native features (status bar, keyboard, splash screen)
import { initializeNativeFeatures } from './services/nativeFile'
initializeNativeFeatures().catch(console.error)

// Import storage test utilities (adds __testStorage and __simpleUpload to window)
// Only in development - helps debug Supabase Storage issues
import './services/testStorage'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import * as sessionManager from '@/lib/sessionManager'
import * as documentsService from '@/services/documents'
import * as aiService from '@/services/ai'
import { supabase } from '@/lib/supabase'

// Re-export for QueryClient usage
const { isAuthError, refreshSession } = sessionManager

// Expose modules on window for debugging/testing (development only)
// This ensures tests use the SAME module instances as the app
if (import.meta.env.DEV) {
  const testWindow = window as unknown as {
    __sessionManager: typeof sessionManager
    __documents: typeof documentsService
    __ai: typeof aiService
    __supabase: typeof supabase
    __runSessionTest: () => Promise<void>
  }
  
  testWindow.__sessionManager = sessionManager
  testWindow.__documents = documentsService
  testWindow.__ai = aiService
  testWindow.__supabase = supabase
  
  // Add a convenient test function
  testWindow.__runSessionTest = async () => {
    console.log('🧪 ════════════════════════════════════════')
    console.log('🧪 SESSION MANAGER TEST (using app modules)')
    console.log('🧪 ════════════════════════════════════════')
    
    const sm = testWindow.__sessionManager
    const docs = testWindow.__documents
    
    // Test 1: Check sync behavior
    console.log('\n🧪 Test 1: getValidSession is synchronous')
    const start1 = Date.now()
    const session = sm.getValidSession()
    console.log(`   Result: ${session ? '✅ Session found' : '⚠️ No session'} (${Date.now() - start1}ms)`)
    
    // Test 2: Multiple sync calls
    console.log('\n🧪 Test 2: 10 rapid sync calls')
    const start2 = Date.now()
    for (let i = 0; i < 10; i++) sm.getValidSession()
    console.log(`   Result: ✅ ${Date.now() - start2}ms for 10 calls`)
    
    // Test 3: Single document fetch
    console.log('\n🧪 Test 3: Single document fetch')
    const start3 = Date.now()
    try {
      const documents = await Promise.race([
        docs.getDocuments('all'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout after 10s')), 10000))
      ])
      console.log(`   Result: ✅ Got ${(documents as unknown[]).length} docs in ${Date.now() - start3}ms`)
    } catch (e) {
      console.error(`   Result: ❌ ${(e as Error).message} after ${Date.now() - start3}ms`)
    }
    
    // Test 4: Concurrent fetches (the problem scenario)
    console.log('\n🧪 Test 4: 4 concurrent fetches (simulates filter navigation)')
    const start4 = Date.now()
    try {
      const results = await Promise.race([
        Promise.all([
          docs.getDocuments('all').catch(e => ({ error: e.message })),
          docs.getDocuments('starred').catch(e => ({ error: e.message })),
          docs.getDocuments('drafts').catch(e => ({ error: e.message })),
          docs.getDocuments('recent').catch(e => ({ error: e.message })),
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout after 20s')), 20000))
      ])
      const errors = (results as unknown[]).filter(r => r && typeof r === 'object' && 'error' in r)
      if (errors.length > 0) {
        console.log(`   Result: ⚠️ ${errors.length}/4 failed in ${Date.now() - start4}ms`)
      } else {
        console.log(`   Result: ✅ All 4 completed in ${Date.now() - start4}ms`)
      }
    } catch (e) {
      console.error(`   Result: ❌ ${(e as Error).message} after ${Date.now() - start4}ms`)
    }
    
    // Test 5: Check Supabase connection directly
    console.log('\n🧪 Test 5: Direct Supabase query')
    const start5 = Date.now()
    try {
      const { data, error } = await Promise.race([
        testWindow.__supabase.from('documents').select('id').limit(1),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout after 5s')), 5000))
      ]) as { data: unknown, error: unknown }
      if (error) {
        console.error(`   Result: ❌ Supabase error: ${JSON.stringify(error)}`)
      } else {
        console.log(`   Result: ✅ Direct query OK in ${Date.now() - start5}ms`)
      }
    } catch (e) {
      console.error(`   Result: ❌ ${(e as Error).message} after ${Date.now() - start5}ms`)
    }
    
    console.log('\n🧪 ════════════════════════════════════════')
    console.log('🧪 TEST COMPLETE')
    console.log('🧪 ════════════════════════════════════════')
  }
  
  console.log('🧪 Test utilities loaded. Run __runSessionTest() in console.')
}

/**
 * QueryClient Configuration
 * -------------------------
 * This is the "brain" of TanStack Query - it manages all caching and synchronization.
 * 
 * KEY CONCEPTS:
 * 
 * staleTime: How long data is considered "fresh"
 *   - Fresh data won't trigger background refetches
 *   - Set higher for data that doesn't change often
 * 
 * gcTime (garbage collection time): How long inactive data stays in memory
 *   - After a query is no longer used, its data stays for this duration
 *   - Useful for back-button navigation (data is still cached)
 * 
 * retry: Number of retry attempts on failure
 *   - 1 = fail once, retry once, then show error
 *   - Prevents hammering a failing server
 * 
 * OPTIMIZED FOR NAVIGATION:
 * - Reduced staleTime so data refreshes more often
 * - Added retryDelay to prevent rapid-fire retries
 * - Disabled refetchOnMount for smoother back-navigation
 * 
 * FIX: Added global auth error detection with automatic session refresh
 * This helps recover from "infinite loading after idle" by detecting auth errors
 * and triggering a session refresh before retrying queries.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,      // 30 seconds - balance between fresh and cached
      gcTime: 1000 * 60 * 10,    // 10 minutes - keep unused data in cache
      retry: (failureCount, error) => {
        // FIX: Smart retry logic for auth errors
        // If it's an auth error on the first failure, refresh session and retry once
        if (failureCount < 2 && isAuthError(error)) {
          console.log('🔐 [QueryClient] Auth error detected, will refresh session before retry')
          // Trigger session refresh (async, but don't await - the retry delay will give it time)
          refreshSession().catch(err => {
            console.error('🔐 [QueryClient] Session refresh failed:', err)
          })
          return true // Do retry after the delay
        }
        // For non-auth errors, retry twice
        return failureCount < 2
      },
      retryDelay: (attemptIndex, error) => {
        // FIX: Give more time for auth error retries to allow session refresh
        const baseDelay = isAuthError(error) ? 2000 : 1000
        return Math.min(baseDelay * 2 ** attemptIndex, 10000)
      },
      refetchOnWindowFocus: false, // Don't refetch on window focus (prevents flashing)
      refetchOnMount: 'always',    // Always check for fresh data on mount, but use cache immediately
      networkMode: 'offlineFirst', // Use cache first, then validate with network
    },
    mutations: {
      retry: 0, // Don't retry mutations - user should click again if failed
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Analytics />
      {/* 
        React Query DevTools
        --------------------
        This adds a floating button in the corner (only in development!)
        Click it to see:
        - All active queries and their status
        - Cached data
        - Query timings
        - Mutation history
        
        It's automatically excluded from production builds.
      */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
