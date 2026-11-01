import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { validateContent } from "../lib/text.ts";
import type { SummaryDocument } from "../lib/types.ts";

// Every bundled lesson must pass validation before it can ship.
const dir = new URL("../content/summaries/", import.meta.url);
const lessonFiles = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "retired.json");
const index = readFileSync(new URL("index.ts", dir), "utf8");
for (const file of lessonFiles) {
  test(`content/summaries/${file} is valid`, () => {
    const doc = JSON.parse(readFileSync(new URL(file, dir), "utf8")) as SummaryDocument;
    assert.match(doc.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.equal(`${doc.slug}.json`, file);
    const errors = validateContent(doc.content).filter((i) => i.level === "error");
    assert.deepEqual(errors, []);
    for (const q of doc.content.questions) assert.ok(q.answer >= 0 && q.answer < q.options.length);
    assert.ok(index.includes(`./${file}"`), `${file} is not imported in content/summaries/index.ts`);
    const audio = doc.content.audio?.url;
    if (audio?.startsWith("/")) assert.ok(existsSync(new URL(`../public${audio}`, import.meta.url)), `missing audio file public${audio}`);
  });
}

import { flattenSentences, tokenize } from "../lib/text.ts";

for (const file of lessonFiles) {
  test(`${file}: every vocabulary word appears in the text, timings fit the audio`, () => {
    const doc = JSON.parse(readFileSync(new URL(file, dir), "utf8")) as SummaryDocument;
    const flat = flattenSentences(doc.content.sections);
    doc.content.vocab.forEach((v, i) => {
      const found = flat.some((s) => tokenize(s.en, doc.content.vocab).some((t) => t.vocab === i));
      assert.ok(found, `vocab "${v.term}" never appears in the lesson text`);
    });
    if (doc.content.audio?.durationSec) {
      const last = flat[flat.length - 1];
      assert.ok((last.start ?? 0) < doc.content.audio.durationSec, "last sentence starts after the audio ends");
      for (const s of flat) assert.ok(s.end === undefined || s.end > (s.start ?? 0), `${s.id}: end before start`);
    }
  });
}
