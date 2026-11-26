import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccount } from "@/components/DeleteAccount";
import { SUPPORT_EMAIL, SUPPORT_TELEGRAM } from "@/lib/legal";

// Public page required by Google Play ("Delete account URL" in the Data safety form).
export const metadata: Metadata = {
  title: "Hisobni o‘chirish",
  description: "Bookly hisobingizni va unga bog‘liq barcha ma’lumotlarni o‘chirish. Delete your Bookly account and data.",
  alternates: { canonical: "/account/delete" },
};

export default function DeleteAccountPage() {
  return (
    <main id="main" className="container page legal">
      <header className="page-head">
        <p className="eyebrow">Hisob</p>
        <h1 className="page-title">Hisobni o‘chirish</h1>
        <p className="page-lead">Bookly hisobingizni va unga bog‘liq barcha ma’lumotlarni istalgan vaqtda butunlay o‘chirishingiz mumkin.</p>
      </header>

      <section className="legal-section">
        <h2>Qanday o‘chiriladi</h2>
        <ol>
          <li>Bookly ilovasi yoki saytida Google orqali hisobingizga kiring.</li>
          <li>Shu sahifada (yoki ilovada: Hisob bo‘limi) “Hisobni o‘chirish” tugmasini bosing.</li>
          <li>Tasdiqlang — hisob darhol o‘chiriladi.</li>
        </ol>
        <DeleteAccount />
      </section>

      <section className="legal-section">
        <h2>Nimalar o‘chiriladi</h2>
        <ul>
          <li>Profil: ism, email, profil rasmi;</li>
          <li>Progress, saqlangan darslar, mashq natijalari va sozlamalar;</li>
          <li>Baholar va sharhlaringiz;</li>
          <li>Statistika hodisalari, AI foydalanish tarixi va kutish ro‘yxatidagi yozuv.</li>
        </ul>
        <p>Ma’lumotlar darhol o‘chiriladi va zaxira nusxalardan 30 kun ichida yo‘qoladi. Xaridlar haqidagi yozuvlar qonun talab qilgan muddat saqlanishi mumkin. Siz yuborgan shikoyatlar moderatsiya uchun anonim holda qoladi.</p>
        <p>
          <strong>Premium obunangiz bo‘lsa:</strong> hisobni o‘chirish Google Play obunasini bekor qilmaydi. Avval Google Play → Profil → To‘lovlar va obunalar → Obunalar bo‘limida bekor qiling.
        </p>
      </section>

      {(SUPPORT_EMAIL || SUPPORT_TELEGRAM) && (
        <section className="legal-section">
          <h2>Hisobingizga kira olmayapsizmi?</h2>
          <p>
            Hisobingizga bog‘langan emaildan yozing, 7 kun ichida o‘chiramiz:{" "}
            {SUPPORT_EMAIL && <a href={`mailto:${SUPPORT_EMAIL}?subject=Bookly%20hisobini%20o%E2%80%98chirish`}>{SUPPORT_EMAIL}</a>}
            {SUPPORT_EMAIL && SUPPORT_TELEGRAM && " yoki "}
            {SUPPORT_TELEGRAM && (
              <a href={SUPPORT_TELEGRAM} target="_blank" rel="noreferrer">
                Telegram
              </a>
            )}
            .
          </p>
        </section>
      )}

      <hr className="legal-divider" />
      <section className="legal-section" lang="en">
        <h2>Delete your Bookly account (English)</h2>
        <p>
          Sign in with Google on this page or in the app (Account tab) and tap “Hisobni o‘chirish” (Delete account). Your profile, progress, saved lessons, practice results, reviews, analytics events, AI usage and waitlist entry are deleted immediately and removed from backups within 30 days. Deleting the account does not cancel a Google Play subscription — cancel it in Google Play first.
          {SUPPORT_EMAIL && <> If you can’t sign in, email {SUPPORT_EMAIL} from the address linked to your account and we will delete it within 7 days.</>}
        </p>
        <p>
          See also the <Link href="/privacy#english">Privacy Policy</Link>.
        </p>
      </section>
    </main>
  );
}
