import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";
import { AgentError, decideApproval } from "@/lib/ai/engine";
import { approvalSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("ai.use");
  if (auth.error) return auth.error;

  const { id } = await params;
  const parsed = approvalSchema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid approval decision.", 422);

  const db = await ensureDb();
  try {
    const result = await decideApproval(db, auth.context, {
      approvalId: id,
      decision: parsed.data.decision,
      note: parsed.data.note,
    });
    return NextResponse.json({
      approval: result.approval,
      alreadyDecided: result.alreadyDecided,
      execution: result.execution,
    });
  } catch (error) {
    if (error instanceof AgentError) return jsonError(error.message, error.status, { code: error.code });
    console.error("approval_failed", { error: String(error) });
    return jsonError("The approval could not be processed.", 500);
  }
}
