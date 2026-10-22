import "server-only";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db";
import {
  campaignRecipients,
  campaigns,
  customerConsents,
  customers,
  type Tenant,
} from "@/db/schema";
import { deliverMessage } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";

export class MarketingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Sends a campaign through the provider-neutral delivery layer. In demo mode
 * (or with no email provider configured) each message is recorded as
 * `simulated`; the campaign status never says `sent` unless a provider
 * actually accepted the message.
 */
export async function sendCampaign(
  db: Database,
  input: { tenant: Tenant; campaignId: string; actorUserId: string },
) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.tenantId, input.tenant.id)))
    .limit(1);
  if (!campaign) throw new MarketingError("Campaign not found.", 404);
  if (campaign.status === "sent" || campaign.status === "simulated" || campaign.status === "partial") {
    throw new MarketingError("This campaign has already been sent.", 409);
  }

  const rows = await db
    .select({ customer: customers, consent: customerConsents })
    .from(customers)
    .leftJoin(
      customerConsents,
      and(
        eq(customerConsents.customerId, customers.id),
        eq(customerConsents.type, "marketing"),
        eq(customerConsents.tenantId, input.tenant.id),
      ),
    )
    .where(eq(customers.tenantId, input.tenant.id));
  const recipients = rows.filter((row) => row.consent?.granted === true && Boolean(row.customer.email));

  let sent = 0;
  let simulated = 0;
  let failed = 0;

  for (const { customer } of recipients) {
    const first = customer.name.split(" ")[0] ?? "";
    const message = await deliverMessage(db, {
      tenantId: input.tenant.id,
      customerId: customer.id,
      campaignId: campaign.id,
      channel: campaign.channel as "email" | "sms" | "whatsapp",
      toAddress: customer.email ?? "",
      subject: campaign.subject.replaceAll("{{first_name}}", first),
      body: campaign.body.replaceAll("{{first_name}}", first),
      idempotencyKey: `campaign:${campaign.id}:${customer.id}`,
    });
    if (message.status === "sent") sent += 1;
    else if (message.status === "simulated") simulated += 1;
    else failed += 1;

    await db.insert(campaignRecipients).values({
      tenantId: input.tenant.id,
      campaignId: campaign.id,
      customerId: customer.id,
      email: customer.email,
      status: message.status,
      messageId: message.id,
    });
  }

  const status = sent > 0 && simulated === 0 && failed === 0 ? "sent" : sent > 0 ? "partial" : "simulated";
  const [updated] = await db
    .update(campaigns)
    .set({ status, sentAt: new Date(), audience: { ...(campaign.audience as Record<string, unknown>), count: recipients.length } })
    .where(and(eq(campaigns.id, campaign.id), eq(campaigns.tenantId, input.tenant.id)))
    .returning();

  await recordAudit(db, {
    tenantId: input.tenant.id,
    actorUserId: input.actorUserId,
    action: simulated > 0 ? "campaign.simulated" : "campaign.sent",
    resourceType: "campaign",
    resourceId: campaign.id,
    metadata: { recipients: recipients.length, sent, simulated, failed },
  });

  return {
    campaign: updated,
    recipients: recipients.length,
    sent,
    simulated,
    failed,
    simulatedOnly: sent === 0,
    note:
      simulated > 0
        ? "No email provider is configured. Messages were saved as simulated demonstration records — nothing was delivered."
        : "Messages were accepted by the configured email provider.",
  };
}
