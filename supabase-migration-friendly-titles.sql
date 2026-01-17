-- Migration: Add friendly_title column to patents table
-- Run this in Supabase Dashboard → SQL Editor

-- Add friendly_title column
ALTER TABLE public.patents
ADD COLUMN IF NOT EXISTS friendly_title TEXT;

-- Create index for searching by friendly title
CREATE INDEX IF NOT EXISTS idx_patents_friendly_title
ON public.patents(friendly_title);

-- Verify migration
SELECT 'Migration completed successfully!' AS status,
       (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'patents' AND column_name = 'friendly_title') AS column_created;
