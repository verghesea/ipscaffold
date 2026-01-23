-- Signup Cap and Waitlist System
-- Purpose: Protect budget by limiting free signups during alpha launch

-- ============================================================
-- 1. APP SETTINGS TABLE (Global Configuration)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO public.app_settings (key, value, description) VALUES
    ('signup_cap', '50', 'Maximum number of users allowed to sign up'),
    ('signups_enabled', 'true', 'Whether public signups are enabled'),
    ('signup_count', '0', 'Current number of signups (auto-incremented)')
ON CONFLICT (key) DO NOTHING;

-- RLS Policies for app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can read/write settings
CREATE POLICY "Super admins can view settings"
    ON public.app_settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

CREATE POLICY "Super admins can update settings"
    ON public.app_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

-- Service role can read/write (for backend)
CREATE POLICY "Service role can manage settings"
    ON public.app_settings FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- 2. WAITLIST TABLE (For users when cap is reached)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    source TEXT, -- Where they came from (e.g., 'landing_page', 'alpha_full_page')
    referrer TEXT, -- HTTP referrer
    metadata JSONB, -- Additional context (browser, location, etc.)
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_approved ON public.waitlist(approved);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist(created_at DESC);

-- RLS Policies for waitlist
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Super admins can view waitlist
CREATE POLICY "Super admins can view waitlist"
    ON public.waitlist FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

-- Super admins can update waitlist (approve users)
CREATE POLICY "Super admins can update waitlist"
    ON public.waitlist FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

-- Service role can manage waitlist
CREATE POLICY "Service role can manage waitlist"
    ON public.waitlist FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- 3. HELPER FUNCTIONS
-- ============================================================

-- Function to get current signup count from profiles table
CREATE OR REPLACE FUNCTION get_actual_signup_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM public.profiles WHERE created_at > NOW() - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if signups are available
CREATE OR REPLACE FUNCTION signups_available()
RETURNS BOOLEAN AS $$
DECLARE
    cap INTEGER;
    enabled BOOLEAN;
    current_count INTEGER;
BEGIN
    -- Get settings
    SELECT value::INTEGER INTO cap FROM public.app_settings WHERE key = 'signup_cap';
    SELECT value::BOOLEAN INTO enabled FROM public.app_settings WHERE key = 'signups_enabled';

    -- Get actual count
    current_count := get_actual_signup_count();

    -- Check if signups are enabled and under cap
    RETURN enabled AND (current_count < cap);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. AUDIT LOG FOR SETTINGS CHANGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_settings_audit_log_key ON public.settings_audit_log(setting_key);
CREATE INDEX IF NOT EXISTS idx_settings_audit_log_changed_at ON public.settings_audit_log(changed_at DESC);

-- RLS for audit log
ALTER TABLE public.settings_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view audit log"
    ON public.settings_audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

CREATE POLICY "Service role can manage audit log"
    ON public.settings_audit_log FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- 5. TRIGGER TO LOG SETTINGS CHANGES
-- ============================================================
CREATE OR REPLACE FUNCTION log_settings_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.settings_audit_log (setting_key, old_value, new_value, changed_by, notes)
    VALUES (NEW.key, OLD.value, NEW.value, NEW.updated_by, 'Setting updated');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS settings_change_trigger ON public.app_settings;
CREATE TRIGGER settings_change_trigger
    AFTER UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION log_settings_change();

-- ============================================================
-- NOTES
-- ============================================================
-- After running this migration:
-- 1. Super admin needs to be manually set: UPDATE profiles SET is_super_admin = TRUE WHERE email = 'your-email@example.com';
-- 2. Default signup cap is 50 users
-- 3. Signups are enabled by default
-- 4. Use signups_available() function in backend to check before creating accounts
