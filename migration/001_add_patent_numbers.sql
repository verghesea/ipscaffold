-- Migration: Add patent number columns to patents table
-- Date: 2026-01-13
-- Description: Adds patent_number and publication_number fields to support patent number display

-- Add columns to patents table
ALTER TABLE patents ADD COLUMN IF NOT EXISTS patent_number TEXT;
ALTER TABLE patents ADD COLUMN IF NOT EXISTS publication_number TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_patents_patent_number ON patents(patent_number);

-- Add comment for documentation
COMMENT ON COLUMN patents.patent_number IS 'Extracted patent number (e.g., US10123456B2)';
COMMENT ON COLUMN patents.publication_number IS 'Publication number if available';
