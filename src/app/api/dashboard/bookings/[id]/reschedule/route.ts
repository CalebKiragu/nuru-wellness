import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { BookingError, rescheduleBooking } from "@/lib/bookings";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, clientIp, jsonError, readJson } from "@/lib/http";
import { rescheduleSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("bookings.manage");
  if (auth.error) return auth.error;

  const { id } = await params;
  const parsed = rescheduleSchema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid reschedule request.", 422);

  const db = await ensureDb();
  try {
    const booking = await rescheduleBooking(db, {
      tenant: auth.context.tenant,
      bookingId: id,
      start: parsed.data.start,
      staffId: parsed.data.staffId,
      reason: parsed.data.reason,
      actorUserId: auth.context.user.id,
      ip: clientIp(request),
    });
    return NextResponse.json({ booking });
  } catch (error) {
    if (error instanceof BookingError) return jsonError(error.message, error.status, { code: error.code });
    console.error("reschedule_failed", { error: String(error) });
    return jsonError("Could not reschedule the booking.", 500);
  }
}
