/* ========= v1.0 SW: Offline Endurance Cache — full asset precache v2.0 ========= */

const CACHE_NAME = 'mbt-monolith-cache-v6';

const PRECACHE_ASSETS = [
    /* --- Shell entry --- */
    './index.html',
    './manifest.json',
    './cow-maskable.svg',

    /* --- Vendored libraries --- */
    './src/lib/gridstack.min.css',
    './src/lib/gridstack-all.js',
    './src/lib/lucide.min.js',
    './src/lib/tailwind.min.js',
    './src/lib/mammoth.browser.min.js',
    './src/lib/html2pdf.bundle.min.js',
    './src/lib/Sortable.min.js',
    './src/lib/jspdf.umd.min.js',
    './src/lib/jspdf.plugin.autotable.min.js',
    './src/lib/html2canvas.min.js',
    './src/lib/xlsx.full.min.js',
    './src/lib/marked.min.js',
    './src/lib/pdf.min.js',
    './src/lib/localforage.min.js',
    './src/lib/jszip.min.js',
    './src/lib/supabase.min.js',

    /* --- Core scripts --- */
    './src/scripts/storage.js',
    './src/scripts/migration.js',
    './src/scripts/icons.js',
    './src/scripts/self_analysis.js',
    './src/scripts/engine/mbtle.js',
    './src/scripts/engine/opengate.js',
    './src/scripts/engine/totalizer.js',
    './src/scripts/engine/publisher.js',

    /* --- Core modules --- */
    './src/core/mBT.core.js',
    './src/core/blueprints.js',
    './src/core/components/ToolHost.js',
    './src/core/components/EmbeddedMode.js',
    './src/core/services/OpenGate.js',
    './src/core/services/Preflight.js',
    './src/core/services/Contacts.js',
    './src/core/services/Security.js',

    /* --- Config --- */
    './src/config/ai.js',
    './src/config/supabase.js',

    /* --- Services --- */
    './src/services/ai-context.js',
    './src/services/ai-pattern-recognition.js',
    './src/services/ai-reports.js',
    './src/services/supabase-sync.js',

    /* --- Tools manifest --- */
    './src/tools/tools-manifest.json',

    /* --- Tool HTML files --- */
    './src/tools/ai/index.html',
    './src/tools/calendar/index.html',
    './src/tools/contacts/index.html',
    './src/tools/db/index.html',
    './src/tools/publisher/index.html',
    './src/tools/rsi/index.html',
    './src/tools/stages/index.html',
    './src/tools/supabase/index.html',
    './src/tools/template/index.html',

    /* --- PWA icons --- */
    './public/icon-192x192.png',
    './public/icon-512x512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    /* --- Offline-first: cache hit returns immediately, fallback to network --- */
    event.respondWith(
        caches.match(event.request)
            .then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    /* --- Cache successful GET responses for future offline use --- */
                    if (event.request.method === 'GET' && response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
            .catch(() => {
                /* --- Final fallback for navigation requests --- */
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});
