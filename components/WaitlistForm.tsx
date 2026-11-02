"use client";
// Launch waitlist: email (required) + optional name and Telegram. Stored via the join_waitlist() RPC.
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import { useAuth } from "./AuthProvider";
import { Icon } from "./Icon";

const JOINED_KEY = "bookly:waitlist";

export function markedJoined(): boolean {
  try {
    return localStorage.getItem(JOINED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberJoined() {
  try {
    localStorage.setItem(JOINED_KEY, "1");
    window.dispatchEvent(new Event("bookly:waitlist"));
  } catch {
    /* ignore */
  }
}

type State = "idle" | "saving" | "joined" | "already" | "error";

export function WaitlistForm({ source = "landing", compact = false }: { source?: string; compact?: boolean }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (markedJoined()) setState("already");
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.email) setEmail((e) => e || user.email!);
    const supabase = getSupabaseBrowser();
    supabase
      ?.rpc("on_waitlist")
      .then(({ data }) => {
        if (data === true) setState((s) => (s === "joined" ? s : "already"));
      });
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trap) return setState("joined"); // bot filled the hidden field
    setError(null);
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError("Kutish ro‘yxati hali ulanmagan (demo rejim).");
      return;
    }
    setState("saving");
    const { data, error: err } = await supabase.rpc("join_waitlist", {
      p_email: email,
      p_name: name || null,
      p_telegram: telegram || null,
      p_source: source,
    });
    if (err) {
      setState("error");
      if (err.message.includes("invalid_email")) setError("Email manzilini tekshiring, masalan: ism@gmail.com");
      else if (err.message.includes("invalid_telegram")) setError("Telegram username 4–32 ta lotin harfi, raqam yoki _ dan iborat bo‘lsin (masalan: @bookly_uz).");
      else if (err.code === "PGRST202" || err.message.includes("join_waitlist")) setError("Kutish ro‘yxati hali sozlanmagan. Keyinroq urinib ko‘ring.");
      else setError("Saqlab bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.");
      return;
    }
    rememberJoined();
    setState(data === "already" ? "already" : "joined");
    if (data !== "already") track("waitlist_join", undefined, { source, telegram: Boolean(telegram) });
  };

  if (state === "joined" || state === "already") {
    return (
      <div className="waitlist-done" role="status">
        <span className="waitlist-check" aria-hidden>
          <Icon name="check" />
        </span>
        <div>
          <strong>{state === "joined" ? "Ro‘yxatga qo‘shildingiz!" : "Siz kutish ro‘yxatidasiz"}</strong>
          <p>Bookly rasmiy ishga tushganda birinchilardan bo‘lib xabar beramiz. Hozircha beta darslardan bemalol foydalaning.</p>
        </div>
      </div>
    );
  }

  return (
    <form className={`waitlist-form${compact ? " is-compact" : ""}`} onSubmit={submit} noValidate={false}>
      <div className="waitlist-fields">
        <label className="waitlist-field waitlist-email">
          <span className="sr-only">Email</span>
          <input type="email" required autoComplete="email" inputMode="email" placeholder="Email manzilingiz" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {!compact && (
          <>
            <label className="waitlist-field">
              <span className="sr-only">Ismingiz (ixtiyoriy)</span>
              <input type="text" autoComplete="given-name" placeholder="Ismingiz (ixtiyoriy)" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="waitlist-field">
              <span className="sr-only">Telegram (ixtiyoriy)</span>
              <input type="text" autoComplete="off" placeholder="Telegram @username (ixtiyoriy)" maxLength={60} value={telegram} onChange={(e) => setTelegram(e.target.value)} />
            </label>
          </>
        )}
        <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" />
        <button type="submit" className="btn btn-gold" disabled={state === "saving"}>
          {state === "saving" ? "Saqlanmoqda…" : "Ro‘yxatga yozilish"}
        </button>
      </div>
      {error && (
        <p className="waitlist-error" role="alert">
          {error}
        </p>
      )}
      <p className="waitlist-note">Faqat ishga tushish va muhim yangiliklar haqida xabar beramiz. Spam yo‘q, istalgan vaqtda ro‘yxatdan chiqish mumkin.</p>
    </form>
  );
}
