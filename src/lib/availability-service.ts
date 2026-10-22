import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import type { Database } from "@/db";
import {
  bookingHolds,
  bookings,
  businessHours,
  serviceAddons,
  services,
  staffAvailability,
  staffProfiles,
  staffServices,
  timeOff,
  type Service,
  type StaffProfile,
} from "@/db/schema";
import type { Tenant } from "@/db/schema";
import { calculateAvailability, weekdayForDate, type Slot } from "./availability";
import { formatInTimeZone } from "date-fns-tz";

export type ResolvedBookingSelection = {
  service: Service;
  addons: { id: string; name: string; priceCents: number; durationMinutes: number }[];
  totalDurationMinutes: number;
  totalPriceCents: number;
};

export async function resolveSelection(
  db: Database,
  tenantId: string,
  serviceId: string,
  addonIds: string[] = [],
): Promise<ResolvedBookingSelection | null> {
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.tenantId, tenantId), eq(services.isActive, true)))
    .limit(1);
  if (!service) return null;

  let addons: ResolvedBookingSelection["addons"] = [];
  if (addonIds.length) {
    const rows = await db
      .select()
      .from(serviceAddons)
      .where(
        and(
          eq(serviceAddons.tenantId, tenantId),
          eq(serviceAddons.isActive, true),
          inArray(serviceAddons.id, addonIds),
        ),
      );
    addons = rows
      .filter((addon) => !addon.serviceId || addon.serviceId === serviceId)
      .map((addon) => ({
        id: addon.id,
        name: addon.name,
        priceCents: addon.priceCents,
        durationMinutes: addon.durationMinutes,
      }));
  }

  return {
    service,
    addons,
    totalDurationMinutes: service.durationMinutes + addons.reduce((sum, addon) => sum + addon.durationMinutes, 0),
    totalPriceCents: service.priceCents + addons.reduce((sum, addon) => sum + addon.priceCents, 0),
  };
}

export async function assertStaffCanPerform(db: Database, tenantId: string, staffId: string, serviceId: string) {
  const [staff] = await db
    .select()
    .from(staffAvailability)
    .where(and(eq(staffAvailability.tenantId, tenantId), eq(staffAvailability.staffId, staffId)))
    .limit(1);
  if (!staff) return false;
  const [link] = await db
    .select()
    .from(staffServices)
    .where(
      and(
        eq(staffServices.tenantId, tenantId),
        eq(staffServices.staffId, staffId),
        eq(staffServices.serviceId, serviceId),
      ),
    )
    .limit(1);
  return Boolean(link);
}

export async function eligibleStaffForService(db: Database, tenantId: string, serviceId: string): Promise<StaffProfile[]> {
  const links = await db
    .select()
    .from(staffServices)
    .where(and(eq(staffServices.tenantId, tenantId), eq(staffServices.serviceId, serviceId)));
  if (!links.length) return [];
  const rows = await db
    .select()
    .from(staffProfiles)
    .where(and(eq(staffProfiles.tenantId, tenantId), eq(staffProfiles.isActive, true)))
    .orderBy(asc(staffProfiles.sortOrder));
  return rows.filter((staff) => links.some((link) => link.staffId === staff.id));
}

export type AvailabilityResult = {
  slots: Slot[];
  timezone: string;
  dateKey: string;
  selection: ResolvedBookingSelection;
};

export async function getAvailabilityForSelection(
  db: Database,
  tenant: Tenant,
  input: { serviceId: string; staffId: string; dateKey: string; addonIds?: string[]; excludeBookingId?: string },
): Promise<AvailabilityResult | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKey)) return null;
  const selection = await resolveSelection(db, tenant.id, input.serviceId, input.addonIds ?? []);
  if (!selection) return null;
  const canPerform = await assertStaffCanPerform(db, tenant.id, input.staffId, input.serviceId);
  if (!canPerform) return null;

  const weekday = weekdayForDate(input.dateKey);
  const [hours] = await db
    .select()
    .from(businessHours)
    .where(and(eq(businessHours.tenantId, tenant.id), eq(businessHours.weekday, weekday)))
    .limit(1);

  const availability = await db
    .select()
    .from(staffAvailability)
    .where(
      and(
        eq(staffAvailability.tenantId, tenant.id),
        eq(staffAvailability.staffId, input.staffId),
        eq(staffAvailability.weekday, weekday),
        eq(staffAvailability.isActive, true),
      ),
    );

  const dayStart = new Date(`${input.dateKey}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 2 * 86_400_000);

  const [existing, off, holds] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.tenantId, tenant.id),
          eq(bookings.staffId, input.staffId),
          inArray(bookings.status, ["pending", "confirmed"]),
          lt(bookings.startsAt, dayEnd),
          gt(bookings.endsAt, new Date(dayStart.getTime() - 2 * 86_400_000)),
        ),
      ),
    db
      .select()
      .from(timeOff)
      .where(
        and(
          eq(timeOff.tenantId, tenant.id),
          eq(timeOff.staffId, input.staffId),
          lt(timeOff.startsAt, dayEnd),
          gt(timeOff.endsAt, dayStart),
        ),
      ),
    db
      .select()
      .from(bookingHolds)
      .where(
        and(
          eq(bookingHolds.tenantId, tenant.id),
          eq(bookingHolds.staffId, input.staffId),
          gt(bookingHolds.expiresAt, new Date()),
          lt(bookingHolds.startsAt, dayEnd),
        ),
      ),
  ]);

  const service = {
    durationMinutes: selection.totalDurationMinutes,
    bufferBeforeMinutes: selection.service.bufferBeforeMinutes,
    bufferAfterMinutes: selection.service.bufferAfterMinutes,
  };

  const slots = calculateAvailability({
    dateKey: input.dateKey,
    timezone: tenant.timezone,
    service,
    businessHours: hours ? { opensAt: hours.opensAt, closesAt: hours.closesAt, isClosed: hours.isClosed } : null,
    staffAvailability: availability.map((a) => ({ start: a.startTime, end: a.endTime })),
    timeOff: off.map((o) => ({ start: o.startsAt, end: o.endsAt })),
    bookings: existing
      .filter((booking) => booking.id !== input.excludeBookingId)
      .map((booking) => ({
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        bufferBeforeMinutes: booking.bufferBeforeMinutes,
        bufferAfterMinutes: booking.bufferAfterMinutes,
        status: booking.status,
      })),
    holds: holds.map((hold) => ({ start: hold.startsAt, end: hold.endsAt })),
    leadTimeMinutes: 90,
    slotStepMinutes: 15,
  });

  return { slots, timezone: tenant.timezone, dateKey: input.dateKey, selection };
}

export function formatSlotTime(iso: string, timezone: string) {
  return formatInTimeZone(new Date(iso), timezone, "h:mm a");
}

export async function findNextAvailableSlot(
  db: Database,
  tenant: Tenant,
  serviceId: string,
  staffId: string,
  maxDays = 14,
): Promise<{ dateKey: string; slot: Slot } | null> {
  const { addDays } = await import("date-fns");
  const { formatInTimeZone } = await import("date-fns-tz");
  for (let offset = 0; offset < maxDays; offset += 1) {
    const dateKey = formatInTimeZone(addDays(new Date(), offset), tenant.timezone, "yyyy-MM-dd");
    const result = await getAvailabilityForSelection(db, tenant, { serviceId, staffId, dateKey });
    if (result?.slots.length) return { dateKey, slot: result.slots[0] };
  }
  return null;
}
