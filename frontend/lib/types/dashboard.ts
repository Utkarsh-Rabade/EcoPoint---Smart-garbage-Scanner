/**
 * EcoPoints — Dashboard API types
 *
 * These match the exact JSON shapes returned by the Supabase Edge Functions:
 *   - GET /functions/v1/dashboard
 *   - GET /functions/v1/leaderboard
 *   - GET /functions/v1/rewards
 *
 * Do not add fields that aren't actually returned by the API.
 */

/* ── Dashboard ────────────────────────────────────────────────────────────── */

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  total_points: number;
  member_since: string;         // DATE string: "2026-01-15"
  created_at: string;
  is_active: boolean;
  email_verified: boolean;
  last_login_at: string | null;
  preferences: Record<string, unknown>;
}

/**
 * verification_result is free-form JSONB set by the AI verification function.
 * We read what we can from it and fall back gracefully.
 */
export interface VerificationResult {
  item_type?: string;           // e.g. "Plastic bottle"
  material?: string;            // e.g. "PET plastic"
  weight_grams?: number;
  recyclable?: boolean;
  confidence?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface Submission {
  id: string;
  status: "pending" | "processing" | "approved" | "rejected" | "review";
  verification_result: VerificationResult | null;
  points_awarded: number;
  submitted_at: string;
}

export interface PointsTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  created_at: string;
}

export interface DashboardData {
  profile: Profile;
  total_points: number;
  recent_submissions: Submission[];
  recent_points_transactions: PointsTransaction[];
}

/* ── Leaderboard ──────────────────────────────────────────────────────────── */

export interface LeaderboardEntry {
  id: string;
  full_name: string;
  total_points: number;
  created_at: string;
  rank: number;
}

export interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
}

/* ── Rewards ──────────────────────────────────────────────────────────────── */

export interface Reward {
  title: string;
  points_cost: number;
}

export interface RewardsData {
  rewards: Reward[];
}

/* ── API error shape ──────────────────────────────────────────────────────── */

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
