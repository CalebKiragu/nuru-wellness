import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StorefrontShell } from "@/components/storefront/shell";
import { fontClass } from "@/components/storefront/theme";
import { getPublicTenant, getStorefrontData } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getPublicTenant();
  if (!tenant) return {};
  return { title: `Booking policies — ${tenant.name}` };
}

export default async function PoliciesPage() {
  const tenant = await getPublicTenant();
  if (!tenant) notFound();
  const data = await getStorefrontData(tenant);
  if (!data) notFound();
  const content = data.config.content;

  return (
    <StorefrontShell data={data}>
      <div className="sf-container max-w-3xl py-12 lg:py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-tenant-muted)] hover:text-[var(--color-brand)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the studio
        </Link>
        <p className="sf-eyebrow mt-8">Before your visit</p>
        <h1 className={`${fontClass(data.config.theme)} mt-4 text-[clamp(2.8rem,5.5vw,4.4rem)] leading-[0.95]`}>Booking policies.</h1>
        <p className="mt-5 text-sm leading-relaxed text-[var(--color-tenant-muted)]">
          A few simple agreements so that every guest’s time is protected. This is a demonstration
          storefront; no payments are collected here.
        </p>

        <div className="mt-10 space-y-8">
          <section className="border-t border-[var(--color-tenant-border)] pt-6">
            <h2 className={`${fontClass(data.config.theme)} text-2xl`}>Cancellations & rescheduling</h2>
            <p className="mt-3 text-sm leading-[1.8] text-[var(--color-tenant-muted)]">{content.cancellationPolicy}</p>
          </section>
          <section className="border-t border-[var(--color-tenant-border)] pt-6">
            <h2 className={`${fontClass(data.config.theme)} text-2xl`}>Deposits & payment</h2>
            <p className="mt-3 text-sm leading-[1.8] text-[var(--color-tenant-muted)]">{content.depositPolicy}</p>
          </section>
          <section className="border-t border-[var(--color-tenant-border)] pt-6">
            <h2 className={`${fontClass(data.config.theme)} text-2xl`}>Arrival & late arrivals</h2>
            <p className="mt-3 text-sm leading-[1.8] text-[var(--color-tenant-muted)]">{content.arrivalPolicy}</p>
          </section>
          <section className="border-t border-[var(--color-tenant-border)] pt-6">
            <h2 className={`${fontClass(data.config.theme)} text-2xl`}>Communication</h2>
            <p className="mt-3 text-sm leading-[1.8] text-[var(--color-tenant-muted)]">
              Booking confirmations and appointment changes are transactional messages. Marketing
              messages are only sent where you have given separate consent, and every marketing
              message can be opted out of independently. Your contact details are never sold.
            </p>
          </section>
          <section className="border-t border-[var(--color-tenant-border)] pt-6">
            <h2 className={`${fontClass(data.config.theme)} text-2xl`}>Demonstration data</h2>
            <p className="mt-3 text-sm leading-[1.8] text-[var(--color-tenant-muted)]">
              This studio is a demonstration tenant. Bookings are stored in a demo database, no
              payment is processed, and outbound messages are previewed rather than delivered unless
              a real provider has been configured.
            </p>
          </section>
        </div>
      </div>
    </StorefrontShell>
  );
}
