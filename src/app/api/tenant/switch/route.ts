import { NextResponse } from "next/server";
import { getMemberships, setActiveTenant } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/http";
import { publicRedirect } from "@/lib/url";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return publicRedirect(request, "/login");

  const form = await request.formData();
  const tenantId = String(form.get("tenantId") ?? "");
  const memberships = await getMemberships(user.id);
  if (!memberships.some((membership) => membership.tenant.id === tenantId)) {
    return NextResponse.json({ error: "You do not have access to that workspace." }, { status: 403 });
  }
  await setActiveTenant(user.id, tenantId);
  return publicRedirect(request, "/dashboard");
}
