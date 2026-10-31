import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenSentences, hasTimings, sentenceAtTime, sentenceEnd, slugify, tokenize, validateContent } from "../lib/text.ts";
import type { SummaryContent } from "../lib/types.ts";

const sentences = [
  { id: "a", en: "Small habits lead to big changes.", uz: "Kichik odatlar...", start: 0 },
  { id: "b", en: "Repeat it every day.", uz: "Har kuni takrorlang.", start: 2.5 },
  { id: "c", en: "Results add up.", uz: "Natijalar yig‘iladi.", start: 5 },
];

test("sentenceAtTime finds the sentence playing at t", () => {
  assert.equal(sentenceAtTime(sentences, 0), 0);
  assert.equal(sentenceAtTime(sentences, 2.49), 1); // 50ms tolerance
  assert.equal(sentenceAtTime(sentences, 3), 1);
  assert.equal(sentenceAtTime(sentences, 99), 2);
  assert.equal(sentenceAtTime([], 1), -1);
});

test("sentenceEnd falls back to next start, then duration", () => {
  assert.equal(sentenceEnd(sentences, 0, 10), 2.5);
  assert.equal(sentenceEnd(sentences, 2, 10), 10);
  assert.equal(sentenceEnd([{ ...sentences[0], end: 1.8 }, sentences[1]], 0, 10), 1.8);
});

test("hasTimings requires ascending numeric starts", () => {
  assert.equal(hasTimings(sentences), true);
  assert.equal(hasTimings([sentences[1], sentences[0]]), false);
  assert.equal(hasTimings([{ id: "x", en: "a", uz: "b" }]), false);
});

test("tokenize marks vocabulary words, forms and phrases", () => {
  const vocab = [
    { term: "habit", forms: ["habits"], uz: "odat", example: "" },
    { term: "give up", forms: ["gave up"], uz: "taslim bo‘lmoq", example: "" },
  ];
  const t = tokenize("Habits matter, so never give up — inhabit nothing.", vocab);
  const marked = t.filter((x) => x.vocab !== undefined).map((x) => [x.text, x.vocab]);
  assert.deepEqual(marked, [
    ["Habits", 0],
    ["give up", 1],
  ]);
  assert.equal(t.map((x) => x.text).join(""), "Habits matter, so never give up — inhabit nothing.");
});

test("flattenSentences keeps order and section index", () => {
  const flat = flattenSentences([
    { id: "s1", heading: { en: "A", uz: "A" }, sentences: sentences.slice(0, 2) },
    { id: "s2", heading: { en: "B", uz: "B" }, sentences: sentences.slice(2) },
  ]);
  assert.deepEqual(flat.map((s) => [s.index, s.sectionIndex]), [
    [0, 0],
    [1, 0],
    [2, 1],
  ]);
});

test("validateContent catches broken lessons", () => {
  const content: SummaryContent = {
    sections: [{ id: "s1", heading: { en: "", uz: "" }, sentences: [sentences[0], { ...sentences[0] }] }],
    vocab: [],
    questions: [{ id: "q1", prompt: "?", promptUz: "?", options: ["a", "b"], answer: 5, explanationUz: "" }],
    takeaway: { en: "", uz: "" },
    audio: null,
  };
  const errors = validateContent(content).filter((i) => i.level === "error").map((i) => i.message);
  assert.ok(errors.some((m) => m.includes("takrorlangan")));
  assert.ok(errors.some((m) => m.includes("to‘g‘ri javob")));
});

test("slugify makes URL-safe slugs from Uzbek and English", () => {
  assert.equal(slugify("Kichik odatlar, katta o‘zgarishlar"), "kichik-odatlar-katta-ozgarishlar");
  assert.equal(slugify("  Atomic Habits!! "), "atomic-habits");
});
