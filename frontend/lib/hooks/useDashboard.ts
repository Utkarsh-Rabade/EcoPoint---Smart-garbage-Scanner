/**
 * EcoPoints — Dashboard data hook
 *
 * Fetches all three API endpoints in parallel:
 *   - /functions/v1/dashboard    (profile, submissions, transactions)
 *   - /functions/v1/leaderboard  (top 5 preview)
 *   - /functions/v1/rewards      (first 3 preview)
 *
 * Authentication: passes the Supabase session JWT as Bearer token.
 * Each endpoint validates the JWT server-side; no user_id is sent from client.
 *
 * Returns a single { data, isLoading, error, refetch } object.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  DashboardData,
  LeaderboardData,
  RewardsData,
} from "@/lib/types/dashboard";


/* ── Combined data shape ──────────────────────────────────────────────────── */

export interface DashboardPageData {
  dashboard: DashboardData;
  leaderboard: LeaderboardData;
  rewards: RewardsData;
}

export interface UseDashboardResult {
  data: DashboardPageData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/* ── Helper: authenticated fetch ──────────────────────────────────────────── */

async function authFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const json = await res.json();

  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message
      ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return json as T;
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */

export function useDashboard(): UseDashboardResult {
  const [data, setData] = useState<DashboardPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchCount = useRef(0);

  const fetch = useCallback(async () => {
    const id = ++fetchCount.current;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated. Please log in.");
      }

      const token = session.access_token;

      // Build the URL here (at call time) so Next.js env substitution has run.
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error(
          "NEXT_PUBLIC_SUPABASE_URL is not set. Check your .env.local file."
        );
      }
      const functionsBase = `${supabaseUrl}/functions/v1`;

      const [dashboard, leaderboard, rewards] = await Promise.all([
        authFetch<DashboardData>(`${functionsBase}/dashboard`, token),
        authFetch<LeaderboardData>(`${functionsBase}/leaderboard`, token),
        authFetch<RewardsData>(`${functionsBase}/rewards`, token),
      ]);

      // Guard stale responses
      if (id !== fetchCount.current) return;

      setData({ dashboard, leaderboard, rewards });
    } catch (err) {
      if (id !== fetchCount.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard."
      );
    } finally {
      if (id === fetchCount.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
