import type { Metadata } from "next";
import { LoginCard } from "@/components/LoginCard";

export const metadata: Metadata = { title: "Kirish", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/me";
  return (
    <main id="main" className="container narrow page">
      <LoginCard next={safeNext} error={error === "auth"} />
    </main>
  );
}
