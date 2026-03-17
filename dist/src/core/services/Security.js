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
