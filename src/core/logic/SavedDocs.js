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

    /* H2: keep newest by date (ties: first). H1: null-prototype lookup. Count removed duplicates. */
    function dedupeByIdNewest(list) {
        var out = hostList();
        var duplicates = 0;
        if (!Array.isArray(list)) return { list: out, duplicates: duplicates };
        var valid = hostList();
        var i, e;
        for (i = 0; i < list.length; i++) {
            e = list[i];
            if (validEntry(e)) valid.push(e);
        }
        var sorted = sortByDateDesc(valid);
        var seen = Object.create(null);
        for (i = 0; i < sorted.length; i++) {
            e = sorted[i];
            if (Object.prototype.hasOwnProperty.call(seen, e.id)) {
                duplicates++;
                continue;
            }
            seen[e.id] = 1;
            out.push(e);
        }
        return { list: out, duplicates: duplicates };
    }

    function changedIds(before, after) {
        var previous = Object.create(null);
        dedupeByIdNewest(before).list.forEach(function (entry) { previous[entry.id] = entry; });
        return dedupeByIdNewest(after).list.filter(function (entry) {
            var prior = previous[entry.id];
            return !prior || prior.title !== entry.title || prior.date !== entry.date ||
                prior.templateId !== entry.templateId || prior.templateName !== entry.templateName ||
                !sameContent(prior.editorData, entry.editorData);
        }).map(function (entry) { return entry.id; });
    }

    function mergeSave(stored, incoming) {
        var tombstones = Object.create(null);
        var deleted = [];
        [stored.savedDocsDeleted, incoming.savedDocsDeleted].forEach(function (list) {
            if (!Array.isArray(list)) return;
            list.forEach(function (id) {
                if (!nonEmptyString(id) || tombstones[id]) return;
                tombstones[id] = true;
                deleted.push(id);
            });
        });
        function eligible(list) {
            return dedupeByIdNewest(Array.isArray(list) ? list.filter(function (entry) {
                return validEntry(entry) && !tombstones[entry.id];
            }) : []);
        }
        var existing = eligible(stored.savedDocs);
        var received = eligible(incoming.savedDocs);
        var changed = null;
        if (Array.isArray(incoming.changedDocIds)) {
            changed = Object.create(null);
            incoming.changedDocIds.forEach(function (id) { if (nonEmptyString(id)) changed[id] = true; });
        }
        var byId = Object.create(null);
        existing.list.forEach(function (entry) { byId[entry.id] = entry; });
        var result = received.list.map(function (entry) {
            var prior = byId[entry.id];
            delete byId[entry.id];
            return prior && changed && !changed[entry.id] ? prior : entry;
        });
        existing.list.forEach(function (entry) { if (byId[entry.id]) result.push(entry); });
        var sorted = sortByDateDesc(result);
        var duplicates = existing.duplicates + received.duplicates;
        return {
            savedDocs: sorted.slice(0, CAP),
            savedDocsDeleted: deleted,
            dropped: Math.max(0, sorted.length - CAP) + duplicates,
            duplicates: duplicates
        };
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
        var deleted = Object.create(null);
        var i, id;
        if (Array.isArray(deletedIds)) {
            for (i = 0; i < deletedIds.length; i++) {
                id = deletedIds[i];
                if (typeof id === 'string' && id !== '') deleted[id] = 1;
            }
        }
        var budgetDeduped = dedupeByIdNewest(budgetList);
        var result = budgetDeduped.list;
        var duplicates = budgetDeduped.duplicates;
        var byId = Object.create(null);
        for (i = 0; i < result.length; i++) byId[result[i].id] = result[i];

        var legacyCopies = 0;
        var skippedDeleted = 0;
        var legacyDeduped = dedupeByIdNewest(Array.isArray(legacyList) ? legacyList : []);
        duplicates += legacyDeduped.duplicates;
        var legacy = legacyDeduped.list;

        for (i = 0; i < legacy.length; i++) {
            var e = legacy[i];
            if (!validEntry(e)) continue;

            if (Object.prototype.hasOwnProperty.call(deleted, e.id)) {
                skippedDeleted++;
                continue;
            }

            var existing = Object.prototype.hasOwnProperty.call(byId, e.id) ? byId[e.id] : null;
            if (existing) {
                if (sameContent(existing, e)) continue;
                var legId = e.id + '_legacy';
                /* A prior migrate already kept the browser copy: never add a third. */
                if (Object.prototype.hasOwnProperty.call(byId, legId)) continue;
                /* L2: a deleted legacy copy must not come back. */
                if (Object.prototype.hasOwnProperty.call(deleted, legId)) {
                    skippedDeleted++;
                    continue;
                }
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
        var dropped = duplicates;
        if (sorted.length > CAP) {
            dropped += sorted.length - CAP;
            sorted = sorted.slice(0, CAP);
        }
        return {
            list: sorted,
            legacyCopies: legacyCopies,
            skippedDeleted: skippedDeleted,
            dropped: dropped,
            duplicates: duplicates
        };
    }

    function storeEntry(entry) {
        var copy = hostData(entry);
        if (copy.templateId === 'fundingPackage' && copy.editorData && typeof copy.editorData === 'object') {
            delete copy.editorData.sources;
        }
        return copy;
    }

    function add(budget, entry, includeCandidates) {
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
        /* N10: keep the newest CAP by date regardless of stored array order. */
        var sorted = sortByDateDesc(next);
        var dropped = 0;
        if (sorted.length > CAP) {
            dropped = sorted.length - CAP;
            sorted = sorted.slice(0, CAP);
        }
        budget.savedDocs = sorted;
        var result = { dropped: dropped };
        if (includeCandidates && dropped) result.candidates = next;
        return hostData(result);
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
            return hostData({ changed: false, added: 0, conflicts: 0, dropped: 0, duplicates: 0 });
        }
        var before = Array.isArray(budget.savedDocs) ? hostData(budget.savedDocs) : hostList();
        var beforeIds = Object.create(null);
        var i;
        for (i = 0; i < before.length; i++) {
            if (validEntry(before[i])) beforeIds[before[i].id] = 1;
        }
        var deleted = Array.isArray(budget.savedDocsDeleted) ? budget.savedDocsDeleted : [];
        var r = merge(before, legacyList, deleted);
        var added = 0;
        var conflicts = 0;
        for (i = 0; i < r.list.length; i++) {
            if (!Object.prototype.hasOwnProperty.call(beforeIds, r.list[i].id)) {
                added++;
                if (r.list[i].id.length > 7 && r.list[i].id.slice(-7) === '_legacy') conflicts++;
            }
        }
        var beforeJson = JSON.stringify(before);
        var afterJson = JSON.stringify(r.list);
        if (beforeJson === afterJson) {
            /* N11: still report drops when a legacy entry was considered but did not change the capped list. */
            return hostData({
                changed: false,
                added: 0,
                conflicts: 0,
                dropped: r.dropped,
                duplicates: r.duplicates || 0
            });
        }
        budget.savedDocs = r.list;
        return hostData({
            changed: true,
            added: added,
            conflicts: conflicts,
            dropped: r.dropped,
            duplicates: r.duplicates || 0
        });
    }

    window.mBTSavedDocs = {
        CAP: CAP,
        list: list,
        merge: merge,
        changedIds: changedIds,
        mergeSave: mergeSave,
        add: add,
        remove: remove,
        rename: rename,
        migrate: migrate
    };
}(typeof window !== 'undefined' ? window : this));
