"use client";
import { useState } from "react";
import { detachSync } from "@/lib/store";
import { haptic } from "@/lib/native/haptics";
import { useAuth } from "./AuthProvider";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";

/** In-app account deletion (Google Play requirement). Used on /account/delete and in settings. */
export function DeleteAccount({ compact = false }: { compact?: boolean }) {
  const { enabled, loading, user, isPremium, signInWithGoogle, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) return compact ? null : <p className="alert alert-info">Demo rejim: bu saytda hisoblar yo‘q.</p>;
  if (loading) return null;
  if (!user) {
    return compact ? null : (
      <button type="button" className="btn btn-primary" onClick={() => signInWithGoogle("/account/delete")}>
        <Icon name="google" /> O‘chirish uchun Google bilan kiring
      </button>
    );
  }

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Hisobni o‘chirib bo‘lmadi.");
      haptic("success");
      await detachSync();
      try {
        window.localStorage.removeItem("bookly:v1");
      } catch {
        /* storage unavailable */
      }
      await signOut("/?deleted=1");
    } catch (e) {
      haptic("error");
      setError(e instanceof Error ? e.message : "Hisobni o‘chirib bo‘lmadi.");
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={`btn btn-danger${compact ? " btn-sm" : ""}`} onClick={() => setOpen(true)}>
        <Icon name="trash" size={18} /> Hisobni o‘chirish
      </button>
      {open && (
        <Sheet
          title="Hisobni o‘chirasizmi?"
          onClose={() => !busy && setOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-soft" onClick={() => setOpen(false)} disabled={busy}>
                Bekor qilish
              </button>
              <button type="button" className="btn btn-danger" disabled={!agree || busy} onClick={remove}>
                {busy ? "O‘chirilmoqda…" : "Butunlay o‘chirish"}
              </button>
            </>
          }
        >
          <p>
            <strong>{user.email}</strong> hisobi va unga bog‘liq barcha ma’lumotlar — progress, saqlanganlar, mashq natijalari, sharhlar — butunlay o‘chiriladi. Buni qaytarib bo‘lmaydi.
          </p>
          {isPremium && (
            <p className="alert">
              Sizda Premium obuna bor. Hisobni o‘chirish uni bekor qilmaydi — avval Google Play → Obunalar bo‘limida bekor qiling.
            </p>
          )}
          <label className="check-row">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>Tushunaman, bu amalni qaytarib bo‘lmaydi.</span>
          </label>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
        </Sheet>
      )}
    </>
  );
}
