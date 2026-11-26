import type { Metadata } from "next";
import { AccountPanel } from "@/components/AccountPanel";

export const metadata: Metadata = { title: "Hisob", robots: { index: false } };

export default function AccountPage() {
  return (
    <main id="main" className="container page account-page">
      <header className="page-head">
        <p className="eyebrow">Hisob</p>
        <h1 className="page-title">Hisob va sozlamalar</h1>
      </header>
      <AccountPanel />
    </main>
  );
}
