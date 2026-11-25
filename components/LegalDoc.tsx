import Link from "next/link";
import { LEGAL_UPDATED, type LegalSection } from "@/lib/legal";

function Sections({ sections, lang }: { sections: LegalSection[]; lang: "uz" | "en" }) {
  return (
    <div lang={lang}>
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="legal-section">
          <h2>{s.h}</h2>
          {s.p?.map((t, i) => <p key={i}>{t}</p>)}
          {s.ul && (
            <ul>
              {s.ul.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          {s.after?.map((t, i) => <p key={`after-${i}`}>{t}</p>)}
        </section>
      ))}
    </div>
  );
}

/** Shared layout for the Privacy Policy and Terms pages (Uzbek, then the English version). */
export function LegalDoc({ title, titleEn, uz, en }: { title: string; titleEn: string; uz: LegalSection[]; en: LegalSection[] }) {
  return (
    <main id="main" className="container page legal">
      <header className="page-head">
        <p className="eyebrow">Bookly</p>
        <h1 className="page-title">{title}</h1>
        <p className="muted small">
          Oxirgi yangilanish: {LEGAL_UPDATED} · <a href="#english">English version</a>
        </p>
        <nav className="legal-links" aria-label="Huquqiy hujjatlar">
          <Link href="/privacy">Maxfiylik siyosati</Link>
          <Link href="/terms">Foydalanish shartlari</Link>
          <Link href="/account/delete">Hisobni o‘chirish</Link>
        </nav>
      </header>
      <Sections sections={uz} lang="uz" />
      <hr className="legal-divider" />
      <h1 className="page-title" id="english" lang="en">
        {titleEn}
      </h1>
      <p className="muted small" lang="en">
        Last updated: {LEGAL_UPDATED}
      </p>
      <Sections sections={en} lang="en" />
    </main>
  );
}
