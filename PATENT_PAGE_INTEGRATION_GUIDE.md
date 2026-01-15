# PatentDetailPage Integration Guide

## Summary

All frontend components are built and ready. The final step is to integrate them into `PatentDetailPage.tsx`.

---

## Changes Needed in client/src/pages/PatentDetailPage.tsx

### 1. Add New Imports (Top of File)

After the existing imports, add:

```typescript
import { EnhancedMarkdownRenderer } from '@/components/patent/EnhancedMarkdownRenderer';
import { ArtifactHeader } from '@/components/patent/ArtifactHeader';
import { useSectionImages } from '@/hooks/useSectionImages';
import { countSections } from '@/lib/markdownParser';
```

### 2. Add Active Tab State (Line ~50)

After `const [artifacts, setArtifacts] = useState<Artifact[]>([]);` add:

```typescript
const [activeTab, setActiveTab] = useState<string>('elia15');
```

### 3. Get Current Artifact (Line ~52)

Add after state declarations:

```typescript
// Get current artifact based on active tab
const currentArtifact = artifacts.find(a => a.type === activeTab);

// Use image hook for current artifact
const {
  images,
  loading: imagesLoading,
  generating,
  generateImages,
  regenerateImage,
} = useSectionImages(currentArtifact?.id);

// Calculate section count
const sectionCount = currentArtifact
  ? countSections(currentArtifact.content)
  : 0;
```

### 4. Add Image Generation Handler (Line ~60)

Add these handler functions:

```typescript
const handleGenerateImages = async () => {
  const result = await generateImages();
  if (result?.success) {
    toast({
      title: 'Images Generated!',
      description: `Created ${result.imagesGenerated} images (Cost: $${result.costEstimate?.costUSD.toFixed(2)})`,
    });
  } else if (result?.errors?.length) {
    toast({
      title: 'Partial Success',
      description: `Generated ${result.imagesGenerated} images, ${result.errors.length} failed`,
      variant: 'destructive',
    });
  }
};

const handleRegenerateImage = async (sectionNumber: number) => {
  const result = await regenerateImage(sectionNumber);
  if (result) {
    toast({ title: 'Image regenerated successfully' });
  } else {
    toast({
      title: 'Regeneration failed',
      description: 'Please try again',
      variant: 'destructive'
    });
  }
};
```

### 5. Update Tab Trigger (Line ~270)

Find the `TabsTrigger` component and add `onClick` handler:

```typescript
<TabsTrigger
  key={key}
  value={key}
  disabled={!hasArtifact}
  className="flex items-center gap-2 data-[state=active]:border-b-2"
  data-testid={`tab-${key}`}
  onClick={() => {
    analytics.trackArtifactView(key);
    setActiveTab(key);  // ADD THIS LINE
  }}
>
```

### 6. Replace TabsContent (Line ~295)

Replace the entire `TabsContent` block with:

```typescript
<TabsContent key={key} value={key} className="mt-6">
  {/* Graph paper background container */}
  <div className="relative bg-white shadow-lg overflow-hidden">
    {/* Graph paper overlay */}
    <div
      className="absolute inset-0 pointer-events-none opacity-50"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px),
          linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)
        `,
        backgroundSize: '10px 10px, 10px 10px, 50px 50px, 50px 50px',
      }}
    />

    {/* Top accent line (4-color gradient) */}
    <div className="h-[3px] bg-gradient-to-r from-[#2563eb] via-[#059669] to-[#dc2626]" />

    <div className="relative z-10 p-6 md:p-12">
      {artifact ? (
        <>
          {/* Artifact Header with Generate Button */}
          <ArtifactHeader
            artifactNumber={Object.keys(ARTIFACT_TYPES).indexOf(key) + 1}
            totalArtifacts={3}
            artifactLabel={meta.label}
            artifactTitle={meta.tagline}
            hasImages={images.length > 0}
            imageCount={images.length}
            totalSections={sectionCount}
            generating={generating}
            onGenerateImages={handleGenerateImages}
          />

          {/* Enhanced Markdown Renderer with Images */}
          <EnhancedMarkdownRenderer
            content={artifact.content}
            images={images}
            generating={generating}
            onRegenerateImage={handleRegenerateImage}
          />
        </>
      ) : (
        <Card className="text-center py-8">
          <CardContent>
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Generating {meta.label}...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  </div>
</TabsContent>
```

### 7. Remove Old formatContent Function

Delete the entire `formatContent` function (lines ~126-179) as it's replaced by `EnhancedMarkdownRenderer`.

---

## Testing Checklist

After making these changes:

- [ ] Page loads without errors
- [ ] Tabs switch correctly
- [ ] "Generate Images" button appears
- [ ] Click generates images (shows loading state)
- [ ] Images display above section headers
- [ ] Images have corner marks and captions
- [ ] Hover on image shows regenerate button
- [ ] Regenerate button works
- [ ] Graph paper background visible
- [ ] 4-color accent line shows at top
- [ ] Responsive on mobile

---

## File Location

**File to edit:** `client/src/pages/PatentDetailPage.tsx`

---

## Quick Reference

**What we're replacing:**
- Old inline markdown formatting → `EnhancedMarkdownRenderer`
- Simple artifact display → `ArtifactHeader` + images

**What we're adding:**
- Image fetching with `useSectionImages` hook
- Generate/regenerate functionality
- Graph paper background styling
- 4-color pen accent system

---

## Visual Changes

**Before:** Plain markdown with basic formatting
**After:**
- Images above each section
- 4-color corner marks on images
- Graph paper background
- Blue/red/green pen accents
- Professional hybrid design

---

## Next Steps

1. Make these changes in Replit
2. Test the page loads
3. Try generating images for an artifact
4. Verify design matches mockup-final-hybrid.html

Ready to integrate! 🚀
