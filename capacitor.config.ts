import type { CapacitorConfig } from "@capacitor/cli";

// Bookly Android app.
//
// The app loads the live Bookly site (BOOKLY_APP_URL) in a Capacitor WebView, so web and app are
// always in sync: a deploy of the website updates the app instantly, no store review needed.
// Native features (Google sign-in, lock-screen player, reminders, haptics, Play Billing, offline
// downloads) are added through Capacitor plugins that the website calls when it runs in the app.
//
// Build: BOOKLY_APP_URL=https://your-domain npx cap sync android   (see docs/ANDROID_RELEASE.md)

const APP_URL = (process.env.BOOKLY_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
if (!APP_URL.startsWith("https://")) {
  console.warn("\n⚠  BOOKLY_APP_URL is not an https:// URL. Set it to the production site before building a release.\n");
}

const config: CapacitorConfig = {
  // ⚠ The application id is permanent once published on Google Play.
  appId: "uz.bookly.app",
  appName: "Bookly",
  webDir: "mobile/www",
  // Lets the server and client detect the app (lib/platform.ts: APP_UA_TOKEN).
  appendUserAgent: "BooklyApp/1.0",
  backgroundColor: "#FBFAF6",
  server: {
    url: APP_URL || undefined,
    androidScheme: "https",
    cleartext: false,
    // Shown when the site can't be reached and nothing is cached yet (first launch offline).
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: false,
    // Enable chrome://inspect only in debug builds.
    webContentsDebuggingEnabled: process.env.BOOKLY_DEBUG === "1",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: "#FBFAF6",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    SystemBars: {
      // Edge-to-edge (required by Android 15+): the site pads itself with env(safe-area-inset-*).
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
    LocalNotifications: {
      smallIcon: "ic_stat_bookly",
      iconColor: "#0B5D4B",
    },
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false },
      logLevel: 1,
    },
  },
};

export default config;
