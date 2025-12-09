const CACHE_NAME = 'moo-budget-v5'; // Incremented version

// We cache both the root and the explicit index.html to be safe
const CRITICAL_ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

// External libraries
const EXTERNAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/lucide/0.263/lucide.min.js',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/lucide/0.263/cow.svg' // CRITICAL: Cache the icon so PWA is valid
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // 1. Cache Critical files (Wait for this)
            await cache.addAll(CRITICAL_ASSETS);
            
            // 2. Cache External files (Don't let one failure break the installation)
            // We use map to try each one individually
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
    // Take control of the page immediately
    event.waitUntil(self.clients.claim());
    // Clear old caches
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
                // STRATEGY: Network First
                // Try to get the fresh version from the internet
                const networkResponse = await fetch(event.request);
                
                // If successful, save it to cache for next time
                if (networkResponse && networkResponse.status === 200) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, networkResponse.clone());
                }
                
                return networkResponse;
            } catch (error) {
                // NETWORK FAILED (Offline)
                console.log('Offline: Serving from cache', event.request.url);
                
                // Try to find it in the cache
                const cachedResponse = await caches.match(event.request);
                
                if (cachedResponse) {
                    return cachedResponse;
                }

                // FALLBACK: If the user is asking for a page but we don't have it,
                // serve the main index.html (useful for Single Page Apps)
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }

                // If we have nothing, unfortunately we must return an error response
                // or the browser will show a generic connection error.
                return new Response("You are offline and this file is not cached.", { 
                    status: 503, 
                    headers: { 'Content-Type': 'text/plain' } 
                });
            }
        })()
    );
});