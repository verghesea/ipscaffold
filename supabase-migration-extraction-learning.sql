-- Migration: Learning System for Metadata Extraction
-- Purpose: Log extraction attempts, manual corrections, and learn patterns over time
-- Run in Supabase SQL Editor

-- 1. Log every extraction attempt (success or failure)
CREATE TABLE IF NOT EXISTS public.extraction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patent_id UUID REFERENCES public.patents(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,  -- 'assignee', 'inventors', 'filingDate', etc.
    extracted_value TEXT,      -- What the regex extracted (null if failed)
    pattern_used TEXT,         -- Which regex pattern matched (null if none)
    pattern_index INTEGER,     -- Index in the pattern array (0 = first tried)
    extraction_success BOOLEAN NOT NULL,
    context_before TEXT,       -- 200 chars before the field keyword
    context_after TEXT,        -- 200 chars after the field keyword
    full_context TEXT,         -- Larger context window (500 chars around keyword)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Log manual corrections by admins
CREATE TABLE IF NOT EXISTS public.metadata_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patent_id UUID REFERENCES public.patents(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    original_value TEXT,       -- What extraction produced (null if nothing)
    corrected_value TEXT NOT NULL,  -- What admin entered
    corrected_by UUID REFERENCES auth.users(id),

    -- Context for pattern learning
    context_before TEXT,       -- Text before the correct value in PDF
    context_after TEXT,        -- Text after the correct value in PDF
    value_position_start INTEGER, -- Character position where value starts
    value_position_end INTEGER,   -- Character position where value ends

    -- Analysis results
    pattern_suggestion TEXT,   -- AI-suggested regex (if generated)
    pattern_confidence NUMERIC(3, 2), -- AI confidence 0.00-1.00
    pattern_status TEXT DEFAULT 'pending', -- pending, approved, rejected, deployed

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id)
);

-- 3. Store approved patterns that were learned
CREATE TABLE IF NOT EXISTS public.learned_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_name TEXT NOT NULL,
    pattern TEXT NOT NULL,        -- The regex pattern
    pattern_description TEXT,     -- Human-readable explanation
    priority INTEGER DEFAULT 100, -- Lower = tried earlier (1-49: learned, 50-99: AI, 100+: built-in)
    is_active BOOLEAN DEFAULT true,

    -- Provenance
    source TEXT NOT NULL,         -- 'manual', 'ai_generated', 'original'
    correction_id UUID REFERENCES public.metadata_corrections(id),

    -- Effectiveness tracking
    times_used INTEGER DEFAULT 0,
    times_succeeded INTEGER DEFAULT 0,
    success_rate NUMERIC(5, 2) GENERATED ALWAYS AS (
        CASE WHEN times_used > 0
             THEN (times_succeeded::NUMERIC / times_used) * 100
             ELSE 0
        END
    ) STORED,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Analysis queue for batch pattern generation
CREATE TABLE IF NOT EXISTS public.pattern_analysis_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
    corrections_analyzed INTEGER DEFAULT 0,
    patterns_generated INTEGER DEFAULT 0,
    analysis_result JSONB,          -- AI analysis output
    error_message TEXT,             -- If status = 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_extraction_logs_patent ON public.extraction_logs(patent_id);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_field ON public.extraction_logs(field_name);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_success ON public.extraction_logs(extraction_success);
CREATE INDEX IF NOT EXISTS idx_corrections_field ON public.metadata_corrections(field_name);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON public.metadata_corrections(pattern_status);
CREATE INDEX IF NOT EXISTS idx_corrections_patent ON public.metadata_corrections(patent_id);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_field ON public.learned_patterns(field_name, priority);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_active ON public.learned_patterns(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_learned_patterns_success_rate ON public.learned_patterns(success_rate DESC);

-- Enable RLS
ALTER TABLE public.extraction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metadata_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pattern_analysis_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only for all tables)
CREATE POLICY "Admin can manage extraction_logs"
    ON public.extraction_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Admin can manage corrections"
    ON public.metadata_corrections FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Admin can manage learned_patterns"
    ON public.learned_patterns FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Admin can manage pattern_analysis"
    ON public.pattern_analysis_queue FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Comments for documentation
COMMENT ON TABLE public.extraction_logs IS 'Logs every extraction attempt from PDF parsing for analysis';
COMMENT ON TABLE public.metadata_corrections IS 'Tracks manual corrections made by admins to train the system';
COMMENT ON TABLE public.learned_patterns IS 'Stores approved regex patterns learned from corrections';
COMMENT ON TABLE public.pattern_analysis_queue IS 'Queue for batch AI analysis of corrections';

COMMENT ON COLUMN public.learned_patterns.priority IS 'Pattern priority: 1-49 learned, 50-99 AI-generated, 100+ built-in';
COMMENT ON COLUMN public.learned_patterns.success_rate IS 'Auto-calculated: (times_succeeded / times_used) * 100';
COMMENT ON COLUMN public.metadata_corrections.pattern_status IS 'pending = awaiting analysis, approved = ready to deploy, deployed = in production, rejected = not useful';
