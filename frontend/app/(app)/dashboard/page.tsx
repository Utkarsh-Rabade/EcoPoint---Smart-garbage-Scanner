"use client";

/**
 * EcoPoints — Dashboard page (/dashboard)
 *
 * Seven sections, each with a distinct visual treatment:
 *  1. Welcome       — editorial headline + CTA (no chrome)
 *  2. Impact        — segmented stat grid (mixed visual weights)
 *  3. Recycle Now   — forest-green band (visual peak)
 *  4. Recent Activity — timeline list (no card)
 *  5. Eco Journey   — level + progress strip
 *  6. Community     — mini leaderboard (borderless list)
 *  7. Rewards       — mini rewards preview (borderless list)
 *
 * Data: fetched from /functions/v1/dashboard, /leaderboard, /rewards
 *       via useDashboard() — real Supabase JWT, no hardcoded mock data.
 */

import Link from "next/link";
import { useDashboard } from "@/lib/hooks/useDashboard";
import type { Submission } from "@/lib/types/dashboard";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Skeleton, SpinnerCenter } from "@/components/ui/Loading";
import { StatusPill } from "@/components/ui/Badge";

import "@/styles/shell.css";
import "@/styles/dashboard.css";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** Estimate grams diverted from submission; 150g per item is a reasonable default */
function estimateWasteGrams(submissions: Submission[]): number {
  return submissions.reduce((acc, s) => {
    const w = s.verification_result?.weight_grams;
    return acc + (typeof w === "number" ? w : 150);
  }, 0);
}

/** Format grams into a readable weight string */
function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1)} kg`;
  }
  return `${Math.round(grams)} g`;
}

/** Derive item label from verification_result with graceful fallback */
function getItemLabel(s: Submission): string {
  const vr = s.verification_result;
  if (vr?.item_type) return vr.item_type;
  return "Recycling item";
}

/** Derive material from verification_result */
function getMaterial(s: Submission): string | null {
  return s.verification_result?.material ?? null;
}

/** Derive current streak from submissions (consecutive recent days with approvals) */
function computeStreak(submissions: Submission[]): number {
  // With only up to 5 submissions from API, return count of approved ones
  return submissions.filter((s) => s.status === "approved").length;
}

/** Compute level from total points */
function computeLevel(points: number): {
  level: number;
  levelName: string;
  currentMin: number;
  nextMin: number;
} {
  const levels = [
    { level: 1, name: "Seedling",    min: 0 },
    { level: 2, name: "Sprout",      min: 100 },
    { level: 3, name: "Sapling",     min: 300 },
    { level: 4, name: "Grove",       min: 600 },
    { level: 5, name: "Forest",      min: 1000 },
    { level: 6, name: "Canopy",      min: 1750 },
    { level: 7, name: "Ecosystem",   min: 3000 },
  ];

  let current = levels[0];
  for (const l of levels) {
    if (points >= l.min) current = l;
    else break;
  }

  const idx = levels.indexOf(current);
  const next = levels[idx + 1] ?? { min: current.min + 1000 };

  return {
    level: current.level,
    levelName: current.name,
    currentMin: current.min,
    nextMin: next.min,
  };
}

const MILESTONES = [100, 300, 600, 1000, 1750, 3000];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── Inline Icons ───────────────────────────────────────────────────────── */

function UploadCloudIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m8 17 4-4 4 4" />
    </svg>
  );
}

function ArrowRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h14v2H3V8Z" /><path d="M4 10v8h12v-8" /><path d="M10 8V18" />
      <path d="M7 8c0-1.657 1.343-3 3-3s3 1.343 3 3" />
    </svg>
  );
}

/* ─── Sub-section: Impact skeletons ──────────────────────────────────────── */

function ImpactSkeleton() {
  return (
    <div className="db-impact__grid" aria-label="Loading stats…">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="db-impact__stat">
          <Skeleton variant="heading" style={{ width: "60%", marginBottom: 8 }} />
          <Skeleton variant="text-sm" style={{ width: "80%" }} />
        </div>
      ))}
    </div>
  );
}

/* ─── Sub-section: Activity skeletons ────────────────────────────────────── */

function ActivitySkeleton() {
  return (
    <div className="db-activity__list" aria-label="Loading activity…">
      {[0, 1, 2].map((i) => (
        <div key={i} className="db-skeleton-row" style={{ paddingLeft: 0, borderLeft: "none" }}>
          <Skeleton variant="avatar-sm" />
          <div style={{ flex: 1 }}>
            <Skeleton variant="text" style={{ width: "60%", marginBottom: 6 }} />
            <Skeleton variant="text-sm" style={{ width: "40%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();

  /* ── Full-page loading ──────────────────────────────────────────────── */
  if (isLoading && !data) {
    return (
      <div className="ep-page">
        <SpinnerCenter size="lg" label="Loading dashboard…" />
      </div>
    );
  }

  /* ── Hard error (no data) ────────────────────────────────────────────── */
  if (error && !data) {
    return (
      <div className="ep-page">
        <Alert variant="error" title="Could not load dashboard">
          {error}
          <div style={{ marginTop: "var(--ep-space-4)" }}>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  // data is guaranteed to exist here
  const { dashboard, leaderboard, rewards } = data!;
  const { profile, recent_submissions: submissions } = dashboard;
  const totalPoints = dashboard.total_points;
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  /* ── Computed values ──────────────────────────────────────────────────── */
  const itemCount = submissions.length;
  const wasteDiverted = estimateWasteGrams(submissions);
  const streak = computeStreak(submissions);
  const { level, levelName, currentMin, nextMin } = computeLevel(totalPoints);
  const progressPct = Math.min(
    100,
    Math.round(((totalPoints - currentMin) / (nextMin - currentMin)) * 100)
  );

  const topLeaderboard = leaderboard.leaderboard.slice(0, 5);
  const previewRewards = rewards.rewards.slice(0, 4);

  return (
    <div className="ep-page">
      <div className="db-page">

        {/* ── Soft reload error (data exists but refresh failed) ─────────── */}
        {error && (
          <Alert variant="warning" onDismiss={() => refetch()}>
            Some data may be stale. <button
              type="button"
              style={{ color: "var(--ep-color-brand)", background: "none", border: "none", cursor: "pointer", fontWeight: "var(--ep-font-weight-medium)", padding: 0 }}
              onClick={() => refetch()}
            >Refresh</button>
          </Alert>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1: Welcome
        ════════════════════════════════════════════════════════════════ */}
        <section className="db-welcome" aria-labelledby="db-welcome-heading">
          <h1 id="db-welcome-heading" className="db-welcome__headline">
            Make waste count.
          </h1>
          <p className="db-welcome__body">
            Hey {firstName}. Every item you recycle gets verified by our AI, earns you EcoPoints, and keeps materials out of landfill.
            Your actions add up.
          </p>
          <div className="db-welcome__actions">
            <Button
              as="a"
              href="/submit"
              variant="primary"
              size="lg"
            >
              Recycle an item
            </Button>
            <Button
              as="a"
              href="/history"
              variant="ghost"
              size="lg"
            >
              View history
            </Button>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2: Impact stats
        ════════════════════════════════════════════════════════════════ */}
        <section aria-labelledby="db-impact-heading">
          <p id="db-impact-heading" className="db-impact__heading" aria-label="Your impact">
            Your impact
          </p>

          {isLoading ? (
            <ImpactSkeleton />
          ) : (
            <div className="db-impact__grid" role="list">
              {/* EcoPoints — largest, brand color */}
              <div className="db-impact__stat db-impact__stat--points" role="listitem">
                <div className="db-impact__value" aria-label={`${formatNumber(totalPoints)} EcoPoints`}>
                  {formatNumber(totalPoints)}
                </div>
                <div className="db-impact__label">EcoPoints</div>
                <div className="db-impact__sub">Total earned</div>
              </div>

              {/* Items recycled */}
              <div className="db-impact__stat db-impact__stat--items" role="listitem">
                <div className="db-impact__value">{itemCount}</div>
                <div className="db-impact__label">Items recycled</div>
                <div className="db-impact__sub">Recent submissions</div>
              </div>

              {/* Waste diverted — earth-tone treatment */}
              <div className="db-impact__stat db-impact__stat--waste" role="listitem">
                <div className="db-impact__value">{formatWeight(wasteDiverted)}</div>
                <div className="db-impact__label">Waste diverted</div>
                <div className="db-impact__sub">Estimated from items</div>
              </div>

              {/* Streak — points color */}
              <div className="db-impact__stat db-impact__stat--streak" role="listitem">
                <div className="db-impact__value">{streak}</div>
                <div className="db-impact__label">Approved items</div>
                <div className="db-impact__sub">Verified &amp; confirmed</div>
              </div>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3: Recycle Now — visual peak
        ════════════════════════════════════════════════════════════════ */}
        <section className="db-recycle" aria-label="Recycle an item now">
          <div className="db-recycle__copy">
            <p className="db-recycle__eyebrow">Start recycling</p>
            <h2 className="db-recycle__title">
              Got something to recycle?
            </h2>
            <p className="db-recycle__desc">
              Take a photo, upload it, and our AI verifies the item in seconds.
              Every approved submission earns you EcoPoints you can spend on real rewards.
            </p>
          </div>

          <div className="db-recycle__action">
            {/* Decorative icon visible on wider screens */}
            <div className="db-recycle__icon" aria-hidden="true" style={{ marginBottom: "var(--ep-space-4)" }}>
              <UploadCloudIcon />
            </div>
            <Link href="/submit" className="ep-btn ep-btn--primary ep-btn--lg db-recycle__btn">
              Recycle an item
            </Link>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 4: Recent Activity — timeline
        ════════════════════════════════════════════════════════════════ */}
        <section className="db-activity" aria-labelledby="db-activity-heading">
          <div className="db-activity__header">
            <h2 id="db-activity-heading" className="db-activity__title">
              Recent activity
            </h2>
            <Link href="/history" className="db-activity__link">
              View all <ArrowRightIcon />
            </Link>
          </div>

          {isLoading ? (
            <ActivitySkeleton />
          ) : submissions.length === 0 ? (
            <div style={{
              padding: "var(--ep-space-8) 0",
              textAlign: "center",
              color: "var(--ep-color-text-tertiary)",
              fontSize: "var(--ep-font-size-sm)",
            }}>
              No submissions yet.{" "}
              <Link href="/submit" style={{ color: "var(--ep-color-brand)", fontWeight: "var(--ep-font-weight-medium)" }}>
                Recycle your first item
              </Link>
              .
            </div>
          ) : (
            <ol className="db-activity__list" aria-label="Recent submissions">
              {submissions.map((s) => {
                const label = getItemLabel(s);
                const material = getMaterial(s);
                const statusClass = `db-activity__item--${s.status}`;
                const hasPoints = s.points_awarded > 0;

                return (
                  <li key={s.id} className={`db-activity__item ${statusClass}`}>
                    <div className="db-activity__main">
                      <div className="db-activity__item-title">{label}</div>
                      <div className="db-activity__item-meta">
                        {material && (
                          <>
                            <span>{material}</span>
                            <span className="db-activity__item-meta-sep" aria-hidden="true" />
                          </>
                        )}
                        <time dateTime={s.submitted_at}>{formatDate(s.submitted_at)}</time>
                      </div>
                    </div>

                    <div className="db-activity__side">
                      <StatusPill status={s.status} />
                      <span
                        className={`db-activity__points${hasPoints ? "" : " db-activity__points--zero"}`}
                        aria-label={hasPoints ? `${s.points_awarded} points earned` : "No points yet"}
                      >
                        {hasPoints ? `+${formatNumber(s.points_awarded)} pts` : "—"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 5: Eco Journey
        ════════════════════════════════════════════════════════════════ */}
        <section className="db-journey" aria-labelledby="db-journey-heading">
          <div className="db-journey__header">
            <div>
              <h2 id="db-journey-heading" className="db-journey__title">
                Eco Journey
              </h2>
              <div style={{ marginTop: "var(--ep-space-1)", fontSize: "var(--ep-font-size-xs)", color: "var(--ep-color-text-tertiary)" }}>
                {formatNumber(totalPoints)} of {formatNumber(nextMin)} points to next level
              </div>
            </div>
            <div className="db-journey__level-badge" aria-label={`Level ${level}: ${levelName}`}>
              Lv.{level} — {levelName}
            </div>
          </div>

          {/* Progress bar */}
          <div className="db-journey__progress-label" aria-hidden="true">
            <span>Lv.{level} — {formatNumber(currentMin)} pts</span>
            <span>Lv.{level + 1} — {formatNumber(nextMin)} pts</span>
          </div>
          <div
            className="db-journey__track"
            role="progressbar"
            aria-valuenow={totalPoints}
            aria-valuemin={currentMin}
            aria-valuemax={nextMin}
            aria-label={`Level progress: ${progressPct}%`}
          >
            <div className="db-journey__fill" style={{ width: `${progressPct}%` }} />
          </div>

          {/* Milestone dots */}
          <div className="db-journey__milestones" aria-label="Point milestones">
            {MILESTONES.map((m) => {
              const reached = totalPoints >= m;
              return (
                <div
                  key={m}
                  className={`db-journey__milestone${reached ? " db-journey__milestone--reached" : ""}`}
                  aria-label={`${formatNumber(m)} points${reached ? " — reached" : ""}`}
                >
                  <div className="db-journey__milestone-dot" />
                  {formatNumber(m)}
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTIONS 6 + 7: Bottom two-column row
        ════════════════════════════════════════════════════════════════ */}
        <div className="db-bottom-row">

          {/* ── Community preview ──────────────────────────────────────── */}
          <section className="db-community" aria-labelledby="db-community-heading">
            <div className="db-community__header">
              <h2 id="db-community-heading" className="db-community__title">
                Community
              </h2>
              <Link href="/leaderboard" className="db-community__link">
                Full board <ArrowRightIcon size={12} />
              </Link>
            </div>

            {isLoading ? (
              <div>
                {[0,1,2].map((i) => (
                  <div key={i} className="db-skeleton-row">
                    <Skeleton variant="avatar-sm" />
                    <Skeleton variant="text" style={{ flex: 1 }} />
                    <Skeleton variant="text-sm" style={{ width: "3rem" }} />
                  </div>
                ))}
              </div>
            ) : topLeaderboard.length === 0 ? (
              <p style={{ fontSize: "var(--ep-font-size-sm)", color: "var(--ep-color-text-tertiary)" }}>
                No leaderboard data yet.
              </p>
            ) : (
              <ol className="db-community__list" aria-label="Top recyclers">
                {topLeaderboard.map((entry) => {
                  const isCurrentUser = entry.id === profile.id;
                  return (
                    <li key={entry.id} className="db-community__row">
                      <span className={`db-community__rank${entry.rank <= 3 ? " db-community__rank--top" : ""}`}>
                        {entry.rank}
                      </span>
                      <div className="db-community__avatar" aria-hidden="true">
                        {getInitials(entry.full_name || "?")}
                      </div>
                      <span className={`db-community__name${isCurrentUser ? " db-community__name--you" : ""}`}>
                        {entry.full_name || "Anonymous"}
                        {isCurrentUser && " (you)"}
                      </span>
                      <span className="db-community__pts" aria-label={`${formatNumber(entry.total_points)} points`}>
                        {formatNumber(entry.total_points)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* ── Rewards preview ────────────────────────────────────────── */}
          <section className="db-rewards" aria-labelledby="db-rewards-heading">
            <div className="db-rewards__header">
              <h2 id="db-rewards-heading" className="db-rewards__title">
                Rewards
              </h2>
              <Link href="/rewards" className="db-rewards__link">
                Browse all <ArrowRightIcon size={12} />
              </Link>
            </div>

            {isLoading ? (
              <div>
                {[0,1,2].map((i) => (
                  <div key={i} className="db-skeleton-row">
                    <Skeleton variant="rect" style={{ width: "2rem", height: "2rem" }} />
                    <Skeleton variant="text" style={{ flex: 1 }} />
                    <Skeleton variant="text-sm" style={{ width: "4rem" }} />
                  </div>
                ))}
              </div>
            ) : previewRewards.length === 0 ? (
              <p style={{ fontSize: "var(--ep-font-size-sm)", color: "var(--ep-color-text-tertiary)" }}>
                No rewards available yet.
              </p>
            ) : (
              <ul className="db-rewards__list" aria-label="Available rewards">
                {previewRewards.map((r, i) => {
                  const canAfford = totalPoints >= r.points_cost;
                  return (
                    <li key={i} className="db-rewards__row">
                      <div className="db-rewards__icon" aria-hidden="true">
                        <GiftIcon />
                      </div>
                      <span className="db-rewards__name" title={r.title}>{r.title}</span>
                      <span
                        className="db-rewards__cost"
                        style={canAfford ? { borderColor: "var(--ep-color-success-border)", backgroundColor: "var(--ep-color-success-muted)", color: "var(--ep-color-success-text)" } : undefined}
                        aria-label={`${formatNumber(r.points_cost)} points required${canAfford ? ", you can afford this" : ""}`}
                      >
                        {formatNumber(r.points_cost)} pts
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
