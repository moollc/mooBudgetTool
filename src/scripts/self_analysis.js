/* ========= v7.1 Self Analysis: Codebase Health Diagnostics v23.0 ========= */
/*
 * Phase 7.1 Auditor (original): namespace, dead code, bundle analysis.
 * Phase 23 extension: IDB store record counts, storage quota, error capture,
 *   global module verification, RSI debt summary.
 *
 * Exposes: window.mBT.rsi.Auditor.run()
 *          window.mBTAudit()                  (shortcut — existing)
 *          window.mBTSelfAnalysis.run()        (Phase 23 extended report)
 *          window.mBTSelfAnalysis.log()        (console.table output)
 */
(function () {
    'use strict';

    window.mBT = window.mBT || {};
    window.mBT.rsi = window.mBT.rsi || {};

    var Auditor = {
        /**
         * Runs the full analysis suite and heavily prints to console.
         */
        run: function () {
            console.groupCollapsed('%c[mBT Auditor] System Health Report', 'color: #3b82f6; font-size: 14px; font-weight: bold;');

            console.log("Running Phase 7.1 RSI Diagnostics...");
            this.checkNamespaceHealth();
            this.detectDeadCode();
            this.analyzeBundle();

            console.log('%cAudit Complete.', 'color: #10b981; font-weight: bold;');
            console.groupEnd();

            return "Audit Complete. Open console to view results.";
        },

        checkNamespaceHealth: function () {
            console.group('Namespace Health (window.mBT)');
            var mbt = window.mBT;
            var healthy = true;

            // Expected namespaces based on Phase 4-6 architectures
            var expectedKeys = ['core', 'icons', 'storage', 'le'];
            expectedKeys.forEach(function(key) {
                if (mbt[key]) {
                    console.log('window.mBT.' + key + ': ACTIVE');
                } else {
                    console.warn('window.mBT.' + key + ': MISSING');
                    healthy = false;
                }
            });

            // Storage specific check
            if (mbt.storage) {
                if (typeof mbt.storage.validateSchema === 'function') {
                    console.log('Storage Schema Validator: ACTIVE');
                }
            } else {
                console.warn('Storage core missing or not initialized.');
            }

            console.groupEnd();
            return healthy;
        },

        detectDeadCode: function () {
            console.group('Dead Code & Route Detector');

            // 1. Check UI Navigation vs Route Panels (Shell Level)
            var navButtons = document.querySelectorAll('#sidebar-nav .nav-btn[data-route]');
            var panels = document.querySelectorAll('.route-panel');

            var buttonRoutes = Array.from(navButtons).map(function(b) { return b.getAttribute('data-route'); });
            var panelRoutes = Array.from(panels).map(function(p) { return p.id.replace('panel-', ''); });

            // Check if every button has a panel
            buttonRoutes.forEach(function(r) {
                if (panelRoutes.indexOf(r) === -1) {
                    console.error('Route mismatch: Button exists for \'' + r + '\', but no #panel-' + r + ' found.');
                } else {
                    console.log('Route mapping: ' + r + ' button -> panel');
                }
            });

            // Check if every panel has a button (could be internal, but worth warning)
            panelRoutes.forEach(function(r) {
                if (buttonRoutes.indexOf(r) === -1) {
                    console.warn('Orphan Panel: #panel-' + r + ' exists, but no sidebar button links to it.');
                }
            });

            // 2. Check registered JS route handlers
            if (window.mBT.core && window.mBT.core.routes && window.mBT.core.routes.handlers) {
                var handlers = Object.keys(window.mBT.core.routes.handlers);
                handlers.forEach(function(h) {
                    if (panelRoutes.indexOf(h) === -1) {
                        console.warn('Orphan Route Handler: Function registered for \'' + h + '\', but no panel exists.');
                    }
                });
            }

            console.groupEnd();
        },

        analyzeBundle: function () {
            console.group('Bundle & Resource Analysis');

            // Count scripts in document
            var scripts = document.querySelectorAll('script');
            var scriptSources = [];
            var inlineCount = 0;

            scripts.forEach(function(s) {
                var src = s.getAttribute('src');
                if (src) {
                    scriptSources.push(src);
                } else {
                    inlineCount++;
                }
            });

            // Check for duplicate script inclusions
            var duplicates = scriptSources.filter(function(item, index) { return scriptSources.indexOf(item) !== index; });

            if (duplicates.length > 0) {
                console.warn('Duplicate scripts detected:', duplicates);
            } else {
                console.log('No duplicate script inclusions found.');
            }

            console.log('Total Scripts: ' + scripts.length + ' (' + scriptSources.length + ' external, ' + inlineCount + ' inline)');
            scriptSources.forEach(function(src) { console.log('   - ' + src); });

            // Very basic local storage size check (approximation)
            try {
                var _lsTotal = 0, _xLen, _x;
                for (_x in localStorage) {
                    if (!localStorage.hasOwnProperty(_x)) continue;
                    _xLen = ((localStorage[_x].length + _x.length) * 2);
                    _lsTotal += _xLen;
                }
                var lsKB = (_lsTotal / 1024).toFixed(2);
                console.log('LocalStorage usage: ~' + lsKB + ' KB');
            } catch (e) {
                console.log('LocalStorage usage: [Restricted]');
            }

            console.groupEnd();
        }
    };

    // Attach to namespace
    window.mBT.rsi.Auditor = Auditor;

    /* --- Shortcut: run Phase 7.1 auditor --- */
    window.mBTAudit = function () {
        return window.mBT.rsi.Auditor.run();
    };

    /* ========= Phase 23 Extension: IDB + Quota + Error Capture ========= */

    /* --- Known mBT top-level globals to verify --- */
    var EXPECTED_GLOBALS = [
        'mBTLE', 'mBTSupabaseConfig', 'mBTSync',
        'mBTAIConfig', 'mBTAIContext', 'mBTPatterns', 'mBTReports',
        'mBTEmbedded', 'mBTBridge', 'mBTSelfAnalysis'
    ];

    /* --- IDB store names mirrored from storage.js --- */
    var STORES = ['mbt_projects', 'mbt_stages', 'mbt_executions', 'og_ref', 'mbt_generic', 'contacts', 'sessions'];

    /* --- Console error capture: intercept after page load --- */
    var _capturedErrors = [];
    var _origError = console.error.bind(console);
    console.error = function () {
        var msg = Array.prototype.slice.call(arguments).map(function (a) {
            return typeof a === 'object' ? (a && a.message ? a.message : JSON.stringify(a)) : String(a);
        }).join(' ');
        _capturedErrors.push({ time: new Date().toISOString(), message: msg });
        _origError.apply(console, arguments);
    };

    /* --- Count records in one IDB store --- */
    function countStore(db, name) {
        return new Promise(function (resolve) {
            try {
                var req = db.transaction(name, 'readonly').objectStore(name).count();
                req.onsuccess = function () { resolve({ store: name, count: req.result || 0, error: null }); };
                req.onerror = function () { resolve({ store: name, count: 0, error: req.error ? req.error.message : 'idb error' }); };
            } catch (e) {
                resolve({ store: name, count: 0, error: e.message });
            }
        });
    }

    /* --- Storage quota from navigator.storage.estimate --- */
    function quotaEstimate() {
        if (navigator.storage && navigator.storage.estimate) {
            return navigator.storage.estimate().then(function (est) {
                return {
                    usageMB: (est.usage / 1048576).toFixed(2),
                    quotaMB: (est.quota / 1048576).toFixed(2),
                    percentUsed: ((est.usage / est.quota) * 100).toFixed(1)
                };
            });
        }
        return Promise.resolve({ usageMB: 'n/a', quotaMB: 'n/a', percentUsed: 'n/a' });
    }

    /* --- Global module presence check --- */
    function checkGlobals() {
        return EXPECTED_GLOBALS.map(function (name) {
            var val = window[name];
            return { global: name, loaded: val !== undefined && val !== null };
        });
    }

    /* --- Full Phase 23 report --- */
    function runExtended() {
        var report = { timestamp: new Date().toISOString(), globals: [], stores: [], quota: {}, errors: [], summary: [] };
        report.globals = checkGlobals();

        var dbPromise = new Promise(function (resolve, reject) {
            var req = indexedDB.open('mBT_DB');
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });

        return dbPromise.then(function (db) {
            return Promise.all([
                Promise.all(STORES.map(function (s) { return countStore(db, s); })),
                quotaEstimate()
            ]);
        }).then(function (results) {
            report.stores = results[0];
            report.quota  = results[1];
            report.errors = _capturedErrors.slice();

            var missing      = report.globals.filter(function (g) { return !g.loaded; });
            var totalRecords = report.stores.reduce(function (sum, s) { return sum + s.count; }, 0);
            var storeErrs    = report.stores.filter(function (s) { return s.error; });

            report.summary = [
                { check: 'Globals loaded',    value: (report.globals.length - missing.length) + '/' + report.globals.length },
                { check: 'Missing globals',   value: missing.map(function (g) { return g.global; }).join(', ') || 'none' },
                { check: 'Total IDB records', value: totalRecords },
                { check: 'Store errors',      value: storeErrs.length ? storeErrs.map(function (s) { return s.store; }).join(', ') : 'none' },
                { check: 'Storage used',      value: report.quota.usageMB + ' MB / ' + report.quota.quotaMB + ' MB (' + report.quota.percentUsed + '%)' },
                { check: 'Console errors',    value: report.errors.length }
            ];
            return report;
        }).catch(function (err) {
            report.summary = [{ check: 'Analysis failed', value: err.message }];
            return report;
        });
    }

    /* --- Expose Phase 23 API --- */
    window.mBTSelfAnalysis = {
        run: runExtended,
        /* --- log: run and pretty-print to console --- */
        log: function () {
            return runExtended().then(function (r) {
                console.group('[mBT Self-Analysis v23]');
                console.table(r.summary);
                console.group('Globals'); console.table(r.globals); console.groupEnd();
                console.group('IDB Stores'); console.table(r.stores); console.groupEnd();
                if (r.errors.length) { console.group('Errors'); console.table(r.errors); console.groupEnd(); }
                console.groupEnd();
                return r;
            });
        }
    };

    console.log('[mBT] Self-Analysis v23 loaded. Run: window.mBTSelfAnalysis.log()');

})();
