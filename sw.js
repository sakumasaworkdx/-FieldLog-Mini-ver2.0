const CACHE_NAME = "fieldlog-v3.9-cache";
const URLS_TO_CACHE = [
  "./v3/index.html",
  "./v3/app.js",
  "./v3/styles.css",
  "./jszip.min.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

// インストール時にファイルをキャッシュ
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

// オフライン時でもキャッシュから返す
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((res) => {
      return res || fetch(event.request).then((response) => {
        // 地図タイルなどは動的にキャッシュ
        if (event.request.url.includes("tile.openstreetmap.org")) {
          return caches.open("map-tiles").then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        }
        return response;
      });
    }).catch(() => {
      // 完全にオフラインでキャッシュもない場合のフォールバック（任意）
    })
  );
});
