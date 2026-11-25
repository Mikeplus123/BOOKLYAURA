import type { Metadata } from "next";
import { LegalDoc } from "@/components/LegalDoc";
import { privacyEn, privacyUz } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Maxfiylik siyosati",
  description: "Bookly qanday ma’lumot yig‘adi, undan qanday foydalanadi va sizning huquqlaringiz. Privacy Policy.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalDoc title="Maxfiylik siyosati" titleEn="Privacy Policy" uz={privacyUz()} en={privacyEn()} />;
}
