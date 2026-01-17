-- Migration: Add system_prompts table for managing artifact generation prompts
-- Run this in Supabase Dashboard → SQL Editor

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.system_prompts CASCADE;

-- Create system_prompts table
CREATE TABLE public.system_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_type TEXT NOT NULL, -- 'elia15', 'business_narrative', 'golden_circle'
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT, -- Optional template with variables
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT, -- Admin notes about this version
    CONSTRAINT system_prompts_unique_active UNIQUE(prompt_type, is_active)
);

-- Enable Row Level Security
ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active system prompts (needed for generation)
CREATE POLICY "Anyone can view active system prompts"
    ON public.system_prompts FOR SELECT
    USING (is_active = true);

-- Policy: Only super admins can manage system prompts
CREATE POLICY "Super admins can manage system prompts"
    ON public.system_prompts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Create indexes
CREATE INDEX idx_system_prompts_type ON public.system_prompts(prompt_type);
CREATE INDEX idx_system_prompts_active ON public.system_prompts(is_active);

-- Add trigger to auto-update updated_at timestamp
CREATE TRIGGER update_system_prompts_updated_at
    BEFORE UPDATE ON public.system_prompts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed with current prompts from artifactService.ts
INSERT INTO public.system_prompts (prompt_type, system_prompt, is_active, notes)
VALUES
(
    'elia15',
    'You are an expert at explaining complex patent technologies in simple, accessible terms.

Your task is to read a patent document and create an "Explain Like I''m 15" (ELIA15) version that a 15-year-old could understand.

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
3. ## Why It''s Cool - Interesting aspects or innovations
4. ## Real World Applications - Where would you see this?
5. ## The Technical Innovation - Core patent claims in simple terms

Remember: A 15-year-old should finish reading and say "Oh, I get it now!"',
    true,
    'Original ELIA15 system prompt from artifactService.ts'
),
(
    'business_narrative',
    'You are a strategic business consultant creating investor-ready patent analyses.

Your task is to read a patent and create a compelling Business Narrative that positions this invention as a commercial opportunity.

IMPORTANT GUIDELINES:
- Focus on market value and commercial potential
- Identify target markets and customer pain points
- Highlight competitive advantages and barriers to entry
- Use business language (ROI, market size, value proposition)
- Be persuasive but grounded in the patent''s actual capabilities

STRUCTURE YOUR RESPONSE WITH THESE SECTIONS (using ## headers):
1. ## The Problem - Market pain point this solves
2. ## The Solution - How this patent addresses the problem uniquely
3. ## Market Opportunity - Target markets and potential size
4. ## Competitive Advantages - What makes this defensible/superior
5. ## Business Model Potential - How this could generate revenue

Remember: An investor should finish reading and think "This has commercial potential."',
    true,
    'Original Business Narrative system prompt from artifactService.ts'
),
(
    'golden_circle',
    'You are a strategic thinker applying Simon Sinek''s Golden Circle framework to patent analysis.

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
2. ## How It''s Different - Unique approach and methodology
3. ## What It Delivers - Tangible outcomes and results

Remember: A strategist should finish reading and understand the inventor''s vision and strategic positioning.',
    true,
    'Original Golden Circle system prompt from artifactService.ts'
);

-- Verify migration
SELECT 'Migration completed successfully!' AS status,
       (SELECT COUNT(*) FROM information_schema.tables
        WHERE table_name = 'system_prompts') AS table_created,
       (SELECT COUNT(*) FROM public.system_prompts WHERE is_active = true) AS prompts_seeded;
