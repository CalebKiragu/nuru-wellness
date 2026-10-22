import "server-only";
import { cookies, headers } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { ensureDb } from "@/db";
import {
  businessHours,
  locations,
  serviceAddons,
  services,
  staffProfiles,
  staffServices,
  storefrontConfigs,
  tenantDomains,
  tenants,
  type Service,
  type StaffProfile,
  type Tenant,
} from "@/db/schema";
import { env } from "@/lib/env";
import type { StorefrontConfig } from "@/lib/storefront";

export const DEMO_TENANT_COOKIE = "nuru_demo_tenant";

export function normalizeHost(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export async function getRequestHost(): Promise<string> {
  const h = await headers();
  return normalizeHost(h.get("x-forwarded-host") ?? h.get("host"));
}

export async function getDemoTenantSlug(): Promise<string | null> {
  if (!env.demoMode) return null;
  const store = await cookies();
  return store.get(DEMO_TENANT_COOKIE)?.value ?? null;
}

/**
 * Public tenant resolution. This is deliberately separate from dashboard
 * authorization: a hostname or demo slug can only select published tenant
 * content, never grant access to private data.
 */
export async function resolveTenantForHost(host: string): Promise<Tenant | null> {
  const db = await ensureDb();
  const normalized = normalizeHost(host);
  const rootHost = normalizeHost(env.rootDomain.replace(/^[^.]+\./, "")) || "localhost";

  const candidates = new Set<string>();
  if (normalized) candidates.add(normalized);
  const demoSlug = await getDemoTenantSlug();
  if (demoSlug) candidates.add(`${demoSlug}.localhost`);

  for (const candidate of candidates) {
    const [row] = await db
      .select({ tenant: tenants })
      .from(tenants)
      .innerJoin(tenantDomains, eq(tenantDomains.tenantId, tenants.id))
      .where(and(eq(tenantDomains.hostname, candidate), eq(tenants.status, "active")))
      .limit(1);
    if (row?.tenant) return row.tenant;
  }

  // Subdomain of the configured root domain (e.g. amani.nuru.example.com).
  const suffixes = [rootHost, "localhost"];
  for (const suffix of suffixes) {
    if (normalized.endsWith(`.${suffix}`)) {
      const slug = normalized.slice(0, -(suffix.length + 1)).split(".").pop();
      if (slug) {
        const [tenant] = await db
          .select()
          .from(tenants)
          .where(and(eq(tenants.slug, slug), eq(tenants.status, "active")))
          .limit(1);
        if (tenant) return tenant;
      }
    }
  }

  if (env.demoMode && demoSlug) {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.slug, demoSlug), eq(tenants.status, "active")))
      .limit(1);
    if (tenant) return tenant;
  }

  return null;
}

export async function getPublicTenant(): Promise<Tenant | null> {
  const host = await getRequestHost();
  return resolveTenantForHost(host);
}

export async function getStorefrontConfig(tenantId: string, mode: "published" | "draft" = "published") {
  const db = await ensureDb();
  const [config] = await db
    .select()
    .from(storefrontConfigs)
    .where(eq(storefrontConfigs.tenantId, tenantId))
    .limit(1);
  if (!config) return null;
  const raw = mode === "published" ? config.published : config.draft;
  return raw as unknown as StorefrontConfig;
}

export type StorefrontData = {
  tenant: Tenant;
  config: StorefrontConfig;
  services: (Service & { staff: StaffProfile[]; addons: { id: string; name: string; description: string; priceCents: number; durationMinutes: number }[] })[];
  staff: StaffProfile[];
  location: {
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    country: string;
    phone: string | null;
    email: string | null;
  } | null;
  hours: { weekday: number; opensAt: string; closesAt: string; isClosed: boolean }[];
};

export async function getStorefrontData(tenant: Tenant, mode: "published" | "draft" = "published"): Promise<StorefrontData | null> {
  const db = await ensureDb();
  const config = await getStorefrontConfig(tenant.id, mode);
  if (!config) return null;

  const [serviceRows, staffRows, links, locationRows, hourRows, addonRows] = await Promise.all([
    db.select().from(services).where(and(eq(services.tenantId, tenant.id), eq(services.isActive, true))).orderBy(asc(services.sortOrder)),
    db.select().from(staffProfiles).where(and(eq(staffProfiles.tenantId, tenant.id), eq(staffProfiles.isActive, true))).orderBy(asc(staffProfiles.sortOrder)),
    db.select().from(staffServices).where(eq(staffServices.tenantId, tenant.id)),
    db.select().from(locations).where(eq(locations.tenantId, tenant.id)).limit(1),
    db.select().from(businessHours).where(eq(businessHours.tenantId, tenant.id)).orderBy(asc(businessHours.weekday)),
    db.select().from(serviceAddons).where(eq(serviceAddons.tenantId, tenant.id)),
  ]);

  return {
    tenant,
    config,
    services: serviceRows.map((service) => ({
      ...service,
      staff: staffRows.filter((staff) => links.some((l) => l.serviceId === service.id && l.staffId === staff.id)),
      addons: addonRows
        .filter((addon) => addon.serviceId === service.id && addon.isActive)
        .map((addon) => ({
          id: addon.id,
          name: addon.name,
          description: addon.description,
          priceCents: addon.priceCents,
          durationMinutes: addon.durationMinutes,
        })),
    })),
    staff: staffRows,
    location: locationRows[0]
      ? {
          name: locationRows[0].name,
          addressLine1: locationRows[0].addressLine1,
          addressLine2: locationRows[0].addressLine2,
          city: locationRows[0].city,
          country: locationRows[0].country,
          phone: locationRows[0].phone,
          email: locationRows[0].email,
        }
      : null,
    hours: hourRows.map((h) => ({ weekday: h.weekday, opensAt: h.opensAt, closesAt: h.closesAt, isClosed: h.isClosed })),
  };
}

export async function listPublicTenantsForDemo() {
  if (!env.demoMode) return [];
  const db = await ensureDb();
  return db
    .select({ slug: tenants.slug, name: tenants.name })
    .from(tenants)
    .where(and(eq(tenants.status, "active"), eq(tenants.isDemo, true)));
}
