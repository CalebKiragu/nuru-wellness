import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { ensureDb } from "@/db";
import { staffProfiles, timeOff } from "@/db/schema";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";

const schema = z.object({
  staffId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(200).default("Unavailable"),
});

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("staff.manage");
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid time off.", 422);
  if (parsed.data.endTime <= parsed.data.startTime) {
    return jsonError("The end time must be after the start time.", 422);
  }

  const db = await ensureDb();
  const [person] = await db
    .select({ id: staffProfiles.id })
    .from(staffProfiles)
    .where(and(eq(staffProfiles.id, parsed.data.staffId), eq(staffProfiles.tenantId, auth.context.tenant.id)))
    .limit(1);
  if (!person) return jsonError("Team member not found.", 404);

  const timezone = auth.context.tenant.timezone;
  const startsAt = fromZonedTime(`${parsed.data.date}T${parsed.data.startTime}:00`, timezone);
  const endsAt = fromZonedTime(`${parsed.data.date}T${parsed.data.endTime}:00`, timezone);

  const [row] = await db
    .insert(timeOff)
    .values({
      tenantId: auth.context.tenant.id,
      staffId: person.id,
      startsAt,
      endsAt,
      reason: parsed.data.reason,
    })
    .returning();
  return NextResponse.json({ timeOff: row }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("staff.manage");
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("Missing time-off id.", 400);

  const db = await ensureDb();
  const [row] = await db
    .delete(timeOff)
    .where(and(eq(timeOff.id, id), eq(timeOff.tenantId, auth.context.tenant.id)))
    .returning();
  if (!row) return jsonError("Time off not found.", 404);
  return NextResponse.json({ deleted: true });
}
