-- Migration: Add section_images table for AI-generated section images
-- Run this in Supabase Dashboard → SQL Editor

-- Create section_images table
CREATE TABLE IF NOT EXISTS public.section_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES public.artifacts(id) ON DELETE CASCADE,
    section_number INTEGER NOT NULL,
    section_title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    prompt_used TEXT NOT NULL,
    generation_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(artifact_id, section_number)
);

-- Enable Row Level Security
ALTER TABLE public.section_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view images for artifacts they own
CREATE POLICY "Users can view section images for own artifacts"
    ON public.section_images FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.artifacts
            JOIN public.patents ON patents.id = artifacts.patent_id
            WHERE artifacts.id = section_images.artifact_id
            AND (patents.user_id = auth.uid() OR patents.user_id IS NULL)
        )
    );

-- Policy: Service role can insert section images
CREATE POLICY "Service role can insert section images"
    ON public.section_images FOR INSERT
    WITH CHECK (true);

-- Policy: Service role can update section images
CREATE POLICY "Service role can update section images"
    ON public.section_images FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Policy: Service role can delete section images
CREATE POLICY "Service role can delete section images"
    ON public.section_images FOR DELETE
    USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_section_images_artifact_id ON public.section_images(artifact_id);
CREATE INDEX IF NOT EXISTS idx_section_images_artifact_section ON public.section_images(artifact_id, section_number);

-- Add trigger to auto-update updated_at timestamp
DROP TRIGGER IF EXISTS update_section_images_updated_at ON public.section_images;
CREATE TRIGGER update_section_images_updated_at
    BEFORE UPDATE ON public.section_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for section images
INSERT INTO storage.buckets (id, name, public)
VALUES ('section-images', 'section-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Anyone can view images
CREATE POLICY "Anyone can view section images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'section-images');

-- Storage policy: Service role can upload images
CREATE POLICY "Service role can upload section images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'section-images');

-- Storage policy: Service role can update images
CREATE POLICY "Service role can update section images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'section-images')
    WITH CHECK (bucket_id = 'section-images');

-- Storage policy: Service role can delete images
CREATE POLICY "Service role can delete section images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'section-images');
