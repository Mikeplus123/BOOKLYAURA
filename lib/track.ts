"use client";
// Minimal product analytics for the MVP success metrics (completion, repeat use,
// comprehension, premium interest). Writes to the `events` table when Supabase is configured.
import { getSupabaseBrowser } from "./supabase/client";
import { getState } from "./store";

export type EventName =
  | "summary_view"
  | "session_start"
  | "summary_complete"
  | "practice_complete"
  | "mode_change"
  | "ai_explain"
  | "premium_view"
  | "premium_interest"
  | "sign_in"
  | "waitlist_join";

let currentUserId: string | null = null;
export function setTrackingUser(id: string | null) {
  currentUserId = id;
}

export function track(name: EventName, summarySlug?: string, props: Record<string, unknown> = {}) {
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    if (process.env.NODE_ENV === "development") console.debug("[track]", name, summarySlug ?? "", props);
    return;
  }
  void supabase
    .from("events")
    .insert({ name, summary_slug: summarySlug ?? null, props, user_id: currentUserId, anon_id: getState().anonId })
    .then(({ error }) => {
      if (error && process.env.NODE_ENV === "development") console.warn("[track] failed", error.message);
    });
}
