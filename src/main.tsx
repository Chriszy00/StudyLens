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
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,      // 30 seconds - balance between fresh and cached
      gcTime: 1000 * 60 * 10,    // 10 minutes - keep unused data in cache
      retry: 2,                   // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
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
