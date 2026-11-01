import type { Metadata } from "next";
import { MyLibrary } from "@/components/MyLibrary";
import { getCatalog } from "@/lib/content";

export const metadata: Metadata = { title: "Mening darslarim", robots: { index: false } };

export default async function MePage() {
  const catalog = await getCatalog();
  return (
    <main id="main" className="container page">
      <header className="page-head">
        <p className="eyebrow">Shaxsiy kutubxona</p>
        <h1 className="page-title">Mening darslarim</h1>
      </header>
      <MyLibrary catalog={catalog} />
    </main>
  );
}
