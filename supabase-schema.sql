-- IP Scaffold - Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor

-- Create public.profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    credits INTEGER DEFAULT 30, -- 3 uploads max (10 credits each)
    is_admin BOOLEAN DEFAULT FALSE,
    display_name TEXT, -- User full name (required for complete profile)
    organization TEXT, -- User organization (required for complete profile)
    profile_prompt_skipped_at TIMESTAMP WITH TIME ZONE, -- When user skipped profile completion
    profile_completed_at TIMESTAMP WITH TIME ZONE, -- When profile was completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Patents table (uses UUID)
CREATE TABLE IF NOT EXISTS public.patents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    inventors TEXT,
    assignee TEXT,
    filing_date TEXT,
    issue_date TEXT,
    full_text TEXT NOT NULL,
    pdf_filename TEXT,
    status TEXT DEFAULT 'processing',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.patents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own patents
CREATE POLICY "Users can view own patents"
    ON public.patents FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Anonymous can view patents without user (preview mode)
CREATE POLICY "Anyone can view unclaimed patents"
    ON public.patents FOR SELECT
    USING (user_id IS NULL);

-- Policy: Users can insert their own patents
CREATE POLICY "Users can insert own patents"
    ON public.patents FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Service role can insert patents (for anonymous uploads)
CREATE POLICY "Service role can insert patents"
    ON public.patents FOR INSERT
    WITH CHECK (true);

-- Policy: Users can update their own patents
CREATE POLICY "Users can update own patents"
    ON public.patents FOR UPDATE
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Artifacts table (uses UUID)
CREATE TABLE IF NOT EXISTS public.artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patent_id UUID REFERENCES public.patents(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL,
    content TEXT NOT NULL,
    tokens_used INTEGER,
    generation_time_seconds NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view artifacts for their patents
CREATE POLICY "Users can view artifacts for own patents"
    ON public.artifacts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.patents
            WHERE patents.id = artifacts.patent_id
            AND (patents.user_id = auth.uid() OR patents.user_id IS NULL)
        )
    );

-- Policy: Service role can insert artifacts
CREATE POLICY "Service role can insert artifacts"
    ON public.artifacts FOR INSERT
    WITH CHECK (true);

-- Credit transactions (uses UUID)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    description TEXT,
    patent_id UUID REFERENCES public.patents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view own transactions"
    ON public.credit_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can insert transactions
CREATE POLICY "Service role can insert transactions"
    ON public.credit_transactions FOR INSERT
    WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patents_user_id ON public.patents(user_id);
CREATE INDEX IF NOT EXISTS idx_patents_status ON public.patents(status);
CREATE INDEX IF NOT EXISTS idx_artifacts_patent_id ON public.artifacts(patent_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, credits)
    VALUES (NEW.id, NEW.email, 100);
    
    -- Create signup bonus transaction
    INSERT INTO public.credit_transactions (user_id, amount, balance_after, transaction_type, description)
    VALUES (NEW.id, 100, 100, 'signup_bonus', 'Welcome bonus');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patents_updated_at ON public.patents;
CREATE TRIGGER update_patents_updated_at
    BEFORE UPDATE ON public.patents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
