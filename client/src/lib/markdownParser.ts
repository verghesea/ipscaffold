/**
 * Client-side markdown section parser
 * Mirrors server-side logic in server/services/sectionParser.ts
 */

import type { SectionImage } from './api';

export interface ParsedSection {
  number: number;
  title: string;
  content: string;
  rawLines: string[];
}

/**
 * Parses markdown content into sections based on ## headers
 *
 * Example:
 * ## Introduction
 * This is the intro.
 *
 * ## The Invention
 * This is the invention.
 *
 * Returns: [
 *   { number: 1, title: "Introduction", content: "This is the intro.", rawLines: [...] },
 *   { number: 2, title: "The Invention", content: "This is the invention.", rawLines: [...] }
 * ]
 */
export function parseMarkdownSections(markdown: string): ParsedSection[] {
  const lines = markdown.split('\n');
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  let sectionNumber = 0;

  for (const line of lines) {
    // Check for ## header (level 2)
    const headerMatch = line.match(/^##\s+(.+)$/);

    if (headerMatch) {
      // Save previous section if exists
      if (currentSection) {
        sections.push({
          ...currentSection,
          content: currentSection.content.trim(),
        });
      }

      // Start new section
      sectionNumber++;
      currentSection = {
        number: sectionNumber,
        title: headerMatch[1].trim(),
        content: '',
        rawLines: [line],
      };
    } else if (currentSection) {
      // Add line to current section
      currentSection.content += line + '\n';
      currentSection.rawLines.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection) {
    sections.push({
      ...currentSection,
      content: currentSection.content.trim(),
    });
  }

  return sections;
}

/**
 * Maps section images to sections by section_number
 * Returns a Map for O(1) lookup
 */
export function mapImagesToSections(
  sections: ParsedSection[],
  images: SectionImage[]
): Map<number, SectionImage> {
  const imageMap = new Map<number, SectionImage>();
  for (const image of images) {
    imageMap.set(image.section_number, image);
  }
  return imageMap;
}

/**
 * Gets a specific section by number
 */
export function getSectionByNumber(
  markdown: string,
  sectionNumber: number
): ParsedSection | null {
  const sections = parseMarkdownSections(markdown);
  return sections.find(s => s.number === sectionNumber) || null;
}

/**
 * Counts total sections in markdown
 */
export function countSections(markdown: string): number {
  return parseMarkdownSections(markdown).length;
}
