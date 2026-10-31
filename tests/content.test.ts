import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { validateContent } from "../lib/text.ts";
import type { SummaryDocument } from "../lib/types.ts";

// Every bundled lesson must pass validation before it can ship.
const dir = new URL("../content/summaries/", import.meta.url);
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  test(`content/summaries/${file} is valid`, () => {
    const doc = JSON.parse(readFileSync(new URL(file, dir), "utf8")) as SummaryDocument;
    assert.match(doc.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.equal(`${doc.slug}.json`, file);
    const errors = validateContent(doc.content).filter((i) => i.level === "error");
    assert.deepEqual(errors, []);
    for (const q of doc.content.questions) assert.ok(q.answer >= 0 && q.answer < q.options.length);
  });
}
