import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/tokens.css";
import "@/styles/home.css";

export const metadata: Metadata = {
  title: "EcoPoints — Earn rewards for recycling",
  description:
    "EcoPoints rewards you for recycling. Photograph recyclable items, earn EcoPoints, and redeem them for real rewards while tracking your environmental impact.",
};

/* ── SVG icons ────────────────────────────────────────────────────────────── */

function IconLeaf() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3C17 3 9 3 5 8c-2.5 3.2-2 8 0 10 1 1 3 2 5 1 0 0-1-4 1-7 2 3 1 7 1 7 2 1 4 0 5-1 2-2 2.5-7 0-10" />
      <path d="M3 17c1.5-2 4-4 7-5" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 7a2 2 0 012-2h1l1.5-2h5L13 5h1a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" />
      <circle cx="10" cy="11" r="2.5" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 2l2.2 4.8 5.3.8-3.8 3.7.9 5.2L10 14l-4.6 2.5.9-5.2L2.5 7.6l5.3-.8L10 2z" />
    </svg>
  );
}

function IconGift() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="8" width="16" height="11" rx="1.5" />
      <path d="M2 8h16M10 8V19" />
      <path d="M10 8C10 8 7 8 6.5 5.5S8 2 10 4c2-2 3.5-.5 3.5 2S10 8 10 8z" />
    </svg>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="home-page">

      {/* ── Nav ── */}
      <nav className="home-nav" aria-label="Main navigation">
        <Link href="/" className="home-nav__brand" aria-label="EcoPoints home">
          <span className="home-nav__mark" aria-hidden="true">
            <IconLeaf />
          </span>
          EcoPoints
        </Link>
        <div className="home-nav__links">
          <Link href="/login" className="home-nav__login">Log in</Link>
          <Link href="/signup" className="home-nav__cta">Get started</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="home-hero" aria-label="Hero">
        <div className="home-hero__inner">

          {/* Copy */}
          <div className="home-hero__copy">
            <p className="home-hero__eyebrow">Recycling, rewarded</p>
            <h1 className="home-hero__title">
              Turn recycling into<br />
              <em>something tangible.</em>
            </h1>
            <p className="home-hero__sub">
              Photograph your recyclables, earn EcoPoints with every verified
              submission, and redeem them for real rewards — all while
              tracking your personal environmental impact.
            </p>
            <div className="home-hero__actions">
              <Link href="/signup" className="home-hero__btn-primary">
                Start earning free
              </Link>
              <Link href="/login" className="home-hero__btn-secondary">
                Log in to your account
              </Link>
            </div>
          </div>

          {/* Visual */}
          <div className="home-hero__visual" aria-hidden="true">
            <div className="home-hero__orb">
              <div className="home-hero__orb-ring home-hero__orb-ring--1" />
              <div className="home-hero__orb-ring home-hero__orb-ring--2" />
              <div className="home-hero__orb-ring home-hero__orb-ring--3" />
              <div className="home-hero__orb-center">
                <IconLeaf />
              </div>
              <div className="home-hero__orb-dot home-hero__orb-dot--1">
                <IconCamera />
              </div>
              <div className="home-hero__orb-dot home-hero__orb-dot--2">
                <IconStar />
              </div>
              <div className="home-hero__orb-dot home-hero__orb-dot--3">
                <IconGift />
              </div>
            </div>
          </div>
        </div>

        {/* Decorative shape */}
        <div className="home-hero__deco" aria-hidden="true" />
      </section>

      {/* ── How it works ── */}
      <section className="home-how" aria-labelledby="how-title">
        <div className="home-how__inner">
          <div className="home-how__header">
            <p className="home-how__eyebrow">How it works</p>
            <h2 className="home-how__title" id="how-title">
              Three steps to greener living
            </h2>
          </div>

          <div className="home-steps" role="list">
            <article className="home-step" role="listitem">
              <p className="home-step__num">01</p>
              <div className="home-step__icon"><IconCamera /></div>
              <h3 className="home-step__title">Photograph your recyclable</h3>
              <p className="home-step__body">
                Take a clear photo of the item — a plastic bottle, cardboard
                box, glass jar, or aluminium can. Our AI verifies it
                automatically.
              </p>
            </article>

            <article className="home-step" role="listitem">
              <p className="home-step__num">02</p>
              <div className="home-step__icon"><IconStar /></div>
              <h3 className="home-step__title">Earn EcoPoints</h3>
              <p className="home-step__body">
                Every verified submission adds EcoPoints to your balance.
                Track your impact over time and climb the community
                leaderboard.
              </p>
            </article>

            <article className="home-step" role="listitem">
              <p className="home-step__num">03</p>
              <div className="home-step__icon"><IconGift /></div>
              <h3 className="home-step__title">Redeem real rewards</h3>
              <p className="home-step__body">
                Spend your EcoPoints in the rewards store. Real value for
                real recycling effort — no gimmicks.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="home-cta" aria-labelledby="cta-title">
        <div className="home-cta__inner">
          <h2 className="home-cta__title" id="cta-title">
            Ready to start recycling smarter?
          </h2>
          <p className="home-cta__sub">
            Join EcoPoints for free. No credit card needed.
          </p>
          <div className="home-cta__actions">
            <Link href="/signup" className="home-cta__btn-primary">
              Create a free account
            </Link>
            <Link href="/login" className="home-cta__btn-ghost">
              Already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="home-footer">
        <p className="home-footer__copy">
          © {new Date().getFullYear()} EcoPoints. All rights reserved.
        </p>
        <nav className="home-footer__links" aria-label="Footer links">
          <Link href="/login">Log in</Link>
          <Link href="/signup">Sign up</Link>
        </nav>
      </footer>
    </div>
  );
}
