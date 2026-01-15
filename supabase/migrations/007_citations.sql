-- Migration: Add citations column to summaries table
-- This stores AI attribution/source references for grounding

-- Add citations column to store source references
ALTER TABLE summaries 
ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN summaries.citations IS 'Array of citation objects: {claim, sourceQuote, verified, section}';

-- Update keyword_coverage column comment (now used for citation verification rate)
COMMENT ON COLUMN summaries.keyword_coverage IS 'Citation verification rate: percentage of AI claims that were verified in source document';

-- Create index for querying citations (optional, for future features)
-- CREATE INDEX IF NOT EXISTS idx_summaries_citations ON summaries USING gin(citations);
