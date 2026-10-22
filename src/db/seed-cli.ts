import "dotenv/config";
import { sql } from "drizzle-orm";
import { ensureDb } from "./index";
import { tenants } from "./schema";

/**
 * Explicit seed command. `ensureDb` runs migrations and, when DEMO_MODE is on,
 * seeds the two curated demonstration tenants if the database is empty.
 */
async function main() {
  const db = await ensureDb();
  const rows = await db.select({ name: tenants.name, slug: tenants.slug, isDemo: tenants.isDemo }).from(tenants).orderBy(tenants.name);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(tenants);
  console.log(`Database ready. ${Number(count)} tenant(s):`);
  for (const row of rows) console.log(`  - ${row.name} (${row.slug})${row.isDemo ? " [demo]" : ""}`);
  if (Number(count) === 0) {
    console.log("No tenants were seeded. Set DEMO_MODE=true to load the demonstration data.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
