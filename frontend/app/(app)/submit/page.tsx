"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import "@/styles/shell.css";
import "@/styles/submit.css";
import "@/styles/button.css";
import "@/styles/status.css";
import { createClient } from "@/lib/supabase/client";

/* ── Types ────────────────────────────────────────────────────────────────── */

type PagePhase = "idle" | "uploading" | "success" | "error";

interface SubmissionResult {
  id: string;
  status: string;
  submitted_at: string;
  points_awarded: number;
  verification_result?: Record<string, unknown> | null;
}

interface FileState {
  file: File;
  preview: string;
  validationError: string | null;
}

interface LocationState {
  latitude: string;
  longitude: string;
  accuracy: string;
}

/* ── Constants ────────────────────────────────────────────────────────────── */

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_TOKEN: "Your session has expired. Please log out and log back in.",
  AUTH_MISSING_TOKEN: "You must be logged in to submit a recycling photo.",
  MISSING_IMAGE: "Please select an image before submitting.",
  INVALID_FILE_TYPE: "Only JPEG, PNG, and WebP images are accepted.",
  FILE_TOO_LARGE: "Your image is too large. Maximum file size is 5 MB.",
  INVALID_MULTIPART: "There was a problem preparing your submission. Please try again.",
  STORAGE_UPLOAD_FAILED: "We couldn't upload your image. Please check your connection and try again.",
  DATABASE_INSERT_FAILED: "Your image uploaded but the submission record couldn't be saved. Please try again.",
  INTERNAL_ERROR: "Something went wrong on our end. Please try again shortly.",
  DUPLICATE_IMAGE: "You've already submitted this exact photo. Please photograph a different recyclable item.",
};


function humanError(code?: string, fallback?: string): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return fallback ?? "An unexpected error occurred. Please try again.";
}

/* ── File validation ──────────────────────────────────────────────────────── */

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `${file.type || "Unknown"} files aren't accepted. Please use a JPEG, PNG, or WebP image.`;
  }
  if (file.size > MAX_BYTES) {
    return `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum allowed size is 5 MB.`;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Step indicator ───────────────────────────────────────────────────────── */

type StepStatus = "done" | "active" | "idle";

function Step({ num, label, status }: { num: number; label: string; status: StepStatus }) {
  return (
    <div className={`sub-step sub-step--${status}`}>
      <div className="sub-step__num" aria-hidden="true">
        {status === "done" ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : num}
      </div>
      <span>{label}</span>
    </div>
  );
}

/* ── Drop-zone / upload area ──────────────────────────────────────────────── */

interface DropzoneProps {
  fileState: FileState | null;
  onFile: (f: File) => void;
  onReplace: () => void;
  disabled: boolean;
}

function Dropzone({ fileState, onFile, onReplace, disabled }: DropzoneProps) {
  // Desktop: generic file picker
  const inputRef = useRef<HTMLInputElement>(null);
  // Mobile camera: capture="environment" opens rear camera directly
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Mobile gallery: no capture attribute so user picks from library
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Snapshot the File before the input value is reset
    const file = files[0];
    onFile(file);
  }, [onFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // After a mobile input is used, reset it so the same file can be re-selected
  const resetInput = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current) ref.current.value = "";
  };

  if (fileState?.file) {
    return (
      <div className="sub-dropzone sub-dropzone--has-image" aria-label="Selected image preview">
        <div className="sub-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileState.preview}
            alt="Preview of selected recycling item"
            className="sub-preview__img"
          />
          <div className="sub-preview__toolbar">
            <button
              type="button"
              className="sub-preview__replace"
              onClick={onReplace}
              disabled={disabled}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M10 2L2 10M2 2l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Replace
            </button>
          </div>
          <div className="sub-preview__name">
            <span>{fileState.file.name}</span>
            <span>{formatBytes(fileState.file.size)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Desktop dropzone (hidden on mobile) ─────────────────────────── */}
      <div
        className={`sub-dropzone sub-dropzone--desktop${isDragging ? " sub-dropzone--active" : ""}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload area — click or drag an image here"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sub-dropzone__hidden-input"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          // Programmatic .click() bubbles to the dropzone; stop it re-opening the picker
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { handleFiles(e.target.files); resetInput(inputRef); }}
        />

        <div className="sub-dropzone__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 14V4M11 4L8 7M11 4l3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v1.5A1.5 1.5 0 005.5 19h11a1.5 1.5 0 001.5-1.5V16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </div>

        <div>
          <p className="sub-dropzone__title">Drop your photo here</p>
          <p className="sub-dropzone__hint">
            or <span style={{ color: "var(--ep-color-brand)", fontWeight: 500 }}>click to browse</span>
          </p>
        </div>

        <p className="sub-dropzone__types">JPEG · PNG · WebP · max 5 MB</p>
      </div>

      {/* ── Mobile camera / gallery picker (hidden on desktop) ──────────── */}
      <div className="sub-mobile-upload" aria-label="Add a photo">
        {/* Hidden inputs — triggered by the visible buttons below */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sub-dropzone__hidden-input"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          onChange={(e) => { handleFiles(e.target.files); resetInput(cameraInputRef); }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sub-dropzone__hidden-input"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          onChange={(e) => { handleFiles(e.target.files); resetInput(galleryInputRef); }}
        />

        {/* Primary action — opens rear camera */}
        <button
          id="btn-take-photo"
          type="button"
          className="sub-mobile-btn sub-mobile-btn--primary"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
          aria-label="Take a photo with your camera"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M8 4H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="8" y="2" width="6" height="3" rx="1" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="11" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Take photo
        </button>

        {/* Secondary action — opens gallery/file picker */}
        <button
          id="btn-choose-gallery"
          type="button"
          className="sub-mobile-btn sub-mobile-btn--secondary"
          disabled={disabled}
          onClick={() => galleryInputRef.current?.click()}
          aria-label="Choose a photo from your gallery"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="8" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M3 15l4-4 3 3 2-2 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Choose from gallery
        </button>

        <p className="sub-mobile-upload__hint">JPEG · PNG · WebP · max 5 MB</p>
      </div>

      {fileState?.validationError && (
        <p className="sub-file-error" role="alert">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.25" />
            <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {fileState.validationError}
        </p>
      )}
    </>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function SubmitPage() {
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [location, setLocation] = useState<LocationState>({ latitude: "", longitude: "", accuracy: "" });
  const [locationOpen, setLocationOpen] = useState(false);
  const [phase, setPhase] = useState<PagePhase>("idle");
  const [progress, setProgress] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [actionType, setActionType] = useState<string>("auto");
  const fileInputResetRef = useRef<HTMLInputElement>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [pollingTimeout, setPollingTimeout] = useState<NodeJS.Timeout | null>(null);
  // Ref to always have the latest status in timeout/interval closures
  const latestStatusRef = useRef<string | null>(null);

  const isUploading = phase === "uploading";
  const hasValidFile = !!fileState?.file && !fileState.validationError;

  function handleFile(file: File) {
    const err = validateFile(file);
    const preview = err ? (fileState?.preview ?? "") : URL.createObjectURL(file);
    if (fileState?.preview && fileState.preview !== preview) {
      URL.revokeObjectURL(fileState.preview);
    }
    setFileState({ file, preview, validationError: err });
    setSubmitError(null);
  }

  function handleReplace() {
    if (fileState?.preview) URL.revokeObjectURL(fileState.preview);
    setFileState(null);
    setSubmitError(null);
  }

  function updateLocation(key: keyof LocationState, value: string) {
    setLocation((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasValidFile || isUploading) return;

    setPhase("uploading");
    setSubmitError(null);
    setProgress(10);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated. Please log in again.");

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");

      // Build multipart form
      const form = new FormData();
      form.append("image", fileState!.file);
      if (location.latitude.trim()) form.append("latitude", location.latitude.trim());
      if (location.longitude.trim()) form.append("longitude", location.longitude.trim());
      if (location.accuracy.trim()) form.append("accuracy", location.accuracy.trim());
      // Pass action type hint to the edge function
      form.append("action_type", actionType);

      setProgress(30);

      const res = await fetch(`${supabaseUrl}/functions/v1/submissions`, {
        method: "POST",
        headers: {
          // No Content-Type — browser sets it with boundary for multipart
          Authorization: `Bearer ${session.access_token}`,
        },
        body: form,
      });

      setProgress(80);

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code = (json as { error?: { code?: string; message?: string } }).error?.code;
        const msg = (json as { error?: { code?: string; message?: string } }).error?.message;
        throw new Error(humanError(code, msg));
      }

      setProgress(100);
      const data = json as SubmissionResult;
      latestStatusRef.current = data.status;
      setResult(data);
      // Switch to success phase so the result view renders while we poll
      setPhase("success");
      // Trigger verification and start polling for status updates
      triggerAndPollVerification(data.id, session.access_token, supabaseUrl);
    } catch (err) {
      setPhase("error");
      setProgress(0);
      setSubmitError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    }
  }

  function handleReset() {
    if (fileState?.preview) URL.revokeObjectURL(fileState.preview);
    setFileState(null);
    setLocation({ latitude: "", longitude: "", accuracy: "" });
    setActionType("auto");
    setPhase("idle");
    setProgress(0);
    setSubmitError(null);
    setResult(null);
    // Clear polling interval and timeout
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    if (pollingTimeout) {
      clearTimeout(pollingTimeout);
      setPollingTimeout(null);
    }
  }

  // Trigger verification and start polling for status updates
  async function triggerAndPollVerification(
    submissionId: string,
    accessToken: string,
    supabaseUrl: string
  ) {
    // Trigger verification (fire and forget)
    try {
      const verifyUrl = `${supabaseUrl}/functions/v1/gemini-verify`;
      await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ submission_id: submissionId }),
      });
      // We don't await the result here - we'll get it via polling
    } catch (err) {
      console.error("Failed to trigger verification:", err);
      // Continue with polling anyway - the verification might still happen
    }

    // Set up polling interval (every 2 seconds)
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/submissions/${submissionId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          console.error(`Failed to fetch submission ${submissionId}:`, res.status);
          return; // Continue polling
        }

        const json = await res.json();
        // GET endpoint wraps data in { submission: { ... } }
        const submissionData: SubmissionResult = json.submission ?? json;
        latestStatusRef.current = submissionData.status;
        // Update the result with the latest data
        setResult(submissionData);

        // If status is no longer pending, stop polling
        if (submissionData.status !== "pending") {
          stopPolling();
        }
      } catch (err) {
        console.error("Error polling submission status:", err);
        // Continue polling
      }
    }, 2000);

    setPollingInterval(intervalId);

    // Set timeout to stop polling after 30 seconds
    const timeoutId = setTimeout(() => {
      stopPolling();
      // Use ref to get the latest status (avoids stale closure)
      if (latestStatusRef.current === "pending" || latestStatusRef.current === null) {
        setSubmitError("Verification timed out. Please try again.");
        setPhase("error");
      }
    }, 30000);

    setPollingTimeout(timeoutId);
  }

  // Stop polling interval and timeout
  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    if (pollingTimeout) {
      clearTimeout(pollingTimeout);
      setPollingTimeout(null);
    }
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  /* ── Step state ──────────────────────────────────────────────────────────── */
  const step1: StepStatus = hasValidFile ? "done" : "idle";
  const step2: StepStatus = !!result ? "done" : isUploading ? "active" : hasValidFile ? "active" : "idle";
  const step3: StepStatus = !!result && result.status !== "pending" ? "done" : !!result ? "active" : "idle";

  /* ── Success view ────────────────────────────────────────────────────────── */
  if (phase === "success" && result) {
    // Determine what to show based on status
    const isPending = result.status === "pending";
    const isApproved = result.status === "approved";
    const isReview = result.status === "review";
    const isRejected = result.status === "rejected";

    return (
      <main className="ep-page sub-page" id="submit-main">
        <header className="sub-header">
          {isPending ? (
            <p className="sub-header__eyebrow">Verification in progress</p>
          ) : isApproved ? (
            <p className="sub-header__eyebrow">Verification complete</p>
          ) : isReview ? (
            <p className="sub-header__eyebrow">Under review</p>
          ) : (
            <p className="sub-header__eyebrow">Verification failed</p>
          )}
          <h1 className="sub-header__title">
            {isPending ? "Verifying your submission" : isApproved ? "You&apos;re making a difference" : isReview ? "Your submission is under review" : "Verification failed"}
          </h1>
        </header>

        <div className="sub-success">
          <div className="sub-success__top">
            <div className="sub-success__icon" aria-hidden="true">
              {isPending ? (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="2" />
                </svg>
              ) : isApproved ? (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M6 14l5.5 5.5L22 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : isReview ? (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M8 8l12 12M8 20l12-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M8 8l12 12M12 8l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <h2 className="sub-success__title">
              {isPending ? "Verification in progress" : isApproved ? "Submission received" : isReview ? "Submission under review" : "Verification failed"}
            </h2>
            <p className="sub-success__sub">
              {isPending
                ? "Our AI verification system is analysing your photo. This may take a moment."
                : isApproved
                ? "Your photo has been verified and EcoPoints have been awarded to your account."
                : isReview
                ? "Your photo requires manual review. You will be notified once the review is complete."
                : "We could not verify your photo. Please try again with a different image."
              }
            </p>
          </div>

          <div className="sub-success__body">

            {/* ── Submission metadata ────────────────────────────────────────── */}
            <div className="sub-success__row">
              <span className="sub-success__key">Submission ID</span>
              <span className="sub-success__val" style={{ fontFamily: "var(--ep-font-mono)", fontSize: "0.75rem" }}>
                {result.id.split("-")[0]}…
              </span>
            </div>
            <div className="sub-success__row">
              <span className="sub-success__key">Status</span>
              <span
                className={`ep-status-pill ${isPending ? "ep-status-pill--pending" : ""} ${isApproved ? "ep-status-pill--approved" : ""} ${isReview ? "ep-status-pill--review" : ""} ${isRejected ? "ep-status-pill--rejected" : ""}`}
                style={{ fontSize: "0.7rem" }}
              >
                {isPending ? "Pending review" : isApproved ? "Approved" : isReview ? "Under review" : "Rejected"}
              </span>
            </div>
            <div className="sub-success__row">
              <span className="sub-success__key">Submitted</span>
              <span className="sub-success__val">{formatDate(result.submitted_at)}</span>
            </div>
            {!isPending && (
              <div className="sub-success__row">
                <span className="sub-success__key">Points awarded</span>
                <span className="sub-success__val" style={{ color: isApproved ? "var(--ep-color-brand)" : "var(--ep-color-text-tertiary)" }}>
                  {isApproved ? `+${result.points_awarded} EcoPoints` : isRejected ? "0 EcoPoints" : "Awaiting review"}
                </span>
              </div>
            )}

            {/* ── Why this result? ───────────────────────────────────────────── */}
            {!isPending && (() => {
              const vr = result.verification_result as Record<string, unknown> | null | undefined;
              const reason           = typeof vr?.reason            === "string"  ? vr.reason            : null;
              const actionTypeVal    = typeof vr?.action_type       === "string"  ? vr.action_type       : null;
              const evidence         = typeof vr?.evidence          === "string"  ? vr.evidence          : null;
              const itemType         = typeof vr?.item_type         === "string"  ? vr.item_type         : null;
              const material         = typeof vr?.material          === "string"  ? vr.material          : null;
              const confidence       = typeof vr?.confidence        === "number"  ? vr.confidence        : null;
              const isAiGenerated    = typeof vr?.is_ai_generated   === "boolean" ? vr.is_ai_generated   : false;
              const contaminated     = typeof vr?.contamination_detected === "boolean" ? vr.contamination_detected : false;

              const confPct = confidence !== null ? `${Math.round(confidence * 100)}%` : null;

              // Human-readable action label
              const ACTION_LABELS: Record<string, string> = {
                recycling: "Recycling", tree_planting: "Tree planting",
                waste_segregation: "Waste segregation", litter_cleanup: "Litter cleanup",
                composting: "Composting", unknown: "Unknown",
              };
              const actionLabel = actionTypeVal ? (ACTION_LABELS[actionTypeVal] ?? actionTypeVal) : null;

              const reasonTone = isApproved
                ? "sub-verdict--approved"
                : isReview
                ? "sub-verdict--review"
                : "sub-verdict--rejected";

              const ReasonIcon = isApproved
                ? () => (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )
                : isReview
                ? () => (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )
                : () => (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  );

              const fallbackReason = isAiGenerated
                ? "This image was identified as AI-generated or digitally created. Only real photographs are accepted."
                : isApproved
                ? "Your environmental action was verified and EcoPoints have been awarded."
                : isReview
                ? "Your submission has been sent for manual review. You will be notified once it is assessed."
                : "This submission could not be verified. Please try again with a clear, well-lit photo of the action.";

              return (
                <div className="sub-verdict" aria-label="Verification explanation">
                  <div className={`sub-verdict__header ${reasonTone}`}>
                    <ReasonIcon />
                    <span className="sub-verdict__heading">Why this result?</span>
                  </div>

                  <p className="sub-verdict__reason">
                    {reason || fallbackReason}
                  </p>

                  {/* Evidence paragraph */}
                  {evidence && evidence.length > 0 && (
                    <p className="sub-verdict__evidence">
                      <strong>Evidence:</strong> {evidence}
                    </p>
                  )}

                  {/* Detection chips */}
                  {(actionLabel && actionTypeVal !== "unknown") || (itemType && itemType !== "none") || (material && material !== "unknown") || confPct ? (
                    <div className="sub-verdict__chips" aria-label="Detection details">
                      {actionLabel && actionTypeVal !== "unknown" && (
                        <span className="sub-verdict__chip sub-verdict__chip--action">
                          {actionLabel}
                        </span>
                      )}
                      {itemType && itemType !== "none" && itemType !== "" && (
                        <span className="sub-verdict__chip">
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                            <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                            <path d="M3.5 5.5l1.5 1.5 2.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {itemType}
                        </span>
                      )}
                      {material && material !== "unknown" && material !== "" && (
                        <span className="sub-verdict__chip">
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                            <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                          </svg>
                          {material}
                        </span>
                      )}
                      {confPct && (
                        <span className="sub-verdict__chip sub-verdict__chip--conf">
                          {confPct} confidence
                        </span>
                      )}
                      {contaminated && (
                        <span className="sub-verdict__chip sub-verdict__chip--warn">
                          Contamination detected
                        </span>
                      )}
                      {isAiGenerated && (
                        <span className="sub-verdict__chip sub-verdict__chip--warn">
                          AI-generated image
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>

          <div className="sub-success__actions">
            <button
              className="ep-btn ep-btn--secondary"
              onClick={handleReset}
            >
              Submit another
            </button>
            <Link href="/history" className="ep-btn ep-btn--primary">
              View history
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* ── Action selector ─────────────────────────────────────────────────────── */
  const ACTION_OPTIONS: { value: string; label: string; icon: string; points: string }[] = [
    { value: "auto",             label: "Let AI detect",      icon: "✦",  points: "varies" },
    { value: "recycling",        label: "Recycling",          icon: "♻",  points: "10 pts" },
    { value: "tree_planting",    label: "Plant a tree",       icon: "🌱", points: "30 pts" },
    { value: "waste_segregation",label: "Segregate waste",    icon: "🍃", points: "10 pts" },
    { value: "litter_cleanup",   label: "Clean up litter",   icon: "🧹", points: "20 pts" },
    { value: "composting",       label: "Composting",         icon: "🪱", points: "15 pts" },
  ];

  /* ── Form view ───────────────────────────────────────────────────────────── */
  return (
    <main className="ep-page sub-page" id="submit-main">
      <header className="sub-header">
        <p className="sub-header__eyebrow">Environmental action</p>
        <h1 className="sub-header__title">Submit your eco action</h1>
        <p className="sub-header__sub">
          Photograph your environmental action. Our AI verifies it and
          awards EcoPoints to your account.
        </p>
      </header>

      {/* Steps */}
      <div className="sub-steps" aria-label="Submission steps">
        <Step num={1} label="Choose photo" status={step1} />
        <div className="sub-step__connector" aria-hidden="true" />
        <Step num={2} label="Submit" status={step2} />
        <div className="sub-step__connector" aria-hidden="true" />
        <Step num={3} label="Verified" status={step3} />
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Action selector */}
        <div className="sub-action-selector" role="group" aria-label="Select action type">
          <p className="sub-action-selector__label">What are you doing?</p>
          <div className="sub-action-selector__grid">
            {ACTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`sub-action-btn${actionType === opt.value ? " sub-action-btn--active" : ""}`}
                onClick={() => setActionType(opt.value)}
                disabled={isUploading}
                aria-pressed={actionType === opt.value}
                id={`action-btn-${opt.value}`}
              >
                <span className="sub-action-btn__icon" aria-hidden="true">{opt.icon}</span>
                <span className="sub-action-btn__label">{opt.label}</span>
                <span className="sub-action-btn__pts">{opt.points}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Upload zone */}
        <Dropzone
          fileState={fileState}
          onFile={handleFile}
          onReplace={handleReplace}
          disabled={isUploading}
        />

        {/* Optional location */}
        <div className="sub-location">
          <button
            type="button"
            className="sub-location__toggle"
            aria-expanded={locationOpen}
            aria-controls="location-fields"
            onClick={() => setLocationOpen((o) => !o)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "var(--ep-space-2)" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1a4 4 0 010 8c-2.2 0-4-1.8-4-4s1.8-4 4-4z" stroke="currentColor" strokeWidth="1.25" />
                <path d="M7 13c0 0-4-3.5-4-7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                <path d="M7 13c0 0 4-3.5 4-7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              </svg>
              Add location <span style={{ color: "var(--ep-color-text-tertiary)", fontWeight: 400, fontSize: "0.8rem" }}>(optional)</span>
            </span>
            <svg
              className={`sub-location__toggle-icon${locationOpen ? " sub-location__toggle-icon--open" : ""}`}
              width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
            >
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {locationOpen && (
            <div className="sub-location__fields" id="location-fields">
              {(["latitude", "longitude", "accuracy"] as const).map((key) => (
                <div className="sub-field" key={key}>
                  <label className="sub-field__label" htmlFor={`loc-${key}`}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </label>
                  <input
                    id={`loc-${key}`}
                    type="number"
                    step="any"
                    className="sub-field__input"
                    placeholder={key === "accuracy" ? "metres" : "decimal"}
                    value={location[key]}
                    onChange={(e) => updateLocation(key, e.target.value)}
                    disabled={isUploading}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progress */}
        {isUploading && (
          <div className="sub-progress" aria-live="polite" aria-label="Upload in progress">
            <p className="sub-progress__label">
              <span className="sub-progress__spinner" aria-hidden="true" />
              Uploading and processing…
            </p>
            <div className="sub-progress__bar-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="sub-progress__bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Error */}
        {phase === "error" && submitError && (
          <div className="sub-error" role="alert">
            <p className="sub-error__title">Submission failed</p>
            <p className="sub-error__body">{submitError}</p>
          </div>
        )}

        {/* Submit row */}
        <div className="sub-submit-row" style={{ marginTop: "var(--ep-space-6)" }}>
          <p className="sub-submit-hint">
            By submitting, you confirm this photo shows a real environmental
            action you have personally performed.
          </p>
          <button
            type="submit"
            className="ep-btn ep-btn--primary ep-btn--lg"
            disabled={!hasValidFile || isUploading}
            aria-busy={isUploading}
          >
            {isUploading ? (
              <>
                <span className="ep-btn__spinner" aria-hidden="true" />
                Submitting…
              </>
            ) : "Submit photo"}
          </button>
        </div>
      </form>
    </main>
  );
}
