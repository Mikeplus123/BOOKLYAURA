"use client";
// Offline downloads: lesson text in IndexedDB, narration audio in Cache Storage.
// The service worker (public/sw.js) serves cached audio (with Range support, so seeking works)
// and falls back to the /offline reader when the network is gone.
import { useSyncExternalStore } from "react";
import type { Summary, SummaryContent, SummaryMeta } from "./types";

export const AUDIO_CACHE = "bookly-audio-v1";
const DB_NAME = "bookly-offline";
const STORE = "lessons";

export interface OfflineLesson {
  slug: string;
  summary: Summary & { content: SummaryContent };
  nextUp: SummaryMeta[];
  audioUrls: string[];
  bytes: number;
  savedAt: string;
}

export type OfflineMeta = Pick<OfflineLesson, "slug" | "bytes" | "savedAt"> & { title: string; author: string; coverColor: string; coverImage?: string | null; durationMin: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "slug" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

// ─── tiny reactive index of downloaded slugs ───
let index: OfflineMeta[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: OfflineMeta[] = [];
const emit = () => listeners.forEach((l) => l());

function toMeta(l: OfflineLesson): OfflineMeta {
  return {
    slug: l.slug,
    bytes: l.bytes,
    savedAt: l.savedAt,
    title: l.summary.titleUz || l.summary.title,
    author: l.summary.author,
    coverColor: l.summary.coverColor,
    coverImage: l.summary.coverImage,
    durationMin: l.summary.durationMin,
  };
}

export async function refreshIndex(): Promise<OfflineMeta[]> {
  if (typeof indexedDB === "undefined") return (index = []);
  try {
    const all = await tx<OfflineLesson[]>("readonly", (s) => s.getAll() as IDBRequest<OfflineLesson[]>);
    index = all.map(toMeta).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    index = [];
  }
  emit();
  return index;
}

export function useOfflineLessons(): OfflineMeta[] | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      if (index === null) void refreshIndex();
      return () => listeners.delete(l);
    },
    () => index,
    () => null,
  );
}

export function useIsDownloaded(slug: string): boolean {
  const list = useOfflineLessons();
  return Boolean(list?.some((l) => l.slug === slug));
}

export async function getOfflineLesson(slug: string): Promise<OfflineLesson | null> {
  try {
    return (await tx<OfflineLesson | undefined>("readonly", (s) => s.get(slug) as IDBRequest<OfflineLesson | undefined>)) ?? null;
  } catch {
    return null;
  }
}

function audioUrlsOf(content: SummaryContent): string[] {
  const urls = [content.audio?.url, ...Object.values(content.audioAlt ?? {}).map((t) => t?.url)].filter((u): u is string => Boolean(u));
  return [...new Set(urls.map((u) => new URL(u, window.location.origin).href))];
}

/** Total download size in bytes (HEAD requests; 0 when unknown). */
export async function estimateSize(content: SummaryContent): Promise<number> {
  const sizes = await Promise.all(
    audioUrlsOf(content).map((u) =>
      fetch(u, { method: "HEAD" })
        .then((r) => Number(r.headers.get("content-length")) || 0)
        .catch(() => 0),
    ),
  );
  return sizes.reduce((a, b) => a + b, 0);
}

/** Download a lesson for offline use. `onProgress` receives 0…1. */
export async function downloadLesson(summary: Summary & { content: SummaryContent }, nextUp: SummaryMeta[], onProgress?: (p: number) => void): Promise<void> {
  const urls = audioUrlsOf(summary.content);
  const cache = await caches.open(AUDIO_CACHE);
  // Ask the browser not to evict our storage under pressure.
  void navigator.storage?.persist?.().catch(() => false);

  const totals = new Array(urls.length).fill(0);
  const loaded = new Array(urls.length).fill(0);
  const report = () => {
    const t = totals.reduce((a, b) => a + b, 0);
    onProgress?.(t ? loaded.reduce((a, b) => a + b, 0) / t : 0);
  };

  let bytes = 0;
  await Promise.all(
    urls.map(async (url, i) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok || !res.body) throw new Error(`audio ${res.status}`);
      totals[i] = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded[i] += value.length;
        report();
      }
      const type = res.headers.get("content-type") || "audio/mpeg";
      const blob = new Blob(chunks as BlobPart[], { type });
      bytes += blob.size;
      await cache.put(url, new Response(blob, { headers: { "Content-Type": type, "Content-Length": String(blob.size), "Accept-Ranges": "bytes" } }));
    }),
  );
  // Cover artwork, so the offline library and lock screen look right.
  if (summary.coverImage) await cache.add(new URL(summary.coverImage, window.location.origin).href).catch(() => undefined);

  const lesson: OfflineLesson = { slug: summary.slug, summary, nextUp, audioUrls: urls, bytes, savedAt: new Date().toISOString() };
  await tx("readwrite", (s) => s.put(lesson));
  onProgress?.(1);
  // Make sure the offline reader page and its scripts are cached too.
  navigator.serviceWorker?.controller?.postMessage({ type: "warm-offline" });
  await refreshIndex();
}

export async function removeLesson(slug: string): Promise<void> {
  const lesson = await getOfflineLesson(slug);
  if (lesson) {
    const cache = await caches.open(AUDIO_CACHE);
    // Keep files another downloaded lesson still uses.
    const others = (index ?? []).filter((l) => l.slug !== slug);
    const keep = new Set<string>();
    for (const o of others) (await getOfflineLesson(o.slug))?.audioUrls.forEach((u) => keep.add(u));
    await Promise.all(lesson.audioUrls.filter((u) => !keep.has(u)).map((u) => cache.delete(u)));
  }
  await tx("readwrite", (s) => s.delete(slug));
  await refreshIndex();
}

export function formatBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
