"use client";
// Native Google Sign-In for the Android app.
//
// Google blocks its OAuth pages inside embedded WebViews ("disallowed_useragent"), so the app
// can't use the web redirect flow. Instead the native Credential Manager sheet returns a Google
// ID token, which we hand to Supabase (signInWithIdToken). Supabase then sets the same session
// cookies the website uses, so server-rendered pages see the user as signed in.
//
// Setup (once): Google Cloud → Credentials → create an "Android" OAuth client with the app's
// package name + SHA-1 of the Play app-signing key, and use the existing *Web* client ID here
// (NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID) — it is the audience Supabase verifies.
import type { SupabaseClient } from "@supabase/supabase-js";

const WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

let initialized: Promise<void> | null = null;
// Returns { SocialLogin } — never the plugin itself from an async function (Capacitor proxies + .then()).
async function plugin() {
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  initialized ??= SocialLogin.initialize({ google: { webClientId: WEB_CLIENT_ID } });
  await initialized;
  return { SocialLogin };
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type NativeSignInResult = { ok: true } | { ok: false; cancelled?: boolean; error: string };

export async function nativeGoogleSignIn(supabase: SupabaseClient): Promise<NativeSignInResult> {
  if (!WEB_CLIENT_ID) return { ok: false, error: "Google kirish sozlanmagan (NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID)." };
  try {
    const { SocialLogin } = await plugin();
    // Google gets the hashed nonce; Supabase gets the raw one and checks they match.
    const rawNonce = randomNonce();
    const res = await SocialLogin.login({
      provider: "google",
      // No `scopes`: email + profile are the default, and custom scopes need a modified MainActivity.
      options: { nonce: await sha256Hex(rawNonce), style: "bottom", filterByAuthorizedAccounts: false },
    });
    const idToken = res.result && "idToken" in res.result ? res.result.idToken : null;
    if (!idToken) return { ok: false, error: "Google hisobidan token olinmadi." };
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce: rawNonce });
    if (error) return { ok: false, error: "Kirishda xatolik: " + error.message };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(msg)) return { ok: false, cancelled: true, error: "Bekor qilindi." };
    return { ok: false, error: "Google orqali kirib bo‘lmadi. Qayta urinib ko‘ring." };
  }
}

/** Forget the Google account choice on this device (next sign-in shows the account picker). */
export async function nativeGoogleSignOut(): Promise<void> {
  try {
    const { SocialLogin } = await plugin();
    await SocialLogin.logout({ provider: "google" });
  } catch {
    /* not signed in natively */
  }
}
