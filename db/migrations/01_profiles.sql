-- Profiles table
-- Stores user profile information linked to Supabase Auth users

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE,
    total_points INTEGER DEFAULT 0 NOT NULL,
    member_since DATE DEFAULT CURRENT_DATE NOT NULL,
    preferences JSONB DEFAULT '{}'::jsonb NOT NULL,

    -- Constraints
    CONSTRAINT chk_total_points_nonnegative CHECK (total_points >= 0)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_total_points ON profiles(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text IN ('admin', 'moderator')
));

CREATE POLICY "Service can update points cache"
ON profiles FOR UPDATE
USING (auth.role() = 'service')
WITH CHECK (auth.role() = 'service');