/**
 * Auth shell layout — /login and /signup.
 *
 * Redesigned: editorial split layout.
 *   Left  = brand/story panel (brand green, CSS pattern, wordmark)
 *   Right = form panel (white, scrollable on short viewports)
 *
 * All auth logic lives in the page files — this is pure layout.
 */

import Link from "next/link";
import type { Metadata } from "next";
import "@/styles/shell.css";
import "@/styles/tokens.css";

export const metadata: Metadata = {
  title: { template: "%s — EcoPoints", default: "EcoPoints" },
  description: "Log in or create your EcoPoints account.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div id="ep-auth-shell">
      {/* ── Split layout ── */}
      <div className="ep-auth-split">

        {/* Left — brand panel */}
        <aside className="ep-auth-brand" aria-hidden="true">
          {/* Brand panel texture overlay (pure CSS, no images) */}
          <div className="ep-auth-brand__texture" />

          {/* Wordmark */}
          <Link
            href="/"
            className="ep-auth-brand__wordmark"
            aria-label="EcoPoints home"
            aria-hidden="false"
          >
            <span className="ep-auth-brand__mark">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 3C17 3 9 3 5 8c-2.5 3.2-2 8 0 10 1 1 3 2 5 1 0 0-1-4 1-7 2 3 1 7 1 7 2 1 4 0 5-1 2-2 2.5-7 0-10" />
                <path d="M3 17c1.5-2 4-4 7-5" />
              </svg>
            </span>
            EcoPoints
          </Link>

          {/* Editorial brand copy */}
          <div className="ep-auth-brand__body">
            <p className="ep-auth-brand__eyebrow">Recycling, rewarded</p>
            <h2 className="ep-auth-brand__heading">
              Every item recycled<br />counts for something.
            </h2>
            <p className="ep-auth-brand__sub">
              Photograph your recyclables, earn EcoPoints, and redeem them
              for real rewards — all while tracking your environmental impact.
            </p>
          </div>

          {/* Decorative leaf marks — CSS shapes */}
          <div className="ep-auth-brand__deco" aria-hidden="true">
            <div className="ep-auth-brand__deco-leaf ep-auth-brand__deco-leaf--1" />
            <div className="ep-auth-brand__deco-leaf ep-auth-brand__deco-leaf--2" />
            <div className="ep-auth-brand__deco-ring" />
          </div>
        </aside>

        {/* Right — form panel */}
        <main className="ep-auth-form-panel">
          <div className="ep-auth-form-inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
