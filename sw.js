self.addEventListener("install", function (e) {
  console.log("[Service Worker] Install");
});

var cacheName = "v1.04";
var appShellFiles = [
  "./ble-handler.js",
  "./compass.js",
  "./gps-handler.js",
  "./index.html",
  "./manifest.json",
  "./p5.js",
  "./p5.ble.js",
  "./sketch.js",
  "./style.css",
  "./test_data.json",
  "./ui-components.js",
  "./utils.js",
];

self.addEventListener("install", function (e) {
  console.log("[Service Worker] Install");
  e.waitUntil(
    caches.open(cacheName).then(function (cache) {
      console.log("[Service Worker] Caching all: app shell and content");
      return cache.addAll(appShellFiles);
    })
  );
});

self.addEventListener("fetch", function (e) {
  // Only cache requests from same origin or our defined app shell files
  if (
    !e.request.url.startsWith(self.location.origin) &&
    !appShellFiles.some((file) => e.request.url.includes(file))
  ) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (r) {
      console.log("[Service Worker] Fetching resource: " + e.request.url);
      return (
        r ||
        fetch(e.request).then(function (response) {
          return caches.open(cacheName).then(function (cache) {
            console.log(
              "[Service Worker] Caching new resource: " + e.request.url
            );
            cache.put(e.request, response.clone());
            return response;
          });
        })
      );
    })
  );
});

// Add periodic background sync registration
self.addEventListener("periodicsync", function (event) {
  if (event.tag === "keep-alive-sync") {
    event.waitUntil(keepAliveTask());
  }
});

async function keepAliveTask() {
  // Perform minimal work to keep the service worker alive
  console.log("[Service Worker] Periodic sync - keeping alive");
  
  // Fetch a dummy text file to perform actual network activity
  try {
    const response = await fetch('./keep-alive.txt?t=' + Date.now());
    if (response.ok) {
      const text = await response.text();
      console.log('[Service Worker] Keep-alive fetch successful:', text.substring(0, 20) + '...');
    }
  } catch (error) {
    console.log("[Service Worker] Keep-alive fetch failed:", error);
  }
}
