"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { markedJoined } from "./WaitlistForm";

const DISMISS_KEY = "bookly:betabar-dismissed";

/** Thin announcement bar: Bookly is in beta → join the launch waitlist. */
export function BetaBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const update = () => {
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        /* ignore */
      }
      setShow(!dismissed && !markedJoined());
    };
    update();
    window.addEventListener("bookly:waitlist", update);
    return () => window.removeEventListener("bookly:waitlist", update);
  }, []);

  if (!show) return null;
  return (
    <div className="beta-bar" role="region" aria-label="Beta haqida">
      <span className="beta-chip">BETA</span>
      <span className="beta-text">Bookly hozir sinov bosqichida. Rasmiy ishga tushishi haqida birinchi bo‘lib xabar oling.</span>
      <Link href="/#waitlist" className="beta-link">
        Kutish ro‘yxatiga yozilish <Icon name="arrow" size={16} />
      </Link>
      <button
        type="button"
        className="beta-close"
        aria-label="Yopish"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* ignore */
          }
          setShow(false);
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
