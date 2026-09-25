SET local check_function_bodies = off;

CREATE EXTENSION "postgis" SCHEMA "public";

CREATE TABLE "public"."admin_audit_logs" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "admin_user_id"  uuid,
  "action_type"    text                     NOT NULL,
  "target_type"    text                     NOT NULL,
  "target_id"      uuid,
  "changes"        jsonb                    NOT NULL,
  "timestamp"      timestamp with time zone NOT NULL DEFAULT now(),
  "ip_address"     inet,
  "user_agent"     text,
  "session_id"     text,
  "outcome"        text                     NOT NULL DEFAULT 'success'::text,
  "failure_reason" text,
  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY (id),
  CONSTRAINT "chk_action_type_valid"
    CHECK
    ((action_type = ANY (ARRAY['login'::text, 'logout'::text, 'password_change'::text, 'submission_review'::text, 'submission_override'::text, 'points_adjust'::text,
    'points_expiration'::text,
    'reward_create'::text,
    'reward_update'::text,
    'reward_delete'::text,
    'reward_inventory_update'::text,
    'device_register'::text,
    'device_update'::text,
    'device_decommission'::text,
    'system_config_change'::text, 'bulk_user_action'::text, 'data_export'::text, 'data_deletion_request'::text, 'api_key_rotation'::text, 'security_incident'::text]))),
  CONSTRAINT "chk_outcome_valid" CHECK ((outcome = ANY (ARRAY['success'::text, 'failure'::text, 'partial'::text]))),
  CONSTRAINT "chk_target_type_valid"
    CHECK
    ((target_type = ANY (ARRAY['submission'::text, 'user'::text, 'reward'::text, 'device'::text, 'iot_event'::text, 'recycling_center'::text, 'system'::text, 'api_key'::text,
    'audit_log'::text])))
);

ALTER TABLE "public"."admin_audit_logs"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."iot_devices" (
  "id"                  uuid                         NOT NULL DEFAULT gen_random_uuid(),
  "device_id"           text                         NOT NULL,
  "user_id"             uuid,
  "name"                text                         NOT NULL,
  "description"         text,
  "device_type"         text                         NOT NULL,
  "location"            public.geography(Point,4326) NOT NULL,
  "installation_date"   timestamp with time zone     NOT NULL,
  "last_seen_at"        timestamp with time zone,
  "battery_level"       integer,
  "fill_level"          integer,
  "status"              text                         NOT NULL DEFAULT 'active'::text,
  "firmware_version"    text,
  "capabilities"        jsonb                        NOT NULL DEFAULT '[]'::jsonb,
  "configuration"       jsonb                        DEFAULT '{}'::jsonb,
  "created_at"          timestamp with time zone     NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone     NOT NULL DEFAULT now(),
  "last_maintenance_at" timestamp with time zone,
  CONSTRAINT "chk_battery_level_range" CHECK (((battery_level IS NULL) OR ((battery_level >= 0) AND (battery_level <= 100)))),
  CONSTRAINT "chk_device_type_valid"
    CHECK
    ((device_type = ANY (ARRAY['smart_bin'::text, 'collection_truck'::text, 'sensor_station'::text, 'reverse_vending_machine'::text, 'compactor'::text, 'sorting_system'::text]))),
  CONSTRAINT "chk_fill_level_range" CHECK (((fill_level IS NULL) OR ((fill_level >= 0) AND (fill_level <= 100)))),
  CONSTRAINT "chk_status_valid" CHECK ((status = ANY (ARRAY['active'::text, 'maintenance'::text, 'inactive'::text, 'lost'::text]))),
  CONSTRAINT "iot_devices_device_id_key" UNIQUE (device_id),
  CONSTRAINT "iot_devices_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."iot_devices"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."iot_events" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "device_id"          uuid                     NOT NULL,
  "event_type"         text                     NOT NULL,
  "timestamp"          timestamp with time zone NOT NULL,
  "weight_grams"       integer,
  "fill_level_before"  integer,
  "fill_level_after"   integer,
  "image_url"          text,
  "sensor_data"        jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "processed"          boolean                  NOT NULL DEFAULT false,
  "related_submission" uuid,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chk_event_type_valid"
    CHECK
    ((event_type = ANY (ARRAY['deposit'::text, 'weight_change'::text, 'tamper'::text, 'environmental'::text, 'connectivity'::text, 'maintenance'::text, 'full_alert'::text]))),
  CONSTRAINT "chk_fill_level_after_range" CHECK (((fill_level_after IS NULL) OR ((fill_level_after >= 0) AND (fill_level_after <= 100)))),
  CONSTRAINT "chk_fill_level_before_range" CHECK (((fill_level_before IS NULL) OR ((fill_level_before >= 0) AND (fill_level_before <= 100)))),
  CONSTRAINT "chk_image_url_format" CHECK (((image_url IS NULL) OR (image_url ~* '^https?://'::text))),
  CONSTRAINT "chk_weight_grams_nonnegative" CHECK (((weight_grams IS NULL) OR (weight_grams >= 0))),
  CONSTRAINT "iot_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."iot_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."points_transactions" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  uuid                     NOT NULL,
  "amount"                   integer                  NOT NULL,
  "transaction_type"         text                     NOT NULL,
  "related_id"               uuid,
  "description"              text                     NOT NULL,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "batch_id"                 uuid,
  "merkle_proof"             text,
  "reversing_transaction_id" uuid,
  CONSTRAINT "chk_related_id_consistent" CHECK ((((transaction_type = 'submission_award'::text) AND (related_id IS
    NOT NULL)) OR ((transaction_type = 'reward_redeem'::text) AND (related_id IS
    NOT NULL)) OR ((transaction_type = 'admin_adjust'::text) AND (related_id IS NULL)) OR ((transaction_type = 'expiration'::text) AND (related_id IS NULL)) OR
    ((transaction_type = 'correction'::text) AND (related_id IS NOT NULL)))),
  CONSTRAINT "chk_transaction_type_valid"
    CHECK ((transaction_type = ANY (ARRAY['submission_award'::text, 'reward_redeem'::text, 'admin_adjust'::text, 'expiration'::text, 'correction'::text]))),
  CONSTRAINT "points_transactions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."points_transactions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"             uuid                     NOT NULL,
  "email"          text                     NOT NULL,
  "full_name"      text                     NOT NULL,
  "avatar_url"     text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "is_active"      boolean                  NOT NULL DEFAULT true,
  "email_verified" boolean                  NOT NULL DEFAULT false,
  "last_login_at"  timestamp with time zone,
  "total_points"   integer                  NOT NULL DEFAULT 0,
  "member_since"   date                     NOT NULL DEFAULT CURRENT_DATE,
  "preferences"    jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "chk_total_points_nonnegative" CHECK ((total_points >= 0)),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."recycling_centers" (
  "id"                 uuid                         NOT NULL DEFAULT gen_random_uuid(),
  "name"               text                         NOT NULL,
  "description"        text,
  "address"            jsonb                        NOT NULL,
  "location"           public.geography(Point,4326),
  "phone"              text,
  "website"            text,
  "accepted_materials" text[]                       NOT NULL,
  "hours"              jsonb                        NOT NULL,
  "is_active"          boolean                      NOT NULL DEFAULT true,
  "created_at"         timestamp with time zone     NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone     NOT NULL DEFAULT now(),
  "created_by"         uuid,
  "verified"           boolean                      NOT NULL DEFAULT false,
  "verification_date"  timestamp with time zone,
  "verification_notes" text,
  CONSTRAINT "chk_accepted_materials_valid" CHECK ((accepted_materials && ARRAY['plastic'::text, 'glass'::text, 'metal'::text, 'paper'::text, 'cardboard'::text, 'other'::text])),
  CONSTRAINT "recycling_centers_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."recycling_centers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."reward_redemptions" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"           uuid                     NOT NULL,
  "reward_id"         uuid                     NOT NULL,
  "points_cost"       integer                  NOT NULL,
  "redeemed_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "status"            text                     NOT NULL DEFAULT 'pending'::text,
  "tracking_number"   text,
  "fulfillment_notes" text,
  "shipping_address"  jsonb,
  "digital_code"      text,
  "expires_at"        timestamp with time zone,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chk_points_cost_positive" CHECK ((points_cost > 0)),
  CONSTRAINT "chk_status_valid" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text]))),
  CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."reward_redemptions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."rewards" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "title"               text                     NOT NULL,
  "description"         text                     NOT NULL,
  "points_cost"         integer                  NOT NULL,
  "category"            text                     NOT NULL,
  "image_url"           text,
  "available"           boolean                  NOT NULL DEFAULT true,
  "inventory_limit"     integer,
  "inventory_remaining" integer,
  "valid_from"          timestamp with time zone NOT NULL,
  "valid_until"         timestamp with time zone NOT NULL,
  "fulfillment_type"    text                     NOT NULL,
  "requires_address"    boolean                  NOT NULL DEFAULT false,
  "digital_delivery"    boolean                  NOT NULL DEFAULT false,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "fulfilled_count"     integer                  NOT NULL DEFAULT 0,
  CONSTRAINT "chk_digital_delivery_consistent" CHECK ((((digital_delivery = true) AND (fulfillment_type = 'digital_code'::text)) OR (digital_delivery = false))),
  CONSTRAINT "chk_fulfillment_type_valid" CHECK ((fulfillment_type = ANY (ARRAY['digital_code'::text, 'physical_shipping'::text, 'service_voucher'::text, 'donation'::text]))),
  CONSTRAINT "chk_inventory_consistent" CHECK ((((inventory_limit IS NULL) AND (inventory_remaining IS NULL)) OR ((inventory_limit IS NOT NULL) AND (inventory_remaining IS
    NOT NULL) AND (inventory_remaining <= inventory_limit)))),
  CONSTRAINT "chk_inventory_limit_nonnegative" CHECK (((inventory_limit IS NULL) OR (inventory_limit >= 0))),
  CONSTRAINT "chk_inventory_remaining_nonnegative" CHECK (((inventory_remaining IS NULL) OR (inventory_remaining >= 0))),
  CONSTRAINT "chk_points_cost_positive" CHECK ((points_cost > 0)),
  CONSTRAINT "chk_requires_address_consistent"
    CHECK
    ((((requires_address = true) AND (fulfillment_type = 'physical_shipping'::text)) OR ((requires_address = false) AND (fulfillment_type = ANY (ARRAY['digital_code'::text,
    'service_voucher'::text, 'donation'::text]))))),
  CONSTRAINT "chk_valid_date_range" CHECK ((valid_until >= valid_from)),
  CONSTRAINT "rewards_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."rewards"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."submissions" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"             uuid                     NOT NULL,
  "image_url"           text                     NOT NULL,
  "image_hash"          text                     NOT NULL,
  "latitude"            double precision,
  "longitude"           double precision,
  "accuracy"            double precision,
  "submitted_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "status"              text                     NOT NULL DEFAULT 'pending'::text,
  "verification_result" jsonb,
  "points_awarded"      integer                  DEFAULT 0,
  "processed_at"        timestamp with time zone,
  "reviewed_by"         uuid,
  "reviewed_at"         timestamp with time zone,
  "ip_address"          inet,
  "user_agent"          text,
  CONSTRAINT "chk_accuracy_nonnegative" CHECK (((accuracy IS NULL) OR (accuracy >= (0)::double precision))),
  CONSTRAINT "chk_latitude_range" CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)))),
  CONSTRAINT "chk_longitude_range" CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))),
  CONSTRAINT "chk_points_awarded_nonnegative" CHECK ((points_awarded >= 0)),
  CONSTRAINT "chk_status_valid" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'approved'::text, 'rejected'::text, 'review'::text]))),
  CONSTRAINT "submissions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."submissions"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
    -- Insert a new profile for the newly created user
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        is_active,
        email_verified,
        total_points,
        member_since,
        preferences
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        TRUE,
        COALESCE((NOW() AT TIME ZONE 'utc')::date, CURRENT_DATE),
        0,
        CURRENT_DATE,
        '{}'::jsonb
    );

    RETURN NEW;
END;
$function$;

ALTER TABLE "public"."iot_events"
  ADD CONSTRAINT "iot_events_device_id_fkey" FOREIGN KEY (device_id) REFERENCES public.iot_devices(id) ON DELETE CASCADE;

ALTER TABLE "public"."points_transactions"
  ADD CONSTRAINT "points_transactions_reversing_transaction_id_fkey" FOREIGN KEY (reversing_transaction_id) REFERENCES public.points_transactions(id);

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."admin_audit_logs"
  ADD CONSTRAINT "admin_audit_logs_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."iot_devices"
  ADD CONSTRAINT "iot_devices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."points_transactions"
  ADD CONSTRAINT "points_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."recycling_centers"
  ADD CONSTRAINT "recycling_centers_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."reward_redemptions"
  ADD CONSTRAINT "reward_redemptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."reward_redemptions"
  ADD CONSTRAINT "reward_redemptions_reward_id_fkey" FOREIGN KEY (reward_id) REFERENCES public.rewards(id) ON DELETE RESTRICT;

ALTER TABLE "public"."iot_events"
  ADD CONSTRAINT "iot_events_related_submission_fkey" FOREIGN KEY (related_submission) REFERENCES public.submissions(id) ON DELETE SET NULL;

ALTER TABLE "public"."submissions"
  ADD CONSTRAINT "submissions_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);

ALTER TABLE "public"."submissions"
  ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX idx_admin_audit_logs_action_type ON public.admin_audit_logs USING btree (action_type);

CREATE INDEX idx_admin_audit_logs_admin_user_id ON public.admin_audit_logs USING btree (admin_user_id);

CREATE INDEX idx_admin_audit_logs_ip_address ON public.admin_audit_logs USING btree (ip_address);

CREATE INDEX idx_admin_audit_logs_outcome ON public.admin_audit_logs USING btree (outcome);

CREATE INDEX idx_admin_audit_logs_session_id ON public.admin_audit_logs USING btree (session_id)
  WHERE (session_id IS NOT NULL);

CREATE INDEX idx_admin_audit_logs_target_id ON public.admin_audit_logs USING btree (target_id)
  WHERE (target_id IS NOT NULL);

CREATE INDEX idx_admin_audit_logs_target_type ON public.admin_audit_logs USING btree (target_type);

CREATE INDEX idx_admin_audit_logs_timestamp ON public.admin_audit_logs USING btree ("timestamp" DESC);

CREATE INDEX idx_iot_devices_battery_level ON public.iot_devices USING btree (battery_level)
  WHERE (battery_level IS NOT NULL);

CREATE INDEX idx_iot_devices_device_type ON public.iot_devices USING btree (device_type);

CREATE INDEX idx_iot_devices_fill_level ON public.iot_devices USING btree (fill_level)
  WHERE (fill_level IS NOT NULL);

CREATE INDEX idx_iot_devices_last_seen ON public.iot_devices USING btree (last_seen_at);

CREATE INDEX idx_iot_devices_location ON public.iot_devices USING gist (location);

CREATE INDEX idx_iot_devices_status ON public.iot_devices USING btree (status);

CREATE INDEX idx_iot_devices_user_id ON public.iot_devices USING btree (user_id);

CREATE INDEX idx_iot_events_device_id ON public.iot_events USING btree (device_id);

CREATE INDEX idx_iot_events_device_timestamp ON public.iot_events USING btree (device_id, "timestamp" DESC);

CREATE INDEX idx_iot_events_event_type ON public.iot_events USING btree (event_type);

CREATE INDEX idx_iot_events_processed ON public.iot_events USING btree (processed)
  WHERE (processed = false);

CREATE INDEX idx_iot_events_related_submission ON public.iot_events USING btree (related_submission)
  WHERE (related_submission IS NOT NULL);

CREATE INDEX idx_iot_events_timestamp ON public.iot_events USING btree ("timestamp" DESC);

CREATE INDEX idx_points_transactions_batch_id ON public.points_transactions USING btree (batch_id)
  WHERE (batch_id IS NOT NULL);

CREATE INDEX idx_points_transactions_created_at ON public.points_transactions USING btree (created_at DESC);

CREATE INDEX idx_points_transactions_related_id ON public.points_transactions USING btree (related_id)
  WHERE (related_id IS NOT NULL);

CREATE INDEX idx_points_transactions_reversing_transaction_id ON public.points_transactions USING btree (reversing_transaction_id)
  WHERE (reversing_transaction_id IS NOT NULL);

CREATE INDEX idx_points_transactions_type ON public.points_transactions USING btree (transaction_type);

CREATE INDEX idx_points_transactions_user_created ON public.points_transactions USING btree (user_id, created_at DESC);

CREATE INDEX idx_points_transactions_user_id ON public.points_transactions USING btree (user_id);

CREATE INDEX idx_profiles_created_at ON public.profiles USING btree (created_at DESC);

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);

CREATE INDEX idx_profiles_is_active ON public.profiles USING btree (is_active)
  WHERE (is_active = true);

CREATE INDEX idx_profiles_total_points ON public.profiles USING btree (total_points DESC);

CREATE INDEX idx_recycling_centers_active ON public.recycling_centers USING btree (is_active)
  WHERE (is_active = true);

CREATE INDEX idx_recycling_centers_created_at ON public.recycling_centers USING btree (created_at DESC);

CREATE INDEX idx_recycling_centers_created_by ON public.recycling_centers USING btree (created_by)
  WHERE (created_by IS NOT NULL);

CREATE INDEX idx_recycling_centers_location ON public.recycling_centers USING gist (location);

CREATE INDEX idx_recycling_centers_verified ON public.recycling_centers USING btree (verified)
  WHERE (verified = true);

CREATE INDEX idx_reward_redemptions_created_at ON public.reward_redemptions USING btree (created_at DESC);

CREATE INDEX idx_reward_redemptions_redeemed_at ON public.reward_redemptions USING btree (redeemed_at DESC);

CREATE INDEX idx_reward_redemptions_reward_id ON public.reward_redemptions USING btree (reward_id);

CREATE INDEX idx_reward_redemptions_status ON public.reward_redemptions USING btree (status);

CREATE INDEX idx_reward_redemptions_user_id ON public.reward_redemptions USING btree (user_id);

CREATE INDEX idx_reward_redemptions_user_status ON public.reward_redemptions USING btree (user_id, status);

CREATE INDEX idx_rewards_available ON public.rewards USING btree (available)
  WHERE (available = true);

CREATE INDEX idx_rewards_category ON public.rewards USING btree (category);

CREATE INDEX idx_rewards_fulfillment_type ON public.rewards USING btree (fulfillment_type);

CREATE INDEX idx_rewards_points_cost ON public.rewards USING btree (points_cost);

CREATE INDEX idx_rewards_valid_period ON public.rewards USING btree (valid_from, valid_until);

CREATE INDEX idx_submissions_image_hash ON public.submissions USING btree (image_hash);

CREATE INDEX idx_submissions_processed_at ON public.submissions USING btree (processed_at)
  WHERE (processed_at IS NOT NULL);

CREATE INDEX idx_submissions_reviewed_by ON public.submissions USING btree (reviewed_by)
  WHERE (reviewed_by IS NOT NULL);

CREATE INDEX idx_submissions_status ON public.submissions USING btree (status);

CREATE INDEX idx_submissions_submitted_at ON public.submissions USING btree (submitted_at DESC);

CREATE INDEX idx_submissions_user_id ON public.submissions USING btree (user_id);

CREATE INDEX idx_submissions_user_status ON public.submissions USING btree (user_id, status);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Admins can view audit logs" ON "public"."admin_audit_logs"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))));

CREATE POLICY "Audit logs are immutable" ON "public"."admin_audit_logs"
  FOR UPDATE
  TO PUBLIC
  USING (false);

CREATE POLICY "Audit logs immutable delete" ON "public"."admin_audit_logs"
  FOR DELETE
  TO PUBLIC
  USING (false);

CREATE POLICY "Service can insert audit logs" ON "public"."admin_audit_logs"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.role() = 'service'::text));

CREATE POLICY "Admins can manage all devices" ON "public"."iot_devices"
  FOR ALL
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))));

CREATE POLICY "Public can view active public devices" ON "public"."iot_devices"
  FOR SELECT
  TO PUBLIC
  USING (((user_id IS NULL) AND (status = 'active'::text)));

CREATE POLICY "Users can update own devices" ON "public"."iot_devices"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can view own devices" ON "public"."iot_devices"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Admins can view all events" ON "public"."iot_events"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))));

CREATE POLICY "Public can view events from public devices" ON "public"."iot_events"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.iot_devices
  WHERE ((iot_devices.id = iot_events.device_id) AND (iot_devices.user_id IS NULL)))));

CREATE POLICY "Service can insert events" ON "public"."iot_events"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.role() = 'service'::text));

CREATE POLICY "Users can view events from own devices" ON "public"."iot_events"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.iot_devices
  WHERE ((iot_devices.id = iot_events.device_id) AND (iot_devices.user_id = auth.uid())))));

CREATE POLICY "Admins can view all transactions" ON "public"."points_transactions"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))));

CREATE POLICY "Points transactions immutable delete" ON "public"."points_transactions"
  FOR DELETE
  TO PUBLIC
  USING (false);

CREATE POLICY "Points transactions immutable" ON "public"."points_transactions"
  FOR UPDATE
  TO PUBLIC
  USING (false);

CREATE POLICY "Points transactions only via functions" ON "public"."points_transactions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (false);

CREATE POLICY "Service can insert admin adjustments" ON "public"."points_transactions"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((( SELECT auth.role() AS role) = 'service'::text) AND (current_setting('app.current_function'::text, true) = 'adjust-points-admin'::text) AND (( SELECT
    (users.raw_user_meta_data ->> 'role'::text) AS text
   FROM auth.users
  WHERE (users.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text]))));

CREATE POLICY "Service can insert reward redemptions" ON "public"."points_transactions"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((( SELECT auth.role() AS role) = 'service'::text) AND (current_setting('app.current_function'::text, true) = 'award-points-reward'::text)));

CREATE POLICY "Service can insert submission awards" ON "public"."points_transactions"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((( SELECT auth.role() AS role) = 'service'::text) AND (current_setting('app.current_function'::text, true) = 'award-points-submission'::text)));

CREATE POLICY "Users can view own transactions" ON "public"."points_transactions"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Admins can view all profiles" ON "public"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))));

CREATE POLICY "Service can update points cache" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.role() AS ROLE) = 'service'::text))
  WITH CHECK ((( SELECT auth.role() AS role) = 'service'::text));

CREATE POLICY "Users can update own profile" ON "public"."profiles"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users can view own profile" ON "public"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = id));

CREATE POLICY "Admins can manage recycling centers" ON "public"."recycling_centers"
  FOR ALL
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))));

CREATE POLICY "Anyone can view active recycling centers" ON "public"."recycling_centers"
  FOR SELECT
  TO PUBLIC
  USING ((is_active = true));

CREATE POLICY "Admins can update redemption status" ON "public"."reward_redemptions"
  FOR UPDATE
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))));

CREATE POLICY "Admins can view all redemptions" ON "public"."reward_redemptions"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))));

CREATE POLICY "Redemptions are immutable" ON "public"."reward_redemptions"
  FOR UPDATE
  TO PUBLIC
  USING (false);

CREATE POLICY "Users can create own redemptions" ON "public"."reward_redemptions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own redemptions" ON "public"."reward_redemptions"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Admins can manage all rewards" ON "public"."rewards"
  FOR ALL
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))));

CREATE POLICY "Anyone can view available rewards" ON "public"."rewards"
  FOR SELECT
  TO PUBLIC
  USING (((available = true) AND (now() >= valid_from) AND (now() <= valid_until) AND ((inventory_limit IS NULL) OR (inventory_remaining > 0))));

CREATE POLICY "Admins can view all submissions" ON "public"."submissions"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))));

CREATE POLICY "Moderators can update submission status" ON "public"."submissions"
  FOR UPDATE
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))))))
  WITH CHECK ((status = ANY (ARRAY['approved'::text, 'rejected'::text, 'review'::text])));

CREATE POLICY "Submissions are immutable" ON "public"."submissions"
  FOR UPDATE
  TO PUBLIC
  USING (false);

CREATE POLICY "Users can create own submissions" ON "public"."submissions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own submissions" ON "public"."submissions"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Service role can upload submission images" ON "storage"."objects"
  FOR INSERT
  TO "service_role"
  WITH CHECK ((bucket_id = 'submission-images'::text));

CREATE POLICY "Service role can view submission images" ON "storage"."objects"
  FOR SELECT
  TO "service_role"
  USING ((bucket_id = 'submission-images'::text));

CREATE POLICY "Users can own delete submission images" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'submission-images'::text) AND (name ~~ 'submissions/%'::text) AND (split_part(name, '/'::text, 2) = (auth.uid())::text)));

CREATE POLICY "Users can own upload submission images" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'submission-images'::text) AND (name ~~ 'submissions/%'::text) AND (split_part(name, '/'::text, 2) = (auth.uid())::text)));

CREATE POLICY "Users can own view submission images" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'submission-images'::text) AND (name ~~ 'submissions/%'::text) AND (split_part(name, '/'::text, 2) = (auth.uid())::text)));

COMMENT ON EXTENSION "postgis" IS 'PostGIS geometry and geography spatial types and functions';

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."admin_audit_logs" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."iot_devices" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."iot_events" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."points_transactions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."recycling_centers" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reward_redemptions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rewards" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."submissions" TO "anon", "authenticated", "postgres", "service_role";

