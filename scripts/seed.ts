/**
 * Creates the tables if they are missing, then loads seed/questions.json —
 * but only into an empty database. Running it against a database that already
 * has questions is a no-op, so it can never wipe work you have done.
 *
 *   npm run db:seed            uses whatever .env says, else local PGlite
 *   DATABASE_URL=… npm run db:seed   overrides it for one run
 */

import "./env";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";
import { categories, questions, toStatus } from "../lib/schema";

type SeedFile = {
  categories: Array<{ id: string; code: string; title: string; order?: number }>;
  questions: Array<{
    id: string;
    categoryId: string;
    text: string;
    answer?: string;
    status?: string;
    starred?: boolean;
    order?: number;
  }>;
};

async function createTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS categories (
      id          text PRIMARY KEY,
      code        text NOT NULL,
      title       text NOT NULL,
      position    integer NOT NULL DEFAULT 0,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS questions (
      id           text PRIMARY KEY,
      category_id  text NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      text         text NOT NULL,
      answer       text NOT NULL DEFAULT '',
      status       text NOT NULL DEFAULT 'todo',
      starred      boolean NOT NULL DEFAULT false,
      position     integer NOT NULL DEFAULT 0,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now(),
      reviewed_at  timestamptz
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS questions_category_idx ON questions (category_id)
  `);
}

async function main() {
  // Say which database this is touching. Pointing at the wrong one is the
  // easiest mistake to make here, and the hardest to notice afterwards.
  const target = process.env.DATABASE_URL
    ? `Neon (${new URL(process.env.DATABASE_URL).host})`
    : "local PGlite (.pglite/)";
  console.log(`Target: ${target}`);

  await createTables();

  const existing = await db.select().from(questions);
  if (existing.length > 0) {
    console.log(`Database already has ${existing.length} questions — leaving it alone.`);
    return;
  }

  const file = JSON.parse(
    readFileSync(join(process.cwd(), "seed", "questions.json"), "utf8"),
  ) as SeedFile;

  await db.insert(categories).values(
    file.categories.map((c, index) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      position: c.order ?? index,
    })),
  );

  await db.insert(questions).values(
    file.questions.map((q, index) => ({
      id: q.id,
      categoryId: q.categoryId,
      text: q.text,
      answer: q.answer ?? "",
      status: toStatus(q.status),
      starred: q.starred === true,
      position: q.order ?? index,
    })),
  );

  console.log(
    `Seeded ${file.questions.length} questions across ${file.categories.length} categories.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
