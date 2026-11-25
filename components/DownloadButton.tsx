"use client";
// "Yuklab olish" — save a lesson (text + all narrations) for offline listening.
import { useState } from "react";
import { downloadLesson, removeLesson, useIsDownloaded } from "@/lib/offline";
import { haptic } from "@/lib/native/haptics";
import { track } from "@/lib/track";
import type { Summary, SummaryContent, SummaryMeta } from "@/lib/types";
import { Icon } from "./Icon";

export function DownloadButton({ summary, nextUp = [], variant = "button" }: { summary: Summary & { content: SummaryContent }; nextUp?: SummaryMeta[]; variant?: "button" | "icon" }) {
  const downloaded = useIsDownloaded(summary.slug);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState(false);
  if (typeof window !== "undefined" && !("caches" in window && "indexedDB" in window)) return null;

  const start = async () => {
    if (progress !== null) return;
    if (downloaded) {
      if (!window.confirm("Yuklab olingan darsni qurilmadan o‘chirasizmi?")) return;
      haptic("soft");
      await removeLesson(summary.slug);
      return;
    }
    haptic("tap");
    setError(false);
    setProgress(0);
    try {
      await downloadLesson(summary, nextUp, setProgress);
      haptic("success");
      track("download", summary.slug);
    } catch {
      haptic("error");
      setError(true);
    } finally {
      setProgress(null);
    }
  };

  const pct = progress === null ? 0 : Math.round(progress * 100);
  const label = progress !== null ? `Yuklanmoqda ${pct}%` : downloaded ? "Yuklab olingan" : error ? "Qayta urinish" : "Yuklab olish";
  const ring = (
    <span className="dl-ring" style={{ ["--p" as string]: `${pct}%` }} aria-hidden>
      <Icon name={downloaded ? "cloud-done" : "download"} size={variant === "icon" ? 20 : 18} />
    </span>
  );

  if (variant === "icon")
    return (
      <button type="button" className={`icon-btn dl-btn${downloaded ? " is-on" : ""}${progress !== null ? " is-loading" : ""}`} aria-label={label} title={label} onClick={start}>
        {ring}
      </button>
    );
  return (
    <button type="button" className={`btn btn-soft dl-btn${downloaded ? " is-on" : ""}${progress !== null ? " is-loading" : ""}`} onClick={start} aria-live="polite">
      {ring} {label}
    </button>
  );
}
