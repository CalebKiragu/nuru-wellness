import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDb } from "@/db";
import { services } from "@/db/schema";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  shortDescription: z.string().trim().min(5).max(200).optional(),
  description: z.string().trim().min(10).max(6000).optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  bufferBeforeMinutes: z.number().int().min(0).max(120).optional(),
  bufferAfterMinutes: z.number().int().min(0).max(120).optional(),
  priceCents: z.number().int().min(0).max(100_000_000).optional(),
  category: z.string().trim().max(60).optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("services.manage");
  if (auth.error) return auth.error;
  const { id } = await params;

  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid service details.", 422);

  const db = await ensureDb();
  const [service] = await db
    .update(services)
    .set({
      ...parsed.data,
      imageUrl: parsed.data.imageUrl === undefined ? undefined : parsed.data.imageUrl || null,
    })
    .where(and(eq(services.id, id), eq(services.tenantId, auth.context.tenant.id)))
    .returning();
  if (!service) return jsonError("Service not found.", 404);

  await recordAudit(db, {
    tenantId: auth.context.tenant.id,
    actorUserId: auth.context.user.id,
    action: "service.updated",
    resourceType: "service",
    resourceId: service.id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ service });
}
