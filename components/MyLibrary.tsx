"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useBookly, useSyncStatus } from "@/lib/store";
import type { SummaryMeta } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { Icon } from "./Icon";
import { SummaryCard } from "./SummaryCard";

const SYNC_LABEL = {
  local: "Faqat shu qurilmada saqlanmoqda",
  syncing: "Sinxronlanmoqda…",
  synced: "Barcha qurilmalaringizda saqlandi",
  error: "Sinxronlashda xatolik — keyinroq qayta urinamiz",
} as const;

export function MyLibrary({ catalog }: { catalog: SummaryMeta[] }) {
  const { enabled, user, profile, isPremium, loading, signInWithGoogle } = useAuth();
  const progress = useBookly((s) => s.progress);
  const library = useBookly((s) => s.library);
  const practice = useBookly((s) => s.practice);
  const status = useSyncStatus();

  const bySlug = useMemo(() => new Map(catalog.map((s) => [s.slug, s])), [catalog]);

  const inProgress = useMemo(
    () =>
      Object.entries(progress)
        .filter(([slug, p]) => !p.completedAt && p.percent > 0 && bySlug.has(slug))
        .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
        .map(([slug]) => bySlug.get(slug)!),
    [progress, bySlug],
  );
  const saved = useMemo(
    () =>
      Object.entries(library)
        .filter(([slug, l]) => l.saved && bySlug.has(slug))
        .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
        .map(([slug]) => bySlug.get(slug)!),
    [library, bySlug],
  );
  const completed = useMemo(
    () =>
      Object.entries(progress)
        .filter(([slug, p]) => p.completedAt && bySlug.has(slug))
        .sort((a, b) => (b[1].completedAt ?? "").localeCompare(a[1].completedAt ?? ""))
        .map(([slug]) => bySlug.get(slug)!),
    [progress, bySlug],
  );

  const minutes = completed.reduce((acc, s) => acc + s.durationMin, 0);
  const practiceStats = Object.values(practice).reduce((acc, p) => ({ correct: acc.correct + p.bestScore, total: acc.total + p.total }), { correct: 0, total: 0 });
  const suggestion = catalog.find((s) => !progress[s.slug] && (s.isFree || isPremium));

  return (
    <div className="me">
      <section className="me-account">
        {enabled && user ? (
          <div className="me-user">
            <div>
              <p className="eyebrow">Hisob</p>
              <h2>{profile?.display_name ?? user.email}</h2>
              <p className="muted small">
                {user.email} · {isPremium ? "Premium a’zo ★" : "Bepul reja"}
              </p>
            </div>
            <span className={`sync-pill sync-${status}`}>
              <Icon name="sync" size={16} /> {SYNC_LABEL[status]}
            </span>
          </div>
        ) : enabled ? (
          <div className="me-signin">
            <div>
              <h2>Progressingizni yo‘qotmang</h2>
              <p>Google orqali kiring — o‘qigan joyingiz, saqlanganlar va natijalar telefon va kompyuteringizda bir xil bo‘ladi. Hozirgi progressingiz hisobingizga qo‘shiladi.</p>
            </div>
            <button type="button" className="btn btn-primary" disabled={loading} onClick={() => signInWithGoogle("/me")}>
              <Icon name="google" /> Google bilan kirish
            </button>
          </div>
        ) : (
          <div className="me-signin">
            <div>
              <h2>Demo rejim</h2>
              <p>Progress shu brauzerda saqlanmoqda. Supabase ulanganda Google orqali kirish va qurilmalararo sinxronlash yoqiladi.</p>
            </div>
          </div>
        )}
      </section>

      <section className="stats" aria-label="Statistika">
        <div className="stat">
          <strong>{completed.length}</strong>
          <span>tugatilgan dars</span>
        </div>
        <div className="stat">
          <strong>{minutes}</strong>
          <span>daqiqa o‘rganildi</span>
        </div>
        <div className="stat">
          <strong>{practiceStats.total ? `${Math.round((practiceStats.correct / practiceStats.total) * 100)}%` : "—"}</strong>
          <span>savollarga to‘g‘ri javob</span>
        </div>
        <div className="stat">
          <strong>{saved.length}</strong>
          <span>saqlangan</span>
        </div>
      </section>

      <Shelf title="Davom ettirish" items={inProgress} empty={null} />
      <Shelf
        title="Saqlanganlar"
        items={saved}
        empty={
          <p className="muted">
            Dars sahifasida <Icon name="bookmark" size={14} /> tugmasini bosing — shu yerda paydo bo‘ladi.
          </p>
        }
      />
      <Shelf title="Tugatilganlar" items={completed} empty={null} />

      {inProgress.length + saved.length + completed.length === 0 && (
        <div className="empty">
          <span className="empty-emoji" aria-hidden>
            📚
          </span>
          <h3>Hali dars boshlanmagan</h3>
          <p>Birinchi darsni boshlang — atigi 5 daqiqa.</p>
          {suggestion && (
            <Link href={`/s/${suggestion.slug}`} className="btn btn-primary">
              <Icon name="play" /> {suggestion.titleUz || suggestion.title}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Shelf({ title, items, empty }: { title: string; items: SummaryMeta[]; empty: React.ReactNode }) {
  if (!items.length && !empty) return null;
  return (
    <section className="shelf">
      <h2 className="h3">
        {title} {items.length > 0 && <span className="chip-count">{items.length}</span>}
      </h2>
      {items.length ? (
        <div className="grid-cards">
          {items.map((s) => (
            <SummaryCard key={s.slug} meta={s} />
          ))}
        </div>
      ) : (
        empty
      )}
    </section>
  );
}
