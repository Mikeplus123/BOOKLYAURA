// Lessons that live in the repository. They are the source of truth for these slugs:
// on every Vercel build `scripts/sync-content.ts` pushes them into Supabase automatically.
// Add a lesson: put `<slug>.json` here (export it from /admin → "JSON eksport"), put its audio in
// `public/audio/<slug>.mp3`, and add one import line below.
import type { SummaryDocument } from "@/lib/types";
import atomicHabits from "./atomic-habits.json";
import sevenHabits from "./7-habits-of-highly-effective-people.json";
import winFriends from "./how-to-win-friends-and-influence-people.json";

export const LOCAL_SUMMARIES = [atomicHabits, sevenHabits, winFriends] as unknown as SummaryDocument[];
