/* G1: opt-in transaction service. Merely loading this file does not open/write a DB. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./record-helpers'));
    else root.mBTRecords = factory(root.mBTRecordHelpers);
}(this, function (H) {
    'use strict';
    /* Adapter contract: transaction(work) resolves only after commit, rejects on abort.
       tx.get(store,key,callback), tx.all(store,callback), tx.put(store,key,value),
       tx.finish(result), tx.abort(reason). All stores use out-of-line keys.
       No schema is created here. Future builders supply a reviewed DB/store mapping. */
    function indexedDBAdapter(db, names) {
        var logical = ['records', 'operations', 'drafts', 'audit', 'backups', 'staging'];
        names = names || { records: 'records', operations: 'operations', drafts: 'drafts', audit: 'audit', backups: 'backups', staging: 'staging' };
        return { transaction: function (work) {
            return new Promise(function (resolve, reject) {
                var tx, result, completed = false, error = null;
                function abort(e) { error = e; try { tx.abort(); } catch (ignore) {} }
                try { tx = db.transaction(logical.map(function (k) { return names[k]; }), 'readwrite'); }
                catch (e) { reject(e); return; }
                tx.oncomplete = function () { if (!completed) { completed = true; resolve(result); } };
                tx.onabort = function () { if (!completed) { completed = true; reject(error || tx.error || new Error('ABORTED')); } };
                tx.onerror = function () { error = error || tx.error; };
                function request(req, callback) {
                    req.onsuccess = function () { try { callback(req.result); } catch (e) { abort(e); } };
                    req.onerror = function () { error = error || req.error; };
                }
                try {
                    work({
                        get: function (store, key, callback) { request(tx.objectStore(names[store]).get(key), callback); },
                        all: function (store, callback) {
                            var rows = [], req = tx.objectStore(names[store]).openCursor();
                            req.onsuccess = function () { try { var cursor = req.result; if (cursor) { rows.push(cursor.value); cursor.continue(); } else callback(rows); } catch (e) { abort(e); } };
                            req.onerror = function () { error = error || req.error; };
                        },
                        put: function (store, key, value) { var req = tx.objectStore(names[store]).put(H.clone(value), key); req.onerror = function () { error = error || req.error; }; },
                        finish: function (value) { result = H.clone(value); },
                        abort: abort
                    });
                } catch (e) { abort(e); }
            });
        } };
    }
    function create(adapter) {
        if (!adapter || typeof adapter.transaction !== 'function') throw new Error('ADAPTER_REQUIRED');
        var pending = {};
        function key(command) { return H.canonical([command.budgetId, command.operationId]); }
        function commit(command, validate) {
            var draft, opKey, fingerprint;
            try {
                draft = H.retainDraft(command, 'PENDING', null); opKey = key(command); fingerprint = H.canonical(command);
                if (typeof command.operationId !== 'string' || !command.operationId || !Array.isArray(command.changes) || !command.changes.length || command.changes.length > 64) throw new Error('COMMAND');
            } catch (e) { return Promise.resolve({ ok: false, code: e.code || e.message }); }
            pending[opKey] = draft;
            return adapter.transaction(function (tx) {
                function refused(code, current) {
                    draft = H.retainDraft(command, code, current); pending[opKey] = draft;
                    tx.put('drafts', opKey, draft); tx.finish({ ok: false, code: code, draft: draft });
                }
                tx.get('operations', opKey, function (previous) {
                    var candidates = [], seen = {};
                    if (previous) {
                        if (previous.fingerprint !== fingerprint) { refused('OPERATION_REUSED', null); return; }
                        tx.finish({ ok: true, replay: true, records: previous.records }); return;
                    }
                    function write() {
                        var answer = { ok: true, replay: false, records: candidates.map(function (c) { return c.next; }) };
                        candidates.forEach(function (c) { tx.put('records', c.next.id, c.next); });
                        tx.put('operations', opKey, { fingerprint: fingerprint, records: answer.records });
                        tx.put('audit', opKey, { operationId: command.operationId, budgetId: command.budgetId, changes: command.changes, records: answer.records });
                        tx.finish(answer);
                    }
                    function validated() {
                        if (!validate) { write(); return; }
                        var done = false;
                        /* Domain validator MUST complete using this transaction's requests,
                           not await network/timer/Promise work (IDB may auto-close). */
                        validate(candidates, tx, function (error) {
                            if (done) { tx.abort(new Error('VALIDATOR_TWICE')); return; }
                            done = true;
                            if (error) refused(error.code || error.message || String(error), null);
                            else write();
                        });
                    }
                    function next(index) {
                        var change;
                        if (index === command.changes.length) { validated(); return; }
                        change = command.changes[index];
                        if (Object.prototype.hasOwnProperty.call(seen, change.recordId)) { refused('DUPLICATE_RECORD', null); return; }
                        seen[change.recordId] = true;
                        tx.get('records', change.recordId, function (current) {
                            var prepared;
                            try { prepared = H.prepareCAS(current, change, command.budgetId); }
                            catch (e) { refused(e.code || e.message, current); return; }
                            candidates.push({ current: current || null, next: prepared }); next(index + 1);
                        });
                    }
                    next(0);
                });
            }).then(function (result) {
                if (!result) throw new Error('VALIDATION_INCOMPLETE');
                if (result.ok) delete pending[opKey];
                return result;
            }).catch(function (error) {
                draft = H.retainDraft(command, error.code || error.message || 'ABORTED', null);
                pending[opKey] = draft;
                return { ok: false, code: draft.code, draft: H.clone(draft) };
            });
        }
        function save(command, validate) {
            return commit({ budgetId: command.budgetId, operationId: command.operationId,
                changes: [{ recordId: command.recordId, kind: command.kind, expectedVersion: command.expectedVersion,
                    patch: command.patch, sources: command.sources, acceptSource: command.acceptSource === true }] }, validate);
        }
        function preserveBackup(value) {
            try { H.verifyBackup(value); } catch (e) { return Promise.resolve({ ok: false, code: e.code || e.message }); }
            return adapter.transaction(function (tx) {
                tx.get('backups', value.id, function (previous) {
                    if (previous && H.canonical(previous) !== H.canonical(value)) { tx.finish({ ok: false, code: 'BACKUP_EXISTS' }); return; }
                    tx.put('backups', value.id, value); tx.finish({ ok: true, backup: value });
                });
            }).catch(function (e) { return { ok: false, code: e.code || e.message }; });
        }
        function stage(id, backup) {
            var value;
            try { value = H.staging(id, backup); } catch (e) { return Promise.resolve({ ok: false, code: e.code || e.message }); }
            return adapter.transaction(function (tx) {
                tx.get('backups', backup.id, function (saved) {
                    if (!saved || H.canonical(saved) !== H.canonical(backup)) { tx.finish({ ok: false, code: 'BACKUP_REQUIRED' }); return; }
                    tx.get('staging', id, function (previous) {
                        if (previous && H.canonical(previous) !== H.canonical(value)) { tx.finish({ ok: false, code: 'STAGING_EXISTS' }); return; }
                        tx.put('staging', id, value); tx.finish({ ok: true, stage: value });
                    });
                });
            }).catch(function (e) { return { ok: false, code: e.code || e.message }; });
        }
        return { save: save, commit: commit, preserveBackup: preserveBackup, stage: stage,
            draft: function (budgetId, operationId) { var d = pending[H.canonical([budgetId, operationId])]; return d ? H.clone(d) : null; } };
    }
    return { create: create, indexedDBAdapter: indexedDBAdapter };
}));
