import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bookly — 5 daqiqada katta g‘oyalar",
    short_name: "Bookly",
    description: "Kitoblarning asosiy g‘oyalarini o‘qing, tinglang va ingliz tilini mashq qiling.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBFAF6",
    theme_color: "#0B5D4B",
    lang: "uz",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/bookly-icon.webp", sizes: "1254x1254", type: "image/webp" },
    ],
  };
}
