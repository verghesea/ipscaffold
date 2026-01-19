/**
 * Parallel Image Generator - Generates section images in parallel with batching
 *
 * Benefits:
 * - Reduces generation time from ~9 minutes to ~2-3 minutes
 * - Respects OpenAI rate limits by batching (3 concurrent requests)
 * - Same cost as sequential generation
 * - Real-time progress tracking
 */

import { parseMarkdownSections } from './sectionParser';
import { generateSectionImage } from './imageGenerator';
import { uploadImageFromUrl } from './imageStorage';
import { supabaseStorage } from '../supabaseStorage';
import type { ArtifactType } from './dallePrompts';

interface Artifact {
  id: string;
  artifact_type: ArtifactType;
  content: string;
}

interface ImageGenerationTask {
  artifactId: string;
  artifactType: ArtifactType;
  sectionNumber: number;
  sectionTitle: string;
  sectionContent: string;
}

/**
 * Generate images for all artifacts in parallel with batching
 *
 * @param artifacts - All artifacts to generate images for
 * @param patentId - Patent ID for logging
 * @param totalSections - Total number of sections (for progress)
 * @param onProgress - Callback for progress updates
 */
export async function generateArtifactImagesParallel(
  artifacts: Artifact[],
  patentId: string,
  totalSections: number,
  onProgress: (current: number) => Promise<void>
): Promise<void> {
  // Build list of all image generation tasks
  const tasks: ImageGenerationTask[] = [];

  for (const artifact of artifacts) {
    const sections = parseMarkdownSections(artifact.content);

    for (const section of sections) {
      tasks.push({
        artifactId: artifact.id,
        artifactType: artifact.artifact_type as ArtifactType,
        sectionNumber: section.number,
        sectionTitle: section.title,
        sectionContent: section.content,
      });
    }
  }

  console.log(`[ParallelImageGen] Processing ${tasks.length} image generation tasks`);

  // Process tasks in batches of 3 (to respect OpenAI rate limits)
  const BATCH_SIZE = 3;
  let completed = 0;

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);

    console.log(`[ParallelImageGen] Starting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tasks.length / BATCH_SIZE)} (${batch.length} images)`);

    // Process batch in parallel
    await Promise.all(
      batch.map(async (task) => {
        try {
          console.log(`[ParallelImageGen] Generating image for ${task.artifactType} section ${task.sectionNumber}: ${task.sectionTitle}`);

          // Generate image with Claude-generated prompt and title
          const imageResult = await generateSectionImage({
            artifactType: task.artifactType,
            sectionNumber: task.sectionNumber,
            sectionTitle: task.sectionTitle,
            sectionContent: task.sectionContent,
          });

          // Upload to Supabase Storage
          const storedImageUrl = await uploadImageFromUrl(
            imageResult.imageUrl,
            task.artifactId,
            task.sectionNumber
          );

          // Save to database
          await supabaseStorage.upsertSectionImage({
            artifact_id: task.artifactId,
            section_number: task.sectionNumber,
            section_title: task.sectionTitle,
            image_url: storedImageUrl,
            prompt_used: imageResult.promptUsed,
            image_title: imageResult.imageTitle, // Claude-generated descriptive title
            generation_metadata: {
              model: 'dall-e-3',
              size: '1792x1024',
              quality: 'hd',
              revisedPrompt: imageResult.revisedPrompt,
            },
          });

          completed++;
          console.log(`[ParallelImageGen] ✓ Completed ${completed}/${totalSections}: ${task.sectionTitle}`);

          // Update progress
          await onProgress(completed);
        } catch (error) {
          console.error(`[ParallelImageGen] ✗ Failed to generate image for section ${task.sectionNumber}:`, error);
          // Continue with other images even if one fails
        }
      })
    );
  }

  console.log(`[ParallelImageGen] ✓ Completed all ${completed}/${totalSections} images for patent ${patentId}`);
}

/**
 * Estimate time for parallel generation
 *
 * @param sectionCount - Number of sections
 * @param batchSize - Images processed in parallel (default 3)
 * @returns Estimated time in seconds
 */
export function estimateParallelGenerationTime(
  sectionCount: number,
  batchSize: number = 3
): number {
  const AVG_SECONDS_PER_IMAGE = 35;
  const batches = Math.ceil(sectionCount / batchSize);
  return batches * AVG_SECONDS_PER_IMAGE;
}
