"use client";
// Glue between the website and the Android shell. Renders nothing; runs once at startup.
//  • hides the splash screen, matches status/navigation bar icons to the theme
//  • Android back button: closes sheets/players first, then history back, then minimises the app
//  • deep links (App Links, bookly://, notification taps) navigate inside the app
//  • external links open in an in-app browser tab instead of replacing the app
//  • links Play Billing to the signed-in account, refreshes the reminder schedule
//  • registers the service worker (offline lessons) on web and in the app
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { runBackHandler } from "@/lib/native/back";
import { isNativeApp } from "@/lib/platform";
import { subscribe, getState } from "@/lib/store";
import { track } from "@/lib/track";

/** Turn an App Link / custom-scheme URL into an in-app path, or null if it isn't ours. */
function toAppPath(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol === "bookly:") {
      // bookly://s/atomic-habits → /s/atomic-habits
      const path = `/${u.host}${u.pathname}`.replace(/\/+$/, "") || "/";
      return path + u.search;
    }
    if (u.origin === window.location.origin) return u.pathname + u.search + u.hash;
  } catch {
    /* not a URL */
  }
  return null;
}

function resolvedTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function NativeBridge() {
  const router = useRouter();
  const { user } = useAuth();

  // ─── service worker (web + app) ───
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);

  // ─── native shell wiring ───
  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add("is-app");
    const cleanups: Array<() => void> = [];
    let cancelled = false;

    void (async () => {
      const [{ App }, { SplashScreen }, { SystemBars, SystemBarsStyle }, { Browser }, { LocalNotifications }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/splash-screen"),
        import("@capacitor/core"),
        import("@capacitor/browser"),
        import("@capacitor/local-notifications"),
      ]);
      if (cancelled) return;
      void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined);
      track("app_open");

      // Status-bar icons follow the reading theme (light icons on the dark theme).
      const syncBars = () => void SystemBars.setStyle({ style: resolvedTheme() === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
      syncBars();
      const themeObserver = new MutationObserver(syncBars);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      cleanups.push(() => themeObserver.disconnect());

      // Back button / gesture.
      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (runBackHandler()) return;
        const atRoot = window.location.pathname === "/";
        if (canGoBack && !atRoot) window.history.back();
        else void App.minimizeApp();
      });
      cleanups.push(() => void back.remove());

      // Deep links (App Links + bookly://).
      const open = await App.addListener("appUrlOpen", ({ url }) => {
        const path = toAppPath(url);
        if (path) router.push(path);
      });
      cleanups.push(() => void open.remove());

      // Tapping a reminder opens the lesson it talks about.
      const tap = await LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
        const url = (notification.extra as { url?: string } | undefined)?.url;
        if (url?.startsWith("/")) router.push(url);
      });
      cleanups.push(() => void tap.remove());

      // Resume: refresh the reminder schedule (rolling 14-day window, skip today if studied).
      const resume = await App.addListener("resume", () => {
        void import("@/lib/native/reminders").then((m) => m.refreshReminders());
      });
      cleanups.push(() => void resume.remove());
      void import("@/lib/native/reminders").then((m) => m.refreshReminders());

      // External links → in-app browser tab (Custom Tabs), so the learner never "leaves" Bookly.
      const onClick = (e: MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0) return;
        const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!a) return;
        const href = a.href;
        if (!/^https?:/i.test(href)) return; // mailto:, tel: → handled by Android
        const url = new URL(href);
        if (url.origin === window.location.origin) return;
        e.preventDefault();
        void Browser.open({ url: href, toolbarColor: resolvedTheme() === "dark" ? "#0C1714" : "#0B5D4B" });
      };
      document.addEventListener("click", onClick, true);
      cleanups.push(() => document.removeEventListener("click", onClick, true));
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, [router]);

  // ─── Play Billing follows the account ───
  useEffect(() => {
    if (!isNativeApp() || !user) return;
    void import("@/lib/native/billing").then((m) => m.billingLogIn(user.id));
  }, [user]);

  // ─── finishing a lesson today cancels today's reminder ───
  useEffect(() => {
    if (!isNativeApp()) return;
    let lastDone = Object.values(getState().progress).filter((p) => p.completedAt).length;
    return subscribe(() => {
      const done = Object.values(getState().progress).filter((p) => p.completedAt).length;
      if (done !== lastDone) {
        lastDone = done;
        void import("@/lib/native/reminders").then((m) => m.refreshReminders());
      }
    });
  }, []);

  return null;
}
