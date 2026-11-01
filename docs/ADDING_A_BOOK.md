# Adding a book summary to Bookly

There are two ways to add a lesson. Both end up in Supabase and on the live site.

| | **A. Admin page** (no coding) | **B. Repository** (version-controlled, recommended for final lessons) |
|---|---|---|
| Where | `your-site/admin` | `content/summaries/<slug>.json` + `public/audio/<slug>.mp3` |
| Goes live | immediately on **Saqlash** | on the next push to `main` (Vercel build syncs it to Supabase) |
| Good for | drafting, quick fixes | the official version of each lesson |

---

## What you need for each book

1. **English narration text**, exactly as it is spoken in the audio.
2. **Uzbek translation**, in the same order (sentence-for-sentence by meaning).
3. **Audio file** (MP3).
4. Title, author, topic, level, and the attribution/rights note.

Mark sections with a heading line, in both texts if you like:

```
## Goals and systems | Maqsadlar va tizimlar
Clear distinguishes between goals and systems. A goal describes the result you want...
```

## A. Using the admin page

1. Open `/admin` and choose **Yangi dars**.
2. **1. Ma’lumot:** fill in the title, Uzbek title, author, slug, topic, level, cover colour, intro, "what you'll learn" points and the attribution note.
3. **2. Matn kiritish:** paste the English text and the Uzbek translation.
   - The preview shows how sentences pair up. Red means the counts differ in that section, so fix the text and the preview updates live.
   - When it all matches, press **Matnni darsga qo‘llash**.
4. **3. Matn va tarjima:** read through it and fix any sentence directly.
5. **4. Audio va sinxron:** press **Audio yuklash** to upload the MP3, then press **Avtomatik sinxronlash**.
   - Every sentence gets its start and end time in about 2 seconds.
   - Press ▶ on a few sentences to check them. Nudge any with − / + (0.1 s).
   - If the audio has music or no clear pauses, use the manual mode instead: press **Boshlash** and tap Space at the start of each sentence.
6. **5. Lug‘at va savollar:** add 6–8 vocabulary words (each must appear in the text), 3 questions and the takeaway.
7. **6. Tekshirish va saqlash:** fix any red items, choose **Bepul / Premium**, tick **Nashr qilish** and press **Saqlash**.

To keep a permanent copy in GitHub, press **JSON eksport** and follow B below.

## B. Adding it to the repository

1. Save the lesson as `content/summaries/<slug>.json`. **JSON eksport** from the admin page gives you this file.
2. Put the audio in `public/audio/<slug>.mp3` and set `"audio": { "url": "/audio/<slug>.mp3" }` in the JSON.
3. Add one import line to `content/summaries/index.ts`.
4. Run the checks:
   ```bash
   npm test
   ```
   They check that every sentence pairs up, that every vocabulary word appears in the text, that the timings fit the audio, that the file is registered and that the audio exists.
5. Commit and push to `main`. Vercel builds the site, and `scripts/sync-content.mts` copies the lesson into Supabase automatically.

### How the sync behaves

- A repository lesson is written to Supabase only when its JSON file **changed** since the last sync.
- If you edit a repository lesson in `/admin` and the JSON hasn't changed, your admin edits are kept. If you later change the JSON, the repository version wins.
- To delete a lesson that came from the repository:
  1. remove its JSON file and its import line;
  2. add its slug to `content/summaries/retired.json`.
- Commands:
  - `npm run sync` does the same as the build step.
  - `npm run seed` overwrites every repository lesson in Supabase.

Both need `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set, in `.env.local` locally or in Vercel's environment variables.

### Word-exact timing (optional)

The admin auto-sync is usually within a few hundredths of a second. For audio where it struggles, there is an exact, speech-recognition-based tool:

1. Install it once:
   ```bash
   pip install pocketsphinx
   ```
2. Run it on the lesson and its audio:
   ```bash
   python scripts/align-audio.py content/summaries/<slug>.json public/audio/<slug>.mp3
   ```
It writes start/end times into the JSON. If a name is unknown, it tells you which word, and you add a pronunciation with `--word aziz="AH Z IY Z"`.

## Rights checklist (before publishing)

- Show the attribution: an independent Bookly summary, the author credit, and that it is not endorsed.
- Keep a rights record for each title (licence or legal opinion).
- Have a native speaker review the Uzbek translation.
- Listen to the full audio track once and check names, missing words and clipped endings.
