# Bookly Android app — setup, build and release

The Android app is a Capacitor 8 shell (`android/`) that loads the live website (`BOOKLY_APP_URL`)
and adds native features through plugins. Deploying the website updates the app instantly; you only
upload a new build to Google Play when native code, plugins, icons or permissions change.

| Native feature | Where |
| --- | --- |
| Google Sign-In (native account picker → Supabase) | `lib/native/auth.ts` |
| Lock-screen / notification player, background audio | `components/reader/useMediaSession.ts` |
| Full-screen "Now playing", swipe to skip, sleep timer | `components/reader/NowPlaying.tsx` |
| Daily reminders (local notifications, 14-day rolling schedule) | `lib/native/reminders.ts` |
| Haptics (taps, answers, swipes) | `lib/native/haptics.ts` |
| Offline downloads (service worker + IndexedDB) | `public/sw.js`, `lib/offline.ts`, `/offline` |
| Google Play Billing (RevenueCat) | `lib/native/billing.ts`, `app/api/billing/*` |
| Back button, deep links, external links, splash, status bar | `components/native/NativeBridge.tsx` |
| Pull to refresh | `components/native/PullToRefresh.tsx` |

The app identifies itself with `BooklyApp/1.0` in its user agent (`lib/platform.ts`), so the server can
render app-specific pages (e.g. Premium via Google Play only) and hide `/admin`.

---

## 1. One-time setup

### 1.1 Decide the package name — it can never change
`uz.bookly.app` is set in `capacitor.config.ts`, `android/app/build.gradle` and `lib/platform.ts`.
Change it **before** the first upload if you want something else (e.g. `uz.supernovas.bookly`).

### 1.2 Database
Run `supabase/migrations/0004_reports_and_app.sql` in the Supabase SQL editor (after 0001–0003).

### 1.3 Environment variables (website hosting, e.g. Vercel)

| Variable | Value | Needed for launch? |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain` | **Yes** |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Public support email (shown in Privacy Policy and Play listing) | **Yes** |
| `NEXT_PUBLIC_SUPPORT_TELEGRAM` | `https://t.me/your_support` | Recommended |
| `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Cloud **Web** OAuth client ID (the one Supabase uses) | **Yes** (sign-in in the app) |
| `ANDROID_SHA256_CERT_FINGERPRINTS` | Play app-signing SHA-256 (+ upload key), comma-separated | After creating the app in Play Console |
| `ANTHROPIC_API_KEY` | Claude API key — turns on "Tushuntir" (AI explanations) | Later (hidden until set) |
| `NEXT_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat public Android SDK key (`goog_…`) | Later (Premium) |
| `NEXT_PUBLIC_REVENUECAT_ENTITLEMENT` | `premium` | Later |
| `REVENUECAT_SECRET_KEY` | RevenueCat secret API key (`sk_…`), server only | Later |
| `REVENUECAT_WEBHOOK_AUTH` | Long random string; same value in the RevenueCat webhook | Later |
| `NEXT_PUBLIC_ANDROID_LIVE` | `true` once the app is public (shows "Get the app" on the web) | After launch |

### 1.4 Google Sign-In for the app
1. Google Cloud Console → APIs & Services → Credentials → **Create credentials → OAuth client ID → Android**.
   Package name `uz.bookly.app`, SHA-1 of the **Play app-signing key** (Play Console → Test and release →
   App integrity → App signing). Add a second Android client with your **upload key** SHA-1 for local builds.
2. Keep using the existing **Web** client ID in `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` — the ID token's audience
   is the web client, which Supabase already trusts (Authentication → Providers → Google).
3. Nothing else: no redirect URL is needed for the native flow.

### 1.5 Google Play Billing (Premium)
1. Play Console → Monetize → Products → **Subscriptions** → create `bookly_premium` with a monthly base plan
   (optional: a 7-day free trial offer). Requires a payments profile.
2. RevenueCat → new project → Google Play app (`uz.bookly.app`) → upload the Play service-account JSON
   (RevenueCat docs walk you through it) → Entitlement `premium` → attach `bookly_premium` → Offering
   `default` with a **Monthly** package.
3. RevenueCat → Integrations → **Webhooks** → URL `https://your-domain/api/billing/revenuecat`,
   Authorization header = `REVENUECAT_WEBHOOK_AUTH`.
4. Until these keys are set, the app's Premium page shows the "I'm interested" list (no prices, no payments).

### 1.6 Signing key
```bash
keytool -genkeypair -v -keystore bookly-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
```
Create `android/keystore.properties` (git-ignored):
```
storeFile=../bookly-upload.jks
storePassword=…
keyAlias=upload
keyPassword=…
```
Back up the `.jks` file and passwords somewhere safe (password manager + offline copy). With Play App Signing
Google holds the real signing key, but you need this upload key for every update.

---

## 2. Build

Requirements on the build machine: Node 22, JDK 21, Android Studio (SDK 36).

```bash
npm ci
BOOKLY_APP_URL=https://your-domain npm run android:sync
BOOKLY_APP_HOST=your-domain npm run android:bundle
```
The signed bundle is at `android/app/build/outputs/bundle/release/app-release.aab`.

- Test on a device: `npm run android:open` → Run ▶ in Android Studio (debug), or
  `BOOKLY_DEBUG=1 BOOKLY_APP_URL=… npx cap sync android` to enable `chrome://inspect`.
- Icons/splash: edit `assets/*.png`, then `npm run android:assets`.
- Before every upload: bump `versionCode` (always +1) and `versionName` in `android/app/build.gradle`.

## 3. Test checklist (real device, release build)
- [ ] Fresh install → splash → home; status bar icons readable in light and dark theme
- [ ] Google sign-in (account picker), sign-out, sign in with another account
- [ ] Start a lesson → lock the phone → narration keeps playing; lock-screen shows cover, title, ⏮ ⏯ ⏭, seek bar
- [ ] Bluetooth headset play/pause works; notification disappears after leaving the lesson
- [ ] Full player: swipe cover left/right, swipe down to close, sleep timer fades out and pauses
- [ ] Download a lesson → airplane mode → reopen the app → lesson plays from "Yuklab olinganlar"
- [ ] Reminders: enable (permission prompt), set a time 2 min ahead, notification arrives, tap opens the lesson
- [ ] Practice: flashcards swipe right/left with vibration; quiz answers vibrate
- [ ] Back button closes sheets/player first, then navigates back, then minimises on home
- [ ] Report a review, hide a user, report an AI explanation; reports appear in /admin (desktop)
- [ ] Account tab → Delete account works; Privacy/Terms open
- [ ] Premium: subscribe with a licence-test account, restore purchases, "Manage subscription" opens Play
- [ ] Links to Telegram/email open outside the app; a shared `https://your-domain/s/...` link opens in the app
