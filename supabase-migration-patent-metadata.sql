-- Add patent metadata fields for better identification and display
ALTER TABLE public.patents
ADD COLUMN IF NOT EXISTS patent_number TEXT,
ADD COLUMN IF NOT EXISTS application_number TEXT,
ADD COLUMN IF NOT EXISTS patent_classification TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_patents_patent_number
ON public.patents(patent_number);

CREATE INDEX IF NOT EXISTS idx_patents_application_number
ON public.patents(application_number);

COMMENT ON COLUMN public.patents.patent_number IS
'Official patent number (e.g., US 11,397,301 B2)';

COMMENT ON COLUMN public.patents.application_number IS
'Patent application number (e.g., US 17/123,456)';

COMMENT ON COLUMN public.patents.patent_classification IS
'Patent classification codes (e.g., CPC, IPC classifications)';
