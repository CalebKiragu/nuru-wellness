import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { ensureDb } from "@/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await ensureDb();
    await db.execute(sql`select 1`);
    return NextResponse.json(
      {
        status: "ok",
        database: "ok",
        demoMode: env.demoMode,
        aiProvider: env.aiProvider,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("health_check_failed", { error: String(error) });
    return NextResponse.json({ status: "error", database: "unavailable" }, { status: 503 });
  }
}
