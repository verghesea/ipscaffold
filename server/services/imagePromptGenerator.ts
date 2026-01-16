/**
 * Image Prompt Generator - Uses Claude to create patent-specific image prompts
 *
 * This service analyzes patent section content and generates tailored DALL-E/SDXL prompts
 * that accurately represent the specific technology described in each patent.
 *
 * Benefits:
 * - Every patent gets unique, relevant images
 * - Claude understands technical content and creates visual descriptions
 * - Works with any patent domain (mechanical, software, medical, etc.)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ArtifactType } from './dallePrompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ImagePromptRequest {
  artifactType: ArtifactType;
  sectionNumber: number;
  sectionTitle: string;
  sectionContent: string;
}

/**
 * Generate a custom image prompt using Claude
 *
 * Claude analyzes the patent section content and creates a specific prompt
 * for DALL-E/SDXL that describes a simple 4-color pen sketch illustrating
 * the concept.
 *
 * Cost: ~$0.001 per prompt (Haiku model)
 * Time: ~2-3 seconds
 */
export async function generateImagePrompt(
  request: ImagePromptRequest
): Promise<string> {
  const { artifactType, sectionNumber, sectionTitle, sectionContent } = request;

  const systemPrompt = `You are an expert at creating image generation prompts for AI image generators like DALL-E and Stable Diffusion.

Your task is to read patent section content and create a prompt for a simple 4-color pen sketch that illustrates the key concept.

STYLE REQUIREMENTS (CRITICAL):
- Simple hand-drawn sketch style (like quick working notes)
- Use only 4 colors: blue, red, green, and black pens
- Minimal detail, loose sketchy linework
- Graph paper background visible
- 16:9 aspect ratio
- Look like quick diagrams drawn during a brainstorming session

CONTENT REQUIREMENTS:
- Illustrate the SPECIFIC technology/concept from this patent section
- Focus on the key visual elements (don't try to show everything)
- Use simple shapes, arrows, labels to convey the idea
- Make it conceptually accurate to THIS patent (not generic)

PROMPT FORMAT:
Write a single paragraph prompt starting with "Simple hand-drawn sketch showing..." that describes:
1. What is being illustrated (specific to this patent)
2. Which colored pens are used and for what elements
3. The sketchy, minimal style
4. Graph paper background and 16:9 ratio

IMPORTANT: Make the prompt SPECIFIC to the content provided. Avoid generic descriptions.`;

  const userPrompt = `Create an image prompt for this patent section:

**Artifact Type:** ${getArtifactTypeDescription(artifactType)}
**Section ${sectionNumber}: ${sectionTitle}**

**Content:**
${sectionContent}

Generate a DALL-E prompt for a simple 4-color pen sketch that illustrates the key concept from this specific section.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast and cheap ($0.001 per prompt)
      max_tokens: 300,
      temperature: 0.7, // Slightly creative but consistent
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    const generatedPrompt = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '';

    if (!generatedPrompt) {
      throw new Error('Claude returned empty prompt');
    }

    console.log(`[ImagePromptGenerator] Generated prompt for ${artifactType} section ${sectionNumber}`);
    console.log(`[ImagePromptGenerator] Prompt length: ${generatedPrompt.length} chars`);

    return generatedPrompt;
  } catch (error) {
    console.error('[ImagePromptGenerator] Error generating prompt:', error);

    // Fallback to generic prompt if Claude fails
    console.warn('[ImagePromptGenerator] Falling back to generic prompt');
    return generateFallbackPrompt(request);
  }
}

/**
 * Get human-readable description of artifact type for better Claude context
 */
function getArtifactTypeDescription(artifactType: ArtifactType): string {
  const descriptions = {
    elia15: "Explain Like I'm 15 (simplified explanation for young adults)",
    business_narrative: "Business Narrative (investor-focused commercial pitch)",
    golden_circle: "Golden Circle (why-how-what strategic framework)",
  };

  return descriptions[artifactType] || artifactType;
}

/**
 * Generate a basic fallback prompt if Claude fails
 * Better than hardcoded prompts because it still uses section title
 */
function generateFallbackPrompt(request: ImagePromptRequest): string {
  const { sectionTitle, sectionContent } = request;

  // Extract first sentence or use title
  const firstSentence = sectionContent.split('.')[0] || sectionTitle;

  return `Simple hand-drawn sketch illustrating "${sectionTitle}", quick diagram with blue, red, green, and black pens, showing concept of ${firstSentence}, loose sketchy style, minimal detail, like quick working notes, graph paper background visible, 16:9 aspect ratio`;
}

/**
 * Batch generate prompts for multiple sections
 * Useful for generating all prompts for an artifact at once
 */
export async function generateBatchImagePrompts(
  requests: ImagePromptRequest[]
): Promise<Map<number, string>> {
  const prompts = new Map<number, string>();

  for (const request of requests) {
    try {
      const prompt = await generateImagePrompt(request);
      prompts.set(request.sectionNumber, prompt);
    } catch (error) {
      console.error(`Error generating prompt for section ${request.sectionNumber}:`, error);
      // Continue with other sections even if one fails
    }
  }

  return prompts;
}
