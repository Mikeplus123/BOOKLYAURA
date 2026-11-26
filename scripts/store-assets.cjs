/* Google Play listing graphics: app icon (512²), feature graphic (1024×500) and captioned phone
 * screenshots (1080×2160, 2:1 — the tallest ratio Play accepts), rendered from the real app.
 *
 *   npm run build && PORT=3100 npm start      # in another terminal (demo mode is fine)
 *   npx -y playwright@1 install chromium      # once, if Playwright isn't installed
 *   node scripts/store-assets.cjs http://localhost:3100
 *
 * Output: store/ (commit it, upload in Play Console → Grow → Store presence → Main store listing).
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3100";
const OUT = path.join(__dirname, "..", "store");
const RAW = path.join(OUT, "raw");
// Inline everything as data: URIs — pages made with setContent() run on about:blank and can't load file:// URLs.
const dataUri = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
const font = (pkg, file) => dataUri(path.join(__dirname, "..", "node_modules", "@fontsource-variable", pkg, "files", file), "font/woff2");
const FONTS = `
@font-face{font-family:Fraunces;src:url(${font("fraunces", "fraunces-latin-wght-normal.woff2")}) format("woff2");font-weight:100 900}
@font-face{font-family:Manrope;src:url(${font("manrope", "manrope-latin-wght-normal.woff2")}) format("woff2");font-weight:200 800}`;
const ICON = dataUri(path.join(__dirname, "..", "assets", "icon-only.png"), "image/png");
const BOOK = dataUri(path.join(__dirname, "..", "public", "brand", "bookly-icon.webp"), "image/webp");

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  d.setHours(19, 30, 0, 0);
  return d.toISOString();
};
// Realistic learner state for the screenshots: a lesson in progress and a 3-day streak.
const STATE = {
  anonId: "store-demo",
  prefs: { theme: "light", textSize: 1, rate: 1, mode: "bilingual", haptics: true, updatedAt: day(0) },
  progress: {
    "atomic-habits": { sentenceIndex: 3, positionSec: 20, percent: 38, mode: "bilingual", format: "both", completedAt: null, updatedAt: day(0) },
    "7-habits-of-highly-effective-people": { sentenceIndex: 40, positionSec: 0, percent: 100, completedAt: day(1), updatedAt: day(1) },
    "how-to-win-friends-and-influence-people": { sentenceIndex: 40, positionSec: 0, percent: 100, completedAt: day(2), updatedAt: day(2) },
  },
  library: { "atomic-habits": { saved: true, updatedAt: day(0) } },
  practice: { "7-habits-of-highly-effective-people": { score: 3, total: 3, bestScore: 3, answers: [0, 0, 0], completedAt: day(1), updatedAt: day(1) } },
};

const SHOTS = [
  { name: "1-home", url: "/", caption: "Katta g‘oyalar —<br><em>5 daqiqada</em>" },
  { name: "2-read", url: "/s/atomic-habits/learn", caption: "Ikki tilda <em>o‘qing</em><br>va tinglang" },
  { name: "3-player", url: "/s/atomic-habits/learn", caption: "Ekran o‘chiq bo‘lsa ham<br><em>tinglang</em>", action: "player" },
  { name: "4-cards", url: "/s/atomic-habits/practice", caption: "So‘zlarni <em>suring</em><br>va yodlang", action: "cards" },
  { name: "5-library", url: "/library", caption: "Saralangan <em>kutubxona</em>" },
  { name: "6-streak", url: "/me", caption: "Har kungi <em>seriyangizni</em><br>saqlang", action: "stats" },
];

async function main() {
  fs.mkdirSync(RAW, { recursive: true });
  const browser = await chromium.launch();

  // ─── raw screens from the app (Android user agent → app layout) ───
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 720 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 BooklyApp/1.0",
  });
  await ctx.addInitScript((state) => {
    localStorage.setItem("bookly:v1", JSON.stringify(state));
    localStorage.setItem("bookly:betabar-dismissed", "1");
  }, STATE);
  const page = await ctx.newPage();
  for (const s of SHOTS) {
    await page.goto(BASE + s.url, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    if (s.url.endsWith("/learn")) {
      await page.waitForSelector(".player-bar");
      await page.locator(".toast .icon-btn").click().catch(() => undefined);
    }
    if (s.action === "player") {
      await page.click(".pb-now");
      await page.waitForSelector(".now-playing");
      await page.waitForTimeout(500);
    }
    if (s.action === "cards") {
      for (let i = 0; i < 3; i++) {
        await page.click(".option >> nth=0");
        await page.click(".feedback .btn-primary");
      }
      await page.waitForSelector(".flashcard");
      await page.evaluate(() => window.scrollTo(0, 0));
      const box = await page.locator(".flash-stage").boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + 90);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width / 2 + i * 9, box.y + 90);
      await page.waitForTimeout(200);
    }
    if (s.action === "stats")
      // The account card says "Demo rejim" on a local server; real users see their account there.
      await page.addStyleTag({ content: ".me-account{display:none!important}" });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(RAW, `${s.name}.png`) });
    if (s.action === "cards") await page.mouse.up();
  }
  await ctx.close();

  // ─── compositions ───
  const comp = await browser.newPage({ viewport: { width: 1080, height: 2160 }, deviceScaleFactor: 1 });
  for (const s of SHOTS) {
    const img = dataUri(path.join(RAW, `${s.name}.png`), "image/png");
    await comp.setContent(`<!doctype html><html><head><style>${FONTS}
      *{margin:0;box-sizing:border-box}
      body{width:1080px;height:2160px;overflow:hidden;background:radial-gradient(90% 60% at 50% 0%,#127a62 0%,#0b5d4b 45%,#053d33 100%);font-family:Manrope;color:#fff;display:flex;flex-direction:column;align-items:center}
      h1{font-family:Fraunces;font-weight:600;font-size:92px;line-height:1.08;text-align:center;height:200px;margin-top:110px;display:flex;align-items:center;justify-content:center;letter-spacing:-1px}
      h1 em{font-style:normal;color:#ecd292}
      .phone{margin-top:90px;width:800px;height:1600px;border-radius:64px;padding:18px;background:#0a1f1a;box-shadow:0 40px 90px rgba(0,0,0,.45),inset 0 0 0 2px rgba(255,255,255,.08)}
      .phone img{width:100%;height:100%;border-radius:48px;object-fit:cover;object-position:top;display:block}
      </style></head><body><h1><span>${s.caption}</span></h1><div class="phone"><img src="${img}"></div></body></html>`);
    await comp.waitForTimeout(300);
    await comp.screenshot({ path: path.join(OUT, `screenshot-${s.name}.png`) });
  }

  // Feature graphic 1024×500
  await comp.setViewportSize({ width: 1024, height: 500 });
  await comp.setContent(`<!doctype html><html><head><style>${FONTS}
    *{margin:0;box-sizing:border-box}
    body{width:1024px;height:500px;overflow:hidden;background:radial-gradient(70% 120% at 85% 50%,#127a62 0%,#0b5d4b 50%,#053d33 100%);font-family:Manrope;color:#fff;display:flex;align-items:center;padding:0 70px;gap:50px}
    .icon{width:200px;height:200px;border-radius:46px;background:#FBFAF6 url(${BOOK}) center/72% no-repeat;box-shadow:0 24px 60px rgba(0,0,0,.35);flex-shrink:0}
    h1{font-family:Fraunces;font-weight:600;font-size:78px;line-height:1}
    p{margin-top:16px;font-size:34px;font-weight:600;opacity:.92;line-height:1.25}
    p em{font-style:normal;color:#ecd292}
    small{display:block;margin-top:22px;font-size:22px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.7}
    </style></head><body><div class="icon"></div><div><h1>Bookly</h1><p>Katta g‘oyalar — <em>5 daqiqada</em>.<br>O‘qing, tinglang, ingliz tilini o‘rganing.</p><small>O‘zbekcha · English · Русский</small></div></body></html>`);
  await comp.waitForTimeout(300);
  await comp.screenshot({ path: path.join(OUT, "feature-graphic.png") });

  // App icon 512×512 (Play applies its own rounded mask)
  await comp.setViewportSize({ width: 512, height: 512 });
  await comp.setContent(`<!doctype html><body style="margin:0;width:512px;height:512px;background:url(${ICON}) center/cover no-repeat"></body>`);
  await comp.waitForTimeout(200);
  await comp.screenshot({ path: path.join(OUT, "icon-512.png") });

  await browser.close();
  console.log("Store assets written to", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
