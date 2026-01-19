-- Migration: Add image_title columns for DALL-E revised prompts
-- Run this in Supabase Dashboard -> SQL Editor

-- Add image_title column to section_images
ALTER TABLE public.section_images
ADD COLUMN IF NOT EXISTS image_title TEXT;

-- Add image_title to patent_hero_images
ALTER TABLE public.patent_hero_images
ADD COLUMN IF NOT EXISTS image_title TEXT;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.section_images.image_title IS
'Title/caption from DALL-E revised_prompt showing what was actually generated';

COMMENT ON COLUMN public.patent_hero_images.image_title IS
'Title/caption from DALL-E revised_prompt showing what was actually generated';

-- Optional: Backfill with prompts for existing images
-- Uncomment if you want to populate titles for existing images
-- UPDATE public.section_images
-- SET image_title = prompt_used
-- WHERE image_title IS NULL;

-- UPDATE public.patent_hero_images
-- SET image_title = prompt_used
-- WHERE image_title IS NULL;
