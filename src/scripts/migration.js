/**
 * Legacy Migration Utility (JavaScript Version)
 * Migrate localStorage/localforage → IndexedDB
 *
 * Handles three legacy storage formats:
 *   1. prodBudget_v5_<projectName> — project budget data (localforage/localStorage)
 *   2. prodBudget_v5_globalItems   — OpenGate rates (localforage/localStorage)
 *   3. moo_contacts                — contacts database (localforage/localStorage)
 *   4. mBT_projects (old format)   — early localStorage project list
 */

var MigrationHelper = {
    _migrated: false,

    /**
     * Run full migration sequence. Safe to call multiple times — skips if already done.
     * Returns a Promise that resolves with the migration report.
     */
    run: function () {
        var self = this;

        if (this._migrated) {
            return Promise.resolve({ skipped: true });
        }

        var report = { projects: 0, rates: 0, contacts: 0, errors: [] };

        return this._migrateV5Projects(report)
            .then(function () { return self._migrateOldFormatProjects(report); })
            .then(function () { return self._migrateRates(report); })
            .then(function () { return self._migrateContacts(report); })
            .then(function () {
                self._migrated = true;
                console.log('[Migration] Complete — ' + report.projects + ' projects, ' + report.rates + ' rates, ' + report.contacts + ' contacts migrated.');
                if (report.errors.length > 0) {
                    console.warn('[Migration] Errors:', report.errors);
                }
                return report;
            })
            .catch(function (err) {
                report.errors.push({ source: 'migration', message: String(err) });
                return report;
            });
    },

    /**
     * Migrate prodBudget_v5_* project data from localforage/localStorage into IndexedDB
     */
    _migrateV5Projects: function (report) {
        var self = this;
        var prefix = 'prodBudget_v5_';
        var lastLoaded = localStorage.getItem(prefix + 'lastLoaded');

        if (!lastLoaded) return Promise.resolve();

        return this._loadLegacy(prefix + lastLoaded).then(function (data) {
            if (!data) return;

            if (!data.id) data.id = data.projectName || 'default';
            if (!data.name) data.name = data.projectName || 'Untitled';

            return window.mBT.storage.getProject(data.id).then(function (existing) {
                if (existing) return; // Already migrated

                return window.mBT.storage.updateProject(data).then(function () {
                    report.projects++;
                });
            });
        }).catch(function (err) {
            report.errors.push({ source: 'v5_projects', message: String(err) });
        });
    },

    /**
     * Migrate old mBT_projects localStorage format
     */
    _migrateOldFormatProjects: function (report) {
        var raw = localStorage.getItem('mBT_projects');
        if (!raw) return Promise.resolve();

        var projects;
        try {
            projects = JSON.parse(raw);
        } catch (e) {
            report.errors.push({ source: 'old_projects', message: 'Failed to parse mBT_projects' });
            return Promise.resolve();
        }

        if (!Array.isArray(projects) || projects.length === 0) return Promise.resolve();

        var chain = Promise.resolve();
        for (var i = 0; i < projects.length; i++) {
            (function (project) {
                chain = chain.then(function () {
                    if (!project.id) project.id = 'p_migrated_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                    if (!project.created) project.created = new Date().toISOString();

                    return window.mBT.storage.getProject(project.id).then(function (existing) {
                        if (existing) return;

                        return window.mBT.storage.updateProject({
                            id: project.id,
                            name: project.name || 'Untitled',
                            budget: project.budget || 0,
                            currency: project.currency || 'JMD',
                            status: project.status || 'active',
                            created: project.created
                        }).then(function () {
                            report.projects++;

                            // Migrate nested stages if present
                            if (project.data && Array.isArray(project.data.stages)) {
                                var stageChain = Promise.resolve();
                                for (var j = 0; j < project.data.stages.length; j++) {
                                    (function (stage) {
                                        stageChain = stageChain.then(function () {
                                            return window.mBT.storage.createStage({
                                                name: stage.name || 'Untitled Stage',
                                                budget: stage.budget || 0,
                                                allocated: stage.allocated || [],
                                                completed: stage.completed || [],
                                                projectId: project.id
                                            });
                                        });
                                    })(project.data.stages[j]);
                                }
                                return stageChain;
                            }
                        });
                    });
                }).catch(function (err) {
                    report.errors.push({ source: 'old_project', message: String(err), projectName: project.name });
                });
            })(projects[i]);
        }

        return chain;
    },

    /**
     * Migrate OpenGate rates from prodBudget_v5_globalItems
     */
    _migrateRates: function (report) {
        return this._loadLegacy('prodBudget_v5_globalItems').then(function (rates) {
            if (!rates || !Array.isArray(rates) || rates.length === 0) return;

            var chain = Promise.resolve();
            for (var i = 0; i < rates.length; i++) {
                (function (rate, idx) {
                    chain = chain.then(function () {
                        return window.mBT.storage.createOGItem({
                            category: 'crew_rates',
                            label: rate.description || rate.label || 'Unknown',
                            value: rate.rate || rate.value || 0,
                            unit: rate.unit || 'Day',
                            currency: 'JMD'
                        }).then(function () {
                            report.rates++;
                        });
                    });
                })(rates[i], i);
            }

            return chain;
        }).catch(function (err) {
            report.errors.push({ source: 'rates', message: String(err) });
        });
    },

    /**
     * Migrate contacts from moo_contacts
     */
    _migrateContacts: function (report) {
        return this._loadLegacy('moo_contacts').then(function (contacts) {
            if (!contacts || !Array.isArray(contacts) || contacts.length === 0) return;

            return window.mBT.storage.getDb().then(function (db) {
                var tx = db.transaction('contacts', 'readwrite');
                var store = tx.objectStore('contacts');

                for (var i = 0; i < contacts.length; i++) {
                    var c = contacts[i];
                    store.put({
                        id: c.id || ('c_migrated_' + Date.now() + '_' + i),
                        name: c.name || 'Unknown',
                        role: c.role || 'Crew',
                        phone: c.phone || '',
                        email: c.email || '',
                        category: c.category || 'Crew',
                        contact: c.contact || c.phone || c.email || ''
                    });
                    report.contacts++;
                }

                return new Promise(function (resolve, reject) {
                    tx.oncomplete = function () { resolve(); };
                    tx.onerror = function () { reject(tx.error); };
                });
            });
        }).catch(function (err) {
            report.errors.push({ source: 'contacts', message: String(err) });
        });
    },

    /**
     * Load from localforage first, then localStorage fallback
     */
    _loadLegacy: function (key) {
        if (typeof localforage !== 'undefined') {
            return localforage.getItem(key).then(function (data) {
                if (data) return data;
                var raw = localStorage.getItem(key);
                if (raw) { try { return JSON.parse(raw); } catch (e) { } }
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

    /**
     * Remove legacy localStorage keys after successful migration
     */
    cleanup: function () {
        var keysToRemove = ['mBT_projects', 'mBT_stages', 'mBT_executions', 'mBT_credentials'];

        // Also remove prodBudget_v5_ keys
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf('prodBudget_v5_') === 0) {
                keysToRemove.push(key);
            }
        }

        for (var j = 0; j < keysToRemove.length; j++) {
            localStorage.removeItem(keysToRemove[j]);
        }

        console.log('[Migration] Legacy localStorage cleared (' + keysToRemove.length + ' keys)');
    },

    generateReport: function (result) {
        var lines = [];
        lines.push('=== MIGRATION REPORT ===');
        lines.push('Projects Migrated: ' + (result.projects || 0));
        lines.push('Rates Migrated: ' + (result.rates || 0));
        lines.push('Contacts Migrated: ' + (result.contacts || 0));
        lines.push('Errors: ' + (result.errors ? result.errors.length : 0));

        if (result.errors && result.errors.length > 0) {
            lines.push('');
            lines.push('=== ERRORS ===');
            for (var i = 0; i < result.errors.length; i++) {
                var err = result.errors[i];
                lines.push((i + 1) + '. [' + err.source + '] ' + err.message);
            }
        }

        return lines.join('\n');
    }
};

// === GLOBAL EXPORT ===
window.mBT = window.mBT || {};
window.mBT.migration = MigrationHelper;

