import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

// Learners (signed in or not) flag a review or an AI explanation. Required by Google Play's
// user-generated-content and AI-generated-content policies.
const Body = z.object({
  targetType: z.enum(["review", "ai_explanation"]),
  targetId: z.string().min(1).max(200),
  summarySlug: z.string().max(120).optional(),
  reason: z.enum(["spam", "offensive", "harassment", "wrong", "copyright", "other"]),
  details: z.string().max(1000).optional(),
  snapshot: z.string().max(4000).optional(),
});

// Guests: a small in-memory allowance per IP so the endpoint can't be used to flood the queue.
const guestHits = new Map<string, { day: string; count: number }>();
function guestAllowed(ip: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const rec = guestHits.get(ip);
  if (!rec || rec.day !== day) {
    guestHits.set(ip, { day, count: 1 });
    return true;
  }
  if (rec.count >= 10) return false;
  rec.count++;
  return true;
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Noto‘g‘ri so‘rov.", 400);
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true, demo: true });

  const b = parsed.data;
  const row = {
    target_type: b.targetType,
    target_id: b.targetId,
    summary_slug: b.summarySlug ?? null,
    reason: b.reason,
    details: b.details?.trim() || null,
    snapshot: b.snapshot ?? null,
  };

  const supabase = await getSupabaseServer();
  const { data } = await supabase!.auth.getUser();

  if (data.user) {
    // Signed in: insert as the learner (RLS checks reporter_id = auth.uid()). Duplicate = already reported.
    const { error } = await supabase!.from("content_reports").insert(row);
    if (error && error.code !== "23505") return fail("Shikoyatni yuborib bo‘lmadi.", 500);
    return NextResponse.json({ ok: true });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!guestAllowed(ip)) return fail("Bugun juda ko‘p shikoyat yuborildi. Ertaga qayta urinib ko‘ring.", 429);
  const admin = getSupabaseAdmin();
  if (!admin) return fail("Shikoyat yuborish uchun hisobingizga kiring.", 401);
  const { error } = await admin.from("content_reports").insert({ ...row, reporter_id: null });
  if (error) return fail("Shikoyatni yuborib bo‘lmadi.", 500);
  return NextResponse.json({ ok: true });
}
