"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { SummaryMeta } from "@/lib/types";
import { levelEn, topicLabel } from "@/lib/types";

interface Row extends Pick<SummaryMeta, "slug" | "title" | "titleUz" | "author" | "topic" | "level" | "isFree" | "isPublished" | "durationMin"> {
  updatedAt?: string;
}

interface Stats {
  waitlist: number;
  interest: number;
  completes: number;
  sessions: number;
}

export function AdminList({ local }: { local: Row[] }) {
  const supabase = getSupabaseBrowser();
  const [rows, setRows] = useState<Row[] | null>(supabase ? null : local);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.from("summaries").select("slug,title,title_uz,author,topic,level,is_free,is_published,duration_min,updated_at").order("sort_order");
      setRows(
        (data ?? []).map((r) => ({
          slug: r.slug,
          title: r.title,
          titleUz: r.title_uz,
          author: r.author,
          topic: r.topic,
          level: r.level,
          isFree: r.is_free,
          isPublished: r.is_published,
          durationMin: r.duration_min,
          updatedAt: r.updated_at,
        })),
      );
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
      const [waitlist, interest, completes, sessions] = await Promise.all([
        count(supabase.from("waitlist").select("*", { count: "exact", head: true }).eq("unsubscribed", false)),
        count(supabase.from("premium_interest").select("*", { count: "exact", head: true })),
        count(supabase.from("events").select("*", { count: "exact", head: true }).eq("name", "summary_complete").gte("created_at", since)),
        count(supabase.from("events").select("*", { count: "exact", head: true }).eq("name", "session_start").gte("created_at", since)),
      ]);
      setStats({ waitlist, interest, completes, sessions });
    })();
  }, [supabase]);

  // Download the launch waitlist as a CSV (opens in Excel / Google Sheets) for the launch announcement.
  const exportWaitlist = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("waitlist")
      .select("email,name,telegram,source,created_at,notified_at,unsubscribed")
      .order("created_at", { ascending: true });
    if (error || !data) return alert(`Yuklab bo‘lmadi: ${error?.message ?? ""}`);
    const cols = ["email", "name", "telegram", "source", "created_at", "notified_at", "unsubscribed"] as const;
    const esc = (v: unknown) => {
      const t = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const csv = [cols.join(","), ...data.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `bookly-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="admin">
      <div className="section-head">
        <div>
          <p className="eyebrow">Kontent boshqaruvi</p>
          <h1 className="page-title">Darslar</h1>
        </div>
        <Link href="/admin/edit/new" className="btn btn-primary">
          <Icon name="plus" /> Yangi dars
        </Link>
      </div>

      {!supabase && (
        <p className="alert alert-info">
          Demo rejim: darslarni tahrirlash va JSON eksport qilish mumkin, lekin saqlash uchun Supabase ulanishi kerak. Eksport qilingan JSON’ni <code>content/summaries/</code> ga qo‘shishingiz ham mumkin.
        </p>
      )}

      {stats && (
        <div className="stats">
          <div className="stat">
            <strong>{stats.sessions}</strong>
            <span>dars sessiyasi (30 kun)</span>
          </div>
          <div className="stat">
            <strong>{stats.completes}</strong>
            <span>tugatilgan dars (30 kun)</span>
          </div>
          <div className="stat">
            <strong>{stats.sessions ? Math.round((stats.completes / stats.sessions) * 100) : 0}%</strong>
            <span>tugatish darajasi</span>
          </div>
          <div className="stat">
            <strong>{stats.interest}</strong>
            <span>Premium qiziqish</span>
          </div>
          <div className="stat">
            <strong>{stats.waitlist}</strong>
            <span>kutish ro‘yxatida</span>
            <button type="button" className="link-btn small" onClick={() => void exportWaitlist()}>
              CSV yuklab olish
            </button>
          </div>
        </div>
      )}

      {rows === null ? (
        <p className="muted">Yuklanmoqda…</p>
      ) : rows.length === 0 ? (
        <div className="empty">
          <h3>Hali dars yo‘q</h3>
          <p>“Yangi dars” tugmasini bosing yoki <code>npm run seed</code> bilan repozitoriydagi darslarni yuklang.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Dars</th>
                <th>Mavzu</th>
                <th>Daraja</th>
                <th>Kirish</th>
                <th>Holat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug}>
                  <td>
                    <strong>{r.titleUz || r.title}</strong>
                    <small>{r.author}</small>
                  </td>
                  <td>{topicLabel(r.topic)}</td>
                  <td>{levelEn(r.level)}</td>
                  <td>{r.isFree ? <span className="badge badge-free">Bepul</span> : <span className="badge badge-premium">Premium</span>}</td>
                  <td>{r.isPublished ? <span className="status status-on">Nashrda</span> : <span className="status">Qoralama</span>}</td>
                  <td>
                    <Link href={`/admin/edit/${r.slug}`} className="btn btn-soft btn-sm">
                      Tahrirlash
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
