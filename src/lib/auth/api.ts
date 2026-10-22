import "server-only";
import { NextResponse } from "next/server";
import { getDashboardContext, type DashboardContext } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http";

export async function requireApiPermission(
  permission: Permission,
): Promise<{ context: DashboardContext; error?: never } | { context?: never; error: NextResponse }> {
  const context = await getDashboardContext();
  if (!context) return { error: jsonError("Please sign in to continue.", 401) };
  if (!can(context.role, permission)) {
    return { error: jsonError("Your role does not allow this action.", 403) };
  }
  return { context };
}
