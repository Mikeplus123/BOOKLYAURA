import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { canAccessAdmin } from "@/lib/admin-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Moderators act on reports: hide the review, clear a cached AI explanation (so it is regenerated),
// or dismiss the report. The report is closed with a short resolution note.
const Body = z.object({
  id: z.string().uuid(),
  action: z.enum(["hide_review", "clear_ai", "dismiss"]),
});

export async function POST(req: NextRequest) {
  const access = await canAccessAdmin();
  if (!access.ok) return NextResponse.json({ error: "Ruxsat yo‘q." }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Noto‘g‘ri so‘rov." }, { status: 400 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY sozlanmagan." }, { status: 503 });

  const { id, action } = parsed.data;
  const { data: report } = await admin.from("content_reports").select("*").eq("id", id).maybeSingle();
  if (!report) return NextResponse.json({ error: "Shikoyat topilmadi." }, { status: 404 });

  let resolution = "dismissed";
  if (action === "hide_review") {
    if (report.target_type !== "review") return NextResponse.json({ error: "Bu sharh emas." }, { status: 400 });
    const { error } = await admin.from("summary_reviews").update({ is_hidden: true }).eq("id", report.target_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    resolution = "review_hidden";
  } else if (action === "clear_ai") {
    if (report.target_type !== "ai_explanation") return NextResponse.json({ error: "Bu AI tushuntirish emas." }, { status: 400 });
    const [slug, sentenceId] = String(report.target_id).split(":");
    const { error } = await admin.from("ai_explanations").delete().eq("summary_slug", slug).eq("sentence_id", sentenceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    resolution = "ai_cache_cleared";
  }

  // Close every open report about the same item.
  const status = action === "dismiss" ? "dismissed" : "resolved";
  const { error } = await admin
    .from("content_reports")
    .update({ status, resolution, resolved_at: new Date().toISOString() })
    .eq("target_type", report.target_type)
    .eq("target_id", report.target_id)
    .eq("status", "open");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
