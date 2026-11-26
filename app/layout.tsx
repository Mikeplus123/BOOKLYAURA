import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/literata";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { PrefsEffect } from "@/components/PrefsEffect";
import { NativeBridge } from "@/components/native/NativeBridge";
import { OfflineBanner } from "@/components/native/OfflineBanner";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Bookly — 5 daqiqada katta g‘oyalar", template: "%s · Bookly" },
  description:
    "Kitoblarning asosiy g‘oyalarini o‘qing, tinglang va ingliz tilini mashq qiling. O‘zbek tilidagi qisqa nonfiction darslar: inglizcha audio, o‘zbekcha tarjima va mashqlar.",
  applicationName: "Bookly",
  openGraph: {
    title: "Bookly — 5 daqiqada katta g‘oyalar",
    description: "Kitoblarning asosiy g‘oyalarini o‘qing, tinglang va ingliz tilini mashq qiling.",
    images: [{ url: "/brand/bookly-wordmark.png", width: 1280, height: 640 }],
    locale: "uz_UZ",
    type: "website",
  },
  icons: { apple: "/brand/bookly-icon.webp" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Edge-to-edge in the Android app (required on Android 15+); content pads itself with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFAF6" },
    { media: "(prefers-color-scheme: dark)", color: "#0C1714" },
  ],
};

// Applies saved theme + text size before first paint (prevents a flash of the wrong theme).
const prefsScript = `(function(){try{if(navigator.userAgent.indexOf('BooklyApp')>-1)document.documentElement.classList.add('is-app')}catch(e){}try{var s=JSON.parse(localStorage.getItem('bookly:v1')||'{}').prefs||{};var t=s.theme||'system';if(t==='system'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t;document.documentElement.dataset.textSize=String(s.textSize==null?1:s.textSize)}catch(e){document.documentElement.dataset.theme='light'}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" data-theme="light" data-text-size="1" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body>
        <AuthProvider>
          <PrefsEffect />
          <NativeBridge />
          <OfflineBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
