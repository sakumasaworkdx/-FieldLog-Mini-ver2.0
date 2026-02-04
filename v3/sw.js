const CACHE_NAME = "fieldlog-v3.8-cache";
const URLS_TO_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE)));
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("tile.openstreetmap.org")) {
    event.respondWith(
      caches.open("map-tiles").then((cache) => {
        return cache.match(event.request).then((response) => {
          return response || fetch(event.request).then((newResponse) => {
            cache.put(event.request, newResponse.clone());
            return newResponse;
          });
        });
      })
    );
  } else {
    event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
  }
});
