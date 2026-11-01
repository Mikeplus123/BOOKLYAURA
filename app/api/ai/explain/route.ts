import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { AIError, explainSentence, isAIConfigured, type Explanation } from "@/lib/ai";
import { getSummary } from "@/lib/content";
import { flattenSentences } from "@/lib/text";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

const Body = z.object({ slug: z.string().min(1).max(120), sentenceId: z.string().min(1).max(64) });

// Demo mode (no Supabase): small in-memory limit per IP so a public preview can't be abused.
const demoHits = new Map<string, { day: string; count: number }>();
function demoAllowed(ip: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const rec = demoHits.get(ip);
  if (!rec || rec.day !== day) {
    demoHits.set(ip, { day, count: 1 });
    return true;
  }
  if (rec.count >= 15) return false;
  rec.count++;
  return true;
}

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Noto‘g‘ri so‘rov.", 400);
  const { slug, sentenceId } = parsed.data;

  // Content gating applies: you can only ask about lessons you can open.
  const { summary, viewer } = await getSummary(slug);
  if (!summary) return fail("Dars topilmadi.", 404);
  if (!summary.content) return fail("Bu dars Premium a’zolar uchun.", 403);

  const sentences = flattenSentences(summary.content.sections);
  const i = sentences.findIndex((s) => s.id === sentenceId);
  if (i < 0) return fail("Jumla topilmadi.", 404);
  const sentence = sentences[i];

  if (isSupabaseConfigured && !viewer.userId) return fail("AI yordamchidan foydalanish uchun hisobingizga kiring.", 401);

  const hash = createHash("sha256").update(`${sentence.en}\n${sentence.uz}`).digest("hex").slice(0, 16);
  const admin = getSupabaseAdmin();

  // Cached explanations are free and instant.
  if (admin) {
    const { data } = await admin
      .from("ai_explanations")
      .select("explanation")
      .eq("summary_slug", slug)
      .eq("sentence_id", sentenceId)
      .eq("content_hash", hash)
      .maybeSingle();
    if (data?.explanation) return NextResponse.json({ explanation: data.explanation as Explanation, cached: true });
  }

  if (!isAIConfigured) return fail("AI yordamchi hali sozlanmagan (ANTHROPIC_API_KEY).", 503);

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseServer();
    const { data: allowed, error } = await supabase!.rpc("consume_ai_quota");
    if (error) return fail("Limitni tekshirib bo‘lmadi.", 500);
    if (!allowed)
      return fail(
        viewer.isPremium
          ? "Bugungi AI limitingiz tugadi. Ertaga yana foydalanishingiz mumkin."
          : "Bugungi bepul AI limitingiz tugadi. Premium bilan ko‘proq foydalanish mumkin.",
        429,
      );
  } else {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!demoAllowed(ip)) return fail("Bugungi demo limiti tugadi.", 429);
  }

  try {
    const explanation = await explainSentence({
      sentence,
      previous: sentences[i - 1]?.en,
      next: sentences[i + 1]?.en,
      title: summary.title,
      level: summary.level,
    });
    if (admin) {
      await admin
        .from("ai_explanations")
        .upsert({ summary_slug: slug, sentence_id: sentenceId, content_hash: hash, explanation });
    }
    return NextResponse.json({ explanation, cached: false });
  } catch (err) {
    const e = err instanceof AIError ? err : new AIError("AI bilan bog‘lanib bo‘lmadi.");
    return fail(e.message, e.status);
  }
}
