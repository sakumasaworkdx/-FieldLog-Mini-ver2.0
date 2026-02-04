const CACHE_NAME = "fieldlog-v3.7-final-fix";
const URLS_TO_CACHE = [
  "./v3/index.html",
  "./v3/app.js",
  "./v3/styles.css",
  "./jszip.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 1つずつキャッシュし、万が一1つ失敗しても他を生かす
      return Promise.allSettled(
        URLS_TO_CACHE.map(url => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).catch(() => {
        // オフライン時に見つからない場合はindex.htmlを返す保険
        if (e.request.mode === 'navigate') return caches.match("./v3/index.html");
      });
    })
  );
});
