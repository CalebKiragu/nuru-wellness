import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import type { Database } from "@/db";
import {
  bookingItems,
  bookingStatusHistory,
  bookings,
  customerConsents,
  customers,
  dashboardNotifications,
  notificationPreferences,
  type Booking,
  type BookingStatus,
  type Customer,
  type Tenant,
} from "@/db/schema";
import { getAvailabilityForSelection } from "@/lib/availability-service";
import { isSlotStillAvailable } from "@/lib/availability";
import { formatDateLong, formatTime } from "@/lib/format";
import { recordAudit } from "@/lib/audit";
import { deliverMessage, renderNotification } from "@/lib/notifications";
import type { CreateBookingPayload } from "@/lib/validation";

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeReference(tenantName: string) {
  const prefix = tenantName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "NRU";
  const bytes = randomBytes(6);
  let body = "";
  for (const byte of bytes) body += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  return `${prefix}-${body}`;
}

export class BookingError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "booking_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function findIdempotentBooking(db: Database, tenantId: string, idempotencyKey: string) {
  const [row] = await db
    .select({ booking: bookings, customer: customers })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(and(eq(bookings.tenantId, tenantId), eq(bookings.idempotencyKey, idempotencyKey)))
    .limit(1);
  return row ?? null;
}

export async function createBooking(
  db: Database,
  tenant: Tenant,
  payload: CreateBookingPayload,
  options: { actorUserId?: string | null; source?: string; ip?: string | null } = {},
): Promise<{ booking: Booking; customer: Customer; duplicate: boolean }> {
  const existing = await findIdempotentBooking(db, tenant.id, payload.idempotencyKey);
  if (existing) return { ...existing, duplicate: true };

  const start = new Date(payload.start);
  if (Number.isNaN(start.getTime())) throw new BookingError("That start time is not valid.");

  const dateKey = formatInTimeZone(start, tenant.timezone, "yyyy-MM-dd");
  const availability = await getAvailabilityForSelection(db, tenant, {
    serviceId: payload.serviceId,
    staffId: payload.staffId,
    dateKey,
    addonIds: payload.addonIds,
  });
  if (!availability) throw new BookingError("That treatment or therapist is not available.", 404);
  if (!isSlotStillAvailable(availability.slots, payload.start)) {
    throw new BookingError("That time is no longer available. Please choose another.", 409, "slot_unavailable");
  }

  const result = await db.transaction(async (trx) => {
    const tx = trx as unknown as Database;

    // Serialize booking attempts for this therapist/day. Combined with the
    // revalidation below, this prevents concurrent double bookings even when
    // two requests arrive with different idempotency keys.
    const lockKey = `${tenant.id}:${payload.staffId}:${dateKey}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`);

    const freshAvailability = await getAvailabilityForSelection(tx, tenant, {
      serviceId: payload.serviceId,
      staffId: payload.staffId,
      dateKey,
      addonIds: payload.addonIds,
    });
    if (!freshAvailability || !isSlotStillAvailable(freshAvailability.slots, payload.start)) {
      throw new BookingError("Someone just took that time. Please choose another slot.", 409, "slot_unavailable");
    }

    const email = payload.customer.email.toLowerCase();
    let [customer] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, tenant.id), eq(customers.email, email)))
      .limit(1);

    if (!customer) {
      [customer] = await tx
        .insert(customers)
        .values({
          tenantId: tenant.id,
          name: payload.customer.name,
          email,
          phone: payload.customer.phone,
          isDemo: tenant.isDemo,
        })
        .returning();
    } else {
      await tx
        .update(customers)
        .set({ name: payload.customer.name, phone: payload.customer.phone, updatedAt: new Date() })
        .where(and(eq(customers.id, customer.id), eq(customers.tenantId, tenant.id)));
    }

    const selection = freshAvailability.selection;
    const endsAt = new Date(start.getTime() + selection.totalDurationMinutes * 60_000);
    let booking: Booking | undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt < 4 && !booking; attempt += 1) {
      try {
        [booking] = await tx
          .insert(bookings)
          .values({
            tenantId: tenant.id,
            reference: makeReference(tenant.name),
            customerId: customer.id,
            staffId: payload.staffId,
            serviceId: payload.serviceId,
            startsAt: start,
            endsAt,
            bufferBeforeMinutes: selection.service.bufferBeforeMinutes,
            bufferAfterMinutes: selection.service.bufferAfterMinutes,
            status: "confirmed",
            source: options.source ?? "storefront",
            priceCents: selection.totalPriceCents,
            currency: tenant.currency,
            customerNote: payload.customer.note ?? null,
            idempotencyKey: payload.idempotencyKey,
            isDemo: tenant.isDemo,
            createdByUserId: options.actorUserId ?? null,
          })
          .returning();
      } catch (error) {
        lastError = error;
        const message = String(error);
        if (message.includes("bookings_reference_unique") || message.includes("reference")) continue;
        throw error;
      }
    }
    if (!booking) throw lastError ?? new Error("Could not create booking");

    await tx.insert(bookingItems).values([
      {
        tenantId: tenant.id,
        bookingId: booking.id,
        serviceId: selection.service.id,
        name: selection.service.name,
        durationMinutes: selection.service.durationMinutes,
        priceCents: selection.service.priceCents,
      },
      ...selection.addons.map((addon) => ({
        tenantId: tenant.id,
        bookingId: booking!.id,
        addonId: addon.id,
        name: addon.name,
        durationMinutes: addon.durationMinutes,
        priceCents: addon.priceCents,
      })),
    ]);

    await tx.insert(bookingStatusHistory).values({
      tenantId: tenant.id,
      bookingId: booking.id,
      fromStatus: null,
      toStatus: "confirmed",
      changedByUserId: options.actorUserId ?? null,
      reason: "Booking created",
    });

    await tx.insert(customerConsents).values([
      { tenantId: tenant.id, customerId: customer.id, type: "transactional", granted: true, source: "booking" },
      {
        tenantId: tenant.id,
        customerId: customer.id,
        type: "marketing",
        granted: payload.marketingConsent,
        source: "booking",
      },
    ]);

    await tx
      .insert(notificationPreferences)
      .values({
        tenantId: tenant.id,
        customerId: customer.id,
        transactionalEmail: true,
        marketingEmail: payload.marketingConsent,
      })
      .onConflictDoUpdate({
        target: [notificationPreferences.tenantId, notificationPreferences.customerId],
        set: { marketingEmail: payload.marketingConsent, updatedAt: new Date() },
      });

    await tx.insert(dashboardNotifications).values({
      tenantId: tenant.id,
      type: "booking_created",
      title: "New booking confirmed",
      body: `${customer.name} booked ${selection.service.name} for ${formatDateLong(start, tenant.timezone)} at ${formatTime(start, tenant.timezone)}.`,
    });

    await recordAudit(tx, {
      tenantId: tenant.id,
      actorUserId: options.actorUserId ?? null,
      action: "booking.created",
      resourceType: "booking",
      resourceId: booking.id,
      metadata: {
        reference: booking.reference,
        serviceId: selection.service.id,
        staffId: payload.staffId,
        startsAt: booking.startsAt.toISOString(),
        source: options.source ?? "storefront",
      },
      ip: options.ip ?? null,
    });

    return { booking, customer, serviceName: selection.service.name };
  });

  const when = `${formatDateLong(result.booking.startsAt, tenant.timezone)} at ${formatTime(result.booking.startsAt, tenant.timezone)}`;
  try {
    const rendered = renderNotification("booking_confirmed", {
      businessName: tenant.name,
      customerName: result.customer.name,
      serviceName: result.serviceName,
      when,
      reference: result.booking.reference,
    });
    await deliverMessage(db, {
      tenantId: tenant.id,
      customerId: result.customer.id,
      toAddress: result.customer.email ?? "",
      subject: rendered.subject,
      body: rendered.body,
      idempotencyKey: `booking-confirmed:${result.booking.id}`,
    });
  } catch (error) {
    console.error("booking_notification_failed", { bookingId: result.booking.id, error: String(error) });
  }

  return { ...result, duplicate: false };
}

const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  cancelled: [],
  completed: [],
  no_show: [],
};

export async function updateBookingStatus(
  db: Database,
  input: {
    tenantId: string;
    bookingId: string;
    status: "confirmed" | "cancelled" | "completed" | "no_show";
    actorUserId: string;
    reason?: string;
    ip?: string | null;
  },
) {
  const [row] = await db
    .select({ booking: bookings, customer: customers })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(and(eq(bookings.id, input.bookingId), eq(bookings.tenantId, input.tenantId)))
    .limit(1);

  if (!row) throw new BookingError("Booking not found.", 404);
  if (!allowedTransitions[row.booking.status].includes(input.status)) {
    throw new BookingError(`A ${row.booking.status.replace("_", " ")} booking cannot be marked ${input.status.replace("_", " ")}.`, 409, "invalid_transition");
  }

  const [updated] = await db
    .update(bookings)
    .set({
      status: input.status,
      updatedAt: new Date(),
      cancelledAt: input.status === "cancelled" ? new Date() : row.booking.cancelledAt,
    })
    .where(and(eq(bookings.id, input.bookingId), eq(bookings.tenantId, input.tenantId)))
    .returning();

  await db.insert(bookingStatusHistory).values({
    tenantId: input.tenantId,
    bookingId: input.bookingId,
    fromStatus: row.booking.status,
    toStatus: input.status,
    changedByUserId: input.actorUserId,
    reason: input.reason ?? null,
  });

  await recordAudit(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "booking.status_changed",
    resourceType: "booking",
    resourceId: input.bookingId,
    metadata: { from: row.booking.status, to: input.status, reference: row.booking.reference },
    ip: input.ip ?? null,
  });

  if (input.status === "cancelled") {
    const tenant = await db.query.tenants.findFirst({ where: (t, { eq: e }) => e(t.id, input.tenantId) });
    if (tenant) {
      const rendered = renderNotification("booking_cancelled", {
        businessName: tenant.name,
        customerName: row.customer.name,
        serviceName: "appointment",
        when: `${formatDateLong(row.booking.startsAt, tenant.timezone)} at ${formatTime(row.booking.startsAt, tenant.timezone)}`,
        reference: row.booking.reference,
      });
      await deliverMessage(db, {
        tenantId: input.tenantId,
        customerId: row.customer.id,
        toAddress: row.customer.email ?? "",
        subject: rendered.subject,
        body: rendered.body,
        idempotencyKey: `booking-cancelled:${row.booking.id}:${Date.now()}`,
      }).catch((error) => console.error("cancellation_email_failed", String(error)));
    }
  }

  return updated;
}

export async function rescheduleBooking(
  db: Database,
  input: {
    tenant: Tenant;
    bookingId: string;
    start: string;
    staffId: string;
    actorUserId: string;
    reason?: string;
    ip?: string | null;
  },
) {
  const [existing] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, input.bookingId), eq(bookings.tenantId, input.tenant.id)))
    .limit(1);
  if (!existing) throw new BookingError("Booking not found.", 404);
  if (!["pending", "confirmed"].includes(existing.status)) {
    throw new BookingError("Only pending or confirmed bookings can be rescheduled.", 409);
  }

  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) throw new BookingError("That start time is not valid.");
  const dateKey = formatInTimeZone(start, input.tenant.timezone, "yyyy-MM-dd");

  const updated = await db.transaction(async (trx) => {
    const tx = trx as unknown as Database;
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${input.tenant.id}:${input.staffId}:${dateKey}`})::bigint)`,
    );
    const availability = await getAvailabilityForSelection(tx, input.tenant, {
      serviceId: existing.serviceId,
      staffId: input.staffId,
      dateKey,
      excludeBookingId: existing.id,
    });
    if (!availability || !isSlotStillAvailable(availability.slots, input.start)) {
      throw new BookingError("That time is not available for this therapist.", 409, "slot_unavailable");
    }
    const durationMs = existing.endsAt.getTime() - existing.startsAt.getTime();
    const [row] = await tx
      .update(bookings)
      .set({
        staffId: input.staffId,
        startsAt: start,
        endsAt: new Date(start.getTime() + durationMs),
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, existing.id), eq(bookings.tenantId, input.tenant.id)))
      .returning();

    await tx.insert(bookingStatusHistory).values({
      tenantId: input.tenant.id,
      bookingId: existing.id,
      fromStatus: existing.status,
      toStatus: existing.status,
      changedByUserId: input.actorUserId,
      reason: input.reason ? `Rescheduled: ${input.reason}` : "Rescheduled",
    });

    await recordAudit(tx, {
      tenantId: input.tenant.id,
      actorUserId: input.actorUserId,
      action: "booking.rescheduled",
      resourceType: "booking",
      resourceId: existing.id,
      metadata: {
        from: existing.startsAt.toISOString(),
        to: start.toISOString(),
        reference: existing.reference,
      },
      ip: input.ip ?? null,
    });
    return row;
  });

  return updated;
}

export async function getTenantBooking(db: Database, tenantId: string, bookingId: string) {
  const [row] = await db
    .select({ booking: bookings, customer: customers })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function getBookingByReference(db: Database, tenantId: string, reference: string) {
  const [row] = await db
    .select({ booking: bookings, customer: customers })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(and(eq(bookings.reference, reference.toUpperCase()), eq(bookings.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function getCustomerBookings(db: Database, tenantId: string, customerId: string) {
  return db
    .select({ booking: bookings, serviceName: sql<string>`(select name from services where id = bookings.service_id)` })
    .from(bookings)
    .where(and(eq(bookings.tenantId, tenantId), eq(bookings.customerId, customerId)))
    .orderBy(bookings.startsAt);
}

export async function countTenantBookings(db: Database, tenantId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.tenantId, tenantId), ne(bookings.status, "cancelled")));
  return row?.count ?? 0;
}
