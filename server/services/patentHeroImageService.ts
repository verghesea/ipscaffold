/**
 * Patent Hero Image Service - Generates thumbnail/hero images for patent tiles
 *
 * Creates a single overview image per patent (not per artifact/section).
 * Used on dashboard tiles to give visual identity to each patent.
 *
 * Format: Square 1024x1024 (perfect for tiles)
 * Style: Same 4-color pen sketch aesthetic as section images
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { uploadImageFromUrl } from './imageStorage';
import { extractELIA15Introduction } from './titleGenerator';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerateHeroImageRequest {
  patentId: string;
  elia15Content: string;
  patentTitle: string;
  friendlyTitle?: string;
}

export interface HeroImageResult {
  imageUrl: string;
  promptUsed: string;
  revisedPrompt?: string;
  costUSD: number;
  generationTimeSeconds: number;
}

/**
 * Generate a hero/thumbnail image for a patent
 *
 * Uses ELIA15 introduction to understand the invention,
 * then creates an overview sketch that captures the essence.
 *
 * Cost: ~$0.04 (DALL-E standard) + ~$0.001 (Claude prompt) = $0.041
 * Time: ~30-40 seconds total
 */
export async function generatePatentHeroImage(
  request: GenerateHeroImageRequest
): Promise<HeroImageResult> {
  const { patentId, elia15Content, patentTitle, friendlyTitle } = request;

  console.log(`[HeroImage] Generating hero image for patent ${patentId}`);

  // Extract introduction for context
  const introduction = extractELIA15Introduction(elia15Content);

  // Generate patent-specific hero prompt using Claude
  const prompt = await generateHeroImagePrompt({
    patentTitle: friendlyTitle || patentTitle,
    introduction,
  });

  console.log(`[HeroImage] Using prompt: ${prompt.substring(0, 100)}...`);

  // Generate square image with DALL-E
  const startTime = Date.now();

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    size: '1024x1024', // Square format for tiles
    quality: 'standard',
    n: 1,
  });

  const generationTime = Math.round((Date.now() - startTime) / 1000);

  if (!response.data[0]?.url) {
    throw new Error('No image URL returned from DALL-E');
  }

  console.log(`[HeroImage] Image generated in ${generationTime}s, uploading to storage...`);

  // Upload to Supabase Storage
  const imageUrl = await uploadImageFromUrl(
    response.data[0].url,
    `hero-${patentId}`,
    0 // Use 0 for hero images
  );

  console.log(`[HeroImage] ✓ Hero image created for patent ${patentId}`);

  return {
    imageUrl,
    promptUsed: prompt,
    revisedPrompt: response.data[0].revised_prompt,
    costUSD: 0.04, // Standard quality
    generationTimeSeconds: generationTime,
  };
}

/**
 * Generate a hero-specific image prompt using Claude
 *
 * Different from section prompts - focuses on OVERALL concept,
 * not specific details. Should capture the essence at a glance.
 */
async function generateHeroImagePrompt({
  patentTitle,
  introduction,
}: {
  patentTitle: string;
  introduction: string;
}): Promise<string> {
  const systemPrompt = `You are an expert at creating image generation prompts for patent overview/hero images.

Your task is to read the patent title and introduction, then create a prompt for a simple overview sketch that captures the ESSENCE of the invention at a glance.

STYLE REQUIREMENTS (CRITICAL):
- Simple hand-drawn sketch style (like quick working notes)
- Use only 4 colors: blue, red, green, and black pens
- Minimal detail, loose sketchy linework
- Graph paper background visible
- Square 1:1 aspect ratio (not 16:9)
- Look like a quick concept sketch during brainstorming

CONTENT REQUIREMENTS:
- Illustrate the OVERALL concept (not specific technical details)
- Focus on the main visual metaphor or key innovation
- Should be recognizable even at thumbnail size
- Use simple shapes, icons, or symbols
- Make it conceptually accurate but visually simple

HERO IMAGE SPECIFIC:
- Think "icon" not "diagram" - what represents this patent?
- Should work as a visual identity/thumbnail
- Capture the "Aha!" moment in one image
- More abstract/symbolic than section images

PROMPT FORMAT:
Write a single paragraph prompt starting with "Simple hand-drawn concept sketch showing..." that describes:
1. The core visual metaphor or symbol for this patent
2. Which colored pens are used and for what elements
3. The sketchy, minimal style
4. Square format, graph paper background

IMPORTANT: Make it ICONIC and MEMORABLE. This is the "face" of the patent.`;

  const userPrompt = `Patent Title: ${patentTitle}

Introduction:
${introduction}

Generate a DALL-E prompt for a simple hero/overview sketch (square format, iconic, captures essence):`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      temperature: 0.7,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const generatedPrompt = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '';

    if (!generatedPrompt) {
      throw new Error('Claude returned empty prompt');
    }

    return generatedPrompt;
  } catch (error) {
    console.error('[HeroImage] Error generating prompt with Claude:', error);
    // Fallback to basic prompt
    return generateFallbackHeroPrompt(patentTitle);
  }
}

/**
 * Generate a basic fallback hero prompt if Claude fails
 */
function generateFallbackHeroPrompt(patentTitle: string): string {
  return `Simple hand-drawn concept sketch representing "${patentTitle}", minimal iconic design with blue, red, green, and black pens, central visual metaphor, loose sketchy style, square format, graph paper background visible`;
}
