-- Add index for recycling_centers created_by foreign key
-- Performance optimization for queries filtering by created_by (user's recycling centers)

CREATE INDEX IF NOT EXISTS idx_recycling_centers_created_by
ON public.recycling_centers (created_by)
WHERE created_by IS NOT NULL;