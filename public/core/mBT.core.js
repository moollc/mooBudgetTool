// mBT Monolith Core - Navigation & Routing Engine
// Handles sidebar navigation and content loading for local portability

window.mBT = window.mBT || {};
window.mBT.core = window.mBT.core || {};
window.mBT.core.actions = window.mBT.core.actions || {};
window.mBT.core.routes = window.mBT.core.routes || {};
window.mBT.core.routes.handlers = window.mBT.core.routes.handlers || {};

// Store definitions for IndexedDB
var DB_NAMESPACES = {
  projects: 'mbt_projects',
  stages: 'mbt_stages',
  executions: 'mbt_executions',
  og_ref: 'og_ref'
};

// Register all actions for delegation
var coreActions = {
  'route': function (e, el) {
    var route = el.dataset.route;
    window.location.hash = route;
    return true;
  },
  'section-toggle': function (e, el) {
    var section = el.dataset.id;
    if (window.budget && window.budget.sections[section]) {
      window.budget.sections[section].isOpen = !window.budget.sections[section].isOpen;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () {
          if (typeof mBT.ui.paint === 'function') mBT.ui.paint();
        });
      } else {
        if (typeof mBT.ui.paint === 'function') mBT.ui.paint();
      }
    }
    return true;
  },
  'crew-toggle': function (e, el) {
    el.classList.toggle('bg-blue-50');
    el.classList.toggle('border-blue-200');
    el.classList.toggle('text-blue-600');
    return true;
  },
  'row-lock': function (e, el) {
    var item = findItem(el);
    if (!item) return true;
    var isLocked = item.rateType === 'fixed';
    item.rateType = isLocked ? 'negotiable' : 'fixed';
    if (typeof mBTLE !== 'undefined' && typeof mBTLE.reconcile === 'function') mBTLE.reconcile();
    if (typeof mBT.ui !== 'undefined' && typeof mBT.ui.paint === 'function') mBT.ui.paint();
    return true;
  },
  'row-delete': function (e, el) {
    var itemId = el.dataset.id;
    var section = el.dataset.section;
    if (typeof mBTME !== 'undefined' && typeof mBTME.confirm === 'function') {
      mBTME.confirm("Delete Line Item", "Remove this item from the budget permanently?", function () {
        if (typeof mBT.ui !== 'undefined' && mBT.ui.ops && typeof mBT.ui.ops.remove === 'function') {
          mBT.ui.ops.remove(section, itemId);
        } else {
          var tr = document.querySelector('tr[data-item-id="' + itemId + '"]');
          if (tr) tr.parentElement.removeChild(tr);
        }
        if (typeof mBTLE !== 'undefined' && typeof mBTLE.reconcile === 'function') mBTLE.reconcile();
        if (typeof mBT.ui !== 'undefined' && typeof mBT.ui.paint === 'function') mBT.ui.paint();
      });
    }
    return true;
  },
  'section-add': function (e, el) {
    var section = el.dataset.id;
    if (typeof showItemSelectorModal === 'function') showItemSelectorModal(section);
    return true;
  },
  'item-select': function (e, el) {
    var item = el.dataset.item;
    if (item) {
      el.classList.add('ring-2');
      el.classList.add('ring-blue-500');
    }
    return true;
  },
  'item-deselect': function (e, el) {
    var item = el.dataset.item;
    if (item) {
      el.classList.remove('ring-2');
      el.classList.remove('ring-blue-500');
    }
    return true;
  }
};

// Register all core actions
var actionNames = Object.keys(coreActions);
for (var i = 0; i < actionNames.length; i++) {
  var name = actionNames[i];
  window.mBT.core.actions[name] = coreActions[name];
}

// Find item by element
function findItem(el) {
  var tr = typeof el.closest === 'function' ? el.closest('tr') : null;
  if (!tr) return null;
  var section = tr.dataset.section;
  if (!window.budget || !window.budget.sections[section]) return null;
  var items = window.budget.sections[section].items;
  var itemId = el.dataset.id;
  for (var j = 0; j < items.length; j++) {
    if (String(items[j].id) === String(itemId)) return items[j];
  }
  return null;
}

// Bootstrap
(function () {
  // Initialize IndexedDB if not already done
  if (typeof indexedDB !== 'undefined' && !window.db) {
    var request = indexedDB.open('mBTDatabase', 1);
    request.onerror = function () {
      console.error('[mBT] IndexedDB open error:', request.error);
    };
    request.onsuccess = function () {
      window.db = request.result;
      console.log('[mBT] IndexedDB initialized');
    };
    request.onupgradeneeded = function (event) {
      var db = event.target.result;
      
      // Create projects store
      if (!db.objectStoreNames.contains('projects')) {
        var pStore = db.createObjectStore('projects', { keyPath: 'id' });
        pStore.createIndex('name', 'name', { unique: false });
      }
      
      // Create stages store
      if (!db.objectStoreNames.contains('stages')) {
        var sStore = db.createObjectStore('stages', { keyPath: 'id' });
        sStore.createIndex('name', 'name', { unique: false });
      }
      
      // Create executions store
      if (!db.objectStoreNames.contains('executions')) {
        var eStore = db.createObjectStore('executions', { keyPath: 'id' });
        eStore.createIndex('projectId', 'projectId', { unique: false });
      }
      
      // Create og_ref store
      if (!db.objectStoreNames.contains('og_ref')) {
        db.createObjectStore('og_ref', { keyPath: 'id' });
      }
      
      console.log('[mBT] IndexedDB stores created');
    };
  }
})();

// Navigation handler
document.addEventListener('hashchange', function () {
  var hash = window.location.hash.slice(1) || 'db';
  var route = hash.replace('#', '');
  
  // Update sidebar active state
  var btns = document.querySelectorAll('[data-route]');
  for (var k = 0; k < btns.length; k++) {
    var btn = btns[k];
    if (btn.dataset.route === route) {
      btn.classList.add('bg-blue-600', 'text-white');
    } else {
      btn.classList.remove('bg-blue-600', 'text-white');
    }
  }
});

// Expose for external use
window.mBT.core.routes.register = function (route, handler) {
  if (typeof window.mBT.core.routes.handlers[route] !== 'undefined') return;
  window.mBT.core.routes.handlers[route] = handler;
};

console.log('[mBT] Core module initialized');
