import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getViewer } from "@/lib/supabase/server";

/** Admin pages: real admins when Supabase is on; local development only in demo mode. */
export async function canAccessAdmin(): Promise<{ ok: boolean; reason?: "login" | "forbidden" | "demo-prod" }> {
  if (!isSupabaseConfigured) return process.env.NODE_ENV === "production" ? { ok: false, reason: "demo-prod" } : { ok: true };
  const viewer = await getViewer();
  if (!viewer.userId) return { ok: false, reason: "login" };
  return viewer.isAdmin ? { ok: true } : { ok: false, reason: "forbidden" };
}
