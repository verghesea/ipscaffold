-- Add progress tracking table for real-time patent generation updates
CREATE TABLE IF NOT EXISTS public.patent_progress (
    patent_id UUID PRIMARY KEY REFERENCES public.patents(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    current INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    complete BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.patent_progress IS
'Tracks real-time progress of patent processing including artifacts and images';

COMMENT ON COLUMN public.patent_progress.stage IS
'Current processing stage: artifacts, hero_image, or section_images';

COMMENT ON COLUMN public.patent_progress.current IS
'Current step number in the stage';

COMMENT ON COLUMN public.patent_progress.total IS
'Total steps in the stage';

-- Enable RLS
ALTER TABLE public.patent_progress ENABLE ROW LEVEL SECURITY;

-- Users can view progress for their own patents
CREATE POLICY "Users can view own patent progress"
    ON public.patent_progress FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.patents
            WHERE patents.id = patent_progress.patent_id
            AND patents.user_id = auth.uid()
        )
    );

-- Service role can manage all progress
CREATE POLICY "Service role can manage progress"
    ON public.patent_progress FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patent_progress_updated_at
ON public.patent_progress(updated_at DESC);
