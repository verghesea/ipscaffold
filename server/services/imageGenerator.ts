/**
 * Image Generator - DALL-E 3 integration for section images
 * Generates simple 4-color pen sketch style images
 * Uses Claude to create patent-specific prompts
 */

import { getPromptForSection, type ArtifactType } from './dallePrompts';
import { generateImagePrompt } from './imagePromptGenerator';

// NOTE: Requires OpenAI SDK - install with: npm install openai
import OpenAI from 'openai';

export interface ImageGenerationRequest {
  artifactType: ArtifactType;
  sectionNumber: number;
  sectionTitle: string;
  sectionContent: string; // ADD: Actual section content for Claude to analyze
}

export interface ImageGenerationResult {
  imageUrl: string;
  promptUsed: string;
  revisedPrompt?: string;
  imageTitle: string; // Descriptive title explaining what the image shows
}

export interface ImageGenerationError {
  error: string;
  sectionNumber: number;
  details?: string;
}

/**
 * Initialize OpenAI client
 * Requires OPENAI_API_KEY environment variable
 */
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Generates an image for a specific artifact section using DALL-E 3
 *
 * @param request - Section details (artifact type, number, title)
 * @returns Image URL and prompts
 * @throws Error if generation fails
 *
 * Cost: ~$0.04 per standard quality image (1792x1024)
 */
export async function generateSectionImage(
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const { artifactType, sectionNumber, sectionTitle, sectionContent } = request;

  // Generate patent-specific prompt AND title using Claude
  console.log(`[ImageGenerator] Generating custom prompt for ${artifactType} section ${sectionNumber}...`);
  const { prompt, title } = await generateImagePrompt({
    artifactType,
    sectionNumber,
    sectionTitle,
    sectionContent,
  });

  if (!prompt || !title) {
    throw new Error(
      `Failed to generate prompt for ${artifactType} section ${sectionNumber}`
    );
  }

  console.log(`[ImageGenerator] Title: ${title}`);
  console.log(`[ImageGenerator] Using prompt: ${prompt.substring(0, 100)}...`);

  try {
    const openai = getOpenAIClient();

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1792x1024', // 16:9 aspect ratio
      quality: 'standard', // Standard quality - $0.04/image (vs HD $0.08/image)
      n: 1,
    });

    if (!response.data[0]?.url) {
      throw new Error('No image URL returned from DALL-E');
    }

    return {
      imageUrl: response.data[0].url,
      promptUsed: prompt,
      revisedPrompt: response.data[0].revised_prompt,
      imageTitle: title, // Use Claude-generated descriptive title
    };
  } catch (error) {
    console.error(`Error generating image for section ${sectionNumber}:`, error);
    throw new Error(
      `Failed to generate image: ${(error as Error).message}`
    );
  }
}

/**
 * Generates images for multiple sections
 * Handles errors gracefully and continues with other sections
 */
export async function generateBatchImages(
  requests: ImageGenerationRequest[]
): Promise<{
  success: ImageGenerationResult[];
  errors: ImageGenerationError[];
}> {
  const success: ImageGenerationResult[] = [];
  const errors: ImageGenerationError[] = [];

  for (const request of requests) {
    try {
      const result = await generateSectionImage(request);
      success.push(result);
    } catch (error) {
      errors.push({
        error: (error as Error).message,
        sectionNumber: request.sectionNumber,
        details: `Section: ${request.sectionTitle}`,
      });
    }
  }

  return { success, errors };
}

/**
 * Estimates cost for generating images
 *
 * DALL-E 3 Standard (1792x1024): $0.04 per image
 */
export function estimateImageGenerationCost(imageCount: number): {
  costUSD: number;
  breakdown: string;
} {
  const costPerImage = 0.04;
  const totalCost = imageCount * costPerImage;

  return {
    costUSD: totalCost,
    breakdown: `${imageCount} images × $${costPerImage} = $${totalCost.toFixed(2)}`,
  };
}
