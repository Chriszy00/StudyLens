-- Learning System Tables
-- Flashcards, Study Sessions, and Mastery Tracking

-- Flashcards table (generated from study questions)
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  front TEXT NOT NULL,  -- Question
  back TEXT NOT NULL,   -- Answer
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  
  -- SM-2 Spaced Repetition fields
  ease_factor DECIMAL(4,2) DEFAULT 2.5,  -- Initial ease factor
  interval_days INTEGER DEFAULT 0,        -- Days until next review
  repetitions INTEGER DEFAULT 0,          -- Number of successful reviews
  next_review_date TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study sessions table
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  cards_studied INTEGER DEFAULT 0,
  cards_correct INTEGER DEFAULT 0,
  session_type TEXT DEFAULT 'review' CHECK (session_type IN ('review', 'learn', 'quiz')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Card reviews (individual card attempts)
CREATE TABLE IF NOT EXISTS card_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  quality INTEGER NOT NULL CHECK (quality >= 0 AND quality <= 5),  -- SM-2 quality rating (0-5)
  time_spent_ms INTEGER,  -- Time spent on card in milliseconds
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Concept mastery tracking
CREATE TABLE IF NOT EXISTS concept_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  keyword TEXT NOT NULL,
  
  mastery_score DECIMAL(5,2) DEFAULT 0,  -- 0-100 weighted mastery score
  times_reviewed INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, document_id, keyword)
);

-- Enable RLS
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_mastery ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own flashcards" ON flashcards FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own study sessions" ON study_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own card reviews" ON card_reviews FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own concept mastery" ON concept_mastery FOR ALL USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS flashcards_user_id_idx ON flashcards(user_id);
CREATE INDEX IF NOT EXISTS flashcards_document_id_idx ON flashcards(document_id);
CREATE INDEX IF NOT EXISTS flashcards_next_review_idx ON flashcards(next_review_date);
CREATE INDEX IF NOT EXISTS study_sessions_user_id_idx ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS concept_mastery_user_document_idx ON concept_mastery(user_id, document_id);
