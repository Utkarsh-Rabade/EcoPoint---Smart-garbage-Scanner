/**
 * Supabase browser client
 *
 * Uses NEXT_PUBLIC_ prefixed environment variables which are safe to expose
 * to the browser. Never use SUPABASE_SERVICE_ROLE_KEY or any secret key here.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing required environment variables: " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "must be set in .env.local"
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
