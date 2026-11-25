"use client";
// Downloaded lessons (works with no network). Lists what's on the device and opens a lesson in the
// regular player — imported statically so its code is part of this page and cached for offline use.
import Link from "next/link";
import { useEffect, useState } from "react";
import Practice from "@/components/practice/Practice";
import Player from "@/components/reader/Player";
import { formatBytes, getOfflineLesson, removeLesson, useOfflineLessons, type OfflineLesson, type OfflineMeta } from "@/lib/offline";
import { haptic } from "@/lib/native/haptics";
import { useSwipe } from "@/lib/useSwipe";
import { Icon } from "./Icon";
import { BookCover } from "./BookCover";

function readParams(): { slug: string | null; view: string | null } {
  const q = new URLSearchParams(window.location.search);
  return { slug: q.get("slug"), view: q.get("view") };
}

export function OfflineLibrary() {
  const lessons = useOfflineLessons();
  const [mounted, setMounted] = useState(false);
  const [route, setRoute] = useState<{ slug: string | null; view: string | null }>({ slug: null, view: null });
  const [lesson, setLesson] = useState<OfflineLesson | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setMounted(true);
    setRoute(readParams());
    const onPop = () => setRoute(readParams());
    const onNet = () => setOnline(navigator.onLine);
    onNet();
    window.addEventListener("popstate", onPop);
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
    };
  }, []);

  useEffect(() => {
    if (!route.slug) return setLesson(null);
    void getOfflineLesson(route.slug).then(setLesson);
  }, [route.slug]);

  // In-page navigation (no server round trip), with a real history entry for the back button.
  const open = (slug: string | null, view?: string) => {
    const url = slug ? `/offline?slug=${encodeURIComponent(slug)}${view ? `&view=${view}` : ""}` : "/offline";
    window.history.pushState(null, "", url);
    setRoute({ slug, view: view ?? null });
    window.scrollTo(0, 0);
  };

  if (!mounted) return null;

  if (route.slug && lesson) {
    if (route.view === "practice")
      return (
        <main id="main" className="container page">
          <Practice slug={lesson.slug} title={lesson.summary.titleUz || lesson.summary.title} content={lesson.summary.content} />
        </main>
      );
    return <Player key={lesson.slug} summary={lesson.summary} nextUp={[]} offline />;
  }

  return (
    <main id="main" className="container page offline-page">
      <header className="page-head">
        <p className="eyebrow">{online ? "Qurilmangizda" : "Oflayn rejim"}</p>
        <h1 className="page-title">Yuklab olinganlar</h1>
        <p className="page-lead">{online ? "Bu darslarni internetsiz ham tinglashingiz va o‘qishingiz mumkin." : "Internet yo‘q, lekin bu darslar qurilmangizda saqlangan."}</p>
      </header>

      {lessons === null ? (
        <p className="muted">
          <span className="dot-pulse" /> Yuklanmoqda…
        </p>
      ) : lessons.length === 0 ? (
        <div className="empty">
          <span className="empty-emoji" aria-hidden>
            📥
          </span>
          <h3>Hali hech narsa yuklab olinmagan</h3>
          <p>Dars ichidagi “Yuklab olish” tugmasini bosing — dars matni va audiosi shu yerda paydo bo‘ladi.</p>
          {online && (
            <Link href="/library" className="btn btn-primary">
              Kutubxonaga o‘tish
            </Link>
          )}
        </div>
      ) : (
        <>
          <ul className="offline-list">
            {lessons.map((l) => (
              <OfflineRow key={l.slug} lesson={l} onOpen={() => open(l.slug)} />
            ))}
          </ul>
          <p className="muted tiny center">
            Jami: {formatBytes(lessons.reduce((a, l) => a + l.bytes, 0))} · O‘chirish uchun chapga suring
          </p>
        </>
      )}

      {online && (
        <p className="center">
          <Link href="/me" className="link-btn">
            ← Mening darslarim
          </Link>
        </p>
      )}
    </main>
  );
}

function OfflineRow({ lesson, onOpen }: { lesson: OfflineMeta; onOpen: () => void }) {
  const [confirm, setConfirm] = useState(false);
  // Swipe left to reveal "delete" (like a mail app).
  const swipe = useSwipe({
    axis: "x",
    allow: ["left", "right"],
    onSwipe: (dir) => {
      haptic("select");
      setConfirm(dir === "left");
    },
  });
  const offset = swipe.dragging ? Math.min(0, swipe.offset) : confirm ? -96 : 0;
  return (
    <li className={`offline-row${offset < 0 ? " is-revealed" : ""}`}>
      <button
        type="button"
        className="offline-delete"
        aria-label={`${lesson.title} — qurilmadan o‘chirish`}
        tabIndex={confirm ? 0 : -1}
        onClick={async () => {
          haptic("warning");
          await removeLesson(lesson.slug);
        }}
      >
        <Icon name="trash" /> O‘chirish
      </button>
      <div className={`offline-card${swipe.dragging ? " is-dragging" : ""}`} style={{ transform: `translateX(${offset}px)` }} {...swipe.handlers}>
        <button type="button" className="offline-open" onClick={() => (confirm ? setConfirm(false) : onOpen())}>
          <BookCover meta={{ title: lesson.title, titleUz: lesson.title, author: lesson.author, coverColor: lesson.coverColor, coverImage: lesson.coverImage, topic: "self-development" }} size="sm" />
          <span className="offline-text">
            <strong>{lesson.title}</strong>
            <small>
              {lesson.author} · {lesson.durationMin} daqiqa · {formatBytes(lesson.bytes)}
            </small>
          </span>
          <span className="offline-play" aria-hidden>
            <Icon name="play" />
          </span>
        </button>
        <button type="button" className="icon-btn sm offline-more" aria-label="O‘chirish" onClick={() => setConfirm((v) => !v)}>
          <Icon name="more" />
        </button>
      </div>
    </li>
  );
}
