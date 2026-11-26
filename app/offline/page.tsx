import type { Metadata } from "next";
import { OfflineLibrary } from "@/components/OfflineLibrary";

// Static page (no cookies / server data) so the service worker can cache it and open it with no network.
export const metadata: Metadata = { title: "Yuklab olinganlar", robots: { index: false } };

export default function OfflinePage() {
  return <OfflineLibrary />;
}
