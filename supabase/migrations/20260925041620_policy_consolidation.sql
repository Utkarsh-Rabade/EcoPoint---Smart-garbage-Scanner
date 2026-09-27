-- Policy consolidation to reduce multiple permissive policies for same role/cmd
-- This improves performance by reducing policy check overhead

-- iot_devices: SELECT for public
-- Existing policies:
--   "Public can view active public devices": ((user_id IS NULL) AND (status = 'active'::text))
--   "Users can view own devices": (auth.uid() = user_id)
-- Note: "Admins can manage all devices" has cmd ALL, so not included in this consolidation
DROP POLICY IF EXISTS "Public can view active public devices" ON public.iot_devices;
DROP POLICY IF EXISTS "Users can view own devices" ON public.iot_devices;
CREATE POLICY "iot_devices_select_public" ON public.iot_devices
    FOR SELECT
    TO public
    USING (((user_id IS NULL) AND (status = 'active'::text)) OR ((select auth.uid()) = user_id));

-- iot_events: SELECT for public
-- Existing policies:
--   "Admins can view all events": (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))
--   "Public can view events from public devices": (EXISTS ( SELECT 1 FROM iot_devices WHERE ((iot_devices.id = iot_events.device_id) AND (iot_devices.user_id IS NULL))))
--   "Users can view events from own devices": (EXISTS ( SELECT 1 FROM iot_devices WHERE ((iot_devices.id = iot_events.device_id) AND (iot_devices.user_id = auth.uid()))))
DROP POLICY IF EXISTS "Admins can view all events" ON public.iot_events;
DROP POLICY IF EXISTS "Public can view events from public devices" ON public.iot_events;
DROP POLICY IF EXISTS "Users can view events from own devices" ON public.iot_events;
CREATE POLICY "iot_events_select_public" ON public.iot_events
    FOR SELECT
    TO public
    USING (
      EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))
      OR (EXISTS ( SELECT 1 FROM iot_devices WHERE ((iot_devices.id = iot_events.device_id) AND (iot_devices.user_id IS NULL))))
      OR (EXISTS ( SELECT 1 FROM iot_devices WHERE ((iot_devices.id = iot_events.device_id) AND (iot_devices.user_id = (select auth.uid()))))
    );

-- points_transactions: SELECT for public
-- Existing policies:
--   "Admins can view all transactions": (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))
--   "Users can view own transactions": (auth.uid() = user_id)
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.points_transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.points_transactions;
CREATE POLICY "points_transactions_select_public" ON public.points_transactions
    FOR SELECT
    TO public
    USING (
      EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))
      OR ((select auth.uid()) = user_id)
    );

-- profiles: SELECT for public
-- Existing policies:
--   "Admins can view all profiles": (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))
--   "Users can view own profile": (auth.uid() = id)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
    FOR SELECT
    TO public
    USING (
      EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))
      OR ((select auth.uid()) = id)
    );

-- reward_redemptions: SELECT for public
-- Existing policies:
--   "Admins can view all redemptions": (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))
--   "Users can view own redemptions": (auth.uid() = user_id)
DROP POLICY IF EXISTS "Admins can view all redemptions" ON public.reward_redemptions;
DROP POLICY IF EXISTS "Users can view own redemptions" ON public.reward_redemptions;
CREATE POLICY "reward_redemptions_select_public" ON public.reward_redemptions
    FOR SELECT
    TO public
    USING (
      EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))
      OR ((select auth.uid()) = user_id)
    );

-- submissions: SELECT for public
-- Existing policies:
--   "Admins can view all submissions": (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))
--   "Users can view own submissions": (auth.uid() = user_id)
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users can view own submissions" ON public.submissions;
CREATE POLICY "submissions_select_public" ON public.submissions
    FOR SELECT
    TO public
    USING (
      EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))
      OR ((select auth.uid()) = user_id)
    );

-- points_transactions: INSERT for authenticated (service accounts)
-- Existing policies:
--   "Service can insert admin adjustments": (((select auth.role()) = 'service'::text) AND (current_setting('app.current_function', true) = 'adjust-points-admin'::text) AND (( SELECT (users.raw_user_meta_data ->> 'role'::text) FROM auth.users WHERE (users.id = (select auth.uid())) ) = ANY (ARRAY['admin'::text, 'moderator'::text])))
--   "Service can insert reward redemptions": (((select auth.role()) = 'service'::text) AND (current_setting('app.current_function', true) = 'award-points-reward'::text))
--   "Service can insert submission awards": (((select auth.role()) = 'service'::text) AND (current_setting('app.current_function', true) = 'award-points-submission'::text))
-- Note: "Points transactions only via functions" has roles={public} and with_check false, so it does not allow any inserts; we leave it as is.
DROP POLICY IF EXISTS "Service can insert admin adjustments" ON public.points_transactions;
DROP POLICY IF EXISTS "Service can insert reward redemptions" ON public.points_transactions;
DROP POLICY IF EXISTS "Service can insert submission awards" ON public.points_transactions;
CREATE POLICY "points_transactions_insert_authenticated" ON public.points_transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (
      (((select auth.role()) = 'service'::text) AND (current_setting('app.current_function', true) = 'adjust-points-admin'::text) AND (( SELECT (users.raw_user_meta_data ->> 'role'::text) FROM auth.users WHERE (users.id = (select auth.uid())) ) = ANY (ARRAY['admin'::text, 'moderator'::text])))
      OR (((select auth.role()) = 'service'::text) AND (current_setting('app.current_function', true) = 'award-points-reward'::text))
      OR (((select auth.role()) = 'service'::text) AND (current_setting('app.current_function', true) = 'award-points-submission'::text))
    );