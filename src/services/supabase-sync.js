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
        _handleAuthResponse(data, email);
        return data;
    }

    /* --- Sign up with email + password. --- */
    async function signUp(username, email, password) {
        var res = await fetch(getAuthUrl('/signup'), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                email: email, 
                password: password,
                data: { display_name: username }
            })
        });
        var data = await res.json();
        if (!res.ok) {
            console.warn('[mBTSync] Sign-up error:', data.message);
            throw new Error(data.message || 'Sign-up failed.');
        }

        // If auto-confirm is on in Supabase, we might get a session immediately.
        if (data.access_token) {
            _handleAuthResponse(data, email);
        }
        return data;
    }

    /* --- Password Recovery: sends reset email. --- */
    async function forgotPassword(email) {
        var res = await fetch(getAuthUrl('/recover'), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ email: email })
        });
        if (!res.ok) {
            var data = await res.json();
            throw new Error(data.message || 'Recovery request failed.');
        }
        return true;
    }

    /* --- Update user data (e.g. password). --- */
    async function updatePassword(newPassword) {
        var res = await fetch(getAuthUrl('/user'), {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ password: newPassword })
        });
        var data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Password update failed.');
        }
        return data;
    }

    /* --- Helper to save auth state --- */
    function _handleAuthResponse(data, email) {
        if (data.access_token) localStorage.setItem('mbt_supabase_auth_token', data.access_token);
        if (data.refresh_token) localStorage.setItem('mbt_supabase_refresh_token', data.refresh_token);
        if (email) localStorage.setItem('mbt_supabase_user_email', email);
        if (data.user) {
            localStorage.setItem('mbt_supabase_user_email', data.user.email);
            localStorage.setItem('mbt_supabase_user_id', data.user.id);
            if (data.user.user_metadata && data.user.user_metadata.display_name) {
                localStorage.setItem('mbt_profile_display_name', data.user.user_metadata.display_name);
            }
        }
    }

    /* --- Process URL Hash for OAuth Redirects --- */
    function processAuthHash(hash) {
        if (!hash) return false;
        var hashStr = hash.indexOf('#') === 0 ? hash.substring(1) : hash;
        var params = new URLSearchParams(hashStr);
        var accessToken = params.get('access_token');
        var refreshToken = params.get('refresh_token');
        
        if (accessToken) {
            _handleAuthResponse({
                access_token: accessToken,
                refresh_token: refreshToken
            }, null);
            return true;
        }
        return false;
    }

    async function refreshAccessToken() {
        var refreshTok = localStorage.getItem('mbt_supabase_refresh_token');
        if (!refreshTok) throw new Error('No refresh token available');
        var res = await fetch(getAuthUrl('/token?grant_type=refresh_token'), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ refresh_token: refreshTok })
        });
        if (!res.ok) {
            signOut();
            throw new Error('Session expired. Please sign in again.');
        }
        var data = await res.json();
        _handleAuthResponse(data, null);
        return data;
    }

    async function fetchWithRetry(url, opts) {
        var res = await fetch(url, opts);
        if (res.status === 401) {
            console.warn('[mBTSync] Token expired, attempting refresh...');
            await refreshAccessToken();
            // Rebuild headers because access token changed
            opts.headers = Object.assign({}, opts.headers, getHeaders());
            res = await fetch(url, opts);
        }
        return res;
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
        
        // G15: Privacy Wipe on Sign-Out — aggressively clear local cache
        try {
            var s = window.mBTStorage || window.mBT.storage;
            // Clear all projects
            var projects = await s.getAllProjects();
            for (var i = 0; i < projects.length; i++) {
                await s.deleteProject(projects[i].id, true);
            }
            // Clear all stages
            var stages = await s.getAllStages();
            for (var j = 0; j < stages.length; j++) {
                await s.deleteStage(stages[j].id, true);
            }
            // Clear localforage keys starting with prodBudget_v5_
            if (typeof localforage !== 'undefined') {
                var lfKeys = await localforage.keys();
                var budgetPrefix = 'prodBudget_v5_';
                for (var k = 0; k < lfKeys.length; k++) {
                    if (lfKeys[k].indexOf(budgetPrefix) === 0) {
                        await localforage.removeItem(lfKeys[k]);
                    }
                }
            }
            // Clear contacts and sessions via IDB transactions
            var db = await s.getDb();
            var tx = db.transaction(['contacts', 'sessions'], 'readwrite');
            tx.objectStore('contacts').clear();
            tx.objectStore('sessions').clear();
            await new Promise(function (resolve, reject) {
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        } catch (e) {
            console.warn('[mBTSync] Privacy wipe on sign-out partially failed:', e);
        }
    }

    /* --- Get current session state from localStorage (no network call). --- */
    function getSession() {
        var token = localStorage.getItem('mbt_supabase_auth_token') || '';
        var email = localStorage.getItem('mbt_supabase_user_email') || '';
        var id    = localStorage.getItem('mbt_supabase_user_id') || '';
        return token ? { token: token, email: email, id: id } : null;
    }

    /* --- Save / fetch user profile (proxied to mbt_generic). --- */
    async function saveProfile(displayName, region, role) {
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        if (!userId) throw new Error('Not signed in');
        
        localStorage.setItem('mbt_profile_display_name', displayName || '');
        localStorage.setItem('mbt_profile_region', region || 'Jamaica');
        localStorage.setItem('mbt_profile_role', role || '');
        
        try { await pushPreferences(); } catch (e) {
            console.warn('[mBTSync] Proxy profile push failed', e);
        }
        
        return { display_name: displayName, region: region, role: role };
    }

    async function fetchProfile() {
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        if (!userId) return null;
        
        try { await pullPreferences(); } catch (e) {
            console.warn('[mBTSync] Proxy profile pull failed', e);
        }
        
        return {
            display_name: localStorage.getItem('mbt_profile_display_name') || '',
            region: localStorage.getItem('mbt_profile_region') || 'Jamaica',
            role: localStorage.getItem('mbt_profile_role') || ''
        };
    }

    function getBaseUrl(table) {
        var url = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.API_URL : '';
        return url + '/rest/v1/' + table;
    }

    /* --- Fetch all rows from a Supabase table --- */
    async function sbFetchAll(table) {
        var res = await fetchWithRetry(getBaseUrl(table) + '?select=*', {
            method: 'GET',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Supabase fetch failed for ' + table + ': ' + res.statusText);
        return res.json();
    }

    /* --- Upsert a record (insert or update by id) --- */
    async function sbUpsert(table, record) {
        var res = await fetchWithRetry(getBaseUrl(table), {
            method: 'POST',
            headers: Object.assign({}, getHeaders(), { 'Prefer': 'resolution=merge-duplicates,return=representation' }),
            body: JSON.stringify(record)
        });
        if (!res.ok) throw new Error('Supabase upsert failed for ' + table + ': ' + res.statusText);
        return res.json();
    }

    /* --- Delete a record by id --- */
    async function sbDelete(table, id) {
        var res = await fetchWithRetry(getBaseUrl(table) + '?id=eq.' + encodeURIComponent(id), {
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

    /* --- Delete a local record by storeName and id (used during pull soft-delete propagation).
           skipTombstone=true prevents re-tombstoning a record that was already deleted remotely. --- */
    async function deleteLocalRecord(storeName, id) {
        var s = window.mBTStorage || window.mBT.storage;
        switch (storeName) {
            case 'mbt_projects':   return s.deleteProject(id, true);
            case 'mbt_stages':     return s.deleteStage(id, true);
            case 'mbt_executions': return s.deleteExecution(id, true);
            case 'og_ref':         return s.deleteOGItem(id);
            case 'contacts':
            case 'sessions': {
                var db = await s._getDb();
                return new Promise(function (resolve, reject) {
                    var store = db.transaction([storeName], 'readwrite').objectStore(storeName);
                    var req = store.delete(id);
                    req.onsuccess = function () { resolve(); };
                    req.onerror = function () { reject(req.error); };
                });
            }
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

    /* --- Strip base64 attachment blobs from a budget before pushing to cloud.
           Prevents Supabase 50MB payload limit crashes from embedded file data.
           Attachment metadata (title, filename) is preserved so the cloud record
           knows what files exist; only the binary content is stripped. --- */
    function _stripBase64Attachments(data) {
        if (!data || !data.fundingSources || !data.fundingSources.length) return data;
        var clone = JSON.parse(JSON.stringify(data));
        for (var i = 0; i < clone.fundingSources.length; i++) {
            var src = clone.fundingSources[i];
            if (!src.attachments || !src.attachments.length) continue;
            for (var j = 0; j < src.attachments.length; j++) {
                if (src.attachments[j].data && src.attachments[j].data.length > 1024) {
                    src.attachments[j].data = '[stripped_for_sync]';
                }
            }
        }
        return clone;
    }

    var _isSyncing = false;

    /* --- Push all local IndexedDB data to Supabase --- */
    async function syncPushAll() {
        if (_isSyncing) return { synced: 0, errors: 0, reason: 'sync_in_progress' };
        if (!window.mBTSupabaseConfig || !window.mBTSupabaseConfig.isConfigured()) {
            return { synced: 0, errors: 0, reason: 'not_configured' };
        }
        _isSyncing = true;
        try {

        var schema = window.mBTSupabaseSchema || {};
        var storeNames = Object.keys(schema);
        var totalSynced = 0;
        var totalErrors = 0;
        var pushedProjectIds = {}; /* Track IDs already pushed to avoid double-pushing monolith */
        var conflicts = []; /* G16: Track conflict messages */

        for (var i = 0; i < storeNames.length; i++) {
            var storeName = storeNames[i];
            var tableName = schema[storeName];
            try {
                // Phase 51: Fetch remote projects to handle offline name collisions before push
                let remoteNames = null;
                if (storeName === 'mbt_projects') {
                    try {
                        let remoteProj = await sbFetchAll(tableName);
                        remoteNames = {};
                        for (let r of remoteProj) { if (r.data && r.data.name) remoteNames[r.data.name.toLowerCase()] = r.id; }
                    } catch (e) {
                        console.warn('[mBTSync] Could not pre-fetch remote projects for collision check', e);
                    }
                }

                var records = await getLocalRecords(storeName);
                for (var j = 0; j < records.length; j++) {
                    try {
                        let payload = records[j];
                        
                        // Phase 51: Name conflict resolution
                        if (storeName === 'mbt_projects' && remoteNames && payload.name) {
                            let lname = String(payload.name).toLowerCase();
                            // If remote has this name but under a different ID, rename local to avoid user confusion
                            if (remoteNames[lname] && remoteNames[lname] !== payload.id) {
                                payload.name = payload.name + ' (Offline Sync)';
                                await writeLocalRecord(storeName, payload);
                            }
                        }
                        
                        /* --- Phase 46 Security: Privacy filter via centralized config --- */
                        if (window.mBTSupabaseConfig && mBTSupabaseConfig.SYNC.applyPrivacyFilter) {
                            payload = mBTSupabaseConfig.SYNC.applyPrivacyFilter(storeName, payload);
                        }

                        await sbUpsert(tableName, payload);
                        totalSynced++;
                        if (storeName === 'mbt_projects' && payload.id) {
                            pushedProjectIds[payload.id] = true;
                        }
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

        /* --- Sub-Phase 51.1 Group B: Monolith Budget Push
               Enumerate all prodBudget_v5_* localforage keys and push any budget not
               already covered by the IndexedDB mbt_projects loop above. --- */
        try {
            var lfKeys = (typeof localforage !== 'undefined') ? await localforage.keys() : [];
            var budgetPrefix = 'prodBudget_v5_';
            var excludeSuffixes = ['trash', 'globalItems', 'templates', 'currency', 'rates',
                'lastLoaded', 'ApiKey', 'selectedAiProvider', 'dateFormat',
                'projectNameSeparator', 'projectStorageProtocol', 'aiSystemPrompt'];
            var userId = localStorage.getItem('mbt_supabase_user_id') || '';

            for (var lfi = 0; lfi < lfKeys.length; lfi++) {
                var lfKey = lfKeys[lfi];
                if (lfKey.indexOf(budgetPrefix) !== 0) continue;
                var skipKey = false;
                for (var ex = 0; ex < excludeSuffixes.length; ex++) {
                    if (lfKey.indexOf(excludeSuffixes[ex]) !== -1) { skipKey = true; break; }
                }
                if (skipKey) continue;

                try {
                    var budgetData = await localforage.getItem(lfKey);
                    if (!budgetData) continue;
                    var budgetId = budgetData.id || budgetData.projectName || lfKey.replace(budgetPrefix, '');
                    if (pushedProjectIds[budgetId]) continue; /* Already pushed via IndexedDB loop */

                    var cleanBudget = _stripBase64Attachments(budgetData);
                    var monolithPayload = {
                        id: budgetId,
                        user_id: userId,
                        data: cleanBudget,
                        updated_at: cleanBudget.updated_at || new Date().toISOString()
                    };
                    await sbUpsert('projects', monolithPayload);
                    totalSynced++;
                    pushedProjectIds[budgetId] = true;
                } catch (e) {
                    console.error('[mBTSync] Monolith push error for ' + lfKey + ':', e);
                    totalErrors++;
                }
            }
        } catch (e) {
            console.error('[mBTSync] Monolith enumeration error:', e);
        }

        /* --- Sub-Phase 51.1 Group C: Tombstone push — propagate local deletions to Supabase --- */
        try {
            var s = window.mBTStorage || window.mBT.storage;
            var tombstones = await s.getAllTombstones();
            if (tombstones.length) {
                var storeToTable = window.mBTSupabaseSchema || {};
                var tombUserId = localStorage.getItem('mbt_supabase_user_id') || '';
                for (var t = 0; t < tombstones.length; t++) {
                    var tomb = tombstones[t];
                    var targetTable = storeToTable[tomb.store];
                    if (!targetTable) continue;
                    try {
                        await sbUpsert(targetTable, {
                            id: tomb.id,
                            user_id: tombUserId,
                            deleted_at: tomb.deleted_at,
                            updated_at: tomb.deleted_at
                        });
                        totalSynced++;
                        conflicts.push('Deleted remote ' + tomb.store + ' id ' + tomb.id);
                    } catch (e) {
                        console.error('[mBTSync] Tombstone push error for ' + tomb.store + '/' + tomb.id + ':', e);
                        totalErrors++;
                    }
                }
                /* Clear tombstones only after all have been pushed successfully enough */
                await s.clearTombstones();
            }
        } catch (e) {
            console.error('[mBTSync] Tombstone propagation error:', e);
        }

        await (window.mBTStorage || window.mBT.storage).setItem(
            window.mBTSupabaseConfig.SYNC.LAST_SYNC_KEY,
            Date.now()
        );

        try { await pushPreferences(); } catch (e) { console.warn('[mBTSync] Preferences push failed:', e); }

        return { synced: totalSynced, errors: totalErrors, conflicts: conflicts };
        } finally {
            _isSyncing = false;
        }
    }

    /* --- Pull Supabase data into IndexedDB (additive — does not overwrite newer local records) --- */
    async function syncPullAll() {
        if (_isSyncing) return { pulled: 0, errors: 0, reason: 'sync_in_progress' };
        if (!window.mBTSupabaseConfig || !window.mBTSupabaseConfig.isConfigured()) {
            return { pulled: 0, errors: 0, reason: 'not_configured' };
        }
        _isSyncing = true;
        try {

        var schema = window.mBTSupabaseSchema || {};
        var storeNames = Object.keys(schema);
        var totalPulled = 0;
        var totalErrors = 0;
        var conflicts = []; /* G16: Track conflict messages */

        for (var i = 0; i < storeNames.length; i++) {
            var storeName = storeNames[i];
            var tableName = schema[storeName];
            try {
                var remoteRecords = await sbFetchAll(tableName);
                var localRecords = await getLocalRecords(storeName);
                var localMap = {};
                for (var r=0; r < localRecords.length; r++) { localMap[localRecords[r].id] = localRecords[r]; }

                for (var j = 0; j < remoteRecords.length; j++) {
                    var remote = remoteRecords[j];
                    var local = localMap[remote.id];

                    /* Sub-Phase 51.1 Group C: Soft-delete propagation — remove local copy if remote was deleted */
                    if (remote.deleted_at) {
                        if (local) {
                            try {
                                await deleteLocalRecord(storeName, remote.id);
                                totalPulled++;
                            } catch (e) {
                                console.error('[mBTSync] Pull delete error ' + storeName + ':', e);
                                totalErrors++;
                            }
                        }
                        continue;
                    }

                    if (!local) {
                        try {
                            await writeLocalRecord(storeName, remote);
                            totalPulled++;
                        } catch (e) {
                            console.error('[mBTSync] writeLocalRecord error ' + storeName + ':', e);
                            totalErrors++;
                        }
                    } else {
                        // Conflict resolution checking for updated_at tracking
                        var remoteTime = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
                        var localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
                        if (remoteTime > localTime) {
                            // G14: Base64 Sync Loophole — restore stripped attachments from local before write
                            if (storeName === 'mbt_projects' && remote.data && remote.data.fundingSources) {
                                if (local && local.data && local.data.fundingSources) {
                                    for (var k = 0; k < remote.data.fundingSources.length; k++) {
                                        var rSrc = remote.data.fundingSources[k];
                                        var lSrc = local.data.fundingSources[k];
                                        if (rSrc && lSrc && rSrc.attachments && lSrc.attachments) {
                                            for (var a = 0; a < rSrc.attachments.length; a++) {
                                                if (rSrc.attachments[a].data === '[stripped_for_sync]' && lSrc.attachments[a] && lSrc.attachments[a].data) {
                                                    rSrc.attachments[a].data = lSrc.attachments[a].data;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            try {
                                await writeLocalRecord(storeName, remote);
                                totalPulled++;
                                conflicts.push('Overwrote local ' + storeName + ' with newer cloud copy.');
                            } catch (e) {
                                console.error('[mBTSync] writeLocalRecord overwrite error ' + storeName + ':', e);
                                totalErrors++;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[mBTSync] Pull error ' + tableName + ':', e);
                totalErrors++;
            }
        }

        /* --- Sub-Phase 51.4: Monolith LocalForage Bridge ---
               Extrapolate pulled IndexedDB mbt_projects records back into
               the active localforage environment so the UI can physically mount them. */
        try {
            var lfBridgeRecords = await getLocalRecords('mbt_projects');
            for (var lb = 0; lb < lfBridgeRecords.length; lb++) {
                var br = lfBridgeRecords[lb];
                if (br && br.id && br.data && typeof localforage !== 'undefined') {
                    await localforage.setItem('prodBudget_v5_' + br.id, br.data);
                }
            }
        } catch(e) {
            console.error('[mBTSync] Monolith localforage bridge error:', e);
        }

        await (window.mBTStorage || window.mBT.storage).setItem(
            window.mBTSupabaseConfig.SYNC.LAST_SYNC_KEY,
            Date.now()
        );

        try { await pullPreferences(); } catch (e) { console.warn('[mBTSync] Preferences pull failed:', e); }

        return { pulled: totalPulled, errors: totalErrors, conflicts: conflicts };
        } finally {
            _isSyncing = false;
        }
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

    /* --- Sub-Phase 51.1 Group C: Settings & Preferences Sync
           Whitelisted localStorage keys + budget.settings pushed to Supabase mbt_generic table.
           API keys, auth tokens, and sensitive keys are explicitly excluded.
           budget.settings is bridged via _getBudgetSettings / _setBudgetSettings hooks
           wired in index.html after the sync service loads. --- */

    var SYNCABLE_PREFS = [
        'prodBudget_v5_currency',
        'prodBudget_v5_rates',
        'prodBudget_v5_dateFormat',
        'prodBudget_v5_projectNameSeparator',
        'moo_og_loc',
        'moo_og_share',
        'mBT_openToolsInternal',
        'mbt_supabase_sync_on_reconnect',
        'mbt_supabase_sync_mode',
        'mbt_profile_display_name',
        'mbt_profile_region',
        'mbt_profile_role'
    ];

    async function pushPreferences() {
        if (!window.mBTSupabaseConfig || !window.mBTSupabaseConfig.isSignedIn()) return;
        var prefs = {};
        for (var i = 0; i < SYNCABLE_PREFS.length; i++) {
            var val = localStorage.getItem(SYNCABLE_PREFS[i]);
            if (val !== null) prefs[SYNCABLE_PREFS[i]] = val;
        }
        if (typeof window.mBTSync._getBudgetSettings === 'function') {
            var bs = window.mBTSync._getBudgetSettings();
            if (bs) prefs._budgetSettings = bs;
        }
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        await sbUpsert('mbt_generic', {
            key: 'user_preferences',
            user_id: userId,
            value: prefs,
            updated_at: new Date().toISOString()
        });
    }

    async function pullPreferences() {
        if (!window.mBTSupabaseConfig || !window.mBTSupabaseConfig.isSignedIn()) return;
        var res = await fetchWithRetry(
            getBaseUrl('mbt_generic') + '?key=eq.user_preferences&select=*',
            { method: 'GET', headers: getHeaders() }
        );
        if (!res.ok) return;
        var rows = await res.json();
        if (!rows || !rows.length) return;
        var prefs = rows[0].value;
        if (!prefs || typeof prefs !== 'object') return;
        for (var i = 0; i < SYNCABLE_PREFS.length; i++) {
            var key = SYNCABLE_PREFS[i];
            if (prefs[key] !== undefined && prefs[key] !== null) {
                localStorage.setItem(key, prefs[key]);
            }
        }
        if (prefs._budgetSettings && typeof window.mBTSync._setBudgetSettings === 'function') {
            window.mBTSync._setBudgetSettings(prefs._budgetSettings);
        }
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

    /* --- Sub-Phase 51.1 Group B: Continuous Auto-Save to Cloud
           Called by mBT.data.save() after every local write. Debounces 30 seconds
           so rapid edits batch into a single push once the user pauses typing. --- */
    var _autoSaveTimeout = null;
    var AUTO_SAVE_DEBOUNCE_MS = 30000;

    function scheduleAutoSync() {
        if (!_shouldAutoSync()) return;
        if (localStorage.getItem('mbt_supabase_sync_mode') !== 'continuous') return;
        if (_isSyncing) return;
        clearTimeout(_autoSaveTimeout);
        _autoSaveTimeout = setTimeout(function () {
            if (_shouldAutoSync() && !_isSyncing) {
                syncPushAll().catch(function (e) {
                    console.warn('[mBTSync] Auto-save push failed:', e);
                });
            }
        }, AUTO_SAVE_DEBOUNCE_MS);
    }

    var _reconnectTimeout = null;
    window.addEventListener('online', function () {
        if (_shouldAutoSync()) {
            clearTimeout(_reconnectTimeout);
            _reconnectTimeout = setTimeout(function() {
                syncPushAll().catch(function (e) {
                    console.warn('[mBTSync] Auto-push on reconnect failed:', e);
                });
            }, 5000); // 5s debounce to allow network to stabilize
        }
    });

    // Sub-Phase 50.2 Blind Spot: Periodic Token Refresh
    // Active sessions should proactively refresh the token to avoid unexpected expiration.
    setInterval(function() {
        if (localStorage.getItem('mbt_supabase_refresh_token')) {
            refreshAccessToken().catch(function(e) {
                console.warn('[mBTSync] Background token refresh failed', e);
            });
        }
    }, 45 * 60 * 1000); // Runs every 45 minutes

    /* --- 6. GLOBAL EXPOSURE --- */

    window.mBTSync = {
        pushAll:           syncPushAll,
        pullAll:           syncPullAll,
        exportData:        exportAllData,
        signIn:            signIn,
        signUp:            signUp,
        forgotPassword:    forgotPassword,
        updatePassword:    updatePassword,
        signInWithGoogle:  signInWithGoogle,
        signOut:           signOut,
        saveProfile:       saveProfile,
        fetchProfile:      fetchProfile,
        refreshAccessToken: refreshAccessToken,
        processAuthHash:   processAuthHash,
        scheduleAutoSync:  scheduleAutoSync,
        pushPreferences:   pushPreferences,
        pullPreferences:   pullPreferences,
        /* Hooks wired by index.html to bridge budget.settings across module boundary */
        _getBudgetSettings: null,
        _setBudgetSettings: null
    };

    console.log('[mBT] Supabase sync service initialized ✓');
})();
