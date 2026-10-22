import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarPlus, Check, Clock, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { StorefrontShell } from "@/components/storefront/shell";
import { ensureDb } from "@/db";
import { outboundMessages, services, staffProfiles } from "@/db/schema";
import { getBookingByReference } from "@/lib/bookings";
import { formatDateLong, formatDuration, formatMoney, formatTime } from "@/lib/format";
import { getPublicTenant, getStorefrontData } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ reference: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Booking confirmed", robots: { index: false, follow: false } };
}

function googleDate(date: Date) {
  return formatInTimeZone(date, "UTC", "yyyyMMdd'T'HHmmss'Z'");
}

export default async function ConfirmationPage({ params }: Props) {
  const { reference } = await params;
  const tenant = await getPublicTenant();
  if (!tenant) notFound();
  const data = await getStorefrontData(tenant);
  if (!data) notFound();

  const db = await ensureDb();
  const row = await getBookingByReference(db, tenant.id, decodeURIComponent(reference));
  if (!row) notFound();

  const { booking, customer } = row;
  const [staff] = await db
    .select()
    .from(staffProfiles)
    .where(and(eq(staffProfiles.id, booking.staffId), eq(staffProfiles.tenantId, tenant.id)))
    .limit(1);
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, booking.serviceId), eq(services.tenantId, tenant.id)))
    .limit(1);
  const [message] = await db
    .select()
    .from(outboundMessages)
    .where(and(eq(outboundMessages.tenantId, tenant.id), eq(outboundMessages.idempotencyKey, `booking-confirmed:${booking.id}`)))
    .limit(1);

  const calendarUrl = new URL("https://calendar.google.com/calendar/render");
  calendarUrl.searchParams.set("action", "TEMPLATE");
  calendarUrl.searchParams.set("text", `${service?.name ?? "Treatment"} at ${tenant.name}`);
  calendarUrl.searchParams.set("dates", `${googleDate(booking.startsAt)}/${googleDate(booking.endsAt)}`);
  calendarUrl.searchParams.set("details", `Booking reference: ${booking.reference}\nWith ${staff?.name ?? "your therapist"}.`);
  calendarUrl.searchParams.set("location", `${data.config.content.address}, ${data.config.content.city}`);

  return (
    <StorefrontShell data={data}>
      <div className="sf-container max-w-4xl py-12 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-soft)] text-[var(--color-brand)]">
            <Check className="h-7 w-7" strokeWidth={2.5} />
          </span>
          <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Booking confirmed</p>
          <h1 className="mt-3 font-display text-[clamp(2.8rem,6vw,4.6rem)] leading-[0.96]">
            We have saved your time.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-tenant-muted)]">
            Thank you, {customer.name.split(" ")[0]}. Your appointment at {tenant.name} is confirmed.
            The studio can see it in their dashboard right now.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-tenant-border)] bg-[var(--color-surface)] px-4 py-2 text-xs">
            <span className="text-[var(--color-tenant-muted)]">Booking reference</span>
            <strong className="font-mono tracking-wider">{booking.reference}</strong>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)]">
          <div className="border-b border-[var(--color-tenant-border)] bg-[var(--color-soft)]/40 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--color-accent)]">Your treatment</p>
                <h2 className="mt-1 font-display text-3xl">{service?.name ?? "Treatment"}</h2>
                <p className="mt-1 text-sm text-[var(--color-tenant-muted)]">
                  {service ? formatDuration(service.durationMinutes) : ""} with {staff?.name ?? "your therapist"}
                </p>
              </div>
              <p className="text-base font-semibold">{formatMoney(booking.priceCents, booking.currency)}</p>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2">
            <div>
              <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-tenant-muted)]">Date</p>
              <p className="mt-1.5 flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4 text-[var(--color-accent)]" /> {formatDateLong(booking.startsAt, tenant.timezone)}</p>
              <p className="mt-1 text-sm text-[var(--color-tenant-muted)]">{formatTime(booking.startsAt, tenant.timezone)} – {formatTime(booking.endsAt, tenant.timezone)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-tenant-muted)]">Where</p>
              <p className="mt-1.5 flex items-start gap-2 text-sm leading-relaxed"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" /> {data.config.content.address}<br />{data.config.content.city}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-tenant-muted)]">Guest</p>
              <p className="mt-1.5 text-sm">{customer.name}</p>
              <p className="text-sm text-[var(--color-tenant-muted)]">{customer.email}</p>
              <p className="text-sm text-[var(--color-tenant-muted)]">{customer.phone}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-tenant-muted)]">Payment</p>
              <p className="mt-1.5 text-sm">Pay at your appointment</p>
              <p className="text-[10px] text-[var(--color-tenant-muted)]">No payment has been taken in this demonstration.</p>
            </div>
          </div>

          <div className="border-t border-[var(--color-tenant-border)] p-6">
            <div className="flex flex-wrap gap-3">
              <a href={calendarUrl.toString()} target="_blank" rel="noreferrer" className="sf-btn sf-btn-outline">
                <CalendarPlus className="h-4 w-4" /> Add to calendar
              </a>
              <a href={`tel:${data.config.content.phone}`} className="sf-btn sf-btn-outline">
                <Phone className="h-4 w-4" /> {data.config.content.phone}
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-5 max-w-2xl rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-canvas)] p-5 text-xs leading-relaxed text-[var(--color-tenant-muted)]">
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand)]" />
            <span>
              <strong className="text-[var(--color-tenant-ink)]">Arrive ten minutes early.</strong>{" "}
              {data.config.content.arrivalPolicy} {data.config.content.cancellationPolicy}
            </span>
          </p>
        </div>

        {message && (
          <div className="mx-auto mt-5 max-w-2xl rounded-[var(--tenant-radius)] border border-dashed border-[var(--color-tenant-border)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-tenant-muted)]">Confirmation message preview</p>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${message.status === "sent" ? "bg-[#E6EFE7] text-[#2F5C42]" : "bg-[#F5E8D8] text-[#8C5B30]"}`}>
                {message.status === "sent" ? "Sent" : "Simulated · not sent"}
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-[var(--color-tenant-ink)]">{message.subject}</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-[11px] leading-relaxed text-[var(--color-tenant-muted)]">{message.body}</p>
            <p className="mt-2 text-[10px] text-[var(--color-tenant-muted)]">
              {message.status === "sent" ? "Delivered through the configured email provider." : "No email provider is configured. In demo mode this message is stored and previewed, never reported as delivered."}
            </p>
          </div>
        )}

        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-between gap-4 border-t border-[var(--color-tenant-border)] pt-6 text-xs text-[var(--color-tenant-muted)]">
          <Link href="/" className="sf-link text-[var(--color-brand)]">Back to {tenant.name}</Link>
          <a href={`mailto:${data.config.content.email}`} className="inline-flex items-center gap-1.5 hover:text-[var(--color-brand)]">
            <Mail className="h-3.5 w-3.5" /> {data.config.content.email}
          </a>
        </div>
      </div>
    </StorefrontShell>
  );
}
