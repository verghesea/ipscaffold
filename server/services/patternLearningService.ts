/**
 * Pattern Learning Service
 * Uses Claude to analyze corrections and generate regex patterns
 */

import Anthropic from '@anthropic-ai/sdk';
import { getPendingCorrections, updateCorrectionWithPattern } from './extractionLogger';
import { supabaseAdmin } from '../lib/supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface PatternSuggestion {
  pattern: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  passRate: number;
  testedAgainst: number;
  testResults: PatternTestResult[];
  recommendation: 'auto_deploy' | 'review' | 'needs_more_data';
}

export interface PatternTestResult {
  correctionId: string;
  correctedValue: string;
  matched: boolean;
  extractedValue: string | null;
}

interface CorrectionForAnalysis {
  id: string;
  patent_id: string;
  field_name: string;
  corrected_value: string;
  context_before: string;
  context_after: string;
  full_context: string;
}

/**
 * Analyze corrections for a specific field and generate pattern suggestions
 *
 * @param fieldName - Field to analyze (assignee, inventors, filingDate, etc.)
 * @param minCorrections - Minimum corrections needed (default: 5)
 * @returns Pattern suggestions with test results
 */
export async function analyzeFieldCorrections(
  fieldName: string,
  minCorrections: number = 5
): Promise<PatternSuggestion[]> {
  console.log(`[PatternLearning] Analyzing corrections for field: ${fieldName}`);

  // Get pending corrections for this field
  const corrections = await getPendingCorrections(fieldName, 50);

  if (corrections.length < minCorrections) {
    console.log(`[PatternLearning] Not enough corrections (${corrections.length}/${minCorrections})`);
    return [];
  }

  console.log(`[PatternLearning] Found ${corrections.length} corrections to analyze`);

  // Group corrections by context similarity
  const groups = groupCorrectionsByContext(corrections);
  console.log(`[PatternLearning] Grouped into ${groups.length} similar patterns`);

  const suggestions: PatternSuggestion[] = [];

  // Analyze each group
  for (const group of groups) {
    if (group.length < 2) continue; // Skip single corrections

    try {
      console.log(`[PatternLearning] Generating pattern for group of ${group.length} corrections`);

      const suggestion = await generatePatternFromGroup(fieldName, group);
      suggestions.push(suggestion);

      // Update corrections with suggestions
      for (const correction of group) {
        await updateCorrectionWithPattern(
          correction.id,
          suggestion.pattern,
          suggestion.passRate
        );
      }
    } catch (error) {
      console.error('[PatternLearning] Error generating pattern:', error);
    }
  }

  return suggestions;
}

/**
 * Generate a regex pattern from a group of similar corrections
 * Uses Claude to analyze examples and create a robust pattern
 */
async function generatePatternFromGroup(
  fieldName: string,
  corrections: CorrectionForAnalysis[]
): Promise<PatternSuggestion> {
  const prompt = buildPatternGenerationPrompt(fieldName, corrections);

  console.log(`[PatternLearning] Sending ${corrections.length} examples to Claude...`);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Parse Claude's response
  const content = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = parseClaudeResponse(content);

  console.log(`[PatternLearning] Claude suggested pattern: ${parsed.pattern}`);

  // Test the pattern against all corrections
  const testResults = testPatternAgainstCorrections(parsed.pattern, corrections);
  const passCount = testResults.filter((r) => r.matched).length;
  const passRate = passCount / testResults.length;

  console.log(`[PatternLearning] Pattern passed ${passCount}/${testResults.length} tests (${(passRate * 100).toFixed(0)}%)`);

  // Determine confidence and recommendation
  let confidence: 'high' | 'medium' | 'low';
  let recommendation: 'auto_deploy' | 'review' | 'needs_more_data';

  if (passRate >= 0.9 && corrections.length >= 5) {
    confidence = 'high';
    recommendation = 'auto_deploy';
  } else if (passRate >= 0.7 && corrections.length >= 3) {
    confidence = 'medium';
    recommendation = 'review';
  } else {
    confidence = 'low';
    recommendation = 'needs_more_data';
  }

  return {
    pattern: parsed.pattern,
    description: parsed.description,
    confidence,
    passRate,
    testedAgainst: corrections.length,
    testResults,
    recommendation,
  };
}

/**
 * Build a prompt for Claude to generate a regex pattern
 */
function buildPatternGenerationPrompt(
  fieldName: string,
  corrections: CorrectionForAnalysis[]
): string {
  const examples = corrections
    .slice(0, 10) // Limit to 10 examples to avoid token limits
    .map(
      (c, i) => `
Example ${i + 1}:
- Correct value: "${c.corrected_value}"
- Context before: "${c.context_before.substring(c.context_before.length - 100)}"
- Context after: "${c.context_after.substring(0, 100)}"
`
    )
    .join('\n');

  return `You are an expert at writing regex patterns for extracting metadata from USPTO patent PDFs.

Field: ${fieldName}

I have ${corrections.length} examples where the automatic extraction failed, but humans corrected them. Your task is to generate a JavaScript-compatible regex pattern that would have correctly extracted all these values.

${examples}

Requirements:
1. The pattern must capture the correct value in capture group 1: (...)
2. Use non-greedy quantifiers .*? where appropriate
3. Handle common variations (whitespace, punctuation, formatting)
4. Be specific enough to avoid false positives
5. The pattern should work in JavaScript's RegExp with 'i' flag (case-insensitive)

Important context about USPTO patent PDFs:
- Field labels like "Assignee:", "Inventors:", "Filed:" appear in various formats
- May have numbering like "(72) Inventor:" or "(73) Assignee:"
- Values may be followed by location codes like "(US)", state codes, or city names
- Formatting can be inconsistent (extra spaces, line breaks, asterisks)

Respond with EXACTLY this format:

PATTERN:
/your regex pattern here/

DESCRIPTION:
Brief description of what the pattern matches (1-2 sentences)

CONFIDENCE:
Your confidence level (0.0-1.0) that this pattern will generalize well`;
}

/**
 * Parse Claude's response to extract pattern, description, and confidence
 */
function parseClaudeResponse(response: string): {
  pattern: string;
  description: string;
  confidence: number;
} {
  // Extract pattern (between PATTERN: and next section)
  const patternMatch = response.match(/PATTERN:\s*\n?\s*\/(.+?)\//s);
  const pattern = patternMatch ? patternMatch[1] : '';

  // Extract description
  const descMatch = response.match(/DESCRIPTION:\s*\n?\s*(.+?)(?=\n\n|CONFIDENCE:|$)/s);
  const description = descMatch ? descMatch[1].trim() : 'Pattern extracted from corrections';

  // Extract confidence
  const confMatch = response.match(/CONFIDENCE:\s*\n?\s*([\d.]+)/);
  const confidence = confMatch ? parseFloat(confMatch[1]) : 0.5;

  if (!pattern) {
    throw new Error('Failed to parse pattern from Claude response');
  }

  return { pattern, description, confidence };
}

/**
 * Test a regex pattern against corrections to see if it extracts the correct values
 */
function testPatternAgainstCorrections(
  patternStr: string,
  corrections: CorrectionForAnalysis[]
): PatternTestResult[] {
  let regex: RegExp;

  try {
    regex = new RegExp(patternStr, 'i');
  } catch (error) {
    console.error('[PatternLearning] Invalid regex pattern:', error);
    // Return all as failed
    return corrections.map((c) => ({
      correctionId: c.id,
      correctedValue: c.corrected_value,
      matched: false,
      extractedValue: null,
    }));
  }

  return corrections.map((correction) => {
    // Test against the full PDF context
    const match = correction.full_context.match(regex);
    const extractedValue = match && match[1] ? match[1].trim() : null;

    // Check if extracted value matches the corrected value
    // Use loose matching (case-insensitive, trim whitespace)
    const matched =
      extractedValue !== null &&
      extractedValue.toLowerCase().trim() === correction.corrected_value.toLowerCase().trim();

    return {
      correctionId: correction.id,
      correctedValue: correction.corrected_value,
      matched,
      extractedValue,
    };
  });
}

/**
 * Group corrections by context similarity
 * Helps identify common patterns vs one-off edge cases
 */
function groupCorrectionsByContext(
  corrections: CorrectionForAnalysis[]
): CorrectionForAnalysis[][] {
  // Simple grouping: all corrections for same field are in one group
  // In future, could use more sophisticated similarity detection
  // (e.g., clustering by context text similarity)

  const groups: CorrectionForAnalysis[][] = [];

  // For now, just return all corrections as one group if there are enough
  if (corrections.length >= 3) {
    groups.push(corrections);
  } else {
    // If too few, return individual groups (won't be processed)
    corrections.forEach((c) => groups.push([c]));
  }

  return groups;
}

/**
 * Deploy a learned pattern to the database
 *
 * @param fieldName - Field this pattern applies to
 * @param pattern - Regex pattern string
 * @param description - Human-readable description
 * @param correctionIds - Corrections this pattern was learned from
 * @param priority - Pattern priority (lower = tried first)
 * @param createdBy - Admin user ID
 * @returns Pattern ID
 */
export async function deployPattern(
  fieldName: string,
  pattern: string,
  description: string,
  correctionIds: string[],
  priority: number,
  createdBy: string
): Promise<string> {
  console.log(`[PatternLearning] Deploying pattern for ${fieldName}: ${pattern}`);

  // Insert pattern into learned_patterns table
  const { data, error } = await supabaseAdmin
    .from('learned_patterns')
    .insert({
      field_name: fieldName,
      pattern,
      pattern_description: description,
      priority,
      source: 'ai_generated',
      created_by: createdBy,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to deploy pattern: ${error.message}`);
  }

  const patternId = data.id;

  // Mark corrections as deployed
  await supabaseAdmin
    .from('metadata_corrections')
    .update({ pattern_status: 'deployed', correction_id: patternId })
    .in('id', correctionIds);

  console.log(`[PatternLearning] ✓ Pattern deployed with ID: ${patternId}`);

  return patternId;
}

/**
 * Get count of pending corrections by field
 * Used to show "pattern opportunities" in UI
 */
export async function getPendingCorrectionCounts(): Promise<
  Array<{ fieldName: string; count: number; ready: boolean }>
> {
  const { data, error } = await supabaseAdmin
    .from('metadata_corrections')
    .select('field_name')
    .eq('pattern_status', 'pending');

  if (error || !data) {
    console.error('[PatternLearning] Error getting correction counts:', error);
    return [];
  }

  // Count by field
  const counts: Record<string, number> = {};
  data.forEach((row) => {
    counts[row.field_name] = (counts[row.field_name] || 0) + 1;
  });

  return Object.entries(counts).map(([fieldName, count]) => ({
    fieldName,
    count,
    ready: count >= 5, // Threshold for analysis
  }));
}
