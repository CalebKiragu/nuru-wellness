import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { ensureDb } from "@/db";
import { services, staffProfiles, staffServices } from "@/db/schema";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";

const staffSchema = z.object({
  name: z.string().trim().min(2).max(100),
  title: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(2000).default(""),
  email: z.string().trim().email().max(160).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#24483D"),
  isActive: z.boolean().default(true),
  serviceIds: z.array(z.string().uuid()).default([]),
});

const updateSchema = staffSchema.partial().extend({ id: z.string().uuid().optional() });

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("staff.manage");
  if (auth.error) return auth.error;
  const parsed = staffSchema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid team member details.", 422);

  const db = await ensureDb();
  const validServices = parsed.data.serviceIds.length
    ? await db
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.tenantId, auth.context.tenant.id), inArray(services.id, parsed.data.serviceIds)))
    : [];

  const [person] = await db
    .insert(staffProfiles)
    .values({
      tenantId: auth.context.tenant.id,
      name: parsed.data.name,
      title: parsed.data.title,
      bio: parsed.data.bio,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      imageUrl: parsed.data.imageUrl || null,
      color: parsed.data.color,
      isActive: parsed.data.isActive,
    })
    .returning();

  if (validServices.length) {
    await db.insert(staffServices).values(
      validServices.map((service) => ({ tenantId: auth.context.tenant.id, staffId: person.id, serviceId: service.id })),
    );
  }

  return NextResponse.json({ staff: person }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("staff.manage");
  if (auth.error) return auth.error;
  const parsed = updateSchema.safeParse(await readJson<unknown>(request));
  if (!parsed.success || !parsed.data.id) return jsonError("Invalid team member details.", 422);

  const db = await ensureDb();
  const { id, serviceIds, ...fields } = parsed.data;
  const [person] = await db
    .update(staffProfiles)
    .set({
      ...fields,
      email: fields.email === undefined ? undefined : fields.email || null,
      phone: fields.phone === undefined ? undefined : fields.phone || null,
      imageUrl: fields.imageUrl === undefined ? undefined : fields.imageUrl || null,
    })
    .where(and(eq(staffProfiles.id, id), eq(staffProfiles.tenantId, auth.context.tenant.id)))
    .returning();
  if (!person) return jsonError("Team member not found.", 404);

  if (serviceIds) {
    const valid = serviceIds.length
      ? await db
          .select({ id: services.id })
          .from(services)
          .where(and(eq(services.tenantId, auth.context.tenant.id), inArray(services.id, serviceIds)))
      : [];
    await db.delete(staffServices).where(and(eq(staffServices.tenantId, auth.context.tenant.id), eq(staffServices.staffId, id)));
    if (valid.length) {
      await db.insert(staffServices).values(
        valid.map((service) => ({ tenantId: auth.context.tenant.id, staffId: id, serviceId: service.id })),
      );
    }
  }

  return NextResponse.json({ staff: person });
}
