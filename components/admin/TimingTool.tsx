"use client";
// Tap-to-sync: play the narration and press "Belgilash" (or Space) at the start of each sentence.
// Afterwards, fine-tune any start time with ±0.1s buttons and test each sentence.
// "Avtomatik sinxronlash" does the whole job from the audio's pauses in a second; review it after.
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { autoSync } from "@/lib/autosync";
import { flattenSentences, formatTime, sentenceEnd } from "@/lib/text";
import type { Section } from "@/lib/types";

interface Props {
  audioUrl: string;
  sections: Section[];
  onChange: (sections: Section[]) => void;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function TimingTool({ audioUrl, sections, onChange }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const flat = useMemo(() => flattenSentences(sections), [sections]);
  const [marking, setMarking] = useState(false);
  const [cursor, setCursor] = useState(() => Math.max(0, flat.findIndex((s) => typeof s.start !== "number")));
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const stopAt = useRef<number | null>(null);

  const setStart = (index: number, value: number | undefined) => {
    let k = 0;
    const next = sections.map((sec) => ({
      ...sec,
      sentences: sec.sentences.map((s) => {
        const i = k++;
        if (i !== index) return s;
        const { end: _end, ...rest } = s;
        return value === undefined ? { ...rest, start: undefined } : { ...rest, start: round(Math.max(0, value)) };
      }),
    }));
    onChange(next);
  };

  const shiftAll = (delta: number) => {
    onChange(
      sections.map((sec) => ({
        ...sec,
        sentences: sec.sentences.map((s) =>
          typeof s.start === "number"
            ? { ...s, start: round(Math.max(0, s.start + delta)), ...(typeof s.end === "number" ? { end: round(Math.max(0, s.end + delta)) } : {}) }
            : s,
        ),
      })),
    );
  };

  const clearAll = () => {
    if (!confirm("Barcha vaqtlar o‘chirilsinmi?")) return;
    onChange(sections.map((sec) => ({ ...sec, sentences: sec.sentences.map(({ start: _s, end: _e, ...rest }) => rest) })));
    setCursor(0);
  };

  const [auto, setAuto] = useState<{ state: "idle" | "working" | "done" | "error"; message?: string }>({ state: "idle" });

  const runAutoSync = async () => {
    if (flat.some((s) => typeof s.start === "number") && !confirm("Mavjud vaqtlar avtomatik hisoblangan vaqtlar bilan almashtiriladi. Davom etilsinmi?")) return;
    setAuto({ state: "working" });
    try {
      const t0 = performance.now();
      const res = await fetch(audioUrl);
      if (!res.ok) throw new Error(`Audio yuklanmadi (${res.status})`);
      const buf = await res.arrayBuffer();
      const ctx = new AudioContext();
      const audio = await ctx.decodeAudioData(buf);
      void ctx.close();
      const mono = new Float32Array(audio.length);
      for (let c = 0; c < audio.numberOfChannels; c++) {
        const ch = audio.getChannelData(c);
        for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / audio.numberOfChannels;
      }
      const timings = autoSync(mono, audio.sampleRate, flat.map((s) => s.en));
      let k = 0;
      onChange(
        sections.map((sec) => ({
          ...sec,
          sentences: sec.sentences.map((s) => {
            const t = timings[k++];
            return { ...s, start: t.start, end: Math.min(t.end, round(audio.duration)) };
          }),
        })),
      );
      setCursor(flat.length);
      setAuto({
        state: "done",
        message: `${flat.length} ta jumla ${((performance.now() - t0) / 1000).toFixed(1)} soniyada vaqtga bog‘landi. Endi ▶ tugmalari bilan bir nechta jumlani tekshirib ko‘ring.`,
      });
    } catch (e) {
      setAuto({ state: "error", message: e instanceof Error ? e.message : "Audio tahlil qilinmadi." });
    }
  };

  const mark = () => {
    const a = audioRef.current;
    if (!a || cursor >= flat.length) return;
    setStart(cursor, a.currentTime);
    setCursor((c) => c + 1);
  };

  const testSentence = (i: number) => {
    const a = audioRef.current;
    const s = flat[i];
    if (!a || typeof s?.start !== "number") return;
    a.currentTime = s.start;
    stopAt.current = sentenceEnd(flat, i, a.duration);
    void a.play();
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    let raf = 0;
    const loop = () => {
      setTime(a.currentTime);
      if (stopAt.current !== null && a.currentTime >= stopAt.current) {
        a.pause();
        stopAt.current = null;
      }
      if (!a.paused) raf = requestAnimationFrame(loop);
    };
    const onPlay = () => (raf = requestAnimationFrame(loop));
    const onMeta = () => setDuration(a.duration);
    a.addEventListener("play", onPlay);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      cancelAnimationFrame(raf);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!marking) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        mark();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const timedCount = flat.filter((s) => typeof s.start === "number").length;
  const current = flat[cursor];

  return (
    <div className="timing">
      <audio ref={audioRef} src={audioUrl} controls preload="metadata" className="timing-audio" />
      <p className="muted small">
        {timedCount}/{flat.length} jumla vaqtga bog‘langan · audio {formatTime(duration)} · hozir {time.toFixed(2)}s
      </p>

      <div className="timing-auto">
        <div>
          <strong>
            <Icon name="sparkle" /> Avtomatik sinxronlash
          </strong>
          <p className="muted small">
            Audiodagi pauzalarni topib, har bir jumlaning boshlanish va tugash vaqtini o‘zi hisoblaydi (internet yoki AI kerak emas). Matn audio bilan aynan bir xil bo‘lishi kerak.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={runAutoSync} disabled={auto.state === "working"}>
          {auto.state === "working" ? "Tahlil qilinmoqda…" : "Avtomatik sinxronlash"}
        </button>
        {auto.message && <p className={`alert ${auto.state === "done" ? "alert-ok" : ""}`}>{auto.message}</p>}
      </div>

      <p className="timing-or">yoki qo‘lda belgilang:</p>

      <div className={`timing-mark${marking ? " is-on" : ""}`}>
        {!marking ? (
          <>
            <p>
              <strong>Qanday ishlaydi:</strong> “Boshlash” ni bosing, audio ijro etiladi. Diktor har bir jumlani boshlaganda <kbd>Space</kbd> yoki “Belgilash” ni bosing.
            </p>
            <div className="row">
              <label className="select">
                <span>Qaysi jumladan</span>
                <select value={cursor} onChange={(e) => setCursor(Number(e.target.value))}>
                  {flat.map((s, i) => (
                    <option key={s.id} value={i}>
                      {i + 1}. {s.en.slice(0, 50)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const a = audioRef.current;
                  if (!a) return;
                  const prevStart = flat[cursor - 1]?.start;
                  a.currentTime = cursor > 0 && typeof prevStart === "number" ? prevStart : 0;
                  setMarking(true);
                  void a.play();
                }}
              >
                <Icon name="play" /> Boshlash
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="timing-next-label">Keyingi jumla ({Math.min(cursor + 1, flat.length)}/{flat.length}):</p>
            <p className="timing-next" lang="en">
              {current ? current.en : "Hammasi belgilandi ✅"}
            </p>
            <div className="row">
              <button type="button" className="btn btn-primary btn-lg" onClick={mark} disabled={!current}>
                Belgilash (Space)
              </button>
              <button type="button" className="btn btn-soft" onClick={() => setCursor((c) => Math.max(0, c - 1))}>
                Bitta orqaga
              </button>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => {
                  audioRef.current?.pause();
                  setMarking(false);
                }}
              >
                To‘xtatish
              </button>
            </div>
          </>
        )}
      </div>

      <div className="row">
        <button type="button" className="btn btn-soft btn-sm" onClick={() => shiftAll(-0.1)}>
          Hammasini −0.1s
        </button>
        <button type="button" className="btn btn-soft btn-sm" onClick={() => shiftAll(0.1)}>
          Hammasini +0.1s
        </button>
        <button type="button" className="btn btn-soft btn-sm danger" onClick={clearAll}>
          <Icon name="trash" /> Vaqtlarni tozalash
        </button>
      </div>

      <ol className="timing-list">
        {flat.map((s, i) => (
          <li key={s.id} className={i === cursor && marking ? "is-cursor" : ""}>
            <span className="timing-n">{i + 1}</span>
            <span className="timing-text" lang="en">
              {s.en}
            </span>
            <span className="timing-controls">
              <button type="button" className="icon-btn sm" aria-label="−0.1s" onClick={() => typeof s.start === "number" && setStart(i, s.start - 0.1)}>
                −
              </button>
              <input
                type="number"
                step="0.05"
                min="0"
                value={typeof s.start === "number" ? s.start : ""}
                placeholder="—"
                aria-label={`${i + 1}-jumla boshlanish vaqti`}
                onChange={(e) => setStart(i, e.target.value === "" ? undefined : Number(e.target.value))}
              />
              <button type="button" className="icon-btn sm" aria-label="+0.1s" onClick={() => typeof s.start === "number" && setStart(i, s.start + 0.1)}>
                +
              </button>
              <button type="button" className="icon-btn sm" aria-label="Sinab ko‘rish" disabled={typeof s.start !== "number"} onClick={() => testSentence(i)}>
                <Icon name="play" size={16} />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
