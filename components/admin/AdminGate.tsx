import Link from "next/link";

export function AdminGate({ reason }: { reason?: "login" | "forbidden" | "demo-prod" }) {
  return (
    <main id="main" className="container narrow page center">
      <h1 className="page-title">Kontent boshqaruvi</h1>
      {reason === "login" && (
        <>
          <p className="page-lead">Davom etish uchun administrator hisobi bilan kiring.</p>
          <Link href="/login?next=/admin" className="btn btn-primary">
            Kirish
          </Link>
        </>
      )}
      {reason === "forbidden" && <p className="page-lead">Bu bo‘lim faqat administratorlar uchun. Admin huquqini olish uchun README’dagi SQL buyrug‘idan foydalaning.</p>}
      {reason === "demo-prod" && <p className="page-lead">Admin paneli uchun Supabase ulanishi kerak.</p>}
    </main>
  );
}
