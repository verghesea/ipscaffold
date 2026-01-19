-- Migration: Add Super Admin Role and User Management
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. Add super_admin column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_super_admin
ON public.profiles(is_super_admin);

-- 2. Create user management audit log
CREATE TABLE IF NOT EXISTS public.user_management_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'create_user', 'delete_user', 'toggle_admin', etc.
    target_user_id UUID REFERENCES auth.users(id),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE public.user_management_log ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can view audit logs
CREATE POLICY "Super admins can view user management logs"
    ON public.user_management_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

-- Policy: Super admins can insert logs (for service role)
CREATE POLICY "Super admins can insert logs"
    ON public.user_management_log FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

-- Optional: Promote first admin to super admin
-- Uncomment and replace email to promote specific user
-- UPDATE public.profiles
-- SET is_super_admin = TRUE
-- WHERE email = 'your-email@example.com' AND is_admin = TRUE;

-- Add comment
COMMENT ON COLUMN public.profiles.is_super_admin IS
'Super admin flag - allows user creation, deletion, and admin management';

COMMENT ON TABLE public.user_management_log IS
'Audit log for user management actions by super admins';
