"use client";
// Pull down at the top of a page to refresh it (Android app only — browsers have their own).
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { haptic } from "@/lib/native/haptics";
import { isNativeApp } from "@/lib/platform";

const TRIGGER = 78;

export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || document.documentElement.classList.contains("sheet-open") || e.touches.length !== 1) return;
      startY.current = e.touches[0].clientY;
      armed.current = false;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        setPull(0);
        return;
      }
      const d = Math.min(120, dy * 0.5);
      setPull(d);
      if (d >= TRIGGER && !armed.current) {
        armed.current = true;
        haptic("select");
      } else if (d < TRIGGER) armed.current = false;
    };
    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      if (armed.current) {
        setRefreshing(true);
        haptic("medium");
        router.refresh();
        window.setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 900);
      } else setPull(0);
      armed.current = false;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  if (!pull && !refreshing) return null;
  const shown = refreshing ? TRIGGER : pull;
  return (
    <div className={`ptr${refreshing ? " is-refreshing" : ""}${shown >= TRIGGER ? " is-armed" : ""}`} style={{ transform: `translate(-50%, ${shown}px)` }} aria-hidden>
      <span style={{ transform: refreshing ? undefined : `rotate(${shown * 3}deg)` }}>
        <Icon name="sync" size={20} />
      </span>
    </div>
  );
}
