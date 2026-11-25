import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Google Play subscriptions via RevenueCat → public.subscriptions (read by is_premium()).
// We always re-read the subscriber from RevenueCat's REST API instead of trusting webhook bodies,
// so a forged or out-of-order webhook can't grant Premium.
//
// Env: REVENUECAT_SECRET_KEY (secret API key, "sk_…"), REVENUECAT_WEBHOOK_AUTH (any long random string,
// also entered as the webhook's Authorization header in RevenueCat), NEXT_PUBLIC_REVENUECAT_ENTITLEMENT.

const ENTITLEMENT = process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT || "premium";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isBillingConfigured = Boolean(process.env.REVENUECAT_SECRET_KEY);

interface RcSubscription {
  expires_date: string | null;
  purchase_date: string;
  period_type: "normal" | "trial" | "intro" | "prepaid";
  store: string;
  unsubscribe_detected_at: string | null;
  billing_issues_detected_at: string | null;
  refunded_at?: string | null;
  grace_period_expires_date?: string | null;
}

interface RcSubscriber {
  entitlements: Record<string, { expires_date: string | null; product_identifier: string }>;
  subscriptions: Record<string, RcSubscription>;
}

type Status = "trialing" | "active" | "past_due" | "canceled" | "expired";

function statusOf(sub: RcSubscription, now: number): Status {
  if (sub.refunded_at) return "canceled";
  const end = sub.expires_date ? Date.parse(sub.expires_date) : Infinity;
  const grace = sub.grace_period_expires_date ? Date.parse(sub.grace_period_expires_date) : 0;
  if (end > now) return sub.period_type === "trial" ? "trialing" : "active";
  // Google's billing grace period: keep access while the payment is retried.
  if (grace > now) return "active";
  if (sub.billing_issues_detected_at) return "past_due";
  return "expired";
}

/** Fetch the subscriber from RevenueCat and upsert their subscription rows. Returns whether they're Premium. */
export async function syncRevenueCatSubscriber(appUserId: string): Promise<{ premium: boolean }> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  const admin = getSupabaseAdmin();
  if (!key || !admin) throw new Error("billing_not_configured");
  // App user ids are Supabase user ids (Purchases.logIn). Ignore anonymous RevenueCat ids.
  if (!UUID.test(appUserId)) return { premium: false };

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`revenuecat_${res.status}`);
  const { subscriber } = (await res.json()) as { subscriber: RcSubscriber };

  const ent = subscriber.entitlements?.[ENTITLEMENT];
  const productIds = new Set(Object.keys(subscriber.subscriptions ?? {}));
  if (ent?.product_identifier) productIds.add(ent.product_identifier);

  const now = Date.now();
  const rows = [...productIds]
    .filter((id) => subscriber.subscriptions[id]?.store === "play_store")
    .map((productId) => {
      const sub = subscriber.subscriptions[productId];
      return {
        user_id: appUserId,
        plan: productId,
        status: statusOf(sub, now),
        provider: "google_play",
        provider_ref: `rc:${appUserId}:${productId}`,
        current_period_end: sub.grace_period_expires_date && Date.parse(sub.grace_period_expires_date) > now ? sub.grace_period_expires_date : sub.expires_date,
        cancel_at_period_end: Boolean(sub.unsubscribe_detected_at),
      };
    });

  if (rows.length) {
    const { error } = await admin.from("subscriptions").upsert(rows, { onConflict: "provider,provider_ref" });
    if (error) throw new Error(`subscriptions_upsert: ${error.message}`);
  }
  const premium = Boolean(ent && (!ent.expires_date || Date.parse(ent.expires_date) > now));
  return { premium };
}
