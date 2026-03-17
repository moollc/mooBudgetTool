/**
 * mBT Contacts Service — Crew and Vendor Management (Modular JS)
 */

(function () {
    'use strict';

    window.mBT = window.mBT || {};
    window.mBT.services = window.mBT.services || {};

    var Contacts = {
        getAll: function () {
            return window.mBT.storage.getDb().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction('contacts', 'readonly');
                    var store = tx.objectStore('contacts');
                    var request = store.getAll();
                    request.onsuccess = function () { resolve(request.result || []); };
                    request.onerror = function () { reject(request.error); };
                });
            });
        },

        save: function (contact) {
            return window.mBT.storage.getDb().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction('contacts', 'readwrite');
                    var store = tx.objectStore('contacts');
                    var request = store.put(contact);
                    request.onsuccess = function () { resolve(); };
                    request.onerror = function () { reject(request.error); };
                });
            });
        },

        seedDefaults: function () {
            var defaults = [
                { id: 'jm_lead', name: 'Jayson M.Y', role: 'Lead Architect', category: 'Crew', email: 'jayson@example.com' },
                { id: 'sample_dp', name: 'Sample DP', role: 'Director of Photography', category: 'Crew', email: 'dp@example.com' }
            ];

            var self = this;
            this.getAll().then(function (existing) {
                if (existing.length === 0) {
                    defaults.forEach(function (item) { self.save(item); });
                }
            });
        },

        render: function () {
            var list = document.getElementById('contacts-list');
            if (!list) return;

            this.getAll().then(function (items) {
                if (items.length === 0) {
                    list.innerHTML = '<p class="svc-desc">No contacts found.</p>';
                    return;
                }

                function esc(str) {
                    return String(str || '')
                        .replace(/&/g, '&')
                        .replace(/</g, '<')
                        .replace(/>/g, '>')
                        .replace(/"/g, '"')
                        .replace(/'/g, '&#39;');
                }

                list.innerHTML = items.map(function (item) {
                    return '<div class="service-item">' +
                        '<div class="svc-icon" style="background:var(--blue-500); color:' + esc(item.name.charAt(0)) + ';">' + esc(item.name.charAt(0)) + '</div>' +
                        '<div class="svc-info"><div class="svc-name">' + esc(item.name) + '</div>' +
                        '<div class="svc-desc">' + esc(item.role) + ' &mdash; ' + esc(item.category) + '</div></div>' +
                        '<span class="svc-status ready">active</span></div>';
                }).join('');
            });
        }
    };

    window.mBT.services.contacts = Contacts;

    if (window.mBT.core && window.mBT.core.routes) {
        window.mBT.core.routes.register('contacts', function () {
            Contacts.render();
        });
    }

    setTimeout(function () { Contacts.seedDefaults(); }, 1200);
})();