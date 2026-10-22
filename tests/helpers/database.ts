import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, asc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Database } from "@/db";
import { seedDatabase } from "@/db/seed";

export type TestDatabase = {
  db: Database;
  client: PGlite;
  close: () => Promise<void>;
};

/**
 * Each suite gets a fresh in-memory Postgres (PGlite) with the real migration
 * and the real demo seed. Nothing touches the developer's local .nuru data.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzle(client, { schema }) as unknown as Database;
  await migrate(db as never, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await seedDatabase(db);
  return { db, client, close: () => client.close() };
}

export async function getTenant(db: Database, slug: string) {
  const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, slug)).limit(1);
  if (!tenant) throw new Error(`Missing seeded tenant: ${slug}`);
  return tenant;
}

export async function getUser(db: Database, email: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user) throw new Error(`Missing seeded user: ${email}`);
  return user;
}

export async function getFixtures(db: Database) {
  const amani = await getTenant(db, "amani");
  const bahari = await getTenant(db, "bahari");
  const amaniOwner = await getUser(db, "owner@amani.demo");
  const bahariOwner = await getUser(db, "owner@bahari.demo");
  const [amaniStaff] = await db
    .select()
    .from(schema.staffProfiles)
    .where(and(eq(schema.staffProfiles.tenantId, amani.id), eq(schema.staffProfiles.isActive, true)))
    .orderBy(asc(schema.staffProfiles.sortOrder))
    .limit(1);
  const [bahariStaff] = await db
    .select()
    .from(schema.staffProfiles)
    .where(and(eq(schema.staffProfiles.tenantId, bahari.id), eq(schema.staffProfiles.isActive, true)))
    .orderBy(asc(schema.staffProfiles.sortOrder))
    .limit(1);
  const [amaniService] = await db
    .select()
    .from(schema.services)
    .where(and(eq(schema.services.tenantId, amani.id), eq(schema.services.isActive, true)))
    .orderBy(asc(schema.services.sortOrder))
    .limit(1);
  const [bahariService] = await db
    .select()
    .from(schema.services)
    .where(and(eq(schema.services.tenantId, bahari.id), eq(schema.services.isActive, true)))
    .orderBy(asc(schema.services.sortOrder))
    .limit(1);
  if (!amaniStaff || !bahariStaff || !amaniService || !bahariService) {
    throw new Error("Seed fixtures are incomplete");
  }
  return { amani, bahari, amaniOwner, bahariOwner, amaniStaff, bahariStaff, amaniService, bahariService };
}
