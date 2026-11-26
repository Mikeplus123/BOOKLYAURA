import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isBillingConfigured, syncRevenueCatSubscriber } from "@/lib/billing-server";

export const runtime = "nodejs";

// RevenueCat webhook (Project settings → Integrations → Webhooks). Set the Authorization header value
// to REVENUECAT_WEBHOOK_AUTH. The body only tells us *who* changed; the state is re-read from the API.
function authorized(req: NextRequest): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  const got = req.headers.get("authorization") ?? "";
  if (!expected) return false;
  const a = Buffer.from(got.replace(/^Bearer\s+/i, ""));
  const b = Buffer.from(expected.replace(/^Bearer\s+/i, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isBillingConfigured) return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { event?: { type?: string; app_user_id?: string; aliases?: string[]; transferred_to?: string[]; transferred_from?: string[] } } | null;
  const event = body?.event;
  if (!event) return NextResponse.json({ ok: true });

  // Every id the event touches (TRANSFER moves a purchase between accounts).
  const ids = new Set([event.app_user_id, ...(event.aliases ?? []), ...(event.transferred_to ?? []), ...(event.transferred_from ?? [])].filter((x): x is string => Boolean(x)));
  try {
    for (const id of ids) await syncRevenueCatSubscriber(id);
  } catch (e) {
    console.error("[billing/webhook]", event.type, e);
    // 5xx → RevenueCat retries with backoff.
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
