/**
 * Title Generator - Uses Claude to create friendly, accessible patent titles
 *
 * Transforms technical patent office titles into short, friendly titles
 * that explain what the invention does in plain language.
 *
 * Examples:
 * - "SYSTEMS AND METHODS FOR..." → "Wireless Charging Without Contact"
 * - "APPARATUS FOR..." → "Understanding Natural Language"
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface GenerateTitleRequest {
  patentTitle: string; // Original technical title
  elia15Introduction: string; // First section of ELIA15
}

/**
 * Generate a friendly, accessible title from patent content
 *
 * Cost: ~$0.001 per title (Haiku model)
 * Time: ~2-3 seconds
 */
export async function generateFriendlyTitle(
  request: GenerateTitleRequest
): Promise<string> {
  const { patentTitle, elia15Introduction } = request;

  const systemPrompt = `You are an expert at creating accessible, friendly titles for patents.

Your task is to read the original patent title and ELIA15 introduction, then create a SHORT, FRIENDLY title that:
- Explains WHAT the invention does (not HOW)
- Uses plain language (no jargon like "systems and methods")
- Is 3-8 words long (max 60 characters)
- Sounds interesting and accessible
- Focuses on the benefit or purpose

Examples:
- Original: "SYSTEMS AND METHODS FOR WIRELESS POWER TRANSFER USING MAGNETIC RESONANCE COUPLING"
  Friendly: "Wireless Charging Without Contact"

- Original: "APPARATUS AND METHOD FOR PROCESSING NATURAL LANGUAGE QUERIES USING SEMANTIC ANALYSIS"
  Friendly: "Understanding Natural Language Questions"

- Original: "BIODEGRADABLE POLYMER COMPOSITION FOR MEDICAL IMPLANTS"
  Friendly: "Dissolving Medical Implants"

- Original: "METHOD FOR DETECTING ANOMALIES IN NETWORK TRAFFIC USING MACHINE LEARNING"
  Friendly: "Detecting Suspicious Network Activity"

Output ONLY the friendly title, nothing else. No quotes, no explanation.`;

  const userPrompt = `Original Patent Title: ${patentTitle}

ELIA15 Introduction:
${elia15Introduction.substring(0, 800)}

Generate a friendly title (3-8 words, max 60 chars):`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast and cheap
      max_tokens: 50,
      temperature: 0.5,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    let friendlyTitle = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : patentTitle;

    // Remove quotes if Claude added them
    friendlyTitle = friendlyTitle.replace(/^["']|["']$/g, '');

    // Validate length
    if (friendlyTitle.length > 60) {
      // Truncate and add ellipsis
      friendlyTitle = friendlyTitle.substring(0, 57) + '...';
    }

    // If result is too similar to original or invalid, use fallback
    if (friendlyTitle.length < 10 || friendlyTitle === patentTitle) {
      return generateFallbackTitle(patentTitle);
    }

    console.log(`[TitleGenerator] Generated: "${friendlyTitle}"`);
    return friendlyTitle;
  } catch (error) {
    console.error('[TitleGenerator] Error generating friendly title:', error);
    return generateFallbackTitle(patentTitle);
  }
}

/**
 * Generate a basic fallback title if Claude fails
 * Removes common patent jargon and shortens
 */
function generateFallbackTitle(originalTitle: string): string {
  let title = originalTitle;

  // Remove common jargon
  title = title.replace(/SYSTEMS? AND METHODS? FOR/gi, '');
  title = title.replace(/APPARATUS AND METHOD FOR/gi, '');
  title = title.replace(/METHOD FOR/gi, '');
  title = title.replace(/APPARATUS FOR/gi, '');
  title = title.replace(/DEVICE FOR/gi, '');
  title = title.replace(/SYSTEM FOR/gi, '');

  // Trim and take first 60 chars
  title = title.trim();
  if (title.length > 60) {
    title = title.substring(0, 57) + '...';
  }

  // Capitalize properly
  title = title
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return title || 'Untitled Patent';
}

/**
 * Extract introduction section from ELIA15 content
 * Returns first section (usually "Introduction" or similar)
 */
export function extractELIA15Introduction(elia15Content: string): string {
  const lines = elia15Content.split('\n');
  const introduction: string[] = [];
  let foundFirstSection = false;

  for (const line of lines) {
    // Check for ## header (level 2)
    if (line.match(/^##\s+/)) {
      if (foundFirstSection) break; // Stop at second section
      foundFirstSection = true;
      continue; // Skip the header itself
    }

    if (foundFirstSection) {
      introduction.push(line);
    }
  }

  return introduction.join('\n').substring(0, 800);
}
