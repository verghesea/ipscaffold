import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface SectionImagePrompt {
  sectionHeading: string;
  sectionOrder: number;
  dallePrompt: string;
  sectionContent: string;
}

export async function analyzeArtifactForImages(
  artifactContent: string,
  artifactType: 'elia15' | 'business_narrative' | 'golden_circle',
  patentTitle: string
): Promise<SectionImagePrompt[]> {
  const styleGuide = getStyleGuide(artifactType);
  
  const prompt = `You are an expert at creating visual concepts for technical and business content.

Analyze the following ${getArtifactDisplayName(artifactType)} document and identify the main sections that would benefit from a visual illustration.

For each section, create an optimized DALL-E prompt that will generate a professional, minimalist illustration that captures the essence of that section's content.

IMPORTANT GUIDELINES:
- Create prompts for a maximum of 3-4 key sections (the most important ones)
- Each prompt should be 1-2 sentences, very specific and descriptive
- Use this visual style: ${styleGuide}
- Avoid text, labels, or words in the images
- Focus on concepts, metaphors, and visual representations
- Make prompts specific to the actual content, not generic

Patent Title: ${patentTitle}

Document Content:
${artifactContent}

Respond in this exact JSON format (no markdown, just raw JSON):
[
  {
    "sectionHeading": "The exact heading from the document",
    "sectionOrder": 1,
    "dallePrompt": "Your optimized DALL-E prompt here"
  }
]`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Failed to parse image prompt response:', responseText);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      sectionHeading: string;
      sectionOrder: number;
      dallePrompt: string;
    }>;

    return parsed.map((item, index) => ({
      sectionHeading: item.sectionHeading,
      sectionOrder: item.sectionOrder || index + 1,
      dallePrompt: item.dallePrompt,
      sectionContent: extractSectionContent(artifactContent, item.sectionHeading)
    }));
  } catch (error) {
    console.error('Error analyzing artifact for images:', error);
    return [];
  }
}

function getStyleGuide(artifactType: string): string {
  switch (artifactType) {
    case 'elia15':
      return 'Warm, approachable illustration style with amber/gold tones. Hand-drawn feel, educational and friendly. Think textbook diagrams meets modern infographic.';
    case 'business_narrative':
      return 'Professional, corporate illustration style with blue tones. Clean lines, business-focused imagery. Think investor pitch deck visuals.';
    case 'golden_circle':
      return 'Strategic, conceptual illustration style with purple tones. Abstract representations of purpose and methodology. Think TED talk visual aids.';
    default:
      return 'Professional, minimalist illustration with clean lines and muted colors.';
  }
}

function getArtifactDisplayName(artifactType: string): string {
  switch (artifactType) {
    case 'elia15':
      return 'ELIA15 (simplified explanation)';
    case 'business_narrative':
      return 'Business Narrative';
    case 'golden_circle':
      return 'Golden Circle (WHY/HOW/WHAT)';
    default:
      return artifactType;
  }
}

function extractSectionContent(fullContent: string, heading: string): string {
  const lines = fullContent.split('\n');
  let capturing = false;
  let content: string[] = [];
  
  for (const line of lines) {
    if (line.includes(heading) || line.replace(/[#*]/g, '').trim() === heading.replace(/[#*]/g, '').trim()) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (line.match(/^#{1,3}\s/) || line.match(/^\*\*[^*]+\*\*$/)) {
        break;
      }
      content.push(line);
    }
  }
  
  return content.join('\n').trim().substring(0, 500);
}
