import { test } from "node:test";
import assert from "node:assert/strict";
import { currentStreak, localDay } from "../lib/streak.ts";
import { APP_UA_TOKEN, isAppUserAgent } from "../lib/platform.ts";

const at = (daysAgo: number, now: Date) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};
const progress = (iso: string, done = false) => ({ sentenceIndex: 3, positionSec: 0, percent: done ? 100 : 30, completedAt: done ? iso : null, updatedAt: iso });

test("streak counts consecutive days ending today", () => {
  const now = new Date(2026, 10, 25, 20, 0);
  const s = currentStreak({ progress: { a: progress(at(0, now)), b: progress(at(1, now), true), c: progress(at(2, now)) }, practice: {} }, now);
  assert.deepEqual(s, { days: 3, today: true });
});

test("streak survives until today's lesson (counts from yesterday)", () => {
  const now = new Date(2026, 10, 25, 9, 0);
  const s = currentStreak({ progress: { a: progress(at(1, now)), b: progress(at(2, now)) }, practice: {} }, now);
  assert.deepEqual(s, { days: 2, today: false });
});

test("a missed day breaks the streak", () => {
  const now = new Date(2026, 10, 25, 9, 0);
  const s = currentStreak({ progress: { a: progress(at(0, now)), b: progress(at(2, now)) }, practice: {} }, now);
  assert.equal(s.days, 1);
});

test("practice counts as activity; untouched lessons don't", () => {
  const now = new Date(2026, 10, 25, 9, 0);
  const iso = at(0, now);
  const s = currentStreak(
    {
      progress: { a: { ...progress(at(1, now)), percent: 0 } },
      practice: { a: { score: 1, total: 3, bestScore: 1, answers: [], completedAt: iso, updatedAt: iso } },
    },
    now,
  );
  assert.deepEqual(s, { days: 1, today: true });
  assert.equal(localDay(now), "2026-11-25");
});

test("app user agent detection", () => {
  assert.equal(isAppUserAgent(`Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile Safari/537.36 ${APP_UA_TOKEN}/1.0`), true);
  assert.equal(isAppUserAgent("Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile Safari/537.36"), false);
  assert.equal(isAppUserAgent(null), false);
});
