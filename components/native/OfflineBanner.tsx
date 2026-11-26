"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

/** Slim banner while the device is offline, pointing to downloaded lessons. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  // Not on the downloads page itself, and not over the reader's own top bar.
  if (!offline || pathname.startsWith("/offline") || /^\/s\/[^/]+\/(learn|practice)/.test(pathname)) return null;
  return (
    <div className="offline-banner" role="status">
      <Icon name="wifi-off" size={16} /> Internet yo‘q —{" "}
      <Link href="/offline">yuklab olingan darslar</Link>
    </div>
  );
}
