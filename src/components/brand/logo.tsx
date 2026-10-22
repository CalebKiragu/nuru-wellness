import Link from "next/link";
import { cn } from "@/lib/cn";

export function NuruMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M32 48V31"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M32 48c0-11 5-18 16-21-1 12-6 18-16 21Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M32 48c0-7-3-12-10-14 0 8 4 12 10 14Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <circle cx="34.5" cy="20.5" r="3.8" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  variant = "dark",
  compact = false,
}: {
  className?: string;
  href?: string;
  variant?: "dark" | "light";
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="Nuru Wellness home"
      className={cn("inline-flex items-center gap-2.5", variant === "light" ? "text-ivory" : "text-forest", className)}
    >
      <NuruMark size={compact ? 28 : 34} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.55rem] tracking-[0.01em]">Nuru</span>
        {!compact && (
          <span className="mt-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.32em] opacity-70">
            Wellness
          </span>
        )}
      </span>
    </Link>
  );
}
