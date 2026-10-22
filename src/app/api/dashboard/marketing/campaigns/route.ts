import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDb } from "@/db";
import { campaigns } from "@/db/schema";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  channel: z.enum(["email", "sms", "whatsapp"]).default("email"),
  subject: z.string().trim().min(2).max(180),
  body: z.string().trim().min(5).max(10_000),
});

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("marketing.manage");
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid campaign details.", 422);

  const db = await ensureDb();
  const [campaign] = await db
    .insert(campaigns)
    .values({
      tenantId: auth.context.tenant.id,
      name: parsed.data.name,
      channel: parsed.data.channel,
      subject: parsed.data.subject,
      body: parsed.data.body,
      audience: { segment: "marketing_consented" },
      status: "draft",
      isDemo: auth.context.tenant.isDemo,
      createdByUserId: auth.context.user.id,
    })
    .returning();

  return NextResponse.json({ campaign }, { status: 201 });
}
