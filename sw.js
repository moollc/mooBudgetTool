const CACHE_NAME = 'moo-budget-v19-49';

// We cache both the root and the explicit index.html to be safe
const CRITICAL_ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

// External libraries & Assets
const EXTERNAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/lucide/0.263/lucide.min.js',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    // FIXED: Updated Icon Paths (PNGs)
    'https://raw.githubusercontent.com/moollc/mooBudgetTool/main/assets/cow-512.png',
    'https://raw.githubusercontent.com/moollc/mooBudgetTool/main/assets/cow-192.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await cache.addAll(CRITICAL_ASSETS);
            await Promise.all(
                EXTERNAL_ASSETS.map(url => 
                    fetch(url).then(res => {
                        if (res.ok) return cache.put(url, res);
                    }).catch(err => console.log('Failed to cache external:', url))
                )
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        ))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        (async () => {
            try {
                const networkResponse = await fetch(event.request);
                if (networkResponse && networkResponse.status === 200) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            } catch (error) {
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) return cachedResponse;
                if (event.request.mode === 'navigate') return caches.match('./index.html');
                return new Response("Offline", { status: 503, headers: { 'Content-Type': 'text/plain' } });
            }
        })()
    );
});
