"use server";

import { count, eq, max } from "drizzle-orm";
import { db } from "./db";
import { categories, questions, type Category, type Question, type QuestionPatch, toStatus } from "./schema";
import { makeId, uniqueCode, loadSnapshot, type Snapshot } from "./queries";
import { requireUser } from "./auth";

/**
 * Every action re-checks the session: a server action is its own endpoint, so it
 * cannot lean on the page having checked already.
 *
 * No revalidatePath here. The page is force-dynamic, so nothing is cached, and
 * the client already applies each result optimistically — revalidating would
 * push a full RSC payload down after every keystroke-debounced answer save.
 */

async function nextPosition(categoryId: string): Promise<number> {
  const [row] = await db
    .select({ value: max(questions.position) })
    .from(questions)
    .where(eq(questions.categoryId, categoryId));
  return (row?.value ?? -1) + 1;
}

export async function createQuestion(input: {
  categoryId: string;
  text: string;
}): Promise<Question> {
  await requireUser();

  const text = input.text.trim();
  if (!text) throw new Error("Question text is required");

  const [category] = await db.select().from(categories).where(eq(categories.id, input.categoryId));
  if (!category) throw new Error("Unknown category");

  const [created] = await db
    .insert(questions)
    .values({
      id: makeId("q"),
      categoryId: input.categoryId,
      text,
      position: await nextPosition(input.categoryId),
    })
    .returning();

  return created;
}

export async function updateQuestion(id: string, patch: QuestionPatch): Promise<Question> {
  await requireUser();

  const values: Partial<typeof questions.$inferInsert> = { updatedAt: new Date() };

  if (typeof patch.text === "string") {
    const text = patch.text.trim();
    if (!text) throw new Error("Question text cannot be empty");
    values.text = text;
  }
  if (typeof patch.answer === "string") values.answer = patch.answer;
  if (typeof patch.starred === "boolean") values.starred = patch.starred;
  if (patch.status === "todo" || patch.status === "reviewed") {
    values.status = patch.status;
    values.reviewedAt = patch.status === "reviewed" ? new Date() : null;
  }
  if (typeof patch.categoryId === "string") {
    const [category] = await db.select().from(categories).where(eq(categories.id, patch.categoryId));
    if (!category) throw new Error("Unknown category");
    values.categoryId = patch.categoryId;
    values.position = await nextPosition(patch.categoryId);
  }

  const [updated] = await db.update(questions).set(values).where(eq(questions.id, id)).returning();
  if (!updated) throw new Error("Question not found");

  return updated;
}

export async function deleteQuestion(id: string): Promise<void> {
  await requireUser();
  await db.delete(questions).where(eq(questions.id, id));
}

export async function createCategory(input: {
  title: string;
  code?: string;
}): Promise<Category> {
  await requireUser();

  const title = input.title.trim();
  if (!title) throw new Error("A title is required");

  const existing = await db.select().from(categories);
  const [created] = await db
    .insert(categories)
    .values({
      id: makeId("c"),
      code: uniqueCode(
        input.code?.trim() || title.replace(/[^A-Za-z0-9]/g, "").slice(0, 2),
        existing.map((c) => c.code),
      ),
      title,
      position: existing.length,
    })
    .returning();

  return created;
}

export async function updateCategory(
  id: string,
  patch: { title?: string; code?: string },
): Promise<Category> {
  await requireUser();

  const values: Partial<typeof categories.$inferInsert> = {};
  if (patch.title?.trim()) values.title = patch.title.trim();
  if (patch.code?.trim()) {
    const others = await db.select().from(categories);
    values.code = uniqueCode(
      patch.code,
      others.filter((c) => c.id !== id).map((c) => c.code),
    );
  }

  const [updated] = await db.update(categories).set(values).where(eq(categories.id, id)).returning();
  if (!updated) throw new Error("Category not found");

  return updated;
}

/** Questions cascade via the foreign key. */
export async function deleteCategory(id: string): Promise<void> {
  await requireUser();
  await db.delete(categories).where(eq(categories.id, id));
}

export async function resetProgress(wipeAnswers: boolean): Promise<void> {
  await requireUser();
  await db.update(questions).set({
    status: "todo",
    reviewedAt: null,
    updatedAt: new Date(),
    ...(wipeAnswers ? { answer: "" } : {}),
  });
}

type ImportShape = {
  categories?: Array<Record<string, unknown>>;
  questions?: Array<Record<string, unknown>>;
};

/**
 * Replaces everything with an export from any earlier version of this app.
 * The old JSON used `order`; the columns are now `position`, so accept both.
 */
export async function importSnapshot(raw: unknown): Promise<Snapshot> {
  await requireUser();

  const payload = raw as ImportShape;
  const incomingCategories = Array.isArray(payload?.categories) ? payload.categories : [];
  const incomingQuestions = Array.isArray(payload?.questions) ? payload.questions : [];

  if (incomingCategories.length === 0) throw new Error("That file has no categories in it");

  const seenCodes: string[] = [];
  const cats = incomingCategories.map((c, index) => {
    const code = uniqueCode(String(c.code ?? "CAT"), seenCodes);
    seenCodes.push(code);
    return {
      id: typeof c.id === "string" && c.id ? c.id : makeId("c"),
      code,
      title: String(c.title ?? "Untitled"),
      position: Number.isFinite(c.position) ? Number(c.position) : Number(c.order ?? index),
    };
  });

  const knownIds = new Set(cats.map((c) => c.id));
  const qs = incomingQuestions
    .filter((q) => knownIds.has(String(q.categoryId)) && String(q.text ?? "").trim() !== "")
    .map((q, index) => ({
      id: typeof q.id === "string" && q.id ? q.id : makeId("q"),
      categoryId: String(q.categoryId),
      text: String(q.text).trim(),
      answer: typeof q.answer === "string" ? q.answer : "",
      status: toStatus(q.status),
      starred: q.starred === true,
      position: Number.isFinite(q.position) ? Number(q.position) : Number(q.order ?? index),
      reviewedAt: q.reviewedAt ? new Date(String(q.reviewedAt)) : null,
    }));

  // Wipe then refill. Small dataset, and it keeps import genuinely idempotent.
  await db.delete(questions);
  await db.delete(categories);
  await db.insert(categories).values(cats);
  if (qs.length) await db.insert(questions).values(qs);

  return loadSnapshot();
}

export async function questionCount(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(questions);
  return row?.value ?? 0;
}
