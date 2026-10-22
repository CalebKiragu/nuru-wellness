import "server-only";
import { and, asc, count, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Database } from "@/db";
import {
  agentArtifacts,
  agentRuns,
  approvalRequests,
  bookingStatusHistory,
  bookings,
  customers,
  dashboardNotifications,
  services,
  staffProfiles,
  storefrontConfigs,
  type Tenant,
} from "@/db/schema";

export function dayBounds(timezone: string, date = new Date()) {
  const key = formatInTimeZone(date, timezone, "yyyy-MM-dd");
  const start = fromZonedTime(`${key}T00:00:00`, timezone);
  const tomorrowKey = formatInTimeZone(new Date(start.getTime() + 26 * 3_600_000), timezone, "yyyy-MM-dd");
  const end = fromZonedTime(`${tomorrowKey}T00:00:00`, timezone);
  return { start, end, key };
}

export function weekBounds(timezone: string, date = new Date()) {
  const start = date;
  const end = new Date(date.getTime() + 7 * 86_400_000);
  return { start, end };
}

export async function getTodayBookings(db: Database, tenant: Tenant) {
  const { start, end } = dayBounds(tenant.timezone);
  return db
    .select({
      booking: bookings,
      customer: customers,
      service: services,
      staff: staffProfiles,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, bookings.staffId))
    .where(
      and(
        eq(bookings.tenantId, tenant.id),
        gte(bookings.startsAt, start),
        lt(bookings.startsAt, end),
        ne(bookings.status, "cancelled"),
      ),
    )
    .orderBy(asc(bookings.startsAt));
}

export async function getUpcomingBookings(db: Database, tenant: Tenant, limit = 6) {
  const { start, end } = weekBounds(tenant.timezone);
  return db
    .select({ booking: bookings, customer: customers, service: services, staff: staffProfiles })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, bookings.staffId))
    .where(
      and(
        eq(bookings.tenantId, tenant.id),
        gte(bookings.startsAt, start),
        lt(bookings.startsAt, end),
        ne(bookings.status, "cancelled"),
      ),
    )
    .orderBy(asc(bookings.startsAt))
    .limit(limit);
}

export async function getDashboardOverview(db: Database, tenant: Tenant) {
  const today = await getTodayBookings(db, tenant);
  const upcoming = await getUpcomingBookings(db, tenant);
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
  const { start: todayStart, end: todayEnd } = dayBounds(tenant.timezone);

  const [pendingRow] = await db
    .select({ value: count() })
    .from(bookings)
    .where(and(eq(bookings.tenantId, tenant.id), eq(bookings.status, "pending")));

  const [weekRow] = await db
    .select({ value: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantId, tenant.id),
        gte(bookings.startsAt, now),
        lt(bookings.startsAt, weekEnd),
        ne(bookings.status, "cancelled"),
      ),
    );

  const [clientRow] = await db
    .select({ value: count() })
    .from(customers)
    .where(eq(customers.tenantId, tenant.id));

  const recent = await db
    .select({
      history: bookingStatusHistory,
      booking: bookings,
      customer: customers,
    })
    .from(bookingStatusHistory)
    .innerJoin(bookings, eq(bookings.id, bookingStatusHistory.bookingId))
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(eq(bookingStatusHistory.tenantId, tenant.id))
    .orderBy(desc(bookingStatusHistory.createdAt))
    .limit(6);

  const approvals = await db
    .select({ approval: approvalRequests, artifact: agentArtifacts, run: agentRuns })
    .from(approvalRequests)
    .leftJoin(agentArtifacts, eq(agentArtifacts.id, approvalRequests.artifactId))
    .leftJoin(agentRuns, eq(agentRuns.id, approvalRequests.runId))
    .where(and(eq(approvalRequests.tenantId, tenant.id), eq(approvalRequests.status, "pending")))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(3);

  const [latestRun] = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.tenantId, tenant.id))
    .orderBy(desc(agentRuns.createdAt))
    .limit(1);

  const [config] = await db
    .select()
    .from(storefrontConfigs)
    .where(eq(storefrontConfigs.tenantId, tenant.id))
    .limit(1);

  const [unreadRow] = await db
    .select({ value: count() })
    .from(dashboardNotifications)
    .where(and(eq(dashboardNotifications.tenantId, tenant.id), sql`${dashboardNotifications.readAt} is null`));

  const draftUnpublished = config ? JSON.stringify(config.draft) !== JSON.stringify(config.published) : false;
  const nextAppointment = today.find((row) => row.booking.startsAt > now && row.booking.status !== "cancelled");

  return {
    today,
    upcoming,
    pendingCount: Number(pendingRow?.value ?? 0),
    weekCount: Number(weekRow?.value ?? 0),
    clientCount: Number(clientRow?.value ?? 0),
    recent,
    approvals,
    latestRun: latestRun ?? null,
    draftUnpublished,
    unreadCount: Number(unreadRow?.value ?? 0),
    nextAppointment: nextAppointment ?? null,
    dayStart: todayStart,
    dayEnd: todayEnd,
  };
}

export async function getUnreadNotifications(db: Database, tenantId: string) {
  return db
    .select()
    .from(dashboardNotifications)
    .where(and(eq(dashboardNotifications.tenantId, tenantId), sql`${dashboardNotifications.readAt} is null`))
    .orderBy(desc(dashboardNotifications.createdAt))
    .limit(8);
}
