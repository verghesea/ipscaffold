# Implementation Roadmap: Image Generation & Hybrid Design

**Status:** Ready to implement
**Design:** Future Lab layout + 4-color pen accents
**Images:** Simple 4-color pen sketches via DALL-E 3
**Estimated Effort:** 15-20 hours

---

## Overview

Implement AI-generated section images for patent artifacts with hybrid design system.

**Key Components:**
1. Database schema for section images
2. DALL-E 3 API integration
3. Section parsing from markdown
4. Image generation service
5. Frontend design system update
6. Image display components

---

## Phase 1: Database & Schema (2-3 hours)

### 1.1 Add section_images Table

**File:** `server/db/schema.sql` (or migration)

```sql
CREATE TABLE section_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  section_title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  prompt_used TEXT NOT NULL,
  generation_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(artifact_id, section_number)
);

CREATE INDEX idx_section_images_artifact ON section_images(artifact_id);
```

### 1.2 Update TypeScript Types

**File:** `shared/schema.ts`

```typescript
export interface SectionImage {
  id: string;
  artifactId: string;
  sectionNumber: number;
  sectionTitle: string;
  imageUrl: string;
  promptUsed: string;
  generationMetadata?: {
    model: string;
    size: string;
    quality: string;
    revisedPrompt?: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

### 1.3 Supabase Storage Bucket

Create storage bucket for images:
- Bucket name: `section-images`
- Public access: Yes (for viewing)
- File size limit: 5MB
- Allowed types: image/png, image/jpeg

---

## Phase 2: Backend Services (5-7 hours)

### 2.1 Install OpenAI SDK

**File:** `server/package.json`

```bash
npm install openai
```

### 2.2 Environment Variables

**File:** `server/.env`

```bash
OPENAI_API_KEY=sk-...
```

### 2.3 DALL-E Service

**File:** `server/services/imageGenerator.ts`

```typescript
import OpenAI from 'openai';
import { DALLE_PROMPTS } from './dallePrompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ImageGenerationRequest {
  artifactType: 'elia15' | 'business_narrative' | 'golden_circle';
  sectionNumber: number;
  sectionTitle: string;
}

export interface ImageGenerationResult {
  imageUrl: string;
  promptUsed: string;
  revisedPrompt?: string;
}

export async function generateSectionImage(
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const prompt = DALLE_PROMPTS[request.artifactType][request.sectionNumber];

  if (!prompt) {
    throw new Error(`No prompt found for ${request.artifactType} section ${request.sectionNumber}`);
  }

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    size: '1792x1024', // 16:9 HD
    quality: 'hd',
    n: 1,
  });

  return {
    imageUrl: response.data[0].url!,
    promptUsed: prompt,
    revisedPrompt: response.data[0].revised_prompt,
  };
}
```

### 2.4 DALL-E Prompts Configuration

**File:** `server/services/dallePrompts.ts`

```typescript
export const DALLE_PROMPTS = {
  elia15: {
    1: `Simple hand-drawn sketch showing cable problem transforming to wireless solution, quick diagram with blue and black pens, left side has tangled curved lines representing cables, right side has simple circular coils with radiating lines, arrow drawn with red pen between them, loose sketchy style, minimal detail, like quick working notes, graph paper background visible, 16:9 aspect ratio`,

    2: `Simple pen sketch of two coils with magnetic field lines between them, quick diagram drawn with blue and black pens, transmitter coil on left (spiral circle), receiver coil on right (spiral circle), curved lines connecting them drawn with green pen showing energy flow, loose sketchy linework, minimal detail, working notes style, graph paper background faintly visible, 16:9 aspect ratio`,

    3: `Quick hand-drawn exploded view sketch showing coil layers separated vertically, simple diagram with blue and black pens, 3-4 circular/rectangular shapes stacked with space between, dashed lines connecting them drawn with red pen, small arrows showing assembly, loose sketchy style, very simple and minimal, like quick working sketch, graph paper background visible, 16:9 aspect ratio`,

    4: `Simple before-and-after comparison sketch, quick diagram with colored pens, left side labeled "OLD" shows messy scribbled lines in black, right side labeled "NEW" shows clean simple coil circle in blue with green radiating lines, red arrow pointing from left to right, very simple loose sketch, minimal detail, working notes style, graph paper background, 16:9 aspect ratio`,

    5: `Simple network sketch showing center hub with connections to surrounding nodes, quick diagram with blue and green pens, central circle (transmitter) with straight lines radiating out to 5-6 smaller circles (devices), drawn with loose sketchy lines, minimal detail, like quick working diagram, small icons or simple shapes for devices, graph paper background visible, 16:9 aspect ratio`,
  },

  business_narrative: {
    1: `Simple sketch showing infrastructure problem, quick diagram with red and black pens, geometric shapes with X marks and broken lines, disconnected boxes with gaps between them, rough sketchy style, minimal detail, working notes aesthetic, shows barriers or breaks simply, graph paper background visible, 16:9 aspect ratio`,

    2: `Simple pen sketch of solution concept, clean diagram with blue and green pens, central coil circle with organized radiating field lines, neat but still hand-drawn, minimal detail, shows elegance through simplicity, working sketch style, graph paper background, 16:9 aspect ratio`,

    3: `Simple growth diagram, quick sketch with blue and green pens, concentric circles expanding outward from center, drawn freehand with loose lines, minimal detail, shows expansion simply, working notes style, graph paper background visible, 16:9 aspect ratio`,
  },

  golden_circle: {
    1: `Simple sketch of core purpose concept, quick diagram with blue and green pens, central circle with radiating lines spreading outward, drawn with loose freehand circles, minimal detail, shows core with expanding influence simply, working notes aesthetic, graph paper background, 16:9 aspect ratio`,

    2: `Simple process sketch showing connected elements, quick diagram with blue and black pens, 3-4 circles or boxes connected by arrows, shows flow simply, loose sketchy linework, minimal detail, working notes style, graph paper background visible, 16:9 aspect ratio`,

    3: `Simple product sketch, quick diagram with blue and black pens, basic geometric shape representing device, minimal detail, clean simple lines but still hand-drawn, shows what it is simply, working notes aesthetic, graph paper background, 16:9 aspect ratio`,
  },
} as const;
```

### 2.5 Section Parser

**File:** `server/services/sectionParser.ts`

```typescript
export interface ParsedSection {
  number: number;
  title: string;
  content: string;
  level: number;
}

/**
 * Parses markdown content into sections based on ## headers
 */
export function parseMarkdownSections(markdown: string): ParsedSection[] {
  const lines = markdown.split('\n');
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  let sectionNumber = 0;

  for (const line of lines) {
    // Check for ## header (level 2)
    const headerMatch = line.match(/^##\s+(.+)$/);

    if (headerMatch) {
      // Save previous section if exists
      if (currentSection) {
        sections.push(currentSection);
      }

      // Start new section
      sectionNumber++;
      currentSection = {
        number: sectionNumber,
        title: headerMatch[1].trim(),
        content: '',
        level: 2,
      };
    } else if (currentSection) {
      // Add line to current section content
      currentSection.content += line + '\n';
    }
  }

  // Don't forget the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}
```

### 2.6 Image Storage Service

**File:** `server/services/imageStorage.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Service key for admin access
);

export async function uploadImageFromUrl(
  imageUrl: string,
  artifactId: string,
  sectionNumber: number
): Promise<string> {
  // Download image from DALL-E URL
  const response = await fetch(imageUrl);
  const buffer = await response.buffer();

  // Upload to Supabase Storage
  const fileName = `${artifactId}/section-${sectionNumber}.png`;
  const { data, error } = await supabase.storage
    .from('section-images')
    .upload(fileName, buffer, {
      contentType: 'image/png',
      upsert: true, // Overwrite if exists
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('section-images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
```

### 2.7 Main Image Generation Service

**File:** `server/services/artifactImageService.ts`

```typescript
import { supabase } from '../db/supabase';
import { generateSectionImage } from './imageGenerator';
import { uploadImageFromUrl } from './imageStorage';
import { parseMarkdownSections } from './sectionParser';
import { SectionImage } from '../../shared/schema';

export interface GenerateImagesRequest {
  artifactId: string;
  artifactType: 'elia15' | 'business_narrative' | 'golden_circle';
  markdownContent: string;
}

export interface GenerateImagesResult {
  success: boolean;
  imagesGenerated: number;
  sectionImages: SectionImage[];
  errors?: string[];
}

/**
 * Generates images for all sections in an artifact
 */
export async function generateArtifactImages(
  request: GenerateImagesRequest
): Promise<GenerateImagesResult> {
  const sections = parseMarkdownSections(request.markdownContent);
  const sectionImages: SectionImage[] = [];
  const errors: string[] = [];

  for (const section of sections) {
    try {
      // Generate image via DALL-E
      const imageResult = await generateSectionImage({
        artifactType: request.artifactType,
        sectionNumber: section.number,
        sectionTitle: section.title,
      });

      // Upload to Supabase Storage
      const storedImageUrl = await uploadImageFromUrl(
        imageResult.imageUrl,
        request.artifactId,
        section.number
      );

      // Save to database
      const { data, error } = await supabase
        .from('section_images')
        .upsert({
          artifact_id: request.artifactId,
          section_number: section.number,
          section_title: section.title,
          image_url: storedImageUrl,
          prompt_used: imageResult.promptUsed,
          generation_metadata: {
            model: 'dall-e-3',
            size: '1792x1024',
            quality: 'hd',
            revisedPrompt: imageResult.revisedPrompt,
          },
        })
        .select()
        .single();

      if (error) {
        errors.push(`Section ${section.number}: ${error.message}`);
      } else {
        sectionImages.push(data as SectionImage);
      }
    } catch (error) {
      errors.push(`Section ${section.number}: ${(error as Error).message}`);
    }
  }

  return {
    success: errors.length === 0,
    imagesGenerated: sectionImages.length,
    sectionImages,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

### 2.8 API Endpoints

**File:** `server/routes/images.ts`

```typescript
import { Router } from 'express';
import { generateArtifactImages } from '../services/artifactImageService';
import { supabase } from '../db/supabase';

const router = Router();

/**
 * POST /api/images/generate/:artifactId
 * Generate images for all sections in an artifact
 */
router.post('/generate/:artifactId', async (req, res) => {
  try {
    const { artifactId } = req.params;

    // Get artifact details
    const { data: artifact, error } = await supabase
      .from('artifacts')
      .select('type, content')
      .eq('id', artifactId)
      .single();

    if (error || !artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Generate images
    const result = await generateArtifactImages({
      artifactId,
      artifactType: artifact.type,
      markdownContent: artifact.content,
    });

    res.json(result);
  } catch (error) {
    console.error('Error generating images:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/images/:artifactId
 * Get all images for an artifact
 */
router.get('/:artifactId', async (req, res) => {
  try {
    const { artifactId } = req.params;

    const { data, error } = await supabase
      .from('section_images')
      .select('*')
      .eq('artifact_id', artifactId)
      .order('section_number');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/images/:imageId
 * Delete a specific section image
 */
router.delete('/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;

    const { error } = await supabase
      .from('section_images')
      .delete()
      .eq('id', imageId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
```

**File:** `server/index.ts` (add route)

```typescript
import imageRoutes from './routes/images';

// ... existing code ...

app.use('/api/images', imageRoutes);
```

---

## Phase 3: Frontend Design System (3-4 hours)

### 3.1 Add 4-Color Pen Design Tokens

**File:** `client/src/styles/design-tokens.css` (or Tailwind config)

```css
:root {
  /* 4-Color Pen Palette */
  --pen-black: #1f2937;
  --pen-blue: #2563eb;
  --pen-red: #dc2626;
  --pen-green: #059669;

  /* Grid System */
  --grid-size: 10px;
  --major-grid: 50px;
  --grid-light: rgba(0, 0, 0, 0.04);
  --grid-medium: rgba(0, 0, 0, 0.08);
}
```

**File:** `tailwind.config.js`

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        pen: {
          black: '#1f2937',
          blue: '#2563eb',
          red: '#dc2626',
          green: '#059669',
        },
      },
      backgroundImage: {
        'grid-paper': `
          linear-gradient(to right, var(--grid-light) 1px, transparent 1px),
          linear-gradient(to bottom, var(--grid-light) 1px, transparent 1px),
          linear-gradient(to right, var(--grid-medium) 1px, transparent 1px),
          linear-gradient(to bottom, var(--grid-medium) 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        'grid-paper': 'var(--grid-size) var(--grid-size), var(--grid-size) var(--grid-size), var(--major-grid) var(--major-grid), var(--major-grid) var(--major-grid)',
      },
    },
  },
};
```

### 3.2 Section Image Component

**File:** `client/src/components/SectionImage.tsx`

```typescript
import React from 'react';
import { SectionImage as SectionImageType } from '../../../shared/schema';

interface SectionImageProps {
  image: SectionImageType;
  className?: string;
}

export const SectionImage: React.FC<SectionImageProps> = ({ image, className = '' }) => {
  return (
    <div className={`section-image-wrapper ${className}`}>
      {/* Image container with corner marks */}
      <div className="relative border-2 border-pen-blue p-2 bg-white">
        {/* Corner marks */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-pen-blue" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-pen-blue" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-pen-blue" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-pen-blue" />

        {/* Actual image */}
        <img
          src={image.imageUrl}
          alt={image.sectionTitle}
          className="w-full aspect-video object-cover border border-gray-200"
          loading="lazy"
        />
      </div>

      {/* Caption */}
      <div className="mt-2 text-xs font-mono text-pen-blue">
        Fig {image.sectionNumber} — {image.sectionTitle}
      </div>
    </div>
  );
};
```

### 3.3 Update PatentDetailPage

**File:** `client/src/pages/PatentDetailPage.tsx`

Key changes:
1. Fetch section images along with artifact data
2. Pass images to MarkdownRenderer
3. Apply hybrid design styling

```typescript
import { SectionImage } from '../../../shared/schema';
import { SectionImage as SectionImageComponent } from '../components/SectionImage';

// Add to component state
const [sectionImages, setSectionImages] = useState<SectionImage[]>([]);

// Fetch images when artifact loads
useEffect(() => {
  if (currentArtifact?.id) {
    fetch(`/api/images/${currentArtifact.id}`)
      .then(res => res.json())
      .then(data => setSectionImages(data))
      .catch(err => console.error('Failed to fetch images:', err));
  }
}, [currentArtifact?.id]);

// Update container styling with graph paper background
<div className="relative bg-white shadow-lg">
  {/* Graph paper background */}
  <div className="absolute inset-0 bg-grid-paper opacity-50 pointer-events-none" />

  {/* Top accent line */}
  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pen-blue via-pen-green to-pen-red" />

  <div className="relative z-10 p-8">
    {/* Content */}
  </div>
</div>
```

### 3.4 Enhanced Markdown Renderer

**File:** `client/src/components/MarkdownRenderer.tsx`

```typescript
import { SectionImage as SectionImageType } from '../../../shared/schema';
import { SectionImage } from './SectionImage';

interface MarkdownRendererProps {
  content: string;
  sectionImages?: SectionImageType[];
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  sectionImages = []
}) => {
  // Parse content into sections
  const sections = parseMarkdownSections(content);

  return (
    <div className="markdown-content">
      {sections.map((section, index) => {
        const sectionNumber = index + 1;
        const image = sectionImages.find(img => img.sectionNumber === sectionNumber);

        return (
          <div key={sectionNumber} className="section mb-12">
            {/* Image above header if available */}
            {image && (
              <SectionImage image={image} className="mb-6" />
            )}

            {/* Section header */}
            <div className="section-header mb-4">
              <div className="text-xs font-mono text-pen-red font-bold mb-1">
                SECTION {String(sectionNumber).padStart(2, '0')}
              </div>
              <h3 className="text-2xl font-bold text-pen-black border-b-2 border-pen-blue inline-block pb-1">
                {section.title}
              </h3>
            </div>

            {/* Section content */}
            <div className="section-content pl-4 border-l-3 border-pen-blue">
              <ReactMarkdown>{section.content}</ReactMarkdown>
            </div>

            {/* Divider between sections */}
            {index < sections.length - 1 && (
              <div className="section-divider my-8 h-px bg-gradient-to-r from-transparent via-pen-blue to-transparent relative">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-pen-blue border-2 border-white rounded-full" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

function parseMarkdownSections(content: string) {
  // Implementation matches backend parser
  // Returns array of { title, content }
}
```

---

## Phase 4: Image Generation UI (2-3 hours)

### 4.1 Generate Images Button

Add to PatentDetailPage toolbar:

```typescript
<button
  onClick={handleGenerateImages}
  disabled={isGenerating}
  className="px-4 py-2 bg-pen-blue text-white rounded hover:bg-blue-600 disabled:opacity-50"
>
  {isGenerating ? (
    <>
      <Loader2 className="animate-spin inline mr-2" size={16} />
      Generating Images...
    </>
  ) : (
    <>
      <Sparkles className="inline mr-2" size={16} />
      Generate Images
    </>
  )}
</button>

async function handleGenerateImages() {
  if (!currentArtifact) return;

  setIsGenerating(true);
  try {
    const response = await fetch(`/api/images/generate/${currentArtifact.id}`, {
      method: 'POST',
    });

    const result = await response.json();

    if (result.success) {
      toast.success(`Generated ${result.imagesGenerated} images`);
      // Refresh images
      setSectionImages(result.sectionImages);
    } else {
      toast.error(`Some images failed: ${result.errors?.join(', ')}`);
    }
  } catch (error) {
    toast.error('Failed to generate images');
  } finally {
    setIsGenerating(false);
  }
}
```

### 4.2 Image Management UI

Optional: Add individual image regeneration and deletion

```typescript
<div className="image-actions flex gap-2 mt-2">
  <button
    onClick={() => regenerateImage(image.id)}
    className="text-xs text-pen-blue hover:underline"
  >
    Regenerate
  </button>
  <button
    onClick={() => deleteImage(image.id)}
    className="text-xs text-pen-red hover:underline"
  >
    Delete
  </button>
</div>
```

---

## Phase 5: Testing & Polish (2-3 hours)

### 5.1 Manual Testing Checklist

- [ ] Generate images for ELIA15 artifact
- [ ] Verify images match prompt style (simple 4-color pen sketches)
- [ ] Check image positioning (above headers)
- [ ] Test responsive design on mobile
- [ ] Verify graph paper background renders correctly
- [ ] Test with all three artifact types
- [ ] Check image loading states
- [ ] Verify error handling (API failures)
- [ ] Test image regeneration
- [ ] Test image deletion

### 5.2 Cost Monitoring

Track DALL-E API usage:
- ELIA15: 5 sections × $0.08 = $0.40
- Business Narrative: 3 sections × $0.08 = $0.24
- Golden Circle: 3 sections × $0.08 = $0.24
- **Total per patent: ~$0.88**

Add cost tracking to admin panel.

### 5.3 Performance Optimization

- Lazy load images (already in component)
- Add image loading skeletons
- Cache DALL-E results (don't regenerate unless requested)
- Consider CDN for image delivery

---

## Phase 6: Documentation (1 hour)

### 6.1 Developer Documentation

Create `docs/IMAGE_GENERATION.md`:
- How image generation works
- DALL-E prompt customization
- Adding new artifact types
- Troubleshooting guide

### 6.2 User Documentation

Update user guide:
- How to generate images
- Image regeneration
- Cost implications
- Best practices

---

## Success Criteria

✅ **Functional:**
- Images generate successfully for all artifact types
- Images display above section headers
- Hybrid design matches mockup
- Error handling works gracefully

✅ **Design:**
- Simple 4-color pen sketch aesthetic
- Future Lab layout structure maintained
- Graph paper background subtle but visible
- Responsive on all screen sizes

✅ **Performance:**
- Images load quickly with lazy loading
- No blocking operations during generation
- Proper loading states and feedback

✅ **Cost:**
- Total cost per patent ~$0.88
- Cost tracking implemented
- No unnecessary regeneration

---

## Migration & Rollout

### Step 1: Database Migration
Run schema migration to add `section_images` table

### Step 2: Backend Deployment
Deploy new image generation services and API endpoints

### Step 3: Frontend Deployment
Deploy updated PatentDetailPage with hybrid design

### Step 4: Initial Image Generation
Generate images for existing patents (optional, can be on-demand)

### Step 5: User Testing
Get feedback from early users on image quality and design

---

## Future Enhancements (Post-MVP)

1. **Medieval Easter Egg Theme**
   - Theme toggle in UI
   - Alternative DALL-E prompts for medieval style
   - Achievement/discovery mechanism

2. **Custom Prompts**
   - Allow users to customize prompts per section
   - Save custom prompt templates
   - A/B test different styles

3. **Image Variations**
   - Generate multiple variations
   - Let users choose favorite
   - Learn preferences over time

4. **Alternative Models**
   - Add Flux Pro as cheaper alternative
   - Side-by-side comparison
   - User preference selection

5. **Batch Generation**
   - Generate images for multiple patents at once
   - Background job queue
   - Progress tracking

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Database | 2-3 hours | None |
| Phase 2: Backend | 5-7 hours | Phase 1 |
| Phase 3: Frontend Design | 3-4 hours | Phase 1 |
| Phase 4: Image UI | 2-3 hours | Phase 2, 3 |
| Phase 5: Testing | 2-3 hours | Phase 4 |
| Phase 6: Documentation | 1 hour | All phases |
| **Total** | **15-20 hours** | |

---

## Getting Started

1. Review this roadmap
2. Set up OpenAI API key
3. Start with Phase 1 (Database schema)
4. Test each phase before moving to next
5. Generate sample images early to validate prompts

Let's build this! 🚀
