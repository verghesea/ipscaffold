-- ============================================================================
-- CONSOLIDATED MIGRATION - Run this in Supabase SQL Editor
-- ============================================================================
-- This migration includes all pending database changes needed for the app
-- to function correctly with hero images, patent metadata, progress tracking,
-- super admin features, and image titles.
--
-- Run this once in your Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. PATENT METADATA (patent numbers, application numbers, classifications)
-- ============================================================================

-- Add patent metadata columns
ALTER TABLE public.patents
ADD COLUMN IF NOT EXISTS patent_number TEXT,
ADD COLUMN IF NOT EXISTS application_number TEXT,
ADD COLUMN IF NOT EXISTS patent_classification TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patents_patent_number
ON public.patents(patent_number);

CREATE INDEX IF NOT EXISTS idx_patents_application_number
ON public.patents(application_number);

COMMENT ON COLUMN public.patents.patent_number IS
'Official patent number (e.g., US10123456B2)';

COMMENT ON COLUMN public.patents.application_number IS
'Patent application number (e.g., 16/123,456)';

COMMENT ON COLUMN public.patents.patent_classification IS
'Patent classification codes (e.g., A61F 2/28)';

-- ============================================================================
-- 2. PATENT HERO IMAGES TABLE
-- ============================================================================

-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS public.patent_hero_images CASCADE;

-- Create patent_hero_images table
CREATE TABLE public.patent_hero_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patent_id UUID NOT NULL REFERENCES public.patents(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    prompt_used TEXT NOT NULL,
    image_title TEXT,
    generation_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT patent_hero_images_unique_patent UNIQUE(patent_id)
);

-- Enable Row Level Security
ALTER TABLE public.patent_hero_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view hero images for patents they own
DROP POLICY IF EXISTS "Users can view hero images for own patents" ON public.patent_hero_images;
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
DROP POLICY IF EXISTS "Service role can manage hero images" ON public.patent_hero_images;
CREATE POLICY "Service role can manage hero images"
    ON public.patent_hero_images FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_patent_hero_images_patent_id
ON public.patent_hero_images(patent_id);

-- Add trigger to auto-update updated_at timestamp (if function exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        -- Drop trigger if it exists
        DROP TRIGGER IF EXISTS update_patent_hero_images_updated_at ON public.patent_hero_images;
        -- Create trigger
        CREATE TRIGGER update_patent_hero_images_updated_at
            BEFORE UPDATE ON public.patent_hero_images
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- 3. SECTION IMAGES - Add image_title column
-- ============================================================================

-- Add image_title column to section_images if it doesn't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'section_images') THEN
        ALTER TABLE public.section_images
        ADD COLUMN IF NOT EXISTS image_title TEXT;

        COMMENT ON COLUMN public.section_images.image_title IS
        'Title/caption for the image, typically from DALL-E revised_prompt';
    END IF;
END $$;

-- ============================================================================
-- 4. PROGRESS TRACKING TABLE
-- ============================================================================

-- Create progress tracking table
CREATE TABLE IF NOT EXISTS public.patent_progress (
    patent_id UUID PRIMARY KEY REFERENCES public.patents(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    current INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    complete BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.patent_progress ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view progress for their own patents
DROP POLICY IF EXISTS "Users can view own patent progress" ON public.patent_progress;
CREATE POLICY "Users can view own patent progress"
    ON public.patent_progress FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.patents
            WHERE patents.id = patent_progress.patent_id
            AND patents.user_id = auth.uid()
        )
    );

-- Policy: Service role can manage progress
DROP POLICY IF EXISTS "Service role can manage progress" ON public.patent_progress;
CREATE POLICY "Service role can manage progress"
    ON public.patent_progress FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 5. SUPER ADMIN ROLE
-- ============================================================================

-- Add super_admin column to profiles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

        -- Create index
        CREATE INDEX IF NOT EXISTS idx_profiles_is_super_admin
        ON public.profiles(is_super_admin);
    END IF;
END $$;

-- Create user management audit log
CREATE TABLE IF NOT EXISTS public.user_management_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE public.user_management_log ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can view logs
DROP POLICY IF EXISTS "Super admins can view logs" ON public.user_management_log;
CREATE POLICY "Super admins can view logs"
    ON public.user_management_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all tables and columns were created
SELECT
    'Migration completed successfully! ✅' AS status,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'patents' AND column_name = 'patent_number') AS patent_metadata_added,
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_name = 'patent_hero_images') AS hero_images_table_created,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'section_images' AND column_name = 'image_title') AS section_image_titles_added,
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_name = 'patent_progress') AS progress_table_created,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'profiles' AND column_name = 'is_super_admin') AS super_admin_added;

-- Show sample of tables created
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('patents', 'patent_hero_images', 'section_images', 'patent_progress', 'profiles', 'user_management_log')
ORDER BY table_name;
