import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDb } from "@/db";
import { serviceAddons, services } from "@/db/schema";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";

const addonSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(400).default(""),
  priceCents: z.number().int().min(0).max(10_000_000),
  durationMinutes: z.number().int().min(0).max(240).default(0),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("services.manage");
  if (auth.error) return auth.error;
  const { id } = await params;
  const parsed = addonSchema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid add-on.", 422);

  const db = await ensureDb();
  const [service] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, id), eq(services.tenantId, auth.context.tenant.id)))
    .limit(1);
  if (!service) return jsonError("Service not found.", 404);

  const [addon] = await db
    .insert(serviceAddons)
    .values({
      tenantId: auth.context.tenant.id,
      serviceId: id,
      name: parsed.data.name,
      description: parsed.data.description,
      priceCents: parsed.data.priceCents,
      durationMinutes: parsed.data.durationMinutes,
    })
    .returning();
  return NextResponse.json({ addon }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("services.manage");
  if (auth.error) return auth.error;
  const { id } = await params;
  const url = new URL(request.url);
  const addonId = url.searchParams.get("addonId");
  if (!addonId) return jsonError("Missing add-on id.", 400);

  const db = await ensureDb();
  const [addon] = await db
    .update(serviceAddons)
    .set({ isActive: false })
    .where(and(eq(serviceAddons.id, addonId), eq(serviceAddons.serviceId, id), eq(serviceAddons.tenantId, auth.context.tenant.id)))
    .returning();
  if (!addon) return jsonError("Add-on not found.", 404);
  return NextResponse.json({ addon });
}
