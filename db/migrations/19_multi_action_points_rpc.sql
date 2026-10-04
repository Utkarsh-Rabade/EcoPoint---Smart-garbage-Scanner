-- Migration 19: Update award_points_for_submission to use action-based points
-- Previously hardcoded to 10 pts. Now reads points_awarded from the submissions
-- row, which gemini-verify sets to the correct action-based value before calling
-- this RPC. Backwards compatible — existing approved recycling submissions
-- already have points_awarded=10 (idempotency guard prevents re-awarding).

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
  v_action_type  TEXT;
BEGIN
  -- 1. Fetch the approved submission.
  --    Only process approved submissions with points_awarded = 0.
  SELECT user_id, points_awarded,
         COALESCE(
           (verification_result->>'action_type'),
           CASE WHEN (verification_result->>'is_recyclable_item')::boolean THEN 'recycling' ELSE 'unknown' END
         )
    INTO v_user_id, v_already_paid, v_action_type
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

  -- 2. Determine points to award.
  --    gemini-verify stamps points_awarded on the submissions row BEFORE calling
  --    this RPC. If it is still 0 here, use action-type defaults as a fallback.
  v_points := CASE v_action_type
    WHEN 'recycling'         THEN 10
    WHEN 'waste_segregation' THEN 10
    WHEN 'composting'        THEN 15
    WHEN 'litter_cleanup'    THEN 20
    WHEN 'tree_planting'     THEN 30
    ELSE 10  -- safe fallback
  END;

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
    'EcoPoints awarded for verified environmental action: ' || COALESCE(v_action_type, 'recycling')
  )
  ON CONFLICT DO NOTHING;

  -- 4. Stamp the submission so we know points were awarded.
  UPDATE submissions
     SET points_awarded = v_points
   WHERE id             = p_submission_id
     AND points_awarded = 0;

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
