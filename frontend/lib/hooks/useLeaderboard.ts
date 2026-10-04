/**
 * EcoPoints — Leaderboard hook
 *
 * Fetches the leaderboard from the Edge Function and the current
 * user's profile (for rank highlighting) from PostgREST.
 *
 * Auth pattern: Edge Function → Authorization only (no apikey, CORS).
 *               PostgREST     → apikey + Authorization.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LeaderboardEntry } from "@/lib/types/dashboard";

export type { LeaderboardEntry };

export interface UseLeaderboardResult {
  entries: LeaderboardEntry[];
  currentUserId: string | null;
  currentUserRank: number | null;
  currentUserPoints: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useLeaderboard(): UseLeaderboardResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [currentUserPoints, setCurrentUserPoints] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchCount = useRef(0);

  const doFetch = useCallback(async () => {
    const id = ++fetchCount.current;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated.");

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) throw new Error("Missing environment variables.");

      const token = session.access_token;
      const userId = session.user.id;

      // Edge Function: Authorization only — apikey is not in CORS allowed headers
      const fnHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // PostgREST: needs both apikey and Authorization
      const restHeaders = {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const [lbRes, profileRes] = await Promise.all([
        fetch(`${supabaseUrl}/functions/v1/leaderboard`, { headers: fnHeaders }),
        fetch(`${supabaseUrl}/rest/v1/profiles?select=total_points&id=eq.${userId}`, {
          headers: restHeaders,
        }),
      ]);

      if (!lbRes.ok) {
        const body = await lbRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ??
            `Leaderboard request failed (${lbRes.status})`
        );
      }

      const lbJson: { leaderboard: LeaderboardEntry[] } = await lbRes.json();
      const profileJson: { total_points: number }[] = profileRes.ok
        ? await profileRes.json()
        : [];

      if (id !== fetchCount.current) return;

      const board = lbJson.leaderboard ?? [];
      setEntries(board);
      setCurrentUserId(userId);

      // Find user in leaderboard for rank
      const userEntry = board.find((e) => e.id === userId);
      setCurrentUserRank(userEntry?.rank ?? null);
      setCurrentUserPoints(
        userEntry?.total_points ?? profileJson[0]?.total_points ?? 0
      );
    } catch (err) {
      if (id !== fetchCount.current) return;
      setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    } finally {
      if (id === fetchCount.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => { void doFetch(); }, [doFetch]);

  return {
    entries,
    currentUserId,
    currentUserRank,
    currentUserPoints,
    isLoading,
    error,
    refetch: doFetch,
  };
}
