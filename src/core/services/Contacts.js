/**
 * © 2026 Jayson Moo-Young <jayson.m.y@gmail.com>
 * Part of the mBT (Moo Budget Tool) Ecosystem.
 * License: MIT
 */

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

        /* Phase 113/114 — "Me" Card: designate one contact as the current user */
        setMe: function (contactId) {
            var self = this;
            return self.getAll().then(function (contacts) {
                var saves = contacts.map(function (c) {
                    c.isMe = (c.id === contactId);
                    return self.save(c);
                });
                return Promise.all(saves);
            });
        },

        getMe: function () {
            return this.getAll().then(function (contacts) {
                return contacts.find(function (c) { return c.isMe === true; }) || null;
            });
        },

        /* Phase 113/114 — Device Bridge: import contacts via navigator.contacts (PWA-native) */
        /* Degrades gracefully: resolves with empty array if API unavailable */
        importFromDevice: function () {
            var self = this;
            if (!navigator.contacts || !navigator.contacts.select) {
                return Promise.resolve({ imported: 0, error: 'navigator.contacts API not available on this device or browser.' });
            }
            return navigator.contacts.select(['name', 'email', 'tel'], { multiple: true }).then(function (results) {
                if (!results || results.length === 0) return { imported: 0 };
                var saves = results.map(function (r, i) {
                    var name = (r.name && r.name[0]) ? r.name[0] : 'Unknown';
                    var email = (r.email && r.email[0]) ? r.email[0] : '';
                    var phone = (r.tel && r.tel[0]) ? r.tel[0] : '';
                    var contact = {
                        id: 'device_' + Date.now() + '_' + i,
                        name: name,
                        email: email,
                        phone: phone,
                        category: 'Crew',
                        role: '',
                        isMe: false,
                        source: 'device'
                    };
                    return self.save(contact);
                });
                return Promise.all(saves).then(function () { return { imported: results.length }; });
            }).catch(function (err) {
                return { imported: 0, error: err.message || 'Device contact access denied.' };
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