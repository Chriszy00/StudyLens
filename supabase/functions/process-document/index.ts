// Supabase Edge Function for AI Document Processing using Google Gemini
// CHUNKED PROCESSING VERSION - Handles documents of any length
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

interface ChunkResult {
    summary: string
    keyPoints: string[]
    keywords: string[]
}

// Citation for grounding AI output in source document
interface Citation {
    claim: string           // The AI's summarized statement
    sourceQuote: string     // Exact quote from source document
    verified: boolean       // Whether quote was found in document
    section?: number        // Which chunk/section it came from
}

// Results structure with citations
interface ProcessingResults {
    shortSummary: string
    detailedSummary: string
    bulletPoints: string[]
    keywords: string[]
    studyQuestions: Array<{ question: string, answer: string, difficulty: string, sourceQuote?: string }>
    citations: Citation[]
}

// Configuration
const CHUNK_SIZE = 4000  // Characters per chunk
const MAX_CHUNKS = 10    // Maximum chunks to process (prevents runaway costs)

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

        // Get document text
        const fullText = document.original_text || ''

        if (!fullText.trim()) {
            throw new Error('Document has no text content')
        }

        // Split into chunks
        const chunks = splitIntoChunks(fullText, CHUNK_SIZE)
        const totalChunks = chunks.length
        const wasChunked = totalChunks > 1

        console.log(`📝 Document: ${fullText.length} chars → ${totalChunks} chunk(s)`)

        // Limit chunks to prevent excessive API usage
        const chunksToProcess = chunks.slice(0, MAX_CHUNKS)
        const wasTruncated = totalChunks > MAX_CHUNKS

        if (wasTruncated) {
            console.log(`⚠️ Document too large, processing only first ${MAX_CHUNKS} chunks`)
        }

        let results: {
            shortSummary: string
            detailedSummary: string
            bulletPoints: string[]
            keywords: string[]
            studyQuestions: Array<{ question: string, answer: string, difficulty: string, sourceQuote?: string }>
            citations?: Citation[]
        }

        if (wasChunked) {
            // CHUNKED PROCESSING: Process each chunk, then combine
            console.log('🔄 Starting chunked processing...')
            results = await processChunkedDocument(chunksToProcess, options, geminiApiKey)
        } else {
            // SINGLE CHUNK: Process normally
            console.log('⚡ Single chunk processing...')
            const geminiStart = Date.now()
            results = await processSingleChunk(fullText, options, geminiApiKey)
            console.log(`⚡ Gemini processing took: ${Date.now() - geminiStart}ms`)
        }

        // Calculate metrics
        const originalWords = fullText.split(/\s+/).length
        const summaryWords = ((results.shortSummary || '') + ' ' + (results.detailedSummary || '')).split(/\s+/).length
        const compressionRatio = Math.min(99, Math.max(0, Math.round((1 - summaryWords / originalWords) * 100)))

        // Calculate citation verification rate
        const citations = results.citations || []
        const verifiedCount = citations.filter(c => c.verified).length
        const citationRate = citations.length > 0 ? Math.round((verifiedCount / citations.length) * 100) : 0
        console.log(`📚 Citation verification rate: ${citationRate}% (${verifiedCount}/${citations.length})`)

        // Update summary with results (including citations)
        const { error: updateError } = await supabase
            .from('summaries')
            .update({
                short_summary: results.shortSummary,
                detailed_summary: results.detailedSummary,
                bullet_points: results.bulletPoints,
                keywords: results.keywords,
                study_questions: results.studyQuestions,
                citations: citations, // Store citations for UI display
                compression_ratio: compressionRatio,
                keyword_coverage: citationRate, // Repurpose this field for citation rate
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
            JSON.stringify({
                summaryId,
                status: 'completed',
                chunksProcessed: chunksToProcess.length,
                wasChunked,
                wasTruncated,
                originalLength: fullText.length,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        const errorMessage = (error as Error).message
        console.error('❌ Error:', errorMessage)

        // Parse user-friendly errors (format: "ERROR_CODE:User friendly message")
        let userMessage = 'Something went wrong while processing your document. Please try again.'
        let errorCode = 'UNKNOWN_ERROR'

        if (errorMessage.includes(':')) {
            const parts = errorMessage.split(':')
            errorCode = parts[0]
            userMessage = parts.slice(1).join(':') // In case message contains colons
        } else if (errorMessage.includes('Document not found')) {
            userMessage = 'The document could not be found. It may have been deleted.'
            errorCode = 'DOC_NOT_FOUND'
        } else if (errorMessage.includes('No text content')) {
            userMessage = 'The document appears to be empty or could not be read. Please try uploading again.'
            errorCode = 'EMPTY_DOC'
        }

        return new Response(
            JSON.stringify({
                error: userMessage,
                errorCode: errorCode,
                technicalDetails: errorMessage // For debugging in console
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})

/**
 * Split text into chunks, trying to break at sentence boundaries
 */
function splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = []
    let remaining = text

    while (remaining.length > 0) {
        if (remaining.length <= chunkSize) {
            chunks.push(remaining)
            break
        }

        // Try to find a sentence boundary near the chunk size
        let breakPoint = chunkSize

        // Look for sentence endings (. ! ?) within the last 500 chars of the chunk
        const searchStart = Math.max(0, chunkSize - 500)
        const searchArea = remaining.substring(searchStart, chunkSize)

        // Find the last sentence boundary
        const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n']
        let lastBoundary = -1

        for (const ending of sentenceEndings) {
            const pos = searchArea.lastIndexOf(ending)
            if (pos > lastBoundary) {
                lastBoundary = pos
            }
        }

        if (lastBoundary > 0) {
            breakPoint = searchStart + lastBoundary + 2  // Include the punctuation and space
        }

        chunks.push(remaining.substring(0, breakPoint).trim())
        remaining = remaining.substring(breakPoint).trim()
    }

    return chunks
}

/**
 * Process a document that spans multiple chunks
 */
async function processChunkedDocument(
    chunks: string[],
    options: ProcessRequest['options'],
    apiKey: string
): Promise<{
    shortSummary: string
    detailedSummary: string
    bulletPoints: string[]
    keywords: string[]
    studyQuestions: Array<{ question: string, answer: string, difficulty: string }>
}> {
    console.log(`🔄 Processing ${chunks.length} chunks...`)

    // Step 1: Process each chunk to extract key information
    const chunkResults: ChunkResult[] = []

    for (let i = 0; i < chunks.length; i++) {
        console.log(`  📝 Processing chunk ${i + 1}/${chunks.length}...`)
        const result = await processChunk(chunks[i], i + 1, chunks.length, apiKey)
        chunkResults.push(result)
    }

    // Step 2: Combine all chunk results into final summary
    console.log('🔗 Combining chunk results...')
    const combinedResult = await combineChunkResults(chunkResults, options, apiKey)

    return combinedResult
}

/**
 * Process a single chunk to extract key information
 */
async function processChunk(
    text: string,
    chunkNum: number,
    totalChunks: number,
    apiKey: string
): Promise<ChunkResult> {
    const prompt = `You are analyzing part ${chunkNum} of ${totalChunks} of an academic document.

Extract the key information from this section:

TEXT:
${text}

Respond with JSON only:
{
  "summary": "2-3 sentence summary of THIS section",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Rules:
- Return ONLY valid JSON, no markdown
- Focus on the main ideas in THIS section
- Be concise but comprehensive`

    const response = await callGemini(prompt, apiKey, 800)

    try {
        const parsed = JSON.parse(response)
        return {
            summary: parsed.summary || '',
            keyPoints: parsed.keyPoints || [],
            keywords: parsed.keywords || [],
        }
    } catch {
        console.warn(`  ⚠️ Chunk ${chunkNum} parse failed, using fallback`)
        return {
            summary: response.substring(0, 200),
            keyPoints: ['Content analyzed'],
            keywords: ['document'],
        }
    }
}

/**
 * Combine results from all chunks into a final comprehensive summary
 */
async function combineChunkResults(
    chunkResults: ChunkResult[],
    options: ProcessRequest['options'],
    apiKey: string
): Promise<{
    shortSummary: string
    detailedSummary: string
    bulletPoints: string[]
    keywords: string[]
    studyQuestions: Array<{ question: string, answer: string, difficulty: string }>
}> {
    // Compile all chunk summaries and key points
    const allSummaries = chunkResults.map((r, i) => `Section ${i + 1}: ${r.summary}`).join('\n')
    const allKeyPoints = chunkResults.flatMap(r => r.keyPoints)
    const allKeywords = [...new Set(chunkResults.flatMap(r => r.keywords))]

    const prompt = `You are an expert academic tutor creating study materials for university students. You have analyzed a document in ${chunkResults.length} sections. Here are the section summaries and key points:

SECTION SUMMARIES:
${allSummaries}

ALL KEY POINTS:
${allKeyPoints.map(p => `• ${p}`).join('\n')}

ALL KEYWORDS FOUND:
${allKeywords.join(', ')}

Now create a comprehensive final analysis. Respond with this exact JSON structure:
{
  "shortSummary": "YOUR SHORT SUMMARY HERE - see requirements below",
  "detailedSummary": "YOUR DETAILED SUMMARY HERE - see requirements below",
  "bulletPoints": ["STUDY NOTE 1", "STUDY NOTE 2", "STUDY NOTE 3", "STUDY NOTE 4", "STUDY NOTE 5", "STUDY NOTE 6", "STUDY NOTE 7", "STUDY NOTE 8"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
  "studyQuestions": [
    {"question": "Q1?", "answer": "A1", "difficulty": "easy"},
    {"question": "Q2?", "answer": "A2", "difficulty": "medium"},
    {"question": "Q3?", "answer": "A3", "difficulty": "hard"},
    {"question": "Q4?", "answer": "A4", "difficulty": "medium"},
    {"question": "Q5?", "answer": "A5", "difficulty": "hard"}
  ]
}

=== SHORT SUMMARY REQUIREMENTS (4-6 sentences, ~80-120 words) ===
Must include:
1. What this document/topic IS (clear definition or classification)
2. The MAIN PURPOSE or problem it addresses
3. 2-3 KEY CONCEPTS or components that are essential to understand
4. WHY this matters (practical significance or applications)
5. A memorable takeaway or thesis statement

=== DETAILED SUMMARY REQUIREMENTS (300-400 words, structured with headers) ===
IMPORTANT: Include section headers DIRECTLY in the text using this EXACT format with double newlines between sections:

**INTRODUCTION:** [2-3 sentences defining the topic and its significance]

**CORE CONCEPTS:** [Paragraph explaining fundamental principles, theories, formulas, and definitions]

**KEY COMPONENTS:** [Paragraph detailing the key components, methods, or processes and how they relate]

**APPLICATIONS:** [Paragraph with real-world applications and concrete examples]

**CONNECTIONS:** [Paragraph on how this connects to broader topics and future implications]

**KEY TAKEAWAYS:** [2-3 sentences of what students MUST remember for exams]

=== BULLET POINTS (STUDY NOTES) REQUIREMENTS - Generate exactly 8 ===
These should be ACTIONABLE study notes, not just summaries. Each bullet should be one of:
• DEFINITION: "[Term]: [clear, concise definition that could appear on an exam]"
• FORMULA/EQUATION: "[Name]: [formula] where [explain variables]"
• KEY DISTINCTION: "[Concept A] vs [Concept B]: [explain the difference]"
• PROCESS/STEPS: "[Process name]: Step 1... Step 2... Step 3..."
• CAUSE/EFFECT: "[X] leads to [Y] because [explanation]"
• EXAMPLE: "[Concept] example: [concrete real-world example]"
• COMMON MISTAKE: "⚠️ Common error: [what students often get wrong]"
• MEMORY AID: "💡 Remember: [mnemonic or memorable way to recall]"

=== KEYWORDS REQUIREMENTS ===
Generate exactly 8 keywords/terms a student should know for an exam

=== STUDY QUESTIONS REQUIREMENTS ===
Generate exactly 5 questions that:
- Easy (1): Tests basic recall or definition
- Medium (2): Tests understanding of relationships or applications
- Hard (2): Tests analysis, synthesis, or problem-solving
Include DETAILED answers (2-3 sentences each) that explain the reasoning

Rules:
- Return ONLY valid JSON, no markdown code blocks
- Create a cohesive summary that ties all sections together
- Prioritize the most important points and keywords
- Write in clear, educational language suitable for university students`

    const response = await callGemini(prompt, apiKey, 2500)

    try {
        const parsed = JSON.parse(response)
        return {
            shortSummary: parsed.shortSummary || '',
            detailedSummary: parsed.detailedSummary || '',
            bulletPoints: parsed.bulletPoints || [],
            keywords: parsed.keywords || [],
            studyQuestions: parsed.studyQuestions || [],
        }
    } catch {
        console.warn('⚠️ Final combination parse failed, using fallback')
        return {
            shortSummary: allSummaries.substring(0, 500),
            detailedSummary: allSummaries,
            bulletPoints: allKeyPoints.slice(0, 8),
            keywords: allKeywords.slice(0, 8),
            studyQuestions: [],
        }
    }
}

/**
 * Process a single (non-chunked) document with citations
 */
async function processSingleChunk(
    text: string,
    options: ProcessRequest['options'],
    apiKey: string
): Promise<ProcessingResults> {
    const prompt = `You are an expert academic tutor creating study materials for university students. Analyze this academic text and create comprehensive, learning-focused content.

CRITICAL REQUIREMENT: For EVERY bullet point and study question, you MUST include a "sourceQuote" field containing the EXACT text from the document that supports your claim. This is essential for academic integrity and grounding.

TEXT:
${text}

Respond with this exact JSON structure:
{
  "shortSummary": "YOUR SHORT SUMMARY HERE - see requirements below",
  "detailedSummary": "YOUR DETAILED SUMMARY HERE - see requirements below",
  "bulletPoints": [
    {"text": "STUDY NOTE 1", "sourceQuote": "exact quote from document"},
    {"text": "STUDY NOTE 2", "sourceQuote": "exact quote from document"},
    {"text": "STUDY NOTE 3", "sourceQuote": "exact quote from document"},
    {"text": "STUDY NOTE 4", "sourceQuote": "exact quote from document"},
    {"text": "STUDY NOTE 5", "sourceQuote": "exact quote from document"},
    {"text": "STUDY NOTE 6", "sourceQuote": "exact quote from document"},
    {"text": "STUDY NOTE 7", "sourceQuote": "exact quote from document"},
    {"text": "STUDY NOTE 8", "sourceQuote": "exact quote from document"}
  ],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
  "studyQuestions": [
    {"question": "Q1?", "answer": "A1", "difficulty": "easy", "sourceQuote": "exact text supporting this Q&A"},
    {"question": "Q2?", "answer": "A2", "difficulty": "medium", "sourceQuote": "exact text supporting this Q&A"},
    {"question": "Q3?", "answer": "A3", "difficulty": "hard", "sourceQuote": "exact text supporting this Q&A"},
    {"question": "Q4?", "answer": "A4", "difficulty": "medium", "sourceQuote": "exact text supporting this Q&A"},
    {"question": "Q5?", "answer": "A5", "difficulty": "hard", "sourceQuote": "exact text supporting this Q&A"}
  ]
}

=== SOURCE QUOTE REQUIREMENTS ===
IMPORTANT: The "sourceQuote" field must contain the EXACT words from the TEXT above.
- Copy the relevant sentence(s) VERBATIM from the document
- Keep quotes 10-50 words for clarity
- The quote must directly support the claim/note/question
- If multiple sentences are needed, include them all

=== SHORT SUMMARY REQUIREMENTS (4-6 sentences, ~80-120 words) ===
Must include:
1. What this document/topic IS (clear definition or classification)
2. The MAIN PURPOSE or problem it addresses
3. 2-3 KEY CONCEPTS or components that are essential to understand
4. WHY this matters (practical significance or applications)
5. A memorable takeaway or thesis statement

=== DETAILED SUMMARY REQUIREMENTS (300-400 words, structured with headers) ===
IMPORTANT: Include section headers DIRECTLY in the text using this EXACT format with double newlines between sections:

**INTRODUCTION:** [2-3 sentences defining the topic and its significance]

**CORE CONCEPTS:** [Paragraph explaining fundamental principles, theories, formulas, and definitions]

**KEY COMPONENTS:** [Paragraph detailing the key components, methods, or processes and how they relate]

**APPLICATIONS:** [Paragraph with real-world applications and concrete examples]

**CONNECTIONS:** [Paragraph on how this connects to broader topics and future implications]

**KEY TAKEAWAYS:** [2-3 sentences of what students MUST remember for exams]

=== BULLET POINTS (STUDY NOTES) REQUIREMENTS - Generate exactly 8 ===
These should be ACTIONABLE study notes, not just summaries. Each bullet should be one of:
• DEFINITION: "[Term]: [clear, concise definition that could appear on an exam]"
• FORMULA/EQUATION: "[Name]: [formula] where [explain variables]"
• KEY DISTINCTION: "[Concept A] vs [Concept B]: [explain the difference]"
• PROCESS/STEPS: "[Process name]: Step 1... Step 2... Step 3..."
• CAUSE/EFFECT: "[X] leads to [Y] because [explanation]"
• EXAMPLE: "[Concept] example: [concrete real-world example]"
• COMMON MISTAKE: "⚠️ Common error: [what students often get wrong]"
• MEMORY AID: "💡 Remember: [mnemonic or memorable way to recall]"

=== KEYWORDS REQUIREMENTS ===
Generate exactly 8 keywords/terms a student should know for an exam

=== STUDY QUESTIONS REQUIREMENTS ===
Generate exactly 5 questions that:
- Easy (1): Tests basic recall or definition
- Medium (2): Tests understanding of relationships or applications
- Hard (2): Tests analysis, synthesis, or problem-solving
Include DETAILED answers (2-3 sentences each) that explain the reasoning
MUST include sourceQuote for each question

Rules:
- Return ONLY valid JSON, no markdown code blocks
- Write in clear, educational language suitable for university students
- Be specific and precise - avoid vague or generic statements
- Prioritize exam-relevant information
- ALWAYS include sourceQuote with exact text from the document`

    const response = await callGemini(prompt, apiKey, 3500) // Increased tokens for citations

    try {
        const parsed = JSON.parse(response)

        // Extract bullet points - handle both old format (string[]) and new format with citations
        let bulletPoints: string[] = []
        let citations: Citation[] = []

        if (Array.isArray(parsed.bulletPoints)) {
            parsed.bulletPoints.forEach((bp: string | { text: string; sourceQuote?: string }, index: number) => {
                if (typeof bp === 'string') {
                    bulletPoints.push(bp)
                } else if (bp.text) {
                    bulletPoints.push(bp.text)
                    if (bp.sourceQuote) {
                        // Verify the citation exists in the source text
                        const verified = verifyCitation(bp.sourceQuote, text)
                        citations.push({
                            claim: bp.text,
                            sourceQuote: bp.sourceQuote,
                            verified,
                            section: 1
                        })
                    }
                }
            })
        }

        // Process study questions with citations
        const studyQuestions = (parsed.studyQuestions || []).map((q: { question: string; answer: string; difficulty: string; sourceQuote?: string }) => {
            if (q.sourceQuote) {
                const verified = verifyCitation(q.sourceQuote, text)
                citations.push({
                    claim: q.question,
                    sourceQuote: q.sourceQuote,
                    verified,
                    section: 1
                })
            }
            return {
                question: q.question,
                answer: q.answer,
                difficulty: q.difficulty,
                sourceQuote: q.sourceQuote
            }
        })

        console.log(`📚 Generated ${citations.length} citations, ${citations.filter(c => c.verified).length} verified`)

        return {
            shortSummary: parsed.shortSummary || '',
            detailedSummary: parsed.detailedSummary || '',
            bulletPoints,
            keywords: parsed.keywords || [],
            studyQuestions,
            citations
        }
    } catch {
        console.warn('JSON parse failed, using fallback')
        return {
            shortSummary: response.substring(0, 300),
            detailedSummary: response,
            bulletPoints: ['Summary generated - see detailed view'],
            keywords: ['document', 'analysis'],
            studyQuestions: [],
            citations: []
        }
    }
}

/**
 * Verify that a citation quote actually exists in the source text
 * Enhanced to handle PPTX-to-PDF conversion issues:
 * - Text fragmentation (words split across lines)
 * - Strange whitespace and formatting
 * - Unicode normalization issues
 */
function verifyCitation(quote: string, sourceText: string): boolean {
    if (!quote || !sourceText) return false

    // AGGRESSIVE normalization for both texts
    const normalize = (text: string): string => {
        return text
            .toLowerCase()
            // Remove all types of whitespace and line breaks
            .replace(/[\r\n\t\f\v]+/g, ' ')
            // Normalize unicode characters
            .normalize('NFKC')
            // Remove special characters but keep alphanumeric
            .replace(/[^\w\s]/g, ' ')
            // Collapse multiple spaces to single
            .replace(/\s+/g, ' ')
            .trim()
    }

    const normalizedQuote = normalize(quote)
    const normalizedSource = normalize(sourceText)

    // Strategy 1: Exact substring match (after normalization)
    if (normalizedSource.includes(normalizedQuote)) {
        console.log('✅ Citation verified via exact match')
        return true
    }

    // Strategy 2: Key phrases match (for shorter, distinctive phrases)
    // Extract 3-4 word phrases from the quote and check if they exist
    const quoteWords = normalizedQuote.split(' ').filter(w => w.length > 2)

    if (quoteWords.length >= 3) {
        // Check 3-word phrases
        let phrasesFound = 0
        const totalPhrases = Math.max(1, quoteWords.length - 2)

        for (let i = 0; i < quoteWords.length - 2; i++) {
            const phrase = `${quoteWords[i]} ${quoteWords[i + 1]} ${quoteWords[i + 2]}`
            if (normalizedSource.includes(phrase)) {
                phrasesFound++
            }
        }

        const phraseMatchRatio = phrasesFound / totalPhrases
        if (phraseMatchRatio >= 0.5) {
            console.log(`✅ Citation verified via phrase match (${phrasesFound}/${totalPhrases} phrases)`)
            return true
        }
    }

    // Strategy 3: Word-by-word sequential matching (handles fragmented text)
    // Words should appear in ROUGH order but can have gaps
    if (quoteWords.length >= 4) {
        let matchedWords = 0
        let searchPos = 0

        for (const word of quoteWords) {
            // Look for the word anywhere after current position, but within reasonable distance
            const windowSize = 1000 // Characters to look ahead
            const searchWindow = normalizedSource.substring(searchPos, searchPos + windowSize)
            const foundPos = searchWindow.indexOf(word)

            if (foundPos !== -1) {
                matchedWords++
                searchPos = searchPos + foundPos + word.length
            }
        }

        const matchRatio = matchedWords / quoteWords.length
        if (matchRatio >= 0.6) { // 60% of words found in sequence
            console.log(`✅ Citation verified via word sequence (${matchedWords}/${quoteWords.length} words, ${Math.round(matchRatio * 100)}%)`)
            return true
        }
    }

    // Strategy 4: Bag-of-words match (for very fragmented text)
    // Check if most unique words from quote exist anywhere in source
    const significantWords = quoteWords.filter(w => w.length >= 4) // Only longer words
    if (significantWords.length >= 3) {
        const wordsFound = significantWords.filter(w => normalizedSource.includes(w)).length
        const wordMatchRatio = wordsFound / significantWords.length

        if (wordMatchRatio >= 0.8) { // 80% of significant words found anywhere
            console.log(`✅ Citation verified via bag-of-words (${wordsFound}/${significantWords.length} words)`)
            return true
        }
    }

    console.log(`❌ Citation not verified: "${normalizedQuote.substring(0, 50)}..."`)
    return false
}

/**
 * Call Gemini API with a prompt - includes retry logic for transient errors
 */
async function callGemini(prompt: string, apiKey: string, maxTokens: number): Promise<string> {
    const MAX_RETRIES = 3
    const BASE_DELAY_MS = 2000 // 2 seconds base delay

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`🤖 Gemini API call attempt ${attempt}/${MAX_RETRIES}...`)

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: maxTokens,
                            responseMimeType: 'application/json',
                        },
                    }),
                }
            )

            if (!response.ok) {
                const errorText = await response.text()
                console.error(`Gemini API error (attempt ${attempt}):`, errorText)

                // Parse the error to get more details
                let errorDetails = ''
                try {
                    const errorJson = JSON.parse(errorText)
                    errorDetails = errorJson.error?.message || errorText
                } catch {
                    errorDetails = errorText
                }

                // Check if it's a retryable error (503 overloaded, 429 rate limit, 500 server error)
                const isRetryable = response.status === 503 || response.status === 429 || response.status === 500

                if (isRetryable && attempt < MAX_RETRIES) {
                    // Exponential backoff: 2s, 4s, 8s
                    const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1)
                    console.log(`⏳ Retryable error (${response.status}), waiting ${delayMs}ms before retry...`)
                    await new Promise(resolve => setTimeout(resolve, delayMs))
                    continue
                }

                // Throw user-friendly errors based on status code
                switch (response.status) {
                    case 503:
                        throw new Error('AI_BUSY:Our AI service is currently experiencing high demand. Please wait a moment and try again.')
                    case 429:
                        throw new Error('AI_RATE_LIMIT:You\'ve made too many requests. Please wait a few minutes before trying again.')
                    case 400:
                        throw new Error('AI_INVALID_REQUEST:The document could not be processed. It may be too long or contain unsupported content.')
                    case 401:
                    case 403:
                        throw new Error('AI_AUTH_ERROR:There\'s a configuration issue with our AI service. Please contact support.')
                    default:
                        throw new Error(`AI_ERROR:Something went wrong with the AI service. Please try again later. (Error: ${response.status})`)
                }
            }

            const data = await response.json()
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text

            if (!content) {
                // Check for safety blocks or other issues
                const finishReason = data.candidates?.[0]?.finishReason
                if (finishReason === 'SAFETY') {
                    throw new Error('AI_SAFETY:The document was flagged by our content safety filter. Please review the content and try again.')
                }
                throw new Error('AI_EMPTY:The AI returned an empty response. Please try again.')
            }

            console.log(`✅ Gemini API call successful on attempt ${attempt}`)
            return content

        } catch (error) {
            // If it's already a user-friendly error, rethrow it
            if ((error as Error).message.includes(':')) {
                throw error
            }

            // Network or other errors
            if (attempt < MAX_RETRIES) {
                const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1)
                console.log(`⏳ Network error, waiting ${delayMs}ms before retry...`)
                await new Promise(resolve => setTimeout(resolve, delayMs))
                continue
            }

            throw new Error('AI_NETWORK:Unable to reach the AI service. Please check your internet connection and try again.')
        }
    }

    // Should never reach here, but just in case
    throw new Error('AI_ERROR:Failed to process after multiple attempts. Please try again later.')
}


