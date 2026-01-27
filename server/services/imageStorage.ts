/**
 * Image Storage Service - Handles uploading DALL-E images to Supabase Storage
 */

import { supabaseAdmin } from '../lib/supabase.js';

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
  const fileName = `${artifactId}/section-${sectionNumber}.png`;

  // Upload to Supabase Storage
  const { data, error } = await supabaseAdmin.storage
    .from('section-images')
    .upload(fileName, imageBuffer, {
      contentType: 'image/png',
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
 * Downloads image from DALL-E URL and uploads to Supabase Storage
 * Stores ORIGINAL unwatermarked image - watermark applied only during PDF export
 *
 * @param dalleImageUrl - Temporary DALL-E image URL
 * @param artifactId - Artifact UUID
 * @param sectionNumber - Section number
 * @returns Permanent Supabase Storage public URL
 *
 * Note: DALL-E URLs expire after ~1 hour, so we need to download and store them
 */
export async function uploadImageFromUrl(
  dalleImageUrl: string,
  artifactId: string,
  sectionNumber: number
): Promise<string> {
  try {
    // Download image from DALL-E
    const imageBuffer = await downloadImageFromUrl(dalleImageUrl);

    // Upload ORIGINAL to Supabase Storage (no watermark)
    // Watermark will be applied on-demand during PDF generation
    const publicUrl = await uploadImageToStorage(
      imageBuffer,
      artifactId,
      sectionNumber
    );

    return publicUrl;
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
  const fileName = `${artifactId}/section-${sectionNumber}.png`;

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
