import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SummaryCard } from "@/components/SummaryCard";
import { BilingualDemo } from "@/components/landing/BilingualDemo";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getCatalog } from "@/lib/content";
import { TOPICS } from "@/lib/types";

const STEPS = [
  { n: "1", title: "Mavzuni tanlang", text: "Odatlar, o‘qish, samaradorlik, muloqot yoki biznes — har bir dars davomiyligi va ingliz tili darajasi bilan." },
  { n: "2", title: "O‘qing yoki tinglang", text: "Inglizcha audio jumlama-jumla belgilanadi, ostida esa o‘zbekcha tarjima turadi." },
  { n: "3", title: "Mashq qiling", text: "3 ta qisqa savol, foydali so‘zlar va hayotda qo‘llash uchun bitta amaliy qadam." },
];

const MODES = [
  { title: "Ikki tilda o‘rganish", audio: "Inglizcha audio", text: "Inglizcha jumla va uning ostida o‘zbekcha tarjima", tag: "Boshlash uchun" },
  { title: "Ingliz tili amaliyoti", audio: "Inglizcha audio", text: "Faqat inglizcha matn — kerak bo‘lsa tarjimani bosib oching", tag: "Ishonch ortganda" },
  { title: "O‘zbekcha yordam", audio: "Inglizcha audio", text: "Faqat o‘zbekcha tarjima — quloq inglizchaga o‘rganadi", tag: "Ma’noni ushlash" },
];

const WAYS = [
  { icon: "book", title: "Faqat o‘qish", text: "Audio to‘xtab turadi, o‘z tezligingizda o‘qiysiz. Tarjima doim yoningizda." },
  { icon: "headphones", title: "Faqat tinglash", text: "Ekranga qaramasdan tinglang — takrorlash va tezlik tugmalari bilan." },
  { icon: "both", title: "O‘qib tinglash", text: "Diktor gapirayotgan jumla belgilanadi va ekran o‘zi unga suriladi." },
  { icon: "repeat", title: "Takrorlab mashq", text: "Avval o‘zbekcha yordam bilan, keyin qiyin joyni faqat inglizcha matn bilan qayta tinglang." },
];

const FAQ = [
  { q: "Ro‘yxatdan o‘tishim shartmi?", a: "Yo‘q. Bepul namunani darhol boshlashingiz mumkin. Hisob (Google orqali) faqat progressingizni turli qurilmalarda saqlash va AI yordamchidan foydalanish uchun kerak." },
  { q: "Qisqacha mazmun kitobning o‘rnini bosadimi?", a: "Yo‘q. Bookly kitobning asosiy g‘oyalarini tanishtiradi va tushuntiradi. G‘oya yoqsa, to‘liq kitobni o‘qishni tavsiya qilamiz." },
  { q: "Ingliz tilim yaxshi emas. Menga mos keladimi?", a: "Ha. Har bir darsda daraja ko‘rsatilgan, tezlikni pasaytirish, jumlani qayta tinglash va o‘zbekcha tarjimani ko‘rish mumkin. Qiyin so‘zlarni bosib izohini ko‘rasiz." },
  { q: "Premium nimani beradi?", a: "Kengroq kutubxona, barcha mashqlar va ko‘proq AI tushuntirishlar. Narx va shartlar to‘lovdan oldin aniq ko‘rsatiladi; obunani istalgan vaqtda bekor qilish mumkin." },
  { q: "Bookly hozir qaysi bosqichda?", a: "Bookly hozir beta (sinov) bosqichida: darslar bepul, fikr-mulohazalaringiz asosida yaxshilanmoqda. Rasmiy ishga tushish haqida xabar olish uchun kutish ro‘yxatiga yoziling." },
  { q: "Rus tili ham bo‘ladimi?", a: "Talab va kontent imkoniyatlariga qarab keyinroq qo‘shiladi. Hozir asosiy e’tibor o‘zbek tiliga qaratilgan." },
];

export default async function HomePage() {
  const catalog = await getCatalog();
  const firstFree = catalog.find((s) => s.isFree);
  const sampleHref = firstFree ? `/s/${firstFree.slug}/learn` : "/library";

  return (
    <main id="main">
      {/* ─── hero ─── */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow eyebrow-pill">
              <span className="pulse-dot" aria-hidden /> Beta · O‘zbek tilida · ingliz tili amaliyoti bilan
            </p>
            <h1 className="hero-title">
              5 daqiqada <span className="hl">katta g‘oyalar.</span>
            </h1>
            <p className="hero-sub">Kitoblarning asosiy g‘oyalarini o‘qing, tinglang va ingliz tilini mashq qiling.</p>
            <div className="hero-ctas">
              <Link href={sampleHref} className="btn btn-primary btn-lg">
                <Icon name="play" /> Bepul namunani boshlash
              </Link>
              <Link href="/library" className="btn btn-ghost btn-lg">
                Kutubxonani ko‘rish <Icon name="arrow" />
              </Link>
            </div>
            <ul className="hero-trust">
              <li>
                <Icon name="check" size={16} /> Ro‘yxatdan o‘tmasdan
              </li>
              <li>
                <Icon name="clock" size={16} /> ~5 daqiqalik darslar
              </li>
              <li>
                <Icon name="globe" size={16} /> EN audio + UZ matn
              </li>
            </ul>
          </div>
          <div className="hero-demo">
            <BilingualDemo />
          </div>
        </div>
      </section>

      {/* ─── problem → solution ─── */}
      <section className="section">
        <div className="container">
          <div className="problem">
            <div>
              <p className="eyebrow">Nega Bookly?</p>
              <h2 className="section-title">Foydali bilim bor. Vaqt, ingliz tili va sabr yetishmaydi.</h2>
            </div>
            <ul className="problem-list">
              <li>
                <span>📖</span> Kitoblar uzun, ular uchun vaqt topish qiyin
              </li>
              <li>
                <span>🇬🇧</span> Ingliz tilidagi matn har jumlada tarjimonni talab qiladi
              </li>
              <li>
                <span>📱</span> Internetdagi kontent tarqoq va ishonchsiz
              </li>
              <li className="is-answer">
                <span>✨</span> Bookly: bitta g‘oya, bitta qisqa dars, aniq tushuncha
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── how it works ─── */}
      <section className="section section-tint" aria-labelledby="how-title">
        <div className="container">
          <p className="eyebrow">Qanday ishlaydi</p>
          <h2 className="section-title" id="how-title">
            Tanlang → tushuning → qo‘llang
          </h2>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.n} className="step">
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── bilingual modes ─── */}
      <section className="section" aria-labelledby="modes-title">
        <div className="container">
          <p className="eyebrow">Ikki tilli o‘rganish</p>
          <h2 className="section-title" id="modes-title">
            Inglizchani eshiting, ma’nosini o‘zbekcha tushuning
          </h2>
          <p className="section-lead">Boshlanishda o‘zbekcha yordamdan ko‘proq foydalaning, ishonch ortgan sari uni kamaytiring. Rejimni tinglash davomida almashtirsangiz ham, joyingiz yo‘qolmaydi.</p>
          <div className="modes">
            {MODES.map((m, i) => (
              <article key={m.title} className="mode-card">
                <span className="mode-tag">{m.tag}</span>
                <h3>{m.title}</h3>
                <dl>
                  <div>
                    <dt>Audio</dt>
                    <dd>{m.audio}</dd>
                  </div>
                  <div>
                    <dt>Ekranda</dt>
                    <dd>{m.text}</dd>
                  </div>
                </dl>
                <div className={`mode-visual mode-visual-${i}`} aria-hidden>
                  {i !== 2 && <span className="mv-en">Small habits lead to big changes.</span>}
                  {i !== 1 && <span className="mv-uz">Kichik odatlar katta o‘zgarishlarga olib keladi.</span>}
                  {i === 1 && <span className="mv-reveal">Tarjimani ko‘rish</span>}
                </div>
              </article>
            ))}
          </div>
          <div className="ways">
            {WAYS.map((w) => (
              <div key={w.title} className="way">
                <span className="way-icon">
                  <Icon name={w.icon} />
                </span>
                <div>
                  <h3>{w.title}</h3>
                  <p>{w.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="help-strip">
            <p>
              <strong>Qiyin joy bormi?</strong> Jumlani bosing: qayta tinglang, sekinlashtiring, tarjimasini oching yoki <span className="ai-chip"><Icon name="sparkle" size={14} /> AI</span> dan o‘zbekcha tushuntirish so‘rang. Belgilangan so‘zni bossangiz — ma’nosi va misol: <em>habit → odat</em>.
            </p>
          </div>
        </div>
      </section>

      {/* ─── featured ─── */}
      {catalog.length > 0 && (
        <section className="section section-tint" aria-labelledby="featured-title">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">Kutubxonadan</p>
                <h2 className="section-title" id="featured-title">
                  Bugun boshlash uchun
                </h2>
              </div>
              <Link href="/library" className="btn btn-ghost">
                Hammasi <Icon name="arrow" />
              </Link>
            </div>
            <div className="grid-cards">
              {catalog.slice(0, 4).map((s) => (
                <SummaryCard key={s.slug} meta={s} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── topics ─── */}
      <section className="section" aria-labelledby="topics-title">
        <div className="container">
          <p className="eyebrow">Mavzular</p>
          <h2 className="section-title" id="topics-title">
            Hayotda kerak bo‘ladigan bilimlar
          </h2>
          <div className="topics">
            {TOPICS.map((t) => (
              <Link key={t.id} href={`/library?topic=${t.id}`} className="topic">
                <span className="topic-emoji" aria-hidden>
                  {t.emoji}
                </span>
                <span>
                  <strong>{t.uz}</strong>
                  <small lang="en">{t.en}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── premium teaser ─── */}
      <section className="section">
        <div className="container">
          <div className="premium-teaser">
            <div>
              <p className="eyebrow eyebrow-gold">Premium</p>
              <h2 className="section-title">Avval sinab ko‘ring. Yoqsa — davom eting.</h2>
              <p>Bir nechta to‘liq dars doim bepul. Premium kengroq kutubxona, barcha mashqlar va ko‘proq AI tushuntirishlarni ochadi. Yashirin to‘lovlar yo‘q: narx, yangilanish va bekor qilish shartlari oldindan ko‘rsatiladi.</p>
            </div>
            <Link href="/premium" className="btn btn-gold btn-lg">
              Premium haqida <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── waitlist ─── */}
      <section className="section" id="waitlist" aria-labelledby="waitlist-title">
        <div className="container">
          <div className="waitlist-card">
            <div className="waitlist-copy">
              <p className="eyebrow eyebrow-gold">Kutish ro‘yxati</p>
              <h2 className="section-title" id="waitlist-title">
                Bookly hozir beta. Rasmiy ishga tushishni o‘tkazib yubormang.
              </h2>
              <p>Beta darslar hozir bepul. Ro‘yxatga yozilsangiz, to‘liq kutubxona va Premium ochilganda birinchilardan bo‘lib xabar olasiz.</p>
              <ul className="waitlist-perks">
                <li>
                  <Icon name="star" size={16} /> Rasmiy ishga tushish haqida birinchi bo‘lib xabar
                </li>
                <li>
                  <Icon name="book" size={16} /> Yangi kitoblar qo‘shilganda xabar
                </li>
                <li>
                  <Icon name="check" size={16} /> Spam yo‘q — faqat muhim yangiliklar
                </li>
              </ul>
            </div>
            <WaitlistForm source="landing" />
          </div>
        </div>
      </section>

      {/* ─── faq ─── */}
      <section className="section section-tint" aria-labelledby="faq-title">
        <div className="container narrow">
          <p className="eyebrow">Savollar</p>
          <h2 className="section-title" id="faq-title">
            Ko‘p beriladigan savollar
          </h2>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <Icon name="chevron-down" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── final cta ─── */}
      <section className="final-cta">
        <div className="container">
          <h2>Birinchi g‘oyani hoziroq o‘rganing</h2>
          <p>Bitta dars — taxminan 5 daqiqa. Ro‘yxatdan o‘tish shart emas.</p>
          <Link href={sampleHref} className="btn btn-gold btn-lg">
            <Icon name="play" /> Bepul namunani boshlash
          </Link>
        </div>
      </section>
    </main>
  );
}
