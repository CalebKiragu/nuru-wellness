import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDb } from "@/db";
import { customerConsents, customers, notificationPreferences } from "@/db/schema";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  marketingConsent: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("customers.manage");
  if (auth.error) return auth.error;
  const { id } = await params;

  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid client details.", 422);

  const db = await ensureDb();
  const [existing] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, auth.context.tenant.id)))
    .limit(1);
  if (!existing) return jsonError("Client not found.", 404);

  const [updated] = await db
    .update(customers)
    .set({
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(customers.id, id), eq(customers.tenantId, auth.context.tenant.id)))
    .returning();

  if (typeof parsed.data.marketingConsent === "boolean") {
    const [consent] = await db
      .select()
      .from(customerConsents)
      .where(
        and(
          eq(customerConsents.tenantId, auth.context.tenant.id),
          eq(customerConsents.customerId, id),
          eq(customerConsents.type, "marketing"),
        ),
      )
      .limit(1);
    if (consent) {
      await db.update(customerConsents).set({ granted: parsed.data.marketingConsent }).where(eq(customerConsents.id, consent.id));
    } else {
      await db.insert(customerConsents).values({
        tenantId: auth.context.tenant.id,
        customerId: id,
        type: "marketing",
        granted: parsed.data.marketingConsent,
        source: "dashboard",
      });
    }
    await db
      .insert(notificationPreferences)
      .values({
        tenantId: auth.context.tenant.id,
        customerId: id,
        marketingEmail: parsed.data.marketingConsent,
      })
      .onConflictDoUpdate({
        target: [notificationPreferences.tenantId, notificationPreferences.customerId],
        set: { marketingEmail: parsed.data.marketingConsent, updatedAt: new Date() },
      });
  }

  return NextResponse.json({ customer: updated });
}
