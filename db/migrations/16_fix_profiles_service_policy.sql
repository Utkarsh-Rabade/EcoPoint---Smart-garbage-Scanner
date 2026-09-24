-- Fix RLS initialization plan issue in profiles table for service update points cache policy
-- Replace direct auth.role() call with cached subselect version

-- Drop and recreate the service update points cache policy
DROP POLICY IF EXISTS "Service can update points cache" ON public.profiles;
CREATE POLICY "Service can update points cache"
ON public.profiles FOR UPDATE
TO authenticated
USING (((SELECT auth.role()) = 'service'::text))
WITH CHECK (((SELECT auth.role()) = 'service'::text));