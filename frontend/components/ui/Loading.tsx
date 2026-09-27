/**
 * EcoPoints — Loading state components
 *
 * Skeleton:    content-shaped placeholder during load
 * Spinner:     circular progress indicator
 * Progress:    horizontal progress bar
 * EmptyState:  no-content placeholder
 *
 * Usage:
 *   <Skeleton variant="text" style={{ width: "60%" }} />
 *   <Skeleton variant="card" style={{ height: 120 }} />
 *   <SkeletonBlock lines={3} />
 *
 *   <Spinner size="md" />
 *   <SpinnerCenter />
 *
 *   <Progress value={65} max={100} />
 *   <Progress indeterminate />
 *
 *   <EmptyState title="No submissions yet" description="..." action={<Button>Submit now</Button>} />
 */

import "@/styles/loading.css";

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

type SkeletonVariant =
  | "text"
  | "text-sm"
  | "heading"
  | "avatar-sm"
  | "avatar-md"
  | "avatar-lg"
  | "rect"
  | "card";

interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: SkeletonVariant;
}

export function Skeleton({ variant = "rect", className = "", style, ...props }: SkeletonProps) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={[
        "ep-skeleton",
        `ep-skeleton--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      {...props}
    />
  );
}

/* ── SkeletonBlock — text paragraph placeholder ───────────────────────────── */

interface SkeletonBlockProps {
  lines?: number;
  className?: string;
}

export function SkeletonBlock({ lines = 3, className = "" }: SkeletonBlockProps) {
  return (
    <div className={`ep-skeleton-block ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          variant="text"
          style={{
            width: i === lines - 1 && lines > 1 ? "70%" : "100%",
          }}
        />
      ))}
    </div>
  );
}

/* ── Spinner ──────────────────────────────────────────────────────────────── */

type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
type SpinnerColor = "brand" | "muted" | "white";

interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", color = "brand", label = "Loading…", className = "" }: SpinnerProps) {
  return (
    <span role="status" aria-label={label}>
      <span
        className={[
          "ep-spinner",
          `ep-spinner--${size}`,
          color !== "brand" && `ep-spinner--${color}`,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      />
    </span>
  );
}

/* Full-section centered spinner */
export function SpinnerCenter({ size = "md", label = "Loading…" }: { size?: SpinnerSize; label?: string }) {
  return (
    <div className="ep-spinner-center">
      <Spinner size={size} label={label} />
    </div>
  );
}

/* ── Progress ─────────────────────────────────────────────────────────────── */

interface ProgressProps {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  thin?: boolean;
  thick?: boolean;
  label?: string;
  className?: string;
}

export function Progress({
  value = 0,
  max = 100,
  indeterminate = false,
  thin = false,
  thick = false,
  label = "Progress",
  className = "",
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={[
        "ep-progress",
        thin && "ep-progress--thin",
        thick && "ep-progress--thick",
        indeterminate && "ep-progress--indeterminate",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="ep-progress__fill"
        style={indeterminate ? undefined : { width: `${pct}%` }}
      />
    </div>
  );
}

/* ── EmptyState ───────────────────────────────────────────────────────────── */

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`ep-empty ${className}`}>
      {icon && <div className="ep-empty__icon">{icon}</div>}
      <p className="ep-empty__title">{title}</p>
      {description && <p className="ep-empty__description">{description}</p>}
      {action && <div style={{ marginTop: "var(--ep-space-4)" }}>{action}</div>}
    </div>
  );
}
