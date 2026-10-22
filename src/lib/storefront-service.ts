import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db";
import { publishedVersions, storefrontConfigs } from "@/db/schema";
import {
  defaultSections,
  presetTheme,
  sectionLabels,
  type StorefrontConfig,
  type StorefrontSection,
  type StorefrontTheme,
} from "@/lib/storefront";
import { recordAudit } from "@/lib/audit";

const sectionKeys = Object.keys(sectionLabels) as StorefrontSection["key"][];

const colorSchema = z.object({
  brand: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  brandDeep: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  canvas: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  surface: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ink: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  muted: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  border: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  onBrand: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  soft: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const themeSchema = z.object({
  preset: z.enum(["botanical", "coastal", "earth", "custom"]),
  colors: colorSchema,
  displayFont: z.enum(["editorial", "modern", "classic"]),
  radius: z.enum(["none", "soft", "rounded"]),
  buttonStyle: z.enum(["solid", "outline", "pill"]),
  cardStyle: z.enum(["flat", "elevated", "outline"]),
  width: z.enum(["narrow", "standard", "wide"]),
  spacing: z.enum(["compact", "balanced", "airy"]),
});

const text = z.string().max(4000);
const contentSchema = z.object({
  businessName: z.string().trim().min(1).max(80),
  tagline: text,
  heroEyebrow: text,
  heroTitle: text,
  heroText: text,
  heroImage: z.string().min(1).max(500),
  heroImageAlt: text,
  heroFocal: z.string().max(40),
  primaryCta: z.string().max(60),
  secondaryCta: z.string().max(60),
  servicesEyebrow: text,
  servicesTitle: text,
  servicesText: text,
  aboutTitle: text,
  aboutText: text,
  aboutImage: z.string().min(1).max(500),
  aboutImageAlt: text,
  aboutHighlights: z.array(z.string().max(160)).max(8),
  teamTitle: text,
  teamText: text,
  galleryTitle: text,
  galleryText: text,
  galleryImages: z.array(z.object({ url: z.string().min(1).max(500), alt: z.string().max(200) })).max(8),
  testimonialsTitle: text,
  testimonialsText: text,
  testimonials: z
    .array(z.object({ quote: z.string().max(600), author: z.string().max(80), service: z.string().max(80) }))
    .max(6),
  locationTitle: text,
  locationText: text,
  address: z.string().max(200),
  city: z.string().max(120),
  phone: z.string().max(40),
  email: z.string().max(160),
  hours: z.array(z.object({ day: z.string().max(60), hours: z.string().max(80) })).max(7),
  instagram: z.string().max(80).optional(),
  instagramUrl: z.string().max(300).optional(),
  footerNote: text,
  cancellationPolicy: text,
  depositPolicy: text,
  arrivalPolicy: text,
  seoTitle: z.string().max(120),
  seoDescription: z.string().max(300),
});

const sectionSchema = z.object({
  key: z.enum(sectionKeys as [StorefrontSection["key"], ...StorefrontSection["key"][]]),
  label: z.string().max(80),
  visible: z.boolean(),
  sortOrder: z.number().int().min(0).max(20),
});

export const storefrontConfigSchema = z.object({
  theme: themeSchema,
  content: contentSchema,
  sections: z.array(sectionSchema).min(1).max(sectionKeys.length),
  version: z.number().int().optional(),
  updatedAt: z.string().optional(),
});

export type StorefrontSaveInput = z.infer<typeof storefrontConfigSchema>;

export class StorefrontError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function normalizeConfig(input: StorefrontSaveInput): StorefrontConfig {
  const seen = new Set<string>();
  const sections = [...input.sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((section) => {
      if (seen.has(section.key)) return false;
      seen.add(section.key);
      return true;
    })
    .map((section, index) => ({ ...section, sortOrder: index, label: sectionLabels[section.key] ?? section.label }));

  for (const section of defaultSections) {
    if (!seen.has(section.key)) sections.push({ ...section, sortOrder: sections.length });
  }

  const theme: StorefrontTheme =
    input.theme.preset === "custom"
      ? input.theme
      : { ...presetTheme(input.theme.preset), ...input.theme, preset: input.theme.preset };

  return {
    theme,
    content: input.content,
    sections,
    version: input.version,
    updatedAt: new Date().toISOString(),
  };
}

export async function getConfigRow(db: Database, tenantId: string) {
  const [row] = await db.select().from(storefrontConfigs).where(eq(storefrontConfigs.tenantId, tenantId)).limit(1);
  return row ?? null;
}

export async function saveDraft(
  db: Database,
  input: { tenantId: string; userId: string; config: unknown },
) {
  const parsed = storefrontConfigSchema.safeParse(input.config);
  if (!parsed.success) {
    throw new StorefrontError(parsed.error.issues[0]?.message ?? "Invalid storefront configuration.");
  }
  const row = await getConfigRow(db, input.tenantId);
  if (!row) throw new StorefrontError("Storefront configuration not found.", 404);
  const config = normalizeConfig(parsed.data);

  const [updated] = await db
    .update(storefrontConfigs)
    .set({ draft: config as unknown as Record<string, unknown>, updatedAt: new Date(), updatedBy: input.userId })
    .where(eq(storefrontConfigs.tenantId, input.tenantId))
    .returning();

  await recordAudit(db, {
    tenantId: input.tenantId,
    actorUserId: input.userId,
    action: "storefront.draft_saved",
    resourceType: "storefront",
    resourceId: updated.id,
    metadata: { preset: config.theme.preset, sections: config.sections.filter((s) => s.visible).length },
  });

  return { config, draftChanged: true, publishedChanged: false };
}

export async function publishDraft(
  db: Database,
  input: { tenantId: string; userId: string; note?: string },
) {
  const row = await getConfigRow(db, input.tenantId);
  if (!row) throw new StorefrontError("Storefront configuration not found.", 404);
  const draft = row.draft as unknown as StorefrontConfig;

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${publishedVersions.version}), 0)::int` })
    .from(publishedVersions)
    .where(eq(publishedVersions.tenantId, input.tenantId));
  const version = Number(max ?? 0) + 1;

  const [snapshot] = await db
    .insert(publishedVersions)
    .values({
      tenantId: input.tenantId,
      version,
      snapshot: draft as unknown as Record<string, unknown>,
      note: input.note?.slice(0, 300) ?? "Published from the storefront editor",
      createdBy: input.userId,
    })
    .returning();

  const published = { ...draft, version };
  await db
    .update(storefrontConfigs)
    .set({ published: published as unknown as Record<string, unknown>, updatedAt: new Date(), updatedBy: input.userId })
    .where(eq(storefrontConfigs.tenantId, input.tenantId));

  await recordAudit(db, {
    tenantId: input.tenantId,
    actorUserId: input.userId,
    action: "storefront.published",
    resourceType: "storefront",
    resourceId: snapshot.id,
    metadata: { version, preset: draft.theme?.preset },
  });

  return { version, publishedAt: snapshot.createdAt, published };
}

export async function rollbackToVersion(
  db: Database,
  input: { tenantId: string; userId: string; versionId: string },
) {
  const [snapshot] = await db
    .select()
    .from(publishedVersions)
    .where(and(eq(publishedVersions.id, input.versionId), eq(publishedVersions.tenantId, input.tenantId)))
    .limit(1);
  if (!snapshot) throw new StorefrontError("Published version not found.", 404);

  const restored = snapshot.snapshot as unknown as StorefrontConfig;
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${publishedVersions.version}), 0)::int` })
    .from(publishedVersions)
    .where(eq(publishedVersions.tenantId, input.tenantId));
  const version = Number(max ?? 0) + 1;

  await db
    .update(storefrontConfigs)
    .set({
      draft: { ...restored, updatedAt: new Date().toISOString() } as unknown as Record<string, unknown>,
      published: { ...restored, version } as unknown as Record<string, unknown>,
      updatedAt: new Date(),
      updatedBy: input.userId,
    })
    .where(eq(storefrontConfigs.tenantId, input.tenantId));

  await db.insert(publishedVersions).values({
    tenantId: input.tenantId,
    version,
    snapshot: restored as unknown as Record<string, unknown>,
    note: `Rolled back to version ${snapshot.version}`,
    createdBy: input.userId,
  });

  await recordAudit(db, {
    tenantId: input.tenantId,
    actorUserId: input.userId,
    action: "storefront.published",
    resourceType: "storefront",
    resourceId: snapshot.id,
    metadata: { rollbackFrom: snapshot.version, newVersion: version },
  });

  return { restoredVersion: snapshot.version, newVersion: version };
}

export async function listVersions(db: Database, tenantId: string, limit = 12) {
  return db
    .select()
    .from(publishedVersions)
    .where(eq(publishedVersions.tenantId, tenantId))
    .orderBy(desc(publishedVersions.version))
    .limit(limit);
}
