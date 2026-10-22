import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { requireApiPermission } from "@/lib/auth/api";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { MarketingError, sendCampaign } from "@/lib/marketing";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const auth = await requireApiPermission("marketing.manage");
  if (auth.error) return auth.error;
  const { id } = await params;

  const db = await ensureDb();
  try {
    const result = await sendCampaign(db, {
      tenant: auth.context.tenant,
      campaignId: id,
      actorUserId: auth.context.user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MarketingError) return jsonError(error.message, error.status);
    console.error("campaign_send_failed", { error: String(error) });
    return jsonError("The campaign could not be processed.", 500);
  }
}
