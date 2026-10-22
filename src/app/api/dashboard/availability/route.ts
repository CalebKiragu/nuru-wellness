import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDb } from "@/db";
import { requireApiPermission } from "@/lib/auth/api";
import { jsonError } from "@/lib/http";
import { getAvailabilityForSelection } from "@/lib/availability-service";

const querySchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  const auth = await requireApiPermission("bookings.manage");
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    serviceId: url.searchParams.get("serviceId"),
    staffId: url.searchParams.get("staffId"),
    date: url.searchParams.get("date"),
  });
  if (!parsed.success) return jsonError("Invalid availability request.", 400);

  const db = await ensureDb();
  const result = await getAvailabilityForSelection(db, auth.context.tenant, {
    serviceId: parsed.data.serviceId,
    staffId: parsed.data.staffId,
    dateKey: parsed.data.date,
  });
  if (!result) return jsonError("That treatment or therapist is not available.", 404);
  return NextResponse.json({ slots: result.slots, timezone: result.timezone }, { headers: { "Cache-Control": "no-store" } });
}
