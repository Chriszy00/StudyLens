import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Analytics } from '@vercel/analytics/react'
import { ensureFreshSession, isAuthError } from '@/lib/supabase'
import { initializeNativeFeatures } from './services/nativeFile'
import './index.css'
import App from './App'

// Initialize Capacitor native features (status bar, keyboard, splash screen)
initializeNativeFeatures().catch(console.error)

// Import storage test utilities (development only)
import './services/testStorage'

// ---------------------------------------------------------------------------
// QueryClient — simple config. All timeout / retry / dead-socket handling
// is done by the resilient fetch wrapper in supabase.ts. We don't need to
// replicate that logic here.
// ---------------------------------------------------------------------------
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 2,
        },
        mutations: {
            retry: 0,
        },
    },
})

// ---------------------------------------------------------------------------
// Global query error handler.
//
// If ANY React Query fetch fails with an auth error (expired JWT, missing
// session, etc.), we call ensureFreshSession() which deduplicates concurrent
// refresh calls (only ONE getSession() runs at a time).
// On success the Supabase client fires TOKEN_REFRESHED, AuthContext
// invalidates caches, and React Query's built-in retry re-runs with the
// fresh token. On failure we dispatch a DOM event so AuthContext can
// perform a full logout + redirect to login.
// ---------------------------------------------------------------------------
queryClient.getQueryCache().config.onError = (error, query) => {
    if (isAuthError(error)) {
        console.warn(
            '[QueryClient] Auth error detected, refreshing session...',
            { queryKey: query.queryKey, error: (error as Error).message }
        )
        ensureFreshSession().then((session) => {
            if (!session) {
                console.warn('[QueryClient] Session refresh failed — dispatching session-expired event')
                window.dispatchEvent(new Event('supabase:session-expired'))
            }
        })
    }
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
            <Analytics />
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    </StrictMode>,
)
