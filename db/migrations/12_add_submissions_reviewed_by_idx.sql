-- Add index for submissions reviewed_by foreign key
-- Performance optimization for queries filtering by reviewed_by (moderator/admin actions)

CREATE INDEX IF NOT EXISTS idx_submissions_reviewed_by
ON public.submissions (reviewed_by)
WHERE reviewed_by IS NOT NULL;