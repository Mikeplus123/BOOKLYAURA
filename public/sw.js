/* Bookly service worker — offline lessons for the website and the Android app.
 *
 *  • Downloaded narration (Cache "bookly-audio-v1", filled by lib/offline.ts) is served from the
 *    cache, including byte-range requests so seeking works offline.
 *  • Static build files are cache-first; images/fonts stale-while-revalidate.
 *  • Page navigations are network-first. With no network a lesson URL redirects to the offline
 *    reader (/offline?slug=…), everything else shows the cached /offline page.
 *  • Personal pages and API responses are never cached.
 */
const VERSION = "v1";
const STATIC = `bookly-static-${VERSION}`;
const PAGES = `bookly-pages-${VERSION}`;
const AUDIO = "bookly-audio-v1"; // user downloads — kept across versions
const OFFLINE_URL = "/offline";
const MAX_STATIC = 400;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(warmOffline().catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC, PAGES, AUDIO]);
      for (const key of await caches.keys()) if (key.startsWith("bookly-") && !keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "warm-offline") event.waitUntil(warmOffline().catch(() => undefined));
});

/** Cache the offline reader page and every build file it references (scripts, styles, fonts). */
async function warmOffline() {
  const res = await fetch(OFFLINE_URL, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) return;
  const pages = await caches.open(PAGES);
  await pages.put(OFFLINE_URL, res.clone());
  const html = await res.text();
  const urls = new Set(["/icon.svg", "/brand/bookly-icon.webp", "/manifest.webmanifest"]);
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\)]+/g)) urls.add(m[0]);
  const stat = await caches.open(STATIC);
  await Promise.all(
    [...urls].map(async (u) => {
      if (await stat.match(u)) return;
      const r = await fetch(u).catch(() => null);
      if (!r || !r.ok) return;
      await stat.put(u, r.clone());
      // Fonts referenced from CSS.
      if (u.endsWith(".css")) {
        const css = await r.text();
        for (const f of css.matchAll(/url\((\/_next\/static\/media\/[^)"']+)\)/g)) {
          if (!(await stat.match(f[1]))) await stat.add(f[1]).catch(() => undefined);
        }
      }
    }),
  );
  await trim(STATIC, MAX_STATIC);
}

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.startsWith("/api/") || p.startsWith("/auth/") || p === "/sw.js") return;

  if (p.startsWith("/audio/") || req.destination === "audio") {
    event.respondWith(audio(req));
    return;
  }
  if (p.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (/^\/(covers|brand)\//.test(p) || p === "/icon.svg" || /\.(woff2?|png|webp|jpg|jpeg|svg)$/.test(p)) {
    event.respondWith(staleWhileRevalidate(req, STATIC));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(navigate(req, url));
  }
  // Everything else (RSC payloads, data) goes straight to the network.
});

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const update = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await update) || new Response("", { status: 504 });
}

async function navigate(req, url) {
  try {
    const res = await fetch(req);
    // Keep the offline page fresh whenever we pass by it online.
    if (url.pathname === OFFLINE_URL && res.ok) (await caches.open(PAGES)).put(OFFLINE_URL, res.clone());
    return res;
  } catch {
    const lesson = url.pathname.match(/^\/s\/([^/]+)(?:\/(learn|practice))?\/?$/);
    if (lesson && url.pathname !== OFFLINE_URL) {
      const view = lesson[2] === "practice" ? "&view=practice" : "";
      return Response.redirect(`${OFFLINE_URL}?slug=${encodeURIComponent(lesson[1])}${view}`, 302);
    }
    const cached = await (await caches.open(PAGES)).match(OFFLINE_URL);
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bookly</title>' +
        '<body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;background:#FBFAF6;color:#14211D">' +
        "<div><h1>Internet yo‘q</h1><p>Ulanib, qayta urinib ko‘ring.</p><button onclick=\"location.reload()\" style=\"padding:14px 24px;border-radius:999px;border:0;background:#0B5D4B;color:#fff;font-size:1rem\">Qayta urinish</button></div>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

/** Downloaded audio from the cache, honouring Range requests (seeking). Otherwise the network. */
async function audio(req) {
  const cache = await caches.open(AUDIO);
  const hit = await cache.match(req.url, { ignoreSearch: true });
  if (!hit) return fetch(req);
  const range = req.headers.get("range");
  if (!range) return hit;
  const blob = await hit.blob();
  const size = blob.size;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? Number(m[1]) : 0;
  let end = m && m[2] ? Number(m[2]) : size - 1;
  if (m && !m[1] && m[2]) {
    start = size - Number(m[2]); // suffix range: last N bytes
    end = size - 1;
  }
  if (start >= size || start > end) {
    return new Response("", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  end = Math.min(end, size - 1);
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": hit.headers.get("Content-Type") || "audio/mpeg",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}
