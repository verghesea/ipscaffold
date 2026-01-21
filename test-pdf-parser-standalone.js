/**
 * Standalone PDF parser test - no Supabase dependencies
 * Tests pdf-parse and pdf.js extraction only
 */

import fs from 'fs/promises';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const PDF_DIR = '/Users/averghese/spider_ai/patent_enrichment/pdfs';

// Import pdf-parse dynamically
let getPdfParseClass;

async function loadPdfParse() {
  if (getPdfParseClass) return getPdfParseClass;

  const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js');
  getPdfParseClass = async () => pdfParseModule.default;
  return getPdfParseClass;
}

// Check if text is meaningful (not just page numbers)
function isTextMeaningful(text) {
  if (!text || text.length < 100) return false;

  const pageNumberPattern = /^[\s\-\d]+of\s+\d+[\s\-\d]*$/gim;
  const cleanedText = text.replace(pageNumberPattern, '').trim();

  if (cleanedText.length < 50) return false;

  const words = cleanedText.split(/\s+/).filter(w => w.length > 2);
  return words.length >= 10;
}

// Try pdf-parse first
async function tryPdfParse(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const getPdfParse = await loadPdfParse();
    const PDFParse = await getPdfParse();
    const parser = new PDFParse({ data: dataBuffer });
    await parser.load();
    const result = await parser.getText();
    return result.text;
  } catch (error) {
    throw new Error(`pdf-parse failed: ${error.message}`);
  }
}

// Try pdf.js fallback
async function tryPdfJs(filePath) {
  try {
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

    return fullText;
  } catch (error) {
    throw new Error(`pdf.js failed: ${error.message}`);
  }
}

// Main test function
async function testPDF(filePath, filename) {
  const startTime = Date.now();
  let text = '';
  let method = '';
  let error = null;

  try {
    // Try pdf-parse first
    text = await tryPdfParse(filePath);

    if (isTextMeaningful(text)) {
      method = 'pdf-parse';
    } else {
      // Fallback to pdf.js
      text = await tryPdfJs(filePath);
      method = 'pdf.js';
    }

    const duration = Date.now() - startTime;
    return {
      filename,
      success: true,
      textLength: text.length,
      method,
      duration,
      sample: text.substring(0, 200).replace(/\s+/g, ' ').trim(),
    };

  } catch (err) {
    const duration = Date.now() - startTime;
    return {
      filename,
      success: false,
      error: err.message,
      duration,
    };
  }
}

async function runTests() {
  console.log('=== PDF Parser Standalone Test ===\n');
  console.log(`Testing PDFs in: ${PDF_DIR}\n`);

  const files = await fs.readdir(PDF_DIR);
  const pdfFiles = files.filter(f => f.endsWith('.pdf')).sort();

  console.log(`Found ${pdfFiles.length} PDF files\n`);
  console.log('Starting tests...\n');

  const results = [];
  let successCount = 0;
  let failCount = 0;
  let pdfParseCount = 0;
  let pdfJsCount = 0;
  let totalTextLength = 0;

  for (let i = 0; i < pdfFiles.length; i++) {
    const filename = pdfFiles[i];
    const filePath = path.join(PDF_DIR, filename);

    console.log(`[${i + 1}/${pdfFiles.length}] Testing: ${filename}`);

    const result = await testPDF(filePath, filename);
    results.push(result);

    if (result.success) {
      successCount++;
      totalTextLength += result.textLength;

      if (result.method === 'pdf-parse') pdfParseCount++;
      else pdfJsCount++;

      console.log(`  ✓ SUCCESS - ${result.textLength.toLocaleString()} chars via ${result.method} (${result.duration}ms)`);

      // Show sample for the problematic PDF
      if (filename === 'US20230310646A1.pdf') {
        console.log(`  📄 Sample: "${result.sample}"`);
      }
    } else {
      failCount++;
      console.log(`  ✗ FAILED - ${result.error}`);
    }

    console.log('');
  }

  // Print summary
  console.log('='.repeat(70));
  console.log('=== TEST SUMMARY ===\n');
  console.log(`Total PDFs tested: ${pdfFiles.length}`);
  console.log(`✓ Successful: ${successCount} (${(successCount / pdfFiles.length * 100).toFixed(1)}%)`);
  console.log(`✗ Failed: ${failCount} (${(failCount / pdfFiles.length * 100).toFixed(1)}%)`);
  console.log(`\nExtraction methods:`);
  console.log(`  • pdf-parse: ${pdfParseCount} (${(pdfParseCount / successCount * 100).toFixed(1)}%)`);
  console.log(`  • pdf.js fallback: ${pdfJsCount} (${(pdfJsCount / successCount * 100).toFixed(1)}%)`);
  console.log(`\nTotal text extracted: ${(totalTextLength / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Average per PDF: ${(totalTextLength / successCount / 1024).toFixed(0)} KB`);

  // Check the problematic PDF specifically
  const problematicPdf = results.find(r => r.filename === 'US20230310646A1.pdf');
  if (problematicPdf) {
    console.log('\n=== PROBLEMATIC PDF (US20230310646A1.pdf) ===');
    if (problematicPdf.success) {
      console.log(`✓ SUCCESS!`);
      console.log(`  Method: ${problematicPdf.method}`);
      console.log(`  Text length: ${problematicPdf.textLength.toLocaleString()} characters`);
      console.log(`  Duration: ${problematicPdf.duration}ms`);
      console.log(`  Sample: "${problematicPdf.sample}"`);
    } else {
      console.log(`✗ STILL FAILING`);
      console.log(`  Error: ${problematicPdf.error}`);
    }
  }

  if (failCount > 0) {
    console.log('\n=== FAILED PDFs ===');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  • ${r.filename}`);
      console.log(`    Error: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(70));

  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});
