import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo size={26} />
          <p>5 daqiqada katta g‘oyalar. Kitoblarning asosiy g‘oyalarini o‘qing, tinglang va ingliz tilini mashq qiling.</p>
        </div>
        <nav className="footer-links" aria-label="Pastki havolalar">
          <Link href="/library">Kutubxona</Link>
          <Link href="/premium">Premium va narxlar</Link>
          <Link href="/me">Mening darslarim</Link>
          <Link href="/login">Kirish</Link>
        </nav>
        <p className="footer-note">
          Bookly qisqacha mazmunlari kitob g‘oyalarini tanishtiradi va tushuntiradi — ular to‘liq kitobning o‘rnini bosmaydi. Har bir dars mualliflik huquqiga rioya qilgan holda tayyorlanadi.
        </p>
        <p className="footer-copy">© {new Date().getFullYear()} Bookly · Supernova’s loyihasi</p>
      </div>
    </footer>
  );
}
