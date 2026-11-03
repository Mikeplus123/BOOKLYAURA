"use client";
// Ratings & comments for one summary. Every summary has its own rating.
// Reads and writes go straight to Supabase (summary_reviews + summary_rating_stats, protected by RLS).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icon";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import type { RatingStats, Review } from "@/lib/types";

const PAGE = 10;
const MAX_COMMENT = 1000;
const RATING_WORDS = ["", "Yoqmadi", "O‘rtacha emas", "Yaxshi", "Juda yaxshi", "Ajoyib!"];

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToReview(row: any): Review {
  return {
    id: row.id,
    summarySlug: row.summary_slug,
    userId: row.user_id,
    rating: row.rating,
    comment: row.comment,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function statsFromRow(row: any): RatingStats {
  return {
    avg: Number(row.avg_rating) || 0,
    count: row.review_count ?? 0,
    stars: [row.stars_1 ?? 0, row.stars_2 ?? 0, row.stars_3 ?? 0, row.stars_4 ?? 0, row.stars_5 ?? 0],
    comments: row.comment_count ?? 0,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const EMPTY_STATS: RatingStats = { avg: 0, count: 0, stars: [0, 0, 0, 0, 0], comments: 0 };

export function Stars({ value, size = 16, label }: { value: number; size?: number; label?: string }) {
  return (
    <span className="stars" role="img" aria-label={label ?? `${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="star" style={{ width: size, height: size }}>
            <Icon name="star" size={size} className="icon star-empty" />
            <span className="star-fill" style={{ width: `${fill * 100}%` }}>
              <Icon name="star" size={size} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

export function Reviews({ slug, initialStats }: { slug: string; initialStats?: RatingStats | null }) {
  const supabase = getSupabaseBrowser();
  const { enabled, loading: authLoading, user, signInWithGoogle } = useAuth();

  const [stats, setStats] = useState<RatingStats>(initialStats ?? EMPTY_STATS);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [mine, setMine] = useState<Review | null>(null);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const loadStats = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("summary_rating_stats").select("*").eq("summary_slug", slug).maybeSingle();
    setStats(data ? statsFromRow(data) : EMPTY_STATS);
  }, [supabase, slug]);

  const loadPage = useCallback(
    async (offset: number) => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("summary_reviews")
        .select("*")
        .eq("summary_slug", slug)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE);
      if (error) {
        setUnavailable(true);
        return;
      }
      const rows = (data ?? []).map(rowToReview);
      setHasMore(rows.length > PAGE);
      const pageRows = rows.slice(0, PAGE);
      setReviews((prev) => (offset === 0 ? pageRows : [...prev, ...pageRows.filter((r) => !prev.some((p) => p.id === r.id))]));
    },
    [supabase, slug],
  );

  // Public list + stats.
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void Promise.all([loadStats(), loadPage(0)]).finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [supabase, loadStats, loadPage]);

  // The signed-in learner's own review (prefills the form).
  useEffect(() => {
    if (!supabase || !user) {
      setMine(null);
      return;
    }
    void supabase
      .from("summary_reviews")
      .select("*")
      .eq("summary_slug", slug)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const r = data ? rowToReview(data) : null;
        setMine(r);
        setRating(r?.rating ?? 0);
        setComment(r?.comment ?? "");
      });
  }, [supabase, user, slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    if (rating < 1) {
      setMessage({ kind: "error", text: "Avval yulduzchani tanlang (1–5)." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const text = comment.trim().slice(0, MAX_COMMENT) || null;
    const res = mine
      ? await supabase.from("summary_reviews").update({ rating, comment: text }).eq("id", mine.id).select("*").single()
      : await supabase.from("summary_reviews").insert({ summary_slug: slug, rating, comment: text }).select("*").single();
    setSaving(false);
    if (res.error || !res.data) {
      setMessage({ kind: "error", text: "Saqlab bo‘lmadi. Birozdan keyin qayta urinib ko‘ring." });
      return;
    }
    const saved = rowToReview(res.data);
    setMine(saved);
    setEditing(false);
    setReviews((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
    setMessage({ kind: "ok", text: mine ? "Sharhingiz yangilandi." : "Rahmat! Fikringiz qabul qilindi." });
    track("review_submit", slug, { rating, hasComment: Boolean(text), updated: Boolean(mine) });
    void loadStats();
  };

  const remove = async () => {
    if (!supabase || !mine) return;
    if (!window.confirm("Sharhingizni o‘chirasizmi?")) return;
    setSaving(true);
    const { error } = await supabase.from("summary_reviews").delete().eq("id", mine.id);
    setSaving(false);
    if (error) {
      setMessage({ kind: "error", text: "O‘chirib bo‘lmadi." });
      return;
    }
    setReviews((prev) => prev.filter((r) => r.id !== mine.id));
    setMine(null);
    setRating(0);
    setComment("");
    setEditing(false);
    setMessage({ kind: "ok", text: "Sharhingiz o‘chirildi." });
    void loadStats();
  };

  const maxBar = useMemo(() => Math.max(1, ...stats.stars), [stats.stars]);
  const shown = hover || rating;
  const showForm = user && (!mine || editing);

  return (
    <section className="reviews" id="reviews" aria-labelledby="reviews-title">
      <h2 className="h3" id="reviews-title">
        <Icon name="star" size={20} /> Baholar va sharhlar
      </h2>

      <div className="reviews-grid">
        {/* ─── summary ─── */}
        <div className="rating-summary">
          <div className="rating-big">
            <strong>{stats.count ? stats.avg.toFixed(1) : "—"}</strong>
            <Stars value={stats.avg} size={18} />
            <span className="muted">{stats.count ? `${stats.count} ta baho` : "Hali baho yo‘q"}</span>
          </div>
          <ul className="rating-bars" aria-label="Baholar taqsimoti">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = stats.stars[n - 1];
              return (
                <li key={n}>
                  <span className="rating-bar-label">{n}</span>
                  <Icon name="star" size={12} />
                  <span className="rating-bar">
                    <span style={{ width: `${(c / maxBar) * 100}%` }} />
                  </span>
                  <span className="rating-bar-count">{c}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ─── form ─── */}
        <div className="review-form-wrap">
          {!enabled ? (
            <p className="muted">Sharhlar Supabase ulangan saytda ishlaydi (demo rejimda o‘chirilgan).</p>
          ) : unavailable ? (
            <p className="muted">Sharhlar hozircha mavjud emas.</p>
          ) : authLoading ? (
            <p className="muted">
              <span className="dot-pulse" /> Yuklanmoqda…
            </p>
          ) : !user ? (
            <div className="review-login">
              <p>
                <strong>Bu dars sizga yoqdimi?</strong> Baho va fikr qoldirish uchun hisobingizga kiring.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => signInWithGoogle(`${window.location.pathname}#reviews`)}>
                <Icon name="google" /> Google bilan kirish
              </button>
            </div>
          ) : showForm ? (
            <form className="review-form" onSubmit={submit}>
              <label className="field-label" id="rate-label">
                {mine ? "Bahoingizni o‘zgartiring" : "Bu dars sizga qanchalik foydali bo‘ldi?"}
              </label>
              <div className="star-input" role="radiogroup" aria-labelledby="rate-label" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} yulduz`}
                    className={n <= shown ? "is-on" : ""}
                    onMouseEnter={() => setHover(n)}
                    onFocus={() => setHover(n)}
                    onBlur={() => setHover(0)}
                    onClick={() => setRating(n)}
                  >
                    <Icon name="star" size={28} />
                  </button>
                ))}
                <span className="star-word" aria-live="polite">
                  {RATING_WORDS[shown]}
                </span>
              </div>
              <textarea
                className="review-textarea"
                value={comment}
                maxLength={MAX_COMMENT}
                rows={3}
                placeholder="Fikringizni yozing: nima yoqdi, nimani yaxshilash kerak? (ixtiyoriy)"
                aria-label="Sharh"
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="review-form-foot">
                <span className="muted tiny">
                  {comment.length}/{MAX_COMMENT}
                </span>
                <div className="review-form-actions">
                  {mine && (
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => setEditing(false)} disabled={saving}>
                      Bekor qilish
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving || rating < 1}>
                    {saving ? "Saqlanmoqda…" : mine ? "Yangilash" : "Yuborish"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            mine && (
              <div className="review-mine">
                <p className="field-label">Sizning bahoingiz</p>
                <Stars value={mine.rating} size={20} />
                {mine.comment && <p className="review-text">{mine.comment}</p>}
                <div className="review-form-actions">
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => setEditing(true)}>
                    Tahrirlash
                  </button>
                  <button type="button" className="btn btn-soft btn-sm" onClick={remove} disabled={saving}>
                    <Icon name="trash" size={16} /> O‘chirish
                  </button>
                </div>
              </div>
            )
          )}
          {message && (
            <p className={`review-message${message.kind === "error" ? " is-error" : ""}`} role="status">
              {message.text}
            </p>
          )}
        </div>
      </div>

      {/* ─── list ─── */}
      {enabled && !unavailable && (
        <div className="review-list">
          {loading ? (
            <p className="muted">
              <span className="dot-pulse" /> Sharhlar yuklanmoqda…
            </p>
          ) : reviews.length === 0 ? (
            <p className="muted">Hali sharh yo‘q — birinchi bo‘lib fikr qoldiring!</p>
          ) : (
            <ul>
              {reviews.map((r) => (
                <li key={r.id} className="review">
                  <div className="review-head">
                    {r.authorAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="review-avatar" src={r.authorAvatar} alt="" width={36} height={36} referrerPolicy="no-referrer" />
                    ) : (
                      <span className="review-avatar is-letter" aria-hidden>
                        {(r.authorName ?? "B").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <strong>
                        {r.authorName ?? "Bookly o‘quvchisi"}
                        {user?.id === r.userId && <span className="review-you"> (siz)</span>}
                      </strong>
                      <span className="review-meta">
                        <Stars value={r.rating} size={13} /> · {formatDate(r.createdAt)}
                        {r.updatedAt && r.updatedAt.slice(0, 16) !== r.createdAt.slice(0, 16) && " · tahrirlangan"}
                      </span>
                    </div>
                  </div>
                  {r.comment && <p className="review-text">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
          {hasMore && (
            <button type="button" className="btn btn-soft btn-sm" onClick={() => void loadPage(reviews.length)}>
              Yana ko‘rsatish
            </button>
          )}
        </div>
      )}
    </section>
  );
}
