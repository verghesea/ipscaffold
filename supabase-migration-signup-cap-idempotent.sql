-- Signup Cap and Waitlist System (Idempotent Version)
-- Can be run multiple times safely

-- ============================================================
-- 1. APP SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings (only if not exists)
INSERT INTO public.app_settings (key, value, description) VALUES
    ('signup_cap', '50', 'Maximum number of users allowed to sign up'),
    ('signups_enabled', 'true', 'Whether public signups are enabled'),
    ('signup_count', '0', 'Current number of signups (auto-incremented)')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Super admins can view settings" ON public.app_settings;
CREATE POLICY "Super admins can view settings"
    ON public.app_settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

DROP POLICY IF EXISTS "Super admins can update settings" ON public.app_settings;
CREATE POLICY "Super admins can update settings"
    ON public.app_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

DROP POLICY IF EXISTS "Service role can manage settings" ON public.app_settings;
CREATE POLICY "Service role can manage settings"
    ON public.app_settings FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- 2. WAITLIST TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    source TEXT,
    referrer TEXT,
    metadata JSONB,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_approved ON public.waitlist(approved);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist(created_at DESC);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Super admins can view waitlist" ON public.waitlist;
CREATE POLICY "Super admins can view waitlist"
    ON public.waitlist FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

DROP POLICY IF EXISTS "Super admins can update waitlist" ON public.waitlist;
CREATE POLICY "Super admins can update waitlist"
    ON public.waitlist FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

DROP POLICY IF EXISTS "Service role can manage waitlist" ON public.waitlist;
CREATE POLICY "Service role can manage waitlist"
    ON public.waitlist FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- 3. HELPER FUNCTIONS
-- ============================================================

-- Function to get current signup count
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
    SELECT value::INTEGER INTO cap FROM public.app_settings WHERE key = 'signup_cap';
    SELECT value::BOOLEAN INTO enabled FROM public.app_settings WHERE key = 'signups_enabled';
    current_count := get_actual_signup_count();
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_settings_audit_log_key ON public.settings_audit_log(setting_key);
CREATE INDEX IF NOT EXISTS idx_settings_audit_log_changed_at ON public.settings_audit_log(changed_at DESC);

-- Enable RLS
ALTER TABLE public.settings_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view audit log" ON public.settings_audit_log;
CREATE POLICY "Super admins can view audit log"
    ON public.settings_audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_super_admin = TRUE
        )
    );

DROP POLICY IF EXISTS "Service role can manage audit log" ON public.settings_audit_log;
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
-- VERIFICATION QUERIES
-- ============================================================

-- Check if everything was created successfully
DO $$
BEGIN
    RAISE NOTICE 'Migration complete!';
    RAISE NOTICE 'Tables created: app_settings, waitlist, settings_audit_log';
    RAISE NOTICE 'Functions created: get_actual_signup_count(), signups_available()';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Set super admin: UPDATE profiles SET is_super_admin = TRUE WHERE email = ''your@email.com'';';
    RAISE NOTICE '2. Visit /admin → Signup Cap tab to verify';
END $$;
