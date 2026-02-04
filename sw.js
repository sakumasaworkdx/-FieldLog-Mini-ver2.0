// 名前を v4.0 に更新することでブラウザに再読込を促します
const CACHE_NAME = "fieldlog-v4.0-cache";

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
  self.skipWaiting(); // 新しいSWをすぐに有効化
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
