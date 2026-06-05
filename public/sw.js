// Minimal service worker — its only job is to satisfy Chrome's PWA
// installability criteria (a registered SW with a fetch handler) so that
// `beforeinstallprompt` fires and the home-screen install flow works on
// Android/desktop Chrome.
//
// We deliberately avoid aggressive caching: the app's data (leaderboards,
// predictions, live match state) is highly dynamic and stale responses would
// harm the experience during a live match.

const VERSION = "v1";
const STATIC_CACHE = `prode-static-${VERSION}`;

// Paths that are safe to cache (immutable-ish, served by Next from /_next/
// with hashed filenames, plus the manifest and icons).
const STATIC_PATTERNS = [
  /\/_next\/static\//,
  /\/icon\b/,
  /\/icon1\b/,
  /\/apple-icon\b/,
  /\/manifest\.webmanifest$/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop any old caches from previous versions.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // We only handle GETs. Anything else (Server Actions are POSTs, Supabase
  // mutations, etc.) goes straight to the network.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStatic = STATIC_PATTERNS.some((re) => re.test(url.pathname));

  if (isStatic) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else (HTML pages, API responses, etc.) → network only.
  // This keeps live data fresh during a match. The mere presence of this
  // handler is what makes Chrome consider the site installable.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}
