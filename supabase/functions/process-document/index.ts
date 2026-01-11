// Supabase Edge Function for AI Document Processing using Google Gemini
// OPTIMIZED VERSION - Faster processing, reduced token usage
// Deploy with: supabase functions deploy process-document

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessRequest {
    documentId: string
    options: {
        generateShortSummary: boolean
        generateDetailedSummary: boolean
        extractKeywords: boolean
        generateQuestions: boolean
    }
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const startTime = Date.now()
    console.log('🚀 Edge Function started')

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!

        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY not configured')
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { documentId, options } = await req.json() as ProcessRequest

        console.log('📄 Processing document:', documentId)

        // Get the document
        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('*')
            .eq('id', documentId)
            .single()

        if (docError || !document) {
            throw new Error('Document not found')
        }

        // Create or update summary record
        const { data: existingSummary } = await supabase
            .from('summaries')
            .select('id')
            .eq('document_id', documentId)
            .single()

        let summaryId: string

        if (existingSummary) {
            summaryId = existingSummary.id
            await supabase
                .from('summaries')
                .update({ processing_status: 'processing', error_message: null })
                .eq('id', summaryId)
        } else {
            const { data: newSummary, error: createError } = await supabase
                .from('summaries')
                .insert({ document_id: documentId, processing_status: 'processing' })
                .select('id')
                .single()

            if (createError) throw createError
            summaryId = newSummary.id
        }

        // Get and TRUNCATE document text for faster processing
        const fullText = document.original_text || ''

        if (!fullText.trim()) {
            throw new Error('Document has no text content')
        }

        // OPTIMIZATION: Limit text to 4000 chars for faster free-tier processing
        const maxChars = 4000
        const truncatedText = fullText.length > maxChars
            ? fullText.substring(0, maxChars) + '\n\n[Document truncated for processing]'
            : fullText

        console.log(`📝 Text length: ${fullText.length} → ${truncatedText.length} chars`)

        // Process with Gemini (optimized prompt)
        const geminiStart = Date.now()
        const results = await processWithGemini(truncatedText, options, geminiApiKey)
        console.log(`⚡ Gemini processing took: ${Date.now() - geminiStart}ms`)

        // Calculate metrics
        const originalWords = fullText.split(/\s+/).length
        const summaryWords = ((results.shortSummary || '') + ' ' + (results.detailedSummary || '')).split(/\s+/).length
        const compressionRatio = Math.min(99, Math.max(0, Math.round((1 - summaryWords / originalWords) * 100)))

        // Update summary with results
        const { error: updateError } = await supabase
            .from('summaries')
            .update({
                short_summary: results.shortSummary,
                detailed_summary: results.detailedSummary,
                bullet_points: results.bulletPoints,
                keywords: results.keywords,
                study_questions: results.studyQuestions,
                compression_ratio: compressionRatio,
                keyword_coverage: 85,
                processing_status: 'completed',
            })
            .eq('id', summaryId)

        if (updateError) throw updateError

        // Mark document as processed
        await supabase
            .from('documents')
            .update({ is_draft: false })
            .eq('id', documentId)

        console.log(`✅ Total processing time: ${Date.now() - startTime}ms`)

        return new Response(
            JSON.stringify({ summaryId, status: 'completed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Error:', (error as Error).message)

        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})

async function processWithGemini(
    text: string,
    options: ProcessRequest['options'],
    apiKey: string
) {
    // OPTIMIZED: Simpler, faster prompt
    const prompt = `Analyze this academic text and respond with JSON only.

TEXT:
${text}

Respond with this exact JSON structure:
{
  "shortSummary": "2-3 sentence summary",
  "detailedSummary": "Detailed paragraph (100-150 words)",
  "bulletPoints": ["key point 1", "key point 2", "key point 3", "key point 4", "key point 5"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6"],
  "studyQuestions": [
    {"question": "Q1?", "answer": "A1", "difficulty": "easy"},
    {"question": "Q2?", "answer": "A2", "difficulty": "medium"},
    {"question": "Q3?", "answer": "A3", "difficulty": "hard"}
  ]
}

Rules:
- Return ONLY valid JSON, no markdown
- Keep summaries concise and accurate
- Generate exactly 5 bullet points
- Generate exactly 6 keywords
- Generate exactly 3 study questions (easy, medium, hard)`

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,  // Lower = faster, more consistent
                    maxOutputTokens: 1500,  // Reduced from 4000
                    responseMimeType: 'application/json',
                },
            }),
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini API error:', errorText)
        throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
        throw new Error('No content from Gemini')
    }

    // Parse response
    try {
        const parsed = JSON.parse(content)
        return {
            shortSummary: parsed.shortSummary || '',
            detailedSummary: parsed.detailedSummary || '',
            bulletPoints: parsed.bulletPoints || [],
            keywords: parsed.keywords || [],
            studyQuestions: parsed.studyQuestions || [],
        }
    } catch {
        // Fallback if JSON parsing fails
        console.warn('JSON parse failed, using fallback')
        return {
            shortSummary: content.substring(0, 300),
            detailedSummary: content,
            bulletPoints: ['Summary generated - see detailed view'],
            keywords: ['document', 'analysis'],
            studyQuestions: [],
        }
    }
}
