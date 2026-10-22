import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Activity, ArrowUpRight, CalendarDays, CircleUserRound, Database, Layers, ShieldCheck, Store, Users } from "lucide-react";
import { StatCard } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { auditEvents, bookings, tenantDomains, tenantSubscriptions, tenants, users } from "@/db/schema";
import { getTenantStats } from "@/lib/dashboard-data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusStyles: Record<string, string> = {
  active: "bg-[#e6efe7] text-[#2f5c42]",
  suspended: "bg-[#f6e4df] text-[#8f4332]",
  draft: "bg-[#f2f0ec] text-[#6f6a63]",
};

export default async function AdminPage() {
  const db = await ensureDb();
  const [tenantRows, domains, subscriptions, totalUsers, totalBookings, recentEvents] = await Promise.all([
    db.select().from(tenants).orderBy(tenants.createdAt),
    db.select().from(tenantDomains),
    db.select().from(tenantSubscriptions),
    db.select({ value: sql<number>`count(*)::int` }).from(users),
    db.select({ value: sql<number>`count(*)::int` }).from(bookings),
    db
      .select({ event: auditEvents, tenant: tenants })
      .from(auditEvents)
      .leftJoin(tenants, eq(tenants.id, auditEvents.tenantId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(12),
  ]);

  const stats = await Promise.all(tenantRows.map((tenant) => getTenantStats(db, tenant.id)));
  const pendingApprovals = stats.reduce((sum, row) => sum + row.pendingApprovals, 0);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-brass">Nuru Wellness</p>
          <h1 className="mt-1.5 font-display text-[clamp(2.1rem,3.4vw,2.8rem)] leading-none text-forest">Platform overview</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Every workspace on this deployment, with record counts read live from the database. Tenants remain isolated from one another; this view is for the platform operator only.
          </p>
        </div>
        <span className="dash-chip border border-line bg-paper text-muted"><ShieldCheck className="h-3 w-3" /> Platform admin</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Workspaces" value={tenantRows.length} note={`${tenantRows.filter((row) => row.isDemo).length} demo tenants`} />
        <StatCard label="Total users" value={Number(totalUsers[0]?.value ?? 0)} note="Across all workspaces" accent="clay" />
        <StatCard label="Bookings" value={Number(totalBookings[0]?.value ?? 0)} note="All statuses, all tenants" />
        <StatCard label="Pending approvals" value={pendingApprovals} note="AI actions paused for a human" accent="brass" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {tenantRows.map((tenant, index) => {
          const stat = stats[index];
          const primary = domains.find((domain) => domain.tenantId === tenant.id && domain.isPrimary);
          const subscription = subscriptions.find((row) => row.tenantId === tenant.id);
          return (
            <section key={tenant.id} className="dash-card overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#efe9df] font-display text-lg text-forest">{tenant.name.slice(0, 1)}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-ink">{tenant.name}</h2>
                      <span className={`dash-chip ${statusStyles[tenant.status] ?? "bg-[#f2f0ec] text-[#6f6a63]"}`}>{tenant.status}</span>
                      {tenant.isDemo && <span className="dash-chip bg-[#f7ecda] text-[#8e612f]">Demo</span>}
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-muted">{tenant.slug} · {primary?.hostname ?? "no domain"}</p>
                  </div>
                </div>
                <Link href="/dashboard" className="dash-btn dash-btn-ghost" aria-label={`Open ${tenant.name} workspace`}>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-3 divide-x divide-[#efeae1] border-b border-line">
                <div className="px-4 py-3"><p className="text-[9px] uppercase tracking-[0.1em] text-muted">Bookings</p><p className="mt-1 font-display text-xl text-forest">{stat.bookings}</p></div>
                <div className="px-4 py-3"><p className="text-[9px] uppercase tracking-[0.1em] text-muted">Clients</p><p className="mt-1 font-display text-xl text-forest">{stat.customers}</p></div>
                <div className="px-4 py-3"><p className="text-[9px] uppercase tracking-[0.1em] text-muted">Team</p><p className="mt-1 font-display text-xl text-forest">{stat.staff}</p></div>
              </div>
              <div className="space-y-2 px-4 py-4 text-[11px] sm:px-5">
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted"><Layers className="h-3 w-3" /> Plan</span><span className="text-ink">{subscription?.plan ?? "—"} · {subscription?.status ?? "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted"><Store className="h-3 w-3" /> Treatments</span><span className="text-ink">{stat.services}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted"><CalendarDays className="h-3 w-3" /> Timezone</span><span className="text-ink">{tenant.timezone}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted"><Activity className="h-3 w-3" /> Pending approvals</span><span className="text-ink">{stat.pendingApprovals}</span></div>
              </div>
              <div className="border-t border-line bg-[#faf6ef] px-4 py-2.5 text-[9px] text-muted sm:px-5">
                Created {formatDate(tenant.createdAt, "UTC", "d MMM yyyy")}. Tenant IDs are never accepted from client input for authorization.
              </div>
            </section>
          );
        })}
      </div>

      <section className="dash-card mt-5 overflow-hidden">
        <div className="border-b border-line px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-semibold text-ink">Recent audit events</h2>
          <p className="mt-0.5 text-[11px] text-muted">Write operations recorded with the acting user and tenant</p>
        </div>
        {recentEvents.length === 0 ? (
          <p className="px-4 py-6 text-[11px] text-muted sm:px-5">No audit events yet.</p>
        ) : (
          <div className="divide-y divide-[#efeae1]">
            {recentEvents.map(({ event, tenant }) => (
              <div key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5">
                <span className="font-mono text-[10px] font-medium text-ink">{event.action}</span>
                <span className="text-[10px] text-muted">{tenant?.name ?? "Platform"}</span>
                <span className="text-[10px] text-muted">· {event.resourceType}</span>
                <span className="ml-auto text-[9px] text-muted">{formatDate(event.createdAt, "UTC", "d MMM, h:mm a")}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1.5"><Users className="h-3 w-3" /> {tenantRows.length} workspaces</span>
        <span className="flex items-center gap-1.5"><Database className="h-3 w-3" /> Live database counts</span>
        <span className="flex items-center gap-1.5"><CircleUserRound className="h-3 w-3" /> Platform operator only</span>
      </div>
    </div>
  );
}
