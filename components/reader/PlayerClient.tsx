"use client";
// The player depends on browser-only state (saved position, preferences, audio/speech APIs),
// so it renders on the client only. This avoids hydration mismatches and flashes of wrong state.
import dynamic from "next/dynamic";

const Player = dynamic(() => import("./Player"), {
  ssr: false,
  loading: () => (
    <div className="reader-loading" aria-busy="true">
      <span className="dot-pulse" /> Dars yuklanmoqda…
    </div>
  ),
});

export default Player;
