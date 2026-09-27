"use client";

/**
 * EcoPoints — Login page
 *
 * Uses Supabase Auth email + password sign-in.
 * On success: router.push("/dashboard") + router.refresh()
 * On error:   inline alert with Supabase error message.
 *
 * Layout lives in app/(auth)/layout.tsx (auth shell — no app nav).
 * All UI via existing design system components.
 */

import { useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input, InputWrapper } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

import "@/styles/auth.css";

/* ── Inline eye icon SVG ────────────────────────────────────────────────── */

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    /* Eye open */
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 10s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  ) : (
    /* Eye closed */
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.45 13.45A8.16 8.16 0 0 1 10 14c-5.4 0-9-4-9-4a14.7 14.7 0 0 1 3.55-3.45M6.1 6.1A8.16 8.16 0 0 1 10 5c5.4 0 9 5 9 5a14.7 14.7 0 0 1-2.32 2.68M2 2l16 16" />
    </svg>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function LoginPage() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Field-level validation errors */
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  /* ── Validation ─────────────────────────────────────────────────────── */

  function validate(): boolean {
    let valid = true;

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
    } else {
      setPasswordError(undefined);
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
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        // Map common Supabase errors to user-friendly messages
        if (
          authError.message.toLowerCase().includes("invalid login") ||
          authError.message.toLowerCase().includes("invalid credentials")
        ) {
          setError("Incorrect email or password. Please try again.");
        } else if (authError.message.toLowerCase().includes("email not confirmed")) {
          setError("Please check your inbox and confirm your email before logging in.");
        } else {
          setError(authError.message);
        }
        return;
      }

      // Success — refresh server state, then navigate
      router.refresh();
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <>
      {/* Card header */}
      <div className="auth-header">
        <p className="auth-header__eyebrow">Welcome back</p>
        <h1 className="auth-header__title">Log in to EcoPoints</h1>
        <p className="auth-header__lead">
          Track your recycling impact and earn rewards.
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
            aria-describedby={emailError ? `${emailId}-error` : undefined}
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
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(undefined);
              }}
              status={passwordError ? "error" : "default"}
              disabled={isLoading}
              className="auth-pw-input"
              aria-describedby={passwordError ? `${passwordId}-error` : undefined}
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
          {isLoading ? "Logging in…" : "Log in"}
        </Button>
      </form>

      {/* Footer */}
      <div className="auth-footer">
        Don&rsquo;t have an account?{" "}
        <Link href="/signup">Create one free</Link>
      </div>
    </>
  );
}
