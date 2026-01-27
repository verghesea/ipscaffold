/**
 * PDF Generation Service
 * Converts patent artifacts to downloadable PDFs with embedded images
 *
 * Design System:
 * - Clean professional layout with subtle graph paper on cover only
 * - Top accent gradient (blue -> green -> red)
 * - Typography: Playfair Display (headings), Work Sans (body)
 * - Color-coded artifact types (amber, blue, purple)
 * - Professional editorial layout with proper page breaks
 */

import PDFDocument from 'pdfkit';
import path from 'path';
import { supabaseStorage } from '../supabaseStorage.js';
import type { Artifact, SectionImage } from '../supabaseStorage.js';
import { addWatermark } from './imageWatermarkService.js';

// Font paths - using custom fonts to match website design
const FONTS = {
  // Playfair Display for headings
  playfairRegular: path.join(process.cwd(), 'server/assets/fonts/PlayfairDisplay-Regular.ttf'),
  playfairSemiBold: path.join(process.cwd(), 'server/assets/fonts/PlayfairDisplay-SemiBold.ttf'),
  playfairBold: path.join(process.cwd(), 'server/assets/fonts/PlayfairDisplay-Bold.ttf'),
  // Work Sans for body text
  workSansLight: path.join(process.cwd(), 'server/assets/fonts/WorkSans-Light.ttf'),
  workSansRegular: path.join(process.cwd(), 'server/assets/fonts/WorkSans-Regular.ttf'),
  workSansMedium: path.join(process.cwd(), 'server/assets/fonts/WorkSans-Medium.ttf'),
  workSansSemiBold: path.join(process.cwd(), 'server/assets/fonts/WorkSans-SemiBold.ttf'),
};

// Registered font names for use in the document
const FONT_NAMES = {
  // Headings
  h1: 'Playfair-Bold',
  h2: 'Playfair-SemiBold',
  h3: 'Playfair-Regular',
  // Body text
  body: 'Work-Sans',
  bodyMedium: 'Work-Sans-Medium',
  bodySemiBold: 'Work-Sans-SemiBold',
  bodyLight: 'Work-Sans-Light',
};

/**
 * Register custom fonts with the PDF document
 */
function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont(FONT_NAMES.h1, FONTS.playfairBold);
  doc.registerFont(FONT_NAMES.h2, FONTS.playfairSemiBold);
  doc.registerFont(FONT_NAMES.h3, FONTS.playfairRegular);
  doc.registerFont(FONT_NAMES.body, FONTS.workSansRegular);
  doc.registerFont(FONT_NAMES.bodyMedium, FONTS.workSansMedium);
  doc.registerFont(FONT_NAMES.bodySemiBold, FONTS.workSansSemiBold);
  doc.registerFont(FONT_NAMES.bodyLight, FONTS.workSansLight);
}

interface PDFGenerationOptions {
  includeImages?: boolean;
  watermarkImages?: boolean;
}

interface PDFResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

// Layout constants for better content distribution
const LAYOUT = {
  // Reduced margins for more content space
  margins: { top: 50, bottom: 50, left: 54, right: 54 },
  // Spacing between elements (tighter than before)
  headingSpaceBefore: { h1: 12, h2: 10, h3: 6 },
  headingSpaceAfter: { h1: 6, h2: 4, h3: 3 },
  paragraphSpaceAfter: 8,
  listItemSpaceAfter: 4,
  // Minimum space needed for content before forcing page break
  minHeadingSpace: 80, // Space needed for heading + some content
  minImageSpace: 180,  // Space needed for image container
};

// Design constants matching frontend
const COLORS = {
  // Primary text colors
  black: '#1f2937',
  darkGray: '#374151',
  mediumGray: '#6b7280',
  lightGray: '#9ca3af',

  // Accent gradient colors
  blue: '#2563eb',
  green: '#059669',
  red: '#dc2626',

  // Artifact type colors
  amber: {
    primary: '#d97706',
    light: '#fef3c7',
    border: '#fcd34d',
  },
  blueType: {
    primary: '#2563eb',
    light: '#dbeafe',
    border: '#93c5fd',
  },
  purple: {
    primary: '#9333ea',
    light: '#f3e8ff',
    border: '#c4b5fd',
  },

  // Background
  paper: '#fffdf7',
  graphLine: '#e8e8e8',
  graphLineDark: '#d4d4d4',
};

// Artifact type configurations matching frontend ARTIFACT_TYPES
const ARTIFACT_CONFIG: Record<string, {
  label: string;
  tagline: string;
  emoji: string;
  color: typeof COLORS.amber;
}> = {
  elia15: {
    label: 'Scientific Narrative',
    tagline: "Explain Like I'm 15",
    emoji: '💡',
    color: COLORS.amber,
  },
  business_narrative: {
    label: 'Business Narrative',
    tagline: 'Commercial Strategy',
    emoji: '📈',
    color: COLORS.blueType,
  },
  golden_circle: {
    label: 'Golden Circle',
    tagline: 'Why • How • What',
    emoji: '🎯',
    color: COLORS.purple,
  },
};

/**
 * Parse markdown content into structured sections
 */
function parseMarkdownSections(markdown: string): Array<{ type: string; content: string; level?: number }> {
  const lines = markdown.split('\n');
  const sections: Array<{ type: string; content: string; level?: number }> = [];

  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      sections.push({
        type: 'paragraph',
        content: currentParagraph.join('\n').trim(),
      });
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    // Heading detection
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      sections.push({
        type: 'heading',
        content: headingMatch[2].trim(),
        level: headingMatch[1].length,
      });
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    // List items
    if (line.match(/^[\-\*]\s+/) || line.match(/^\d+\.\s+/)) {
      flushParagraph();
      sections.push({
        type: 'list-item',
        content: line.replace(/^[\-\*]\s+/, '').replace(/^\d+\.\s+/, ''),
      });
      continue;
    }

    // Regular text - accumulate into paragraph
    currentParagraph.push(line);
  }

  flushParagraph();

  return sections;
}

/**
 * Fetch image buffer from URL and optionally apply watermark
 * @param imageUrl - URL of the image to fetch
 * @param applyWatermark - Whether to apply watermark (default: false)
 * @returns Image buffer (watermarked if requested)
 */
async function fetchImageBuffer(imageUrl: string, applyWatermark: boolean = false): Promise<Buffer | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    let imageBuffer = Buffer.from(arrayBuffer);

    // Apply watermark if requested
    if (applyWatermark) {
      try {
        imageBuffer = await addWatermark(imageBuffer, {
          position: 'bottom-right',
          opacity: 0.7,
          scale: 0.15,
        });
      } catch (error) {
        console.warn('Failed to apply watermark, using original image:', error);
        // Continue with unwatermarked image if watermarking fails
      }
    }

    return imageBuffer;
  } catch (error) {
    console.error('Failed to fetch image:', error);
    return null;
  }
}

/**
 * Draw a simple clean background (optimized for file size)
 * Only used on cover page for visual appeal
 */
function drawCoverBackground(doc: PDFKit.PDFDocument) {
  const { width, height } = doc.page;

  // Save graphics state
  doc.save();

  // Fill background with warm off-white
  doc.rect(0, 0, width, height).fill(COLORS.paper);

  // Draw a subtle, simplified grid pattern (fewer lines = smaller file size)
  const gridSpacing = 24; // Larger spacing = fewer lines
  doc.strokeColor(COLORS.graphLine)
    .lineWidth(0.3)
    .opacity(0.25);

  // Draw lines in a single path for efficiency
  for (let x = 0; x < width; x += gridSpacing) {
    doc.moveTo(x, 0).lineTo(x, height);
  }
  for (let y = 0; y < height; y += gridSpacing) {
    doc.moveTo(0, y).lineTo(width, y);
  }
  doc.stroke();

  // Restore graphics state
  doc.restore();
  doc.opacity(1);
}

/**
 * Draw a clean white background for content pages (no grid = smaller file)
 */
function drawContentBackground(doc: PDFKit.PDFDocument) {
  const { width, height } = doc.page;
  doc.rect(0, 0, width, height).fill('#ffffff');
}

/**
 * Draw the top accent gradient bar
 */
function drawTopAccentBar(doc: PDFKit.PDFDocument) {
  const { width } = doc.page;
  const barHeight = 4;

  // Create gradient effect with three segments
  const segmentWidth = width / 3;

  // Blue segment
  doc.rect(0, 0, segmentWidth, barHeight)
    .fill(COLORS.blue);

  // Green segment
  doc.rect(segmentWidth, 0, segmentWidth, barHeight)
    .fill(COLORS.green);

  // Red segment
  doc.rect(segmentWidth * 2, 0, segmentWidth + 1, barHeight)
    .fill(COLORS.red);
}

/**
 * Check if there's enough space on current page, add new page if not
 * Returns true if a new page was added
 */
function ensureSpace(doc: PDFKit.PDFDocument, requiredSpace: number, isContentPage: boolean = true): boolean {
  const availableSpace = doc.page.height - doc.page.margins.bottom - doc.y;
  if (availableSpace < requiredSpace) {
    doc.addPage();
    if (isContentPage) {
      drawContentBackground(doc);
    } else {
      drawCoverBackground(doc);
    }
    drawTopAccentBar(doc);
    doc.y = doc.page.margins.top + 8;
    return true;
  }
  return false;
}

/**
 * Draw artifact header badge (matching frontend ArtifactHeader component)
 */
function drawArtifactHeader(
  doc: PDFKit.PDFDocument,
  artifactNumber: number,
  totalArtifacts: number,
  artifactType: string,
  startY: number
): number {
  const config = ARTIFACT_CONFIG[artifactType] || ARTIFACT_CONFIG.elia15;
  const pageWidth = doc.page.width;
  const margins = doc.page.margins;
  const contentWidth = pageWidth - margins.left - margins.right;

  const boxHeight = 50;  // Reduced from 60
  const numberBoxSize = 36;  // Reduced from 40
  const padding = 10;  // Reduced from 12

  // Draw outer border box
  doc.strokeColor(config.color.primary)
    .lineWidth(2)
    .rect(margins.left, startY, contentWidth, boxHeight)
    .stroke();

  // Draw number box
  doc.strokeColor(config.color.primary)
    .lineWidth(2)
    .rect(margins.left + padding, startY + (boxHeight - numberBoxSize) / 2, numberBoxSize, numberBoxSize)
    .stroke();

  // Draw number inside box
  doc.font(FONT_NAMES.bodySemiBold)
    .fontSize(14)
    .fillColor(config.color.primary)
    .text(
      String(artifactNumber).padStart(2, '0'),
      margins.left + padding,
      startY + (boxHeight - 14) / 2,
      {
        width: numberBoxSize,
        align: 'center',
      }
    );

  // Draw "Artifact X / Y" label
  const textStartX = margins.left + padding + numberBoxSize + 10;

  doc.font(FONT_NAMES.bodyMedium)
    .fontSize(8)
    .fillColor(COLORS.red)
    .text(
      `ARTIFACT ${String(artifactNumber).padStart(2, '0')} / ${String(totalArtifacts).padStart(2, '0')}`,
      textStartX,
      startY + 12,
      { characterSpacing: 1 }
    );

  // Draw artifact label and tagline
  doc.font(FONT_NAMES.h2)
    .fontSize(12)
    .fillColor(COLORS.black)
    .text(
      `${config.label} - ${config.tagline}`,
      textStartX,
      startY + 26,
      { width: contentWidth - numberBoxSize - padding * 3 }
    );

  return startY + boxHeight + 12;  // Reduced spacing after header
}

/**
 * Add page footer with page number and branding
 */
function addPageFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number) {
  const { width, height, margins } = doc.page;
  const footerY = height - 35;

  // Draw separator line
  doc.strokeColor(COLORS.graphLineDark)
    .lineWidth(0.5)
    .moveTo(margins.left, footerY - 8)
    .lineTo(width - margins.right, footerY - 8)
    .stroke();

  // Page number centered
  doc.font(FONT_NAMES.body)
    .fontSize(8)
    .fillColor(COLORS.mediumGray)
    .text(
      `Page ${pageNum} of ${totalPages}`,
      margins.left,
      footerY,
      {
        align: 'center',
        width: width - margins.left - margins.right,
      }
    );

  // Branding on right
  doc.font(FONT_NAMES.bodyMedium)
    .fontSize(7)
    .fillColor(COLORS.lightGray)
    .text(
      'Humble AI',
      width - margins.right - 50,
      footerY,
      {
        width: 50,
        align: 'right',
      }
    );
}

/**
 * Render a styled heading with proper page break handling
 * Returns estimated height needed for the heading
 */
function getHeadingHeight(doc: PDFKit.PDFDocument, content: string, level: number): number {
  const sizes: Record<number, number> = { 1: 18, 2: 14, 3: 12, 4: 11, 5: 10, 6: 10 };
  const fontSize = sizes[level] || 11;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right - 12;

  // Use appropriate Playfair font based on heading level
  const fontName = level === 1 ? FONT_NAMES.h1 : level === 2 ? FONT_NAMES.h2 : FONT_NAMES.h3;
  doc.font(fontName).fontSize(fontSize);
  const textHeight = doc.heightOfString(content, { width: contentWidth });

  // Include space before and after
  const spaceBefore = level <= 2 ? LAYOUT.headingSpaceBefore.h2 : LAYOUT.headingSpaceBefore.h3;
  const spaceAfter = level <= 2 ? LAYOUT.headingSpaceAfter.h2 : LAYOUT.headingSpaceAfter.h3;

  return textHeight + spaceBefore + spaceAfter + LAYOUT.minHeadingSpace;
}

/**
 * Render a styled heading
 */
function renderHeading(doc: PDFKit.PDFDocument, content: string, level: number, artifactColor: typeof COLORS.amber) {
  const sizes: Record<number, number> = { 1: 18, 2: 14, 3: 12, 4: 11, 5: 10, 6: 10 };
  const fontSize = sizes[level] || 11;

  // Add space before major headings (reduced)
  if (level <= 2) {
    doc.y += LAYOUT.headingSpaceBefore.h2;
  } else {
    doc.y += LAYOUT.headingSpaceBefore.h3;
  }

  // For level 2 headings, add a colored accent
  if (level === 2) {
    const currentY = doc.y;
    const margins = doc.page.margins;

    // Draw small accent bar before heading
    doc.rect(margins.left, currentY, 3, fontSize + 2)
      .fill(artifactColor.primary);

    // Draw heading text with indent - use Playfair SemiBold for H2
    doc.font(FONT_NAMES.h2)
      .fontSize(fontSize)
      .fillColor(COLORS.black)
      .text(content, margins.left + 10, currentY, {
        continued: false,
      });
  } else if (level === 1) {
    // Main title - use Playfair Bold for H1
    doc.font(FONT_NAMES.h1)
      .fontSize(fontSize)
      .fillColor(COLORS.black)
      .text(content, {
        continued: false,
      });

    // Add subtle underline
    const textWidth = doc.widthOfString(content);
    doc.strokeColor(artifactColor.primary)
      .lineWidth(1)
      .moveTo(doc.page.margins.left, doc.y + 1)
      .lineTo(doc.page.margins.left + Math.min(textWidth, 180), doc.y + 1)
      .stroke();

    doc.y += 2;
  } else {
    // Other headings (H3+) - Playfair Regular
    doc.font(FONT_NAMES.h3)
      .fontSize(fontSize)
      .fillColor(level === 3 ? COLORS.darkGray : COLORS.mediumGray)
      .text(content, {
        continued: false,
      });
  }

  // Reduced space after headings
  doc.y += level <= 2 ? LAYOUT.headingSpaceAfter.h2 : LAYOUT.headingSpaceAfter.h3;
}

/**
 * Render a paragraph with proper styling - uses Work Sans for readability
 */
function renderParagraph(doc: PDFKit.PDFDocument, content: string) {
  doc.font(FONT_NAMES.body)
    .fontSize(11)
    .fillColor(COLORS.darkGray)
    .text(content, {
      align: 'justify',
      lineGap: 2,
    });
  doc.y += LAYOUT.paragraphSpaceAfter;
}

/**
 * Render a list item with bullet - uses Work Sans for body text
 */
function renderListItem(doc: PDFKit.PDFDocument, content: string, artifactColor: typeof COLORS.amber) {
  const currentY = doc.y;
  const margins = doc.page.margins;

  // Draw bullet point (small filled circle)
  doc.circle(margins.left + 6, currentY + 5, 2)
    .fill(artifactColor.primary);

  // Draw text with indent - use Work Sans
  doc.font(FONT_NAMES.body)
    .fontSize(11)
    .fillColor(COLORS.darkGray)
    .text(content, margins.left + 16, currentY, {
      width: doc.page.width - margins.left - margins.right - 16,
      align: 'left',
      lineGap: 1.5,
    });
  doc.y += LAYOUT.listItemSpaceAfter;
}

/**
 * Render an image with styled container
 */
async function renderImage(
  doc: PDFKit.PDFDocument,
  imageBuffer: Buffer,
  artifactColor: typeof COLORS.amber
) {
  const margins = doc.page.margins;
  const maxWidth = doc.page.width - margins.left - margins.right - 16;
  const maxHeight = 200; // Reduced from 250

  // Calculate total space needed for image container
  const containerHeight = maxHeight + 16;

  // Check if we need a new page - use ensureSpace
  ensureSpace(doc, containerHeight + 20, true);

  const imageStartY = doc.y;

  // Draw image container with border
  doc.strokeColor(artifactColor.border)
    .lineWidth(1)
    .roundedRect(margins.left, imageStartY, maxWidth + 16, containerHeight, 2)
    .stroke();

  // Draw light background
  doc.rect(margins.left + 1, imageStartY + 1, maxWidth + 14, containerHeight - 2)
    .fill('#fafafa');

  // Embed the image
  try {
    doc.image(imageBuffer, margins.left + 8, imageStartY + 8, {
      fit: [maxWidth, maxHeight],
      align: 'center',
      valign: 'center',
    });
  } catch (error) {
    // If image fails, show placeholder text
    doc.font(FONT_NAMES.body)
      .fontSize(9)
      .fillColor(COLORS.lightGray)
      .text('Image could not be rendered', margins.left + 8, imageStartY + maxHeight / 2, {
        width: maxWidth,
        align: 'center',
      });
  }

  doc.y = imageStartY + containerHeight + 10; // Reduced bottom spacing
}

/**
 * Generate PDF for a single artifact
 */
export async function generateArtifactPDF(
  artifactId: string,
  options: PDFGenerationOptions = {}
): Promise<PDFResult> {
  const { includeImages = true, watermarkImages = false } = options;

  // Fetch artifact data
  const artifact = await supabaseStorage.getArtifact(artifactId);
  if (!artifact) {
    throw new Error('Artifact not found');
  }

  // Fetch section images if needed
  let sectionImages: SectionImage[] = [];
  if (includeImages) {
    sectionImages = await supabaseStorage.getSectionImagesByArtifact(artifactId);
  }

  const config = ARTIFACT_CONFIG[artifact.artifact_type] || ARTIFACT_CONFIG.elia15;

  // Create PDF document with tighter margins
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: LAYOUT.margins,
    info: {
      Title: `${config.label} - Patent Analysis`,
      Author: 'Humble AI',
      Subject: 'Patent Analysis',
      Creator: 'Humble Patent Analyzer',
    },
    bufferPages: true,
    compress: true, // Enable compression for smaller file size
  });

  // Register custom fonts
  registerFonts(doc);

  // Collect PDF chunks
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  // Promise that resolves when PDF is complete
  const pdfComplete = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Draw first page - use content background (clean white, no grid)
  drawContentBackground(doc);
  drawTopAccentBar(doc);

  // Start content after accent bar
  doc.y = doc.page.margins.top + 8;

  // Draw artifact header
  let currentY = drawArtifactHeader(doc, 1, 1, artifact.artifact_type, doc.y);
  doc.y = currentY;

  // Add generation date (smaller, less space)
  doc.font(FONT_NAMES.body)
    .fontSize(8)
    .fillColor(COLORS.mediumGray)
    .text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
      align: 'left',
    });
  doc.y += 12; // Reduced spacing

  // Parse and render content
  const sections = parseMarkdownSections(artifact.content);
  let currentSectionNumber = 0;

  for (const section of sections) {
    switch (section.type) {
      case 'heading':
        // Calculate space needed for heading + some following content
        const headingSpace = getHeadingHeight(doc, section.content, section.level || 2);

        // Ensure we have space for heading and at least some content
        ensureSpace(doc, headingSpace, true);

        if (section.level === 2) {
          currentSectionNumber++;
        }

        renderHeading(doc, section.content, section.level || 2, config.color);

        // Check for section image after level 2 headings
        if (includeImages && section.level === 2) {
          const sectionImage = sectionImages.find(
            (img) => img.section_number === currentSectionNumber
          );

          if (sectionImage) {
            try {
              const imageBuffer = await fetchImageBuffer(sectionImage.image_url, watermarkImages);
              if (imageBuffer) {
                await renderImage(doc, imageBuffer, config.color);
              }
            } catch (error) {
              console.error('Failed to embed image:', error);
            }
          }
        }
        break;

      case 'paragraph':
        // Check if paragraph fits, if not add page
        doc.font(FONT_NAMES.body).fontSize(11);
        const paraHeight = doc.heightOfString(section.content, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        });
        ensureSpace(doc, paraHeight + LAYOUT.paragraphSpaceAfter + 20, true);
        renderParagraph(doc, section.content);
        break;

      case 'list-item':
        // Check if list item fits
        doc.font(FONT_NAMES.body).fontSize(11);
        const listHeight = doc.heightOfString(section.content, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 16,
        });
        ensureSpace(doc, listHeight + LAYOUT.listItemSpaceAfter + 10, true);
        renderListItem(doc, section.content, config.color);
        break;
    }
  }

  // Add footer with page numbers to all pages
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    addPageFooter(doc, i + 1, pages.count);
  }

  // Finalize PDF
  doc.end();

  const buffer = await pdfComplete;

  // Generate filename
  const filename = `${config.label.replace(/\s+/g, '_')}_${artifact.patent_id.substring(0, 8)}.pdf`;

  return {
    buffer,
    filename,
    mimeType: 'application/pdf',
  };
}

/**
 * Generate combined PDF for all artifacts of a patent
 */
export async function generatePatentPackagePDF(
  patentId: string,
  options: PDFGenerationOptions = {}
): Promise<PDFResult> {
  const { includeImages = true, watermarkImages = true } = options;

  // Fetch all artifacts for patent
  const artifacts = await supabaseStorage.getArtifactsByPatent(patentId);

  if (artifacts.length === 0) {
    throw new Error('No artifacts found for patent');
  }

  // Fetch patent details
  const patent = await supabaseStorage.getPatent(patentId);
  if (!patent) {
    throw new Error('Patent not found');
  }

  // Create PDF document with tighter margins and compression
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: LAYOUT.margins,
    info: {
      Title: `Patent Analysis - ${patent.friendly_title || patent.title || 'Untitled'}`,
      Author: 'Humble AI',
      Subject: 'Complete Patent Analysis Package',
      Creator: 'Humble Patent Analyzer',
    },
    bufferPages: true,
    compress: true, // Enable compression for smaller file size
  });

  // Register custom fonts
  registerFonts(doc);

  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const pdfComplete = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // === COVER PAGE ===
  // Only the cover page gets the graph paper background
  drawCoverBackground(doc);
  drawTopAccentBar(doc);

  const margins = doc.page.margins;
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - margins.left - margins.right;

  // Cover page content - centered vertically
  doc.y = 160;

  // "Patent Analysis Package" title - use Playfair Bold for cover
  doc.font(FONT_NAMES.h1)
    .fontSize(32)
    .fillColor(COLORS.black)
    .text('Patent Analysis', {
      align: 'center',
      width: contentWidth,
    });

  doc.font(FONT_NAMES.h1)
    .fontSize(32)
    .fillColor(COLORS.blue)
    .text('Package', {
      align: 'center',
      width: contentWidth,
    });
  doc.y += 20;

  // Decorative line
  const lineY = doc.y;
  const lineWidth = 180;
  const lineStartX = margins.left + (contentWidth - lineWidth) / 2;

  // Three-segment line matching the top accent
  doc.rect(lineStartX, lineY, lineWidth / 3, 3).fill(COLORS.blue);
  doc.rect(lineStartX + lineWidth / 3, lineY, lineWidth / 3, 3).fill(COLORS.green);
  doc.rect(lineStartX + (lineWidth * 2) / 3, lineY, lineWidth / 3, 3).fill(COLORS.red);

  doc.y = lineY + 24;

  // Patent title - use Playfair SemiBold
  doc.font(FONT_NAMES.h2)
    .fontSize(16)
    .fillColor(COLORS.darkGray)
    .text(patent.friendly_title || patent.title || 'Untitled Patent', {
      align: 'center',
      width: contentWidth,
    });
  doc.y += 6;

  // Assignee - use Work Sans
  if (patent.assignee) {
    doc.font(FONT_NAMES.body)
      .fontSize(11)
      .fillColor(COLORS.mediumGray)
      .text(patent.assignee, {
        align: 'center',
        width: contentWidth,
      });
    doc.y += 20;
  }

  // Patent number badge
  if (patent.patent_number) {
    const badgeWidth = 140;
    const badgeHeight = 26;
    const badgeX = margins.left + (contentWidth - badgeWidth) / 2;
    const badgeY = doc.y;

    doc.strokeColor(COLORS.mediumGray)
      .lineWidth(1)
      .rect(badgeX, badgeY, badgeWidth, badgeHeight)
      .stroke();

    doc.font(FONT_NAMES.bodyMedium)
      .fontSize(10)
      .fillColor(COLORS.darkGray)
      .text(patent.patent_number, badgeX, badgeY + 8, {
        width: badgeWidth,
        align: 'center',
      });

    doc.y = badgeY + badgeHeight + 30;
  }

  // Contents section
  doc.font(FONT_NAMES.bodyMedium)
    .fontSize(10)
    .fillColor(COLORS.mediumGray)
    .text('CONTENTS', {
      align: 'center',
      width: contentWidth,
      characterSpacing: 2,
    });
  doc.y += 12;

  // List artifacts with their colors
  const artifactOrder = ['elia15', 'business_narrative', 'golden_circle'];
  const sortedArtifacts = artifacts.sort((a, b) => {
    return artifactOrder.indexOf(a.artifact_type) - artifactOrder.indexOf(b.artifact_type);
  });

  sortedArtifacts.forEach((artifact, index) => {
    const config = ARTIFACT_CONFIG[artifact.artifact_type] || ARTIFACT_CONFIG.elia15;

    // Draw bullet
    doc.circle(margins.left + contentWidth / 2 - 70, doc.y + 4, 3)
      .fill(config.color.primary);

    // Draw text
    doc.font(FONT_NAMES.body)
      .fontSize(10)
      .fillColor(COLORS.darkGray)
      .text(`${config.label}`, margins.left + contentWidth / 2 - 55, doc.y, {
        width: 180,
        align: 'left',
      });
    doc.y += 4;
  });

  // Footer on cover
  doc.y = doc.page.height - 100;

  doc.font(FONT_NAMES.body)
    .fontSize(9)
    .fillColor(COLORS.mediumGray)
    .text('Generated by', {
      align: 'center',
      width: contentWidth,
    });

  doc.font(FONT_NAMES.h2)
    .fontSize(12)
    .fillColor(COLORS.black)
    .text('Humble AI', {
      align: 'center',
      width: contentWidth,
    });
  doc.y += 6;

  doc.font(FONT_NAMES.body)
    .fontSize(8)
    .fillColor(COLORS.lightGray)
    .text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), {
      align: 'center',
      width: contentWidth,
    });

  // === ARTIFACT PAGES ===
  const totalArtifacts = sortedArtifacts.length;

  for (let artifactIndex = 0; artifactIndex < sortedArtifacts.length; artifactIndex++) {
    const artifact = sortedArtifacts[artifactIndex];
    const config = ARTIFACT_CONFIG[artifact.artifact_type] || ARTIFACT_CONFIG.elia15;

    // New page for each artifact - use clean white background (no grid)
    doc.addPage();
    drawContentBackground(doc);
    drawTopAccentBar(doc);

    doc.y = doc.page.margins.top + 8;

    // Draw artifact header
    let currentY = drawArtifactHeader(
      doc,
      artifactIndex + 1,
      totalArtifacts,
      artifact.artifact_type,
      doc.y
    );
    doc.y = currentY;

    // Parse and render artifact content
    const sections = parseMarkdownSections(artifact.content);
    const sectionImages = await supabaseStorage.getSectionImagesByArtifact(artifact.id);
    let currentSectionNumber = 0;

    for (const section of sections) {
      switch (section.type) {
        case 'heading':
          // Calculate space needed for heading + some following content
          const headingSpace = getHeadingHeight(doc, section.content, section.level || 2);

          // Ensure we have space for heading and at least some content
          ensureSpace(doc, headingSpace, true);

          if (section.level === 2) {
            currentSectionNumber++;
          }

          renderHeading(doc, section.content, section.level || 2, config.color);

          // Embed section image
          if (includeImages && section.level === 2) {
            const sectionImage = sectionImages.find(
              (img) => img.section_number === currentSectionNumber
            );

            if (sectionImage) {
              try {
                const imageBuffer = await fetchImageBuffer(sectionImage.image_url, watermarkImages);
                if (imageBuffer) {
                  await renderImage(doc, imageBuffer, config.color);
                }
              } catch (error) {
                console.error('Failed to embed image:', error);
              }
            }
          }
          break;

        case 'paragraph':
          // Check if paragraph fits, if not add page
          doc.font(FONT_NAMES.body).fontSize(11);
          const paraHeight = doc.heightOfString(section.content, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          });
          ensureSpace(doc, paraHeight + LAYOUT.paragraphSpaceAfter + 20, true);
          renderParagraph(doc, section.content);
          break;

        case 'list-item':
          // Check if list item fits
          doc.font(FONT_NAMES.body).fontSize(11);
          const listHeight = doc.heightOfString(section.content, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 16,
          });
          ensureSpace(doc, listHeight + LAYOUT.listItemSpaceAfter + 10, true);
          renderListItem(doc, section.content, config.color);
          break;
      }
    }
  }

  // Add footer with page numbers to all pages
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    addPageFooter(doc, i + 1, pages.count);
  }

  doc.end();

  const buffer = await pdfComplete;

  const filename = `Patent_Analysis_Package_${patent.id.substring(0, 8)}.pdf`;

  return {
    buffer,
    filename,
    mimeType: 'application/pdf',
  };
}
