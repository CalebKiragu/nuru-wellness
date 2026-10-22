import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ensureDb } from "@/db";
import { dashboardNotifications } from "@/db/schema";
import { getDashboardContext } from "@/lib/auth/session";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const context = await getDashboardContext();
  if (!context) return jsonError("Please sign in.", 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("Missing notification id.", 400);

  const db = await ensureDb();
  const [row] = await db
    .update(dashboardNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(dashboardNotifications.id, id), eq(dashboardNotifications.tenantId, context.tenant.id)))
    .returning();
  if (!row) return jsonError("Notification not found.", 404);
  return NextResponse.json({ notification: row });
}
