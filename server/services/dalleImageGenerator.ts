import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export interface GeneratedImage {
  imageUrl: string;
  revisedPrompt?: string;
  size: string;
}

export async function generateSectionImage(
  dallePrompt: string,
  artifactType: 'elia15' | 'business_narrative' | 'golden_circle'
): Promise<GeneratedImage | null> {
  const colorScheme = getColorScheme(artifactType);
  
  const fullPrompt = `${dallePrompt}

Style requirements:
- ${colorScheme}
- Minimalist, professional illustration
- No text, labels, or words
- Clean white or light gradient background
- Subtle, sophisticated color palette
- High quality, suitable for business documents`;

  console.log('\n=== DALL-E Image Generation ===');
  console.log('Artifact Type:', artifactType);
  console.log('Full Prompt:', fullPrompt);
  console.log('================================\n');

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',
    });

    if (response.data && response.data[0]) {
      return {
        imageUrl: response.data[0].url || '',
        revisedPrompt: response.data[0].revised_prompt,
        size: '1024x1024'
      };
    }

    return null;
  } catch (error) {
    console.error('DALL-E generation error:', error);
    return null;
  }
}

function getColorScheme(artifactType: string): string {
  switch (artifactType) {
    case 'elia15':
      return 'Warm amber and gold tones (#F59E0B, #D97706), with touches of cream and soft orange';
    case 'business_narrative':
      return 'Professional blue tones (#3B82F6, #1E40AF), with touches of navy and light blue';
    case 'golden_circle':
      return 'Rich purple tones (#8B5CF6, #6D28D9), with touches of violet and lavender';
    default:
      return 'Neutral professional tones';
  }
}

export async function downloadAndStoreImage(
  imageUrl: string,
  supabaseClient: any,
  fileName: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    
    const imageBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(imageBuffer);

    const { data, error } = await supabaseClient.storage
      .from('section-images')
      .upload(fileName, uint8Array, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      console.error('Supabase storage error:', error);
      return null;
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from('section-images')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error downloading and storing image:', error);
    return null;
  }
}
