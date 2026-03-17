/**
 * mBT Preflight - Offline Survival Check
 * Runs on boot to verify IndexedDB and core stores exist
 */

(function () {
    'use strict';

    var Preflight = {
        check: function () {
            var results = [];
            var errors = [];

            // Check 1: IndexedDB availability
            if (typeof indexedDB === 'undefined') {
                errors.push('IndexedDB API not available');
            }

            // Check 2: Core stores exist
            if (indexedDB) {
                var request = indexedDB.open('mBT_DB', 2);

                request.onerror = function () {
                    errors.push('Failed to open IndexedDB');
                };

                request.onsuccess = function () {
                    var db = request.result;

                    var requiredStores = [
                        'mbt_projects',
                        'mbt_stages',
                        'mbt_executions',
                        'og_ref',
                        'mbt_generic',
                        'contacts',
                        'sessions'
                    ];

                    for (var i = 0; i < requiredStores.length; i++) {
                        var storeName = requiredStores[i];
                        if (!db.objectStoreNames.contains(storeName)) {
                            errors.push('Store missing: ' + storeName);
                        } else {
                            results.push('✓ Store "' + storeName + '" exists');
                        }
                    }
                };

                request.onupgradeneeded = function (event) {
                    var db = event.target.result;

                    // Create missing stores on upgrade
                    if (!db.objectStoreNames.contains('mbt_projects')) {
                        db.createObjectStore('mbt_projects', { keyPath: 'id' });
                        results.push('✓ Created store: mbt_projects');
                    }

                    if (!db.objectStoreNames.contains('mbt_stages')) {
                        db.createObjectStore('mbt_stages', { keyPath: 'id' });
                        results.push('✓ Created store: mbt_stages');
                    }

                    if (!db.objectStoreNames.contains('mbt_executions')) {
                        db.createObjectStore('mbt_executions', { keyPath: 'id' });
                        results.push('✓ Created store: mbt_executions');
                    }

                    if (!db.objectStoreNames.contains('og_ref')) {
                        db.createObjectStore('og_ref', { keyPath: 'id' });
                        results.push('✓ Created store: og_ref');
                    }

                    if (!db.objectStoreNames.contains('mbt_generic')) {
                        db.createObjectStore('mbt_generic', { keyPath: 'key' });
                        results.push('✓ Created store: mbt_generic');
                    }

                    if (!db.objectStoreNames.contains('contacts')) {
                        db.createObjectStore('contacts', { keyPath: 'id' });
                        results.push('✓ Created store: contacts');
                    }

                    if (!db.objectStoreNames.contains('sessions')) {
                        db.createObjectStore('sessions', { keyPath: 'id' });
                        results.push('✓ Created store: sessions');
                    }
                };
            }

            // Check 3: PWA manifest
            if (typeof document !== 'undefined') {
                var link = document.querySelector('link[rel="manifest"]');
                if (!link) {
                    errors.push('PWA manifest not found');
                } else {
                    results.push('✓ PWA manifest configured');
                }
            }

            // Check 4: Service Worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(function () {
                    results.push('✓ Service Worker registered');
                }).catch(function () {
                    // Service worker optional
                });
            }

            // Output results
            for (var i = 0; i < results.length; i++) {
                console.log(results[i]);
            }

            if (errors.length > 0) {
                for (var j = 0; j < errors.length; j++) {
                    console.error(errors[j]);
                }
            }

            return {
                passed: errors.length === 0,
                results: results,
                errors: errors,
                version: '1.0.0'
            };
        },

        report: function (data) {
            var statusEl = document.getElementById('preflight-status');
            var detailsEl = document.getElementById('preflight-details');

            if (statusEl) {
                if (data.passed) {
                    statusEl.textContent = '✓ Ready';
                    statusEl.style.color = '#10b981';
                } else {
                    statusEl.textContent = '⚠ Issues';
                    statusEl.style.color = '#f59e0b';
                }
            }

            if (detailsEl) {
                detailsEl.innerHTML = data.results.map(function (r) {
                    return '<div class="preflight-line">' + r + '</div>';
                }).join('');
            }
        },

        /* --- Manifest: validates tool paths from tools-manifest.json exist --- */
        checkManifest: function () {
            fetch('./src/tools/tools-manifest.json')
                .then(function (r) { return r.json(); })
                .then(function (manifest) {
                    if (!Array.isArray(manifest)) return;
                    manifest.forEach(function (tool) {
                        if (!tool.path) return;
                        fetch(tool.path)
                            .then(function () {
                                console.log('[mBT Preflight] Tool OK: ' + tool.id);
                            })
                            .catch(function () {
                                console.warn('[mBT Preflight] Tool missing: ' + tool.id + ' at ' + tool.path);
                                document.dispatchEvent(new CustomEvent('mbt:tool-missing', {
                                    bubbles: true,
                                    detail: { id: tool.id, path: tool.path }
                                }));
                            });
                    });
                })
                .catch(function () {
                    console.warn('[mBT Preflight] tools-manifest.json not found');
                });
        }
    };

    // Expose globally
    window.mBT = window.mBT || {};
    window.mBT.preflight = Preflight;

    // Auto-run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            Preflight.check();
            Preflight.checkManifest();
            console.log('[mBT] Preflight initialized ✓');
        });
    } else {
        Preflight.check();
        Preflight.checkManifest();
        console.log('[mBT] Preflight initialized ✓');
    }

    console.log('[mBT] Preflight module loaded ✓');
})();