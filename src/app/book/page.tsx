import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { StorefrontShell } from "@/components/storefront/shell";
import { fontClass } from "@/components/storefront/theme";
import { formatDuration, formatMoney } from "@/lib/format";
import { getPublicTenant, getStorefrontData } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getPublicTenant();
  if (!tenant) return {};
  return { title: `Book a treatment — ${tenant.name}` };
}

export default async function BookPage() {
  const tenant = await getPublicTenant();
  if (!tenant) notFound();
  const data = await getStorefrontData(tenant);
  if (!data) notFound();

  return (
    <StorefrontShell data={data}>
      <div className="sf-container py-12 lg:py-20">
        <div className="max-w-2xl">
          <p className="sf-eyebrow">Online booking</p>
          <h1 className={`${fontClass(data.config.theme)} mt-4 text-[clamp(2.8rem,5.5vw,4.8rem)] leading-[0.94]`}>
            Choose your treatment.
          </h1>
          <p className="mt-5 text-[0.98rem] leading-relaxed text-[var(--color-tenant-muted)]">
            Every appointment includes a short consultation. Availability is live, and you will see
            your booking in the studio dashboard immediately.
          </p>
        </div>

        <div className="mt-10 grid gap-4">
          {data.services.map((service) => (
            <article key={service.id} className="group grid gap-5 rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-[10rem_1fr_auto] sm:items-center sm:p-5">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[calc(var(--tenant-radius)*0.7)] sm:aspect-[4/3]">
                {service.imageUrl && <Image src={service.imageUrl} alt="" fill sizes="160px" className="object-cover" />}
              </div>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h2 className={`${fontClass(data.config.theme)} text-2xl sm:text-3xl`}>{service.name}</h2>
                  <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-tenant-muted)]">{formatDuration(service.durationMinutes)}</span>
                </div>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--color-tenant-muted)]">{service.shortDescription}</p>
                <p className="mt-2 text-[11px] text-[var(--color-tenant-muted)]">With {service.staff.map((person) => person.name.split(" ")[0]).join(" or ")}</p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <p className="text-base font-semibold">{formatMoney(service.priceCents, service.currency)}</p>
                <Link href={`/book/${service.slug}`} className="sf-btn sf-btn-primary">
                  Book <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-4 border-t border-[var(--color-tenant-border)] pt-8 sm:grid-cols-3">
          {[
            ["Choose a time", "Live availability, calculated from the studio diary."],
            ["Add your details", "We only ask for what the studio needs to prepare."],
            ["You’re confirmed", "Your reference appears instantly in the dashboard."],
          ].map(([title, body], index) => (
            <div key={title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-tenant-border)] text-[10px] font-semibold text-[var(--color-accent)]">{index + 1}</span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-tenant-muted)]">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-[var(--tenant-radius)] bg-[var(--color-soft)]/50 px-5 py-4 text-xs text-[var(--color-tenant-muted)]">
          <Sparkles className="h-4 w-4 text-[var(--color-brand)]" />
          <span>Demonstration booking · no payment is taken and outbound messages are simulated.</span>
          <Link href="/policies" className="sf-link text-[var(--color-brand)]">Read policies</Link>
        </div>
      </div>
    </StorefrontShell>
  );
}
