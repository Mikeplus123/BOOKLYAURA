import { BetaBar } from "@/components/BetaBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PullToRefresh } from "@/components/native/PullToRefresh";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BetaBar />
      <SiteHeader />
      <PullToRefresh />
      <div className="site-main">{children}</div>
      <SiteFooter />
    </>
  );
}
