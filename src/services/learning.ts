import { supabase } from '@/lib/supabase'

export interface Flashcard {
    id: string
    user_id: string
    document_id: string
    front: string
    back: string
    difficulty: 'easy' | 'medium' | 'hard'
    ease_factor: number
    interval_days: number
    repetitions: number
    next_review_date: string
    last_reviewed_at: string | null
    created_at: string
}

export interface StudySession {
    id: string
    user_id: string
    document_id: string | null
    started_at: string
    ended_at: string | null
    cards_studied: number
    cards_correct: number
    session_type: 'review' | 'learn' | 'quiz'
}

export interface ConceptMastery {
    id: string
    user_id: string
    document_id: string
    keyword: string
    mastery_score: number
    times_reviewed: number
    times_correct: number
    last_reviewed_at: string | null
}

/**
 * Generate flashcards from a document's study questions
 */
export async function generateFlashcardsFromDocument(documentId: string): Promise<Flashcard[]> {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Not authenticated')

    // Get the summary with study questions
    const { data: summary, error: summaryError } = await supabase
        .from('summaries')
        .select('study_questions, keywords')
        .eq('document_id', documentId)
        .single()

    if (summaryError || !summary) {
        throw new Error('No summary found for document')
    }

    const studyQuestions = summary.study_questions as Array<{
        question: string
        answer: string
        difficulty: 'easy' | 'medium' | 'hard'
    }> || []

    if (studyQuestions.length === 0) {
        throw new Error('No study questions available')
    }

    // Check if flashcards already exist
    const { data: existingCards } = await supabase
        .from('flashcards')
        .select('id')
        .eq('document_id', documentId)
        .eq('user_id', user.id)

    if (existingCards && existingCards.length > 0) {
        // Return existing flashcards
        const { data: cards } = await supabase
            .from('flashcards')
            .select('*')
            .eq('document_id', documentId)
            .eq('user_id', user.id)
        return cards as Flashcard[]
    }

    // Create flashcards from study questions
    const flashcardsToInsert = studyQuestions.map(q => ({
        user_id: user.id,
        document_id: documentId,
        front: q.question,
        back: q.answer,
        difficulty: q.difficulty,
    }))

    const { data: newCards, error: insertError } = await supabase
        .from('flashcards')
        .insert(flashcardsToInsert)
        .select()

    if (insertError) throw insertError
    return newCards as Flashcard[]
}

/**
 * Get flashcards due for review
 */
export async function getDueFlashcards(documentId?: string): Promise<Flashcard[]> {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Not authenticated')

    let query = supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', user.id)
        .lte('next_review_date', new Date().toISOString())
        .order('next_review_date', { ascending: true })

    if (documentId) {
        query = query.eq('document_id', documentId)
    }

    const { data, error } = await query
    if (error) throw error
    return data as Flashcard[]
}

/**
 * Get all flashcards for a document
 */
export async function getFlashcards(documentId: string): Promise<Flashcard[]> {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data as Flashcard[]
}

/**
 * SM-2 Algorithm: Calculate next review date based on quality rating
 * Quality: 0 = complete blackout, 5 = perfect response
 */
export function calculateSM2(
    quality: number,
    repetitions: number,
    easeFactor: number,
    intervalDays: number
): { repetitions: number; easeFactor: number; intervalDays: number } {
    // Ensure quality is between 0 and 5
    quality = Math.max(0, Math.min(5, quality))

    let newRepetitions = repetitions
    let newEaseFactor = easeFactor
    let newInterval = intervalDays

    if (quality >= 3) {
        // Correct response
        if (repetitions === 0) {
            newInterval = 1
        } else if (repetitions === 1) {
            newInterval = 6
        } else {
            newInterval = Math.round(intervalDays * easeFactor)
        }
        newRepetitions = repetitions + 1
    } else {
        // Incorrect response - reset
        newRepetitions = 0
        newInterval = 1
    }

    // Update ease factor
    newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    newEaseFactor = Math.max(1.3, newEaseFactor) // Minimum ease factor

    return {
        repetitions: newRepetitions,
        easeFactor: Math.round(newEaseFactor * 100) / 100,
        intervalDays: newInterval,
    }
}

/**
 * Record a card review and update spaced repetition values
 */
export async function recordCardReview(
    flashcardId: string,
    quality: number, // 0-5 rating
    sessionId?: string,
    timeSpentMs?: number
): Promise<Flashcard> {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Not authenticated')

    // Get current flashcard state
    const { data: card, error: fetchError } = await supabase
        .from('flashcards')
        .select('*')
        .eq('id', flashcardId)
        .single()

    if (fetchError || !card) throw new Error('Flashcard not found')

    // Calculate new SM-2 values
    const sm2Result = calculateSM2(
        quality,
        card.repetitions,
        card.ease_factor,
        card.interval_days
    )

    // Calculate next review date
    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + sm2Result.intervalDays)

    // Update flashcard
    const { data: updatedCard, error: updateError } = await supabase
        .from('flashcards')
        .update({
            repetitions: sm2Result.repetitions,
            ease_factor: sm2Result.easeFactor,
            interval_days: sm2Result.intervalDays,
            next_review_date: nextReview.toISOString(),
            last_reviewed_at: new Date().toISOString(),
        })
        .eq('id', flashcardId)
        .select()
        .single()

    if (updateError) throw updateError

    // Record the review
    await supabase.from('card_reviews').insert({
        flashcard_id: flashcardId,
        session_id: sessionId,
        user_id: user.id,
        quality,
        time_spent_ms: timeSpentMs,
    })

    return updatedCard as Flashcard
}

/**
 * Start a new study session
 */
export async function startStudySession(
    documentId?: string,
    sessionType: 'review' | 'learn' | 'quiz' = 'review'
): Promise<StudySession> {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('study_sessions')
        .insert({
            user_id: user.id,
            document_id: documentId,
            session_type: sessionType,
        })
        .select()
        .single()

    if (error) throw error
    return data as StudySession
}

/**
 * End a study session
 */
export async function endStudySession(
    sessionId: string,
    cardsStudied: number,
    cardsCorrect: number
): Promise<void> {
    await supabase
        .from('study_sessions')
        .update({
            ended_at: new Date().toISOString(),
            cards_studied: cardsStudied,
            cards_correct: cardsCorrect,
        })
        .eq('id', sessionId)
}

/**
 * Get study statistics for a user
 */
export async function getStudyStats(): Promise<{
    totalCardsStudied: number
    totalSessionsCompleted: number
    averageAccuracy: number
    streakDays: number
}> {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Not authenticated')

    const { data: sessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id)
        .not('ended_at', 'is', null)

    if (!sessions || sessions.length === 0) {
        return {
            totalCardsStudied: 0,
            totalSessionsCompleted: 0,
            averageAccuracy: 0,
            streakDays: 0,
        }
    }

    const totalCardsStudied = sessions.reduce((acc, s) => acc + (s.cards_studied || 0), 0)
    const totalCorrect = sessions.reduce((acc, s) => acc + (s.cards_correct || 0), 0)
    const averageAccuracy = totalCardsStudied > 0
        ? Math.round((totalCorrect / totalCardsStudied) * 100)
        : 0

    // Calculate streak (simplified - just check consecutive days)
    const today = new Date().toDateString()
    const sessionDates = [...new Set(sessions.map(s => new Date(s.started_at).toDateString()))]
    const hasStudiedToday = sessionDates.includes(today)

    return {
        totalCardsStudied,
        totalSessionsCompleted: sessions.length,
        averageAccuracy,
        streakDays: hasStudiedToday ? sessionDates.length : 0,
    }
}

// ============================================
// WEIGHTED MASTERY SCORE (WMS) IMPLEMENTATION
// ============================================

/**
 * Calculate Weighted Mastery Score for a concept
 * 
 * WMS Formula:
 * WMS = (correct / reviewed) × 100 × recencyWeight × difficultyWeight
 * 
 * Where:
 * - recencyWeight: Decays over time (more recent = higher weight)
 * - difficultyWeight: Harder concepts have lower base score
 */
export function calculateWMS(
    timesReviewed: number,
    timesCorrect: number,
    lastReviewedAt: Date | null,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): number {
    if (timesReviewed === 0) return 0

    // Base accuracy (0-100)
    const accuracy = (timesCorrect / timesReviewed) * 100

    // Recency weight (decays over time)
    // Full weight if reviewed today, 50% after 7 days, 25% after 30 days
    let recencyWeight = 1.0
    if (lastReviewedAt) {
        const daysSinceReview = Math.floor(
            (Date.now() - lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24)
        )
        recencyWeight = Math.max(0.25, 1 - (daysSinceReview * 0.025))
    }

    // Difficulty weight (harder = requires more reviews for same mastery)
    const difficultyWeights = {
        easy: 1.0,
        medium: 0.85,
        hard: 0.7,
    }
    const difficultyWeight = difficultyWeights[difficulty]

    // Repetition bonus (more reviews = more confident in score)
    // Caps at 1.2x after 10 reviews
    const repetitionBonus = Math.min(1.2, 1 + (timesReviewed * 0.02))

    // Final WMS calculation
    const wms = accuracy * recencyWeight * difficultyWeight * repetitionBonus

    return Math.min(100, Math.round(wms * 100) / 100)
}

/**
 * Update mastery score for a keyword after a review
 */
export async function updateConceptMastery(
    documentId: string,
    keyword: string,
    wasCorrect: boolean
): Promise<ConceptMastery> {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Not authenticated')

    // Get or create mastery record
    const { data: existing } = await supabase
        .from('concept_mastery')
        .select('*')
        .eq('user_id', user.id)
        .eq('document_id', documentId)
        .eq('keyword', keyword)
        .single()

    const timesReviewed = (existing?.times_reviewed || 0) + 1
    const timesCorrect = (existing?.times_correct || 0) + (wasCorrect ? 1 : 0)
    const lastReviewedAt = new Date()

    // Calculate new WMS
    const masteryScore = calculateWMS(timesReviewed, timesCorrect, lastReviewedAt)

    if (existing) {
        // Update existing record
        const { data, error } = await supabase
            .from('concept_mastery')
            .update({
                times_reviewed: timesReviewed,
                times_correct: timesCorrect,
                mastery_score: masteryScore,
                last_reviewed_at: lastReviewedAt.toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single()

        if (error) throw error
        return data as ConceptMastery
    } else {
        // Create new record
        const { data, error } = await supabase
            .from('concept_mastery')
            .insert({
                user_id: user.id,
                document_id: documentId,
                keyword,
                times_reviewed: timesReviewed,
                times_correct: timesCorrect,
                mastery_score: masteryScore,
                last_reviewed_at: lastReviewedAt.toISOString(),
            })
            .select()
            .single()

        if (error) throw error
        return data as ConceptMastery
    }
}

/**
 * Get mastery scores for all concepts in a document
 */
export async function getDocumentMastery(documentId: string): Promise<ConceptMastery[]> {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('concept_mastery')
        .select('*')
        .eq('user_id', user.id)
        .eq('document_id', documentId)
        .order('mastery_score', { ascending: false })

    if (error) throw error
    return data as ConceptMastery[]
}

/**
 * Get overall mastery statistics for a user
 */
export async function getOverallMastery(): Promise<{
    totalConcepts: number
    masteredConcepts: number  // WMS >= 80
    learningConcepts: number  // WMS 40-79
    needsWorkConcepts: number // WMS < 40
    averageMastery: number
}> {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Not authenticated')

    const { data } = await supabase
        .from('concept_mastery')
        .select('mastery_score')
        .eq('user_id', user.id)

    if (!data || data.length === 0) {
        return {
            totalConcepts: 0,
            masteredConcepts: 0,
            learningConcepts: 0,
            needsWorkConcepts: 0,
            averageMastery: 0,
        }
    }

    const scores = data.map(d => d.mastery_score || 0)

    return {
        totalConcepts: scores.length,
        masteredConcepts: scores.filter(s => s >= 80).length,
        learningConcepts: scores.filter(s => s >= 40 && s < 80).length,
        needsWorkConcepts: scores.filter(s => s < 40).length,
        averageMastery: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }
}

