import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ensureDb } from "@/db";
import { tenantDomains, tenants } from "@/db/schema";
import { env } from "@/lib/env";
import { DEMO_TENANT_COOKIE } from "@/lib/tenant";

export async function POST(request: Request) {
  if (!env.demoMode) return NextResponse.json({ error: "Demo switching is disabled." }, { status: 404 });
  const form = await request.formData();
  const slug = String(form.get("tenant") ?? "").trim();
  const requestedNext = String(form.get("next") ?? "/");
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";

  const db = await ensureDb();
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.slug, slug), eq(tenants.status, "active"), eq(tenants.isDemo, true)))
    .limit(1);
  if (!tenant) return NextResponse.json({ error: "Demonstration studio not found." }, { status: 404 });

  await db
    .insert(tenantDomains)
    .values({ tenantId: tenant.id, hostname: `${slug}.localhost`, isPrimary: false })
    .onConflictDoNothing();

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(DEMO_TENANT_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
