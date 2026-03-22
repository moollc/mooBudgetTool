/**
 * mBTStorage — IndexedDB Wrapper (JavaScript Version)
 * Unified data persistence layer for mBT
 * 
 * @module scripts/storage
 */

// === DB CONSTANTS ===

var DB_NAME = 'mBT_DB';
var DB_VERSION = 3;

var STORE_NAMES = {
  PROJECTS: 'mbt_projects',
  STAGES: 'mbt_stages',
  EXECUTIONS: 'mbt_executions',
  OG_REF: 'og_ref',
  GENERIC: 'mbt_generic',
  CONTACTS: 'contacts',
  SESSIONS: 'sessions',
  TOMBSTONES: 'mbt_tombstones',
};

// === STORAGE CLASS ===

var mBTStorage = {
  // Phase 16: Monolith Bridge (Async Support for localforage)
  getMonolithBudget: function() {
    const prefix = 'prodBudget_v5_';
    const lastLoaded = localStorage.getItem(prefix + 'lastLoaded');
    if (!lastLoaded) return Promise.resolve(null);
    const projectKey = prefix + lastLoaded;
    
    const tryFallback = () => {
        const raw = localStorage.getItem(projectKey);
        if (raw) {
          try { 
            const data = JSON.parse(raw);
            if (data && !data.id) data.id = data.projectName || 'default';
            return data;
          } catch(e) {}
        }
        return null;
    };

    if (typeof localforage !== 'undefined') {
       return localforage.getItem(projectKey).then(function(data) {
          if (data) {
            if (!data.id) data.id = data.projectName || 'default';
            return data;
          }
          return tryFallback();
       }).catch(tryFallback);
    } else {
       return Promise.resolve(tryFallback());
    }
  },

  _db: null,
  _dbPromise: null,

  getDb: function () {
    if (this._db) return Promise.resolve(this._db);

    if (!this._dbPromise) {
      this._dbPromise = this._openDB();
    }

    return this._dbPromise;
  },

  _getDb: function () {
    return this.getDb();
  },

  _openDB: function () {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = function () {
        var err = request.error;
        if (err && err.name === 'QuotaExceededError') {
            window.dispatchEvent(new CustomEvent('mbt:quota-exceeded', { detail: { store: 'DB open' } }));
        }
        reject(err);
      };

      request.onsuccess = function () {
        mBTStorage._db = request.result;
        resolve(mBTStorage._db);
      };

      request.onupgradeneeded = function (event) {
        var db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAMES.PROJECTS)) {
          var projectStore = db.createObjectStore(STORE_NAMES.PROJECTS, { keyPath: 'id' });
          projectStore.createIndex('name', 'name', { unique: false });
          projectStore.createIndex('budget', 'budget', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.STAGES)) {
          var stageStore = db.createObjectStore(STORE_NAMES.STAGES, { keyPath: 'id' });
          stageStore.createIndex('projectId', 'projectId', { unique: false });
          stageStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.EXECUTIONS)) {
          var execStore = db.createObjectStore(STORE_NAMES.EXECUTIONS, { keyPath: 'id' });
          execStore.createIndex('projectId', 'projectId', { unique: false });
          execStore.createIndex('stageId', 'stageId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.OG_REF)) {
          var ogStore = db.createObjectStore(STORE_NAMES.OG_REF, { keyPath: 'id' });
          ogStore.createIndex('category', 'category', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.GENERIC)) {
          db.createObjectStore(STORE_NAMES.GENERIC, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.CONTACTS)) {
          var contactStore = db.createObjectStore(STORE_NAMES.CONTACTS, { keyPath: 'id' });
          contactStore.createIndex('name', 'name', { unique: false });
          contactStore.createIndex('role', 'role', { unique: false });
          contactStore.createIndex('category', 'category', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.SESSIONS)) {
          db.createObjectStore(STORE_NAMES.SESSIONS, { keyPath: 'id' });
        }

        /* Sub-Phase 51.1 Group C: Tombstone store for soft-delete propagation */
        if (!db.objectStoreNames.contains(STORE_NAMES.TOMBSTONES)) {
          db.createObjectStore(STORE_NAMES.TOMBSTONES, { keyPath: 'id' });
        }
      };
    });
  },

  close: function () {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
    this._dbPromise = null;
  },

  // === PROJECT STORE ===

  createProject: function (project) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.PROJECTS], 'readwrite').objectStore(STORE_NAMES.PROJECTS);
      var newProject = {
        name: project.name,
        budget: project.budget,
        currency: project.currency,
        status: project.status,
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        created: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      var request = store.add(newProject);
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () {
          resolve(self.getProject(newProject.id));
        };
        request.onerror = function () {
          var err = request.error;
          if (err && err.name === 'QuotaExceededError') {
              window.dispatchEvent(new CustomEvent('mbt:quota-exceeded', { detail: { store: STORE_NAMES.PROJECTS } }));
          }
          reject(err);
        };
      });
    });
  },

  getProject: function (id) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction(STORE_NAMES.PROJECTS, 'readonly').objectStore(STORE_NAMES.PROJECTS);
      return new Promise(function (resolve, reject) {
        var request = store.get(id);
        request.onsuccess = function () {
          resolve(request.result);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  updateProject: function (project) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.PROJECTS], 'readwrite').objectStore(STORE_NAMES.PROJECTS);
      project.updated_at = new Date().toISOString();
      var request = store.put(project);
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () {
          resolve();
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  deleteProject: function (id, skipTombstone) {
    var self = this;
    return this.getDb().then(function (db) {
      var txStores = [STORE_NAMES.PROJECTS, STORE_NAMES.STAGES, STORE_NAMES.EXECUTIONS];
      if (!skipTombstone) txStores.push(STORE_NAMES.TOMBSTONES);
      var tx = db.transaction(txStores, 'readwrite');
      tx.objectStore(STORE_NAMES.PROJECTS).delete(id);

      return new Promise(function (resolve, reject) {
        var stageStore = tx.objectStore(STORE_NAMES.STAGES);
        var stageIndex = stageStore.index('projectId');
        var stageReq = stageIndex.getAll(id);
        stageReq.onsuccess = function () {
          var stages = stageReq.result || [];
          for (var i = 0; i < stages.length; i++) {
            stageStore.delete(stages[i].id);
          }

          var execStore = tx.objectStore(STORE_NAMES.EXECUTIONS);
          var execIndex = execStore.index('projectId');
          var execReq = execIndex.getAll(id);
          execReq.onsuccess = function () {
            var execs = execReq.result || [];
            for (var j = 0; j < execs.length; j++) {
              execStore.delete(execs[j].id);
            }
            /* Write tombstones for project and all its cascaded children */
            if (!skipTombstone) {
              var now = new Date().toISOString();
              var tombStore = tx.objectStore(STORE_NAMES.TOMBSTONES);
              tombStore.put({ id: id, store: 'mbt_projects', deleted_at: now });
              for (var k = 0; k < stages.length; k++) {
                tombStore.put({ id: stages[k].id, store: 'mbt_stages', deleted_at: now });
              }
              for (var m = 0; m < execs.length; m++) {
                tombStore.put({ id: execs[m].id, store: 'mbt_executions', deleted_at: now });
              }
            }
          };
        };

        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  },

  getAllProjects: function () {
    var self = this;
    return this.getMonolithBudget().then(function(monolith) {
      return self._getDb().then(function (db) {
        var store = db.transaction(STORE_NAMES.PROJECTS, 'readonly').objectStore(STORE_NAMES.PROJECTS);
        return new Promise(function (resolve, reject) {
          var request = store.getAll();
          request.onsuccess = function () {
            let results = request.result || [];
            if (monolith) {
              // Merge monolith project, ensuring it's at the top and unique
              results = [monolith, ...results.filter(p => p.id !== monolith.id && p.name !== monolith.projectName)];
            }
            resolve(results);
          };
          request.onerror = function () {
            reject(request.error);
          };
        });
      });
    });
  },

  // === STAGE STORE ===

  createStage: function (stage) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.STAGES], 'readwrite').objectStore(STORE_NAMES.STAGES);
      var newStage = {
        name: stage.name,
        budget: stage.budget,
        allocated: stage.allocated || [],
        completed: stage.completed || [],
        projectId: stage.projectId,
        id: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      var request = store.add(newStage);
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () {
          resolve(self.getStage(newStage.id));
        };
        request.onerror = function () {
          var err = request.error;
          if (err && err.name === 'QuotaExceededError') {
              window.dispatchEvent(new CustomEvent('mbt:quota-exceeded', { detail: { store: STORE_NAMES.STAGES } }));
          }
          reject(err);
        };
      });
    });
  },

  getStage: function (id) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction(STORE_NAMES.STAGES, 'readonly').objectStore(STORE_NAMES.STAGES);
      return new Promise(function (resolve, reject) {
        var request = store.get(id);
        request.onsuccess = function () {
          resolve(request.result);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  updateStage: function (stage) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.STAGES], 'readwrite').objectStore(STORE_NAMES.STAGES);
      stage.updated_at = new Date().toISOString();
      var request = store.put(stage);
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () {
          resolve();
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  deleteStage: function (id, skipTombstone) {
    var self = this;
    return this.getDb().then(function (db) {
      var txStores = [STORE_NAMES.STAGES, STORE_NAMES.EXECUTIONS];
      if (!skipTombstone) txStores.push(STORE_NAMES.TOMBSTONES);
      var tx = db.transaction(txStores, 'readwrite');
      tx.objectStore(STORE_NAMES.STAGES).delete(id);

      return new Promise(function (resolve, reject) {
        var execStore = tx.objectStore(STORE_NAMES.EXECUTIONS);
        var execIndex = execStore.index('stageId');
        var execReq = execIndex.getAll(id);
        execReq.onsuccess = function () {
          var execs = execReq.result || [];
          for (var i = 0; i < execs.length; i++) {
            execStore.delete(execs[i].id);
          }
          if (!skipTombstone) {
            var now = new Date().toISOString();
            var tombStore = tx.objectStore(STORE_NAMES.TOMBSTONES);
            tombStore.put({ id: id, store: 'mbt_stages', deleted_at: now });
            for (var j = 0; j < execs.length; j++) {
              tombStore.put({ id: execs[j].id, store: 'mbt_executions', deleted_at: now });
            }
          }
        };

        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  },

  getStagesByProject: function (projectId) {
    var self = this;
    return this.getMonolithBudget().then(function(monolith) {
      return self._getDb().then(function (db) {
        if (monolith && (projectId === monolith.id || projectId === monolith.projectName)) {
          if (monolith.targetLock && monolith.targetLock.stages) {
            const mStages = Object.entries(monolith.targetLock.stages)
              .filter(([k, s]) => s && (s.days > 0 || s.subtotal > 0))
              .map(([k, s]) => ({
                id: 'monolith_' + k,
                projectId: monolith.id,
                projectName: monolith.projectName,
                description: k.toUpperCase(),
                amount: s.subtotal || 0,
                budgeted: s.totalCap || 0
              }));
            return Promise.resolve(mStages);
          }
        }
        
        var store = db.transaction(STORE_NAMES.STAGES, 'readonly').objectStore(STORE_NAMES.STAGES);
        var index = store.index('projectId');
        return new Promise(function (resolve, reject) {
          var request = index.getAll(projectId);
          request.onsuccess = function () {
            resolve(request.result || []);
          };
          request.onerror = function () {
            reject(request.error);
          };
        });
      });
    });
  },

  getAllStages: function () {
    var self = this;
    return this.getMonolithBudget().then(function(monolith) {
      return self._getDb().then(function (db) {
        var store = db.transaction(STORE_NAMES.STAGES, 'readonly').objectStore(STORE_NAMES.STAGES);
        return new Promise(function (resolve, reject) {
          var request = store.getAll();
          request.onsuccess = function () {
            let results = request.result || [];
            if (monolith && monolith.targetLock && monolith.targetLock.stages) {
              const mStages = Object.entries(monolith.targetLock.stages)
                .filter(([k, s]) => s && (s.days > 0 || s.subtotal > 0))
                .map(([k, s]) => ({
                  id: 'monolith_' + k,
                  projectId: monolith.id,
                  projectName: monolith.projectName,
                  description: k.toUpperCase(),
                  amount: s.subtotal || 0,
                  budgeted: s.totalCap || 0
                }));
              results = [...mStages, ...results];
            }
            resolve(results);
          };
          request.onerror = function () {
            reject(request.error);
          };
        });
      });
    });
  },

  // === EXECUTION STORE ===

  createExecution: function (exec) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.EXECUTIONS], 'readwrite').objectStore(STORE_NAMES.EXECUTIONS);
      var newExec = {
        projectId: exec.projectId,
        stageId: exec.stageId,
        amount: exec.amount,
        category: exec.category,
        description: exec.description,
        id: 'e_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      var request = store.add(newExec);
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () {
          resolve(self.getExecution(newExec.id));
        };
        request.onerror = function () {
          var err = request.error;
          if (err && err.name === 'QuotaExceededError') {
              window.dispatchEvent(new CustomEvent('mbt:quota-exceeded', { detail: { store: STORE_NAMES.EXECUTIONS } }));
          }
          reject(err);
        };
      });
    });
  },

  getExecution: function (id) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction(STORE_NAMES.EXECUTIONS, 'readonly').objectStore(STORE_NAMES.EXECUTIONS);
      return new Promise(function (resolve, reject) {
        var request = store.get(id);
        request.onsuccess = function () {
          resolve(request.result);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  updateExecution: function (exec) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.EXECUTIONS], 'readwrite').objectStore(STORE_NAMES.EXECUTIONS);
      exec.updated_at = new Date().toISOString();
      var request = store.put(exec);
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () {
          resolve();
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  deleteExecution: function (id, skipTombstone) {
    var self = this;
    return this._getDb().then(function (db) {
      var txStores = skipTombstone ? [STORE_NAMES.EXECUTIONS] : [STORE_NAMES.EXECUTIONS, STORE_NAMES.TOMBSTONES];
      var tx = db.transaction(txStores, 'readwrite');
      var request = tx.objectStore(STORE_NAMES.EXECUTIONS).delete(id);
      if (!skipTombstone) {
        tx.objectStore(STORE_NAMES.TOMBSTONES).put({ id: id, store: 'mbt_executions', deleted_at: new Date().toISOString() });
      }
      return new Promise(function (resolve, reject) {
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  },

  getExecutionsByStage: function (stageId) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction(STORE_NAMES.EXECUTIONS, 'readonly').objectStore(STORE_NAMES.EXECUTIONS);
      var index = store.index('stageId');
      return new Promise(function (resolve, reject) {
        var request = index.getAll(stageId);
        request.onsuccess = function () {
          resolve(request.result || []);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  getExecutionsByProject: function (projectId) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction(STORE_NAMES.EXECUTIONS, 'readonly').objectStore(STORE_NAMES.EXECUTIONS);
      var index = store.index('projectId');
      return new Promise(function (resolve, reject) {
        var request = index.getAll(projectId);
        request.onsuccess = function () {
          resolve(request.result || []);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  // === OG_REF STORE ===

  createOGItem: function (item) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.OG_REF], 'readwrite').objectStore(STORE_NAMES.OG_REF);
      var newItem = {
        category: item.category,
        label: item.label,
        value: item.value,
        currency: item.currency,
        id: 'og_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        updated_at: new Date().toISOString(),
      };
      var request = store.add(newItem);
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () {
          resolve(self.getOGItem(newItem.id));
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  getOGItem: function (id) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction(STORE_NAMES.OG_REF, 'readonly').objectStore(STORE_NAMES.OG_REF);
      return new Promise(function (resolve, reject) {
        var request = store.get(id);
        request.onsuccess = function () {
          resolve(request.result);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  updateOGItem: function (item) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.OG_REF], 'readwrite').objectStore(STORE_NAMES.OG_REF);
      item.updated_at = new Date().toISOString();
      var request = store.put(item);
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () {
          resolve();
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  deleteOGItem: function (id) {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.OG_REF], 'readwrite').objectStore(STORE_NAMES.OG_REF);
      return new Promise(function (resolve, reject) {
        var request = store.delete(id);
        request.onsuccess = function () {
          resolve();
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  getAllOGItems: function () {
    var self = this;
    return this._getDb().then(function (db) {
      var store = db.transaction(STORE_NAMES.OG_REF, 'readonly').objectStore(STORE_NAMES.OG_REF);
      return new Promise(function (resolve, reject) {
        var request = store.getAll();
        request.onsuccess = function () {
          resolve(request.result || []);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  // === CONTACTS STORE ===

  getAllContacts: function () {
    return this._getDb().then(function (db) {
      var store = db.transaction(STORE_NAMES.CONTACTS, 'readonly').objectStore(STORE_NAMES.CONTACTS);
      return new Promise(function (resolve, reject) {
        var request = store.getAll();
        request.onsuccess = function () { resolve(request.result || []); };
        request.onerror = function () { reject(request.error); };
      });
    });
  },

  saveContact: function (contact) {
    return this._getDb().then(function (db) {
      if (!contact.id) {
        contact.id = 'contact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      }
      contact.updated_at = new Date().toISOString();
      var store = db.transaction([STORE_NAMES.CONTACTS], 'readwrite').objectStore(STORE_NAMES.CONTACTS);
      return new Promise(function (resolve, reject) {
        var request = store.put(contact);
        request.onsuccess = function () { resolve(contact); };
        request.onerror = function () { reject(request.error); };
      });
    });
  },

  deleteContact: function (id, skipTombstone) {
    return this._getDb().then(function (db) {
      var txStores = skipTombstone ? [STORE_NAMES.CONTACTS] : [STORE_NAMES.CONTACTS, STORE_NAMES.TOMBSTONES];
      var tx = db.transaction(txStores, 'readwrite');
      tx.objectStore(STORE_NAMES.CONTACTS).delete(id);
      if (!skipTombstone) {
        var now = new Date().toISOString();
        tx.objectStore(STORE_NAMES.TOMBSTONES).put({ id: id, store: 'contacts', deleted_at: now });
      }
      return new Promise(function (resolve, reject) {
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  },

  // === UTILITY ===

  getTotalBudget: function (projectId) {
    return this.getProject(projectId).then(function (project) {
      return project ? project.budget : 0;
    });
  },

  getTotalAllocated: function (stageId) {
    return this.getStage(stageId).then(function (stage) {
      return stage ? stage.allocated.reduce(function (a, b) { return a + b; }, 0) : 0;
    });
  },

  getTotalCompleted: function (stageId) {
    return this.getStage(stageId).then(function (stage) {
      return stage ? stage.completed.reduce(function (a, b) { return a + b; }, 0) : 0;
    });
  },

  getTotalExecutionCost: function (stageId) {
    return this.getExecutionsByStage(stageId).then(function (executions) {
      return executions.reduce(function (sum, exec) { return sum + exec.amount; }, 0);
    });
  },

  // === GENERIC STORE (Key-Value) ===

  getItem: function (key) {
    return this._getDb().then(function (db) {
      var store = db.transaction(STORE_NAMES.GENERIC, 'readonly').objectStore(STORE_NAMES.GENERIC);
      return new Promise(function (resolve, reject) {
        var request = store.get(key);
        request.onsuccess = function () {
          resolve(request.result ? request.result.value : null);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  setItem: function (key, value) {
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.GENERIC], 'readwrite').objectStore(STORE_NAMES.GENERIC);
      var request = store.put({ key: key, value: value, updated_at: new Date().toISOString() });
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () {
          resolve();
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  removeItem: function (key) {
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.GENERIC], 'readwrite').objectStore(STORE_NAMES.GENERIC);
      var request = store.delete(key);
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () {
          resolve();
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  },

  // === TOMBSTONE STORE ===

  getAllTombstones: function () {
    return this._getDb().then(function (db) {
      var store = db.transaction(STORE_NAMES.TOMBSTONES, 'readonly').objectStore(STORE_NAMES.TOMBSTONES);
      return new Promise(function (resolve, reject) {
        var request = store.getAll();
        request.onsuccess = function () { resolve(request.result || []); };
        request.onerror = function () { reject(request.error); };
      });
    });
  },

  clearTombstones: function () {
    return this._getDb().then(function (db) {
      var store = db.transaction([STORE_NAMES.TOMBSTONES], 'readwrite').objectStore(STORE_NAMES.TOMBSTONES);
      return new Promise(function (resolve, reject) {
        var request = store.clear();
        request.onsuccess = function () { resolve(); };
        request.onerror = function () { reject(request.error); };
      });
    });
  },

  /* --- Export: full IndexedDB snapshot as JSON string --- */
  exportAllData: function () {
      var self = this;
      return self._getDb().then(function (db) {
          var storeNames = Object.values(STORE_NAMES);
          var promises = storeNames.map(function (name) {
              return new Promise(function (resolve) {
                  try {
                      var tx = db.transaction(name, 'readonly');
                      var req = tx.objectStore(name).getAll();
                      req.onsuccess = function () { resolve({ store: name, data: req.result || [] }); };
                      req.onerror = function () { resolve({ store: name, data: [] }); };
                  } catch (e) {
                      resolve({ store: name, data: [] });
                  }
              });
          });
          return Promise.all(promises).then(function (results) {
              var snapshot = {
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  stores: {}
              };
              results.forEach(function (r) { snapshot.stores[r.store] = r.data; });
              return JSON.stringify(snapshot, null, 2);
          });
      });
  },
};

// === GLOBAL EXPORT ===

if (typeof window !== 'undefined') {
  window.mBT = window.mBT || {};
  window.mBT.storage = mBTStorage;
}

console.log('[mBT] Storage module initialized ✓');