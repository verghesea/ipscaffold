# Multi-User Organizations Feature Specification

## Overview
Enable multiple users to work together within shared organizations, pooling credits and collaborating on patent analyses.

---

## Core Features

### 1. Organization Management
- **Create Organization** - User can create a new organization and become the owner
- **Organization Profile** - View and edit organization name, view credit balance
- **Delete Organization** - Owner can delete organization (requires confirmation)
- **Leave Organization** - Members can leave organizations they belong to

### 2. Team Membership
- **Invite Team Members** - Send email invitations to join organization
- **Accept Invitation** - Users can accept invite via email link to join organization
- **Remove Members** - Admins can remove members from organization
- **View Team List** - See all organization members with their roles and join dates
- **Member Roles** - Three role levels:
  - **Owner** - Full control (can delete org, manage billing, assign admins)
  - **Admin** - Can invite/remove members, manage settings
  - **Member** - Can view shared patents, use org credits

### 3. Shared Credits
- **Organization Credit Pool** - Credits belong to organization, not individual users
- **Shared Usage** - Any member can use organization credits for patent analysis
- **Credit History** - View all credit transactions across organization
- **Purchase Credits for Org** - Owner/admin can buy credits for the organization

### 4. Shared Patent Access
- **Organization-Wide Patents** - All patents uploaded by any member are visible to entire organization
- **Collaborative Analysis** - Team members can view/comment on patents uploaded by others
- **Patent History** - See who uploaded each patent and when
- **Patent Dashboard** - Filter patents by uploader, date, status

### 5. Organization Switching (Multi-Org Support)
- **Organization Selector** - Dropdown to switch between organizations
- **Personal Account** - Option to work in personal account vs organization context
- **Context Indicator** - Always show which org you're currently working in
- **Separate Credit Pools** - Each organization has independent credits

---

## User Flows

### Creating an Organization
1. User clicks "Create Organization" from settings
2. Enters organization name
3. Optionally buys initial credits
4. Becomes organization owner
5. Can invite team members immediately

### Joining an Organization
1. Receive email invitation from organization admin
2. Click "Accept Invitation" link in email
3. If not signed up, create account first
4. Automatically join organization as member
5. Organization appears in org switcher

### Using Organization Credits
1. User switches to organization context
2. Uploads patent for analysis
3. Credits deducted from organization pool (not personal credits)
4. Patent visible to all organization members
5. Credit transaction recorded with user who initiated it

### Managing Team
1. Owner/admin goes to "Team" page in org settings
2. Views list of all members with roles
3. Can send new invitations via email
4. Can change member roles (promote to admin, demote to member)
5. Can remove members (except cannot remove owner)

---

## Business Rules

### Credits
- Organization credits are separate from personal user credits
- When working in org context, only org credits are used
- Personal credits cannot be transferred to organizations
- Org credits cannot be transferred to personal accounts
- Credit purchases specify which account (personal vs org)

### Patents
- Patents uploaded in org context belong to organization
- Patents uploaded in personal context belong to user only
- Cannot transfer patents between personal/org accounts
- Deleted organization = all org patents become inaccessible

### Roles & Permissions
- **Owner** (one per org):
  - Cannot be removed
  - Can delete organization
  - Can transfer ownership
  - All admin permissions

- **Admin** (multiple allowed):
  - Invite/remove members
  - Change member roles (except owner)
  - Manage org settings
  - Purchase credits

- **Member** (multiple allowed):
  - View all org patents
  - Upload patents using org credits
  - View team list (read-only)

### Membership
- User can belong to multiple organizations
- User always has personal account available
- Must explicitly switch context to work in org
- Invitations expire after 7 days
- Removed members lose access immediately

---

## Database Schema

### `organizations` Table (EXISTS)
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### `organization_members` Table (EXISTS)
```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);
```

### Required Schema Changes
- Add `profiles.organization_id UUID REFERENCES organizations(id)` (replace text `organization` field)
- Add `patents.organization_id UUID REFERENCES organizations(id)` (nullable for personal patents)
- Create RLS policies for organization-based access
- Add indexes on foreign keys

---

## UI Components Needed

### New Pages
- `/organizations` - List of user's organizations
- `/organizations/new` - Create organization
- `/organizations/:id/settings` - Organization settings
- `/organizations/:id/team` - Team management
- `/invites/:token` - Accept invitation page

### New Components
- **OrganizationSwitcher** - Dropdown in navbar showing current context
- **OrganizationCard** - Card showing org name, member count, credits
- **TeamMemberList** - Table of members with roles and actions
- **InviteMemberModal** - Form to send email invitations
- **OrganizationBadge** - Visual indicator when in org context
- **SharedPatentIndicator** - Shows which org member uploaded patent

### Modified Components
- **Dashboard** - Filter patents by org context
- **CreditBalance** - Show org credits when in org context
- **UploadArea** - Indicate which account will be charged
- **PatentCard** - Show uploader name for org patents

---

## Backend API Endpoints

### Organizations
```
POST   /api/organizations                     - Create organization
GET    /api/organizations                     - List user's organizations
GET    /api/organizations/:id                 - Get organization details
PATCH  /api/organizations/:id                 - Update organization
DELETE /api/organizations/:id                 - Delete organization
```

### Members
```
GET    /api/organizations/:id/members         - List organization members
POST   /api/organizations/:id/members/invite  - Send invitation
DELETE /api/organizations/:id/members/:userId - Remove member
PATCH  /api/organizations/:id/members/:userId - Update member role
```

### Invitations
```
POST   /api/invites                           - Create invite token
GET    /api/invites/:token                    - Get invite details
POST   /api/invites/:token/accept             - Accept invitation
DELETE /api/invites/:token                    - Revoke invitation
```

### Credits
```
GET    /api/organizations/:id/credits         - Get credit balance
POST   /api/organizations/:id/credits         - Add credits (purchase)
GET    /api/organizations/:id/transactions    - Get credit history
```

---

## Data Migration Required

### Step 1: Migrate Existing Organization Names
```sql
-- For each unique organization name in profiles.organization:
-- 1. Create organization record
-- 2. Set user as owner
-- 3. Give organization 0 credits (users keep personal credits)
-- 4. Link user profile to organization
```

### Step 2: Update Profiles
```sql
ALTER TABLE profiles
ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Migrate data from text to foreign key
-- After migration, drop old text column:
ALTER TABLE profiles DROP COLUMN organization;
```

### Step 3: Update Patents
```sql
ALTER TABLE patents
ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Keep existing patents as personal (organization_id = NULL)
```

### Step 4: RLS Policies
```sql
-- Allow users to view organizations they're members of
-- Allow users to view patents from their organizations
-- Allow org admins to manage members
```

---

## Technical Requirements

### Backend
- **Invite token generation** - Secure random tokens with expiration
- **Email service integration** - Send invitation emails
- **Credit pooling logic** - Deduct from org credits when in org context
- **Role-based permission checks** - Verify user permissions on all org endpoints
- **Organization context middleware** - Determine which org user is working in

### Frontend
- **Context state management** - Track which org is currently active
- **Real-time updates** - Refresh team list when members change
- **Loading states** - Show loading for all org operations
- **Error handling** - Handle permission denied errors gracefully
- **Organization switcher UX** - Easy switching between personal/org contexts

### Database
- **RLS policies** - Secure organization and member data
- **Cascade deletes** - Clean up members when org deleted
- **Indexes** - Performance for org queries
- **Constraints** - Enforce one owner per org, role validation

---

## Future Enhancements (Out of Scope)

- **Billing Integration** - Org-level subscriptions and payment methods
- **Usage Analytics** - Dashboard showing per-member usage stats
- **Custom Roles** - Define custom roles beyond owner/admin/member
- **Patent Folders** - Organize shared patents into folders
- **Activity Feed** - Stream of team activity (uploads, invites, etc.)
- **SSO Integration** - Enterprise single sign-on
- **API Keys** - Organization-level API access
- **Webhooks** - Notifications for org events
- **Patent Comments** - Team collaboration on specific patents
- **Audit Logs** - Detailed history of all org actions

---

## Estimated Effort

**Total: 12-15 hours**

| Component | Effort |
|-----------|--------|
| Backend API (storage methods + routes) | 5-6 hours |
| Frontend UI (pages + components) | 4-5 hours |
| Data migration scripts | 2-3 hours |
| Testing & polish | 2-3 hours |

---

## Launch Decision

### Status: DEFERRED POST-ALPHA

**Current State:**
- ✅ Database tables exist in Supabase
- ❌ No backend code implementation
- ❌ No frontend UI
- ❌ No API endpoints

**Recommendation for Alpha:** Defer this feature.

**Rationale:**
- Complex feature that adds significant scope
- Most alpha users will be individuals, not teams
- Can validate demand before building
- Simpler architecture = faster iteration
- Current text-based organization field sufficient for personalization

**When to Build:**
- After 3+ users explicitly request team features
- When targeting enterprise customers
- Post-alpha with stable individual user experience
- When monetization strategy includes team plans

**Current Workaround:**
- Users can enter organization name as text
- Displayed in profile and dashboard
- No functional impact on usage
- Sufficient for personalization and filtering

---

## Implementation Checklist

When ready to implement:

### Phase 1: Backend Foundation
- [ ] Add organization methods to supabaseStorage.ts
- [ ] Create organization API endpoints in supabaseRoutes.ts
- [ ] Implement invite token system
- [ ] Add RLS policies for organizations
- [ ] Add RLS policies for organization_members
- [ ] Create data migration scripts
- [ ] Test API endpoints with Postman/curl

### Phase 2: Frontend Core
- [ ] Create OrganizationSwitcher component
- [ ] Create organization list page
- [ ] Create organization settings page
- [ ] Create team management page
- [ ] Add organization context to state management
- [ ] Update credit display to show org credits
- [ ] Test org switching flow

### Phase 3: Invitations
- [ ] Create InviteMemberModal component
- [ ] Create invite acceptance page
- [ ] Integrate email service
- [ ] Create invite email templates
- [ ] Test invitation flow end-to-end

### Phase 4: Shared Patents
- [ ] Update patent queries for org context
- [ ] Update patent upload to use org credits
- [ ] Add "uploaded by" indicator
- [ ] Update dashboard filtering
- [ ] Test patent visibility across members

### Phase 5: Migration & Polish
- [ ] Run data migration on production
- [ ] Test all user flows
- [ ] Add loading states and error handling
- [ ] Write user documentation
- [ ] Announce feature to users

---

## Notes

- Database tables already exist in production Supabase
- No code currently references these tables
- Feature is fully architected, awaiting implementation
- Can be built incrementally in phases
- Consider A/B testing with subset of users before full rollout
