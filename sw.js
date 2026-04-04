/* ========= v1.0 SW: Offline Endurance Cache — full asset precache v2.2 ========= */

const CACHE_NAME = 'mbt-monolith-cache-v22';

const PRECACHE_ASSETS = [
    /* --- Shell entry --- */
    './index.html',
    './manifest.json',

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
    './src/scripts/engine/opfs.js',
    './src/scripts/engine/totalizer.js',
    './src/scripts/engine/publisher.js',

    /* --- App CSS --- */
    './public/css/mbt-core.css',

    /* --- Core modules --- */
    './src/core/mBT.core.js',
    './src/core/mBT.assets.js',
    './src/core/mBT.templates.js',
    './src/core/ui.settings.js',
    './src/core/finance.engine.js',
    './src/core/blueprints.js',
    './src/core/components/ToolHost.js',
    './src/core/components/EmbeddedMode.js',
    './src/core/services/OpenGate.js',
    './src/core/services/Preflight.js',
    './src/core/services/Contacts.js',
    './src/core/services/Security.js',
    './src/core/ui/Footer.js',
    './src/core/ui/Toolbar.js',
    './src/core/ui/Calendar.js',
    './src/core/wasm_node/pkg/mbt_wasm.js',

    /* --- Config --- */
    './src/config/ai.js',
    './src/config/supabase.js',

    /* --- Services --- */
    './src/services/ai-context.js',
    './src/services/ai-pattern-recognition.js',
    './src/services/ai-reports.js',
    './src/services/supabase-sync.js',
    './src/services/supabase-realtime.js',

    /* --- Tools manifest --- */
    './src/tools/tools-manifest.json',

    /* --- Tool HTML files --- */
    './src/tools/ai/index.html',
    './src/tools/calendar/index.html',
    './src/tools/contacts/index.html',
    './src/tools/db/index.html',
    './src/tools/diff/index.html',
    './src/tools/fringes/index.html',
    './src/tools/po/index.html',
    './src/tools/publisher/index.html',
    './src/tools/rsi/index.html',
    './src/tools/share/index.html',
    './src/tools/stages/index.html',
    './src/tools/supabase/index.html',
    './src/tools/template/index.html',

    /* --- PWA icons (local — GitHub CDN would cause atomic install failure when offline) --- */
    './assets/mBT.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                /* Map absolute bypass to installation assets to defeat old-SW interception */
                const requests = PRECACHE_ASSETS.map(url => new Request(url, { cache: 'no-store' }));
                return cache.addAll(requests);
            })
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
    /* Only cache GET requests */
    if (event.request.method !== 'GET') return;

    /* --- Navigation requests: network-first so code updates reflect immediately ---
       On file://, "network" is the local file system — always returns the latest version.
       Falls back to cached index.html only when the source is unreachable (true offline). */
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request, { cache: 'no-cache' }).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
                }
                return networkResponse;
            }).catch(() => caches.match('./index.html', { ignoreSearch: true }))
        );
        return;
    }

    /* --- All other assets: stale-while-revalidate for fast loads --- */
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            /* 1. Fire up a network fetch bypassing ALL browser HTTP caches to get the absolute newest version */
            const fetchPromise = fetch(event.request, { cache: 'no-cache' }).then((networkResponse) => {
                /* 2. Silently update the bare-URL cache to prevent query-string bloat */
                if (networkResponse && networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        const cleanUrl = new URL(event.request.url);
                        cleanUrl.search = '';
                        cache.put(cleanUrl, clone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                /* If network fails and we have no cache, fallback for navigation */
                if (!cachedResponse && event.request.mode === 'navigate') {
                    return caches.match('./index.html', { ignoreSearch: true });
                }
            });

            /* 3. Instantly return the cached response for zero-latency UI */
            return cachedResponse || fetchPromise;
        })
    );
});

/* --- Phase 92.9: Background Sync — Activity Log Replay --- */
self.addEventListener('sync', function(event) {
    if (event.tag === 'mbt-activity-sync') {
        event.waitUntil(_swDrainActivityQueue());
    }
});

function _swDrainActivityQueue() {
    return new Promise(function(resolve) {
        var req = indexedDB.open('mBT_DB', 3);
        req.onerror = resolve;
        req.onsuccess = function(e) {
            var db = e.target.result;
            /* Read SW credentials */
            var tx = db.transaction(['mbt_generic'], 'readonly');
            var cfgReq = tx.objectStore('mbt_generic').get('mbt_supabase_config_for_sw');
            cfgReq.onerror = resolve;
            cfgReq.onsuccess = function(cfgE) {
                var cfgRecord = cfgE.target.result;
                if (!cfgRecord || !cfgRecord.value || !cfgRecord.value.api_url || !cfgRecord.value.auth_token) {
                    resolve(); return;
                }
                var cfg = cfgRecord.value;
                /* Read activity queue */
                var tx2 = db.transaction(['mbt_generic'], 'readonly');
                var qReq = tx2.objectStore('mbt_generic').get('activity_offline_queue');
                qReq.onerror = resolve;
                qReq.onsuccess = function(qE) {
                    var qRecord = qE.target.result;
                    var entries = (qRecord && Array.isArray(qRecord.value)) ? qRecord.value : [];
                    if (!entries.length) { resolve(); return; }
                    var posts = entries.map(function(entry) {
                        return fetch(cfg.api_url + '/rest/v1/mbt_activity_log', {
                            method: 'POST',
                            headers: {
                                'Content-Type':  'application/json',
                                'apikey':        cfg.anon_key || '',
                                'Authorization': 'Bearer ' + cfg.auth_token,
                                'Prefer':        'return=minimal'
                            },
                            body: JSON.stringify(entry)
                        });
                    });
                    Promise.all(posts).then(function() {
                        /* Clear queue on full success */
                        var writeTx = db.transaction(['mbt_generic'], 'readwrite');
                        var delReq  = writeTx.objectStore('mbt_generic').delete('activity_offline_queue');
                        delReq.onsuccess = resolve;
                        delReq.onerror   = resolve;
                    }).catch(resolve); /* Leave queue intact — SW will retry on next sync event */
                };
            };
        };
    });
}
