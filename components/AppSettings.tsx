"use client";
// "Sozlamalar" on My lessons: reminders, vibration, downloads, account, legal. In the Android app
// this is the settings screen Google Play reviewers look for (privacy policy + account deletion).
import Link from "next/link";
import { useEffect, useState } from "react";
import { SUPPORT_EMAIL, SUPPORT_TELEGRAM } from "@/lib/legal";
import { haptic } from "@/lib/native/haptics";
import { applyReminders, DEFAULT_REMINDER, getReminderSettings, type ReminderSettings } from "@/lib/native/reminders";
import { formatBytes, useOfflineLessons } from "@/lib/offline";
import { isNativeApp, PLAY_STORE_URL } from "@/lib/platform";
import { setPrefs, useBookly } from "@/lib/store";
import { track } from "@/lib/track";
import { useAuth } from "./AuthProvider";
import { DeleteAccount } from "./DeleteAccount";
import { Icon } from "./Icon";

const pad = (n: number) => String(n).padStart(2, "0");

export function AppSettings() {
  const { enabled, user, signOut } = useAuth();
  const hapticsOn = useBookly((s) => s.prefs.haptics !== false);
  const downloads = useOfflineLessons();
  const [native, setNative] = useState(false);
  const [touch, setTouch] = useState(false);
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const n = isNativeApp();
    setNative(n);
    setTouch(n || window.matchMedia("(pointer: coarse)").matches);
    setReminder(getReminderSettings());
    if (n) void import("@capacitor/app").then(({ App }) => App.getInfo().then((i) => setVersion(`${i.version} (${i.build})`)).catch(() => undefined));
  }, []);

  const updateReminder = async (next: ReminderSettings) => {
    setReminder(next);
    setReminderMsg(null);
    const res = await applyReminders(next);
    if (res === "denied") {
      haptic("warning");
      setReminder({ ...next, enabled: false });
      setReminderMsg("Bildirishnomalarga ruxsat berilmadi. Telefon sozlamalari → Ilovalar → Bookly → Bildirishnomalar bo‘limida yoqing.");
      return;
    }
    if (next.enabled) {
      haptic("success");
      setReminderMsg(`Har kuni ${pad(next.hour)}:${pad(next.minute)} da eslatamiz. Bugun dars qilsangiz, bugungisi yuborilmaydi.`);
    }
    track("reminder_set", undefined, { enabled: next.enabled, hour: next.hour });
  };

  const downloadedBytes = downloads?.reduce((a, l) => a + l.bytes, 0) ?? 0;

  return (
    <section className="settings" id="settings" aria-labelledby="settings-title">
      <h2 className="h3" id="settings-title">
        Sozlamalar
      </h2>

      <div className="settings-group">
        <div className="setting">
          <span className="setting-icon" aria-hidden>
            <Icon name="bell" />
          </span>
          <div className="setting-text">
            <strong>Kunlik eslatma</strong>
            <small>{native ? "Har kuni 5 daqiqalik dars uchun eslatma" : "Bookly Android ilovasida mavjud"}</small>
          </div>
          {native ? (
            <label className="toggle">
              <input type="checkbox" checked={reminder.enabled} onChange={(e) => void updateReminder({ ...reminder, enabled: e.target.checked })} aria-label="Kunlik eslatma" />
              <span className="toggle-ui" aria-hidden />
            </label>
          ) : process.env.NEXT_PUBLIC_ANDROID_LIVE === "true" ? (
            <a className="btn btn-soft btn-sm" href={PLAY_STORE_URL}>
              Ilovani olish
            </a>
          ) : null}
        </div>
        {native && reminder.enabled && (
          <div className="setting setting-sub">
            <div className="setting-text">
              <strong>Vaqt</strong>
            </div>
            <input
              type="time"
              className="time-input"
              value={`${pad(reminder.hour)}:${pad(reminder.minute)}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                if (Number.isFinite(h) && Number.isFinite(m)) void updateReminder({ ...reminder, hour: h, minute: m });
              }}
              aria-label="Eslatma vaqti"
            />
          </div>
        )}
        {reminderMsg && <p className="setting-note">{reminderMsg}</p>}

        {touch && (
          <div className="setting">
            <span className="setting-icon" aria-hidden>
              <Icon name="vibrate" />
            </span>
            <div className="setting-text">
              <strong>Tebranish</strong>
              <small>Tugmalar, javoblar va suruvlarda yengil tebranish</small>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={hapticsOn}
                onChange={(e) => {
                  setPrefs({ haptics: e.target.checked });
                  if (e.target.checked) haptic("medium");
                }}
                aria-label="Tebranish"
              />
              <span className="toggle-ui" aria-hidden />
            </label>
          </div>
        )}

        <Link href="/offline" className="setting setting-link">
          <span className="setting-icon" aria-hidden>
            <Icon name="download" />
          </span>
          <div className="setting-text">
            <strong>Yuklab olinganlar</strong>
            <small>{downloads?.length ? `${downloads.length} ta dars · ${formatBytes(downloadedBytes)}` : "Darslarni internetsiz tinglash uchun yuklab oling"}</small>
          </div>
          <Icon name="arrow" />
        </Link>
      </div>

      <div className="settings-group">
        {(SUPPORT_TELEGRAM || SUPPORT_EMAIL) && (
          <a className="setting setting-link" href={SUPPORT_TELEGRAM || `mailto:${SUPPORT_EMAIL}`} target={SUPPORT_TELEGRAM ? "_blank" : undefined} rel="noreferrer">
            <span className="setting-icon" aria-hidden>
              <Icon name="info" />
            </span>
            <div className="setting-text">
              <strong>Yordam va fikr-mulohaza</strong>
              <small>Odatda bir kun ichida javob beramiz</small>
            </div>
            <Icon name="arrow" />
          </a>
        )}
        <Link href="/privacy" className="setting setting-link">
          <span className="setting-icon" aria-hidden>
            <Icon name="shield" />
          </span>
          <div className="setting-text">
            <strong>Maxfiylik siyosati</strong>
          </div>
          <Icon name="arrow" />
        </Link>
        <Link href="/terms" className="setting setting-link">
          <span className="setting-icon" aria-hidden>
            <Icon name="file" />
          </span>
          <div className="setting-text">
            <strong>Foydalanish shartlari</strong>
          </div>
          <Icon name="arrow" />
        </Link>
      </div>

      {enabled && user && (
        <div className="settings-group settings-account">
          <button type="button" className="setting setting-link" onClick={() => signOut()}>
            <span className="setting-icon" aria-hidden>
              <Icon name="logout" />
            </span>
            <div className="setting-text">
              <strong>Chiqish</strong>
              <small>{user.email}</small>
            </div>
          </button>
          <div className="setting">
            <div className="setting-text">
              <strong>Hisobni o‘chirish</strong>
              <small>Hisob va barcha ma’lumotlar butunlay o‘chiriladi</small>
            </div>
            <DeleteAccount compact />
          </div>
        </div>
      )}

      <p className="muted tiny center">Bookly{version ? ` ${version}` : ""} · Supernova’s loyihasi</p>
    </section>
  );
}
