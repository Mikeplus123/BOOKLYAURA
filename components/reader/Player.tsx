"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icon";
import { flattenSentences, formatTime, retimeSentences } from "@/lib/text";
import { getState, saveProgress, setPrefs, setSaved, useBookly, type Theme } from "@/lib/store";
import { track } from "@/lib/track";
import type { AudioLang, ReadingMode, StudyFormat, Summary, SummaryContent, SummaryMeta } from "@/lib/types";
import { levelEn, topicLabel } from "@/lib/types";
import { SentenceBlock } from "./SentenceBlock";
import { RATES, usePlayback, type Playback } from "./usePlayback";

const MODES: { id: ReadingMode; label: string; hint: string }[] = [
  { id: "bilingual", label: "Ikki tilda", hint: "Inglizcha matn + o‘zbekcha tarjima" },
  { id: "english", label: "Inglizcha", hint: "Faqat inglizcha; tarjimani bosib oching" },
  { id: "uzbek", label: "O‘zbekcha", hint: "Inglizcha audio + o‘zbekcha matn" },
];

const AUDIO_LANGS: { id: AudioLang; label: string; hint: string }[] = [
  { id: "en", label: "EN", hint: "Inglizcha audio" },
  { id: "uz", label: "UZ", hint: "O‘zbekcha audio" },
  { id: "ru", label: "RU", hint: "Ruscha audio" },
];

/** Reading-mode labels when the translation line is Russian (Russian narration). */
const MODES_RU: typeof MODES = [
  { id: "bilingual", label: "Ikki tilda", hint: "Inglizcha matn + ruscha tarjima" },
  { id: "english", label: "Inglizcha", hint: "Faqat inglizcha; tarjimani bosib oching" },
  { id: "uzbek", label: "Ruscha", hint: "Faqat ruscha matn" },
];

const audioLangKey = (slug: string) => `bookly:audio-lang:${slug}`;

const FORMATS: { id: StudyFormat; label: string; icon: "book" | "headphones" | "both" }[] = [
  { id: "both", label: "O‘qib tinglash", icon: "both" },
  { id: "read", label: "Faqat o‘qish", icon: "book" },
  { id: "listen", label: "Faqat tinglash", icon: "headphones" },
];

const TEXT_SIZES = ["Kichik", "O‘rta", "Katta", "Juda katta"];
const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "Avto" },
  { id: "light", label: "Yorug‘" },
  { id: "warm", label: "Iliq" },
  { id: "dark", label: "Tungi" },
];

interface Props {
  summary: Summary & { content: SummaryContent };
  initialFormat?: StudyFormat;
  nextUp: SummaryMeta[];
}

export default function Player({ summary, initialFormat, nextUp }: Props) {
  const { content, slug } = summary;
  const sentences = useMemo(() => flattenSentences(content.sections), [content.sections]);
  const total = sentences.length;

  // ─── narration language (English + optional Uzbek / Russian tracks) ───
  const audioLangs = useMemo(
    () => AUDIO_LANGS.filter((l) => l.id === "en" ? Boolean(content.audio?.url) : Boolean(content.audioAlt?.[l.id])),
    [content.audio, content.audioAlt],
  );
  const [audioLang, setAudioLang] = useState<AudioLang>(() => {
    try {
      const saved = window.localStorage.getItem(audioLangKey(slug)) as AudioLang | null;
      if (saved && saved !== "en" && content.audioAlt?.[saved]) return saved;
    } catch {
      /* storage unavailable */
    }
    return "en";
  });
  const altTrack = audioLang === "en" ? null : content.audioAlt?.[audioLang] ?? null;
  const playSentences = useMemo(() => (altTrack ? retimeSentences(sentences, altTrack) : sentences), [sentences, altTrack]);
  const trLang: "uz" | "ru" = audioLang === "ru" && sentences.some((s) => s.ru) ? "ru" : "uz";
  const modes = trLang === "ru" ? MODES_RU : MODES;
  const prefs = useBookly((s) => s.prefs);
  const saved = useBookly((s) => s.library[slug]?.saved ?? false);

  // Resume from saved progress (read once on mount).
  const [initial] = useState(() => {
    const p = getState().progress[slug];
    const resumable = p && !p.completedAt && p.sentenceIndex > 0 && p.sentenceIndex < total;
    return { index: resumable ? p.sentenceIndex : 0, resumed: Boolean(resumable), format: p?.format };
  });

  const [mode, setMode] = useState<ReadingMode>(() => getState().prefs.mode);
  const [format, setFormat] = useState<StudyFormat>(initialFormat ?? initial.format ?? "both");
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [vocabOpen, setVocabOpen] = useState<{ index: number; rect: DOMRect } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [follow, setFollow] = useState(true);
  const [showResume, setShowResume] = useState(initial.resumed);
  const [completed, setCompleted] = useState(false);
  const [readIndex, setReadIndex] = useState(initial.index);

  const onFinish = useCallback(() => {
    setCompleted(true);
    saveProgress(slug, { sentenceIndex: total - 1, percent: 100, completedAt: new Date().toISOString() });
    track("summary_complete", slug, { via: "audio" });
  }, [slug, total]);

  const pb = usePlayback({
    sentences: playSentences,
    audioUrl: altTrack?.url ?? content.audio?.url ?? null,
    initialIndex: initial.index,
    initialRate: getState().prefs.rate,
    onFinish,
  });

  useEffect(() => {
    track("session_start", slug, { format, engine: pb.kind });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switching narration keeps the current sentence and, if it was playing, carries on in the new language.
  const resumeAfterSwitch = useRef(false);
  const changeAudioLang = (l: AudioLang) => {
    if (l === audioLang) return;
    resumeAfterSwitch.current = pb.playing;
    if (pb.playing) pb.pause();
    setAudioLang(l);
    try {
      window.localStorage.setItem(audioLangKey(slug), l);
    } catch {
      /* storage unavailable */
    }
    track("mode_change", slug, { audioLang: l });
  };
  useEffect(() => {
    if (!resumeAfterSwitch.current) return;
    resumeAfterSwitch.current = false;
    pb.goTo(pb.index, { play: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioLang]);

  // ─── progress saving ───
  const position = format === "read" && !pb.playing ? readIndex : pb.index;
  useEffect(() => {
    if (completed) return;
    const t = setTimeout(() => {
      const percent = pb.kind === "audio" || pb.kind === "audio-untimed"
        ? (pb.duration ? (pb.time / pb.duration) * 100 : 0)
        : ((position + 1) / total) * 100;
      saveProgress(slug, { sentenceIndex: position, positionSec: pb.time, percent: Math.min(99, percent), mode, format });
    }, 700);
    return () => clearTimeout(t);
  }, [position, mode, format, slug, total, completed, pb.kind, pb.duration, pb.time]);

  // ─── follow the narrator: keep the active sentence in view ───
  const programmaticScroll = useRef(false);
  useEffect(() => {
    if (!pb.canFollow || format === "listen" || !follow || !pb.playing) return;
    const el = document.getElementById(`sentence-${pb.index}`);
    if (!el) return;
    programmaticScroll.current = true;
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    const t = setTimeout(() => (programmaticScroll.current = false), 700);
    return () => clearTimeout(t);
  }, [pb.index, pb.playing, pb.canFollow, follow, format]);

  // If the learner scrolls by hand while listening, stop following until they ask.
  useEffect(() => {
    const stop = () => {
      if (pb.playing && !programmaticScroll.current) setFollow(false);
    };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchmove", stop, { passive: true });
    return () => {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
    };
  }, [pb.playing]);

  // Reading position (for "read only" and saved position): top-most visible sentence.
  useEffect(() => {
    if (format === "listen") return;
    const visible = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.index);
          if (e.isIntersecting) visible.set(i, e.boundingClientRect.top);
          else visible.delete(i);
        }
        if (visible.size) setReadIndex(Math.min(...visible.keys()));
      },
      { rootMargin: "-20% 0px -45% 0px" },
    );
    document.querySelectorAll<HTMLElement>(".sentence").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [format, mode]);

  // Scroll to the resume point once.
  useEffect(() => {
    if (!initial.resumed) return;
    const el = document.getElementById(`sentence-${initial.index}`);
    el?.scrollIntoView({ block: "center" });
  }, [initial]);

  // ─── handlers ───
  const changeMode = (m: ReadingMode) => {
    setMode(m);
    setPrefs({ mode: m });
    track("mode_change", slug, { mode: m });
  };

  const changeFormat = (f: StudyFormat) => {
    setFormat(f);
    if (f === "read" && pb.playing) pb.pause();
    if (f !== "read" && !pb.playing && format === "read") pb.goTo(readIndex, { play: false });
  };

  const onSelect = useCallback((i: number) => setSelected((cur) => (cur === i ? null : i)), []);
  const onVocab = useCallback((index: number, el: HTMLElement) => setVocabOpen({ index, rect: el.getBoundingClientRect() }), []);

  const toggleReveal = (i: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const markRead = () => {
    setCompleted(true);
    saveProgress(slug, { sentenceIndex: total - 1, percent: 100, completedAt: new Date().toISOString(), mode, format });
    track("summary_complete", slug, { via: "reading" });
  };

  const restart = () => {
    setCompleted(false);
    setShowResume(false);
    pb.goTo(0, { play: format !== "read" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setRate = (r: number) => {
    pb.setRate(r);
    setPrefs({ rate: r });
  };

  // Keyboard shortcuts: Space play/pause, ←/→ sentence, R replay, L loop, Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        setVocabOpen(null);
        setSettingsOpen(false);
        setSelected(null);
        return;
      }
      if (format === "read" || pb.kind === "none") return;
      if (e.key === " " && !(e.target as HTMLElement)?.closest("button")) {
        e.preventDefault();
        pb.toggle();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        pb.next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        pb.prev();
      } else if (e.key.toLowerCase() === "r") {
        pb.replay();
      } else if (e.key.toLowerCase() === "l") {
        pb.setLoop(!pb.loop);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pb, format]);

  const activeIndex = pb.canFollow && format !== "read" ? pb.index : -1;
  const isDone = completed || pb.ended;
  const progressPct = pb.duration ? Math.min(100, (pb.time / pb.duration) * 100) : ((position + 1) / total) * 100;
  const currentSection = content.sections[sentences[pb.index]?.sectionIndex ?? 0];

  return (
    <div className={`reader format-${format}`} data-mode={mode}>
      {/* ─── top bar ─── */}
      <header className="reader-top">
        <div className="reader-top-inner">
          <Link href={`/s/${slug}`} className="icon-btn" aria-label="Orqaga">
            <Icon name="back" />
          </Link>
          <div className="reader-title">
            <strong>{summary.titleUz || summary.title}</strong>
            <span>
              {topicLabel(summary.topic)} · {summary.durationMin} daqiqa · {levelEn(summary.level)}
            </span>
          </div>
          <button
            type="button"
            className={`icon-btn${saved ? " is-on" : ""}`}
            aria-pressed={saved}
            aria-label={saved ? "Saqlanganlardan olib tashlash" : "Saqlash"}
            onClick={() => setSaved(slug, !saved)}
          >
            <Icon name={saved ? "bookmark-filled" : "bookmark"} />
          </button>
          <button type="button" className="icon-btn" aria-label="Sozlamalar" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}>
            <Icon name="settings" />
          </button>
        </div>

        <div className="reader-controls-row">
          <div className="segmented" role="radiogroup" aria-label="Matn rejimi">
            {modes.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} title={m.hint} className={mode === m.id ? "is-on" : ""} onClick={() => changeMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          {audioLangs.length > 1 && format !== "read" && (
            <div className="segmented segmented-sm audio-lang" role="radiogroup" aria-label="Audio tili">
              <span className="audio-lang-icon" aria-hidden>
                <Icon name="headphones" size={15} />
              </span>
              {audioLangs.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={audioLang === l.id} title={l.hint} className={audioLang === l.id ? "is-on" : ""} onClick={() => changeAudioLang(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
          )}
          <div className="format-switch" role="radiogroup" aria-label="O‘rganish usuli">
            {FORMATS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={format === f.id} aria-label={f.label} title={f.label} className={format === f.id ? "is-on" : ""} onClick={() => changeFormat(f.id)}>
                <Icon name={f.icon} />
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          rate={pb.rate}
          setRate={setRate}
          textSize={prefs.textSize}
          theme={prefs.theme}
          showRate={pb.kind !== "none"}
        />
      )}

      {showResume && !isDone && (
        <div className="toast" role="status">
          <span>Oxirgi joyingizdan davom etyapsiz ({initial.index + 1}/{total}).</span>
          <button type="button" className="link-btn" onClick={restart}>
            Boshidan
          </button>
          <button type="button" className="icon-btn sm" aria-label="Yopish" onClick={() => setShowResume(false)}>
            <Icon name="close" />
          </button>
        </div>
      )}

      {/* ─── body ─── */}
      <main className="reader-body" id="main">
        {pb.kind === "speech" && format !== "read" && (
          <p className="engine-note">
            <Icon name="info" /> Bu dars uchun hali yozilgan audio yo‘q — hozircha brauzerning inglizcha ovozi o‘qib beradi.
          </p>
        )}
        {pb.kind === "audio-untimed" && (
          <p className="engine-note">
            <Icon name="info" /> Audio matn bilan hali sinxronlanmagan: jumlalar avtomatik belgilanmaydi.
          </p>
        )}
        {pb.error && (
          <p className="engine-note is-error" role="alert">
            {pb.error}
          </p>
        )}

        {format === "listen" ? (
          <ListenPanel pb={pb} total={total} sectionTitle={mode === "uzbek" ? (trLang === "ru" ? currentSection?.heading.ru ?? currentSection?.heading.uz : currentSection?.heading.uz) : currentSection?.heading.en} onShowText={() => changeFormat("both")} />
        ) : (
          <article className="reader-text" aria-label="Dars matni">
            {content.sections.map((section) => (
              <section key={section.id} className="reader-section">
                <h2 className="reader-heading">
                  {mode !== "uzbek" && <span lang="en">{section.heading.en}</span>}
                  {mode !== "english" && <small lang={trLang}>{trLang === "ru" ? section.heading.ru ?? section.heading.uz : section.heading.uz}</small>}
                </h2>
                {section.sentences.map((s) => {
                  const fs = sentences.find((x) => x.id === s.id)!;
                  return (
                    <div key={s.id} className="sentence-wrap">
                      <SentenceBlock
                        sentence={fs}
                        vocab={content.vocab}
                        mode={mode}
                        trLang={trLang}
                        active={fs.index === activeIndex}
                        selected={fs.index === selected}
                        revealed={revealed.has(fs.index)}
                        onSelect={onSelect}
                        onVocab={onVocab}
                      />
                      {selected === fs.index && (
                        <SentenceActions
                          slug={slug}
                          sentenceId={fs.id}
                          index={fs.index}
                          mode={mode}
                          pb={pb}
                          revealed={revealed.has(fs.index)}
                          onReveal={() => toggleReveal(fs.index)}
                          onClose={() => setSelected(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </section>
            ))}

            {!isDone && format === "read" && (
              <div className="read-finish">
                <button type="button" className="btn btn-primary" onClick={markRead}>
                  <Icon name="check" /> O‘qib tugatdim
                </button>
              </div>
            )}
          </article>
        )}

        {isDone && <FinishPanel slug={slug} hasPractice={content.questions.length > 0 || content.vocab.length > 0} takeaway={content.takeaway} nextUp={nextUp} onRestart={restart} />}
      </main>

      {!follow && pb.playing && format !== "listen" && (
        <button
          type="button"
          className="follow-btn"
          onClick={() => {
            setFollow(true);
            document.getElementById(`sentence-${pb.index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          <Icon name="target" /> Joriy jumlaga qaytish
        </button>
      )}

      {/* ─── player bar ─── */}
      {format !== "read" && pb.kind !== "none" ? (
        <PlayerBar pb={pb} progressPct={progressPct} total={total} onRate={setRate} />
      ) : format === "read" && pb.kind !== "none" ? (
        <div className="read-mode-bar">
          <button type="button" className="btn btn-soft" onClick={() => changeFormat("both")}>
            <Icon name="play" /> Shu joydan tinglash
          </button>
        </div>
      ) : null}

      {vocabOpen && <VocabPopover item={content.vocab[vocabOpen.index]} rect={vocabOpen.rect} onClose={() => setVocabOpen(null)} />}
    </div>
  );
}

// ─── sub-components ─────────────────────────────────────────────────────────

function PlayerBar({ pb, progressPct, total, onRate }: { pb: Playback; progressPct: number; total: number; onRate: (r: number) => void }) {
  const barRef = useRef<HTMLDivElement>(null);
  const seekFromEvent = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (rect) pb.seek((clientX - rect.left) / rect.width);
  };
  const cycleRate = () => {
    const i = RATES.indexOf(pb.rate as (typeof RATES)[number]);
    onRate(RATES[(i + 1) % RATES.length] ?? 1);
  };
  return (
    <div className="player-bar" role="region" aria-label="Audio pleyer">
      <div className="player-progress">
        <span className="time">{formatTime(pb.time)}</span>
        <div
          ref={barRef}
          className="track"
          role="slider"
          tabIndex={0}
          aria-label="Ijro joyi"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
          aria-valuetext={`${pb.index + 1}-jumla, jami ${total}`}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            seekFromEvent(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) seekFromEvent(e.clientX);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") pb.next();
            if (e.key === "ArrowLeft") pb.prev();
          }}
        >
          <div className="track-fill" style={{ width: `${progressPct}%` }} />
          <div className="track-thumb" style={{ left: `${progressPct}%` }} />
        </div>
        <span className="time">{formatTime(pb.duration)}</span>
      </div>
      <div className="player-buttons">
        <button type="button" className="chip-btn" onClick={cycleRate} aria-label={`Tezlik ${pb.rate}×`}>
          {pb.rate}×
        </button>
        <button type="button" className="icon-btn lg" onClick={pb.prev} aria-label="Oldingi jumla" disabled={pb.kind === "audio-untimed"}>
          <Icon name="prev" />
        </button>
        <button type="button" className="play-btn" onClick={pb.toggle} aria-label={pb.playing ? "Pauza" : "Ijro etish"}>
          <Icon name={pb.playing ? "pause" : "play"} />
        </button>
        <button type="button" className="icon-btn lg" onClick={pb.next} aria-label="Keyingi jumla" disabled={pb.kind === "audio-untimed"}>
          <Icon name="next" />
        </button>
        <button
          type="button"
          className={`chip-btn${pb.loop ? " is-on" : ""}`}
          onClick={() => pb.setLoop(!pb.loop)}
          aria-pressed={pb.loop}
          aria-label="Joriy jumlani takrorlash"
          title="Jumlani takrorlash (L)"
          disabled={pb.kind === "audio-untimed"}
        >
          <Icon name="repeat" />
        </button>
      </div>
    </div>
  );
}

function ListenPanel({ pb, total, sectionTitle, onShowText }: { pb: Playback; total: number; sectionTitle?: string; onShowText: () => void }) {
  return (
    <div className="listen-panel">
      <div className="listen-art" aria-hidden>
        <div className={`listen-wave${pb.playing ? " is-playing" : ""}`}>
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 6) * 0.12}s` }} />
          ))}
        </div>
      </div>
      <p className="listen-section">{sectionTitle}</p>
      <p className="listen-count">
        {pb.index + 1} / {total} jumla
      </p>
      <div className="listen-actions">
        <button type="button" className="btn btn-soft" onClick={() => pb.replay(undefined, false)} disabled={pb.kind === "audio-untimed"}>
          <Icon name="replay" /> Jumlani qayta
        </button>
        <button type="button" className="btn btn-soft" onClick={() => pb.replay(undefined, true)} disabled={pb.kind === "audio-untimed"}>
          <Icon name="slow" /> Sekinroq
        </button>
      </div>
      <button type="button" className="link-btn" onClick={onShowText}>
        Matnni ko‘rsatish
      </button>
    </div>
  );
}

function SentenceActions({
  slug,
  sentenceId,
  index,
  mode,
  pb,
  revealed,
  onReveal,
  onClose,
}: {
  slug: string;
  sentenceId: string;
  index: number;
  mode: ReadingMode;
  pb: Playback;
  revealed: boolean;
  onReveal: () => void;
  onClose: () => void;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const canReplay = pb.kind === "audio" || pb.kind === "speech";
  return (
    <div className="sentence-actions" role="toolbar" aria-label="Jumla amallari">
      <div className="sentence-actions-row">
        {canReplay && (
          <>
            <button type="button" className="action" onClick={() => pb.replay(index, false)}>
              <Icon name="replay" /> Qayta tinglash
            </button>
            <button type="button" className="action" onClick={() => pb.replay(index, true)}>
              <Icon name="slow" /> Sekin
            </button>
            <button type="button" className="action" onClick={() => pb.goTo(index, { play: true })}>
              <Icon name="play" /> Shu yerdan
            </button>
          </>
        )}
        {mode === "english" && (
          <button type="button" className={`action${revealed ? " is-on" : ""}`} onClick={onReveal}>
            <Icon name="translate" /> {revealed ? "Tarjimani yashirish" : "Tarjima"}
          </button>
        )}
        <button type="button" className={`action action-ai${aiOpen ? " is-on" : ""}`} onClick={() => setAiOpen((v) => !v)}>
          <Icon name="sparkle" /> Tushuntir
        </button>
        <button type="button" className="action action-close" onClick={onClose} aria-label="Yopish">
          <Icon name="close" />
        </button>
      </div>
      {aiOpen && <ExplainPanel slug={slug} sentenceId={sentenceId} />}
    </div>
  );
}

interface ExplanationData {
  meaningUz: string;
  simpleEn: string;
  phrases: { en: string; uz: string; note: string }[];
  grammarUz: string;
}
const explanationCache = new Map<string, ExplanationData>();

function ExplainPanel({ slug, sentenceId }: { slug: string; sentenceId: string }) {
  const { enabled, user, signInWithGoogle } = useAuth();
  const key = `${slug}:${sentenceId}`;
  const [data, setData] = useState<ExplanationData | null>(explanationCache.get(key) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const needsLogin = enabled && !user;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, sentenceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Xatolik yuz berdi.");
      explanationCache.set(key, json.explanation);
      setData(json.explanation);
      track("ai_explain", slug, { sentenceId, cached: json.cached });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }, [slug, sentenceId, key]);

  useEffect(() => {
    if (!data && !needsLogin) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, needsLogin]);

  if (needsLogin)
    return (
      <div className="explain">
        <p>AI tushuntirishlari bepul — faqat hisobingizga kiring, shunda limit va natijalar saqlanadi.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => signInWithGoogle(window.location.pathname)}>
          <Icon name="google" /> Google bilan kirish
        </button>
      </div>
    );

  return (
    <div className="explain" aria-live="polite">
      {loading && (
        <div className="explain-loading">
          <span className="dot-pulse" aria-hidden /> Tushuntirish tayyorlanmoqda…
        </div>
      )}
      {error && (
        <div className="explain-error">
          <p>{error}</p>
          <button type="button" className="link-btn" onClick={load}>
            Qayta urinish
          </button>
        </div>
      )}
      {data && (
        <div className="explain-body">
          <p className="explain-meaning">{data.meaningUz}</p>
          {data.simpleEn && (
            <p className="explain-simple" lang="en">
              <span>Soddaroq:</span> {data.simpleEn}
            </p>
          )}
          {data.phrases.length > 0 && (
            <ul className="explain-phrases">
              {data.phrases.map((p, i) => (
                <li key={i}>
                  <strong lang="en">{p.en}</strong> — {p.uz}
                  {p.note && <small> {p.note}</small>}
                </li>
              ))}
            </ul>
          )}
          {data.grammarUz && <p className="explain-grammar">📐 {data.grammarUz}</p>}
          <p className="explain-foot">AI tomonidan tayyorlangan · xatolar bo‘lishi mumkin</p>
        </div>
      )}
    </div>
  );
}

function VocabPopover({ item, rect, onClose }: { item: SummaryContent["vocab"][number]; rect: DOMRect; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    ref.current?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, [onClose]);

  const width = Math.min(320, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12));
  const below = rect.bottom + 10 + 220 < window.innerHeight;
  const style = below ? { top: rect.bottom + 10, left, width } : { bottom: window.innerHeight - rect.top + 10, left, width };

  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(item.term);
    u.lang = "en-US";
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  };

  return (
    <div ref={ref} className="vocab-pop" style={style} role="dialog" aria-label={`${item.term} so‘zi`} tabIndex={-1}>
      <div className="vocab-pop-head">
        <strong lang="en">{item.term}</strong>
        <button type="button" className="icon-btn sm" onClick={speak} aria-label="Talaffuzni tinglash">
          <Icon name="volume" />
        </button>
        <span className="vocab-pop-uz">→ {item.uz}</span>
      </div>
      {item.definition && (
        <p className="vocab-pop-def" lang="en">
          {item.definition}
        </p>
      )}
      <p className="vocab-pop-ex" lang="en">
        “{item.example}”
      </p>
      {item.exampleUz && <p className="vocab-pop-exuz">{item.exampleUz}</p>}
    </div>
  );
}

function SettingsPanel({
  onClose,
  rate,
  setRate,
  textSize,
  theme,
  showRate,
}: {
  onClose: () => void;
  rate: number;
  setRate: (r: number) => void;
  textSize: number;
  theme: Theme;
  showRate: boolean;
}) {
  return (
    <div className="settings-panel" role="dialog" aria-label="O‘qish sozlamalari">
      <div className="settings-row">
        <span>Matn o‘lchami</span>
        <div className="stepper">
          <button type="button" aria-label="Kichikroq" disabled={textSize <= 0} onClick={() => setPrefs({ textSize: textSize - 1 })}>
            A−
          </button>
          <output>{TEXT_SIZES[textSize]}</output>
          <button type="button" aria-label="Kattaroq" disabled={textSize >= 3} onClick={() => setPrefs({ textSize: textSize + 1 })}>
            A+
          </button>
        </div>
      </div>
      <div className="settings-row">
        <span>Mavzu</span>
        <div className="chips">
          {THEMES.map((t) => (
            <button key={t.id} type="button" className={`chip theme-chip theme-${t.id}${theme === t.id ? " is-on" : ""}`} aria-pressed={theme === t.id} onClick={() => setPrefs({ theme: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {showRate && (
        <div className="settings-row">
          <span>Tezlik</span>
          <div className="chips">
            {RATES.map((r) => (
              <button key={r} type="button" className={`chip${rate === r ? " is-on" : ""}`} aria-pressed={rate === r} onClick={() => setRate(r)}>
                {r}×
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="settings-keys">
        Klaviatura: <kbd>Space</kbd> ijro/pauza · <kbd>←</kbd>/<kbd>→</kbd> jumlalar · <kbd>R</kbd> qayta · <kbd>L</kbd> takrorlash
      </p>
      <button type="button" className="btn btn-soft btn-sm" onClick={onClose}>
        Tayyor
      </button>
    </div>
  );
}

function FinishPanel({
  slug,
  hasPractice,
  takeaway,
  nextUp,
  onRestart,
}: {
  slug: string;
  hasPractice: boolean;
  takeaway: { en: string; uz: string };
  nextUp: SummaryMeta[];
  onRestart: () => void;
}) {
  return (
    <section className="finish" aria-labelledby="finish-title">
      <div className="finish-ribbon" aria-hidden />
      <h2 id="finish-title">Barakalla! Darsni tugatdingiz 🎉</h2>
      {takeaway.en && (
        <div className="takeaway">
          <span className="eyebrow">Amaliy qadam</span>
          <p lang="en">{takeaway.en}</p>
          <p className="muted">{takeaway.uz}</p>
        </div>
      )}
      <div className="finish-actions">
        {hasPractice && (
          <Link href={`/s/${slug}/practice`} className="btn btn-primary">
            <Icon name="target" /> Mashq qilish · ~3 daqiqa
          </Link>
        )}
        <button type="button" className="btn btn-soft" onClick={onRestart}>
          <Icon name="replay" /> Yana bir bor
        </button>
      </div>
      {nextUp.length > 0 && (
        <div className="finish-next">
          <span className="eyebrow">Keyingi dars</span>
          {nextUp.slice(0, 2).map((s) => (
            <Link key={s.slug} href={`/s/${s.slug}`} className="next-link">
              <span className="next-dot" style={{ background: s.coverColor }} />
              <span>
                <strong>{s.titleUz || s.title}</strong>
                <small>
                  {topicLabel(s.topic)} · {s.durationMin} daqiqa
                </small>
              </span>
              <Icon name="arrow" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
