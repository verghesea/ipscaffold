/**
 * Standalone PDF Parser Test - No Supabase dependency
 * Tests both pdf-parse and pdf.js on all 91 patent PDFs
 *
 * NOTE: pdf-parse bundles pdfjs-dist@5.4.296 internally, while the project
 * has pdfjs-dist@5.4.530. To avoid conflicts, we use pdf-parse's internal
 * pdf.js when the primary parser fails.
 */

import fs from 'fs/promises';
import path from 'path';

const PDF_DIR = '/Users/averghese/spider_ai/patent_enrichment/pdfs';

// Use pdf-parse's internal pdfjs-dist to avoid version conflicts
let pdfjsLib = null;
async function getPdfjsLib() {
  if (!pdfjsLib) {
    // Import from pdf-parse's dependency to ensure version consistency
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

// Dynamic import for pdf-parse
async function getPdfParseClass() {
  try {
    const module = await import('pdf-parse');
    return module.PDFParse || module.default?.PDFParse;
  } catch {
    return eval('require')('pdf-parse').PDFParse;
  }
}

/**
 * Check if extracted text is meaningful (not just page numbers/whitespace)
 */
function isTextMeaningful(text) {
  const cleanText = text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/g, '')
    .replace(/Page\s+\d+/gi, '')
    .trim();

  const words = cleanText.split(/\s+/).filter(w => w.length > 2);
  const hasPatentKeywords = /inventor|assignee|patent|claim|filed|application|abstract/i.test(cleanText);

  return words.length > 100 || (words.length > 50 && hasPatentKeywords);
}

/**
 * Extract text using pdf.js (Mozilla's PDF parser)
 */
async function extractTextWithPdfJs(filePath) {
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

    const pageText = textContent.items
      .map((item) => item.str)
      .join(' ');

    fullText += pageText + '\n\n';
  }

  return { text: fullText, numPages };
}

/**
 * Parse a single PDF with fallback strategy
 */
async function parsePDF(filePath) {
  let text = '';
  let parser = 'pdf-parse';
  let numPages = 0;

  try {
    // Try pdf-parse first
    const dataBuffer = await fs.readFile(filePath);
    const PDFParse = await getPdfParseClass();
    const pdfParser = new PDFParse({ data: dataBuffer });
    await pdfParser.load();
    const result = await pdfParser.getText();
    text = result.text;
    numPages = result.numpages || 0;

    // Check if meaningful
    if (!isTextMeaningful(text)) {
      // Fallback to pdf.js
      const pdfJsResult = await extractTextWithPdfJs(filePath);
      text = pdfJsResult.text;
      numPages = pdfJsResult.numPages;
      parser = 'pdf.js (fallback)';
    }
  } catch (error) {
    // pdf-parse failed, try pdf.js
    try {
      const pdfJsResult = await extractTextWithPdfJs(filePath);
      text = pdfJsResult.text;
      numPages = pdfJsResult.numPages;
      parser = 'pdf.js (fallback)';
    } catch (pdfJsError) {
      throw new Error(`Both parsers failed: pdf-parse: ${error.message}, pdf.js: ${pdfJsError.message}`);
    }
  }

  if (!text || text.length < 100) {
    throw new Error('No meaningful text extracted');
  }

  return { text, parser, numPages };
}

/**
 * Extract basic metadata from text
 */
function extractMetadata(text) {
  const titleMatch = text.match(/(?:Title:|Patent Title:)\s*(.+?)(?:\n|Inventors?:|Abstract:)/i);
  let title = titleMatch ? titleMatch[1].trim() : null;

  if (!title) {
    const lines = text.split('\n').filter(line => line.trim().length > 10);
    title = lines[1] || lines[0] || null;
  }

  const inventorPatterns = [
    /\(\s*72\s*\)\s*Inventors?:\s*([^\n]+?)(?:\n|$)/i,
    /Inventors?:\s*([^\n]+?)(?:\n|$)/i,
  ];

  let inventors = null;
  for (const pattern of inventorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      inventors = match[1].trim().replace(/\s*,?\s*\([A-Z]{2}\)\s*$/g, '').trim();
      break;
    }
  }

  return { title, inventors };
}

async function runTests() {
  console.log('=== PDF Parser Comprehensive Test ===\n');
  console.log(`PDF Directory: ${PDF_DIR}`);
  console.log(`pdf.js version: ${pdfjsLib.version}\n`);

  // Get all PDF files
  const files = await fs.readdir(PDF_DIR);
  const pdfFiles = files.filter(f => f.endsWith('.pdf')).sort();

  console.log(`Found ${pdfFiles.length} PDF files\n`);
  console.log('Starting tests...\n');
  console.log('-'.repeat(80));

  const results = {
    success: [],
    failed: [],
    totalTextLength: 0,
    totalDuration: 0,
    pdfParseCount: 0,
    pdfJsCount: 0,
  };

  // Track the problematic PDF specifically
  const PROBLEMATIC_PDF = 'US20230310646A1.pdf';
  let problematicResult = null;

  for (let i = 0; i < pdfFiles.length; i++) {
    const filename = pdfFiles[i];
    const filePath = path.join(PDF_DIR, filename);

    try {
      const startTime = Date.now();
      const parsed = await parsePDF(filePath);
      const duration = Date.now() - startTime;

      const textLength = parsed.text.length;
      results.totalTextLength += textLength;
      results.totalDuration += duration;

      const metadata = extractMetadata(parsed.text);

      // Count parser usage
      if (parsed.parser.includes('pdf.js')) {
        results.pdfJsCount++;
      } else {
        results.pdfParseCount++;
      }

      console.log(`[${String(i + 1).padStart(2)}/${pdfFiles.length}] SUCCESS: ${filename}`);
      console.log(`         ${(textLength / 1024).toFixed(1)} KB | ${duration}ms | ${parsed.parser} | ${parsed.numPages} pages`);

      if (metadata.title) {
        console.log(`         Title: ${metadata.title.substring(0, 60)}${metadata.title.length > 60 ? '...' : ''}`);
      }

      results.success.push({
        filename,
        textLength,
        duration,
        parser: parsed.parser,
        numPages: parsed.numPages,
        title: metadata.title,
        inventors: metadata.inventors,
      });

      // Track problematic PDF
      if (filename === PROBLEMATIC_PDF) {
        problematicResult = {
          success: true,
          textLength,
          duration,
          parser: parsed.parser,
          textSample: parsed.text.substring(0, 500),
        };
      }

    } catch (error) {
      console.log(`[${String(i + 1).padStart(2)}/${pdfFiles.length}] FAILED: ${filename}`);
      console.log(`         Error: ${error.message}`);

      results.failed.push({
        filename,
        error: error.message,
      });

      // Track problematic PDF
      if (filename === PROBLEMATIC_PDF) {
        problematicResult = {
          success: false,
          error: error.message,
        };
      }
    }

    console.log('');
  }

  // Print summary
  console.log('='.repeat(80));
  console.log('\n=== TEST SUMMARY ===\n');

  const successRate = (results.success.length / pdfFiles.length * 100).toFixed(1);
  const avgDuration = results.success.length > 0 ? (results.totalDuration / results.success.length).toFixed(0) : 0;
  const avgTextSize = results.success.length > 0 ? (results.totalTextLength / results.success.length / 1024).toFixed(1) : 0;

  console.log('1. OVERALL SUCCESS RATE');
  console.log(`   Total PDFs tested: ${pdfFiles.length}`);
  console.log(`   Successful: ${results.success.length} (${successRate}%)`);
  console.log(`   Failed: ${results.failed.length} (${(results.failed.length / pdfFiles.length * 100).toFixed(1)}%)`);
  console.log('');

  console.log('2. PARSER USAGE');
  console.log(`   pdf-parse (primary): ${results.pdfParseCount} PDFs`);
  console.log(`   pdf.js (fallback): ${results.pdfJsCount} PDFs`);
  console.log('');

  console.log('3. PERFORMANCE');
  console.log(`   Total extraction time: ${(results.totalDuration / 1000).toFixed(1)} seconds`);
  console.log(`   Average time per PDF: ${avgDuration}ms`);
  console.log(`   Total text extracted: ${(results.totalTextLength / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Average text per PDF: ${avgTextSize} KB`);
  console.log('');

  // Report on problematic PDF
  console.log('4. PROBLEMATIC PDF ANALYSIS (US20230310646A1.pdf)');
  if (problematicResult) {
    if (problematicResult.success) {
      console.log(`   Status: SUCCESS`);
      console.log(`   Text extracted: ${(problematicResult.textLength / 1024).toFixed(1)} KB`);
      console.log(`   Parser used: ${problematicResult.parser}`);
      console.log(`   Duration: ${problematicResult.duration}ms`);
      console.log(`   Text sample (first 300 chars):`);
      console.log(`   "${problematicResult.textSample.substring(0, 300).replace(/\n/g, ' ')}..."`);

      if (problematicResult.textLength > 10000) {
        console.log(`   VERDICT: FIXED - Now extracting substantial content (${(problematicResult.textLength / 1024).toFixed(0)} KB vs previous 405 bytes)`);
      } else {
        console.log(`   VERDICT: STILL PROBLEMATIC - Only ${problematicResult.textLength} bytes extracted`);
      }
    } else {
      console.log(`   Status: FAILED`);
      console.log(`   Error: ${problematicResult.error}`);
    }
  } else {
    console.log(`   Status: NOT FOUND in PDF directory`);
  }
  console.log('');

  // Report failures
  if (results.failed.length > 0) {
    console.log('5. FAILED PDFs (Need Investigation)');
    results.failed.forEach((f, idx) => {
      console.log(`   ${idx + 1}. ${f.filename}`);
      console.log(`      Error: ${f.error}`);
    });
    console.log('');
  }

  // Report smallest extractions (potential quality issues)
  if (results.success.length > 0) {
    console.log('6. SMALLEST EXTRACTIONS (Potential Quality Issues)');
    const smallest = [...results.success]
      .sort((a, b) => a.textLength - b.textLength)
      .slice(0, 5);

    smallest.forEach((r, idx) => {
      const status = r.textLength < 5000 ? '[LOW]' : '[OK]';
      console.log(`   ${idx + 1}. ${r.filename} - ${(r.textLength / 1024).toFixed(1)} KB ${status}`);
    });
    console.log('');

    console.log('7. LARGEST EXTRACTIONS (For Reference)');
    const largest = [...results.success]
      .sort((a, b) => b.textLength - a.textLength)
      .slice(0, 5);

    largest.forEach((r, idx) => {
      console.log(`   ${idx + 1}. ${r.filename} - ${(r.textLength / 1024).toFixed(1)} KB`);
    });
  }

  console.log('\n' + '='.repeat(80));

  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});
