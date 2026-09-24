-- Recycling centers table
-- Information about physical recycling centers where users can drop off materials

CREATE TABLE IF NOT EXISTS recycling_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    address JSONB NOT NULL, -- {street, city, state, postal_code, country}
    location GEOGRAPHY(POINT, 4326), -- For distance queries
    phone TEXT,
    website TEXT,
    accepted_materials TEXT[] NOT NULL, -- Array of material types accepted
    hours JSONB NOT NULL, -- Opening hours in structured format
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    verification_date TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,

    -- Constraints
    CONSTRAINT chk_accepted_materials_valid CHECK (
        accepted_materials && ARRAY['plastic', 'glass', 'metal', 'paper', 'cardboard', 'other']
    )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_recycling_centers_location ON recycling_centers USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_recycling_centers_active ON recycling_centers(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_recycling_centers_verified ON recycling_centers(verified) WHERE verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_recycling_centers_created_at ON recycling_centers(created_at DESC);

-- Enable Row Level Security
ALTER TABLE recycling_centers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recycling_centers
CREATE POLICY "Anyone can view active recycling centers"
ON recycling_centers FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "Admins can manage recycling centers"
ON recycling_centers FOR ALL
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text IN ('admin', 'moderator')
));