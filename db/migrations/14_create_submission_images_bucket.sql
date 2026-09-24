-- Create private storage bucket for EcoPoints recycling submission images
-- This bucket stores user-uploaded images for recycling verification

-- Create the submission-images bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submission-images',
  'submission-images',
  false,  -- Private bucket
  5242880,  -- 5MB file size limit
  '{image/jpeg,image/png,image/webp}'  -- Allowed image MIME types
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enable Row Level Security on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload images to their own user-specific path
CREATE POLICY "Users can own upload submission images" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'submission-images'
    AND name LIKE 'submissions/%'
    AND split_part(name, '/', 2) = auth.uid()::text
);

-- Policy: Service role can upload submission images (for backend processing)
CREATE POLICY "Service role can upload submission images" ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'submission-images');

-- Policy: Users can view their own uploaded images
CREATE POLICY "Users can own view submission images" ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'submission-images'
    AND name LIKE 'submissions/%'
    AND split_part(name, '/', 2) = auth.uid()::text
);

-- Policy: Service role can view submission images (for verification)
CREATE POLICY "Service role can view submission images" ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'submission-images');

-- Policy: Users can delete their own uploaded images
CREATE POLICY "Users can own delete submission images" ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'submission-images'
    AND name LIKE 'submissions/%'
    AND split_part(name, '/', 2) = auth.uid()::text
);