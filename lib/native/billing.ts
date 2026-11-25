"use client";
// Google Play Billing through RevenueCat (Android app only).
//
// Google Play requires digital subscriptions sold inside the app to use Play Billing. RevenueCat wraps
// it: the app buys the "premium" entitlement, RevenueCat validates the Play receipt and calls our
// webhook, which writes public.subscriptions. is_premium() then unlocks content on every device,
// including the website.
//
// Setup: RevenueCat project → Google Play app → entitlement "premium" → an offering with a monthly
// package. Put the *public* Android SDK key in NEXT_PUBLIC_REVENUECAT_ANDROID_KEY.
import { ANDROID_APP_ID, isNativeApp } from "@/lib/platform";

const API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";
export const ENTITLEMENT = process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT || "premium";

/** True in the Android app when RevenueCat is configured. */
export function billingAvailable(): boolean {
  return Boolean(API_KEY) && isNativeApp();
}

type PurchasesModule = typeof import("@revenuecat/purchases-capacitor");
// Holds { P } — never resolve a promise with the plugin itself (Capacitor proxies + .then()).
let configured: Promise<{ P: PurchasesModule["Purchases"] }> | null = null;
let currentUser: string | null = null;

async function purchases(userId?: string | null) {
  configured ??= (async () => {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({ apiKey: API_KEY, appUserID: userId ?? undefined });
    currentUser = userId ?? null;
    return { P: Purchases };
  })();
  const { P } = await configured;
  if (userId && userId !== currentUser) {
    await P.logIn({ appUserID: userId });
    currentUser = userId;
  }
  return { P };
}

/** Link purchases to the Bookly account (Supabase user id) so Premium follows the account. */
export async function billingLogIn(userId: string): Promise<void> {
  if (!billingAvailable()) return;
  try {
    await purchases(userId);
  } catch {
    /* store unavailable (e.g. emulator without Play) */
  }
}

export async function billingLogOut(): Promise<void> {
  if (!billingAvailable() || !configured || !currentUser) return;
  try {
    const { P } = await configured;
    await P.logOut();
    currentUser = null;
  } catch {
    /* already anonymous */
  }
}

export interface PremiumOffer {
  priceString: string;
  period: string | null;
  productId: string;
  hasTrial: boolean;
}

/** The current offering's monthly (or first) package, with the localized Play price. */
export async function getPremiumOffer(userId: string): Promise<PremiumOffer | null> {
  if (!billingAvailable()) return null;
  try {
    const { P } = await purchases(userId);
    const { current } = await P.getOfferings();
    const pkg = current?.monthly ?? current?.availablePackages[0];
    if (!pkg) return null;
    const p = pkg.product;
    return {
      priceString: p.priceString,
      period: p.subscriptionPeriod ?? null,
      productId: p.identifier,
      hasTrial: Boolean(p.introPrice && p.introPrice.price === 0) || Boolean(p.defaultOption?.freePhase),
    };
  } catch {
    return null;
  }
}

export type PurchaseResult = { ok: true } | { ok: false; cancelled?: boolean; error: string };

async function syncServer(): Promise<void> {
  // Ask the server to read the subscription from RevenueCat right away (the webhook may lag a few seconds).
  await fetch("/api/billing/sync", { method: "POST" }).catch(() => undefined);
}

export async function buyPremium(userId: string): Promise<PurchaseResult> {
  try {
    const { P } = await purchases(userId);
    const { current } = await P.getOfferings();
    const pkg = current?.monthly ?? current?.availablePackages[0];
    if (!pkg) return { ok: false, error: "Obuna hozircha mavjud emas." };
    const { customerInfo } = await P.purchasePackage({ aPackage: pkg });
    if (!customerInfo.entitlements.active[ENTITLEMENT]) return { ok: false, error: "To‘lov tasdiqlanmadi. Birozdan keyin “Xaridlarni tiklash”ni bosing." };
    await syncServer();
    return { ok: true };
  } catch (e) {
    const err = e as { code?: string | number; userCancelled?: boolean; message?: string };
    if (err?.userCancelled || String(err?.code) === "1" || /cancel/i.test(err?.message ?? "")) return { ok: false, cancelled: true, error: "Bekor qilindi." };
    return { ok: false, error: "To‘lovni amalga oshirib bo‘lmadi. Qayta urinib ko‘ring." };
  }
}

export async function restorePurchases(userId: string): Promise<{ premium: boolean }> {
  const { P } = await purchases(userId);
  const { customerInfo } = await P.restorePurchases();
  await syncServer();
  return { premium: Boolean(customerInfo.entitlements.active[ENTITLEMENT]) };
}

/** Google Play's subscription management page for this app. */
export function manageSubscriptionsUrl(productId?: string): string {
  const q = new URLSearchParams({ package: ANDROID_APP_ID });
  if (productId) q.set("sku", productId);
  return `https://play.google.com/store/account/subscriptions?${q}`;
}
