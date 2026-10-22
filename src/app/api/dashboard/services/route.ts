import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDb } from "@/db";
import { services } from "@/db/schema";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";
import { slugify } from "@/lib/format";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(80).optional(),
  shortDescription: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(6000),
  durationMinutes: z.number().int().min(5).max(480),
  bufferBeforeMinutes: z.number().int().min(0).max(120).default(10),
  bufferAfterMinutes: z.number().int().min(0).max(120).default(10),
  priceCents: z.number().int().min(0).max(100_000_000),
  category: z.string().trim().max(60).default("Massage"),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100).default(0),
});

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("services.manage");
  if (auth.error) return auth.error;

  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid service details.", 422);

  const db = await ensureDb();
  const slug = slugify(parsed.data.slug || parsed.data.name) || `service-${Date.now()}`;
  const [clash] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.tenantId, auth.context.tenant.id), eq(services.slug, slug)))
    .limit(1);
  if (clash) return jsonError("A service with that URL slug already exists.", 409);

  const [service] = await db
    .insert(services)
    .values({
      tenantId: auth.context.tenant.id,
      slug,
      name: parsed.data.name,
      shortDescription: parsed.data.shortDescription,
      description: parsed.data.description,
      durationMinutes: parsed.data.durationMinutes,
      bufferBeforeMinutes: parsed.data.bufferBeforeMinutes,
      bufferAfterMinutes: parsed.data.bufferAfterMinutes,
      priceCents: parsed.data.priceCents,
      currency: auth.context.tenant.currency,
      category: parsed.data.category,
      imageUrl: parsed.data.imageUrl || null,
      isActive: parsed.data.isActive,
      sortOrder: parsed.data.sortOrder,
    })
    .returning();

  await recordAudit(db, {
    tenantId: auth.context.tenant.id,
    actorUserId: auth.context.user.id,
    action: "service.created",
    resourceType: "service",
    resourceId: service.id,
    metadata: { name: service.name, slug: service.slug },
  });

  return NextResponse.json({ service }, { status: 201 });
}
