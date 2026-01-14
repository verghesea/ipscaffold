import { createClient } from '@supabase/supabase-js';
import { analyzeArtifactForImages, SectionImagePrompt } from './imagePromptAnalyzer';
import { generateSectionImage, downloadAndStoreImage } from './dalleImageGenerator';
import { nanoid } from 'nanoid';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface SectionImage {
  id: string;
  artifactId: string;
  sectionHeading: string;
  sectionOrder: number;
  imageUrl: string;
  dallePrompt: string;
  imageSize: string;
  generationCost: number;
}

export async function generateImagesForArtifact(
  artifactId: string,
  artifactContent: string,
  artifactType: 'elia15' | 'business_narrative' | 'golden_circle',
  patentTitle: string
): Promise<SectionImage[]> {
  console.log(`\n=== Starting Image Generation for ${artifactType.toUpperCase()} ===`);
  console.log('Artifact ID:', artifactId);
  console.log('Patent Title:', patentTitle);

  const sectionPrompts = await analyzeArtifactForImages(
    artifactContent,
    artifactType,
    patentTitle
  );

  console.log(`Found ${sectionPrompts.length} sections for image generation:`);
  sectionPrompts.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.sectionHeading}`);
    console.log(`     Prompt: ${s.dallePrompt.substring(0, 100)}...`);
  });

  const generatedImages: SectionImage[] = [];
  const COST_PER_IMAGE = 0.04;

  for (const section of sectionPrompts) {
    try {
      console.log(`\nGenerating image for: "${section.sectionHeading}"`);
      
      const generatedImage = await generateSectionImage(section.dallePrompt, artifactType);
      
      if (!generatedImage) {
        console.error(`Failed to generate image for section: ${section.sectionHeading}`);
        continue;
      }

      const fileName = `${artifactId}/${nanoid(10)}.png`;
      const storedUrl = await downloadAndStoreImage(
        generatedImage.imageUrl,
        supabase,
        fileName
      );

      if (!storedUrl) {
        console.error(`Failed to store image for section: ${section.sectionHeading}`);
        continue;
      }

      const { data: insertedImage, error } = await supabase
        .from('section_images')
        .insert({
          artifact_id: artifactId,
          section_heading: section.sectionHeading,
          section_order: section.sectionOrder,
          image_url: storedUrl,
          dalle_prompt: section.dallePrompt,
          image_size: generatedImage.size,
          generation_cost: COST_PER_IMAGE
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting section_image record:', error);
        continue;
      }

      console.log(`Successfully generated and stored image for: "${section.sectionHeading}"`);
      
      generatedImages.push({
        id: insertedImage.id,
        artifactId: insertedImage.artifact_id,
        sectionHeading: insertedImage.section_heading,
        sectionOrder: insertedImage.section_order,
        imageUrl: insertedImage.image_url,
        dallePrompt: insertedImage.dalle_prompt,
        imageSize: insertedImage.image_size,
        generationCost: insertedImage.generation_cost
      });
    } catch (error) {
      console.error(`Error generating image for section "${section.sectionHeading}":`, error);
    }
  }

  console.log(`\n=== Completed Image Generation for ${artifactType.toUpperCase()} ===`);
  console.log(`Generated ${generatedImages.length} of ${sectionPrompts.length} images`);

  return generatedImages;
}

export async function getImagesForArtifact(artifactId: string): Promise<SectionImage[]> {
  const { data, error } = await supabase
    .from('section_images')
    .select('*')
    .eq('artifact_id', artifactId)
    .order('section_order', { ascending: true });

  if (error) {
    console.error('Error fetching section images:', error);
    return [];
  }

  return (data || []).map(img => ({
    id: img.id,
    artifactId: img.artifact_id,
    sectionHeading: img.section_heading,
    sectionOrder: img.section_order,
    imageUrl: img.image_url,
    dallePrompt: img.dalle_prompt,
    imageSize: img.image_size,
    generationCost: img.generation_cost
  }));
}
