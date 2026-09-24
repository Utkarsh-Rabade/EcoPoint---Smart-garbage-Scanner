-- Reward redemptions table
-- Records of users redeeming rewards for points

CREATE TABLE IF NOT EXISTS reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
    points_cost INTEGER NOT NULL, -- Points deducted (should match reward.points_cost at time of redemption)
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, shipped, delivered, cancelled
    tracking_number TEXT,
    fulfillment_notes TEXT,
    shipping_address JSONB, -- For physical rewards
    digital_code TEXT, -- Encrypted at rest for digital rewards
    expires_at TIMESTAMP WITH TIME ZONE, -- If reward has expiration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT chk_status_valid CHECK (
        status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')
    ),
    CONSTRAINT chk_points_cost_positive CHECK (points_cost > 0),
    CONSTRAINT chk_digital_code_consistent CHECK (
        (digital_code IS NOT NULL AND fulfillment_type = 'digital_code') OR
        (digital_code IS NULL)
    ),
    CONSTRAINT chk_shipping_address_consistent CHECK (
        (shipping_address IS NOT NULL AND EXISTS (
            SELECT 1 FROM rewards WHERE id = reward_id AND requires_address = TRUE
        )) OR
        (shipping_address IS NULL)
    )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user_id ON reward_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_reward_id ON reward_redemptions(reward_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_redeemed_at ON reward_redemptions(redeemed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_status ON reward_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user_status ON reward_redemptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_created_at ON reward_redemptions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reward_redemptions
CREATE POLICY "Users can view own redemptions"
ON reward_redemptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own redemptions"
ON reward_redemptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Redemptions are immutable"
ON reward_redemptions FOR UPDATE
USING (false);

CREATE POLICY "Admins can view all redemptions"
ON reward_redemptions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text IN ('admin', 'moderator')
));

CREATE POLICY "Admins can update redemption status"
ON reward_redemptions FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text IN ('admin', 'moderator')
));