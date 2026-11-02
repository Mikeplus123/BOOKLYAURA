import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { PremiumActions } from "@/components/PremiumActions";
import { WaitlistForm } from "@/components/WaitlistForm";
import { PREMIUM_PRICE_UZS, SUPPORT_TELEGRAM, formatUzs } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Premium",
  description: "Bookly Premium: kengroq kutubxona, barcha mashqlar va ko‘proq AI tushuntirishlar. Shaffof narx va istalgan vaqtda bekor qilish.",
};

const FREE = ["Bir nechta to‘liq bepul dars", "O‘qish, tinglash va ikki tilli rejim", "Mashqlar (bepul darslarda)", "Kuniga 15 ta AI tushuntirish", "Progressni qurilmalararo saqlash"];
const PREMIUM = ["Butun kutubxona — har oy yangi darslar", "Barcha darslarda mashq va lug‘at", "Kuniga 100 ta AI tushuntirish", "Yangi darslarga birinchilardan kirish", "Mavzuli o‘quv to‘plamlari (tez orada)"];

export default function PremiumPage() {
  return (
    <main id="main" className="container page">
      <header className="page-head center">
        <p className="eyebrow eyebrow-gold">Premium</p>
        <h1 className="page-title">Ko‘proq g‘oyalar. Ko‘proq amaliyot.</h1>
        <p className="page-lead">Bookly’ni avval bepul sinab ko‘ring. Foydali bo‘lsa — Premium bilan butun kutubxonani oching.</p>
      </header>

      <div className="plans">
        <article className="plan">
          <h2>Bepul</h2>
          <p className="plan-price">
            0 so‘m <small>doim</small>
          </p>
          <ul>
            {FREE.map((f) => (
              <li key={f}>
                <Icon name="check" size={18} /> {f}
              </li>
            ))}
          </ul>
        </article>
        <article className="plan plan-premium">
          <span className="plan-ribbon" aria-hidden />
          <h2>
            Premium <span className="badge badge-premium">Oylik</span>
          </h2>
          <p className="plan-price">
            {PREMIUM_PRICE_UZS ? (
              <>
                {formatUzs(PREMIUM_PRICE_UZS)} <small>/ oy</small>
              </>
            ) : (
              <>
                Sinov narxi <small>tez orada e’lon qilinadi</small>
              </>
            )}
          </p>
          <ul>
            {PREMIUM.map((f) => (
              <li key={f}>
                <Icon name="check" size={18} /> {f}
              </li>
            ))}
          </ul>
          <PremiumActions />
        </article>
      </div>

      <section className="premium-waitlist" aria-labelledby="pw-title">
        <h2 className="h3" id="pw-title">
          Rasmiy ishga tushishni kutyapsizmi?
        </h2>
        <p className="muted">Bookly hozir beta. Email qoldiring — Premium va to‘liq kutubxona ochilganda xabar beramiz.</p>
        <WaitlistForm source="premium" compact />
      </section>

      <section className="terms" aria-labelledby="terms-title">
        <h2 className="h3" id="terms-title">
          Shaffof shartlar
        </h2>
        <div className="terms-grid">
          <div>
            <Icon name="sync" />
            <h3>Yangilanish</h3>
            <p>Obuna har oy avtomatik yangilanadi. Yangilanishdan oldin eslatma yuboramiz.</p>
          </div>
          <div>
            <Icon name="close" />
            <h3>Bekor qilish</h3>
            <p>Istalgan vaqtda bekor qiling — to‘langan davr oxirigacha Premium ishlayveradi.</p>
          </div>
          <div>
            <Icon name="lock" />
            <h3>Xavfsiz to‘lov</h3>
            <p>To‘lov mahalliy to‘lov tizimlari orqali amalga oshiriladi. Karta ma’lumotlari Bookly’da saqlanmaydi.</p>
          </div>
          <div>
            <Icon name="info" />
            <h3>Yordam</h3>
            <p>
              Savollar bo‘lsa,{" "}
              <a href={SUPPORT_TELEGRAM} target="_blank" rel="noreferrer">
                Telegram orqali
              </a>{" "}
              yozing — odatda bir kun ichida javob beramiz.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
