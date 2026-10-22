import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { outboundMessages } from "@/db/schema";
import { can, roleLabel } from "@/lib/auth/permissions";
import { deliverMessage } from "@/lib/notifications";
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

describe("demo mode never claims external success", () => {
  it("records a message as simulated when no email provider is configured", async () => {
    const key = `demo-honesty-${Date.now()}`;
    const message = await deliverMessage(ctx.db, {
      tenantId: fixtures.amani.id,
      toAddress: "client@example.com",
      subject: "A studio note",
      body: "Hello there",
      idempotencyKey: key,
    });

    expect(message.status).toBe("simulated");
    expect(message.provider).toBe("demo");
    expect(message.providerMessageId).toBeNull();
    expect(message.sentAt).toBeNull();

    const again = await deliverMessage(ctx.db, {
      tenantId: fixtures.amani.id,
      toAddress: "client@example.com",
      subject: "A studio note",
      body: "Hello there",
      idempotencyKey: key,
    });
    expect(again.id).toBe(message.id);

    const rows = await ctx.db
      .select()
      .from(outboundMessages)
      .where(and(eq(outboundMessages.tenantId, fixtures.amani.id), eq(outboundMessages.idempotencyKey, key)));
    expect(rows).toHaveLength(1);
  });

  it("does not leak a simulated message into another tenant's records", async () => {
    const key = `demo-isolation-${Date.now()}`;
    const message = await deliverMessage(ctx.db, {
      tenantId: fixtures.amani.id,
      toAddress: "client@example.com",
      subject: "Private note",
      body: "Only Amani",
      idempotencyKey: key,
    });

    const bahariRows = await ctx.db
      .select()
      .from(outboundMessages)
      .where(and(eq(outboundMessages.tenantId, fixtures.bahari.id), eq(outboundMessages.idempotencyKey, key)));
    expect(bahariRows).toHaveLength(0);
    expect(message.tenantId).toBe(fixtures.amani.id);
  });
});

describe("role permissions", () => {
  it("gives owners the full tenant toolset", () => {
    expect(can("owner", "settings.manage")).toBe(true);
    expect(can("owner", "storefront.publish")).toBe(true);
    expect(can("owner", "ai.use")).toBe(true);
  });

  it("keeps managers out of account settings", () => {
    expect(can("manager", "settings.manage")).toBe(false);
    expect(can("manager", "storefront.publish")).toBe(true);
    expect(can("manager", "marketing.manage")).toBe(true);
  });

  it("limits staff to day-to-day workspace access", () => {
    expect(can("staff", "bookings.manage")).toBe(true);
    expect(can("staff", "customers.view")).toBe(true);
    expect(can("staff", "services.manage")).toBe(false);
    expect(can("staff", "marketing.manage")).toBe(false);
    expect(can("staff", "ai.use")).toBe(false);
    expect(can("staff", "settings.manage")).toBe(false);
  });

  it("labels roles for the dashboard", () => {
    expect(roleLabel("owner")).toBe("Owner");
    expect(roleLabel("manager")).toBe("Manager");
    expect(roleLabel("staff")).toBe("Staff");
  });
});
