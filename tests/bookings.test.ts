import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { bookings, outboundMessages } from "@/db/schema";
import { createBooking, getTenantBooking, updateBookingStatus, BookingError } from "@/lib/bookings";
import { findNextAvailableSlot } from "@/lib/availability-service";
import { listBookings } from "@/lib/dashboard-data";
import type { CreateBookingPayload } from "@/lib/validation";
import { createTestDatabase, getFixtures, type TestDatabase } from "./helpers/database";

let ctx: TestDatabase;
let fixtures: Awaited<ReturnType<typeof getFixtures>>;

beforeAll(async () => {
  ctx = await createTestDatabase();
  fixtures = await getFixtures(ctx.db);
});

afterAll(async () => {
  await ctx?.close();
});

function payload(overrides: Partial<CreateBookingPayload> = {}): CreateBookingPayload {
  const slot = overrides.start ? new Date(overrides.start) : null;
  if (!slot) throw new Error("payload() needs a start");
  return {
    serviceId: fixtures.amaniService.id,
    staffId: fixtures.amaniStaff.id,
    start: slot.toISOString(),
    addonIds: [],
    customer: { name: "Test Client", email: `client-${Date.now()}@example.com`, phone: "+254700000001", note: "Please use unscented oil." },
    marketingConsent: false,
    policyAccepted: true,
    idempotencyKey: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  };
}

describe("booking engine against the real schema and seed", () => {
  it("finds a genuine slot and creates a confirmed tenant-scoped booking", async () => {
    const found = await findNextAvailableSlot(ctx.db, fixtures.amani, fixtures.amaniService.id, fixtures.amaniStaff.id, 21);
    expect(found).not.toBeNull();

    const input = payload({ start: found!.slot.start });
    const result = await createBooking(ctx.db, fixtures.amani, input);

    expect(result.duplicate).toBe(false);
    expect(result.booking.tenantId).toBe(fixtures.amani.id);
    expect(result.booking.status).toBe("confirmed");
    expect(result.booking.reference).toMatch(/^[A-Z]{3}-[A-Z2-9]{6}$/);
    expect(result.booking.isDemo).toBe(true);
    expect(result.booking.priceCents).toBeGreaterThan(0);

    const [stored] = await ctx.db.select().from(bookings).where(eq(bookings.id, result.booking.id));
    expect(stored?.idempotencyKey).toBe(input.idempotencyKey);

    const [notification] = await ctx.db
      .select()
      .from(outboundMessages)
      .where(and(eq(outboundMessages.tenantId, fixtures.amani.id), eq(outboundMessages.idempotencyKey, `booking-confirmed:${result.booking.id}`)));
    expect(notification?.status).toBe("simulated");
    expect(notification?.provider).toBe("demo");
  });

  it("returns the same booking for a repeated idempotency key", async () => {
    const found = await findNextAvailableSlot(ctx.db, fixtures.amani, fixtures.amaniService.id, fixtures.amaniStaff.id, 21);
    const input = payload({ start: found!.slot.start });
    const first = await createBooking(ctx.db, fixtures.amani, input);
    const second = await createBooking(ctx.db, fixtures.amani, input);

    expect(second.duplicate).toBe(true);
    expect(second.booking.id).toBe(first.booking.id);

    const rows = await ctx.db
      .select()
      .from(bookings)
      .where(and(eq(bookings.tenantId, fixtures.amani.id), eq(bookings.idempotencyKey, input.idempotencyKey)));
    expect(rows).toHaveLength(1);
  });

  it("rejects a second booking for a slot that was just taken", async () => {
    const found = await findNextAvailableSlot(ctx.db, fixtures.amani, fixtures.amaniService.id, fixtures.amaniStaff.id, 21);
    const first = payload({ start: found!.slot.start });
    await createBooking(ctx.db, fixtures.amani, first);

    const second = payload({
      start: found!.slot.start,
      customer: { name: "Second Client", email: `second-${Date.now()}@example.com`, phone: "+254700000002" },
    });
    await expect(createBooking(ctx.db, fixtures.amani, second)).rejects.toMatchObject({ status: 409, code: "slot_unavailable" });
  });

  it("keeps one winner when two attempts race for the same slot", async () => {
    const found = await findNextAvailableSlot(ctx.db, fixtures.amani, fixtures.amaniService.id, fixtures.amaniStaff.id, 21);
    const start = found!.slot.start;
    const attempts = await Promise.allSettled([
      createBooking(ctx.db, fixtures.amani, payload({ start, customer: { name: "Race A", email: `race-a-${Date.now()}@example.com`, phone: "+254700000003" } })),
      createBooking(ctx.db, fixtures.amani, payload({ start, customer: { name: "Race B", email: `race-b-${Date.now()}@example.com`, phone: "+254700000004" } })),
    ]);

    const fulfilled = attempts.filter((entry) => entry.status === "fulfilled");
    expect(fulfilled.length).toBe(1);

    const rows = await ctx.db
      .select()
      .from(bookings)
      .where(and(eq(bookings.tenantId, fixtures.amani.id), eq(bookings.startsAt, new Date(start))));
    expect(rows).toHaveLength(1);
  });

  it("isolates booking records and status changes by tenant", async () => {
    const found = await findNextAvailableSlot(ctx.db, fixtures.amani, fixtures.amaniService.id, fixtures.amaniStaff.id, 21);
    const { booking } = await createBooking(ctx.db, fixtures.amani, payload({ start: found!.slot.start }));

    expect((await getTenantBooking(ctx.db, fixtures.amani.id, booking.id))?.booking.id).toBe(booking.id);
    expect(await getTenantBooking(ctx.db, fixtures.bahari.id, booking.id)).toBeNull();

    const amaniRows = await listBookings(ctx.db, fixtures.amani, { limit: 500 });
    const bahariRows = await listBookings(ctx.db, fixtures.bahari, { limit: 500 });
    expect(amaniRows.some((row) => row.booking.id === booking.id)).toBe(true);
    expect(bahariRows.some((row) => row.booking.id === booking.id)).toBe(false);

    await expect(
      updateBookingStatus(ctx.db, {
        tenantId: fixtures.bahari.id,
        bookingId: booking.id,
        status: "cancelled",
        actorUserId: fixtures.bahariOwner.id,
      }),
    ).rejects.toBeInstanceOf(BookingError);
  });

  it("refuses a booking that mixes service and therapist from another tenant", async () => {
    const found = await findNextAvailableSlot(ctx.db, fixtures.amani, fixtures.amaniService.id, fixtures.amaniStaff.id, 21);
    await expect(
      createBooking(ctx.db, fixtures.amani, payload({
        start: found!.slot.start,
        serviceId: fixtures.bahariService.id,
        staffId: fixtures.bahariStaff.id,
      })),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("enforces valid status transitions", async () => {
    const found = await findNextAvailableSlot(ctx.db, fixtures.amani, fixtures.amaniService.id, fixtures.amaniStaff.id, 21);
    const { booking } = await createBooking(ctx.db, fixtures.amani, payload({ start: found!.slot.start }));

    const completed = await updateBookingStatus(ctx.db, {
      tenantId: fixtures.amani.id,
      bookingId: booking.id,
      status: "completed",
      actorUserId: fixtures.amaniOwner.id,
    });
    expect(completed.status).toBe("completed");

    await expect(
      updateBookingStatus(ctx.db, {
        tenantId: fixtures.amani.id,
        bookingId: booking.id,
        status: "cancelled",
        actorUserId: fixtures.amaniOwner.id,
      }),
    ).rejects.toMatchObject({ code: "invalid_transition" });
  });
});
