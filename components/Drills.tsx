"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Category, Question, QuestionPatch } from "@/lib/schema";
import type { LocalUser } from "@/lib/auth";
import {
  createCategory,
  createQuestion,
  deleteCategory as deleteCategoryAction,
  deleteQuestion as deleteQuestionAction,
  importSnapshot,
  resetProgress,
  updateCategory,
  updateQuestion,
} from "@/lib/actions";
import { QuestionRow } from "./QuestionRow";
import { DrillOverlay } from "./DrillOverlay";
import { Chevron, Play, Search, Trash } from "./icons";

type Filter = "all" | "todo" | "done" | "starred" | "unanswered";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "todo", label: "To review" },
  { id: "done", label: "Reviewed" },
  { id: "starred", label: "Starred" },
  { id: "unanswered", label: "No answer" },
];

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

export function Drills({
  initialCategories,
  initialQuestions,
  user,
}: {
  initialCategories: Category[];
  initialQuestions: Question[];
  user: LocalUser;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [questions, setQuestions] = useState(initialQuestions);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [deck, setDeck] = useState<Question[] | null>(null);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const say = useCallback((text: string, error = false) => {
    setToast({ text, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 5000 : 1900);
  }, []);

  /* ------------------------------------------------------------ collapsed */

  useEffect(() => {
    try {
      const raw = localStorage.getItem("drills.collapsed");
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* first run, or storage blocked */
    }
  }, []);

  const persistCollapsed = useCallback((next: Set<string>) => {
    setCollapsed(next);
    try {
      localStorage.setItem("drills.collapsed", JSON.stringify([...next]));
    } catch {
      /* not important enough to surface */
    }
  }, []);

  /* ------------------------------------------------------------ mutations */

  const patchQuestion = useCallback(
    async (id: string, patch: QuestionPatch) => {
      const before = questions.find((q) => q.id === id);
      setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
      try {
        const updated = await updateQuestion(id, patch);
        setQuestions((qs) => qs.map((q) => (q.id === id ? updated : q)));
      } catch (error) {
        if (before) setQuestions((qs) => qs.map((q) => (q.id === id ? before : q)));
        say(error instanceof Error ? error.message : "Could not save", true);
        throw error;
      }
    },
    [questions, say],
  );

  async function addQuestion(categoryId: string, text: string) {
    try {
      const created = await createQuestion({ categoryId, text });
      setQuestions((qs) => [...qs, created]);
      say("Question added");
    } catch (error) {
      say(error instanceof Error ? error.message : "Could not add", true);
    }
  }

  async function removeQuestion(question: Question) {
    if (!confirm(`Delete this question?\n\n${question.text}`)) return;
    const snapshot = questions;
    setQuestions((qs) => qs.filter((q) => q.id !== question.id));
    try {
      await deleteQuestionAction(question.id);
      say("Question deleted");
    } catch (error) {
      setQuestions(snapshot);
      say(error instanceof Error ? error.message : "Could not delete", true);
    }
  }

  async function addCategory(title: string, code: string) {
    try {
      const created = await createCategory({ title, code });
      setCategories((cs) => [...cs, created]);
      say("Category added");
    } catch (error) {
      say(error instanceof Error ? error.message : "Could not add", true);
    }
  }

  async function renameCategory(category: Category) {
    const title = prompt("Category name:", category.title);
    if (title === null || !title.trim()) return;
    const code = prompt("Short code (up to 4 characters):", category.code);
    try {
      const updated = await updateCategory(category.id, {
        title,
        code: code?.trim() || category.code,
      });
      setCategories((cs) => cs.map((c) => (c.id === category.id ? updated : c)));
    } catch (error) {
      say(error instanceof Error ? error.message : "Could not rename", true);
    }
  }

  async function removeCategory(category: Category) {
    const owned = questions.filter((q) => q.categoryId === category.id).length;
    if (!confirm(`Delete "${category.title}" and its ${owned} question(s)?`)) return;
    const snapshot = { categories, questions };
    setCategories((cs) => cs.filter((c) => c.id !== category.id));
    setQuestions((qs) => qs.filter((q) => q.categoryId !== category.id));
    try {
      await deleteCategoryAction(category.id);
      say("Category deleted");
    } catch (error) {
      setCategories(snapshot.categories);
      setQuestions(snapshot.questions);
      say(error instanceof Error ? error.message : "Could not delete", true);
    }
  }

  async function doReset() {
    if (!confirm("Clear every reviewed mark?\n\nYour written answers are kept.")) return;
    setBusy(true);
    try {
      await resetProgress(false);
      setQuestions((qs) => qs.map((q) => ({ ...q, status: "todo", reviewedAt: null })));
      say("Progress reset");
    } catch (error) {
      say(error instanceof Error ? error.message : "Could not reset", true);
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      categories,
      questions,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `drills-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importJson(file: File) {
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const incoming = (parsed.db ?? parsed) as { questions?: unknown[] };
      const count = Array.isArray(incoming.questions) ? incoming.questions.length : 0;
      if (!confirm(`Replace everything with ${file.name}?\n\n${count} questions.`)) return;
      const snapshot = await importSnapshot(incoming);
      setCategories(snapshot.categories);
      setQuestions(snapshot.questions);
      setOpenIds(new Set());
      say(`Imported ${snapshot.questions.length} questions`);
    } catch (error) {
      say(error instanceof Error ? error.message : "Could not read that file", true);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /* -------------------------------------------------------------- derived */

  const sortedCategories = useMemo(() => [...categories].sort(byPosition), [categories]);

  const grouped = useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const category of sortedCategories) map.set(category.id, []);
    for (const question of [...questions].sort(byPosition)) {
      map.get(question.categoryId)?.push(question);
    }
    return map;
  }, [sortedCategories, questions]);

  const displayIds = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of sortedCategories) {
      (grouped.get(category.id) ?? []).forEach((question, index) => {
        map.set(question.id, `${category.code}-${String(index + 1).padStart(2, "0")}`);
      });
    }
    return map;
  }, [sortedCategories, grouped]);

  const matches = useCallback(
    (question: Question) => {
      if (filter === "todo" && question.status === "reviewed") return false;
      if (filter === "done" && question.status !== "reviewed") return false;
      if (filter === "starred" && !question.starred) return false;
      if (filter === "unanswered" && question.answer.trim()) return false;
      if (search) {
        const needle = search.toLowerCase();
        if (
          !question.text.toLowerCase().includes(needle) &&
          !question.answer.toLowerCase().includes(needle)
        ) {
          return false;
        }
      }
      return true;
    },
    [filter, search],
  );

  const visible = useMemo(() => questions.filter(matches), [questions, matches]);
  const filtering = filter !== "all" || search !== "";

  const reviewedCount = questions.filter((q) => q.status === "reviewed").length;
  const answeredCount = questions.filter((q) => q.answer.trim()).length;
  const percent = questions.length ? (reviewedCount / questions.length) * 100 : 0;

  /* ------------------------------------------------------------- shortcuts */

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (deck) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
        if (event.key === "Escape") target.blur();
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "d") {
        event.preventDefault();
        startDrill();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function startDrill() {
    const pool = visible.length ? visible : questions;
    if (!pool.length) {
      say("No questions to drill yet", true);
      return;
    }
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDeck(shuffled);
  }

  /* ----------------------------------------------------------------- view */

  return (
    <div className="wrap">
      <header className="top">
        <div className="headRow">
          <div className="grow">
            <p className="eyebrow">Interview Prep · Frontend</p>
            <h1>Frontend Interview Drills</h1>
          </div>
          <div className="whoami">
            <span>{user.name}</span>
            <a className="btn small" href="/api/auth/signout">
              Sign out
            </a>
          </div>
        </div>

        <p className="sub">
          Theory questions across your stack. Write your own answer to each one, mark it reviewed
          when you can say it out loud, and add questions as you meet them.
        </p>

        <div className="statbar">
          <div className="figure">
            <span className="num">
              {reviewedCount} / {questions.length}
            </span>
            <span className="lbl">Reviewed</span>
          </div>
          <div className="figure">
            <span className="num">{answeredCount}</span>
            <span className="lbl">Answered</span>
          </div>
          <div className="track">
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="controls">
            {FILTERS.map((entry) => (
              <button
                key={entry.id}
                className="chip"
                type="button"
                aria-pressed={filter === entry.id}
                onClick={() => setFilter(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="searchrow">
        <div className="searchbox">
          <Search />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search questions and answers…"
            value={search}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn primary" type="button" onClick={startDrill}>
          <Play />
          Drill me
        </button>
      </div>

      <div className="toolrow">
        <button className="ghost" type="button" onClick={() => persistCollapsed(new Set())}>
          Expand all
        </button>
        <button
          className="ghost"
          type="button"
          onClick={() => persistCollapsed(new Set(categories.map((c) => c.id)))}
        >
          Collapse all
        </button>
        <button className="ghost" type="button" onClick={() => setAddCategoryOpen(true)}>
          + Category
        </button>
        <span className="spacer" />
        <button className="ghost" type="button" onClick={exportJson}>
          Export
        </button>
        <button className="ghost" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
          Import
        </button>
        <ThemeButton />
        <button className="ghost danger" type="button" onClick={doReset} disabled={busy}>
          Reset progress
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importJson(file);
          }}
        />
      </div>

      <nav className="jump">
        {sortedCategories.map((category) => (
          <a
            key={category.id}
            href={`#cat-${category.id}`}
            onClick={() => {
              const next = new Set(collapsed);
              next.delete(category.id);
              persistCollapsed(next);
            }}
          >
            {category.code} <span className="n">{(grouped.get(category.id) ?? []).length}</span>
          </a>
        ))}
      </nav>

      <main>
        {sortedCategories.map((category) => {
          const own = grouped.get(category.id) ?? [];
          const shown = own.filter(matches);
          if (filtering && shown.length === 0 && own.length > 0) return null;
          const reviewedHere = own.filter((q) => q.status === "reviewed").length;

          return (
            <details
              key={category.id}
              id={`cat-${category.id}`}
              className="cat"
              open={filtering ? true : !collapsed.has(category.id)}
              onToggle={(event) => {
                if (filtering) return;
                const next = new Set(collapsed);
                if (event.currentTarget.open) next.delete(category.id);
                else next.add(category.id);
                persistCollapsed(next);
              }}
            >
              <summary>
                <span className="catTag">{category.code}</span>
                <span
                  className="catTitle"
                  title="Double-click to rename"
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    void renameCategory(category);
                  }}
                >
                  {category.title}
                </span>
                <span className="catCount">
                  {reviewedHere}/{own.length}
                </span>
                <button
                  className="iconbtn danger"
                  type="button"
                  title="Delete category and its questions"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void removeCategory(category);
                  }}
                >
                  <Trash />
                </button>
                <Chevron />
              </summary>

              <div className="catBody">
                {shown.map((question) => (
                  <QuestionRow
                    key={question.id}
                    question={question}
                    categories={sortedCategories}
                    displayId={displayIds.get(question.id) ?? ""}
                    open={openIds.has(question.id)}
                    onToggleOpen={() =>
                      setOpenIds((ids) => {
                        const next = new Set(ids);
                        if (next.has(question.id)) next.delete(question.id);
                        else next.add(question.id);
                        return next;
                      })
                    }
                    onPatch={(patch) => patchQuestion(question.id, patch)}
                    onDelete={() => void removeQuestion(question)}
                  />
                ))}

                {!filtering && (
                  <AddQuestion
                    category={category}
                    onAdd={(text) => void addQuestion(category.id, text)}
                  />
                )}
              </div>
            </details>
          );
        })}

        {addCategoryOpen && (
          <AddCategory
            onAdd={(title, code) => {
              void addCategory(title, code);
              setAddCategoryOpen(false);
            }}
            onCancel={() => setAddCategoryOpen(false)}
          />
        )}

        {visible.length === 0 && questions.length > 0 && (
          <p className="empty">Nothing matches this filter.</p>
        )}
      </main>

      <footer className="note">
        Questions are prompts to research and rehearse, not a scored quiz. Everything is stored in
        Postgres, so your answers follow you to any device you sign in from.
      </footer>

      {deck && (
        <DrillOverlay
          deck={deck}
          categories={sortedCategories}
          onMarkReviewed={(id) => void patchQuestion(id, { status: "reviewed" })}
          onClose={(finished) => {
            setDeck(null);
            if (finished) say("Deck finished — nice.");
          }}
        />
      )}

      {toast && <div className={`toast${toast.error ? " error" : ""}`}>{toast.text}</div>}
    </div>
  );
}

function AddQuestion({
  category,
  onAdd,
}: {
  category: Category;
  onAdd: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <div className="addrow">
        <button className="addbtn" type="button" onClick={() => setOpen(true)}>
          + Add a question to {category.title}
        </button>
      </div>
    );
  }

  return (
    <div className="addrow">
      <form
        className="addform"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          onAdd(text.trim());
          setText("");
          ref.current?.focus();
        }}
      >
        <textarea
          ref={ref}
          className="textline"
          rows={2}
          placeholder="New question…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
            if (event.key === "Escape") {
              setText("");
              setOpen(false);
            }
          }}
        />
        <button className="btn primary" type="submit">
          Add
        </button>
      </form>
    </div>
  );
}

function AddCategory({
  onAdd,
  onCancel,
}: {
  onAdd: (title: string, code: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => ref.current?.focus(), []);

  return (
    <div className="addrow">
      <form
        className="addform"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onAdd(title.trim(), code.trim());
        }}
      >
        <input
          ref={ref}
          className="textline"
          placeholder="New category name, e.g. System Design"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
        />
        <input
          className="textline"
          placeholder="Code"
          maxLength={4}
          style={{ maxWidth: 90 }}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn primary" type="submit">
          Add
        </button>
      </form>
    </div>
  );
}

function ThemeButton() {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("drills.theme");
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {
      /* storage blocked */
    }
  }, []);

  function cycle() {
    const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next === "system" ? "" : next);
    try {
      localStorage.setItem("drills.theme", next);
    } catch {
      /* storage blocked */
    }
  }

  return (
    <button className="ghost" type="button" onClick={cycle}>
      Theme
    </button>
  );
}
