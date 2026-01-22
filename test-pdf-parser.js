/**
 * Test script to validate PDF parser on all 91 PDFs
 * Tests both pdf-parse and pdf.js fallback
 */

import { parsePatentPDF } from './server/services/pdfParser.ts';
import fs from 'fs/promises';
import path from 'path';

const PDF_DIR = '/Users/averghese/spider_ai/patent_enrichment/pdfs';

async function testPdfParser() {
  console.log('=== PDF Parser Test Suite ===\n');
  console.log(`Testing PDFs in: ${PDF_DIR}\n`);

  // Get all PDF files
  const files = await fs.readdir(PDF_DIR);
  const pdfFiles = files.filter(f => f.endsWith('.pdf')).sort();

  console.log(`Found ${pdfFiles.length} PDF files\n`);
  console.log('Starting tests...\n');

  const results = {
    success: [],
    failed: [],
    totalTextLength: 0,
  };

  for (let i = 0; i < pdfFiles.length; i++) {
    const filename = pdfFiles[i];
    const filePath = path.join(PDF_DIR, filename);

    try {
      console.log(`[${i + 1}/${pdfFiles.length}] Testing: ${filename}`);

      const startTime = Date.now();
      const parsed = await parsePatentPDF(filePath);
      const duration = Date.now() - startTime;

      const textLength = parsed.fullText.length;
      results.totalTextLength += textLength;

      console.log(`  ✓ SUCCESS - ${textLength.toLocaleString()} characters extracted in ${duration}ms`);
      console.log(`    Title: ${parsed.title || 'N/A'}`);
      console.log(`    Inventor: ${parsed.inventors || 'N/A'}`);

      results.success.push({
        filename,
        textLength,
        duration,
        title: parsed.title,
      });

    } catch (error) {
      console.log(`  ✗ FAILED - ${error.message}`);
      results.failed.push({
        filename,
        error: error.message,
      });
    }

    console.log(''); // blank line between tests
  }

  // Print summary
  console.log('='.repeat(60));
  console.log('=== TEST SUMMARY ===\n');
  console.log(`Total PDFs tested: ${pdfFiles.length}`);
  console.log(`Successful: ${results.success.length} (${(results.success.length / pdfFiles.length * 100).toFixed(1)}%)`);
  console.log(`Failed: ${results.failed.length} (${(results.failed.length / pdfFiles.length * 100).toFixed(1)}%)`);
  console.log(`Total text extracted: ${(results.totalTextLength / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Average text per PDF: ${(results.totalTextLength / results.success.length / 1024).toFixed(0)} KB`);

  if (results.failed.length > 0) {
    console.log('\n=== FAILED PDFs ===');
    results.failed.forEach(f => {
      console.log(`  • ${f.filename}`);
      console.log(`    Error: ${f.error}`);
    });
  }

  if (results.success.length > 0) {
    console.log('\n=== TOP 5 LARGEST EXTRACTIONS ===');
    const top5 = [...results.success]
      .sort((a, b) => b.textLength - a.textLength)
      .slice(0, 5);

    top5.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.filename} - ${(r.textLength / 1024).toFixed(0)} KB in ${r.duration}ms`);
    });

    console.log('\n=== TOP 5 SMALLEST EXTRACTIONS ===');
    const bottom5 = [...results.success]
      .sort((a, b) => a.textLength - b.textLength)
      .slice(0, 5);

    bottom5.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.filename} - ${(r.textLength / 1024).toFixed(0)} KB in ${r.duration}ms`);
    });
  }

  console.log('\n' + '='.repeat(60));

  // Exit with error code if any failed
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
testPdfParser().catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});
