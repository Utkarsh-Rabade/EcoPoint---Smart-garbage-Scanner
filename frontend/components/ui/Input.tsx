/**
 * EcoPoints — Input, Textarea, Select, Field components
 *
 * Field wraps label + input + hint/error into a cohesive form group.
 *
 * Usage:
 *   <Field label="Email" htmlFor="email" hint="We'll never share it.">
 *     <Input id="email" type="email" placeholder="you@example.com" />
 *   </Field>
 *
 *   <Field label="Message" htmlFor="msg" error="Required">
 *     <Textarea id="msg" rows={4} status="error" />
 *   </Field>
 *
 *   <Field label="Category" htmlFor="cat">
 *     <Select id="cat">
 *       <option value="">Choose…</option>
 *       <option value="plastic">Plastic</option>
 *     </Select>
 *   </Field>
 */

import "@/styles/input.css";

/* ── Field wrapper ──────────────────────────────────────────────────────── */

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  className = "",
}: FieldProps) {
  return (
    <div className={`ep-field ${className}`}>
      <label
        htmlFor={htmlFor}
        className={`ep-label${required ? " ep-label--required" : ""}`}
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="ep-field-hint">{hint}</p>}
      {error && (
        <p className="ep-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Input ──────────────────────────────────────────────────────────────── */

type InputStatus = "default" | "error" | "success";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  status?: InputStatus;
}

export function Input({ status = "default", className = "", ...props }: InputProps) {
  return (
    <input
      className={[
        "ep-input",
        status === "error" && "ep-input--error",
        status === "success" && "ep-input--success",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

/* ── Textarea ───────────────────────────────────────────────────────────── */

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  status?: InputStatus;
}

export function Textarea({ status = "default", className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={[
        "ep-textarea",
        status === "error" && "ep-textarea--error",
        status === "success" && "ep-textarea--success",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

/* ── Select ─────────────────────────────────────────────────────────────── */

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  status?: InputStatus;
}

export function Select({ status = "default", className = "", children, ...props }: SelectProps) {
  return (
    <select
      className={[
        "ep-select",
        status === "error" && "ep-select--error",
        status === "success" && "ep-select--success",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </select>
  );
}

/* ── InputWrapper — with icon support ───────────────────────────────────── */

interface InputWrapperProps {
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function InputWrapper({
  icon,
  suffix,
  children,
  className = "",
}: InputWrapperProps) {
  return (
    <div className={`ep-input-wrapper ${className}`}>
      {icon && <span className="ep-input-icon">{icon}</span>}
      {children}
      {suffix && <span className="ep-input-suffix">{suffix}</span>}
    </div>
  );
}
