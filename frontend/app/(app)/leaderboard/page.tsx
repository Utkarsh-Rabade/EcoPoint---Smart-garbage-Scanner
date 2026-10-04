"use client";

import Link from "next/link";
import "@/styles/shell.css";
import "@/styles/leaderboard.css";
import "@/styles/button.css";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";
import type { LeaderboardEntry } from "@/lib/hooks/useLeaderboard";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function currentMonth(): string {
  return new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/* ── Avatar ───────────────────────────────────────────────────────────────── */

function Avatar({
  name,
  rank,
  isMe,
}: {
  name: string;
  rank: number;
  isMe: boolean;
}) {
  const cls = isMe
    ? "lb-avatar lb-avatar--me"
    : rank <= 3
    ? `lb-avatar lb-avatar--${rank}`
    : "lb-avatar";
  return <div className={cls} aria-hidden="true">{initials(name)}</div>;
}

/* ── Rank cell ────────────────────────────────────────────────────────────── */

function RankCell({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <div className={`lb-rank lb-rank--${rank}`} aria-label={`Rank ${rank}`}>
        {MEDALS[rank]}
      </div>
    );
  }
  return (
    <div className="lb-rank lb-rank--other" aria-label={`Rank ${rank}`}>
      {rank}
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

function SkeletonRows() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <div className="lb-sk-row" key={i}>
          <div className="lb-sk lb-sk-circle" />
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="lb-sk lb-sk-avatar" />
            <div className="lb-sk" style={{ width: "45%", height: "0.9rem" }} />
          </div>
          <div className="lb-sk" style={{ width: "4rem", height: "0.9rem", marginLeft: "auto" }} />
        </div>
      ))}
    </>
  );
}

function SkeletonSidebar() {
  return (
    <div className="lb-sk-standing">
      <div className="lb-sk-standing-top" />
      <div className="lb-sk-standing-body">
        <div className="lb-sk" style={{ width: "60%", height: "0.8rem" }} />
        <div className="lb-sk" style={{ width: "80%", height: "0.8rem" }} />
      </div>
    </div>
  );
}

/* ── Row ──────────────────────────────────────────────────────────────────── */

function Row({
  entry,
  isMe,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
}) {
  const topCls =
    entry.rank <= 3 ? ` lb-row--rank-${entry.rank}` : "";
  const meCls = isMe ? " lb-row--me" : "";

  return (
    <div
      className={`lb-row${topCls}${meCls}`}
      role="row"
      aria-label={`${entry.full_name}, rank ${entry.rank}, ${entry.total_points} points`}
    >
      <RankCell rank={entry.rank} />

      <div className="lb-user" role="cell">
        <Avatar name={entry.full_name} rank={entry.rank} isMe={isMe} />
        <div className="lb-name">
          <p className="lb-name__text">{entry.full_name}</p>
          {isMe && <p className="lb-name__you">You</p>}
        </div>
      </div>

      <div className="lb-pts" role="cell">
        <span className="lb-pts__value">
          {entry.total_points.toLocaleString()}
        </span>
        <span className="lb-pts__unit">pts</span>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function LeaderboardPage() {
  const {
    entries,
    currentUserId,
    currentUserRank,
    currentUserPoints,
    isLoading,
    error,
    refetch,
  } = useLeaderboard();

  const isOnBoard = currentUserRank !== null;
  const month = currentMonth();

  return (
    <main className="ep-page lb-page" id="leaderboard-main">
      {/* Error banner — full width, above layout */}
      {error && (
        <div className="lb-error" role="alert">
          <p className="lb-error__title">Could not load leaderboard</p>
          <p className="lb-error__body">{error}</p>
          <button className="ep-btn ep-btn--secondary ep-btn--sm" onClick={refetch}>
            Try again
          </button>
        </div>
      )}

      <div className="lb-layout">
        {/* ── Sidebar ── */}
        <aside className="lb-sidebar" aria-label="Your standing">

          {/* Heading */}
          <div className="lb-heading">
            <p className="lb-heading__eyebrow">Community rankings</p>
            <h1 className="lb-heading__title">Leaderboard</h1>
            <p className="lb-heading__sub">
              The most active recyclers in your community, ranked by total
              EcoPoints earned. Keep submitting to climb the board.
            </p>
          </div>

          {/* Your standing card */}
          {isLoading ? (
            <SkeletonSidebar />
          ) : !error ? (
            <div className="lb-standing">
              <div className="lb-standing__top">
                <p className="lb-standing__label">Your rank</p>
                {isOnBoard ? (
                  <>
                    <p className="lb-standing__rank">
                      {currentUserRank}
                      <span className="lb-standing__rank-suffix">
                        {currentUserRank === 1
                          ? "st"
                          : currentUserRank === 2
                          ? "nd"
                          : currentUserRank === 3
                          ? "rd"
                          : "th"}
                      </span>
                    </p>
                    <p className="lb-standing__note">
                      {ordinal(currentUserRank)} out of {entries.length} recyclers
                    </p>
                  </>
                ) : (
                  <>
                    <p className="lb-standing__rank" style={{ fontSize: "2rem" }}>
                      —
                    </p>
                    <p className="lb-standing__note">Not yet ranked</p>
                  </>
                )}
              </div>
              <div className="lb-standing__bottom">
                <div className="lb-standing__stat">
                  <span className="lb-standing__stat-label">Your EcoPoints</span>
                  <span className="lb-standing__stat-value lb-standing__stat-value--pts">
                    {(currentUserPoints ?? 0).toLocaleString()}
                  </span>
                </div>
                {isOnBoard && entries[0] && currentUserRank !== 1 && (
                  <div className="lb-standing__stat">
                    <span className="lb-standing__stat-label">Gap to #1</span>
                    <span className="lb-standing__stat-value">
                      {(
                        entries[0].total_points - (currentUserPoints ?? 0)
                      ).toLocaleString()}{" "}
                      pts
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Live period indicator */}
          {!error && (
            <div className="lb-period" aria-label={`Leaderboard period: ${month}`}>
              <span className="lb-period__dot" aria-hidden="true" />
              <span>All-time · Updated {month}</span>
            </div>
          )}
        </aside>

        {/* ── Ranked list panel ── */}
        <div className="lb-panel" role="table" aria-label="Leaderboard rankings">
          {/* Column headers */}
          {!isLoading && entries.length > 0 && (
            <div className="lb-panel__head" role="row">
              <div className="lb-panel__head-cell" role="columnheader">#</div>
              <div className="lb-panel__head-cell" role="columnheader">Recycler</div>
              <div className="lb-panel__head-cell lb-panel__head-cell--right" role="columnheader">
                EcoPoints
              </div>
            </div>
          )}

          {/* Loading */}
          {isLoading && <SkeletonRows />}

          {/* Empty */}
          {!isLoading && !error && entries.length === 0 && (
            <div className="lb-empty" role="row">
              <div className="lb-empty__icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  />
                </svg>
              </div>
              <h2 className="lb-empty__title">No rankings yet</h2>
              <p className="lb-empty__body">
                Be the first to appear on the leaderboard. Submit a recyclable
                item to start earning EcoPoints.
              </p>
              <Link href="/submit" className="ep-btn ep-btn--primary">
                Submit an item
              </Link>
            </div>
          )}

          {/* Rows */}
          {!isLoading && !error && entries.map((entry) => (
            <Row
              key={entry.id}
              entry={entry}
              isMe={entry.id === currentUserId}
            />
          ))}

          {/* User not on board note */}
          {!isLoading && !error && entries.length > 0 && !isOnBoard && (
            <p className="lb-not-ranked">
              You&apos;re not in the top {entries.length} yet — keep recycling
              to earn more EcoPoints and claim your spot.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
