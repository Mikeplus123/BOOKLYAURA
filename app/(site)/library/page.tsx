import type { Metadata } from "next";
import { LibraryBrowser } from "@/components/LibraryBrowser";
import { getCatalog } from "@/lib/content";

export const metadata: Metadata = {
  title: "Kutubxona",
  description: "Shaxsiy rivojlanish, o‘qish odatlari, samaradorlik, muloqot va biznes bo‘yicha qisqa darslar.",
};

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const [{ topic }, catalog] = await Promise.all([searchParams, getCatalog()]);
  return (
    <main id="main" className="container page">
      <header className="page-head">
        <p className="eyebrow">Kutubxona</p>
        <h1 className="page-title">Bugun nimani o‘rganamiz?</h1>
        <p className="page-lead">Har bir dars ~5 daqiqa: asosiy g‘oyalar, hayotiy misol va bitta amaliy qadam.</p>
      </header>
      <LibraryBrowser catalog={catalog} initialTopic={topic} />
    </main>
  );
}
