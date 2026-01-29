/**
 * Image Storage Service - Handles uploading DALL-E images to Supabase Storage
 */

import { supabaseAdmin } from '../lib/supabase.js';
import sharp from 'sharp';
import { addWatermark } from './imageWatermarkService.js';

/**
 * Downloads an image from a URL and returns it as a Buffer
 */
async function downloadImageFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Compression options for images
 */
interface CompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png';
}

/**
 * Compresses an image buffer using Sharp
 * Converts to JPEG and resizes for optimal PDF file size
 *
 * @param imageBuffer - Original image buffer (typically PNG from DALL-E)
 * @param options - Compression options
 * @returns Compressed image buffer
 */
async function compressImage(
  imageBuffer: Buffer,
  options: CompressionOptions = {}
): Promise<Buffer> {
  const {
    quality = 85,
    maxWidth = 1024,
    maxHeight = 1024,
    format = 'jpeg',
  } = options;

  const originalSize = imageBuffer.length;

  let pipeline = sharp(imageBuffer);

  // Resize if larger than max dimensions (preserving aspect ratio)
  pipeline = pipeline.resize(maxWidth, maxHeight, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  // Convert to JPEG with quality setting (mozjpeg for better compression)
  if (format === 'jpeg') {
    pipeline = pipeline.jpeg({
      quality,
      mozjpeg: true,
    });
  } else {
    pipeline = pipeline.png({
      compressionLevel: 9,
    });
  }

  const compressedBuffer = await pipeline.toBuffer();
  const compressedSize = compressedBuffer.length;
  const reduction = ((originalSize - compressedSize) / originalSize) * 100;

  console.log(
    `[Image Compression] Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ` +
    `Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB ` +
    `(${reduction.toFixed(1)}% reduction)`
  );

  return compressedBuffer;
}

/**
 * Uploads an image buffer to Supabase Storage
 *
 * @param imageBuffer - Image data as Buffer
 * @param artifactId - Artifact UUID
 * @param sectionNumber - Section number (1, 2, 3, etc.)
 * @returns Public URL of the uploaded image
 */
export async function uploadImageToStorage(
  imageBuffer: Buffer,
  artifactId: string,
  sectionNumber: number
): Promise<string> {
  // Compress image to reduce PDF file size
  const compressedBuffer = await compressImage(imageBuffer, {
    quality: 85,
    maxWidth: 1024,
    maxHeight: 1024,
    format: 'jpeg',
  });

  const fileName = `${artifactId}/section-${sectionNumber}.jpeg`;

  // Upload to Supabase Storage
  const { data, error } = await supabaseAdmin.storage
    .from('section-images')
    .upload(fileName, compressedBuffer, {
      contentType: 'image/jpeg',
      upsert: true, // Overwrite if exists (for regeneration)
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from('section-images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Result of uploading both original and watermarked versions
 */
export interface UploadImageResult {
  originalUrl: string;
  watermarkedUrl: string;
}

/**
 * Downloads image from DALL-E URL and uploads BOTH original and watermarked versions
 * This implements Option A: Pre-watermark at creation time for fast loading
 *
 * @param dalleImageUrl - Temporary DALL-E image URL
 * @param artifactId - Artifact UUID
 * @param sectionNumber - Section number
 * @returns Object with both original and watermarked URLs
 *
 * Note: DALL-E URLs expire after ~1 hour, so we need to download and store them
 */
export async function uploadImageFromUrl(
  dalleImageUrl: string,
  artifactId: string,
  sectionNumber: number
): Promise<string>;
export async function uploadImageFromUrl(
  dalleImageUrl: string,
  artifactId: string,
  sectionNumber: number,
  uploadBoth: true
): Promise<UploadImageResult>;
export async function uploadImageFromUrl(
  dalleImageUrl: string,
  artifactId: string,
  sectionNumber: number,
  uploadBoth?: boolean
): Promise<string | UploadImageResult> {
  try {
    // Download image from DALL-E
    const imageBuffer = await downloadImageFromUrl(dalleImageUrl);

    if (uploadBoth) {
      // Upload BOTH original and watermarked versions
      console.log(`[Image Storage] Creating original and watermarked versions for section ${sectionNumber}...`);

      // 1. Upload ORIGINAL (unwatermarked) version
      const compressedOriginal = await compressImage(imageBuffer, {
        quality: 85,
        maxWidth: 1024,
        maxHeight: 1024,
        format: 'jpeg',
      });

      const originalFileName = `${artifactId}/original-section-${sectionNumber}.jpeg`;
      const { error: originalError } = await supabaseAdmin.storage
        .from('section-images')
        .upload(originalFileName, compressedOriginal, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (originalError) {
        throw new Error(`Failed to upload original: ${originalError.message}`);
      }

      const { data: originalUrlData } = supabaseAdmin.storage
        .from('section-images')
        .getPublicUrl(originalFileName);

      // 2. Apply watermark
      console.log(`[Image Storage] Applying Humble watermark to section ${sectionNumber}...`);
      const watermarkedBuffer = await addWatermark(compressedOriginal, {
        position: 'bottom-right',
        opacity: 0.7,
        scale: 0.15,
      });

      // 3. Upload WATERMARKED version
      const watermarkedFileName = `${artifactId}/section-${sectionNumber}.jpeg`;
      const { error: watermarkedError } = await supabaseAdmin.storage
        .from('section-images')
        .upload(watermarkedFileName, watermarkedBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (watermarkedError) {
        throw new Error(`Failed to upload watermarked: ${watermarkedError.message}`);
      }

      const { data: watermarkedUrlData } = supabaseAdmin.storage
        .from('section-images')
        .getPublicUrl(watermarkedFileName);

      console.log(`[Image Storage] ✓ Uploaded both versions for section ${sectionNumber}`);

      return {
        originalUrl: originalUrlData.publicUrl,
        watermarkedUrl: watermarkedUrlData.publicUrl,
      };
    } else {
      // Legacy: Upload only one version (for backward compatibility)
      const publicUrl = await uploadImageToStorage(
        imageBuffer,
        artifactId,
        sectionNumber
      );

      return publicUrl;
    }
  } catch (error) {
    console.error('Error uploading image from URL:', error);
    throw new Error(`Failed to store image: ${(error as Error).message}`);
  }
}

/**
 * Deletes an image from Supabase Storage
 *
 * @param artifactId - Artifact UUID
 * @param sectionNumber - Section number
 */
export async function deleteImageFromStorage(
  artifactId: string,
  sectionNumber: number
): Promise<void> {
  const fileName = `${artifactId}/section-${sectionNumber}.jpeg`;

  const { error } = await supabaseAdmin.storage
    .from('section-images')
    .remove([fileName]);

  if (error) {
    console.error('Error deleting image:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

/**
 * Deletes all images for an artifact
 *
 * @param artifactId - Artifact UUID
 */
export async function deleteAllArtifactImages(
  artifactId: string
): Promise<void> {
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from('section-images')
    .list(artifactId);

  if (listError) {
    throw new Error(`Failed to list images: ${listError.message}`);
  }

  if (!files || files.length === 0) {
    return; // No images to delete
  }

  const filePaths = files.map(file => `${artifactId}/${file.name}`);

  const { error: deleteError } = await supabaseAdmin.storage
    .from('section-images')
    .remove(filePaths);

  if (deleteError) {
    throw new Error(`Failed to delete images: ${deleteError.message}`);
  }
}

/**
 * Uploads a hero image from DALL-E URL with BOTH original and watermarked versions
 *
 * @param dalleImageUrl - Temporary DALL-E image URL
 * @param patentId - Patent UUID
 * @returns Object with both original and watermarked URLs
 */
export async function uploadHeroImageFromUrl(
  dalleImageUrl: string,
  patentId: string
): Promise<UploadImageResult> {
  try {
    // Download image from DALL-E
    const imageBuffer = await downloadImageFromUrl(dalleImageUrl);

    console.log(`[Hero Image Storage] Creating original and watermarked versions for patent ${patentId}...`);

    // 1. Compress original
    const compressedOriginal = await compressImage(imageBuffer, {
      quality: 85,
      maxWidth: 1024,
      maxHeight: 1024,
      format: 'jpeg',
    });

    // 2. Upload ORIGINAL (unwatermarked) version
    const originalFileName = `hero-images/${patentId}/original.jpeg`;
    const { error: originalError } = await supabaseAdmin.storage
      .from('section-images')
      .upload(originalFileName, compressedOriginal, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (originalError) {
      throw new Error(`Failed to upload original hero: ${originalError.message}`);
    }

    const { data: originalUrlData } = supabaseAdmin.storage
      .from('section-images')
      .getPublicUrl(originalFileName);

    // 3. Apply watermark
    console.log(`[Hero Image Storage] Applying Humble watermark...`);
    const watermarkedBuffer = await addWatermark(compressedOriginal, {
      position: 'bottom-right',
      opacity: 0.7,
      scale: 0.15,
    });

    // 4. Upload WATERMARKED version
    const watermarkedFileName = `hero-images/${patentId}/hero.jpeg`;
    const { error: watermarkedError } = await supabaseAdmin.storage
      .from('section-images')
      .upload(watermarkedFileName, watermarkedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (watermarkedError) {
      throw new Error(`Failed to upload watermarked hero: ${watermarkedError.message}`);
    }

    const { data: watermarkedUrlData } = supabaseAdmin.storage
      .from('section-images')
      .getPublicUrl(watermarkedFileName);

    console.log(`[Hero Image Storage] ✓ Uploaded both hero image versions`);

    return {
      originalUrl: originalUrlData.publicUrl,
      watermarkedUrl: watermarkedUrlData.publicUrl,
    };
  } catch (error) {
    console.error('Error uploading hero image from URL:', error);
    throw new Error(`Failed to store hero image: ${(error as Error).message}`);
  }
}

/**
 * Checks if a storage bucket exists and creates it if not
 * Run this during setup/migration
 */
export async function ensureStorageBucketExists(): Promise<void> {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`);
  }

  const bucketExists = buckets.some(bucket => bucket.name === 'section-images');

  if (!bucketExists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket('section-images', {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/png', 'image/jpeg'],
    });

    if (createError) {
      throw new Error(`Failed to create bucket: ${createError.message}`);
    }

    console.log('Created section-images storage bucket');
  }
}
