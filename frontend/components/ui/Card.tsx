/**
 * EcoPoints — Card, Panel, Well, Stat, Table components
 *
 * Each is a deliberately different visual treatment:
 *   Card     — white surface, thin border, shadow
 *   Panel    — flat wrapper, no chrome
 *   Well     — sunken / inset fill
 *   Stat     — number + label, no card chrome
 *   Section  — full-bleed layout block
 *
 * Usage:
 *   <Card>...</Card>
 *   <Card.Header title="Points" subtitle="This month" />
 *   <Card.Divider />
 *   <Card.Footer><Button>Done</Button></Card.Footer>
 *
 *   <Well>Inset note content</Well>
 *
 *   <Stat value="1,240" label="Total Points" variant="brand" />
 */

import "@/styles/card.css";

/* ── Card ────────────────────────────────────────────────────────────────── */

interface CardProps {
  compact?: boolean;
  loose?: boolean;
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

export function Card({
  compact = false,
  loose = false,
  children,
  className = "",
  as: Tag = "div",
}: CardProps) {
  return (
    <Tag
      className={[
        "ep-card",
        compact && "ep-card--compact",
        loose && "ep-card--loose",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

Card.Header = function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="ep-card__header">
      <div>
        <div className="ep-card__title">{title}</div>
        {subtitle && <div className="ep-card__subtitle">{subtitle}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

Card.Divider = function CardDivider() {
  return <hr className="ep-card__divider" />;
};

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

Card.Footer = function CardFooter({ children, className = "" }: CardFooterProps) {
  return <div className={`ep-card__footer ${className}`}>{children}</div>;
};

/* ── Well ────────────────────────────────────────────────────────────────── */

interface WellProps {
  compact?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Well({ compact = false, children, className = "" }: WellProps) {
  return (
    <div
      className={[
        "ep-well",
        compact && "ep-well--compact",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────── */

interface SectionProps {
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

export function Section({
  size = "md",
  children,
  className = "",
  as: Tag = "section",
}: SectionProps) {
  return (
    <Tag
      className={[
        "ep-section",
        size === "sm" && "ep-section--sm",
        size === "lg" && "ep-section--lg",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

/* ── Stat ────────────────────────────────────────────────────────────────── */

interface StatProps {
  value: React.ReactNode;
  label: React.ReactNode;
  delta?: React.ReactNode;
  deltaDirection?: "up" | "down";
  variant?: "default" | "brand" | "earth" | "points";
  className?: string;
}

export function Stat({
  value,
  label,
  delta,
  deltaDirection = "up",
  variant = "default",
  className = "",
}: StatProps) {
  return (
    <div className={`ep-stat ${className}`}>
      <div
        className={[
          "ep-stat__value",
          variant !== "default" && `ep-stat__value--${variant}`,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </div>
      <div className="ep-stat__label">{label}</div>
      {delta !== undefined && (
        <div className={`ep-stat__delta ep-stat__delta--${deltaDirection}`}>
          {delta}
        </div>
      )}
    </div>
  );
}

/* ── List row (data row inside a card) ───────────────────────────────────── */

interface ListRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}

export function ListRow({ label, value, className = "" }: ListRowProps) {
  return (
    <div className={`ep-list-row ${className}`}>
      <span className="ep-list-row__label">{label}</span>
      <span className="ep-list-row__value">{value}</span>
    </div>
  );
}
