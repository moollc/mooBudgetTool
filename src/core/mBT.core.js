/**
 * mBT Monolith Core — Navigation & Routing Engine
 * Pure Vanilla JS. Zero build tools. Zero framework dependencies.
 */

(function () {
    'use strict';

    // === Global Namespace ===
    window.mBT = window.mBT || {};
    window.mBT.core = window.mBT.core || {};
    window.mBT.core.actions = {};
    window.mBT.core.routes = { handlers: {} };

    // === Configuration ===
    const DEFAULT_ROUTE = 'db';
    const THEME_KEY = 'mbt_app_theme';
    const NAV_POS_KEY = 'mbt_nav_pos';

    const ROUTE_NAMES = {
        db: 'Database',
        stages: 'Stages',
        publisher: 'Publisher',
        ai: 'AI Assistant',
        opengate: 'OpenGate',
        contacts: 'Contacts',
        security: 'Security',
        settings: 'Settings'
    };

    // =========================================
    // 1. HASH ROUTER
    // =========================================

    function getCurrentRoute() {
        var hash = window.location.hash.replace(/^#\/?/, '');
        return hash || DEFAULT_ROUTE;
    }

    function navigateTo(route) {
        window.location.hash = route;
    }

    function applyRoute() {
        var route = getCurrentRoute();

        // Update sidebar + bottom-nav active state
        var buttons = document.querySelectorAll('.nav-btn[data-route]');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.getAttribute('data-route') === route) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }

        // Switch visible panel
        var panels = document.querySelectorAll('.route-panel');
        for (var j = 0; j < panels.length; j++) {
            var panel = panels[j];
            if (panel.id === 'panel-' + route) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        }

        // Update header
        var toolNameEl = document.getElementById('active-tool-name');
        if (toolNameEl) {
            toolNameEl.textContent = ROUTE_NAMES[route] || route;
        }

        // Fire registered route handler
        var handler = window.mBT.core.routes.handlers[route];
        if (typeof handler === 'function') {
            handler(route);
        }

        console.log('[mBT] Route →', route);
    }

    // =========================================
    // 2. SIDEBAR TOGGLE
    // =========================================

    function initSidebar() {
        var sidebar = document.getElementById('sidebar');
        var toggleBtn = document.getElementById('sidebar-toggle');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                sidebar.classList.toggle('open');
            });
        }

        var header = document.getElementById('sidebar-header');
        if (header) {
            header.addEventListener('click', function (e) {
                if (!sidebar.classList.contains('open') && e.target !== toggleBtn) {
                    sidebar.classList.add('open');
                }
            });
        }
    }

    // =========================================
    // 3. ONLINE / OFFLINE STATUS
    // =========================================

    function updateStatus() {
        var dot = document.getElementById('status-dot');
        var label = document.getElementById('status-label');
        if (!dot) return;

        if (navigator.onLine) {
            dot.className = 'online';
            if (label) label.textContent = 'Online';
        } else {
            dot.className = 'offline';
            if (label) label.textContent = 'Offline';
        }
    }

    // =========================================
    // 4. SETTINGS PANEL
    // =========================================

    function populateSettings() {
        var list = document.getElementById('settings-list');
        if (!list) return;

        var isDark = document.body.classList.contains('dark-theme');
        var navPos = localStorage.getItem(NAV_POS_KEY) || 'sidebar';
        var isSyncActive = localStorage.getItem('mbt_supabase_sync') === 'true';

        var settings = [
            {
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
                name: 'Currency', desc: 'Set default display currency (JMD, USD, GBP…)', status: 'ready'
            },
            {
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
                name: 'Dark Mode', desc: 'Toggle dark interface.',
                toggle: true, toggleId: 'setting-dark-mode', toggleOn: isDark
            },
            {
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
                name: 'Nav Position', desc: 'Switch between left sidebar and bottom navigation.',
                select: true, selectId: 'setting-nav-pos', selectVal: navPos,
                selectOpts: [{ val: 'sidebar', label: 'Left Sidebar' }, { val: 'bottom', label: 'Bottom Bar' }]
            },
            {
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>',
                name: 'Cloud Sync', desc: 'Connect to Supabase for cross-device sync.',
                status: isSyncActive ? 'ready' : 'stub', statusLabel: isSyncActive ? 'ON' : 'OFF', action: 'toggleSync'
            },
            {
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
                name: 'Data Export', desc: 'Export all local data as .moo or .zip bundle.', status: 'ready'
            },
            {
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>',
                name: 'AI Settings', desc: 'Configure AI endpoint and API keys.', status: 'ready', action: 'openAISettings'
            }
        ];

        list.innerHTML = settings.map(function (s) {
            var right = '';
            if (s.toggle) {
                right = '<label class="svc-toggle">' +
                    '<input type="checkbox" id="' + s.toggleId + '"' + (s.toggleOn ? ' checked' : '') + '>' +
                    '<span class="toggle-track"><span class="toggle-thumb"></span></span>' +
                    '</label>';
            } else if (s.select) {
                right = '<select id="' + s.selectId + '" class="svc-select">' +
                    s.selectOpts.map(function (o) {
                        return '<option value="' + o.val + '"' + (s.selectVal === o.val ? ' selected' : '') + '>' + o.label + '</option>';
                    }).join('') +
                    '</select>';
            } else {
                right = '<span class="svc-status ' + (s.status || 'stub') + '">' + (s.statusLabel || s.status || '') + '</span>';
            }
            return '<div class="service-item"' + (s.action ? ' onclick="window.mBT.core.actions.' + s.action + '()" style="cursor:pointer"' : '') + '>' +
                '<div class="svc-icon" style="background:var(--slate-100);">' + s.icon + '</div>' +
                '<div class="svc-info"><div class="svc-name">' + s.name + '</div><div class="svc-desc">' + s.desc + '</div></div>' +
                right +
                '</div>';
        }).join('');

        var darkToggle = document.getElementById('setting-dark-mode');
        if (darkToggle) {
            darkToggle.addEventListener('change', function () {
                window.mBT.core.actions.toggleDarkMode();
            });
        }
        var navSelect = document.getElementById('setting-nav-pos');
        if (navSelect) {
            navSelect.addEventListener('change', function () {
                window.mBT.core.actions.setNavPos(this.value);
            });
        }
    }

    // === Cloud Sync Actions ===
    window.mBT.core.actions.toggleSync = function () {
        const active = localStorage.getItem('mbt_supabase_sync') === 'true';
        localStorage.setItem('mbt_supabase_sync', !active);
        alert('Cloud Sync ' + (!active ? 'Enabled' : 'Disabled'));
        populateSettings();
        if (!active) window.mBT.core.actions.pushToCloud();
    };

    window.mBT.core.actions.pushToCloud = function () {
        if (!window.mBTSync) {
            console.warn('[mBT] Supabase sync service not available.');
            return;
        }
        if (!window.mBTSupabaseConfig || !mBTSupabaseConfig.isConfigured()) {
            console.warn('[mBT] Supabase not configured — open the Cloud Backup tool to add credentials.');
            return;
        }
        console.log('[mBT] Pushing to Supabase...');
        mBTSync.pushAll().then(function (r) {
            console.log('[mBT] Push complete — synced:', r.synced, 'errors:', r.errors);
        }).catch(function (e) {
            console.error('[mBT] Push failed:', e);
        });
    };

    window.mBT.core.actions.openAISettings = function () {
        const key = prompt('Enter AI API Key (optional):', localStorage.getItem('mbt_ai_api_key') || '');
        const endpoint = prompt('Enter AI Endpoint:', localStorage.getItem('mbt_ai_endpoint') || 'http://localhost:1234/v1/chat/completions');
        if (key !== null) localStorage.setItem('mbt_ai_api_key', key);
        if (endpoint !== null) localStorage.setItem('mbt_ai_endpoint', endpoint);
        alert('AI Settings saved.');
    };

    // === Theme ===
    function applyTheme(dark) {
        document.body.classList.toggle('dark-theme', !!dark);
    }

    function loadTheme() {
        applyTheme(localStorage.getItem(THEME_KEY) === 'dark');
    }

    window.mBT.core.actions.toggleDarkMode = function () {
        var isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem(THEME_KEY, isDark ? 'light' : 'dark');
        applyTheme(!isDark);
        populateSettings();
    };

    // === Nav Position ===
    var _collapseTimer = null;

    function applyNavPos(pos) {
        document.body.classList.toggle('nav-bottom', pos === 'bottom');
        initBottomNavCollapse();
    }

    function loadNavPos() {
        var stored = localStorage.getItem(NAV_POS_KEY);
        /* First-run on narrow screens: default to bottom nav */
        if (!stored && window.innerWidth < 600) {
            stored = 'bottom';
        }
        applyNavPos(stored || 'sidebar');
    }

    var _collapseInited = false;

    function initBottomNavCollapse() {
        var bnav = document.getElementById('bottom-nav');
        if (!bnav) return;
        if (_collapseTimer) clearTimeout(_collapseTimer);

        /* Remove collapsed state if switching away from bottom nav */
        if (!document.body.classList.contains('nav-bottom')) {
            bnav.classList.remove('collapsed');
            return;
        }

        function expand() {
            bnav.classList.remove('collapsed');
            resetIdleTimer();
        }

        function resetIdleTimer() {
            if (_collapseTimer) clearTimeout(_collapseTimer);
            if (!document.body.classList.contains('nav-bottom')) return;
            _collapseTimer = setTimeout(function () {
                bnav.classList.add('collapsed');
            }, 8000);
        }

        /* Only bind listeners once */
        if (!_collapseInited) {
            _collapseInited = true;
            bnav.addEventListener('mouseenter', expand);
            bnav.addEventListener('touchstart', expand, { passive: true });
            document.addEventListener('click', function () { resetIdleTimer(); });
            document.addEventListener('scroll', function () { resetIdleTimer(); }, true);
        }
        resetIdleTimer();
    }

    window.mBT.core.actions.setNavPos = function (pos) {
        localStorage.setItem(NAV_POS_KEY, pos);
        applyNavPos(pos);
        populateSettings();
    };

    // === Public API ===
    window.mBT.core.navigateTo = navigateTo;
    window.mBT.core.getCurrentRoute = getCurrentRoute;
    window.mBT.core.routes.register = function (route, handler) {
        window.mBT.core.routes.handlers[route] = handler;
    };

    // =========================================
    // 6. BOOTSTRAP
    // =========================================

    function boot() {
        console.log('[mBT] Booting Monolith Core…');

        // Wire all nav buttons (sidebar + bottom nav)
        var navButtons = document.querySelectorAll('.nav-btn[data-route]');
        for (var i = 0; i < navButtons.length; i++) {
            navButtons[i].addEventListener('click', function () {
                navigateTo(this.getAttribute('data-route'));
            });
        }

        loadTheme();
        loadNavPos();
        initSidebar();
        updateStatus();
        populateSettings();
        applyRoute();

        window.addEventListener('hashchange', applyRoute);
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);

        // Preflight warning (non-intrusive, console-only + subtle badge)
        checkPreflightWarning();

        // First Run Hydration
        hydrateDefaultData();

        /* --- Auto-sync: push to Supabase on interval if enabled --- */
        if (window.mBTSupabaseConfig && mBTSupabaseConfig.SYNC.ENABLED && window.mBTSync) {
            setInterval(function () {
                if (navigator.onLine && mBTSupabaseConfig.isConfigured()) {
                    window.mBT.core.actions.pushToCloud();
                }
            }, mBTSupabaseConfig.SYNC.AUTO_SYNC_INTERVAL);
        }

        console.log('[mBT] Core module initialized ✓');
    }

    function checkPreflightWarning() {
        if (typeof window.mBT.preflight !== 'undefined') {
            // Preflight runs automatically; check for errors
            if (window.mBT.preflight && window.mBT.preflight.errors && window.mBT.preflight.errors.length > 0) {
                // Show non-intrusive warning badge in sidebar if IndexedDB has issues
                var warningBadge = document.getElementById('preflight-warning-badge');
                if (!warningBadge) {
                    warningBadge = document.createElement('div');
                    warningBadge.id = 'preflight-warning-badge';
                    warningBadge.className = 'px-3 py-2 bg-yellow-500 text-white text-xs text-center nav-warning';
                    warningBadge.textContent = '⚠️';
                    var sidebarHeader = document.getElementById('sidebar-header');
                    if (sidebarHeader) {
                        sidebarHeader.insertBefore(warningBadge, sidebarHeader.firstChild);
                    }
                }
            } else {
                // Remove warning if no longer needed
                var warningBadge = document.getElementById('preflight-warning-badge');
                if (warningBadge) {
                    warningBadge.remove();
                }
            }
        }
    }

    async function hydrateDefaultData() {
        if (!window.mBT || !window.mBT.storage) return;
        try {
            const projects = await window.mBT.storage.getAllProjects();
            if (projects.length === 0) {
                console.log('[mBT] Hydrating default budget template...');

                // 1. Create Default Project
                const defaultProject = {
                    name: 'Default Production Budget',
                    budget: 50000,
                    currency: 'USD',
                    status: 'active',
                    lastModified: new Date().toISOString()
                };
                const projectId = await window.mBT.storage.createProject(defaultProject);

                // 2. Seed Industry-standard Stages
                const stages = [
                    { projectId, description: 'Pre-roll / Prep', budgeted: 15000, amount: 0, allocationPercent: 0 },
                    { projectId, description: 'Production / Principal', budgeted: 25000, amount: 0, allocationPercent: 0 },
                    { projectId, description: 'Post / Wrap', budgeted: 10000, amount: 0, allocationPercent: 0 }
                ];
                for (const stage of stages) {
                    await window.mBT.storage.createStage(stage);
                }

                // 3. Seed Dummy Contacts
                const contacts = [
                    { name: 'Alice Grip', department: 'Grip', email: 'alice@example.com', rate: 450, projectId },
                    { name: 'Bob Sparky', department: 'Electrical', email: 'bob@example.com', rate: 400, projectId },
                    { name: 'Charlie Sound', department: 'Sound', email: 'charlie@example.com', rate: 380, projectId }
                ];
                for (const contact of contacts) {
                    await window.mBT.storage.setItem('contacts', [...(await window.mBT.storage.getItem('contacts') || []), contact]);
                }

                // 4. Initial RSI health item
                const rsiItem = {
                    id: 'first-audit',
                    title: 'Perform First Production Audit',
                    status: 'pending',
                    severity: 'low',
                    category: 'Technical Debt',
                    description: 'Analyze initial budget allocation for contingency gaps.',
                    timestamp: new Date().toISOString()
                };
                await window.mBT.storage.setItem('rsi_health_items', [rsiItem]);

                console.log('[mBT] Hydration complete ✓');
            }
        } catch (e) {
            console.warn('[mBT] Hydration failed:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})();
