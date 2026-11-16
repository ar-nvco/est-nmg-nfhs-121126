/* NMG Revenue Estimate - offline support.
   When you update anything, change VERSION here AND APP_VERSION in index.html
   to the same number so devices pick up the new files. */
const VERSION = "v7";
const CACHE = "nmg-estimate-" + VERSION;
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

/* Install: download fresh copies from GitHub (skip the browser's own cache). */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(FILES.map((f) =>
        fetch(new Request(f, { cache: "reload" })).then((res) => { if (res.ok) return c.put(f, res); })
      )))
      .then(() => self.skipWaiting())
  );
});

/* Activate: delete older saved versions. */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* The page itself: try the latest from GitHub first (3-second limit),
   fall back to the saved copy when there's no signal.
   Icons and other files: saved copy first. */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([
          fetch(req, { cache: "no-cache" }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
        ]);
        if (res && res.ok) { cache.put("./", res.clone()); return res; }
        throw new Error("bad response");
      } catch (err) {
        return (await cache.match("./")) || (await cache.match("index.html")) || Response.error();
      }
    })());
    return;
  }

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }))
    )
  );
});
