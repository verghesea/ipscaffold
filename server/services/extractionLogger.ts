/**
 * Extraction Logger Service
 * Logs PDF extraction attempts for pattern learning
 */

import { supabaseAdmin } from '../lib/supabase';

export interface ExtractionLogEntry {
  patentId: string;
  fieldName: string;
  extractedValue: string | null;
  patternUsed: string | null;
  patternIndex: number | null;
  success: boolean;
  contextBefore: string;
  contextAfter: string;
  fullContext: string;
}

export interface MetadataCorrectionEntry {
  patentId: string;
  fieldName: string;
  originalValue: string | null;
  correctedValue: string;
  correctedBy: string;
  contextBefore?: string;
  contextAfter?: string;
  valuePositionStart?: number;
  valuePositionEnd?: number;
}

export interface ContextExtraction {
  before: string;
  after: string;
  full: string;
  valueStart?: number;
  valueEnd?: number;
}

/**
 * Extract context around a keyword or value in text
 *
 * @param fullText - Complete PDF text
 * @param searchTerm - Keyword to find (e.g., "Assignee:", "Inventors:")
 * @param windowBefore - Characters to include before match (default: 200)
 * @param windowAfter - Characters to include after match (default: 200)
 * @param fullWindow - Characters for full context (default: 500)
 * @returns Context object with before/after/full text
 */
export function extractContext(
  fullText: string,
  searchTerm: string,
  windowBefore: number = 200,
  windowAfter: number = 200,
  fullWindow: number = 500
): ContextExtraction | null {
  if (!fullText || !searchTerm) return null;

  // Find the search term (case-insensitive)
  const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const match = fullText.match(regex);

  if (!match || match.index === undefined) return null;

  const matchStart = match.index;
  const matchEnd = matchStart + match[0].length;

  // Extract windows
  const beforeStart = Math.max(0, matchStart - windowBefore);
  const afterEnd = Math.min(fullText.length, matchEnd + windowAfter);
  const fullStart = Math.max(0, matchStart - fullWindow);
  const fullEnd = Math.min(fullText.length, matchEnd + fullWindow);

  return {
    before: fullText.substring(beforeStart, matchStart).trim(),
    after: fullText.substring(matchEnd, afterEnd).trim(),
    full: fullText.substring(fullStart, fullEnd).trim(),
    valueStart: matchStart,
    valueEnd: matchEnd,
  };
}

/**
 * Find context around a specific value in the text
 * Useful for logging manual corrections
 *
 * @param fullText - Complete PDF text
 * @param value - The value to find in the text
 * @returns Context around the value
 */
export function findValueContext(
  fullText: string,
  value: string
): ContextExtraction | null {
  if (!fullText || !value) return null;

  const index = fullText.indexOf(value);
  if (index === -1) return null;

  const valueEnd = index + value.length;
  const beforeStart = Math.max(0, index - 200);
  const afterEnd = Math.min(fullText.length, valueEnd + 200);
  const fullStart = Math.max(0, index - 500);
  const fullEnd = Math.min(fullText.length, valueEnd + 500);

  return {
    before: fullText.substring(beforeStart, index).trim(),
    after: fullText.substring(valueEnd, afterEnd).trim(),
    full: fullText.substring(fullStart, fullEnd).trim(),
    valueStart: index,
    valueEnd,
  };
}

/**
 * Log an extraction attempt to the database
 *
 * @param entry - Extraction log entry
 */
export async function logExtraction(entry: ExtractionLogEntry): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('extraction_logs')
      .insert({
        patent_id: entry.patentId,
        field_name: entry.fieldName,
        extracted_value: entry.extractedValue,
        pattern_used: entry.patternUsed,
        pattern_index: entry.patternIndex,
        extraction_success: entry.success,
        context_before: entry.contextBefore,
        context_after: entry.contextAfter,
        full_context: entry.fullContext,
      });

    if (error) {
      console.error('[ExtractionLogger] Failed to log extraction:', error);
    }
  } catch (error) {
    console.error('[ExtractionLogger] Error logging extraction:', error);
  }
}

/**
 * Log a manual metadata correction
 *
 * @param entry - Correction entry
 * @returns Correction ID
 */
export async function logMetadataCorrection(
  entry: MetadataCorrectionEntry
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('metadata_corrections')
      .insert({
        patent_id: entry.patentId,
        field_name: entry.fieldName,
        original_value: entry.originalValue,
        corrected_value: entry.correctedValue,
        corrected_by: entry.correctedBy,
        context_before: entry.contextBefore,
        context_after: entry.contextAfter,
        value_position_start: entry.valuePositionStart,
        value_position_end: entry.valuePositionEnd,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[ExtractionLogger] Failed to log correction:', error);
      return null;
    }

    console.log(`[ExtractionLogger] ✓ Logged correction for ${entry.fieldName}: "${entry.correctedValue}"`);
    return data.id;
  } catch (error) {
    console.error('[ExtractionLogger] Error logging correction:', error);
    return null;
  }
}

/**
 * Get failed extractions for a specific field
 * Used for pattern analysis
 *
 * @param fieldName - Field to query (e.g., 'assignee')
 * @param limit - Max number of results
 * @returns Failed extraction logs
 */
export async function getFailedExtractions(
  fieldName: string,
  limit: number = 50
): Promise<ExtractionLogEntry[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('extraction_logs')
      .select('*')
      .eq('field_name', fieldName)
      .eq('extraction_success', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[ExtractionLogger] Failed to get failed extractions:', error);
      return [];
    }

    return (data || []).map((log) => ({
      patentId: log.patent_id,
      fieldName: log.field_name,
      extractedValue: log.extracted_value,
      patternUsed: log.pattern_used,
      patternIndex: log.pattern_index,
      success: log.extraction_success,
      contextBefore: log.context_before,
      contextAfter: log.context_after,
      fullContext: log.full_context,
    }));
  } catch (error) {
    console.error('[ExtractionLogger] Error getting failed extractions:', error);
    return [];
  }
}

/**
 * Get pending corrections for pattern analysis
 *
 * @param fieldName - Field to query
 * @param limit - Max number of results
 * @returns Pending corrections
 */
export async function getPendingCorrections(
  fieldName?: string,
  limit: number = 50
) {
  try {
    let query = supabaseAdmin
      .from('metadata_corrections')
      .select('*')
      .eq('pattern_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fieldName) {
      query = query.eq('field_name', fieldName);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ExtractionLogger] Failed to get pending corrections:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[ExtractionLogger] Error getting pending corrections:', error);
    return [];
  }
}

/**
 * Update correction with AI-generated pattern suggestion
 *
 * @param correctionId - Correction UUID
 * @param pattern - Suggested regex pattern
 * @param confidence - AI confidence (0.0-1.0)
 */
export async function updateCorrectionWithPattern(
  correctionId: string,
  pattern: string,
  confidence: number
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('metadata_corrections')
      .update({
        pattern_suggestion: pattern,
        pattern_confidence: confidence,
        pattern_status: 'suggested',
      })
      .eq('id', correctionId);

    if (error) {
      console.error('[ExtractionLogger] Failed to update correction with pattern:', error);
    }
  } catch (error) {
    console.error('[ExtractionLogger] Error updating correction:', error);
  }
}

/**
 * Track pattern usage and success
 *
 * @param patternId - Learned pattern UUID
 * @param succeeded - Whether the pattern successfully extracted
 */
export async function trackPatternUsage(
  patternId: string,
  succeeded: boolean
): Promise<void> {
  try {
    // Increment times_used and conditionally times_succeeded
    const { error } = await supabaseAdmin.rpc('increment_pattern_stats', {
      pattern_id: patternId,
      did_succeed: succeeded,
    });

    if (error) {
      // If RPC doesn't exist yet, fall back to manual update
      const { data: pattern } = await supabaseAdmin
        .from('learned_patterns')
        .select('times_used, times_succeeded')
        .eq('id', patternId)
        .single();

      if (pattern) {
        await supabaseAdmin
          .from('learned_patterns')
          .update({
            times_used: (pattern.times_used || 0) + 1,
            times_succeeded: succeeded ? (pattern.times_succeeded || 0) + 1 : pattern.times_succeeded,
          })
          .eq('id', patternId);
      }
    }
  } catch (error) {
    console.error('[ExtractionLogger] Error tracking pattern usage:', error);
  }
}
