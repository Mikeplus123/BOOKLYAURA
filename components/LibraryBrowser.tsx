"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SummaryMeta } from "@/lib/types";
import { LEVELS, TOPICS } from "@/lib/types";
import { Icon } from "./Icon";
import { SummaryCard } from "./SummaryCard";

const normalize = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ']/g, "").normalize("NFKD");

export function LibraryBrowser({ catalog, initialTopic }: { catalog: SummaryMeta[]; initialTopic?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(TOPICS.some((t) => t.id === initialTopic) ? initialTopic! : null);
  const [level, setLevel] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);

  const chooseTopic = (id: string | null) => {
    setTopic(id);
    router.replace(id ? `${pathname}?topic=${id}` : pathname, { scroll: false });
  };

  const results = useMemo(() => {
    const q = normalize(query.trim());
    return catalog.filter((s) => {
      if (topic && s.topic !== topic) return false;
      if (level && s.level !== level) return false;
      if (freeOnly && !s.isFree) return false;
      if (!q) return true;
      return normalize([s.title, s.titleUz, s.author, s.tagline].join(" ")).includes(q);
    });
  }, [catalog, query, topic, level, freeOnly]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of catalog) m.set(s.topic, (m.get(s.topic) ?? 0) + 1);
    return m;
  }, [catalog]);

  const hasFilters = Boolean(query || topic || level || freeOnly);

  return (
    <div className="library">
      <div className="search">
        <Icon name="search" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kitob, muallif yoki mavzu bo‘yicha qidiring"
          aria-label="Qidirish"
        />
        {query && (
          <button type="button" className="icon-btn sm" aria-label="Tozalash" onClick={() => setQuery("")}>
            <Icon name="close" />
          </button>
        )}
      </div>

      <div className="filters" role="group" aria-label="Mavzu bo‘yicha saralash">
        <button type="button" className={`chip${topic === null ? " is-on" : ""}`} aria-pressed={topic === null} onClick={() => chooseTopic(null)}>
          Barchasi <span className="chip-count">{catalog.length}</span>
        </button>
        {TOPICS.map((t) => (
          <button key={t.id} type="button" className={`chip${topic === t.id ? " is-on" : ""}`} aria-pressed={topic === t.id} onClick={() => chooseTopic(topic === t.id ? null : t.id)}>
            <span aria-hidden>{t.emoji}</span> {t.uz}
            {counts.get(t.id) ? <span className="chip-count">{counts.get(t.id)}</span> : null}
          </button>
        ))}
      </div>

      <div className="filters filters-secondary">
        <label className="select">
          <span>Daraja</span>
          <select value={level ?? ""} onChange={(e) => setLevel(e.target.value || null)}>
            <option value="">Har qanday</option>
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.uz} ({l.cefr})
              </option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} />
          <span className="toggle-ui" aria-hidden />
          Faqat bepul
        </label>
        {hasFilters && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setQuery("");
              chooseTopic(null);
              setLevel(null);
              setFreeOnly(false);
            }}
          >
            Filtrlarni tozalash
          </button>
        )}
        <span className="result-count" aria-live="polite">
          {results.length} ta dars
        </span>
      </div>

      {results.length > 0 ? (
        <div className="grid-cards">
          {results.map((s) => (
            <SummaryCard key={s.slug} meta={s} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <span className="empty-emoji" aria-hidden>
            🔎
          </span>
          <h3>{catalog.length === 0 ? "Kutubxona tez orada to‘ladi" : "Hech narsa topilmadi"}</h3>
          <p>{catalog.length === 0 ? "Birinchi darslar tayyorlanmoqda. Yangiliklarni kuzatib boring!" : "Boshqa so‘z bilan qidirib ko‘ring yoki filtrlarni tozalang."}</p>
        </div>
      )}

      <p className="library-note">
        Har hafta yangi darslar qo‘shiladi. Qaysi kitobni ko‘rishni xohlaysiz? Bizga Telegram orqali yozing.
      </p>
    </div>
  );
}
