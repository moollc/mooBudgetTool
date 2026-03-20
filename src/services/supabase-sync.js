/* ========= v1.0 Supabase Sync Service — bidirectional IndexedDB/Supabase sync v2.0 ========= */
(function () {
    'use strict';

    /* --- 1. SUPABASE REST API PRIMITIVES --- */

    function getHeaders() {
        var anonKey = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.ANON_KEY : '';
        var jwt     = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.AUTH_TOKEN : '';
        /* Use the user JWT when signed in so RLS user_id scoping works correctly. */
        var bearer  = jwt || anonKey;
        return {
            'apikey':         anonKey,
            'Authorization':  'Bearer ' + bearer,
            'Content-Type':   'application/json',
            'Prefer':         'return=representation'
        };
    }

    function getAuthHeaders() {
        var key = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.ANON_KEY : '';
        var jwt = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.AUTH_TOKEN : '';
        return {
            'apikey':         key,
            'Authorization':  jwt ? 'Bearer ' + jwt : 'Bearer ' + key,
            'Content-Type':   'application/json'
        };
    }

    function getAuthUrl(path) {
        var base = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.API_URL : '';
        return base + '/auth/v1' + path;
    }

    /* --- Sign in with email + password. Stores JWT in localStorage on success. --- */
    async function signIn(email, password) {
        var res = await fetch(getAuthUrl('/token?grant_type=password'), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ email: email, password: password })
        });
        var data = await res.json();
        if (!res.ok) {
            console.warn('[mBTSync] Auth error:', data.error_description || data.message);
            throw new Error('Sign-in failed. Check your email and password.');
        }
        localStorage.setItem('mbt_supabase_auth_token', data.access_token);
        localStorage.setItem('mbt_supabase_refresh_token', data.refresh_token || '');
        localStorage.setItem('mbt_supabase_user_email', data.user ? data.user.email : email);
        localStorage.setItem('mbt_supabase_user_id', data.user ? data.user.id : '');
        return data;
    }

    /* --- Sign in with Google — opens the OAuth provider page in a new tab. --- */
    function signInWithGoogle() {
        var base = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.API_URL : '';
        if (!base && typeof window.mBTOGAPI !== 'undefined' && window.mBTOGAPI.cloud) {
            base = window.mBTOGAPI.cloud.url;
        }
        if (!base) { throw new Error('Supabase URL not configured'); }
        var redirectTo = encodeURIComponent(window.location.origin + window.location.pathname + window.location.search);
        var url = base + '/auth/v1/authorize?provider=google&redirect_to=' + redirectTo;
        window.location.href = url;
    }

    /* --- Sign out: revoke token on server and clear localStorage. --- */
    async function signOut() {
        var jwt = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.AUTH_TOKEN : '';
        if (jwt) {
            try {
                await fetch(getAuthUrl('/logout'), {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
            } catch (e) { /* silent — clear locally regardless */ }
        }
        localStorage.removeItem('mbt_supabase_auth_token');
        localStorage.removeItem('mbt_supabase_refresh_token');
        localStorage.removeItem('mbt_supabase_user_email');
        localStorage.removeItem('mbt_supabase_user_id');
    }

    /* --- Get current session state from localStorage (no network call). --- */
    function getSession() {
        var token = localStorage.getItem('mbt_supabase_auth_token') || '';
        var email = localStorage.getItem('mbt_supabase_user_email') || '';
        var id    = localStorage.getItem('mbt_supabase_user_id') || '';
        return token ? { token: token, email: email, id: id } : null;
    }

    /* --- Save / fetch user profile (profiles table). --- */
    async function saveProfile(displayName, region, role) {
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        if (!userId) throw new Error('Not signed in');
        var record = { id: userId, display_name: displayName || '', region: region || 'Jamaica', role: role || '', updated_at: new Date().toISOString() };
        var res = await fetch(getBaseUrl('profiles'), {
            method: 'POST',
            headers: Object.assign({}, getHeaders(), { 'Prefer': 'resolution=merge-duplicates,return=representation' }),
            body: JSON.stringify(record)
        });
        if (!res.ok) throw new Error('Profile save failed: ' + res.statusText);
        var data = await res.json();
        var profile = Array.isArray(data) ? data[0] : data;
        localStorage.setItem('mbt_profile_display_name', profile.display_name || '');
        localStorage.setItem('mbt_profile_region', profile.region || 'Jamaica');
        localStorage.setItem('mbt_profile_role', profile.role || '');
        return profile;
    }

    async function fetchProfile() {
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        if (!userId) return null;
        var res = await fetch(getBaseUrl('profiles') + '?id=eq.' + encodeURIComponent(userId) + '&select=*', {
            headers: getHeaders()
        });
        if (!res.ok) return null;
        var rows = await res.json();
        if (!rows || !rows.length) return null;
        var p = rows[0];
        localStorage.setItem('mbt_profile_display_name', p.display_name || '');
        localStorage.setItem('mbt_profile_region', p.region || 'Jamaica');
        localStorage.setItem('mbt_profile_role', p.role || '');
        return p;
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
                        let payload = records[j];
                        
                        // Phase 46 Security: Privacy Filter
                        // Strip local contact information when pushing rate references to the OpenGate community pool
                        if (storeName === 'og_ref') {
                            payload = Object.assign({}, payload);
                            delete payload.contact_id;
                            delete payload.contact_name;
                            delete payload.contact_phone;
                            delete payload.contact_email;
                        }

                        await sbUpsert(tableName, payload);
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

    /* --- 5. OFFLINE PUSH QUEUE --- */
    /* When the app comes back online and "Sync budgets to cloud" is enabled,
       automatically push any local changes that accumulated while offline. */

    function _shouldAutoSync() {
        return localStorage.getItem('mbt_supabase_sync_on_reconnect') === 'true' &&
               window.mBTSupabaseConfig &&
               window.mBTSupabaseConfig.isConfigured() &&
               window.mBTSupabaseConfig.isSignedIn();
    }

    window.addEventListener('online', function () {
        if (_shouldAutoSync()) {
            syncPushAll().catch(function (e) {
                console.warn('[mBTSync] Auto-push on reconnect failed:', e);
            });
        }
    });

    /* --- 6. GLOBAL EXPOSURE --- */

    window.mBTSync = {
        pushAll:       syncPushAll,
        pullAll:       syncPullAll,
        exportData:    exportAllData,
        sbFetchAll:    sbFetchAll,
        sbUpsert:      sbUpsert,
        sbDelete:      sbDelete,
        signIn:        signIn,
        signInWithGoogle: signInWithGoogle,
        signOut:       signOut,
        getSession:    getSession,
        saveProfile:   saveProfile,
        fetchProfile:  fetchProfile
    };

    console.log('[mBT] Supabase sync service initialized ✓');
})();
