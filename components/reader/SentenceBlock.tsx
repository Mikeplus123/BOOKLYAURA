"use client";
import { memo, useMemo } from "react";
import { tokenize, type FlatSentence } from "@/lib/text";
import type { ReadingMode, VocabItem } from "@/lib/types";

interface Props {
  sentence: FlatSentence;
  vocab: VocabItem[];
  mode: ReadingMode;
  /** Language of the translation line: Uzbek by default, Russian while listening to the Russian narration. */
  trLang?: "uz" | "ru";
  active: boolean;
  selected: boolean;
  revealed: boolean;
  onSelect: (index: number) => void;
  onVocab: (vocabIndex: number, el: HTMLElement) => void;
}

/** One sentence pair. Memoised so playback ticks only re-render the sentences that change. */
export const SentenceBlock = memo(function SentenceBlock({ sentence, vocab, mode, trLang = "uz", active, selected, revealed, onSelect, onVocab }: Props) {
  const tokens = useMemo(() => tokenize(sentence.en, vocab), [sentence.en, vocab]);
  const showEn = mode !== "uzbek";
  const showUz = mode === "bilingual" || mode === "uzbek" || revealed;
  const translation = (trLang === "ru" && sentence.ru) || sentence.uz;
  const translationLang = trLang === "ru" && sentence.ru ? "ru" : "uz";

  return (
    <div
      id={`sentence-${sentence.index}`}
      data-index={sentence.index}
      className={`sentence${active ? " is-active" : ""}${selected ? " is-selected" : ""}${mode === "uzbek" ? " is-uz-only" : ""}`}
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      aria-label={mode === "uzbek" ? translation : sentence.en}
      onClick={() => onSelect(sentence.index)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSelect(sentence.index);
        }
      }}
    >
      {showEn && (
        <p className="sentence-en" lang="en">
          {tokens.map((t, i) =>
            t.vocab === undefined ? (
              <span key={i}>{t.text}</span>
            ) : (
              <button
                key={i}
                type="button"
                className="vocab-word"
                aria-label={`${t.text}: lug‘at`}
                onClick={(e) => {
                  e.stopPropagation();
                  onVocab(t.vocab!, e.currentTarget);
                }}
              >
                {t.text}
              </button>
            ),
          )}
        </p>
      )}
      {showUz && (
        <p className={`sentence-uz${mode === "english" ? " is-revealed" : ""}`} lang={translationLang}>
          {translation}
        </p>
      )}
    </div>
  );
});
