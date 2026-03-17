/* ========= v1.0 Supabase Sync Service — bidirectional IndexedDB/Supabase sync v2.0 ========= */
(function () {
    'use strict';

    /* --- 1. SUPABASE REST API PRIMITIVES --- */

    function getHeaders() {
        var key = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.ANON_KEY : '';
        return {
            'apikey': key,
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    function getBaseUrl(table) {
        var url = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.API_URL : '';
        return url + '/rest/v1/' + table;
    }

    /* --- Fetch all rows from a Supabase table --- */
    async function sbFetchAll(table) {
        var res = await fetch(getBaseUrl(table) + '?select=*', {
            method: 'GET',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Supabase fetch failed for ' + table + ': ' + res.statusText);
        return res.json();
    }

    /* --- Upsert a record (insert or update by id) --- */
    async function sbUpsert(table, record) {
        var res = await fetch(getBaseUrl(table), {
            method: 'POST',
            headers: Object.assign({}, getHeaders(), { 'Prefer': 'resolution=merge-duplicates,return=representation' }),
            body: JSON.stringify(record)
        });
        if (!res.ok) throw new Error('Supabase upsert failed for ' + table + ': ' + res.statusText);
        return res.json();
    }

    /* --- Delete a record by id --- */
    async function sbDelete(table, id) {
        var res = await fetch(getBaseUrl(table) + '?id=eq.' + encodeURIComponent(id), {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Supabase delete failed for ' + table + ': ' + res.statusText);
    }

    /* --- 2. STORE-TO-TABLE MAPPING --- */

    /* --- Returns all records from a given IndexedDB store using specific storage methods --- */
    async function getLocalRecords(storeName) {
        var s = window.mBTStorage || window.mBT.storage;
        switch (storeName) {
            case 'mbt_projects':   return s.getAllProjects();
            case 'mbt_stages':     return s.getAllStages();
            case 'mbt_executions': {
                var projects = await s.getAllProjects();
                var all = [];
                for (var i = 0; i < projects.length; i++) {
                    var execs = await s.getExecutionsByProject(projects[i].id);
                    all = all.concat(execs);
                }
                return all;
            }
            case 'og_ref':         return s.getAllOGItems();
            case 'contacts': {
                var db = await s.getDb();
                return new Promise(function (resolve, reject) {
                    var store = db.transaction('contacts', 'readonly').objectStore('contacts');
                    var req = store.getAll();
                    req.onsuccess = function () { resolve(req.result || []); };
                    req.onerror = function () { reject(req.error); };
                });
            }
            case 'sessions': {
                var db2 = await s.getDb();
                return new Promise(function (resolve, reject) {
                    var store2 = db2.transaction('sessions', 'readonly').objectStore('sessions');
                    var req2 = store2.getAll();
                    req2.onsuccess = function () { resolve(req2.result || []); };
                    req2.onerror = function () { reject(req2.error); };
                });
            }
            default: return [];
        }
    }

    /* --- Write a pulled Supabase record into IndexedDB (additive — skips existing ids) --- */
    async function writeLocalRecord(storeName, record) {
        var s = window.mBTStorage || window.mBT.storage;
        switch (storeName) {
            case 'mbt_projects':
                return s.updateProject(record);
            case 'mbt_stages':
                return s.updateStage(record);
            case 'mbt_executions':
                return s.updateExecution(record);
            case 'og_ref':
                return s.updateOGItem(record);
            case 'contacts':
            case 'sessions': {
                var tableName = storeName;
                var db = await s.getDb();
                return new Promise(function (resolve, reject) {
                    var store = db.transaction([tableName], 'readwrite').objectStore(tableName);
                    var req = store.put(record);
                    req.onsuccess = function () { resolve(); };
                    req.onerror = function () { reject(req.error); };
                });
            }
        }
    }

    /* --- 3. SYNC OPERATIONS --- */

    /* --- Push all local IndexedDB data to Supabase --- */
    async function syncPushAll() {
        if (!window.mBTSupabaseConfig || !window.mBTSupabaseConfig.isConfigured()) {
            return { synced: 0, errors: 0, reason: 'not_configured' };
        }

        var schema = window.mBTSupabaseSchema || {};
        var storeNames = Object.keys(schema);
        var totalSynced = 0;
        var totalErrors = 0;

        for (var i = 0; i < storeNames.length; i++) {
            var storeName = storeNames[i];
            var tableName = schema[storeName];
            try {
                var records = await getLocalRecords(storeName);
                for (var j = 0; j < records.length; j++) {
                    try {
                        await sbUpsert(tableName, records[j]);
                        totalSynced++;
                    } catch (e) {
                        console.error('[mBTSync] Upsert error ' + tableName + ':', e);
                        totalErrors++;
                    }
                }
            } catch (e) {
                console.error('[mBTSync] getLocalRecords error ' + storeName + ':', e);
                totalErrors++;
            }
        }

        await (window.mBTStorage || window.mBT.storage).setItem(
            window.mBTSupabaseConfig.SYNC.LAST_SYNC_KEY,
            Date.now()
        );

        return { synced: totalSynced, errors: totalErrors };
    }

    /* --- Pull Supabase data into IndexedDB (additive — does not overwrite newer local records) --- */
    async function syncPullAll() {
        if (!window.mBTSupabaseConfig || !window.mBTSupabaseConfig.isConfigured()) {
            return { pulled: 0, errors: 0, reason: 'not_configured' };
        }

        var schema = window.mBTSupabaseSchema || {};
        var storeNames = Object.keys(schema);
        var totalPulled = 0;
        var totalErrors = 0;

        for (var i = 0; i < storeNames.length; i++) {
            var storeName = storeNames[i];
            var tableName = schema[storeName];
            try {
                var remoteRecords = await sbFetchAll(tableName);
                var localRecords = await getLocalRecords(storeName);
                var localIds = new Set(localRecords.map(function (r) { return r.id; }));

                for (var j = 0; j < remoteRecords.length; j++) {
                    if (!localIds.has(remoteRecords[j].id)) {
                        try {
                            await writeLocalRecord(storeName, remoteRecords[j]);
                            totalPulled++;
                        } catch (e) {
                            console.error('[mBTSync] writeLocalRecord error ' + storeName + ':', e);
                            totalErrors++;
                        }
                    }
                }
            } catch (e) {
                console.error('[mBTSync] Pull error ' + tableName + ':', e);
                totalErrors++;
            }
        }

        await (window.mBTStorage || window.mBT.storage).setItem(
            window.mBTSupabaseConfig.SYNC.LAST_SYNC_KEY,
            Date.now()
        );

        return { pulled: totalPulled, errors: totalErrors };
    }

    /* --- 4. EXPORT / IMPORT --- */

    async function exportAllData() {
        var storeNames = ['mbt_projects', 'mbt_stages', 'mbt_executions', 'og_ref', 'contacts', 'sessions'];
        var exportObj = {};
        for (var i = 0; i < storeNames.length; i++) {
            exportObj[storeNames[i]] = await getLocalRecords(storeNames[i]);
        }
        exportObj.metadata = { exported_at: new Date().toISOString(), version: '2.0' };
        return JSON.stringify(exportObj, null, 2);
    }

    /* --- 5. GLOBAL EXPOSURE --- */

    window.mBTSync = {
        pushAll:       syncPushAll,
        pullAll:       syncPullAll,
        exportData:    exportAllData,
        sbFetchAll:    sbFetchAll,
        sbUpsert:      sbUpsert,
        sbDelete:      sbDelete
    };

    console.log('[mBT] Supabase sync service initialized ✓');
})();
