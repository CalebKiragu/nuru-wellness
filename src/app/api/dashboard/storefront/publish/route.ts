import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";
import { ensureDb } from "@/db";
import { StorefrontError, publishDraft } from "@/lib/storefront-service";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("storefront.publish");
  if (auth.error) return auth.error;
  const body = await readJson<{ note?: string }>(request);
  const db = await ensureDb();
  try {
    const result = await publishDraft(db, {
      tenantId: auth.context.tenant.id,
      userId: auth.context.user.id,
      note: typeof body?.note === "string" ? body.note : undefined,
    });
    revalidatePath("/");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StorefrontError) return jsonError(error.message, error.status);
    console.error("storefront_publish_failed", { error: String(error) });
    return jsonError("Could not publish the storefront.", 500);
  }
}
