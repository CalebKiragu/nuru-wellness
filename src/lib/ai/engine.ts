import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db";
import {
  agentArtifacts,
  agentRuns,
  agentSteps,
  approvalRequests,
  campaignRecipients,
  campaigns,
  customerConsents,
  customers,
  storefrontConfigs,
  type ApprovalRequest,
  type TenantRole,
} from "@/db/schema";
import type { ActorContext, AgentTask, ToolResult } from "./types";
import { getProvider } from "./providers";
import { runTool, type ToolName } from "./tools";
import { hashPayload } from "@/lib/hash";
import { recordAudit } from "@/lib/audit";
import { deliverMessage } from "@/lib/notifications";
import type { StorefrontConfig } from "@/lib/storefront";

const taskTools: Record<AgentTask, ToolName[]> = {
  marketing_campaign: ["get_business_profile", "get_available_slots", "get_marketing_audience", "get_campaign_history"],
  storefront_copy: ["get_business_profile", "get_storefront_config"],
  schedule_review: ["get_business_profile", "get_bookings_summary", "get_available_slots"],
  business_question: ["get_business_profile", "get_bookings_summary"],
};

export class AgentError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "agent_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function runAgentWorkflow(
  db: Database,
  context: ActorContext,
  input: { task: AgentTask; prompt: string },
) {
  const provider = getProvider();
  const [run] = await db
    .insert(agentRuns)
    .values({
      tenantId: context.tenant.id,
      userId: context.user.id,
      task: input.task,
      prompt: input.prompt,
      status: "queued",
      provider: provider.info.id,
      model: provider.info.model,
    })
    .returning();

  try {
    await db.update(agentRuns).set({ status: "running", updatedAt: new Date() }).where(eq(agentRuns.id, run.id));

    const facts: Record<string, unknown> = {};
    const toolResults: ToolResult[] = [];
    let stepIndex = 0;

    for (const toolName of taskTools[input.task]) {
      stepIndex += 1;
      const output = await runTool(db, context.tenant, context.role, toolName, {});
      facts[toolName.replace("get_", "")] = output;
      await db.insert(agentSteps).values({
        tenantId: context.tenant.id,
        runId: run.id,
        stepIndex,
        kind: "tool",
        name: toolName,
        status: "completed",
        input: {},
        output,
        completedAt: new Date(),
      });
      toolResults.push({ output, summary: toolName });
    }

    const plan = await provider.plan(input.task, input.prompt, context, facts);

    for (const step of plan.steps) {
      stepIndex += 1;
      await db.insert(agentSteps).values({
        tenantId: context.tenant.id,
        runId: run.id,
        stepIndex,
        kind: step.kind,
        name: step.name,
        status: "completed",
        input: step.input ?? {},
        output: step.output ?? {},
        completedAt: new Date(),
      });
    }

    let artifactId: string | null = null;
    if (plan.artifact) {
      const [artifact] = await db
        .insert(agentArtifacts)
        .values({
          tenantId: context.tenant.id,
          runId: run.id,
          type: plan.artifact.type,
          title: plan.artifact.title,
          content: plan.artifact.content,
          status: plan.approval ? "awaiting_approval" : "draft",
        })
        .returning();
      artifactId = artifact.id;
    }

    let awaitingApproval = false;
    if (plan.approval) {
      awaitingApproval = true;
      stepIndex += 1;
      const [approval] = await db
        .insert(approvalRequests)
        .values({
          tenantId: context.tenant.id,
          runId: run.id,
          artifactId,
          action: plan.approval.action,
          resourceType: plan.approval.resourceType,
          resourceId: artifactId,
          payload: plan.approval.payload,
          payloadHash: hashPayload(plan.approval.payload),
          status: "pending",
          requestedByUserId: context.user.id,
        })
        .returning();
      await db.insert(agentSteps).values({
        tenantId: context.tenant.id,
        runId: run.id,
        stepIndex,
        kind: "approval",
        name: plan.approval.action,
        status: "awaiting_approval",
        input: { approvalId: approval.id },
        output: { payloadHash: approval.payloadHash },
      });
    }

    const [updated] = await db
      .update(agentRuns)
      .set({
        status: awaitingApproval ? "awaiting_approval" : "completed",
        result: plan.result,
        updatedAt: new Date(),
        completedAt: awaitingApproval ? null : new Date(),
      })
      .where(eq(agentRuns.id, run.id))
      .returning();

    await recordAudit(db, {
      tenantId: context.tenant.id,
      actorUserId: context.user.id,
      action: "agent.run",
      resourceType: "agent_run",
      resourceId: run.id,
      metadata: { task: input.task, provider: provider.info.id, live: provider.info.live, awaitingApproval },
    });

    return { run: updated, summary: plan.summary, awaitingApproval, provider: provider.info, steps: toolResults.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(agentRuns)
      .set({ status: "failed", error: message, updatedAt: new Date(), completedAt: new Date() })
      .where(eq(agentRuns.id, run.id));
    await db.insert(agentSteps).values({
      tenantId: context.tenant.id,
      runId: run.id,
      stepIndex: 99,
      kind: "error",
      name: "workflow_failed",
      status: "failed",
      error: message,
    });
    throw new AgentError("The assistant could not complete that request.", 500, "workflow_failed");
  }
}

const campaignPayloadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  channel: z.enum(["email", "sms", "whatsapp"]).default("email"),
  subject: z.string().trim().min(2).max(180),
  body: z.string().trim().min(5).max(10_000),
  audience: z.record(z.unknown()).optional(),
  rationale: z.string().max(1000).optional(),
});

const copyPayloadSchema = z.object({
  changes: z.record(z.string().max(2000)),
  note: z.string().max(300).optional(),
});

async function executeSendCampaign(
  db: Database,
  context: ActorContext,
  approval: ApprovalRequest,
) {
  const parsed = campaignPayloadSchema.safeParse(approval.payload);
  if (!parsed.success) throw new AgentError("The approved campaign payload is no longer valid.", 409, "payload_invalid");
  const payload = parsed.data;

  const rows = await db
    .select({ customer: customers, consent: customerConsents })
    .from(customers)
    .leftJoin(
      customerConsents,
      and(
        eq(customerConsents.customerId, customers.id),
        eq(customerConsents.type, "marketing"),
        eq(customerConsents.tenantId, context.tenant.id),
      ),
    )
    .where(eq(customers.tenantId, context.tenant.id));

  const recipients = rows.filter((row) => row.consent?.granted === true && Boolean(row.customer.email));

  const [campaign] = await db
    .insert(campaigns)
    .values({
      tenantId: context.tenant.id,
      name: payload.name,
      channel: payload.channel,
      subject: payload.subject,
      body: payload.body,
      audience: { ...(payload.audience ?? {}), count: recipients.length, segment: "marketing_consented" },
      status: "draft",
      isDemo: context.tenant.isDemo,
      createdByUserId: context.user.id,
    })
    .returning();

  let sentCount = 0;
  let simulatedCount = 0;
  let failedCount = 0;

  for (const { customer } of recipients) {
    const body = payload.body.replaceAll("{{first_name}}", customer.name.split(" ")[0] ?? "");
    const subject = payload.subject.replaceAll("{{first_name}}", customer.name.split(" ")[0] ?? "");
    const message = await deliverMessage(db, {
      tenantId: context.tenant.id,
      customerId: customer.id,
      campaignId: campaign.id,
      channel: payload.channel,
      toAddress: customer.email ?? "",
      subject,
      body,
      idempotencyKey: `campaign:${campaign.id}:${customer.id}`,
    });
    if (message.status === "sent") sentCount += 1;
    else if (message.status === "simulated") simulatedCount += 1;
    else failedCount += 1;

    await db.insert(campaignRecipients).values({
      tenantId: context.tenant.id,
      campaignId: campaign.id,
      customerId: customer.id,
      email: customer.email,
      status: message.status,
      messageId: message.id,
    });
  }

  const status = sentCount > 0 && simulatedCount === 0 && failedCount === 0 ? "sent" : sentCount > 0 ? "partial" : "simulated";
  const [updatedCampaign] = await db
    .update(campaigns)
    .set({ status, sentAt: new Date() })
    .where(and(eq(campaigns.id, campaign.id), eq(campaigns.tenantId, context.tenant.id)))
    .returning();

  await recordAudit(db, {
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    action: simulatedCount > 0 ? "campaign.simulated" : "campaign.sent",
    resourceType: "campaign",
    resourceId: campaign.id,
    metadata: {
      recipients: recipients.length,
      sentCount,
      simulatedCount,
      failedCount,
      provider: simulatedCount > 0 ? "demo" : "resend",
      approvalId: approval.id,
    },
  });

  return {
    campaignId: campaign.id,
    campaignStatus: updatedCampaign?.status ?? status,
    recipients: recipients.length,
    sent: sentCount,
    simulated: simulatedCount,
    failed: failedCount,
    externalDelivery: sentCount > 0,
    note:
      simulatedCount > 0
        ? "No email provider is configured, so these messages were simulated. Nothing left the demo environment."
        : "Messages were accepted by the configured email provider.",
  };
}

async function executeApplyStorefrontCopy(
  db: Database,
  context: ActorContext,
  approval: ApprovalRequest,
) {
  const parsed = copyPayloadSchema.safeParse(approval.payload);
  if (!parsed.success) throw new AgentError("The approved copy payload is no longer valid.", 409, "payload_invalid");

  const [config] = await db
    .select()
    .from(storefrontConfigs)
    .where(eq(storefrontConfigs.tenantId, context.tenant.id))
    .limit(1);
  if (!config) throw new AgentError("Storefront configuration not found.", 404);

  const draft = config.draft as unknown as StorefrontConfig;
  const allowedKeys = ["heroTitle", "heroText", "servicesText", "aboutTitle", "aboutText", "teamText", "locationText"] as const;
  const nextContent = { ...draft.content };
  const applied: string[] = [];
  for (const [key, value] of Object.entries(parsed.data.changes)) {
    if ((allowedKeys as readonly string[]).includes(key) && typeof value === "string" && value.trim()) {
      (nextContent as unknown as Record<string, string>)[key] = value.trim();
      applied.push(key);
    }
  }
  if (!applied.length) throw new AgentError("No supported copy fields were present in the approval.", 409, "payload_invalid");

  const nextDraft: StorefrontConfig = { ...draft, content: nextContent, updatedAt: new Date().toISOString() };
  await db
    .update(storefrontConfigs)
    .set({ draft: nextDraft as unknown as Record<string, unknown>, updatedAt: new Date(), updatedBy: context.user.id })
    .where(and(eq(storefrontConfigs.tenantId, context.tenant.id)));

  await recordAudit(db, {
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    action: "storefront.draft_saved",
    resourceType: "storefront",
    resourceId: config.id,
    metadata: { source: "assistant", fields: applied, approvalId: approval.id },
  });

  return {
    draftUpdated: true,
    published: false,
    fields: applied,
    note: "Copy was applied to the draft only. Review it in the storefront editor and publish when ready.",
  };
}

export async function decideApproval(
  db: Database,
  context: ActorContext,
  input: { approvalId: string; decision: "approved" | "rejected"; note?: string },
) {
  if (context.role !== "owner" && context.role !== "manager") {
    throw new AgentError("Only an owner or manager can decide an approval.", 403, "forbidden");
  }

  const [approval] = await db
    .select()
    .from(approvalRequests)
    .where(and(eq(approvalRequests.id, input.approvalId), eq(approvalRequests.tenantId, context.tenant.id)))
    .limit(1);
  if (!approval) throw new AgentError("Approval not found.", 404);

  if (approval.status === "executed" || approval.status === "rejected") {
    return { approval, alreadyDecided: true, execution: approval.result ?? null };
  }
  if (approval.status !== "pending" && approval.status !== "approved") {
    throw new AgentError("This approval can no longer be decided.", 409, "approval_closed");
  }

  // The payload hash is the binding between what the approver saw and what is
  // executed. Any mutation after the request was raised invalidates approval.
  if (hashPayload(approval.payload) !== approval.payloadHash) {
    await db
      .update(approvalRequests)
      .set({ status: "expired", decidedAt: new Date(), result: { error: "payload_mismatch" } })
      .where(eq(approvalRequests.id, approval.id));
    throw new AgentError("The approval payload changed after it was prepared. Please ask the assistant to prepare it again.", 409, "payload_mismatch");
  }

  if (input.decision === "rejected") {
    const [updated] = await db
      .update(approvalRequests)
      .set({
        status: "rejected",
        decidedByUserId: context.user.id,
        decidedAt: new Date(),
        result: { note: input.note ?? null },
      })
      .where(eq(approvalRequests.id, approval.id))
      .returning();
    if (approval.artifactId) {
      await db.update(agentArtifacts).set({ status: "rejected" }).where(eq(agentArtifacts.id, approval.artifactId));
    }
    if (approval.runId) {
      await db
        .update(agentRuns)
        .set({
          status: "completed",
          result: { rejected: true, note: input.note ?? null },
          updatedAt: new Date(),
          completedAt: new Date(),
        })
        .where(eq(agentRuns.id, approval.runId));
    }
    await recordAudit(db, {
      tenantId: context.tenant.id,
      actorUserId: context.user.id,
      action: "approval.rejected",
      resourceType: "approval",
      resourceId: approval.id,
      metadata: { action: approval.action },
    });
    return { approval: updated, alreadyDecided: false, execution: { rejected: true } };
  }

  await db
    .update(approvalRequests)
    .set({ status: "approved", decidedByUserId: context.user.id, decidedAt: new Date() })
    .where(eq(approvalRequests.id, approval.id));

  try {
    const execution =
      approval.action === "send_campaign"
        ? await executeSendCampaign(db, context, approval)
        : approval.action === "apply_storefront_copy"
          ? await executeApplyStorefrontCopy(db, context, approval)
          : (() => {
              throw new AgentError(`Unsupported approval action: ${approval.action}`, 409, "unsupported_action");
            })();

    const [updated] = await db
      .update(approvalRequests)
      .set({ status: "executed", result: execution })
      .where(eq(approvalRequests.id, approval.id))
      .returning();

    if (approval.artifactId) {
      await db.update(agentArtifacts).set({ status: "applied" }).where(eq(agentArtifacts.id, approval.artifactId));
    }
    if (approval.runId) {
      await db
        .update(agentRuns)
        .set({ status: "completed", result: execution, updatedAt: new Date(), completedAt: new Date() })
        .where(eq(agentRuns.id, approval.runId));
    }

    await recordAudit(db, {
      tenantId: context.tenant.id,
      actorUserId: context.user.id,
      action: "approval.approved",
      resourceType: "approval",
      resourceId: approval.id,
      metadata: { action: approval.action, payloadHash: approval.payloadHash },
    });

    return { approval: updated, alreadyDecided: false, execution };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(approvalRequests)
      .set({ status: "approved", result: { error: message } })
      .where(eq(approvalRequests.id, approval.id));
    if (approval.runId) {
      await db
        .update(agentRuns)
        .set({ status: "failed", error: message, updatedAt: new Date(), completedAt: new Date() })
        .where(eq(agentRuns.id, approval.runId));
    }
    if (error instanceof AgentError) throw error;
    throw new AgentError("The approved action could not be executed.", 500, "execution_failed");
  }
}

export async function getPendingApprovals(db: Database, tenantId: string) {
  return db
    .select({ approval: approvalRequests, artifact: agentArtifacts, run: agentRuns })
    .from(approvalRequests)
    .leftJoin(agentArtifacts, eq(agentArtifacts.id, approvalRequests.artifactId))
    .leftJoin(agentRuns, eq(agentRuns.id, approvalRequests.runId))
    .where(and(eq(approvalRequests.tenantId, tenantId), eq(approvalRequests.status, "pending")))
    .orderBy(asc(approvalRequests.createdAt));
}

export type { TenantRole };
