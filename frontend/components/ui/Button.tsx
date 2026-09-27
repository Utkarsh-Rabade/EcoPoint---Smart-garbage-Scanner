/**
 * EcoPoints — Button component
 *
 * Variants:  primary | secondary | ghost | outline | danger
 * Sizes:     sm | md | lg
 * States:    default | disabled | loading
 *
 * Usage:
 *   <Button variant="primary">Submit</Button>
 *   <Button variant="secondary" size="sm">Cancel</Button>
 *   <Button variant="ghost" isLoading>Saving…</Button>
 *   <Button as="a" href="/dashboard" variant="outline">Go to dashboard</Button>
 */

import "@/styles/button.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isIconOnly?: boolean;
  children?: React.ReactNode;
  className?: string;
}

type ButtonAsButton = ButtonBaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> & {
    as?: "button";
    href?: never;
  };

type ButtonAsAnchor = ButtonBaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps> & {
    as: "a";
    href: string;
  };

type ButtonProps = ButtonAsButton | ButtonAsAnchor;

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  isIconOnly = false,
  children,
  className = "",
  as: Tag = "button",
  ...props
}: ButtonProps) {
  const classes = [
    "ep-btn",
    `ep-btn--${variant}`,
    size !== "md" && `ep-btn--${size}`,
    isLoading && "ep-btn--loading",
    isIconOnly && "ep-btn--icon",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {isLoading && (
        <span className="ep-btn__spinner" aria-hidden="true" />
      )}
      {children}
    </>
  );

  if (Tag === "a") {
    const { as: _as, isLoading: _l, isIconOnly: _i, ...anchorProps } =
      props as ButtonAsAnchor & { as: "a"; isLoading?: boolean; isIconOnly?: boolean };
    return (
      <a className={classes} {...anchorProps}>
        {content}
      </a>
    );
  }

  const { isLoading: _l, isIconOnly: _i, ...buttonProps } =
    props as ButtonAsButton & { isLoading?: boolean; isIconOnly?: boolean };

  return (
    <button
      className={classes}
      disabled={isLoading || (buttonProps as React.ButtonHTMLAttributes<HTMLButtonElement>).disabled}
      aria-busy={isLoading || undefined}
      {...(buttonProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  );
}
