/* ========= mBT Collab Client — multiplayer membership + shared budget_data =========
   Uses window.mBTCollabConfig (mbt-collab project). Never touches personal-backup keys.
   Auth tokens: mbt_collab_auth_token / mbt_collab_refresh_token / mbt_collab_user_*     */
(function () {
    'use strict';

    var LS_TOKEN = 'mbt_collab_auth_token';
    var LS_REFRESH = 'mbt_collab_refresh_token';
    var LS_EMAIL = 'mbt_collab_user_email';
    var LS_USER_ID = 'mbt_collab_user_id';

    var _saveTimer = null;
    var _pendingProjectId = null;
    var _pendingBudgetData = null;
    var SAVE_DEBOUNCE_MS = 2500;

    function _cfg() {
        return window.mBTCollabConfig || null;
    }

    function _apiUrl() {
        var c = _cfg();
        return c ? c.API_URL : '';
    }

    function _anonKey() {
        var c = _cfg();
        return c ? c.ANON_KEY : '';
    }

    function _jwt() {
        /* Fallback read only: honor a regular cloud sign-in session for authenticated
           requests too, so bridged sessions from getSession() actually authenticate. */
        return localStorage.getItem(LS_TOKEN) || localStorage.getItem('mbt_supabase_auth_token') || '';
    }

    function getAuthHeaders() {
        var key = _anonKey();
        var jwt = _jwt();
        return {
            'apikey': key,
            'Authorization': 'Bearer ' + (jwt ? jwt : key),
            'Content-Type': 'application/json'
        };
    }

    function getRestHeaders() {
        var h = getAuthHeaders();
        h['Prefer'] = 'return=representation';
        return h;
    }

    function getAuthUrl(path) {
        return _apiUrl() + '/auth/v1' + path;
    }

    function getRestUrl(path) {
        return _apiUrl() + '/rest/v1' + path;
    }

    function _handleAuthResponse(data, email) {
        if (data.access_token) localStorage.setItem(LS_TOKEN, data.access_token);
        if (data.refresh_token) localStorage.setItem(LS_REFRESH, data.refresh_token);
        if (email) localStorage.setItem(LS_EMAIL, email);
        if (data.user) {
            if (data.user.email) localStorage.setItem(LS_EMAIL, data.user.email);
            if (data.user.id) localStorage.setItem(LS_USER_ID, data.user.id);
        }
    }

    function _parseErrorBody(data, fallback) {
        if (!data) return fallback || 'Request failed';
        if (typeof data === 'string') return data;
        /* PostgREST / Supabase RPC exceptions often land in message or error_description */
        if (data.message) return data.message;
        if (data.error_description) return data.error_description;
        if (data.error) return String(data.error);
        if (data.msg) return data.msg;
        return fallback || 'Request failed';
    }

    function _jsonOrThrow(res, fallbackMsg) {
        return res.json().then(function (data) {
            if (!res.ok) {
                throw new Error(_parseErrorBody(data, fallbackMsg || ('HTTP ' + res.status)));
            }
            return data;
        }).catch(function (e) {
            if (e && e.message && e.name === 'Error' && e.message.indexOf('HTTP') !== 0 &&
                e.message !== 'Unexpected end of JSON input') {
                throw e;
            }
            if (!res.ok) throw new Error(fallbackMsg || ('HTTP ' + res.status));
            throw e;
        });
    }

    /* --- Auth --- */

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
                console.warn('[mBTCollab] Auth error:', data.error_description || data.message);
                throw new Error(_parseErrorBody(data, 'Sign-in failed. Check your email and password.'));
            }
            _handleAuthResponse(data, email);
            return data;
        });
    }

    function signUp(email, password, displayName) {
        var resRef;
        var body = {
            email: email,
            password: password
        };
        if (displayName) {
            body.data = { display_name: displayName };
        }
        return fetch(getAuthUrl('/signup'), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        }).then(function (res) {
            resRef = res;
            return res.json();
        }).then(function (data) {
            if (!resRef.ok) {
                console.warn('[mBTCollab] Sign-up error:', data.message);
                throw new Error(_parseErrorBody(data, 'Sign-up failed.'));
            }
            if (data.access_token) {
                _handleAuthResponse(data, email);
            }
            return data;
        });
    }

    function signOut() {
        var jwt = _jwt();
        var logoutPromise = jwt
            ? fetch(getAuthUrl('/logout'), { method: 'POST', headers: getAuthHeaders() }).catch(function () { })
            : Promise.resolve();
        return logoutPromise.then(function () {
            localStorage.removeItem(LS_TOKEN);
            localStorage.removeItem(LS_REFRESH);
            localStorage.removeItem(LS_EMAIL);
            localStorage.removeItem(LS_USER_ID);
        });
    }

    function getSession() {
        var token = localStorage.getItem(LS_TOKEN) || '';
        var email = localStorage.getItem(LS_EMAIL) || '';
        var id = localStorage.getItem(LS_USER_ID) || '';
        /* Fallback read only (never write here): both configs point at the same mbt-collab
           project, so a session created via the regular cloud sign-in path is also valid here. */
        if (!token) {
            token = localStorage.getItem('mbt_supabase_auth_token') || '';
            email = localStorage.getItem('mbt_supabase_user_email') || '';
            id = localStorage.getItem('mbt_supabase_user_id') || '';
        }
        return token ? { token: token, email: email, id: id } : null;
    }

    function refreshAccessToken() {
        var refreshTok = localStorage.getItem(LS_REFRESH);
        if (!refreshTok) return Promise.reject(new Error('No collab refresh token'));
        return fetch(getAuthUrl('/token?grant_type=refresh_token'), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ refresh_token: refreshTok })
        }).then(function (res) {
            if (!res.ok) {
                signOut();
                throw new Error('Collab session expired. Please sign in again.');
            }
            return res.json();
        }).then(function (data) {
            _handleAuthResponse(data, null);
            return data;
        });
    }

    function requireSession() {
        if (!getSession()) {
            return Promise.reject(new Error('Not authenticated: sign in to mBT Collab first'));
        }
        return Promise.resolve(getSession());
    }

    /* --- Projects / invites --- */

    function createProject(name, budgetData) {
        return requireSession().then(function (session) {
            var payload = {
                owner_user_id: session.id,
                name: name || 'Shared Budget',
                budget_data: budgetData && typeof budgetData === 'object' ? budgetData : {}
            };
            return fetch(getRestUrl('/projects'), {
                method: 'POST',
                headers: getRestHeaders(),
                body: JSON.stringify(payload)
            }).then(function (res) {
                return _jsonOrThrow(res, 'Failed to create collab project');
            }).then(function (rows) {
                var row = Array.isArray(rows) ? rows[0] : rows;
                if (!row || !row.id) throw new Error('Create project returned no id');
                syncBudgetLines(row.id, budgetData).catch(function (le) {
                    console.warn('[mBTCollab] budget_lines sync after create failed:', le && le.message ? le.message : le);
                });
                return row;
            });
        });
    }

    function createInvite(projectId, roleToGrant) {
        return requireSession().then(function (session) {
            var role = roleToGrant === 'viewer' ? 'viewer' : 'editor';
            var payload = {
                project_id: projectId,
                created_by: session.id,
                role_to_grant: role
            };
            return fetch(getRestUrl('/project_invites'), {
                method: 'POST',
                headers: getRestHeaders(),
                body: JSON.stringify(payload)
            }).then(function (res) {
                return _jsonOrThrow(res, 'Failed to create invite');
            }).then(function (rows) {
                var row = Array.isArray(rows) ? rows[0] : rows;
                if (!row || !row.token) throw new Error('Create invite returned no token');
                return row;
            });
        });
    }

    function revokeInviteByToken(token) {
        if (!token) return Promise.resolve();
        return requireSession().then(function () {
            return fetch(getRestUrl('/project_invites?token=eq.' + encodeURIComponent(token)), {
                method: 'PATCH',
                headers: getRestHeaders(),
                body: JSON.stringify({ revoked: true })
            }).then(function (res) {
                if (!res.ok) {
                    return res.json().then(function (data) {
                        throw new Error(_parseErrorBody(data, 'Failed to revoke invite'));
                    });
                }
                return true;
            });
        });
    }

    function redeemInvite(token) {
        return requireSession().then(function () {
            return fetch(getRestUrl('/rpc/redeem_project_invite'), {
                method: 'POST',
                headers: getRestHeaders(),
                body: JSON.stringify({ invite_token: token })
            }).then(function (res) {
                return res.json().then(function (data) {
                    if (!res.ok) {
                        throw new Error(_parseErrorBody(data, 'Invite redeem failed'));
                    }
                    /* RPC returns uuid string or sometimes wrapped */
                    var projectId = data;
                    if (data && typeof data === 'object') {
                        projectId = data.project_id || data.id || data.redeem_project_invite || null;
                    }
                    if (!projectId || typeof projectId !== 'string') {
                        throw new Error('Redeem did not return a project id');
                    }
                    return projectId;
                });
            });
        });
    }

    function loadProject(projectId) {
        return requireSession().then(function () {
            var q = '/projects?id=eq.' + encodeURIComponent(projectId) +
                '&select=id,name,budget_data,updated_at,owner_user_id';
            return fetch(getRestUrl(q), {
                method: 'GET',
                headers: getRestHeaders()
            }).then(function (res) {
                return _jsonOrThrow(res, 'Failed to load collab project');
            }).then(function (rows) {
                if (!Array.isArray(rows) || rows.length === 0) {
                    throw new Error('Project not found or access denied');
                }
                return rows[0];
            });
        });
    }

    function _numOrNull(v) {
        if (v === undefined || v === null || v === '') return null;
        var n = parseFloat(v);
        return isFinite(n) ? n : null;
    }

    /* Flatten budget.sections[].items into budget_lines rows. Skip items with no id. */
    function extractBudgetLines(projectId, budgetData) {
        var rows = [];
        if (!projectId || !budgetData || !budgetData.sections) return rows;
        var currency = budgetData.displayCurrency || budgetData.currency || '';
        var sectionKeys = Object.keys(budgetData.sections);
        var si, items, ii, item, key, sec;
        for (si = 0; si < sectionKeys.length; si++) {
            sec = budgetData.sections[sectionKeys[si]];
            items = (sec && sec.items) ? sec.items : [];
            for (ii = 0; ii < items.length; ii++) {
                item = items[ii];
                if (!item) continue;
                key = item.id != null && item.id !== '' ? String(item.id) : '';
                if (!key) continue;
                rows.push({
                    project_id: projectId,
                    line_key: key,
                    section_key: String(sectionKeys[si] || ''),
                    description: String(item.description || item.name || ''),
                    unit: String(item.unit || ''),
                    rate: _numOrNull(item.rate),
                    quantity: _numOrNull(item.quantity),
                    actual_rate: _numOrNull(item.actualRate),
                    actual_quantity: _numOrNull(item.actualQuantity),
                    actual: _numOrNull(item.actual),
                    currency: String(item.currency || currency || ''),
                    contact_id: String(item.contactId || item.contact_id || '')
                });
            }
        }
        return rows;
    }

    function _quoteInList(values) {
        var out = [];
        var i, s;
        for (i = 0; i < values.length; i++) {
            s = String(values[i]).replace(/"/g, '');
            if (!s) continue;
            out.push('"' + s + '"');
        }
        return out.join(',');
    }

    /* After suitcase save: upsert current lines, delete keys no longer in the budget.
       Failures warn only. Suitcase remains source of truth. */
    function syncBudgetLines(projectId, budgetData) {
        if (!projectId) {
            return Promise.resolve({ upserted: 0, deleted: 0 });
        }
        var rows = extractBudgetLines(projectId, budgetData);
        var keep = {};
        var i;
        for (i = 0; i < rows.length; i++) keep[rows[i].line_key] = true;

        var upsert = Promise.resolve();
        if (rows.length) {
            var headers = getRestHeaders();
            headers['Prefer'] = 'resolution=merge-duplicates,return=minimal';
            upsert = fetch(
                getRestUrl('/budget_lines?on_conflict=project_id,line_key'),
                { method: 'POST', headers: headers, body: JSON.stringify(rows) }
            ).then(function (res) {
                if (!res.ok) {
                    return res.text().then(function (t) {
                        throw new Error(t || ('HTTP ' + res.status));
                    });
                }
            });
        }

        return upsert.then(function () {
            return fetch(
                getRestUrl('/budget_lines?project_id=eq.' + encodeURIComponent(projectId) + '&select=line_key'),
                { method: 'GET', headers: getRestHeaders() }
            ).then(function (res) {
                return _jsonOrThrow(res, 'Failed to list budget_lines');
            });
        }).then(function (existing) {
            var stale = [];
            var list = Array.isArray(existing) ? existing : [];
            var j, k;
            for (j = 0; j < list.length; j++) {
                k = list[j] && list[j].line_key;
                if (k && !keep[k]) stale.push(k);
            }
            if (!stale.length && rows.length) {
                return { upserted: rows.length, deleted: 0 };
            }
            var delQ = '/budget_lines?project_id=eq.' + encodeURIComponent(projectId);
            if (stale.length && rows.length) {
                delQ += '&line_key=in.(' + _quoteInList(stale) + ')';
            }
            /* No current lines: wipe the project's ledger rows. */
            return fetch(delQ, { method: 'DELETE', headers: getRestHeaders() }).then(function (res) {
                if (!res.ok) {
                    return res.text().then(function (t) {
                        throw new Error(t || ('HTTP ' + res.status));
                    });
                }
                return { upserted: rows.length, deleted: stale.length || list.length };
            });
        });
    }

    function saveProject(projectId, budgetData) {
        return requireSession().then(function () {
            var payload = {
                budget_data: budgetData && typeof budgetData === 'object' ? budgetData : {}
            };
            if (budgetData && budgetData.projectName) {
                payload.name = budgetData.projectName;
            }
            return fetch(getRestUrl('/projects?id=eq.' + encodeURIComponent(projectId)), {
                method: 'PATCH',
                headers: getRestHeaders(),
                body: JSON.stringify(payload)
            }).then(function (res) {
                return _jsonOrThrow(res, 'Failed to save collab project');
            }).then(function (rows) {
                /* Prefer: return=representation — empty array means 0 rows matched
                   (wrong id or RLS blocked UPDATE). Treat as hard failure so callers
                   do not silently think the shared budget was persisted. */
                var saved;
                if (Array.isArray(rows)) {
                    if (!rows.length) {
                        throw new Error('Collab save matched 0 rows (no write permission or wrong project id)');
                    }
                    saved = rows[0];
                } else {
                    saved = rows;
                }
                /* Fire-and-forget activity entry; never fail the save on log errors.
                   Requires project_activity migration on mbt-collab (not live until applied). */
                logActivity(projectId, 'save', 'Updated budget details').catch(function (ae) {
                    console.warn('[mBTCollab] logActivity after save failed:', ae && ae.message ? ae.message : ae);
                });
                syncBudgetLines(projectId, budgetData).catch(function (le) {
                    console.warn('[mBTCollab] budget_lines sync failed:', le && le.message ? le.message : le);
                });
                return saved;
            });
        });
    }

    /* Append one row to project_activity (self-attributed; writers only via RLS). */
    function logActivity(projectId, actionType, description) {
        return requireSession().then(function (session) {
            if (!projectId) {
                return Promise.reject(new Error('logActivity requires projectId'));
            }
            var payload = {
                project_id: projectId,
                user_id: session.id,
                action_type: actionType || 'save',
                description: description != null ? String(description) : ''
            };
            return fetch(getRestUrl('/project_activity'), {
                method: 'POST',
                headers: getRestHeaders(),
                body: JSON.stringify(payload)
            }).then(function (res) {
                return _jsonOrThrow(res, 'Failed to log activity');
            }).then(function (rows) {
                var row = Array.isArray(rows) ? rows[0] : rows;
                return row;
            });
        });
    }

    /* Latest activity for a project (default 20, newest first). Members via RLS. */
    function listActivity(projectId, limit) {
        return requireSession().then(function () {
            if (!projectId) {
                return Promise.reject(new Error('listActivity requires projectId'));
            }
            var lim = parseInt(limit, 10);
            if (!lim || lim < 1) lim = 20;
            if (lim > 100) lim = 100;
            var q = '/project_activity?project_id=eq.' + encodeURIComponent(projectId) +
                '&select=id,project_id,user_id,action_type,description,created_at' +
                '&order=created_at.desc&limit=' + lim;
            return fetch(getRestUrl(q), {
                method: 'GET',
                headers: getRestHeaders()
            }).then(function (res) {
                return _jsonOrThrow(res, 'Failed to list activity');
            }).then(function (rows) {
                return Array.isArray(rows) ? rows : [];
            });
        });
    }

    /* Snapshot live editor budget at fire time so debounced saves never ship a
       stale closure capture from an earlier mBT.data.save() call.
       window.budget is the top-level var budget binding (reassigned on every wrap). */
    function _liveBudgetSnapshot() {
        try {
            if (typeof window.budget !== 'undefined' && window.budget && typeof window.budget === 'object') {
                return JSON.parse(JSON.stringify(window.budget));
            }
        } catch (e) { /* fall through */ }
        return null;
    }

    function _flushScheduledSave() {
        var projectId = _pendingProjectId;
        var fallback = _pendingBudgetData;
        _pendingProjectId = null;
        _pendingBudgetData = null;
        _saveTimer = null;
        if (!projectId) return;

        /* Prefer live window.budget (current editor state). Fall back to the
           plain snapshot passed from the most recent mBT.data.save() call. */
        var live = _liveBudgetSnapshot();
        var data = live || fallback;
        if (!data || typeof data !== 'object') {
            console.warn('[mBTCollab] Debounced save skipped: no budget payload');
            return;
        }
        if (live && live.collab_project_id) {
            projectId = live.collab_project_id;
        } else if (data.collab_project_id) {
            projectId = data.collab_project_id;
        } else if (window._mBTActiveCollabProjectId) {
            projectId = window._mBTActiveCollabProjectId;
        }

        saveProject(projectId, data).catch(function (e) {
            console.warn('[mBTCollab] Debounced save failed:', e && e.message ? e.message : e);
        });
    }

    /* Debounced save for editor keystrokes. Local save still happens immediately
       in mBT.data.save; this only batches the shared backend PATCH.
       Always re-reads live window.budget at fire time (not the schedule-time
       object reference) so rapid edits never upload a stale snapshot. */
    function scheduleSaveProject(projectId, budgetData) {
        if (!projectId && budgetData && budgetData.collab_project_id) {
            projectId = budgetData.collab_project_id;
        }
        if (!projectId) {
            console.warn('[mBTCollab] scheduleSaveProject called without project id');
            return;
        }
        _pendingProjectId = projectId;
        /* Keep latest plain snapshot as fallback if live read fails at fire time */
        if (budgetData && typeof budgetData === 'object') {
            try {
                _pendingBudgetData = JSON.parse(JSON.stringify(budgetData));
            } catch (e) {
                _pendingBudgetData = budgetData;
            }
        }
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(_flushScheduledSave, SAVE_DEBOUNCE_MS);
    }

    function listMyProjects() {
        return requireSession().then(function () {
            return fetch(getRestUrl('/projects?select=id,name,updated_at,owner_user_id&order=updated_at.desc'), {
                method: 'GET',
                headers: getRestHeaders()
            }).then(function (res) {
                return _jsonOrThrow(res, 'Failed to list collab projects');
            }).then(function (rows) {
                return Array.isArray(rows) ? rows : [];
            });
        });
    }

    function getMemberRole(projectId) {
        return requireSession().then(function () {
            var uid = localStorage.getItem(LS_USER_ID) || '';
            var q = '/project_members?project_id=eq.' + encodeURIComponent(projectId) +
                '&user_id=eq.' + encodeURIComponent(uid) + '&select=role';
            return fetch(getRestUrl(q), {
                method: 'GET',
                headers: getRestHeaders()
            }).then(function (res) {
                return _jsonOrThrow(res, 'Failed to read member role');
            }).then(function (rows) {
                if (Array.isArray(rows) && rows[0] && rows[0].role) return rows[0].role;
                return null;
            });
        });
    }

    window.mBTCollab = {
        signIn: signIn,
        signUp: signUp,
        signOut: signOut,
        getSession: getSession,
        refreshAccessToken: refreshAccessToken,
        createProject: createProject,
        createInvite: createInvite,
        revokeInviteByToken: revokeInviteByToken,
        redeemInvite: redeemInvite,
        loadProject: loadProject,
        saveProject: saveProject,
        extractBudgetLines: extractBudgetLines,
        syncBudgetLines: syncBudgetLines,
        scheduleSaveProject: scheduleSaveProject,
        flushSaveProject: _flushScheduledSave,
        listMyProjects: listMyProjects,
        getMemberRole: getMemberRole,
        logActivity: logActivity,
        listActivity: listActivity
    };

    console.log('[mBT] Collab client initialized ✓');
})();
