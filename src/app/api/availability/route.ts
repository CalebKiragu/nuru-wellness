import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDb } from "@/db";
import { getAvailabilityForSelection } from "@/lib/availability-service";
import { clientIp, jsonError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPublicTenant } from "@/lib/tenant";

const querySchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  addonIds: z.string().optional(),
});

export async function GET(request: Request) {
  const ip = clientIp(request);
  const limit = checkRateLimit(`availability:${ip}`, 120, 60_000);
  if (!limit.allowed) return jsonError("Too many requests. Please try again shortly.", 429);

  const tenant = await getPublicTenant();
  if (!tenant) return jsonError("Storefront not found.", 404);

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    serviceId: url.searchParams.get("serviceId"),
    staffId: url.searchParams.get("staffId"),
    date: url.searchParams.get("date"),
    addonIds: url.searchParams.get("addonIds") ?? undefined,
  });
  if (!parsed.success) return jsonError("Invalid availability request.", 400);

  const addonIds = parsed.data.addonIds?.split(",").filter(Boolean).slice(0, 4) ?? [];
  const db = await ensureDb();
  const result = await getAvailabilityForSelection(db, tenant, {
    serviceId: parsed.data.serviceId,
    staffId: parsed.data.staffId,
    dateKey: parsed.data.date,
    addonIds,
  });
  if (!result) return jsonError("That treatment or therapist is not available.", 404);

  return NextResponse.json(
    {
      timezone: result.timezone,
      dateKey: result.dateKey,
      slots: result.slots,
      durationMinutes: result.selection.totalDurationMinutes,
      priceCents: result.selection.totalPriceCents,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
