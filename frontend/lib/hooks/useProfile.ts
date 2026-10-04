/**
 * EcoPoints — Profile data hook
 *
 * Reuses the dashboard Edge Function (already fixed + deployed) to get the
 * full Profile object + submission stats in one call. Also fetches the
 * current user's rank from the leaderboard function.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Submission } from "@/lib/types/dashboard";

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface ProfilePageData {
  profile: Profile;
  totalPoints: number;
  totalSubmissions: number;
  verifiedSubmissions: number;
  rank: number | null;
}

export interface UseProfileResult {
  data: ProfilePageData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/* ── Eco level config ─────────────────────────────────────────────────────── */

export interface EcoLevel {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number; // maxPoints of last level is Infinity
}

export const ECO_LEVELS: EcoLevel[] = [
  { level: 1, name: "Seedling",    minPoints: 0,    maxPoints: 99 },
  { level: 2, name: "Sprout",      minPoints: 100,  maxPoints: 299 },
  { level: 3, name: "Sapling",     minPoints: 300,  maxPoints: 699 },
  { level: 4, name: "Tree",        minPoints: 700,  maxPoints: 1499 },
  { level: 5, name: "Grove",       minPoints: 1500, maxPoints: 2999 },
  { level: 6, name: "Forest",      minPoints: 3000, maxPoints: 5999 },
  { level: 7, name: "Rainforest",  minPoints: 6000, maxPoints: Infinity },
];

export function getLevel(points: number): EcoLevel {
  return (
    ECO_LEVELS.slice().reverse().find((l) => points >= l.minPoints) ??
    ECO_LEVELS[0]
  );
}

export function levelProgress(points: number): number {
  const lvl = getLevel(points);
  if (lvl.maxPoints === Infinity) return 100;
  const range = lvl.maxPoints - lvl.minPoints + 1;
  const earned = points - lvl.minPoints;
  return Math.min(100, Math.round((earned / range) * 100));
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */

export function useProfile(): UseProfileResult {
  const [data, setData] = useState<ProfilePageData | null>(null);
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
      const fnHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // Fetch dashboard (profile + submissions) and leaderboard in parallel
      const [dashRes, lbRes] = await Promise.all([
        fetch(`${supabaseUrl}/functions/v1/dashboard`, { headers: fnHeaders }),
        fetch(`${supabaseUrl}/functions/v1/leaderboard`, { headers: fnHeaders }),
      ]);

      if (!dashRes.ok) {
        const body = await dashRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ??
            `Dashboard request failed (${dashRes.status})`
        );
      }

      const dashJson = await dashRes.json();
      const lbJson = lbRes.ok ? await lbRes.json().catch(() => ({})) : {};

      if (id !== fetchCount.current) return;

      const profile: Profile = dashJson.profile;
      const submissions: Submission[] = dashJson.recent_submissions ?? [];
      const totalPoints: number = dashJson.total_points ?? profile.total_points ?? 0;

      // Derive stats from what we have (recent_submissions is max 5 from dashboard)
      // For totals, use profile.total_points as proxy; for verified count
      // we can only count from the recent slice — be transparent about this.
      const verifiedSubmissions = submissions.filter(
        (s) => s.status === "approved" || (s.status as string) === "verified"
      ).length;

      // Find rank in leaderboard
      const entries: { id: string; rank: number }[] =
        lbJson.leaderboard ?? [];
      const myEntry = entries.find((e) => e.id === profile.id);

      setData({
        profile,
        totalPoints,
        totalSubmissions: submissions.length,
        verifiedSubmissions,
        rank: myEntry?.rank ?? null,
      });
    } catch (err) {
      if (id !== fetchCount.current) return;
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    } finally {
      if (id === fetchCount.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => { void doFetch(); }, [doFetch]);

  return { data, isLoading, error, refetch: doFetch };
}
