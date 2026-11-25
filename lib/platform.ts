// Where is Bookly running? Safe to import from client and server code (no Node or DOM imports).
//
// The Android app loads the live site inside a Capacitor WebView and appends APP_UA_TOKEN to the
// WebView's user agent (see capacitor.config.ts). That lets the server render app-specific pages
// (e.g. Google Play Billing instead of local payment providers) and lets client code detect the app
// even before the Capacitor bridge has loaded.

export const APP_UA_TOKEN = "BooklyApp";
/** Android application id (Play Store package name). Keep in sync with capacitor.config.ts. */
export const ANDROID_APP_ID = "uz.bookly.app";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_APP_ID}`;

/** True when a request's user agent comes from the Bookly Android app. */
export function isAppUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && userAgent.includes(APP_UA_TOKEN));
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

/** Client only: true inside the Bookly Android app. Returns false during SSR. */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  return isAppUserAgent(window.navigator.userAgent);
}
