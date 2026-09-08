import { pgTable, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable(
  "questions",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    answer: text("answer").notNull().default(""),
    // Stored as text so adding a third state later needs no migration.
    status: text("status").$type<QuestionStatus>().notNull().default("todo"),
    starred: boolean("starred").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [index("questions_category_idx").on(table.categoryId)],
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  category: one(categories, {
    fields: [questions.categoryId],
    references: [categories.id],
  }),
}));

export type QuestionStatus = "todo" | "reviewed";

/** Anything that is not exactly "reviewed" counts as still to do. */
export function toStatus(value: unknown): QuestionStatus {
  return value === "reviewed" ? "reviewed" : "todo";
}

/** The fields a client is allowed to change on a question. */
export type QuestionPatch = {
  text?: string;
  answer?: string;
  status?: QuestionStatus;
  starred?: boolean;
  categoryId?: string;
};

export type Category = typeof categories.$inferSelect;
export type Question = typeof questions.$inferSelect;
