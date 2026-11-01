import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/AdminGate";
import { Editor } from "@/components/admin/Editor";
import { LOCAL_SUMMARIES } from "@/content/summaries";
import { canAccessAdmin } from "@/lib/admin-guard";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Darsni tahrirlash", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await canAccessAdmin();
  if (!access.ok) return <AdminGate reason={access.reason} />;
  return (
    <main id="main" className="container page">
      <Editor slug={slug} localDocs={isSupabaseConfigured ? [] : LOCAL_SUMMARIES} />
    </main>
  );
}
