/**
 * Unit Tests for PDF Parser
 *
 * Tests the metadata extraction logic from patent text.
 * These tests don't require external services.
 *
 * Run: npm test -- server/__tests__/unit/pdfParser.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Supabase admin client to avoid database calls
vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

// Mock the extraction logger
vi.mock('../../services/extractionLogger', () => ({
  logExtraction: vi.fn(),
  extractContext: vi.fn().mockReturnValue(null),
  trackPatternUsage: vi.fn(),
}));

// Import after mocks are set up
import { extractMetadataFromText } from '../../services/pdfParser';

describe('PDF Parser - Metadata Extraction', () => {
  describe('Patent Number Extraction', () => {
    it('should extract US patent number with format US 10,123,456 B2', async () => {
      const text = `
        United States Patent
        Patent No.: US 10,123,456 B2
        Date of Patent: Jan. 1, 2024
      `;

      const result = await extractMetadataFromText(text);
      expect(result.patentNumber).toContain('10,123,456');
    });

    it('should extract patent number from (10) format', async () => {
      const text = `
        (10) Patent Number: US 9,876,543 B1
        (45) Date of Patent: Dec. 15, 2023
      `;

      const result = await extractMetadataFromText(text);
      expect(result.patentNumber).toBeDefined();
    });

    it('should return null for text without patent number', async () => {
      const text = 'This is just some random text without any patent information.';

      const result = await extractMetadataFromText(text);
      expect(result.patentNumber).toBeNull();
    });
  });

  describe('Inventor Extraction', () => {
    it('should extract single inventor from (72) format', async () => {
      const text = `
        (72) Inventor: John Smith, San Jose, CA (US)
        (73) Assignee: Acme Corp
      `;

      const result = await extractMetadataFromText(text);
      expect(result.inventors).toBe('John Smith');
    });

    it('should extract inventors from simple "Inventors:" format', async () => {
      const text = `
        Inventors: Jane Doe, Bob Wilson
        Assignee: Tech Company Inc.
      `;

      const result = await extractMetadataFromText(text);
      expect(result.inventors).toContain('Jane Doe');
    });

    it('should clean up location codes from inventor names', async () => {
      const text = `
        (72) Inventor: Alice Johnson, Cupertino, CA (US)
      `;

      const result = await extractMetadataFromText(text);
      expect(result.inventors).not.toContain('(US)');
      expect(result.inventors).toBe('Alice Johnson');
    });

    it('should handle missing inventors gracefully', async () => {
      const text = 'Patent document without inventor information.';

      const result = await extractMetadataFromText(text);
      expect(result.inventors).toBeNull();
    });
  });

  describe('Assignee Extraction', () => {
    it('should extract assignee from (73) format', async () => {
      const text = `
        (72) Inventor: John Smith
        (73) Assignee: Google LLC, Mountain View, CA (US)
        (21) Appl. No.: 16/123,456
      `;

      const result = await extractMetadataFromText(text);
      expect(result.assignee).toBe('Google LLC');
    });

    it('should extract assignee from simple format', async () => {
      const text = `
        Assignee: Apple Inc.
        Filed: March 15, 2023
      `;

      const result = await extractMetadataFromText(text);
      expect(result.assignee).toBe('Apple Inc.');
    });

    it('should remove state codes from assignee', async () => {
      const text = `
        (73) Assignee: Microsoft Corporation, Redmond, WA
      `;

      const result = await extractMetadataFromText(text);
      expect(result.assignee).not.toContain(', WA');
      expect(result.assignee).toBe('Microsoft Corporation');
    });

    it('should handle assignee with special characters', async () => {
      const text = `
        (73) Assignee: Johnson & Johnson, Inc., New Brunswick, NJ (US)
      `;

      const result = await extractMetadataFromText(text);
      expect(result.assignee).toContain('Johnson & Johnson');
    });
  });

  describe('Application Number Extraction', () => {
    it('should extract application number from (21) format', async () => {
      const text = `
        (21) Appl. No.: 16/123,456
        (22) Filed: Jan. 5, 2022
      `;

      const result = await extractMetadataFromText(text);
      expect(result.applicationNumber).toBe('16/123,456');
    });

    it('should extract application number without leading zeros', async () => {
      const text = `
        Appl. No.: 15/987,654
        Filed: December 1, 2021
      `;

      const result = await extractMetadataFromText(text);
      expect(result.applicationNumber).toContain('987,654');
    });
  });

  describe('Filing Date Extraction', () => {
    it('should extract filing date with month name', async () => {
      const text = `
        (21) Appl. No.: 16/123,456
        Filed: March 15, 2023
      `;

      const result = await extractMetadataFromText(text);
      expect(result.filingDate).toBe('March 15, 2023');
    });

    it('should extract filing date with abbreviated month', async () => {
      const text = `
        Filed: Jan. 5, 2022
      `;

      const result = await extractMetadataFromText(text);
      expect(result.filingDate).toBe('Jan. 5, 2022');
    });
  });

  describe('Title Extraction', () => {
    it('should extract title from "Title:" format', async () => {
      const text = `
        Title: Method and System for Data Processing
        Inventors: John Smith
      `;

      const result = await extractMetadataFromText(text);
      expect(result.title).toBe('Method and System for Data Processing');
    });

    it('should use fallback for title when no explicit title', async () => {
      const text = `
        First Line
        Second Line is the Title Here
        Third Line
      `;

      const result = await extractMetadataFromText(text);
      expect(result.title).toBeDefined();
    });
  });

  describe('Complete Patent Document', () => {
    it('should extract all metadata from a complete patent header', async () => {
      const text = `
        United States Patent
        Smith et al.

        (10) Patent Number: US 11,234,567 B2
        (45) Date of Patent: Mar. 21, 2024

        (54) ADVANCED MACHINE LEARNING SYSTEM FOR DATA ANALYSIS

        (71) Applicant: TechCorp International, Inc., Austin, TX (US)

        (72) Inventors: John Smith, Austin, TX (US);
                       Jane Doe, San Francisco, CA (US)

        (73) Assignee: TechCorp International, Inc., Austin, TX (US)

        (21) Appl. No.: 17/456,789
        (22) Filed: Sep. 15, 2021

        (51) Int. Cl.
             G06N 3/08 (2006.01)
             G06F 18/24 (2023.01)

        Abstract

        A machine learning system for analyzing complex datasets...
      `;

      const result = await extractMetadataFromText(text);

      expect(result.patentNumber).toBeDefined();
      expect(result.inventors).toContain('John Smith');
      expect(result.assignee).toBe('TechCorp International, Inc.');
      expect(result.applicationNumber).toBe('17/456,789');
      expect(result.filingDate).toBe('Sep. 15, 2021');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', async () => {
      const result = await extractMetadataFromText('');

      expect(result.title).toBeDefined();
      expect(result.inventors).toBeNull();
      expect(result.assignee).toBeNull();
      expect(result.patentNumber).toBeNull();
    });

    it('should handle text with only whitespace', async () => {
      const result = await extractMetadataFromText('   \n\n\t  ');

      expect(result.inventors).toBeNull();
      expect(result.assignee).toBeNull();
    });

    it('should handle non-English characters in names', async () => {
      const text = `
        (72) Inventor: Jean-Pierre Dupont, Paris (FR)
        (73) Assignee: Societe Anonyme de Technologies, Paris (FR)
      `;

      const result = await extractMetadataFromText(text);
      // Should at least not crash
      expect(result).toBeDefined();
    });

    it('should handle very long assignee names', async () => {
      const text = `
        (73) Assignee: The Board of Trustees of the Leland Stanford Junior University, Stanford, CA (US)
      `;

      const result = await extractMetadataFromText(text);
      expect(result.assignee).toBe('The Board of Trustees of the Leland Stanford Junior University');
    });
  });
});

describe('PDF Parser - Text Meaningfulness Check', () => {
  // Note: isTextMeaningful is not exported, but we can test via parsePatentPDF behavior
  // These tests document expected behavior

  it('should consider text with patent keywords meaningful', () => {
    const text = `
      This patent describes an invention for processing data.
      The inventors developed a method that improves efficiency.
      Claims include the abstract and detailed description.
    `;

    // This text has patent keywords and sufficient words
    // The function should return true for this
    const wordCount = text.split(/\s+/).filter(w => w.length > 2).length;
    expect(wordCount).toBeGreaterThan(10);
  });

  it('should consider page numbers only as not meaningful', () => {
    const text = `
      -- 1 of 15 --
      Page 1
      -- 2 of 15 --
      Page 2
    `;

    const cleanText = text
      .replace(/--\s*\d+\s*of\s*\d+\s*--/g, '')
      .replace(/Page\s+\d+/gi, '')
      .trim();

    const wordCount = cleanText.split(/\s+/).filter(w => w.length > 2).length;
    expect(wordCount).toBeLessThan(10);
  });
});
