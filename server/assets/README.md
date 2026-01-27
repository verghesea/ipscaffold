# Assets Directory

This directory contains static assets used by the server.

## Watermark

Place the Humble AI watermark file here:

**File:** `humble-watermark.png`

**Requirements:**
- Format: PNG with transparency
- Recommended size: 400-600px wide
- Transparent background preferred
- Will be scaled to 15% of image width

**Architecture:**
The watermark is applied **ON-DEMAND**, not permanently stored:
- ✅ Original DALL-E images are stored WITHOUT watermarks in Supabase
- ✅ Web app displays clean, unwatermarked images
- ✅ Watermark applied dynamically when generating PDFs
- ✅ Can toggle watermarks on/off without regenerating images
- ✅ No need to regenerate expensive DALL-E images

**Usage:**
The watermark is applied to:
- PDF exports (both individual artifacts and complete packages)
- Position: Bottom-right corner with 20px padding
- Opacity: 70%
- Scale: 15% of image width

**Flexibility:**
- Enable/disable watermarks by setting `watermarkImages: false` in PDF generation options
- Original images always remain pristine in storage
- Future feature: Premium users could get watermark-free PDFs

If the watermark file is not present, PDFs will be generated without watermarking (graceful degradation).
