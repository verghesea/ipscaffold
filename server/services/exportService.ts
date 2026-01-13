import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from 'docx';
import { supabaseStorage } from '../supabaseStorage';
import { parseArtifactSections } from './sectionParser';

/**
 * Gets human-readable title for artifact types
 */
function getArtifactTitle(type: string): string {
  const titles: Record<string, string> = {
    elia15: 'ELIA15: Simplified Explanation',
    business_narrative: 'Business Narrative',
    golden_circle: 'Golden Circle Framework',
  };
  return titles[type] || type;
}

/**
 * Exports a patent and all its artifacts as a PDF document with embedded images.
 *
 * @param patentId - The ID of the patent to export
 * @returns PDF as a Buffer
 */
export async function exportPatentAsPDF(patentId: string): Promise<Buffer> {
  const patent = await supabaseStorage.getPatent(patentId);
  if (!patent) throw new Error('Patent not found');

  const artifacts = await supabaseStorage.getArtifactsByPatent(patentId);
  const allImages = await supabaseStorage.getSectionImagesByPatent(patentId);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', chunk => chunks.push(chunk));

  // Title page
  doc.fontSize(28).font('Helvetica-Bold').text(patent.title || 'Patent Analysis', {
    align: 'center',
  });
  doc.moveDown();

  if (patent.patent_number) {
    doc.fontSize(14).font('Helvetica').text(`Patent Number: ${patent.patent_number}`, {
      align: 'center',
    });
    doc.moveDown(0.5);
  }

  doc.fontSize(12).font('Helvetica');
  if (patent.assignee) {
    doc.text(`Assignee: ${patent.assignee}`);
  }
  if (patent.filing_date) {
    doc.text(`Filing Date: ${patent.filing_date}`);
  }
  if (patent.inventors) {
    doc.text(`Inventors: ${patent.inventors}`);
  }

  doc.addPage();

  // Process each artifact
  for (const artifact of artifacts) {
    doc.fontSize(20).font('Helvetica-Bold').text(getArtifactTitle(artifact.artifact_type));
    doc.moveDown();

    const sections = parseArtifactSections(artifact.content);
    const artifactImages = allImages.filter(img => img.artifact_id === artifact.id);

    for (const section of sections) {
      // Section heading
      doc.fontSize(16).font('Helvetica-Bold').text(section.heading);
      doc.moveDown(0.5);

      // Add image if available
      const image = artifactImages.find(img => img.section_heading === section.heading);
      if (image) {
        try {
          const imageResponse = await fetch(image.image_url);
          if (imageResponse.ok) {
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            doc.image(imageBuffer, {
              fit: [400, 400],
              align: 'center',
            });
            doc.moveDown();
          }
        } catch (err) {
          console.error('Failed to embed image in PDF:', err);
        }
      }

      // Section content
      const paragraphs = section.content.trim().split('\n\n');
      doc.fontSize(11).font('Helvetica');
      for (const para of paragraphs) {
        if (para.trim()) {
          doc.text(para.trim(), {
            align: 'justify',
            lineGap: 2,
          });
          doc.moveDown(0.5);
        }
      }
      doc.moveDown();
    }

    doc.addPage();
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Exports a patent and all its artifacts as a DOCX document with embedded images.
 *
 * @param patentId - The ID of the patent to export
 * @returns DOCX as a Buffer
 */
export async function exportPatentAsDOCX(patentId: string): Promise<Buffer> {
  const patent = await supabaseStorage.getPatent(patentId);
  if (!patent) throw new Error('Patent not found');

  const artifacts = await supabaseStorage.getArtifactsByPatent(patentId);
  const allImages = await supabaseStorage.getSectionImagesByPatent(patentId);

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: patent.title || 'Patent Analysis',
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
  );

  if (patent.patent_number) {
    children.push(
      new Paragraph({
        text: `Patent Number: ${patent.patent_number}`,
        spacing: { after: 100 },
      }),
    );
  }

  if (patent.assignee) {
    children.push(
      new Paragraph({
        text: `Assignee: ${patent.assignee}`,
      }),
    );
  }

  if (patent.filing_date) {
    children.push(
      new Paragraph({
        text: `Filing Date: ${patent.filing_date}`,
      }),
    );
  }

  if (patent.inventors) {
    children.push(
      new Paragraph({
        text: `Inventors: ${patent.inventors}`,
      }),
    );
  }

  children.push(new Paragraph({ text: '' })); // Spacer

  // Process each artifact
  for (const artifact of artifacts) {
    children.push(
      new Paragraph({
        text: getArtifactTitle(artifact.artifact_type),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),
    );

    const sections = parseArtifactSections(artifact.content);
    const artifactImages = allImages.filter(img => img.artifact_id === artifact.id);

    for (const section of sections) {
      // Section heading
      children.push(
        new Paragraph({
          text: section.heading,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        }),
      );

      // Add image if available
      const image = artifactImages.find(img => img.section_heading === section.heading);
      if (image) {
        try {
          const imageResponse = await fetch(image.image_url);
          if (imageResponse.ok) {
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imageBuffer,
                    transformation: { width: 400, height: 400 },
                  }),
                ],
                spacing: { after: 200 },
              }),
            );
          }
        } catch (err) {
          console.error('Failed to embed image in DOCX:', err);
        }
      }

      // Section content paragraphs
      const paragraphs = section.content.trim().split('\n\n');
      for (const para of paragraphs) {
        if (para.trim()) {
          children.push(
            new Paragraph({
              text: para.trim(),
              spacing: { after: 100 },
            }),
          );
        }
      }

      children.push(new Paragraph({ text: '' })); // Spacer
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return await Packer.toBuffer(doc);
}

/**
 * Exports a patent and all its artifacts as plain text.
 *
 * @param patentId - The ID of the patent to export
 * @returns Plain text as a Buffer
 */
export async function exportPatentAsTXT(patentId: string): Promise<Buffer> {
  const patent = await supabaseStorage.getPatent(patentId);
  if (!patent) throw new Error('Patent not found');

  const artifacts = await supabaseStorage.getArtifactsByPatent(patentId);

  let text = '';

  // Title section
  text += `${patent.title || 'Patent Analysis'}\n`;
  text += `${'='.repeat((patent.title || 'Patent Analysis').length)}\n\n`;

  if (patent.patent_number) {
    text += `Patent Number: ${patent.patent_number}\n`;
  }
  if (patent.assignee) {
    text += `Assignee: ${patent.assignee}\n`;
  }
  if (patent.filing_date) {
    text += `Filing Date: ${patent.filing_date}\n`;
  }
  if (patent.inventors) {
    text += `Inventors: ${patent.inventors}\n`;
  }
  text += '\n';

  // Process each artifact
  for (const artifact of artifacts) {
    text += `\n${'*'.repeat(80)}\n`;
    text += `${getArtifactTitle(artifact.artifact_type)}\n`;
    text += `${'*'.repeat(80)}\n\n`;
    text += artifact.content;
    text += '\n\n';
  }

  return Buffer.from(text, 'utf-8');
}
