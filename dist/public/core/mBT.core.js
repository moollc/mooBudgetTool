// mBT Monolith Core - Navigation & Routing Engine
// Handles sidebar navigation and content loading for local portability

window.mBT = window.mBT || {};
window.mBT.core = window.mBT.core || {};

// Store definitions for IndexedDB
const DB_NAMESPACES = {
  projects: 'mbt_projects',
  stages: 'mbt_stages',
  executions: 'mbt_executions',
  og_ref: 'og_ref'
};

// Register all actions for delegation
Object.freeze({
  'route': (e, el) => {
    const route = el.dataset.route;
    window.location.hash = route;
    return true;
  },
  'section-toggle': (e, el) => {
    const section = el.dataset.id;
    if (window.budget && window.budget.sections[section]) {
      window.budget.sections[section].isOpen = !window.budget.sections[section].isOpen;
      requestAnimationFrame(() => {
        if (typeof mBT.ui.paint === 'function') mBT.ui.paint();
      });
    }
    return true;
  },
  'crew-toggle': (e, el) => {
    el.classList.toggle('bg-blue-50');
    el.classList.toggle('border-blue-200');
    el.classList.toggle('text-blue-600');
    return true;
  },
  'row-lock': (e, el) => {
    const item = findItem(el);
    if (!item) return true;
    const isLocked = item.rateType === 'fixed';
    item.rateType = isLocked ? 'negotiable' : 'fixed';
    if (typeof mBTLE.reconcile === 'function') mBTLE.reconcile();
    if (typeof mBT.ui.paint === 'function') mBT.ui.paint();
    return true;
  },
  'row-delete': (e, el) => {
    const itemId = el.dataset.id;
    const section = el.dataset.section;
    mBTME.confirm("Delete Line Item", "Remove this item from the budget permanently?", () => {
      if (typeof mBT.ui.ops.remove === 'function') {
        mBT.ui.ops.remove(section, itemId);
      } else {
        document.querySelector(`tr[data-item-id="${itemId}"]`)?.remove();
      }
      if (typeof mBTLE.reconcile === 'function') mBTLE.reconcile();
      if (typeof mBT.ui.paint === 'function') mBT.ui.paint();
    });
    return true;
  },
  'section-add': (e, el) => {
    const section = el.dataset.id;
    showItemSelectorModal(section);
    return true;
  },
  'item-select': (e, el) => {
    const item = el.dataset.item;
    if (item) {
      el.classList.add('ring-2');
      el.classList.add('ring-blue-500');
    }
    return true;
  },
  'item-deselect': (e, el) => {
    const item = el.dataset.item;
    if (item) {
      el.classList.remove('ring-2');
      el.classList.remove('ring-blue-500');
    }
    return true;
  }
});

// Register all core actions
Object.entries(actions).forEach(([name, handler]) => {
  window.mBT.core.actions[name] = handler;
});

// Find item by element
function findItem(el) {
  const row = el.closest('tr');
  if (!row) return null;
  const section = row.dataset.section;
  if (!window.budget || !window.budget.sections[section]) return null;
  const items = window.budget.sections[section].items;
  const itemId = el.dataset.id;
  return items.find(i => String(i.id) === String(itemId)) || null;
}

// Bootstrap
(async () => {
  // Initialize IndexedDB if not already done
  if (typeof indexedDB !== 'undefined' && !window.db) {
    const request = indexedDB.open('mBTDatabase', 1);
    request.onerror = () => {
      console.error('[mBT] IndexedDB open error:', request.error);
    };
    request.onsuccess = () => {
      window.db = request.result;
      console.log('[mBT] IndexedDB initialized');
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create projects store
      if (!db.objectStoreNames.contains('projects')) {
        const store = db.createObjectStore('projects', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
      }
      
      // Create stages store
      if (!db.objectStoreNames.contains('stages')) {
        const store = db.createObjectStore('stages', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
      }
      
      // Create executions store
      if (!db.objectStoreNames.contains('executions')) {
        const store = db.createObjectStore('executions', { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
      
      // Create og_ref store
      if (!db.objectStoreNames.contains('og_ref')) {
        const store = db.createObjectStore('og_ref', { keyPath: 'id' });
      }
      
      console.log('[mBT] IndexedDB stores created');
    };
  }
})();

// Navigation handler
document.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1) || 'db';
  const route = hash.replace('#', '');
  
  // Update sidebar active state
  document.querySelectorAll('[data-route]').forEach(btn => {
    if (btn.dataset.route === route) {
      btn.classList.add('bg-blue-600', 'text-white');
    } else {
      btn.classList.remove('bg-blue-600', 'text-white');
    }
  });
});

// Expose for external use
window.mBT.core.routes = {
  register: (route, handler) => {
    if (typeof window.mBT.core.routes.handlers[route] !== 'undefined') return;
    window.mBT.core.routes.handlers[route] = handler;
  }
};

console.log('[mBT] Core module initialized');