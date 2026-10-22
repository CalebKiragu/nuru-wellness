import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Search } from "lucide-react";
import { DemoNote, EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { getStaffOptions, listBookings } from "@/lib/dashboard-data";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import type { BookingStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

const statuses: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; staff?: string; from?: string; to?: string }>;
}) {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "bookings.view")) notFound();
  const params = await searchParams;
  const status = statuses.some((entry) => entry.value === params.status) ? params.status! : "all";
  const query = (params.q ?? "").slice(0, 80);

  const db = await ensureDb();
  const [rows, staff] = await Promise.all([
    listBookings(db, context.tenant, {
      status: status as BookingStatus | "all",
      query: query || undefined,
      staffId: params.staff || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
      limit: 400,
    }),
    getStaffOptions(db, context.tenant.id),
  ]);

  const tabHref = (value: string) => {
    const search = new URLSearchParams();
    if (value !== "all") search.set("status", value);
    if (query) search.set("q", query);
    if (params.staff) search.set("staff", params.staff);
    if (params.from) search.set("from", params.from);
    if (params.to) search.set("to", params.to);
    return `/dashboard/bookings${search.toString() ? `?${search}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Bookings"
        description="Every appointment in this workspace, newest first. Search by reference, client, phone or treatment."
        actions={<Link href="/dashboard/calendar" className="dash-btn dash-btn-secondary"><CalendarDays className="h-3.5 w-3.5" /> Calendar</Link>}
      />
      <DemoNote>Booking records are real rows in the demo database. Confirmation and cancellation emails are simulated because no email provider is configured.</DemoNote>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {statuses.map((entry) => (
          <Link
            key={entry.value}
            href={tabHref(entry.value)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${status === entry.value ? "border-forest bg-forest text-ivory" : "border-line bg-paper text-muted hover:border-forest/40"}`}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      <form method="get" className="dash-card mb-4 grid gap-2 p-3 sm:grid-cols-[1fr_10rem_9rem_9rem_auto]">
        <input type="hidden" name="status" value={status} />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={query} className="dash-input pl-8" placeholder="Search reference, client or treatment" />
        </div>
        <select name="staff" defaultValue={params.staff ?? ""} className="dash-input" aria-label="Therapist">
          <option value="">All therapists</option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>{person.name}</option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={params.from ?? ""} className="dash-input" aria-label="From date" />
        <input type="date" name="to" defaultValue={params.to ?? ""} className="dash-input" aria-label="To date" />
        <div className="flex gap-2">
          <button type="submit" className="dash-btn dash-btn-primary">Filter</button>
          <Link href="/dashboard/bookings" className="dash-btn dash-btn-secondary">Reset</Link>
        </div>
      </form>

      <SectionCard title={`${rows.length} booking${rows.length === 1 ? "" : "s"}`} description="Click a row for the full record and status actions.">
        {rows.length === 0 ? (
          <EmptyState title="No bookings match" description="Adjust the filters or clear the search. New storefront bookings appear here instantly." />
        ) : (
          <div className="overflow-x-auto">
            <table className="dash-table w-full min-w-[46rem]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Client</th>
                  <th>Treatment</th>
                  <th>Therapist</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ booking, customer, service, staff: therapist }) => (
                  <tr key={booking.id} className="hover:bg-[#faf6ef]">
                    <td className="whitespace-nowrap">
                      <Link href={`/dashboard/bookings/${booking.id}`} className="block">
                        <span className="text-xs font-medium">{formatDate(booking.startsAt, context.tenant.timezone, "EEE d MMM yyyy")}</span>
                        <span className="block text-[10px] tabular-nums text-muted">{formatTime(booking.startsAt, context.tenant.timezone)} – {formatTime(booking.endsAt, context.tenant.timezone)}</span>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/dashboard/bookings/${booking.id}`} className="block">
                        <span className="text-xs font-medium">{customer.name}</span>
                        <span className="block text-[10px] text-muted">{customer.email ?? customer.phone ?? "No contact"}</span>
                      </Link>
                    </td>
                    <td><span className="text-xs">{service.name}</span></td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                        <span className="h-2 w-2 rounded-full" style={{ background: therapist.color }} />
                        {therapist.name.split(" ")[0]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-xs tabular-nums">{formatMoney(booking.priceCents, booking.currency)}</td>
                    <td><StatusBadge status={booking.status} /></td>
                    <td><span className="font-mono text-[10px] text-muted">{booking.reference}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
