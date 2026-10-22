import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDb } from "@/db";
import { businessHours } from "@/db/schema";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  hours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        opensAt: z.string().regex(/^\d{2}:\d{2}$/),
        closesAt: z.string().regex(/^\d{2}:\d{2}$/),
        isClosed: z.boolean(),
      }),
    )
    .length(7),
});

export async function PUT(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("settings.manage");
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid opening hours.", 422);

  for (const row of parsed.data.hours) {
    if (!row.isClosed && row.closesAt <= row.opensAt) {
      return jsonError("Closing time must be after opening time.", 422);
    }
  }

  const db = await ensureDb();
  await db.transaction(async (trx) => {
    const tx = trx as unknown as typeof db;
    for (const row of parsed.data.hours) {
      await tx
        .update(businessHours)
        .set({ opensAt: row.opensAt, closesAt: row.closesAt, isClosed: row.isClosed })
        .where(and(eq(businessHours.tenantId, auth.context.tenant.id), eq(businessHours.weekday, row.weekday)));
    }
  });

  await recordAudit(db, {
    tenantId: auth.context.tenant.id,
    actorUserId: auth.context.user.id,
    action: "business.hours_updated",
    resourceType: "business_hours",
    metadata: { days: parsed.data.hours.length },
  });

  return NextResponse.json({ saved: true });
}
