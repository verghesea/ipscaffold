/**
 * Section Parser - Extracts sections from markdown content
 * Sections are defined by ## headers
 */

export interface ParsedSection {
  number: number;
  title: string;
  content: string;
  level: number;
}

/**
 * Parses markdown content into sections based on ## headers (level 2)
 *
 * Example input:
 * ```
 * ## Introduction
 * This is the intro content.
 *
 * ## The Invention
 * This is the invention content.
 * ```
 *
 * Example output:
 * ```
 * [
 *   { number: 1, title: "Introduction", content: "This is the intro content.", level: 2 },
 *   { number: 2, title: "The Invention", content: "This is the invention content.", level: 2 }
 * ]
 * ```
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
        level: 2,
      };
    } else if (currentSection) {
      // Add line to current section content
      currentSection.content += line + '\n';
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
 * Counts the total number of sections in markdown
 */
export function countSections(markdown: string): number {
  return parseMarkdownSections(markdown).length;
}

/**
 * Validates that markdown has the expected number of sections
 */
export function validateSectionCount(
  markdown: string,
  expectedCount: number
): boolean {
  return countSections(markdown) === expectedCount;
}
