/**
 * Image Watermarking Service
 * Applies Humble AI watermark ON-DEMAND (not permanent storage)
 *
 * Architecture:
 * - Original DALL-E images are stored WITHOUT watermarks in Supabase
 * - Watermark is applied dynamically when generating PDFs
 * - This allows toggling watermarks without regenerating expensive images
 * - Web app displays original unwatermarked images
 * - PDFs include watermarked versions
 */

import { createCanvas, loadImage, Image } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WatermarkOptions {
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'center';
  opacity?: number;
  scale?: number;
}

/**
 * Default watermark configuration
 */
const DEFAULT_WATERMARK_PATH = path.join(__dirname, '../assets/humble-watermark.png');
const DEFAULT_OPTIONS: Required<WatermarkOptions> = {
  position: 'bottom-right',
  opacity: 0.7,
  scale: 0.15, // 15% of image width
};

/**
 * Add watermark to image buffer
 * @param imageBuffer - Original image buffer
 * @param options - Watermark positioning and styling options
 * @returns Watermarked image buffer (PNG)
 */
export async function addWatermark(
  imageBuffer: Buffer,
  options: WatermarkOptions = {}
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Load original image
    const originalImage = await loadImage(imageBuffer);
    const { width, height } = originalImage;

    // Create canvas matching original dimensions
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw original image
    ctx.drawImage(originalImage, 0, 0, width, height);

    // Try to load watermark (if it exists)
    let watermarkImage: Image | null = null;

    try {
      watermarkImage = await loadImage(DEFAULT_WATERMARK_PATH);
    } catch (error) {
      // Watermark file doesn't exist yet - skip watermarking
      console.log('Watermark file not found, skipping watermark');
      return imageBuffer;
    }

    if (watermarkImage) {
      // Calculate watermark dimensions
      const watermarkWidth = width * opts.scale;
      const watermarkHeight = (watermarkImage.height / watermarkImage.width) * watermarkWidth;

      // Calculate position
      let x = 0;
      let y = 0;
      const padding = 20;

      switch (opts.position) {
        case 'bottom-right':
          x = width - watermarkWidth - padding;
          y = height - watermarkHeight - padding;
          break;

        case 'bottom-left':
          x = padding;
          y = height - watermarkHeight - padding;
          break;

        case 'bottom-center':
          x = (width - watermarkWidth) / 2;
          y = height - watermarkHeight - padding;
          break;

        case 'center':
          x = (width - watermarkWidth) / 2;
          y = (height - watermarkHeight) / 2;
          break;
      }

      // Apply opacity
      ctx.globalAlpha = opts.opacity;

      // Draw watermark
      ctx.drawImage(watermarkImage, x, y, watermarkWidth, watermarkHeight);

      // Reset opacity
      ctx.globalAlpha = 1.0;
    }

    // Convert to buffer
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Failed to add watermark:', error);
    // Return original image if watermarking fails
    return imageBuffer;
  }
}

/**
 * Add watermark to image from URL
 * Fetches image, adds watermark, returns buffer
 */
export async function addWatermarkToUrl(
  imageUrl: string,
  options: WatermarkOptions = {}
): Promise<Buffer> {
  try {
    // Fetch image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Add watermark
    return await addWatermark(imageBuffer, options);
  } catch (error) {
    console.error('Failed to watermark image from URL:', error);
    throw error;
  }
}

/**
 * Check if watermark file exists
 */
export function watermarkExists(): boolean {
  try {
    const fs = require('fs');
    return fs.existsSync(DEFAULT_WATERMARK_PATH);
  } catch {
    return false;
  }
}
