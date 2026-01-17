/**
 * System Prompt Service - Manages artifact generation prompts from database
 *
 * Allows super admins to view and edit the system prompts used for:
 * - ELIA15 generation
 * - Business Narrative generation
 * - Golden Circle generation
 *
 * Prompts are stored in the database (system_prompts table) instead of hardcoded.
 */

import { supabaseAdmin } from '../lib/supabase';

export interface SystemPrompt {
  id: string;
  prompt_type: 'elia15' | 'business_narrative' | 'golden_circle';
  system_prompt: string;
  user_prompt_template?: string;
  version: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
}

export type PromptType = 'elia15' | 'business_narrative' | 'golden_circle';

/**
 * Get the active system prompt for an artifact type
 * Used during artifact generation
 */
export async function getActiveSystemPrompt(
  promptType: PromptType
): Promise<SystemPrompt | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_prompts')
      .select('*')
      .eq('prompt_type', promptType)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error(`[SystemPrompt] Error fetching ${promptType}:`, error);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`[SystemPrompt] Failed to get ${promptType}:`, error);
    return null;
  }
}

/**
 * Get all versions of a prompt type (for history/comparison)
 */
export async function getAllPromptVersions(
  promptType: PromptType
): Promise<SystemPrompt[]> {
  const { data, error } = await supabaseAdmin
    .from('system_prompts')
    .select('*')
    .eq('prompt_type', promptType)
    .order('version', { ascending: false });

  if (error) {
    console.error(`[SystemPrompt] Error fetching versions:`, error);
    return [];
  }

  return data || [];
}

/**
 * Get all active prompts (for admin UI)
 */
export async function getAllActivePrompts(): Promise<SystemPrompt[]> {
  const { data, error } = await supabaseAdmin
    .from('system_prompts')
    .select('*')
    .eq('is_active', true)
    .order('prompt_type', { ascending: true });

  if (error) {
    console.error('[SystemPrompt] Error fetching all active prompts:', error);
    return [];
  }

  return data || [];
}

/**
 * Update a system prompt (creates new version, deactivates old)
 * Super admin only
 */
export async function updateSystemPrompt(
  promptType: PromptType,
  newPrompt: string,
  userId: string,
  notes?: string
): Promise<SystemPrompt> {
  // Deactivate current active prompt
  await supabaseAdmin
    .from('system_prompts')
    .update({ is_active: false })
    .eq('prompt_type', promptType)
    .eq('is_active', true);

  // Get the latest version number
  const { data: latestVersion } = await supabaseAdmin
    .from('system_prompts')
    .select('version')
    .eq('prompt_type', promptType)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const newVersion = (latestVersion?.version || 0) + 1;

  // Create new active prompt
  const { data, error } = await supabaseAdmin
    .from('system_prompts')
    .insert({
      prompt_type: promptType,
      system_prompt: newPrompt,
      version: newVersion,
      is_active: true,
      created_by: userId,
      notes: notes || `Updated to version ${newVersion}`,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update prompt: ${error.message}`);
  }

  console.log(`[SystemPrompt] Updated ${promptType} to v${newVersion}`);

  return data;
}

/**
 * Rollback to a previous version
 * Super admin only
 */
export async function rollbackToVersion(
  promptType: PromptType,
  versionId: string
): Promise<SystemPrompt> {
  // Get the target version
  const { data: targetPrompt, error: fetchError } = await supabaseAdmin
    .from('system_prompts')
    .select('*')
    .eq('id', versionId)
    .single();

  if (fetchError || !targetPrompt) {
    throw new Error('Version not found');
  }

  // Deactivate current active prompt
  await supabaseAdmin
    .from('system_prompts')
    .update({ is_active: false })
    .eq('prompt_type', promptType)
    .eq('is_active', true);

  // Activate the target version
  const { data, error } = await supabaseAdmin
    .from('system_prompts')
    .update({ is_active: true })
    .eq('id', versionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to rollback: ${error.message}`);
  }

  console.log(`[SystemPrompt] Rolled back ${promptType} to v${targetPrompt.version}`);

  return data;
}

/**
 * Get fallback hardcoded prompts (used if database fails)
 * These match the seeded prompts in the migration
 */
export function getFallbackPrompt(promptType: PromptType): string {
  const fallbacks: Record<PromptType, string> = {
    elia15: `You are an expert at explaining complex patent technologies in simple, accessible terms.

Your task is to read a patent document and create an "Explain Like I'm 15" (ELIA15) version that a 15-year-old could understand.

IMPORTANT GUIDELINES:
- Use simple, everyday language (no jargon)
- Use analogies and real-world examples
- Break down complex concepts into digestible pieces
- Keep paragraphs short (3-4 sentences max)
- Use active voice and conversational tone
- Focus on WHAT it does and WHY it matters (not technical HOW)

STRUCTURE YOUR RESPONSE WITH THESE SECTIONS (using ## headers):
1. ## Introduction - What problem does this solve?
2. ## How It Works - Simple explanation with everyday analogies
3. ## Why It's Cool - Interesting aspects or innovations
4. ## Real World Applications - Where would you see this?
5. ## The Technical Innovation - Core patent claims in simple terms

Remember: A 15-year-old should finish reading and say "Oh, I get it now!"`,

    business_narrative: `You are a strategic business consultant creating investor-ready patent analyses.

Your task is to read a patent and create a compelling Business Narrative that positions this invention as a commercial opportunity.

IMPORTANT GUIDELINES:
- Focus on market value and commercial potential
- Identify target markets and customer pain points
- Highlight competitive advantages and barriers to entry
- Use business language (ROI, market size, value proposition)
- Be persuasive but grounded in the patent's actual capabilities

STRUCTURE YOUR RESPONSE WITH THESE SECTIONS (using ## headers):
1. ## The Problem - Market pain point this solves
2. ## The Solution - How this patent addresses the problem uniquely
3. ## Market Opportunity - Target markets and potential size
4. ## Competitive Advantages - What makes this defensible/superior
5. ## Business Model Potential - How this could generate revenue

Remember: An investor should finish reading and think "This has commercial potential."`,

    golden_circle: `You are a strategic thinker applying Simon Sinek's Golden Circle framework to patent analysis.

Your task is to read a patent and analyze it through the WHY-HOW-WHAT framework.

GOLDEN CIRCLE FRAMEWORK:
- WHY: The purpose, cause, or belief behind this invention
- HOW: The specific approach or methodology that makes this unique
- WHAT: The tangible outcome, product, or result

IMPORTANT GUIDELINES:
- Start with WHY (the deeper purpose beyond profit)
- Connect WHY to emotional or philosophical motivations
- Show how HOW differentiates this from alternatives
- Make WHAT concrete and measurable
- Reveal the strategic thinking behind the invention

STRUCTURE YOUR RESPONSE WITH THESE SECTIONS (using ## headers):
1. ## Why This Exists - The deeper purpose and vision
2. ## How It's Different - Unique approach and methodology
3. ## What It Delivers - Tangible outcomes and results

Remember: A strategist should finish reading and understand the inventor's vision and strategic positioning.`,
  };

  return fallbacks[promptType];
}

/**
 * Get system prompt with fallback
 * Tries database first, falls back to hardcoded if fails
 */
export async function getSystemPromptWithFallback(
  promptType: PromptType
): Promise<string> {
  const dbPrompt = await getActiveSystemPrompt(promptType);

  if (dbPrompt?.system_prompt) {
    console.log(`[SystemPrompt] Using database prompt for ${promptType} (v${dbPrompt.version})`);
    return dbPrompt.system_prompt;
  }

  console.warn(`[SystemPrompt] Database prompt not found for ${promptType}, using fallback`);
  return getFallbackPrompt(promptType);
}
