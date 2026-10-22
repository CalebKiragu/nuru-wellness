import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Eye,
  Megaphone,
  Sparkles,
  Store,
  UserRound,
} from "lucide-react";
import { DemoNote, EmptyState, PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { getDashboardOverview } from "@/lib/dashboard";
import { formatDate, formatDateLong, formatTime, relativeDayLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

function greeting(timezone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function OverviewPage() {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "dashboard.view")) notFound();
  const db = await ensureDb();
  const data = await getDashboardOverview(db, context.tenant);
  const first = context.user.name.split(" ")[0];
  const latestApproval = data.approvals[0];

  const activities = data.recent.filter((row) => row.history.fromStatus !== null).slice(0, 5);

  return (
    <div>
      <PageHeader
        eyebrow={formatDateLong(new Date(), context.tenant.timezone)}
        title={`${greeting(context.tenant.timezone)}, ${first}.`}
        description={`Here is what is happening at ${context.tenant.name} today. No revenue or conversion figures are invented — every number below comes from live demo records.`}
        actions={
          <>
            <Link href="/dashboard/calendar" className="dash-btn dash-btn-secondary"><CalendarDays className="h-3.5 w-3.5" /> Open calendar</Link>
            <Link href="/dashboard/assistant" className="dash-btn dash-btn-primary"><Sparkles className="h-3.5 w-3.5" /> Ask Nuru</Link>
          </>
        }
      />

      <DemoNote />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Today"
          value={data.today.length}
          note={data.nextAppointment ? `Next at ${formatTime(data.nextAppointment.booking.startsAt, context.tenant.timezone)} · ${data.nextAppointment.service.name}` : "No appointments remain today"}
          href="/dashboard/calendar"
        />
        <StatCard label="Awaiting confirmation" value={data.pendingCount} note="Requests that need a decision" href="/dashboard/bookings?status=pending" accent="brass" />
        <StatCard label="Next 7 days" value={data.weekCount} note="Confirmed and pending appointments" href="/dashboard/calendar" />
        <StatCard label="Client records" value={data.clientCount} note="People who have booked with the studio" href="/dashboard/customers" accent="clay" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <SectionCard
          title="Today's schedule"
          description="Live appointments from the demo database"
          action={<Link href="/dashboard/calendar" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-forest hover:underline">Full calendar</Link>}
        >
          {data.today.length === 0 ? (
            <EmptyState
              title="No appointments today"
              description="The calendar is clear. You can still review upcoming bookings or share your storefront."
              action={<Link href="/dashboard/bookings" className="dash-btn dash-btn-secondary">View bookings</Link>}
            />
          ) : (
            <div className="divide-y divide-[#efeae1]">
              {data.today.map(({ booking, customer, service, staff }) => (
                <Link key={booking.id} href={`/dashboard/bookings/${booking.id}`} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#faf6ef] sm:px-5">
                  <div className="w-14 shrink-0 text-right">
                    <p className="text-xs font-semibold tabular-nums text-ink">{formatTime(booking.startsAt, context.tenant.timezone)}</p>
                    <p className="text-[9px] tabular-nums text-muted">{formatTime(booking.endsAt, context.tenant.timezone)}</p>
                  </div>
                  <span className="h-9 w-0.5 shrink-0 rounded-full" style={{ background: staff.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{service.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {customer.name} · with {staff.name.split(" ")[0]}
                      {booking.customerNote ? ` · “${booking.customerNote}”` : ""}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Needs your attention" description="Genuine items from this workspace">
            <div className="divide-y divide-[#efeae1]">
              {latestApproval && (
                <Link href="/dashboard/assistant" className="flex items-start gap-3 px-4 py-3.5 hover:bg-[#faf6ef] sm:px-5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f5e8d8] text-[#8c5b30]"><Sparkles className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink">AI draft awaiting approval</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">{latestApproval.artifact?.title ?? "Prepared workflow"}</p>
                  </div>
                  <span className="dash-chip bg-[#f5e8d8] text-[#8c5b30]">Review</span>
                </Link>
              )}
              {data.pendingCount > 0 && (
                <Link href="/dashboard/bookings?status=pending" className="flex items-start gap-3 px-4 py-3.5 hover:bg-[#faf6ef] sm:px-5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f7ecda] text-[#8e612f]"><Clock className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink">{data.pendingCount} booking{data.pendingCount === 1 ? "" : "s"} pending</p>
                    <p className="mt-0.5 text-[11px] text-muted">Confirm or cancel from the bookings view.</p>
                  </div>
                  <ArrowRight className="mt-1 h-3.5 w-3.5 text-muted" />
                </Link>
              )}
              {data.draftUnpublished && (
                <Link href="/dashboard/storefront" className="flex items-start gap-3 px-4 py-3.5 hover:bg-[#faf6ef] sm:px-5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e6efe7] text-[#2f5c42]"><Store className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink">Storefront draft is unpublished</p>
                    <p className="mt-0.5 text-[11px] text-muted">Preview and publish your changes when ready.</p>
                  </div>
                  <span className="dash-chip bg-[#e6efe7] text-[#2f5c42]">Publish</span>
                </Link>
              )}
              {!latestApproval && data.pendingCount === 0 && !data.draftUnpublished && (
                <div className="flex items-center gap-2.5 px-4 py-4 text-xs text-muted sm:px-5">
                  <Check className="h-4 w-4 text-forest" /> Nothing needs your attention right now.
                </div>
              )}
            </div>
          </SectionCard>

          <div className="overflow-hidden rounded-xl bg-forest p-5 text-ivory">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brass" />
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-brass">Nuru assistant</p>
            </div>
            <p className="mt-3 font-display text-2xl leading-snug">
              {data.latestRun
                ? data.latestRun.status === "awaiting_approval"
                  ? "Your promotion draft is ready for review."
                  : "Your assistant has been working."
                : "There is a little more room in the diary this week."}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-ivory/65">
              {data.latestRun?.result && typeof data.latestRun.result.summary === "string"
                ? data.latestRun.result.summary
                : "Ask Nuru to find quieter slots, draft a campaign, or refresh your storefront copy."}
            </p>
            <Link href="/dashboard/assistant" className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ivory hover:text-brass">
              Open assistant <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <SectionCard
          title="Coming up"
          description="The next seven days"
          action={<Link href="/dashboard/calendar" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-forest hover:underline">View week</Link>}
        >
          {data.upcoming.length === 0 ? (
            <EmptyState title="Nothing booked yet" description="Share your storefront or create availability to fill the week." />
          ) : (
            <div className="overflow-x-auto">
              <table className="dash-table w-full">
                <thead>
                  <tr><th>When</th><th>Treatment</th><th>Client</th><th>Therapist</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.upcoming.map(({ booking, customer, service, staff }) => (
                    <tr key={booking.id} className="hover:bg-[#faf6ef]">
                      <td className="whitespace-nowrap">
                        <Link href={`/dashboard/bookings/${booking.id}`} className="block">
                          <span className="text-xs font-medium">{relativeDayLabel(booking.startsAt, context.tenant.timezone)}</span>
                          <span className="block text-[10px] text-muted">{formatTime(booking.startsAt, context.tenant.timezone)}</span>
                        </Link>
                      </td>
                      <td><Link href={`/dashboard/bookings/${booking.id}`} className="text-xs font-medium hover:text-forest">{service.name}</Link></td>
                      <td><span className="text-xs">{customer.name}</span></td>
                      <td><span className="text-xs text-muted">{staff.name.split(" ")[0]}</span></td>
                      <td><StatusBadge status={booking.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent activity" description="Booking status changes recorded in the audit trail">
          {activities.length === 0 ? (
            <EmptyState title="No activity yet" description="Status changes will appear here with who made them and when." />
          ) : (
            <div className="divide-y divide-[#efeae1]">
              {activities.map(({ history, booking, customer }) => (
                <div key={history.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#efe9df] text-muted">
                    <UserRound className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-relaxed text-ink">
                      <span className="font-medium">{customer.name}</span> · {booking.reference} moved to{" "}
                      <span className="font-medium">{history.toStatus.replace("_", " ")}</span>
                    </p>
                    <p className="mt-0.5 text-[9px] text-muted">
                      {formatDate(history.createdAt, context.tenant.timezone, "d MMM, h:mm a")} · {booking.isDemo ? "Demo record" : "Live record"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/dashboard/storefront", icon: Eye, title: "Preview the storefront", body: "Review the draft on desktop and mobile before publishing." },
          { href: "/dashboard/marketing", icon: Megaphone, title: "Review marketing", body: "See simulated sends, consent counts and campaign history." },
          { href: "/dashboard/calendar", icon: CalendarDays, title: "Plan the week", body: "Day and week views, therapist filters and time off." },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="dash-card group flex items-start gap-3 p-4 transition-colors hover:border-forest/25">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#efe9df] text-forest"><item.icon className="h-4 w-4" /></span>
            <div>
              <p className="text-xs font-semibold text-ink">{item.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{item.body}</p>
            </div>
            <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
