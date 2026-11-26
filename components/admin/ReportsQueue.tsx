"use client";
// Moderation queue: open reports about reviews and AI explanations. Google Play expects
// reported content to be reviewed promptly (we promise 24 hours in the Terms).
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface Report {
  id: string;
  target_type: "review" | "ai_explanation";
  target_id: string;
  summary_slug: string | null;
  reason: string;
  details: string | null;
  snapshot: string | null;
  created_at: string;
}

const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  offensive: "Nomaqbul",
  harassment: "Ta’qib",
  wrong: "Noto‘g‘ri",
  copyright: "Mualliflik / shaxsiy",
  other: "Boshqa",
};

function preview(r: Report): string {
  if (r.target_type === "ai_explanation" && r.snapshot) {
    try {
      const d = JSON.parse(r.snapshot) as { meaningUz?: string };
      return d.meaningUz ?? r.snapshot;
    } catch {
      return r.snapshot;
    }
  }
  return r.snapshot ?? "";
}

export function ReportsQueue() {
  const supabase = getSupabaseBrowser();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("content_reports").select("*").eq("status", "open").order("created_at", { ascending: true }).limit(100);
    if (error) {
      setError(error.message.includes("content_reports") ? "0004 migratsiyasini ishga tushiring." : error.message);
      setReports([]);
      return;
    }
    setReports(data as Report[]);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!supabase) return null;

  const act = async (r: Report, action: "hide_review" | "clear_ai" | "dismiss") => {
    setBusy(r.id);
    setError(null);
    const res = await fetch("/api/admin/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, action }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(json.error ?? "Xatolik.");
    void load();
  };

  // Group duplicate reports about the same item.
  const groups = new Map<string, Report[]>();
  for (const r of reports ?? []) {
    const k = `${r.target_type}:${r.target_id}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  return (
    <section className="admin-reports" aria-labelledby="reports-title">
      <h2 className="h3" id="reports-title">
        <Icon name="flag" /> Shikoyatlar {reports && reports.length > 0 && <span className="chip-count">{reports.length}</span>}
      </h2>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {reports === null ? (
        <p className="muted">
          <span className="dot-pulse" /> Yuklanmoqda…
        </p>
      ) : groups.size === 0 ? (
        <p className="muted">Ochiq shikoyat yo‘q. 🎉</p>
      ) : (
        <ul className="report-list">
          {[...groups.values()].map((items) => {
            const r = items[0];
            const reasons = [...new Set(items.map((i) => REASON_LABEL[i.reason] ?? i.reason))].join(", ");
            return (
              <li key={r.id} className="report-item">
                <div className="report-meta">
                  <span className="badge">{r.target_type === "review" ? "Sharh" : "AI"}</span>
                  <strong>{r.summary_slug}</strong>
                  <span className="muted small">
                    {items.length} ta shikoyat · {reasons} · {new Date(r.created_at).toLocaleString("uz-UZ")}
                  </span>
                </div>
                <blockquote className="report-snapshot">{preview(r)}</blockquote>
                {items.filter((i) => i.details).map((i) => (
                  <p key={i.id} className="small muted">
                    “{i.details}”
                  </p>
                ))}
                <div className="report-actions">
                  {r.target_type === "review" ? (
                    <button type="button" className="btn btn-danger btn-sm" disabled={busy === r.id} onClick={() => act(r, "hide_review")}>
                      <Icon name="eye-off" size={16} /> Sharhni yashirish
                    </button>
                  ) : (
                    <button type="button" className="btn btn-danger btn-sm" disabled={busy === r.id} onClick={() => act(r, "clear_ai")}>
                      <Icon name="replay" size={16} /> AI javobini o‘chirish
                    </button>
                  )}
                  <button type="button" className="btn btn-soft btn-sm" disabled={busy === r.id} onClick={() => act(r, "dismiss")}>
                    Rad etish
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
