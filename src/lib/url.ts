import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

function firstHeader(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first ? first : null;
}

function isLoopback(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(host);
}

/**
 * The public origin as the visitor sees it.
 *
 * Render (and most Node hosts) bind the app to localhost:10000 internally, so
 * `request.url` is not safe for redirects. Forwarded headers carry the real
 * public hostname and protocol; `NEXT_PUBLIC_APP_URL` / RENDER_EXTERNAL_URL is
 * the last-resort fallback.
 */
export function getPublicOrigin(request: Request): string {
  const forwardedHost = firstHeader(request.headers.get("x-forwarded-host"));
  const host = forwardedHost ?? firstHeader(request.headers.get("host"));
  const forwardedProto = firstHeader(request.headers.get("x-forwarded-proto"));

  let requestProto = "http";
  try {
    requestProto = new URL(request.url).protocol.replace(":", "") || "http";
  } catch {
    // Keep the default.
  }

  const proto = forwardedProto ?? (env.isProduction ? "https" : requestProto);

  if (host) {
    // A loopback host reached through a production proxy is the internal bind
    // address, never something a visitor can use. Fall back to the configured
    // public URL instead of redirecting to localhost:10000.
    if (!isLoopback(host) || !env.isProduction) {
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }

  return env.appUrl;
}

/** Redirect to a same-site path using the visitor-facing origin. */
export function publicRedirect(request: Request, path: string, status = 303) {
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return NextResponse.redirect(new URL(safePath, getPublicOrigin(request)), status);
}
