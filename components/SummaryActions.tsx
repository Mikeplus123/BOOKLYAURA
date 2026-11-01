"use client";
import Link from "next/link";
import { useEffect } from "react";
import { setSaved, useBookly } from "@/lib/store";
import { track } from "@/lib/track";
import { Icon } from "./Icon";

/** Start / continue buttons + save toggle on the summary page (reads local progress). */
export function SummaryActions({ slug, total, hasAudio }: { slug: string; total: number; hasAudio: boolean }) {
  const progress = useBookly((s) => s.progress[slug]);
  const saved = useBookly((s) => s.library[slug]?.saved ?? false);
  const practice = useBookly((s) => s.practice[slug]);

  useEffect(() => track("summary_view", slug), [slug]);

  const inProgress = progress && !progress.completedAt && progress.sentenceIndex > 0;
  return (
    <div className="summary-actions">
      {inProgress && (
        <Link href={`/s/${slug}/learn`} className="btn btn-primary btn-lg btn-block">
          <Icon name="play" /> Davom ettirish · {Math.round(progress.percent)}%
        </Link>
      )}
      <div className="start-grid">
        <Link href={`/s/${slug}/learn?format=both`} className={`start-option${inProgress ? "" : " is-primary"}`}>
          <Icon name="both" size={22} />
          <strong>O‘qib tinglash</strong>
          <small>Matn diktor bilan birga belgilanadi</small>
        </Link>
        <Link href={`/s/${slug}/learn?format=read`} className="start-option">
          <Icon name="book" size={22} />
          <strong>Faqat o‘qish</strong>
          <small>O‘z tezligingizda</small>
        </Link>
        <Link href={`/s/${slug}/learn?format=listen`} className="start-option">
          <Icon name="headphones" size={22} />
          <strong>Faqat tinglash</strong>
          <small>{hasAudio ? "Ekranga qaramasdan" : "Brauzer ovozi bilan (namuna)"}</small>
        </Link>
      </div>
      <div className="summary-actions-row">
        <button type="button" className={`btn btn-soft${saved ? " is-on" : ""}`} aria-pressed={saved} onClick={() => setSaved(slug, !saved)}>
          <Icon name={saved ? "bookmark-filled" : "bookmark"} /> {saved ? "Saqlangan" : "Saqlash"}
        </button>
        {progress?.completedAt && (
          <Link href={`/s/${slug}/practice`} className="btn btn-soft">
            <Icon name="target" /> Mashq {practice ? `· ${practice.bestScore}/${practice.total}` : ""}
          </Link>
        )}
        <span className="muted small">{total} ta jumla</span>
      </div>
    </div>
  );
}
