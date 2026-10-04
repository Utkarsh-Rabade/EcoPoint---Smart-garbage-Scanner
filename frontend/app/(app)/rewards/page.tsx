"use client";

import { useState } from "react";
import Link from "next/link";
import "@/styles/shell.css";
import "@/styles/rewards.css";
import "@/styles/button.css";
import { useRewards } from "@/lib/hooks/useRewards";
import type { Reward } from "@/lib/hooks/useRewards";

/* ── Category icons (SVG inline, no external deps) ───────────────────────── */

const RewardIcon = ({ index }: { index: number }) => {
  const icons = [
    // Leaf
    <svg key="leaf" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 17c0 0 2-8 8-9.5C16 6 17 3 17 3s-1 8-6 10c-1.5.6-8 4-8 4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 17l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>,
    // Gift
    <svg key="gift" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="8" width="16" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 8v10M2 12h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 8C5.5 8 4 6.5 4 5s2-2 3 0 3 3 3 3H7zM13 8c1.5 0 3-1.5 3-3s-2-2-3 0-3 3-3 3h3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>,
    // Star
    <svg key="star" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2l2.4 5 5.6.8-4 3.9.9 5.5L10 14.5l-4.9 2.7.9-5.5L2 7.8l5.6-.8L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>,
    // Bag
    <svg key="bag" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 7h12l-1.5 9H5.5L4 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 7V5.5a3 3 0 016 0V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>,
    // Recycle
    <svg key="recycle" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3L7 7h6L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 7l-4 7h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 7l4 7h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>,
    // Sparkle
    <svg key="sparkle" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2v4M10 14v4M2 10h4M14 10h4M4.9 4.9l2.8 2.8M12.3 12.3l2.8 2.8M4.9 15.1l2.8-2.8M12.3 7.7l2.8-2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>,
  ];
  return icons[index % icons.length] ?? icons[0];
};

/* ── Reward descriptions (generated per title substring, keeps it editorial) ─ */

function describeReward(title: string, cost: number): string {
  const t = title.toLowerCase();
  if (t.includes("coffee") || t.includes("café") || t.includes("cafe"))
    return "Enjoy a complimentary drink at a participating café — a small thank-you for keeping the planet cleaner.";
  if (t.includes("plant") || t.includes("tree") || t.includes("seed"))
    return "We'll plant a tree on your behalf through our reforestation partner. Real impact, real roots.";
  if (t.includes("voucher") || t.includes("coupon") || t.includes("discount"))
    return `A ${cost}-point voucher redeemable with our eco-retail partners. Every purchase gives back.`;
  if (t.includes("bag") || t.includes("tote"))
    return "A durable organic-cotton tote — replace single-use plastic bags and carry your values everywhere.";
  if (t.includes("book") || t.includes("guide"))
    return "A curated sustainability handbook delivered digitally — packed with actionable eco-living ideas.";
  if (t.includes("bottle") || t.includes("flask") || t.includes("tumbler"))
    return "A reusable insulated bottle to reduce disposable cup waste. Good for you, great for the planet.";
  if (t.includes("donation") || t.includes("charity"))
    return "Your points trigger a real charitable donation to an environmental organisation of your choice.";
  if (cost < 100)
    return "A small but meaningful reward for your recycling effort — every action adds up.";
  if (cost < 500)
    return "A mid-tier reward recognising your consistent contribution to a more sustainable future.";
  return "A premium reward for dedicated recyclers — you've earned every point that gets you here.";
}

/* ── Skeleton loading ─────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="rwd-skeleton-card">
      <div className="rwd-skeleton-band" />
      <div className="rwd-skeleton-body">
        <div className="rwd-sk" style={{ width: "2.25rem", height: "2.25rem", borderRadius: "0.5rem" }} />
        <div className="rwd-sk" style={{ width: "60%", height: "1.1rem" }} />
        <div className="rwd-sk" style={{ width: "90%", height: "0.8rem" }} />
        <div className="rwd-sk" style={{ width: "75%", height: "0.8rem" }} />
      </div>
      <div className="rwd-skeleton-footer" />
    </div>
  );
}

/* ── Confirm modal ────────────────────────────────────────────────────────── */

type ModalState = "confirm" | "success";

interface ConfirmModalProps {
  reward: Reward;
  balance: number;
  onClose: () => void;
}

function ConfirmModal({ reward, balance, onClose }: ConfirmModalProps) {
  const [phase, setPhase] = useState<ModalState>("confirm");
  const [isRedeeming, setIsRedeeming] = useState(false);

  const canAfford = balance >= reward.points_cost;
  const afterBalance = balance - reward.points_cost;

  function handleRedeem() {
    if (!canAfford) return;
    setIsRedeeming(true);
    // Simulate redemption (no redemption endpoint exists yet)
    setTimeout(() => {
      setIsRedeeming(false);
      setPhase("success");
    }, 900);
  }

  return (
    <div
      className="rwd-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={phase === "success" ? "Reward redeemed" : `Redeem ${reward.title}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rwd-modal">
        {phase === "success" ? (
          <div className="rwd-success">
            <div className="rwd-success__icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="rwd-success__title">Reward redeemed!</h2>
            <p className="rwd-success__body">
              <strong>{reward.title}</strong> has been added to your account.
              Check your email for redemption details.
            </p>
            <button className="ep-btn ep-btn--primary" onClick={onClose} style={{ minWidth: "10rem" }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="rwd-modal__header">
              <p className="rwd-modal__pre">Confirm redemption</p>
              <h2 className="rwd-modal__title">{reward.title}</h2>
            </div>
            <div className="rwd-modal__body">
              <div className="rwd-modal__cost-row">
                <span className="rwd-modal__cost-label">Points required</span>
                <span className="rwd-modal__cost-value">
                  {reward.points_cost.toLocaleString()} pts
                </span>
              </div>

              {canAfford ? (
                <div className="rwd-modal__balance-row">
                  <span>Balance after redemption</span>
                  <span className="rwd-modal__balance-after">
                    {afterBalance.toLocaleString()} pts
                  </span>
                </div>
              ) : (
                <p className="rwd-modal__insufficient">
                  You need{" "}
                  <strong>
                    {(reward.points_cost - balance).toLocaleString()} more pts
                  </strong>{" "}
                  to unlock this reward. Keep recycling!
                </p>
              )}

              <div className="rwd-modal__actions">
                <button
                  className="ep-btn ep-btn--secondary"
                  onClick={onClose}
                  disabled={isRedeeming}
                >
                  Cancel
                </button>
                <button
                  className="ep-btn ep-btn--primary"
                  onClick={handleRedeem}
                  disabled={!canAfford || isRedeeming}
                  aria-busy={isRedeeming}
                >
                  {isRedeeming ? "Redeeming…" : "Redeem now"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Reward card ──────────────────────────────────────────────────────────── */

interface RewardCardProps {
  reward: Reward;
  index: number;
  affordable: boolean;
  balance: number;
  onRedeem: (r: Reward) => void;
}

function RewardCard({ reward, index, affordable, balance, onRedeem }: RewardCardProps) {
  const shortfall = reward.points_cost - balance;

  return (
    <article
      className={`rwd-card ${affordable ? "rwd-card--affordable" : "rwd-card--locked"}`}
      aria-label={`${reward.title}, ${reward.points_cost} points`}
    >
      <div className="rwd-card__band" aria-hidden="true" />
      <div className="rwd-card__body">
        <div className="rwd-card__icon" aria-hidden="true">
          <RewardIcon index={index} />
        </div>
        <h2 className="rwd-card__title">{reward.title}</h2>
        <p className="rwd-card__desc">{describeReward(reward.title, reward.points_cost)}</p>
      </div>
      <div className="rwd-card__footer">
        <div className="rwd-card__cost">
          <span className="rwd-card__cost-amount">
            {reward.points_cost.toLocaleString()}
          </span>
          <span className="rwd-card__cost-unit">pts</span>
        </div>
        {affordable ? (
          <button
            className="ep-btn ep-btn--primary ep-btn--sm"
            onClick={() => onRedeem(reward)}
            id={`redeem-${index}`}
          >
            Redeem
          </button>
        ) : (
          <div className="rwd-card__shortfall" aria-label={`Need ${shortfall} more points`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v6M6 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Need {shortfall.toLocaleString()} more
          </div>
        )}
      </div>
    </article>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function RewardsPage() {
  const { rewards, balance, isLoading, error, refetch } = useRewards();
  const [pendingReward, setPendingReward] = useState<Reward | null>(null);

  const currentBalance = balance ?? 0;
  const affordable = rewards.filter((r) => r.points_cost <= currentBalance);
  const locked = rewards.filter((r) => r.points_cost > currentBalance);
  const hasLocked = locked.length > 0;
  const cheapestLocked = locked[0]?.points_cost ?? 0;

  return (
    <>
      <main className="ep-page rwd-page" id="rewards-main">

        {/* Page header + balance */}
        <header className="rwd-header">
          <div className="rwd-header__text">
            <p className="rwd-header__eyebrow">Rewards store</p>
            <h1 className="rwd-header__title">Spend your EcoPoints</h1>
            <p className="rwd-header__subtitle">
              Every point you earn through recycling can be exchanged for
              real-world rewards. Browse what&apos;s available and redeem when
              you&apos;re ready.
            </p>
          </div>

          {/* Balance ledger */}
          <div className={`rwd-balance${isLoading ? " rwd-balance--loading" : ""}`} aria-label="Your EcoPoints balance">
            <p className="rwd-balance__label">Your balance</p>
            <p className="rwd-balance__amount">
              {isLoading ? "—" : currentBalance.toLocaleString()}
              <span className="rwd-balance__unit">pts</span>
            </p>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="rwd-error" role="alert">
            <p className="rwd-error__title">Could not load rewards</p>
            <p className="rwd-error__body">{error}</p>
            <button className="ep-btn ep-btn--secondary ep-btn--sm" onClick={refetch}>
              Try again
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !error && (
          <>
            <p className="rwd-section-label">Available rewards</p>
            <div className="rwd-grid">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </>
        )}

        {/* Rewards grid */}
        {!isLoading && !error && rewards.length === 0 && (
          <div className="rwd-grid">
            <div className="rwd-empty">
              <div className="rwd-empty__icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3 6 7 1-5 5 1.5 7L12 18l-6.5 3L7 14 2 9l7-1 3-6z"
                    stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="rwd-empty__title">No rewards yet</h2>
              <p className="rwd-empty__body">
                The rewards catalog is being assembled. Check back soon — more
                options are being added regularly.
              </p>
              <Link href="/submit" className="ep-btn ep-btn--primary">
                Earn more points
              </Link>
            </div>
          </div>
        )}

        {/* Affordable rewards */}
        {!isLoading && !error && affordable.length > 0 && (
          <>
            <p className="rwd-section-label">Available to you</p>
            <div className="rwd-grid">
              {affordable.map((r, i) => (
                <RewardCard
                  key={r.title}
                  reward={r}
                  index={i}
                  affordable
                  balance={currentBalance}
                  onRedeem={setPendingReward}
                />
              ))}
            </div>
          </>
        )}

        {/* Locked rewards */}
        {!isLoading && !error && locked.length > 0 && (
          <>
            <p className="rwd-section-label" style={{ marginTop: affordable.length ? "var(--ep-space-6)" : 0 }}>
              More to unlock
            </p>
            <div className="rwd-grid">
              {locked.map((r, i) => (
                <RewardCard
                  key={r.title}
                  reward={r}
                  index={affordable.length + i}
                  affordable={false}
                  balance={currentBalance}
                  onRedeem={setPendingReward}
                />
              ))}
            </div>
          </>
        )}

        {/* Earn-more note when some rewards are locked */}
        {!isLoading && !error && hasLocked && (
          <div className="rwd-locked-note" role="note">
            <span className="rwd-locked-note__icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25" />
                <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <span>
              You&apos;re{" "}
              <strong>{(cheapestLocked - currentBalance).toLocaleString()} pts</strong>{" "}
              away from unlocking the next reward. Submit more recyclable items
              at the{" "}
              <Link href="/submit" style={{ color: "var(--ep-color-brand)", fontWeight: 500 }}>
                recycling station
              </Link>
              .
            </span>
          </div>
        )}
      </main>

      {/* Confirmation modal */}
      {pendingReward && (
        <ConfirmModal
          reward={pendingReward}
          balance={currentBalance}
          onClose={() => setPendingReward(null)}
        />
      )}
    </>
  );
}
