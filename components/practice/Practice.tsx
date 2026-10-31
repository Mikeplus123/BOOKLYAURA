"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { savePractice, useBookly } from "@/lib/store";
import { track } from "@/lib/track";
import type { Question, SummaryContent, VocabItem } from "@/lib/types";

type Step = "questions" | "vocab" | "done";

export default function Practice({ slug, title, content }: { slug: string; title: string; content: SummaryContent }) {
  const { questions, vocab, takeaway } = content;
  const [step, setStep] = useState<Step>(questions.length ? "questions" : vocab.length ? "vocab" : "done");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showUz, setShowUz] = useState(false);
  const best = useBookly((s) => s.practice[slug]?.bestScore);

  const score = useMemo(() => answers.filter((a, i) => a === questions[i]?.answer).length, [answers, questions]);

  const finishQuestions = (finalAnswers: number[]) => {
    const s = finalAnswers.filter((a, i) => a === questions[i]?.answer).length;
    savePractice(slug, s, questions.length, finalAnswers);
    track("practice_complete", slug, { score: s, total: questions.length });
    setStep(vocab.length ? "vocab" : "done");
  };

  const stepsList: { id: Step; label: string }[] = [
    ...(questions.length ? [{ id: "questions" as Step, label: "Savollar" }] : []),
    ...(vocab.length ? [{ id: "vocab" as Step, label: "So‘zlar" }] : []),
    { id: "done", label: "Natija" },
  ];

  return (
    <div className="practice">
      <header className="practice-head">
        <Link href={`/s/${slug}`} className="icon-btn" aria-label="Orqaga">
          <Icon name="back" />
        </Link>
        <div>
          <span className="eyebrow">Mashq</span>
          <h1>{title}</h1>
        </div>
        <label className="toggle small">
          <input type="checkbox" checked={showUz} onChange={(e) => setShowUz(e.target.checked)} />
          <span className="toggle-ui" aria-hidden />
          O‘zbekcha yordam
        </label>
      </header>

      <ol className="stepper-dots" aria-label="Bosqichlar">
        {stepsList.map((s) => (
          <li key={s.id} className={s.id === step ? "is-on" : stepsList.findIndex((x) => x.id === step) > stepsList.findIndex((x) => x.id === s.id) ? "is-done" : ""}>
            {s.label}
          </li>
        ))}
      </ol>

      {step === "questions" && questions[qIndex] && (
        <QuestionCard
          key={questions[qIndex].id}
          q={questions[qIndex]}
          n={qIndex + 1}
          total={questions.length}
          showUz={showUz}
          onAnswer={(choice) => setAnswers((prev) => [...prev.slice(0, qIndex), choice])}
          onNext={() => {
            if (qIndex + 1 < questions.length) setQIndex(qIndex + 1);
            else finishQuestions(answers);
          }}
        />
      )}

      {step === "vocab" && <VocabReview vocab={vocab} showUz={showUz} onDone={() => setStep("done")} />}

      {step === "done" && (
        <section className="practice-done">
          {questions.length > 0 && (
            <div className="score">
              <span className="score-num">
                {score}/{questions.length}
              </span>
              <p>{score === questions.length ? "Ajoyib! Hammasini to‘g‘ri tushundingiz." : score >= questions.length / 2 ? "Yaxshi natija! Qiyin joyni qayta tinglab ko‘ring." : "Matnni yana bir bor o‘qib chiqing — keyingi safar osonroq bo‘ladi."}</p>
              {best !== undefined && best > score && <small className="muted">Eng yaxshi natijangiz: {best}/{questions.length}</small>}
            </div>
          )}
          {takeaway.en && (
            <div className="takeaway">
              <span className="eyebrow">Bugungi amaliy qadam</span>
              <p lang="en">{takeaway.en}</p>
              <p className="muted">{takeaway.uz}</p>
            </div>
          )}
          <div className="finish-actions">
            <Link href={`/s/${slug}/learn`} className="btn btn-soft">
              <Icon name="replay" /> Darsga qaytish
            </Link>
            <Link href="/library" className="btn btn-primary">
              Keyingi dars <Icon name="arrow" />
            </Link>
          </div>
          {questions.length > 0 && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setAnswers([]);
                setQIndex(0);
                setStep("questions");
              }}
            >
              Savollarni qayta yechish
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function QuestionCard({
  q,
  n,
  total,
  showUz,
  onAnswer,
  onNext,
}: {
  q: Question;
  n: number;
  total: number;
  showUz: boolean;
  onAnswer: (i: number) => void;
  onNext: () => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const answered = choice !== null;
  const correct = choice === q.answer;
  return (
    <section className="q-card" aria-labelledby={`q-${q.id}`}>
      <p className="q-count">
        Savol {n} / {total}
      </p>
      <h2 id={`q-${q.id}`} lang="en">
        {q.prompt}
      </h2>
      {showUz && <p className="q-uz">{q.promptUz}</p>}
      <div className="options" role="radiogroup" aria-labelledby={`q-${q.id}`}>
        {q.options.map((opt, i) => {
          const state = !answered ? "" : i === q.answer ? " is-correct" : i === choice ? " is-wrong" : " is-dim";
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={choice === i}
              disabled={answered}
              className={`option${state}`}
              onClick={() => {
                setChoice(i);
                onAnswer(i);
              }}
            >
              <span className="option-letter">{String.fromCharCode(65 + i)}</span>
              <span>
                <span lang="en">{opt}</span>
                {showUz && q.optionsUz?.[i] && <small>{q.optionsUz[i]}</small>}
              </span>
              {answered && i === q.answer && <Icon name="check" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`feedback ${correct ? "is-correct" : "is-wrong"}`} role="status">
          <strong>{correct ? "To‘g‘ri! ✅" : "Unchalik emas"}</strong>
          <p>{q.explanationUz}</p>
          <button type="button" className="btn btn-primary" onClick={onNext} autoFocus>
            {n < total ? "Keyingi savol" : "Davom etish"} <Icon name="arrow" />
          </button>
        </div>
      )}
    </section>
  );
}

function VocabReview({ vocab, showUz, onDone }: { vocab: VocabItem[]; showUz: boolean; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const item = vocab[i];
  const advance = (knew: boolean) => {
    if (knew) setKnown((k) => k + 1);
    setFlipped(false);
    if (i + 1 < vocab.length) setI(i + 1);
    else onDone();
  };
  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(item.term);
    u.lang = "en-US";
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  };
  return (
    <section className="vocab-review" aria-label="Lug‘at takrori">
      <p className="q-count">
        So‘z {i + 1} / {vocab.length} · bilganlaringiz: {known}
      </p>
      <button type="button" className={`flashcard${flipped ? " is-flipped" : ""}`} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? "Kartani yopish" : "Kartani ochish"}>
        <span className="flash-front">
          <strong lang="en">{item.term}</strong>
          {item.definition && !showUz && <small lang="en">{item.definition}</small>}
          <em>Ma’nosini eslang, keyin bosing</em>
        </span>
        <span className="flash-back">
          <strong>{item.uz}</strong>
          <span lang="en">“{item.example}”</span>
          {item.exampleUz && <small>{item.exampleUz}</small>}
        </span>
      </button>
      <div className="vocab-actions">
        <button type="button" className="icon-btn" onClick={speak} aria-label="Talaffuz">
          <Icon name="volume" />
        </button>
        {flipped ? (
          <>
            <button type="button" className="btn btn-soft" onClick={() => advance(false)}>
              Yana takrorlayman
            </button>
            <button type="button" className="btn btn-primary" onClick={() => advance(true)}>
              Bilaman <Icon name="check" />
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setFlipped(true)}>
            Javobni ko‘rish
          </button>
        )}
      </div>
      <button type="button" className="link-btn" onClick={onDone}>
        O‘tkazib yuborish
      </button>
    </section>
  );
}
