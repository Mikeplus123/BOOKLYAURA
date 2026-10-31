"use client";
import Link from "next/link";
import { useBookly } from "@/lib/store";
import type { SummaryMeta } from "@/lib/types";
import { LANG_LABEL, levelEn, topicLabel } from "@/lib/types";
import { BookCover } from "./BookCover";
import { Icon } from "./Icon";

export function SummaryCard({ meta }: { meta: SummaryMeta }) {
  const progress = useBookly((s) => s.progress[meta.slug]);
  const done = Boolean(progress?.completedAt);
  const pct = done ? 100 : Math.round(progress?.percent ?? 0);

  return (
    <Link href={`/s/${meta.slug}`} className="card" aria-label={`${meta.titleUz || meta.title} — ${meta.author}`}>
      <div className="card-cover">
        <BookCover meta={meta} size="md" />
        <span className={`badge ${meta.isFree ? "badge-free" : "badge-premium"}`}>
          {meta.isFree ? "Bepul" : (
            <>
              <Icon name="lock" size={12} /> Premium
            </>
          )}
        </span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{meta.titleUz || meta.title}</h3>
        <p className="card-author">{meta.author}</p>
        <p className="card-meta">
          <span>{topicLabel(meta.topic)}</span>
          <span aria-hidden>·</span>
          <span>
            <Icon name="clock" size={13} /> {meta.durationMin} daqiqa
          </span>
          <span aria-hidden>·</span>
          <span>{levelEn(meta.level)}</span>
        </p>
        <div className="card-foot">
          <span className="langs" aria-label="Tillar">
            {meta.languages.map((l) => (
              <span key={l} className="lang">
                {LANG_LABEL[l]}
              </span>
            ))}
          </span>
          {pct > 0 && (
            <span className={`card-progress${done ? " is-done" : ""}`}>
              {done ? (
                <>
                  <Icon name="check" size={14} /> Tugatildi
                </>
              ) : (
                <>
                  <span className="mini-bar">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  {pct}%
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
