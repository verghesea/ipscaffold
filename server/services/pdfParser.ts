import fs from 'fs/promises';

export interface ParsedPatent {
  title: string | null;
  inventors: string | null;
  assignee: string | null;
  filingDate: string | null;
  issueDate: string | null;
  patentNumber: string | null;
  publicationNumber: string | null;
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
  
  // Extract assignee
  const assigneeMatch = text.match(/Assignee:\s*(.+?)(?:\n\n|Appl\.|Filed:)/i);
  const assignee = assigneeMatch ? assigneeMatch[1].trim() : null;
  
  // Extract filing date
  const filingDateMatch = text.match(/Filed:\s*(\w+\.?\s+\d{1,2},?\s+\d{4})/i);
  const filingDate = filingDateMatch ? filingDateMatch[1].trim() : null;
  
  // Extract issue date (or publication date)
  const issueDateMatch = text.match(/(?:Date of Patent|Patent No\.|Pub\. No\.).*?(\w+\.?\s+\d{1,2},?\s+\d{4})/i);
  const issueDate = issueDateMatch ? issueDateMatch[1].trim() : null;

  // Extract patent number (multiple common patterns)
  const patentPatterns = [
    /Patent\s+No\.?\s*:?\s*([0-9,]+\s*[A-Z]\d*)/i,
    /US\s*([0-9,]+\s*[A-Z]\d*)/i,
    /United States Patent\s+([0-9,]+)/i,
    /Patent Number:\s*([0-9,]+\s*[A-Z]\d*)/i,
    /\(US\s+([0-9,]+\s*[A-Z]\d*)\)/i,
  ];

  let patentNumber = null;
  for (const pattern of patentPatterns) {
    const match = text.match(pattern);
    if (match) {
      patentNumber = match[1].replace(/,/g, '').trim();
      break;
    }
  }

  // Extract publication number
  const publicationMatch = text.match(/Pub(?:lication)?\.?\s+No\.?\s*:?\s*(US\s*\d{4}\/\d+\s*[A-Z]\d*)/i);
  const publicationNumber = publicationMatch ? publicationMatch[1].trim() : null;

  return {
    title,
    inventors,
    assignee,
    filingDate,
    issueDate,
    patentNumber,
    publicationNumber,
    fullText: text
  };
}
