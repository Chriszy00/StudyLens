-- Storage bucket setup for documents
-- Run this in the Supabase SQL Editor

-- Create storage bucket for documents (if not exists via dashboard)
-- Note: Bucket creation is typically done via Supabase Dashboard
-- Go to: Storage -> New Bucket -> Name: "documents" -> Make it private

-- Storage policies for the 'documents' bucket
-- These allow users to upload/read/delete their own files

-- Policy: Users can upload files to their own folder
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own files
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
