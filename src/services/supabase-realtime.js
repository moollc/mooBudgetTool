/* ========= mBTRealtime — Supabase Realtime WebSocket Client v1.0 =========
   Implements the Phoenix WebSocket protocol over native browser WebSocket.
   No external dependencies — works fully offline when Supabase is unreachable.

   Public API (window.mBTRealtime):
     connect()                               — Open WebSocket connection
     disconnect()                            — Close connection and clear all state
     subscribeToProject(projectId)           — Join DB changes + Presence for a project
     unsubscribeFromProject(projectId)       — Leave channels for a project
     broadcastTypingLock(fieldId)            — Claim a field for editing (broadcast)
     broadcastTypingRelease(fieldId)         — Release a claimed field (broadcast)
     broadcastTypingStatus(fieldLabel)       — Non-exclusive "is editing" status broadcast
     broadcastTypingStatusRelease()          — Clear typing status broadcast
     broadcastActivity(type,section,field,detail) — Log an activity entry (broadcast + DB persist)
     isFieldLocked(fieldId)                  — True if another peer holds this field
     getLockedBy(fieldId)                    — Display name of lock holder (or null)
     getPresencePeers()                      — Array of connected peer objects
     isConnected()                           — True if WebSocket is open

   Events dispatched on window:
     mbt:realtime-connected            — WebSocket handshake succeeded
     mbt:realtime-disconnected         — Connection closed
     mbt:remote-project-update         — { record } — remote project changed
     mbt:presence-update               — { peers[] } — presence roster changed
     mbt:peer-typing                   — { fieldId, userId, displayName }
     mbt:peer-release                  — { fieldId }
     mbt:peer-typing-status            — { userId, displayName, fieldLabel, active }
     mbt:activity-log                  — { user_id, display_name, action_type, section, field, detail, created_at }
========= */

(function () {
    'use strict';

    /* --- Internal state --- */
    var _ws = null;     /* WebSocket instance */
    var _refCounter = 0;        /* Auto-incrementing Phoenix message ref */
    var _heartbeatTimer = null;     /* setInterval handle for 30s heartbeat */
    var _reconnectTimer = null;     /* setTimeout handle for reconnect backoff */
    var _reconnectDelay = 5000;     /* Reconnect delay ms — doubles on failure */
    var _channels = {};       /* Active channel map { key: { topic, joinRef } } */
    var _presenceState = {};       /* { userId: { user_id, display_name, .. } } */
    var _typingLocks = {};       /* { fieldId: { userId, displayName } } */
    var _activeProjectId = null;     /* projectId currently subscribed */
    var _connected = false;    /* WebSocket.OPEN state flag */
    var _intentionalClose = false;   /* Suppress auto-reconnect on manual disconnect */
    /* --- Phase 92: Typing status debounce/release timers --- */
    var _typingStatusDebounce = null; /* Outgoing broadcast debounce (300ms) */
    var _typingStatusRelease = null; /* Auto-release timer (2s idle) */
    var _lastTypingField = '';   /* fieldLabel captured at last broadcastTypingStatus call */
    /* --- Phase 92.9: Offline activity queue keys --- */
    var _ACTIVITY_QUEUE_KEY = 'activity_offline_queue';    /* IDB mbt_generic key for offline queue */
    var _SW_CONFIG_KEY = 'mbt_supabase_config_for_sw'; /* IDB key for SW credential cache */

    /* Write current Supabase credentials to IDB so the SW can drain the queue when the tab is closed */
    function _syncCredsToIdb() {
        var cfg = window.mBTSupabaseConfig;
        if (!cfg || !cfg.API_URL || typeof window.mBTStorage === 'undefined') return;
        var jwt = localStorage.getItem('mbt_supabase_auth_token') || '';
        if (!jwt) return;
        window.mBTStorage.setItem(_SW_CONFIG_KEY, {
            api_url: cfg.API_URL,
            anon_key: cfg.ANON_KEY || '',
            auth_token: jwt
        }).catch(function () { });
    }

    /* --- Phoenix protocol helpers --- */

    function _nextRef() {
        return String(++_refCounter);
    }

    /* Send a Phoenix-encoded message. Silently drops if socket isn't open. */
    function _send(msg) {
        if (_ws && _ws.readyState === WebSocket.OPEN) {
            _ws.send(JSON.stringify(msg));
        }
    }

    /* --- Connection management --- */

    function _buildWsUrl() {
        var cfg = window.mBTSupabaseConfig;
        if (!cfg) return null;
        var base = cfg.API_URL || '';
        if (!base) return null;
        /* Convert https:// → wss:// */
        var wsBase = base.replace(/^https?:\/\//, function (m) {
            return m === 'https://' ? 'wss://' : 'ws://';
        });
        var apiKey = cfg.ANON_KEY || '';
        return wsBase + '/realtime/v1/websocket?apikey=' + encodeURIComponent(apiKey) + '&vsn=1.0.0';
    }

    function connect() {
        if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;
        var url = _buildWsUrl();
        if (!url) {
            console.warn('[mBTRealtime] Cannot connect: Supabase URL not configured');
            return;
        }
        _intentionalClose = false;

        try {
            _ws = new WebSocket(url);
        } catch (e) {
            console.warn('[mBTRealtime] WebSocket creation failed:', e);
            _scheduleReconnect();
            return;
        }

        _ws.onopen = function () {
            _connected = true;
            _reconnectDelay = 5000; /* Reset backoff on successful connect */
            console.log('[mBTRealtime] Connected to Supabase Realtime');
            _startHeartbeat();
            _syncCredsToIdb();
            window.dispatchEvent(new CustomEvent('mbt:realtime-connected'));
            /* Re-subscribe to active project if we had one before reconnect */
            if (_activeProjectId) {
                subscribeToProject(_activeProjectId);
            }
        };

        _ws.onmessage = function (evt) {
            try {
                var msg = JSON.parse(evt.data);
                _handleMessage(msg);
            } catch (e) {
                console.warn('[mBTRealtime] Message parse error:', e);
            }
        };

        _ws.onclose = function () {
            _connected = false;
            _stopHeartbeat();
            window.dispatchEvent(new CustomEvent('mbt:realtime-disconnected'));
            if (!_intentionalClose) {
                console.log('[mBTRealtime] Disconnected — scheduling reconnect in', _reconnectDelay, 'ms');
                _scheduleReconnect();
            }
        };

        _ws.onerror = function (e) {
            /* onerror is always followed by onclose — reconnect handled there */
            console.warn('[mBTRealtime] WebSocket error — will attempt reconnect');
        };
    }

    function disconnect() {
        _intentionalClose = true;
        if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
        if (_typingStatusDebounce) { clearTimeout(_typingStatusDebounce); _typingStatusDebounce = null; }
        if (_typingStatusRelease) { clearTimeout(_typingStatusRelease); _typingStatusRelease = null; }
        _stopHeartbeat();
        _channels = {};
        _presenceState = {};
        _typingLocks = {};
        _activeProjectId = null;
        _lastTypingField = '';
        _connected = false;
        if (_ws) {
            _ws.onclose = null; /* Prevent reconnect from manual disconnect */
            _ws.close();
            _ws = null;
        }
        _dispatchPresenceUpdate();
    }

    function _scheduleReconnect() {
        if (_reconnectTimer) clearTimeout(_reconnectTimer);
        /* Only reconnect when user is still signed in */
        _reconnectTimer = setTimeout(function () {
            if (!_intentionalClose && localStorage.getItem('mbt_supabase_auth_token')) {
                _reconnectDelay = Math.min(_reconnectDelay * 2, 60000); /* Exponential backoff up to 60s */
                connect();
            }
        }, _reconnectDelay);
    }

    /* --- Heartbeat (Phoenix requires this to keep the connection alive) --- */

    function _startHeartbeat() {
        _stopHeartbeat();
        _heartbeatTimer = setInterval(function () {
            _send([null, _nextRef(), 'phoenix', 'heartbeat', {}]);
        }, 30000);
    }

    function _stopHeartbeat() {
        if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
    }

    /* --- Message handling --- */

    /* Phoenix message format: [join_ref, ref, topic, event, payload] */
    function _handleMessage(msg) {
        if (!Array.isArray(msg) || msg.length < 5) return;
        var topic = msg[2];
        var event = msg[3];
        var payload = msg[4];

        switch (event) {
            case 'phx_reply':
                _handleJoinReply(topic, payload);
                break;
            case 'phx_error':
                console.warn('[mBTRealtime] Channel error on', topic, payload);
                break;
            case 'postgres_changes':
                _handlePostgresChange(payload);
                break;
            case 'presence_state':
                _handlePresenceState(topic, payload);
                break;
            case 'presence_diff':
                _handlePresenceDiff(topic, payload);
                break;
            case 'broadcast':
                _handleBroadcast(topic, payload);
                break;
            /* heartbeat replies are implicitly handled — no action needed */
        }
    }

    function _handleJoinReply(topic, payload) {
        if (payload && payload.status === 'ok') {
            console.log('[mBTRealtime] Joined channel:', topic);
        } else if (payload && payload.status === 'error') {
            console.warn('[mBTRealtime] Failed to join channel:', topic, payload.response);
        }
    }

    /* --- Sub-Phase 51.2 Task 3: Live Postgres Sync --- */
    function _handlePostgresChange(payload) {
        if (!payload || !payload.data) return;
        var record = payload.data.record;
        if (!record) return;
        /* Do NOT process our own echoed changes to avoid reconcile loops */
        var myUserId = localStorage.getItem('mbt_supabase_user_id') || '';
        if (record.user_id && record.user_id === myUserId) return;
        window.dispatchEvent(new CustomEvent('mbt:remote-project-update', {
            detail: { record: record }
        }));
    }

    /* --- Sub-Phase 51.2 Task 2: Presence --- */
    function _handlePresenceState(topic, payload) {
        /* Full presence roster sent on join */
        _presenceState = {};
        if (payload && typeof payload === 'object') {
            for (var key in payload) {
                var entry = payload[key];
                /* Supabase Realtime v2: presence entries are { metas: [..] } */
                var metas = (entry && entry.metas) ? entry.metas : (Array.isArray(entry) ? entry : [entry]);
                if (metas.length) _presenceState[key] = metas[0];
            }
        }
        _dispatchPresenceUpdate();
    }

    function _handlePresenceDiff(topic, payload) {
        if (!payload) return;
        /* Add joiners */
        if (payload.joins) {
            for (var joinKey in payload.joins) {
                var joinEntry = payload.joins[joinKey];
                var joinMetas = (joinEntry && joinEntry.metas) ? joinEntry.metas : [joinEntry];
                _presenceState[joinKey] = joinMetas[0] || {};
            }
        }
        /* Remove leavers and release their typing locks */
        if (payload.leaves) {
            for (var leaveKey in payload.leaves) {
                _releaseAllLocksForUser(leaveKey);
                delete _presenceState[leaveKey];
            }
        }
        _dispatchPresenceUpdate();
    }

    function _dispatchPresenceUpdate() {
        var peers = [];
        for (var key in _presenceState) { peers.push(_presenceState[key]); }
        window.dispatchEvent(new CustomEvent('mbt:presence-update', {
            detail: { peers: peers }
        }));
    }

    /* --- Sub-Phase 51.2 Task 4: Typing Locks via Broadcast --- */
    function _handleBroadcast(topic, payload) {
        if (!payload) return;
        var event = payload.event;
        var data = payload.payload;
        if (!data) return;

        if (event === 'typing_lock') {
            var myId = localStorage.getItem('mbt_supabase_user_id') || '';
            if (data.user_id === myId) return; /* Ignore our own lock broadcasts */
            _typingLocks[data.field_id] = { userId: data.user_id, displayName: data.display_name || 'Peer' };
            window.dispatchEvent(new CustomEvent('mbt:peer-typing', {
                detail: { fieldId: data.field_id, userId: data.user_id, displayName: data.display_name }
            }));
        } else if (event === 'typing_release') {
            delete _typingLocks[data.field_id];
            window.dispatchEvent(new CustomEvent('mbt:peer-release', {
                detail: { fieldId: data.field_id }
            }));

            /* --- Phase 62: RBAC — admin broadcasts a role change for a specific user --- */
        } else if (event === 'auth_changed') {
            var myUserId = localStorage.getItem('mbt_supabase_user_id') || '';
            /* Only act on messages addressed to this user */
            if (data.target_user_id && data.target_user_id === myUserId) {
                window.dispatchEvent(new CustomEvent('mbt:auth-changed', {
                    detail: { role: data.role || 'viewer', changed_by: data.changed_by || '' }
                }));
            }

            /* --- Phase 68B: Approval verdict — Owner approved or rejected an Editor's pending edit --- */
        } else if (event === 'approval_verdict') {
            var myVerdictId = localStorage.getItem('mbt_supabase_user_id') || '';
            if (data.target_user_id && data.target_user_id === myVerdictId) {
                window.dispatchEvent(new CustomEvent('mbt:approval-verdict', {
                    detail: { verdict: data.verdict || 'rejected', projectId: data.project_id || '' }
                }));
            }

            /* --- Phase 92: Activity log — peer broadcast a persisted activity entry --- */
        } else if (event === 'activity_log') {
            var myActId = localStorage.getItem('mbt_supabase_user_id') || '';
            /* Ignore own echoes — local dispatch already fired in broadcastActivity() */
            if (data.user_id && data.user_id === myActId) return;
            window.dispatchEvent(new CustomEvent('mbt:activity-log', { detail: data }));

            /* --- Phase 92: Typing status — non-exclusive "peer is editing" indicator --- */
        } else if (event === 'typing_status') {
            var myTsId = localStorage.getItem('mbt_supabase_user_id') || '';
            if (data.user_id && data.user_id === myTsId) return;
            window.dispatchEvent(new CustomEvent('mbt:peer-typing-status', {
                detail: {
                    userId: data.user_id || '',
                    displayName: data.display_name || 'Peer',
                    fieldLabel: data.field_label || '',
                    active: !!data.active
                }
            }));
        }
    }

    /* --- Sub-Phase 51.2 Task 6: Orphaned Lock Sweep --- */
    /* Called when a peer leaves presence — forcibly releases all their frozen rows */
    function _releaseAllLocksForUser(userId) {
        var released = [];
        for (var fieldId in _typingLocks) {
            if (_typingLocks[fieldId].userId === userId) {
                released.push(fieldId);
            }
        }
        for (var i = 0; i < released.length; i++) {
            delete _typingLocks[released[i]];
            window.dispatchEvent(new CustomEvent('mbt:peer-release', {
                detail: { fieldId: released[i] }
            }));
        }
    }

    /* --- Channel subscriptions --- */

    /* Subscribe to Postgres project updates and presence for a specific project. */
    function subscribeToProject(projectId) {
        if (!_connected) {
            /* Connect first — will auto-subscribe after connect via onopen handler */
            _activeProjectId = projectId;
            connect();
            return;
        }
        _activeProjectId = projectId;
        var jwt = localStorage.getItem('mbt_supabase_auth_token') || '';
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        var displayName = localStorage.getItem('mbt_profile_display_name') || 'Collaborator';

        /* --- DB Changes channel: subscribe to UPDATE events on public.projects table ---
           Sub-Phase 51.2 Task 9: Bind to JWT for RLS-level security so only rows
           the user owns (per RLS policy) will be delivered. */
        var dbTopic = 'realtime:public:projects';
        var dbJoinRef = _nextRef();
        _channels['db_projects'] = { topic: dbTopic, joinRef: dbJoinRef };
        _send([dbJoinRef, dbJoinRef, dbTopic, 'phx_join', {
            config: {
                broadcast: { self: false },
                presence: { key: '' },
                postgres_changes: [{ event: 'UPDATE', schema: 'public', table: 'projects' }]
            },
            access_token: jwt
        }]);

        /* --- Presence channel: one channel per project so collaborators on different
               projects don't bleed into each other's presence bars. --- */
        var presenceTopic = 'realtime:presence:budget:' + projectId;
        var presJoinRef = _nextRef();
        _channels['presence_' + projectId] = { topic: presenceTopic, joinRef: presJoinRef };
        _send([presJoinRef, presJoinRef, presenceTopic, 'phx_join', {
            config: { presence: { key: userId } },
            access_token: jwt
        }]);

        /* Track own presence payload (sent 600ms after join to ensure server processes phx_join first) */
        setTimeout(function () {
            if (!_connected || _activeProjectId !== projectId) return;
            _send([null, _nextRef(), presenceTopic, 'presence', {
                event: 'track',
                payload: {
                    user_id: userId,
                    display_name: displayName,
                    project_id: projectId,
                    joined_at: new Date().toISOString()
                }
            }]);
        }, 600);
    }

    function unsubscribeFromProject(projectId) {
        /* Leave DB changes channel */
        if (_channels['db_projects']) {
            var ch = _channels['db_projects'];
            _send([ch.joinRef, _nextRef(), ch.topic, 'phx_leave', {}]);
            delete _channels['db_projects'];
        }
        /* Leave Presence channel */
        var presKey = 'presence_' + projectId;
        if (_channels[presKey]) {
            var pch = _channels[presKey];
            _send([pch.joinRef, _nextRef(), pch.topic, 'phx_leave', {}]);
            delete _channels[presKey];
        }
        /* Clear state for this project */
        _presenceState = {};
        _typingLocks = {};
        _activeProjectId = null;
        _lastTypingField = '';
        if (_typingStatusDebounce) { clearTimeout(_typingStatusDebounce); _typingStatusDebounce = null; }
        if (_typingStatusRelease) { clearTimeout(_typingStatusRelease); _typingStatusRelease = null; }
        _dispatchPresenceUpdate();
    }

    /* --- Sub-Phase 51.2 Task 4: Typing Lock Broadcasts --- */

    function broadcastTypingLock(fieldId) {
        if (!_activeProjectId || !_connected) return;
        var presenceTopic = 'realtime:presence:budget:' + _activeProjectId;
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        var displayName = localStorage.getItem('mbt_profile_display_name') || 'Collaborator';
        _send([null, _nextRef(), presenceTopic, 'broadcast', {
            event: 'typing_lock',
            payload: { field_id: fieldId, user_id: userId, display_name: displayName }
        }]);
    }

    function broadcastTypingRelease(fieldId) {
        if (!_activeProjectId || !_connected) return;
        var presenceTopic = 'realtime:presence:budget:' + _activeProjectId;
        _send([null, _nextRef(), presenceTopic, 'broadcast', {
            event: 'typing_release',
            payload: { field_id: fieldId }
        }]);
    }

    /* --- Phase 62: RBAC — Admin sends a role change to a specific peer --- */

    function broadcastRoleChange(targetUserId, newRole) {
        if (!_activeProjectId || !_connected) return;
        var presenceTopic = 'realtime:presence:budget:' + _activeProjectId;
        var myUserId = localStorage.getItem('mbt_supabase_user_id') || '';
        var displayName = localStorage.getItem('mbt_profile_display_name') || 'Admin';
        _send([null, _nextRef(), presenceTopic, 'broadcast', {
            event: 'auth_changed',
            payload: {
                target_user_id: targetUserId,
                role: newRole,
                changed_by: displayName,
                changed_by_id: myUserId
            }
        }]);
    }

    /* --- Phase 68B: Notify Editor that their pending edit was approved or rejected --- */

    function broadcastApproval(targetUserId, projectId, verdict) {
        if (!_activeProjectId || !_connected) return;
        var presenceTopic = 'realtime:presence:budget:' + _activeProjectId;
        var myUserId = localStorage.getItem('mbt_supabase_user_id') || '';
        _send([null, _nextRef(), presenceTopic, 'broadcast', {
            event: 'approval_verdict',
            payload: {
                target_user_id: targetUserId,
                project_id: projectId,
                verdict: verdict,
                decided_by: myUserId
            }
        }]);
    }

    /* --- Phase 50C.8: Tool Focus Broadcast --- */

    function broadcastFocus(toolName) {
        if (!_activeProjectId || !_connected) return;
        var presenceTopic = 'realtime:presence:budget:' + _activeProjectId;
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        var displayName = localStorage.getItem('mbt_profile_display_name') || 'Collaborator';
        _send([null, _nextRef(), presenceTopic, 'broadcast', {
            event: 'tool_focus',
            payload: { tool: toolName, user_id: userId, display_name: displayName }
        }]);
    }

    /* --- Phase 92: Typing Status Broadcasts (non-exclusive, for toast display) --- */

    /* Internal: send a typing_status broadcast with active flag */
    function _sendTypingStatus(fieldLabel, active) {
        if (!_activeProjectId || !_connected) return;
        var presenceTopic = 'realtime:presence:budget:' + _activeProjectId;
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        var displayName = localStorage.getItem('mbt_profile_display_name') || 'Collaborator';
        _send([null, _nextRef(), presenceTopic, 'broadcast', {
            event: 'typing_status',
            payload: { user_id: userId, display_name: displayName, field_label: fieldLabel, active: active }
        }]);
    }

    /* Called on input focusin — debounced 300ms, auto-releases after 2s idle */
    function broadcastTypingStatus(fieldLabel) {
        _lastTypingField = fieldLabel;
        /* Cancel any pending auto-release timer while user is still active */
        if (_typingStatusRelease) { clearTimeout(_typingStatusRelease); _typingStatusRelease = null; }
        /* Debounce outgoing broadcast to avoid flooding on rapid keystrokes */
        if (_typingStatusDebounce) { clearTimeout(_typingStatusDebounce); }
        _typingStatusDebounce = setTimeout(function () {
            _typingStatusDebounce = null;
            _sendTypingStatus(_lastTypingField, true);
            /* Auto-release 2s after the debounced send fires with no further activity */
            _typingStatusRelease = setTimeout(function () {
                _typingStatusRelease = null;
                _sendTypingStatus(_lastTypingField, false);
            }, 2000);
        }, 300);
    }

    /* Called on input focusout — immediately broadcasts inactive and clears timers */
    function broadcastTypingStatusRelease() {
        if (_typingStatusDebounce) { clearTimeout(_typingStatusDebounce); _typingStatusDebounce = null; }
        if (_typingStatusRelease) { clearTimeout(_typingStatusRelease); _typingStatusRelease = null; }
        _sendTypingStatus(_lastTypingField, false);
        _lastTypingField = '';
    }

    /* --- Phase 92.9: Offline activity queue --- */

    /* Append one entry to the IDB offline queue (capped at 200 entries) */
    function _enqueueActivity(entry) {
        if (typeof window.mBTStorage === 'undefined') return;
        window.mBTStorage.getItem(_ACTIVITY_QUEUE_KEY).then(function (existing) {
            var arr = Array.isArray(existing) ? existing : [];
            arr.push(entry);
            if (arr.length > 200) arr = arr.slice(-200);
            return window.mBTStorage.setItem(_ACTIVITY_QUEUE_KEY, arr);
        }).catch(function () { });
    }

    /* POST all queued entries to Supabase, clear queue on full success */
    function drainActivityQueue() {
        if (typeof window.mBTStorage === 'undefined') return;
        var cfg = window.mBTSupabaseConfig;
        if (!cfg || !cfg.API_URL) return;
        var jwt = localStorage.getItem('mbt_supabase_auth_token') || '';
        if (!jwt) return;
        window.mBTStorage.getItem(_ACTIVITY_QUEUE_KEY).then(function (arr) {
            if (!Array.isArray(arr) || !arr.length) return;
            var posts = arr.map(function (entry) {
                return fetch(cfg.API_URL + '/rest/v1/mbt_activity_log', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': cfg.ANON_KEY || '',
                        'Authorization': 'Bearer ' + jwt,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(entry)
                });
            });
            return Promise.all(posts).then(function () {
                return window.mBTStorage.removeItem(_ACTIVITY_QUEUE_KEY);
            });
        }).catch(function (e) {
            console.warn('[mBTRealtime] Activity queue drain failed:', e);
        });
    }

    /* On reconnect: drain page-level queue, then register SW Background Sync tag */
    window.addEventListener('online', function () {
        drainActivityQueue();
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(function (reg) {
                return reg.sync.register('mbt-activity-sync');
            }).catch(function () { });
        }
    });

    /* --- Phase 92: Activity Log Broadcast + DB Persist --- */

    /* Internal: POST an activity row to mbt_activity_log via Supabase REST (fire and forget) */
    function _persistActivity(payload) {
        var cfg = window.mBTSupabaseConfig;
        if (!cfg || !cfg.API_URL || !_activeProjectId) return;
        var jwt = localStorage.getItem('mbt_supabase_auth_token') || '';
        if (!jwt) return;
        var body = {
            project_id: _activeProjectId,
            user_id: payload.user_id,
            display_name: payload.display_name,
            action_type: payload.action_type,
            section: payload.section || '',
            field: payload.field || '',
            detail: payload.detail || '',
            created_at: payload.created_at || new Date().toISOString()
        };
        if (!navigator.onLine) {
            _enqueueActivity(body);
            return;
        }
        fetch(cfg.API_URL + '/rest/v1/mbt_activity_log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': cfg.ANON_KEY || '',
                'Authorization': 'Bearer ' + jwt,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(body)
        }).catch(function (e) {
            console.warn('[mBTRealtime] Activity log persist failed — queuing for replay:', e);
            _enqueueActivity(body);
        });
    }

    /* Broadcast an activity entry to peers, persist to DB, and dispatch locally.
       actionType: 'field_edit' | 'tool_open' | 'field_lock' | 'budget_save'
       section, field, detail: human-readable context strings */
    function broadcastActivity(actionType, section, field, detail) {
        var userId = localStorage.getItem('mbt_supabase_user_id') || '';
        var displayName = localStorage.getItem('mbt_profile_display_name') || 'Collaborator';
        var payload = {
            user_id: userId,
            display_name: displayName,
            action_type: actionType || 'field_edit',
            section: section || '',
            field: field || '',
            detail: detail || '',
            created_at: new Date().toISOString()
        };
        /* Broadcast to all peers on the presence channel */
        if (_activeProjectId && _connected) {
            var presenceTopic = 'realtime:presence:budget:' + _activeProjectId;
            _send([null, _nextRef(), presenceTopic, 'broadcast', {
                event: 'activity_log',
                payload: payload
            }]);
        }
        /* Persist to DB (non-blocking) */
        _persistActivity(payload);
        /* Dispatch locally so the sender's own feed updates immediately */
        window.dispatchEvent(new CustomEvent('mbt:activity-log', { detail: payload }));
    }

    /* --- Query helpers --- */

    function isFieldLocked(fieldId) {
        var lock = _typingLocks[fieldId];
        if (!lock) return false;
        var myId = localStorage.getItem('mbt_supabase_user_id') || '';
        return lock.userId !== myId;
    }

    function getLockedBy(fieldId) {
        var lock = _typingLocks[fieldId];
        if (!lock) return null;
        var myId = localStorage.getItem('mbt_supabase_user_id') || '';
        return lock.userId !== myId ? (lock.displayName || 'Peer') : null;
    }

    function getPresencePeers() {
        var myId = localStorage.getItem('mbt_supabase_user_id') || '';
        var peers = [];
        for (var key in _presenceState) {
            var p = _presenceState[key];
            if (p && p.user_id !== myId) peers.push(p);
        }
        return peers;
    }

    function isConnected() {
        return _connected;
    }

    /* --- Global exposure --- */
    window.mBTRealtime = {
        connect: connect,
        disconnect: disconnect,
        subscribeToProject: subscribeToProject,
        unsubscribeFromProject: unsubscribeFromProject,
        broadcastTypingLock: broadcastTypingLock,
        broadcastTypingRelease: broadcastTypingRelease,
        broadcastTypingStatus: broadcastTypingStatus,
        broadcastTypingStatusRelease: broadcastTypingStatusRelease,
        broadcastActivity: broadcastActivity,
        drainActivityQueue: drainActivityQueue,
        broadcastFocus: broadcastFocus,
        broadcastRoleChange: broadcastRoleChange,
        broadcastApproval: broadcastApproval,
        isFieldLocked: isFieldLocked,
        getLockedBy: getLockedBy,
        getPresencePeers: getPresencePeers,
        isConnected: isConnected
    };

})();
