import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { BookingError, createBooking } from "@/lib/bookings";
import { assertSameOrigin, clientIp, jsonError, readJson } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { createBookingSchema } from "@/lib/validation";
import { getPublicTenant } from "@/lib/tenant";
import { getStorefrontConfig } from "@/lib/tenant";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const ip = clientIp(request);
  const limit = checkRateLimit(`booking:${ip}`, 10, 15 * 60_000);
  if (!limit.allowed) {
    return jsonError("Too many booking attempts. Please try again in a little while.", 429, {
      retryAfter: limit.retryAfterSeconds,
    });
  }

  const tenant = await getPublicTenant();
  if (!tenant) return jsonError("Storefront not found.", 404);
  const config = await getStorefrontConfig(tenant.id, "published");
  if (!config) return jsonError("This storefront is not published.", 404);

  const body = await readJson<unknown>(request);
  if (!body) return jsonError("Expected a JSON request body.", 415);
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Please check the booking details.", 422, {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }

  const headerKey = request.headers.get("idempotency-key");
  if (headerKey && headerKey !== parsed.data.idempotencyKey) {
    return jsonError("Idempotency key mismatch.", 400);
  }

  const db = await ensureDb();
  try {
    const result = await createBooking(db, tenant, parsed.data, { ip, source: "storefront" });
    return NextResponse.json(
      {
        duplicate: result.duplicate,
        demo: tenant.isDemo,
        booking: {
          reference: result.booking.reference,
          startsAt: result.booking.startsAt,
          endsAt: result.booking.endsAt,
          status: result.booking.status,
          priceCents: result.booking.priceCents,
          currency: result.booking.currency,
        },
      },
      { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof BookingError) {
      return jsonError(error.message, error.status, { code: error.code });
    }
    console.error("booking_failed", { error: String(error) });
    return jsonError("We could not complete your booking. Please try again.", 500);
  }
}
