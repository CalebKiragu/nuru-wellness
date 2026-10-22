import Link from "next/link";
import { Clock3, Sparkles } from "lucide-react";
import type { BookingStatus } from "@/db/schema";
import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-brass">{eyebrow}</p>}
        <h1 className="mt-1.5 font-display text-[clamp(2.1rem,3.4vw,2.8rem)] leading-none text-forest">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DemoNote({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-brass/30 bg-[#f7efdf] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#77572f]">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" />
      <p>{children ?? "Seeded demonstration data. Any booking you create is a real record in this demo database. External messages and payments are simulated."}</p>
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
  href,
  accent,
}: {
  label: string;
  value: string | number;
  note?: string;
  href?: string;
  accent?: "forest" | "brass" | "clay";
}) {
  const content = (
    <>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={cn(
          "mt-2 font-display text-[2.4rem] leading-none",
          accent === "brass" ? "text-[#8d6534]" : accent === "clay" ? "text-clay" : "text-forest",
        )}
      >
        {value}
      </p>
      {note && <p className="mt-2 text-[11px] leading-relaxed text-muted">{note}</p>}
    </>
  );
  const className = "dash-card p-4 transition-colors hover:border-forest/20 sm:p-5";
  return href ? (
    <Link href={href} className={className}>{content}</Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
  description,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: string;
}) {
  return (
    <section className={cn("dash-card overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[11px] text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const statusStyles: Record<BookingStatus, string> = {
  pending: "bg-[#f7ecda] text-[#8e612f] border-[#ebd8bb]",
  confirmed: "bg-[#e6efe7] text-[#2f5c42] border-[#cee0d1]",
  cancelled: "bg-[#f2f0ec] text-[#6f6a63] border-[#e3ded5]",
  completed: "bg-[#e8edf2] text-[#3e586c] border-[#d3dee7]",
  no_show: "bg-[#f6e4df] text-[#8f4332] border-[#eccbc2]",
};

const statusLabels: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={cn("dash-chip border", statusStyles[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {statusLabels[status]}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#efe9df] text-muted">
        <Clock3 className="h-4 w-4" />
      </span>
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
