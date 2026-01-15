export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    full_name: string | null
                    avatar_url: string | null
                    summary_length_preference: string
                    auto_save_enabled: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    full_name?: string | null
                    avatar_url?: string | null
                    summary_length_preference?: string
                    auto_save_enabled?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    full_name?: string | null
                    avatar_url?: string | null
                    summary_length_preference?: string
                    auto_save_enabled?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            documents: {
                Row: {
                    id: string
                    user_id: string
                    title: string
                    type: string
                    original_filename: string | null
                    storage_path: string | null
                    original_text: string | null
                    read_time_minutes: number | null
                    tags: string[] | null
                    image_url: string | null
                    is_starred: boolean
                    is_draft: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    title: string
                    type: string
                    original_filename?: string | null
                    storage_path?: string | null
                    original_text?: string | null
                    read_time_minutes?: number | null
                    tags?: string[] | null
                    image_url?: string | null
                    is_starred?: boolean
                    is_draft?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    title?: string
                    type?: string
                    original_filename?: string | null
                    storage_path?: string | null
                    original_text?: string | null
                    read_time_minutes?: number | null
                    tags?: string[] | null
                    image_url?: string | null
                    is_starred?: boolean
                    is_draft?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "documents_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            summaries: {
                Row: {
                    id: string
                    document_id: string
                    short_summary: string | null
                    detailed_summary: string | null
                    bullet_points: string[] | null
                    keywords: string[] | null
                    study_questions: Json | null
                    citations: Json | null  // Array of {claim, sourceQuote, verified, section}
                    compression_ratio: number | null
                    keyword_coverage: number | null  // Now used as citation verification rate
                    processing_status: 'pending' | 'processing' | 'completed' | 'failed'
                    error_message: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    document_id: string
                    short_summary?: string | null
                    detailed_summary?: string | null
                    bullet_points?: string[] | null
                    keywords?: string[] | null
                    study_questions?: Json | null
                    citations?: Json | null
                    compression_ratio?: number | null
                    keyword_coverage?: number | null
                    processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
                    error_message?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    document_id?: string
                    short_summary?: string | null
                    detailed_summary?: string | null
                    bullet_points?: string[] | null
                    keywords?: string[] | null
                    study_questions?: Json | null
                    citations?: Json | null
                    compression_ratio?: number | null
                    keyword_coverage?: number | null
                    processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
                    error_message?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "summaries_document_id_fkey"
                        columns: ["document_id"]
                        isOneToOne: true
                        referencedRelation: "documents"
                        referencedColumns: ["id"]
                    }
                ]
            }
            flashcards: {
                Row: {
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
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    document_id: string
                    front: string
                    back: string
                    difficulty?: 'easy' | 'medium' | 'hard'
                    ease_factor?: number
                    interval_days?: number
                    repetitions?: number
                    next_review_date?: string
                    last_reviewed_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    document_id?: string
                    front?: string
                    back?: string
                    difficulty?: 'easy' | 'medium' | 'hard'
                    ease_factor?: number
                    interval_days?: number
                    repetitions?: number
                    next_review_date?: string
                    last_reviewed_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            study_sessions: {
                Row: {
                    id: string
                    user_id: string
                    document_id: string | null
                    started_at: string
                    ended_at: string | null
                    cards_studied: number
                    cards_correct: number
                    session_type: 'review' | 'learn' | 'quiz'
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    document_id?: string | null
                    started_at?: string
                    ended_at?: string | null
                    cards_studied?: number
                    cards_correct?: number
                    session_type?: 'review' | 'learn' | 'quiz'
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    document_id?: string | null
                    started_at?: string
                    ended_at?: string | null
                    cards_studied?: number
                    cards_correct?: number
                    session_type?: 'review' | 'learn' | 'quiz'
                    created_at?: string
                }
                Relationships: []
            }
            card_reviews: {
                Row: {
                    id: string
                    flashcard_id: string
                    session_id: string | null
                    user_id: string
                    quality: number
                    time_spent_ms: number | null
                    reviewed_at: string
                }
                Insert: {
                    id?: string
                    flashcard_id: string
                    session_id?: string | null
                    user_id: string
                    quality: number
                    time_spent_ms?: number | null
                    reviewed_at?: string
                }
                Update: {
                    id?: string
                    flashcard_id?: string
                    session_id?: string | null
                    user_id?: string
                    quality?: number
                    time_spent_ms?: number | null
                    reviewed_at?: string
                }
                Relationships: []
            }
            concept_mastery: {
                Row: {
                    id: string
                    user_id: string
                    document_id: string
                    keyword: string
                    mastery_score: number
                    times_reviewed: number
                    times_correct: number
                    last_reviewed_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    document_id: string
                    keyword: string
                    mastery_score?: number
                    times_reviewed?: number
                    times_correct?: number
                    last_reviewed_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    document_id?: string
                    keyword?: string
                    mastery_score?: number
                    times_reviewed?: number
                    times_correct?: number
                    last_reviewed_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            app_settings: {
                Row: {
                    id: string
                    summary_enabled: boolean
                    maintenance_mode: boolean
                    maintenance_message: string | null
                    updated_at: string
                    updated_by: string | null
                }
                Insert: {
                    id?: string
                    summary_enabled?: boolean
                    maintenance_mode?: boolean
                    maintenance_message?: string | null
                    updated_at?: string
                    updated_by?: string | null
                }
                Update: {
                    id?: string
                    summary_enabled?: boolean
                    maintenance_mode?: boolean
                    maintenance_message?: string | null
                    updated_at?: string
                    updated_by?: string | null
                }
                Relationships: []
            }
            admin_users: {
                Row: {
                    id: string
                    user_id: string
                    created_at: string
                    created_by: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    created_at?: string
                    created_by?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    created_at?: string
                    created_by?: string | null
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
