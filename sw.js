const CACHE_NAME = "fieldlog-v3.9-final";
// キャッシュするファイルのリスト（パスを正確に記述）
const URLS_TO_CACHE = [
  "/field_memo/v3/index.html",
  "/field_memo/v3/app.js",
  "/field_memo/v3/styles.css",
  "/field_memo/jszip.min.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting(); // 新しいバージョンを即座に適用
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
      if (res) return res; // キャッシュがあればそれを返す

      return fetch(event.request).then((response) => {
        // 地図タイル（背景画像）は、取得できたらその場でキャッシュに保存する
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
