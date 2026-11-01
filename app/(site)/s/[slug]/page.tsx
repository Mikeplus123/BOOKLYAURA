import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/BookCover";
import { Icon } from "@/components/Icon";
import { SummaryActions } from "@/components/SummaryActions";
import { SummaryCard } from "@/components/SummaryCard";
import { getNextSuggestions, getSummary } from "@/lib/content";
import { flattenSentences } from "@/lib/text";
import { LANG_LABEL, levelLabel, topicLabel } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { summary } = await getSummary(slug);
  if (!summary) return { title: "Topilmadi" };
  return { title: summary.titleUz || summary.title, description: summary.tagline || summary.intro };
}

export default async function SummaryPage({ params }: Params) {
  const { slug } = await params;
  const { summary, viewer } = await getSummary(slug);
  if (!summary) notFound();
  const next = await getNextSuggestions(summary);
  const total = summary.content ? flattenSentences(summary.content.sections).length : 0;

  return (
    <main id="main" className="container page">
      <nav className="crumbs" aria-label="Yo‘l">
        <Link href="/library">Kutubxona</Link>
        <span aria-hidden>/</span>
        <Link href={`/library?topic=${summary.topic}`}>{topicLabel(summary.topic)}</Link>
      </nav>

      <div className="summary-hero">
        <div className="summary-cover">
          <BookCover meta={summary} size="lg" />
        </div>
        <div className="summary-info">
          <div className="badges">
            <span className={`badge ${summary.isFree ? "badge-free" : "badge-premium"}`}>{summary.isFree ? "Bepul" : "Premium"}</span>
            {summary.languages.map((l) => (
              <span key={l} className="lang">
                {LANG_LABEL[l]}
              </span>
            ))}
          </div>
          <h1 className="summary-title">{summary.titleUz || summary.title}</h1>
          {summary.titleUz && summary.titleUz !== summary.title && (
            <p className="summary-original" lang="en">
              {summary.title}
            </p>
          )}
          <p className="summary-author">{summary.author}</p>
          <ul className="facts">
            <li>
              <Icon name="clock" size={16} /> {summary.durationMin} daqiqa
            </li>
            <li>
              <Icon name="library" size={16} /> {topicLabel(summary.topic)}
            </li>
            <li>
              <Icon name="globe" size={16} /> Ingliz tili: {levelLabel(summary.level)}
            </li>
          </ul>
          {summary.tagline && <p className="summary-tagline">{summary.tagline}</p>}

          {summary.locked ? (
            <div className="locked">
              <Icon name="lock" size={22} />
              <div>
                <h2>Bu dars Premium a’zolar uchun</h2>
                <p>Bepul darslar bilan Bookly’ni sinab ko‘ring. Yoqsa, Premium bilan butun kutubxonani oching.</p>
                <div className="locked-actions">
                  <Link href="/premium" className="btn btn-gold">
                    Premiumni ko‘rish
                  </Link>
                  {isSupabaseConfigured && !viewer.userId && (
                    <Link href={`/login?next=/s/${slug}`} className="btn btn-soft">
                      Hisobga kirish
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <SummaryActions slug={slug} total={total} hasAudio={Boolean(summary.content?.audio?.url)} />
          )}
        </div>
      </div>

      <div className="summary-details">
        <section>
          <h2 className="h3">Bu dars haqida</h2>
          <p className="prose">{summary.intro}</p>
        </section>
        {summary.learnPoints.length > 0 && (
          <section>
            <h2 className="h3">Siz nimani o‘rganasiz</h2>
            <ul className="learn-points">
              {summary.learnPoints.map((p) => (
                <li key={p}>
                  <Icon name="check" size={18} /> {p}
                </li>
              ))}
            </ul>
          </section>
        )}
        {summary.content && (
          <section>
            <h2 className="h3">Darsdan keyin</h2>
            <p className="prose muted">
              {summary.content.questions.length} ta tushunish savoli · {summary.content.vocab.length} ta foydali so‘z · 1 ta amaliy qadam (ixtiyoriy)
            </p>
          </section>
        )}
        {summary.attribution && <p className="attribution">{summary.attribution}</p>}
      </div>

      {next.length > 0 && (
        <section className="section-tight" aria-labelledby="next-title">
          <h2 className="h3" id="next-title">
            Sizga yana yoqishi mumkin
          </h2>
          <div className="grid-cards">
            {next.map((s) => (
              <SummaryCard key={s.slug} meta={s} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
