"use client";

import { useState } from "react";
import Link from "next/link";
import "@/styles/shell.css";
import "@/styles/history.css";
import "@/styles/status.css";
import "@/styles/button.css";
import { useHistory } from "@/lib/hooks/useHistory";
import type { Submission, SubmissionStatus } from "@/lib/hooks/useHistory";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(s: SubmissionStatus): string {
  const map: Record<SubmissionStatus, string> = {
    pending: "Pending",
    processing: "Processing",
    review: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
    verified: "Verified",
  };
  return map[s] ?? s;
}

function statusPillClass(s: SubmissionStatus): string {
  const map: Record<SubmissionStatus, string> = {
    pending: "ep-status-pill--pending",
    processing: "ep-status-pill--processing",
    review: "ep-status-pill--review",
    approved: "ep-status-pill--approved",
    rejected: "ep-status-pill--rejected",
    verified: "ep-status-pill--verified",
  };
  return map[s] ?? "";
}

function itemType(sub: Submission): string {
  // New contract uses action_type; old recycling rows have item_type directly
  const at = sub.verification_result?.action_type as string | undefined;
  const it = sub.verification_result?.item_type as string | undefined;
  if (at && at !== "unknown") return it && it !== "" ? it : actionLabel(sub);
  return it ?? "Unknown item";
}

function itemMaterial(sub: Submission): string {
  return sub.verification_result?.material ?? "—";
}

const ACTION_LABELS: Record<string, string> = {
  recycling:          "Recycling",
  tree_planting:      "Tree planting",
  waste_segregation:  "Waste segregation",
  litter_cleanup:     "Litter cleanup",
  composting:         "Composting",
};

/**
 * Returns the action badge info for a submission row.
 * `verified` is true only when the backend confirmed the action was performed
 * (action_detected=true). When the model identified an action type but rejected
 * the submission (action_detected=false), verified=false so the row shows
 * "Recycling — not verified" instead of the misleading plain "RECYCLING" badge.
 */
function actionBadge(sub: Submission): { text: string; verified: boolean } | null {
  const vr = sub.verification_result;
  const at = vr?.action_type as string | undefined;
  const actionDetected = vr?.action_detected === true;

  // Legacy rows: is_recyclable_item=true means the action was actually verified
  const legacyVerified = vr?.is_recyclable_item === true;

  if (at && at !== "unknown" && ACTION_LABELS[at]) {
    return { text: ACTION_LABELS[at], verified: actionDetected };
  }
  // Backwards compat: old rows only have is_recyclable_item
  if (legacyVerified) {
    return { text: "Recycling", verified: true };
  }
  return null;
}

/** Plain string version — kept for aria-label and detail drawer helpers. */
function actionLabel(sub: Submission): string {
  return actionBadge(sub)?.text ?? "";
}

/* ── Status dot icon ──────────────────────────────────────────────────────── */

function StatusDot({ status }: { status: SubmissionStatus }) {
  const colors: Record<SubmissionStatus, string> = {
    pending: "#b45309",
    processing: "#5c7258",
    review: "#b45309",
    approved: "#3a5c33",
    verified: "#3a5c33",
    rejected: "#b91c1c",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: colors[status] ?? "#a09891",
        flexShrink: 0,
      }}
    />
  );
}

/* ── Skeleton rows ────────────────────────────────────────────────────────── */

function SkeletonRows() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <div className="hist-skeleton-row" key={i}>
          <div className="hist-skeleton hist-skeleton--md" />
          <div className="hist-skeleton hist-skeleton--sm" />
          <div className="hist-skeleton hist-skeleton--sm" />
          <div className="hist-skeleton hist-skeleton--sm" />
          <div />
        </div>
      ))}
    </>
  );
}

/* ── Helpers for the Detail Drawer ───────────────────────────────────────── */

const ACTION_IMPROVE_HINTS: Record<string, string> = {
  recycling:
    "Show the item being placed into a clearly identified recycling container. Make sure the recycling symbol or label on the bin is visible in the photo.",
  tree_planting:
    "Show the sapling being actively placed or held directly above a freshly dug hole in the soil rather than only photographing the plant by itself.",
  waste_segregation:
    "Show the organic waste being placed into a clearly labelled organic, green-waste, or compost collection container — not an ordinary mixed-waste bin.",
  litter_cleanup:
    "Show the litter being actively picked up or collected from the area, with the waste and the collection action both clearly visible.",
  composting:
    "Show the organic material being placed into a clearly recognisable composting bin, tumbler, or compost system.",
  unknown:
    "Submit a clear, well-lit photo that shows both the item and the environmental action being performed.",
};

function improveHint(vr: NonNullable<Submission["verification_result"]>): string {
  if (vr.is_ai_generated) {
    return "Submit an original camera photo rather than an AI-generated or synthetically edited image.";
  }
  if (!(vr as Record<string, unknown>).is_real_photo) {
    return "Submit a genuine real-world camera photo for your EcoPoints submission.";
  }
  const physicalSeen = (vr as Record<string, unknown>).physical_action_observed === true;
  const at = (vr.action_type as string | undefined) ?? "unknown";
  // Physical action was visible but didn’t qualify — give specific bin/item guidance
  if (physicalSeen && !vr.action_detected) {
    if (at === "recycling" || at === "unknown") {
      return "Show an accepted recyclable item being placed into a clearly identified recycling container — the bin should have a visible recycling symbol or label.";
    }
    return ACTION_IMPROVE_HINTS[at] ?? ACTION_IMPROVE_HINTS.unknown;
  }
  const confidence = typeof vr.confidence === "number" ? vr.confidence : 1;
  if (confidence < 0.4) {
    return "Take a clearer, well-lit photo with both the item and the action fully visible. Avoid blurry or dark images.";
  }
  if (vr.contamination_detected) {
    return "Make sure the item is clean and free of food residue or liquid before placing it in the recycling stream.";
  }
  return ACTION_IMPROVE_HINTS[at] ?? ACTION_IMPROVE_HINTS.unknown;
}

function actionDetectedLabel(vr: NonNullable<Submission["verification_result"]>): string {
  const at = (vr.action_type as string | undefined) ?? "unknown";
  const label = ACTION_LABELS[at] ?? "Environmental action";
  if (vr.action_detected) return `${label} verified ✓`;
  // physical_action_observed exists on the new schema; fall back gracefully for old rows
  const physicalSeen = (vr as Record<string, unknown>).physical_action_observed === true;
  if (physicalSeen) {
    // A physical action was visible but it didn’t meet EcoPoints criteria
    return at !== "unknown"
      ? `${label} not verified ✕`
      : "EcoPoints action not verified ✕";
  }
  if (at === "unknown") return "No supported action detected ✕";
  return `${label} not verified ✕`;
}

function statusHeading(status: SubmissionStatus): string {
  if (status === "rejected") return "Why was this rejected?";
  if (status === "approved" || status === "verified") return "Why was this approved?";
  if (status === "review") return "Why is this under review?";
  return "Verification status";
}

/* ── Detail drawer ────────────────────────────────────────────────────────── */

interface DrawerProps {
  submission: Submission;
  onClose: () => void;
}

function DetailDrawer({ submission: sub, onClose }: DrawerProps) {
  const vr = sub.verification_result;
  const isApproved = sub.status === "approved" || sub.status === "verified";
  const isRejected = sub.status === "rejected";
  const isReview = sub.status === "review";
  const isPending = sub.status === "pending" || sub.status === "processing";

  // Derived display values — always show something, never blank
  const displayItemType = vr?.item_type && vr.item_type !== ""
    ? vr.item_type
    : "Unclear";
  const displayMaterial = vr?.material && vr.material !== ""
    ? vr.material
    : vr?.action_type === "recycling" ? "Unclear" : null;
  const displayConfidence = typeof vr?.confidence === "number"
    ? `${Math.round(vr.confidence * 100)}%`
    : null;
  const displayAction = vr?.action_type && vr.action_type !== "unknown"
    ? (ACTION_LABELS[vr.action_type] ?? vr.action_type)
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="hist-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className="hist-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Submission detail"
      >
        <header className="hist-drawer__header">
          <h2 className="hist-drawer__title">Submission detail</h2>
          <button
            className="hist-drawer__close"
            onClick={onClose}
            aria-label="Close detail panel"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M13.5 4.5L4.5 13.5M4.5 4.5l9 9"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="hist-drawer__body">

          {/* ── Status + points ────────────────────────────────────────────── */}
          <div className="hist-vd-status-row">
            <span className={`ep-status-pill ${statusPillClass(sub.status)}`}>
              <StatusDot status={sub.status} />
              {statusLabel(sub.status)}
            </span>
            {isApproved && sub.points_awarded > 0 && (
              <span className="hist-points-badge">
                +{sub.points_awarded}
                <span className="hist-points-badge__unit">pts</span>
              </span>
            )}
          </div>

          {/* ── Evidence block: WHAT WAS DETECTED ─────────────────────────── */}
          {vr && (
            <div className="hist-detail-section">
              <p className="hist-detail-section__label">What was detected</p>

              {/* Item detected */}
              <div className="hist-vd-evidence-card">
                <div className="hist-vd-evidence-card__header">
                  <span className="hist-vd-evidence-card__label">Item detected</span>
                  <span className="hist-vd-evidence-card__chip hist-vd-evidence-card__chip--neutral">
                    {displayItemType}
                  </span>
                </div>
                {displayMaterial && (
                  <div className="hist-detail-row" style={{ marginTop: "var(--ep-space-2)" }}>
                    <span className="hist-detail-row__key">Material</span>
                    <span className="hist-detail-row__val">{displayMaterial}</span>
                  </div>
                )}
              </div>

              {/* Action detected */}
              {(() => {
                const physicalSeen =
                  (vr as Record<string, unknown>).physical_action_observed === true;
                const isPhysicalButNotSupported =
                  physicalSeen && !vr.action_detected;
                return (
                  <div className={`hist-vd-evidence-card ${
                    vr.action_detected
                      ? "hist-vd-evidence-card--success"
                      : "hist-vd-evidence-card--error"
                  }`}>
                    <div className="hist-vd-evidence-card__header">
                      <span className="hist-vd-evidence-card__label">
                        {isPhysicalButNotSupported
                          ? "Physical action observed"
                          : "Action detected"}
                      </span>
                      <span className={`hist-vd-evidence-card__chip ${
                        vr.action_detected
                          ? "hist-vd-evidence-card__chip--success"
                          : "hist-vd-evidence-card__chip--error"
                      }`}>
                        {actionDetectedLabel(vr)}
                      </span>
                    </div>
                    {/* When a physical action was seen but EcoPoints action was not
                        verified, show a clarifying callout instead of the generic
                        "object visible ≠ action verified" principle. */}
                    {isPhysicalButNotSupported ? (
                      <p className="hist-vd-principle">
                        Physical action observed ≠ EcoPoints action verified
                      </p>
                    ) : (
                      !vr.action_detected && vr.item_type && vr.item_type !== "" && (
                        <p className="hist-vd-principle">
                          Object visible ≠ action verified
                        </p>
                      )
                    )}
                  </div>
                );
              })()}

              {/* Evidence description from backend */}
              {vr.evidence && vr.evidence !== "" && (
                <div className="hist-detail-row" style={{ marginTop: "var(--ep-space-1)" }}>
                  <span className="hist-detail-row__key">Evidence</span>
                  <span className="hist-detail-row__val" style={{ textAlign: "left", flex: 1 }}>
                    {vr.evidence}
                  </span>
                </div>
              )}

              {/* Confidence */}
              {displayConfidence && (
                <div className="hist-detail-row">
                  <span className="hist-detail-row__key">Confidence</span>
                  <span className="hist-detail-row__val">{displayConfidence}</span>
                </div>
              )}

              {/* Flags: AI generated / contamination */}
              {vr.is_ai_generated && (
                <div className="hist-vd-flag hist-vd-flag--error">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M6.5 3.5v3M6.5 9h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  Image appears AI-generated or synthetic
                </div>
              )}
              {vr.contamination_detected && (
                <div className="hist-vd-flag hist-vd-flag--warning">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M6.5 3.5v3M6.5 9h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  Contamination detected — item may contain food residue or liquid
                </div>
              )}
            </div>
          )}

          {/* ── Approved detail ────────────────────────────────────────────── */}
          {isApproved && vr && (
            <div className="hist-detail-section">
              <p className="hist-detail-section__label">Why was this approved?</p>
              <div className="hist-vd-reason-card hist-vd-reason-card--success">
                {vr.reason ? (
                  <p className="hist-vd-reason-card__text">{vr.reason}</p>
                ) : (
                  <p className="hist-vd-reason-card__text">
                    The image clearly demonstrated the required environmental action
                    and met all verification criteria for EcoPoints.
                  </p>
                )}
              </div>
              {/* Approved summary row */}
              <div className="hist-vd-approved-row">
                {displayAction && (
                  <div className="hist-vd-approved-item">
                    <span className="hist-vd-approved-item__key">Action</span>
                    <span className="hist-vd-approved-item__val">{displayAction}</span>
                  </div>
                )}
                {vr.item_type && vr.item_type !== "" && (
                  <div className="hist-vd-approved-item">
                    <span className="hist-vd-approved-item__key">Item</span>
                    <span className="hist-vd-approved-item__val">{vr.item_type}</span>
                  </div>
                )}
                {displayConfidence && (
                  <div className="hist-vd-approved-item">
                    <span className="hist-vd-approved-item__key">Confidence</span>
                    <span className="hist-vd-approved-item__val">{displayConfidence}</span>
                  </div>
                )}
                {sub.points_awarded > 0 && (
                  <div className="hist-vd-approved-item">
                    <span className="hist-vd-approved-item__key">EcoPoints awarded</span>
                    <span className="hist-vd-approved-item__val hist-vd-approved-item__val--points">
                      +{sub.points_awarded}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Rejected reason + how to improve ──────────────────────────── */}
          {isRejected && vr && (
            <div className="hist-detail-section">
              <p className="hist-detail-section__label">Why was this rejected?</p>
              <div className="hist-vd-reason-card hist-vd-reason-card--error">
                {vr.reason ? (
                  <p className="hist-vd-reason-card__text">{vr.reason}</p>
                ) : (
                  <p className="hist-vd-reason-card__text">
                    The submission did not meet the verification criteria for EcoPoints.
                  </p>
                )}
              </div>

              <p className="hist-detail-section__label" style={{ marginTop: "var(--ep-space-2)" }}>
                How to improve
              </p>
              <div className="hist-vd-improve-card">
                <p className="hist-vd-improve-card__text">{improveHint(vr)}</p>
              </div>
            </div>
          )}

          {/* ── Under review reason ────────────────────────────────────────── */}
          {isReview && (
            <div className="hist-detail-section">
              <p className="hist-detail-section__label">Why is this under review?</p>
              <div className="hist-vd-reason-card hist-vd-reason-card--review">
                {vr?.reason ? (
                  <p className="hist-vd-reason-card__text">{vr.reason}</p>
                ) : (
                  <p className="hist-vd-reason-card__text">
                    The image could not be automatically verified with sufficient
                    confidence. A manual reviewer will assess this submission before
                    any points are awarded.
                  </p>
                )}
              </div>
              <p className="hist-vd-review-note">
                Points will only be awarded after a reviewer confirms the
                submission meets EcoPoints criteria.
              </p>
            </div>
          )}

          {/* ── Pending / processing ───────────────────────────────────────── */}
          {isPending && (
            <div className="hist-detail-section">
              <div className="hist-vd-reason-card hist-vd-reason-card--pending">
                <p className="hist-vd-reason-card__text">
                  Your submission is being processed by our AI verification
                  system. This usually takes a few minutes. Points will be
                  awarded once verified.
                </p>
              </div>
            </div>
          )}

          {/* ── Timeline ──────────────────────────────────────────────────── */}
          <div className="hist-detail-section">
            <p className="hist-detail-section__label">Timeline</p>
            <div className="hist-detail-row">
              <span className="hist-detail-row__key">Submitted</span>
              <span className="hist-detail-row__val">
                {formatDateLong(sub.submitted_at)}
              </span>
            </div>
          </div>

          {/* ── CTA ───────────────────────────────────────────────────────── */}
          <div style={{ marginTop: "auto" }}>
            <Link
              href="/submit"
              className="ep-btn ep-btn--primary"
              style={{ display: "block", textAlign: "center" }}
            >
              Submit another item
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ── Main page component ──────────────────────────────────────────────────── */

export default function HistoryPage() {
  const { submissions, summary, isLoading, error, refetch } = useHistory();
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeSubmission = activeId
    ? submissions.find((s) => s.id === activeId) ?? null
    : null;

  return (
    <>
      <main className="ep-page hist-page" id="history-main">
        {/* Page header */}
        <header className="hist-header">
          <p className="hist-header__eyebrow">Your activity</p>
          <h1 className="hist-header__title">Recycling history</h1>
          <p className="hist-header__subtitle">
            Every item you recycle is logged here — track your impact, check
            verification status, and see points earned over time.
          </p>
        </header>

        {/* Summary strip */}
        <div className="hist-summary" aria-label="History summary">
          <div className="hist-summary__item">
            <p className="hist-summary__label">Total submissions</p>
            <p className="hist-summary__value hist-summary__value--brand">
              {isLoading ? "—" : (summary?.total ?? 0)}
            </p>
            <p className="hist-summary__hint">items recorded</p>
          </div>
          <div className="hist-summary__item">
            <p className="hist-summary__label">Verified</p>
            <p className="hist-summary__value hist-summary__value--verified">
              {isLoading ? "—" : (summary?.verified ?? 0)}
            </p>
            <p className="hist-summary__hint">items accepted</p>
          </div>
          <div className="hist-summary__item">
            <p className="hist-summary__label">Points earned</p>
            <p className="hist-summary__value hist-summary__value--points">
              {isLoading ? "—" : (summary?.totalPoints ?? 0)}
            </p>
            <p className="hist-summary__hint">from recycling</p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="hist-error" role="alert">
            <p className="hist-error__title">Could not load history</p>
            <p className="hist-error__body">{error}</p>
            <button
              className="ep-btn ep-btn--secondary ep-btn--sm"
              onClick={refetch}
            >
              Try again
            </button>
          </div>
        )}

        {/* Main list */}
        {!error && (
          <>
            {/* Toolbar */}
            <div className="hist-toolbar">
              <p className="hist-toolbar__count">
                {isLoading
                  ? "Loading…"
                  : `${submissions.length} submission${submissions.length !== 1 ? "s" : ""}`}
              </p>
              {!isLoading && submissions.length > 0 && (
                <Link
                  href="/submit"
                  className="ep-btn ep-btn--primary ep-btn--sm"
                >
                  + Recycle item
                </Link>
              )}
            </div>

            <div className="hist-list" role="table" aria-label="Submission history">
              {/* Column headers */}
              {!isLoading && submissions.length > 0 && (
                <div className="hist-list__head" role="row">
                  <div className="hist-list__head-cell" role="columnheader">Item</div>
                  <div className="hist-list__head-cell" role="columnheader">Date</div>
                  <div className="hist-list__head-cell" role="columnheader">Status</div>
                  <div className="hist-list__head-cell hist-list__head-cell--right" role="columnheader">
                    Points
                  </div>
                  <div className="hist-list__head-cell" role="columnheader" />
                </div>
              )}

              {/* Loading */}
              {isLoading && <SkeletonRows />}

              {/* Empty */}
              {!isLoading && submissions.length === 0 && !error && (
                <div className="hist-empty" role="row">
                  <div className="hist-empty__icon" aria-hidden="true">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 11v6M14 11v6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <h2 className="hist-empty__title">No submissions yet</h2>
                  <p className="hist-empty__body">
                    Start recycling to build your history. Submit your first
                    item and earn EcoPoints.
                  </p>
                  <Link href="/submit" className="ep-btn ep-btn--primary">
                    Recycle your first item
                  </Link>
                </div>
              )}

              {/* Rows */}
              {!isLoading &&
                submissions.map((sub) => {
                  const isActive = sub.id === activeId;
                  const earned = sub.points_awarded ?? 0;
                  return (
                    <div
                      key={sub.id}
                      className={`hist-row${isActive ? " hist-row--active" : ""}`}
                      role="row"
                      tabIndex={0}
                      onClick={() =>
                        setActiveId(isActive ? null : sub.id)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setActiveId(isActive ? null : sub.id);
                        }
                      }}
                      aria-expanded={isActive}
                      aria-label={`${itemType(sub)}, ${statusLabel(sub.status)}, ${formatDate(sub.submitted_at)}`}
                    >
                      {/* Item name + action label */}
                      <div className="hist-row__item" role="cell">
                        {(() => {
                          const badge = actionBadge(sub);
                          if (!badge) return null;
                          const cls = badge.verified
                            ? "hist-row__action-badge"
                            : "hist-row__action-badge hist-row__action-badge--unverified";
                          const label = badge.verified
                            ? badge.text
                            : `${badge.text} — not verified`;
                          return <span className={cls}>{label}</span>;
                        })()}
                        <span className="hist-row__type">
                          {itemType(sub)}
                        </span>
                        <span className="hist-row__material">
                          {itemMaterial(sub)}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="hist-row__date" role="cell">
                        {formatDate(sub.submitted_at)}
                      </div>

                      {/* Status */}
                      <div role="cell">
                        <span
                          className={`ep-status-pill ${statusPillClass(sub.status)}`}
                          style={{ fontSize: "0.7rem" }}
                        >
                          <StatusDot status={sub.status} />
                          {statusLabel(sub.status)}
                        </span>
                      </div>

                      {/* Points */}
                      <div
                        className={`hist-row__points${earned === 0 ? " hist-row__points--zero" : ""}`}
                        role="cell"
                      >
                        {earned > 0 ? `+${earned}` : "—"}
                      </div>

                      {/* Chevron */}
                      <div className="hist-row__chevron" aria-hidden="true">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                        >
                          <path
                            d="M5 3l4 4-4 4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </main>

      {/* Detail drawer */}
      {activeSubmission && (
        <DetailDrawer
          submission={activeSubmission}
          onClose={() => setActiveId(null)}
        />
      )}
    </>
  );
}
