const CACHE_NAME = "fieldlog-v3.9-fixed";

// ドット（.）から始めることで、現在の場所からの相対パスになります
const URLS_TO_CACHE = [
  "./v3/index.html",
  "./v3/app.js",
  "./v3/styles.css",
  "./jszip.min.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
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
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((res) => {
      return res || fetch(event.request).then((response) => {
        // 地図タイルをキャッシュする設定
        if (event.request.url.includes("tile.openstreetmap.org")) {
          const resClone = response.clone();
          caches.open("map-tiles").then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return response;
      });
    })
  );
});
