# Multi-Organization Support - Implementation Guide

✅ **Status**: Phase 3 Complete (Database + Backend + Frontend) - READY FOR TESTING
🌿 **Branch**: `feature/multi-org-support`
📦 **GitHub**: https://github.com/verghesea/ipscaffold/tree/feature/multi-org-support

---

## What Was Done (All 3 Phases Complete)

I've reviewed your **latest GitHub code** and created complete organization support that matches your actual architecture:

### ✅ Checked Your Current Code Structure:
- Supabase with UUID primary keys ✓
- TypeScript interfaces + Zod schemas (not Drizzle) ✓
- User-level credits in profiles table ✓
- RLS policies for user-based access ✓

### ✅ Created Migration Files:
1. **`migrations/004_add_organizations.sql`** - Creates organizations & organization_members tables
2. **`migrations/005_organization_rls_policies.sql`** - Updates RLS policies for org-based access
3. **`migrations/migrate-to-organizations.js`** - Data migration script for existing users

### ✅ Updated Schema (`shared/schema.ts`):
- Added `Organization` interface
- Added `OrganizationMember` interface
- Updated `Patent` to include `organization_id`
- Updated `User` to include `current_organization_id`
- Updated `CreditTransaction` to include `organization_id`

### ✅ Implemented Backend API (`server/supabaseStorage.ts` & `server/supabaseRoutes.ts`):
- Organization CRUD methods: `getOrganization`, `getUserOrganizations`, `createOrganization`
- Member management: `addOrganizationMember`, `removeOrganizationMember`, `updateOrganizationMemberRole`, `getOrganizationMembers`
- Credit operations: `updateOrganizationCredits`, `getPatentsByOrganization`
- Current org management: `setCurrentOrganization`, `getOrganizationMemberRole`
- API endpoints:
  - `GET /api/organizations` - Get user's organizations
  - `POST /api/organizations` - Create organization
  - `POST /api/organizations/switch` - Switch current org
  - `GET /api/organizations/:id/members` - Get org members
  - `POST /api/organizations/:id/members` - Invite member (admin only)
  - `DELETE /api/organizations/:id/members/:userId` - Remove member
  - `PATCH /api/organizations/:id/members/:userId` - Update member role
  - `PATCH /api/organizations/:id` - Update organization name
- Updated upload handler to use organization credits
- Updated session verification to auto-create personal org
- Updated dashboard to show organization patents
- Updated patent access checks for organization-based access

### ✅ Implemented Frontend UI (Phase 3):
**New Components:**
- `client/src/components/OrganizationSwitcher.tsx` - Dropdown in navbar to switch organizations
- `client/src/components/FirstTimeOrgSetup.tsx` - Onboarding dialog for new users
- `client/src/pages/OrganizationSettingsPage.tsx` - Complete org management interface

**Updated Files:**
- `client/src/lib/api.ts` - Added Organization/OrganizationMember interfaces and all API methods
- `client/src/hooks/useAuth.tsx` - Added currentOrganization to auth context
- `client/src/components/layout/Navbar.tsx` - Integrated org switcher, shows org credits
- `client/src/pages/DashboardPage.tsx` - Shows FirstTimeOrgSetup for users without org
- `client/src/App.tsx` - Added /organization/settings route

**Features:**
- Organization name and credits display in navbar
- Switch between multiple organizations via dropdown
- Invite members by email (requires existing account)
- Remove members with confirmation (protects against removing last admin)
- Update member roles (admin, member, viewer) via dropdown
- Edit organization name (admins only)
- Role-based UI (admins see management, members/viewers see read-only)
- Toast notifications for all actions
- Confirmation dialogs for destructive actions
- First-time user experience with automatic org creation dialog

---

## How It Works

### Organization Model:
- **Organizations** have a shared credit balance
- **Users** can belong to multiple organizations (via `organization_members`)
- **Roles**: admin, member, viewer
- **Patents** belong to organizations (but track which user uploaded)
- **Credits** are at org level (shared by all members)

### Access Control:
- Users can only see patents in their organization(s)
- Org admins can invite/remove members
- RLS policies enforce organization boundaries
- Backwards compatible (anonymous preview mode still works)

---

## Step-by-Step Implementation

### STEP 1: Pull the Latest Code from GitHub

```bash
# In your Replit terminal
git fetch origin
git checkout feature/multi-org-support
git pull origin feature/multi-org-support
```

### STEP 2: Run Database Migrations in Supabase

Go to **Supabase Dashboard** → **SQL Editor** and run these in order:

#### Migration 004: Create Organization Tables

```sql
-- Copy and paste from migrations/004_add_organizations.sql
-- This creates organizations and organization_members tables
```

Click **RUN** ▶️

#### Migration 005: Update RLS Policies

```sql
-- Copy and paste from migrations/005_organization_rls_policies.sql
-- This updates RLS policies for org-based access
```

Click **RUN** ▶️

#### Verify Tables Were Created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('organizations', 'organization_members');
```

You should see both tables listed.

### STEP 3: Migrate Existing Users (Optional - If You Have Existing Users)

If you have existing users, run the data migration script:

```bash
# In Replit terminal
node migrations/migrate-to-organizations.js
```

This script will:
- Create a personal organization for each user
- Transfer user credits to their organization
- Update all their patents to belong to their org
- Set it as their current organization

**If you're starting fresh with no users**, skip this step!

### STEP 4: Test the Complete Implementation

All phases are complete! Test the following:

1. **New User Signup**:
   - Sign up with a new email
   - You should see the "Welcome to IP Scaffold" dialog
   - Create your first organization
   - You should be redirected to dashboard

2. **Organization Switcher**:
   - Click the organization dropdown in navbar
   - See your organization name, credits, and role
   - Click "Organization Settings" to manage

3. **Upload Patent**:
   - Upload a patent PDF
   - Credits should deduct from organization (not user)
   - All org members should see the patent

4. **Member Management** (as Admin):
   - Go to Organization Settings
   - Invite a member by email (they must have an account)
   - Change member roles
   - Remove members
   - Edit organization name

5. **Multi-Organization**:
   - Create a second organization
   - Switch between organizations via dropdown
   - Each org has separate credits and patents

---

---

## Testing After Full Implementation

### Test Checklist:
- [ ] New user signup creates personal organization
- [ ] User can upload patent (deducts from org credits)
- [ ] User can see their org's patents
- [ ] User cannot see other orgs' patents
- [ ] Org admin can invite members
- [ ] Invited member can see org patents
- [ ] Org switcher works (if user in multiple orgs)
- [ ] Credits are shared across org members

---

## Migration Strategy for Production

### Option 1: Gradual Migration (Recommended)
1. Deploy database migrations (004, 005)
2. Run data migration script
3. Deploy backend code with org support
4. Deploy frontend with org UI
5. Test thoroughly
6. Announce feature to users

### Option 2: Feature Flag
1. Add feature flag `ENABLE_ORGANIZATIONS=false`
2. Deploy all code with flag off
3. Test in staging
4. Enable flag when ready
5. Monitor for issues

---

## Cost Impact

**No change to AI costs**, just organizational structure:
- Claude API: ~$0.45 per patent (unchanged)
- Credits now shared at org level instead of user level
- Same 10 credits per patent

---

## Rollback Plan

If something goes wrong:

```sql
-- Revert RLS policies to user-based
DROP POLICY "Users can view patents in their organizations" ON public.patents;
CREATE POLICY "Users can view own patents"
  ON public.patents FOR SELECT
  USING (auth.uid() = user_id);

-- Continue with other policies...
```

---

## Questions to Answer Before Proceeding

1. **Do you want me to implement Phase 2 (Backend API)?**
   - I can add the organization methods to supabaseStorage.ts
   - I can add the API endpoints to supabaseRoutes.ts
   - I can update the upload handler

2. **Do you want me to implement Phase 3 (Frontend UI)?**
   - Create OrganizationSwitcher component
   - Update signup flow
   - Create organization settings page

3. **Or do you want to hand this off to Replit AI?**
   - I can create detailed instructions for Replit
   - The database schema is ready
   - Replit can implement backend + frontend

---

## Current Branch Status

✅ **Pushed to GitHub**: `feature/multi-org-support`
✅ **Database Migrations**: Created and ready to run
✅ **Schema Updates**: Complete
✅ **Data Migration Script**: Ready
✅ **Backend API**: Fully implemented
✅ **Frontend UI**: Fully implemented
🎉 **READY FOR TESTING**: All 3 phases complete!

---

## Next Steps

**Option A: I Continue Building**
Let me know and I'll implement Phase 2 (Backend) and Phase 3 (Frontend).

**Option B: You Test Database First**
1. Run migrations 004 and 005 in Supabase
2. Verify tables exist
3. Run data migration if you have existing users
4. Report back if it works

**Option C: Hand to Replit AI**
I can create a detailed guide for Replit AI to implement Phases 2 & 3.

What would you like to do next? 🚀
