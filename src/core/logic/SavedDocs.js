/* Saved documents on the budget (budget.savedDocs). ES5. No network or storage side effects. */
(function (window) {
    'use strict';

    var CAP = 50;

    /* vm contexts give array/object literals a different realm than the test harness.
       JSON.parse builds host-realm values so node:assert/strict deepEqual can pass. */
    function hostList() {
        return JSON.parse('[]');
    }

    function hostData(v) {
        return JSON.parse(JSON.stringify(v));
    }

    function isPlain(o) {
        return o != null && typeof o === 'object' && !Array.isArray(o);
    }

    function nonEmptyString(v) {
        return typeof v === 'string' && v !== '';
    }

    function validEntry(e) {
        return isPlain(e) && nonEmptyString(e.id) && nonEmptyString(e.templateId);
    }

    function canonJson(v) {
        if (v === null || typeof v !== 'object') return JSON.stringify(v);
        if (Array.isArray(v)) {
            var parts = [];
            var i;
            for (i = 0; i < v.length; i++) parts.push(canonJson(v[i]));
            return '[' + parts.join(',') + ']';
        }
        var keys = Object.keys(v).sort();
        var out = [];
        var k;
        for (k = 0; k < keys.length; k++) {
            out.push(JSON.stringify(keys[k]) + ':' + canonJson(v[keys[k]]));
        }
        return '{' + out.join(',') + '}';
    }

    function sameContent(a, b) {
        return canonJson(a) === canonJson(b);
    }

    function dateKey(e) {
        return (e && typeof e.date === 'string' && e.date !== '') ? e.date : null;
    }

    function sortByDateDesc(arr) {
        var indexed = [];
        var i;
        for (i = 0; i < arr.length; i++) indexed.push({ e: arr[i], i: i });
        indexed.sort(function (a, b) {
            var da = dateKey(a.e);
            var db = dateKey(b.e);
            if (da && db) {
                if (da > db) return -1;
                if (da < db) return 1;
                return a.i - b.i;
            }
            if (da && !db) return -1;
            if (!da && db) return 1;
            return a.i - b.i;
        });
        var out = hostList();
        for (i = 0; i < indexed.length; i++) out.push(indexed[i].e);
        return out;
    }

    function firstValidById(list) {
        var out = hostList();
        var seen = {};
        var i, e;
        if (!Array.isArray(list)) return out;
        for (i = 0; i < list.length; i++) {
            e = list[i];
            if (!validEntry(e)) continue;
            if (seen[e.id]) continue;
            seen[e.id] = 1;
            out.push(e);
        }
        return out;
    }

    function list(budget) {
        if (!isPlain(budget) || !Array.isArray(budget.savedDocs)) return hostList();
        var kept = hostList();
        var i, e;
        for (i = 0; i < budget.savedDocs.length; i++) {
            e = budget.savedDocs[i];
            if (validEntry(e)) kept.push(e);
        }
        return sortByDateDesc(kept);
    }

    function merge(budgetList, legacyList, deletedIds) {
        var deleted = {};
        var i, id;
        if (Array.isArray(deletedIds)) {
            for (i = 0; i < deletedIds.length; i++) {
                id = deletedIds[i];
                if (typeof id === 'string' && id !== '') deleted[id] = 1;
            }
        }
        var result = firstValidById(budgetList);
        var byId = {};
        for (i = 0; i < result.length; i++) byId[result[i].id] = result[i];

        var legacyCopies = 0;
        var skippedDeleted = 0;
        var legacy = Array.isArray(legacyList) ? legacyList : [];
        var seenLegacy = {};

        for (i = 0; i < legacy.length; i++) {
            var e = legacy[i];
            if (!validEntry(e)) continue;
            if (seenLegacy[e.id]) continue;
            seenLegacy[e.id] = 1;

            if (deleted[e.id]) {
                skippedDeleted++;
                continue;
            }

            var existing = byId[e.id];
            if (existing) {
                if (sameContent(existing, e)) continue;
                var legId = e.id + '_legacy';
                /* A prior migrate already kept the browser copy: never add a third. */
                if (byId[legId]) continue;
                var copy = hostData(e);
                copy.id = legId;
                copy.title = (typeof e.title === 'string' ? e.title : '') + ' (from this browser)';
                result.push(copy);
                byId[legId] = copy;
                legacyCopies++;
                continue;
            }

            var added = hostData(e);
            result.push(added);
            byId[e.id] = added;
        }

        var sorted = sortByDateDesc(result);
        var dropped = 0;
        if (sorted.length > CAP) {
            dropped = sorted.length - CAP;
            sorted = sorted.slice(0, CAP);
        }
        return {
            list: sorted,
            legacyCopies: legacyCopies,
            skippedDeleted: skippedDeleted,
            dropped: dropped
        };
    }

    function storeEntry(entry) {
        var copy = hostData(entry);
        if (copy.templateId === 'fundingPackage' && copy.editorData && typeof copy.editorData === 'object') {
            delete copy.editorData.sources;
        }
        return copy;
    }

    function add(budget, entry) {
        if (!isPlain(budget)) return hostData({ dropped: 0, rejected: true });
        if (!validEntry(entry)) return hostData({ dropped: 0, rejected: true });
        if (!Array.isArray(budget.savedDocs)) budget.savedDocs = hostList();
        var stored = storeEntry(entry);
        var next = hostList();
        next.push(stored);
        var i, e;
        for (i = 0; i < budget.savedDocs.length; i++) {
            e = budget.savedDocs[i];
            if (e && e.id === stored.id) continue;
            next.push(e);
        }
        var dropped = 0;
        if (next.length > CAP) {
            dropped = next.length - CAP;
            next.length = CAP;
        }
        budget.savedDocs = next;
        return hostData({ dropped: dropped });
    }

    function remove(budget, id) {
        if (!isPlain(budget) || typeof id !== 'string' || id === '') return false;
        if (!Array.isArray(budget.savedDocs)) return false;
        var next = hostList();
        var found = false;
        var i, e;
        for (i = 0; i < budget.savedDocs.length; i++) {
            e = budget.savedDocs[i];
            if (e && e.id === id) {
                found = true;
                continue;
            }
            next.push(e);
        }
        if (!found) return false;
        budget.savedDocs = next;
        if (!Array.isArray(budget.savedDocsDeleted)) budget.savedDocsDeleted = hostList();
        var already = false;
        for (i = 0; i < budget.savedDocsDeleted.length; i++) {
            if (budget.savedDocsDeleted[i] === id) { already = true; break; }
        }
        if (!already) budget.savedDocsDeleted.push(id);
        return true;
    }

    function rename(budget, id, title) {
        if (!isPlain(budget) || typeof id !== 'string' || id === '') return false;
        if (typeof title !== 'string' || title.trim() === '') return false;
        if (!Array.isArray(budget.savedDocs)) return false;
        var i, e;
        for (i = 0; i < budget.savedDocs.length; i++) {
            e = budget.savedDocs[i];
            if (e && e.id === id) {
                e.title = title;
                return true;
            }
        }
        return false;
    }

    function migrate(budget, legacyList) {
        if (!isPlain(budget)) {
            return hostData({ changed: false, added: 0, conflicts: 0, dropped: 0 });
        }
        var before = Array.isArray(budget.savedDocs) ? hostData(budget.savedDocs) : hostList();
        var beforeIds = {};
        var i;
        for (i = 0; i < before.length; i++) {
            if (validEntry(before[i])) beforeIds[before[i].id] = 1;
        }
        var deleted = Array.isArray(budget.savedDocsDeleted) ? budget.savedDocsDeleted : [];
        var r = merge(before, legacyList, deleted);
        var added = 0;
        var conflicts = 0;
        for (i = 0; i < r.list.length; i++) {
            if (!beforeIds[r.list[i].id]) {
                added++;
                if (r.list[i].id.length > 7 && r.list[i].id.slice(-7) === '_legacy') conflicts++;
            }
        }
        var beforeJson = JSON.stringify(before);
        var afterJson = JSON.stringify(r.list);
        if (beforeJson === afterJson) {
            return hostData({ changed: false, added: 0, conflicts: 0, dropped: 0 });
        }
        budget.savedDocs = r.list;
        return hostData({
            changed: true,
            added: added,
            conflicts: conflicts,
            dropped: r.dropped
        });
    }

    window.mBTSavedDocs = {
        CAP: CAP,
        list: list,
        merge: merge,
        add: add,
        remove: remove,
        rename: rename,
        migrate: migrate
    };
}(typeof window !== 'undefined' ? window : this));
