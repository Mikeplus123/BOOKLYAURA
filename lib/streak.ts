// Daily learning streak, computed from local progress/practice timestamps (no extra storage).
import type { BooklyState } from "./store";

export function localDay(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Days (local time) on which the learner opened, finished or practised a lesson. */
export function activeDays(state: Pick<BooklyState, "progress" | "practice">): Set<string> {
  const days = new Set<string>();
  for (const p of Object.values(state.progress)) {
    if (p.percent > 0) days.add(localDay(p.updatedAt));
    if (p.completedAt) days.add(localDay(p.completedAt));
  }
  for (const p of Object.values(state.practice)) days.add(localDay(p.completedAt));
  return days;
}

/** Consecutive active days ending today (or yesterday, so the streak isn't "lost" before today's lesson). */
export function currentStreak(state: Pick<BooklyState, "progress" | "practice">, now = new Date()): { days: number; today: boolean } {
  const days = activeDays(state);
  const today = days.has(localDay(now));
  const cursor = new Date(now);
  if (!today) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (days.has(localDay(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { days: n, today };
}
