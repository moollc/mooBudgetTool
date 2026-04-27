/**
 * © 2026 Jayson Moo-Young <jayson.m.y@gmail.com>
 * Part of the mBT (Moo Budget Tool) Ecosystem.
 * License: MIT
 */

/**
 * mBTOG : Open Gate Engine
 *
 * The name comes from several places.
 *
 * In film, "opening the gate" is a camera check, physically
 * openning the film gate after a take to inspect the aperture for anything 
 * that ould ruin the image. Today the term "shooting open gate" means
 * exposing the full sensor area without cropping.
 * Both are moments of acquiring visual truth.
 *
 * The third, I propose is akin to literally openning a gate:
 * removing the gatekeeping.
 * Industry rate information, production processes, document standards;
 * this knowledge has always been held by the few
 * (understandably, people worked and suffered years to accumulate it),
 * especially in smaller markets like the Caribbean, where there is
 * no union rate card, no published guild scale,
 * and no authoritative source a new producer can point to and say
 * "this is what things cost here."
 *
 * Open Gate is the answer to that. A living, community-calibrated reference
 * that gives any producer in Jamaica, Trinidad, Barbados, or anywhere else
 * the same baseline knowledge that used to require years of industry access
 * to accumulate.
 *
 * The gate is open. Go through it. Take a look.
 *
 * -------------------------------------------------------------------------
 * Shared engine loaded by both the Budget Editor (mBT/index.html) and the
 * App Shell (src/core/index.html). Depends only on window.localforage.
 * Sets window.mBTOG.
 * -------------------------------------------------------------------------
 */

(function () {
    'use strict';

    /* ========= REGIONAL RATE MULTIPLIERS ========= */
    /* Jamaica is the base (1.0). All other regions are multiples of JMD rates. */
    var RATE_REGIONS = {
        'Jamaica':     1.0,
        'Trinidad':    1.3,
        'Barbados':    1.5,
        'Guyana':      1.2,
        'UK':          2.8,
        'Canada':      2.7,
        'Australia':   2.4,
        'USA':         3.5
    };

    /* ========= CLOUD CONFIG ========= */
    /*
     * Publishable key : safe to embed in client code.
     * Supabase RLS ensures public can only READ og_community_rates.
     * All other tables require authentication.
     * The secret key is never embedded here.
     */
    var OG_CLOUD_URL = 'https://gdrgxlicnvtrbenfxypt.supabase.co';
    var OG_CLOUD_KEY = 'sb_publishable_1e5RuNmbdBzqC_n_-dFYHw_gBJzA73k';
    var OG_TABLE     = 'og_community_rates';
    var OG_SYNC_KEY  = 'moo_og_last_sync';

    /* ========= STORAGE HELPERS ========= */
    /* Use localforage directly, works in both Budget Editor and App Shell. */

    function _lfGet(key) {
        return window.localforage.getItem(key).catch(function () { return null; });
    }

    function _lfSet(key, val) {
        return window.localforage.setItem(key, val).catch(function () {});
    }

    /* Legacy migration bridge: if localforage has nothing, check localStorage. */
    function _loadWithMigration(key) {
        return _lfGet(key).then(function (data) {
            if (data) return data;
            var raw = localStorage.getItem(key);
            if (raw) {
                try {
                    var parsed = JSON.parse(raw);
                    _lfSet(key, parsed);
                    return parsed;
                } catch (e) {}
            }
            return null;
        });
    }

    /* ========= OPEN GATE ENGINE ========= */

    var mBTOG = {

        RATE_REGIONS: RATE_REGIONS,

        settings: {
            optInSharing: JSON.parse(localStorage.getItem('moo_og_share') || 'false'),
            location: localStorage.getItem('moo_og_loc') || 'Jamaica',
            get regionMultiplier() { return RATE_REGIONS[this.location] || 1.0; }
        },

        rates: [],
        contacts: [],
        templates: [],

        search: function (query) {
            if (!query) return this.rates;
            var q = query.toLowerCase();
            return this.rates.filter(function (r) {
                return (r.description || '').toLowerCase().indexOf(q) > -1;
            });
        },

        /* --- INIT --- */

        init: function () {
            var self = this;
            return self.loadRates().then(function () {
                return self.loadContacts();
            }).then(function () {
                self.loadTemplates();
                /* Attempt cloud sync after local data is ready. Non-blocking. */
                setTimeout(function () {
                    self.syncFromCloud();
                    self.syncContactsFromCloud();
                }, 1200);
            });
        },

        /* --- RATES --- */

        loadRates: function () {
            var self = this;
            var DB_VERSION_KEY = 'mbt_og_db_version';
            var CURRENT_VERSION = '2026.04.27_v4';
            
            return _loadWithMigration('prodBudget_v5_globalItems').then(function (stored) {
                return _lfGet(DB_VERSION_KEY).then(function (v) {
                    self.rates.length = 0;
                    /* If no data OR version mismatch, reseed with the new 2025 research baseline */
                    if (!stored || stored.length === 0 || v !== CURRENT_VERSION) {
                        var defaults = self._getJamaicaDatabase();
                        for (var i = 0; i < defaults.length; i++) { self.rates.push(defaults[i]); }
                        _lfSet(DB_VERSION_KEY, CURRENT_VERSION);
                        return self.saveRates();
                    }
                    for (var j = 0; j < stored.length; j++) { self.rates.push(stored[j]); }
                });
            });
        },

        saveRates: function () {
            return _lfSet('prodBudget_v5_globalItems', this.rates);
        },

        /* --- Notify parent window that a rate was added or changed --- */
        notifyRateChanged: function (description, rate, region) {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'mbt:tool-action',
                    action: 'og-rate-changed',
                    payload: { description: description, rate: rate, region: region || this.settings.location }
                }, '*');
            }
        },

        /* --- CONTACTS ---
         * mBTOG.contacts is a runtime cache of the canonical IndexedDB `contacts` store.
         * All writes go through window.mBTStorage.saveContact().
         * mBTOG.contacts is refreshed from IndexedDB on init and after any write.
         * Legacy localforage `moo_contacts` is migrated in on first load.
         */

        loadContacts: function () {
            var self = this;
            /* If mBTStorage is available, use it as canonical source */
            if (window.mBTStorage && typeof window.mBTStorage.getAllContacts === 'function') {
                return window.mBTStorage.getAllContacts().then(function (dbContacts) {
                    self.contacts.length = 0;
                    for (var i = 0; i < dbContacts.length; i++) { self.contacts.push(dbContacts[i]); }
                    /* One-time migration: pull any legacy moo_contacts into IndexedDB */
                    return _loadWithMigration('moo_contacts').then(function (legacy) {
                        if (!legacy || !legacy.length) return;
                        var byId = {};
                        for (var j = 0; j < dbContacts.length; j++) { byId[dbContacts[j].id] = true; }
                        var migrated = [];
                        for (var k = 0; k < legacy.length; k++) {
                            var lc = legacy[k];
                            if (!lc.id) lc.id = 'contact_' + Date.now() + '_' + k;
                            if (!byId[lc.id]) {
                                lc.portfolio = lc.portfolio || [];
                                migrated.push(window.mBTStorage.saveContact(lc));
                                self.contacts.push(lc);
                            }
                        }
                        if (migrated.length) {
                            return Promise.all(migrated).then(function () {
                                /* Clear legacy store after successful migration */
                                return _lfSet('moo_contacts', []);
                            });
                        }
                    });
                }).catch(function () { return self._loadContactsFallback(); });
            }
            return self._loadContactsFallback();
        },

        _loadContactsFallback: function () {
            var self = this;
            return _loadWithMigration('moo_contacts').then(function (stored) {
                self.contacts.length = 0;
                if (stored) {
                    for (var i = 0; i < stored.length; i++) { self.contacts.push(stored[i]); }
                }
            });
        },

        /* Refresh runtime cache from IndexedDB (call after any write) */
        refreshContacts: function () {
            var self = this;
            if (window.mBTStorage && typeof window.mBTStorage.getAllContacts === 'function') {
                return window.mBTStorage.getAllContacts().then(function (all) {
                    self.contacts.length = 0;
                    for (var i = 0; i < all.length; i++) { self.contacts.push(all[i]); }
                    return all;
                }).catch(function () { return self.contacts; });
            }
            return Promise.resolve(self.contacts);
        },

        /* Save a contact to IndexedDB and refresh the cache */
        saveContact: function (contact) {
            var self = this;
            if (window.mBTStorage && typeof window.mBTStorage.saveContact === 'function') {
                return window.mBTStorage.saveContact(contact).then(function (saved) {
                    return self.refreshContacts().then(function () { return saved; });
                });
            }
            /* Fallback: update in-memory array and persist to localforage */
            if (!contact.id) contact.id = 'contact_' + Date.now();
            var idx = -1;
            for (var i = 0; i < self.contacts.length; i++) {
                if (self.contacts[i].id === contact.id) { idx = i; break; }
            }
            if (idx > -1) { self.contacts[idx] = contact; } else { self.contacts.push(contact); }
            return _lfSet('moo_contacts', self.contacts).then(function () { return contact; });
        },

        /* Legacy shim — kept so old callers don't break during transition */
        saveContacts: function () {
            return _lfSet('moo_contacts', this.contacts);
        },

        /* --- OG_CONTACTS CLOUD SYNC (opt-in) ---
         * Pushes non-private contacts to og_contacts Supabase table.
         * Pulls shared contacts from other users and merges as read-only.
         * Controlled by localStorage key: moo_og_share_contacts ('true'/'false').
         */
        OG_CONTACTS_TABLE: 'og_contacts',

        _getOwnerId: function () {
            var uid = localStorage.getItem('mbt_user_id');
            if (!uid) {
                uid = 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
                localStorage.setItem('mbt_user_id', uid);
            }
            return uid;
        },

        syncContactsFromCloud: function () {
            var self = this;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve([]);
            var shareEnabled = localStorage.getItem('moo_og_share_contacts') === 'true';
            if (!shareEnabled) return Promise.resolve([]);

            return fetch(OG_CLOUD_URL + '/rest/v1/' + self.OG_CONTACTS_TABLE + '?select=*&order=shared_at.desc', {
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + OG_CLOUD_KEY
                }
            }).then(function (res) {
                if (!res.ok) return [];
                return res.json();
            }).then(function (rows) {
                if (!rows || !rows.length) return [];
                var ownerId = self._getOwnerId();
                var sharedByOthers = rows.filter(function (r) { return r.owner_id !== ownerId; });
                /* Store shared contacts in a separate localforage key — never mixed into IndexedDB */
                return _lfSet('moo_og_shared_contacts', sharedByOthers).then(function () {
                    window.dispatchEvent(new CustomEvent('mbt:shared-contacts-updated', { detail: { count: sharedByOthers.length } }));
                    return sharedByOthers;
                });
            }).catch(function () { return []; });
        },

        pushContactsToCloud: function () {
            var self = this;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve(0);
            var shareEnabled = localStorage.getItem('moo_og_share_contacts') === 'true';
            if (!shareEnabled) return Promise.resolve(0);

            var ownerId = self._getOwnerId();
            var ownerName = localStorage.getItem('mbt_display_name') || 'mBT User';
            var toShare = self.contacts.filter(function (c) { return !c.privateContact; });

            if (!toShare.length) return Promise.resolve(0);

            var pushed = 0;
            var promises = toShare.map(function (c) {
                var payload = {
                    id:             c.id,
                    owner_id:       ownerId,
                    owner_name:     ownerName,
                    name:           c.name,
                    department:     c.department || c.role || '',
                    role:           c.role || c.department || '',
                    email:          c.email || null,
                    phone:          c.phone || null,
                    rate:           c.rate || null,
                    /* wallet & portfolio: only share URL-type portfolio items, never Base64 file data */
                    portfolio:      (c.portfolio || []).filter(function (p) { return p.type === 'link'; }),
                    private_contact: false
                    /* wallet_type / wallet_address intentionally excluded from cloud */
                };
                return fetch(OG_CLOUD_URL + '/rest/v1/' + self.OG_CONTACTS_TABLE, {
                    method: 'POST',
                    headers: {
                        'apikey': OG_CLOUD_KEY,
                        'Authorization': 'Bearer ' + OG_CLOUD_KEY,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates,return=minimal'
                    },
                    body: JSON.stringify(payload)
                }).then(function (res) { if (res.ok) pushed++; }).catch(function () {});
            });

            return Promise.all(promises).then(function () {
                localStorage.setItem('moo_og_contacts_last_push', new Date().toISOString());
                return pushed;
            });
        },

        deleteContactFromCloud: function (contactId) {
            var self = this;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve(false);
            var shareEnabled = localStorage.getItem('moo_og_share_contacts') === 'true';
            if (!shareEnabled) return Promise.resolve(false);
            return fetch(OG_CLOUD_URL + '/rest/v1/' + self.OG_CONTACTS_TABLE + '?id=eq.' + encodeURIComponent(contactId), {
                method: 'DELETE',
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + OG_CLOUD_KEY,
                    'Prefer': 'return=minimal'
                }
            }).then(function (res) { return res.ok; }).catch(function () { return false; });
        },

        getSharedContacts: function () {
            return _lfGet('moo_og_shared_contacts').then(function (data) { return data || []; });
        },

        /* --- CLOUD SYNC --- */

        /*
         * syncFromCloud() pulls community rates from Supabase og_community_rates.
         * Uses the publishable key for public read. No account required.
         * Merges new entries only never overwrites local edits.
         * Respects the user's cloud sync toggle (moo_og_cloud_sync).
         * Silently no-ops if offline or sync is disabled.
         */
        syncFromCloud: function () {
            var self = this;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve(0);
            var syncEnabled = JSON.parse(localStorage.getItem('moo_og_cloud_sync') || 'true');
            if (!syncEnabled) return Promise.resolve(0);

            return fetch(OG_CLOUD_URL + '/rest/v1/' + OG_TABLE + '?select=*&order=id', {
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + OG_CLOUD_KEY
                }
            }).then(function (res) {
                if (!res.ok) return [];
                return res.json();
            }).then(function (rows) {
                if (!rows || !rows.length) return 0;
                var existing = {};
                for (var i = 0; i < self.rates.length; i++) {
                    existing[self.rates[i].description.toLowerCase()] = true;
                }
                var added = 0;
                for (var j = 0; j < rows.length; j++) {
                    var row = rows[j];
                    if (!existing[row.description.toLowerCase()]) {
                        self.rates.push({
                            id: row.id,
                            description: row.description,
                            unit: row.unit || 'Day',
                            rate: parseFloat(row.rate) || 0,
                            region: row.region || 'Jamaica',
                            source: row.source || 'community'
                        });
                        existing[row.description.toLowerCase()] = true;
                        added++;
                    }
                }
                if (added > 0) { self.saveRates(); }
                localStorage.setItem(OG_SYNC_KEY, new Date().toISOString());
                return added;
            }).catch(function () { return 0; });
        },

        /*
         * pushRate() — contribute a rate to the community database.
         * Requires a Supabase auth token stored at mbt_supabase_key.
         * Opt-in only — respects moo_og_share toggle.
         */
        pushRate: function (description, unit, rate, region) {
            var self = this;
            var shareEnabled = JSON.parse(localStorage.getItem('moo_og_share') || 'false');
            if (!shareEnabled) return Promise.resolve(false);
            /* Use the user JWT when signed in — required for RLS to record contributed_by. */
            var authToken = localStorage.getItem('mbt_supabase_auth_token') || OG_CLOUD_KEY;

            return fetch(OG_CLOUD_URL + '/rest/v1/' + OG_TABLE, {
                method: 'POST',
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + authToken,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    description: description,
                    unit: unit || 'Day',
                    rate: parseFloat(rate) || 0,
                    region: region || self.settings.location,
                    currency: 'JMD',
                    source: 'community'
                })
            }).then(function (res) { return res.ok; }).catch(function () { return false; });
        },

        /*
         * upsertVote() — Phase 48 voting mechanism
         * Requires auth token. Resolves to true if vote was recorded successfully.
         */
        upsertVote: function (rateId, voteType) {
            var authToken = localStorage.getItem('mbt_supabase_auth_token');
            if (!authToken) return Promise.resolve(false); // Must be signed in to vote

            var userId = localStorage.getItem('mbt_supabase_user_id');
            if (!userId) return Promise.resolve(false);

            return fetch(OG_CLOUD_URL + '/rest/v1/og_votes', {
                method: 'POST',
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + authToken,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates,return=minimal'
                },
                body: JSON.stringify({
                    rate_id: rateId,
                    user_id: userId,
                    vote_type: voteType
                })
            }).then(function (res) { return res.ok; }).catch(function () { return false; });
        },

        /* Returns ISO timestamp of last successful cloud sync, or null. */
        lastSync: function () {
            return localStorage.getItem(OG_SYNC_KEY) || null;
        },

        /*
         * fetchRateAverages() — pulls the og_rate_averages view from Supabase.
         * Returns a map of { "description|region": { avg_rate, contributor_count } }.
         * Falls back to computing averages from the local cached community rates when offline.
         * Stores result in localStorage for offline access.
         */
        fetchRateAverages: function (region) {
            var AVGS_KEY = 'moo_og_rate_averages';
            var filterRegion = region || 'Jamaica';
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                /* Offline: return cached averages or compute from local data. */
                var cached = localStorage.getItem(AVGS_KEY);
                if (cached) {
                    try { return Promise.resolve(JSON.parse(cached)); } catch (e) {}
                }
                return Promise.resolve(this._computeLocalAverages());
            }
            return fetch(OG_CLOUD_URL + '/rest/v1/og_rate_averages?select=*&region=eq.' + encodeURIComponent(filterRegion), {
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + OG_CLOUD_KEY
                }
            }).then(function (res) {
                if (!res.ok) return null;
                return res.json();
            }).then(function (rows) {
                if (!rows || !rows.length) return {};
                var map = {};
                for (var i = 0; i < rows.length; i++) {
                    var r = rows[i];
                    map[r.description.toLowerCase() + '|' + r.region.toLowerCase()] = {
                        avg_rate: parseFloat(r.avg_rate) || 0,
                        contributor_count: parseInt(r.contributor_count, 10) || 0
                    };
                }
                localStorage.setItem(AVGS_KEY, JSON.stringify(map));
                return map;
            }).catch(function () { return {}; });
        },

        /* Compute rate averages from local rates + regional defaults (Phase 172).
           Returns a lookup map keyed by `description|region` (lowercase) so
           mBT.rates.applyRegion() can substitute the correct researched rate
           when a user switches region in Settings.

           Layering rules (later overrides earlier):
           1. Regional defaults (RegionalRateAccuracy.md sourced) — base layer
           2. Community-submitted rates — averaged per key, override defaults
              (community votes carry weight; if 3+ contributors agree, their
              average wins over the seeded default).
        */
        _computeLocalAverages: function () {
            var map = {};
            var i, r, key;

            /* Layer 1: Regional defaults */
            var defaults = this._getAllRegionalDefaults() || [];
            for (i = 0; i < defaults.length; i++) {
                r = defaults[i];
                key = (r.description || '').toLowerCase() + '|' + (r.region || 'Jamaica').toLowerCase();
                map[key] = {
                    avg_rate: parseFloat(r.rate) || 0,
                    currency: r.currency || 'JMD',
                    contributor_count: 0,
                    source: 'default'
                };
            }

            /* Layer 2: Community submissions (averaged) */
            var community = {};
            for (i = 0; i < this.rates.length; i++) {
                r = this.rates[i];
                if (r.source !== 'community') continue;
                key = (r.description || '').toLowerCase() + '|' + (r.region || 'Jamaica').toLowerCase();
                if (!community[key]) { community[key] = { sum: 0, count: 0, currency: r.currency || 'JMD' }; }
                community[key].sum += parseFloat(r.rate) || 0;
                community[key].count++;
            }
            for (var k in community) {
                if (community[k].count > 0) {
                    map[k] = {
                        avg_rate: Math.round(community[k].sum / community[k].count),
                        currency: community[k].currency,
                        contributor_count: community[k].count,
                        source: 'community'
                    };
                }
            }
            return map;
        },

        /* --- INTELLIGENT INGESTION --- */
        /* Deduplicates by description (rates) or name+role (contacts) before saving. */

        ingest: function (items, type) {
            var self = this;
            var added = 0;
            type = type || 'rate';

            if (type === 'rate') {
                var existingRates = {};
                for (var i = 0; i < self.rates.length; i++) {
                    existingRates[self.rates[i].description.toLowerCase()] = true;
                }
                for (var j = 0; j < items.length; j++) {
                    var item = items[j];
                    if (!existingRates[item.description.toLowerCase()]) {
                        self.rates.push({
                            description: item.description,
                            unit: item.unit || 'Day',
                            rate: parseFloat(item.rate) || 0
                        });
                        existingRates[item.description.toLowerCase()] = true;
                        added++;
                    }
                }
                if (added > 0) return self.saveRates().then(function () { return added; });

            } else if (type === 'contact') {
                var existingContacts = {};
                for (var k = 0; k < self.contacts.length; k++) {
                    var c = self.contacts[k];
                    existingContacts[(c.name + '|' + c.role).toLowerCase()] = true;
                }
                for (var m = 0; m < items.length; m++) {
                    var ci = items[m];
                    var name = (ci.Name || ci.name || '').trim();
                    var role = (ci.Role || ci.role || 'Crew').trim();
                    var phone = (ci.Phone || ci.phone || '').trim();
                    var email = (ci.Email || ci.email || '').trim();
                    if (!name) continue;
                    var ckey = (name + '|' + role).toLowerCase();
                    if (!existingContacts[ckey]) {
                        self.contacts.push({
                            id: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                            name: name,
                            role: role,
                            phone: phone,
                            email: email,
                            contact: phone || email
                        });
                        existingContacts[ckey] = true;
                        added++;
                    }
                }
                if (added > 0) return self.saveContacts().then(function () { return added; });
            }

            return Promise.resolve(added);
        },

        /* --- TEMPLATE REGISTRY --- */
        /* Document layout definitions for the Assistant Builder (GridStack). */
        /* This is the single source of truth for document schemas across both apps. */

        loadTemplates: function () {
            var t = [
                /* --- WRITING & CORE --- */
                {
                    id: 'script', cat: 'Pre-Prod', label: 'Script', icon: 'file', default: true,
                    widgets: [{ id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true }, { id: 'body', x: 0, w: 12, h: 12, type: 'richText', label: "Screenplay", autoPosition: true }],
                    defaults: { additional: { body: "INT. LOCATION - DAY\n\n" } }
                },
                {
                    id: 'treatment', cat: 'Pre-Prod', label: 'Story Treatment', icon: 'file', default: false,
                    widgets: [{ id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true }, { id: 'body', x: 0, w: 12, h: 12, type: 'richText', label: "Story Treatment", autoPosition: true }],
                    defaults: { additional: { body: "LOGLINE:\n\nSYNOPSIS:\n\n" } }
                },
                /* --- PRE-PRODUCTION --- */
                {
                    id: 'breakdown', cat: 'Pre-Prod', label: 'Script Breakdowns', icon: 'search', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'cast', x: 0, w: 6, h: 6, type: 'cast', label: "Characters", autoPosition: true },
                        { id: 'logistics', x: 6, w: 6, h: 6, type: 'logistics', label: "Locations", autoPosition: true },
                        { id: 'notes', x: 0, w: 12, h: 4, type: 'richText', label: "Scene Notes & Requirements", autoPosition: true }
                    ],
                    defaults: { cast: [], locations: [], additional: { notes: "" } }
                },
                {
                    id: 'shotlist', cat: 'Pre-Prod', label: 'Shot Lists', icon: 'film', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'schedule', x: 0, w: 12, h: 12, type: 'schedule', label: "Shot Sequence", autoPosition: true },
                        { id: 'logistics', x: 0, w: 12, h: 4, type: 'logistics', label: "Locations", autoPosition: true }
                    ],
                    defaults: { schedule: [], locations: [] }
                },
                {
                    id: 'storyboard', cat: 'Pre-Prod', label: 'Storyboards', icon: 'image', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'frame1', x: 0, w: 4, h: 6, type: 'image', label: "Frame 1", autoPosition: true },
                        { id: 'desc1', x: 0, w: 4, h: 3, type: 'richText', label: "Action 1", autoPosition: true },
                        { id: 'frame2', x: 4, w: 4, h: 6, type: 'image', label: "Frame 2", autoPosition: true },
                        { id: 'desc2', x: 4, w: 4, h: 3, type: 'richText', label: "Action 2", autoPosition: true },
                        { id: 'frame3', x: 8, w: 4, h: 6, type: 'image', label: "Frame 3", autoPosition: true },
                        { id: 'desc3', x: 8, w: 4, h: 3, type: 'richText', label: "Action 3", autoPosition: true }
                    ],
                    defaults: { additional: { desc1: "", desc2: "", desc3: "" } }
                },
                {
                    id: 'preCheck', cat: 'Pre-Prod', label: 'Pre-Prod Checklist', icon: 'check', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'logistics', x: 0, w: 6, h: 10, type: 'richText', label: "Logistics Checklist", autoPosition: true },
                        { id: 'creative', x: 6, w: 6, h: 10, type: 'richText', label: "Creative Checklist", autoPosition: true }
                    ],
                    defaults: { additional: { logistics: "- [ ] Permits\n- [ ] Insurance\n", creative: "- [ ] Script Lock\n- [ ] Storyboards\n" } }
                },
                {
                    id: 'casting', cat: 'Pre-Prod', label: 'Casting Sheets', icon: 'user', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'cast', x: 0, w: 12, h: 10, type: 'cast', label: "Audition List", autoPosition: true },
                        { id: 'notes', x: 0, w: 12, h: 4, type: 'richText', label: "Casting Director Notes", autoPosition: true }
                    ],
                    defaults: { cast: [], additional: { notes: "" } }
                },
                {
                    id: 'techScout', cat: 'Pre-Prod', label: 'Tech Scout Report', icon: 'mapPin', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'logistics', x: 0, w: 12, h: 10, type: 'logistics', label: "Location Details", autoPosition: true },
                        { id: 'notes', x: 0, w: 12, h: 6, type: 'richText', label: "Tech Notes (Power/Parking/Access)", autoPosition: true }
                    ],
                    defaults: { locations: [], additional: { notes: "" } }
                },
                { id: 'charProf', cat: 'Pre-Prod', label: 'Character Profiles', icon: 'user', default: false },
                { id: 'dood', cat: 'Pre-Prod', label: 'Day Out of Days', icon: 'calendar', default: false },
                { id: 'stripboard', cat: 'Pre-Prod', label: 'Stripboard Schedule', icon: 'calendar', default: false },
                /* --- FINANCIAL & PITCH --- */
                {
                    id: 'pitchDeck', cat: 'Pre-Prod', label: 'Funding Pitch Deck', icon: 'maximize', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'cover', x: 0, w: 6, h: 8, type: 'image', label: "Key Art", autoPosition: true },
                        { id: 'synopsis', x: 6, w: 6, h: 8, type: 'richText', label: "Logline & Synopsis", autoPosition: true },
                        { id: 'mood1', x: 0, w: 4, h: 4, type: 'image', label: "Tone Ref 1", autoPosition: true },
                        { id: 'mood2', x: 4, w: 4, h: 4, type: 'image', label: "Tone Ref 2", autoPosition: true },
                        { id: 'mood3', x: 8, w: 4, h: 4, type: 'image', label: "Tone Ref 3", autoPosition: true },
                        { id: 'team', x: 0, w: 12, h: 6, type: 'contacts', label: "Key Creative Team", autoPosition: true }
                    ],
                    defaults: { contacts: [], additional: { synopsis: "" } }
                },
                {
                    id: 'budgetRep', cat: 'Pre-Prod', label: 'Budget Report', icon: 'money', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'summary', x: 0, w: 12, h: 4, type: 'richText', label: "Executive Summary", autoPosition: true },
                        { id: 'breakdown', x: 0, w: 12, h: 12, type: 'schedule', label: "Cost Breakdown", autoPosition: true }
                    ],
                    defaults: { additional: { summary: "" } }
                },
                { id: 'vendorBid', cat: 'Pre-Prod', label: 'Vendor Bid Comparison', icon: 'alert', default: false },
                /* --- PRODUCTION --- */
                {
                    id: 'callSheet', cat: 'Production', label: 'Daily Call Sheet', icon: 'alert', default: true,
                    widgets: [
                        { id: 'contacts', x: 0, w: 6, h: 4, type: 'contacts', label: "Key Contacts", autoPosition: true },
                        { id: 'logistics', x: 6, w: 6, h: 4, type: 'logistics', label: "Logistics", autoPosition: true },
                        { id: 'schedule', x: 0, w: 12, h: 6, type: 'schedule', label: "Schedule", autoPosition: true },
                        { id: 'cast', x: 0, w: 6, h: 6, type: 'cast', label: "Cast List", autoPosition: true },
                        { id: 'crew', x: 6, w: 6, h: 6, type: 'crew', label: "Crew List", autoPosition: true },
                        { id: 'notes', x: 0, w: 12, h: 2, type: 'richText', label: "General Notes", autoPosition: true },
                        { id: 'footer', x: 0, w: 12, h: 2, type: 'footer', label: "Safety Footer", autoPosition: true }
                    ],
                    defaults: { contacts: [], locations: [], schedule: [], cast: [], crew: [], additional: { notes: "" } }
                },
                {
                    id: 'prodReport', cat: 'Production', label: 'Production Report', icon: 'barChart', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'schedule', x: 0, w: 12, h: 5, type: 'schedule', label: "Scenes Shot", autoPosition: true },
                        { id: 'crew', x: 0, w: 12, h: 5, type: 'crew', label: "Crew Attendance", autoPosition: true },
                        { id: 'notes', x: 0, w: 6, h: 4, type: 'richText', label: "Production Notes", autoPosition: true },
                        { id: 'delays', x: 6, w: 6, h: 4, type: 'richText', label: "Delays / Issues", autoPosition: true }
                    ],
                    defaults: { schedule: [], crew: [], additional: { notes: "", delays: "" } }
                },
                {
                    id: 'crewList', cat: 'Production', label: 'Crew Contact List', icon: 'phone', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'contacts', x: 0, w: 12, h: 4, type: 'contacts', label: "Production Team", autoPosition: true },
                        { id: 'crew', x: 0, w: 12, h: 12, type: 'crew', label: "Department Heads & Crew", autoPosition: true }
                    ],
                    defaults: { contacts: [], crew: [] }
                },
                { id: 'transport', cat: 'Production', label: 'Transport Schedule', icon: 'mapPin', default: false },
                { id: 'continuity', cat: 'Production', label: 'Continuity/Sound Log', icon: 'film', default: false },
                { id: 'muahCont', cat: 'Production', label: 'Hair/Makeup Continuity', icon: 'user', default: false },
                { id: 'propList', cat: 'Production', label: 'Prop List', icon: 'hazard', default: false },
                { id: 'catering', cat: 'Production', label: 'Catering/Meal Tracker', icon: 'coffee', default: false },
                { id: 'pettyCash', cat: 'Production', label: 'Petty Cash Log', icon: 'money', default: false },
                { id: 'po', cat: 'Production', label: 'Purchase Order', icon: 'receipt', default: false },
                { id: 'timecard', cat: 'Production', label: 'Timecards', icon: 'history', default: false },
                { id: 'riskAI', cat: 'Production', label: 'AI Risk Assessment', icon: 'sparkle', default: false },
                { id: 'carbon', cat: 'Production', label: 'Carbon Calculator', icon: 'sparkle', default: false },
                /* --- POST & LEGAL --- */
                {
                    id: 'talentAgr', cat: 'Legal', label: 'Talent Agreement', icon: 'check', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'terms', x: 0, w: 12, h: 14, type: 'richText', label: "Contract Terms & Conditions", autoPosition: true }
                    ],
                    defaults: { additional: { terms: "STANDARD AGREEMENT\n\n1. Services..\n2. Compensation.." } }
                },
                {
                    id: 'dealMemo', cat: 'Legal', label: 'Crew Deal Memo', icon: 'file', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'terms', x: 0, w: 12, h: 10, type: 'richText', label: "Terms of Agreement", autoPosition: true }
                    ],
                    defaults: { additional: { terms: "DEAL MEMO\n\nName:\nRole:\nRate:" } }
                },
                {
                    id: 'permit', cat: 'Legal', label: 'Filming Permit', icon: 'file', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'details', x: 0, w: 12, h: 10, type: 'richText', label: "Permit Details", autoPosition: true }
                    ],
                    defaults: { additional: { details: "PERMIT #:\nLOCATION:\nRESTRICTIONS:" } }
                },
                {
                    id: 'insurance', cat: 'Legal', label: 'Insurance Cert', icon: 'lock', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'details', x: 0, w: 12, h: 10, type: 'richText', label: "Coverage Details", autoPosition: true }
                    ],
                    defaults: { additional: { details: "INSURER:\nPOLICY #:\nCOVERAGE:" } }
                },
                { id: 'vfxBreak', cat: 'Post-Prod', label: 'VFX Breakdown', icon: 'hazard', default: false },
                { id: 'postSched', cat: 'Post-Prod', label: 'Post Schedule', icon: 'calendar', default: true },
                { id: 'delivery', cat: 'Post-Prod', label: 'Delivery Schedule', icon: 'folder', default: false },
                { id: 'festTrack', cat: 'Post-Prod', label: 'Festival Tracker', icon: 'sparkle', default: false },
                { id: 'locRel', cat: 'Legal', label: 'Location Release', icon: 'mapPin', default: true },
                { id: 'kitRental', cat: 'Legal', label: 'Kit Rental Agreement', icon: 'camera', default: false },
                { id: 'covid', cat: 'Legal', label: 'COVID Protocols', icon: 'hazard', default: false },
                { id: 'sag', cat: 'Legal', label: 'SAG-AFTRA Paperwork', icon: 'sparkle', default: false }
            ];
            this.templates.length = 0;
            for (var i = 0; i < t.length; i++) { this.templates.push(t[i]); }
        },

        /* ========= JAMAICA 2025 INDUSTRY RATE DATABASE ========= */
        /*
         * These rates are the result of years of asking around, cross-referencing
         * quotes, and comparing actual invoices. They are not official. There is no
         * official source. That is the point.
         *
         * All rates in JMD. Apply mBTOG.settings.regionMultiplier for other markets.
         */
        _getJamaicaDatabase: function () {
            return [
                /* Pre-Production */
                { description: 'Storyboard Artist', unit: 'Day', rate: 45000 },
                { description: 'Copywriter (Pitch/Treatment)', unit: 'Flat', rate: 115000 }, /* ~$750 USD */
                { description: 'Script Consultant / Doctor', unit: 'Flat', rate: 230000 }, /* ~$1500 USD */
                { description: 'Pitch Deck Designer', unit: 'Flat', rate: 120000 },
                { description: 'Researcher', unit: 'Day', rate: 38750 }, /* ~$250 USD */
                { description: 'Concept Artist', unit: 'Day', rate: 55000 },
                { description: 'Legal - Rights & Clearances', unit: 'Flat', rate: 387500 }, /* ~$2500 USD */
                /* Above-the-Line */
                { description: 'Director', unit: 'Day', rate: 285000 }, /* $1850 Midpoint * 155 */
                { description: 'Executive Producer', unit: 'Flat', rate: 500000 },
                { description: 'Producer', unit: 'Day', rate: 155000 }, /* ~$1000 USD */
                { description: 'Line Producer', unit: 'Day', rate: 115000 }, /* ~$750 USD */
                { description: 'Screenwriter', unit: 'Flat', rate: 465000 }, /* $3000 USD */
                { description: 'Cast - Lead', unit: 'Day', rate: 100000 },
                { description: 'Cast - Supporting', unit: 'Day', rate: 50000 },
                { description: 'Casting Director', unit: 'Day', rate: 100000 }, /* ~$650 USD */
                { description: 'Stunt Coordinator', unit: 'Day', rate: 77500 }, /* $500 USD */
                /* Production Office */
                { description: 'Unit Production Manager (UPM)', unit: 'Day', rate: 93000 }, /* $600 USD */
                { description: 'Production Coordinator', unit: 'Day', rate: 46500 }, /* $300 USD */
                { description: '1st Assistant Director (1st AD)', unit: 'Day', rate: 100000 }, /* $650 USD */
                { description: '2nd Assistant Director', unit: 'Day', rate: 70000 },
                { description: '2nd 2nd AD', unit: 'Day', rate: 38750 },
                { description: 'Key PA', unit: 'Day', rate: 31000 },
                { description: 'Set PA', unit: 'Day', rate: 23250 },
                { description: 'Office PA', unit: 'Day', rate: 23250 },
                { description: 'Truck PA', unit: 'Day', rate: 27900 },
                { description: 'Location Manager', unit: 'Day', rate: 77500 },
                { description: 'Location Scout', unit: 'Day', rate: 54250 },
                { description: 'Script Supervisor', unit: 'Day', rate: 62000 },
                { description: 'Medic / Set Nurse', unit: 'Day', rate: 54250 },
                { description: 'Production Accountant', unit: 'Day', rate: 85250 }, /* ~$550 USD */
                { description: 'Still Photographer', unit: 'Day', rate: 69750 }, /* ~$450 USD */
                { description: 'Publicist', unit: 'Day', rate: 77500 }, /* ~$500 USD */
                { description: 'Security Guard', unit: 'Day', rate: 18600 },
                { description: 'Craft Service', unit: 'Day', rate: 38750 },
                { description: 'Catering (Per Head)', unit: 'Flat', rate: 3500 },
                /* Camera */
                { description: 'Director of Photography (DP)', unit: 'Day', rate: 178250 }, /* $1150 Midpoint * 155 */
                { description: 'Camera Operator', unit: 'Day', rate: 93000 }, /* $600 USD */
                { description: '1st Assistant Camera (Focus)', unit: 'Day', rate: 62000 }, /* $400 Midpoint * 155 */
                { description: '2nd Assistant Camera', unit: 'Day', rate: 46500 },
                { description: 'Digital Imaging Tech (DIT)', unit: 'Day', rate: 77500 },
                { description: 'Steadicam Operator', unit: 'Day', rate: 108500 },
                { description: 'Drone Operator', unit: 'Day', rate: 85250 },
                { description: 'Camera Utility', unit: 'Day', rate: 38750 },
                /* Lighting & Grip */
                { description: 'Gaffer', unit: 'Day', rate: 73625 }, /* $475 Midpoint * 155 */
                { description: 'Best Boy Electric', unit: 'Day', rate: 54250 },
                { description: 'Electrician', unit: 'Day', rate: 46500 },
                { description: 'Key Grip', unit: 'Day', rate: 73625 }, /* Matches Gaffer */
                { description: 'Best Boy Grip', unit: 'Day', rate: 54250 },
                { description: 'Dolly Grip', unit: 'Day', rate: 54250 },
                { description: 'Grip', unit: 'Day', rate: 46500 },
                { description: 'Generator Operator', unit: 'Day', rate: 54250 },
                /* Sound */
                { description: 'Sound Mixer', unit: 'Day', rate: 96875 }, /* $625 Midpoint * 155 */
                { description: 'Boom Operator', unit: 'Day', rate: 54250 },
                { description: 'Sound Utility', unit: 'Day', rate: 38750 },
                /* Art & Wardrobe */
                { description: 'Production Designer', unit: 'Day', rate: 100750 },
                { description: 'Art Director', unit: 'Day', rate: 77500 },
                { description: 'Set Decorator', unit: 'Day', rate: 69750 },
                { description: 'Set Dresser', unit: 'Day', rate: 46500 },
                { description: 'Props Master', unit: 'Day', rate: 69750 },
                { description: 'Assistant Props', unit: 'Day', rate: 46500 },
                { description: 'Costume Designer', unit: 'Day', rate: 85250 },
                { description: 'Wardrobe Stylist', unit: 'Day', rate: 69750 },
                { description: 'Wardrobe Assistant', unit: 'Day', rate: 38750 },
                /* Hair & Makeup */
                { description: 'Makeup Artist (Key)', unit: 'Day', rate: 69750 },
                { description: 'Hair Stylist (Key)', unit: 'Day', rate: 69750 },
                { description: 'Makeup/Hair Assistant', unit: 'Day', rate: 38750 },
                /* Post-Production */
                { description: 'Post-Production Supervisor', unit: 'Week', rate: 310000 },
                { description: 'Editor', unit: 'Day', rate: 77500 },
                { description: 'Assistant Editor (AE)', unit: 'Day', rate: 38750 },
                { description: 'Colorist', unit: 'Hour', rate: 23250 },
                { description: 'VFX Supervisor', unit: 'Day', rate: 108500 },
                { description: 'VFX Artist', unit: 'Day', rate: 85250 },
                { description: 'Sound Designer', unit: 'Flat', rate: 232500 },
                { description: 'Composer', unit: 'Flat', rate: 310000 },
                { description: 'Music Supervisor', unit: 'Flat', rate: 155000 }
            ];
        },

        /* ========= PHASE 172: REGIONAL DEFAULT DATABASES =========
         * Per-region researched market rates sourced from RegionalRateAccuracy.md.
         * Each entry includes its native currency (USD/GBP/CAD/AUD) — these are
         * sovereign rates per region, NOT JMD numbers waiting to be converted.
         * Region switch substitutes these directly via _computeLocalAverages().
         *
         * Sources cited per region:
         * - Trinidad/Barbados: Atlas Film Fixers + Regional Avg (USD)
         * - UK: BECTU Camera Branch 2025 (GBP)
         * - USA: IATSE Local 600 LBTA Tier 1A (USD hourly × 10hr day) + DGA Low Budget Level 3 (USD weekly ÷ 5)
         * - Australia: MEAA MPPA 2025 (AUD weekly ÷ 5)
         * - Canada: BCCFU Tier 1 (Vancouver) IATSE 891 / IATSE 873 (Toronto) (CAD hourly × 10hr day)
         */

        _getTrinidadDatabase: function () {
            return [
                { description: 'Director', unit: 'Day', rate: 2500, region: 'Trinidad', currency: 'USD', source: 'default' },
                { description: 'Director of Photography (DP)', unit: 'Day', rate: 1400, region: 'Trinidad', currency: 'USD', source: 'default' },
                { description: 'Gaffer', unit: 'Day', rate: 600, region: 'Trinidad', currency: 'USD', source: 'default' },
                { description: 'Sound Mixer', unit: 'Day', rate: 750, region: 'Trinidad', currency: 'USD', source: 'default' },
                { description: 'VFX Artist', unit: 'Day', rate: 750, region: 'Trinidad', currency: 'USD', source: 'default' },
                { description: 'Sound Designer', unit: 'Flat', rate: 600, region: 'Trinidad', currency: 'USD', source: 'default' },
                { description: 'Cast - Lead', unit: 'Day', rate: 1200, region: 'Trinidad', currency: 'USD', source: 'default' },
                { description: 'Casting Director', unit: 'Day', rate: 650, region: 'Trinidad', currency: 'USD', source: 'default' }
            ];
        },

        _getBarbadosDatabase: function () {
            return [
                { description: 'Director', unit: 'Day', rate: 2500, region: 'Barbados', currency: 'USD', source: 'default' },
                { description: 'Director of Photography (DP)', unit: 'Day', rate: 1400, region: 'Barbados', currency: 'USD', source: 'default' },
                { description: 'Camera Operator', unit: 'Day', rate: 900, region: 'Barbados', currency: 'USD', source: 'default' },
                { description: '1st Assistant Camera (Focus)', unit: 'Day', rate: 600, region: 'Barbados', currency: 'USD', source: 'default' },
                { description: 'Gaffer', unit: 'Day', rate: 600, region: 'Barbados', currency: 'USD', source: 'default' },
                { description: 'Sound Mixer', unit: 'Day', rate: 700, region: 'Barbados', currency: 'USD', source: 'default' }
            ];
        },

        /* UK: BECTU Camera Branch 2025 — TV Band 1 / MMP, 10hr day, GBP. */
        _getUKDatabase: function () {
            return [
                { description: 'Director', unit: 'Day', rate: 1500, region: 'UK', currency: 'GBP', source: 'default' },
                { description: 'Producer', unit: 'Day', rate: 1200, region: 'UK', currency: 'GBP', source: 'default' },
                { description: 'Director of Photography (DP)', unit: 'Day', rate: 1600, region: 'UK', currency: 'GBP', source: 'default' },
                { description: 'Gaffer', unit: 'Day', rate: 680, region: 'UK', currency: 'GBP', source: 'default' },
                { description: 'Sound Mixer', unit: 'Day', rate: 800, region: 'UK', currency: 'GBP', source: 'default' },
                { description: 'Editor', unit: 'Day', rate: 750, region: 'UK', currency: 'GBP', source: 'default' },
                { description: 'VFX Artist', unit: 'Day', rate: 650, region: 'UK', currency: 'GBP', source: 'default' },
                { description: 'Sound Designer', unit: 'Flat', rate: 500, region: 'UK', currency: 'GBP', source: 'default' },
                { description: 'Music Supervisor', unit: 'Flat', rate: 600, region: 'UK', currency: 'GBP', source: 'default' },
                { description: 'Cast - Lead', unit: 'Day', rate: 1200, region: 'UK', currency: 'GBP', source: 'default' },
                { description: 'Casting Director', unit: 'Day', rate: 500, region: 'UK', currency: 'GBP', source: 'default' }
            ];
        },

        /* USA: IATSE Local 600 LBTA Tier 1A 2025 (11x Hourly for 10hr Day) + DGA Low Budget Level 3 (Weekly ÷ 5).
           Reflects Tier 1A ($3M-$6.25M) verified union minimums. */
        _getUSADatabase: function () {
            return [
                { description: 'Director', unit: 'Day', rate: 900, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Producer', unit: 'Day', rate: 800, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Line Producer', unit: 'Day', rate: 700, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Director of Photography (DP)', unit: 'Day', rate: 590, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Camera Operator', unit: 'Day', rate: 413, region: 'USA', currency: 'USD', source: 'default' },
                { description: '1st Assistant Camera (Focus)', unit: 'Day', rate: 325, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'DIT', unit: 'Day', rate: 590, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Unit Production Manager (UPM)', unit: 'Day', rate: 911, region: 'USA', currency: 'USD', source: 'default' },
                { description: '1st Assistant Director (1st AD)', unit: 'Day', rate: 867, region: 'USA', currency: 'USD', source: 'default' },
                { description: '2nd Assistant Director', unit: 'Day', rate: 557, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Gaffer', unit: 'Day', rate: 600, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Key Grip', unit: 'Day', rate: 600, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Sound Mixer', unit: 'Day', rate: 750, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Production Designer', unit: 'Day', rate: 750, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Art Director', unit: 'Day', rate: 544, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Makeup Artist (Key)', unit: 'Day', rate: 550, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Wardrobe Stylist', unit: 'Day', rate: 550, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Editor', unit: 'Day', rate: 533, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Assistant Editor', unit: 'Day', rate: 350, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'VFX Artist', unit: 'Day', rate: 750, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'VFX Supervisor', unit: 'Day', rate: 950, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Sound Designer', unit: 'Flat', rate: 600, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Music Supervisor', unit: 'Flat', rate: 750, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Cast - Lead', unit: 'Day', rate: 1500, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Location Manager', unit: 'Day', rate: 650, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Catering (Per Head)', unit: 'Flat', rate: 45, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Script Supervisor', unit: 'Day', rate: 550, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Production Accountant', unit: 'Day', rate: 650, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Stunt Coordinator', unit: 'Day', rate: 1100, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Publicist', unit: 'Day', rate: 600, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Colorist', unit: 'Day', rate: 800, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Copywriter (Pitch/Treatment)', unit: 'Flat', rate: 750, region: 'USA', currency: 'USD', source: 'default' },
                { description: 'Casting Director', unit: 'Day', rate: 650, region: 'USA', currency: 'USD', source: 'default' }
            ];
        },

        /* Canada: BCCFU Tier 1 / IATSE 891 / IATSE 873 (2025). (11x Hourly for 10hr Day). CAD. */
        _getCanadaDatabase: function () {
            return [
                { description: 'Director', unit: 'Day', rate: 2200, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'Producer', unit: 'Day', rate: 1800, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'Director of Photography (DP)', unit: 'Day', rate: 1800, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'Gaffer', unit: 'Day', rate: 850, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'Key Grip', unit: 'Day', rate: 850, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'Sound Mixer', unit: 'Day', rate: 1100, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'Editor', unit: 'Day', rate: 800, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'VFX Artist', unit: 'Day', rate: 850, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'Sound Designer', unit: 'Flat', rate: 750, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'Music Supervisor', unit: 'Flat', rate: 800, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'Cast - Lead', unit: 'Day', rate: 1800, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'Location Manager', unit: 'Day', rate: 750, region: 'Canada', currency: 'CAD', source: 'default' },
                { description: 'Casting Director', unit: 'Day', rate: 850, region: 'Canada', currency: 'CAD', source: 'default' }
            ];
        },

        /* Australia: MEAA MPPA 2025 Market Averages. (Weekly ÷ 5 for Day Rate). AUD. */
        _getAustraliaDatabase: function () {
            return [
                { description: 'Director', unit: 'Day', rate: 2500, region: 'Australia', currency: 'AUD', source: 'default' },
                { description: 'Producer', unit: 'Day', rate: 2200, region: 'Australia', currency: 'AUD', source: 'default' },
                { description: 'Director of Photography (DP)', unit: 'Day', rate: 1800, region: 'Australia', currency: 'AUD', source: 'default' },
                { description: 'Gaffer', unit: 'Day', rate: 850, region: 'Australia', currency: 'AUD', source: 'default' },
                { description: 'Key Grip', unit: 'Day', rate: 850, region: 'Australia', currency: 'AUD', source: 'default' },
                { description: 'Sound Mixer', unit: 'Day', rate: 1200, region: 'Australia', currency: 'AUD', source: 'default' },
                { description: 'Editor', unit: 'Day', rate: 850, region: 'Australia', currency: 'AUD', source: 'default' },
                { description: 'VFX Artist', unit: 'Day', rate: 950, region: 'Australia', currency: 'AUD', source: 'default' },
                { description: 'Sound Designer', unit: 'Flat', rate: 750, region: 'Australia', currency: 'AUD', source: 'default' },
                { description: 'Music Supervisor', unit: 'Flat', rate: 850, region: 'Australia', currency: 'AUD', source: 'default' },
                { description: 'Cast - Lead', unit: 'Day', rate: 1800, region: 'Australia', currency: 'AUD', source: 'default' },
                { description: 'Casting Director', unit: 'Day', rate: 850, region: 'Australia', currency: 'AUD', source: 'default' }
            ];
        },

        /* Aggregator — returns ALL regional defaults concatenated. Jamaica entries
           are tagged with region:'Jamaica', currency:'JMD', source:'default' on the fly
           so they participate in the substitution lookup table.
           Called by loadRates() on first install AND used by _computeLocalAverages()
           to seed the substitution map even when no community data is synced. */
        _getAllRegionalDefaults: function () {
            var jm = this._getJamaicaDatabase();
            var taggedJM = [];
            for (var i = 0; i < jm.length; i++) {
                taggedJM.push({
                    description: jm[i].description,
                    unit: jm[i].unit,
                    rate: jm[i].rate,
                    region: 'Jamaica',
                    currency: 'JMD',
                    source: 'default'
                });
            }
            return taggedJM
                .concat(this._getTrinidadDatabase())
                .concat(this._getBarbadosDatabase())
                .concat(this._getUKDatabase())
                .concat(this._getUSADatabase())
                .concat(this._getCanadaDatabase())
                .concat(this._getAustraliaDatabase());
        },

        /* Intelligence Footer strings — surfaced in the rates UI to cite accuracy. */
        _getRegionIntelligence: function (region) {
            var map = {
                'Jamaica':   'INTELLIGENCE: RATES BASED ON AGGREGATED HISTORICAL INVOICING. NO FORMAL UNION SCALES EXIST. NEGOTIATIONS BESPOKE PER PROJECT.',
                'Trinidad':  'INTELLIGENCE: RATES BASED ON AGGREGATED HISTORICAL INVOICING. NO FORMAL UNION SCALES EXIST. NEGOTIATIONS BESPOKE PER PROJECT.',
                'Barbados':  'INTELLIGENCE: RATES BASED ON AGGREGATED HISTORICAL INVOICING. NO FORMAL UNION SCALES EXIST. NEGOTIATIONS BESPOKE PER PROJECT.',
                'Guyana':    'INTELLIGENCE: RATES BASED ON AGGREGATED HISTORICAL INVOICING. NO FORMAL UNION SCALES EXIST. NEGOTIATIONS BESPOKE PER PROJECT.',
                'USA':       'INTELLIGENCE: ESTIMATES REFLECT IATSE / DGA LOW-TIER AVERAGES (2025). EXCLUDES FRINGES, OVERTIME, AND MEAL PENALTIES.',
                'UK':        'INTELLIGENCE: ESTIMATES TARGET BECTU 2025 RECOMMENDED RATES. SUBJECT TO PACT/BECTU TERMS & CONDITIONS.',
                'Australia': 'INTELLIGENCE: RATES ALIGN WITH FWC MA000091 MODERN AWARD (2025). FINAL TOTALS REQUIRE SUPERANNUATION ADJUSTMENT.',
                'Canada':    'INTELLIGENCE: ESTIMATES REFLECT BCCFU TIER 1 & IATSE 873 (2025). LOCAL PROVINCIAL TAX INCENTIVES NOT APPLIED.'
            };
            return map[region] || '';
        }
    };

    window.mBTOG = mBTOG;
    window.mBTOG.cloud = { url: OG_CLOUD_URL, key: OG_CLOUD_KEY };

})();
