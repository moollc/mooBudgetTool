/**
 * mBT OpenGate Service — Reference Data Management (Modular JS)
 * Manages the `og_ref` IndexedDB store using the unified Storage Engine.
 * Ported from mBT-Old.html lines 1677-2058 (Jamaica 2025 Database)
 */

(function () {
    'use strict';

    window.mBT = window.mBT || {};
    window.mBT.services = window.mBT.services || {};

    var OpenGate = {
        rates: [],
        contacts: [],
        templates: [],

        settings: {
            optInSharing: JSON.parse(localStorage.getItem('moo_og_share') || 'false'),
            location: localStorage.getItem('moo_og_loc') || 'Jamaica'
        },

        /**
         * Get all reference items from IndexedDB og_ref store
         */
        getAll: function () {
            return window.mBT.storage.getDb().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction('og_ref', 'readonly');
                    var store = tx.objectStore('og_ref');
                    var request = store.getAll();
                    request.onsuccess = function () { resolve(request.result || []); };
                    request.onerror = function () { reject(request.error); };
                });
            });
        },

        /**
         * Save or update a reference item
         */
        save: function (item) {
            return window.mBT.storage.getDb().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction('og_ref', 'readwrite');
                    var store = tx.objectStore('og_ref');
                    var request = store.put(item);
                    request.onsuccess = function () { resolve(); };
                    request.onerror = function () { reject(request.error); };
                });
            });
        },

        /**
         * Load rates from IndexedDB, falling back to localforage/localStorage legacy keys,
         * then seeding from the Jamaica 2025 database if nothing is found.
         */
        init: function () {
            var self = this;
            return this._loadRates().then(function () {
                return self._loadContacts();
            }).then(function () {
                console.log('[OpenGate] Initialized: ' + self.rates.length + ' rates, ' + self.contacts.length + ' contacts.');
            });
        },

        _loadRates: function () {
            var self = this;
            var key = 'prodBudget_v5_globalItems';

            return this._loadLegacy(key).then(function (stored) {
                self.rates.length = 0;
                if (!stored || stored.length === 0) {
                    var defaults = self._getJamaicaDatabase();
                    self.rates.push.apply(self.rates, defaults);
                    return self._saveRates();
                } else {
                    self.rates.push.apply(self.rates, stored);
                }
            });
        },

        _loadContacts: function () {
            var self = this;
            var key = 'moo_contacts';

            return this._loadLegacy(key).then(function (stored) {
                self.contacts.length = 0;
                if (stored && stored.length > 0) {
                    self.contacts.push.apply(self.contacts, stored);
                }
            });
        },

        /**
         * Migration bridge: try localforage first, then localStorage, then null
         */
        _loadLegacy: function (key) {
            if (typeof localforage !== 'undefined') {
                return localforage.getItem(key).then(function (data) {
                    if (data) return data;
                    var raw = localStorage.getItem(key);
                    if (raw) {
                        try {
                            var parsed = JSON.parse(raw);
                            localforage.setItem(key, parsed);
                            return parsed;
                        } catch (e) { }
                    }
                    return null;
                }).catch(function () {
                    var raw = localStorage.getItem(key);
                    if (raw) { try { return JSON.parse(raw); } catch (e) { } }
                    return null;
                });
            }
            var raw = localStorage.getItem(key);
            if (raw) { try { return Promise.resolve(JSON.parse(raw)); } catch (e) { } }
            return Promise.resolve(null);
        },

        _saveRates: function () {
            if (typeof localforage !== 'undefined') {
                return localforage.setItem('prodBudget_v5_globalItems', this.rates);
            }
            localStorage.setItem('prodBudget_v5_globalItems', JSON.stringify(this.rates));
            return Promise.resolve();
        },

        _saveContacts: function () {
            if (typeof localforage !== 'undefined') {
                return localforage.setItem('moo_contacts', this.contacts);
            }
            localStorage.setItem('moo_contacts', JSON.stringify(this.contacts));
            return Promise.resolve();
        },

        /**
         * Intelligent ingestion engine for rates and contacts
         */
        ingest: function (items, type) {
            type = type || 'rate';
            var added = 0;
            var self = this;

            if (type === 'rate') {
                var existing = {};
                for (var i = 0; i < this.rates.length; i++) {
                    existing[this.rates[i].description.toLowerCase()] = true;
                }
                for (var j = 0; j < items.length; j++) {
                    var item = items[j];
                    if (!existing[item.description.toLowerCase()]) {
                        this.rates.push({
                            description: item.description,
                            unit: item.unit || 'Day',
                            rate: parseFloat(item.rate) || 0
                        });
                        added++;
                    }
                }
                if (added > 0) return this._saveRates().then(function () { return added; });
            } else if (type === 'contact') {
                var existingC = {};
                for (var k = 0; k < this.contacts.length; k++) {
                    var c = this.contacts[k];
                    existingC[(c.name + '|' + c.role).toLowerCase()] = true;
                }
                for (var m = 0; m < items.length; m++) {
                    var ci = items[m];
                    var name = (ci.Name || ci.name || '').trim();
                    var role = (ci.Role || ci.role || 'Crew').trim();
                    var phone = (ci.Phone || ci.phone || '').trim();
                    var email = (ci.Email || ci.email || '').trim();

                    if (!name) continue;

                    var ckey = (name + '|' + role).toLowerCase();
                    if (!existingC[ckey]) {
                        this.contacts.push({
                            id: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                            name: name,
                            role: role,
                            phone: phone,
                            email: email,
                            contact: phone || email
                        });
                        existingC[ckey] = true;
                        added++;
                    }
                }
                if (added > 0) return this._saveContacts().then(function () { return added; });
            }
            return Promise.resolve(added);
        },

        /**
         * Seed default reference data into IndexedDB og_ref store
         */
        seedDefaults: function () {
            var self = this;
            var defaults = this._getJamaicaDatabase().map(function (item, i) {
                return {
                    id: 'og_jamaica_' + i,
                    category: 'crew_rates',
                    label: item.description,
                    value: item.rate,
                    unit: item.unit,
                    currency: 'JMD'
                };
            });

            this.getAll().then(function (existing) {
                if (existing.length === 0) {
                    console.log('[OpenGate] Seeding ' + defaults.length + ' default reference items…');
                    defaults.forEach(function (item) { self.save(item); });
                }
            });
        },

        /**
         * Populate the UI panel
         */
        render: function () {
            var list = document.getElementById('opengate-list');
            if (!list) return;

            this.getAll().then(function (items) {
                if (items.length === 0) {
                    list.innerHTML = '<div class="service-item"><div class="svc-info">Seeding defaults...</div></div>';
                    return;
                }

                list.innerHTML = items.map(function (item) {
                    var val = window.mBT.le ? window.mBT.le.formatCurrency(item.value, item.currency) : (item.value + ' ' + (item.currency || 'JMD'));
                    return '<div class="service-item">' +
                        '<div class="svc-icon" style="background:var(--slate-100);">💰</div>' +
                        '<div class="svc-info"><div class="svc-name">' + (item.label || item.id) + '</div>' +
                        '<div class="svc-desc">' + val + ' / ' + (item.unit || 'Day') + ' — ' + (item.category || 'general') + '</div></div>' +
                        '<span class="svc-status ready">active</span></div>';
                }).join('');
            });
        },

        /**
         * Jamaica 2025 industry rate database — ported from mBT-Old.html _getJamaicaDatabase()
         * All rates in JMD (Jamaican Dollars)
         */
        _getJamaicaDatabase: function () {
            return [
                { description: 'Storyboard Artist', unit: 'Day', rate: 45000 },
                { description: 'Copywriter (Pitch/Treatment)', unit: 'Flat', rate: 75000 },
                { description: 'Script Consultant / Doctor', unit: 'Flat', rate: 150000 },
                { description: 'Pitch Deck Designer', unit: 'Flat', rate: 120000 },
                { description: 'Researcher', unit: 'Day', rate: 25000 },
                { description: 'Concept Artist', unit: 'Day', rate: 40000 },
                { description: 'Legal - Rights & Clearances', unit: 'Flat', rate: 250000 },
                { description: 'Director', unit: 'Day', rate: 85000 },
                { description: 'Executive Producer', unit: 'Flat', rate: 500000 },
                { description: 'Producer', unit: 'Day', rate: 75000 },
                { description: 'Line Producer', unit: 'Day', rate: 65000 },
                { description: 'Screenwriter', unit: 'Flat', rate: 350000 },
                { description: 'Cast - Lead', unit: 'Day', rate: 100000 },
                { description: 'Cast - Supporting', unit: 'Day', rate: 50000 },
                { description: 'Stunt Coordinator', unit: 'Day', rate: 60000 },
                { description: 'Unit Production Manager (UPM)', unit: 'Day', rate: 60000 },
                { description: 'Production Coordinator', unit: 'Day', rate: 30000 },
                { description: '1st Assistant Director (1st AD)', unit: 'Day', rate: 65000 },
                { description: '2nd Assistant Director', unit: 'Day', rate: 45000 },
                { description: '2nd 2nd AD', unit: 'Day', rate: 25000 },
                { description: 'Key PA', unit: 'Day', rate: 20000 },
                { description: 'Set PA', unit: 'Day', rate: 15000 },
                { description: 'Office PA', unit: 'Day', rate: 15000 },
                { description: 'Truck PA', unit: 'Day', rate: 18000 },
                { description: 'Location Manager', unit: 'Day', rate: 50000 },
                { description: 'Location Scout', unit: 'Day', rate: 35000 },
                { description: 'Script Supervisor', unit: 'Day', rate: 40000 },
                { description: 'Medic / Set Nurse', unit: 'Day', rate: 35000 },
                { description: 'Security Guard', unit: 'Day', rate: 12000 },
                { description: 'Craft Service', unit: 'Day', rate: 25000 },
                { description: 'Catering (Per Head)', unit: 'Flat', rate: 2500 },
                { description: 'Director of Photography (DP)', unit: 'Day', rate: 90000 },
                { description: 'Camera Operator', unit: 'Day', rate: 60000 },
                { description: '1st Assistant Camera (Focus)', unit: 'Day', rate: 45000 },
                { description: '2nd Assistant Camera', unit: 'Day', rate: 35000 },
                { description: 'Digital Imaging Tech (DIT)', unit: 'Day', rate: 50000 },
                { description: 'Steadicam Operator', unit: 'Day', rate: 70000 },
                { description: 'Drone Operator', unit: 'Day', rate: 55000 },
                { description: 'Camera Utility', unit: 'Day', rate: 25000 },
                { description: 'Gaffer', unit: 'Day', rate: 55000 },
                { description: 'Best Boy Electric', unit: 'Day', rate: 40000 },
                { description: 'Electrician', unit: 'Day', rate: 30000 },
                { description: 'Key Grip', unit: 'Day', rate: 50000 },
                { description: 'Best Boy Grip', unit: 'Day', rate: 40000 },
                { description: 'Dolly Grip', unit: 'Day', rate: 40000 },
                { description: 'Grip', unit: 'Day', rate: 30000 },
                { description: 'Generator Operator', unit: 'Day', rate: 35000 },
                { description: 'Sound Mixer', unit: 'Day', rate: 50000 },
                { description: 'Boom Operator', unit: 'Day', rate: 35000 },
                { description: 'Sound Utility', unit: 'Day', rate: 25000 },
                { description: 'Production Designer', unit: 'Day', rate: 65000 },
                { description: 'Art Director', unit: 'Day', rate: 50000 },
                { description: 'Set Decorator', unit: 'Day', rate: 45000 },
                { description: 'Set Dresser', unit: 'Day', rate: 30000 },
                { description: 'Props Master', unit: 'Day', rate: 45000 },
                { description: 'Assistant Props', unit: 'Day', rate: 30000 },
                { description: 'Costume Designer', unit: 'Day', rate: 55000 },
                { description: 'Wardrobe Stylist', unit: 'Day', rate: 45000 },
                { description: 'Wardrobe Assistant', unit: 'Day', rate: 25000 },
                { description: 'Makeup Artist (Key)', unit: 'Day', rate: 45000 },
                { description: 'Hair Stylist (Key)', unit: 'Day', rate: 45000 },
                { description: 'Makeup/Hair Assistant', unit: 'Day', rate: 25000 },
                { description: 'Post-Production Supervisor', unit: 'Week', rate: 200000 },
                { description: 'Editor', unit: 'Day', rate: 50000 },
                { description: 'Assistant Editor (AE)', unit: 'Day', rate: 25000 },
                { description: 'Colorist', unit: 'Hour', rate: 15000 },
                { description: 'VFX Supervisor', unit: 'Day', rate: 70000 },
                { description: 'VFX Artist', unit: 'Day', rate: 55000 },
                { description: 'Sound Designer', unit: 'Flat', rate: 150000 },
                { description: 'Composer', unit: 'Flat', rate: 200000 },
                { description: 'Music Supervisor', unit: 'Flat', rate: 100000 }
            ];
        }
    };

    window.mBT.services.opengate = OpenGate;

    // Register with router
    if (window.mBT.core && window.mBT.core.routes) {
        window.mBT.core.routes.register('opengate', function () {
            OpenGate.render();
        });
    }

    // Delayed initialization
    setTimeout(function () { OpenGate.init(); }, 1000);

    console.log('[mBT] OpenGate service loaded ✓');
})();
