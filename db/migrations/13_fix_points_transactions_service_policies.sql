-- Fix RLS initialization plan issues in points_transactions table
-- Replace direct auth.role() and current_setting() calls with cached subselect versions

-- Drop and recreate the service insert admin adjustments policy
DROP POLICY IF EXISTS "Service can insert admin adjustments" ON public.points_transactions;
CREATE POLICY "Service can insert admin adjustments"
ON public.points_transactions FOR INSERT
TO authenticated
WITH CHECK (
    ((SELECT auth.role()) = 'service'::text)
    AND (current_setting('app.current_function'::text, true) = 'adjust-points-admin'::text)
    AND ((SELECT (users.raw_user_meta_data ->> 'role'::text) AS text
          FROM auth.users
          WHERE (users.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text]))
);

-- Drop and recreate the service insert reward redemptions policy
DROP POLICY IF EXISTS "Service can insert reward redemptions" ON public.points_transactions;
CREATE POLICY "Service can insert reward redemptions"
ON public.points_transactions FOR INSERT
TO authenticated
WITH CHECK (
    ((SELECT auth.role()) = 'service'::text)
    AND (current_setting('app.current_function'::text, true) = 'award-points-reward'::text)
);

-- Drop and recreate the service insert submission awards policy
DROP POLICY IF EXISTS "Service can insert submission awards" ON public.points_transactions;
CREATE POLICY "Service can insert submission awards"
ON public.points_transactions FOR INSERT
TO authenticated
WITH CHECK (
    ((SELECT auth.role()) = 'service'::text)
    AND (current_setting('app.current_function'::text, true) = 'award-points-submission'::text)
);