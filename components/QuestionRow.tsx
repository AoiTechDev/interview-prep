"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Category, Question, QuestionPatch } from "@/lib/schema";
import { highlightAnswer, fenceIsOpen, isFenceLine } from "@/lib/highlight";
import { Check, Pencil, Star, Trash } from "./icons";

type SaveState = "idle" | "saving" | "saved" | "failed";

/**
 * Grows a textarea to fit its content. Runs in a layout effect so the height is
 * correct in the same frame the editor opens — no flash of a short box, and no
 * scrollbar while typing.
 */
function useAutosize(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  active: boolean,
) {
  const fit = useCallback(() => {
    const el = ref.current;
    // A zero-width box reports a scrollHeight of one character per line, which
    // would lock in an absurd height. Skip until it has real layout.
    if (!el || el.clientWidth === 0) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref]);

  useLayoutEffect(() => {
    if (active) fit();
  }, [active, value, fit]);

  // Wrapping changes with width, so refit whenever the box gets wider or
  // narrower — a window resize would otherwise clip the text. Height changes
  // are ignored, so adjusting the height here cannot feed back into a loop.
  useEffect(() => {
    const el = ref.current;
    if (!active || !el || typeof ResizeObserver === "undefined") return;
    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return;
      lastWidth = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, active, fit]);

  return fit;
}

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

  const questionRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  // Where to put the caret after a programmatic edit commits.
  const pendingCaret = useRef<number | null>(null);
  const timers = useRef<{
    text?: ReturnType<typeof setTimeout>;
    answer?: ReturnType<typeof setTimeout>;
  }>({});

  useAutosize(questionRef, draftText, open);
  useAutosize(answerRef, draftAnswer, open);

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

  // React re-renders a controlled textarea with the caret at the end, so a
  // caret set before the commit is discarded. Restore it afterwards instead.
  useLayoutEffect(() => {
    const el = answerRef.current;
    if (!el || pendingCaret.current === null) return;
    el.selectionStart = el.selectionEnd = pendingCaret.current;
    pendingCaret.current = null;
  }, [draftAnswer]);

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

  /** Replace the selection, then land the caret at start + caretOffset. */
  function splice(el: HTMLTextAreaElement, inserted: string, caretOffset: number) {
    const start = el.selectionStart;
    const next = `${el.value.slice(0, start)}${inserted}${el.value.slice(el.selectionEnd)}`;
    pendingCaret.current = start + caretOffset;
    setDraftAnswer(next);
    queue("answer", next);
  }

  function onAnswerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;

    // Tab indents instead of leaving the field — answers here are half code.
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      splice(el, "  ", 2);
      return;
    }

    // Enter on a line that just opened a fence closes it for you and drops the
    // caret inside, so ``` alone is enough to get a usable code block.
    if (event.key === "Enter" && !event.shiftKey && el.selectionStart === el.selectionEnd) {
      const before = el.value.slice(0, el.selectionStart);
      const currentLine = before.slice(before.lastIndexOf("\n") + 1);
      if (isFenceLine(currentLine) && fenceIsOpen(before)) {
        event.preventDefault();
        splice(el, "\n\n```", 1);
      }
    }
  }

  const reviewed = question.status === "reviewed";
  const answered = question.answer.trim().length > 0;
  const lineCount = draftAnswer ? draftAnswer.split("\n").length : 0;

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
          <div className="editor">
            <div className="editorBar">
              <span className="editorName">question</span>
            </div>
            <textarea
              ref={questionRef}
              className="editorArea prose"
              rows={1}
              value={draftText}
              onChange={(e) => {
                setDraftText(e.target.value);
                queue("text", e.target.value);
              }}
              onBlur={(e) => flush("text", e.target.value)}
            />
          </div>

          <div className="editor answerEditor">
            <div className="editorBar">
              <span className="editorName">your answer</span>
              <span className="editorMeta">
                {lineCount} {lineCount === 1 ? "line" : "lines"} · {draftAnswer.length}
              </span>
              <span className={`savehint ${saveState}`}>
                {saveState === "saving" && "saving…"}
                {saveState === "saved" && "saved"}
                {saveState === "failed" && "not saved"}
              </span>
            </div>
            <div className="editorStack">
              {/* Painted behind the transparent textarea; both wrap identically. */}
              <pre
                className="hlLayer"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: `${highlightAnswer(draftAnswer)}\n` }}
              />
              <textarea
                ref={answerRef}
                className="editorArea transparentText"
                rows={1}
                spellCheck={false}
                placeholder="Write the answer in your own words — the version you would actually say out loud.&#10;&#10;Type ``` then Enter for a code block. Tab indents."
                value={draftAnswer}
                onChange={(e) => {
                  setDraftAnswer(e.target.value);
                  queue("answer", e.target.value);
                }}
                onKeyDown={onAnswerKeyDown}
                onBlur={(e) => flush("answer", e.target.value)}
              />
            </div>
          </div>

          <div className="qbodyfoot">
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
