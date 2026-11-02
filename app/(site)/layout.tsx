import { BetaBar } from "@/components/BetaBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BetaBar />
      <SiteHeader />
      <div className="site-main">{children}</div>
      <SiteFooter />
    </>
  );
}
