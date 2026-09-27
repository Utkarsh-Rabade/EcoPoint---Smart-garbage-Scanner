"use client";

/**
 * EcoPoints — Signup page
 *
 * Uses Supabase Auth signUp with email + password.
 * Full name is stored in user_metadata.full_name — the ShellProvider
 * and any profile sync already reads from there.
 *
 * Supabase confirmation behavior:
 *   - If email confirmation is enabled (typical in production):
 *     user gets a confirmation email; we show a success state.
 *   - If auto-confirm is on (dev/local):
 *     session is returned immediately; we redirect to /dashboard.
 *
 * Layout lives in app/(auth)/layout.tsx (auth shell — no app nav).
 */

import { useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input, InputWrapper } from "@/components/ui/Input";
import { Alert, Callout } from "@/components/ui/Alert";

import "@/styles/auth.css";

/* ── Eye icon ────────────────────────────────────────────────────────────── */

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 10s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.45 13.45A8.16 8.16 0 0 1 10 14c-5.4 0-9-4-9-4a14.7 14.7 0 0 1 3.55-3.45M6.1 6.1A8.16 8.16 0 0 1 10 5c5.4 0 9 5 9 5a14.7 14.7 0 0 1-2.32 2.68M2 2l16 16" />
    </svg>
  );
}

/* ── Password strength ───────────────────────────────────────────────────── */

type StrengthLevel = "none" | "weak" | "fair" | "good" | "strong";

function getPasswordStrength(pw: string): StrengthLevel {
  if (!pw) return "none";
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return "weak";
  if (score === 2) return "fair";
  if (score === 3) return "good";
  return "strong";
}

const strengthMeta: Record<StrengthLevel, { label: string; bars: number; barClass: string }> = {
  none:   { label: "",         bars: 0, barClass: "" },
  weak:   { label: "Weak",     bars: 1, barClass: "auth-pw-strength__bar--weak" },
  fair:   { label: "Fair",     bars: 2, barClass: "auth-pw-strength__bar--fair" },
  good:   { label: "Good",     bars: 3, barClass: "auth-pw-strength__bar--good" },
  strong: { label: "Strong",   bars: 4, barClass: "auth-pw-strength__bar--good" },
};

function PasswordStrengthMeter({ password }: { password: string }) {
  const level = getPasswordStrength(password);
  if (level === "none") return null;
  const { label, bars, barClass } = strengthMeta[level];

  return (
    <div aria-label={`Password strength: ${label}`}>
      <div className="auth-pw-strength" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`auth-pw-strength__bar${i < bars ? ` ${barClass}` : ""}`}
          />
        ))}
      </div>
      <p className="auth-pw-strength__label">{label}</p>
    </div>
  );
}

/* ── Success state ───────────────────────────────────────────────────────── */

function ConfirmationSent({ email }: { email: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: "3rem",
          height: "3rem",
          borderRadius: "50%",
          background: "var(--ep-color-success-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto var(--ep-space-5)",
        }}
        aria-hidden="true"
      >
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="var(--ep-color-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8l7 5 7-5" />
          <rect x="2" y="5" width="16" height="12" rx="2" />
        </svg>
      </div>

      <h1
        style={{
          fontSize: "var(--ep-font-size-xl)",
          fontWeight: "var(--ep-font-weight-semibold)",
          color: "var(--ep-color-text-primary)",
          marginBottom: "var(--ep-space-3)",
        }}
      >
        Check your inbox
      </h1>

      <p
        style={{
          fontSize: "var(--ep-font-size-sm)",
          color: "var(--ep-color-text-secondary)",
          lineHeight: "var(--ep-leading-relaxed)",
          marginBottom: "var(--ep-space-5)",
        }}
      >
        We&rsquo;ve sent a confirmation link to{" "}
        <strong style={{ color: "var(--ep-color-text-primary)" }}>{email}</strong>.
        Open it to activate your account.
      </p>

      <Callout>
        Didn&rsquo;t receive it? Check your spam folder or{" "}
        <Link href="/signup" style={{ color: "var(--ep-color-brand)", fontWeight: "var(--ep-font-weight-medium)" }}>
          try again
        </Link>
        .
      </Callout>

      <div className="auth-footer">
        Already confirmed?{" "}
        <Link href="/login">Log in</Link>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

export default function SignupPage() {
  const router = useRouter();

  const nameId     = useId();
  const emailId    = useId();
  const passwordId = useId();
  const confirmId  = useId();

  const [fullName, setFullName]         = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [confirmPassword, setConfirm]   = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);

  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [confirmed, setConfirmed]       = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  /* Field errors */
  const [nameError,     setNameError]     = useState<string | undefined>();
  const [emailError,    setEmailError]    = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError,  setConfirmError]  = useState<string | undefined>();

  /* ── Validation ─────────────────────────────────────────────────────── */

  function validate(): boolean {
    let valid = true;

    if (!fullName.trim()) {
      setNameError("Full name is required.");
      valid = false;
    } else if (fullName.trim().length < 2) {
      setNameError("Name must be at least 2 characters.");
      valid = false;
    } else {
      setNameError(undefined);
    }

    if (!email.trim()) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
      valid = false;
    } else {
      setEmailError(undefined);
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      valid = false;
    } else {
      setPasswordError(undefined);
    }

    if (!confirmPassword) {
      setConfirmError("Please confirm your password.");
      valid = false;
    } else if (confirmPassword !== password) {
      setConfirmError("Passwords don't match.");
      valid = false;
    } else {
      setConfirmError(undefined);
    }

    return valid;
  }

  /* ── Submit ─────────────────────────────────────────────────────────── */

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
          },
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered")) {
          setError(
            "An account with this email already exists. Try logging in instead."
          );
        } else {
          setError(authError.message);
        }
        return;
      }

      /* Supabase signUp behavior:
       *   - Email confirmation enabled: session is null, user.confirmed_at is null
       *     → show "check your inbox" state
       *   - Auto-confirm enabled (dev): session is returned immediately
       *     → redirect to dashboard
       */
      if (data.session) {
        // Auto-confirmed — go straight to the app
        router.refresh();
        router.push("/dashboard");
      } else {
        // Confirmation email sent
        setSubmittedEmail(email.trim());
        setConfirmed(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  /* ── Confirmed state ─────────────────────────────────────────────────── */

  if (confirmed) {
    return <ConfirmationSent email={submittedEmail} />;
  }

  /* ── Form ────────────────────────────────────────────────────────────── */

  return (
    <>
      {/* Card header */}
      <div className="auth-header">
        <p className="auth-header__eyebrow">Get started</p>
        <h1 className="auth-header__title">Create your account</h1>
        <p className="auth-header__lead">
          Join EcoPoints and start earning rewards for recycling.
        </p>
      </div>

      {/* Top-level error */}
      {error && (
        <Alert
          variant="error"
          className="auth-alert"
          onDismiss={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {/* Full name */}
        <Field
          label="Full name"
          htmlFor={nameId}
          error={nameError}
          required
        >
          <Input
            id={nameId}
            type="text"
            autoComplete="name"
            placeholder="Alex Johnson"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (nameError) setNameError(undefined);
            }}
            status={nameError ? "error" : "default"}
            disabled={isLoading}
          />
        </Field>

        {/* Email */}
        <Field
          label="Email"
          htmlFor={emailId}
          error={emailError}
          required
        >
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(undefined);
            }}
            status={emailError ? "error" : "default"}
            disabled={isLoading}
          />
        </Field>

        {/* Password */}
        <Field
          label="Password"
          htmlFor={passwordId}
          error={passwordError}
          required
        >
          <InputWrapper
            suffix={
              <button
                type="button"
                className="auth-pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={0}
              >
                <EyeIcon open={showPassword} />
              </button>
            }
          >
            <Input
              id={passwordId}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(undefined);
              }}
              status={passwordError ? "error" : "default"}
              disabled={isLoading}
              className="auth-pw-input"
            />
          </InputWrapper>
          {/* Strength meter — shown once user starts typing */}
          {password.length > 0 && (
            <PasswordStrengthMeter password={password} />
          )}
        </Field>

        {/* Confirm password */}
        <Field
          label="Confirm password"
          htmlFor={confirmId}
          error={confirmError}
          required
        >
          <InputWrapper
            suffix={
              <button
                type="button"
                className="auth-pw-toggle"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
                tabIndex={0}
              >
                <EyeIcon open={showConfirm} />
              </button>
            }
          >
            <Input
              id={confirmId}
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (confirmError) setConfirmError(undefined);
              }}
              status={confirmError ? "error" : "default"}
              disabled={isLoading}
              className="auth-pw-input"
            />
          </InputWrapper>
        </Field>

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className="auth-submit"
        >
          {isLoading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      {/* Footer */}
      <div className="auth-footer">
        Already have an account?{" "}
        <Link href="/login">Log in</Link>
      </div>
    </>
  );
}
