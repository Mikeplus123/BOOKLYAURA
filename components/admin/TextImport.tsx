"use client";
// Paste the English narration and the Uzbek translation → sentences are split and paired automatically.
// No AI needed. Sections start with "## English heading | O‘zbekcha sarlavha".
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { estimateTotalMinutes, flattenSentences, parseLessonText } from "@/lib/text";
import type { Section } from "@/lib/types";

const EXAMPLE_EN = `## Two evenings | Ikki xil oqshom
Imagine two versions of your evening. In the first, you promise to study for two hours.

## Goals and systems | Maqsadlar va tizimlar
A goal describes the result you want. A system is what you actually do.`;

const EXAMPLE_UZ = `Oqshomingizning ikki xil ko‘rinishini tasavvur qiling. Birinchisida siz ikki soat o‘qishga va’da berasiz.

Maqsad siz istagan natijani ifodalaydi. Tizim esa amalda nima qilishingizdir.`;

export function TextImport({ hasContent, onApply }: { hasContent: boolean; onApply: (sections: Section[], minutes: number) => void }) {
  const [english, setEnglish] = useState("");
  const [uzbek, setUzbek] = useState("");

  const parsed = useMemo(() => (english.trim() ? parseLessonText(english, uzbek) : []), [english, uzbek]);
  const totals = parsed.reduce((a, s) => ({ en: a.en + s.en.length, uz: a.uz + s.uz.length }), { en: 0, uz: 0 });
  const mismatched = parsed.filter((s) => s.uz.length && s.uz.length !== s.en.length);
  const missingHeadings = parsed.some((s) => !s.heading.en);

  const apply = () => {
    if (hasContent && !confirm("Hozirgi matn va tarjima yangisi bilan almashtiriladi (audio va lug‘at saqlanadi). Davom etilsinmi?")) return;
    const sections: Section[] = parsed.map((s, si) => ({
      id: `s${si + 1}`,
      heading: { en: s.heading.en || `Part ${si + 1}`, uz: s.heading.uz || `${si + 1}-qism` },
      sentences: s.en.map((en, i) => ({ id: `s${si + 1}-${i + 1}`, en, uz: s.uz[i] ?? "" })),
    }));
    onApply(sections, estimateTotalMinutes(flattenSentences(sections)));
    setEnglish("");
    setUzbek("");
  };

  return (
    <div className="panel">
      <h2 className="h3">
        <Icon name="book" /> Matndan dars yaratish
      </h2>
      <p className="muted small">
        Inglizcha diktor matnini (audio bilan aynan bir xil) va o‘zbekcha tarjimani joylang. Har bir bo‘lim <code>## English heading | O‘zbekcha sarlavha</code> qatoridan boshlanadi. Jumlalar avtomatik ajratiladi va tartib bo‘yicha juftlanadi. O‘zbekcha matnda ham <code>##</code> qatorlarini yozsangiz, juftlash har bir bo‘lim ichida bo‘ladi.
      </p>
      <div className="form-grid">
        <label className="field field-wide">
          <span className="field-label">Inglizcha matn (audiodagi kabi)</span>
          <textarea rows={12} lang="en" value={english} onChange={(e) => setEnglish(e.target.value)} placeholder={EXAMPLE_EN} />
        </label>
        <label className="field field-wide">
          <span className="field-label">O‘zbekcha tarjima</span>
          <textarea rows={12} value={uzbek} onChange={(e) => setUzbek(e.target.value)} placeholder={EXAMPLE_UZ} />
        </label>
      </div>

      {parsed.length > 0 && (
        <>
          <p className={`alert ${mismatched.length || totals.en !== totals.uz ? "" : "alert-ok"}`}>
            {parsed.length} bo‘lim · {totals.en} ta inglizcha jumla · {totals.uz} ta o‘zbekcha jumla
            {mismatched.length > 0 && ` · ${mismatched.length} ta bo‘limda soni mos emas (quyida qizil)`}
            {totals.uz === 0 && " · o‘zbekcha tarjima hali yo‘q (keyin qo‘shsa ham bo‘ladi)"}
            {missingHeadings && " · ba’zi bo‘limlarda sarlavha yo‘q"}
          </p>
          <div className="import-preview">
            {parsed.map((s, si) => (
              <div key={si} className={`import-sec${s.uz.length && s.uz.length !== s.en.length ? " is-bad" : ""}`}>
                <strong>
                  {si + 1}. {s.heading.en || "—"} <span className="muted">/ {s.heading.uz || "—"}</span>{" "}
                  <small>
                    ({s.en.length} / {s.uz.length})
                  </small>
                </strong>
                <ol>
                  {s.en.map((en, i) => (
                    <li key={i} className={s.uz.length && !s.uz[i] ? "is-bad" : ""}>
                      <span lang="en">{en}</span>
                      <span className="muted">{s.uz[i] ?? "— tarjima yo‘q —"}</span>
                    </li>
                  ))}
                  {s.uz.slice(s.en.length).map((uz, i) => (
                    <li key={`x${i}`} className="is-bad">
                      <span>— ortiqcha —</span>
                      <span className="muted">{uz}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={apply}>
            <Icon name="check" /> Matnni darsga qo‘llash
          </button>
        </>
      )}
    </div>
  );
}
