import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Database } from "@/db";
import {
  agentArtifacts,
  agentRuns,
  agentSteps,
  approvalRequests,
  bookingItems,
  bookingStatusHistory,
  bookings,
  businessHours,
  campaignRecipients,
  campaigns,
  customerConsents,
  customers,
  integrationConnections,
  locations,
  notificationPreferences,
  outboundMessages,
  serviceAddons,
  services,
  staffAvailability,
  staffProfiles,
  staffServices,
  storefrontConfigs,
  tenants,
  timeOff,
  users,
  type BookingStatus,
  type Tenant,
} from "@/db/schema";

export function localDayWindow(dateKey: string, timezone: string) {
  const start = fromZonedTime(`${dateKey}T00:00:00`, timezone);
  const end = fromZonedTime(`${formatInTimeZone(addDays(parseISO(`${dateKey}T12:00:00`), 1), timezone, "yyyy-MM-dd")}T00:00:00`, timezone);
  return { start, end };
}

export function todayKey(timezone: string) {
  return formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
}

export function weekKeys(dateKey: string, startOnMonday = true) {
  const date = parseISO(`${dateKey}T12:00:00`);
  const day = date.getDay();
  const offset = startOnMonday ? (day === 0 ? -6 : 1 - day) : -day;
  return Array.from({ length: 7 }, (_, index) => {
    const next = addDays(date, offset + index);
    return { key: format(next, "yyyy-MM-dd"), date: next };
  });
}

export async function getCalendarDay(db: Database, tenant: Tenant, dateKey: string, staffId?: string) {
  const { start, end } = localDayWindow(dateKey, tenant.timezone);
  const [rows, offRows, staffRows] = await Promise.all([
    db
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
          staffId ? eq(bookings.staffId, staffId) : undefined,
        ),
      )
      .orderBy(asc(bookings.startsAt)),
    db
      .select({ timeOff, staff: staffProfiles })
      .from(timeOff)
      .innerJoin(staffProfiles, eq(staffProfiles.id, timeOff.staffId))
      .where(
        and(
          eq(timeOff.tenantId, tenant.id),
          lt(timeOff.startsAt, end),
          gte(timeOff.endsAt, start),
          staffId ? eq(timeOff.staffId, staffId) : undefined,
        ),
      )
      .orderBy(asc(timeOff.startsAt)),
    db
      .select()
      .from(staffProfiles)
      .where(and(eq(staffProfiles.tenantId, tenant.id), eq(staffProfiles.isActive, true)))
      .orderBy(asc(staffProfiles.sortOrder)),
  ]);
  return { dateKey, start, end, rows, timeOff: offRows, staff: staffRows };
}

export async function getCalendarWeek(db: Database, tenant: Tenant, dateKey: string, staffId?: string) {
  const keys = weekKeys(dateKey);
  const start = localDayWindow(keys[0].key, tenant.timezone).start;
  const end = localDayWindow(keys[6].key, tenant.timezone).end;
  const rows = await db
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
        staffId ? eq(bookings.staffId, staffId) : undefined,
      ),
    )
    .orderBy(asc(bookings.startsAt));

  const staff = await db
    .select()
    .from(staffProfiles)
    .where(and(eq(staffProfiles.tenantId, tenant.id), eq(staffProfiles.isActive, true)))
    .orderBy(asc(staffProfiles.sortOrder));

  return {
    days: keys.map((key) => ({
      ...key,
      rows: rows.filter((row) => formatInTimeZone(row.booking.startsAt, tenant.timezone, "yyyy-MM-dd") === key.key),
    })),
    staff,
  };
}

export type BookingFilters = {
  status?: BookingStatus | "all";
  query?: string;
  staffId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export async function listBookings(db: Database, tenant: Tenant, filters: BookingFilters = {}) {
  const conditions = [eq(bookings.tenantId, tenant.id)];
  if (filters.status && filters.status !== "all") conditions.push(eq(bookings.status, filters.status));
  if (filters.staffId) conditions.push(eq(bookings.staffId, filters.staffId));
  if (filters.from) conditions.push(gte(bookings.startsAt, fromZonedTime(`${filters.from}T00:00:00`, tenant.timezone)));
  if (filters.to) conditions.push(lt(bookings.startsAt, localDayWindow(filters.to, tenant.timezone).end));
  if (filters.query) {
    const term = `%${filters.query.trim()}%`;
    conditions.push(
      or(
        ilike(bookings.reference, term),
        ilike(customers.name, term),
        ilike(customers.email, term),
        ilike(customers.phone, term),
        ilike(services.name, term),
      )!,
    );
  }

  return db
    .select({ booking: bookings, customer: customers, service: services, staff: staffProfiles })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, bookings.staffId))
    .where(and(...conditions))
    .orderBy(desc(bookings.startsAt))
    .limit(filters.limit ?? 300);
}

export async function getBookingDetail(db: Database, tenantId: string, bookingId: string) {
  const [row] = await db
    .select({ booking: bookings, customer: customers, service: services, staff: staffProfiles, location: locations })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, bookings.staffId))
    .leftJoin(locations, eq(locations.id, bookings.locationId))
    .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, tenantId)))
    .limit(1);
  if (!row) return null;
  const [items, history, otherBookings] = await Promise.all([
    db.select().from(bookingItems).where(and(eq(bookingItems.tenantId, tenantId), eq(bookingItems.bookingId, bookingId))),
    db
      .select({ history: bookingStatusHistory, user: users })
      .from(bookingStatusHistory)
      .leftJoin(users, eq(users.id, bookingStatusHistory.changedByUserId))
      .where(and(eq(bookingStatusHistory.tenantId, tenantId), eq(bookingStatusHistory.bookingId, bookingId)))
      .orderBy(desc(bookingStatusHistory.createdAt)),
    db
      .select({ booking: bookings, service: services })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .where(and(eq(bookings.tenantId, tenantId), eq(bookings.customerId, row.customer.id), ne(bookings.id, bookingId)))
      .orderBy(desc(bookings.startsAt))
      .limit(5),
  ]);
  return { ...row, items, history, otherBookings };
}

export async function listCustomers(db: Database, tenantId: string, query?: string) {
  const rows = await db
    .select()
    .from(customers)
    .where(
      query
        ? and(
            eq(customers.tenantId, tenantId),
            or(ilike(customers.name, `%${query}%`), ilike(customers.email, `%${query}%`), ilike(customers.phone, `%${query}%`)),
          )
        : eq(customers.tenantId, tenantId),
    )
    .orderBy(asc(customers.name));

  const stats = await db
    .select({
      customerId: bookings.customerId,
      visits: count(),
      totalSpend: sql<number>`coalesce(sum(case when ${bookings.status} = 'completed' then ${bookings.priceCents} else 0 end), 0)::int`,
      lastVisit: sql<Date | null>`max(${bookings.startsAt})`,
      upcoming: sql<number>`count(case when ${bookings.startsAt} > now() and ${bookings.status} in ('pending','confirmed') then 1 end)::int`,
    })
    .from(bookings)
    .where(and(eq(bookings.tenantId, tenantId), ne(bookings.status, "cancelled")))
    .groupBy(bookings.customerId);

  const consents = await db
    .select()
    .from(customerConsents)
    .where(and(eq(customerConsents.tenantId, tenantId), eq(customerConsents.type, "marketing")));

  return rows.map((customer) => {
    const stat = stats.find((entry) => entry.customerId === customer.id);
    const consent = consents.find((entry) => entry.customerId === customer.id);
    return {
      customer,
      visits: Number(stat?.visits ?? 0),
      upcoming: Number(stat?.upcoming ?? 0),
      totalSpend: Number(stat?.totalSpend ?? 0),
      lastVisit: stat?.lastVisit ? new Date(stat.lastVisit) : null,
      marketingConsent: consent?.granted ?? false,
    };
  });
}

export async function getCustomerDetail(db: Database, tenantId: string, customerId: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
    .limit(1);
  if (!customer) return null;
  const [history, consents, preferences, notes] = await Promise.all([
    db
      .select({ booking: bookings, service: services, staff: staffProfiles })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(staffProfiles, eq(staffProfiles.id, bookings.staffId))
      .where(and(eq(bookings.tenantId, tenantId), eq(bookings.customerId, customerId)))
      .orderBy(desc(bookings.startsAt)),
    db.select().from(customerConsents).where(and(eq(customerConsents.tenantId, tenantId), eq(customerConsents.customerId, customerId))),
    db
      .select()
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.tenantId, tenantId), eq(notificationPreferences.customerId, customerId)))
      .limit(1),
    db
      .select()
      .from(outboundMessages)
      .where(and(eq(outboundMessages.tenantId, tenantId), eq(outboundMessages.customerId, customerId)))
      .orderBy(desc(outboundMessages.createdAt))
      .limit(8),
  ]);
  return { customer, history, consents, preferences: preferences[0] ?? null, messages: notes };
}

export async function listServices(db: Database, tenantId: string) {
  const [rows, addons, links, staff] = await Promise.all([
    db.select().from(services).where(eq(services.tenantId, tenantId)).orderBy(asc(services.sortOrder)),
    db.select().from(serviceAddons).where(eq(serviceAddons.tenantId, tenantId)).orderBy(asc(serviceAddons.name)),
    db.select().from(staffServices).where(eq(staffServices.tenantId, tenantId)),
    db
      .select()
      .from(staffProfiles)
      .where(and(eq(staffProfiles.tenantId, tenantId), eq(staffProfiles.isActive, true)))
      .orderBy(asc(staffProfiles.sortOrder)),
  ]);
  return rows.map((service) => ({
    service,
    addons: addons.filter((addon) => addon.serviceId === service.id),
    staff: staff.filter((person) => links.some((link) => link.serviceId === service.id && link.staffId === person.id)),
    allStaff: staff,
  }));
}

export async function listStaff(db: Database, tenantId: string) {
  const [staff, availability, off, links, serviceRows] = await Promise.all([
    db.select().from(staffProfiles).where(eq(staffProfiles.tenantId, tenantId)).orderBy(asc(staffProfiles.sortOrder)),
    db.select().from(staffAvailability).where(eq(staffAvailability.tenantId, tenantId)).orderBy(asc(staffAvailability.weekday)),
    db
      .select()
      .from(timeOff)
      .where(and(eq(timeOff.tenantId, tenantId), gte(timeOff.endsAt, new Date())))
      .orderBy(asc(timeOff.startsAt)),
    db.select().from(staffServices).where(eq(staffServices.tenantId, tenantId)),
    db.select().from(services).where(eq(services.tenantId, tenantId)).orderBy(asc(services.sortOrder)),
  ]);
  return {
    staff: staff.map((person) => ({
      person,
      availability: availability.filter((row) => row.staffId === person.id),
      timeOff: off.filter((row) => row.staffId === person.id),
      services: serviceRows.filter((service) => links.some((link) => link.staffId === person.id && link.serviceId === service.id)),
    })),
    allServices: serviceRows,
  };
}

export async function getBusinessHours(db: Database, tenantId: string) {
  return db.select().from(businessHours).where(eq(businessHours.tenantId, tenantId)).orderBy(asc(businessHours.weekday));
}

export async function listCampaigns(db: Database, tenantId: string) {
  const [rows, recipients, messages] = await Promise.all([
    db.select().from(campaigns).where(eq(campaigns.tenantId, tenantId)).orderBy(desc(campaigns.createdAt)),
    db.select().from(campaignRecipients).where(eq(campaignRecipients.tenantId, tenantId)),
    db.select().from(outboundMessages).where(eq(outboundMessages.tenantId, tenantId)).orderBy(desc(outboundMessages.createdAt)).limit(30),
  ]);
  return rows.map((campaign) => ({
    campaign,
    recipients: recipients.filter((entry) => entry.campaignId === campaign.id),
    messages: messages.filter((entry) => entry.campaignId === campaign.id),
  }));
}

export async function getMarketingStats(db: Database, tenantId: string) {
  const [customerRows, consents, messageRows] = await Promise.all([
    db.select({ value: count() }).from(customers).where(eq(customers.tenantId, tenantId)),
    db
      .select({ granted: customerConsents.granted, value: count() })
      .from(customerConsents)
      .where(and(eq(customerConsents.tenantId, tenantId), eq(customerConsents.type, "marketing")))
      .groupBy(customerConsents.granted),
    db
      .select({ status: outboundMessages.status, value: count() })
      .from(outboundMessages)
      .where(eq(outboundMessages.tenantId, tenantId))
      .groupBy(outboundMessages.status),
  ]);
  return {
    customers: Number(customerRows[0]?.value ?? 0),
    consented: Number(consents.find((row) => row.granted)?.["value"] ?? 0),
    declined: Number(consents.find((row) => !row.granted)?.["value"] ?? 0),
    messages: Object.fromEntries(messageRows.map((row) => [row.status, Number(row.value)])),
  };
}

export async function listAgentRuns(db: Database, tenantId: string, limit = 20) {
  const runs = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.tenantId, tenantId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit);

  const [steps, artifacts, approvals] = await Promise.all([
    db.select().from(agentSteps).where(eq(agentSteps.tenantId, tenantId)).orderBy(asc(agentSteps.stepIndex)),
    db.select().from(agentArtifacts).where(eq(agentArtifacts.tenantId, tenantId)).orderBy(desc(agentArtifacts.createdAt)),
    db.select().from(approvalRequests).where(eq(approvalRequests.tenantId, tenantId)).orderBy(desc(approvalRequests.createdAt)),
  ]);

  return runs.map((run) => ({
    run,
    steps: steps.filter((step) => step.runId === run.id),
    artifacts: artifacts.filter((artifact) => artifact.runId === run.id),
    approvals: approvals.filter((approval) => approval.runId === run.id),
  }));
}

export async function getIntegrationConnections(db: Database, tenantId: string) {
  return db.select().from(integrationConnections).where(eq(integrationConnections.tenantId, tenantId)).orderBy(asc(integrationConnections.provider));
}

export async function getStorefrontConfigRow(db: Database, tenantId: string) {
  const [row] = await db.select().from(storefrontConfigs).where(eq(storefrontConfigs.tenantId, tenantId)).limit(1);
  return row ?? null;
}

export async function listDemoTenants(db: Database) {
  return db
    .select({
      tenant: tenants,
      subscriptions: sql<number>`0::int`,
    })
    .from(tenants)
    .orderBy(asc(tenants.name));
}

export async function getTenantStats(db: Database, tenantId: string) {
  const [bookingCount, customerCount, staffCount, serviceCount, latestApproval] = await Promise.all([
    db.select({ value: count() }).from(bookings).where(and(eq(bookings.tenantId, tenantId), ne(bookings.status, "cancelled"))),
    db.select({ value: count() }).from(customers).where(eq(customers.tenantId, tenantId)),
    db.select({ value: count() }).from(staffProfiles).where(and(eq(staffProfiles.tenantId, tenantId), eq(staffProfiles.isActive, true))),
    db.select({ value: count() }).from(services).where(and(eq(services.tenantId, tenantId), eq(services.isActive, true))),
    db
      .select({ value: count() })
      .from(approvalRequests)
      .where(and(eq(approvalRequests.tenantId, tenantId), eq(approvalRequests.status, "pending"))),
  ]);
  return {
    bookings: Number(bookingCount[0]?.value ?? 0),
    customers: Number(customerCount[0]?.value ?? 0),
    staff: Number(staffCount[0]?.value ?? 0),
    services: Number(serviceCount[0]?.value ?? 0),
    pendingApprovals: Number(latestApproval[0]?.value ?? 0),
  };
}

export async function getCustomerOptions(db: Database, tenantId: string) {
  return db.select({ id: customers.id, name: customers.name, email: customers.email }).from(customers).where(eq(customers.tenantId, tenantId)).orderBy(asc(customers.name));
}

export async function getServiceOptions(db: Database, tenantId: string) {
  return db.select().from(services).where(and(eq(services.tenantId, tenantId), eq(services.isActive, true))).orderBy(asc(services.sortOrder));
}

export async function getStaffOptions(db: Database, tenantId: string) {
  return db
    .select()
    .from(staffProfiles)
    .where(and(eq(staffProfiles.tenantId, tenantId), eq(staffProfiles.isActive, true)))
    .orderBy(asc(staffProfiles.sortOrder));
}

export async function searchBookingsForCustomer(db: Database, tenantId: string, customerId: string, limit = 10) {
  return db
    .select({ booking: bookings, service: services })
    .from(bookings)
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .where(and(eq(bookings.tenantId, tenantId), eq(bookings.customerId, customerId)))
    .orderBy(desc(bookings.startsAt))
    .limit(limit);
}

export async function getHoursForWeekday(db: Database, tenantId: string, weekday: number) {
  const [row] = await db
    .select()
    .from(businessHours)
    .where(and(eq(businessHours.tenantId, tenantId), eq(businessHours.weekday, weekday)))
    .limit(1);
  return row ?? null;
}

export async function countNewCustomersThisMonth(db: Database, tenantId: string) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ value: count() })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), gte(customers.createdAt, start)));
  return Number(row?.value ?? 0);
}

export { lte, inArray };
