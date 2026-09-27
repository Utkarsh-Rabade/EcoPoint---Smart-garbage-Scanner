/**
 * Auth shell layout — /login and /signup.
 *
 * Deliberately isolated from the authenticated app shell:
 *   - No nav, no header with links, no bottom bar
 *   - Wordmark-only top header for brand continuity
 *   - Centered card on an off-white background
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
      {/* Minimal header — wordmark only */}
      <header className="ep-auth-header">
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--ep-space-2)",
            textDecoration: "none",
            color: "var(--ep-color-text-primary)",
            fontWeight: "var(--ep-font-weight-semibold)",
            fontSize: "var(--ep-font-size-md)",
          }}
          aria-label="EcoPoints home"
        >
          {/* Leaf mark */}
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "1.625rem",
              height: "1.625rem",
              background: "var(--ep-color-brand)",
              borderRadius: "var(--ep-radius-sm)",
              color: "var(--ep-color-brand-text-on)",
            }}
            aria-hidden="true"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 3C17 3 9 3 5 8c-2.5 3.2-2 8 0 10 1 1 3 2 5 1 0 0-1-4 1-7 2 3 1 7 1 7 2 1 4 0 5-1 2-2 2.5-7 0-10" />
              <path d="M3 17c1.5-2 4-4 7-5" />
            </svg>
          </span>
          EcoPoints
        </Link>
      </header>

      {/* Centered content area */}
      <div className="ep-auth-body">
        <div className="ep-auth-card">
          {children}
        </div>
      </div>
    </div>
  );
}
