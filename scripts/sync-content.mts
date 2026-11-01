// Sync repository lessons (content/summaries/*.json) into Supabase.
//
// Runs automatically before every build (`prebuild`), so: push to GitHub → Vercel deploy → Supabase updated.
// Run by hand any time:   npm run sync    (only new or changed lessons)
//                          npm run seed    (overwrite every repo lesson in Supabase)
//
// Rules
//  • A repo lesson is written to Supabase when it is new, or when its JSON file changed since the last sync.
//  • If the JSON did NOT change, edits made in /admin are kept (they are never overwritten silently).
//  • Slugs in content/summaries/retired.json are deleted from Supabase.
//  • Without NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY it does nothing (demo mode / local builds).
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

const force = process.argv.includes("--force");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.log("[sync-content] Skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.");
  process.exit(0);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const dir = new URL("../content/summaries/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "retired.json");
let failed = false;
const fail = (msg: string) => {
  console.error(`[sync-content] ✗ ${msg}`);
  failed = true;
};

for (const file of files) {
  const raw = readFileSync(new URL(file, dir), "utf8");
  const doc = JSON.parse(raw);
  const sourceHash = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  if (`${doc.slug}.json` !== file) {
    fail(`${file}: file name must be "<slug>.json" (slug is "${doc.slug}")`);
    continue;
  }

  const { data: existing, error: readErr } = await supabase.from("summaries").select("id").eq("slug", doc.slug).maybeSingle();
  if (readErr) {
    fail(`${doc.slug}: ${readErr.message}`);
    continue;
  }
  if (existing && !force) {
    const { data: c } = await supabase.from("summary_content").select("content").eq("summary_id", existing.id).maybeSingle();
    if (c?.content?.sourceHash === sourceHash) {
      console.log(`[sync-content] = ${doc.slug} (unchanged)`);
      continue;
    }
  }

  const row = {
    slug: doc.slug,
    title: doc.title,
    title_uz: doc.titleUz ?? "",
    author: doc.author,
    topic: doc.topic,
    duration_min: doc.durationMin,
    level: doc.level,
    languages: doc.languages,
    is_free: doc.isFree,
    is_published: doc.isPublished,
    cover_color: doc.coverColor,
    tagline: doc.tagline ?? "",
    intro: doc.intro ?? "",
    learn_points: doc.learnPoints ?? [],
    attribution: doc.attribution ?? "",
    sort_order: doc.sortOrder ?? 100,
  };
  const { data, error } = await supabase.from("summaries").upsert(row, { onConflict: "slug" }).select("id").single();
  if (error || !data) {
    fail(`${doc.slug}: ${error?.message}`);
    continue;
  }
  const res = await supabase.from("summary_content").upsert({ summary_id: data.id, content: { ...doc.content, sourceHash } });
  if (res.error) fail(`${doc.slug} content: ${res.error.message}`);
  else console.log(`[sync-content] ✓ ${doc.slug} ${existing ? "(updated)" : "(added)"}`);
}

const retiredPath = new URL("retired.json", dir);
if (existsSync(retiredPath)) {
  const { slugs = [] } = JSON.parse(readFileSync(retiredPath, "utf8")) as { slugs?: string[] };
  const keep = new Set(files.map((f) => f.replace(/\.json$/, "")));
  const toDelete = slugs.filter((s) => !keep.has(s));
  if (toDelete.length) {
    const { data, error } = await supabase.from("summaries").delete().in("slug", toDelete).select("slug");
    if (error) fail(`retire: ${error.message}`);
    else for (const r of data ?? []) console.log(`[sync-content] − ${r.slug} (removed)`);
  }
}

if (failed) {
  console.error("[sync-content] Some lessons failed to sync. Check the Supabase keys and that the migration has been run.");
  process.exit(1);
}
console.log("[sync-content] Done.");
