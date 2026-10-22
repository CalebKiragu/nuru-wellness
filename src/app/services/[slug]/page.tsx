import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock, Info, Sparkles, UserRound } from "lucide-react";
import { StorefrontShell } from "@/components/storefront/shell";
import { fontClass } from "@/components/storefront/theme";
import { ensureDb } from "@/db";
import { findNextAvailableSlot } from "@/lib/availability-service";
import { formatDate, formatDuration, formatMoney } from "@/lib/format";
import { getPublicTenant, getStorefrontData } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getPublicTenant();
  if (!tenant) return {};
  const data = await getStorefrontData(tenant);
  const service = data?.services.find((entry) => entry.slug === slug);
  if (!service) return {};
  return {
    title: `${service.name} — ${data!.config.content.businessName}`,
    description: service.shortDescription,
    openGraph: {
      title: service.name,
      description: service.shortDescription,
      images: service.imageUrl ? [{ url: service.imageUrl }] : undefined,
    },
    alternates: { canonical: `/services/${service.slug}` },
    robots: tenant.isDemo ? { index: false, follow: false } : undefined,
  };
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getPublicTenant();
  if (!tenant) notFound();
  const data = await getStorefrontData(tenant);
  if (!data) notFound();
  const service = data.services.find((entry) => entry.slug === slug);
  if (!service) notFound();

  const db = await ensureDb();
  const availability = await Promise.all(
    service.staff.slice(0, 3).map(async (person) => ({
      staff: person,
      next: await findNextAvailableSlot(db, tenant, service.id, person.id, 14),
    })),
  );
  const related = data.services.filter((entry) => entry.id !== service.id).slice(0, 3);
  const content = data.config.content;

  return (
    <StorefrontShell data={data}>
      <div className="border-b border-[var(--color-tenant-border)] bg-[color-mix(in_srgb,var(--color-soft)_22%,var(--color-canvas))]">
        <div className="sf-container py-5">
          <Link href="/#services" className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-tenant-muted)] hover:text-[var(--color-brand)]">
            <ArrowLeft className="h-3.5 w-3.5" /> All treatments
          </Link>
        </div>
      </div>

      <article>
        <div className="sf-container grid gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-20">
          <div>
            <p className="sf-eyebrow">{service.category} · {formatDuration(service.durationMinutes)}</p>
            <h1 className={`${fontClass(data.config.theme)} mt-4 max-w-[14ch] text-[clamp(3rem,6vw,5rem)] leading-[0.94]`}>
              {service.name}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-tenant-muted)]">
              {service.shortDescription}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-6 border-y border-[var(--color-tenant-border)] py-5">
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--color-tenant-muted)]">Duration</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium"><Clock className="h-4 w-4 text-[var(--color-accent)]" /> {formatDuration(service.durationMinutes)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--color-tenant-muted)]">Investment</p>
                <p className="mt-1 text-sm font-semibold">{formatMoney(service.priceCents, service.currency)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--color-tenant-muted)]">With</p>
                <p className="mt-1 text-sm font-medium">{service.staff.map((s) => s.name.split(" ")[0]).join(" or ") || "Our team"}</p>
              </div>
            </div>

            <div className="mt-8 space-y-4 text-[0.95rem] leading-[1.8] text-[var(--color-tenant-muted)]">
              {service.description.split("\n\n").map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-10">
              <h2 className={`${fontClass(data.config.theme)} text-3xl`}>What the session involves</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  "A short consultation before we begin",
                  "Pressure and focus adapted to you",
                  "A private room, warm linens and quiet",
                  "Time to settle afterwards",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--color-tenant-muted)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            {service.addons.length > 0 && (
              <div className="mt-10 rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)] p-6">
                <h2 className={`${fontClass(data.config.theme)} text-2xl`}>Add to your treatment</h2>
                <div className="mt-4 divide-y divide-[var(--color-tenant-border)]">
                  {service.addons.map((addon) => (
                    <div key={addon.id} className="flex items-start justify-between gap-5 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">{addon.name}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-tenant-muted)]">{addon.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium">{formatMoney(addon.priceCents, service.currency)}</p>
                        <p className="text-[10px] text-[var(--color-tenant-muted)]">+{addon.durationMinutes} min</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[10px] text-[var(--color-tenant-muted)]">Add-ons can be selected during booking and extend your appointment time.</p>
              </div>
            )}

            <div className="mt-10">
              <h2 className={`${fontClass(data.config.theme)} text-3xl`}>Therapist availability</h2>
              <div className="mt-5 space-y-3">
                {availability.map(({ staff, next }) => (
                  <div key={staff.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 overflow-hidden rounded-full bg-[var(--color-soft)]">
                        {staff.imageUrl ? (
                          <Image src={staff.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center"><UserRound className="h-4 w-4" /></span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{staff.name}</p>
                        <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-tenant-muted)]">{staff.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[var(--color-tenant-muted)]">
                        {next ? `Next: ${formatDate(new Date(next.slot.start), tenant.timezone)} at ${next.slot.label}` : "Contact the studio"}
                      </span>
                      <Link href={`/book/${service.slug}?staff=${staff.id}`} className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-brand)] underline underline-offset-4">
                        View times
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 space-y-4 border-t border-[var(--color-tenant-border)] pt-8">
              <div>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em]">Cancellation</h2>
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-tenant-muted)]">{content.cancellationPolicy}</p>
              </div>
              <div>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em]">Deposit & payment</h2>
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-tenant-muted)]">{content.depositPolicy}</p>
              </div>
            </div>
          </div>

          <aside className="lg:pt-4">
            <div className="lg:sticky lg:top-28">
              <div className="overflow-hidden rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
                <div className="relative aspect-[4/3]">
                  {service.imageUrl && (
                    <Image src={service.imageUrl} alt={`${service.name} treatment`} fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" priority />
                  )}
                </div>
                <div className="p-6">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className={`${fontClass(data.config.theme)} text-3xl`}>{formatMoney(service.priceCents, service.currency)}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-tenant-muted)]">{formatDuration(service.durationMinutes)}</p>
                  </div>
                  <Link href={`/book/${service.slug}`} className="sf-btn sf-btn-primary mt-5 w-full">
                    Choose a time <ArrowRight className="h-4 w-4" />
                  </Link>
                  <p className="mt-3 text-center text-[10px] leading-relaxed text-[var(--color-tenant-muted)]">
                    Instant confirmation · No payment required in this demo
                  </p>
                  <div className="mt-5 space-y-2 border-t border-[var(--color-tenant-border)] pt-4 text-[11px] leading-relaxed text-[var(--color-tenant-muted)]">
                    <p className="flex gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" /> {content.arrivalPolicy}</p>
                    <p className="flex gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" /> This is a demonstration booking. The appointment is saved to a demo database; no payment is collected and no external messages are sent.</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="border-t border-[var(--color-tenant-border)] bg-[var(--color-surface)] py-16">
            <div className="sf-container">
              <div className="flex items-end justify-between gap-4">
                <h2 className={`${fontClass(data.config.theme)} text-4xl`}>You may also like</h2>
                <Link href="/#services" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-brand)]">Full menu</Link>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {related.map((item) => (
                  <Link key={item.id} href={`/services/${item.slug}`} className="group rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] p-5 transition-colors hover:bg-[var(--color-canvas)]">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-accent)]">{formatDuration(item.durationMinutes)}</p>
                    <h3 className={`${fontClass(data.config.theme)} mt-2 text-2xl`}>{item.name}</h3>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--color-tenant-muted)]">{item.shortDescription}</p>
                    <p className="mt-4 flex items-center justify-between text-sm">
                      <span>{formatMoney(item.priceCents, item.currency)}</span>
                      <ArrowRight className="h-4 w-4 text-[var(--color-brand)] transition-transform group-hover:translate-x-1" />
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </article>
    </StorefrontShell>
  );
}
