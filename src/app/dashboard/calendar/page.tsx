import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeft, ArrowRight, CalendarDays, CalendarRange, Clock, MapPin } from "lucide-react";
import { DemoNote, EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { getCalendarDay, getCalendarWeek, todayKey, weekKeys } from "@/lib/dashboard-data";
import { formatDateLong, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

function shiftKey(dateKey: string, days: number) {
  return format(addDays(parseISO(`${dateKey}T12:00:00`), days), "yyyy-MM-dd");
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; staff?: string }>;
}) {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "bookings.view")) notFound();
  const params = await searchParams;
  const timezone = context.tenant.timezone;
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : todayKey(timezone);
  const view = params.view === "week" ? "week" : "day";
  const staffId = params.staff ?? "";
  const date = parseISO(`${dateKey}T12:00:00`);

  const db = await ensureDb();
  const [day, week] = await Promise.all([
    getCalendarDay(db, context.tenant, dateKey, staffId || undefined),
    getCalendarWeek(db, context.tenant, dateKey, staffId || undefined),
  ]);

  const prevKey = view === "day" ? shiftKey(dateKey, -1) : shiftKey(dateKey, -7);
  const nextKey = view === "day" ? shiftKey(dateKey, 1) : shiftKey(dateKey, 7);
  const base = (nextView: string) => `/dashboard/calendar?date=${dateKey}&view=${nextView}${staffId ? `&staff=${staffId}` : ""}`;
  const shiftLink = (key: string) => `/dashboard/calendar?date=${key}&view=${view}${staffId ? `&staff=${staffId}` : ""}`;
  const weekList = weekKeys(dateKey);
  const activeStaff = day.staff.filter((person) => !staffId || person.id === staffId);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Calendar"
        description="A real view of the diary. Times are shown in the studio's timezone; cancelled appointments remain visible for the record."
        actions={
          <>
            <Link href={shiftLink(todayKey(timezone))} className="dash-btn dash-btn-secondary">Today</Link>
            <Link href="/dashboard/bookings" className="dash-btn dash-btn-secondary"><CalendarDays className="h-3.5 w-3.5" /> All bookings</Link>
          </>
        }
      />
      <DemoNote>Seeded appointments and time off are relative to today. New bookings made on the storefront appear here immediately.</DemoNote>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={shiftLink(prevKey)} className="dash-btn dash-btn-secondary px-2" aria-label="Previous period"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-[11rem] text-center">
            <p className="text-xs font-semibold text-ink">
              {view === "day" ? formatDateLong(date, timezone) : `${formatInTimeZone(weekList[0].date, timezone, "d MMM")} – ${formatInTimeZone(weekList[6].date, timezone, "d MMM yyyy")}`}
            </p>
            <p className="text-[9px] uppercase tracking-[0.1em] text-muted">{view === "day" ? "Day view" : "Week view"}</p>
          </div>
          <Link href={shiftLink(nextKey)} className="dash-btn dash-btn-secondary px-2" aria-label="Next period"><ArrowRight className="h-4 w-4" /></Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form method="get" className="flex items-center gap-2">
            <input type="hidden" name="date" value={dateKey} />
            <input type="hidden" name="view" value={view} />
            <select name="staff" defaultValue={staffId} className="dash-input min-h-9 w-auto py-1 text-xs" aria-label="Filter by therapist">
              <option value="">All therapists</option>
              {day.staff.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
            <button type="submit" className="dash-btn dash-btn-secondary">Filter</button>
          </form>
          <div className="flex rounded-md border border-line bg-paper p-0.5">
            <Link href={base("day")} className={cn("rounded px-2.5 py-1 text-[10px] font-semibold", view === "day" ? "bg-forest text-ivory" : "text-muted")}>Day</Link>
            <Link href={base("week")} className={cn("rounded px-2.5 py-1 text-[10px] font-semibold", view === "week" ? "bg-forest text-ivory" : "text-muted")}>Week</Link>
          </div>
        </div>
      </div>

      {view === "day" ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {activeStaff.map((person) => {
            const rows = day.rows.filter((row) => row.staff.id === person.id);
            const off = day.timeOff.filter((row) => row.staff.id === person.id);
            return (
              <section key={person.id} className="dash-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: person.color }} />
                    <div>
                      <p className="text-xs font-semibold">{person.name}</p>
                      <p className="text-[9px] uppercase tracking-[0.08em] text-muted">{person.title}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted">{rows.filter((row) => row.booking.status !== "cancelled").length} booked</span>
                </div>
                {off.length > 0 && (
                  <div className="border-b border-line bg-[#f7efdf] px-4 py-2">
                    {off.map((entry) => (
                      <p key={entry.timeOff.id} className="text-[10px] text-[#77572f]">
                        <Clock className="mr-1 inline h-3 w-3" /> {formatTime(entry.timeOff.startsAt, timezone)}–{formatTime(entry.timeOff.endsAt, timezone)} · {entry.timeOff.reason}
                      </p>
                    ))}
                  </div>
                )}
                {rows.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[11px] text-muted">No appointments.</div>
                ) : (
                  <div className="divide-y divide-[#efeae1]">
                    {rows.map(({ booking, customer, service, staff }) => (
                      <Link key={booking.id} href={`/dashboard/bookings/${booking.id}`} className={cn("block px-4 py-3 hover:bg-[#faf6ef]", booking.status === "cancelled" && "opacity-55")}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold tabular-nums">
                            {formatTime(booking.startsAt, timezone)} <span className="font-normal text-muted">– {formatTime(booking.endsAt, timezone)}</span>
                          </p>
                          <StatusBadge status={booking.status} />
                        </div>
                        <p className="mt-1.5 text-xs font-medium">{service.name}</p>
                        <p className="text-[10px] text-muted">{customer.name} · with {staff.name.split(" ")[0]} · {booking.reference}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {activeStaff.length === 0 && (
            <div className="dash-card lg:col-span-2 xl:col-span-3"><EmptyState title="No active team members" description="Add a therapist and their working hours to start accepting bookings." /></div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {week.days.map((entry) => {
            const isToday = entry.key === todayKey(timezone);
            return (
              <section key={entry.key} className={cn("dash-card overflow-hidden", isToday && "border-forest/40")}>
                <div className={cn("border-b border-line px-3 py-2", isToday ? "bg-[#eef2eb]" : "")}>
                  <p className="text-[9px] uppercase tracking-[0.1em] text-muted">{formatInTimeZone(entry.date, timezone, "EEE")}</p>
                  <p className="font-display text-xl leading-tight text-forest">{formatInTimeZone(entry.date, timezone, "d MMM")}</p>
                  <p className="text-[9px] text-muted">{entry.rows.filter((row) => row.booking.status !== "cancelled").length} appointments</p>
                </div>
                <div className="max-h-[34rem] divide-y divide-[#efeae1] overflow-y-auto">
                  {entry.rows.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[10px] text-muted">Open</p>
                  ) : (
                    entry.rows.map(({ booking, customer, service }) => (
                      <Link key={booking.id} href={`/dashboard/bookings/${booking.id}`} className={cn("block px-3 py-2 hover:bg-[#faf6ef]", booking.status === "cancelled" && "opacity-50")}>
                        <p className="text-[10px] font-semibold tabular-nums">{formatTime(booking.startsAt, timezone)}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] font-medium">{service.name}</p>
                        <p className="line-clamp-1 text-[9px] text-muted">{customer.name}</p>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1.5"><CalendarRange className="h-3.5 w-3.5" /> Week starts Monday</span>
        <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {context.tenant.name} · {timezone}</span>
        {can(context.role, "staff.manage") && <Link href="/dashboard/staff" className="font-semibold text-forest underline underline-offset-2">Manage working hours & time off</Link>}
      </div>
    </div>
  );
}
