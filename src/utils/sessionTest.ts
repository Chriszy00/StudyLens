/**
 * SESSION MANAGER TEST SCRIPT
 * ============================
 * 
 * This script simulates the "infinite loading after idle" scenario by:
 * 1. Clearing the session cache (simulating idle/expired state)
 * 2. Triggering multiple concurrent document fetches (like navigating filters)
 * 3. Checking if requests complete or hang
 * 
 * USAGE:
 * ------
 * Copy the exported function into the browser console and run:
 * 
 *   testSessionManager()
 * 
 * Or import and run in your app:
 * 
 *   import { testSessionManager } from '@/utils/sessionTest'
 *   testSessionManager()
 */

import { getValidSession, clearSessionCache, setSessionCache, ensureValidSession, refreshSession } from '@/lib/sessionManager'
import { getDocuments } from '@/services/documents'
import { supabase } from '@/lib/supabase'

export interface TestResult {
    name: string
    passed: boolean
    duration: number
    error?: string
    details?: string
}

/**
 * Run all session manager tests
 */
export async function testSessionManager(): Promise<TestResult[]> {
    console.log('🧪 ════════════════════════════════════════')
    console.log('🧪 SESSION MANAGER TEST SUITE')
    console.log('🧪 ════════════════════════════════════════')
    
    const results: TestResult[] = []
    
    // Test 1: getValidSession is synchronous
    results.push(await testSyncGetValidSession())
    
    // Test 2: Cache population and retrieval
    results.push(await testCachePopulation())
    
    // Test 3: Concurrent requests don't hang
    results.push(await testConcurrentRequests())
    
    // Test 4: Request with cleared cache
    results.push(await testClearedCacheRequest())
    
    // Test 5: Refresh has timeout protection
    results.push(await testRefreshTimeout())
    
    // Summary
    console.log('\n🧪 ════════════════════════════════════════')
    console.log('🧪 TEST SUMMARY')
    console.log('🧪 ════════════════════════════════════════')
    
    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length
    
    results.forEach(r => {
        const status = r.passed ? '✅' : '❌'
        console.log(`${status} ${r.name} (${r.duration}ms)`)
        if (r.error) console.log(`   Error: ${r.error}`)
        if (r.details) console.log(`   ${r.details}`)
    })
    
    console.log(`\n🧪 Results: ${passed} passed, ${failed} failed`)
    
    return results
}

/**
 * Test 1: getValidSession should be synchronous (no Promise)
 */
async function testSyncGetValidSession(): Promise<TestResult> {
    const name = 'getValidSession is synchronous'
    const start = Date.now()
    
    try {
        // getValidSession should return immediately (Session | null), not a Promise
        const result = getValidSession()
        
        // Check it's not a Promise
        if (result instanceof Promise) {
            return {
                name,
                passed: false,
                duration: Date.now() - start,
                error: 'getValidSession returned a Promise instead of Session | null'
            }
        }
        
        return {
            name,
            passed: true,
            duration: Date.now() - start,
            details: `Returned ${result ? 'Session' : 'null'} synchronously`
        }
    } catch (err) {
        return {
            name,
            passed: false,
            duration: Date.now() - start,
            error: err instanceof Error ? err.message : String(err)
        }
    }
}

/**
 * Test 2: Cache can be populated and retrieved
 */
async function testCachePopulation(): Promise<TestResult> {
    const name = 'Cache population and retrieval'
    const start = Date.now()
    
    try {
        // Get current session from Supabase (the only place we should call this)
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
            return {
                name,
                passed: false,
                duration: Date.now() - start,
                error: 'No session available - please sign in first'
            }
        }
        
        // Clear the cache
        clearSessionCache()
        
        // Verify cache is empty
        const emptyResult = getValidSession()
        if (emptyResult !== null) {
            return {
                name,
                passed: false,
                duration: Date.now() - start,
                error: 'Cache was not cleared properly'
            }
        }
        
        // Populate the cache
        setSessionCache(session)
        
        // Verify cache has session
        const cachedResult = getValidSession()
        if (!cachedResult) {
            return {
                name,
                passed: false,
                duration: Date.now() - start,
                error: 'Cache was not populated properly'
            }
        }
        
        return {
            name,
            passed: true,
            duration: Date.now() - start,
            details: 'Cache clear/populate/retrieve all working'
        }
    } catch (err) {
        return {
            name,
            passed: false,
            duration: Date.now() - start,
            error: err instanceof Error ? err.message : String(err)
        }
    }
}

/**
 * Test 3: Multiple concurrent requests don't hang
 * This simulates what happens when you switch filters quickly
 */
async function testConcurrentRequests(): Promise<TestResult> {
    const name = 'Concurrent requests complete without hanging'
    const start = Date.now()
    const TIMEOUT_MS = 20000 // 20 second timeout
    
    try {
        // Ensure we have a valid session first
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            setSessionCache(session)
        }
        
        console.log('🧪 Starting 5 concurrent document fetches...')
        
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT: Requests hung for more than 20 seconds!')), TIMEOUT_MS)
        })
        
        // Fire 5 concurrent requests (simulates rapid filter switching)
        const requests = Promise.all([
            getDocuments('all').catch(e => ({ error: e.message })),
            getDocuments('starred').catch(e => ({ error: e.message })),
            getDocuments('drafts').catch(e => ({ error: e.message })),
            getDocuments('recent').catch(e => ({ error: e.message })),
            getDocuments('all').catch(e => ({ error: e.message })),
        ])
        
        // Race between requests and timeout
        const results = await Promise.race([requests, timeoutPromise])
        
        const duration = Date.now() - start
        console.log(`🧪 All 5 requests completed in ${duration}ms`)
        
        // Check for errors
        const errors = results.filter((r: unknown) => r && typeof r === 'object' && 'error' in r)
        if (errors.length > 0) {
            return {
                name,
                passed: false,
                duration,
                error: `${errors.length}/5 requests failed`,
                details: errors.map((e: { error: string }) => e.error).join(', ')
            }
        }
        
        return {
            name,
            passed: true,
            duration,
            details: `All 5 concurrent requests completed in ${duration}ms`
        }
    } catch (err) {
        return {
            name,
            passed: false,
            duration: Date.now() - start,
            error: err instanceof Error ? err.message : String(err)
        }
    }
}

/**
 * Test 4: Request with cleared cache throws immediately (doesn't hang)
 */
async function testClearedCacheRequest(): Promise<TestResult> {
    const name = 'Cleared cache request fails fast (no hang)'
    const start = Date.now()
    const TIMEOUT_MS = 5000
    
    try {
        // Save current session
        const { data: { session: originalSession } } = await supabase.auth.getSession()
        
        // Clear cache to simulate "idle" state
        clearSessionCache()
        
        console.log('🧪 Testing request with cleared cache...')
        
        // This should fail fast, not hang
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT: Request hung instead of failing fast!')), TIMEOUT_MS)
        })
        
        try {
            await Promise.race([
                getDocuments('all'),
                timeoutPromise
            ])
            
            // If we get here, the request succeeded (user might still be authenticated)
            // Restore session cache
            if (originalSession) setSessionCache(originalSession)
            
            return {
                name,
                passed: true,
                duration: Date.now() - start,
                details: 'Request completed (session still valid server-side)'
            }
        } catch (requestError) {
            // Restore session cache
            if (originalSession) setSessionCache(originalSession)
            
            const duration = Date.now() - start
            const errorMsg = requestError instanceof Error ? requestError.message : String(requestError)
            
            // Check if it was a timeout or a proper error
            if (errorMsg.includes('TIMEOUT')) {
                return {
                    name,
                    passed: false,
                    duration,
                    error: 'Request HUNG instead of failing fast!'
                }
            }
            
            // Fast failure is expected
            return {
                name,
                passed: true,
                duration,
                details: `Request failed fast in ${duration}ms: ${errorMsg}`
            }
        }
    } catch (err) {
        return {
            name,
            passed: false,
            duration: Date.now() - start,
            error: err instanceof Error ? err.message : String(err)
        }
    }
}

/**
 * Test 5: refreshSession has timeout protection
 */
async function testRefreshTimeout(): Promise<TestResult> {
    const name = 'refreshSession has timeout protection'
    const start = Date.now()
    const MAX_EXPECTED_MS = 15000 // Should complete within 15 seconds (timeout is 10s)
    
    try {
        console.log('🧪 Testing refreshSession timeout protection...')
        
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT: refreshSession hung for more than 15 seconds!')), MAX_EXPECTED_MS)
        })
        
        const result = await Promise.race([
            refreshSession(),
            timeoutPromise
        ])
        
        const duration = Date.now() - start
        
        return {
            name,
            passed: true,
            duration,
            details: `refreshSession completed in ${duration}ms, returned ${result ? 'Session' : 'null'}`
        }
    } catch (err) {
        return {
            name,
            passed: false,
            duration: Date.now() - start,
            error: err instanceof Error ? err.message : String(err)
        }
    }
}

/**
 * Console-friendly version for copy-paste
 * Run this in browser console after the app loads
 */
export function getConsoleTestScript(): string {
    return `
// Session Manager Test Script
// Paste this entire block into the browser console

(async function testSessionManager() {
    console.log('🧪 ════════════════════════════════════════');
    console.log('🧪 SESSION MANAGER QUICK TEST');
    console.log('🧪 ════════════════════════════════════════');
    
    // Access the app's modules through the window
    // Note: This assumes Vite exposes modules in dev mode
    
    const results = [];
    
    // Test 1: Check if we can access session manager
    console.log('\\n🧪 Test 1: Accessing session manager...');
    try {
        // In dev mode, we can import dynamically
        const sessionManager = await import('/src/lib/sessionManager.ts');
        console.log('✅ Session manager accessible');
        
        // Test 2: getValidSession is sync
        console.log('\\n🧪 Test 2: getValidSession should be synchronous...');
        const start2 = Date.now();
        const session = sessionManager.getValidSession();
        const duration2 = Date.now() - start2;
        
        if (session instanceof Promise) {
            console.error('❌ FAILED: getValidSession returned a Promise!');
            results.push({ test: 'sync check', passed: false });
        } else {
            console.log(\`✅ getValidSession is sync, returned in \${duration2}ms\`);
            console.log('   Session:', session ? 'Found' : 'null');
            results.push({ test: 'sync check', passed: true });
        }
        
        // Test 3: Multiple concurrent calls don't hang
        console.log('\\n🧪 Test 3: Concurrent getValidSession calls...');
        const start3 = Date.now();
        const calls = [];
        for (let i = 0; i < 10; i++) {
            calls.push(sessionManager.getValidSession());
        }
        const duration3 = Date.now() - start3;
        console.log(\`✅ 10 calls completed in \${duration3}ms (should be <5ms since sync)\`);
        results.push({ test: 'concurrent sync', passed: duration3 < 100 });
        
        // Test 4: Test document fetches
        console.log('\\n🧪 Test 4: Concurrent document fetches (simulating filter navigation)...');
        const documents = await import('/src/services/documents.ts');
        
        const start4 = Date.now();
        const TIMEOUT = 20000;
        
        const fetchPromise = Promise.all([
            documents.getDocuments('all').catch(e => ({ error: e.message })),
            documents.getDocuments('starred').catch(e => ({ error: e.message })),
            documents.getDocuments('drafts').catch(e => ({ error: e.message })),
            documents.getDocuments('recent').catch(e => ({ error: e.message })),
        ]);
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('HUNG: Requests took more than 20s!')), TIMEOUT);
        });
        
        try {
            const fetchResults = await Promise.race([fetchPromise, timeoutPromise]);
            const duration4 = Date.now() - start4;
            console.log(\`✅ All fetches completed in \${duration4}ms\`);
            
            const errors = fetchResults.filter(r => r && r.error);
            if (errors.length > 0) {
                console.warn('⚠️ Some requests had errors:', errors);
            }
            results.push({ test: 'concurrent fetches', passed: true, duration: duration4 });
        } catch (e) {
            console.error('❌ FAILED:', e.message);
            results.push({ test: 'concurrent fetches', passed: false, error: e.message });
        }
        
        // Test 5: Simulate idle by clearing cache
        console.log('\\n🧪 Test 5: Simulating idle (cleared cache) then fetching...');
        sessionManager.clearSessionCache();
        console.log('   Cache cleared. Attempting fetch...');
        
        const start5 = Date.now();
        try {
            await Promise.race([
                documents.getDocuments('all'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('HUNG!')), 5000))
            ]);
            const duration5 = Date.now() - start5;
            console.log(\`✅ Fetch completed in \${duration5}ms (session still valid server-side)\`);
            results.push({ test: 'idle recovery', passed: true });
        } catch (e) {
            const duration5 = Date.now() - start5;
            if (e.message === 'HUNG!') {
                console.error('❌ FAILED: Request HUNG after cache clear!');
                results.push({ test: 'idle recovery', passed: false });
            } else {
                console.log(\`✅ Request failed fast in \${duration5}ms (expected): \${e.message}\`);
                results.push({ test: 'idle recovery', passed: true });
            }
        }
        
    } catch (e) {
        console.error('❌ Test setup failed:', e);
    }
    
    // Summary
    console.log('\\n🧪 ════════════════════════════════════════');
    console.log('🧪 SUMMARY');
    console.log('🧪 ════════════════════════════════════════');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(\`✅ Passed: \${passed}\`);
    console.log(\`❌ Failed: \${failed}\`);
    
    if (failed === 0) {
        console.log('\\n🎉 ALL TESTS PASSED! The fix is working!');
    } else {
        console.log('\\n⚠️ Some tests failed. Check the logs above.');
    }
    
    return results;
})();
`;
}

// Export for direct console use
if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).testSessionManager = testSessionManager;
    (window as unknown as Record<string, unknown>).getConsoleTestScript = getConsoleTestScript;
}

