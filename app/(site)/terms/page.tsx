import type { Metadata } from "next";
import { LegalDoc } from "@/components/LegalDoc";
import { termsEn, termsUz } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Foydalanish shartlari",
  description: "Bookly foydalanish shartlari: hisob, sharhlar qoidalari, AI, Premium obuna. Terms of Use.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalDoc title="Foydalanish shartlari" titleEn="Terms of Use" uz={termsUz()} en={termsEn()} />;
}
