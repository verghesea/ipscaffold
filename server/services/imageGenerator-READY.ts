/**
 * Image Generator - DALL-E 3 integration for section images
 * Generates simple 4-color pen sketch style images
 */

import OpenAI from 'openai';
import { getPromptForSection, type ArtifactType } from './dallePrompts';

export interface ImageGenerationRequest {
  artifactType: ArtifactType;
  sectionNumber: number;
  sectionTitle: string;
}

export interface ImageGenerationResult {
  imageUrl: string;
  promptUsed: string;
  revisedPrompt?: string;
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
 * Cost: ~$0.08 per HD image (1792x1024)
 */
export async function generateSectionImage(
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const { artifactType, sectionNumber, sectionTitle } = request;

  // Get the prompt for this section
  const prompt = getPromptForSection(artifactType, sectionNumber);

  if (!prompt) {
    throw new Error(
      `No prompt found for ${artifactType} section ${sectionNumber}`
    );
  }

  try {
    const openai = getOpenAIClient();

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1792x1024', // 16:9 HD aspect ratio
      quality: 'hd',
      n: 1,
    });

    if (!response.data[0]?.url) {
      throw new Error('No image URL returned from DALL-E');
    }

    return {
      imageUrl: response.data[0].url,
      promptUsed: prompt,
      revisedPrompt: response.data[0].revised_prompt,
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
 * DALL-E 3 HD (1792x1024): $0.08 per image
 */
export function estimateImageGenerationCost(imageCount: number): {
  costUSD: number;
  breakdown: string;
} {
  const costPerImage = 0.08;
  const totalCost = imageCount * costPerImage;

  return {
    costUSD: totalCost,
    breakdown: `${imageCount} images × $${costPerImage} = $${totalCost.toFixed(2)}`,
  };
}
