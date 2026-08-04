/**
 * mBT OpenGate — App Shell Adapter
 *
 * The core Open Gate engine lives in src/scripts/engine/opengate.js and is
 * shared between the Budget Editor and this App Shell. This file handles
 * Shell-specific concerns only: seeding the og_ref IndexedDB store,
 * rendering the OpenGate panel in the Shell UI, and registering the route.
 *
 * For the full Open Gate ethos and data engine, see:
 *   src/scripts/engine/opengate.js
 */

(function () {
    'use strict';

    window.mBT = window.mBT || {};
    window.mBT.services = window.mBT.services || {};

    var OpenGateShell = {

        /**
         * Initialize — delegates to the shared engine, then seeds og_ref store.
         */
        init: function () {
            if (!window.mBTOG) {
                return Promise.resolve();
            }
            return window.mBTOG.init().then(function () {
                OpenGateShell.seedDefaults();
            });
        },

        /**
         * Seed the Shell's og_ref IndexedDB store from the shared engine rates.
         * Only seeds if the store is empty.
         */
        seedDefaults: function () {
            if (!window.mBT.storage || !window.mBTOG) return;
            var rates = window.mBTOG.rates || [];
            window.mBT.storage.getDb().then(function (db) {
                var tx = db.transaction('og_ref', 'readonly');
                var store = tx.objectStore('og_ref');
                var req = store.count();
                req.onsuccess = function () {
                    if (req.result > 0) return;
                    var writeTx = db.transaction('og_ref', 'readwrite');
                    var writeStore = writeTx.objectStore('og_ref');
                    rates.forEach(function (item, i) {
                        writeStore.put({
                            id: 'og_jamaica_' + i,
                            category: 'crew_rates',
                            label: item.description,
                            value: item.rate,
                            unit: item.unit,
                            currency: 'JMD'
                        });
                    });
                };
            }).catch(function () {});
        },

        /**
         * Render the OpenGate reference panel in the App Shell.
         */
        render: function () {
            var list = document.getElementById('opengate-list');
            if (!list || !window.mBT.storage) return;

            window.mBT.storage.getDb().then(function (db) {
                var tx = db.transaction('og_ref', 'readonly');
                var store = tx.objectStore('og_ref');
                var req = store.getAll();
                req.onsuccess = function () {
                    var items = req.result || [];
                    if (items.length === 0) {
                        list.innerHTML = '<div class="service-item"><div class="svc-info">No reference data found. Open the Budget Editor to seed rates.</div></div>';
                        return;
                    }
                    list.innerHTML = items.map(function (item) {
                        var val = window.mBT.le ? window.mBT.le.formatCurrency(item.value, item.currency) : (item.value + ' ' + (item.currency || 'JMD'));
                        return '<div class="service-item">' +
                            '<div class="svc-info"><div class="svc-name">' + (item.label || item.id) + '</div>' +
                            '<div class="svc-desc">' + val + ' / ' + (item.unit || 'Day') + '</div></div>' +
                            '<span class="svc-status ready">active</span></div>';
                    }).join('');
                };
            }).catch(function () {
                list.innerHTML = '<div class="service-item"><div class="svc-info">Storage unavailable.</div></div>';
            });
        }
    };

    window.mBT.services.opengate = OpenGateShell;

    /* Register Shell route */
    if (window.mBT.core && window.mBT.core.routes) {
        window.mBT.core.routes.register('opengate', function () {
            OpenGateShell.render();
        });
    }

    /* Delayed init — waits for shared engine and storage to be ready */
    setTimeout(function () { OpenGateShell.init(); }, 1000);

})();
