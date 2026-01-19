import fs from 'fs/promises';

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

// Dynamic import for pdf-parse that works in both ESM dev and CJS production
async function getPdfParseClass(): Promise<any> {
  try {
    const module = await import('pdf-parse');
    return (module as any).PDFParse || module.default?.PDFParse;
  } catch {
    return eval('require')('pdf-parse').PDFParse;
  }
}

export async function parsePatentPDF(filePath: string): Promise<ParsedPatent> {
  const dataBuffer = await fs.readFile(filePath);
  
  const PDFParse = await getPdfParseClass();
  const parser = new PDFParse({ data: dataBuffer });
  await parser.load();
  const result = await parser.getText();
  const text = result.text;
  
  // Extract title (usually near the beginning, after "Title:" or as second line)
  const titleMatch = text.match(/(?:Title:|Patent Title:)\s*(.+?)(?:\n|Inventors?:|Abstract:)/i);
  let title = titleMatch ? titleMatch[1].trim() : null;
  
  // Fallback: get title from first few significant lines
  if (!title) {
    const lines = text.split('\n').filter((line: string) => line.trim().length > 10);
    title = lines[1] || lines[0] || 'Untitled Patent';
  }
  
  // Extract inventors
  const inventorsMatch = text.match(/Inventors?:\s*(.+?)(?:\n\n|Assignee:|Appl\.|Filed:)/i);
  const inventors = inventorsMatch ? inventorsMatch[1].trim() : null;
  
  // Extract assignee (multiple patterns for robustness)
  let assignee = null;
  const assigneePatterns = [
    /\(\s*73\s*\)\s*Assignee:\s*([^\n]+?)(?:\n|$)/i, // (73) Assignee: format
    /Assignee:\s*([^\n]+?)(?:\n|$)/i, // Simple Assignee: format
    /(?:\(\s*73\s*\)|Assignee):\s*(.+?)(?:\n\n|Appl\.|Filed:|Notice:)/is, // Multiline with stopwords
  ];

  for (const pattern of assigneePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      assignee = match[1].trim();
      // Remove trailing location codes like (US) but keep the company name
      assignee = assignee.replace(/\s*,?\s*\([A-Z]{2}\)\s*$/, '').trim();
      // Remove "care of" addresses
      assignee = assignee.replace(/\s*,\s*c\/o.+$/i, '').trim();
      console.log(`[PDF Parser] Extracted assignee: "${assignee}"`);
      break;
    }
  }

  if (!assignee) {
    console.log('[PDF Parser] ⚠️ No assignee found in PDF');
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
  const applicationNumberPatterns = [
    /(?:Appl\.?\s+No\.?|Application\s+No\.?)[\s:]*(\d{2}\/\d{3},?\d{3})/i,
    /\(\s*21\s*\)\s*Appl\.\s*No\.?:\s*(\d{2}\/\d{3},?\d{3})/i,
    /Serial\s+No\.?:\s*(\d+)/i,
  ];

  for (const pattern of applicationNumberPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      applicationNumber = match[1].trim();
      break;
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
  const filingDateMatch = text.match(/Filed:\s*(\w+\.?\s+\d{1,2},?\s+\d{4})/i);
  const filingDate = filingDateMatch ? filingDateMatch[1].trim() : null;

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
    fullText: text
  };

  // Log extracted metadata for debugging
  console.log('[PDF Parser] Extraction complete:');
  console.log(`  Title: ${title?.substring(0, 50)}...`);
  console.log(`  Inventors: ${inventors || 'NOT FOUND'}`);
  console.log(`  Assignee: ${assignee || 'NOT FOUND'}`);
  console.log(`  Patent Number: ${patentNumber || 'NOT FOUND'}`);
  console.log(`  Application Number: ${applicationNumber || 'NOT FOUND'}`);
  console.log(`  Classification: ${patentClassification?.substring(0, 50) || 'NOT FOUND'}`);

  return parsed;
}
