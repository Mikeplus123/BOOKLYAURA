import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="container narrow page center">
      <p className="eyebrow">404</p>
      <h1 className="page-title">Bu sahifa topilmadi</h1>
      <p className="page-lead">Ehtimol, havola eskirgan. Kutubxonadan boshqa dars tanlang.</p>
      <Link href="/library" className="btn btn-primary">
        Kutubxonaga o‘tish
      </Link>
    </main>
  );
}
