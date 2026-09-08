/**
 * Loads .env / .env.local using Next's own loader, so scripts run outside the
 * dev server resolve DATABASE_URL with exactly the same precedence Next uses.
 *
 * Imported for its side effect, and imported first: ES modules evaluate their
 * imports in source order, so this runs before lib/db is pulled in.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
