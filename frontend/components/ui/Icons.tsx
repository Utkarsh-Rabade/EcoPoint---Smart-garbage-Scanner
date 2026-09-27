/**
 * Minimal inline SVG icons for the EcoPoints shell.
 * No external icon library — keeps the bundle small.
 * All icons: 20×20 viewBox, stroke-based, currentColor.
 */

interface IconProps {
  className?: string;
  "aria-hidden"?: boolean;
  size?: number;
}

const base = (size = 20): React.SVGProps<SVGSVGElement> => ({
  xmlns: "http://www.w3.org/2000/svg",
  width: size,
  height: size,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function IconGrid({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconHistory({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M10 6v4l2.5 2.5" />
    </svg>
  );
}

export function IconGift({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 8h14v2H3V8Z" />
      <path d="M4 10v8h12v-8" />
      <path d="M10 8V18" />
      <path d="M7 8c0-1.657 1.343-3 3-3s3 1.343 3 3" />
      <path d="M10 5C10 5 8 3 6.5 3S4 4.5 4 5.5 5 7 6.5 7 10 5 10 5Z" />
      <path d="M10 5c0 0 2-2 3.5-2S16 4.5 16 5.5 15 7 13.5 7 10 5 10 5Z" />
    </svg>
  );
}

export function IconTrophy({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 2h8v6a4 4 0 0 1-8 0V2Z" />
      <path d="M6 5H3a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3" />
      <path d="M14 5h3a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3" />
      <path d="M10 12v4" />
      <path d="M7 18h6" />
    </svg>
  );
}

export function IconUser({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="10" cy="7" r="3.5" />
      <path d="M2.5 18c0-4 3.358-7 7.5-7s7.5 3 7.5 7" />
    </svg>
  );
}

export function IconLeaf({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M17 3C17 3 9 3 5 8c-2.5 3.2-2 8 0 10 1 1 3 2 5 1 0 0-1-4 1-7 2 3 1 7 1 7 2 1 4 0 5-1 2-2 2.5-7 0-10" />
      <path d="M3 17c1.5-2 4-4 7-5" />
    </svg>
  );
}

export function IconUpload({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M10 13V5" />
      <path d="M6.5 8.5 10 5l3.5 3.5" />
      <path d="M3 15v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
    </svg>
  );
}

export function IconChevronDown({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  );
}

export function IconSettings({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" />
    </svg>
  );
}

export function IconLogOut({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M7 16H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" />
      <path d="M13 14l4-4-4-4" />
      <path d="M17 10H8" />
    </svg>
  );
}
