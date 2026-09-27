/**
 * EcoPoints — Heading and typography components
 *
 * Semantic heading classes decoupled from h1-h6 visual size.
 *
 * Usage:
 *   <PageHeader title="Dashboard" lead="Your recycling activity" />
 *
 *   <SectionHeading as="h2" ruled>Recent Submissions</SectionHeading>
 *   <SectionHeading as="h2" accented>Rewards</SectionHeading>
 *
 *   <Eyebrow>Recycling category</Eyebrow>
 *
 *   <Text variant="lead">...</Text>
 *   <Text variant="caption" className="ep-text-muted">...</Text>
 */

import "@/styles/typography.css";

/* ── PageHeader ──────────────────────────────────────────────────────────── */

interface PageHeaderProps {
  title: React.ReactNode;
  lead?: React.ReactNode;
  action?: React.ReactNode;
  bordered?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  lead,
  action,
  bordered = false,
  className = "",
}: PageHeaderProps) {
  return (
    <header
      className={[
        "ep-page-header",
        bordered && "ep-page-header--bordered",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--ep-space-4)",
        }}
      >
        <div>
          <h1 className="ep-heading-page">{title}</h1>
          {lead && <p className="ep-text-lead" style={{ marginTop: "var(--ep-space-2)" }}>{lead}</p>}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
    </header>
  );
}

/* ── SectionHeading ──────────────────────────────────────────────────────── */

interface SectionHeadingProps {
  as?: "h2" | "h3" | "h4";
  ruled?: boolean;
  accented?: boolean;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionHeading({
  as: Tag = "h2",
  ruled = false,
  accented = false,
  eyebrow,
  children,
  className = "",
}: SectionHeadingProps) {
  return (
    <div>
      {eyebrow && <div className="ep-eyebrow" style={{ marginBottom: "var(--ep-space-2)" }}>{eyebrow}</div>}
      <Tag
        className={[
          "ep-heading-section",
          ruled && "ep-heading-section--ruled",
          accented && "ep-heading-section--accented",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </Tag>
    </div>
  );
}

/* ── Eyebrow ─────────────────────────────────────────────────────────────── */

interface EyebrowProps {
  variant?: "default" | "brand" | "earth";
  children: React.ReactNode;
  className?: string;
}

export function Eyebrow({ variant = "default", children, className = "" }: EyebrowProps) {
  return (
    <div
      className={[
        "ep-eyebrow",
        variant === "brand" && "ep-eyebrow--brand",
        variant === "earth" && "ep-eyebrow--earth",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

/* ── Text ─────────────────────────────────────────────────────────────────── */

type TextVariant = "lead" | "body" | "caption" | "mono";
type TextElement = "p" | "span" | "div" | "small";

interface TextProps {
  variant?: TextVariant;
  as?: TextElement;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<TextVariant, string> = {
  lead:    "ep-text-lead",
  body:    "ep-text-body",
  caption: "ep-text-caption",
  mono:    "ep-text-mono",
};

const variantDefaultTags: Record<TextVariant, TextElement> = {
  lead:    "p",
  body:    "p",
  caption: "small",
  mono:    "span",
};

export function Text({ variant = "body", as, children, className = "" }: TextProps) {
  const Tag = as ?? variantDefaultTags[variant];
  return (
    <Tag className={`${variantClasses[variant]} ${className}`}>
      {children}
    </Tag>
  );
}
