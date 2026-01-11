import { supabase } from '@/lib/supabase'

export interface Summary {
    id: string
    document_id: string
    short_summary: string | null
    detailed_summary: string | null
    bullet_points: string[] | null
    keywords: string[] | null
    study_questions: StudyQuestion[] | null
    compression_ratio: number | null
    keyword_coverage: number | null
    processing_status: 'pending' | 'processing' | 'completed' | 'failed'
    error_message: string | null
    created_at: string
    updated_at: string
}

export interface StudyQuestion {
    question: string
    answer: string
    difficulty: 'easy' | 'medium' | 'hard'
}

export interface AIProcessingOptions {
    generateShortSummary: boolean
    generateDetailedSummary: boolean
    extractKeywords: boolean
    generateQuestions: boolean
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
): Promise<{ summaryId: string }> {
    const { data, error } = await supabase.functions.invoke('process-document', {
        body: { documentId, options },
    })

    if (error) {
        console.error('Error processing document:', error)
        throw error
    }

    return data
}

/**
 * Get the summary for a document
 */
export async function getSummary(documentId: string): Promise<Summary | null> {
    const { data, error } = await supabase
        .from('summaries')
        .select('*')
        .eq('document_id', documentId)
        .single()

    if (error) {
        if (error.code === 'PGRST116') {
            // No summary found
            return null
        }
        console.error('Error fetching summary:', error)
        throw error
    }

    return data as Summary
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
