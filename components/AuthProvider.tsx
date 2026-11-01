"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { attachSync, detachSync } from "@/lib/store";
import { setTrackingUser, track } from "@/lib/track";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
}

interface AuthValue {
  /** false in demo mode (no Supabase env vars). */
  enabled: boolean;
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  isPremium: boolean;
  isAdmin: boolean;
  signInWithGoogle: (next?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowser();
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const loadEntitlements = useCallback(
    async (u: User | null) => {
      if (!supabase || !u) {
        setProfile(null);
        setIsPremium(false);
        return;
      }
      const [p, prem] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url, role").eq("id", u.id).maybeSingle(),
        supabase.rpc("is_premium"),
      ]);
      setProfile((p.data as Profile | null) ?? null);
      setIsPremium(prem.data === true);
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      setUser(data.user);
      setTrackingUser(data.user?.id ?? null);
      await loadEntitlements(data.user);
      if (active) setLoading(false);
      if (data.user) void attachSync(supabase, data.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setTrackingUser(u?.id ?? null);
      if (event === "SIGNED_IN" && u) {
        void loadEntitlements(u);
        void attachSync(supabase, u.id);
      }
      if (event === "SIGNED_OUT") {
        void loadEntitlements(null);
        void detachSync();
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadEntitlements]);

  const signInWithGoogle = useCallback(
    async (next = "/me") => {
      if (!supabase) return;
      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/me";
      track("sign_in", undefined, { provider: "google" });
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
          queryParams: { prompt: "select_account" },
        },
      });
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await detachSync();
    await supabase.auth.signOut();
    window.location.assign("/");
  }, [supabase]);

  const refreshEntitlements = useCallback(() => loadEntitlements(user), [loadEntitlements, user]);

  const value = useMemo<AuthValue>(
    () => ({
      enabled: isSupabaseConfigured,
      loading,
      user,
      profile,
      isPremium,
      isAdmin: profile?.role === "admin",
      signInWithGoogle,
      signOut,
      refreshEntitlements,
    }),
    [loading, user, profile, isPremium, signInWithGoogle, signOut, refreshEntitlements],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
