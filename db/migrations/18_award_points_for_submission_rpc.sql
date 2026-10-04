-- Migration 18: Create award_points_for_submission RPC
-- Called by gemini-verify/index.ts after a submission is approved.
--
-- Idempotency: updates submissions.points_awarded only when it is still 0,
-- so double-calling this function is safe and never awards points twice.
-- The unique constraint on points_transactions(related_id) further prevents
-- duplicate ledger rows.

CREATE OR REPLACE FUNCTION award_points_for_submission(p_submission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_points       INTEGER;
  v_already_paid INTEGER;
BEGIN
  -- 1. Fetch the approved submission owned by the given user.
  --    Only process approved submissions with points_awarded = 0.
  SELECT user_id, points_awarded
    INTO v_user_id, v_already_paid
    FROM submissions
   WHERE id     = p_submission_id
     AND status = 'approved';

  -- Submission not found or not approved — nothing to do.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Already awarded — idempotency guard.
  IF v_already_paid > 0 THEN
    RETURN;
  END IF;

  -- 2. Determine points to award (10 pts per approved submission).
  --    This can be extended later to vary by material/confidence.
  v_points := 10;

  -- 3. Write an immutable ledger entry.
  INSERT INTO points_transactions (
    user_id,
    amount,
    transaction_type,
    related_id,
    description
  ) VALUES (
    v_user_id,
    v_points,
    'submission_award',
    p_submission_id,
    'Points awarded for verified recyclable submission'
  )
  ON CONFLICT DO NOTHING;   -- safe if a unique index exists on related_id

  -- 4. Stamp the submission so we know points were awarded.
  UPDATE submissions
     SET points_awarded = v_points
   WHERE id             = p_submission_id
     AND points_awarded = 0;  -- extra idempotency guard at row level

  -- 5. Update the user's running total.
  UPDATE profiles
     SET total_points = total_points + v_points,
         updated_at   = NOW()
   WHERE id = v_user_id;
END;
$$;

-- Allow the service role (Edge Functions) to call this function.
GRANT EXECUTE ON FUNCTION award_points_for_submission(UUID) TO service_role;

-- Prevent ordinary users from calling it directly.
REVOKE EXECUTE ON FUNCTION award_points_for_submission(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION award_points_for_submission(UUID) FROM authenticated;
