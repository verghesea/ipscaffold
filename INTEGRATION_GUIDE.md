# Integration Guide for DALL-E Images & Export Features

This branch (`feature/dalle-images-and-exports`) contains 5 phases of enhancements to IPScaffold. The code was built using Drizzle ORM patterns, but your production code uses Supabase directly with Zod schemas.

## What Was Built (5 Phases)

### Phase 1: Patent Number Extraction
- Extracts patent numbers from PDFs using regex patterns
- Displays patent numbers in detail page, dashboard, and preview
- **Files**: `server/services/pdfParser.ts`, `client/src/pages/*`

### Phase 2: Consistent Markdown Headers
- Updated Claude prompts to enforce consistent ## headers
- Created section parser service
- **Files**: `server/services/aiGenerator.ts`, `server/services/sectionParser.ts`

### Phase 3: DALL-E Image Generation
- Generates minimalist hand-drawn images for each section header
- Stores images in Supabase Storage
- **Files**: `server/services/dalleGenerator.ts`, `server/supabaseStorage.ts`
- **New API**: `GET /api/patent/:id/images`

### Phase 4: Export Functionality
- Exports patents as PDF, DOCX, TXT with embedded images
- **Files**: `server/services/exportService.ts`
- **New API**: `GET /api/patent/:id/export/:format`

### Phase 5: Enhanced Markdown Rendering
- React-markdown component with professional styling
- **Files**: `client/src/components/MarkdownRenderer.tsx`

## Key Architectural Differences

### ❗ IMPORTANT: Schema Mismatch

**Our Branch Uses**: Drizzle ORM with `pgTable` definitions in `shared/schema.ts`

**Your Production Uses**: Direct Supabase with Zod schemas and interfaces

**What This Means**:
- The `shared/schema.ts` changes need to be adapted to your pattern
- Keep your existing Zod schemas
- Add our new TypeScript interfaces only
- Database migrations are architecture-agnostic (they work either way)

## Files That Need Schema Adaptation

### 1. `shared/schema.ts`
**What we added**:
```typescript
// Drizzle ORM (DON'T USE THIS)
export const patents = pgTable("patents", {
  patentNumber: text("patent_number"),
  publicationNumber: text("publication_number"),
  // ...
});

export const sectionImages = pgTable("section_images", {
  // ... table definition
});
```

**What you should use instead**:
```typescript
// Keep your existing Zod schema pattern
export interface Patent {
  // ... existing fields
  patent_number: string | null;  // ADD THIS
  publication_number: string | null;  // ADD THIS
}

// Add new interface for section images
export interface SectionImage {
  id: string;
  artifact_id: string;
  section_heading: string;
  section_order: number;
  image_url: string;
  dalle_prompt: string;
  image_size: string | null;
  generation_cost: string | null;
  created_at: string;
}
```

### 2. `server/supabaseStorage.ts`
**Our changes**: Added methods like `createSectionImage()`, `getSectionImagesByPatent()`

**Your task**:
- Keep the method signatures we created
- They already use Supabase client patterns
- Just verify they match your code style

### 3. `server/supabaseRoutes.ts`
**Our changes**:
- Modified `generateRemainingArtifacts()` to include image generation
- Added import statements for new services

**Your task**:
- Merge the image generation calls into your existing workflow
- Keep your notification patterns
- Add our new API endpoints

## Integration Strategy for Replit AI

### Step 1: Tell Replit to Compare Branches

```
I have a feature branch called 'feature/dalle-images-and-exports' that adds:
1. Patent number extraction and display
2. DALL-E image generation for artifact sections
3. Export functionality (PDF, DOCX, TXT)
4. Enhanced markdown rendering

The branch was built using Drizzle ORM patterns, but our production code uses
Supabase directly with Zod schemas. Please help me:

1. Review the changes in the branch
2. Adapt the schema changes to use our existing Supabase/Zod pattern
3. Integrate the new services (dalleGenerator.ts, exportService.ts, sectionParser.ts)
4. Merge the API endpoint additions
5. Keep our existing architecture patterns

Start by showing me the schema differences in shared/schema.ts
```

### Step 2: Have Replit Create Adapted Files

Ask Replit to:
1. Create the new service files (they're architecture-agnostic)
2. Adapt the schema.ts changes to your pattern
3. Merge the supabaseStorage.ts additions
4. Integrate the supabaseRoutes.ts changes
5. Add the frontend components

### Step 3: Database Migrations (Safe - No Conflicts)

The SQL migrations are architecture-agnostic and safe to run:

```sql
-- Migration 001: Patent Numbers
ALTER TABLE patents ADD COLUMN IF NOT EXISTS patent_number TEXT;
ALTER TABLE patents ADD COLUMN IF NOT EXISTS publication_number TEXT;
CREATE INDEX IF NOT EXISTS idx_patents_patent_number ON patents(patent_number);

-- Migration 002: Section Images Table
CREATE TABLE IF NOT EXISTS section_images (
  id SERIAL PRIMARY KEY,
  artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  section_heading TEXT NOT NULL,
  section_order INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  dalle_prompt TEXT NOT NULL,
  image_size TEXT DEFAULT '1024x1024',
  generation_cost NUMERIC(10, 4),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_section_images_artifact_id ON section_images(artifact_id);

-- Migration 003: Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('section-images', 'section-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view section images"
ON storage.objects FOR SELECT
USING (bucket_id = 'section-images');

CREATE POLICY "Service role can upload section images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'section-images' AND auth.role() = 'service_role');
```

## New Dependencies to Install

```bash
npm install openai pdfkit docx @types/pdfkit react-markdown remark-gfm
```

## Environment Variables Needed

Add to Replit Secrets:
```
OPENAI_API_KEY=sk-proj-...
```

## Testing After Integration

1. **Patent Numbers**: Upload a patent PDF, verify number displays in dashboard
2. **Images**: Wait for patent completion, check that section images appear
3. **Export**: Click "Export" button, download PDF/DOCX/TXT
4. **Markdown**: Verify artifacts render with proper styling

## Files to Copy Directly (No Conflicts)

These are new files with no conflicts:
- `server/services/dalleGenerator.ts`
- `server/services/exportService.ts`
- `server/services/sectionParser.ts`
- `client/src/components/MarkdownRenderer.tsx`
- `migration/001_add_patent_numbers.sql`
- `migration/002_add_section_images.sql`
- `migration/003_setup_storage_bucket.sql`

## Files That Need Careful Merging

- `shared/schema.ts` - Schema pattern differences
- `server/supabaseStorage.ts` - Add our new methods
- `server/supabaseRoutes.ts` - Merge image generation workflow
- `client/src/pages/PatentDetailPage.tsx` - Add export UI and MarkdownRenderer
- `client/src/pages/DashboardPage.tsx` - Add patent number column
- `client/src/pages/PreviewPage.tsx` - Add patent number display
- `server/services/pdfParser.ts` - Add patent number extraction
- `server/services/aiGenerator.ts` - Updated prompts with formatting requirements

## Cost Impact

- Claude API: ~$0.45 per patent (existing)
- DALL-E images: ~$0.80 per patent (20 sections × $0.04)
- **Total: ~$1.25 per patent**

## Questions for Replit AI

1. "Show me the schema differences between main and feature/dalle-images-and-exports"
2. "How should we adapt the Drizzle ORM definitions to our Supabase/Zod pattern?"
3. "Can you merge the supabaseStorage.ts additions without breaking existing code?"
4. "Show me how to integrate the image generation into our artifact workflow"

## Success Criteria

✅ Patent numbers display correctly
✅ Section images generate and display
✅ Export downloads work (PDF, DOCX, TXT)
✅ No breaking changes to existing features
✅ Images embedded in exports
✅ Markdown renders with proper styling

---

**Branch URL**: https://github.com/verghesea/ipscaffold/tree/feature/dalle-images-and-exports

**Pull Request**: https://github.com/verghesea/ipscaffold/pull/new/feature/dalle-images-and-exports
