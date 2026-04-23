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
        /* Degrades gracefully: resolves with error object if API unavailable */
        importFromDevice: function () {
            var self = this;
            if (!navigator.contacts || !navigator.contacts.select) {
                var isDesktop = !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
                var msg = isDesktop 
                    ? 'Native Contact Picker is mobile-only. On Desktop, please export your contacts as a VCF or CSV file and use the "File Import" option.'
                    : 'Your browser does not support the native Contact Picker API.';
                return Promise.resolve({ imported: 0, error: msg });
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

        /* Phase 155: CSV Parser for Contact Import (Google Contacts & Standard) */
        parseCSV: function (text) {
            if (!text) return [];
            var lines = text.split(/\r?\n/);
            if (lines.length < 2) return [];
            var headers = lines[0].split(',').map(function(h) { return h.trim().toLowerCase(); });
            
            /* Map common headers to internal fields */
            var map = {
                name: headers.indexOf('name') > -1 ? headers.indexOf('name') : headers.indexOf('display name'),
                first: headers.indexOf('given name'),
                last: headers.indexOf('family name'),
                email: headers.indexOf('email') > -1 ? headers.indexOf('email') : headers.indexOf('e-mail 1 - value'),
                phone: headers.indexOf('phone') > -1 ? headers.indexOf('phone') : headers.indexOf('phone 1 - value'),
                dept: headers.indexOf('department'),
                role: headers.indexOf('role') || headers.indexOf('title') || headers.indexOf('job title')
            };

            var contacts = [];
            for (var i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                /* Simple CSV split (doesn't handle commas inside quotes, but fine for most exports) */
                var cols = lines[i].split(',').map(function(c) { return c.trim().replace(/^"|"$/g, ''); });
                var cName = '';
                if (map.name > -1 && cols[map.name]) {
                    cName = cols[map.name];
                } else if (map.first > -1 && map.last > -1) {
                    cName = (cols[map.first] || '') + ' ' + (cols[map.last] || '');
                } else if (map.first > -1) {
                    cName = cols[map.first];
                }
                cName = cName.trim();
                if (!cName) continue;

                contacts.push({
                    name: cName,
                    email: (map.email > -1 && cols[map.email]) ? cols[map.email] : null,
                    phone: (map.phone > -1 && cols[map.phone]) ? cols[map.phone] : null,
                    department: (map.dept > -1 && cols[map.dept]) ? cols[map.dept] : '',
                    role: (map.role > -1 && cols[map.role]) ? cols[map.role] : ''
                });
            }
            return contacts;
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
