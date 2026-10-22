import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDb } from "@/db";
import { staffAvailability, staffProfiles } from "@/db/schema";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";

const schema = z.object({
  staffId: z.string().uuid(),
  availability: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        isActive: z.boolean().default(true),
      }),
    )
    .max(7),
});

export async function PUT(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("staff.manage");
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid availability.", 422);

  const db = await ensureDb();
  const [person] = await db
    .select()
    .from(staffProfiles)
    .where(and(eq(staffProfiles.id, parsed.data.staffId), eq(staffProfiles.tenantId, auth.context.tenant.id)))
    .limit(1);
  if (!person) return jsonError("Team member not found.", 404);

  await db.transaction(async (trx) => {
    const tx = trx as unknown as typeof db;
    await tx
      .delete(staffAvailability)
      .where(and(eq(staffAvailability.tenantId, auth.context.tenant.id), eq(staffAvailability.staffId, person.id)));
    if (parsed.data.availability.length) {
      await tx.insert(staffAvailability).values(
        parsed.data.availability.map((row) => ({
          tenantId: auth.context.tenant.id,
          staffId: person.id,
          weekday: row.weekday,
          startTime: row.startTime,
          endTime: row.endTime,
          isActive: row.isActive,
        })),
      );
    }
  });

  return NextResponse.json({ saved: true, days: parsed.data.availability.length });
}
