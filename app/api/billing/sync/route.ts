import { NextResponse } from "next/server";
import { isBillingConfigured, syncRevenueCatSubscriber } from "@/lib/billing-server";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Called by the app right after a purchase / restore, so Premium unlocks without waiting for the webhook.
export async function POST() {
  if (!isBillingConfigured) return NextResponse.json({ error: "Billing sozlanmagan." }, { status: 503 });
  const supabase = await getSupabaseServer();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!data.user) return NextResponse.json({ error: "Avval hisobingizga kiring." }, { status: 401 });
  try {
    return NextResponse.json(await syncRevenueCatSubscriber(data.user.id));
  } catch (e) {
    console.error("[billing/sync]", e);
    return NextResponse.json({ error: "Obunani tekshirib bo‘lmadi." }, { status: 502 });
  }
}
