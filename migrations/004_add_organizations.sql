-- Migration 004: Add Organizations
-- Date: 2026-01-13
-- Description: Adds organizations table and organization_members for multi-tenant support

-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organization_members join table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Add organization_id to patents
ALTER TABLE public.patents
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add current_organization_id to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_organization_id UUID REFERENCES public.organizations(id);

-- Add organization_id to credit_transactions (for org-based credits)
ALTER TABLE public.credit_transactions
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_patents_organization ON public.patents(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_org ON public.credit_transactions(organization_id);

-- Add comments
COMMENT ON TABLE public.organizations IS 'Organizations for multi-tenant access control';
COMMENT ON COLUMN public.organizations.credits IS 'Organization-wide credit balance shared by all members';
COMMENT ON COLUMN public.patents.organization_id IS 'Organization that owns this patent';
COMMENT ON COLUMN public.patents.user_id IS 'User who uploaded this patent (for attribution)';
COMMENT ON COLUMN public.profiles.current_organization_id IS 'Currently selected organization for this user';

-- Add trigger for organizations updated_at
DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
