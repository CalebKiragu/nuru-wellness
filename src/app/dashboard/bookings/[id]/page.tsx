import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  Clock,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { BookingStatusActions } from "@/components/dashboard/booking-actions";
import { RescheduleForm } from "@/components/dashboard/reschedule-form";
import { DemoNote, PageHeader, SectionCard, StatusBadge } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { getBookingDetail, getStaffOptions } from "@/lib/dashboard-data";
import { formatDate, formatDateLong, formatDuration, formatMoney, formatTime } from "@/lib/format";
import { formatInTimeZone } from "date-fns-tz";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "bookings.view")) notFound();
  const { id } = await params;
  const db = await ensureDb();
  const detail = await getBookingDetail(db, context.tenant.id, id);
  if (!detail) notFound();
  const staff = await getStaffOptions(db, context.tenant.id);
  const timezone = context.tenant.timezone;
  const canManage = can(context.role, "bookings.manage");
  const reschedulable = ["pending", "confirmed"].includes(detail.booking.status);
  const tomorrow = formatInTimeZone(addDays(new Date(), 1), timezone, "yyyy-MM-dd");

  return (
    <div>
      <Link href="/dashboard/bookings" className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted hover:text-forest">
        <ArrowLeft className="h-3.5 w-3.5" /> All bookings
      </Link>

      <PageHeader
        eyebrow={detail.booking.reference}
        title={detail.service.name}
        description={`${formatDateLong(detail.booking.startsAt, timezone)} at ${formatTime(detail.booking.startsAt, timezone)} with ${detail.staff.name}.`}
        actions={<StatusBadge status={detail.booking.status} />}
      />
      <DemoNote>{detail.booking.isDemo ? "This is a demonstration booking stored in the demo database." : "This is a live workspace record."} Notifications are simulated unless an email provider is configured.</DemoNote>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <SectionCard title="Appointment">
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <div>
                <p className="dash-label">When</p>
                <p className="text-sm font-medium">{formatDateLong(detail.booking.startsAt, timezone)}</p>
                <p className="mt-1 text-xs text-muted">{formatTime(detail.booking.startsAt, timezone)} – {formatTime(detail.booking.endsAt, timezone)} · {timezone}</p>
              </div>
              <div>
                <p className="dash-label">Therapist</p>
                <p className="inline-flex items-center gap-2 text-sm font-medium"><span className="h-2 w-2 rounded-full" style={{ background: detail.staff.color }} /> {detail.staff.name}</p>
                <p className="mt-1 text-xs text-muted">{detail.staff.title}</p>
              </div>
              <div>
                <p className="dash-label">Location</p>
                <p className="flex items-start gap-1.5 text-sm"><MapPin className="mt-0.5 h-3.5 w-3.5 text-muted" /> {detail.location?.name ?? "Primary studio"}</p>
                {detail.location && <p className="mt-1 pl-5 text-xs text-muted">{detail.location.addressLine1}, {detail.location.city}</p>}
              </div>
              <div>
                <p className="dash-label">Value</p>
                <p className="flex items-center gap-1.5 text-sm font-medium"><CircleDollarSign className="h-3.5 w-3.5 text-muted" /> {formatMoney(detail.booking.priceCents, detail.booking.currency)}</p>
                <p className="mt-1 text-xs text-muted">No payment is collected in this demonstration.</p>
              </div>
              <div>
                <p className="dash-label">Source</p>
                <p className="text-sm capitalize">{detail.booking.source.replaceAll("_", " ")}</p>
              </div>
              <div>
                <p className="dash-label">Created</p>
                <p className="text-sm">{formatDate(detail.booking.createdAt, timezone, "d MMM yyyy, h:mm a")}</p>
              </div>
            </div>
            {detail.items.length > 0 && (
              <div className="border-t border-line px-4 py-3 sm:px-5">
                <p className="dash-label">Items</p>
                <ul className="space-y-1.5">
                  {detail.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-xs">
                      <span>{item.name} <span className="text-muted">· {formatDuration(item.durationMinutes)}</span></span>
                      <span className="tabular-nums">{formatMoney(item.priceCents, detail.booking.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Client" action={<Link href={`/dashboard/customers/${detail.customer.id}`} className="text-[10px] font-semibold uppercase tracking-[0.08em] text-forest hover:underline">Client record</Link>}>
            <div className="p-4 sm:p-5">
              <p className="font-display text-2xl text-forest">{detail.customer.name}</p>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                {detail.customer.email && (
                  <a href={`mailto:${detail.customer.email}`} className="inline-flex items-center gap-2 hover:text-forest"><Mail className="h-3.5 w-3.5 text-muted" /> {detail.customer.email}</a>
                )}
                {detail.customer.phone && (
                  <a href={`tel:${detail.customer.phone}`} className="inline-flex items-center gap-2 hover:text-forest"><Phone className="h-3.5 w-3.5 text-muted" /> {detail.customer.phone}</a>
                )}
              </div>
              {detail.customer.notes && (
                <div className="mt-4 rounded-md border border-line bg-[#faf6ef] p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Private client note</p>
                  <p className="mt-1 text-xs leading-relaxed">{detail.customer.notes}</p>
                </div>
              )}
              {detail.booking.customerNote && (
                <div className="mt-3 rounded-md border border-line p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Note with this booking</p>
                  <p className="mt-1 text-xs leading-relaxed">{detail.booking.customerNote}</p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Status history" description="Append-only record of changes">
            <ol className="divide-y divide-[#efeae1]">
              {detail.history.map(({ history, user }) => (
                <li key={history.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#efe9df] text-muted"><Clock className="h-3 w-3" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px]">
                      {history.fromStatus ? <><span className="capitalize text-muted">{history.fromStatus.replace("_", " ")}</span> → </> : "Created as "}
                      <span className="font-semibold capitalize">{history.toStatus.replace("_", " ")}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {formatDate(history.createdAt, timezone, "d MMM yyyy, h:mm a")} · {user?.name ?? "System"}
                      {history.reason ? ` · ${history.reason}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>

        <div className="space-y-5">
          {canManage && (
            <SectionCard title="Update status" description="Changes are recorded in the audit trail.">
              <div className="p-4 sm:p-5"><BookingStatusActions bookingId={detail.booking.id} status={detail.booking.status} /></div>
            </SectionCard>
          )}

          {canManage && reschedulable && (
            <SectionCard title="Reschedule" description="Availability is checked again inside a transaction.">
              <div className="p-4 sm:p-5">
                <RescheduleForm
                  bookingId={detail.booking.id}
                  serviceId={detail.booking.serviceId}
                  staff={staff.map((person) => ({ id: person.id, name: person.name }))}
                  defaultStaffId={detail.booking.staffId}
                  defaultDate={tomorrow}
                />
              </div>
            </SectionCard>
          )}

          <SectionCard title="Client history" description="Other appointments in this workspace">
            {detail.otherBookings.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-muted">This is the client&apos;s only appointment.</p>
            ) : (
              <ul className="divide-y divide-[#efeae1]">
                {detail.otherBookings.map(({ booking, service }) => (
                  <li key={booking.id}>
                    <Link href={`/dashboard/bookings/${booking.id}`} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-[#faf6ef]">
                      <div>
                        <p className="text-[11px] font-medium">{service.name}</p>
                        <p className="text-[10px] text-muted">{formatDate(booking.startsAt, timezone, "d MMM yyyy")} · {formatTime(booking.startsAt, timezone)}</p>
                      </div>
                      <StatusBadge status={booking.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <div className="rounded-xl bg-forest p-5 text-ivory">
            <CalendarClock className="h-4 w-4 text-brass" />
            <p className="mt-2 font-display text-xl leading-snug">One diary, every channel.</p>
            <p className="mt-2 text-[11px] leading-relaxed text-ivory/65">
              Storefront bookings, dashboard changes and reschedules all check the same availability engine, with an advisory lock to prevent double booking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
