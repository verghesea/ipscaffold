-- Migration 005: Organization-Based RLS Policies
-- Date: 2026-01-13
-- Description: Updates RLS policies to support organization-based access control

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORGANIZATIONS POLICIES
-- ============================================================================

-- Users can view organizations they're members of
CREATE POLICY "Users can view their organizations"
ON public.organizations FOR SELECT
USING (
  id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Only admins can update their organizations
CREATE POLICY "Admins can update organizations"
ON public.organizations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = organizations.id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Users can create organizations (they become admin)
CREATE POLICY "Users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- ORGANIZATION_MEMBERS POLICIES
-- ============================================================================

-- Users can view members of their organizations
CREATE POLICY "Users can view org members"
ON public.organization_members FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Only admins can add members
CREATE POLICY "Admins can add members"
ON public.organization_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = organization_members.organization_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Only admins can remove members
CREATE POLICY "Admins can remove members"
ON public.organization_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role = 'admin'
  )
);

-- Only admins can update member roles
CREATE POLICY "Admins can update member roles"
ON public.organization_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role = 'admin'
  )
);

-- ============================================================================
-- UPDATE PATENTS POLICIES FOR ORGANIZATIONS
-- ============================================================================

-- Drop old user-based policies
DROP POLICY IF EXISTS "Users can view own patents" ON public.patents;
DROP POLICY IF EXISTS "Users can insert own patents" ON public.patents;
DROP POLICY IF EXISTS "Users can update own patents" ON public.patents;

-- New org-based policies (keep anonymous viewing for preview mode)
CREATE POLICY "Users can view patents in their organizations"
ON public.patents FOR SELECT
USING (
  -- Allow if in user's organization
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
  OR
  -- OR if patent has no user (preview mode - keep existing behavior)
  user_id IS NULL
);

CREATE POLICY "Users can create patents in their organizations"
ON public.patents FOR INSERT
WITH CHECK (
  -- Must be a member of the organization
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
  OR
  -- OR anonymous uploads (no user_id, no org_id yet)
  (user_id IS NULL AND organization_id IS NULL)
);

CREATE POLICY "Users can update patents in their organizations"
ON public.patents FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
  OR
  user_id IS NULL
);

-- ============================================================================
-- UPDATE ARTIFACTS POLICIES (inherit from patents org)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view artifacts for own patents" ON public.artifacts;

CREATE POLICY "Users can view artifacts for org patents"
ON public.artifacts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.patents
    WHERE patents.id = artifacts.patent_id
    AND (
      -- In user's organization
      patents.organization_id IN (
        SELECT organization_id
        FROM public.organization_members
        WHERE user_id = auth.uid()
      )
      OR
      -- OR preview mode
      patents.user_id IS NULL
    )
  )
);

-- ============================================================================
-- CREDIT TRANSACTIONS POLICIES
-- ============================================================================

-- Drop old policy if exists
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;

-- Users can view transactions for their organizations
CREATE POLICY "Users can view org transactions"
ON public.credit_transactions FOR SELECT
USING (
  -- User's own transactions (old style)
  user_id = auth.uid()
  OR
  -- Organization transactions they're part of
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Keep service role insert policy
-- (Already exists: "Service role can insert transactions")
