import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";
import { ensureDb } from "@/db";
import { StorefrontError, saveDraft } from "@/lib/storefront-service";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("storefront.edit");
  if (auth.error) return auth.error;

  const body = await readJson<{ config?: unknown }>(request);
  if (!body || !body.config) return jsonError("Expected a storefront configuration.", 422);

  const db = await ensureDb();
  try {
    const result = await saveDraft(db, { tenantId: auth.context.tenant.id, userId: auth.context.user.id, config: body.config });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StorefrontError) return jsonError(error.message, error.status);
    console.error("storefront_save_failed", { error: String(error) });
    return jsonError("Could not save the draft.", 500);
  }
}
