import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/** Per-request server client bound to the visitor's auth cookies (RLS applies). */
export async function getSupabaseServer(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there. The proxy refreshes sessions.
        }
      },
    },
  });
}

/** Service-role client (bypasses RLS). Server-only; returns null when the key is not configured. */
export function getSupabaseAdmin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface Viewer {
  userId: string | null;
  email: string | null;
  isPremium: boolean;
  isAdmin: boolean;
}

/** Who is making this request, plus their entitlements. Safe to call in demo mode. */
export async function getViewer(): Promise<Viewer> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { userId: null, email: null, isPremium: false, isAdmin: false };
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { userId: null, email: null, isPremium: false, isAdmin: false };
  const [premium, admin] = await Promise.all([supabase.rpc("is_premium"), supabase.rpc("is_admin")]);
  return { userId: user.id, email: user.email ?? null, isPremium: premium.data === true, isAdmin: admin.data === true };
}
