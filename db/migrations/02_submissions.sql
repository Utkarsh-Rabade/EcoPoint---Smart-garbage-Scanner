-- Submissions table
-- Stores recycling submission records linked to user profiles

CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_hash TEXT NOT NULL, -- SHA-256 hash for duplicate detection
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION, -- GPS accuracy in meters
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, approved, rejected, review
    verification_result JSONB, -- Stores AI verification output
    points_awarded INTEGER DEFAULT 0,
    processed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,

    -- Constraints
    CONSTRAINT chk_status_valid CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'review')),
    CONSTRAINT chk_points_awarded_nonnegative CHECK (points_awarded >= 0),
    CONSTRAINT chk_latitude_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    CONSTRAINT chk_longitude_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
    CONSTRAINT chk_accuracy_nonnegative CHECK (accuracy IS NULL OR accuracy >= 0)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_image_hash ON submissions(image_hash);
CREATE INDEX IF NOT EXISTS idx_submissions_user_status ON submissions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_processed_at ON submissions(processed_at) WHERE processed_at IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for submissions
CREATE POLICY "Users can create own submissions"
ON submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own submissions"
ON submissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Submissions are immutable"
ON submissions FOR UPDATE
USING (false);

CREATE POLICY "Admins can view all submissions"
ON submissions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text IN ('admin', 'moderator')
));

CREATE POLICY "Moderators can update submission status"
ON submissions FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text IN ('admin', 'moderator')
))
WITH CHECK (status IN ('approved', 'rejected', 'review'));