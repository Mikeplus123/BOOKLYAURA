"use client";
// "Spotify-style" lock-screen and notification controls.
//  • Android app: @capgo/capacitor-media-session → native MediaSession + foreground service,
//    so narration keeps playing with the screen off and shows artwork + controls on the lock screen.
//  • Browsers: the standard Media Session API (Chrome on Android shows the same controls).
// Controls: play/pause, previous/next sentence, ±10 s, seek bar.
import { useEffect, useRef } from "react";
import { isNativeApp } from "@/lib/platform";
import type { Playback } from "./usePlayback";

export interface NowPlayingMeta {
  title: string;
  artist: string;
  album: string;
  coverImage?: string | null;
  coverColor: string;
}

type Action = "play" | "pause" | "previoustrack" | "nexttrack" | "seekbackward" | "seekforward" | "seekto" | "stop";
type MS = typeof import("@capgo/capacitor-media-session")["MediaSession"];

/** Square artwork: the lesson cover centred on its colour, or a drawn Bookly cover (data URL). */
async function artworkFor(meta: NowPlayingMeta): Promise<string> {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, meta.coverColor);
  g.addColorStop(1, "#04231d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  if (meta.coverImage) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = new URL(meta.coverImage, window.location.origin).href;
      await img.decode();
      // Portrait cover, fitted to the square's height with a soft shadow.
      const h = size * 0.92;
      const w = (img.naturalWidth / img.naturalHeight) * h;
      ctx.shadowColor = "rgba(0,0,0,.45)";
      ctx.shadowBlur = 30;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      return canvas.toDataURL("image/jpeg", 0.86);
    } catch {
      /* fall through to the drawn cover */
    }
  }
  ctx.fillStyle = "#d9b45c";
  ctx.fillRect(size - 110, 0, 34, 120);
  ctx.fillStyle = "#fff";
  ctx.font = "700 46px Georgia, serif";
  const words = meta.title.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > size - 100 && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.slice(0, 5).forEach((l, i) => ctx.fillText(l, 48, 170 + i * 58));
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.fillText(meta.artist, 48, size - 56);
  return canvas.toDataURL("image/png");
}

export function useMediaSession(pb: Playback, meta: NowPlayingMeta, enabled: boolean) {
  const pbRef = useRef(pb);
  pbRef.current = pb;
  // Wrapped in an object: Capacitor plugins are proxies, and resolving a promise *with* one makes
  // JS call proxy.then() (→ "not implemented" error). Never return a plugin from an async function.
  const nativeRef = useRef<Promise<{ ms: MS | null }> | null>(null);
  const loadNative = () =>
    (nativeRef.current ??= isNativeApp()
      ? import("@capgo/capacitor-media-session").then((m) => ({ ms: m.MediaSession as MS | null })).catch(() => ({ ms: null }))
      : Promise.resolve({ ms: null }));


  // Metadata (title, author, section, artwork).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const art = await artworkFor(meta);
      if (cancelled) return;
      const artwork = art ? [{ src: art, sizes: "512x512", type: art.startsWith("data:image/png") ? "image/png" : "image/jpeg" }] : [];
      const { ms } = await loadNative();
      if (ms) await ms.setMetadata({ title: meta.title, artist: meta.artist, album: meta.album, artwork }).catch(() => undefined);
      else if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: meta.title, artist: meta.artist, album: meta.album, artwork });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, meta.title, meta.artist, meta.album, meta.coverImage, meta.coverColor]);

  // Remote controls (lock screen, notification, headset / Bluetooth buttons).
  useEffect(() => {
    if (!enabled) return;
    const handlers: Record<Action, (d: { seekTime?: number | null }) => void> = {
      play: () => pbRef.current.play(),
      pause: () => pbRef.current.pause(),
      stop: () => pbRef.current.pause(),
      previoustrack: () => pbRef.current.prev(),
      nexttrack: () => pbRef.current.next(),
      seekbackward: () => pbRef.current.seekBy(-10),
      seekforward: () => pbRef.current.seekBy(10),
      seekto: (d) => {
        const p = pbRef.current;
        if (typeof d.seekTime === "number" && p.duration) p.seek(d.seekTime / p.duration);
      },
    };
    const actions = Object.keys(handlers) as Action[];
    let ms: MS | null = null;
    void loadNative().then((r) => {
      ms = r.ms;
      for (const action of actions) {
        if (ms) void ms.setActionHandler({ action }, (d) => handlers[action](d)).catch(() => undefined);
        else if ("mediaSession" in navigator) {
          try {
            navigator.mediaSession.setActionHandler(action, (d) => handlers[action](d));
          } catch {
            /* action unsupported by this browser */
          }
        }
      }
    });
    return () => {
      for (const action of actions) {
        if (ms) void ms.setActionHandler({ action }, null).catch(() => undefined);
        else if ("mediaSession" in navigator) {
          try {
            navigator.mediaSession.setActionHandler(action, null);
          } catch {
            /* ignore */
          }
        }
      }
      // Leaving the lesson: remove the notification.
      void loadNative().then(({ ms: m }) => m?.setPlaybackState({ playbackState: "none" }).catch(() => undefined));
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Playing / paused (starts or stops the Android foreground service).
  useEffect(() => {
    if (!enabled) return;
    const state = pb.playing ? "playing" : "paused";
    void loadNative().then(({ ms }) => {
      if (ms) void ms.setPlaybackState({ playbackState: state }).catch(() => undefined);
      else if ("mediaSession" in navigator) navigator.mediaSession.playbackState = state;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pb.playing]);

  // Seek bar position (throttled to whole seconds).
  const second = Math.floor(pb.time);
  useEffect(() => {
    if (!enabled || !pb.duration || !Number.isFinite(pb.duration)) return;
    const pos = { duration: pb.duration, position: Math.min(pb.time, pb.duration), playbackRate: pb.rate };
    void loadNative().then(({ ms }) => {
      if (ms) void ms.setPositionState(pos).catch(() => undefined);
      else if ("mediaSession" in navigator && navigator.mediaSession.setPositionState) {
        try {
          navigator.mediaSession.setPositionState(pos);
        } catch {
          /* invalid state while loading */
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, second, pb.duration, pb.rate, pb.playing]);
}
