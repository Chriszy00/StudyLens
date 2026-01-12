/**
 * Barrel export for all custom hooks
 * 
 * This allows consumers to import from a single location:
 * import { useDocuments, useFlashcards } from '@/hooks'
 */

// Document hooks
export {
    useDocuments,
    useDocument,
    useCreateDocument,
    useUpdateDocument,
    useDeleteDocument,
    useToggleStar,
    documentKeys,
} from './useDocuments'

// Summary/AI hooks
export {
    useSummary,
    useProcessDocument,
    summaryKeys,
} from './useSummary'

// Flashcard/Study hooks
export {
    useFlashcards,
    useGenerateFlashcards,
    useRecordReview,
    useStartSession,
    useEndSession,
    flashcardKeys,
    sessionKeys,
} from './useFlashcards'
