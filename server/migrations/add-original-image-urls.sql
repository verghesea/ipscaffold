-- Add original_image_url columns to store un-watermarked versions
-- This allows us to keep pristine originals while serving watermarked versions

-- Add to section_images table
ALTER TABLE public.section_images
ADD COLUMN IF NOT EXISTS original_image_url TEXT;

-- Add to patent_hero_images table
ALTER TABLE public.patent_hero_images
ADD COLUMN IF NOT EXISTS original_image_url TEXT;

-- Migration: Copy current image_url to original_image_url for existing images
-- This preserves the current images as "originals" (even though they may not have watermarks yet)
UPDATE public.section_images
SET original_image_url = image_url
WHERE original_image_url IS NULL;

UPDATE public.patent_hero_images
SET original_image_url = image_url
WHERE original_image_url IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.section_images.original_image_url IS 'URL to un-watermarked original image from DALL-E';
COMMENT ON COLUMN public.section_images.image_url IS 'URL to watermarked version for public display';

COMMENT ON COLUMN public.patent_hero_images.original_image_url IS 'URL to un-watermarked original image from DALL-E';
COMMENT ON COLUMN public.patent_hero_images.image_url IS 'URL to watermarked version for public display';
