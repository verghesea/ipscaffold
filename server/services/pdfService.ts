/**
 * PDF Generation Service
 * Converts patent artifacts to downloadable PDFs with embedded images
 *
 * Design System (matching frontend):
 * - Graph paper background texture
 * - Top accent gradient (blue → green → red)
 * - Typography: Playfair Display (headings), Work Sans (body)
 * - Color-coded artifact types (amber, blue, purple)
 * - Professional editorial layout
 */

import PDFDocument from 'pdfkit';
import { supabaseStorage } from '../supabaseStorage.js';
import type { Artifact, SectionImage } from '../supabaseStorage.js';
import { addWatermark } from './imageWatermarkService.js';

interface PDFGenerationOptions {
  includeImages?: boolean;
  watermarkImages?: boolean;
}

interface PDFResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

// Design constants matching frontend
const COLORS = {
  // Primary text colors
  black: '#1f2937',
  darkGray: '#4b5563',
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
  paper: '#fffef9',
  graphLine: '#e5e7eb',
  graphLineDark: '#d1d5db',
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
 * Draw graph paper background pattern on current page
 */
function drawGraphPaperBackground(doc: PDFKit.PDFDocument) {
  const { width, height } = doc.page;

  // Save graphics state
  doc.save();

  // Fill background with warm off-white
  doc.rect(0, 0, width, height)
    .fill(COLORS.paper);

  // Draw minor grid lines (10px spacing equivalent, scaled for PDF)
  const minorSpacing = 8;
  doc.strokeColor(COLORS.graphLine)
    .lineWidth(0.25)
    .opacity(0.4);

  // Vertical minor lines
  for (let x = 0; x < width; x += minorSpacing) {
    doc.moveTo(x, 0).lineTo(x, height).stroke();
  }

  // Horizontal minor lines
  for (let y = 0; y < height; y += minorSpacing) {
    doc.moveTo(0, y).lineTo(width, y).stroke();
  }

  // Draw major grid lines (50px spacing equivalent)
  const majorSpacing = 40;
  doc.strokeColor(COLORS.graphLineDark)
    .lineWidth(0.5)
    .opacity(0.5);

  // Vertical major lines
  for (let x = 0; x < width; x += majorSpacing) {
    doc.moveTo(x, 0).lineTo(x, height).stroke();
  }

  // Horizontal major lines
  for (let y = 0; y < height; y += majorSpacing) {
    doc.moveTo(0, y).lineTo(width, y).stroke();
  }

  // Restore graphics state
  doc.restore();
  doc.opacity(1);
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

  const boxHeight = 60;
  const numberBoxSize = 40;
  const padding = 12;

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
  doc.fontSize(16)
    .fillColor(config.color.primary)
    .text(
      String(artifactNumber).padStart(2, '0'),
      margins.left + padding,
      startY + (boxHeight - 16) / 2,
      {
        width: numberBoxSize,
        align: 'center',
      }
    );

  // Draw "Artifact X / Y" label
  const textStartX = margins.left + padding + numberBoxSize + 12;

  doc.fontSize(9)
    .fillColor(COLORS.red)
    .text(
      `ARTIFACT ${String(artifactNumber).padStart(2, '0')} / ${String(totalArtifacts).padStart(2, '0')}`,
      textStartX,
      startY + 15,
      { characterSpacing: 1 }
    );

  // Draw artifact label and tagline
  doc.fontSize(14)
    .fillColor(COLORS.black)
    .text(
      `${config.label} – ${config.tagline}`,
      textStartX,
      startY + 30,
      { width: contentWidth - numberBoxSize - padding * 3 }
    );

  return startY + boxHeight + 20;
}

/**
 * Add page footer with page number and branding
 */
function addPageFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number) {
  const { width, height, margins } = doc.page;
  const footerY = height - 40;

  // Draw separator line
  doc.strokeColor(COLORS.graphLineDark)
    .lineWidth(0.5)
    .moveTo(margins.left, footerY - 10)
    .lineTo(width - margins.right, footerY - 10)
    .stroke();

  // Page number centered
  doc.fontSize(9)
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
  doc.fontSize(8)
    .fillColor(COLORS.lightGray)
    .text(
      'Humble AI',
      width - margins.right - 60,
      footerY,
      {
        width: 60,
        align: 'right',
      }
    );
}

/**
 * Render a styled heading
 */
function renderHeading(doc: PDFKit.PDFDocument, content: string, level: number, artifactColor: typeof COLORS.amber) {
  const sizes: Record<number, number> = { 1: 22, 2: 18, 3: 15, 4: 13, 5: 12, 6: 11 };
  const fontSize = sizes[level] || 12;

  // Add extra space before major headings
  if (level <= 2) {
    doc.moveDown(0.8);
  }

  // For level 2 headings, add a colored accent
  if (level === 2) {
    const currentY = doc.y;
    const margins = doc.page.margins;

    // Draw small accent bar before heading
    doc.rect(margins.left, currentY, 3, fontSize + 4)
      .fill(artifactColor.primary);

    // Draw heading text with indent
    doc.fontSize(fontSize)
      .fillColor(COLORS.black)
      .text(content, margins.left + 12, currentY, {
        continued: false,
      });
  } else if (level === 1) {
    // Main title - larger with underline
    doc.fontSize(fontSize)
      .fillColor(COLORS.black)
      .text(content, {
        continued: false,
      });

    // Add subtle underline
    const textWidth = doc.widthOfString(content);
    doc.strokeColor(artifactColor.primary)
      .lineWidth(1)
      .moveTo(doc.page.margins.left, doc.y + 2)
      .lineTo(doc.page.margins.left + Math.min(textWidth, 200), doc.y + 2)
      .stroke();

    doc.moveDown(0.3);
  } else {
    // Other headings
    doc.fontSize(fontSize)
      .fillColor(level === 3 ? COLORS.darkGray : COLORS.mediumGray)
      .text(content, {
        continued: false,
      });
  }

  doc.moveDown(0.4);
}

/**
 * Render a paragraph with proper styling
 */
function renderParagraph(doc: PDFKit.PDFDocument, content: string) {
  doc.fontSize(11)
    .fillColor(COLORS.darkGray)
    .text(content, {
      align: 'justify',
      lineGap: 3,
    })
    .moveDown(0.7);
}

/**
 * Render a list item with bullet
 */
function renderListItem(doc: PDFKit.PDFDocument, content: string, artifactColor: typeof COLORS.amber) {
  const currentX = doc.x;
  const currentY = doc.y;
  const margins = doc.page.margins;

  // Draw bullet point (small filled circle)
  doc.circle(margins.left + 8, currentY + 5, 2.5)
    .fill(artifactColor.primary);

  // Draw text with indent
  doc.fontSize(11)
    .fillColor(COLORS.darkGray)
    .text(content, margins.left + 20, currentY, {
      width: doc.page.width - margins.left - margins.right - 20,
      align: 'left',
      lineGap: 2,
    })
    .moveDown(0.3);
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
  const maxWidth = doc.page.width - margins.left - margins.right - 24; // padding
  const maxHeight = 250;

  // Calculate if we need a new page
  if (doc.y + maxHeight + 40 > doc.page.height - margins.bottom) {
    doc.addPage();
    drawGraphPaperBackground(doc);
    drawTopAccentBar(doc);
    doc.y = margins.top + 20;
  }

  const imageStartY = doc.y;

  // Draw image container with border
  doc.strokeColor(artifactColor.border)
    .lineWidth(1)
    .roundedRect(margins.left, imageStartY, maxWidth + 24, maxHeight + 20, 2)
    .stroke();

  // Draw light background
  doc.rect(margins.left + 1, imageStartY + 1, maxWidth + 22, maxHeight + 18)
    .fill('#fafafa');

  // Embed the image
  try {
    doc.image(imageBuffer, margins.left + 12, imageStartY + 10, {
      fit: [maxWidth, maxHeight],
      align: 'center',
      valign: 'center',
    });
  } catch (error) {
    // If image fails, show placeholder text
    doc.fontSize(10)
      .fillColor(COLORS.lightGray)
      .text('Image could not be rendered', margins.left + 12, imageStartY + maxHeight / 2, {
        width: maxWidth,
        align: 'center',
      });
  }

  doc.y = imageStartY + maxHeight + 30;
  doc.moveDown(0.5);
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

  // Create PDF document
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: {
      top: 60,
      bottom: 60,
      left: 60,
      right: 60,
    },
    info: {
      Title: `${config.label} - Patent Analysis`,
      Author: 'Humble AI',
      Subject: 'Patent Analysis',
      Creator: 'Humble Patent Analyzer',
    },
    bufferPages: true,
  });

  // Collect PDF chunks
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  // Promise that resolves when PDF is complete
  const pdfComplete = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Draw first page background and accent bar
  drawGraphPaperBackground(doc);
  drawTopAccentBar(doc);

  // Start content after accent bar
  doc.y = doc.page.margins.top + 10;

  // Draw artifact header
  let currentY = drawArtifactHeader(doc, 1, 1, artifact.artifact_type, doc.y);
  doc.y = currentY;

  // Add generation date
  doc.fontSize(9)
    .fillColor(COLORS.mediumGray)
    .text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
      align: 'left',
    })
    .moveDown(1.5);

  // Parse and render content
  const sections = parseMarkdownSections(artifact.content);
  let currentSectionNumber = 0;

  for (const section of sections) {
    // Check if we need a new page
    if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
      doc.addPage();
      drawGraphPaperBackground(doc);
      drawTopAccentBar(doc);
      doc.y = doc.page.margins.top + 10;
    }

    switch (section.type) {
      case 'heading':
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
        renderParagraph(doc, section.content);
        break;

      case 'list-item':
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

  // Create PDF document
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: {
      top: 60,
      bottom: 60,
      left: 60,
      right: 60,
    },
    info: {
      Title: `Patent Analysis - ${patent.friendly_title || patent.title || 'Untitled'}`,
      Author: 'Humble AI',
      Subject: 'Complete Patent Analysis Package',
      Creator: 'Humble Patent Analyzer',
    },
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const pdfComplete = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // === COVER PAGE ===
  drawGraphPaperBackground(doc);
  drawTopAccentBar(doc);

  const margins = doc.page.margins;
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - margins.left - margins.right;

  // Cover page content - centered vertically
  doc.y = 180;

  // "Patent Analysis Package" title
  doc.fontSize(36)
    .fillColor(COLORS.black)
    .text('Patent Analysis', {
      align: 'center',
      width: contentWidth,
    });

  doc.fontSize(36)
    .fillColor(COLORS.blue)
    .text('Package', {
      align: 'center',
      width: contentWidth,
    })
    .moveDown(2);

  // Decorative line
  const lineY = doc.y;
  const lineWidth = 200;
  const lineStartX = margins.left + (contentWidth - lineWidth) / 2;

  // Three-segment line matching the top accent
  doc.rect(lineStartX, lineY, lineWidth / 3, 3).fill(COLORS.blue);
  doc.rect(lineStartX + lineWidth / 3, lineY, lineWidth / 3, 3).fill(COLORS.green);
  doc.rect(lineStartX + (lineWidth * 2) / 3, lineY, lineWidth / 3, 3).fill(COLORS.red);

  doc.y = lineY + 30;

  // Patent title
  doc.fontSize(18)
    .fillColor(COLORS.darkGray)
    .text(patent.friendly_title || patent.title || 'Untitled Patent', {
      align: 'center',
      width: contentWidth,
    })
    .moveDown(0.5);

  // Assignee
  if (patent.assignee) {
    doc.fontSize(12)
      .fillColor(COLORS.mediumGray)
      .text(patent.assignee, {
        align: 'center',
        width: contentWidth,
      })
      .moveDown(2);
  }

  // Patent number badge
  if (patent.patent_number) {
    const badgeWidth = 160;
    const badgeHeight = 30;
    const badgeX = margins.left + (contentWidth - badgeWidth) / 2;
    const badgeY = doc.y;

    doc.strokeColor(COLORS.mediumGray)
      .lineWidth(1)
      .rect(badgeX, badgeY, badgeWidth, badgeHeight)
      .stroke();

    doc.fontSize(11)
      .fillColor(COLORS.darkGray)
      .text(patent.patent_number, badgeX, badgeY + 9, {
        width: badgeWidth,
        align: 'center',
      });

    doc.y = badgeY + badgeHeight + 40;
  }

  // Contents section
  doc.fontSize(12)
    .fillColor(COLORS.mediumGray)
    .text('CONTENTS', {
      align: 'center',
      width: contentWidth,
      characterSpacing: 2,
    })
    .moveDown(1);

  // List artifacts with their colors
  const artifactOrder = ['elia15', 'business_narrative', 'golden_circle'];
  const sortedArtifacts = artifacts.sort((a, b) => {
    return artifactOrder.indexOf(a.artifact_type) - artifactOrder.indexOf(b.artifact_type);
  });

  sortedArtifacts.forEach((artifact, index) => {
    const config = ARTIFACT_CONFIG[artifact.artifact_type] || ARTIFACT_CONFIG.elia15;

    // Draw bullet
    doc.circle(margins.left + contentWidth / 2 - 80, doc.y + 5, 4)
      .fill(config.color.primary);

    // Draw text
    doc.fontSize(11)
      .fillColor(COLORS.darkGray)
      .text(`${config.label}`, margins.left + contentWidth / 2 - 65, doc.y, {
        width: 200,
        align: 'left',
      })
      .moveDown(0.3);
  });

  // Footer on cover
  doc.y = doc.page.height - 120;

  doc.fontSize(10)
    .fillColor(COLORS.mediumGray)
    .text('Generated by', {
      align: 'center',
      width: contentWidth,
    });

  doc.fontSize(14)
    .fillColor(COLORS.black)
    .text('Humble AI', {
      align: 'center',
      width: contentWidth,
    })
    .moveDown(0.5);

  doc.fontSize(9)
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

    // New page for each artifact
    doc.addPage();
    drawGraphPaperBackground(doc);
    drawTopAccentBar(doc);

    doc.y = doc.page.margins.top + 10;

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
      // Check if we need a new page
      if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
        doc.addPage();
        drawGraphPaperBackground(doc);
        drawTopAccentBar(doc);
        doc.y = doc.page.margins.top + 10;
      }

      switch (section.type) {
        case 'heading':
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
          renderParagraph(doc, section.content);
          break;

        case 'list-item':
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
