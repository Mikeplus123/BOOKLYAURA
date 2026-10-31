"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import { useAuth } from "./AuthProvider";
import { Icon } from "./Icon";

export function PremiumActions() {
  const { enabled, user, isPremium, loading, signInWithGoogle } = useAuth();
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  useEffect(() => track("premium_view"), []);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase || !user) return;
    supabase
      .from("premium_interest")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => data && setState("done"));
  }, [user]);

  if (isPremium)
    return (
      <div className="premium-status">
        <Icon name="star" /> Siz Premium a’zosiz. Rahmat! Obunani boshqarish yoki bekor qilish uchun qo‘llab-quvvatlash xizmatiga yozing.
      </div>
    );

  if (!enabled)
    return <p className="alert alert-info">Demo rejim: to‘lovlar va qiziqish ro‘yxati Supabase ulanganidan keyin ishlaydi.</p>;

  if (!user)
    return (
      <button type="button" className="btn btn-gold btn-lg btn-block" disabled={loading} onClick={() => signInWithGoogle("/premium")}>
        <Icon name="google" /> Kirish va qiziqishni bildirish
      </button>
    );

  if (state === "done")
    return (
      <div className="premium-status">
        <Icon name="check" /> Qiziqishingiz qayd etildi. Premium ochilganda birinchilardan bo‘lib xabar beramiz.
      </div>
    );

  return (
    <>
      <button
        type="button"
        className="btn btn-gold btn-lg btn-block"
        disabled={state === "saving"}
        onClick={async () => {
          const supabase = getSupabaseBrowser();
          if (!supabase) return;
          setState("saving");
          const { error } = await supabase.from("premium_interest").upsert({ user_id: user.id, email: user.email, plan: "premium_monthly" });
          if (error) return setState("error");
          track("premium_interest");
          setState("done");
        }}
      >
        {state === "saving" ? "Saqlanmoqda…" : "Premiumga qiziqishimni bildiraman"}
      </button>
      {state === "error" && (
        <p className="alert" role="alert">
          Saqlab bo‘lmadi. Qayta urinib ko‘ring.
        </p>
      )}
      <p className="tiny muted center">Hozircha hech qanday to‘lov olinmaydi.</p>
      <Link href="/library" className="link-btn center-block">
        Avval bepul darslarni sinab ko‘raman
      </Link>
    </>
  );
}
