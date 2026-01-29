/**
 * Artifact Image Service - Main orchestration for generating section images
 * Combines section parsing, DALL-E generation, and storage
 */

import { parseMarkdownSections } from './sectionParser';
import { generateSectionImage, generateBatchImages, estimateImageGenerationCost } from './imageGenerator';
import { uploadImageFromUrl, deleteAllArtifactImages } from './imageStorage';
import { supabaseStorage } from '../supabaseStorage';
import type { ArtifactType } from './dallePrompts';
import type { SectionImage } from '../supabaseStorage';

export interface GenerateImagesRequest {
  artifactId: string;
  artifactType: ArtifactType;
  markdownContent: string;
}

export interface GenerateImagesResult {
  success: boolean;
  imagesGenerated: number;
  sectionImages: SectionImage[];
  errors?: string[];
  costEstimate?: { costUSD: number; breakdown: string };
}

export interface GenerateSingleImageRequest {
  artifactId: string;
  artifactType: ArtifactType;
  sectionNumber: number;
  sectionTitle: string;
  sectionContent: string; // ADD: Section content for Claude analysis
}

/**
 * Generates images for all sections in an artifact
 *
 * Process:
 * 1. Parse markdown into sections
 * 2. Generate DALL-E image for each section
 * 3. Upload images to Supabase Storage
 * 4. Save metadata to section_images table
 *
 * @param request - Artifact details and content
 * @returns Result with generated images and any errors
 */
export async function generateArtifactImages(
  request: GenerateImagesRequest
): Promise<GenerateImagesResult> {
  const { artifactId, artifactType, markdownContent } = request;

  // Parse markdown into sections
  const sections = parseMarkdownSections(markdownContent);

  if (sections.length === 0) {
    return {
      success: false,
      imagesGenerated: 0,
      sectionImages: [],
      errors: ['No sections found in markdown content'],
    };
  }

  // Estimate cost
  const costEstimate = estimateImageGenerationCost(sections.length);
  console.log(`Generating ${sections.length} images for artifact ${artifactId}`);
  console.log(`Estimated cost: ${costEstimate.breakdown}`);

  const sectionImages: SectionImage[] = [];
  const errors: string[] = [];

  // Generate images for each section
  for (const section of sections) {
    try {
      console.log(`Generating image for section ${section.number}: ${section.title}`);

      // Generate image via DALL-E with patent-specific content
      const imageResult = await generateSectionImage({
        artifactType,
        sectionNumber: section.number,
        sectionTitle: section.title,
        sectionContent: section.content, // Pass actual section content for Claude analysis
      });

      // Upload to Supabase Storage - BOTH original and watermarked versions
      console.log(`Uploading image for section ${section.number} to storage...`);
      const { originalUrl, watermarkedUrl } = await uploadImageFromUrl(
        imageResult.imageUrl,
        artifactId,
        section.number,
        true // Upload both versions
      );

      // Save to database with BOTH URLs
      console.log(`Saving image metadata for section ${section.number} to database...`);
      const sectionImage = await supabaseStorage.upsertSectionImage({
        artifact_id: artifactId,
        section_number: section.number,
        section_title: section.title,
        image_url: watermarkedUrl, // Use watermarked version by default
        original_image_url: originalUrl, // Keep original for admin/re-watermarking
        prompt_used: imageResult.promptUsed,
        image_title: imageResult.imageTitle, // Use Claude-generated descriptive title
        generation_metadata: {
          model: 'dall-e-3',
          size: '1792x1024',
          quality: 'hd',
          revisedPrompt: imageResult.revisedPrompt,
        },
      });

      sectionImages.push(sectionImage);
      console.log(`✓ Successfully generated image for section ${section.number}`);
    } catch (error) {
      const errorMessage = `Section ${section.number} (${section.title}): ${(error as Error).message}`;
      errors.push(errorMessage);
      console.error(`✗ Error generating image:`, errorMessage);
    }
  }

  return {
    success: errors.length === 0,
    imagesGenerated: sectionImages.length,
    sectionImages,
    errors: errors.length > 0 ? errors : undefined,
    costEstimate,
  };
}

/**
 * Generates a single image for a specific section
 * Useful for regenerating individual images
 *
 * @param request - Section details
 * @returns Generated section image
 */
export async function generateSingleSectionImage(
  request: GenerateSingleImageRequest
): Promise<SectionImage> {
  const { artifactId, artifactType, sectionNumber, sectionTitle, sectionContent } = request;

  console.log(`Generating image for section ${sectionNumber}: ${sectionTitle}`);

  // Generate image via DALL-E with patent-specific content
  const imageResult = await generateSectionImage({
    artifactType,
    sectionNumber,
    sectionTitle,
    sectionContent, // Pass actual section content for Claude analysis
  });

  // Upload to Supabase Storage - BOTH original and watermarked versions
  const { originalUrl, watermarkedUrl } = await uploadImageFromUrl(
    imageResult.imageUrl,
    artifactId,
    sectionNumber,
    true // Upload both versions
  );

  // Save to database with BOTH URLs
  const sectionImage = await supabaseStorage.upsertSectionImage({
    artifact_id: artifactId,
    section_number: sectionNumber,
    section_title: sectionTitle,
    image_url: watermarkedUrl, // Use watermarked version by default
    original_image_url: originalUrl, // Keep original for admin/re-watermarking
    prompt_used: imageResult.promptUsed,
    image_title: imageResult.imageTitle, // Use Claude-generated descriptive title
    generation_metadata: {
      model: 'dall-e-3',
      size: '1792x1024',
      quality: 'hd',
      revisedPrompt: imageResult.revisedPrompt,
    },
  });

  console.log(`✓ Successfully generated image for section ${sectionNumber}`);

  return sectionImage;
}

/**
 * Gets all images for an artifact
 *
 * @param artifactId - Artifact UUID
 * @returns Array of section images
 */
export async function getArtifactImages(
  artifactId: string
): Promise<SectionImage[]> {
  return supabaseStorage.getSectionImagesByArtifact(artifactId);
}

/**
 * Deletes all images for an artifact (both from storage and database)
 *
 * @param artifactId - Artifact UUID
 */
export async function deleteArtifactImages(
  artifactId: string
): Promise<void> {
  // Delete from storage
  await deleteAllArtifactImages(artifactId);

  // Delete from database
  await supabaseStorage.deleteSectionImagesByArtifact(artifactId);

  console.log(`Deleted all images for artifact ${artifactId}`);
}

/**
 * Regenerates images for an artifact
 * Deletes existing images and generates new ones
 *
 * @param request - Artifact details
 * @returns Result with generated images
 */
export async function regenerateArtifactImages(
  request: GenerateImagesRequest
): Promise<GenerateImagesResult> {
  const { artifactId } = request;

  console.log(`Regenerating images for artifact ${artifactId}`);

  // Delete existing images
  try {
    await deleteArtifactImages(artifactId);
  } catch (error) {
    console.warn('Error deleting old images:', error);
    // Continue anyway
  }

  // Generate new images
  return generateArtifactImages(request);
}
