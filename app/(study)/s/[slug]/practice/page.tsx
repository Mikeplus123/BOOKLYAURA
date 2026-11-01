import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Practice from "@/components/practice/Practice";
import { getSummary } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Mashq", robots: { index: false } };

export default async function PracticePage({ params }: Props) {
  const { slug } = await params;
  const { summary } = await getSummary(slug);
  if (!summary) notFound();
  if (!summary.content) redirect(`/s/${slug}`);
  return (
    <main id="main" className="container narrow page">
      <Practice slug={slug} title={summary.titleUz || summary.title} content={summary.content} />
    </main>
  );
}
