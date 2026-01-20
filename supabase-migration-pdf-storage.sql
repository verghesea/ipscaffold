-- Add PDF storage path column to patents table
-- This allows us to store PDFs in Supabase Storage instead of local uploads/

ALTER TABLE public.patents
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

COMMENT ON COLUMN public.patents.pdf_storage_path IS 'Path to PDF file in Supabase Storage (e.g., user_id/filename.pdf)';

-- Create storage bucket for patent PDFs (run this in Supabase Dashboard > Storage)
-- Bucket name: patent-pdfs
-- Public: false (require authentication)
-- File size limit: 10MB
-- Allowed MIME types: application/pdf

-- Note: You need to manually create the storage bucket in Supabase Dashboard:
-- 1. Go to Storage section
-- 2. Click "New Bucket"
-- 3. Name: patent-pdfs
-- 4. Public: OFF (unchecked)
-- 5. Click "Create bucket"
--
-- Then set up the storage policies:

-- Policy 1: Allow authenticated users to upload their own PDFs
-- CREATE POLICY "Users can upload their own PDFs"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'patent-pdfs' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );

-- Policy 2: Allow users to read their own PDFs
-- CREATE POLICY "Users can read their own PDFs"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (
--   bucket_id = 'patent-pdfs' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );

-- Policy 3: Allow admins to read all PDFs
-- CREATE POLICY "Admins can read all PDFs"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (
--   bucket_id = 'patent-pdfs' AND
--   EXISTS (
--     SELECT 1 FROM public.profiles
--     WHERE profiles.id = auth.uid()
--     AND profiles.is_admin = true
--   )
-- );

-- Policy 4: Allow service role (backend) full access
-- This is automatically granted, no policy needed
