import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Player from "@/components/reader/PlayerClient";
import { getNextSuggestions, getSummary } from "@/lib/content";
import type { StudyFormat } from "@/lib/types";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ format?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { summary } = await getSummary(slug);
  return { title: summary ? `${summary.titleUz || summary.title} — dars` : "Dars", robots: { index: false } };
}

const FORMATS: StudyFormat[] = ["both", "read", "listen"];

export default async function LearnPage({ params, searchParams }: Props) {
  const [{ slug }, { format }] = await Promise.all([params, searchParams]);
  const { summary } = await getSummary(slug);
  if (!summary) notFound();
  if (!summary.content) redirect(`/s/${slug}`);
  const nextUp = await getNextSuggestions(summary);
  const initialFormat = FORMATS.includes(format as StudyFormat) ? (format as StudyFormat) : undefined;
  return <Player key={slug} summary={{ ...summary, content: summary.content }} initialFormat={initialFormat} nextUp={nextUp} />;
}
