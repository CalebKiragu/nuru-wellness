import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError, readJson } from "@/lib/http";
import { AgentError, runAgentWorkflow } from "@/lib/ai/engine";
import { agentRunSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("ai.use");
  if (auth.error) return auth.error;

  const parsed = agentRunSchema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Please describe the task.", 422);

  const limit = checkRateLimit(`agent:${auth.context.user.id}`, 12, 10 * 60_000);
  if (!limit.allowed) return jsonError("The assistant is busy. Please try again in a few minutes.", 429);

  const db = await ensureDb();
  try {
    const result = await runAgentWorkflow(db, auth.context, parsed.data);
    return NextResponse.json(
      {
        run: result.run,
        summary: result.summary,
        awaitingApproval: result.awaitingApproval,
        provider: result.provider,
        demo: result.provider.live ? false : true,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AgentError) return jsonError(error.message, error.status, { code: error.code });
    console.error("agent_run_failed", { error: String(error) });
    return jsonError("The assistant could not complete that request.", 500);
  }
}
