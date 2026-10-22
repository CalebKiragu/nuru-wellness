import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { ensureDb } from "@/db";
import { tenantMemberships, sessions, tenants, users, type Tenant, type TenantRole, type User } from "@/db/schema";
import { verifyPassword } from "./password";
import { sha256 } from "@/lib/hash";
import { getRequestHost, resolveTenantForHost } from "@/lib/tenant";
import { env, assertServerSecret } from "@/lib/env";
import { can, type Permission } from "./permissions";

export const SESSION_COOKIE = "nuru_session";
export const TENANT_COOKIE = "nuru_dashboard_tenant";
const SESSION_TTL_DAYS = 14;

export type DashboardContext = {
  user: User;
  tenant: Tenant;
  role: TenantRole;
  memberships: { tenant: Tenant; role: TenantRole }[];
};

export async function createSession(userId: string, meta?: { ip?: string; userAgent?: string }) {
  assertServerSecret();
  const db = await ensureDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt,
    ip: meta?.ip ?? null,
    userAgent: meta?.userAgent?.slice(0, 400) ?? null,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await ensureDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  store.delete(SESSION_COOKIE);
}

export async function authenticate(email: string, password: string) {
  const db = await ensureDb();
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

export const getSessionUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await ensureDb();
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
});

/**
 * Demo-only convenience: when DEMO_AUTO_LOGIN is on, resolve a workspace owner
 * without a session so the public demo can be explored without signing in.
 * This is deliberately gated on DEMO_MODE and must never be used with real data.
 */
async function getDemoAutoLoginUser(): Promise<User | null> {
  if (!env.demoMode || !env.demoAutoLogin) return null;
  const db = await ensureDb();

  if (env.demoAutoLoginEmail) {
    const [selected] = await db.select().from(users).where(eq(users.email, env.demoAutoLoginEmail)).limit(1);
    if (selected) return selected;
  }

  const hostTenant = await resolveTenantForHost(await getRequestHost());
  const store = await cookies();
  const selectedTenantId = store.get(TENANT_COOKIE)?.value;
  let tenant: Tenant | null = hostTenant;

  if (!tenant && selectedTenantId) {
    const [selected] = await db.select().from(tenants).where(eq(tenants.id, selectedTenantId)).limit(1);
    tenant = selected ?? null;
  }

  if (tenant) {
    const [owner] = await db
      .select({ user: users })
      .from(tenantMemberships)
      .innerJoin(users, eq(users.id, tenantMemberships.userId))
      .where(and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.role, "owner")))
      .limit(1);
    if (owner?.user) return owner.user;

    const [member] = await db
      .select({ user: users })
      .from(tenantMemberships)
      .innerJoin(users, eq(users.id, tenantMemberships.userId))
      .where(eq(tenantMemberships.tenantId, tenant.id))
      .limit(1);
    if (member?.user) return member.user;
  }

  const [fallback] = await db.select().from(users).where(eq(users.email, "owner@amani.demo")).limit(1);
  return fallback ?? null;
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  return (await getSessionUser()) ?? (await getDemoAutoLoginUser());
});

/** Platform admin pages also work without a login in auto-login demo mode. */
export const getAdminUser = cache(async (): Promise<User | null> => {
  const sessionUser = await getSessionUser();
  if (sessionUser) return sessionUser;
  if (!env.demoMode || !env.demoAutoLogin) return null;
  const db = await ensureDb();
  const [admin] = await db.select().from(users).where(eq(users.email, "admin@nuru.demo")).limit(1);
  return admin ?? null;
});

export const getMemberships = cache(async (userId: string) => {
  const db = await ensureDb();
  const rows = await db
    .select({ tenant: tenants, role: tenantMemberships.role })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
    .where(eq(tenantMemberships.userId, userId));
  return rows;
});

export const getDashboardContext = cache(async (): Promise<DashboardContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const memberships = await getMemberships(user.id);
  if (!memberships.length) return null;
  const store = await cookies();
  const selected = store.get(TENANT_COOKIE)?.value;
  const active = memberships.find((m) => m.tenant.id === selected) ?? memberships[0];
  return { user, tenant: active.tenant, role: active.role, memberships };
});

export async function requirePermission(permission: Permission): Promise<DashboardContext> {
  const context = await getDashboardContext();
  if (!context) throw new Error("UNAUTHENTICATED");
  if (!can(context.role, permission)) throw new Error("FORBIDDEN");
  return context;
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  };
}

export async function setActiveTenant(userId: string, tenantId: string) {
  const memberships = await getMemberships(userId);
  if (!memberships.some((m) => m.tenant.id === tenantId)) {
    throw new Error("FORBIDDEN");
  }
  const store = await cookies();
  store.set(TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
