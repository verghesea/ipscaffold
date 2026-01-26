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

**Usage:**
The watermark is automatically applied to:
- DALL-E generated section images
- Hero images for patents
- Images embedded in PDF exports

**Position:** Bottom-right corner with 20px padding

If the watermark file is not present, images will be generated without watermarking (graceful degradation).
