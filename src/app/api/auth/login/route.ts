import { NextResponse } from "next/server";
import { authenticate, createSession, requestMeta } from "@/lib/auth/session";
import { assertSameOrigin, clientIp, jsonError, readJson } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const ip = clientIp(request);
  const limit = checkRateLimit(`login:${ip}`, 10, 15 * 60_000);
  if (!limit.allowed) return jsonError("Too many sign-in attempts. Please wait before trying again.", 429);

  const body = await readJson<unknown>(request);
  if (!body) return jsonError("Expected a JSON request body.", 415);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonError("Enter a valid email and password.", 422);

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) return jsonError("Email or password is incorrect.", 401);

  const meta = await requestMeta();
  await createSession(user.id, meta);
  return NextResponse.json({ ok: true, redirect: user.isPlatformAdmin ? "/admin" : "/dashboard" });
}
