// Upload every lesson in content/summaries/*.json to Supabase (insert or update by slug).
// Usage: npm run seed   (reads .env.local; needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set them in .env.local).");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const dir = new URL("../content/summaries/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const doc = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
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
    console.error(`✗ ${doc.slug}: ${error?.message}`);
    process.exitCode = 1;
    continue;
  }
  const res = await supabase.from("summary_content").upsert({ summary_id: data.id, content: doc.content });
  if (res.error) {
    console.error(`✗ ${doc.slug} content: ${res.error.message}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${doc.slug}`);
  }
}
