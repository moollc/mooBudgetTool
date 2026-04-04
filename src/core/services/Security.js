/**
 * mBT Security Service — Session Management (Modular JS)
 */

(function () {
    'use strict';

    window.mBT = window.mBT || {};
    window.mBT.services = window.mBT.services || {};

    var Security = {
        getSession: function () {
            return window.mBT.storage.getDb().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction('sessions', 'readonly');
                    var store = tx.objectStore('sessions');
                    var request = store.get('current_session');
                    request.onsuccess = function () { resolve(request.result); };
                    request.onerror = function () { reject(request.error); };
                });
            });
        },

        render: function () {
            var list = document.getElementById('security-list');
            if (!list) return;

            this.getSession().then(function (session) {
                var name = session ? 'Session Active' : 'Local Mode';
                var desc = session ? 'User: ' + session.user : 'Offline persistence active via IndexedDB.';
                var status = 'secure';
                
                var item = document.createElement('div');
                item.className = 'service-item';
                
                var icon = document.createElement('div');
                icon.className = 'svc-icon';
                icon.style.cssText = 'background:var(--emerald-500); color:white';
                icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
                
                var info = document.createElement('div');
                info.className = 'svc-info';
                
                var nameEl = document.createElement('div');
                nameEl.className = 'svc-name';
                nameEl.textContent = name;
                
                var descEl = document.createElement('div');
                descEl.className = 'svc-desc';
                descEl.textContent = desc;
                
                info.appendChild(nameEl);
                info.appendChild(descEl);
                
                var statusEl = document.createElement('span');
                statusEl.className = 'svc-status ready';
                statusEl.textContent = status;
                
                item.appendChild(icon);
                item.appendChild(info);
                item.appendChild(statusEl);
                
                list.appendChild(item);
            });
        }
    };

    window.mBT.services.security = Security;

    if (window.mBT.core && window.mBT.core.routes) {
        window.mBT.core.routes.register('security', function () {
            Security.render();
        });
    }
})();

/* ========= Phase 93 / Phase 62: mBT.rbac — Budget Editor Role-Based Access Control =========
   Extracted from mBT/index.html. Exposed as window.mBT.rbac.
   The Budget Editor shims mBTRBAC = window.mBT.rbac for backward compat.
   Depends only on localStorage — no mBT.storage dependency.
   ========= */
(function () {
    'use strict';

    window.mBT = window.mBT || {};

    var ROLE_KEY = 'mbt_rbac_role';

    function getRole() {
        var token = localStorage.getItem('mbt_supabase_auth_token');
        var anon  = localStorage.getItem('mbt_supabase_anon_key');
        if (!token && !anon) return 'admin';
        return localStorage.getItem(ROLE_KEY) || 'admin';
    }

    function setRole(role) {
        localStorage.setItem(ROLE_KEY, role);
    }

    function applyViewOnlyLockdown() {
        document.body.setAttribute('data-rbac-role', 'viewer');
    }

    function liftLockdown() {
        document.body.setAttribute('data-rbac-role', getRole());
        var inputs = document.querySelectorAll(
            'input[data-field], select[data-field], ' +
            'input[data-action="stage-update"], input[data-section], select[data-section]'
        );
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].removeAttribute('disabled');
            inputs[i].removeAttribute('readonly');
            inputs[i].style.opacity = inputs[i].style.cursor = inputs[i].style.pointerEvents = '';
        }
        var actionBtns = document.querySelectorAll(
            '[data-action="row-delete"], [data-action="section-add"], [data-action="section-delete"], ' +
            '[data-action="section-rename"], [data-action="row-add"], .stage-remove-btn, [data-action="row-lock"]'
        );
        for (var j = 0; j < actionBtns.length; j++) { actionBtns[j].style.display = ''; }
        var footerTools = ['stagesFooterBtn', 'calendarFooterBtn', 'secondaryActionBtn'];
        for (var fi = 0; fi < footerTools.length; fi++) {
            var fbtn = document.getElementById(footerTools[fi]);
            if (fbtn) { fbtn.removeAttribute('disabled'); fbtn.style.opacity = fbtn.style.pointerEvents = ''; }
        }
        var mainBtn = document.getElementById('mainActionBtn');
        if (mainBtn) { mainBtn.removeAttribute('disabled'); mainBtn.style.opacity = mainBtn.style.pointerEvents = ''; }
        var currBtn = document.getElementById('currencyBtn');
        if (currBtn) { currBtn.removeAttribute('disabled'); currBtn.style.opacity = currBtn.style.pointerEvents = ''; }
        if (window._rbacBlocker) {
            document.removeEventListener('click', window._rbacBlocker, true);
            window._rbacBlocker = null;
        }
        var banner = document.getElementById('rbac-viewer-banner');
        if (banner) banner.remove();
        var grids = document.querySelectorAll('.grid-stack');
        for (var g = 0; g < grids.length; g++) {
            if (grids[g].gridstack) grids[g].gridstack.setStatic(false);
        }
    }

    function applyCurrentRole() {
        if (getRole() === 'viewer') applyViewOnlyLockdown();
        else liftLockdown();
    }

    window.addEventListener('mbt:auth-changed', function (evt) {
        var newRole   = (evt.detail && evt.detail.role)       || 'viewer';
        var changedBy = (evt.detail && evt.detail.changed_by) || 'Admin';
        var prevRole  = getRole();
        setRole(newRole);
        if (newRole === 'editor' && prevRole !== 'editor') {
            applyViewOnlyLockdown();
            if (typeof mBTME !== 'undefined') mBTME.alert('Role Updated', changedBy + ' has set your role to Editor. Your saves will be submitted for Owner approval.');
        } else if (newRole === 'admin' && prevRole !== 'admin') {
            liftLockdown();
            if (typeof mBTME !== 'undefined') mBTME.alert('Access Restored', changedBy + ' has granted you full Owner access.');
        }
    });

    window.mBT.rbac = {
        getRole:               getRole,
        setRole:               setRole,
        applyCurrentRole:      applyCurrentRole,
        applyViewOnlyLockdown: applyViewOnlyLockdown,
        liftLockdown:          liftLockdown
    };
})();

/* ========= Phase 93 / Phase 63.5: mBT.tabLock — Multi-Tab BroadcastChannel Mutex =========
   Extracted from mBT/index.html. Exposed as window.mBT.tabLock.
   The Budget Editor shims mBTTabLock = window.mBT.tabLock for backward compat.
   ========= */
(function () {
    'use strict';

    window.mBT = window.mBT || {};

    var CHANNEL_NAME  = 'mbt_tab_ping';
    var PING_TIMEOUT  = 500;
    var PING_INTERVAL = 10000;

    var _channel        = null;
    var _isPrimary      = false;
    var _currentKey     = null;
    var _heartbeatTimer = null;
    var _overlayEl      = null;

    function _mountOverlay() {
        if (_overlayEl) return;
        _overlayEl = document.createElement('div');
        _overlayEl.id = 'tab-lock-overlay';
        _overlayEl.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.82);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;pointer-events:all;';
        _overlayEl.innerHTML =
            '<div style="background:#1e293b;border:1px solid #334155;border-radius:20px;padding:32px 40px;max-width:400px;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.5);">' +
            '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="margin:0 auto 16px;display:block;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            '<p style="color:#f1f5f9;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Budget Open in Another Tab</p>' +
            '<p style="color:#94a3b8;font-size:10px;line-height:1.6;margin-bottom:6px;">This budget is already active in another browser tab. To prevent data conflicts, this tab is locked to read-only.</p>' +
            '<p style="color:#64748b;font-size:9px;line-height:1.5;margin-bottom:20px;">Note: This lock cannot detect Incognito windows or other browsers. If you\'re sure no other tab is open, use the button below.</p>' +
            '<button id="tab-lock-claim-btn" style="background:#2563eb;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;cursor:pointer;">Claim Primary Access</button>' +
            '</div>';
        document.body.appendChild(_overlayEl);
        document.getElementById('tab-lock-claim-btn').addEventListener('click', function () { _becomePrimary(); });
    }

    function _removeOverlay() { if (_overlayEl) { _overlayEl.remove(); _overlayEl = null; } }

    function _startHeartbeat() {
        if (_heartbeatTimer) clearInterval(_heartbeatTimer);
        _heartbeatTimer = setInterval(function () {
            if (_isPrimary && _channel) _channel.postMessage({ type: 'heartbeat', key: _currentKey });
        }, PING_INTERVAL);
    }

    function _becomePrimary() {
        _isPrimary = true;
        _removeOverlay();
        var existing = document.getElementById('tab-primary-badge');
        if (!existing) {
            var badge = document.createElement('span');
            badge.id = 'tab-primary-badge';
            badge.textContent = 'Primary';
            badge.style.cssText = 'background:#1d4ed8;color:#fff;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;padding:2px 7px;border-radius:6px;margin-left:8px;vertical-align:middle;';
            var headerTitle = document.querySelector('#mbt-header-title, .mbt-header-title, header h1, header .text-sm');
            if (headerTitle) headerTitle.appendChild(badge);
        }
        if (_channel) _channel.postMessage({ type: 'claim', key: _currentKey });
        _startHeartbeat();
    }

    function negotiate(projectKey) {
        if (_currentKey && _currentKey !== projectKey) _teardown();
        _currentKey = projectKey;
        if (typeof BroadcastChannel === 'undefined') return;
        _channel = new BroadcastChannel(CHANNEL_NAME);
        var responded = false;
        _channel.onmessage = function (evt) {
            var msg = evt.data;
            if (!msg || msg.key !== _currentKey) return;
            if (msg.type === 'who_is_active') { if (_isPrimary) _channel.postMessage({ type: 'i_am_active', key: _currentKey }); }
            else if (msg.type === 'i_am_active' || msg.type === 'heartbeat') { if (!_isPrimary) { responded = true; _mountOverlay(); } }
            else if (msg.type === 'claim') {
                if (_isPrimary) {
                    _isPrimary = false;
                    if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
                    var badge = document.getElementById('tab-primary-badge');
                    if (badge) badge.remove();
                    _mountOverlay();
                }
            }
        };
        var flush = (typeof localforage !== 'undefined') ? localforage.getItem('__flush_noop__').catch(function () {}) : Promise.resolve();
        flush.then(function () {
            _channel.postMessage({ type: 'who_is_active', key: _currentKey });
            setTimeout(function () { if (!responded) _becomePrimary(); }, PING_TIMEOUT);
        });
    }

    function _teardown() {
        if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
        if (_channel) { _channel.close(); _channel = null; }
        _isPrimary = false; _currentKey = null;
        _removeOverlay();
        var badge = document.getElementById('tab-primary-badge');
        if (badge) badge.remove();
    }

    window.addEventListener('beforeunload', function () { _teardown(); });

    window.mBT.tabLock = {
        negotiate: negotiate,
        teardown:  _teardown,
        isPrimary: function () { return _isPrimary; }
    };
})();

