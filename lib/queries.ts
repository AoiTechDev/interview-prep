import { asc } from "drizzle-orm";
import { db } from "./db";
import { categories, questions, type Category, type Question } from "./schema";

export type Snapshot = {
  categories: Category[];
  questions: Question[];
};

/** Everything the page needs, in two queries. The dataset is small by design. */
export async function loadSnapshot(): Promise<Snapshot> {
  const [cats, qs] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.position), asc(categories.createdAt)),
    db.select().from(questions).orderBy(asc(questions.position), asc(questions.createdAt)),
  ]);
  return { categories: cats, questions: qs };
}

export function makeId(prefix: "c" | "q"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Category codes are the JS-01 style prefixes, so they have to stay unique. */
export function uniqueCode(desired: string, taken: string[]): string {
  const base = desired.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "CAT";
  const used = new Set(taken.map((code) => code.toUpperCase()));
  if (!used.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 3)}${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}${Date.now().toString(36).slice(-2).toUpperCase()}`;
}
