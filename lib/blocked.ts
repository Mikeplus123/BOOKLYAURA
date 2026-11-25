"use client";
// "Hide this user's reviews" — a per-device block list (Google Play UGC policy: users can block others).
import { useSyncExternalStore } from "react";

const KEY = "bookly:blocked-users";
const listeners = new Set<() => void>();
const EMPTY: string[] = [];
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(ids: string[]) {
  cache = ids;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable: keep in memory */
  }
  for (const l of listeners) l();
}

export function blockUser(id: string) {
  if (!read().includes(id)) write([...read(), id]);
}

export function unblockAll() {
  write([]);
}

export function useBlockedUsers(): string[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}
