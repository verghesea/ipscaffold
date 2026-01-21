import fs from 'fs/promises';
import { logExtraction, extractContext, trackPatternUsage } from './extractionLogger';
import { supabaseAdmin } from '../lib/supabase';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import Anthropic from '@anthropic-ai/sdk';

// Startup diagnostic
console.log('[PDF Parser] Module loaded - pdf.js version:', pdfjsLib.version);

export interface ParsedPatent {
  title: string | null;
  inventors: string | null;
  assignee: string | null;
  filingDate: string | null;
  issueDate: string | null;
  patentNumber: string | null;
  applicationNumber: string | null;
  patentClassification: string | null;
  fullText: string;
}

interface LearnedPattern {
  id: string;
  field_name: string;
  pattern: string;
  pattern_description: string;
  priority: number;
  is_active: boolean;
  source: string;
}

interface PatternWithMetadata {
  regex: RegExp;
  patternId: string | null;
  source: string;
  description: string;
}

// Pattern cache - refreshed periodically
let patternCache: Map<string, PatternWithMetadata[]> | null = null;
let lastPatternCacheTime: number = 0;
const PATTERN_CACHE_TTL = 60000; // 1 minute

/**
 * Load learned patterns from database and merge with built-in patterns
 * Returns patterns sorted by priority (lower = tried first)
 */
async function loadPatternsForField(
  fieldName: string,
  builtInPatterns: RegExp[]
): Promise<PatternWithMetadata[]> {
  const now = Date.now();

  // Refresh cache if expired or not initialized
  if (!patternCache || now - lastPatternCacheTime > PATTERN_CACHE_TTL) {
    patternCache = new Map();
    lastPatternCacheTime = now;

    try {
      const { data: learnedPatterns, error } = await supabaseAdmin
        .from('learned_patterns')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (error) {
        console.error('[PDF Parser] Failed to load learned patterns:', error);
      } else if (learnedPatterns && learnedPatterns.length > 0) {
        console.log(`[PDF Parser] Loaded ${learnedPatterns.length} learned patterns from database`);

        // Group by field name
        for (const pattern of learnedPatterns) {
          if (!patternCache.has(pattern.field_name)) {
            patternCache.set(pattern.field_name, []);
          }

          try {
            const regex = new RegExp(pattern.pattern, 'i');
            patternCache.get(pattern.field_name)!.push({
              regex,
              patternId: pattern.id,
              source: pattern.source || 'learned',
              description: pattern.pattern_description,
            });
          } catch (e) {
            console.error(`[PDF Parser] Invalid regex pattern for ${pattern.field_name}:`, pattern.pattern);
          }
        }
      }
    } catch (error) {
      console.error('[PDF Parser] Error loading learned patterns:', error);
    }
  }

  // Get learned patterns for this field
  const learnedPatternsForField = patternCache.get(fieldName) || [];

  // Convert built-in patterns to PatternWithMetadata
  const builtInPatternsWithMetadata: PatternWithMetadata[] = builtInPatterns.map((regex, idx) => ({
    regex,
    patternId: null,
    source: 'built-in',
    description: `Built-in pattern ${idx + 1}`,
  }));

  // Merge: learned patterns first (already sorted by priority), then built-in
  return [...learnedPatternsForField, ...builtInPatternsWithMetadata];
}

// Dynamic import for pdf-parse that works in both ESM dev and CJS production
async function getPdfParseClass(): Promise<any> {
  try {
    const module = await import('pdf-parse');
    return (module as any).PDFParse || module.default?.PDFParse;
  } catch {
    return eval('require')('pdf-parse').PDFParse;
  }
}

/**
 * Check if extracted text is meaningful (not just page numbers/whitespace)
 */
function isTextMeaningful(text: string): boolean {
  // Remove common page number patterns
  const cleanText = text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/g, '')
    .replace(/Page\s+\d+/gi, '')
    .trim();

  // Count actual words (more than 2 characters)
  const words = cleanText.split(/\s+/).filter(w => w.length > 2);

  // Check for patent keywords
  const hasPatentKeywords = /inventor|assignee|patent|claim|filed|application|abstract/i.test(cleanText);

  // Meaningful if:
  // 1. More than 100 words, OR
  // 2. More than 50 words AND contains patent keywords
  return words.length > 100 || (words.length > 50 && hasPatentKeywords);
}

/**
 * Extract text from PDF using Claude API (ultimate fallback for complex PDFs)
 * This is the most reliable method but also the most expensive (~$2-3 per PDF)
 */
async function extractTextWithClaude(filePath: string): Promise<string> {
  console.log('[PDF Parser] === STARTING CLAUDE API FALLBACK ===');

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[PDF Parser] ❌ ANTHROPIC_API_KEY not found in environment variables');
    throw new Error('ANTHROPIC_API_KEY is required for Claude API fallback. Please add it to your environment variables.');
  }

  try {
    console.log('[PDF Parser] Reading PDF file for Claude API...');
    const dataBuffer = await fs.readFile(filePath);
    const fileSizeMB = (dataBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`[PDF Parser] PDF file size: ${fileSizeMB}MB`);

    console.log('[PDF Parser] Converting to base64...');
    const base64Pdf = dataBuffer.toString('base64');
    console.log(`[PDF Parser] Base64 encoding complete (${base64Pdf.length} characters)`);

    console.log('[PDF Parser] Initializing Claude API client...');
    const anthropic = new Anthropic({ apiKey });

    console.log('[PDF Parser] Sending request to Claude API...');
    const startTime = Date.now();

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            },
            {
              type: 'text',
              text: 'Please extract and return ALL the text content from this patent PDF. Include all sections: title, inventors, assignee, filing dates, patent number, abstract, claims, description, and any other text. Return the complete text verbatim without any commentary or explanation.',
            },
          ],
        },
      ],
    });

    const duration = Date.now() - startTime;
    console.log(`[PDF Parser] ✓ Claude API response received in ${duration}ms`);

    // Extract text from response
    const extractedText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('\n\n');

    console.log(`[PDF Parser] ✓ Claude extracted ${extractedText.length} characters`);

    if (!extractedText || extractedText.length < 100) {
      console.error('[PDF Parser] ❌ Claude extracted text too short:', extractedText.length, 'characters');
      throw new Error('Claude API failed to extract meaningful text from PDF');
    }

    console.log('[PDF Parser] === CLAUDE API FALLBACK SUCCESSFUL ===');
    return extractedText;

  } catch (error: any) {
    console.error('[PDF Parser] ❌ ERROR in extractTextWithClaude:');
    console.error('[PDF Parser] Error name:', error?.name);
    console.error('[PDF Parser] Error message:', error?.message);
    if (error?.status) {
      console.error('[PDF Parser] HTTP status:', error.status);
    }
    console.error('[PDF Parser] Error stack:', error?.stack);
    throw error;
  }
}

/**
 * Extract text from PDF using pdf.js (Mozilla's PDF parser)
 * More robust than pdf-parse, handles complex PDF structures better
 */
async function extractTextWithPdfJs(filePath: string): Promise<string> {
  console.log('[PDF Parser] === STARTING PDF.JS FALLBACK ===');

  try {
    console.log('[PDF Parser] Reading PDF file...');
    const dataBuffer = await fs.readFile(filePath);
    const fileSizeMB = (dataBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`[PDF Parser] PDF file size: ${fileSizeMB}MB`);

    console.log('[PDF Parser] Loading PDF document with pdf.js...');
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(dataBuffer),
      useSystemFonts: true,
      verbosity: 0, // Suppress pdf.js warnings
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    console.log(`[PDF Parser] PDF loaded successfully - ${numPages} pages`);

    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`[PDF Parser] Extracting page ${pageNum}/${numPages}...`);

      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine text items with spaces
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      fullText += pageText + '\n\n';

      // Log progress every 5 pages
      if (pageNum % 5 === 0) {
        console.log(`[PDF Parser] Progress: ${pageNum}/${numPages} pages processed`);
      }
    }

    console.log(`[PDF Parser] ✓ pdf.js extracted ${fullText.length} characters from ${numPages} pages`);

    if (!fullText || fullText.length < 100) {
      console.error('[PDF Parser] ❌ pdf.js extracted text too short:', fullText.length, 'characters');
      throw new Error('pdf.js failed to extract meaningful text from PDF');
    }

    console.log('[PDF Parser] === PDF.JS FALLBACK SUCCESSFUL ===');
    return fullText;

  } catch (error: any) {
    console.error('[PDF Parser] ❌ ERROR in extractTextWithPdfJs:');
    console.error('[PDF Parser] Error name:', error?.name);
    console.error('[PDF Parser] Error message:', error?.message);
    console.error('[PDF Parser] Error stack:', error?.stack);
    throw error;
  }
}

/**
 * Extract metadata from patent text using regex patterns
 *
 * @param text - Patent full text
 * @param patentId - Optional patent ID for logging (if re-extracting)
 * @returns Parsed patent metadata (without fullText)
 */
export async function extractMetadataFromText(
  text: string,
  patentId?: string
): Promise<Omit<ParsedPatent, 'fullText'>> {
  
  // Extract title (usually near the beginning, after "Title:" or as second line)
  const titleMatch = text.match(/(?:Title:|Patent Title:)\s*(.+?)(?:\n|Inventors?:|Abstract:)/i);
  let title = titleMatch ? titleMatch[1].trim() : null;
  
  // Fallback: get title from first few significant lines
  if (!title) {
    const lines = text.split('\n').filter((line: string) => line.trim().length > 10);
    title = lines[1] || lines[0] || 'Untitled Patent';
  }
  
  // Extract inventors (multiple patterns for robustness)
  let inventors = null;
  let inventorsPatternUsed: string | null = null;
  let inventorsPatternIndex: number | null = null;
  let inventorsPatternId: string | null = null;
  let inventorsPatternSource: string | null = null;

  const builtInInventorPatterns = [
    /\(\s*72\s*\)\s*Inventors?:\s*([^\n]+?)(?:\n|$)/i, // (72) Inventor: format
    /Inventors?:\s*([^\n]+?)(?:\n|$)/i, // Simple Inventor: format
    /Inventors?:\s*(.+?)(?:\n\n|Assignee:|Appl\.|Filed:)/is, // Multiline with stopwords
  ];

  const inventorPatterns = await loadPatternsForField('inventors', builtInInventorPatterns);

  for (let i = 0; i < inventorPatterns.length; i++) {
    const patternMeta = inventorPatterns[i];
    const match = text.match(patternMeta.regex);
    if (match && match[1]) {
      inventors = match[1].trim();
      // Clean up location info in parentheses
      inventors = inventors.replace(/\s*,?\s*\([A-Z]{2}\)\s*$/g, '').trim();
      inventorsPatternUsed = patternMeta.regex.source;
      inventorsPatternIndex = i;
      inventorsPatternId = patternMeta.patternId;
      inventorsPatternSource = patternMeta.source;
      console.log(`[PDF Parser] Extracted inventors using ${patternMeta.source} pattern: "${inventors.substring(0, 50)}..."`);

      // Track pattern usage if it's a learned pattern
      if (patternMeta.patternId) {
        await trackPatternUsage(patternMeta.patternId, true);
      }
      break;
    }
  }

  // Log extraction attempt (if patentId provided for logging)
  if (patentId) {
    const context = extractContext(text, 'Inventor', 200, 200, 500);
    if (context) {
      await logExtraction({
        patentId,
        fieldName: 'inventors',
        extractedValue: inventors,
        patternUsed: inventorsPatternUsed,
        patternIndex: inventorsPatternIndex,
        success: !!inventors,
        contextBefore: context.before,
        contextAfter: context.after,
        fullContext: context.full,
      });
    }
  }

  if (!inventors) {
    console.log('[PDF Parser] ⚠️ No inventors found in PDF');
    // Debug: Show what's near "Inventor" keyword
    const inventorContext = text.match(/.{0,200}[Ii]nventor.{0,200}/);
    if (inventorContext) {
      console.log('[PDF Parser] DEBUG - Inventor context:', inventorContext[0].substring(0, 150));
    }
  }
  
  // Extract assignee (multiple patterns for robustness)
  let assignee = null;
  let assigneePatternUsed: string | null = null;
  let assigneePatternIndex: number | null = null;
  let assigneePatternId: string | null = null;
  let assigneePatternSource: string | null = null;

  const builtInAssigneePatterns = [
    /\(\s*73\s*\)\s*Assignee:\s*([^\n]+?)(?:\n|$)/i, // (73) Assignee: format
    /Assignee:\s*([^\n]+?)(?:\n|$)/i, // Simple Assignee: format
    /(?:\(\s*73\s*\)|Assignee):\s*(.+?)(?:\n\n|Appl\.|Filed:|Notice:)/is, // Multiline with stopwords
    /Assignee[:\s]+([^(\n]+?)(?:\([A-Z]{2}\)|$)/i, // Assignee with location in parens
    /\*?\s*Assignee[:\s]*([A-Za-z0-9\s,\.&]+?)(?:,\s*[A-Z]{2}|$)/im, // Flexible format with state code
  ];

  const assigneePatterns = await loadPatternsForField('assignee', builtInAssigneePatterns);

  for (let i = 0; i < assigneePatterns.length; i++) {
    const patternMeta = assigneePatterns[i];
    const match = text.match(patternMeta.regex);
    if (match && match[1]) {
      assignee = match[1].trim();
      // Remove trailing location codes like (US), (JP), etc
      assignee = assignee.replace(/\s*,?\s*\([A-Z]{2}\)\s*$/g, '').trim();
      // Remove state codes at end (e.g. ", CA", ", TX")
      assignee = assignee.replace(/\s*,\s*[A-Z]{2}\s*$/g, '').trim();
      // Remove "care of" addresses
      assignee = assignee.replace(/\s*,\s*c\/o.+$/i, '').trim();
      // Remove asterisks and extra whitespace
      assignee = assignee.replace(/\*+/g, '').trim();
      // Only accept if it's reasonable (2-100 chars, not all numbers)
      if (assignee.length >= 2 && assignee.length <= 100 && !/^\d+$/.test(assignee)) {
        assigneePatternUsed = patternMeta.regex.source;
        assigneePatternIndex = i;
        assigneePatternId = patternMeta.patternId;
        assigneePatternSource = patternMeta.source;
        console.log(`[PDF Parser] Extracted assignee using ${patternMeta.source} pattern: "${assignee}"`);

        // Track pattern usage if it's a learned pattern
        if (patternMeta.patternId) {
          await trackPatternUsage(patternMeta.patternId, true);
        }
        break;
      } else {
        assignee = null; // Invalid, keep searching
      }
    }
  }

  // Log extraction attempt (if patentId provided for logging)
  if (patentId) {
    const context = extractContext(text, 'Assignee', 200, 200, 500);
    if (context) {
      await logExtraction({
        patentId,
        fieldName: 'assignee',
        extractedValue: assignee,
        patternUsed: assigneePatternUsed,
        patternIndex: assigneePatternIndex,
        success: !!assignee,
        contextBefore: context.before,
        contextAfter: context.after,
        fullContext: context.full,
      });
    }
  }

  if (!assignee) {
    console.log('[PDF Parser] ⚠️ No assignee found in PDF');
    // Debug: Show what's near "Assignee" keyword
    const assigneeContext = text.match(/.{0,200}[Aa]ssignee.{0,200}/);
    if (assigneeContext) {
      console.log('[PDF Parser] DEBUG - Assignee context:', assigneeContext[0].substring(0, 150));
    }
  }

  // Extract patent number (multiple formats)
  let patentNumber = null;
  const patentNumberPatterns = [
    /(?:Patent\s+No\.?|US)\s*[:\s]*([A-Z]{2}\s*\d{1,2}[,\s]*\d{3}[,\s]*\d{3}\s*[A-Z]\d?)/i,
    /(?:\(\s*10\s*\)|Patent\s+Number):\s*([A-Z]{2}[\s\d,]+[A-Z]\d?)/i,
    /US(\d{7,10})[A-Z]\d?/i,
    /Patent\s+(?:No\.?|Number)\s*[:\s]*([^\n\r]{5,25})/i,
  ];

  for (const pattern of patentNumberPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      patentNumber = match[1].trim().replace(/\s+/g, ' ');
      break;
    }
  }

  // Extract application number
  let applicationNumber = null;
  let applicationNumberPatternUsed: string | null = null;
  let applicationNumberPatternIndex: number | null = null;
  let applicationNumberPatternId: string | null = null;
  let applicationNumberPatternSource: string | null = null;

  const builtInApplicationNumberPatterns = [
    /(?:Appl\.?\s+No\.?|Application\s+No\.?)[\s:]*(\d{2}\/\d{3},?\d{3})/i,
    /\(\s*21\s*\)\s*Appl\.\s*No\.?:\s*(\d{2}\/\d{3},?\d{3})/i,
    /Serial\s+No\.?:\s*(\d+)/i,
  ];

  const applicationNumberPatterns = await loadPatternsForField('applicationNumber', builtInApplicationNumberPatterns);

  for (let i = 0; i < applicationNumberPatterns.length; i++) {
    const patternMeta = applicationNumberPatterns[i];
    const match = text.match(patternMeta.regex);
    if (match && match[1]) {
      applicationNumber = match[1].trim();
      applicationNumberPatternUsed = patternMeta.regex.source;
      applicationNumberPatternIndex = i;
      applicationNumberPatternId = patternMeta.patternId;
      applicationNumberPatternSource = patternMeta.source;
      console.log(`[PDF Parser] Extracted application number using ${patternMeta.source} pattern: "${applicationNumber}"`);

      // Track pattern usage if it's a learned pattern
      if (patternMeta.patternId) {
        await trackPatternUsage(patternMeta.patternId, true);
      }
      break;
    }
  }

  // Log application number extraction
  if (patentId) {
    const context = extractContext(text, 'Appl', 200, 200, 500);
    if (context) {
      await logExtraction({
        patentId,
        fieldName: 'applicationNumber',
        extractedValue: applicationNumber,
        patternUsed: applicationNumberPatternUsed,
        patternIndex: applicationNumberPatternIndex,
        success: !!applicationNumber,
        contextBefore: context.before,
        contextAfter: context.after,
        fullContext: context.full,
      });
    }
  }

  // Extract patent classification (first occurrence of CPC/IPC codes)
  let patentClassification = null;
  const classificationPatterns = [
    /(?:CPC|IPC|Int\.?\s*Cl\.?)[\s:]*([A-H]\d{2}[A-Z]\s*\d+\/\d+(?:[;\s]+[A-H]\d{2}[A-Z]\s*\d+\/\d+)*)/i,
    /(?:CPC|Classification):\s*([^\n]{10,100})/i,
  ];

  for (const pattern of classificationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      patentClassification = match[1].trim().substring(0, 200); // Limit length
      break;
    }
  }

  // Extract filing date
  let filingDate = null;
  let filingDatePatternUsed: string | null = null;
  let filingDatePatternIndex: number | null = null;
  let filingDatePatternId: string | null = null;
  let filingDatePatternSource: string | null = null;

  const builtInFilingDatePatterns = [
    /Filed:\s*(\w+\.?\s+\d{1,2},?\s+\d{4})/i,
  ];

  const filingDatePatterns = await loadPatternsForField('filingDate', builtInFilingDatePatterns);

  for (let i = 0; i < filingDatePatterns.length; i++) {
    const patternMeta = filingDatePatterns[i];
    const match = text.match(patternMeta.regex);
    if (match && match[1]) {
      filingDate = match[1].trim();
      filingDatePatternUsed = patternMeta.regex.source;
      filingDatePatternIndex = i;
      filingDatePatternId = patternMeta.patternId;
      filingDatePatternSource = patternMeta.source;
      console.log(`[PDF Parser] Extracted filing date using ${patternMeta.source} pattern: "${filingDate}"`);

      // Track pattern usage if it's a learned pattern
      if (patternMeta.patternId) {
        await trackPatternUsage(patternMeta.patternId, true);
      }
      break;
    }
  }

  // Log filing date extraction
  if (patentId) {
    const context = extractContext(text, 'Filed:', 200, 200, 500);
    if (context) {
      await logExtraction({
        patentId,
        fieldName: 'filingDate',
        extractedValue: filingDate,
        patternUsed: filingDatePatternUsed,
        patternIndex: filingDatePatternIndex,
        success: !!filingDate,
        contextBefore: context.before,
        contextAfter: context.after,
        fullContext: context.full,
      });
    }
  }

  // Extract issue date (or publication date)
  const issueDateMatch = text.match(/(?:Date of Patent|Patent No\.|Pub\. No\.).*?(\w+\.?\s+\d{1,2},?\s+\d{4})/i);
  const issueDate = issueDateMatch ? issueDateMatch[1].trim() : null;

  const parsed = {
    title,
    inventors,
    assignee,
    filingDate,
    issueDate,
    patentNumber,
    applicationNumber,
    patentClassification,
  };

  // Log extracted metadata for debugging
  console.log('[Metadata Extraction] Extraction complete:');
  console.log(`  Title: ${title?.substring(0, 50)}...`);
  console.log(`  Inventors: ${inventors || 'NOT FOUND'}`);
  console.log(`  Assignee: ${assignee || 'NOT FOUND'}`);
  console.log(`  Patent Number: ${patentNumber || 'NOT FOUND'}`);
  console.log(`  Application Number: ${applicationNumber || 'NOT FOUND'}`);
  console.log(`  Classification: ${patentClassification?.substring(0, 50) || 'NOT FOUND'}`);

  return parsed;
}

/**
 * Parse patent PDF with optional extraction logging
 * Uses pdf-parse first, falls back to Claude API if extraction fails
 *
 * @param filePath - Path to PDF file
 * @param patentId - Optional patent ID for logging (if re-extracting)
 * @returns Parsed patent metadata with fullText
 */
export async function parsePatentPDF(filePath: string, patentId?: string): Promise<ParsedPatent> {
  let text = '';
  let usedClaudeFallback = false;

  try {
    // Try pdf-parse first (fast, free, works for most PDFs)
    console.log('[PDF Parser] Attempting pdf-parse extraction...');
    const dataBuffer = await fs.readFile(filePath);

    const PDFParse = await getPdfParseClass();
    const parser = new PDFParse({ data: dataBuffer });
    await parser.load();
    const result = await parser.getText();
    text = result.text;

    // Check if extraction was successful
    const meaningful = isTextMeaningful(text);

    if (!meaningful) {
      console.log('[PDF Parser] ⚠️ pdf-parse extracted insufficient text (only page numbers/whitespace)');
      console.log('[PDF Parser] Text length:', text.length, 'characters');
      console.log('[PDF Parser] Sample of extracted text:', text.substring(0, 200));
      console.log('[PDF Parser] ========================================');
      console.log('[PDF Parser] TRIGGERING PDF.JS FALLBACK');
      console.log('[PDF Parser] ========================================');

      try {
        // Fallback Tier 2: Use pdf.js (Mozilla's robust PDF parser)
        text = await extractTextWithPdfJs(filePath);
        console.log('[PDF Parser] ✓ pdf.js fallback completed successfully');

        // Check if pdf.js extraction was sufficient
        if (text.length < 1000) {
          console.log('[PDF Parser] ⚠️ pdf.js extracted insufficient text:', text.length, 'characters');
          console.log('[PDF Parser] ========================================');
          console.log('[PDF Parser] TRIGGERING CLAUDE API FALLBACK (FINAL TIER)');
          console.log('[PDF Parser] ========================================');

          try {
            // Fallback Tier 3: Use Claude API (most reliable but expensive)
            text = await extractTextWithClaude(filePath);
            usedClaudeFallback = true;
            console.log('[PDF Parser] ✓ Claude API fallback completed successfully');
          } catch (claudeError) {
            console.error('[PDF Parser] ❌ Claude API fallback failed:');
            console.error('[PDF Parser]', claudeError);
            throw new Error(`Failed to extract PDF text with all methods (pdf-parse, pdf.js, Claude API): ${(claudeError as Error).message}`);
          }
        }
      } catch (pdfJsError) {
        console.error('[PDF Parser] ❌ pdf.js fallback failed:');
        console.error('[PDF Parser]', pdfJsError);

        // Try Claude API as ultimate fallback
        console.log('[PDF Parser] ========================================');
        console.log('[PDF Parser] TRIGGERING CLAUDE API FALLBACK (FINAL TIER)');
        console.log('[PDF Parser] ========================================');

        try {
          text = await extractTextWithClaude(filePath);
          usedClaudeFallback = true;
          console.log('[PDF Parser] ✓ Claude API fallback completed successfully');
        } catch (claudeError) {
          console.error('[PDF Parser] ❌ Claude API fallback also failed:');
          console.error('[PDF Parser]', claudeError);
          throw new Error(`Failed to extract PDF text with all methods: ${(claudeError as Error).message}`);
        }
      }
    } else {
      console.log(`[PDF Parser] ✓ pdf-parse successfully extracted ${text.length} characters`);
    }
  } catch (error) {
    console.error('[PDF Parser] pdf-parse error:', error);
    console.log('[PDF Parser] Falling back to pdf.js...');

    try {
      text = await extractTextWithPdfJs(filePath);
      console.log('[PDF Parser] ✓ pdf.js fallback completed successfully');

      // Check if pdf.js extraction was sufficient
      if (text.length < 1000) {
        console.log('[PDF Parser] ⚠️ pdf.js extracted insufficient text:', text.length, 'characters');
        console.log('[PDF Parser] ========================================');
        console.log('[PDF Parser] TRIGGERING CLAUDE API FALLBACK (FINAL TIER)');
        console.log('[PDF Parser] ========================================');

        try {
          text = await extractTextWithClaude(filePath);
          usedClaudeFallback = true;
          console.log('[PDF Parser] ✓ Claude API fallback completed successfully');
        } catch (claudeError) {
          console.error('[PDF Parser] ❌ Claude API fallback failed:');
          console.error('[PDF Parser]', claudeError);
          throw new Error(`Failed to extract PDF text with all methods: ${(claudeError as Error).message}`);
        }
      }
    } catch (pdfJsError) {
      console.error('[PDF Parser] pdf.js fallback also failed:', pdfJsError);

      // Try Claude API as ultimate fallback
      console.log('[PDF Parser] ========================================');
      console.log('[PDF Parser] TRIGGERING CLAUDE API FALLBACK (FINAL TIER)');
      console.log('[PDF Parser] ========================================');

      try {
        text = await extractTextWithClaude(filePath);
        usedClaudeFallback = true;
        console.log('[PDF Parser] ✓ Claude API fallback completed successfully');
      } catch (claudeError) {
        console.error('[PDF Parser] ❌ Claude API fallback also failed:', claudeError);
        throw new Error('Failed to extract text from PDF using all available methods (pdf-parse, pdf.js, Claude API)');
      }
    }
  }

  // Final sanity check
  if (!text || text.length < 100) {
    throw new Error('PDF text extraction failed - no meaningful text found');
  }

  console.log(`[PDF Parser] Final text length: ${text.length} characters (used ${usedClaudeFallback ? 'Claude API' : 'pdf-parse or pdf.js'})`);

  // Extract metadata from text
  const metadata = await extractMetadataFromText(text, patentId);

  return {
    ...metadata,
    fullText: text,
  };
}
