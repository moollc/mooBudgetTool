/* ========= v1.1 SW: Offline Endurance Cache — full asset precache v2.4 ========= */

var CACHE_NAME = 'mbt-monolith-cache-v22.94';

var PRECACHE_ASSETS = [
    /* --- Shell entry --- */
    './index.html',
    './manifest.json',
    './metadata.json',
    './PrivacyPolicy.md',
    './UserAgreement.md',
    './LICENSE',
    './CREDITS.md',
    './LIBRARY_VERSIONS.md',

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
    './src/scripts/engine/mbtle.js',
    './src/scripts/engine/opengate.js',
    './src/scripts/engine/opengate-api.js',
    './src/scripts/engine/opfs.js',
    './src/scripts/engine/publisher.js',

    /* --- Event routing & AI bridge --- */
    './src/core/logic/EventRouter.js',
    './src/core/logic/AIModule.js',
    './src/core/logic/ContextLedger.js',

    /* --- App CSS --- */
    './public/css/mbt-core.css',
    './public/globals.css',

    /* --- Core UI modules (loaded by monolith) --- */
    './src/core/mBT.assets.js',
    './src/core/mBT.templates.js',
    './src/core/ui.settings.js',
    './src/core/finance.engine.js',

    /* --- Core services (loaded by monolith) --- */
    './src/core/services/Security.js',
    './src/config/supabase.js',
    './src/services/supabase-sync.js',
    './src/services/supabase-realtime.js',

    /* --- Core UI components (loaded by monolith) --- */
    './src/core/ui/Calendar.js',
    './src/core/ui/Footer.js',
    './src/core/ui/Toolbar.js',

    /* --- WebAssembly modules (full offline support — all build targets) --- */
    './src/core/wasm/mbt_wasm.js',
    './src/core/wasm/mbt_wasm_bg.wasm',
    './src/core/wasm_node/mbt_wasm.js',
    './src/core/wasm_node/mbt_wasm_bg.wasm',
    './src/core/wasm_node/mbt_wasm_node.js',
    './src/core/wasm_node/mbt_wasm_node_bg.wasm',
    './src/core/wasm_node/pkg/mbt_wasm.js',
    './src/core/wasm_node/pkg/mbt_wasm_bg.wasm',

    /* --- AI tool dependencies (loaded by src/tools/ai/index.html iframe) --- */
    './src/services/ai-context.js',

    /* --- Tool HTML files (dynamically loaded via openTool() iframes) --- */
    './src/tools/tools-manifest.json',
    './src/tools/ai/index.html',
    './src/tools/calendar_benchmark/index.html',
    './src/tools/contacts/index.html',
    './src/tools/db/index.html',
    './src/tools/diff/index.html',
    './src/tools/fringes/index.html',
    './src/tools/po/index.html',
    './src/tools/publisher/index.html',
    './src/tools/rsi/index.html',
    './src/tools/rsi/DEBT.json',
    './src/tools/share/index.html',
    './src/tools/stages/index.html',
    './src/tools/supabase/index.html',
    './src/tools/template/index.html',

    /* --- PWA icons (offline-critical for installation) --- */
    './assets/cow-192.png',
    './assets/cow-512.png',
    './assets/mBT.svg'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                /* Map absolute bypass to installation assets to defeat old-SW interception.
                   Individual .add() + .catch() ensures one failing asset never aborts install —
                   missed assets are fetched from network on first use and cached at that point. */
                var requests = PRECACHE_ASSETS.map(function(url) {
                    return new Request(url, { cache: 'no-store' });
                });
                var promises = requests.map(function(req) {
                    return cache.add(req).catch(function() {
                        /* Non-fatal: log miss, SW install continues */
                    });
                });
                return Promise.all(promises);
            })
            .then(function() { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames
                    .filter(function(name) { return name !== CACHE_NAME; })
                    .map(function(name) { return caches.delete(name); })
            );
        }).then(function() { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function(event) {
    /* Only cache GET requests */
    if (event.request.method !== 'GET') return;

    /* --- Cache-first strategy: ALL assets (including navigate) served from cache first ---
       Ensures zero-latency loads and infinite offline resilience. Network fetches only happen
       when: (1) asset not in cache, or (2) user explicitly calls reg.update().
       This fixes offline app breakage caused by slow network timeouts. */
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(function(cachedResponse) {
            /* 1. If cached, return immediately for zero-latency UX */
            if (cachedResponse) {
                return cachedResponse;
            }

            /* 2. Not in cache — fetch from network */
            return fetch(event.request, { cache: 'no-cache' }).then(function(networkResponse) {
                /* 3. Silently update the cache with successful response */
                if (networkResponse && networkResponse.status === 200) {
                    var clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        var cleanUrl = new URL(event.request.url);
                        cleanUrl.search = '';
                        return cache.put(cleanUrl, clone);
                    });
                }
                return networkResponse;
            }).catch(function() {
                /* 4. Network failed and nothing in cache — fallback for navigation */
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html', { ignoreSearch: true });
                }
                /* Non-navigation miss: return empty 503 so respondWith gets a valid Response */
                return new Response('', { status: 503, statusText: 'Offline' });
            });
        })
    );
});

/* --- Task 13: SKIP_WAITING bridge — client sends this to activate a waiting SW immediately --- */
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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
