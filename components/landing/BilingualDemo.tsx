"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import type { ReadingMode } from "@/lib/types";

// A live, self-contained preview of the reader on the landing page.
// Real sentences from the "Atomic Habits" lesson.
const LINES = [
  { en: ["For building a ", "habit", ", the second may be the more useful beginning."], uz: "Odat shakllantirish uchun ikkinchisi foydaliroq boshlanish bo‘lishi mumkin." },
  { en: ["A goal can guide you, but the routine does the work."], uz: "Maqsad yo‘l ko‘rsatishi mumkin, lekin ishni kundalik tartib bajaradi." },
  { en: ["Small actions also need time."], uz: "Kichik harakatlarga vaqt ham kerak." },
];

const MODES: { id: ReadingMode; label: string }[] = [
  { id: "bilingual", label: "Ikki tilda" },
  { id: "english", label: "Inglizcha" },
  { id: "uzbek", label: "O‘zbekcha" },
];

export function BilingualDemo() {
  const [mode, setMode] = useState<ReadingMode>("bilingual");
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [word, setWord] = useState(false);
  const [revealed, setRevealed] = useState<number | null>(null);

  useEffect(() => {
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((a) => (a + 1) % LINES.length), 2600);
    return () => clearInterval(t);
  }, [playing]);

  return (
    <div className="demo-device" aria-label="Bookly o‘quvchisining namunasi">
      <div className="demo-top">
        <span className="demo-dot" />
        <span className="demo-title">Atomic Habits</span>
        <span className="demo-meta">5 daq · B1</span>
      </div>
      <div className="segmented segmented-sm" role="radiogroup" aria-label="Matn rejimi (namuna)">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={mode === m.id ? "is-on" : ""} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="demo-text">
        {LINES.map((line, i) => (
          <div
            key={i}
            className={`sentence demo-sentence${i === active ? " is-active" : ""}${mode === "uzbek" ? " is-uz-only" : ""}`}
            onClick={() => {
              setActive(i);
              if (mode === "english") setRevealed(revealed === i ? null : i);
            }}
          >
            {mode !== "uzbek" && (
              <p className="sentence-en" lang="en">
                {line.en.map((part, j) =>
                  part === "habit" ? (
                    <button
                      key={j}
                      type="button"
                      className="vocab-word"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWord((w) => !w);
                      }}
                    >
                      {part}
                    </button>
                  ) : (
                    <span key={j}>{part}</span>
                  ),
                )}
              </p>
            )}
            {(mode !== "english" || revealed === i) && (
              <p className={`sentence-uz${mode === "english" ? " is-revealed" : ""}`}>{line.uz}</p>
            )}
            {i === 0 && word && mode !== "uzbek" && (
              <span className="demo-vocab" role="note">
                <strong>habit</strong> → odat
                <small>“Reading one page before bed is a small habit.”</small>
              </span>
            )}
          </div>
        ))}
        {mode === "english" && <p className="demo-hint">Jumlani bosing — tarjima ochiladi</p>}
      </div>
      <div className="demo-player">
        <span className="chip-btn">1×</span>
        <button type="button" className="play-btn sm" aria-label={playing ? "Pauza" : "Ijro"} onClick={() => setPlaying((p) => !p)}>
          <Icon name={playing ? "pause" : "play"} size={18} />
        </button>
        <div className="track">
          <div className="track-fill" style={{ width: `${((active + 1) / LINES.length) * 100}%` }} />
        </div>
        <span className="chip-btn">
          <Icon name="repeat" size={16} />
        </span>
      </div>
    </div>
  );
}
