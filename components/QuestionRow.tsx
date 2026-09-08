"use client";

import { useEffect, useRef, useState } from "react";
import type { Category, Question, QuestionPatch } from "@/lib/schema";
import { Check, Pencil, Star, Trash } from "./icons";

type SaveState = "idle" | "saving" | "saved" | "failed";

export function QuestionRow({
  question,
  categories,
  displayId,
  open,
  onToggleOpen,
  onPatch,
  onDelete,
}: {
  question: Question;
  categories: Category[];
  displayId: string;
  open: boolean;
  onToggleOpen: () => void;
  onPatch: (patch: QuestionPatch) => Promise<void>;
  onDelete: () => void;
}) {
  const [draftText, setDraftText] = useState(question.text);
  const [draftAnswer, setDraftAnswer] = useState(question.answer);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const timers = useRef<{
    text?: ReturnType<typeof setTimeout>;
    answer?: ReturnType<typeof setTimeout>;
  }>({});

  // Re-sync when the row changes underneath us (import, drill, reset).
  useEffect(() => setDraftText(question.text), [question.text]);
  useEffect(() => setDraftAnswer(question.answer), [question.answer]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      if (pending.text) clearTimeout(pending.text);
      if (pending.answer) clearTimeout(pending.answer);
    };
  }, []);

  useEffect(() => {
    if (open) answerRef.current?.focus();
  }, [open]);

  async function save(patch: QuestionPatch) {
    setSaveState("saving");
    try {
      await onPatch(patch);
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
    } catch {
      setSaveState("failed");
    }
  }

  function queue(field: "text" | "answer", value: string) {
    if (timers.current[field]) clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(() => {
      if (field === "text") {
        const trimmed = value.trim();
        if (!trimmed || trimmed === question.text) return;
        void save({ text: trimmed });
      } else if (value !== question.answer) {
        void save({ answer: value });
      }
    }, 600);
  }

  function flush(field: "text" | "answer", value: string) {
    if (timers.current[field]) clearTimeout(timers.current[field]);
    if (field === "text") {
      const trimmed = value.trim();
      if (!trimmed) {
        setDraftText(question.text);
        return;
      }
      if (trimmed !== question.text) void save({ text: trimmed });
    } else if (value !== question.answer) {
      void save({ answer: value });
    }
  }

  const reviewed = question.status === "reviewed";
  const answered = question.answer.trim().length > 0;

  return (
    <div className={`qrow${reviewed ? " done" : ""}${open ? " open" : ""}`}>
      <div className="qhead">
        <button
          className="qcheck"
          type="button"
          aria-label={`Mark ${displayId} as reviewed`}
          aria-pressed={reviewed}
          onClick={() => void onPatch({ status: reviewed ? "todo" : "reviewed" })}
        >
          <Check />
        </button>

        <span className="qid mono">{displayId}</span>

        <button className="qmain" type="button" onClick={onToggleOpen} aria-expanded={open}>
          <div className="qtext">{question.text}</div>
          <div className="qflags">
            <span className={answered ? "flag" : "flag muted"}>
              {answered ? "answered" : "no answer yet"}
            </span>
          </div>
        </button>

        <div className="qtools">
          <button
            className={`iconbtn${question.starred ? " starred" : ""}`}
            type="button"
            title={question.starred ? "Unstar" : "Star this question"}
            onClick={() => void onPatch({ starred: !question.starred })}
          >
            <Star filled={question.starred} />
          </button>
          <button
            className="iconbtn"
            type="button"
            title="Edit question and answer"
            onClick={onToggleOpen}
          >
            <Pencil />
          </button>
        </div>
      </div>

      {open && (
        <div className="qbody">
          <p className="qlabel">Question</p>
          <textarea
            className="textline"
            rows={2}
            value={draftText}
            onChange={(e) => {
              setDraftText(e.target.value);
              queue("text", e.target.value);
            }}
            onBlur={(e) => flush("text", e.target.value)}
          />

          <p className="qlabel" style={{ marginTop: 12 }}>
            Your answer
          </p>
          <textarea
            ref={answerRef}
            className="answer"
            placeholder="Write the answer in your own words — the version you would actually say out loud."
            value={draftAnswer}
            onChange={(e) => {
              setDraftAnswer(e.target.value);
              queue("answer", e.target.value);
            }}
            onBlur={(e) => flush("answer", e.target.value)}
          />

          <div className="qbodyfoot">
            <span className={`savehint ${saveState}`}>
              {saveState === "saving" && "saving…"}
              {saveState === "saved" && "saved"}
              {saveState === "failed" && "not saved"}
            </span>
            <span className="spacer" />
            <span>Category:</span>
            <select
              className="btn small"
              value={question.categoryId}
              onChange={(e) => void onPatch({ categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </option>
              ))}
            </select>
            <button
              className="iconbtn danger"
              type="button"
              title="Delete this question"
              onClick={onDelete}
            >
              <Trash />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
