"use client";
// The "Hisob" tab: who you are, your plan and sync status, then all settings.
import Image from "next/image";
import Link from "next/link";
import { useSyncStatus } from "@/lib/store";
import { AppSettings } from "./AppSettings";
import { useAuth } from "./AuthProvider";
import { Icon } from "./Icon";

const SYNC_LABEL = {
  local: "Faqat shu qurilmada saqlanmoqda",
  syncing: "Sinxronlanmoqda…",
  synced: "Barcha qurilmalaringizda saqlandi",
  error: "Sinxronlashda xatolik — keyinroq qayta urinamiz",
} as const;

export function AccountPanel() {
  const { enabled, loading, user, profile, isPremium, signInWithGoogle, signInError } = useAuth();
  const status = useSyncStatus();
  const name = profile?.display_name ?? user?.email ?? "";
  const avatar = profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined);

  return (
    <div className="account-panel">
      <section className="account-card">
        {!enabled ? (
          <div>
            <h2>Demo rejim</h2>
            <p className="muted">Progress shu qurilmada saqlanmoqda. Supabase ulanganda Google orqali kirish yoqiladi.</p>
          </div>
        ) : loading ? (
          <p className="muted">
            <span className="dot-pulse" /> Yuklanmoqda…
          </p>
        ) : user ? (
          <>
            <div className="account-user">
              {avatar ? <Image src={avatar} alt="" width={64} height={64} className="avatar account-avatar" /> : <span className="avatar avatar-letter account-avatar">{name[0]?.toUpperCase()}</span>}
              <div>
                <h2>{name}</h2>
                <p className="muted small">{user.email}</p>
              </div>
            </div>
            <div className="account-rows">
              <Link href="/premium" className="account-row">
                <Icon name="star" />
                <span>{isPremium ? "Premium a’zo" : "Bepul reja"}</span>
                {!isPremium && <span className="account-row-cta">Premium haqida</span>}
                <Icon name="arrow" />
              </Link>
              <div className="account-row">
                <Icon name="sync" />
                <span>{SYNC_LABEL[status]}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="account-signin">
            <h2>Hisobingizga kiring</h2>
            <p className="muted">Progress, saqlangan darslar va natijalar telefon va kompyuteringizda bir xil bo‘ladi.</p>
            {signInError && (
              <p className="alert" role="alert">
                {signInError}
              </p>
            )}
            <button type="button" className="btn btn-primary btn-block" onClick={() => signInWithGoogle("/account")}>
              <Icon name="google" /> Google bilan kirish
            </button>
          </div>
        )}
      </section>
      <AppSettings />
    </div>
  );
}
