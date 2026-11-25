"use client";
// "Shikoyat qilish" — report a review or an AI explanation (Google Play UGC / AI-content policies).
import { useState } from "react";
import { haptic } from "@/lib/native/haptics";
import { track } from "@/lib/track";
import { Sheet } from "./ui/Sheet";

export type ReportTarget =
  | { type: "review"; id: string; slug: string; snapshot: string }
  | { type: "ai_explanation"; id: string; slug: string; snapshot: string };

type Reason = "spam" | "offensive" | "harassment" | "wrong" | "copyright" | "other";

const REASONS: Record<ReportTarget["type"], { id: Reason; label: string }[]> = {
  review: [
    { id: "offensive", label: "Haqoratli yoki nomaqbul" },
    { id: "harassment", label: "Ta’qib yoki tahdid" },
    { id: "spam", label: "Spam yoki reklama" },
    { id: "copyright", label: "Shaxsiy ma’lumot / mualliflik huquqi" },
    { id: "other", label: "Boshqa sabab" },
  ],
  ai_explanation: [
    { id: "wrong", label: "Noto‘g‘ri yoki chalg‘ituvchi tushuntirish" },
    { id: "offensive", label: "Haqoratli yoki nomaqbul" },
    { id: "other", label: "Boshqa sabab" },
  ],
};

export function ReportSheet({ target, onClose, onDone }: { target: ReportTarget; onClose: () => void; onDone?: () => void }) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const send = async () => {
    if (!reason) return;
    setState("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: target.type,
          targetId: target.id,
          summarySlug: target.slug,
          reason,
          details: details.trim() || undefined,
          snapshot: target.snapshot.slice(0, 4000),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Yuborib bo‘lmadi.");
      track("content_report", target.slug, { type: target.type, reason });
      haptic("success");
      setState("sent");
      onDone?.();
    } catch (e) {
      haptic("error");
      setError(e instanceof Error ? e.message : "Yuborib bo‘lmadi.");
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <Sheet
        title="Rahmat!"
        onClose={onClose}
        footer={
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            Yopish
          </button>
        }
      >
        <p>Shikoyatingiz moderatorlarga yuborildi. Uni 24 soat ichida ko‘rib chiqamiz va qoidabuzar kontentni o‘chiramiz.</p>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={target.type === "review" ? "Sharh ustidan shikoyat" : "AI javobi haqida xabar berish"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-soft" onClick={onClose}>
            Bekor qilish
          </button>
          <button type="button" className="btn btn-primary" disabled={!reason || state === "sending"} onClick={send}>
            {state === "sending" ? "Yuborilmoqda…" : "Yuborish"}
          </button>
        </>
      }
    >
      <fieldset className="radio-list">
        <legend className="muted small">Sababni tanlang</legend>
        {REASONS[target.type].map((r) => (
          <label key={r.id} className={`radio-row${reason === r.id ? " is-on" : ""}`}>
            <input
              type="radio"
              name="report-reason"
              value={r.id}
              checked={reason === r.id}
              onChange={() => {
                haptic("select");
                setReason(r.id);
              }}
            />
            <span>{r.label}</span>
          </label>
        ))}
      </fieldset>
      <textarea
        className="review-textarea"
        rows={3}
        maxLength={1000}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Qo‘shimcha izoh (ixtiyoriy)"
        aria-label="Qo‘shimcha izoh"
      />
      {state === "error" && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
