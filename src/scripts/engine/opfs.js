/**
 * © 2026 Jayson Moo-Young <jayson.m.y@gmail.com>
 * Part of the mBT (Moo Budget Tool) Ecosystem.
 * License: MIT
 */

/* ========= mBTOPFS: Origin Private File System Persistence Engine ========= */
/* Tier 5 Module — OPFS-backed storage with IndexedDB/localStorage cascade.
   Intercepts prodBudget_v5_* keys only. All other keys fall through to localforage.
   Silently degrades on file:// protocol and unsupported browsers.
   No external dependencies. Sets window.mBTOPFS. */
(function () {
    'use strict';

    var _root      = null;
    var _budgetDir = null;
    var _blobDir   = null;
    var _ready     = false;
    var _persisted = false;

    var BUDGET_PREFIX = 'prodBudget_v5_';

    /* ========= KEY SCOPE GUARD ========= */
    /* Hard boundary: only prodBudget_v5_* keys enter OPFS.
       Tool-specific keys (mbtdb_*, stages_*, og_ref_*, etc.) are never intercepted. */
    function _isBudgetKey(key) {
        return typeof key === 'string' && key.indexOf(BUDGET_PREFIX) === 0;
    }

    /* ========= FILENAME HELPERS ========= */
    /* Percent-encode chars unsafe in OPFS filenames, including % itself to allow round-trip decode. */
    function _safeFileName(key) {
        return key.replace(/[\/\\:*?"<>|%]/g, function (c) {
            return '%' + c.charCodeAt(0).toString(16).toUpperCase();
        }) + '.json';
    }

    function _safeBlobName(key) {
        return key.replace(/[\/\\:*?"<>|%]/g, function (c) {
            return '%' + c.charCodeAt(0).toString(16).toUpperCase();
        });
    }

    /* ========= IMMUNITY PROTOCOL ========= */
    /* Request persistent storage — asks the browser not to evict this origin's data
       under storage pressure. Protects IndexedDB, Cache API, and OPFS simultaneously. */
    function requestPersistence() {
        if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
            return Promise.resolve(false);
        }
        return navigator.storage.persist().then(function (granted) {
            _persisted = granted;
            return granted;
        }).catch(function () { return false; });
    }

    /* ========= OPFS INITIALIZATION ========= */
    /* Aggressive try/catch: on file:// protocol, getDirectory() throws SecurityError.
       Sets _ready = false and returns false — all subsequent calls become no-ops. */
    function init() {
        if (!navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
            return Promise.resolve(false);
        }
        return navigator.storage.getDirectory().then(function (root) {
            _root = root;
            return root.getDirectoryHandle('budgets', { create: true });
        }).then(function (budgetDir) {
            _budgetDir = budgetDir;
            return _root.getDirectoryHandle('blobs', { create: true });
        }).then(function (blobDir) {
            _blobDir = blobDir;
            _ready = true;
            return true;
        }).catch(function (e) {
            console.warn('[mBTOPFS] Init failed — OPFS unavailable (file:// or unsupported browser). Cascading to localforage.', e.message || e);
            _ready = false;
            return false;
        });
    }

    /* ========= CORE JSON I/O ========= */

    function saveJSON(key, data) {
        if (!_ready || !_isBudgetKey(key)) return Promise.resolve();
        var filename = _safeFileName(key);
        var json;
        try {
            json = typeof data === 'string' ? data : JSON.stringify(data);
        } catch (e) {
            console.error('[mBTOPFS] Serialization failed for key:', key, e);
            return Promise.resolve();
        }
        if (json.length > 5 * 1024 * 1024) {
            console.warn('[mBTOPFS] Budget data exceeds 5MB (' + Math.round(json.length / 1024) + ' KB). Writing on main thread — Worker path deferred to future phase.');
        }
        return _budgetDir.getFileHandle(filename, { create: true }).then(function (fh) {
            return fh.createWritable();
        }).then(function (writable) {
            return writable.write(json).then(function () {
                return writable.close();
            });
        }).catch(function (e) {
            console.error('[mBTOPFS] saveJSON failed for key:', key, e);
        });
    }

    function loadJSON(key) {
        if (!_ready || !_isBudgetKey(key)) return Promise.resolve(null);
        var filename = _safeFileName(key);
        return _budgetDir.getFileHandle(filename).then(function (fh) {
            return fh.getFile();
        }).then(function (file) {
            return file.text();
        }).then(function (text) {
            try { return JSON.parse(text); } catch (e) { return null; }
        }).catch(function (e) {
            if (e && e.name === 'NotFoundError') return null;
            console.warn('[mBTOPFS] loadJSON error for key:', key, e);
            return null;
        });
    }

    function removeJSON(key) {
        if (!_ready || !_isBudgetKey(key)) return Promise.resolve();
        var filename = _safeFileName(key);
        return _budgetDir.removeEntry(filename).catch(function (e) {
            if (e && e.name === 'NotFoundError') return;
            console.warn('[mBTOPFS] removeJSON error for key:', key, e);
        });
    }

    /* Iterate directory entries via async iterator, using .then() chain for ES5 compatibility. */
    function listKeys() {
        if (!_ready || !_budgetDir) return Promise.resolve([]);
        var keys = [];
        var iter = _budgetDir.entries();
        function _readNext() {
            return iter.next().then(function (result) {
                if (result.done) return keys;
                var name = result.value[0];
                /* Strip .json suffix and decode any percent-encoded chars back to original key */
                if (name.slice(-5) === '.json') {
                    try { keys.push(decodeURIComponent(name.slice(0, -5))); } catch (e) { keys.push(name.slice(0, -5)); }
                }
                return _readNext();
            });
        }
        return _readNext().catch(function (e) {
            console.warn('[mBTOPFS] listKeys error', e);
            return keys;
        });
    }

    /* ========= BLOB I/O ========= */

    function saveBlob(key, blob) {
        if (!_ready || !_blobDir) return Promise.resolve(false);
        var filename = _safeBlobName(key);
        return _blobDir.getFileHandle(filename, { create: true }).then(function (fh) {
            return fh.createWritable();
        }).then(function (writable) {
            return writable.write(blob).then(function () {
                return writable.close();
            }).then(function () { return true; });
        }).catch(function (e) {
            console.error('[mBTOPFS] saveBlob failed for key:', key, e);
            return false;
        });
    }

    function loadBlob(key) {
        if (!_ready || !_blobDir) return Promise.resolve(null);
        var filename = _safeBlobName(key);
        return _blobDir.getFileHandle(filename).then(function (fh) {
            return fh.getFile();
        }).then(function (file) {
            return new Blob([file], { type: file.type || 'application/octet-stream' });
        }).catch(function (e) {
            if (e && e.name === 'NotFoundError') return null;
            console.warn('[mBTOPFS] loadBlob error for key:', key, e);
            return null;
        });
    }

    /* ========= MIGRATION HELPER ========= */
    /* Background migration: copies existing prodBudget_v5_* keys from localforage into OPFS.
       Runs after init() succeeds. Non-blocking — any failure is silently absorbed. */
    function migrateAllBudgets(localforageRef) {
        if (!_ready || !localforageRef || typeof localforageRef.keys !== 'function') {
            return Promise.resolve();
        }
        return localforageRef.keys().then(function (allKeys) {
            var budgetKeys = allKeys.filter(function (k) { return _isBudgetKey(k); });
            var tasks = budgetKeys.map(function (k) {
                /* Only write if OPFS copy is absent — avoid overwriting a newer OPFS version */
                return loadJSON(k).then(function (existing) {
                    if (existing) return;
                    return localforageRef.getItem(k).then(function (data) {
                        if (data) return saveJSON(k, data);
                    });
                });
            });
            return Promise.all(tasks);
        }).catch(function (e) {
            console.warn('[mBTOPFS] Background migration error', e);
        });
    }

    /* ========= PUBLIC API ========= */
    window.mBTOPFS = {
        init:               init,
        isReady:            function () { return _ready; },
        isPersisted:        function () { return _persisted; },
        requestPersistence: requestPersistence,
        save:               saveJSON,
        load:               loadJSON,
        remove:             removeJSON,
        keys:               listKeys,
        saveBlob:           saveBlob,
        loadBlob:           loadBlob,
        migrate:            migrateAllBudgets
    };

})();
