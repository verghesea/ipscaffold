-- Migration: Add patent_hero_images table for dashboard thumbnails
-- Run this in Supabase Dashboard → SQL Editor

-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS public.patent_hero_images CASCADE;

-- Create patent_hero_images table
CREATE TABLE public.patent_hero_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patent_id UUID NOT NULL REFERENCES public.patents(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    prompt_used TEXT NOT NULL,
    generation_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT patent_hero_images_unique_patent UNIQUE(patent_id)
);

-- Enable Row Level Security
ALTER TABLE public.patent_hero_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view hero images for patents they own
CREATE POLICY "Users can view hero images for own patents"
    ON public.patent_hero_images FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.patents
            WHERE patents.id = patent_hero_images.patent_id
            AND (patents.user_id = auth.uid() OR patents.user_id IS NULL)
        )
    );

-- Policy: Service role can manage hero images
CREATE POLICY "Service role can manage hero images"
    ON public.patent_hero_images FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_patent_hero_images_patent_id
ON public.patent_hero_images(patent_id);

-- Add trigger to auto-update updated_at timestamp
CREATE TRIGGER update_patent_hero_images_updated_at
    BEFORE UPDATE ON public.patent_hero_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify table was created
SELECT 'Migration completed successfully!' AS status,
       (SELECT COUNT(*) FROM information_schema.tables
        WHERE table_name = 'patent_hero_images') AS table_created;
