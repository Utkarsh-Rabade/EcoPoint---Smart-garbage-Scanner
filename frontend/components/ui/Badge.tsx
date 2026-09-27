/**
 * EcoPoints — Badge and StatusDot components
 *
 * Badge:     inline semantic label
 * StatusDot: small colored dot, optionally pulsing
 *
 * Usage:
 *   <Badge variant="success">Verified</Badge>
 *   <Badge variant="points" size="sm">+250 pts</Badge>
 *   <Badge variant="brand" style="solid">Premium</Badge>
 *
 *   <StatusDot variant="success" pulse />
 */

import "@/styles/badge.css";

type BadgeVariant =
  | "default"
  | "brand"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "earth"
  | "points";

type BadgeStyle = "subtle" | "solid";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant?: BadgeVariant;
  style?: BadgeStyle;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant = "default",
  style = "subtle",
  size = "md",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "ep-badge",
        `ep-badge--${variant}`,
        style === "solid" && "ep-badge--solid",
        size === "sm" && "ep-badge--sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

/* ── StatusDot ───────────────────────────────────────────────────────────── */

type StatusDotVariant = "success" | "warning" | "error" | "neutral" | "brand";

interface StatusDotProps {
  variant?: StatusDotVariant;
  pulse?: boolean;
  className?: string;
  /** Accessible label */
  label?: string;
}

export function StatusDot({
  variant = "neutral",
  pulse = false,
  className = "",
  label,
}: StatusDotProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={[
        "ep-status-dot",
        `ep-status-dot--${variant}`,
        pulse && "ep-status-dot--pulse",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

/* ── StatusPill ──────────────────────────────────────────────────────────── */

type SubmissionStatus =
  | "pending"
  | "processing"
  | "reviewing"
  | "verified"
  | "approved"
  | "rejected"
  | "failed"
  | "review"
  | "draft";

const statusLabels: Record<SubmissionStatus, string> = {
  pending:    "Pending",
  processing: "Processing",
  reviewing:  "Under Review",
  verified:   "Verified",
  approved:   "Approved",
  rejected:   "Rejected",
  failed:     "Failed",
  review:     "In Review",
  draft:      "Draft",
};

interface StatusPillProps {
  status: SubmissionStatus;
  className?: string;
}

export function StatusPill({ status, className = "" }: StatusPillProps) {
  return (
    <span
      className={[
        "ep-status-pill",
        `ep-status-pill--${status}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {statusLabels[status]}
    </span>
  );
}
