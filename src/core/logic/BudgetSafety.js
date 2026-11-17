/* Local safety boundaries. ES5. No network or storage side effects. */
(function (window) {
    'use strict';
    var own = function (o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); };
    var derived = { total: 1, ratio: 1, subtotal: 1, grandTotal: 1, actualTotal: 1,
        fringesTotal: 1, productionFeeAmount: 1, incentiveRebate: 1, incentiveQualifyingTotal: 1, ETC: 1,
        updated_at: 1, updatedAt: 1, activityLog: 1 };
    function safe(k) { return k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }
    function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
    function esc(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function identity(b) {
        if (!b || !b.projectName) return null;
        return JSON.stringify([String(b.id || b.collab_project_id || ''), String(b.projectName)]);
    }
    function readError(key, backend, cause) {
        var err = new Error('Could not read "' + key + '" from ' + backend + '. Stored data was left untouched. Retry or recover a backup.');
        err.name = 'StorageReadError'; err.key = key; err.backend = backend; err.cause = cause;
        return err;
    }
    function reportReadFailure(err) {
        console.warn('[mBT] Read failed. No deletion or replacement.', err);
        if (window.mBTME) window.mBTME.alert('Storage Read Failed', err && err.message ? err.message : 'Stored data could not be read. It was left untouched.');
    }
    function budgetLike(v) {
        return !!(v && typeof v === 'object' && (own(v, 'sections') || own(v, 'projectName') || own(v, 'id') || own(v, 'schema_version')));
    }
    function normalized(v) {
        if (Array.isArray(v)) return v.map(normalized);
        if (v && typeof v === 'object') {
            var out = {};
            Object.keys(v).sort().forEach(function (k) { if (safe(k) && !derived[k]) out[k] = normalized(v[k]); });
            return out;
        }
        return v;
    }
    function equal(a, b) { return JSON.stringify(normalized(a)) === JSON.stringify(normalized(b)); }
    function rows(a) {
        if (!Array.isArray(a)) return null;
        var map = Object.create(null), valid = true;
        a.forEach(function (r) {
            if (!r || r.id == null || r.id === '' || own(map, String(r.id))) valid = false;
            else map[String(r.id)] = r;
        });
        return valid ? map : null;
    }
    function capture(before, after, roots) {
        var record = { version: 1, budgetIdentity: identity(before), fields: [] };
        var seenRoots = Object.create(null);
        if (!record.budgetIdentity || record.budgetIdentity !== identity(after)) throw new Error('The budget changed during the operation.');
        function walk(a, b, path, hasA, hasB) {
            if (hasA === hasB && equal(a, b)) return;
            if (hasA && hasB && a && b && typeof a === 'object' && typeof b === 'object') {
                if (Array.isArray(a) && Array.isArray(b)) {
                    var am = rows(a), bm = rows(b);
                    if (am && bm) {
                        var ai = a.map(function (r) { return String(r.id); }), bi = b.map(function (r) { return String(r.id); });
                        if (ai.length === bi.length && ai.every(function (id) { return own(bm, id); }) && JSON.stringify(ai) !== JSON.stringify(bi)) {
                            record.fields.push({ path: path, kind: 'order', before: ai, after: bi, hasBefore: true, hasAfter: true });
                        }
                        Object.keys(am).concat(Object.keys(bm).filter(function (id) { return !own(am, id); })).forEach(function (id) {
                            var fieldsBefore = record.fields.length;
                            walk(am[id], bm[id], path.concat([{ id: id }]), own(am, id), own(bm, id));
                            /* A removed row remembers its place so Undo puts it back where it was. */
                            if (own(am, id) && !own(bm, id) && record.fields.length > fieldsBefore) record.fields[record.fields.length - 1].index = ai.indexOf(id);
                        });
                        return;
                    }
                } else if (!Array.isArray(a) && !Array.isArray(b)) {
                    Object.keys(a).concat(Object.keys(b).filter(function (k) { return !own(a, k); })).forEach(function (k) {
                        if (safe(k) && !derived[k]) walk(a[k], b[k], path.concat([k]), own(a, k), own(b, k));
                    });
                    return;
                }
            }
            record.fields.push({ path: path, before: clone(a), after: clone(b), hasBefore: hasA, hasAfter: hasB });
        }
        (roots || ['sections', 'contingencyPercentage', 'settings', 'targetLock']).forEach(function (k) {
            if (own(seenRoots, k)) return;
            seenRoots[k] = true;
            if (safe(k) && !derived[k] && k !== 'id' && k !== 'projectName') walk(before[k], after[k], [k], own(before, k), own(after, k));
        });
        return record;
    }
    function locate(budget, path) {
        var parent = budget, i, key;
        for (i = 0; i < path.length; i++) {
            key = path[i];
            if (typeof key === 'object') {
                if (!Array.isArray(parent)) return null;
                var found = -1, count = 0, j;
                for (j = 0; j < parent.length; j++) {
                    if (parent[j] && String(parent[j].id) === key.id) { found = j; count++; }
                }
                if (count > 1) return null;
                key = found;
            } else if (!safe(key)) return null;
            if (!parent || typeof parent !== 'object') return null;
            if (i === path.length - 1) return { parent: parent, key: key, exists: key !== -1 && own(parent, key) };
            if (key === -1 || !own(parent, key)) return null;
            parent = parent[key];
        }
        return null;
    }
    function restore(record, budget) {
        if (!record || record.version !== 1 || !record.budgetIdentity) return { ok: false, message: 'This undo record is not safe to restore. Apply the operation again to create a new undo.' };
        if (record.budgetIdentity !== identity(budget)) return { ok: false, message: 'Undo belongs to a different budget. Open the original budget before using Undo.' };
        var checks = [], conflict = false;
        record.fields.forEach(function (f) {
            var slot = locate(budget, f.path);
            var live = slot && slot.exists ? slot.parent[slot.key] : undefined;
            if (f.kind === 'order' && Array.isArray(live)) live = live.map(function (r) { return String(r.id); });
            if (!slot || slot.exists !== f.hasAfter || (slot.exists && !equal(live, f.after))) conflict = true;
            checks.push({ field: f, slot: slot });
        });
        if (conflict) return { ok: false, message: 'Undo was not applied. A field changed after this operation, or its item is missing. Your later edits were kept.' };
        /* Re-resolve each identity after a splice. Validate all fields before any write. */
        var reinsert = [];
        checks.reverse().forEach(function (entry) {
            var f = entry.field, slot = locate(budget, f.path);
            if (f.kind === 'order') {
                var map = rows(slot.parent[slot.key]);
                slot.parent[slot.key] = f.before.map(function (id) { return map[id]; });
            } else if (Array.isArray(slot.parent) && typeof f.path[f.path.length - 1] === 'object') {
                if (!f.hasBefore) slot.parent.splice(slot.key, 1);
                else if (!slot.exists) reinsert.push(f);
                else slot.parent[slot.key] = clone(f.before);
            } else if (f.hasBefore) slot.parent[slot.key] = clone(f.before);
            else delete slot.parent[slot.key];
        });
        /* Removed rows go back lowest position first, so each one lands at its
           original index with the rows before it already in place. */
        reinsert.sort(function (x, y) {
            var xi = typeof x.index === 'number' ? x.index : Infinity, yi = typeof y.index === 'number' ? y.index : Infinity;
            return xi === yi ? 0 : (xi < yi ? -1 : 1);
        });
        reinsert.forEach(function (f) {
            var slot = locate(budget, f.path);
            if (!slot || !Array.isArray(slot.parent)) return;
            if (typeof f.index === 'number' && f.index >= 0) slot.parent.splice(Math.min(f.index, slot.parent.length), 0, clone(f.before));
            else slot.parent.push(clone(f.before));
        });
        return { ok: true, count: record.fields.length };
    }
    window.mBTBudgetSafety = { esc: esc, identity: identity, clone: clone, capture: capture,
        restore: restore, readError: readError, reportReadFailure: reportReadFailure, budgetLike: budgetLike };
})(window);
