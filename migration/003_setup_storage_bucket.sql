-- Migration: Setup Supabase Storage bucket for section images
-- Date: 2026-01-13
-- Description: Creates storage bucket and RLS policies for DALL-E generated section images
-- NOTE: This should be run in Supabase SQL Editor with appropriate permissions

-- Create storage bucket for section images
INSERT INTO storage.buckets (id, name, public)
VALUES ('section-images', 'section-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Allow public read access to section images
CREATE POLICY "Public can view section images"
ON storage.objects FOR SELECT
USING (bucket_id = 'section-images');

-- RLS Policy: Service role can upload section images
CREATE POLICY "Service role can upload section images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'section-images' AND auth.role() = 'service_role');

-- RLS Policy: Service role can update section images
CREATE POLICY "Service role can update section images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'section-images' AND auth.role() = 'service_role');

-- RLS Policy: Service role can delete section images
CREATE POLICY "Service role can delete section images"
ON storage.objects FOR DELETE
USING (bucket_id = 'section-images' AND auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON SCHEMA storage IS 'Supabase Storage schema for file uploads';
