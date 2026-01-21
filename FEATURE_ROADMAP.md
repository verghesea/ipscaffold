# IP Scaffold Feature Roadmap

## Executive Summary

This document provides a comprehensive feature roadmap for IP Scaffold, prioritizing code stability while planning for strategic enhancements. Based on architectural analysis of the current codebase and careful evaluation of all feature requests, I recommend a **three-phase approach** that progressively builds capabilities while maintaining system stability.

**Key Recommendation:** The system is currently stable with a working PDF parsing pipeline. Before adding major new features, complete the "polish" features from the existing plan that have minimal risk. Then introduce foundational features that unlock future capabilities. Finally, add value-add features that expand the product's reach.

**Total Features Analyzed:** 12 features across existing plan and new requests
**Estimated Total Effort:** 70-100 hours
**Recommended Timeline:** 4-6 weeks in three phases

---

## Current System Architecture

### Technology Stack
- **Frontend:** React 19, Vite 7, TailwindCSS 4, Radix UI, Wouter
- **Backend:** Express.js, TypeScript, Node.js
- **Database:** Supabase (PostgreSQL with RLS)
- **AI Services:** Claude (Anthropic), DALL-E 3 (OpenAI)
- **PDF Processing:** pdf-parse, pdfjs-dist, Claude API fallback

### Core Data Model
```
profiles (user accounts, credits, admin flags)
    |
    +-- patents (uploaded patent documents)
            |
            +-- artifacts (elia15, business_narrative, golden_circle)
            |
            +-- patent_hero_images (per-patent main image)
            |
            +-- section_images (per-section illustrations)
```

### Current Migrations Applied
The following migrations exist in the codebase:
- `supabase-migration-consolidated.sql` - Core schema + metadata + hero images + progress + super admin
- `supabase-migration-extraction-learning.sql` - Pattern learning for PDF extraction
- `supabase-migration-pdf-storage.sql` - PDF file storage
- `supabase-migration-section-images.sql` - Section image tables

---

## Complete Feature Inventory

### A. Existing Plan Features (from plan file)

| # | Feature | Est. Hours | Status |
|---|---------|------------|--------|
| A1 | Fix friendly titles on dashboard | 1-2h | Documented |
| A2 | Rename ELIA15 to Scientific Narrative (frontend) | 1-2h | Documented |
| A3 | Add custom image titles from DALL-E | 3-4h | Documented |
| A4 | Super admin role & user management | 6-8h | Documented |
| A5 | Extend sessions to 24 hours | 2-3h | Documented |
| A6 | Staggered image generation with progress | 8-10h | Documented |
| A7 | Multi-PDF upload support | 6-8h | Documented |

### B. New Feature Requests

| # | Feature | Est. Hours | Status |
|---|---------|------------|--------|
| B1 | Personalized welcome message | 2-3h | New |
| B2 | PDF export of artifacts | 8-12h | New |
| B3 | Image watermarking (Humble logo) | 3-4h | New |
| B4 | Patent collections | 12-16h | New |
| B5 | Embeddable widgets | 10-14h | New |

---

## Feature Categorization

### Category 1: Stability/Polish
*Bug fixes and UX improvements with no new architecture*

| Feature | Risk | Database Changes | New Dependencies |
|---------|------|-----------------|------------------|
| A1: Fix friendly titles | Very Low | None | None |
| A2: ELIA15 rename | Very Low | None | None |
| A5: Extend sessions | Low | None | None |
| B1: Welcome message | Low | 2 columns to profiles | None |

### Category 2: Foundational
*Required for other features or adds new core capabilities*

| Feature | Risk | Database Changes | New Dependencies |
|---------|------|-----------------|------------------|
| A4: Super admin role | Medium | 2 tables, 1 column | None |
| A6: Staggered image gen | Medium | Already exists (patent_progress) | None |
| B3: Image watermarking | Low | None | Sharp (already common) |

### Category 3: Value-Add
*High user value but not blocking other features*

| Feature | Risk | Database Changes | New Dependencies |
|---------|------|-----------------|------------------|
| A3: Custom image titles | Low | 1 column (exists) | None |
| A7: Multi-PDF upload | Low | None | None |
| B2: PDF export | Medium | None | pdfkit (already installed) |

### Category 4: Nice-to-Have (Future)
*Platform expansion features requiring significant architecture*

| Feature | Risk | Database Changes | New Dependencies |
|---------|------|-----------------|------------------|
| B4: Patent collections | High | 2-3 new tables | None |
| B5: Embeddable widgets | High | 2-3 new tables + API changes | None |

---

## Detailed Architectural Analysis

### A1: Fix Friendly Titles on Dashboard
**Category:** Stability/Polish | **Effort:** 1-2 hours | **Risk:** Very Low

**Current State:**
- `friendly_title` column exists on patents table
- Grid view correctly uses it (line 352 in DashboardPage.tsx)
- Table view does NOT use it (line 394)
- Dashboard API endpoint omits `friendly_title` from response

**Changes Required:**
1. `/server/supabaseRoutes.ts` - Add `friendlyTitle` to dashboard patent response
2. `/client/src/pages/DashboardPage.tsx` - Use `friendlyTitle || title` in table view

**Architectural Impact:**
- Database: None
- Dependencies: None
- Breaking Changes: None
- Performance: None
- Security: None

**Recommendation:** DO FIRST - Zero risk, immediate user value

---

### A2: Rename ELIA15 to Scientific Narrative
**Category:** Stability/Polish | **Effort:** 1-2 hours | **Risk:** Very Low

**Current State:**
- Backend uses 'elia15' as artifact_type (should remain unchanged)
- Frontend displays "ELIA15" in multiple locations

**Changes Required:**
Frontend-only changes in 5 files:
1. `/client/src/pages/PatentDetailPage.tsx` - Label in artifact metadata
2. `/client/src/pages/DashboardPage.tsx` - Status badge text
3. `/client/src/pages/LandingPage.tsx` - Feature card title
4. `/client/src/components/patent/SystemPromptManager.tsx` - Tab label
5. `/client/src/components/upload/UploadArea.tsx` - Progress message

**Architectural Impact:**
- Database: None (artifact_type remains 'elia15')
- Dependencies: None
- Breaking Changes: None
- Performance: None
- Security: None

**Recommendation:** DO FIRST - Pure cosmetic change, zero risk

---

### A3: Custom Image Titles from DALL-E
**Category:** Value-Add | **Effort:** 3-4 hours | **Risk:** Low

**Current State:**
- DALL-E returns `revised_prompt` in response (currently ignored)
- `image_title` column already exists on both `section_images` and `patent_hero_images` tables
- Migration applied: `supabase-migration-image-titles.sql`

**Changes Required:**
1. `/server/services/imageGenerator.ts` - Capture and store `revised_prompt`
2. `/server/services/patentHeroImageService.ts` - Same
3. `/server/supabaseStorage.ts` - Include `image_title` in responses
4. Frontend components - Display image title as caption

**Architectural Impact:**
- Database: Column already exists
- Dependencies: None
- Breaking Changes: None (additive only)
- Performance: None
- Security: None

**Recommendation:** Phase 1 - Low risk, enhances visual storytelling

---

### A4: Super Admin Role & User Management
**Category:** Foundational | **Effort:** 6-8 hours | **Risk:** Medium

**Current State:**
- `is_admin` boolean exists on profiles
- No `is_super_admin` distinction
- No ability to create/delete users via UI
- Migration exists: `supabase-migration-super-admin.sql`

**Changes Required:**
1. Database migration (already written)
2. `/server/supabaseRoutes.ts` - New middleware + endpoints
3. `/server/supabaseStorage.ts` - New methods for user management
4. `/client/src/pages/AdminPage.tsx` - Create/delete user UI

**Architectural Impact:**
- Database: 1 new column, 1 new table (audit log)
- Dependencies: None
- Breaking Changes: None (additive permission layer)
- Performance: None
- Security: **IMPORTANT** - Must properly restrict super admin actions

**Security Considerations:**
- Super admin actions must be logged to audit table
- Prevent self-deletion
- Prevent removal of last super admin
- Use Supabase Admin API (not client SDK) for user creation/deletion

**Recommendation:** Phase 2 - Important for operations, but not urgent

---

### A5: Extend Sessions to 24 Hours
**Category:** Stability/Polish | **Effort:** 2-3 hours | **Risk:** Low

**Current State:**
- Using Supabase default JWT expiration (~1 hour)
- No refresh token logic implemented
- Users frequently need to re-login

**Changes Required:**
1. Supabase Dashboard - Set JWT expiry to 86400 seconds
2. `/server/supabaseRoutes.ts` - Add refresh endpoint
3. `/client/src/hooks/useAuth.tsx` - Add session monitoring + auto-refresh
4. `/client/src/lib/api.ts` - Token refresh utilities

**Architectural Impact:**
- Database: None
- Dependencies: None
- Breaking Changes: None
- Performance: Slight increase in backend calls for refresh
- Security: **IMPORTANT** - Refresh tokens must be properly validated

**Security Considerations:**
- Store refresh tokens securely
- Implement refresh token rotation
- Add session warning before expiry

**Recommendation:** Phase 1 - Major UX improvement with low risk

---

### A6: Staggered Image Generation with Progress
**Category:** Foundational | **Effort:** 8-10 hours | **Risk:** Medium

**Current State:**
- Scientific Narrative generates synchronously
- Business + Golden Circle generate in parallel (background)
- Hero image generates after artifacts (background)
- Section images are ON-DEMAND (user clicks button)
- Progress tracking table exists: `patent_progress`
- Basic progress service exists: `/server/services/progressService.ts`

**Changes Required:**
1. Refactor `/server/supabaseRoutes.ts` - New orchestrator function
2. Implement SSE endpoint for real-time progress
3. Auto-generate section images (instead of on-demand)
4. New frontend component: `GenerationProgress.tsx`
5. Update PreviewPage and PatentDetailPage

**Architectural Impact:**
- Database: Table already exists
- Dependencies: None (SSE is native)
- Breaking Changes: **YES** - Changes image generation flow
- Performance: **IMPORTANT** - More API calls, rate limiting needed
- Security: SSE endpoint must verify patent ownership

**Risk Mitigation:**
- Add feature flag to enable gradually
- Monitor DALL-E rate limits carefully
- Add 3-second delays between image generations

**Recommendation:** Phase 2 - High value but complex, needs careful rollout

---

### A7: Multi-PDF Upload Support
**Category:** Value-Add | **Effort:** 6-8 hours | **Risk:** Low

**Current State:**
- Single file upload only
- Backend already supports sequential processing
- Frontend has single-file dropzone

**Changes Required:**
1. `/client/src/components/upload/UploadArea.tsx` - Major refactor
   - Accept multiple files
   - Show queue with individual progress
   - Handle errors per file
2. `/client/src/pages/DashboardPage.tsx` - Update sidebar upload
3. No backend changes required

**Architectural Impact:**
- Database: None
- Dependencies: None
- Breaking Changes: None (frontend only)
- Performance: Sequential uploads (not parallel to avoid overload)
- Security: Same validation per file

**Recommendation:** Phase 2 - Good UX feature, low risk

---

### B1: Personalized Welcome Message
**Category:** Stability/Polish | **Effort:** 2-3 hours | **Risk:** Low

**Current State:**
- `profiles` table has `email` but no `first_name` or `organization`
- Header shows generic greeting or email

**Changes Required:**
1. Database migration - Add `first_name`, `organization` to profiles
2. `/server/supabaseStorage.ts` - Update Profile interface
3. `/client/src/components/layout/Navbar.tsx` - Display personalized greeting
4. Settings page (optional) - Allow users to update their info

**Proposed Display Logic:**
```
Priority 1: "Welcome [FirstName] @ [Organization]"
Priority 2: "Welcome [FirstName]"
Priority 3: "Welcome [email username]"
Priority 4: "Welcome"
```

**Architectural Impact:**
- Database: 2 new columns (nullable)
- Dependencies: None
- Breaking Changes: None
- Performance: None
- Security: None (display only)

**Migration SQL:**
```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS organization TEXT;
```

**Recommendation:** Phase 1 - Quick win for brand personalization

---

### B2: PDF Export of Artifacts
**Category:** Value-Add | **Effort:** 8-12 hours | **Risk:** Medium

**Current State:**
- pdfkit already installed (used for other PDF operations)
- Artifacts stored as markdown text
- Images stored in Supabase storage

**Changes Required:**
1. New service: `/server/services/pdfExportService.ts`
2. New API endpoints for PDF generation
3. Frontend download buttons
4. Template design with Humble branding

**Export Options:**
- Individual artifact PDFs (Scientific Narrative, Business Narrative, Golden Circle)
- Combined "Patent Package" PDF with all artifacts + images
- Custom cover page with Humble logo

**Architectural Impact:**
- Database: None
- Dependencies: pdfkit (already installed)
- Breaking Changes: None
- Performance: PDF generation is CPU-intensive (consider async)
- Security: Verify patent ownership before export

**Technical Considerations:**
- Markdown to PDF conversion (pdfkit doesn't natively support markdown)
- Image embedding (need to fetch from Supabase storage)
- Styling consistency with web view
- Memory management for large PDFs

**Recommendation:** Phase 3 - Valuable but significant effort, defer until core stable

---

### B3: Image Watermarking
**Category:** Foundational | **Effort:** 3-4 hours | **Risk:** Low

**Current State:**
- Images generated by DALL-E and stored in Supabase storage
- No watermarking currently

**Changes Required:**
1. Add Sharp library (if not present)
2. New service: `/server/services/watermarkService.ts`
3. Modify image upload flow in `imageGenerator.ts` and `patentHeroImageService.ts`
4. Store Humble logo in `/attached_assets/` or similar

**Watermark Specifications:**
- Position: Bottom-right corner
- Opacity: 60-80%
- Size: ~10-15% of image width
- Logo: Humble Ventures logo (PNG with transparency)

**Architectural Impact:**
- Database: None
- Dependencies: Sharp (common image processing library, ~50KB)
- Breaking Changes: None (existing images unchanged)
- Performance: Minimal (~50-100ms per image)
- Security: None

**Implementation Notes:**
```typescript
// Example watermark application
import sharp from 'sharp';

async function addWatermark(imageBuffer: Buffer, logoPath: string): Promise<Buffer> {
  const logo = await sharp(logoPath)
    .resize({ width: Math.floor(imageWidth * 0.12) })
    .toBuffer();

  return sharp(imageBuffer)
    .composite([{
      input: logo,
      gravity: 'southeast',
      blend: 'over',
    }])
    .toBuffer();
}
```

**Recommendation:** Phase 2 - Important for branding, low risk

---

### B4: Patent Collections
**Category:** Nice-to-Have | **Effort:** 12-16 hours | **Risk:** High

**Current State:**
- Patents are flat list per user
- No grouping or organization capability

**Changes Required:**
1. Database migration - New tables:
   - `collections` (id, user_id, name, description, visibility, cover_image, created_at)
   - `collection_patents` (collection_id, patent_id, position, added_at)
2. New API endpoints for collection CRUD
3. New frontend pages: CollectionsPage, CollectionDetailPage
4. Drag-and-drop UI for organization
5. Visibility controls (private/unlisted/public)

**Architectural Impact:**
- Database: 2 new tables + RLS policies
- Dependencies: @dnd-kit/core or react-beautiful-dnd for drag-and-drop
- Breaking Changes: None
- Performance: Additional queries for collection membership
- Security: **IMPORTANT** - Visibility controls must be enforced at RLS level

**RLS Considerations:**
```sql
-- Private: Only owner can view
-- Unlisted: Anyone with link can view
-- Public: Listed in public gallery
```

**Recommendation:** Phase 3 or Future - Significant scope, not core functionality

---

### B5: Embeddable Widgets
**Category:** Nice-to-Have | **Effort:** 10-14 hours | **Risk:** High

**Current State:**
- No embed capability
- No public API or widget system

**Requires:** B4 (Collections) to be completed first

**Changes Required:**
1. Database migration:
   - `embed_configs` (collection_id, custom_logo, colors, analytics_enabled)
   - `embed_analytics` (embed_id, event_type, timestamp, metadata)
2. New public-facing embed routes (no auth required)
3. Iframe-compatible widget component
4. Embed code generator UI
5. Analytics dashboard

**Architectural Impact:**
- Database: 2 new tables
- Dependencies: None
- Breaking Changes: None
- Performance: **IMPORTANT** - Public endpoints, potential for abuse
- Security: **CRITICAL** - Rate limiting, CORS configuration, sanitization

**Security Considerations:**
- Rate limit embed endpoints
- Validate embed domain against whitelist
- Sanitize all embed configurations
- Track abuse patterns

**Recommendation:** Future - Dependency on collections, significant security surface

---

## Recommended Implementation Phases

### Phase 1: Stability & Polish (Week 1)
*Goal: Quick wins that improve UX without adding complexity*

| Order | Feature | Hours | Risk | Value |
|-------|---------|-------|------|-------|
| 1 | A1: Fix friendly titles | 1-2h | Very Low | High |
| 2 | A2: ELIA15 rename | 1-2h | Very Low | Medium |
| 3 | A5: Extend sessions | 2-3h | Low | High |
| 4 | B1: Welcome message | 2-3h | Low | Medium |
| 5 | A3: Image titles | 3-4h | Low | Medium |

**Total:** 9-14 hours
**Database Changes:** 2 columns (first_name, organization)
**New Dependencies:** None

**Stability Gate Before Phase 2:**
- [ ] All dashboard views display friendly titles correctly
- [ ] "Scientific Narrative" label appears in all UI locations
- [ ] Users stay logged in for 24 hours
- [ ] Welcome message displays correctly with fallbacks
- [ ] Image titles appear under generated images
- [ ] Run full manual QA pass on core patent upload flow
- [ ] Verify no regressions in PDF parsing

---

### Phase 2: Foundational Features (Weeks 2-3)
*Goal: Add capabilities that unlock future features or improve operations*

| Order | Feature | Hours | Risk | Value |
|-------|---------|-------|------|-------|
| 1 | A4: Super admin role | 6-8h | Medium | High |
| 2 | B3: Watermarking | 3-4h | Low | Medium |
| 3 | A7: Multi-PDF upload | 6-8h | Low | High |
| 4 | A6: Staggered image gen | 8-10h | Medium | High |

**Total:** 23-30 hours
**Database Changes:** 1 table (user_management_log), 1 column (is_super_admin)
**New Dependencies:** Sharp (image processing)

**Stability Gate Before Phase 3:**
- [ ] Super admin can create/delete users
- [ ] Super admin can toggle admin status
- [ ] User management audit log captures all actions
- [ ] All new images have Humble watermark
- [ ] Multiple PDFs can be uploaded at once
- [ ] Progress tracking shows real-time status
- [ ] Section images auto-generate after artifacts
- [ ] No DALL-E rate limit errors
- [ ] Run full manual QA pass
- [ ] Monitor error rates for 1 week

---

### Phase 3: Value-Add Features (Weeks 4-6)
*Goal: Expand product capabilities based on stable foundation*

| Order | Feature | Hours | Risk | Value |
|-------|---------|-------|------|-------|
| 1 | B2: PDF export | 8-12h | Medium | High |
| 2 | B4: Collections | 12-16h | High | Medium |
| 3 | B5: Embeddable widgets | 10-14h | High | Medium |

**Total:** 30-42 hours
**Database Changes:** 4+ new tables
**New Dependencies:** Potentially drag-and-drop library

**Note:** B4 and B5 should be considered optional for v1.0. Evaluate based on user feedback from Phase 2.

---

## Risk Assessment Matrix

| Feature | Technical Risk | Business Risk | Mitigation |
|---------|---------------|---------------|------------|
| A1: Friendly titles | Very Low | Low | Simple fix, test visually |
| A2: ELIA15 rename | Very Low | Low | String replacement only |
| A3: Image titles | Low | Low | Additive, no breaking changes |
| A4: Super admin | Medium | Medium | Audit logging, careful RLS |
| A5: Sessions | Low | Low | Standard Supabase pattern |
| A6: Image progress | Medium | Medium | Feature flag, rate limiting |
| A7: Multi-upload | Low | Low | Frontend only, sequential |
| B1: Welcome | Low | Low | Graceful fallbacks |
| B2: PDF export | Medium | Low | Async generation, memory limits |
| B3: Watermarking | Low | Low | Simple image processing |
| B4: Collections | High | Medium | Complex RLS, new UI patterns |
| B5: Widgets | High | High | Security surface, public API |

---

## Specific Recommendations

### Features to Do NOW (Pre-1.0 Release)

1. **A1: Fix friendly titles** - Zero risk, obvious bug fix
2. **A2: ELIA15 rename** - Pure cosmetic, requested by user
3. **A5: Extend sessions** - Major UX pain point
4. **B1: Welcome message** - Quick branding win

### Features to Do Post-Stability (v1.1)

1. **A4: Super admin role** - Important for scaling operations
2. **B3: Watermarking** - Brand protection
3. **A7: Multi-PDF upload** - Power user feature
4. **A6: Staggered image gen** - Improved UX but complex

### Features to Reconsider or Descope

1. **B4: Collections** - Consider descoping for v1.0
   - Alternative: Simple "favorites" or "tags" as MVP
   - Full collections can come in v2.0

2. **B5: Embeddable widgets** - Defer entirely
   - Depends on collections
   - Significant security surface
   - Low urgency for initial launch

### Features That Need More Definition

1. **B2: PDF export** - Need to clarify:
   - What exact format/styling is expected?
   - Should images be embedded or linked?
   - What goes on the cover page?

---

## Testing Strategy Between Phases

### Phase 1 Completion Checklist
```
[ ] Dashboard: Friendly titles display in both grid and table views
[ ] Dashboard: Status badges show "Scientific Narrative" not "ELIA15"
[ ] Upload: Progress shows "Generating Scientific Narrative..."
[ ] Patent Detail: Tab shows "Scientific Narrative"
[ ] Landing: Feature card shows "Scientific Narrative"
[ ] Auth: User stays logged in for 24 hours without re-login
[ ] Header: Welcome message shows name/org when available
[ ] Header: Graceful fallback to email when name not set
[ ] Images: Titles display under hero and section images
[ ] Full regression: Upload new patent end-to-end
[ ] Full regression: View existing patents
[ ] Full regression: Admin functions still work
```

### Phase 2 Completion Checklist
```
[ ] Super Admin: Can access user management UI
[ ] Super Admin: Can create new user with email
[ ] Super Admin: Can set initial credits
[ ] Super Admin: Can toggle admin status
[ ] Super Admin: Can delete user (not self)
[ ] Super Admin: Audit log captures all actions
[ ] Regular Admin: CANNOT access super admin functions
[ ] Watermark: New images have Humble logo
[ ] Watermark: Correct position (bottom-right)
[ ] Watermark: Correct opacity (60-80%)
[ ] Multi-upload: Can select multiple PDFs
[ ] Multi-upload: Each file shows individual status
[ ] Multi-upload: Errors per file don't stop others
[ ] Progress: SSE endpoint streams updates
[ ] Progress: UI shows stage + percentage
[ ] Progress: Auto-generates all section images
[ ] Progress: Rate limiting prevents DALL-E errors
[ ] Full regression: Single upload still works
[ ] Full regression: On-demand image regen still works
```

### Phase 3 Completion Checklist
```
[ ] PDF Export: Individual artifact PDFs generate
[ ] PDF Export: Combined package PDF generates
[ ] PDF Export: Images embedded correctly
[ ] PDF Export: Branding consistent
[ ] Collections: Can create collection
[ ] Collections: Can add/remove patents
[ ] Collections: Drag-and-drop reorder works
[ ] Collections: Visibility controls work
[ ] Collections: Private not accessible to others
[ ] Collections: Unlisted accessible via link
[ ] Widgets: Embed code generated
[ ] Widgets: Renders in iframe
[ ] Widgets: Custom branding applies
[ ] Widgets: Analytics tracking works
[ ] Full regression: All Phase 1 + 2 features
```

---

## Migration Dependency Order

For safe database changes, run migrations in this order:

```sql
-- Phase 1 (single migration)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS organization TEXT;

-- Phase 2 (consolidated migration already exists)
-- Run: supabase-migration-consolidated.sql (if not already run)
-- This includes: super_admin, user_management_log, etc.

-- Phase 3 (new migrations needed)
-- 1. collections_migration.sql
-- 2. embed_system_migration.sql
```

---

## Estimated Timeline

### Conservative Estimate (with buffer)

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1 | 1 week | Week 1 |
| Stability testing | 3 days | Week 1.5 |
| Phase 2 | 2 weeks | Week 3.5 |
| Stability testing | 1 week | Week 4.5 |
| Phase 3 (partial) | 2 weeks | Week 6.5 |

### Aggressive Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1 | 3 days | Day 3 |
| Phase 2 | 1 week | Day 10 |
| Phase 3 (partial) | 1.5 weeks | Day 20 |

**My Recommendation:** Use conservative estimate. The user explicitly values stability over speed.

---

## Final Prioritized Feature List

### Must-Have for v1.0
1. A1: Fix friendly titles
2. A2: ELIA15 rename
3. A5: Extend sessions to 24h
4. B1: Personalized welcome message

### Should-Have for v1.0
5. A3: Custom image titles
6. A4: Super admin role
7. B3: Image watermarking

### Could-Have for v1.0
8. A7: Multi-PDF upload
9. A6: Staggered image generation

### Defer to v1.1+
10. B2: PDF export of artifacts
11. B4: Patent collections
12. B5: Embeddable widgets

---

## Appendix: Database Schema Changes Summary

### New Columns (profiles)
```sql
first_name TEXT
organization TEXT
is_super_admin BOOLEAN DEFAULT FALSE  -- from existing migration
```

### New Tables
```sql
user_management_log  -- from existing migration
collections          -- Phase 3
collection_patents   -- Phase 3
embed_configs        -- Future
embed_analytics      -- Future
```

### Existing Tables Modified
```sql
section_images.image_title  -- from existing migration
patent_hero_images.image_title  -- from existing migration
```

---

*Document prepared: January 2026*
*Based on codebase analysis and feature request review*
*For Humble Ventures - IP Scaffold project*
