"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { attachSync, detachSync } from "@/lib/store";
import { setTrackingUser, track } from "@/lib/track";
import { isNativeApp } from "@/lib/platform";

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
  /** Last native sign-in error (Android app), shown by the login UI. */
  signInError: string | null;
  signOut: (redirectTo?: string) => Promise<void>;
  refreshEntitlements: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowser();
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

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
      track("sign_in", undefined, { provider: "google", native: isNativeApp() });
      setSignInError(null);

      if (isNativeApp()) {
        // Android app: native account picker → ID token → Supabase session (no WebView OAuth).
        const { nativeGoogleSignIn } = await import("@/lib/native/auth");
        const res = await nativeGoogleSignIn(supabase);
        if (!res.ok) {
          if (!res.cancelled) setSignInError(res.error);
          return;
        }
        const { haptic } = await import("@/lib/native/haptics");
        haptic("success");
        // Full navigation so server-rendered pages pick up the new session cookies.
        window.location.assign(safeNext);
        return;
      }

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

  const signOut = useCallback(
    async (redirectTo = "/") => {
      if (!supabase) return;
      await detachSync();
      await supabase.auth.signOut();
      if (isNativeApp()) {
        const [{ nativeGoogleSignOut }, { billingLogOut }] = await Promise.all([import("@/lib/native/auth"), import("@/lib/native/billing")]);
        await Promise.all([nativeGoogleSignOut(), billingLogOut()]);
      }
      window.location.assign(redirectTo);
    },
    [supabase],
  );

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
      signInError,
      signOut,
      refreshEntitlements,
    }),
    [loading, user, profile, isPremium, signInWithGoogle, signInError, signOut, refreshEntitlements],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
