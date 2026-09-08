"use client";

import { useEffect, useState } from "react";
import type { Category, Question } from "@/lib/schema";
import { Close } from "./icons";

export function DrillOverlay({
  deck,
  categories,
  onMarkReviewed,
  onClose,
}: {
  deck: Question[];
  categories: Category[];
  onMarkReviewed: (id: string) => void;
  onClose: (finished: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const current = deck[index];

  function advance(markReviewed: boolean) {
    if (markReviewed && current && current.status !== "reviewed") onMarkReviewed(current.id);
    if (index + 1 >= deck.length) {
      onClose(true);
      return;
    }
    setIndex(index + 1);
    setRevealed(false);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose(false);
      } else if (event.key === " " || event.code === "Space" || event.key === "Enter") {
        event.preventDefault();
        if (revealed) advance(true);
        else setRevealed(true);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        advance(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) return null;

  const category = categories.find((c) => c.id === current.categoryId);
  const hasAnswer = current.answer.trim().length > 0;

  return (
    <div
      className="overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose(false);
      }}
    >
      <div className="drill" role="dialog" aria-modal="true" aria-label="Drill">
        <div className="drillHead">
          <span className="catTag">{category?.code ?? "??"}</span>
          <span className="drillMeta">
            {index + 1} of {deck.length}
            {current.status === "reviewed" ? " · reviewed" : ""}
          </span>
          <button className="iconbtn" type="button" aria-label="Close drill" onClick={() => onClose(false)}>
            <Close />
          </button>
        </div>

        <p className="drillQ">{current.text}</p>

        {revealed && (
          <div className="drillAnswer">
            <p className="drillLabel">Your answer</p>
            <div className={hasAnswer ? "answerText" : "answerText blank"}>
              {hasAnswer ? current.answer : "You have not written an answer for this one yet."}
            </div>
          </div>
        )}

        <div className="drillActions">
          {!revealed && (
            <button className="btn" type="button" onClick={() => setRevealed(true)}>
              Reveal answer
            </button>
          )}
          <span className="spacer" />
          <button className="btn" type="button" onClick={() => advance(false)}>
            Skip
          </button>
          <button className="btn good" type="button" onClick={() => advance(true)}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
