/**
 * Test pdf.js extraction on all 91 PDFs
 * This is the fallback method we implemented
 */

import fs from 'fs/promises';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const PDF_DIR = '/Users/averghese/spider_ai/patent_enrichment/pdfs';

async function extractWithPdfJs(filePath) {
  const dataBuffer = await fs.readFile(filePath);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useSystemFonts: true,
    verbosity: 0,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  let fullText = '';

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    fullText += pageText + '\n\n';
  }

  return { fullText, numPages };
}

async function runTests() {
  console.log('=== pdf.js Extraction Test ===\n');
  console.log(`Testing PDFs in: ${PDF_DIR}\n`);

  const files = await fs.readdir(PDF_DIR);
  const pdfFiles = files.filter(f => f.endsWith('.pdf')).sort();

  console.log(`Found ${pdfFiles.length} PDF files\n`);
  console.log('Starting tests...\n');

  const results = [];
  let successCount = 0;
  let totalTextLength = 0;
  let totalPages = 0;

  for (let i = 0; i < pdfFiles.length; i++) {
    const filename = pdfFiles[i];
    const filePath = path.join(PDF_DIR, filename);

    try {
      const startTime = Date.now();
      const { fullText, numPages } = await extractWithPdfJs(filePath);
      const duration = Date.now() - startTime;

      successCount++;
      totalTextLength += fullText.length;
      totalPages += numPages;

      const result = {
        filename,
        success: true,
        textLength: fullText.length,
        numPages,
        duration,
        sample: fullText.substring(0, 250).replace(/\s+/g, ' ').trim(),
      };

      results.push(result);

      console.log(`[${i + 1}/${pdfFiles.length}] ${filename}`);
      console.log(`  ✓ ${result.textLength.toLocaleString()} chars from ${numPages} pages (${duration}ms)`);

      // Show sample for problematic PDF
      if (filename === 'US20230310646A1.pdf') {
        console.log(`  📄 SAMPLE: "${result.sample}..."`);
      }

    } catch (error) {
      results.push({
        filename,
        success: false,
        error: error.message,
      });

      console.log(`[${i + 1}/${pdfFiles.length}] ${filename}`);
      console.log(`  ✗ FAILED: ${error.message}`);
    }

    console.log('');
  }

  // Summary
  const failCount = results.filter(r => !r.success).length;

  console.log('='.repeat(70));
  console.log('=== SUMMARY ===\n');
  console.log(`Total PDFs: ${pdfFiles.length}`);
  console.log(`✓ Successful: ${successCount} (${(successCount / pdfFiles.length * 100).toFixed(1)}%)`);
  console.log(`✗ Failed: ${failCount} (${(failCount / pdfFiles.length * 100).toFixed(1)}%)`);

  if (successCount > 0) {
    console.log(`\nTotal text extracted: ${(totalTextLength / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total pages processed: ${totalPages.toLocaleString()}`);
    console.log(`Average per PDF: ${(totalTextLength / successCount / 1024).toFixed(0)} KB`);
    console.log(`Average pages per PDF: ${(totalPages / successCount).toFixed(1)}`);

    const avgDuration = results.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) / successCount;
    console.log(`Average extraction time: ${avgDuration.toFixed(0)}ms`);
  }

  // Problematic PDF check
  const problematic = results.find(r => r.filename === 'US20230310646A1.pdf');
  if (problematic) {
    console.log('\n=== US20230310646A1.pdf (Previously Problematic) ===');
    if (problematic.success) {
      console.log(`✓ SUCCESS!`);
      console.log(`  Text: ${problematic.textLength.toLocaleString()} characters`);
      console.log(`  Pages: ${problematic.numPages}`);
      console.log(`  Time: ${problematic.duration}ms`);
      console.log(`  Sample: "${problematic.sample}..."`);
    } else {
      console.log(`✗ STILL FAILING: ${problematic.error}`);
    }
  }

  if (failCount > 0) {
    console.log('\n=== FAILED PDFs ===');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  • ${r.filename}: ${r.error}`);
    });
  }

  // Top 5 largest/smallest
  if (successCount >= 5) {
    const successful = results.filter(r => r.success);

    console.log('\n=== TOP 5 LARGEST EXTRACTIONS ===');
    successful
      .sort((a, b) => b.textLength - a.textLength)
      .slice(0, 5)
      .forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.filename} - ${(r.textLength / 1024).toFixed(0)} KB`);
      });

    console.log('\n=== TOP 5 SMALLEST EXTRACTIONS ===');
    successful
      .sort((a, b) => a.textLength - b.textLength)
      .slice(0, 5)
      .forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.filename} - ${(r.textLength / 1024).toFixed(0)} KB`);
      });
  }

  console.log('\n' + '='.repeat(70));

  return {
    total: pdfFiles.length,
    success: successCount,
    failed: failCount,
    successRate: (successCount / pdfFiles.length * 100).toFixed(1),
  };
}

runTests().then(summary => {
  console.log('\nTest complete!');
  process.exit(summary.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});
