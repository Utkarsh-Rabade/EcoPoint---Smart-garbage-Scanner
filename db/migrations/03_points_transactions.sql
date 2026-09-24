-- Points transactions table
-- Immutable ledger of all points changes (earnings and redemptions)

CREATE TABLE IF NOT EXISTS points_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Positive for earnings, negative for redemptions
    transaction_type TEXT NOT NULL, -- submission_award, reward_redeem, admin_adjust, expiration, correction
    related_id UUID, -- Foreign key to submission, reward_redemption, etc. (nullable)
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    batch_id UUID, -- For grouping related transactions (nullable)
    merkle_proof TEXT, -- Cryptographic proof for audit (future enhancement)
    reversing_transaction_id UUID REFERENCES points_transactions(id), -- If this transaction reverses another

    -- Constraints
    CONSTRAINT chk_transaction_type_valid CHECK (
        transaction_type IN (
            'submission_award',
            'reward_redeem',
            'admin_adjust',
            'expiration',
            'correction'
        )
    ),
    CONSTRAINT chk_related_id_consistent CHECK (
        (transaction_type = 'submission_award' AND related_id IS NOT NULL) OR
        (transaction_type = 'reward_redeem' AND related_id IS NOT NULL) OR
        (transaction_type = 'admin_adjust' AND related_id IS NULL) OR
        (transaction_type = 'expiration' AND related_id IS NULL) OR
        (transaction_type = 'correction' AND related_id IS NOT NULL)
    )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created_at ON points_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_created ON points_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_transactions_type ON points_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_points_transactions_related_id ON points_transactions(related_id) WHERE related_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_points_transactions_batch_id ON points_transactions(batch_id) WHERE batch_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for points_transactions (CRITICAL: Only service accounts can insert)
CREATE POLICY "Users can view own transactions"
ON points_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Points transactions only via functions"
ON points_transactions FOR INSERT
USING (false);

CREATE POLICY "Points transactions immutable"
ON points_transactions FOR UPDATE OR DELETE
USING (false);

CREATE POLICY "Service can insert submission awards"
ON points_transactions FOR INSERT
USING (
    auth.role() = 'service'
    AND current_setting('app.current_function', true) = 'award-points-submission'
);

CREATE POLICY "Service can insert reward redemptions"
ON points_transactions FOR INSERT
USING (
    auth.role() = 'service'
    AND current_setting('app.current_function', true) = 'award-points-reward'
);

CREATE POLICY "Service can insert admin adjustments"
ON points_transactions FOR INSERT
USING (
    auth.role() = 'service'
    AND current_setting('app.current_function', true) = 'adjust-points-admin'
    AND (SELECT (raw_user_meta_data->>'role')::text FROM profiles WHERE id = auth.uid()) IN ('admin', 'moderator')
);

CREATE POLICY "Admins can view all transactions"
ON points_transactions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text IN ('admin', 'moderator')
));