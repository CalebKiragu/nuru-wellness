import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  await destroyCurrentSession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
