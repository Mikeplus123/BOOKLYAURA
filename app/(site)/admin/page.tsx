import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminList } from "@/components/admin/AdminList";
import { LOCAL_SUMMARIES } from "@/content/summaries";
import { canAccessAdmin } from "@/lib/admin-guard";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await canAccessAdmin();
  if (!access.ok) return <AdminGate reason={access.reason} />;
  const local = LOCAL_SUMMARIES.map(({ content: _c, ...m }) => m);
  return (
    <main id="main" className="container page">
      <AdminList local={local} />
    </main>
  );
}
