-- Add index for points_transactions reversing_transaction_id foreign key
-- Performance optimization for queries filtering by reversing_transaction_id

CREATE INDEX IF NOT EXISTS idx_points_transactions_reversing_transaction_id
ON public.points_transactions (reversing_transaction_id)
WHERE reversing_transaction_id IS NOT NULL;