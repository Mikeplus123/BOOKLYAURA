"use client";
// Playback engine for the reader.
//  • "audio"          – a narrated audio file with per-sentence timings (best experience)
//  • "audio-untimed"  – audio file without timings (plays, but cannot follow sentences yet)
//  • "speech"         – no audio file yet: the browser's English voice reads each sentence (demo/preview)
//  • "none"           – nothing available: reading only
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { estimateSeconds, hasTimings, sentenceAtTime, sentenceEnd, type FlatSentence } from "@/lib/text";

export type EngineKind = "audio" | "audio-untimed" | "speech" | "none";

export const SLOW_RATE = 0.7;
export const RATES = [0.75, 0.9, 1, 1.15, 1.3, 1.5] as const;

interface Options {
  sentences: FlatSentence[];
  audioUrl?: string | null;
  initialIndex?: number;
  initialRate?: number;
  onFinish?: () => void;
}

export interface GoToOptions {
  /** Start playing after jumping. Defaults to the current playing state. */
  play?: boolean;
  /** Play only this sentence, then pause (sentence replay). */
  single?: boolean;
  /** Play this sentence slowly (single sentence only). */
  slow?: boolean;
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("en"));
  if (!voices.length) return null;
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|premium|enhanced/i.test(v.name) ? 4 : 0) +
    (/google/i.test(v.name) ? 2 : 0) +
    (v.lang === "en-US" ? 2 : v.lang === "en-GB" ? 1 : 0) +
    (v.localService ? 1 : 0);
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

export function usePlayback({ sentences, audioUrl, initialIndex = 0, initialRate = 1, onFinish }: Options) {
  const timed = useMemo(() => hasTimings(sentences), [sentences]);
  const [kind, setKind] = useState<EngineKind>(audioUrl ? (timed ? "audio" : "audio-untimed") : "none");
  const [index, setIndexState] = useState(() => Math.min(Math.max(0, initialIndex), Math.max(0, sentences.length - 1)));
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(initialRate);
  const [loop, setLoopState] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const indexRef = useRef(index);
  const rateRef = useRef(rate);
  const loopRef = useRef(false);
  const loopIndexRef = useRef(0);
  const stopAtRef = useRef<number | null>(null);
  const slowActiveRef = useRef(false);
  /** Sentence being replayed on its own (so the highlight stays on it when playback stops). */
  const singleIndexRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const speechTokenRef = useRef(0);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const sentencesRef = useRef(sentences);
  sentencesRef.current = sentences;

  const setIndex = useCallback((i: number) => {
    indexRef.current = i;
    setIndexState(i);
  }, []);

  // Estimated timeline for the speech engine (used for the progress bar and seeking).
  const estimates = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const s of sentences) {
      starts.push(acc);
      acc += estimateSeconds(s.en);
    }
    return { starts, total: acc };
  }, [sentences]);

  const finish = useCallback(() => {
    setPlaying(false);
    setEnded(true);
    onFinishRef.current?.();
  }, []);

  // ─── detect speech support (client only) ───
  useEffect(() => {
    if (audioUrl) return;
    if (typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined") {
      setKind("speech");
      const load = () => (voiceRef.current = pickEnglishVoice());
      load();
      window.speechSynthesis.addEventListener?.("voiceschanged", load);
      return () => {
        window.speechSynthesis.removeEventListener?.("voiceschanged", load);
        speechTokenRef.current++;
        window.speechSynthesis.cancel();
      };
    }
    setKind("none");
  }, [audioUrl]);

  // ─── audio element lifecycle ───
  const tick = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    const t = a.currentTime;
    setTime((prev) => (Math.abs(prev - t) >= 0.2 ? t : prev));
    const list = sentencesRef.current;
    if (timed) {
      const stopAt = stopAtRef.current;
      if (stopAt !== null && t >= stopAt - 0.03) {
        if (loopRef.current) {
          a.currentTime = list[loopIndexRef.current]?.start ?? 0;
        } else {
          a.pause();
          stopAtRef.current = null;
          if (slowActiveRef.current) {
            slowActiveRef.current = false;
            a.playbackRate = rateRef.current;
          }
          const keep = singleIndexRef.current;
          singleIndexRef.current = null;
          if (keep !== null) {
            if (keep !== indexRef.current) setIndex(keep);
            return;
          }
        }
      }
      const i = loopRef.current ? loopIndexRef.current : singleIndexRef.current ?? sentenceAtTime(list, a.currentTime);
      if (i !== indexRef.current && i >= 0) setIndex(i);
    }
    if (!a.paused) rafRef.current = requestAnimationFrame(tick);
  }, [timed, setIndex]);

  useEffect(() => {
    if (!audioUrl) return;
    const a = new Audio();
    a.preload = "metadata";
    a.src = audioUrl;
    a.playbackRate = rateRef.current;
    audioRef.current = a;

    const onMeta = () => {
      setDuration(a.duration);
      const start = sentencesRef.current[indexRef.current]?.start;
      if (timed && typeof start === "number" && indexRef.current > 0) a.currentTime = start;
    };
    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      setTime(a.currentTime);
    };
    const onEnded = () => {
      setTime(a.duration);
      if (loopRef.current) {
        a.currentTime = sentencesRef.current[loopIndexRef.current]?.start ?? 0;
        void a.play();
        return;
      }
      finish();
    };
    const onError = () => setError("Audio faylni yuklab bo‘lmadi. Internet aloqasini tekshiring.");
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    return () => {
      a.pause();
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      a.src = "";
      audioRef.current = null;
    };
  }, [audioUrl, timed, tick, finish]);

  // ─── speech engine ───
  const speak = useCallback(
    (i: number, opts: { single?: boolean; slow?: boolean } = {}) => {
      const synth = window.speechSynthesis;
      const list = sentencesRef.current;
      const s = list[i];
      if (!s) return;
      const token = ++speechTokenRef.current;
      synth.cancel();
      setIndex(i);
      setPlaying(true);
      setEnded(false);
      setTime(estimates.starts[i] ?? 0);

      const u = new SpeechSynthesisUtterance(s.en);
      u.lang = voiceRef.current?.lang ?? "en-US";
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = opts.slow ? SLOW_RATE : rateRef.current;
      u.onend = () => {
        if (token !== speechTokenRef.current) return;
        if (loopRef.current) return speak(loopIndexRef.current, opts);
        if (opts.single) return setPlaying(false);
        if (i + 1 < sentencesRef.current.length) speak(i + 1);
        else {
          setTime(estimates.total);
          finish();
        }
      };
      u.onerror = (e) => {
        if (token !== speechTokenRef.current) return;
        if (e.error === "interrupted" || e.error === "canceled") return;
        setPlaying(false);
        setError("Brauzer ovozi ishlamadi. Matnni o‘qib davom eting.");
      };
      // Chrome occasionally drops speak() called in the same tick as cancel().
      setTimeout(() => {
        if (token === speechTokenRef.current) synth.speak(u);
      }, 40);
    },
    [estimates, finish, setIndex],
  );

  const stopSpeech = useCallback(() => {
    speechTokenRef.current++;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(false);
  }, []);

  // ─── public controls ───
  const play = useCallback(() => {
    setError(null);
    if (kind === "audio" || kind === "audio-untimed") {
      const a = audioRef.current;
      if (!a) return;
      if (ended || (a.duration && a.currentTime >= a.duration - 0.05)) {
        a.currentTime = 0;
        setIndex(0);
      }
      stopAtRef.current = loopRef.current ? sentenceEnd(sentencesRef.current, loopIndexRef.current, a.duration) : null;
      singleIndexRef.current = null;
      a.play().catch(() => setError("Audioni ijro etib bo‘lmadi. Qayta urinib ko‘ring."));
    } else if (kind === "speech") {
      speak(ended ? 0 : indexRef.current);
    }
  }, [kind, ended, speak, setIndex]);

  const pause = useCallback(() => {
    if (kind === "speech") stopSpeech();
    else audioRef.current?.pause();
  }, [kind, stopSpeech]);

  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  const goTo = useCallback(
    (target: number, opts: GoToOptions = {}) => {
      const list = sentencesRef.current;
      const i = Math.max(0, Math.min(list.length - 1, target));
      const shouldPlay = opts.play ?? playing;
      setEnded(false);
      if (loopRef.current) loopIndexRef.current = i;

      if (kind === "audio") {
        const a = audioRef.current;
        if (!a) return;
        a.currentTime = list[i].start ?? 0;
        setTime(a.currentTime);
        setIndex(i);
        if (opts.slow) {
          slowActiveRef.current = true;
          a.playbackRate = SLOW_RATE;
        } else if (slowActiveRef.current) {
          slowActiveRef.current = false;
          a.playbackRate = rateRef.current;
        }
        stopAtRef.current = opts.single || loopRef.current ? sentenceEnd(list, i, a.duration) : null;
        singleIndexRef.current = opts.single ? i : null;
        if (shouldPlay) a.play().catch(() => setError("Audioni ijro etib bo‘lmadi."));
        else a.pause();
      } else if (kind === "speech") {
        if (shouldPlay) speak(i, { single: opts.single, slow: opts.slow });
        else {
          stopSpeech();
          setIndex(i);
          setTime(estimates.starts[i] ?? 0);
        }
      } else {
        setIndex(i);
      }
    },
    [kind, playing, speak, stopSpeech, estimates, setIndex],
  );

  const next = useCallback(() => goTo(indexRef.current + 1), [goTo]);
  const prev = useCallback(() => {
    // Like music players: if we're well into a sentence, restart it; otherwise go back one.
    const list = sentencesRef.current;
    const a = audioRef.current;
    if (kind === "audio" && a && a.currentTime - (list[indexRef.current]?.start ?? 0) > 1.5) return goTo(indexRef.current);
    goTo(indexRef.current - 1);
  }, [goTo, kind]);

  const replay = useCallback(
    (i = indexRef.current, slow = false) => goTo(i, { play: true, single: !loopRef.current, slow }),
    [goTo],
  );

  const setRate = useCallback(
    (r: number) => {
      rateRef.current = r;
      setRateState(r);
      if (audioRef.current && !slowActiveRef.current) audioRef.current.playbackRate = r;
      if (kind === "speech" && playing) speak(indexRef.current);
    },
    [kind, playing, speak],
  );

  const setLoop = useCallback(
    (on: boolean) => {
      loopRef.current = on;
      setLoopState(on);
      loopIndexRef.current = indexRef.current;
      const a = audioRef.current;
      if (kind === "audio" && a) stopAtRef.current = on ? sentenceEnd(sentencesRef.current, indexRef.current, a.duration) : null;
    },
    [kind],
  );

  /** Seek by fraction of the whole lesson (progress bar). */
  const seek = useCallback(
    (fraction: number) => {
      const f = Math.max(0, Math.min(1, fraction));
      if (kind === "audio" || kind === "audio-untimed") {
        const a = audioRef.current;
        if (!a || !a.duration) return;
        a.currentTime = f * a.duration;
        setTime(a.currentTime);
        stopAtRef.current = null;
        singleIndexRef.current = null;
        if (timed) setIndex(sentenceAtTime(sentencesRef.current, a.currentTime));
        setEnded(false);
      } else {
        const t = f * estimates.total;
        let i = 0;
        while (i + 1 < estimates.starts.length && estimates.starts[i + 1] <= t) i++;
        goTo(i);
      }
    },
    [kind, timed, estimates, goTo, setIndex],
  );

  const totalDuration = kind === "speech" ? estimates.total / rate : duration;
  const currentTime = kind === "speech" ? time / rate : time;
  const canFollow = kind === "audio" || kind === "speech";

  return {
    kind,
    canFollow,
    index,
    playing,
    rate,
    loop,
    ended,
    error,
    time: currentTime,
    duration: totalDuration,
    play,
    pause,
    toggle,
    goTo,
    next,
    prev,
    replay,
    setRate,
    setLoop,
    seek,
    setIndex,
    clearError: () => setError(null),
    audioElement: audioRef,
  };
}

export type Playback = ReturnType<typeof usePlayback>;
