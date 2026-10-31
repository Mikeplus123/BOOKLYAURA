"use client";
// Local-first learner state (progress, saved library, practice results, preferences).
// Everything works offline/as a guest via localStorage. When the learner signs in,
// `attachSync` merges local and server data (latest `updatedAt` wins) and keeps
// pushing changes to Supabase, so progress follows the account across devices.

import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadingMode, StudyFormat } from "./types";

export type Theme = "system" | "light" | "warm" | "dark";

export interface ProgressEntry {
  sentenceIndex: number;
  positionSec: number;
  percent: number;
  mode?: ReadingMode;
  format?: StudyFormat;
  completedAt: string | null;
  updatedAt: string;
}

export interface LibraryEntry {
  saved: boolean;
  updatedAt: string;
}

export interface PracticeEntry {
  score: number;
  total: number;
  bestScore: number;
  answers: number[];
  completedAt: string;
  updatedAt: string;
}

export interface Prefs {
  theme: Theme;
  /** 0 = small … 3 = extra large */
  textSize: number;
  rate: number;
  mode: ReadingMode;
  updatedAt: string;
}

export interface BooklyState {
  progress: Record<string, ProgressEntry>;
  library: Record<string, LibraryEntry>;
  practice: Record<string, PracticeEntry>;
  prefs: Prefs;
  anonId: string;
}

export type SyncStatus = "local" | "syncing" | "synced" | "error";

const STORAGE_KEY = "bookly:v1";
const EPOCH = new Date(0).toISOString();

export const DEFAULT_PREFS: Prefs = { theme: "system", textSize: 1, rate: 1, mode: "bilingual", updatedAt: EPOCH };

function emptyState(anonId = ""): BooklyState {
  return { progress: {}, library: {}, practice: {}, prefs: { ...DEFAULT_PREFS }, anonId };
}

const SERVER_STATE = emptyState();

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function load(): BooklyState {
  if (typeof window === "undefined") return SERVER_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BooklyState>;
      return {
        progress: parsed.progress ?? {},
        library: parsed.library ?? {},
        practice: parsed.practice ?? {},
        prefs: { ...DEFAULT_PREFS, ...(parsed.prefs ?? {}) },
        anonId: parsed.anonId || randomId(),
      };
    }
  } catch {
    /* corrupted storage – start fresh */
  }
  return emptyState(randomId());
}

let state: BooklyState = typeof window === "undefined" ? SERVER_STATE : load();
const listeners = new Set<() => void>();

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked – keep in memory */
  }
}

function setState(next: BooklyState) {
  state = next;
  persist();
  for (const l of listeners) l();
}

// Keep tabs in sync with each other.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      for (const l of listeners) l();
    }
  });
}

export function getState(): BooklyState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook. Selectors must return stable references (a slice of state), not new objects. */
export function useBookly<T>(selector: (s: BooklyState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(SERVER_STATE),
  );
}

const now = () => new Date().toISOString();

// ─── mutations ───────────────────────────────────────────────────────────────

export function saveProgress(slug: string, patch: Partial<Omit<ProgressEntry, "updatedAt">>) {
  const prev = state.progress[slug];
  const base: Omit<ProgressEntry, "updatedAt"> = prev ?? { sentenceIndex: 0, positionSec: 0, percent: 0, completedAt: null };
  const entry: ProgressEntry = {
    ...base,
    ...patch,
    // Completion is sticky: once finished, a summary stays finished.
    completedAt: patch.completedAt ?? prev?.completedAt ?? null,
    updatedAt: now(),
  };
  entry.percent = Math.max(0, Math.min(100, Math.round(entry.percent * 10) / 10));
  setState({ ...state, progress: { ...state.progress, [slug]: entry } });
  queuePush("progress", slug);
}

export function setSaved(slug: string, saved: boolean) {
  setState({ ...state, library: { ...state.library, [slug]: { saved, updatedAt: now() } } });
  queuePush("library", slug);
}

export function savePractice(slug: string, score: number, total: number, answers: number[]) {
  const prev = state.practice[slug];
  const t = now();
  const entry: PracticeEntry = {
    score,
    total,
    answers,
    bestScore: Math.max(score, prev?.bestScore ?? 0),
    completedAt: t,
    updatedAt: t,
  };
  setState({ ...state, practice: { ...state.practice, [slug]: entry } });
  queuePush("practice", slug);
}

export function setPrefs(patch: Partial<Omit<Prefs, "updatedAt">>) {
  setState({ ...state, prefs: { ...state.prefs, ...patch, updatedAt: now() } });
  queuePush("prefs", "prefs");
}

// ─── server sync ─────────────────────────────────────────────────────────────

type Kind = "progress" | "library" | "practice" | "prefs";

let sync: { supabase: SupabaseClient; userId: string } | null = null;
let syncStatus: SyncStatus = "local";
const statusListeners = new Set<() => void>();
const pending: Record<Kind, Set<string>> = {
  progress: new Set(),
  library: new Set(),
  practice: new Set(),
  prefs: new Set(),
};
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function setStatus(s: SyncStatus) {
  syncStatus = s;
  for (const l of statusListeners) l();
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => statusListeners.delete(l);
    },
    () => syncStatus,
    () => "local" as SyncStatus,
  );
}

function queuePush(kind: Kind, key: string) {
  if (!sync) return;
  pending[kind].add(key);
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void flush(), 1500);
}

const progressRow = (userId: string, slug: string, p: ProgressEntry) => ({
  user_id: userId,
  summary_slug: slug,
  sentence_index: p.sentenceIndex,
  position_sec: p.positionSec,
  percent: p.percent,
  mode: p.mode ?? null,
  format: p.format ?? null,
  completed_at: p.completedAt,
  updated_at: p.updatedAt,
});
const libraryRow = (userId: string, slug: string, l: LibraryEntry) => ({
  user_id: userId,
  summary_slug: slug,
  saved: l.saved,
  updated_at: l.updatedAt,
});
const practiceRow = (userId: string, slug: string, p: PracticeEntry) => ({
  user_id: userId,
  summary_slug: slug,
  score: p.score,
  total: p.total,
  best_score: p.bestScore,
  answers: p.answers,
  completed_at: p.completedAt,
  updated_at: p.updatedAt,
});

/** Push queued changes now. Safe to call any time. */
export async function flush(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (!sync) return;
  const { supabase, userId } = sync;
  const take = (k: Kind) => {
    const keys = [...pending[k]];
    pending[k].clear();
    return keys;
  };
  const progressKeys = take("progress").filter((k) => state.progress[k]);
  const libraryKeys = take("library").filter((k) => state.library[k]);
  const practiceKeys = take("practice").filter((k) => state.practice[k]);
  const prefsChanged = take("prefs").length > 0;
  if (!progressKeys.length && !libraryKeys.length && !practiceKeys.length && !prefsChanged) return;

  setStatus("syncing");
  const ops: PromiseLike<{ error: unknown }>[] = [];
  if (progressKeys.length)
    ops.push(supabase.from("progress").upsert(progressKeys.map((k) => progressRow(userId, k, state.progress[k]))));
  if (libraryKeys.length)
    ops.push(supabase.from("library_items").upsert(libraryKeys.map((k) => libraryRow(userId, k, state.library[k]))));
  if (practiceKeys.length)
    ops.push(supabase.from("practice_results").upsert(practiceKeys.map((k) => practiceRow(userId, k, state.practice[k]))));
  if (prefsChanged) {
    const { updatedAt, ...prefs } = state.prefs;
    ops.push(supabase.from("profiles").update({ preferences: prefs, preferences_updated_at: updatedAt }).eq("id", userId));
  }
  const results = await Promise.all(ops);
  const failed = results.some((r) => r.error);
  if (failed) {
    // Re-queue everything from this batch and retry later.
    progressKeys.forEach((k) => pending.progress.add(k));
    libraryKeys.forEach((k) => pending.library.add(k));
    practiceKeys.forEach((k) => pending.practice.add(k));
    if (prefsChanged) pending.prefs.add("prefs");
    setStatus("error");
    if (!pushTimer) pushTimer = setTimeout(() => void flush(), 15000);
  } else {
    setStatus("synced");
  }
}

const newer = (a: string | undefined, b: string | undefined) => new Date(a ?? EPOCH).getTime() > new Date(b ?? EPOCH).getTime();

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Merge server data into local state and start pushing local changes for this user. */
export async function attachSync(supabase: SupabaseClient, userId: string): Promise<void> {
  if (sync?.userId === userId) return;
  sync = { supabase, userId };
  setStatus("syncing");

  const [progressRes, libraryRes, practiceRes, profileRes] = await Promise.all([
    supabase.from("progress").select("*").eq("user_id", userId),
    supabase.from("library_items").select("*").eq("user_id", userId),
    supabase.from("practice_results").select("*").eq("user_id", userId),
    supabase.from("profiles").select("preferences, preferences_updated_at").eq("id", userId).maybeSingle(),
  ]);
  if (sync?.userId !== userId) return; // signed out meanwhile
  if (progressRes.error || libraryRes.error || practiceRes.error) {
    setStatus("error");
    return;
  }

  const next: BooklyState = {
    ...state,
    progress: { ...state.progress },
    library: { ...state.library },
    practice: { ...state.practice },
  };

  for (const r of progressRes.data as any[]) {
    const local = next.progress[r.summary_slug];
    const remote: ProgressEntry = {
      sentenceIndex: r.sentence_index,
      positionSec: r.position_sec,
      percent: r.percent,
      mode: r.mode ?? undefined,
      format: r.format ?? undefined,
      completedAt: r.completed_at,
      updatedAt: r.updated_at,
    };
    if (!local || newer(remote.updatedAt, local.updatedAt)) {
      next.progress[r.summary_slug] = { ...remote, completedAt: remote.completedAt ?? local?.completedAt ?? null };
    } else {
      // Local wins, but keep server completion if local lost it.
      next.progress[r.summary_slug] = { ...local, completedAt: local.completedAt ?? remote.completedAt };
      if (newer(local.updatedAt, remote.updatedAt) || (!local.completedAt && remote.completedAt)) pending.progress.add(r.summary_slug);
    }
  }
  for (const slug of Object.keys(state.progress)) {
    if (!(progressRes.data as any[]).some((r) => r.summary_slug === slug)) pending.progress.add(slug);
  }

  for (const r of libraryRes.data as any[]) {
    const local = next.library[r.summary_slug];
    if (!local || newer(r.updated_at, local.updatedAt)) next.library[r.summary_slug] = { saved: r.saved, updatedAt: r.updated_at };
    else if (newer(local.updatedAt, r.updated_at)) pending.library.add(r.summary_slug);
  }
  for (const slug of Object.keys(state.library)) {
    if (!(libraryRes.data as any[]).some((r) => r.summary_slug === slug)) pending.library.add(slug);
  }

  for (const r of practiceRes.data as any[]) {
    const local = next.practice[r.summary_slug];
    const best = Math.max(r.best_score, local?.bestScore ?? 0);
    if (!local || newer(r.updated_at, local.updatedAt)) {
      next.practice[r.summary_slug] = {
        score: r.score,
        total: r.total,
        bestScore: best,
        answers: Array.isArray(r.answers) ? r.answers : [],
        completedAt: r.completed_at,
        updatedAt: r.updated_at,
      };
    } else {
      next.practice[r.summary_slug] = { ...local, bestScore: best };
      if (newer(local.updatedAt, r.updated_at)) pending.practice.add(r.summary_slug);
    }
  }
  for (const slug of Object.keys(state.practice)) {
    if (!(practiceRes.data as any[]).some((r) => r.summary_slug === slug)) pending.practice.add(slug);
  }

  const profile = profileRes.data as { preferences: Partial<Prefs> | null; preferences_updated_at: string } | null;
  if (profile?.preferences && Object.keys(profile.preferences).length && newer(profile.preferences_updated_at, state.prefs.updatedAt)) {
    next.prefs = { ...DEFAULT_PREFS, ...profile.preferences, updatedAt: profile.preferences_updated_at };
  } else if (state.prefs.updatedAt !== EPOCH) {
    pending.prefs.add("prefs");
  }

  setState(next);
  await flush();
  if (syncStatus === "syncing") setStatus("synced");
}

/** Stop syncing (sign-out). Clears this device's copy of the account's data, keeps display prefs. */
export async function detachSync(): Promise<void> {
  await flush().catch(() => undefined);
  sync = null;
  for (const k of Object.keys(pending) as Kind[]) pending[k].clear();
  setState({ ...emptyState(state.anonId), prefs: state.prefs });
  setStatus("local");
}

if (typeof window !== "undefined") {
  const flushSoon = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  document.addEventListener("visibilitychange", flushSoon);
  window.addEventListener("pagehide", () => void flush());
}
