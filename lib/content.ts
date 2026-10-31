import "server-only";
import { cache } from "react";
import { LOCAL_SUMMARIES } from "@/content/summaries";
import { getSupabaseServer, getViewer, type Viewer } from "@/lib/supabase/server";
import type { Summary, SummaryContent, SummaryDocument, SummaryMeta } from "@/lib/types";

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
    if (!error && data) return data.map(rowToMeta);
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
