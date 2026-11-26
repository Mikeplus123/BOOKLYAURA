"use client";
// Haptic feedback. Native vibration engine in the Android app (@capacitor/haptics),
// navigator.vibrate() on Android browsers, nothing elsewhere. Respects the learner's "Tebranish" setting.
import { getState } from "@/lib/store";
import { isNativeApp } from "@/lib/platform";

export type HapticKind = "tap" | "select" | "soft" | "medium" | "heavy" | "success" | "warning" | "error";

type HapticsModule = typeof import("@capacitor/haptics");
let mod: Promise<HapticsModule> | null = null;
const load = () => (mod ??= import("@capacitor/haptics"));

const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  select: 5,
  soft: 12,
  medium: 18,
  heavy: 30,
  success: [12, 60, 18],
  warning: [20, 80, 20],
  error: [30, 60, 30, 60, 30],
};

export function haptic(kind: HapticKind = "tap"): void {
  if (typeof window === "undefined") return;
  if (getState().prefs.haptics === false) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && kind !== "error") return;

  if (isNativeApp()) {
    void load()
      .then(({ Haptics, ImpactStyle, NotificationType }) => {
        switch (kind) {
          case "select":
            return Haptics.selectionChanged();
          case "tap":
          case "soft":
            return Haptics.impact({ style: ImpactStyle.Light });
          case "medium":
            return Haptics.impact({ style: ImpactStyle.Medium });
          case "heavy":
            return Haptics.impact({ style: ImpactStyle.Heavy });
          case "success":
            return Haptics.notification({ type: NotificationType.Success });
          case "warning":
            return Haptics.notification({ type: NotificationType.Warning });
          case "error":
            return Haptics.notification({ type: NotificationType.Error });
        }
      })
      .catch(() => undefined);
    return;
  }
  // Only phones/tablets: desktop browsers either ignore this or buzz a gamepad.
  if (typeof navigator.vibrate === "function" && window.matchMedia?.("(pointer: coarse)").matches) {
    try {
      navigator.vibrate(WEB_PATTERNS[kind]);
    } catch {
      /* blocked (no user gesture yet) */
    }
  }
}
