"use client";

/**
 * EcoPoints — Mobile navigation
 *
 * Two parts:
 *   MobileHeader — compact sticky top bar (logo + submit CTA)
 *   BottomNav    — fixed bottom tab bar with 5 primary destinations
 *
 * Touch targets are ≥44px per WCAG 2.5.5.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import "@/styles/shell.css";

import {
  IconGrid,
  IconGift,
  IconHistory,
  IconLeaf,
  IconTrophy,
  IconUpload,
  IconUser,
} from "@/components/ui/Icons";

/* ── Bottom nav destinations ─────────────────────────────────────────────── */

const BOTTOM_NAV = [
  { href: "/dashboard",   label: "Home",       icon: IconGrid },
  { href: "/history",     label: "History",    icon: IconHistory },
  { href: "/submit",      label: "Submit",     icon: IconUpload },
  { href: "/rewards",     label: "Rewards",    icon: IconGift },
  { href: "/leaderboard", label: "Board",      icon: IconTrophy },
] as const;

/* ── Types ───────────────────────────────────────────────────────────────── */

interface MobileHeaderProps {
  userName?: string | null;
}

/* ── MobileHeader ─────────────────────────────────────────────────────────── */

export function MobileHeader({ userName }: MobileHeaderProps) {
  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="ep-header-mobile" role="banner">
      <div className="ep-header-mobile__inner">
        {/* Wordmark */}
        <Link
          href="/dashboard"
          className="ep-wordmark"
          aria-label="EcoPoints home"
          style={{ fontSize: "var(--ep-font-size-sm)" }}
        >
          <span className="ep-wordmark__leaf" aria-hidden="true">
            <IconLeaf size={13} />
          </span>
          <span className="ep-wordmark__name">EcoPoints</span>
        </Link>

        {/* Profile avatar link — quick access on mobile */}
        <Link
          href="/profile"
          className="ep-avatar ep-avatar--lg"
          aria-label={`View profile${userName ? ` for ${userName}` : ""}`}
          style={{ textDecoration: "none" }}
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}

/* ── BottomNav ────────────────────────────────────────────────────────────── */

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="ep-bottom-nav"
      aria-label="Mobile navigation"
      role="navigation"
    >
      <div className="ep-bottom-nav__inner">
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="ep-bottom-nav__item"
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
            >
              <Icon className="ep-bottom-nav__icon" size={22} />
              <span className="ep-bottom-nav__label">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
