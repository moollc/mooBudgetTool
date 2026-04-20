/* ========= mBT Context Ledger — Phase 149.2 =========
   A persistent, per-project index of everything the Assistant can pull into an LLM context:
   treatments, scripts, attachments, receipts (PO + petty cash), template-fills, budget snapshots.
   Stored in localforage under ledger_v1_<projectName>. Queries are scoped to the active project;
   no cross-project bleed unless the caller explicitly passes another projectKey.

   Tokens are estimated at ~4 chars/token (standard GPT heuristic).
   ===================================================== */

(function () {
    'use strict';

    var STORE_PREFIX    = 'ledger_v1_';
    var DEFAULT_MAX     = 12000;         /* default token cap per query */
    var RETENTION_DAYS  = 365;           /* drop entries older than this on startup */
    var MAX_ENTRY_CHARS = 60000;         /* clip any single entry */
    var _cache          = {};            /* in-memory cache of the active ledger */
    var _activeKey      = null;
    var _listeners      = [];            /* change listeners */
    var _silent         = false;         /* suppress _emit during batch operations */

    function _projectKey(name) {
        if (!name) return null;
        return STORE_PREFIX + String(name).replace(/\s+/g, '_').toLowerCase();
    }

    function _tokensOf(text) {
        if (!text) return 0;
        return Math.ceil(String(text).length / 4);
    }

    function _now() { return new Date().toISOString(); }

    function _uid(prefix) {
        return (prefix || 'l') + '_' + Date.now() + '_' + Math.floor(Math.random() * 1e6).toString(36);
    }

    function _hash(s) {
        /* Simple djb2 hash — dedup key for content */
        var h = 5381;
        s = String(s || '');
        for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
        return 'h' + (h >>> 0).toString(36);
    }

    function _persist(key, ledger) {
        if (!window.localforage || !key) return Promise.resolve();
        return window.localforage.setItem(key, ledger).catch(function () { /* quota / unavailable — ignore */ });
    }

    function _emit() {
        if (_silent) return;
        for (var i = 0; i < _listeners.length; i++) {
            try { _listeners[i](_cache); } catch (e) { /* subscriber threw — continue */ }
        }
    }

    /* --- Public API ------------------------------------------------- */

    function setActiveProject(projectName) {
        var key = _projectKey(projectName);
        if (!key) { _activeKey = null; _cache = { entries: [], projectName: null }; return Promise.resolve(_cache); }
        if (key === _activeKey) return Promise.resolve(_cache);
        _activeKey = key;
        if (!window.localforage) {
            _cache = { entries: [], projectName: projectName };
            return Promise.resolve(_cache);
        }
        return window.localforage.getItem(key).then(function (data) {
            _cache = (data && data.entries) ? data : { entries: [], projectName: projectName };
            _cache.projectName = projectName;
            _gcRetention();
            _emit();
            return _cache;
        }).catch(function () {
            _cache = { entries: [], projectName: projectName };
            return _cache;
        });
    }

    function _gcRetention() {
        if (!_cache || !_cache.entries) return;
        var cutoff = Date.now() - RETENTION_DAYS * 86400000;
        var keep = [];
        for (var i = 0; i < _cache.entries.length; i++) {
            var e = _cache.entries[i];
            /* Receipts and snapshots get full retention; treatments/scripts never expire */
            if (e.type === 'treatment' || e.type === 'script') { keep.push(e); continue; }
            if (new Date(e.addedAt).getTime() >= cutoff) keep.push(e);
        }
        if (keep.length !== _cache.entries.length) {
            _cache.entries = keep;
            _persist(_activeKey, _cache);
        }
    }

    function add(entry) {
        if (!entry || !entry.type) return Promise.resolve(null);
        if (!_activeKey) return Promise.resolve(null);

        var text = String(entry.text || '').slice(0, MAX_ENTRY_CHARS);
        var rec = {
            id:       entry.id || _uid(entry.type),
            type:     entry.type,
            name:     entry.name || entry.type,
            text:     text,
            meta:     entry.meta || {},
            addedAt:  entry.addedAt || _now(),
            tokensEst: _tokensOf(text + JSON.stringify(entry.meta || {})),
            hash:     _hash((entry.name || '') + '|' + text)
        };

        /* Dedup: if an entry of same type + same hash exists, replace instead of double-adding */
        var entries = _cache.entries || [];
        var replaced = false;
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].type === rec.type && entries[i].hash === rec.hash) {
                rec.id = entries[i].id;
                entries[i] = rec;
                replaced = true;
                break;
            }
        }
        if (!replaced) entries.push(rec);
        _cache.entries = entries;
        _emit();
        return _persist(_activeKey, _cache).then(function () { return rec; });
    }

    function addBatch(items) {
        if (!items || !items.length) return Promise.resolve([]);
        var out = [];
        _silent = true;
        var chain = Promise.resolve();
        items.forEach(function (it) {
            chain = chain.then(function () { return add(it); }).then(function (r) { if (r) out.push(r); });
        });
        return chain.then(function () {
            _silent = false;
            _emit();
            return out;
        }).catch(function (e) { _silent = false; _emit(); throw e; });
    }

    function remove(id) {
        if (!_cache.entries) return Promise.resolve(false);
        var before = _cache.entries.length;
        _cache.entries = _cache.entries.filter(function (e) { return e.id !== id; });
        if (_cache.entries.length === before) return Promise.resolve(false);
        _emit();
        return _persist(_activeKey, _cache).then(function () { return true; });
    }

    function removeByType(type) {
        if (!_cache.entries) return Promise.resolve(0);
        var before = _cache.entries.length;
        _cache.entries = _cache.entries.filter(function (e) { return e.type !== type; });
        var removed = before - _cache.entries.length;
        if (removed) { _emit(); _persist(_activeKey, _cache); }
        return Promise.resolve(removed);
    }

    function purge(olderThanDays) {
        if (!_cache.entries) return Promise.resolve(0);
        var cutoff = Date.now() - (olderThanDays || 0) * 86400000;
        var before = _cache.entries.length;
        _cache.entries = _cache.entries.filter(function (e) {
            if (e.type === 'treatment' || e.type === 'script') return true;
            return new Date(e.addedAt).getTime() >= cutoff;
        });
        var removed = before - _cache.entries.length;
        if (removed) { _emit(); _persist(_activeKey, _cache); }
        return Promise.resolve(removed);
    }

    function clearAll() {
        _cache.entries = [];
        _emit();
        return _persist(_activeKey, _cache);
    }

    function summary() {
        var entries = (_cache && _cache.entries) || [];
        var byType = {};
        var total = 0;
        for (var i = 0; i < entries.length; i++) {
            var t = entries[i].type;
            if (!byType[t]) byType[t] = { count: 0, tokens: 0 };
            byType[t].count++;
            byType[t].tokens += entries[i].tokensEst || 0;
            total += entries[i].tokensEst || 0;
        }
        return { projectName: _cache.projectName, totalTokens: total, byType: byType, entryCount: entries.length };
    }

    function totalTokens() {
        return summary().totalTokens;
    }

    /* Query — returns an object { slices: {type:[strings]}, totalTokens, usedEntries } */
    function query(opts) {
        opts = opts || {};
        var maxTokens = opts.maxTokens || DEFAULT_MAX;
        var wantTypes = opts.types || null; /* null = all */
        var entries = (_cache && _cache.entries) || [];

        /* Priority order: treatment > script > budget-snapshot > template-fill > attachment > receipt (newest first inside type) */
        var PRIORITY = { 'treatment': 0, 'script': 1, 'budget-snapshot': 2, 'template-fill': 3, 'attachment': 4, 'receipt': 5 };

        var filtered = entries.filter(function (e) { return !wantTypes || wantTypes.indexOf(e.type) > -1; });
        filtered.sort(function (a, b) {
            var pa = PRIORITY[a.type] != null ? PRIORITY[a.type] : 99;
            var pb = PRIORITY[b.type] != null ? PRIORITY[b.type] : 99;
            if (pa !== pb) return pa - pb;
            /* same type → newest first */
            return (b.addedAt || '').localeCompare(a.addedAt || '');
        });

        var slices = {};
        var used = [];
        var budget = 0;
        for (var i = 0; i < filtered.length; i++) {
            var e = filtered[i];
            var cost = e.tokensEst || _tokensOf(e.text);
            if (budget + cost > maxTokens) {
                /* partial include: clip the tail of receipts/attachments so budget is respected */
                if (e.type === 'receipt' || e.type === 'attachment') {
                    var remaining = Math.max(0, maxTokens - budget);
                    if (remaining < 64) break;
                    var clippedText = String(e.text || '').slice(0, remaining * 4);
                    if (!slices[e.type]) slices[e.type] = [];
                    slices[e.type].push('[' + e.name + '] ' + clippedText + ' …(clipped)');
                    used.push({ id: e.id, type: e.type, name: e.name, tokens: remaining, clipped: true });
                    budget = maxTokens;
                }
                continue;
            }
            if (!slices[e.type]) slices[e.type] = [];
            slices[e.type].push(e.name ? ('[' + e.name + '] ' + e.text) : e.text);
            used.push({ id: e.id, type: e.type, name: e.name, tokens: cost, clipped: false });
            budget += cost;
        }
        return { slices: slices, totalTokens: budget, usedEntries: used, availableBudget: maxTokens - budget };
    }

    /* Render query result into a flat system-prompt fragment (bounded) */
    function asPromptFragment(opts) {
        var r = query(opts);
        var parts = [];
        var headings = {
            'treatment':       'TREATMENT',
            'script':          'SCRIPT',
            'budget-snapshot': 'BUDGET SNAPSHOT',
            'template-fill':   'RECENT DOCUMENT FILLS',
            'attachment':      'ATTACHMENTS',
            'receipt':         'RECEIPTS / LEDGER ENTRIES'
        };
        var order = ['treatment', 'script', 'budget-snapshot', 'template-fill', 'attachment', 'receipt'];
        for (var i = 0; i < order.length; i++) {
            var t = order[i];
            if (r.slices[t] && r.slices[t].length) {
                parts.push('--- ' + (headings[t] || t.toUpperCase()) + ' ---');
                parts.push(r.slices[t].join('\n\n'));
                parts.push('');
            }
        }
        return { text: parts.join('\n'), usedEntries: r.usedEntries, totalTokens: r.totalTokens };
    }

    function subscribe(fn) {
        if (typeof fn !== 'function') return function () {};
        _listeners.push(fn);
        return function () {
            var idx = _listeners.indexOf(fn);
            if (idx > -1) _listeners.splice(idx, 1);
        };
    }

    /* --- Bulk ingest helpers ----------------------------------------- */

    /* Ingest the active budget: receipts + snapshot of grand totals.
       Receipts use deterministic ids so repeated syncs upsert instead of duplicating. */
    function ingestBudget(budget) {
        if (!budget) return Promise.resolve(0);
        var items = [];

        /* Budget snapshot (short) */
        var snap = {
            projectName:   budget.projectName || '',
            currency:      budget.currency || 'JMD',
            grandTotal:    budget.grandTotal || 0,
            company:       budget.projectCompany || budget.company || '',
            location:      budget.projectLocation || '',
            shootDays:     (budget.targetLock && budget.targetLock.stages) || 0,
            startDate:     budget.startDate || '',
            sections:      budget.sections ? Object.keys(budget.sections).length : 0
        };
        items.push({
            type: 'budget-snapshot',
            id:   'snap_' + (budget.projectName || 'active'),
            name: 'Budget Snapshot',
            text: JSON.stringify(snap, null, 2),
            meta: { source: 'budget' }
        });

        /* Receipts: POs */
        var pos = (budget.ledgers && budget.ledgers.pos) || [];
        for (var i = 0; i < pos.length; i++) {
            var po = pos[i] || {};
            if (!po.id && !po.poNumber) continue;
            var poText = 'PO #' + (po.poNumber || po.id) + ' | vendor: ' + (po.vendor || '—') +
                         ' | amount: ' + (po.amount || 0) + ' ' + (budget.currency || 'JMD') +
                         ' | date: ' + (po.date || po.createdAt || '') +
                         ' | status: ' + (po.status || 'pending') +
                         ' | desc: ' + (po.description || '');
            items.push({
                type: 'receipt',
                id:   'po_' + (po.id || po.poNumber),
                name: 'PO #' + (po.poNumber || po.id),
                text: poText,
                meta: { kind: 'purchase-order', amount: po.amount, vendor: po.vendor, date: po.date }
            });
        }

        /* Receipts: Petty Cash */
        var pc = (budget.ledgers && budget.ledgers.pettyCash) || [];
        for (var j = 0; j < pc.length; j++) {
            var e = pc[j] || {};
            if (!e.id) continue;
            var pcText = 'PettyCash | ' + (e.date || '') + ' | ' + (e.description || '—') +
                         ' | ' + (e.amount || 0) + ' ' + (budget.currency || 'JMD') +
                         ' | payee: ' + (e.payee || '');
            items.push({
                type: 'receipt',
                id:   'pc_' + e.id,
                name: 'PettyCash ' + (e.date || e.id),
                text: pcText,
                meta: { kind: 'petty-cash', amount: e.amount, payee: e.payee, date: e.date }
            });
        }
        return addBatch(items).then(function (added) { return added.length; });
    }

    /* Ingest Treatment + Script + Attachments from localStorage keys used by the Assistant iframe */
    function ingestSidebar() {
        var items = [];
        try {
            var tr = localStorage.getItem('mbt_ai_treatment') || '';
            if (tr.trim()) items.push({ type: 'treatment', id: 'treatment_active', name: 'Treatment', text: tr });
            var sc = localStorage.getItem('mbt_ai_script') || '';
            if (sc.trim()) items.push({ type: 'script', id: 'script_active', name: 'Script', text: sc });
            var att = JSON.parse(localStorage.getItem('mbt_ai_attachments') || '{}');
            if (att.treatment && att.treatment.text) items.push({ type: 'attachment', id: 'att_treatment', name: att.treatment.name || 'treatment file', text: att.treatment.text, meta: { field: 'treatment' } });
            if (att.script && att.script.text) items.push({ type: 'attachment', id: 'att_script', name: att.script.name || 'script file', text: att.script.text, meta: { field: 'script' } });
        } catch (e) { /* storage unavailable */ }
        return addBatch(items).then(function (added) { return added.length; });
    }

    /* --- Broadcast changes to all tool iframes (Assistant listens for 'ledger-sync') --- */
    subscribe(function () {
        try {
            var sum = summary();
            var iframes = document.getElementsByTagName('iframe');
            for (var i = 0; i < iframes.length; i++) {
                try { iframes[i].contentWindow.postMessage({ type: 'ledger-sync', payload: sum }, '*'); } catch (e) {}
            }
        } catch (e) { /* no DOM yet */ }
    });

    /* --- Expose -------------------------------------------------------- */
    window.mBTContextLedger = {
        setActiveProject:   setActiveProject,
        add:                add,
        addBatch:           addBatch,
        remove:             remove,
        removeByType:       removeByType,
        purge:              purge,
        clearAll:           clearAll,
        summary:            summary,
        totalTokens:        totalTokens,
        query:              query,
        asPromptFragment:   asPromptFragment,
        subscribe:          subscribe,
        ingestBudget:       ingestBudget,
        ingestSidebar:      ingestSidebar,
        _cache:             function () { return _cache; } /* debugging */
    };
})();
