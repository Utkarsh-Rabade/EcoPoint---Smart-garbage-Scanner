"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import "@/styles/shell.css";
import "@/styles/profile.css";
import "@/styles/button.css";
import { useProfile, getLevel, levelProgress, ECO_LEVELS } from "@/lib/hooks/useProfile";
import { createClient } from "@/lib/supabase/client";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/* ── SVG icons ────────────────────────────────────────────────────────────── */

const IconLeaf = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 14c0 0 1.5-6 5.5-7C11.5 5.5 12 3 12 3s-1 6-4.5 7.5C6 11.1 2 14 2 14z"
      stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 14l3.5-3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
);

const IconPoints = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25" />
    <path d="M8 4.5v7M5.5 6.5C5.5 5.4 6.4 4.5 8 4.5c1.7 0 2.5.8 2.5 2 0 2.3-5 2.3-5 5 0 1.2 1 2 2.5 2 1.6 0 2.5-.8 2.5-2"
      stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
);

const IconStar = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.5l1.8 3.8 4.2.6-3 2.9.7 4.2L8 11l-3.7 2 .7-4.2-3-2.9 4.2-.6L8 1.5z"
      stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
  </svg>
);

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
    <path d="M1.5 7h13M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
);

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25" />
    <path d="M5 8.5l2 2 4-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Skeleton hero ────────────────────────────────────────────────────────── */

function SkeletonHero() {
  return (
    <div className="prf-hero" aria-hidden="true">
      <div className="prf-hero__inner">
        <div
          className="prf-avatar prf-sk"
          style={{ background: "rgba(255,255,255,0.1)", border: "none" }}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div className="prf-sk" style={{ width: "12rem", height: "1.5rem" }} />
          <div className="prf-sk" style={{ width: "8rem", height: "0.9rem" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const { data, isLoading, error, refetch } = useProfile();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  /* ── Error state ── */
  if (!isLoading && error) {
    return (
      <main className="ep-page prf-page" id="profile-main">
        <div className="prf-hero" style={{ minHeight: "8rem" }} />
        <div className="prf-error" role="alert">
          <p className="prf-error__title">Could not load profile</p>
          <p className="prf-error__body">{error}</p>
          <button className="ep-btn ep-btn--secondary ep-btn--sm" onClick={refetch}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  const profile = data?.profile;
  const totalPoints = data?.totalPoints ?? 0;
  const currentLevel = getLevel(totalPoints);
  const progress = levelProgress(totalPoints);
  const nextLevel = ECO_LEVELS.find((l) => l.level === currentLevel.level + 1) ?? null;

  /* ── Loading state ── */
  if (isLoading) {
    return (
      <main className="ep-page prf-page" id="profile-main">
        <SkeletonHero />
        <div className="prf-level-bar-wrap">
          <div className="prf-level-bar">
            <div style={{ flex: 1 }}>
              <div className="prf-sk prf-sk--light" style={{ width: "8rem", height: "0.9rem", marginBottom: "0.5rem" }} />
              <div className="prf-sk prf-sk--light" style={{ width: "100%", height: "6px", borderRadius: "9999px" }} />
            </div>
            <div className="prf-sk prf-sk--light" style={{ width: "4rem", height: "2rem" }} />
          </div>
        </div>
        <div className="prf-content">
          <div className="prf-stats-col">
            <div className="prf-sk prf-sk--light" style={{ width: "6rem", height: "0.8rem" }} />
            <div className="prf-stat-grid" style={{ minHeight: "6rem" }} />
          </div>
          <div className="prf-account-col">
            <div className="prf-sk prf-sk--light" style={{ width: "5rem", height: "0.8rem" }} />
            <div className="prf-account" style={{ minHeight: "10rem" }} />
          </div>
        </div>
      </main>
    );
  }

  /* ── Full profile ── */
  return (
    <main className="ep-page prf-page" id="profile-main">

      {/* Hero banner */}
      <div className="prf-hero">
        <div className="prf-hero__inner">
          <div className="prf-avatar" aria-hidden="true">
            {profile?.full_name ? initials(profile.full_name) : "?"}
          </div>
          <div className="prf-hero__info">
            <h1 className="prf-hero__name">
              {profile?.full_name ?? "Your Profile"}
            </h1>
            <p className="prf-hero__email">{profile?.email ?? "—"}</p>
            <div className="prf-hero__badges">
              <span className="prf-badge prf-badge--level">
                <IconLeaf />
                Level {currentLevel.level} · {currentLevel.name}
              </span>
              {data?.rank && (
                <span className="prf-badge prf-badge--rank">
                  <IconStar />
                  {ordinal(data.rank)} on leaderboard
                </span>
              )}
              {profile?.email_verified && (
                <span className="prf-badge prf-badge--verified">
                  <IconCheck />
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating level-progress bar */}
      <div className="prf-level-bar-wrap">
        <div className="prf-level-bar">
          <div className="prf-level-bar__info">
            <div className="prf-level-bar__row">
              <span className="prf-level-bar__name">
                {currentLevel.name}
              </span>
              {nextLevel ? (
                <span className="prf-level-bar__next">
                  {(nextLevel.minPoints - totalPoints).toLocaleString()} pts to{" "}
                  <strong>{nextLevel.name}</strong>
                </span>
              ) : (
                <span className="prf-level-bar__next">Maximum level reached 🌿</span>
              )}
            </div>
            <div
              className="prf-level-bar__track"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Level progress: ${progress}%`}
            >
              <div
                className="prf-level-bar__fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="prf-level-bar__points">
            <p className="prf-level-bar__pts-value">{totalPoints.toLocaleString()}</p>
            <p className="prf-level-bar__pts-label">EcoPoints</p>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="prf-content">

        {/* Left — stats */}
        <div className="prf-stats-col">

          <p className="prf-section-label">Recycling stats</p>

          {/* Top stat row */}
          <div className="prf-stat-grid" aria-label="Key stats">
            <div className="prf-stat-cell">
              <p className="prf-stat-cell__value prf-stat-cell__value--brand">
                {data?.totalSubmissions ?? 0}
              </p>
              <p className="prf-stat-cell__label">Submissions</p>
            </div>
            <div className="prf-stat-cell">
              <p className="prf-stat-cell__value prf-stat-cell__value--earth">
                {data?.verifiedSubmissions ?? 0}
              </p>
              <p className="prf-stat-cell__label">Verified</p>
            </div>
            <div className="prf-stat-cell">
              <p className="prf-stat-cell__value prf-stat-cell__value--pts">
                {totalPoints.toLocaleString()}
              </p>
              <p className="prf-stat-cell__label">EcoPoints</p>
            </div>
          </div>

          {/* Impact detail */}
          <p className="prf-section-label">Impact summary</p>
          <div className="prf-impact">
            <div className="prf-impact__row">
              <div className="prf-impact__left">
                <div className="prf-impact__icon"><IconLeaf /></div>
                <span className="prf-impact__key">Eco level</span>
              </div>
              <span className="prf-impact__val">
                Level {currentLevel.level} — {currentLevel.name}
              </span>
            </div>
            <div className="prf-impact__row">
              <div className="prf-impact__left">
                <div className="prf-impact__icon"><IconPoints /></div>
                <span className="prf-impact__key">Total points earned</span>
              </div>
              <span className="prf-impact__val">{totalPoints.toLocaleString()} pts</span>
            </div>
            {data?.rank && (
              <div className="prf-impact__row">
                <div className="prf-impact__left">
                  <div className="prf-impact__icon"><IconStar /></div>
                  <span className="prf-impact__key">Community rank</span>
                </div>
                <span className="prf-impact__val">{ordinal(data.rank)}</span>
              </div>
            )}
            <div className="prf-impact__row">
              <div className="prf-impact__left">
                <div className="prf-impact__icon"><IconCalendar /></div>
                <span className="prf-impact__key">Member since</span>
              </div>
              <span className="prf-impact__val">
                {formatDate(profile?.member_since ?? profile?.created_at ?? null)}
              </span>
            </div>
            <div className="prf-impact__row">
              <div className="prf-impact__left">
                <div className="prf-impact__icon"><IconCheck /></div>
                <span className="prf-impact__key">Last active</span>
              </div>
              <span className="prf-impact__val">
                {formatDate(profile?.last_login_at ?? null)}
              </span>
            </div>
          </div>

          {/* Quick links */}
          <p className="prf-section-label">Quick links</p>
          <div style={{ display: "flex", gap: "var(--ep-space-3)", flexWrap: "wrap" }}>
            <Link href="/history" className="ep-btn ep-btn--secondary ep-btn--sm">
              View history
            </Link>
            <Link href="/rewards" className="ep-btn ep-btn--secondary ep-btn--sm">
              Browse rewards
            </Link>
            <Link href="/submit" className="ep-btn ep-btn--primary ep-btn--sm">
              Submit item
            </Link>
          </div>
        </div>

        {/* Right — account + sign out */}
        <div className="prf-account-col">

          <p className="prf-section-label">Account</p>
          <div className="prf-account" aria-label="Account details">
            <div className="prf-account__row">
              <span className="prf-account__key">Full name</span>
              <span className="prf-account__val">
                {profile?.full_name ?? <span className="prf-account__val--muted">Not set</span>}
              </span>
            </div>
            <div className="prf-account__row">
              <span className="prf-account__key">Email</span>
              <span className="prf-account__val">{profile?.email ?? "—"}</span>
            </div>
            <div className="prf-account__row">
              <span className="prf-account__key">Email verified</span>
              <span className="prf-account__val">
                {profile?.email_verified ? (
                  <span style={{ color: "var(--ep-color-success)", fontWeight: 600 }}>Yes</span>
                ) : (
                  <span style={{ color: "var(--ep-color-error-text)" }}>No</span>
                )}
              </span>
            </div>
            <div className="prf-account__row">
              <span className="prf-account__key">Account status</span>
              <span className="prf-account__val">
                {profile?.is_active ? (
                  <span style={{ color: "var(--ep-color-success)", fontWeight: 600 }}>Active</span>
                ) : (
                  <span style={{ color: "var(--ep-color-text-tertiary)" }}>Inactive</span>
                )}
              </span>
            </div>
            <div className="prf-account__row">
              <span className="prf-account__key">Member since</span>
              <span className="prf-account__val">
                {formatDate(profile?.member_since ?? profile?.created_at ?? null)}
              </span>
            </div>
          </div>

          <div className="prf-signout">
            <p className="prf-signout__label">
              Signing out will end your current session. Your points and history
              will be saved.
            </p>
            <button
              className="ep-btn ep-btn--danger"
              style={{ width: "100%" }}
              onClick={handleSignOut}
              id="profile-signout-btn"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
