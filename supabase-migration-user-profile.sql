-- Add user profile fields for personalization
-- Run this in Supabase Dashboard → SQL Editor

-- Add display_name and organization columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS organization TEXT,
ADD COLUMN IF NOT EXISTS profile_prompt_skipped_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP WITH TIME ZONE;

-- Update the schema to reflect both are required (but can be null until filled)
COMMENT ON COLUMN public.profiles.display_name IS 'User full name (required for complete profile)';
COMMENT ON COLUMN public.profiles.organization IS 'User organization/company (required for complete profile)';
COMMENT ON COLUMN public.profiles.profile_prompt_skipped_at IS 'Timestamp when user skipped profile completion (triggers re-prompt after 7 days)';
COMMENT ON COLUMN public.profiles.profile_completed_at IS 'Timestamp when user completed their profile';

-- Create index for querying incomplete profiles
CREATE INDEX IF NOT EXISTS idx_profiles_incomplete
ON public.profiles(profile_completed_at)
WHERE profile_completed_at IS NULL;
