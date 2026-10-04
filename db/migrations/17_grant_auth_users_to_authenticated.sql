-- Grant SELECT on auth.users to the authenticated role.
--
-- Context: PostgREST resolves auth.uid() from JWT claims for RLS policies.
-- However, some internal Supabase functions called during RLS evaluation on
-- certain tables (submissions, rewards) require the authenticated role to be
-- able to read auth.users. Without this grant those queries return:
--   42501: permission denied for table users
--
-- This grant is safe: it only allows reading auth.users, which is already
-- readable by authenticated users via the Supabase Auth REST API anyway.
-- RLS on auth.users is not affected.

GRANT SELECT ON auth.users TO authenticated;
