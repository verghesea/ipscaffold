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

export interface ImagePromptResult {
  prompt: string;
  title: string; // Human-readable title explaining what the image shows
}

/**
 * Generate a custom image prompt AND descriptive title using Claude
 *
 * Claude analyzes the patent section content and creates:
 * 1. A specific DALL-E prompt for generating the image
 * 2. A descriptive title explaining what the image illustrates
 *
 * Cost: ~$0.001 per prompt (Haiku model)
 * Time: ~2-3 seconds
 */
export async function generateImagePrompt(
  request: ImagePromptRequest
): Promise<ImagePromptResult> {
  const { artifactType, sectionNumber, sectionTitle, sectionContent } = request;

  const systemPrompt = `You are an expert at creating image generation prompts for AI image generators like DALL-E and Stable Diffusion.

Your task is to read patent section content and create:
1. A DALL-E prompt for a simple 4-color pen sketch
2. A descriptive title that explains what the image illustrates

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

OUTPUT FORMAT - Return your response in this exact format:

TITLE: [A concise 1-2 sentence description of what this image shows and why it matters for understanding this section]

PROMPT: [Single paragraph starting with "Simple hand-drawn sketch showing..." that describes what to draw, which colors to use, and the sketchy style]

IMPORTANT: Make both the title and prompt SPECIFIC to the content provided. Avoid generic descriptions.`;

  const userPrompt = `Create an image prompt and title for this patent section:

**Artifact Type:** ${getArtifactTypeDescription(artifactType)}
**Section ${sectionNumber}: ${sectionTitle}**

**Content:**
${sectionContent}

Generate both a descriptive TITLE and a DALL-E PROMPT following the exact format specified.`;

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

    const generatedText = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '';

    if (!generatedText) {
      throw new Error('Claude returned empty response');
    }

    // Parse the structured response
    const titleMatch = generatedText.match(/TITLE:\s*(.+?)(?=\n\nPROMPT:|$)/is);
    const promptMatch = generatedText.match(/PROMPT:\s*(.+?)$/is);

    const title = titleMatch?.[1]?.trim() || generateFallbackTitle(request);
    const prompt = promptMatch?.[1]?.trim() || generateFallbackPrompt(request).prompt;

    console.log(`[ImagePromptGenerator] Generated for ${artifactType} section ${sectionNumber}`);
    console.log(`[ImagePromptGenerator] Title: ${title.substring(0, 80)}...`);
    console.log(`[ImagePromptGenerator] Prompt length: ${prompt.length} chars`);

    return { prompt, title };
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
 * Generate a basic fallback title if parsing fails
 */
function generateFallbackTitle(request: ImagePromptRequest): string {
  const { sectionTitle } = request;
  return `Illustration of ${sectionTitle}`;
}

/**
 * Generate a basic fallback prompt if Claude fails
 * Better than hardcoded prompts because it still uses section title
 */
function generateFallbackPrompt(request: ImagePromptRequest): ImagePromptResult {
  const { sectionTitle, sectionContent } = request;

  // Extract first sentence or use title
  const firstSentence = sectionContent.split('.')[0] || sectionTitle;

  return {
    title: generateFallbackTitle(request),
    prompt: `Simple hand-drawn sketch illustrating "${sectionTitle}", quick diagram with blue, red, green, and black pens, showing concept of ${firstSentence}, loose sketchy style, minimal detail, like quick working notes, graph paper background visible, 16:9 aspect ratio`,
  };
}

/**
 * Batch generate prompts and titles for multiple sections
 * Useful for generating all prompts for an artifact at once
 */
export async function generateBatchImagePrompts(
  requests: ImagePromptRequest[]
): Promise<Map<number, ImagePromptResult>> {
  const results = new Map<number, ImagePromptResult>();

  for (const request of requests) {
    try {
      const result = await generateImagePrompt(request);
      results.set(request.sectionNumber, result);
    } catch (error) {
      console.error(`Error generating prompt for section ${request.sectionNumber}:`, error);
      // Continue with other sections even if one fails
    }
  }

  return results;
}
