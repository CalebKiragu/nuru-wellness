import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __nuruDb?: Promise<Database>;
  __nuruDbKind?: "postgres" | "pglite";
  __nuruBootstrapped?: Promise<void>;
};

async function createDb(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    });
    globalForDb.__nuruDbKind = "postgres";
    return drizzlePg(pool, { schema }) as unknown as Database;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".nuru", "pgdata");
  fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  globalForDb.__nuruDbKind = "pglite";
  return drizzlePglite(client, { schema }) as unknown as Database;
}

export function getDb(): Promise<Database> {
  if (!globalForDb.__nuruDb) {
    globalForDb.__nuruDb = createDb();
  }
  return globalForDb.__nuruDb;
}

async function runMigrations() {
  const db = await getDb();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(`Migration folder not found at ${migrationsFolder}`);
  }

  if (globalForDb.__nuruDbKind === "postgres") {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db as never, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder });
  }
}

/**
 * Ensures the database schema exists and, in demo mode, that the curated
 * demonstration data is present. Safe to call from every request path.
 */
export async function ensureDb(): Promise<Database> {
  if (!globalForDb.__nuruBootstrapped) {
    globalForDb.__nuruBootstrapped = (async () => {
      await runMigrations();
      const demoMode = process.env.DEMO_MODE === undefined ? process.env.NODE_ENV !== "production" : process.env.DEMO_MODE === "true";
      if (demoMode) {
        const { seedIfEmpty } = await import("./seed");
        await seedIfEmpty(await getDb());
      }
    })().catch((error) => {
      globalForDb.__nuruBootstrapped = undefined;
      throw error;
    });
  }
  await globalForDb.__nuruBootstrapped;
  return getDb();
}
