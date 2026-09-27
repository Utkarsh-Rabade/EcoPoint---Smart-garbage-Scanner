"use client";

/**
 * EcoPoints — Desktop application header
 *
 * Sticky top bar shown on ≥768px screens.
 * Contains: wordmark, primary nav links, Submit CTA, user menu.
 *
 * Active route highlighting is handled by comparing pathname to each link's
 * href using usePathname() from next/navigation.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import "@/styles/shell.css";

import {
  IconChevronDown,
  IconGrid,
  IconGift,
  IconHistory,
  IconLeaf,
  IconLogOut,
  IconSettings,
  IconTrophy,
  IconUpload,
  IconUser,
} from "@/components/ui/Icons";

/* ── Nav link definitions ────────────────────────────────────────────────── */

const NAV_LINKS = [
  { href: "/dashboard",   label: "Dashboard",   icon: IconGrid },
  { href: "/history",     label: "History",     icon: IconHistory },
  { href: "/rewards",     label: "Rewards",     icon: IconGift },
  { href: "/leaderboard", label: "Leaderboard", icon: IconTrophy },
] as const;

/* ── Types ───────────────────────────────────────────────────────────────── */

interface AppHeaderProps {
  /** User's display name — shown in the avatar/menu */
  userName?: string | null;
  /** User's email — shown as dropdown sub-label */
  userEmail?: string | null;
  /** Called when "Sign out" is clicked */
  onSignOut?: () => void;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function AppHeader({ userName, userEmail, onSignOut }: AppHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Derive initials for avatar */
  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  /* Close on outside click */
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen, handleOutsideClick]);

  /* Close on route change */
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  /* Escape key */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="ep-header" role="banner">
      <div className="ep-header__inner">

        {/* ── Wordmark ──────────────────────────────────────────────────── */}
        <Link href="/dashboard" className="ep-wordmark" aria-label="EcoPoints home">
          <span className="ep-wordmark__leaf" aria-hidden="true">
            <IconLeaf size={14} />
          </span>
          <span className="ep-wordmark__name">EcoPoints</span>
        </Link>

        {/* ── Primary nav ────────────────────────────────────────────────── */}
        <nav className="ep-nav" aria-label="Primary navigation">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="ep-nav__link"
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="ep-nav__icon" size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* ── Right cluster ──────────────────────────────────────────────── */}
        <div className="ep-header__right">

          {/* Submit CTA */}
          <Link
            href="/submit"
            className={[
              "ep-btn ep-btn--outline ep-btn--sm",
              (pathname === "/submit" || pathname.startsWith("/submit/")) &&
                "ep-btn--primary",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={pathname === "/submit" ? "page" : undefined}
          >
            <IconUpload size={14} />
            Submit
          </Link>

          {/* User menu */}
          <div className="ep-user-menu-wrapper" ref={menuRef}>
            <button
              type="button"
              className="ep-user-menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="User menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="ep-avatar" aria-hidden="true">
                {initials}
              </span>
              {userName && (
                <span style={{ maxWidth: "9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {userName.split(" ")[0]}
                </span>
              )}
              <IconChevronDown className="ep-user-menu__chevron" size={16} />
            </button>

            {/* Dropdown */}
            <div
              role="menu"
              aria-label="User menu"
              className={`ep-dropdown${menuOpen ? " ep-dropdown--open" : ""}`}
            >
              {/* User identity label */}
              {(userName || userEmail) && (
                <>
                  <div className="ep-dropdown__label" role="none">
                    <div style={{ fontWeight: "var(--ep-font-weight-semibold)", color: "var(--ep-color-text-primary)", textTransform: "none", letterSpacing: 0, fontSize: "var(--ep-font-size-sm)" }}>
                      {userName ?? ""}
                    </div>
                    {userEmail && (
                      <div style={{ color: "var(--ep-color-text-tertiary)", fontSize: "var(--ep-font-size-xs)", fontWeight: "normal", textTransform: "none", letterSpacing: 0, marginTop: "2px" }}>
                        {userEmail}
                      </div>
                    )}
                  </div>
                  <div className="ep-dropdown__divider" role="separator" />
                </>
              )}

              <Link href="/profile" role="menuitem" className="ep-dropdown__item">
                <IconUser size={15} />
                Profile
              </Link>

              <Link href="/profile?tab=settings" role="menuitem" className="ep-dropdown__item">
                <IconSettings size={15} />
                Settings
              </Link>

              <div className="ep-dropdown__divider" role="separator" />

              <button
                type="button"
                role="menuitem"
                className="ep-dropdown__item ep-dropdown__item--danger"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut?.();
                }}
              >
                <IconLogOut size={15} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
