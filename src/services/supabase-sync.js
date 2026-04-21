/* ========= v1.0 Supabase Sync Service — bidirectional IndexedDB/Supabase sync v2.1 ========= */
(function () {
    'use strict';

    /* --- mBT UI Sync Feedback Bridge (Phase 96) --- */
    function _dispatchSyncStatus(status) {
        /* status: 'syncing' | 'saved' | 'error' | 'offline' */
        window.dispatchEvent(new CustomEvent('mbt:sync-status', { detail: { status: status } }));
    }

    /* --- ES5 Utility: Shallow object merge (Phase 148 Cleanup) --- */
    function _assign(target) {
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            if (source) {
                for (var key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                        target[key] = source[key];
                    }
                }
            }
        }
        return target;
    }

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

    function signIn(email, password) {
        var resRef;
        return fetch(getAuthUrl('/token?grant_type=password'), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ email: email, password: password })
        }).then(function (res) {
            resRef = res;
            return res.json();
        }).then(function (data) {
            if (!resRef.ok) {
                console.warn('[mBTSync] Auth error:', data.error_description || data.message);
                throw new Error('Sign-in failed. Check your email and password.');
            }
            _handleAuthResponse(data, email);
            return data;
        });
    }

    /* --- Sign up with email + password. --- */
    function signUp(username, email, password) {
        var resRef;
        return fetch(getAuthUrl('/signup'), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                email: email,
                password: password,
                data: { display_name: username }
            })
        }).then(function (res) {
            resRef = res;
            return res.json();
        }).then(function (data) {
            if (!resRef.ok) {
                console.warn('[mBTSync] Sign-up error:', data.message);
                throw new Error(data.message || 'Sign-up failed.');
            }
            /* If auto-confirm is on in Supabase, we might get a session immediately. */
            if (data.access_token) {
                _handleAuthResponse(data, email);
            }
            return data;
        });
    }

    /* --- Password Recovery: sends reset email. --- */
    function forgotPassword(email) {
        return fetch(getAuthUrl('/recover'), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ email: email })
        }).then(function (res) {
            if (res.ok) return true;
            return res.json().then(function (data) {
                throw new Error(data.message || 'Recovery request failed.');
            });
        });
    }

    /* --- Update user data (e.g. password). --- */
    function updatePassword(newPassword) {
        var resRef;
        return fetch(getAuthUrl('/user'), {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ password: newPassword })
        }).then(function (res) {
            resRef = res;
            return res.json();
        }).then(function (data) {
            if (!resRef.ok) throw new Error(data.message || 'Password update failed.');
            return data;
        });
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

    function refreshAccessToken() {
        var refreshTok = localStorage.getItem('mbt_supabase_refresh_token');
        if (!refreshTok) return Promise.reject(new Error('No refresh token available'));
        return fetch(getAuthUrl('/token?grant_type=refresh_token'), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ refresh_token: refreshTok })
        }).then(function (res) {
            if (!res.ok) {
                signOut();
                throw new Error('Session expired. Please sign in again.');
            }
            return res.json();
        }).then(function (data) {
            _handleAuthResponse(data, null);
            return data;
        });
    }

    function fetchWithRetry(url, opts) {
        return fetch(url, opts).then(function (res) {
            if (res.status !== 401) return res;
            console.warn('[mBTSync] Token expired, attempting refresh...');
            return refreshAccessToken().then(function () {
                /* Rebuild headers because access token changed */
                opts.headers = _assign({}, opts.headers, getHeaders());
                return fetch(url, opts);
            });
        });
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
    function signOut() {
        var jwt = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.AUTH_TOKEN : '';
        var logoutPromise = jwt
            ? fetch(getAuthUrl('/logout'), { method: 'POST', headers: getAuthHeaders() }).catch(function () { /* silent */ })
            : Promise.resolve();

        return logoutPromise.then(function () {
            localStorage.removeItem('mbt_supabase_auth_token');
            localStorage.removeItem('mbt_supabase_refresh_token');
            localStorage.removeItem('mbt_supabase_user_email');
            localStorage.removeItem('mbt_supabase_user_id');

            /* G15: Privacy Wipe on Sign-Out — aggressively clear local cache */
            var s = window.mBTStorage || (window.mBT && window.mBT.storage);
            if (!s) return;

            return s.getAllProjects().then(function (projects) {
                var chain = Promise.resolve();
                projects.forEach(function (p) {
                    chain = chain.then(function () { return s.deleteProject(p.id, true); });
                });
                return chain;
            }).then(function () {
                return s.getAllStages();
            }).then(function (stages) {
                var chain = Promise.resolve();
                stages.forEach(function (st) {
                    chain = chain.then(function () { return s.deleteStage(st.id, true); });
                });
                return chain;
            }).then(function () {
                if (typeof localforage === 'undefined') return null;
                return localforage.keys();
            }).then(function (lfKeys) {
                if (!lfKeys) return null;
                var budgetPrefix = 'prodBudget_v5_';
                var chain = Promise.resolve();
                lfKeys.forEach(function (k) {
                    if (k.indexOf(budgetPrefix) === 0) {
                        chain = chain.then(function () { return localforage.removeItem(k); });
                    }
                });
                return chain;
            }).then(function () {
                /* Clear contacts and sessions via IDB transactions */
                return s.getDb();
            }).then(function (db) {
                if (!db) return;
                var tx = db.transaction(['contacts', 'sessions'], 'readwrite');
                tx.objectStore('contacts').clear();
                tx.objectStore('sessions').clear();
                return new Promise(function (resolve, reject) {
                    tx.oncomplete = function () { resolve(); };
                    tx.onerror    = function () { reject(tx.error); };
                });
            }).catch(function (e) {
                console.warn('[mBTSync] Privacy wipe on sign-out partially failed:', e);
            });
        });
    }

    /* --- Get current session state from localStorage (no network call). --- */
    function getSession() {
        var token = localStorage.getItem('mbt_supabase_auth_token') || '';
        var email = localStorage.getItem('mbt_supabase_user_email') || '';
        var id    = localStorage.getItem('mbt_supabase_user_id') || '';
        return token ? { token: token, email: email, id: id } : null;
    }

    /* --- Save / fetch user profile (proxied to mbt_generic). --- */
    function saveProfile(displayName, region, role) {
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        if (!userId) return Promise.reject(new Error('Not signed in'));

        localStorage.setItem('mbt_profile_display_name', displayName || '');
        localStorage.setItem('mbt_profile_region', region || 'Jamaica');
        localStorage.setItem('mbt_profile_role', role || '');

        return pushPreferences().catch(function (e) {
            console.warn('[mBTSync] Proxy profile push failed', e);
        }).then(function () {
            return { display_name: displayName, region: region, role: role };
        });
    }

    function fetchProfile() {
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        if (!userId) return Promise.resolve(null);

        return pullPreferences().catch(function (e) {
            console.warn('[mBTSync] Proxy profile pull failed', e);
        }).then(function () {
            return {
                display_name: localStorage.getItem('mbt_profile_display_name') || '',
                region: localStorage.getItem('mbt_profile_region') || 'Jamaica',
                role: localStorage.getItem('mbt_profile_role') || ''
            };
        });
    }

    function getBaseUrl(table) {
        var url = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.API_URL : '';
        return url + '/rest/v1/' + table;
    }

    /* --- Fetch all rows from a Supabase table --- */
    function sbFetchAll(table) {
        return fetchWithRetry(getBaseUrl(table) + '?select=*', {
            method: 'GET',
            headers: getHeaders()
        }).then(function (res) {
            if (!res.ok) throw new Error('Supabase fetch failed for ' + table + ': ' + res.statusText);
            return res.json();
        });
    }

    /* --- Phase 63: Simple version hash — sha-like fingerprint of updated_at + projectName.
           Used to detect remote-ahead conflicts without a full schema migration.
           If the remote record's updated_at differs from our local last-sync marker,
           a potential conflict is flagged. --- */
    function _generateVersionHash(record) {
        var str = (record.updated_at || '') + '|' + (record.id || '') + '|' + (record.data && record.data.projectName ? record.data.projectName : '');
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return (hash >>> 0).toString(16);
    }

    /* --- Phase 63: Check remote updated_at before upserting a project.
           If the remote version is newer than our local last-sync marker AND we have
           local edits (local.updated_at > last_sync), a conflict is detected.
           Fires window event 'mbt:diff-conflict' and returns false to halt the sync queue.
           Returns true if safe to proceed. --- */
    function _checkProjectConflict(table, record) {
        if (table !== 'projects' || !record.id) return Promise.resolve(true);

        var lastSyncPromise;
        try {
            var storage = window.mBTStorage || (window.mBT && window.mBT.storage);
            var syncKey = window.mBTSupabaseConfig && window.mBTSupabaseConfig.SYNC && window.mBTSupabaseConfig.SYNC.LAST_SYNC_KEY;
            lastSyncPromise = (storage && syncKey) ? storage.getItem(syncKey) : Promise.resolve(null);
        } catch (_) { lastSyncPromise = Promise.resolve(null); }

        return lastSyncPromise.then(function (rawSync) {
            var lastSyncMs = 0;
            if (rawSync) lastSyncMs = typeof rawSync === 'number' ? rawSync : new Date(rawSync).getTime();

            if (!lastSyncMs) return true; /* First-ever sync — no baseline, safe to push */

            var localUpdated = record.updated_at ? new Date(record.updated_at).getTime() : 0;
            if (localUpdated <= lastSyncMs) return true; /* Local hasn't changed since last sync — safe */

            /* Fetch current remote updated_at */
            return fetchWithRetry(
                getBaseUrl(table) + '?id=eq.' + encodeURIComponent(record.id) + '&select=id,updated_at',
                { method: 'GET', headers: getHeaders() }
            ).then(function (res) {
                if (!res.ok) return true; /* Can't check — proceed optimistically */
                return res.json().then(function (rows) {
                    if (!rows || !rows.length) return true; /* New record — no conflict possible */
                    var remoteUpdatedMs = rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : 0;

                    /* Conflict: remote was updated after our last sync AND we also have local changes */
                    if (remoteUpdatedMs > lastSyncMs && localUpdated > lastSyncMs) {
                        window.dispatchEvent(new CustomEvent('mbt:diff-conflict', {
                            detail: {
                                projectId:    record.id,
                                localRecord:  record,
                                remoteTime:   rows[0].updated_at,
                                localTime:    record.updated_at
                            }
                        }));
                        return false; /* Halt push for this record */
                    }
                    return true;
                });
            }).catch(function () { return true; });
        }).catch(function () { return true; });
    }

    /* --- Upsert a record (insert or update by id) --- */
    function sbUpsert(table, record) {
        return fetchWithRetry(getBaseUrl(table), {
            method: 'POST',
            headers: _assign({}, getHeaders(), { 'Prefer': 'resolution=merge-duplicates,return=representation' }),
            body: JSON.stringify(record)
        }).then(function (res) {
            if (!res.ok) throw new Error('Supabase upsert failed for ' + table + ': ' + res.statusText);
            return res.json();
        });
    }

    /* --- Phase 68A: Insert Editor save into mbt_pending_edits holding table.
           Throws on network/RLS failure — caller handles graceful degradation. --- */
    function sbInsertPendingEdit(payload) {
        var baseUrl = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.API_URL : '';
        if (!baseUrl) return Promise.reject(new Error('[mBTSync] No Supabase URL configured'));
        var url = baseUrl + '/rest/v1/mbt_pending_edits';
        return fetchWithRetry(url, {
            method: 'POST',
            headers: _assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
            body: JSON.stringify(payload)
        }).then(function (res) {
            if (res.ok) return res.json();
            return res.text().then(function (errText) {
                throw new Error('[mBTSync] Pending edit insert failed: ' + errText);
            });
        });
    }

    /* --- Phase 68B: PATCH status on a mbt_pending_edits row (approve / reject) --- */
    function sbPatchPendingEdit(editId, updates) {
        var baseUrl = window.mBTSupabaseConfig ? window.mBTSupabaseConfig.API_URL : '';
        if (!baseUrl) return Promise.reject(new Error('[mBTSync] No Supabase URL configured'));
        var url = baseUrl + '/rest/v1/mbt_pending_edits?id=eq.' + encodeURIComponent(editId);
        return fetchWithRetry(url, {
            method: 'PATCH',
            headers: _assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
            body: JSON.stringify(updates)
        }).then(function (res) {
            if (res.ok) return res.json();
            return res.text().then(function (errText) {
                throw new Error('[mBTSync] Pending edit PATCH failed: ' + errText);
            });
        });
    }

    /* --- Phase 63: Conflict-aware project upsert — wraps sbUpsert with version check.
           Returns { pushed: true } if successful, { conflict: true } if halted. --- */
    function sbUpsertProject(record) {
        return _checkProjectConflict('projects', record).then(function (safe) {
            if (!safe) return { conflict: true };
            return sbUpsert('projects', record).then(function () { return { pushed: true }; });
        });
    }

    /* --- Delete a record by id --- */
    function sbDelete(table, id) {
        return fetchWithRetry(getBaseUrl(table) + '?id=eq.' + encodeURIComponent(id), {
            method: 'DELETE',
            headers: getHeaders()
        }).then(function (res) {
            if (!res.ok) throw new Error('Supabase delete failed for ' + table + ': ' + res.statusText);
        });
    }

    /* --- 2. STORE-TO-TABLE MAPPING --- */

    /* --- Returns all records from a given IndexedDB store using specific storage methods --- */
    function getLocalRecords(storeName) {
        var s = window.mBTStorage || (window.mBT && window.mBT.storage);
        if (!s) return Promise.resolve([]);
        switch (storeName) {
            case 'mbt_projects':   return s.getAllProjects();
            case 'mbt_stages':     return s.getAllStages();
            case 'mbt_executions':
                return s.getAllProjects().then(function (projects) {
                    var reads = (projects || []).map(function (p) {
                        return s.getExecutionsByProject(p.id).catch(function () { return []; });
                    });
                    return Promise.all(reads).then(function (groups) {
                        var all = [];
                        for (var i = 0; i < groups.length; i++) all = all.concat(groups[i] || []);
                        return all;
                    });
                });
            case 'og_ref':         return s.getAllOGItems();
            case 'contacts':
                return s.getDb().then(function (db) {
                    return new Promise(function (resolve, reject) {
                        var store = db.transaction('contacts', 'readonly').objectStore('contacts');
                        var req = store.getAll();
                        req.onsuccess = function () { resolve(req.result || []); };
                        req.onerror   = function () { reject(req.error); };
                    });
                });
            case 'sessions':
                return s.getDb().then(function (db) {
                    return new Promise(function (resolve, reject) {
                        var store = db.transaction('sessions', 'readonly').objectStore('sessions');
                        var req = store.getAll();
                        req.onsuccess = function () { resolve(req.result || []); };
                        req.onerror   = function () { reject(req.error); };
                    });
                });
            default: return Promise.resolve([]);
        }
    }

    /* --- Delete a local record by storeName and id (used during pull soft-delete propagation).
           skipTombstone=true prevents re-tombstoning a record that was already deleted remotely. --- */
    function deleteLocalRecord(storeName, id) {
        var s = window.mBTStorage || (window.mBT && window.mBT.storage);
        if (!s) return Promise.resolve();
        switch (storeName) {
            case 'mbt_projects':   return s.deleteProject(id, true);
            case 'mbt_stages':     return s.deleteStage(id, true);
            case 'mbt_executions': return s.deleteExecution(id, true);
            case 'og_ref':         return s.deleteOGItem(id);
            case 'contacts':
            case 'sessions':
                return s._getDb().then(function (db) {
                    return new Promise(function (resolve, reject) {
                        var store = db.transaction([storeName], 'readwrite').objectStore(storeName);
                        var req = store.delete(id);
                        req.onsuccess = function () { resolve(); };
                        req.onerror   = function () { reject(req.error); };
                    });
                });
        }
        return Promise.resolve();
    }

    /* --- Write a pulled Supabase record into IndexedDB (additive — skips existing ids) --- */
    function writeLocalRecord(storeName, record) {
        var s = window.mBTStorage || (window.mBT && window.mBT.storage);
        if (!s) return Promise.resolve();
        switch (storeName) {
            case 'mbt_projects':   return s.updateProject(record);
            case 'mbt_stages':     return s.updateStage(record);
            case 'mbt_executions': return s.updateExecution(record);
            case 'og_ref':         return s.updateOGItem(record);
            case 'contacts':
            case 'sessions':
                return s.getDb().then(function (db) {
                    return new Promise(function (resolve, reject) {
                        var store = db.transaction([storeName], 'readwrite').objectStore(storeName);
                        var req = store.put(record);
                        req.onsuccess = function () { resolve(); };
                        req.onerror   = function () { reject(req.error); };
                    });
                });
        }
        return Promise.resolve();
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

    /* --- Push a single store's records sequentially; returns a promise that resolves
           to { synced, errors, pushedProjectIds } accumulated from this store. --- */
    function _pushStore(storeName, tableName, remoteNames, pushedProjectIds) {
        return getLocalRecords(storeName).then(function (records) {
            records = records || [];
            var synced = 0;
            var errors = 0;
            var chain = Promise.resolve();
            records.forEach(function (record) {
                chain = chain.then(function () {
                    var payload = record;
                    var renamePromise = Promise.resolve();

                    /* Phase 51: Name conflict resolution */
                    if (storeName === 'mbt_projects' && remoteNames && payload.name) {
                        var lname = String(payload.name).toLowerCase();
                        if (remoteNames[lname] && remoteNames[lname] !== payload.id) {
                            payload.name = payload.name + ' (Offline Sync)';
                            renamePromise = writeLocalRecord(storeName, payload);
                        }
                    }

                    return renamePromise.then(function () {
                        /* Phase 46 Security: Privacy filter via centralized config */
                        if (window.mBTSupabaseConfig && mBTSupabaseConfig.SYNC && mBTSupabaseConfig.SYNC.applyPrivacyFilter) {
                            payload = mBTSupabaseConfig.SYNC.applyPrivacyFilter(storeName, payload);
                        }
                        return sbUpsert(tableName, payload);
                    }).then(function () {
                        synced++;
                        if (storeName === 'mbt_projects' && payload.id) {
                            pushedProjectIds[payload.id] = true;
                        }
                    }).catch(function (e) {
                        console.error('[mBTSync] Upsert error ' + tableName + ':', e);
                        errors++;
                    });
                });
            });
            return chain.then(function () { return { synced: synced, errors: errors }; });
        }).catch(function (e) {
            console.error('[mBTSync] getLocalRecords error ' + storeName + ':', e);
            return { synced: 0, errors: 1 };
        });
    }

    /* --- Push all local IndexedDB data to Supabase --- */
    function syncPushAll() {
        if (_isSyncing) return Promise.resolve({ synced: 0, errors: 0, reason: 'sync_in_progress' });
        if (!window.mBTSupabaseConfig || !window.mBTSupabaseConfig.isConfigured()) {
            return Promise.resolve({ synced: 0, errors: 0, reason: 'not_configured' });
        }
        _isSyncing = true;
        _dispatchSyncStatus('syncing');

        var schema = window.mBTSupabaseSchema || {};
        var storeNames = Object.keys(schema);
        var totalSynced = 0;
        var totalErrors = 0;
        var pushedProjectIds = {};
        var conflicts = [];
        var haltedByConflict = false;

        /* --- Step A: sequentially push each IndexedDB store, with project pre-fetch for collision check --- */
        var chain = Promise.resolve();
        storeNames.forEach(function (storeName) {
            var tableName = schema[storeName];
            chain = chain.then(function () {
                if (storeName !== 'mbt_projects') {
                    return _pushStore(storeName, tableName, null, pushedProjectIds);
                }
                /* Phase 51: Fetch remote projects to handle offline name collisions before push */
                return sbFetchAll(tableName).then(function (remoteProj) {
                    var remoteNames = {};
                    (remoteProj || []).forEach(function (r) {
                        if (r.data && r.data.name) remoteNames[r.data.name.toLowerCase()] = r.id;
                    });
                    return _pushStore(storeName, tableName, remoteNames, pushedProjectIds);
                }).catch(function (e) {
                    console.warn('[mBTSync] Could not pre-fetch remote projects for collision check', e);
                    return _pushStore(storeName, tableName, null, pushedProjectIds);
                });
            }).then(function (tally) {
                totalSynced += tally.synced;
                totalErrors += tally.errors;
            });
        });

        /* --- Step B: Monolith Budget Push (Sub-Phase 51.1 Group B) --- */
        chain = chain.then(function () {
            if (typeof localforage === 'undefined') return null;
            return localforage.keys();
        }).then(function (lfKeys) {
            lfKeys = lfKeys || [];
            var budgetPrefix = 'prodBudget_v5_';
            var excludeSuffixes = ['trash', 'globalItems', 'templates', 'currency', 'rates',
                'lastLoaded', 'ApiKey', 'selectedAiProvider', 'dateFormat',
                'projectNameSeparator', 'projectStorageProtocol', 'aiSystemPrompt'];
            var userId = localStorage.getItem('mbt_supabase_user_id') || '';
            var monolithChain = Promise.resolve();

            lfKeys.forEach(function (lfKey) {
                if (lfKey.indexOf(budgetPrefix) !== 0) return;
                var skipKey = false;
                for (var ex = 0; ex < excludeSuffixes.length; ex++) {
                    if (lfKey.indexOf(excludeSuffixes[ex]) !== -1) { skipKey = true; break; }
                }
                if (skipKey) return;

                monolithChain = monolithChain.then(function () {
                    if (haltedByConflict) return;
                    return localforage.getItem(lfKey).then(function (budgetData) {
                        if (!budgetData) return;
                        var budgetId = budgetData.id || budgetData.projectName || lfKey.replace(budgetPrefix, '');
                        if (pushedProjectIds[budgetId]) return;

                        var cleanBudget = _stripBase64Attachments(budgetData);
                        var monolithPayload = {
                            id: budgetId,
                            user_id: userId,
                            data: cleanBudget,
                            updated_at: cleanBudget.updated_at || new Date().toISOString(),
                            version_hash: _generateVersionHash({ id: budgetId, updated_at: cleanBudget.updated_at, data: cleanBudget })
                        };
                        /* Phase 68A: Role-aware push — Editors route to approval queue; admins push to master DB */
                        var currentRole = localStorage.getItem('mbt_rbac_role') || 'admin';

                        if (currentRole === 'editor') {
                            var displayName = localStorage.getItem('mbt_profile_display_name') || 'Editor';
                            var recentDiffs = [];
                            try {
                                var logEntries = (budgetData.activityLog || []).slice(-50);
                                recentDiffs = logEntries.filter(function (e) { return e.diff; });
                            } catch (diffErr) { /* non-fatal */ }

                            var pendingPayload = {
                                project_id:      budgetId,
                                user_id:         userId,
                                requested_by:    displayName,
                                status:          'pending',
                                budget_snapshot: cleanBudget,
                                diff_log:        recentDiffs,
                                message:         ''
                            };
                            return sbInsertPendingEdit(pendingPayload).then(function () {
                                window.dispatchEvent(new CustomEvent('mbt:pending-edit-submitted', { detail: { projectId: budgetId } }));
                                console.log('[mBTSync] Editor save routed to approval queue for project:', budgetId);
                                totalSynced++;
                                pushedProjectIds[budgetId] = true;
                            }).catch(function (pendingErr) {
                                /* Graceful degrade: if pending insert fails, fall through to normal push */
                                console.error('[mBTSync] Pending queue insert failed, falling back to direct push:', pendingErr);
                                return sbUpsertProject(monolithPayload).then(function (fallbackResult) {
                                    if (fallbackResult.conflict) {
                                        haltedByConflict = true;
                                        return;
                                    }
                                    totalSynced++;
                                    pushedProjectIds[budgetId] = true;
                                });
                            });
                        }

                        /* Admin/owner: Phase 63 conflict-aware push to master DB */
                        return sbUpsertProject(monolithPayload).then(function (pushResult) {
                            if (pushResult.conflict) {
                                haltedByConflict = true;
                                return;
                            }
                            totalSynced++;
                            pushedProjectIds[budgetId] = true;
                        });
                    }).catch(function (e) {
                        console.error('[mBTSync] Monolith push error for ' + lfKey + ':', e);
                        totalErrors++;
                    });
                });
            });

            return monolithChain;
        }).catch(function (e) {
            console.error('[mBTSync] Monolith enumeration error:', e);
        });

        /* --- Step C: Tombstone push — propagate local deletions to Supabase --- */
        chain = chain.then(function () {
            if (haltedByConflict) return;
            var s = window.mBTStorage || (window.mBT && window.mBT.storage);
            if (!s || typeof s.getAllTombstones !== 'function') return;
            return s.getAllTombstones().then(function (tombstones) {
                tombstones = tombstones || [];
                if (!tombstones.length) return;
                var storeToTable = window.mBTSupabaseSchema || {};
                var tombUserId = localStorage.getItem('mbt_supabase_user_id') || '';
                var tombChain = Promise.resolve();
                tombstones.forEach(function (tomb) {
                    var targetTable = storeToTable[tomb.store];
                    if (!targetTable) return;
                    tombChain = tombChain.then(function () {
                        return sbUpsert(targetTable, {
                            id: tomb.id,
                            user_id: tombUserId,
                            deleted_at: tomb.deleted_at,
                            updated_at: tomb.deleted_at
                        }).then(function () {
                            totalSynced++;
                            conflicts.push('Deleted remote ' + tomb.store + ' id ' + tomb.id);
                        }).catch(function (e) {
                            console.error('[mBTSync] Tombstone push error for ' + tomb.store + '/' + tomb.id + ':', e);
                            totalErrors++;
                        });
                    });
                });
                return tombChain.then(function () {
                    /* Clear tombstones only after all have been pushed successfully enough */
                    return s.clearTombstones();
                });
            });
        }).catch(function (e) {
            console.error('[mBTSync] Tombstone propagation error:', e);
        });

        /* --- Step D: Finalize — stamp LAST_SYNC, push preferences, return result --- */
        return chain.then(function () {
            if (haltedByConflict) {
                _isSyncing = false;
                return { synced: totalSynced, errors: totalErrors, conflicts: conflicts, haltedByConflict: true };
            }
            var storage = window.mBTStorage || (window.mBT && window.mBT.storage);
            var syncKey = window.mBTSupabaseConfig && window.mBTSupabaseConfig.SYNC && window.mBTSupabaseConfig.SYNC.LAST_SYNC_KEY;
            var stamp = (storage && syncKey) ? storage.setItem(syncKey, Date.now()) : Promise.resolve();
            return stamp.then(function () {
                return pushPreferences().catch(function (e) { console.warn('[mBTSync] Preferences push failed:', e); });
            }).then(function () {
                var result = { synced: totalSynced, errors: totalErrors, conflicts: conflicts };
                _dispatchSyncStatus(totalErrors > 0 ? 'error' : 'saved');
                _isSyncing = false;
                return result;
            });
        }).catch(function (e) {
            _isSyncing = false;
            _dispatchSyncStatus('error');
            throw e;
        });
    }

    /* --- Pull Supabase data into IndexedDB (additive — does not overwrite newer local records) --- */
    function syncPullAll() {
        if (_isSyncing) return Promise.resolve({ pulled: 0, errors: 0, reason: 'sync_in_progress' });
        if (!window.mBTSupabaseConfig || !window.mBTSupabaseConfig.isConfigured()) {
            return Promise.resolve({ pulled: 0, errors: 0, reason: 'not_configured' });
        }
        _isSyncing = true;
        _dispatchSyncStatus('syncing');

        var schema = window.mBTSupabaseSchema || {};
        var storeNames = Object.keys(schema);
        var totalPulled = 0;
        var totalErrors = 0;
        var conflicts = [];

        var chain = Promise.resolve();
        storeNames.forEach(function (storeName) {
            var tableName = schema[storeName];
            chain = chain.then(function () {
                return Promise.all([sbFetchAll(tableName), getLocalRecords(storeName)]).then(function (results) {
                    var remoteRecords = results[0] || [];
                    var localRecords  = results[1] || [];
                    var localMap = {};
                    for (var r = 0; r < localRecords.length; r++) { localMap[localRecords[r].id] = localRecords[r]; }

                    var recordChain = Promise.resolve();
                    remoteRecords.forEach(function (remote) {
                        var local = localMap[remote.id];

                        /* Sub-Phase 51.1 Group C: Soft-delete propagation — remove local copy if remote was deleted */
                        if (remote.deleted_at) {
                            if (local) {
                                recordChain = recordChain.then(function () {
                                    return deleteLocalRecord(storeName, remote.id).then(function () {
                                        totalPulled++;
                                    }).catch(function (e) {
                                        console.error('[mBTSync] Pull delete error ' + storeName + ':', e);
                                        totalErrors++;
                                    });
                                });
                            }
                            return;
                        }

                        if (!local) {
                            recordChain = recordChain.then(function () {
                                return writeLocalRecord(storeName, remote).then(function () {
                                    totalPulled++;
                                }).catch(function (e) {
                                    console.error('[mBTSync] writeLocalRecord error ' + storeName + ':', e);
                                    totalErrors++;
                                });
                            });
                            return;
                        }

                        /* Conflict resolution via updated_at tracking */
                        var remoteTime = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
                        var localTime  = local.updated_at  ? new Date(local.updated_at).getTime()  : 0;
                        if (remoteTime <= localTime) return;

                        /* G14: Base64 Sync Loophole — restore stripped attachments from local before write */
                        if (storeName === 'mbt_projects' && remote.data && remote.data.fundingSources && local.data && local.data.fundingSources) {
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
                        recordChain = recordChain.then(function () {
                            return writeLocalRecord(storeName, remote).then(function () {
                                totalPulled++;
                                conflicts.push('Overwrote local ' + storeName + ' with newer cloud copy.');
                            }).catch(function (e) {
                                console.error('[mBTSync] writeLocalRecord overwrite error ' + storeName + ':', e);
                                totalErrors++;
                            });
                        });
                    });
                    return recordChain;
                }).catch(function (e) {
                    console.error('[mBTSync] Pull error ' + tableName + ':', e);
                    totalErrors++;
                });
            });
        });

        /* --- Sub-Phase 51.4: Monolith LocalForage Bridge ---
               Extrapolate pulled IndexedDB mbt_projects records back into
               the active localforage environment so the UI can physically mount them. */
        chain = chain.then(function () {
            return getLocalRecords('mbt_projects');
        }).then(function (lfBridgeRecords) {
            lfBridgeRecords = lfBridgeRecords || [];
            if (typeof localforage === 'undefined') return;
            var bridgeChain = Promise.resolve();
            lfBridgeRecords.forEach(function (br) {
                if (br && br.id && br.data) {
                    bridgeChain = bridgeChain.then(function () {
                        return localforage.setItem('prodBudget_v5_' + br.id, br.data);
                    });
                }
            });
            return bridgeChain;
        }).catch(function (e) {
            console.error('[mBTSync] Monolith localforage bridge error:', e);
        });

        return chain.then(function () {
            var storage = window.mBTStorage || (window.mBT && window.mBT.storage);
            var syncKey = window.mBTSupabaseConfig && window.mBTSupabaseConfig.SYNC && window.mBTSupabaseConfig.SYNC.LAST_SYNC_KEY;
            var stamp = (storage && syncKey) ? storage.setItem(syncKey, Date.now()) : Promise.resolve();
            return stamp.then(function () {
                return pullPreferences().catch(function (e) { console.warn('[mBTSync] Preferences pull failed:', e); });
            }).then(function () {
                var result = { pulled: totalPulled, errors: totalErrors, conflicts: conflicts };
                _dispatchSyncStatus(totalErrors > 0 ? 'error' : 'saved');
                _isSyncing = false;
                return result;
            });
        }).catch(function (e) {
            _isSyncing = false;
            _dispatchSyncStatus('error');
            throw e;
        });
    }

    /* --- 4. EXPORT / IMPORT --- */

    function exportAllData() {
        var storeNames = ['mbt_projects', 'mbt_stages', 'mbt_executions', 'og_ref', 'contacts', 'sessions'];
        var exportObj = {};
        var chain = Promise.resolve();
        storeNames.forEach(function (name) {
            chain = chain.then(function () {
                return getLocalRecords(name).then(function (rows) {
                    exportObj[name] = rows || [];
                });
            });
        });
        return chain.then(function () {
            exportObj.metadata = { exported_at: new Date().toISOString(), version: '2.0' };
            return JSON.stringify(exportObj, null, 2);
        });
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

    function pushPreferences() {
        if (!window.mBTSupabaseConfig || !window.mBTSupabaseConfig.isSignedIn()) return Promise.resolve();
        var prefs = {};
        for (var i = 0; i < SYNCABLE_PREFS.length; i++) {
            var val = localStorage.getItem(SYNCABLE_PREFS[i]);
            if (val !== null) prefs[SYNCABLE_PREFS[i]] = val;
        }
        if (window.mBTSync && typeof window.mBTSync._getBudgetSettings === 'function') {
            var bs = window.mBTSync._getBudgetSettings();
            if (bs) prefs._budgetSettings = bs;
        }
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        return sbUpsert('mbt_generic', {
            key: 'user_preferences',
            user_id: userId,
            value: prefs,
            updated_at: new Date().toISOString()
        });
    }

    function pullPreferences() {
        if (!window.mBTSupabaseConfig || !window.mBTSupabaseConfig.isSignedIn()) return Promise.resolve();
        return fetchWithRetry(
            getBaseUrl('mbt_generic') + '?key=eq.user_preferences&select=*',
            { method: 'GET', headers: getHeaders() }
        ).then(function (res) {
            if (!res.ok) return null;
            return res.json();
        }).then(function (rows) {
            if (!rows || !rows.length) return;
            var prefs = rows[0].value;
            if (!prefs || typeof prefs !== 'object') return;
            for (var i = 0; i < SYNCABLE_PREFS.length; i++) {
                var key = SYNCABLE_PREFS[i];
                if (prefs[key] !== undefined && prefs[key] !== null) {
                    localStorage.setItem(key, prefs[key]);
                }
            }
            if (prefs._budgetSettings && window.mBTSync && typeof window.mBTSync._setBudgetSettings === 'function') {
                window.mBTSync._setBudgetSettings(prefs._budgetSettings);
            }
        });
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
            _reconnectTimeout = setTimeout(function () {
                syncPushAll().catch(function (e) {
                    console.warn('[mBTSync] Auto-push on reconnect failed:', e);
                });
            }, 5000); /* 5s debounce to allow network to stabilize */
        }
    });

    /* Sub-Phase 50.2 Blind Spot: Periodic Token Refresh
       Active sessions should proactively refresh the token to avoid unexpected expiration. */
    setInterval(function () {
        if (localStorage.getItem('mbt_supabase_refresh_token')) {
            refreshAccessToken().catch(function (e) {
                console.warn('[mBTSync] Background token refresh failed', e);
            });
        }
    }, 45 * 60 * 1000); /* Runs every 45 minutes */

    /* --- 6. GLOBAL EXPOSURE --- */

    window.mBTSync = {
        pushAll:            syncPushAll,
        pullAll:            syncPullAll,
        exportData:         exportAllData,
        signIn:             signIn,
        signUp:             signUp,
        forgotPassword:     forgotPassword,
        updatePassword:     updatePassword,
        signInWithGoogle:   signInWithGoogle,
        signOut:            signOut,
        saveProfile:        saveProfile,
        fetchProfile:       fetchProfile,
        refreshAccessToken: refreshAccessToken,
        /* Phase 68B: PATCH status on a pending edit row */
        sbPatchPendingEdit: sbPatchPendingEdit,
        /* Phase 63: force-push a resolved project after diff merge, bypassing conflict check */
        forcePushProject:   function (projectId, data) {
            var userId = localStorage.getItem('mbt_supabase_user_id') || '';
            var payload = {
                id: projectId,
                user_id: userId,
                data: _stripBase64Attachments(data),
                updated_at: new Date().toISOString(),
                version_hash: _generateVersionHash({ id: projectId, updated_at: new Date().toISOString(), data: data })
            };
            return sbUpsert('projects', payload);
        },
        processAuthHash:   processAuthHash,
        scheduleAutoSync:  scheduleAutoSync,
        pushPreferences:   pushPreferences,
        pullPreferences:   pullPreferences,
        /* Hooks wired by index.html to bridge budget.settings across module boundary */
        _getBudgetSettings: null,
        _setBudgetSettings: null
    };

})();
