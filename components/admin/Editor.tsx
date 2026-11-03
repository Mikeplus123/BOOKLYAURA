"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icon";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { estimateTotalMinutes, flattenSentences, slugify, validateContent } from "@/lib/text";
import type { Level, Section, SummaryContent, SummaryDocument, TopicId } from "@/lib/types";
import { LEVELS, TOPICS } from "@/lib/types";
import { TextImport } from "./TextImport";
import { TimingTool } from "./TimingTool";

type Tab = "meta" | "ai" | "text" | "audio" | "practice" | "publish";
const TABS: { id: Tab; label: string }[] = [
  { id: "meta", label: "1. Ma’lumot" },
  { id: "ai", label: "2. Matn kiritish" },
  { id: "text", label: "3. Matn va tarjima" },
  { id: "audio", label: "4. Audio va sinxron" },
  { id: "practice", label: "5. Lug‘at va savollar" },
  { id: "publish", label: "6. Tekshirish va saqlash" },
];

export function emptyDocument(): SummaryDocument {
  return {
    slug: "",
    title: "",
    titleUz: "",
    author: "",
    topic: "self-development",
    durationMin: 5,
    level: "intermediate",
    languages: ["en", "uz"],
    isFree: false,
    isPublished: false,
    coverColor: "#0B5D4B",
    tagline: "",
    intro: "",
    learnPoints: [],
    attribution: "",
    sortOrder: 100,
    content: { sections: [], vocab: [], questions: [], takeaway: { en: "", uz: "" }, audio: null },
  };
}

const uid = () => Math.random().toString(36).slice(2, 7);

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowsToDocument(row: any, content: SummaryContent | null): SummaryDocument {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleUz: row.title_uz,
    author: row.author,
    topic: row.topic,
    durationMin: row.duration_min,
    level: row.level,
    languages: row.languages,
    isFree: row.is_free,
    isPublished: row.is_published,
    coverColor: row.cover_color,
    coverImage: row.cover_image ?? null,
    tagline: row.tagline,
    intro: row.intro,
    learnPoints: row.learn_points ?? [],
    attribution: row.attribution,
    sortOrder: row.sort_order,
    content: content ?? emptyDocument().content,
  };
}

export function Editor({ slug, localDocs }: { slug: string; localDocs: SummaryDocument[] }) {
  const router = useRouter();
  const { enabled, isAdmin, loading } = useAuth();
  const supabase = getSupabaseBrowser();
  const isNew = slug === "new";
  const [doc, setDoc] = useState<SummaryDocument | null>(isNew ? emptyDocument() : null);
  const [tab, setTab] = useState<Tab>(isNew ? "meta" : "text");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  // Load
  useEffect(() => {
    if (isNew) return;
    if (!supabase) {
      const local = localDocs.find((d) => d.slug === slug);
      setDoc(local ? structuredClone(local) : null);
      return;
    }
    if (!isAdmin) return;
    (async () => {
      const { data: row } = await supabase.from("summaries").select("*").eq("slug", slug).maybeSingle();
      if (!row) return setDoc(null);
      const { data: c } = await supabase.from("summary_content").select("content").eq("summary_id", row.id).maybeSingle();
      setDoc(rowsToDocument(row, (c?.content as SummaryContent) ?? null));
    })();
  }, [slug, isNew, supabase, isAdmin, localDocs]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  const update = (patch: Partial<SummaryDocument>) => {
    setDoc((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };
  const updateContent = (patch: Partial<SummaryContent>) => {
    setDoc((d) => (d ? { ...d, content: { ...d.content, ...patch } } : d));
    setDirty(true);
  };

  const issues = useMemo(() => (doc ? validateContent(doc.content) : []), [doc]);
  const metaIssues = useMemo(() => {
    if (!doc) return [];
    const out: string[] = [];
    if (!doc.slug || doc.slug !== slugify(doc.slug)) out.push("Slug faqat kichik lotin harflari, raqam va chiziqchadan iborat bo‘lsin.");
    if (!doc.title.trim()) out.push("Sarlavha kerak.");
    if (!doc.author.trim()) out.push("Muallif kerak.");
    if (doc.isPublished && !doc.attribution.trim()) out.push("Nashr qilishdan oldin manba / ruxsat izohini yozing.");
    return out;
  }, [doc]);
  const blocking = metaIssues.length > 0 || issues.some((i) => i.level === "error");

  const exportJson = () => {
    if (!doc) return;
    const { id: _id, ...rest } = doc;
    const { sourceHash: _hash, ...content } = rest.content;
    const blob = new Blob([JSON.stringify({ ...rest, content }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.slug || "bookly-summary"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as SummaryDocument;
      if (!parsed.content?.sections) throw new Error("bad");
      setDoc({ ...emptyDocument(), ...parsed, id: doc?.id, content: { ...emptyDocument().content, ...parsed.content } });
      setDirty(true);
      setMessage({ kind: "ok", text: "JSON yuklandi. Tekshirib, saqlang." });
    } catch {
      setMessage({ kind: "error", text: "JSON fayl Bookly formatiga mos emas." });
    }
  };

  const save = async () => {
    if (!doc || !supabase) return;
    if (blocking) {
      setTab("publish");
      return;
    }
    setSaving(true);
    setMessage(null);
    const row = {
      slug: doc.slug,
      title: doc.title,
      title_uz: doc.titleUz,
      author: doc.author,
      topic: doc.topic,
      duration_min: doc.durationMin,
      level: doc.level,
      languages: doc.languages,
      is_free: doc.isFree,
      is_published: doc.isPublished,
      cover_color: doc.coverColor,
      cover_image: doc.coverImage || null,
      tagline: doc.tagline,
      intro: doc.intro,
      learn_points: doc.learnPoints,
      attribution: doc.attribution,
      sort_order: doc.sortOrder,
    };
    const write = (r: Partial<typeof row>) =>
      doc.id ? supabase.from("summaries").update(r).eq("id", doc.id).select("id").single() : supabase.from("summaries").insert(r).select("id").single();
    let res = await write(row);
    // Database without migration 0003 yet: save without the cover image rather than failing.
    if (res.error && /cover_image/.test(res.error.message)) {
      const { cover_image: _skip, ...rest } = row;
      res = await write(rest);
    }
    if (res.error || !res.data) {
      setSaving(false);
      setMessage({ kind: "error", text: res.error?.code === "23505" ? "Bu slug band. Boshqasini tanlang." : `Saqlab bo‘lmadi: ${res.error?.message}` });
      return;
    }
    const id = res.data.id as string;
    const c = await supabase.from("summary_content").upsert({ summary_id: id, content: doc.content });
    setSaving(false);
    if (c.error) {
      setMessage({ kind: "error", text: `Matnni saqlab bo‘lmadi: ${c.error.message}` });
      return;
    }
    setDirty(false);
    setDoc({ ...doc, id });
    setMessage({ kind: "ok", text: doc.isPublished ? "Saqlandi va nashr qilindi ✅" : "Qoralama sifatida saqlandi ✅" });
    if (isNew) router.replace(`/admin/edit/${doc.slug}`);
  };

  const remove = async () => {
    if (!doc?.id || !supabase) return;
    if (!confirm(`“${doc.title}” butunlay o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.`)) return;
    const { error } = await supabase.from("summaries").delete().eq("id", doc.id);
    if (error) return setMessage({ kind: "error", text: error.message });
    setDirty(false);
    router.push("/admin");
  };

  if (enabled && loading) return <p className="muted">Yuklanmoqda…</p>;
  if (enabled && !isAdmin) return <p className="alert">Bu sahifa faqat administratorlar uchun.</p>;
  if (!doc) return <p className="muted">{isNew ? "" : "Dars topilmadi yoki yuklanmoqda…"}</p>;

  return (
    <div className="editor">
      <div className="editor-head">
        <Link href="/admin" className="icon-btn" aria-label="Ro‘yxatga qaytish">
          <Icon name="back" />
        </Link>
        <div>
          <h1>{doc.title || "Yangi dars"}</h1>
          <p className="muted small">
            {doc.isPublished ? "Nashr qilingan" : "Qoralama"} · {flattenSentences(doc.content.sections).length} jumla
            {dirty && " · saqlanmagan o‘zgarishlar"}
          </p>
        </div>
        <div className="editor-head-actions">
          <label className="btn btn-soft btn-sm">
            <Icon name="upload" /> JSON import
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </label>
          <button type="button" className="btn btn-soft btn-sm" onClick={exportJson}>
            <Icon name="download" /> JSON eksport
          </button>
          {supabase ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          ) : (
            <span className="muted tiny">Demo rejim: saqlash uchun Supabase kerak (JSON eksportdan foydalaning)</span>
          )}
        </div>
      </div>

      {message && (
        <p className={`alert ${message.kind === "ok" ? "alert-ok" : ""}`} role="status">
          {message.text}
        </p>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "meta" && <MetaForm doc={doc} update={update} />}
      {tab === "ai" && (
        <>
          <TextImport
            hasContent={doc.content.sections.length > 0}
            onApply={(sections, minutes) => {
              update({ durationMin: doc.durationMin || minutes });
              updateContent({ sections });
              setTab("text");
            }}
          />
          <details className="ai-details">
            <summary>
              <Icon name="sparkle" /> AI yordamchi (ixtiyoriy, ANTHROPIC_API_KEY kerak)
            </summary>
            <AIBuilder doc={doc} apply={(next) => { setDoc(next); setDirty(true); setTab("text"); }} />
          </details>
        </>
      )}
      {tab === "text" && <SectionsEditor sections={doc.content.sections} onChange={(sections) => updateContent({ sections })} />}
      {tab === "audio" && <AudioPanel doc={doc} updateContent={updateContent} />}
      {tab === "practice" && <PracticeEditor content={doc.content} updateContent={updateContent} />}
      {tab === "publish" && (
        <div className="panel">
          <h2 className="h3">Tekshirish</h2>
          {metaIssues.length === 0 && issues.length === 0 && <p className="alert alert-ok">Hammasi joyida — saqlashga tayyor.</p>}
          <ul className="issues">
            {metaIssues.map((m) => (
              <li key={m} className="is-error">
                {m}
              </li>
            ))}
            {issues.map((i, k) => (
              <li key={k} className={i.level === "error" ? "is-error" : "is-warning"}>
                {i.message}
              </li>
            ))}
            {flattenSentences(doc.content.sections).some((s) => s.review) && (
              <li className="is-warning">AI yozgan tarjimalar bor (sariq belgili) — inson tomonidan tekshirilishi kerak.</li>
            )}
          </ul>
          <label className="toggle">
            <input type="checkbox" checked={doc.isPublished} onChange={(e) => update({ isPublished: e.target.checked })} />
            <span className="toggle-ui" aria-hidden /> Nashr qilish (foydalanuvchilarga ko‘rinadi)
          </label>
          <label className="toggle">
            <input type="checkbox" checked={doc.isFree} onChange={(e) => update({ isFree: e.target.checked })} />
            <span className="toggle-ui" aria-hidden /> Bepul dars (aks holda — Premium)
          </label>
          <div className="row">
            {supabase && (
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving || blocking}>
                {saving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            )}
            {doc.id && supabase && (
              <button type="button" className="btn btn-soft danger" onClick={remove}>
                <Icon name="trash" /> O‘chirish
              </button>
            )}
            {doc.slug && (
              <Link href={`/s/${doc.slug}`} className="btn btn-soft" target="_blank">
                Saytda ko‘rish ↗
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── meta ───────────────────────────────────────────────────────────────────
function MetaForm({ doc, update }: { doc: SummaryDocument; update: (p: Partial<SummaryDocument>) => void }) {
  return (
    <div className="panel form-grid">
      <Field label="Asl sarlavha (inglizcha)">
        <input value={doc.title} onChange={(e) => update({ title: e.target.value, ...(doc.id ? {} : { slug: slugify(e.target.value) }) })} />
      </Field>
      <Field label="O‘zbekcha sarlavha">
        <input value={doc.titleUz} onChange={(e) => update({ titleUz: e.target.value })} />
      </Field>
      <Field label="Muallif">
        <input value={doc.author} onChange={(e) => update({ author: e.target.value })} />
      </Field>
      <Field label="Slug (URL)" hint={`/s/${doc.slug || "..."}`}>
        <input value={doc.slug} onChange={(e) => update({ slug: slugify(e.target.value) })} />
      </Field>
      <Field label="Mavzu">
        <select value={doc.topic} onChange={(e) => update({ topic: e.target.value as TopicId })}>
          {TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.uz}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Ingliz tili darajasi">
        <select value={doc.level} onChange={(e) => update({ level: e.target.value as Level })}>
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.uz} ({l.cefr})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Davomiylik (daqiqa)" hint={`Matn bo‘yicha taxminan ${estimateTotalMinutes(flattenSentences(doc.content.sections))} daqiqa`}>
        <input type="number" min={1} max={60} value={doc.durationMin} onChange={(e) => update({ durationMin: Number(e.target.value) || 1 })} />
      </Field>
      <Field label="Muqova rangi">
        <input type="color" value={doc.coverColor} onChange={(e) => update({ coverColor: e.target.value })} />
      </Field>
      <Field label="Muqova rasmi (URL)" hint="Masalan /covers/slug.webp — bo‘sh bo‘lsa rangli muqova chiziladi">
        <input type="text" value={doc.coverImage ?? ""} placeholder="/covers/slug.webp" onChange={(e) => update({ coverImage: e.target.value.trim() || null })} />
      </Field>
      <Field label="Tartib raqami" hint="Kichik raqam — yuqorida">
        <input type="number" value={doc.sortOrder} onChange={(e) => update({ sortOrder: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="Tillar">
        <div className="chips">
          {(["en", "uz", "ru"] as const).map((l) => (
            <label key={l} className="chip">
              <input
                type="checkbox"
                checked={doc.languages.includes(l)}
                onChange={(e) => update({ languages: e.target.checked ? [...doc.languages, l] : doc.languages.filter((x) => x !== l) })}
              />{" "}
              {l.toUpperCase()}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Qisqa jumla (karta uchun)" wide>
        <input value={doc.tagline} maxLength={140} onChange={(e) => update({ tagline: e.target.value })} />
      </Field>
      <Field label="Kirish matni (o‘zbekcha)" wide>
        <textarea rows={3} value={doc.intro} onChange={(e) => update({ intro: e.target.value })} />
      </Field>
      <Field label="“Siz nimani o‘rganasiz” — har qatorga bittadan" wide>
        <textarea rows={4} value={doc.learnPoints.join("\n")} onChange={(e) => update({ learnPoints: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
      </Field>
      <Field label="Manba va ruxsat izohi" hint="Masalan: “X kitobi asosida. Nashriyot ruxsati bilan.”" wide>
        <textarea rows={2} value={doc.attribution} onChange={(e) => update({ attribution: e.target.value })} />
      </Field>
    </div>
  );
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`field${wide ? " field-wide" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// ─── AI builder ─────────────────────────────────────────────────────────────
function AIBuilder({ doc, apply }: { doc: SummaryDocument; apply: (d: SummaryDocument) => void }) {
  const [english, setEnglish] = useState("");
  const [uzbek, setUzbek] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (doc.content.sections.length && !confirm("Mavjud matn, lug‘at va savollar AI natijasi bilan almashtiriladi. Davom etilsinmi?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: doc.title, author: doc.author, englishText: english, uzbekText: uzbek || undefined, level: doc.level, notes: notes || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Xatolik");
      const lesson = json.lesson;
      const sections: Section[] = lesson.sections.map((s: any, si: number) => ({
        id: `s${si + 1}`,
        heading: { en: s.headingEn, uz: s.headingUz },
        sentences: s.sentences.map((x: any, i: number) => ({ id: `s${si + 1}-${i + 1}`, en: x.en, uz: x.uz, ...(x.uzGenerated ? { review: true } : {}) })),
      }));
      const content: SummaryContent = {
        ...doc.content,
        sections,
        vocab: lesson.vocab,
        questions: lesson.questions.map((q: any, i: number) => ({ id: `q${i + 1}`, ...q })),
        takeaway: lesson.takeaway,
      };
      apply({
        ...doc,
        titleUz: doc.titleUz || lesson.titleUz,
        tagline: doc.tagline || lesson.tagline,
        intro: doc.intro || lesson.intro,
        learnPoints: doc.learnPoints.length ? doc.learnPoints : lesson.learnPoints,
        level: lesson.level,
        durationMin: estimateTotalMinutes(flattenSentences(sections)),
        content,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2 className="h3">
        <Icon name="sparkle" /> AI dars tuzuvchi
      </h2>
      <p className="muted">
        Inglizcha qisqacha mazmunni va (bo‘lsa) o‘zbekcha tarjimani joylang. AI matnni <strong>o‘zgartirmasdan</strong> jumlalarga ajratadi, tarjimani ma’no bo‘yicha moslaydi, bo‘limlar, 6–8 so‘z, 3 savol va amaliy qadam tayyorlaydi. AI yozgan tarjimalar sariq belgi bilan ko‘rsatiladi — ularni albatta tekshiring.
      </p>
      {(!doc.title || !doc.author) && <p className="alert">Avval “Ma’lumot” bo‘limida sarlavha va muallifni kiriting.</p>}
      <div className="form-grid">
        <Field label="Inglizcha matn (yakuniy)" wide>
          <textarea rows={10} value={english} onChange={(e) => setEnglish(e.target.value)} placeholder="Paste the English summary here…" lang="en" />
        </Field>
        <Field label="O‘zbekcha tarjima (ixtiyoriy, lekin tavsiya etiladi)" wide>
          <textarea rows={10} value={uzbek} onChange={(e) => setUzbek(e.target.value)} placeholder="O‘zbekcha tarjimani shu yerga joylang…" />
        </Field>
        <Field label="Qo‘shimcha ko‘rsatma (ixtiyoriy)" wide>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Masalan: savollar B1 darajasida bo‘lsin" />
        </Field>
      </div>
      {error && <p className="alert">{error}</p>}
      <button type="button" className="btn btn-primary" onClick={run} disabled={busy || english.trim().length < 20 || !doc.title || !doc.author}>
        {busy ? "AI ishlamoqda… (1–3 daqiqa)" : "Darsni tuzish"}
      </button>
    </div>
  );
}

// ─── sentences editor ───────────────────────────────────────────────────────
function SectionsEditor({ sections, onChange }: { sections: Section[]; onChange: (s: Section[]) => void }) {
  const setSection = (i: number, patch: Partial<Section>) => onChange(sections.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const setSentence = (si: number, i: number, patch: Record<string, unknown>) =>
    setSection(si, { sentences: sections[si].sentences.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  return (
    <div className="panel">
      <p className="muted small">Har bir inglizcha jumla ostida uning o‘zbekcha tarjimasi. Tarjima so‘zma-so‘z emas, ma’no bo‘yicha bo‘lishi kerak. Sariq belgili qatorlar — AI tarjimasi, tekshirilishi kerak.</p>
      {sections.map((sec, si) => (
        <fieldset key={sec.id} className="sec-edit">
          <legend>Bo‘lim {si + 1}</legend>
          <div className="row">
            <input value={sec.heading.en} placeholder="Heading (EN)" onChange={(e) => setSection(si, { heading: { ...sec.heading, en: e.target.value } })} />
            <input value={sec.heading.uz} placeholder="Sarlavha (UZ)" onChange={(e) => setSection(si, { heading: { ...sec.heading, uz: e.target.value } })} />
            <button type="button" className="icon-btn sm danger" aria-label="Bo‘limni o‘chirish" onClick={() => confirm("Bo‘lim o‘chirilsinmi?") && onChange(sections.filter((_, k) => k !== si))}>
              <Icon name="trash" />
            </button>
          </div>
          {sec.sentences.map((s, i) => (
            <div key={s.id} className={`sent-edit${s.review ? " needs-review" : ""}`}>
              <span className="sent-n">{i + 1}</span>
              <textarea rows={2} lang="en" value={s.en} onChange={(e) => setSentence(si, i, { en: e.target.value })} aria-label="English" />
              <textarea rows={2} value={s.uz} onChange={(e) => setSentence(si, i, { uz: e.target.value, review: undefined })} aria-label="O‘zbekcha" />
              <div className="sent-tools">
                {s.review && (
                  <button type="button" className="chip" title="Tarjima tekshirildi" onClick={() => setSentence(si, i, { review: undefined })}>
                    <Icon name="check" size={14} /> OK
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn sm"
                  aria-label="Keyin jumla qo‘shish"
                  onClick={() => {
                    const list = [...sec.sentences];
                    list.splice(i + 1, 0, { id: `${sec.id}-${uid()}`, en: "", uz: "" });
                    setSection(si, { sentences: list });
                  }}
                >
                  <Icon name="plus" />
                </button>
                <button type="button" className="icon-btn sm danger" aria-label="Jumlani o‘chirish" onClick={() => setSection(si, { sentences: sec.sentences.filter((_, k) => k !== i) })}>
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-soft btn-sm" onClick={() => setSection(si, { sentences: [...sec.sentences, { id: `${sec.id}-${uid()}`, en: "", uz: "" }] })}>
            <Icon name="plus" /> Jumla qo‘shish
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="btn btn-soft"
        onClick={() => onChange([...sections, { id: `s${uid()}`, heading: { en: "", uz: "" }, sentences: [{ id: `s${uid()}-1`, en: "", uz: "" }] }])}
      >
        <Icon name="plus" /> Bo‘lim qo‘shish
      </button>
    </div>
  );
}

// ─── audio ──────────────────────────────────────────────────────────────────
function AudioPanel({ doc, updateContent }: { doc: SummaryDocument; updateContent: (p: Partial<SummaryContent>) => void }) {
  const supabase = getSupabaseBrowser();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(doc.content.audio?.url ?? "");

  const upload = async (file: File) => {
    if (!supabase) return;
    if (!doc.slug) return setError("Avval slug kiriting.");
    if (file.size > 50 * 1024 * 1024) return setError("Fayl 50 MB dan katta.");
    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    const path = `${doc.slug}/${Date.now()}-${uid()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("audio").upload(path, file, { contentType: file.type || "audio/mpeg", upsert: false });
    setUploading(false);
    if (upErr) return setError(`Yuklab bo‘lmadi: ${upErr.message}`);
    const { data } = supabase.storage.from("audio").getPublicUrl(path);
    updateContent({ audio: { url: data.publicUrl } });
    setUrlInput(data.publicUrl);
  };

  return (
    <div className="panel">
      <h2 className="h3">Audio</h2>
      <p className="muted small">Inglizcha diktor ovozi (MP3/M4A). Yuklangandan so‘ng jumlalarni vaqtga bog‘lang — shunda o‘quvchi uchun joriy jumla avtomatik belgilanadi.</p>
      <div className="row">
        {supabase && (
          <label className="btn btn-primary btn-sm">
            <Icon name="upload" /> {uploading ? "Yuklanmoqda…" : "Audio yuklash"}
            <input type="file" accept="audio/*" hidden disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        )}
        <input className="grow" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="yoki audio URL manzilini kiriting" />
        <button type="button" className="btn btn-soft btn-sm" onClick={() => updateContent({ audio: urlInput.trim() ? { url: urlInput.trim() } : null })}>
          Qo‘llash
        </button>
        {doc.content.audio && (
          <button
            type="button"
            className="btn btn-soft btn-sm danger"
            onClick={() => {
              updateContent({ audio: null });
              setUrlInput("");
            }}
          >
            Olib tashlash
          </button>
        )}
      </div>
      {error && <p className="alert">{error}</p>}
      {doc.content.audio?.url ? (
        flattenSentences(doc.content.sections).length ? (
          <TimingTool audioUrl={doc.content.audio.url} sections={doc.content.sections} onChange={(sections) => updateContent({ sections })} />
        ) : (
          <p className="alert alert-info">Sinxronlash uchun avval matnni kiriting.</p>
        )
      ) : (
        <p className="alert alert-info">Audio hali yo‘q. Audio bo‘lmaganda o‘quvchilar uchun brauzer ovozi (namuna sifatida) ishlatiladi.</p>
      )}
    </div>
  );
}

// ─── vocab + questions (validated JSON) ─────────────────────────────────────
function PracticeEditor({ content, updateContent }: { content: SummaryContent; updateContent: (p: Partial<SummaryContent>) => void }) {
  const [vocabText, setVocabText] = useState(() => JSON.stringify(content.vocab, null, 2));
  const [qText, setQText] = useState(() => JSON.stringify(content.questions, null, 2));
  const [err, setErr] = useState<string | null>(null);

  const applyJson = () => {
    try {
      const vocab = JSON.parse(vocabText);
      const questions = JSON.parse(qText);
      if (!Array.isArray(vocab) || !Array.isArray(questions)) throw new Error("Massiv (array) kutilgan.");
      for (const v of vocab) if (typeof v.term !== "string" || typeof v.uz !== "string" || typeof v.example !== "string") throw new Error("Har bir so‘zda term, uz va example bo‘lishi kerak.");
      for (const q of questions)
        if (typeof q.prompt !== "string" || !Array.isArray(q.options) || typeof q.answer !== "number") throw new Error("Har bir savolda prompt, options va answer bo‘lishi kerak.");
      updateContent({ vocab, questions: questions.map((q: any, i: number) => ({ id: q.id || `q${i + 1}`, promptUz: "", explanationUz: "", ...q })) });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "JSON xato");
    }
  };

  return (
    <div className="panel">
      <div className="form-grid">
        <Field label="Amaliy qadam (EN)" wide>
          <input lang="en" value={content.takeaway.en} onChange={(e) => updateContent({ takeaway: { ...content.takeaway, en: e.target.value } })} />
        </Field>
        <Field label="Amaliy qadam (UZ)" wide>
          <input value={content.takeaway.uz} onChange={(e) => updateContent({ takeaway: { ...content.takeaway, uz: e.target.value } })} />
        </Field>
        <Field label={`Lug‘at (${content.vocab.length}) — JSON`} hint='[{"term":"habit","forms":["habits"],"uz":"odat","definition":"…","example":"…","exampleUz":"…"}]' wide>
          <textarea className="mono" rows={12} value={vocabText} onChange={(e) => setVocabText(e.target.value)} spellCheck={false} />
        </Field>
        <Field label={`Savollar (${content.questions.length}) — JSON`} hint='[{"prompt":"…","promptUz":"…","options":["A","B","C"],"optionsUz":["…"],"answer":0,"explanationUz":"…"}]' wide>
          <textarea className="mono" rows={14} value={qText} onChange={(e) => setQText(e.target.value)} spellCheck={false} />
        </Field>
      </div>
      {err && <p className="alert">{err}</p>}
      <button type="button" className="btn btn-primary btn-sm" onClick={applyJson}>
        Lug‘at va savollarni qo‘llash
      </button>
    </div>
  );
}
