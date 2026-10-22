import { NextResponse } from "next/server";
import { getMemberships, setActiveTenant } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);

  const form = await request.formData();
  const tenantId = String(form.get("tenantId") ?? "");
  const memberships = await getMemberships(user.id);
  if (!memberships.some((membership) => membership.tenant.id === tenantId)) {
    return NextResponse.json({ error: "You do not have access to that workspace." }, { status: 403 });
  }
  await setActiveTenant(user.id, tenantId);
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
