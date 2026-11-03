// Core content model for Bookly. The same shape is used by local demo JSON,
// the Supabase tables, the admin editor and the AI content builder.

export const TOPICS = [
  { id: "self-development", uz: "Shaxsiy rivojlanish", en: "Self-development", emoji: "🌱" },
  { id: "study-habits", uz: "O‘qish odatlari", en: "Study habits", emoji: "📚" },
  { id: "productivity", uz: "Samaradorlik", en: "Productivity", emoji: "⏱️" },
  { id: "communication", uz: "Muloqot", en: "Communication", emoji: "💬" },
  { id: "business", uz: "Biznes", en: "Business", emoji: "📈" },
  { id: "practical", uz: "Amaliy bilimlar", en: "Practical knowledge", emoji: "🧭" },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];

export const LEVELS = [
  { id: "beginner", uz: "Boshlang‘ich", en: "Beginner", cefr: "A1" },
  { id: "elementary", uz: "Elementar", en: "Elementary", cefr: "A2" },
  { id: "intermediate", uz: "O‘rta", en: "Intermediate", cefr: "B1" },
  { id: "upper-intermediate", uz: "O‘rtadan yuqori", en: "Upper-intermediate", cefr: "B2" },
  { id: "advanced", uz: "Yuqori", en: "Advanced", cefr: "C1" },
] as const;

export type Level = (typeof LEVELS)[number]["id"];
export type Lang = "en" | "uz" | "ru";

export interface SummaryMeta {
  id: string;
  slug: string;
  /** Original (usually English) title of the book or demo. */
  title: string;
  /** Uzbek title shown to learners. */
  titleUz: string;
  author: string;
  topic: TopicId;
  durationMin: number;
  level: Level;
  languages: Lang[];
  isFree: boolean;
  isPublished: boolean;
  coverColor: string;
  /** Optional cover artwork (e.g. "/covers/<slug>.webp"). Falls back to the CSS-drawn cover. */
  coverImage?: string | null;
  /** One-line hook in Uzbek. */
  tagline: string;
  /** Short Uzbek introduction: what the learner will get from this summary. */
  intro: string;
  /** "Siz nimani o‘rganasiz" bullet points (Uzbek). */
  learnPoints: string[];
  /** Attribution / permission note shown on the summary page. */
  attribution: string;
  sortOrder: number;
  updatedAt?: string;
  /** Learner ratings (from the summary_rating_stats view). Absent when there are none yet. */
  rating?: RatingSummary;
}

/** Average learner rating for one summary. */
export interface RatingSummary {
  avg: number;
  count: number;
}

/** Full rating breakdown shown on the summary page. `stars[0]` = number of 1★ ratings … `stars[4]` = 5★. */
export interface RatingStats extends RatingSummary {
  stars: [number, number, number, number, number];
  comments: number;
}

/** One learner review (rating 1–5 + optional comment). */
export interface Review {
  id: string;
  summarySlug: string;
  userId: string;
  rating: number;
  comment: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sentence {
  /** Stable id, e.g. "s1-3". Used for progress, AI cache and timing. */
  id: string;
  en: string;
  uz: string;
  /** Russian translation (optional; only lessons with Russian audio have it). */
  ru?: string;
  /** Audio start time in seconds (optional until timed). */
  start?: number;
  /** Audio end time in seconds (optional; defaults to next sentence start). */
  end?: number;
  /** Set by the AI builder when the translation was machine-generated and needs a human check. */
  review?: boolean;
}

export interface Section {
  id: string;
  heading: { en: string; uz: string; ru?: string };
  sentences: Sentence[];
}

export interface VocabItem {
  term: string;
  /** Other surface forms to highlight in the text (habits, built, ...). */
  forms?: string[];
  uz: string;
  /** Simple English definition. */
  definition?: string;
  example: string;
  exampleUz?: string;
}

export interface Question {
  id: string;
  prompt: string;
  promptUz: string;
  options: string[];
  optionsUz?: string[];
  /** Index of the correct option. */
  answer: number;
  explanationUz: string;
}

export interface AudioTrack {
  url: string;
  voice?: string;
  durationSec?: number;
}

/** Narration languages. "en" is the main track (`content.audio` + sentence start/end). */
export type AudioLang = "en" | "uz" | "ru";

/**
 * A narration in another language. Same sentences, its own timings:
 * `timings[sentenceId] = [start, end]` in seconds.
 */
export interface AltAudioTrack extends AudioTrack {
  timings: Record<string, [number, number]>;
}

export interface SummaryContent {
  sections: Section[];
  vocab: VocabItem[];
  questions: Question[];
  takeaway: { en: string; uz: string };
  audio: AudioTrack | null;
  /** Optional Uzbek / Russian narrations of the same lesson (bilingual listening). */
  audioAlt?: Partial<Record<"uz" | "ru", AltAudioTrack>>;
  /** Set by scripts/sync-content.mts: hash of the repository JSON this content came from. */
  sourceHash?: string;
}

export interface Summary extends SummaryMeta {
  /** null when the visitor is not allowed to see the lesson (Premium). */
  content: SummaryContent | null;
  locked: boolean;
}

/** Shape of a summary JSON file (content/summaries/*.json) and of admin import/export. */
export interface SummaryDocument extends Omit<SummaryMeta, "id"> {
  id?: string;
  content: SummaryContent;
}

export type ReadingMode = "bilingual" | "english" | "uzbek";
export type StudyFormat = "both" | "read" | "listen";

export function topicLabel(id: string): string {
  return TOPICS.find((t) => t.id === id)?.uz ?? id;
}

export function levelLabel(id: string): string {
  const l = LEVELS.find((x) => x.id === id);
  return l ? `${l.uz} · ${l.cefr}` : id;
}

export function levelEn(id: string): string {
  return LEVELS.find((x) => x.id === id)?.en ?? id;
}

export const LANG_LABEL: Record<Lang, string> = { en: "EN", uz: "UZ", ru: "RU" };
