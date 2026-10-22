import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_CREDENTIALS } from "@/db/seed";
import { authenticate, createSession, requestMeta } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { assertSameOrigin, clientIp, jsonError, readJson } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  if (!env.demoMode) return jsonError("Demo sign-in is disabled.", 404);
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const limit = checkRateLimit(`demo-login:${clientIp(request)}`, 30, 15 * 60_000);
  if (!limit.allowed) return jsonError("Too many demo sign-in attempts.", 429);

  const body = await readJson<unknown>(request);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Choose a demonstration account.", 422);
  const account = DEMO_CREDENTIALS.accounts.find((entry) => entry.email === parsed.data.email.toLowerCase());
  if (!account) return jsonError("That demonstration account is not available.", 404);

  const user = await authenticate(account.email, DEMO_CREDENTIALS.password);
  if (!user) return jsonError("Demo credentials are not seeded. Restart the app to seed the demo data.", 503);

  await createSession(user.id, await requestMeta());
  return NextResponse.json({
    ok: true,
    redirect: user.isPlatformAdmin ? "/admin" : "/dashboard",
  });
}
