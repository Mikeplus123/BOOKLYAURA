"use client";
// Premium inside the Android app: Google Play Billing only (Play policy). Falls back to the
// "I'm interested" list when billing isn't configured yet.
import Link from "next/link";
import { useEffect, useState } from "react";
import { billingAvailable, buyPremium, getPremiumOffer, manageSubscriptionsUrl, restorePurchases, type PremiumOffer } from "@/lib/native/billing";
import { haptic } from "@/lib/native/haptics";
import { track } from "@/lib/track";
import { useAuth } from "./AuthProvider";
import { Icon } from "./Icon";
import { PremiumActions } from "./PremiumActions";

export function PlayPremium() {
  const { enabled, user, isPremium, loading, signInWithGoogle, refreshEntitlements } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [offer, setOffer] = useState<PremiumOffer | null>(null);
  const [state, setState] = useState<"idle" | "buying" | "restoring" | "done">("idle");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => setAvailable(billingAvailable()), []);
  useEffect(() => {
    if (!available || !user) return;
    void getPremiumOffer(user.id).then(setOffer);
  }, [available, user]);

  if (available === null || loading) return <div className="premium-status muted">…</div>;
  if (!enabled || !available) return <PremiumActions />;

  if (isPremium || state === "done")
    return (
      <div className="premium-owned">
        <div className="premium-status">
          <Icon name="star" /> Siz Premium a’zosiz. Rahmat!
        </div>
        <a className="btn btn-soft btn-block" href={manageSubscriptionsUrl(offer?.productId)}>
          Obunani boshqarish (Google Play)
        </a>
      </div>
    );

  if (!user)
    return (
      <button type="button" className="btn btn-gold btn-lg btn-block" onClick={() => signInWithGoogle("/premium")}>
        <Icon name="google" /> Kirish va Premiumni ochish
      </button>
    );

  const buy = async () => {
    haptic("medium");
    setState("buying");
    setMessage(null);
    track("purchase_start", undefined, { productId: offer?.productId });
    const res = await buyPremium(user.id);
    if (res.ok) {
      haptic("success");
      track("purchase_complete", undefined, { productId: offer?.productId });
      await refreshEntitlements();
      setState("done");
      return;
    }
    setState("idle");
    if (!res.cancelled) {
      haptic("error");
      setMessage({ kind: "error", text: res.error });
    }
  };

  const restore = async () => {
    setState("restoring");
    setMessage(null);
    try {
      const { premium } = await restorePurchases(user.id);
      await refreshEntitlements();
      if (premium) {
        haptic("success");
        setState("done");
      } else {
        setState("idle");
        setMessage({ kind: "error", text: "Bu Google hisobida faol obuna topilmadi." });
      }
    } catch {
      setState("idle");
      setMessage({ kind: "error", text: "Xaridlarni tiklab bo‘lmadi." });
    }
  };

  return (
    <>
      <button type="button" className="btn btn-gold btn-lg btn-block" disabled={!offer || state !== "idle"} onClick={buy}>
        {state === "buying" ? "Google Play ochilmoqda…" : offer ? <>Premiumga obuna bo‘lish · {offer.priceString} / oy</> : "Narx yuklanmoqda…"}
      </button>
      {offer?.hasTrial && <p className="tiny center">Bepul sinov davridan keyin {offer.priceString} / oy.</p>}
      {message && (
        <p className={`alert${message.kind === "ok" ? " alert-ok" : ""}`} role="status">
          {message.text}
        </p>
      )}
      <p className="tiny muted center play-legal">
        To‘lov Google Play hisobingizdan olinadi. Obuna har oy avtomatik yangilanadi; Google Play → Obunalar bo‘limida istalgan vaqtda bekor qilishingiz mumkin. <Link href="/terms#premium">Shartlar</Link> · <Link href="/privacy">Maxfiylik</Link>
      </p>
      <button type="button" className="link-btn center-block" disabled={state !== "idle"} onClick={restore}>
        {state === "restoring" ? "Tekshirilmoqda…" : "Xaridlarni tiklash"}
      </button>
    </>
  );
}
