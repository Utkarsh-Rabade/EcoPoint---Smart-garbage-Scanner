-- RLS performance fixes: replace auth.uid(), auth.role() with (select auth.uid()), (select auth.role())
-- Also fix raw_user_meta_data lookups where needed

-- Profiles table
ALTER POLICY "Users can view own profile" ON public.profiles USING ((select auth.uid()) = id);
ALTER POLICY "Users can update own profile" ON public.profiles USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "Admins can view all profiles" ON public.profiles USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])))));

-- Admin audit logs table
ALTER POLICY "Admins can view audit logs" ON public.admin_audit_logs USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])))));
ALTER POLICY "Service can insert audit logs" ON public.admin_audit_logs WITH CHECK ((select auth.role()) = 'service'::text);

-- IoT devices table
ALTER POLICY "Admins can manage all devices" ON public.iot_devices USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])))));
ALTER POLICY "Users can update own devices" ON public.iot_devices USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can view own devices" ON public.iot_devices USING ((select auth.uid()) = user_id);

-- IoT events table
ALTER POLICY "Admins can view all events" ON public.iot_events USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])))));
ALTER POLICY "Service can insert events" ON public.iot_events WITH CHECK ((select auth.role()) = 'service'::text);
ALTER POLICY "Users can view events from own devices" ON public.iot_events USING (EXISTS ( SELECT 1 FROM iot_devices WHERE ((iot_devices.id = iot_events.device_id) AND (iot_devices.user_id = (select auth.uid())))));

-- Points transactions table
ALTER POLICY "Admins can view all transactions" ON public.points_transactions USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])))));
ALTER POLICY "Service can insert admin adjustments" ON public.points_transactions WITH CHECK (((select auth.role()) = 'service'::text) AND (current_setting('app.current_function', true) = 'adjust-points-admin'::text) AND (( SELECT (users.raw_user_meta_data ->> 'role'::text) FROM auth.users WHERE (users.id = (select auth.uid())) ) = ANY (ARRAY['admin'::text, 'moderator'::text])));
ALTER POLICY "Service can insert reward redemptions" ON public.points_transactions WITH CHECK (((select auth.role()) = 'service'::text) AND (current_setting('app.current_function', true) = 'award-points-reward'::text));
ALTER POLICY "Service can insert submission awards" ON public.points_transactions WITH CHECK (((select auth.role()) = 'service'::text) AND (current_setting('app.current_function', true) = 'award-points-submission'::text));
ALTER POLICY "Users can view own transactions" ON public.points_transactions USING ((select auth.uid()) = user_id);

-- Recycling centers table
ALTER POLICY "Admins can manage recycling centers" ON public.recycling_centers USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])))));

-- Reward redemptions table
ALTER POLICY "Admins can update redemption status" ON public.reward_redemptions USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])))));
ALTER POLICY "Admins can view all redemptions" ON public.reward_redemptions USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])))));
ALTER POLICY "Users can create own redemptions" ON public.reward_redemptions WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can view own redemptions" ON public.reward_redemptions USING ((select auth.uid()) = user_id);

-- Rewards table
ALTER POLICY "Admins can manage all rewards" ON public.rewards USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])))));

-- Submissions table
ALTER POLICY "Admins can view all submissions" ON public.submissions USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])))));
ALTER POLICY "Moderators can update submission status" ON public.submissions USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = (select auth.uid())) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))) WITH CHECK (status = ANY (ARRAY['approved'::text, 'rejected'::text, 'review'::text]));
ALTER POLICY "Users can create own submissions" ON public.submissions WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can view own submissions" ON public.submissions USING ((select auth.uid()) = user_id);