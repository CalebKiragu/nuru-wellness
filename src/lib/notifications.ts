import "server-only";
import type { Database } from "@/db";
import { and, eq } from "drizzle-orm";
import { outboundMessages } from "@/db/schema";
import { env } from "./env";

export type NotificationTemplate =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "booking_reminder"
  | "booking_pending"
  | "owner_new_booking";

export function renderNotification(template: NotificationTemplate, data: {
  businessName: string;
  customerName: string;
  serviceName: string;
  when: string;
  reference: string;
  cancellationPolicy?: string;
}) {
  const first = data.customerName.split(" ")[0] || "there";
  switch (template) {
    case "booking_confirmed":
      return {
        subject: `Your appointment at ${data.businessName} is confirmed`,
        body: `Hello ${first},\n\nYour ${data.serviceName} is confirmed for ${data.when}.\n\nBooking reference: ${data.reference}\n\n${data.cancellationPolicy ?? ""}\n\nWith care,\n${data.businessName}`,
      };
    case "booking_pending":
      return {
        subject: `We have received your booking request`,
        body: `Hello ${first},\n\nThank you for your request for ${data.serviceName} on ${data.when}. The studio will confirm it shortly.\n\nBooking reference: ${data.reference}\n\n${data.businessName}`,
      };
    case "booking_cancelled":
      return {
        subject: `Your appointment has been cancelled`,
        body: `Hello ${first},\n\nYour ${data.serviceName} on ${data.when} has been cancelled. Reference ${data.reference}.\n\nIf this was not expected, please contact us.`,
      };
    case "booking_rescheduled":
      return {
        subject: `Your appointment has been moved`,
        body: `Hello ${first},\n\nYour ${data.serviceName} is now scheduled for ${data.when}. Reference ${data.reference}.\n\n${data.businessName}`,
      };
    case "booking_reminder":
      return {
        subject: `A reminder of your appointment at ${data.businessName}`,
        body: `Hello ${first},\n\nA gentle reminder that your ${data.serviceName} is booked for ${data.when}. Reference ${data.reference}.`,
      };
    case "owner_new_booking":
      return {
        subject: `New booking: ${data.serviceName}`,
        body: `${data.customerName} booked ${data.serviceName} for ${data.when}. Reference ${data.reference}.`,
      };
  }
}

/**
 * Provider-neutral delivery. A message is only marked `sent` after a provider
 * accepts it. With no provider configured, the message is persisted and shown
 * in the dashboard as simulated — never as delivered.
 */
export async function deliverMessage(db: Database, input: {
  tenantId: string;
  customerId?: string | null;
  campaignId?: string | null;
  channel?: "email" | "sms" | "whatsapp";
  toAddress: string;
  subject: string;
  body: string;
  idempotencyKey: string;
}) {
  const [existing] = await db
    .select()
    .from(outboundMessages)
    .where(and(eq(outboundMessages.tenantId, input.tenantId), eq(outboundMessages.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing) return existing;

  const configured = Boolean(env.email.resendApiKey && input.channel !== "sms" && input.channel !== "whatsapp");
  let status: "simulated" | "sent" | "failed" = "simulated";
  let provider = "demo";
  let providerMessageId: string | null = null;
  let error: string | null = null;
  let sentAt: Date | null = null;

  if (configured) {
    provider = "resend";
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.email.resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          from: env.email.from,
          to: [input.toAddress],
          subject: input.subject,
          text: input.body,
        }),
      });
      if (response.ok) {
        const json = (await response.json()) as { id?: string };
        status = "sent";
        providerMessageId = json.id ?? null;
        sentAt = new Date();
      } else {
        status = "failed";
        error = `Provider responded ${response.status}`;
      }
    } catch (cause) {
      status = "failed";
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  const [message] = await db
    .insert(outboundMessages)
    .values({
      tenantId: input.tenantId,
      customerId: input.customerId ?? null,
      campaignId: input.campaignId ?? null,
      channel: input.channel ?? "email",
      toAddress: input.toAddress,
      subject: input.subject,
      body: input.body,
      status,
      provider,
      providerMessageId,
      sentAt,
      idempotencyKey: input.idempotencyKey,
      error,
    })
    .returning();
  return message;
}
