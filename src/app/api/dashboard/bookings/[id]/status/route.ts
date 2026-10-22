import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { BookingError, updateBookingStatus } from "@/lib/bookings";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, clientIp, jsonError, readJson } from "@/lib/http";
import { statusUpdateSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("bookings.manage");
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await readJson<unknown>(request);
  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid status change.", 422);

  const db = await ensureDb();
  try {
    const booking = await updateBookingStatus(db, {
      tenantId: auth.context.tenant.id,
      bookingId: id,
      status: parsed.data.status,
      reason: parsed.data.reason,
      actorUserId: auth.context.user.id,
      ip: clientIp(request),
    });
    return NextResponse.json({ booking });
  } catch (error) {
    if (error instanceof BookingError) return jsonError(error.message, error.status, { code: error.code });
    console.error("status_change_failed", { error: String(error) });
    return jsonError("Could not update the booking.", 500);
  }
}
