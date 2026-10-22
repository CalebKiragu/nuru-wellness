import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";
import { ensureDb } from "@/db";
import { StorefrontError, rollbackToVersion } from "@/lib/storefront-service";
import { revalidatePath } from "next/cache";

const schema = z.object({ versionId: z.string().uuid() });

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("storefront.publish");
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError("Choose a published version to restore.", 422);

  const db = await ensureDb();
  try {
    const result = await rollbackToVersion(db, {
      tenantId: auth.context.tenant.id,
      userId: auth.context.user.id,
      versionId: parsed.data.versionId,
    });
    revalidatePath("/");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StorefrontError) return jsonError(error.message, error.status);
    console.error("storefront_rollback_failed", { error: String(error) });
    return jsonError("Could not roll back the storefront.", 500);
  }
}
