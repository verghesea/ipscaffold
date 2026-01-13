import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Section } from './sectionParser';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Initialize Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Minimalist hand-drawn style specification
const STYLE_PROMPT = `Minimalist hand-drawn black line illustration, single continuous stroke, editorial sketch style, no shading, no color, no background, simple symbolic object, loose and organic lines, white background, understated, thoughtful, strategy-document aesthetic`;

export interface ImageGenerationResult {
  imageUrl: string;
  dallePrompt: string;
  cost: number;
}

/**
 * Generates a DALL-E image for a specific section of an artifact.
 *
 * @param sectionHeading - The section header (e.g., "Introduction", "WHY")
 * @param sectionContent - The content of the section for context
 * @param patentTitle - The patent title for additional context
 * @returns Object with imageUrl, dallePrompt, and cost
 */
export async function generateSectionImage(
  sectionHeading: string,
  sectionContent: string,
  patentTitle: string
): Promise<ImageGenerationResult> {

  // Build DALL-E prompt with style + context
  const conceptSummary = sectionContent.substring(0, 300); // First 300 chars for context
  const dallePrompt = `${STYLE_PROMPT}, representing: ${sectionHeading} from patent "${patentTitle}". Concept: ${conceptSummary}. Single symbolic illustration only.`;

  console.log(`Generating image for section: ${sectionHeading}`);

  try {
    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: dallePrompt,
      size: "1024x1024",
      quality: "standard",
      style: "natural",
      n: 1,
    });

    const tempImageUrl = response.data[0].url;
    if (!tempImageUrl) {
      throw new Error('DALL-E did not return an image URL');
    }

    // Download image from OpenAI's temporary URL
    const imageResponse = await fetch(tempImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Upload to Supabase Storage
    const fileName = `${Date.now()}-${sectionHeading.replace(/\s+/g, '-').toLowerCase()}.png`;
    const { data, error } = await supabaseAdmin.storage
      .from('section-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('section-images')
      .getPublicUrl(fileName);

    const cost = 0.040; // $0.04 per 1024x1024 image with DALL-E 3

    console.log(`✓ Generated image for: ${sectionHeading}`);

    return { imageUrl: publicUrl, dallePrompt, cost };

  } catch (error) {
    console.error(`Failed to generate image for ${sectionHeading}:`, error);
    throw error;
  }
}

/**
 * Generates DALL-E images for all sections in an artifact.
 * Images are generated sequentially to avoid rate limits.
 *
 * @param artifactId - The artifact ID to associate images with
 * @param sections - Array of parsed sections from the artifact
 * @param patentTitle - The patent title for context
 * @param storage - Storage service instance for database operations
 */
export async function generateAllSectionImages(
  artifactId: number,
  sections: Section[],
  patentTitle: string,
  storage: any // Will be typed properly when we extend supabaseStorage
): Promise<void> {
  console.log(`Generating ${sections.length} images for artifact ${artifactId}`);

  // Generate images sequentially to avoid rate limits
  for (const section of sections) {
    try {
      const result = await generateSectionImage(
        section.heading,
        section.content,
        patentTitle
      );

      // Save to database
      await storage.createSectionImage({
        artifactId,
        sectionHeading: section.heading,
        sectionOrder: section.order,
        imageUrl: result.imageUrl,
        dallePrompt: result.dallePrompt,
        imageSize: '1024x1024',
        generationCost: result.cost.toString(),
      });

      console.log(`✓ Saved image record for: ${section.heading}`);

      // Rate limiting: wait 1 second between requests to avoid OpenAI rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`Failed to generate image for ${section.heading}:`, error);
      // Continue with other sections even if one fails
      // This ensures partial completion rather than complete failure
    }
  }

  console.log(`Completed image generation for artifact ${artifactId}`);
}
