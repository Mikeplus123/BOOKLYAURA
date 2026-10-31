# Bookly — Big ideas. Five minutes.

Bookly is an Uzbek-first app for reading and listening to short nonfiction summaries, with bilingual English practice.

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres, Google auth, storage, row-level security) · Claude API for the AI tools. There is no CSS framework: the design system lives in `app/globals.css`.

The app also runs **without any setup** in demo mode. It uses the local demo lessons and saves progress in the browser. Connect Supabase to turn on Google sign-in, cross-device sync, Premium gating and the admin panel.

```bash
npm install
npm run dev        # http://localhost:3000
```

---

## What's included

| Area | Where | Notes |
|---|---|---|
| Landing page | `app/(site)/page.tsx` | Hero "5 daqiqada katta g‘oyalar.", a live bilingual demo, how it works, modes, topics, Premium teaser, FAQ |
| Library | `/library` | Search, topic chips, level filter, free-only toggle. Cards show title, author, duration, level, languages and progress |
| Summary page | `/s/[slug]` | Intro, "what you'll learn", start options (read+listen / read / listen), continue, save, Premium lock |
| Reader / player | `/s/[slug]/learn` | See "Bilingual reader" below |
| Practice | `/s/[slug]/practice` | 3 comprehension questions with feedback, vocabulary flashcards, takeaway, score saved |
| My library | `/me` | Continue, saved, completed, stats and sync status |
| Account | `/login` | Google sign-in (Supabase OAuth with PKCE) |
| Premium | `/premium` | Plans, transparent terms and a "notify me" interest list (a willingness-to-pay signal) |
| Admin | `/admin` | Lesson editor, AI lesson builder, audio upload, tap-to-sync timing, validation, publish/free toggles, JSON import/export, MVP metrics |

### Bilingual reader

- **Text modes:** *Ikki tilda* (English plus Uzbek under each sentence), *Inglizcha* (English only; tap to reveal Uzbek) and *O‘zbekcha* (Uzbek only, with English audio). You can switch modes during playback without losing your place.
- **Study formats:** read + listen (the current sentence is highlighted and auto-scrolled), read only (audio paused, reading position saved) and listen only (large controls, no text).
- **Sentence tools:** tap a sentence to replay it, replay it slowly, play from there, reveal its translation, or ask the AI to explain it in Uzbek. Tap an underlined vocabulary word to see its meaning, an example and its pronunciation.
- **Player:** play/pause, previous/next sentence, a seekable progress bar, speed (0.75×–1.5×), loop the current sentence, and keyboard shortcuts (Space, ←/→, R, L).
- **Comfort:** text size, Light / Warm / Dark / Auto themes, and resume where you left off.
- **Audio engines:**
  1. A narrated audio file with sentence timings (best).
  2. Audio without timings: it plays, but sentences are not highlighted.
  3. No audio yet: the browser's English voice reads each sentence, so the demo works today.

### AI tools (Claude)

1. **"Tushuntir" (learner):** explains one sentence in Uzbek, with a meaning, a simpler English version, key phrases and a grammar note.
   - The server looks the sentence up itself, so the Premium paywall still applies.
   - Sign-in is required.
   - Daily limits are enforced in Postgres: 15 per day on the free plan, 100 on Premium.
   - Answers are cached per sentence, so repeat questions cost nothing.
2. **Lesson builder (admin):** paste the final English summary and its Uzbek translation. Claude then:
   - splits the English into sentences **without rewording it** and aligns the Uzbek by meaning;
   - writes section headings, 6–8 vocabulary items, 3 questions, a takeaway, an intro and "what you'll learn";
   - flags any translation it wrote itself in yellow for human review.

The model is `claude-opus-5-5` by default. You can change it with `BOOKLY_AI_MODEL`; for example, `claude-haiku-5-5` lowers the cost of explanations. Server-side refusal fallback is enabled.

### Account sync

Progress, saved lessons, practice results and preferences are **local-first** (`lib/store.ts`), so guests can use everything.

- **On sign-in:** local and server data are merged; the newest change wins and completion is never lost. A guest's progress moves into their account.
- **After that:** every change is pushed to Supabase within about 1.5 seconds, and also when the tab is hidden or closed.

---

## Connect Supabase + Google sign-in (≈15 minutes)

1. **Create a project** at [supabase.com](https://supabase.com).
2. **Run the schema:** open the SQL editor and run `supabase/migrations/0001_bookly_init.sql`. It creates:
   - tables and row-level security (RLS) policies;
   - the profile trigger;
   - premium/admin helper functions and the AI quota function;
   - the `audio` storage bucket.
3. **Turn on Google:**
   1. In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID** (type: Web application).
   2. Add the authorised redirect URI `https://<your-project>.supabase.co/auth/v1/callback`.
   3. In Supabase → Authentication → Providers → **Google**, turn it on and paste the client ID and secret.
   4. In Supabase → Authentication → URL Configuration:
      - set **Site URL** to your production URL;
      - add **Redirect URLs**: `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`.
4. **Set environment variables:** copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `ANTHROPIC_API_KEY`
5. **Load the demo lessons:** run `npm run seed`.
6. **Make yourself an admin:** sign in once, then run in SQL:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
7. **Give someone Premium by hand** (until payments are connected):
   ```sql
   insert into public.subscriptions (user_id, status, provider, current_period_end)
   select id, 'active', 'manual', now() + interval '30 days' from auth.users where email = 'student@example.com';
   ```

## Adding the real summaries

For each book:

1. Open `/admin` and choose **Yangi dars**.
2. Fill in **1. Ma’lumot**: title, author, topic, level, and the attribution / permission note.
3. In **2. AI yordamchi**, paste the final English text and the Uzbek translation, then press **Darsni tuzish**.
4. In **3. Matn va tarjima**, review every yellow (AI-translated) line.
5. In **4. Audio va sinxron**, upload the MP3, press **Boshlash**, and tap **Space** at the start of each sentence. Fine-tune with the ±0.1s buttons and ▶.
6. In **5. Lug‘at va savollar**, check the vocabulary, questions and takeaway.
7. In **6. Tekshirish va saqlash**, resolve any errors, choose free or Premium, publish and save.

Lessons can also live as JSON in `content/summaries/` (same shape as the demos; see `lib/types.ts`). Use **JSON eksport** in the editor to produce them, and `npm run seed` to upload.

## Deploying

- **Vercel (simplest):** import the repo and add the env vars from `.env.example`. That's it.
- **Cloudflare:** use the OpenNext adapter (`@opennextjs/cloudflare`). Supabase stays the database and auth provider.

## Scripts

```bash
npm run dev         # local development
npm run build       # production build
npm run typecheck   # TypeScript
npm test            # unit tests: sync/timing helpers + validation of every bundled lesson
npm run seed        # upload content/summaries/*.json to Supabase
```

## Project map

```
app/(site)/…            landing, library, summary, me, login, premium, admin
app/(study)/s/[slug]/…  reader (learn) and practice — focused layout without site chrome
app/api/ai/…            explain (learner) and build (admin) endpoints
components/reader/      Player, usePlayback (audio/speech engines), SentenceBlock
components/admin/       Editor, TimingTool, AdminList
lib/                    types, text helpers, content loading, local-first store + sync, Supabase clients, AI
supabase/migrations/    database schema, RLS, storage
content/summaries/      demo lessons (original Bookly demos, not summaries of real books)
```

## MVP metrics

The `events` table records `session_start`, `summary_complete`, `practice_complete`, `mode_change`, `ai_explain`, `premium_view` and `premium_interest`. The admin dashboard shows 30-day sessions, completions, completion rate and Premium interest.

Repeat use and comprehension can be queried from `events` and `practice_results`.

---

Bookly is a Supernova’s project. Summaries introduce and explain a book’s ideas; they do not replace the full book. Every published summary needs accurate attribution and appropriate content permissions.
