// Pure helpers shared by the reader, admin tools and tests. No React, no I/O.
import type { Section, Sentence, SummaryContent, VocabItem } from "./types";

export interface FlatSentence extends Sentence {
  index: number;
  sectionIndex: number;
}

export function flattenSentences(sections: Section[]): FlatSentence[] {
  const out: FlatSentence[] = [];
  sections.forEach((section, sectionIndex) => {
    for (const s of section.sentences) out.push({ ...s, index: out.length, sectionIndex });
  });
  return out;
}

/** True when every sentence has a numeric start time in ascending order. */
export function hasTimings(sentences: Sentence[]): boolean {
  if (sentences.length === 0) return false;
  let prev = -Infinity;
  for (const s of sentences) {
    if (typeof s.start !== "number" || !Number.isFinite(s.start) || s.start < prev) return false;
    prev = s.start;
  }
  return true;
}

/** End time of sentence i: explicit end, else next start, else track duration. */
export function sentenceEnd(sentences: Sentence[], i: number, duration: number): number {
  const s = sentences[i];
  if (!s) return duration;
  if (typeof s.end === "number" && Number.isFinite(s.end) && s.end > (s.start ?? 0)) return s.end;
  const next = sentences[i + 1];
  if (next && typeof next.start === "number") return next.start;
  return Number.isFinite(duration) && duration > 0 ? duration : (s.start ?? 0) + 6;
}

/**
 * Index of the sentence playing at time t (binary search on start times).
 * Returns 0 before the first sentence and the last index after the last one.
 */
export function sentenceAtTime(sentences: Sentence[], t: number): number {
  if (sentences.length === 0) return -1;
  let lo = 0;
  let hi = sentences.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = sentences[mid].start ?? 0;
    if (start <= t + 0.05) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export function wordCount(text: string): number {
  const m = text.trim().match(/[\p{L}\p{N}’'‘-]+/gu);
  return m ? m.length : 0;
}

/** Estimated narration seconds for a sentence (≈150 wpm at 1×), used when there is no audio file. */
export function estimateSeconds(text: string, rate = 1): number {
  const words = Math.max(1, wordCount(text));
  return (words / 150) * 60 / rate + 0.35;
}

export function estimateTotalMinutes(sentences: Sentence[]): number {
  const secs = sentences.reduce((acc, s) => acc + estimateSeconds(s.en), 0);
  return Math.max(1, Math.round(secs / 60));
}

export interface Token {
  text: string;
  /** Index into the vocab array when this token is a supported vocabulary word. */
  vocab?: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split an English sentence into plain text and vocabulary tokens.
 * Matches each vocab term (and its listed forms) case-insensitively on word boundaries;
 * longer phrases win over shorter ones, and matches never overlap.
 */
export function tokenize(text: string, vocab: VocabItem[]): Token[] {
  if (!vocab.length || !text) return [{ text }];
  const patterns: { re: string; idx: number; len: number }[] = [];
  vocab.forEach((v, idx) => {
    const forms = new Set([v.term, ...(v.forms ?? [])].map((f) => f.trim()).filter(Boolean));
    for (const f of forms) patterns.push({ re: escapeRegex(f), idx, len: f.length });
  });
  if (!patterns.length) return [{ text }];
  patterns.sort((a, b) => b.len - a.len);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${patterns.map((p) => p.re).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  const lookup = new Map<string, number>();
  for (const p of patterns) {
    const key = p.re.toLowerCase();
    if (!lookup.has(key)) lookup.set(key, p.idx);
  }

  const tokens: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) tokens.push({ text: text.slice(last, start) });
    const idx = lookup.get(escapeRegex(m[0]).toLowerCase());
    tokens.push(idx === undefined ? { text: m[0] } : { text: m[0], vocab: idx });
    last = start + m[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last) });
  return tokens.length ? tokens : [{ text }];
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

/** Checks a lesson before publishing. Errors block saving; warnings are shown to the editor. */
export function validateContent(content: SummaryContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const flat = flattenSentences(content.sections);
  if (!content.sections.length) issues.push({ level: "error", message: "Kamida bitta bo‘lim kerak." });
  if (!flat.length) issues.push({ level: "error", message: "Kamida bitta jumla kerak." });

  const ids = new Set<string>();
  flat.forEach((s, i) => {
    if (!s.id) issues.push({ level: "error", message: `Jumla #${i + 1}: id yo‘q.` });
    else if (ids.has(s.id)) issues.push({ level: "error", message: `Jumla id takrorlangan: ${s.id}` });
    ids.add(s.id);
    if (!s.en.trim()) issues.push({ level: "error", message: `Jumla #${i + 1}: inglizcha matn bo‘sh.` });
    if (!s.uz.trim()) issues.push({ level: "warning", message: `Jumla #${i + 1}: o‘zbekcha tarjima yo‘q.` });
  });

  if (content.audio?.url) {
    const timed = flat.filter((s) => typeof s.start === "number").length;
    if (timed === 0) issues.push({ level: "warning", message: "Audio bor, lekin jumlalar vaqtga bog‘lanmagan (sinxronlash kerak)." });
    else if (timed < flat.length) issues.push({ level: "warning", message: `${flat.length - timed} ta jumlaning boshlanish vaqti yo‘q.` });
    else if (!hasTimings(flat)) issues.push({ level: "error", message: "Jumla vaqtlari o‘sish tartibida emas." });
  }

  content.questions.forEach((q, i) => {
    if (q.options.length < 2) issues.push({ level: "error", message: `Savol ${i + 1}: kamida 2 ta variant kerak.` });
    if (q.answer < 0 || q.answer >= q.options.length) issues.push({ level: "error", message: `Savol ${i + 1}: to‘g‘ri javob indeksi noto‘g‘ri.` });
    if (q.optionsUz && q.optionsUz.length !== q.options.length) issues.push({ level: "warning", message: `Savol ${i + 1}: o‘zbekcha variantlar soni mos emas.` });
  });
  if (content.questions.length && content.questions.length !== 3)
    issues.push({ level: "warning", message: `Tavsiya: 3 ta savol (hozir ${content.questions.length}).` });
  content.vocab.forEach((v, i) => {
    if (!v.term.trim() || !v.uz.trim()) issues.push({ level: "error", message: `Lug‘at ${i + 1}: so‘z va tarjima kerak.` });
  });
  return issues;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[‘’ʻʼ']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
