import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  agentRuns,
  approvalRequests,
  campaigns,
  outboundMessages,
  storefrontConfigs,
} from "@/db/schema";
import { decideApproval, getPendingApprovals, runAgentWorkflow } from "@/lib/ai/engine";
import { hashPayload } from "@/lib/hash";
import { listAgentRuns } from "@/lib/dashboard-data";
import { createTestDatabase, getFixtures, type TestDatabase } from "./helpers/database";

let ctx: TestDatabase;
let fixtures: Awaited<ReturnType<typeof getFixtures>>;

beforeAll(async () => {
  ctx = await createTestDatabase();
  fixtures = await getFixtures(ctx.db);
});

afterAll(async () => {
  await ctx?.close();
});

function actor() {
  return { tenant: fixtures.amani, user: fixtures.amaniOwner, role: "owner" as const };
}

async function approvalForRun(runId: string) {
  const [row] = await ctx.db
    .select()
    .from(approvalRequests)
    .where(and(eq(approvalRequests.tenantId, fixtures.amani.id), eq(approvalRequests.runId, runId)));
  if (!row) throw new Error("Expected an approval request");
  return row;
}

async function campaignCount(tenantId: string) {
  const [row] = await ctx.db.select({ value: sql<number>`count(*)::int` }).from(campaigns).where(eq(campaigns.tenantId, tenantId));
  return Number(row?.value ?? 0);
}

describe("AI workflows and human approvals", () => {
  it("persists a queued→awaiting_approval run with a hash-bound payload", async () => {
    const result = await runAgentWorkflow(ctx.db, actor(), {
      task: "marketing_campaign",
      prompt: "Help me fill the quiet slots this week with a note to consented clients.",
    });

    expect(result.awaitingApproval).toBe(true);
    expect(result.provider.id).toBe("mock");
    expect(result.provider.live).toBe(false);

    const [run] = await ctx.db.select().from(agentRuns).where(eq(agentRuns.id, result.run.id));
    expect(run?.status).toBe("awaiting_approval");
    expect(run?.tenantId).toBe(fixtures.amani.id);

    const approval = await approvalForRun(result.run.id);
    expect(approval.status).toBe("pending");
    expect(approval.payloadHash).toBe(hashPayload(approval.payload));

    const detail = await listAgentRuns(ctx.db, fixtures.amani.id, 20);
    const persisted = detail.find((entry) => entry.run.id === result.run.id);
    expect(persisted?.steps.length).toBeGreaterThan(3);
    expect(persisted?.artifacts[0]?.type).toBe("campaign_draft");
  });

  it("refuses approval when the payload was changed after it was prepared", async () => {
    const before = await campaignCount(fixtures.amani.id);
    const result = await runAgentWorkflow(ctx.db, actor(), {
      task: "marketing_campaign",
      prompt: "Draft a note for clients who opted in.",
    });
    const approval = await approvalForRun(result.run.id);

    await ctx.db
      .update(approvalRequests)
      .set({ payload: { ...approval.payload, subject: "Tampered subject" } })
      .where(eq(approvalRequests.id, approval.id));

    await expect(
      decideApproval(ctx.db, actor(), { approvalId: approval.id, decision: "approved" }),
    ).rejects.toMatchObject({ status: 409, code: "payload_mismatch" });

    const [stored] = await ctx.db.select().from(approvalRequests).where(eq(approvalRequests.id, approval.id));
    expect(stored?.status).toBe("expired");
    expect(await campaignCount(fixtures.amani.id)).toBe(before);
  });

  it("executes an approved campaign as simulated and never claims delivery", async () => {
    const before = await campaignCount(fixtures.amani.id);
    const result = await runAgentWorkflow(ctx.db, actor(), {
      task: "marketing_campaign",
      prompt: "Write to consented clients about genuinely open time.",
    });
    const approval = await approvalForRun(result.run.id);

    const decision = await decideApproval(ctx.db, actor(), { approvalId: approval.id, decision: "approved" });
    expect(decision.alreadyDecided).toBe(false);
    expect(decision.execution).toMatchObject({ sent: 0, externalDelivery: false });
    expect((decision.execution as { simulated: number }).simulated).toBeGreaterThan(0);
    expect(String((decision.execution as { note?: string }).note)).toMatch(/simulated/i);

    expect(await campaignCount(fixtures.amani.id)).toBe(before + 1);

    const [campaign] = await ctx.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.tenantId, fixtures.amani.id), eq(campaigns.id, String((decision.execution as { campaignId: string }).campaignId))));
    expect(campaign?.status).toBe("simulated");

    const messages = await ctx.db.select().from(outboundMessages).where(eq(outboundMessages.campaignId, campaign!.id));
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.every((message) => message.status === "simulated" && message.provider === "demo")).toBe(true);

    const [stored] = await ctx.db.select().from(approvalRequests).where(eq(approvalRequests.id, approval.id));
    expect(stored?.status).toBe("executed");
  });

  it("applies an approved copy refresh to the draft only", async () => {
    const [before] = await ctx.db.select().from(storefrontConfigs).where(eq(storefrontConfigs.tenantId, fixtures.amani.id));
    const publishedBefore = JSON.stringify(before?.published);

    const result = await runAgentWorkflow(ctx.db, actor(), {
      task: "storefront_copy",
      prompt: "Make the homepage feel warmer without inventing claims.",
    });
    const approval = await approvalForRun(result.run.id);
    expect(approval.action).toBe("apply_storefront_copy");

    const decision = await decideApproval(ctx.db, actor(), { approvalId: approval.id, decision: "approved" });
    expect(decision.execution).toMatchObject({ draftUpdated: true, published: false });

    const [after] = await ctx.db.select().from(storefrontConfigs).where(eq(storefrontConfigs.tenantId, fixtures.amani.id));
    expect(JSON.stringify(after?.draft)).not.toBe(JSON.stringify(before?.draft));
    expect(JSON.stringify(after?.published)).toBe(publishedBefore);
  });

  it("lets a human reject a prepared action without side effects", async () => {
    const before = await campaignCount(fixtures.amani.id);
    const result = await runAgentWorkflow(ctx.db, actor(), {
      task: "marketing_campaign",
      prompt: "Draft something for the quiet week.",
    });
    const approval = await approvalForRun(result.run.id);

    const decision = await decideApproval(ctx.db, actor(), { approvalId: approval.id, decision: "rejected" });
    expect(decision.execution).toEqual({ rejected: true });
    expect(await campaignCount(fixtures.amani.id)).toBe(before);

    const [run] = await ctx.db.select().from(agentRuns).where(eq(agentRuns.id, result.run.id));
    expect(run?.status).toBe("completed");
  });

  it("scopes runs, approvals and tool facts to the active tenant", async () => {
    const result = await runAgentWorkflow(ctx.db, actor(), {
      task: "business_question",
      prompt: "How is this week looking?",
    });

    const bahariPending = await getPendingApprovals(ctx.db, fixtures.bahari.id);
    expect(bahariPending.some((row) => row.approval.runId === result.run.id)).toBe(false);

    const bahariRuns = await listAgentRuns(ctx.db, fixtures.bahari.id, 50);
    expect(bahariRuns.some((row) => row.run.id === result.run.id)).toBe(false);

    const detail = await listAgentRuns(ctx.db, fixtures.amani.id, 50);
    const run = detail.find((row) => row.run.id === result.run.id);
    const profileStep = run?.steps.find((step) => step.name === "get_business_profile");
    expect(profileStep?.output).toMatchObject({ businessName: "Amani Bodywork" });
    expect(JSON.stringify(profileStep?.output)).not.toContain("Bahari");
  });
});
