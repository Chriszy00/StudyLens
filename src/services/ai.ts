import { supabase } from '@/lib/supabase'
import { ensureValidSession, getValidSession, isAuthError, warmUpConnection } from '@/lib/sessionManager'

/**
 * Citation for grounding AI output in source document
 * For PDFs: Uses page numbers (sourceQuote = "Page X")
 * For text: Uses extracted quotes (sourceQuote = actual text)
 */
export interface Citation {
    claim: string           // The AI's summarized statement
    sourceQuote: string     // "Page X" for PDFs, or exact quote for text
    verified: boolean       // Always true for PDFs (AI sees pages), fuzzy-matched for text
    section?: number        // Page number (PDFs) or chunk number (text)
}

export interface Summary {
    id: string
    document_id: string
    short_summary: string | null
    detailed_summary: string | null
    bullet_points: string[] | null
    keywords: string[] | null
    study_questions: StudyQuestion[] | null
    citations: Citation[] | null  // Source references for grounding
    compression_ratio: number | null
    keyword_coverage: number | null  // Now used as citation verification rate
    processing_status: 'pending' | 'processing' | 'completed' | 'failed'
    error_message: string | null
    created_at: string
    updated_at: string
}

export interface StudyQuestion {
    question: string
    answer: string
    difficulty: 'easy' | 'medium' | 'hard'
    sourceQuote?: string  // Quote from document supporting this Q&A
}

export interface AIProcessingOptions {
    generateShortSummary: boolean
    generateDetailedSummary: boolean
    extractKeywords: boolean
    generateQuestions: boolean
}


/**
 * Response from the process-document edge function
 */
export interface ProcessDocumentResponse {
    summaryId: string
    status: 'completed' | 'failed'
    chunksProcessed?: number
    wasChunked?: boolean
    wasTruncated?: boolean
    originalLength?: number
}


/**
 * Trigger AI processing for a document
 * This calls the Supabase Edge Function
 */
export async function processDocument(
    documentId: string,
    options: AIProcessingOptions = {
        generateShortSummary: true,
        generateDetailedSummary: true,
        extractKeywords: true,
        generateQuestions: true,
    }
): Promise<ProcessDocumentResponse> {
    // Ensure valid session before making edge function call
    // This prevents the "infinite loading after idle" issue
    console.log('🤖 [AI] Validating session before AI processing...')
    const session = await ensureValidSession()
    if (!session) {
        throw new Error('Session expired. Please sign in again to process documents.')
    }
    console.log('✅ [AI] Session valid, invoking edge function...')

    const { data, error } = await supabase.functions.invoke('process-document', {
        body: { documentId, options },
    })

    if (error) {
        console.error('Edge Function error:', error)

        // Try to extract user-friendly error message from the response
        // The Edge Function returns { error: "user message", errorCode: "...", technicalDetails: "..." }
        let userMessage = 'Our AI service is temporarily unavailable. Please wait a moment and try again.'

        // Check if error.message contains JSON (the edge function response)
        if (error.message) {
            try {
                // Sometimes the error contains the response body
                if (error.context?.body) {
                    const errorBody = JSON.parse(error.context.body)
                    if (errorBody.error) {
                        userMessage = errorBody.error
                    }
                }
            } catch {
                // If parsing fails, check if the data contains the error
                if (data?.error) {
                    userMessage = data.error
                }
            }
        }

        // Log the technical details for debugging
        console.error('Technical details:', data?.technicalDetails || error.message)

        throw new Error(userMessage)
    }

    // Check if the response itself contains an error (edge function returned 200 but with error)
    if (data?.error) {
        console.error('Processing error:', data.error)
        throw new Error(data.error)
    }

    return data
}

/**
 * Get the summary for a document
 * 
 * FIX v3: Added AbortController support to cancel stale requests
 */
export async function getSummary(documentId: string, signal?: AbortSignal): Promise<Summary | null> {
    console.log('📝 [getSummary] Called with documentId:', documentId)
    const startTime = Date.now()

    // Session check
    const session = getValidSession()
    if (!session) {
        console.warn('📝 [getSummary] No cached session - returning null')
        throw new Error('Session expired. Please refresh the page.')
    }

    // Create abort controller with timeout
    const abortController = new AbortController()
    const externalAbortHandler = () => abortController.abort()
    signal?.addEventListener('abort', externalAbortHandler)

    const timeoutId = setTimeout(() => {
        console.log('📝 [getSummary] Aborting query after 10s')
        abortController.abort()
    }, 10000)

    try {
        // Build the query (note: .abortSignal() may not exist in all supabase-js versions)
        const queryPromise = supabase
            .from('summaries')
            .select('*')
            .eq('document_id', documentId)
            .single()

        // Create abort promise that rejects when signal fires
        const abortPromise = new Promise<never>((_, reject) => {
            abortController.signal.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'))
            })
        })

        // Race between query and abort
        const { data, error } = await Promise.race([queryPromise, abortPromise])

        clearTimeout(timeoutId)
        signal?.removeEventListener('abort', externalAbortHandler)

        console.log('📝 [getSummary] Supabase query completed in', Date.now() - startTime, 'ms')

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('📝 [getSummary] No summary found (PGRST116)')
                return null
            }

            if (isAuthError(error)) {
                console.error('📝 [getSummary] Auth error - session may have expired')
                throw new Error('Session expired. Please refresh the page.')
            }

            console.error('📝 [getSummary] Error:', error)
            throw error
        }

        console.log('📝 [getSummary] Returning summary with status:', data?.processing_status)
        return data as Summary
    } catch (err) {
        clearTimeout(timeoutId)
        signal?.removeEventListener('abort', externalAbortHandler)

        const error = err as Error
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
            // Timeout detected - trigger connection warm-up for next request
            console.log('📝 [getSummary] Timeout detected - triggering connection warm-up...')
            warmUpConnection().catch(() => { }) // Fire and forget
            throw new Error('Summary fetch was cancelled')
        }
        throw error
    }
}

/**
 * Poll for summary completion
 * Returns the summary once processing is complete
 */
export async function waitForSummary(
    documentId: string,
    maxAttempts = 30,
    intervalMs = 2000
): Promise<Summary> {
    for (let i = 0; i < maxAttempts; i++) {
        const summary = await getSummary(documentId)

        if (summary) {
            if (summary.processing_status === 'completed') {
                return summary
            }
            if (summary.processing_status === 'failed') {
                throw new Error(summary.error_message || 'AI processing failed')
            }
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error('Timeout waiting for AI processing')
}

/**
 * Get processing status
 */
export async function getProcessingStatus(documentId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_started'
    summary: Summary | null
}> {
    const summary = await getSummary(documentId)

    if (!summary) {
        return { status: 'not_started', summary: null }
    }

    return { status: summary.processing_status, summary }
}
