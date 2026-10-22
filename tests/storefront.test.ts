import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { storefrontConfigs } from "@/db/schema";
import {
  getConfigRow,
  listVersions,
  publishDraft,
  rollbackToVersion,
  saveDraft,
  StorefrontError,
} from "@/lib/storefront-service";
import type { StorefrontConfig } from "@/lib/storefront";
import { normalizeHost } from "@/lib/tenant";
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

async function configFor(tenantId: string) {
  const row = await getConfigRow(ctx.db, tenantId);
  if (!row) throw new Error("Expected storefront config");
  return row;
}

describe("storefront drafts, publishing and rollback", () => {
  it("saves a draft without changing the published site", async () => {
    const before = await configFor(fixtures.amani.id);
    const draft = structuredClone(before.draft as unknown as StorefrontConfig);
    draft.content.heroTitle = "A slower morning, held for you.";

    const saved = await saveDraft(ctx.db, { tenantId: fixtures.amani.id, userId: fixtures.amaniOwner.id, config: draft });
    expect(saved.draftChanged).toBe(true);

    const after = await configFor(fixtures.amani.id);
    expect((after.draft as unknown as StorefrontConfig).content.heroTitle).toBe("A slower morning, held for you.");
    expect((after.published as unknown as StorefrontConfig).content.heroTitle).not.toBe("A slower morning, held for you.");
  });

  it("publishes an immutable snapshot and increases the version", async () => {
    const before = await configFor(fixtures.amani.id);
    const versionsBefore = await listVersions(ctx.db, fixtures.amani.id, 50);
    const draft = structuredClone(before.draft as unknown as StorefrontConfig);
    draft.content.heroTitle = "Published proof";
    await saveDraft(ctx.db, { tenantId: fixtures.amani.id, userId: fixtures.amaniOwner.id, config: draft });

    const published = await publishDraft(ctx.db, { tenantId: fixtures.amani.id, userId: fixtures.amaniOwner.id, note: "Test publication" });
    expect(published.version).toBe(versionsBefore.length + 1);

    const after = await configFor(fixtures.amani.id);
    expect((after.published as unknown as StorefrontConfig).content.heroTitle).toBe("Published proof");
    expect((after.draft as unknown as StorefrontConfig).content.heroTitle).toBe("Published proof");

    const versionsAfter = await listVersions(ctx.db, fixtures.amani.id, 50);
    expect(versionsAfter).toHaveLength(versionsBefore.length + 1);
    expect(versionsAfter[0]?.note).toBe("Test publication");
  });

  it("rolls back by creating a new version rather than deleting history", async () => {
    const versions = await listVersions(ctx.db, fixtures.amani.id, 50);
    const original = versions[versions.length - 1];
    const countBefore = versions.length;

    const result = await rollbackToVersion(ctx.db, {
      tenantId: fixtures.amani.id,
      userId: fixtures.amaniOwner.id,
      versionId: original!.id,
    });
    expect(result.restoredVersion).toBe(original!.version);

    const after = await configFor(fixtures.amani.id);
    const versionsAfter = await listVersions(ctx.db, fixtures.amani.id, 50);
    expect(versionsAfter).toHaveLength(countBefore + 1);
    expect(versionsAfter[0]?.version).toBe(result.newVersion);
    const restoredPublished = after.published as unknown as StorefrontConfig;
    const originalSnapshot = original!.snapshot as unknown as StorefrontConfig;
    expect(restoredPublished.version).toBe(result.newVersion);
    expect(restoredPublished.content.heroTitle).toBe(originalSnapshot.content.heroTitle);
    expect(restoredPublished.theme.preset).toBe(originalSnapshot.theme.preset);
  });

  it("rejects invalid configuration and a version from another tenant", async () => {
    await expect(
      saveDraft(ctx.db, {
        tenantId: fixtures.amani.id,
        userId: fixtures.amaniOwner.id,
        config: { theme: {}, content: {}, sections: "not-an-array" },
      }),
    ).rejects.toBeInstanceOf(StorefrontError);

    const versions = await listVersions(ctx.db, fixtures.amani.id, 5);
    await expect(
      rollbackToVersion(ctx.db, {
        tenantId: fixtures.bahari.id,
        userId: fixtures.bahariOwner.id,
        versionId: versions[0]!.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("does not let one tenant's save affect another tenant", async () => {
    const bahariBefore = await configFor(fixtures.bahari.id);
    const amani = await configFor(fixtures.amani.id);
    const draft = structuredClone(amani.draft as unknown as StorefrontConfig);
    draft.content.heroTitle = "Amani only";
    await saveDraft(ctx.db, { tenantId: fixtures.amani.id, userId: fixtures.amaniOwner.id, config: draft });

    const bahariAfter = await configFor(fixtures.bahari.id);
    expect(JSON.stringify(bahariAfter.draft)).toBe(JSON.stringify(bahariBefore.draft));

    const [row] = await ctx.db
      .select()
      .from(storefrontConfigs)
      .where(and(eq(storefrontConfigs.tenantId, fixtures.bahari.id), eq(storefrontConfigs.id, bahariBefore.id)));
    expect((row?.draft as unknown as StorefrontConfig).content.heroTitle).not.toBe("Amani only");
  });
});

describe("host normalisation", () => {
  it("strips ports, casing and trailing dots, but never looks up membership", () => {
    expect(normalizeHost("AMANI.Localhost:3000")).toBe("amani.localhost");
    expect(normalizeHost("amani.example.com,")).toBe("amani.example.com");
    expect(normalizeHost(null)).toBe("");
  });
});
