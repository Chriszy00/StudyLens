-- Summaries table for storing AI-generated content
-- Run this in the Supabase SQL Editor

-- Create the summaries table
CREATE TABLE IF NOT EXISTS summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  short_summary TEXT,
  detailed_summary TEXT,
  bullet_points TEXT[],
  keywords TEXT[],
  study_questions JSONB DEFAULT '[]',
  compression_ratio DECIMAL(5,2),
  keyword_coverage DECIMAL(5,2),
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (users can access summaries of their own documents)
CREATE POLICY "Users can view summaries of own documents" 
  ON summaries FOR SELECT 
  USING (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert summaries for own documents" 
  ON summaries FOR INSERT 
  WITH CHECK (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update summaries of own documents" 
  ON summaries FOR UPDATE 
  USING (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS summaries_document_id_idx ON summaries(document_id);

-- Create updated_at trigger
CREATE TRIGGER update_summaries_updated_at
  BEFORE UPDATE ON summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
