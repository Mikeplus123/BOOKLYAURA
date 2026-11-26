"use client";
// Full-screen "Now playing" view (Spotify-style): big artwork you can swipe to skip sentences,
// the current sentence as live "lyrics", scrubber, speed, sleep timer and narration language.
// Swipe down, tap the chevron or press Android back to close.
import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BookCover } from "@/components/BookCover";
import { Icon } from "@/components/Icon";
import { pushBackHandler } from "@/lib/native/back";
import { haptic } from "@/lib/native/haptics";
import { formatTime, type FlatSentence } from "@/lib/text";
import type { AudioLang, SummaryMeta } from "@/lib/types";
import { useSwipe } from "@/lib/useSwipe";
import { RATES, type Playback } from "./usePlayback";

export type SleepMode = { kind: "off" } | { kind: "minutes"; until: number; minutes: number } | { kind: "section"; sectionIndex: number };

export const SLEEP_OPTIONS: { id: string; label: string; minutes?: number; section?: boolean }[] = [
  { id: "off", label: "O‘chiq" },
  { id: "5", label: "5 daqiqa", minutes: 5 },
  { id: "10", label: "10 daqiqa", minutes: 10 },
  { id: "15", label: "15 daqiqa", minutes: 15 },
  { id: "30", label: "30 daqiqa", minutes: 30 },
  { id: "section", label: "Bo‘lim oxirida", section: true },
];

interface Props {
  pb: Playback;
  meta: Pick<SummaryMeta, "title" | "titleUz" | "author" | "coverColor" | "topic"> & { coverImage?: string | null };
  sentences: FlatSentence[];
  sectionTitle?: string;
  trLang: "uz" | "ru";
  saved: boolean;
  onSave: () => void;
  onRate: (r: number) => void;
  audioLangs: { id: AudioLang; label: string }[];
  audioLang: AudioLang;
  onAudioLang: (l: AudioLang) => void;
  sleep: SleepMode;
  sleepLeft: string | null;
  onSleep: (optionId: string) => void;
  onShowText: () => void;
  onClose: () => void;
}

export function NowPlaying(props: Props) {
  const { pb, meta, sentences, sectionTitle, trLang, saved, onSave, onRate, audioLangs, audioLang, onAudioLang, sleep, sleepLeft, onSleep, onShowText, onClose } = props;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const barRef = useRef<HTMLDivElement>(null);
  const lastSeekIndex = useRef(pb.index);

  useEffect(() => {
    const unBack = pushBackHandler(() => onCloseRef.current());
    document.documentElement.classList.add("sheet-open");
    return () => {
      unBack();
      document.documentElement.classList.remove("sheet-open");
    };
  }, []);

  // Swipe the artwork: left = next sentence, right = previous (with the cover following the finger).
  const art = useSwipe({
    axis: "x",
    threshold: 70,
    disabled: pb.kind === "audio-untimed",
    onSwipe: (dir) => {
      haptic("select");
      if (dir === "left") pb.next();
      else pb.prev();
    },
  });
  // Swipe down on the header/artwork area to minimise.
  const down = useSwipe({ axis: "y", allow: ["down"], threshold: 110, onSwipe: () => onCloseRef.current() });

  const s = sentences[pb.index];
  const next = sentences[pb.index + 1];
  const pct = pb.duration ? Math.min(100, (pb.time / pb.duration) * 100) : 0;

  const seekFromX = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    pb.seek((clientX - rect.left) / rect.width);
  };
  // A light tick each time scrubbing crosses into another sentence.
  useEffect(() => {
    if (pb.index !== lastSeekIndex.current) {
      lastSeekIndex.current = pb.index;
      if (!pb.playing) haptic("select");
    }
  }, [pb.index, pb.playing]);

  const cycleRate = () => {
    const i = RATES.indexOf(pb.rate as (typeof RATES)[number]);
    haptic("select");
    onRate(RATES[(i + 1) % RATES.length] ?? 1);
  };
  const cycleSleep = () => {
    const cur = sleep.kind === "off" ? "off" : sleep.kind === "section" ? "section" : String(sleep.minutes);
    const i = SLEEP_OPTIONS.findIndex((o) => o.id === cur);
    haptic("select");
    onSleep(SLEEP_OPTIONS[(i + 1) % SLEEP_OPTIONS.length].id);
  };

  if (typeof document === "undefined") return null;
  const style = { ["--np" as string]: meta.coverColor, transform: down.offset > 0 ? `translateY(${down.offset}px)` : undefined } as CSSProperties;

  return createPortal(
    <div className={`now-playing${down.dragging ? " is-dragging" : ""}`} role="dialog" aria-modal="true" aria-label="Hozir ijro etilmoqda" style={style}>
      <div className="np-bg" aria-hidden />
      <div className="np-inner">
        <header className="np-head" {...down.handlers}>
          <button type="button" className="icon-btn" aria-label="Kichraytirish" onClick={onClose}>
            <Icon name="chevron-down" size={26} />
          </button>
          <div className="np-head-title">
            <span>Dars tinglanmoqda</span>
            <strong>{sectionTitle}</strong>
          </div>
          <button type="button" className="icon-btn" aria-label="Matnni ko‘rsatish" onClick={onShowText}>
            <Icon name="book" />
          </button>
        </header>

        <div
          className={`np-art${art.dragging ? " is-dragging" : ""}`}
          {...art.handlers}
          style={{ transform: art.offset ? `translateX(${art.offset}px) rotate(${art.offset / 40}deg)` : undefined }}
        >
          <BookCover meta={meta} size="lg" />
          {pb.kind !== "audio-untimed" && <span className="np-art-hint">← suring →</span>}
        </div>

        <div className="np-meta">
          <div>
            <h2>{meta.titleUz || meta.title}</h2>
            <p>{meta.author}</p>
          </div>
          <button
            type="button"
            className={`icon-btn np-save${saved ? " is-on" : ""}`}
            aria-pressed={saved}
            aria-label={saved ? "Saqlanganlardan olib tashlash" : "Saqlash"}
            onClick={() => {
              haptic(saved ? "soft" : "success");
              onSave();
            }}
          >
            <Icon name={saved ? "bookmark-filled" : "bookmark"} size={24} />
          </button>
        </div>

        {s && pb.canFollow && (
          <div className="np-lyrics" aria-live="polite">
            <p lang="en" className="np-now">
              {s.en}
            </p>
            <p lang={trLang} className="np-tr">
              {trLang === "ru" ? s.ru ?? s.uz : s.uz}
            </p>
            {next && (
              <p lang="en" className="np-next">
                {next.en}
              </p>
            )}
          </div>
        )}

        <div className="np-progress">
          <div
            ref={barRef}
            className="np-track"
            role="slider"
            tabIndex={0}
            aria-label="Ijro joyi"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            data-no-swipe
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              seekFromX(e.clientX);
            }}
            onPointerMove={(e) => e.buttons === 1 && seekFromX(e.clientX)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") pb.seekBy(10);
              if (e.key === "ArrowLeft") pb.seekBy(-10);
            }}
          >
            <div className="np-fill" style={{ width: `${pct}%` }} />
            <div className="np-thumb" style={{ left: `${pct}%` }} />
          </div>
          <div className="np-times">
            <span>{formatTime(pb.time)}</span>
            <span>
              {pb.index + 1} / {sentences.length}
            </span>
            <span>−{formatTime(Math.max(0, pb.duration - pb.time))}</span>
          </div>
        </div>

        <div className="np-controls">
          <button type="button" className="chip-btn np-rate" onClick={cycleRate} aria-label={`Tezlik ${pb.rate}×`}>
            {pb.rate}×
          </button>
          <button
            type="button"
            className="icon-btn np-skip"
            aria-label="Oldingi jumla"
            disabled={pb.kind === "audio-untimed"}
            onClick={() => {
              haptic("select");
              pb.prev();
            }}
          >
            <Icon name="prev" size={30} />
          </button>
          <button
            type="button"
            className="np-play"
            aria-label={pb.playing ? "Pauza" : "Ijro etish"}
            onClick={() => {
              haptic("medium");
              pb.toggle();
            }}
          >
            <Icon name={pb.playing ? "pause" : "play"} size={34} />
          </button>
          <button
            type="button"
            className="icon-btn np-skip"
            aria-label="Keyingi jumla"
            disabled={pb.kind === "audio-untimed"}
            onClick={() => {
              haptic("select");
              pb.next();
            }}
          >
            <Icon name="next" size={30} />
          </button>
          <button
            type="button"
            className={`chip-btn${pb.loop ? " is-on" : ""}`}
            aria-pressed={pb.loop}
            aria-label="Jumlani takrorlash"
            disabled={pb.kind === "audio-untimed"}
            onClick={() => {
              haptic("select");
              pb.setLoop(!pb.loop);
            }}
          >
            <Icon name="repeat" />
          </button>
        </div>

        <div className="np-extra">
          <button type="button" className={`np-pill${sleep.kind !== "off" ? " is-on" : ""}`} onClick={cycleSleep} aria-label="Uyqu taymeri">
            <Icon name="moon" size={18} /> {sleep.kind === "off" ? "Uyqu taymeri" : sleepLeft ?? "Bo‘lim oxirida"}
          </button>
          <button
            type="button"
            className="np-pill"
            onClick={() => {
              haptic("tap");
              pb.seekBy(-10);
            }}
            aria-label="10 soniya orqaga"
          >
            <Icon name="replay" size={18} /> 10s
          </button>
          {audioLangs.length > 1 && (
            <div className="np-langs" role="radiogroup" aria-label="Audio tili">
              {audioLangs.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={audioLang === l.id}
                  className={audioLang === l.id ? "is-on" : ""}
                  onClick={() => {
                    haptic("select");
                    onAudioLang(l.id);
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
