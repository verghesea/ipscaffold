export interface Section {
  heading: string;
  content: string;
  order: number;
}

/**
 * Parses markdown artifact content into structured sections based on ## headers.
 * This enables automated image generation for each section.
 *
 * @param content - The markdown content with ## headers
 * @returns Array of Section objects with heading, content, and order
 */
export function parseArtifactSections(content: string): Section[] {
  const sections: Section[] = [];

  // Split by ## headers
  const lines = content.split('\n');
  let currentSection: Section | null = null;
  let order = 0;

  for (const line of lines) {
    if (line.trim().startsWith('## ')) {
      // Save previous section if exists
      if (currentSection) {
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        heading: line.replace('## ', '').trim(),
        content: '',
        order: order++,
      };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }
  }

  // Save last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}
