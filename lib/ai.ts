import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

// Claude powers two tools:
//  1. "Tushuntir" – explains one English sentence to an Uzbek learner (reader).
//  2. Content builder – turns an English summary + Uzbek translation into a structured lesson (admin).
// Default model is Claude Opus 5.5; override with BOOKLY_AI_MODEL (e.g. claude-haiku-5-5 for lower cost).

export const AI_MODEL = process.env.BOOKLY_AI_MODEL || "claude-opus-5-5";
export const isAIConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

// Server-side refusal fallback ("default" routes by refusal category). Supported by Opus/Sonnet 5.x and Fable.
const FALLBACK_MODELS = /^claude-(opus-5|sonnet-5-5|fable-5)/;
function fallbackParams() {
  return FALLBACK_MODELS.test(AI_MODEL)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
}

export class AIError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

function mapError(err: unknown): never {
  if (err instanceof AIError) throw err;
  if (err instanceof Anthropic.RateLimitError) throw new AIError("AI hozir band. Bir daqiqadan so‘ng qayta urinib ko‘ring.", 429);
  if (err instanceof Anthropic.AuthenticationError) throw new AIError("AI kaliti noto‘g‘ri sozlangan.", 503);
  if (err instanceof Anthropic.BadRequestError) throw new AIError("AI so‘rovi noto‘g‘ri tuzilgan.", 400);
  if (err instanceof Anthropic.APIError) throw new AIError("AI xizmatida xatolik yuz berdi. Keyinroq urinib ko‘ring.", 502);
  throw new AIError("AI bilan bog‘lanib bo‘lmadi.", 502);
}

// ─── 1. Sentence explanation ────────────────────────────────────────────────

export const ExplanationSchema = z.object({
  meaningUz: z.string().describe("What the sentence means, explained naturally in Uzbek (1–2 short sentences)."),
  simpleEn: z.string().describe("The same idea in simpler English (A2–B1 level)."),
  phrases: z
    .array(
      z.object({
        en: z.string().describe("A useful word or expression exactly as it appears in the sentence."),
        uz: z.string().describe("Its Uzbek meaning in this context."),
        note: z.string().describe("A very short Uzbek note on usage, or an empty string."),
      }),
    )
    .describe("1–4 of the most useful words or expressions for a learner."),
  grammarUz: z.string().describe("One short grammar observation in Uzbek, or an empty string if nothing notable."),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

const EXPLAIN_SYSTEM = `You are Bookly's English tutor for Uzbek-speaking students and young adults (roughly A2–B2 English).
A learner tapped one sentence from a short nonfiction lesson and asked for help understanding it.

Write all explanations in clear, natural Uzbek (Latin script, use ‘ for o‘ and g‘). Keep it short, friendly and concrete — the learner is in the middle of listening.
Explain meaning, not word-for-word translation. Pick the expressions that are genuinely useful to learn (phrasal verbs, collocations, idioms, tricky words) rather than easy words.
Only discuss the given sentence; use the surrounding sentences purely as context.`;

export async function explainSentence(input: {
  sentence: { en: string; uz: string };
  previous?: string;
  next?: string;
  title: string;
  level: string;
}): Promise<Explanation> {
  const userText = [
    `Lesson: "${input.title}" (learner level: ${input.level})`,
    input.previous ? `Previous sentence: ${input.previous}` : null,
    `Sentence to explain: ${input.sentence.en}`,
    `Existing Uzbek translation: ${input.sentence.uz || "(none)"}`,
    input.next ? `Next sentence: ${input.next}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      system: EXPLAIN_SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(ExplanationSchema) },
      messages: [{ role: "user", content: userText }],
      ...fallbackParams(),
    });
    if (response.stop_reason === "refusal") throw new AIError("Bu jumlani tushuntirib bo‘lmadi.", 422);
    if (!response.parsed_output) throw new AIError("AI javobini o‘qib bo‘lmadi. Qayta urinib ko‘ring.", 502);
    return response.parsed_output;
  } catch (err) {
    mapError(err);
  }
}

// ─── 2. Content builder (admin) ─────────────────────────────────────────────

export const BuiltLessonSchema = z.object({
  titleUz: z.string(),
  tagline: z.string().describe("One-line Uzbek hook for the card (max ~90 characters)."),
  intro: z.string().describe("2–3 sentence Uzbek introduction: what the learner will understand after this lesson."),
  learnPoints: z.array(z.string()).describe("3–4 Uzbek bullet points: 'what you will learn'."),
  sections: z.array(
    z.object({
      headingEn: z.string(),
      headingUz: z.string(),
      sentences: z.array(
        z.object({
          en: z.string().describe("One English sentence copied exactly from the source text."),
          uz: z.string().describe("The matching Uzbek sentence (meaning-for-meaning)."),
          uzGenerated: z.boolean().describe("true if you wrote or substantially changed this Uzbek translation yourself."),
        }),
      ),
    }),
  ),
  vocab: z
    .array(
      z.object({
        term: z.string().describe("Base form, lowercase unless a proper noun."),
        forms: z.array(z.string()).describe("Other forms of the term that appear in the text."),
        uz: z.string(),
        definition: z.string().describe("Simple English definition."),
        example: z.string().describe("A new, simple English example sentence."),
        exampleUz: z.string(),
      }),
    )
    .describe("6–8 useful vocabulary items that appear in the text."),
  questions: z
    .array(
      z.object({
        prompt: z.string().describe("Comprehension question in simple English."),
        promptUz: z.string(),
        options: z.array(z.string()).describe("Exactly 3 options in English."),
        optionsUz: z.array(z.string()).describe("Uzbek translations of the options, same order."),
        answer: z.number().describe("0-based index of the correct option."),
        explanationUz: z.string().describe("Short Uzbek explanation pointing to where the answer is in the text."),
      }),
    )
    .describe("Exactly 3 comprehension questions answerable from the text alone."),
  takeaway: z.object({ en: z.string(), uz: z.string() }).describe("One practical action the learner can try."),
  level: z.enum(["beginner", "elementary", "intermediate", "upper-intermediate", "advanced"]),
});
export type BuiltLesson = z.infer<typeof BuiltLessonSchema>;

const BUILD_SYSTEM = `You prepare lessons for Bookly, an Uzbek-first app where students read and listen to short nonfiction summaries in English with Uzbek support.

You receive an English summary text written by the Bookly team and, usually, its Uzbek translation. Turn them into a structured lesson.

Rules that matter most:
- The English text is final, human-reviewed content. Split it into sentences and copy every sentence exactly, in order, without rewording, merging, dropping or adding anything. Every part of the English text must appear once.
- Group sentences into short sections (3–8 sentences each). Use the author's headings if present; otherwise write brief, descriptive headings in English and Uzbek.
- Align the provided Uzbek translation to the English sentences by meaning. Translations follow meaning naturally; they need not match word for word. Use the human translation whenever it exists — only split or join its sentences to fit. If a sentence has no Uzbek equivalent, translate it yourself and set uzGenerated to true.
- Write Uzbek in Latin script, using ‘ for o‘ and g‘ (e.g. o‘zgarish, g‘oya).
- Vocabulary, questions and takeaway must be based only on the given text. Questions should check understanding of the main ideas, with one clearly correct option.
- Do not add facts or claims that are not in the source text.`;

export async function buildLesson(input: {
  title: string;
  author: string;
  englishText: string;
  uzbekText?: string;
  level?: string;
  notes?: string;
}): Promise<BuiltLesson> {
  const parts = [
    `Book / lesson title: ${input.title}`,
    `Author: ${input.author}`,
    input.level ? `Target English level: ${input.level}` : "Choose the most appropriate English level.",
    input.notes ? `Editor notes: ${input.notes}` : null,
    `<english_text>\n${input.englishText.trim()}\n</english_text>`,
    input.uzbekText?.trim()
      ? `<uzbek_translation>\n${input.uzbekText.trim()}\n</uzbek_translation>`
      : "No Uzbek translation was provided: translate every sentence yourself and mark uzGenerated true.",
  ].filter(Boolean);

  try {
    const stream = getClient().beta.messages.stream({
      model: AI_MODEL,
      max_tokens: 64000,
      system: BUILD_SYSTEM,
      output_config: { effort: "high", format: betaZodOutputFormat(BuiltLessonSchema) },
      messages: [{ role: "user", content: parts.join("\n\n") }],
      ...fallbackParams(),
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new AIError("AI bu matnni qayta ishlay olmadi.", 422);
    if (message.stop_reason === "max_tokens") throw new AIError("Matn juda uzun. Uni qismlarga bo‘lib yuboring.", 413);
    const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AIError("AI javobi JSON formatida emas. Qayta urinib ko‘ring.", 502);
    }
    const parsed = BuiltLessonSchema.safeParse(json);
    if (!parsed.success) throw new AIError("AI javobi kutilgan tuzilishga mos kelmadi.", 502);
    return parsed.data;
  } catch (err) {
    mapError(err);
  }
}
