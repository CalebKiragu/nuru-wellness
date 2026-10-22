import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export function jsonError(message: string, status = 400, extras: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extras }, { status });
}

function first(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  // Browsers set this themselves; it is a useful backstop when a proxy
  // rewrites Host headers. Cross-site form posts are labelled cross-site.
  if (request.headers.get("sec-fetch-site") === "same-origin") return true;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const forwardedHost = first(request.headers.get("x-forwarded-host"))?.toLowerCase();
    const host = first(request.headers.get("host"))?.toLowerCase();
    if (originHost === forwardedHost || originHost === host) return true;

    // A public URL can legitimately differ from the internal bind address.
    try {
      if (new URL(origin).origin === new URL(env.appUrl).origin) return true;
    } catch {
      // Ignore malformed configured URLs.
    }

    return false;
  } catch {
    return false;
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function readJson<T>(request: Request): Promise<T | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
