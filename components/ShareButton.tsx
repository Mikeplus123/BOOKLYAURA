"use client";
// Share a lesson: Android share sheet in the app, Web Share API on phones, copy-link elsewhere.
import { useState } from "react";
import { haptic } from "@/lib/native/haptics";
import { isNativeApp } from "@/lib/platform";
import { track } from "@/lib/track";
import { Icon } from "./Icon";

export function ShareButton({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    haptic("tap");
    const url = `${window.location.origin}/s/${slug}`;
    const text = `“${title}” — 5 daqiqada asosiy g‘oyalar. Bookly’da o‘qing va tinglang:`;
    try {
      if (isNativeApp()) {
        const { Share } = await import("@capacitor/share");
        await Share.share({ title, text, url, dialogTitle: "Darsni ulashish" });
      } else if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
      track("share", slug);
    } catch {
      /* cancelled */
    }
  };
  return (
    <button type="button" className="btn btn-soft" onClick={share}>
      <Icon name={copied ? "check" : "share"} /> {copied ? "Havola nusxalandi" : "Ulashish"}
    </button>
  );
}
