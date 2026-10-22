import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDb } from "@/db";
import { locations, tenants } from "@/db/schema";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  timezone: z.string().trim().min(3).max(60),
  currency: z.string().trim().length(3),
  location: z
    .object({
      name: z.string().trim().min(2).max(120),
      addressLine1: z.string().trim().min(2).max(160),
      addressLine2: z.string().trim().max(160).nullable().optional(),
      city: z.string().trim().min(2).max(80),
      phone: z.string().trim().max(40).nullable().optional(),
      email: z.string().trim().email().max(160).nullable().optional(),
    })
    .optional(),
});

export async function PATCH(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("settings.manage");
  if (auth.error) return auth.error;

  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid settings.", 422);

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: parsed.data.timezone });
  } catch {
    return jsonError("That timezone is not recognised.", 422);
  }

  const db = await ensureDb();
  const [tenant] = await db
    .update(tenants)
    .set({
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency.toUpperCase(),
    })
    .where(eq(tenants.id, auth.context.tenant.id))
    .returning();

  if (parsed.data.location) {
    const [location] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.tenantId, auth.context.tenant.id))
      .limit(1);
    if (location) {
      await db
        .update(locations)
        .set({
          name: parsed.data.location.name,
          addressLine1: parsed.data.location.addressLine1,
          addressLine2: parsed.data.location.addressLine2 || null,
          city: parsed.data.location.city,
          phone: parsed.data.location.phone || null,
          email: parsed.data.location.email || null,
        })
        .where(eq(locations.id, location.id));
    } else {
      await db.insert(locations).values({
        tenantId: auth.context.tenant.id,
        name: parsed.data.location.name,
        addressLine1: parsed.data.location.addressLine1,
        addressLine2: parsed.data.location.addressLine2 || null,
        city: parsed.data.location.city,
        country: "Kenya",
        phone: parsed.data.location.phone || null,
        email: parsed.data.location.email || null,
        timezone: parsed.data.timezone,
      });
    }
  }

  await recordAudit(db, {
    tenantId: auth.context.tenant.id,
    actorUserId: auth.context.user.id,
    action: "settings.updated",
    resourceType: "tenant",
    resourceId: auth.context.tenant.id,
    metadata: { name: parsed.data.name, timezone: parsed.data.timezone, currency: parsed.data.currency },
  });

  return NextResponse.json({ tenant });
}
