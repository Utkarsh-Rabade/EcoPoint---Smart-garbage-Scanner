-- SECURITY DEFINER function fixes
-- Set search_path to prevent mutable search_path warnings
-- Adjust EXECUTE privileges where appropriate

-- For handle_new_user: set search_path to pg_catalog (function already schema-qualifies public.profiles)
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog;

-- Revoke EXECUTE from PUBLIC and anon for handle_new_user to prevent RPC exposure
-- The trigger is fired by the system (service_role) so we keep EXECUTE for service_role and postgres
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, postgres;

-- For st_estimatedextent functions: set search_path and revoke EXECUTE from anon to prevent direct client invocation
ALTER FUNCTION public.st_estimatedextent(text, text) SET search_path = pg_catalog;
ALTER FUNCTION public.st_estimatedextent(text, text, text) SET search_path = pg_catalog;
ALTER FUNCTION public.st_estimatedextent(text, text, text, boolean) SET search_path = pg_catalog;

REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM anon;
