# Google Play Console — what to fill in

Everything Play Console asks for before the first release, with the answers for Bookly.
Graphics are in `store/` (regenerate with `node scripts/store-assets.cjs`).

## 0. Order of work
1. Create the app (name **Bookly**, default language **Uzbek – uz**, App, Free*, accept declarations).
   *"Free" is correct even with a subscription: the app download is free.
2. Finish **App content** (section 3) and **Store listing** (section 2).
3. Upload the first `.aab` to **Internal testing** (you + team, instant) → test the checklist in `ANDROID_RELEASE.md`.
4. **Closed testing** — required for personal developer accounts created after Nov 2023:
   **at least 12 testers opted in for 14 days in a row** before you can apply for production.
   Organisation accounts skip this. Start it as early as possible.
5. Apply for production access (Dashboard), answer the short questionnaire about the test, then roll out.

## 1. Closed test plan (12 testers × 14 days)
- Create an email list in Play Console → Testing → Closed testing → Testers (Google accounts of 15–20
  people, so you stay above 12 if a few drop out). Share the opt-in link in a Telegram group.
- Testers must **install and keep** the app for 14 days; ask them to open it a few times a week.
- Collect feedback in the group and ship at least one update during the test (Google asks what you changed).
- Production-access form answers to prepare: how you recruited testers, what feedback you got, what you fixed.

## 2. Main store listing
**App name** (max 30 characters): `Bookly: kitob g‘oyalari`

**Short description** (80):
- uz: `Kitoblarning asosiy g‘oyalari 5 daqiqada: o‘qing, tinglang, ingliz tilini o‘rganing`
- en: `Big book ideas in 5 minutes. Read, listen and practise English in Uzbek.`
- ru: `Главные идеи книг за 5 минут: читайте, слушайте и учите английский`

**Full description** (uz):
```
Bookly — mashhur nonfiction kitoblarning eng muhim g‘oyalarini 5 daqiqada o‘rganing.

📚 Qisqa darslar — har bir dars asosiy g‘oyalar, hayotiy misol va bitta amaliy qadam.
🎧 Tinglang — diktor ovozi, matn jumlama-jumla belgilanadi. Ekran o‘chiq bo‘lsa ham ijro davom etadi.
🇺🇿🇬🇧 Ikki tilda — inglizcha matn va o‘zbekcha (yoki ruscha) tarjima yonma-yon.
✨ AI yordamchi — tushunmagan jumlani bosing, o‘zbekcha tushuntirish oling.
🃏 Mashqlar — savollar va suriladigan so‘z kartalari bilan yangi so‘zlarni yodlang.
📥 Oflayn — darslarni yuklab oling va internetsiz tinglang.
🔔 Eslatmalar — har kuni tanlagan vaqtingizda 5 daqiqalik dars.
🔥 Seriya — har kungi o‘rganish odatingizni kuzating.

Bepul darslar doim bepul. Premium butun kutubxonani, barcha mashqlarni va ko‘proq AI tushuntirishlarni ochadi.

Bookly darslari kitob g‘oyalarini tanishtiradi va tushuntiradi — ular to‘liq kitobning o‘rnini bosmaydi.
Supernova’s jamoasi loyihasi.
```
**Full description** (en):
```
Learn the most important ideas of popular nonfiction books in 5 minutes — made for Uzbek speakers.

📚 Short lessons — key ideas, a real-life example and one practical step.
🎧 Listen — narrated audio with sentence-by-sentence highlighting. Keeps playing with the screen off.
🇺🇿🇬🇧 Bilingual — English text side by side with Uzbek (or Russian) translation.
✨ AI helper — tap any sentence for a simple explanation in Uzbek.
🃏 Practice — quiz questions and swipeable vocabulary cards.
📥 Offline — download lessons and listen without internet.
🔔 Reminders — a daily 5-minute lesson at the time you choose.
🔥 Streaks — track your daily learning habit.

Free lessons stay free. Premium unlocks the full library, all exercises and more AI explanations.
Bookly summaries introduce and explain a book’s ideas; they don’t replace the full book.
```
**Graphics:** `store/icon-512.png`, `store/feature-graphic.png` (1024×500), phone screenshots
`store/screenshot-*.png` (1080×2160). Upload 4–8 phone screenshots; tablet screenshots are optional.
**Category:** Education. **Tags:** Books, Language learning, Education.
**Contact details:** email (required) = `NEXT_PUBLIC_SUPPORT_EMAIL`, website = your domain.
**Privacy policy URL:** `https://your-domain/privacy`

## 3. App content (Policy → App content)

| Section | Answer |
| --- | --- |
| Privacy policy | `https://your-domain/privacy` |
| Ads | **No**, the app does not contain ads |
| App access | "All or some functionality is restricted" → **No restrictions**: everything except sync/AI works without an account. (If asked for a login: provide a test Google account with Premium.) |
| Content ratings (IARC) | Category **Reference, News, or Educational**. Violence/sexuality/language/drugs: No. **Users can interact / share content: Yes** (public reviews). Shares location: No. Digital purchases: **Yes**. Expected rating: Everyone / 3+ (PEGI 3) |
| Target audience | **13–15, 16–17, 18+** (do **not** select under 13 — that brings in the Families policy) |
| News app | No |
| COVID-19 / Health | No |
| Data safety | See section 4 |
| Government app | No |
| Financial features | None |
| Account deletion | In-app: My lessons → Settings → Delete account. Web URL: `https://your-domain/account/delete` |
| Foreground service (if asked) | `mediaPlayback` — "Plays the lesson narration the user started, with lock-screen controls, while the screen is off." Provide a short screen recording. |
| Photo/video, exact alarm, location permissions | Not used |

## 4. Data safety form
**Does your app collect or share user data?** Yes. **Encrypted in transit?** Yes. **Users can request deletion?** Yes.

| Data type | Collected | Shared | Optional? | Purposes |
| --- | --- | --- | --- | --- |
| Personal info → Name | Yes | No | Optional (only with Google sign-in) | App functionality, Account management |
| Personal info → Email address | Yes | No | Optional | App functionality, Account management, Developer communications (waitlist) |
| Personal info → User IDs | Yes | No | Optional | App functionality, Account management |
| Photos and videos → Photos | No* | — | — | *Profile photo is a URL from Google, not a photo upload. Declare under "Other user-generated content" only if Play asks. |
| App activity → App interactions | Yes | No | Required | Analytics, App functionality |
| App activity → Other user-generated content (reviews, reports) | Yes | No | Optional | App functionality |
| App info and performance → Crash logs / Diagnostics | No (add if you add crash reporting) | | | |
| Financial info → Purchase history | Yes | No | Optional | App functionality (Premium status) |
| Device or other IDs | Yes (random anonymous app ID) | No | Required | Analytics |

"Shared" means transferred to a third party for its own use. Supabase, Google Play/RevenueCat and Anthropic
process data **on Bookly’s behalf** (service providers), which Play does **not** count as sharing.

## 5. Things to double-check before submitting
- The website is live on HTTPS at `BOOKLY_APP_URL`, `/privacy`, `/terms`, `/account/delete` load without login.
- `/.well-known/assetlinks.json` returns your SHA-256 fingerprint (App Links).
- Support email set (`NEXT_PUBLIC_SUPPORT_EMAIL`) — it appears in the Privacy Policy.
- A moderator checks `/admin` → Shikoyatlar daily (the Terms promise 24 hours).
- Lesson content: original summaries only, no copied book text; covers are Bookly’s own artwork.
