import fs from 'fs/promises';
import { createRequire } from 'module';

// pdf-parse is a CommonJS module
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export interface ParsedPatent {
  title: string | null;
  inventors: string | null;
  assignee: string | null;
  filingDate: string | null;
  issueDate: string | null;
  fullText: string;
}

export async function parsePatentPDF(filePath: string): Promise<ParsedPatent> {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  
  const text = data.text;
  
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
  
  return {
    title,
    inventors,
    assignee,
    filingDate,
    issueDate,
    fullText: text
  };
}
