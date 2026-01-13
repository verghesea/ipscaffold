-- Migration: Add section_images table for DALL-E generated images
-- Date: 2026-01-13
-- Description: Adds section_images table to store DALL-E generated images for artifact section headers

-- Create section_images table
CREATE TABLE IF NOT EXISTS section_images (
  id SERIAL PRIMARY KEY,
  artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  section_heading TEXT NOT NULL,
  section_order INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  dalle_prompt TEXT NOT NULL,
  image_size TEXT DEFAULT '1024x1024',
  generation_cost NUMERIC(10, 4),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_section_images_artifact_id ON section_images(artifact_id);
CREATE INDEX IF NOT EXISTS idx_section_images_section_order ON section_images(artifact_id, section_order);

-- Add comments for documentation
COMMENT ON TABLE section_images IS 'Stores DALL-E generated images for artifact section headers';
COMMENT ON COLUMN section_images.artifact_id IS 'Foreign key to artifacts table';
COMMENT ON COLUMN section_images.section_heading IS 'The ## header text from the markdown (e.g., "Introduction", "WHY")';
COMMENT ON COLUMN section_images.section_order IS 'The order of the section within the artifact (0-indexed)';
COMMENT ON COLUMN section_images.image_url IS 'Public URL to the image in Supabase Storage';
COMMENT ON COLUMN section_images.dalle_prompt IS 'The full prompt used to generate the image';
COMMENT ON COLUMN section_images.image_size IS 'DALL-E image size (e.g., "1024x1024")';
COMMENT ON COLUMN section_images.generation_cost IS 'Cost in USD for generating this image';
