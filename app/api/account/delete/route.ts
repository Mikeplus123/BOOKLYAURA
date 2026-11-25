import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Permanently deletes the signed-in learner's account and data (Google Play "account deletion" requirement).
// Tables that reference auth.users with `on delete cascade` (profiles, progress, library, practice,
// reviews, AI usage, premium interest, subscriptions) are removed by deleting the auth user.
// Analytics events and the waitlist entry are removed explicitly.
const Body = z.object({ confirm: z.literal("DELETE") });

export async function POST(req: NextRequest) {
  if (!Body.safeParse(await req.json().catch(() => null)).success) {
    return NextResponse.json({ error: "Tasdiqlash talab qilinadi." }, { status: 400 });
  }
  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Demo rejimda hisob yo‘q." }, { status: 400 });
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Avval hisobingizga kiring." }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Hisobni o‘chirish hozir ishlamayapti. Iltimos, qo‘llab-quvvatlash xizmatiga yozing." }, { status: 503 });
  }

  const cleanup = await Promise.all([
    admin.from("events").delete().eq("user_id", user.id),
    user.email ? admin.from("waitlist").delete().ilike("email", user.email.replace(/[\\%_]/g, "\\$&")) : Promise.resolve({ error: null }),
    admin.from("content_reports").update({ reporter_id: null }).eq("reporter_id", user.id),
  ]);
  const cleanupError = cleanup.find((r) => r.error)?.error;
  if (cleanupError) console.error("[account/delete] cleanup", cleanupError.message);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account/delete]", error.message);
    return NextResponse.json({ error: "Hisobni o‘chirib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring." }, { status: 500 });
  }
  // Clear the session cookies on this device.
  await supabase.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
