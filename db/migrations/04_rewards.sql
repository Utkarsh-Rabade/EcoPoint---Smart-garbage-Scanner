-- Rewards table
-- Catalog of available rewards that users can redeem with points

CREATE TABLE IF NOT EXISTS rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    points_cost INTEGER NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    available BOOLEAN DEFAULT TRUE NOT NULL,
    inventory_limit INTEGER, -- NULL means unlimited
    inventory_remaining INTEGER, -- NULL means unlimited, must be <= inventory_limit if set
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    fulfillment_type TEXT NOT NULL, -- digital_code, physical_shipping, service_voucher, donation
    requires_address BOOLEAN DEFAULT FALSE NOT NULL,
    digital_delivery BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    fulfilled_count INTEGER DEFAULT 0 NOT NULL,

    -- Constraints
    CONSTRAINT chk_points_cost_positive CHECK (points_cost > 0),
    CONSTRAINT chk_inventory_limit_nonnegative CHECK (inventory_limit IS NULL OR inventory_limit >= 0),
    CONSTRAINT chk_inventory_remaining_nonnegative CHECK (inventory_remaining IS NULL OR inventory_remaining >= 0),
    CONSTRAINT chk_inventory_consistent CHECK (
        (inventory_limit IS NULL AND inventory_remaining IS NULL) OR
        (inventory_limit IS NOT NULL AND inventory_remaining IS NOT NULL AND inventory_remaining <= inventory_limit)
    ),
    CONSTRAINT chk_fulfillment_type_valid CHECK (
        fulfillment_type IN (
            'digital_code',
            'physical_shipping',
            'service_voucher',
            'donation'
        )
    ),
    CONSTRAINT chk_digital_delivery_consistent CHECK (
        (digital_delivery = TRUE AND fulfillment_type = 'digital_code') OR
        (digital_delivery = FALSE)
    ),
    CONSTRAINT chk_requires_address_consistent CHECK (
        (requires_address = TRUE AND fulfillment_type = 'physical_shipping') OR
        (requires_address = FALSE AND fulfillment_type IN ('digital_code', 'service_voucher', 'donation'))
    ),
    CONSTRAINT chk_valid_date_range CHECK (valid_until >= valid_from)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rewards_available ON rewards(available) WHERE available = TRUE;
CREATE INDEX IF NOT EXISTS idx_rewards_points_cost ON rewards(points_cost);
CREATE INDEX IF NOT EXISTS idx_rewards_category ON rewards(category);
CREATE INDEX IF NOT EXISTS idx_rewards_valid_period ON rewards(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_rewards_fulfillment_type ON rewards(fulfillment_type);

-- Enable Row Level Security
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rewards
CREATE POLICY "Anyone can view available rewards"
ON rewards FOR SELECT
USING (
    available = TRUE
    AND NOW() >= valid_from
    AND NOW() <= valid_until
    AND (
        inventory_limit IS NULL
        OR inventory_remaining > 0
    )
);

CREATE POLICY "Admins can manage all rewards"
ON rewards FOR ALL
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text IN ('admin', 'moderator')
));