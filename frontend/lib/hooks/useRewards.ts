/**
 * EcoPoints — Rewards page hook
 *
 * Fetches rewards catalog + current user balance in parallel.
 * Uses the working auth pattern: anon key as apikey + user JWT in Authorization.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Reward } from "@/lib/types/dashboard";

/* ── Types ────────────────────────────────────────────────────────────────── */

export type { Reward };

export interface UseRewardsResult {
  rewards: Reward[];
  balance: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */

export function useRewards(): UseRewardsResult {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchCount = useRef(0);

  const doFetch = useCallback(async () => {
    const id = ++fetchCount.current;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated.");

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) throw new Error("Missing environment variables.");

      const token = session.access_token;

      // Edge Functions only allow "Content-Type, Authorization" in their
      // CORS preflight — sending apikey causes a preflight rejection.
      const fnHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // PostgREST requires apikey as well as the user JWT.
      const restHeaders = {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // Fetch rewards catalog and user profile balance in parallel
      const [rewardsRes, profileRes] = await Promise.all([
        fetch(`${supabaseUrl}/functions/v1/rewards`, { headers: fnHeaders }),
        fetch(
          `${supabaseUrl}/rest/v1/profiles?select=total_points`,
          { headers: restHeaders }
        ),
      ]);

      if (!rewardsRes.ok) {
        const body = await rewardsRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ??
            `Rewards request failed (${rewardsRes.status})`
        );
      }
      if (!profileRes.ok) {
        const body = await profileRes.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ??
            `Profile request failed (${profileRes.status})`
        );
      }

      const rewardsJson: { rewards: Reward[] } = await rewardsRes.json();
      const profileJson: { total_points: number }[] = await profileRes.json();

      if (id !== fetchCount.current) return;

      setRewards(rewardsJson.rewards ?? []);
      setBalance(profileJson[0]?.total_points ?? 0);
    } catch (err) {
      if (id !== fetchCount.current) return;
      setError(err instanceof Error ? err.message : "Failed to load rewards.");
    } finally {
      if (id === fetchCount.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void doFetch();
  }, [doFetch]);

  return { rewards, balance, isLoading, error, refetch: doFetch };
}
