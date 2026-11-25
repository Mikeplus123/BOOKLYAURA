"use client";
// Daily study reminders as *local* notifications (scheduled on the phone, no push server, no tokens).
//
// Instead of one repeating notification we schedule the next 14 days individually, so each one can
// say something useful ("Atomic Habits — 40% da to‘xtagansiz", "🔥 5 kunlik seriya") and today's is
// skipped once the learner has already studied. The schedule is refreshed whenever the app opens.
import { getState } from "@/lib/store";
import { currentStreak } from "@/lib/streak";
import { isNativeApp } from "@/lib/platform";

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

const KEY = "bookly:reminder";
const CHANNEL = "daily-reminders";
const BASE_ID = 7000;
const DAYS = 14;
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 20, minute: 0 };

export function getReminderSettings(): ReminderSettings {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (v && typeof v.enabled === "boolean") return { ...DEFAULT_REMINDER, ...v };
  } catch {
    /* ignore */
  }
  return DEFAULT_REMINDER;
}

function saveSettings(s: ReminderSettings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const TITLES_KEY = "bookly:titles";

/** Remember a lesson's Uzbek title so reminders can name it ("Atomic Habits — davom etamizmi?"). */
export function rememberTitle(slug: string, title: string) {
  try {
    const map = JSON.parse(window.localStorage.getItem(TITLES_KEY) ?? "{}") as Record<string, string>;
    if (map[slug] === title) return;
    map[slug] = title;
    window.localStorage.setItem(TITLES_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function knownTitles(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(TITLES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

const GENERIC = [
  { title: "5 daqiqa — bitta katta g‘oya 📚", body: "Bugungi darsingiz tayyor. Tinglang yoki o‘qing — atigi 5 daqiqa." },
  { title: "Choy damlang, dars tinglang ☕", body: "Bir kitobning eng muhim g‘oyalari va yangi inglizcha so‘zlar sizni kutmoqda." },
  { title: "Ingliz tilingiz uchun 5 daqiqa 🎧", body: "Ikki tilli rejimda tinglang — jumlalar o‘zbekcha tarjimasi bilan." },
  { title: "Bugun nimani o‘rganamiz? 💡", body: "Kutubxonada yangi g‘oyalar bor. Bitta darsni boshlang." },
  { title: "Kichik qadam, katta natija 🌱", body: "Har kuni 5 daqiqa — bir oyda 6 ta kitob g‘oyasi." },
];

interface Continue {
  slug: string;
  percent: number;
}

function lastUnfinished(): Continue | null {
  const entries = Object.entries(getState().progress)
    .filter(([, p]) => !p.completedAt && p.percent > 0 && p.percent < 100)
    .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt));
  const top = entries[0];
  return top ? { slug: top[0], percent: Math.round(top[1].percent) } : null;
}

function message(dayOffset: number, titles: Record<string, string>) {
  const cont = lastUnfinished();
  const streak = currentStreak(getState());
  // Alternate: continue-lesson nudges, streak nudges and general ones.
  if (cont && titles[cont.slug] && dayOffset % 2 === 0) {
    return {
      title: `“${titles[cont.slug]}” — davom etamizmi?`,
      body: `${cont.percent}% da to‘xtagansiz. Qolgan qismi bir necha daqiqa xolos.`,
      url: `/s/${cont.slug}/learn`,
    };
  }
  if (streak.days >= 2 && dayOffset <= 1) {
    return { title: `🔥 ${streak.days} kunlik seriya!`, body: "Bugun ham 5 daqiqa ajrating — seriyani uzmang.", url: cont ? `/s/${cont.slug}/learn` : "/library" };
  }
  const g = GENERIC[(new Date().getDate() + dayOffset) % GENERIC.length];
  return { ...g, url: "/library" };
}

// Returns { LN } — never the plugin itself from an async function (Capacitor proxies + .then()).
async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return { LN: LocalNotifications };
}

/** Ask for notification permission (Android 13+). Returns true when allowed. */
export async function requestReminderPermission(): Promise<boolean> {
  const { LN } = await plugin();
  let perm = await LN.checkPermissions();
  if (perm.display === "prompt" || perm.display === "prompt-with-rationale") perm = await LN.requestPermissions();
  return perm.display === "granted";
}

/**
 * Save settings and (re)build the schedule. Lesson titles for "continue" nudges come from rememberTitle().
 * Returns "denied" when the learner refused notification permission.
 */
export async function applyReminders(settings: ReminderSettings, extraTitles: Record<string, string> = {}): Promise<"ok" | "denied" | "unsupported"> {
  if (!isNativeApp()) return "unsupported";
  const titles = { ...knownTitles(), ...extraTitles };
  const { LN } = await plugin();
  saveSettings(settings);
  const ids = Array.from({ length: DAYS }, (_, i) => ({ id: BASE_ID + i }));
  await LN.cancel({ notifications: ids }).catch(() => undefined);
  if (!settings.enabled) return "ok";

  if (!(await requestReminderPermission())) {
    saveSettings({ ...settings, enabled: false });
    return "denied";
  }
  await LN.createChannel({
    id: CHANNEL,
    name: "Kunlik eslatmalar",
    description: "Har kuni tanlangan vaqtda dars haqida eslatma",
    importance: 3,
    visibility: 1,
    vibration: true,
  }).catch(() => undefined);

  const now = new Date();
  const studiedToday = currentStreak(getState(), now).today;
  const notifications = [];
  for (let d = 0; d < DAYS; d++) {
    const at = new Date(now);
    at.setDate(now.getDate() + d);
    at.setHours(settings.hour, settings.minute, 0, 0);
    if (at <= now) continue;
    if (d === 0 && studiedToday) continue; // already learned today — no nagging
    const m = message(d, titles);
    notifications.push({
      id: BASE_ID + d,
      title: m.title,
      body: m.body,
      channelId: CHANNEL,
      smallIcon: "ic_stat_bookly",
      iconColor: "#0B5D4B",
      schedule: { at, allowWhileIdle: true },
      extra: { url: m.url },
    });
  }
  if (notifications.length) await LN.schedule({ notifications });
  return "ok";
}

/** Refresh the rolling schedule (on app open and after finishing a lesson). */
export async function refreshReminders(): Promise<void> {
  const s = getReminderSettings();
  if (!s.enabled || !isNativeApp()) return;
  try {
    const { LN } = await plugin();
    const perm = await LN.checkPermissions();
    if (perm.display !== "granted") return;
    await applyReminders(s);
  } catch {
    /* plugin unavailable */
  }
}
