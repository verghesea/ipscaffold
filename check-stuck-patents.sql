-- Find patents stuck in processing with errors
SELECT
    id,
    title,
    status,
    error_message,
    created_at,
    updated_at,
    user_id,
    pdf_filename
FROM patents
WHERE status IN ('processing', 'failed', 'elia15_complete')
    AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;

-- Check artifacts for these patents
SELECT
    p.id as patent_id,
    p.title,
    p.status as patent_status,
    COUNT(a.id) as artifact_count
FROM patents p
LEFT JOIN artifacts a ON a.patent_id = p.id
WHERE p.status IN ('processing', 'failed', 'elia15_complete')
    AND p.created_at > NOW() - INTERVAL '7 days'
GROUP BY p.id, p.title, p.status
ORDER BY p.created_at DESC;
