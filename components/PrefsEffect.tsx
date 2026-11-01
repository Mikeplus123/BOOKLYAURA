"use client";
import { useEffect } from "react";
import { useBookly } from "@/lib/store";

/** Applies the learner's theme and text size to <html> (and keeps them in sync across tabs/devices). */
export function PrefsEffect() {
  const theme = useBookly((s) => s.prefs.theme);
  const textSize = useBookly((s) => s.prefs.textSize);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved = theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
      root.dataset.theme = resolved;
    };
    apply();
    root.dataset.textSize = String(textSize);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, textSize]);
  return null;
}
