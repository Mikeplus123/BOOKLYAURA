import "server-only";
import { cache } from "react";
import { LOCAL_SUMMARIES } from "@/content/summaries";
import { getSupabaseServer, getViewer, type Viewer } from "@/lib/supabase/server";
import type { RatingStats, Summary, SummaryContent, SummaryDocument, SummaryMeta } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToMeta(row: any): SummaryMeta {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleUz: row.title_uz ?? "",
    author: row.author,
    topic: row.topic,
    durationMin: row.duration_min,
    level: row.level,
    languages: row.languages ?? ["en", "uz"],
    isFree: !!row.is_free,
    isPublished: !!row.is_published,
    coverColor: row.cover_color ?? "#0B5D4B",
    coverImage: row.cover_image ?? null,
    tagline: row.tagline ?? "",
    intro: row.intro ?? "",
    learnPoints: Array.isArray(row.learn_points) ? row.learn_points : [],
    attribution: row.attribution ?? "",
    sortOrder: row.sort_order ?? 100,
    updatedAt: row.updated_at,
  };
}

export function metaToRow(meta: Omit<SummaryMeta, "id" | "updatedAt">) {
  return {
    slug: meta.slug,
    title: meta.title,
    title_uz: meta.titleUz,
    author: meta.author,
    topic: meta.topic,
    duration_min: meta.durationMin,
    level: meta.level,
    languages: meta.languages,
    is_free: meta.isFree,
    is_published: meta.isPublished,
    cover_color: meta.coverColor,
    cover_image: meta.coverImage || null,
    tagline: meta.tagline,
    intro: meta.intro,
    learn_points: meta.learnPoints,
    attribution: meta.attribution,
    sort_order: meta.sortOrder,
  };
}

function docToMeta(doc: SummaryDocument): SummaryMeta {
  const { content: _content, ...meta } = doc;
  return { ...meta, id: doc.id ?? `local-${doc.slug}` };
}

/** Rating stats row (summary_rating_stats view) → RatingStats. */
export function rowToRatingStats(row: any): RatingStats {
  return {
    avg: Number(row.avg_rating) || 0,
    count: row.review_count ?? 0,
    stars: [row.stars_1 ?? 0, row.stars_2 ?? 0, row.stars_3 ?? 0, row.stars_4 ?? 0, row.stars_5 ?? 0],
    comments: row.comment_count ?? 0,
  };
}

/** Ratings for all summaries, keyed by slug. Empty when Supabase or the reviews migration is missing. */
const getRatings = cache(async (): Promise<Map<string, RatingStats>> => {
  const out = new Map<string, RatingStats>();
  const supabase = await getSupabaseServer();
  if (!supabase) return out;
  const { data, error } = await supabase.from("summary_rating_stats").select("*");
  if (error) {
    console.warn("[bookly] Ratings unavailable (run supabase/migrations/0003_reviews_and_covers.sql):", error.message);
    return out;
  }
  for (const row of data ?? []) out.set(row.summary_slug, rowToRatingStats(row));
  return out;
});

/** Rating breakdown for one summary (null when it has no ratings yet). */
export async function getRatingStats(slug: string): Promise<RatingStats | null> {
  return (await getRatings()).get(slug) ?? null;
}

const withRating = (meta: SummaryMeta, ratings: Map<string, RatingStats>): SummaryMeta => {
  const r = ratings.get(meta.slug);
  return r && r.count > 0 ? { ...meta, rating: { avg: r.avg, count: r.count } } : meta;
};

const bySort = (a: SummaryMeta, b: SummaryMeta) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);

/** Published catalogue (metadata only). Cached per request. */
export const getCatalog = cache(async (): Promise<SummaryMeta[]> => {
  const supabase = await getSupabaseServer();
  if (supabase) {
    const { data, error } = await supabase
      .from("summaries")
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    if (!error && data) {
      const ratings = await getRatings();
      return data.map((row) => withRating(rowToMeta(row), ratings));
    }
    console.warn("[bookly] Could not load catalogue from Supabase, using local demo content:", error?.message);
  }
  return LOCAL_SUMMARIES.filter((d) => d.isPublished).map(docToMeta).sort(bySort);
});

/**
 * One summary, with its lesson content only if the viewer may access it.
 * Premium gating is enforced by Supabase RLS; demo mode mirrors the same rule.
 */
export const getSummary = cache(async (slug: string): Promise<{ summary: Summary | null; viewer: Viewer }> => {
  const viewer = await getViewer();
  const supabase = await getSupabaseServer();

  if (supabase) {
    const { data: row, error } = await supabase.from("summaries").select("*").eq("slug", slug).maybeSingle();
    if (!error) {
      if (!row) return { summary: null, viewer };
      const meta = rowToMeta(row);
      const { data: c } = await supabase.from("summary_content").select("content").eq("summary_id", meta.id).maybeSingle();
      const content = (c?.content as SummaryContent | undefined) ?? null;
      return { summary: { ...meta, content, locked: content === null && !meta.isFree }, viewer };
    }
    console.warn("[bookly] Could not load summary from Supabase, using local demo content:", error.message);
  }

  const doc = LOCAL_SUMMARIES.find((d) => d.slug === slug && d.isPublished);
  if (!doc) return { summary: null, viewer };
  const allowed = doc.isFree || viewer.isPremium || viewer.isAdmin;
  return { summary: { ...docToMeta(doc), content: allowed ? doc.content : null, locked: !allowed }, viewer };
});

/** Related summaries for "what next" suggestions. */
export async function getNextSuggestions(current: SummaryMeta, limit = 3): Promise<SummaryMeta[]> {
  const all = await getCatalog();
  const others = all.filter((s) => s.slug !== current.slug);
  const sameTopic = others.filter((s) => s.topic === current.topic);
  const rest = others.filter((s) => s.topic !== current.topic);
  return [...sameTopic, ...rest].slice(0, limit);
}
