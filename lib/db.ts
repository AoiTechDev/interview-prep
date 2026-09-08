import * as schema from "./schema";

/**
 * Two drivers, one API.
 *
 *   DATABASE_URL set   -> Neon over HTTP. This is what runs on Vercel.
 *   DATABASE_URL unset -> PGlite, real Postgres compiled to WASM, kept in
 *                         .pglite/. Lets the app run locally with nothing
 *                         installed and no cloud account.
 *
 * Both are Postgres, so the schema and every query are identical between them.
 * PGlite is a devDependency and is never reachable in production: a deployment
 * without DATABASE_URL fails loudly rather than quietly writing to a scratch
 * database that vanishes on the next deploy.
 *
 * The connection is created on first query, not on import. `next build`
 * evaluates these modules to collect route config, and a build should not
 * require a reachable database.
 */

type NeonDb = ReturnType<typeof import("drizzle-orm/neon-http").drizzle<typeof schema>>;
type PgliteDb = ReturnType<typeof import("drizzle-orm/pglite").drizzle<typeof schema>>;
type Db = NeonDb | PgliteDb;

declare global {
  // Reused across hot reloads so PGlite is not opened twice in dev.
  // eslint-disable-next-line no-var
  var __drillsDb: Db | undefined;
}

function createDb(): Db {
  const url = process.env.DATABASE_URL;

  if (url) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require("@neondatabase/serverless");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/neon-http");
    return drizzle(neon(url), { schema });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is not set. Add a Neon database from the Vercel dashboard's Storage tab, then redeploy.",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite");
  return drizzle(new PGlite(process.env.PGLITE_DIR ?? ".pglite"), { schema });
}

function resolveDb(): Db {
  if (!globalThis.__drillsDb) globalThis.__drillsDb = createDb();
  return globalThis.__drillsDb;
}

/** Behaves exactly like a Drizzle client; connects on the first property access. */
export const db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    const actual = resolveDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(actual, property, receiver);
    return typeof value === "function" ? value.bind(actual) : value;
  },
}) as Db;

export const usingNeon = Boolean(process.env.DATABASE_URL);
export { schema };
