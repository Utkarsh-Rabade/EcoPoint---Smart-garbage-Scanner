/**
 * EcoPoints — Alert, Callout, Banner components
 *
 * Alert:   dismissible informational block (error, warning, success, info)
 * Callout: non-dismissible inline note
 * Banner:  full-width strip (top of page or section)
 *
 * Usage:
 *   <Alert variant="error" title="Upload failed" onDismiss={() => {}}>
 *     Please try again with a valid image.
 *   </Alert>
 *
 *   <Callout variant="brand">
 *     Photos submitted today will be processed within 2 hours.
 *   </Callout>
 *
 *   <Banner variant="warning">Scheduled maintenance on Oct 5.</Banner>
 */

"use client";

import "@/styles/status.css";

/* ── Alert ───────────────────────────────────────────────────────────────── */

type AlertVariant = "info" | "warning" | "success" | "error";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function Alert({
  variant = "info",
  title,
  icon,
  onDismiss,
  children,
  className = "",
}: AlertProps) {
  return (
    <div
      role="alert"
      className={[
        "ep-alert",
        `ep-alert--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && <span className="ep-alert__icon" aria-hidden="true">{icon}</span>}
      <div className="ep-alert__body">
        {title && <div className="ep-alert__title">{title}</div>}
        {children}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="ep-alert__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ── Callout ─────────────────────────────────────────────────────────────── */

type CalloutVariant = "default" | "brand" | "earth";

interface CalloutProps {
  variant?: CalloutVariant;
  children: React.ReactNode;
  className?: string;
}

export function Callout({ variant = "default", children, className = "" }: CalloutProps) {
  return (
    <div
      className={[
        "ep-callout",
        variant !== "default" && `ep-callout--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

/* ── Banner ──────────────────────────────────────────────────────────────── */

interface BannerProps {
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
}

export function Banner({ variant = "info", children, className = "" }: BannerProps) {
  return (
    <div
      role="status"
      className={[
        "ep-banner",
        `ep-banner--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
