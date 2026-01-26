/**
 * PDF Generation Service
 * Converts patent artifacts to downloadable PDFs with embedded images
 */

import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { supabaseStorage } from '../supabaseStorage.js';
import type { Artifact, SectionImage } from '../supabaseStorage.js';

interface PDFGenerationOptions {
  includeImages?: boolean;
  watermarkImages?: boolean;
}

interface PDFResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

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
        content: line.replace(/^[\-\*]\s+/, '• ').replace(/^\d+\.\s+/, '• '),
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
 * Fetch image buffer from URL
 */
async function fetchImageBuffer(imageUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Failed to fetch image:', error);
    return null;
  }
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

  // Create PDF document
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: {
      top: 72,
      bottom: 72,
      left: 72,
      right: 72,
    },
    info: {
      Title: `${artifact.artifact_type.toUpperCase()} - ${artifact.patent_id}`,
      Author: 'Humble AI',
      Subject: 'Patent Analysis',
      Creator: 'Humble Patent Analyzer',
    },
  });

  // Collect PDF chunks
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  // Promise that resolves when PDF is complete
  const pdfComplete = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Add branding header
  doc
    .fontSize(10)
    .fillColor('#666666')
    .text('Humble AI - Patent Analysis', { align: 'right' })
    .moveDown(0.5);

  // Add title
  const artifactTypeLabels: Record<string, string> = {
    elia15: 'Scientific Narrative',
    business_narrative: 'Business Narrative',
    golden_circle: 'Golden Circle Analysis',
  };

  doc
    .fontSize(24)
    .fillColor('#000000')
    .text(artifactTypeLabels[artifact.artifact_type] || artifact.artifact_type.toUpperCase(), {
      align: 'left',
    })
    .moveDown(0.5);

  // Add metadata
  doc
    .fontSize(10)
    .fillColor('#666666')
    .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'left' })
    .moveDown(1.5);

  // Parse and render content
  const sections = parseMarkdownSections(artifact.content);
  let currentSectionNumber = 0;

  for (const section of sections) {
    switch (section.type) {
      case 'heading':
        // Add page break before major headings (except first)
        if (section.level === 1 && currentSectionNumber > 0) {
          doc.addPage();
        } else if (section.level === 2) {
          currentSectionNumber++;
          doc.moveDown(1);
        }

        // Render heading
        const headingSizes = { 1: 20, 2: 16, 3: 14, 4: 12, 5: 11, 6: 10 };
        doc
          .fontSize(headingSizes[section.level as keyof typeof headingSizes] || 12)
          .fillColor('#000000')
          .text(section.content, { continued: false })
          .moveDown(0.5);

        // Check for section image
        if (includeImages && section.level === 2) {
          const sectionImage = sectionImages.find(
            (img) => img.section_number === currentSectionNumber
          );

          if (sectionImage) {
            try {
              const imageBuffer = await fetchImageBuffer(sectionImage.image_url);

              if (imageBuffer) {
                doc.moveDown(0.5);

                // Calculate image dimensions (maintain aspect ratio)
                const maxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
                const maxHeight = 300;

                doc.image(imageBuffer, {
                  fit: [maxWidth, maxHeight],
                  align: 'center',
                });

                doc.moveDown(0.5);
              }
            } catch (error) {
              console.error('Failed to embed image:', error);
            }
          }
        }
        break;

      case 'paragraph':
        doc
          .fontSize(11)
          .fillColor('#333333')
          .text(section.content, {
            align: 'left',
            lineGap: 2,
          })
          .moveDown(0.8);
        break;

      case 'list-item':
        doc
          .fontSize(11)
          .fillColor('#333333')
          .text(section.content, {
            align: 'left',
            indent: 20,
            lineGap: 2,
          })
          .moveDown(0.3);
        break;
    }
  }

  // Add footer with page numbers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    doc
      .fontSize(9)
      .fillColor('#999999')
      .text(
        `Page ${i + 1} of ${pages.count}`,
        doc.page.margins.left,
        doc.page.height - 50,
        {
          align: 'center',
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        }
      );
  }

  // Finalize PDF
  doc.end();

  const buffer = await pdfComplete;

  // Generate filename
  const artifactTypeName = artifactTypeLabels[artifact.artifact_type] || artifact.artifact_type;
  const filename = `${artifactTypeName.replace(/\s+/g, '_')}_${artifact.patent_id.substring(0, 8)}.pdf`;

  return {
    buffer,
    filename,
    mimeType: 'application/pdf',
  };
}

/**
 * Generate combined PDF for all artifacts of a patent
 */
export async function generatePatentPackagePDF(patentId: string): Promise<PDFResult> {
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
      top: 72,
      bottom: 72,
      left: 72,
      right: 72,
    },
    info: {
      Title: `Patent Analysis - ${patent.title || patent.id}`,
      Author: 'Humble AI',
      Subject: 'Complete Patent Analysis Package',
      Creator: 'Humble Patent Analyzer',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const pdfComplete = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Cover page
  doc
    .fontSize(32)
    .fillColor('#000000')
    .text('Patent Analysis Package', { align: 'center' })
    .moveDown(2);

  doc
    .fontSize(16)
    .fillColor('#666666')
    .text(patent.friendly_title || patent.title || 'Untitled Patent', {
      align: 'center',
    })
    .moveDown(0.5);

  if (patent.assignee) {
    doc
      .fontSize(12)
      .fillColor('#999999')
      .text(patent.assignee, { align: 'center' })
      .moveDown(3);
  }

  doc
    .fontSize(10)
    .fillColor('#666666')
    .text(`Generated by Humble AI`, { align: 'center' })
    .text(new Date().toLocaleDateString(), { align: 'center' });

  // Process each artifact
  const artifactOrder = ['elia15', 'business_narrative', 'golden_circle'];
  const sortedArtifacts = artifacts.sort((a, b) => {
    return artifactOrder.indexOf(a.artifact_type) - artifactOrder.indexOf(b.artifact_type);
  });

  for (const artifact of sortedArtifacts) {
    doc.addPage();

    // Add artifact title
    const artifactLabels: Record<string, string> = {
      elia15: 'Scientific Narrative',
      business_narrative: 'Business Narrative',
      golden_circle: 'Golden Circle Analysis',
    };

    doc
      .fontSize(24)
      .fillColor('#000000')
      .text(artifactLabels[artifact.artifact_type] || artifact.artifact_type.toUpperCase())
      .moveDown(1.5);

    // Render artifact content
    const sections = parseMarkdownSections(artifact.content);
    const sectionImages = await supabaseStorage.getSectionImagesByArtifact(artifact.id);
    let currentSectionNumber = 0;

    for (const section of sections) {
      switch (section.type) {
        case 'heading':
          if (section.level === 2) {
            currentSectionNumber++;
            doc.moveDown(1);
          }

          const headingSizes = { 1: 20, 2: 16, 3: 14, 4: 12, 5: 11, 6: 10 };
          doc
            .fontSize(headingSizes[section.level as keyof typeof headingSizes] || 12)
            .fillColor('#000000')
            .text(section.content)
            .moveDown(0.5);

          // Embed section image
          if (section.level === 2) {
            const sectionImage = sectionImages.find(
              (img) => img.section_number === currentSectionNumber
            );

            if (sectionImage) {
              try {
                const imageBuffer = await fetchImageBuffer(sectionImage.image_url);

                if (imageBuffer) {
                  doc.moveDown(0.5);

                  const maxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
                  const maxHeight = 300;

                  doc.image(imageBuffer, {
                    fit: [maxWidth, maxHeight],
                    align: 'center',
                  });

                  doc.moveDown(0.5);
                }
              } catch (error) {
                console.error('Failed to embed image:', error);
              }
            }
          }
          break;

        case 'paragraph':
          doc
            .fontSize(11)
            .fillColor('#333333')
            .text(section.content, {
              align: 'left',
              lineGap: 2,
            })
            .moveDown(0.8);
          break;

        case 'list-item':
          doc
            .fontSize(11)
            .fillColor('#333333')
            .text(section.content, {
              align: 'left',
              indent: 20,
              lineGap: 2,
            })
            .moveDown(0.3);
          break;
      }
    }
  }

  // Add footer with page numbers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    doc
      .fontSize(9)
      .fillColor('#999999')
      .text(
        `Page ${i + 1} of ${pages.count}`,
        doc.page.margins.left,
        doc.page.height - 50,
        {
          align: 'center',
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        }
      );
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
