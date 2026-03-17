// Service Worker for mBT Monolith Offline-First PWA
// Precaches critical assets for offline tool usage

const CACHE_NAME = 'mbt-monolith-cache-v4';
const TOOLS_DIR = './src/tools';
const PUBLIC_DIR = './public';
const SCRIPTS_DIR = './public';

// Base URLs for precaching (relative to shell/index.html)
const urlsToCache = [
  // Core pages
  '/public/index.html',
  '/public/shell.js',
  
  // Core scripts - critical framework dependencies
  '/public/core/mBTDB.mBT.core.js',
  '/public/core/mBT.ui.js',
  '/public/scripts/mBTDB.storage.js',
  
  // UI Libraries
  '/lib/tailwind.min.js',
  '/lib/gridstack.min.css',
  '/lib/gridstack-all.js',
  '/lib/Sortable.min.js',
  
  // PDF/XLSX rendering
  '/lib/html2canvas.min.js',
  '/lib/html2pdf.bundle.min.js',
  '/lib/mammoth.browser.min.js',
  
  // Core engine scripts
  '/scripts/engine/mbtle.js',
  '/scripts/engine/totalizer.js',
  '/scripts/ai_suite.js',
  '/scripts/icons.js',
  '/scripts/migration.js',
  
  // Core services
  '/core/services/OpenGate.js',
  '/core/services/Contacts.js',
  '/core/services/Security.js',
  '/core/services/Preflight.js',
  
  // Tool assets - all tool HTML files
  '/src/tools/ai/index.html',
  '/src/tools/contacts/index.html',
  '/src/tools/db/index.html',
  '/src/tools/db_full/index.html',
  '/src/tools/publisher/index.html',
  '/src/tools/rsi/index.html',
  '/src/tools/stages/index.html',
  '/src/tools/supabase/index.html',
  
  // Static assets
  '/public/icon-192x192.png',
  '/public/icon-512x512.png',
  
  // Shell modules
  '/public/modules/mBTBudget.html',
  '/public/modules/mBTDB.html',
  '/public/modules/mBTPublish.html',
  '/public/modules/mBTStages.html',
  '/public/modules/mBTPublish.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Opening cache:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Precache complete for', CACHE_NAME);
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - network-first with cache fallback
self.addEventListener('fetch', (event) => {
  // Don't cache navigation requests to external domains
  if (event.request.mode === 'navigate') {
    return;
  }
  
  const { url } = event.request;
  
  // Block requests with query parameters that might cause issues
  if (url.includes('?') && !urlsToCache.some(p => url.includes(p))) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          console.log('[SW] Cache hit:', url.substring(0, 80));
          return response;
        }
        
        // Network fetch with fallback for local file:// protocol
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-OK responses
            if (!response || !response.ok || response.type !== 'basic') {
              return response;
            }
            
            // Cache the response
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          });
      })
  );
});
