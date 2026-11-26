"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";

export function LoginCard({ next, error, aiEnabled = false }: { next: string; error: boolean; aiEnabled?: boolean }) {
  const { enabled, user, loading, signInWithGoogle, signInError } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  return (
    <div className="login-card">
      <LogoMark size={56} />
      <h1>Bookly’ga xush kelibsiz</h1>
      <p className="muted">Hisob shart emas — lekin u bilan progressingiz hamma qurilmada saqlanadi.</p>

      {error && (
        <p className="alert" role="alert">
          Kirishda xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.
        </p>
      )}

      {signInError && (
        <p className="alert" role="alert">
          {signInError}
        </p>
      )}

      {enabled ? (
        <button
          type="button"
          className="btn btn-google btn-lg btn-block"
          disabled={loading || busy}
          onClick={async () => {
            setBusy(true);
            await signInWithGoogle(next);
            // Native sign-in resolves here when cancelled or failed (web sign-in navigates away).
            setBusy(false);
          }}
        >
          <Icon name="google" size={22} /> {busy ? "Google’ga yo‘naltirilmoqda…" : "Google bilan davom etish"}
        </button>
      ) : (
        <p className="alert alert-info">Demo rejim: Supabase hali ulanmagan. README’dagi qadamlarni bajaring — Google orqali kirish avtomatik yoqiladi.</p>
      )}

      <ul className="login-benefits">
        <li>
          <Icon name="sync" size={18} /> Telefon va kompyuterda bir xil progress
        </li>
        <li>
          <Icon name="bookmark" size={18} /> Saqlangan darslar va natijalar
        </li>
        {aiEnabled && (
          <li>
            <Icon name="sparkle" size={18} /> AI yordamchi: jumlalarni o‘zbekcha tushuntirish
          </li>
        )}
      </ul>
      <p className="tiny muted">
        Davom etish orqali siz <Link href="/terms">Foydalanish shartlari</Link> va <Link href="/privacy">Maxfiylik siyosati</Link>ga rozilik bildirasiz. Bookly bilan faqat ism, email va profil rasmingiz ulashiladi — parolingizni hech qachon so‘ramaymiz.
      </p>
      <Link href="/library" className="link-btn">
        Hisobsiz davom etish →
      </Link>
    </div>
  );
}
