/**
 * © 2026 Jayson Moo-Young <jayson.m.y@gmail.com>
 * Part of the mBT (Moo Budget Tool) Ecosystem.
 * License: MIT
 */

(function (window) {
    'use strict';

    function renderDbView(subTab) {
        function esc(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
        var og = window.mBTOG || { rates: [], contacts: [], templates: [], settings: { location: 'Jamaica', optInSharing: false } };

        if (subTab === 'contacts') {
            var contacts = og.contacts || [];
            var listContent = contacts.length ? contacts.map(function (c) {
                return RenderEngine.ui.listRow({
                    id: c.id || c.name,
                    icon: mBTAssets.user,
                    title: c.name || 'Unknown',
                    subtitle: c.role || 'No Role',
                    classes: 'border-b border-slate-50',
                    actions: [{
                        icon: mBTAssets.plus,
                        title: 'Add to Budget',
                        color: 'blue',
                        onClick: "mBT.data.addCrewToBudget('" + esc(c.name) + "', '" + esc(c.role) + "')"
                    }]
                });
            }).join('') : RenderEngine.ui.emptyState({ icon: mBTAssets.user, message: 'No Contacts Found' });

            return '<div class="flex flex-col h-full bg-white overflow-hidden rounded-xl border border-slate-100 shadow-sm">' +
                '<div class="p-3 bg-indigo-50 border-b border-indigo-100 flex flex-col gap-3 shrink-0 z-10">' +
                    '<div class="flex justify-center gap-3 flex-wrap">' +
                        '<button onclick="mBT.features.settings.openAddContactModal()" class="bg-indigo-200 text-indigo-800 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-300 transition-all flex items-center gap-1.5">' + (mBTAssets.plus || "") + ' Add</button>' +
                        '<button onclick="document.getElementById(\'csvImportInput\').click()" class="bg-indigo-200 text-indigo-800 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-300 transition-all flex items-center gap-1.5">' + (mBTAssets.plus || "") + ' Import CSV</button>' +
                    '</div>' +
                    '<div class="relative">' +
                        '<input type="text" id="contactsSearchInput" placeholder="SEARCH PERSONNEL.." class="w-full p-2.5 pr-10 bg-white border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-300 transition-all">' +
                    '</div>' +
                '</div>' +
                '<div id="contactsListBody" class="flex-grow overflow-y-auto no-scrollbar relative bg-white">' + listContent + '</div>' +
            '</div>';
        }

        if (subTab === 'lineItems') {
            var region = (og.settings && og.settings.location) || 'Jamaica';
            var isSharing = og.settings && og.settings.optInSharing;
            var cloudSyncOn = JSON.parse(localStorage.getItem('moo_og_cloud_sync') || 'true');
            var lastSyncRaw = localStorage.getItem('moo_og_last_sync');
            var lastSyncLabel = lastSyncRaw ? new Date(lastSyncRaw).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

            var rates = (og.rates || []).slice().sort(function (a, b) {
                var da = (a.description || '').toLowerCase();
                var db = (b.description || '').toLowerCase();
                if (da < db) return -1;
                if (da > db) return 1;
                return 0;
            });
            var avgsRaw = localStorage.getItem('moo_og_rate_averages');
            var avgs = {};
            try { avgs = avgsRaw ? JSON.parse(avgsRaw) : {}; } catch (e) { }

            var rateRows = rates.length ? rates.map(function (r) {
                var key = (r.description || '').toLowerCase() + '|' + region.toLowerCase();
                var avg = avgs[key];
                var dispRate = r.rate;
                var dispCurr = r.currency || 'USD';

                if (avg && avg.avg_rate > 0) {
                    dispRate = avg.avg_rate;
                    dispCurr = avg.currency || 'USD';
                }

                var sub = dispRate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ' + dispCurr + ' / ' + r.unit;
                if (avg && avg.contributor_count > 0) sub += ' [Research: ' + avg.contributor_count + ']';

                return RenderEngine.ui.listRow({
                    id: r.id || r.description,
                    icon: mBTAssets.money,
                    title: r.description,
                    subtitle: sub,
                    info: r.intelligence || '',
                    classes: 'border-b border-slate-50',
                    actions: [{ icon: mBTAssets.plus, title: 'Add', color: 'blue', onClick: "mBT.features.settings.addRateToBudget('" + esc(r.description) + "', " + dispRate + ", '" + r.unit + "', '" + dispCurr + "')" }]
                });
            }).join('') : RenderEngine.ui.emptyState({ icon: mBTAssets.money, message: 'No Rates Loaded' });

            var regionOpts = (og.RATE_REGIONS ? Object.keys(og.RATE_REGIONS) : [])
                .map(function (r) { return '<option value="' + r + '"' + (region === r ? ' selected' : '') + '>' + r + '</option>'; }).join('');

            var citation = (typeof og._getRegionIntelligence === 'function') ? og._getRegionIntelligence(region) : '';

            return '<div class="flex flex-col h-full bg-white overflow-hidden rounded-xl border border-slate-100 shadow-sm">' +
                '<div class="p-3 bg-slate-50 border-b border-slate-100 shrink-0 space-y-3 z-10">' +
                    '<div class="flex gap-2">' +
                        '<button onclick="mBT.features.settings.openAddRateModal()" class="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 shadow-sm flex items-center justify-center gap-2">' + mBTAssets.plus + ' Add Rate</button>' +
                        '<button onclick="if(window.mBTOG&&mBTOG.syncFromCloud)mBTOG.syncFromCloud().then(function(){_mBTRefreshDbRates();});" class="flex-1 py-2 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 ' + (cloudSyncOn ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400') + '">' + mBTAssets.cloud + ' ' + (cloudSyncOn ? 'Cloud On' : 'Cloud Off') + '</button>' +
                        '<button onclick="if(window.mBTOG&&mBTOG.settings){mBTOG.settings.optInSharing=!mBTOG.settings.optInSharing;localStorage.setItem(\'moo_og_share\',mBTOG.settings.optInSharing);_mBTRefreshDbRates();}" class="flex-1 py-2 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 ' + (isSharing ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400') + '">' + (mBTAssets.upload || mBTAssets.cloud) + ' ' + (isSharing ? 'Contributing' : 'Contribute') + '</button>' +
                    '</div>' +
                    '<div class="flex items-center gap-2">' +
                        '<input type="text" id="dbSearchInput" placeholder="SEARCH GLOBAL RATES.." class="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-100 transition-all">' +
                        '<div class="flex gap-1 shrink-0">' +
                            '<select onchange="if(window.mBTOG&&mBTOG.settings)mBTOG.settings.setMarketTier(this.value).then(function(){ _mBTRefreshDbRates(); });" class="p-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none text-slate-600">' +
                                (function() {
                                    var currentTier = (og.settings && typeof og.settings.getMarketTier === 'function') ? og.settings.getMarketTier() : (localStorage.getItem('moo_og_market_tier') || 'Standard');
                                    return ['Standard', 'Indie', 'Studio'].map(function(t) {
                                        return '<option value="' + t + '"' + (currentTier === t ? ' selected' : '') + '>' + t + '</option>';
                                    }).join('');
                                })() +
                            '</select>' +
                            '<select onchange="if(window.mBTOG&&mBTOG.settings)mBTOG.settings.setLocation(this.value).then(function(){ _mBTRefreshDbRates(); });" class="p-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none text-slate-600">' + regionOpts + '</select>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div id="dbListBody" class="flex-grow overflow-y-auto no-scrollbar relative min-h-0 bg-white">' + rateRows + '</div>' +
                (citation ? '<div class="p-2 bg-blue-50/50 border-t border-blue-100 shrink-0 space-y-0.5"><p class="text-[7px] font-medium text-blue-500 leading-snug">' + esc(citation.replace(/^INTELLIGENCE:\s*/i, '')) + '</p><p class="text-[7px] text-slate-400 font-medium">Last sync: ' + lastSyncLabel + '</p></div>' : '<div class="p-2 border-t border-slate-100 shrink-0"><p class="text-[7px] text-slate-400 font-medium">Last sync: ' + lastSyncLabel + '</p></div>') +
            '</div>';
        }

        if (subTab === 'templates') {
            var templates = og.templates || [];
            var tRows = templates.length ? templates.map(function (t) {
                return '<div class="flex items-center gap-3 p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors">' +
                    '<div class="flex-grow overflow-hidden min-w-0">' +
                        '<div class="text-[10px] font-black uppercase text-slate-700 truncate">' + esc(t.label || t.name || 'Template') + '</div>' +
                        '<div class="text-[9px] text-slate-400 font-bold truncate">' + esc(t.cat || 'General') + '</div>' +
                    '</div>' +
                '</div>';
            }).join('') : '<div class="p-8 text-center text-slate-300 text-[9px] font-black uppercase tracking-widest">No Templates</div>';

            return '<div class="flex flex-col h-full bg-white overflow-hidden rounded-xl border border-slate-100 shadow-sm">' +
                '<div class="p-3 bg-indigo-50 border-b border-indigo-100 shrink-0">' +
                    '<input type="text" id="templateSearchInput" placeholder="Search Templates.." class="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-300 transition-all">' +
                '</div>' +
                '<div class="flex-grow overflow-y-auto no-scrollbar">' + tRows + '</div>' +
            '</div>';
        }

        if (subTab === 'trash') {
            var trashRaw = null;
            try { trashRaw = JSON.parse(localStorage.getItem('moo_og_trash') || 'null'); } catch (e) {}
            var trashItems = Array.isArray(trashRaw) ? trashRaw : [];
            var trRows = trashItems.length ? trashItems.map(function (item, idx) {
                return '<div class="flex items-center gap-3 p-3 border-b border-slate-50 hover:bg-rose-50 transition-colors">' +
                    '<div class="flex-grow overflow-hidden min-w-0">' +
                        '<div class="text-[10px] font-black uppercase text-slate-700 truncate">' + esc(item.description || item.name || 'Item') + '</div>' +
                        '<div class="text-[9px] text-slate-400 font-bold truncate">' + esc(item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : '') + '</div>' +
                    '</div>' +
                    '<button onclick="(function(){var t=JSON.parse(localStorage.getItem(\'moo_og_trash\')||\'[]\');t.splice(' + idx + ',1);localStorage.setItem(\'moo_og_trash\',JSON.stringify(t));mBT.features.settings.open(\'database\',\'trash\');})()" class="shrink-0 px-2 py-1 text-[8px] font-black uppercase text-rose-400 hover:text-rose-600 transition-colors">Remove</button>' +
                '</div>';
            }).join('') : '<div class="p-8 text-center text-slate-300 text-[9px] font-black uppercase tracking-widest">Bin is Empty</div>';

            return '<div class="flex flex-col h-full bg-white overflow-hidden rounded-xl border border-slate-100 shadow-sm">' +
                '<div class="flex-grow overflow-y-auto no-scrollbar">' + trRows + '</div>' +
            '</div>';
        }

        return '<div class="p-8 text-center text-slate-300 text-[9px] font-black uppercase tracking-widest">View Not Found</div>';
    }

    /* Re-renders only the rates list body — no modal reset */
    function _mBTRefreshDbRates() {
        var body = document.getElementById('dbListBody');
        if (!body) return;
        var og = window.mBTOG || { rates: [], settings: { location: 'Jamaica' } };
        function esc(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
        var region = (og.settings && og.settings.location) || 'Jamaica';
        var rates = (og.rates || []).slice().sort(function (a, b) {
            var da = (a.description || '').toLowerCase();
            var db = (b.description || '').toLowerCase();
            if (da < db) return -1;
            if (da > db) return 1;
            return 0;
        });
        var avgsRaw = localStorage.getItem('moo_og_rate_averages');
        var avgs = {};
        try { avgs = avgsRaw ? JSON.parse(avgsRaw) : {}; } catch (e) {}
        var rateRows = rates.length ? rates.map(function (r) {
            var key = (r.description || '').toLowerCase() + '|' + region.toLowerCase();
            var avg = avgs[key];
            var dispRate = r.rate;
            var dispCurr = r.currency || 'USD';
            if (avg && avg.avg_rate > 0) { dispRate = avg.avg_rate; dispCurr = avg.currency || 'USD'; }
            var sub = dispRate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ' + dispCurr + ' / ' + r.unit;
            if (avg && avg.contributor_count > 0) sub += ' [Research: ' + avg.contributor_count + ']';
            return RenderEngine.ui.listRow({
                id: r.id || r.description,
                icon: mBTAssets.money,
                title: r.description,
                subtitle: sub,
                info: r.intelligence || '',
                classes: 'border-b border-slate-50',
                actions: [{ icon: mBTAssets.plus, title: 'Add', color: 'blue', onClick: "mBT.features.settings.addRateToBudget('" + esc(r.description) + "', " + dispRate + ", '" + r.unit + "', '" + dispCurr + "')" }]
            });
        }).join('') : RenderEngine.ui.emptyState({ icon: mBTAssets.money, message: 'No Rates Loaded' });
        body.innerHTML = rateRows;
    }
    window._mBTRefreshDbRates = _mBTRefreshDbRates;

    window.mBT_UI_Settings_getTabContent = function (tabName, subTab) {
        subTab = subTab || 'lineItems';
        function esc(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
        var budget = window.budget || { settings: {}, aiContext: {} };
        if (tabName === 'general') {
            var isDark = localStorage.getItem('mbt_active_theme') === 'dark';
            var _sw = isDark ? 'bg-slate-600' : 'bg-slate-200';
            var _inp = isDark ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-800';
            var _btnBg = isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
            var _btnRose = isDark ? 'bg-rose-900/30 text-rose-400 hover:bg-rose-900/50' : 'bg-rose-50 text-rose-600 hover:bg-rose-100';
            var currentDateFormat = getProjectDateFormat();
            var currentSeparator = getProjectNameSeparator();
            var isCompact = (budget.settings && budget.settings.compactMode) || false;
            var isClassic = (budget.settings && budget.settings.classicTheme) || false;
            var allowZoom = (budget.settings && budget.settings.allowZoom) || false;
            var autoFetchRates = localStorage.getItem(storageKeyPrefix + 'auto_fetch_rates') !== 'false';
            var autoHideNav = localStorage.getItem('mBT_autoHideNav') === 'true';
            var decimalPlaces = (budget.settings && budget.settings.decimalPlaces != null) ? budget.settings.decimalPlaces : 0;

            return '<div class="h-full overflow-y-auto no-scrollbar p-4 space-y-3 animate-in fade-in duration-300">' +
                        '<div class="settings-card flex items-center gap-3">' +
                            '<div class="w-10 h-10 rounded-xl shadow border border-slate-100 overflow-hidden bg-[#fdba35] shrink-0">' + mBTAssets.appLogo + '</div>' +
                            '<div>' +
                                '<h3 class="text-xs font-black uppercase tracking-widest settings-text-primary">moo Budget Tool</h3>' +
                                '<p class="text-[9px] text-slate-400 font-bold">Build v' + APP_VERSION + ' &bull; ' + (navigator.onLine ? '<span class="text-emerald-500">Online</span>' : '<span class="text-rose-500">Offline</span>') + '</p>' +
                            '</div>' +
                        '</div>' +
                        '<div class="settings-card">' +
                            '<div class="grid grid-cols-3 gap-3">' +
                                '<div>' +
                                    '<label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date Format</label>' +
                                    '<select id="dateFormatSelect" onchange="localStorage.setItem(\'' + projectDateFormatKey + '\', this.value)" class="w-full text-[10px] p-2 ' + _inp + ' border-none rounded-lg font-bold outline-none cursor-pointer">' +
                                        '<option value="YYYYMMDD" ' + (currentDateFormat === 'YYYYMMDD' ? 'selected' : '') + '>YYYY-MM-DD</option>' +
                                        '<option value="MMDDYYYY" ' + (currentDateFormat === 'MMDDYYYY' ? 'selected' : '') + '>MM-DD-YYYY</option>' +
                                    '</select>' +
                                '</div>' +
                                '<div>' +
                                    '<label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Separator</label>' +
                                    '<input type="text" id="separatorInput" maxlength="1" value="' + currentSeparator + '" onchange="localStorage.setItem(\'' + projectNameSeparatorKey + '\', this.value)" class="w-full text-[10px] p-2 ' + _inp + ' border-none rounded-lg font-bold text-center outline-none">' +
                                '</div>' +
                                '<div>' +
                                    '<label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Decimals</label>' +
                                    '<select id="decimalPlacesSelect" onchange="if(!budget.settings) budget.settings={}; budget.settings.decimalPlaces=parseInt(this.value); saveBudget(); if(typeof mBTLE!==\'undefined\') mBTLE.reconcile(); render();" class="w-full text-[10px] p-2 ' + _inp + ' border-none rounded-lg font-bold outline-none cursor-pointer">' +
                                        '<option value="0" ' + (decimalPlaces === 0 ? 'selected' : '') + '>0 — 1,500</option>' +
                                        '<option value="1" ' + (decimalPlaces === 1 ? 'selected' : '') + '>1 — 1,500.0</option>' +
                                        '<option value="2" ' + (decimalPlaces === 2 ? 'selected' : '') + '>2 — 1,500.00</option>' +
                                    '</select>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="grid grid-cols-1 md:grid-cols-2 gap-2">' +
                            '<div class="settings-card">' +
                                '<div class="flex items-center justify-between">' +
                                    '<div>' +
                                        '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Allow Page Zoom</h4>' +
                                        '<p class="text-[9px] text-slate-400 font-bold mt-0.5">Enable pinch-to-zoom gestures</p>' +
                                    '</div>' +
                                    '<label class="relative inline-flex items-center cursor-pointer">' +
                                        '<input type="checkbox" id="zoomToggle" ' + (allowZoom ? 'checked' : '') + ' onchange="if(!budget.settings) budget.settings={}; budget.settings.allowZoom = this.checked; saveBudget(); mBT.ui.updateViewport();" class="sr-only peer">' +
                                        '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="settings-card">' +
                                '<div class="flex items-center justify-between">' +
                                    '<div>' +
                                        '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Display Theme</h4>' +
                                        '<p class="text-[9px] text-slate-400 font-bold mt-0.5">Toggle Premium Dark / Classic Light</p>' +
                                    '</div>' +
                                    '<label class="relative inline-flex items-center cursor-pointer">' +
                                        '<input type="checkbox" id="themeToggle" ' + (localStorage.getItem('mbt_active_theme') === 'dark' ? 'checked' : '') + ' onchange="mBT.ui.setTheme(this.checked ? \'dark\' : \'light\');" class="sr-only peer">' +
                                        '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="settings-card">' +
                                '<div class="flex items-center justify-between">' +
                                    '<div>' +
                                        '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Compact View</h4>' +
                                        '<p class="text-[9px] text-slate-400 font-bold mt-0.5">Denser layout for small screens</p>' +
                                    '</div>' +
                                    '<label class="relative inline-flex items-center cursor-pointer">' +
                                        '<input type="checkbox" id="compactModeToggle" ' + (isCompact ? 'checked' : '') + ' onchange="if(!budget.settings) budget.settings={}; budget.settings.compactMode = this.checked; saveBudget(); render();" class="sr-only peer">' +
                                        '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="settings-card">' +
                                '<div class="flex items-center justify-between">' +
                                    '<div>' +
                                        '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Classic Theme</h4>' +
                                        '<p class="text-[9px] text-slate-400 font-bold mt-0.5">Legacy visual style (Pre-v19.54)</p>' +
                                    '</div>' +
                                    '<label class="relative inline-flex items-center cursor-pointer">' +
                                        '<input type="checkbox" id="classicThemeToggle" ' + (isClassic ? 'checked' : '') + ' onchange="if(!budget.settings) budget.settings={}; budget.settings.classicTheme = this.checked; saveBudget(); render();" class="sr-only peer">' +
                                        '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-600"></div>' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="settings-card">' +
                                '<div class="flex items-center justify-between">' +
                                    '<div>' +
                                        '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Open Tools In-App</h4>' +
                                        '<p class="text-[9px] text-slate-400 font-bold mt-0.5">Stages, Publish etc. open inside main window</p>' +
                                    '</div>' +
                                    '<label class="relative inline-flex items-center cursor-pointer">' +
                                        '<input type="checkbox" id="navPrefToggle" ' + (JSON.parse(localStorage.getItem('mBT_openToolsInternal') !== null ? localStorage.getItem('mBT_openToolsInternal') : 'true') ? 'checked' : '') + ' onchange="localStorage.setItem(\'mBT_openToolsInternal\', this.checked);" class="sr-only peer">' +
                                        '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="settings-card">' +
                                '<div class="flex items-center justify-between">' +
                                    '<div>' +
                                        '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Auto-Fetch Rates</h4>' +
                                        '<p class="text-[9px] text-slate-400 font-bold mt-0.5">Refresh exchange rates on startup</p>' +
                                    '</div>' +
                                    '<label class="relative inline-flex items-center cursor-pointer">' +
                                        '<input type="checkbox" id="autoFetchRatesToggle" ' + (autoFetchRates ? 'checked' : '') + ' onchange="localStorage.setItem(\'' + storageKeyPrefix + 'auto_fetch_rates\', this.checked);" class="sr-only peer">' +
                                        '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="settings-card">' +
                                '<div class="flex items-center justify-between">' +
                                    '<div>' +
                                        '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Auto-Hide Nav</h4>' +
                                        '<p class="text-[9px] text-slate-400 font-bold mt-0.5">HUD slides away when idle</p>' +
                                    '</div>' +
                                    '<label class="relative inline-flex items-center cursor-pointer">' +
                                        '<input type="checkbox" id="autoHideNavToggle" ' + (autoHideNav ? 'checked' : '') + ' onchange="localStorage.setItem(\'mBT_autoHideNav\', this.checked); if(typeof mBTNavHUD !== \'undefined\') mBTNavHUD.apply();" class="sr-only peer">' +
                                        '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="settings-card">' +
                                '<div class="flex items-center justify-between">' +
                                    '<div>' +
                                        '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Navigation Visibility</h4>' +
                                        '<p class="text-[9px] text-slate-400 font-bold mt-0.5">Show/Hide HUD buttons</p>' +
                                    '</div>' +
                                    '<button onclick="mBT.features.settings.openFooterVisModal()" class="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors flex items-center gap-1">' + mBTAssets.eye + ' Manage</button>' +
                                '</div>' +
                            '</div>' +
                            '<div class="settings-card">' +
                                '<div class="flex items-center justify-between">' +
                                    '<div>' +
                                        '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Developer Mode</h4>' +
                                        '<p class="text-[9px] text-slate-400 font-bold mt-0.5">Show advanced tools and logs</p>' +
                                    '</div>' +
                                    '<label class="relative inline-flex items-center cursor-pointer">' +
                                        '<input type="checkbox" onchange="localStorage.setItem(\'mBT_devMode\', this.checked); location.reload();" ' + (localStorage.getItem('mBT_devMode') === 'true' ? 'checked' : '') + ' class="sr-only peer">' +
                                        '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="settings-card">' +
                                '<div class="flex items-center justify-between">' +
                                    '<div>' +
                                        '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Show Funding Bar</h4>' +
                                        '<p class="text-[9px] text-slate-400 font-bold mt-0.5">Display the Secured / Gap funding meter</p>' +
                                    '</div>' +
                                    '<label class="relative inline-flex items-center cursor-pointer">' +
                                        '<input type="checkbox" ' + ((budget.settings && budget.settings.showFundingBar === false) ? '' : 'checked') + ' onchange="if(!budget.settings) budget.settings={}; budget.settings.showFundingBar = this.checked; saveBudget(); mBT.ui.toolbar.update();" class="sr-only peer">' +
                                        '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="settings-card">' +
                                '<div class="flex items-center justify-between">' +
                                    '<div>' +
                                        '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Show Timeline Bar</h4>' +
                                        '<p class="text-[9px] text-slate-400 font-bold mt-0.5">Display the Stages sparkline HUD</p>' +
                                    '</div>' +
                                    '<label class="relative inline-flex items-center cursor-pointer">' +
                                        '<input type="checkbox" ' + ((budget.settings && budget.settings.showTimelineBar === false) ? '' : 'checked') + ' onchange="if(!budget.settings) budget.settings={}; budget.settings.showTimelineBar = this.checked; saveBudget(); mBT.ui.toolbar.update();" class="sr-only peer">' +
                                        '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="grid grid-cols-3 gap-2">' +
                             '<a href="https://raw.githubusercontent.com/moollc/mooBudgetTool/refs/heads/main/mBT/index.html" target="_blank" download="moobudget-beta.html" class="flex items-center justify-center gap-2 px-3 py-2 ' + _btnBg + ' rounded-xl font-black text-[9px] uppercase tracking-widest transition-colors">' + mBTAssets.cloud + ' Get Beta</a>' +
                             '<button onclick="hardResetApp()" class="flex items-center justify-center gap-2 px-3 py-2 ' + _btnRose + ' rounded-xl font-black text-[9px] uppercase tracking-widest transition-colors">' + mBTAssets.zap + ' Fix Bugs</button>' +
                             '<button onclick="mBTME.close(\'settingsModal\'); showCoffeeWidget();" class="flex items-center justify-center gap-2 px-3 py-2 bg-[#FFDD00] text-black rounded-xl font-black text-[9px] uppercase tracking-widest hover:opacity-90 transition-opacity">' + mBTAssets.coffee + ' Support</button>' +
                        '</div>' +
                        '<div class="grid grid-cols-2 gap-2 mt-1">' +
                            '<button onclick="mBT.ui.showLegalDoc(\'UserAgreement.md\')" class="py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">User Agreement</button>' +
                            '<button onclick="mBT.ui.showLegalDoc(\'PrivacyPolicy.md\')" class="py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">Privacy Policy</button>' +
                        '</div>' +
                        '<div id="storageHealthCard" class="settings-card mt-1">' +
                            '<div class="flex justify-between items-center mb-1.5">' +
                                '<h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Storage Health</h4>' +
                                '<span id="storageHealthPct" class="text-[9px] font-black text-slate-400">Checking...</span>' +
                            '</div>' +
                            '<div class="w-full bg-slate-200 rounded-full h-1.5 mb-1.5">' +
                                '<div id="storageHealthBar" class="h-1.5 rounded-full bg-emerald-500 transition-all" style="width:0%"></div>' +
                            '</div>' +
                            '<p id="storageHealthDetail" class="text-[8px] text-slate-400 font-bold">Calculating local storage usage...</p>' +
                        '</div>' +
                    '</div>';
        }
        if (tabName === 'connections') {
            /* Webhook lives only in assistant settings sheet (AIModule openChat).
               Same key: storageKeyPrefix + cloudWebhook. Do not reintroduce a card here. */
            var ma = window.mBTAssistant;
            var aiProvidersCardBody = '';

            if (!ma) {
                aiProvidersCardBody = '<div class="p-4 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">AI Service Unavailable</div>';
            } else {
                var providerKeys = Object.keys(ma.ENDPOINTS || {});
                var activeProvider = ma.getProvider();
                var connStatusMap = (window.mBT && window.mBT.registry && window.mBT.registry.connStatus) || {};
                var checkedTs = (window.mBT && window.mBT.registry && window.mBT.registry.connStatusTs) || 0;

                var liveN = 0, downN = 0, notSetN = 0;
                var pi, pk, st, hasKey;
                for (pi = 0; pi < providerKeys.length; pi++) {
                    pk = providerKeys[pi];
                    hasKey = !!(mBT.features.ai.getStoredApiKey(pk));
                    if (pk === 'lmstudio') hasKey = true;
                    st = connStatusMap[pk];
                    if (!hasKey && pk !== 'lmstudio') {
                        notSetN++;
                    } else if (st && st.state === 'live') {
                        liveN++;
                    } else if (st && st.state === 'rejected') {
                        downN++;
                    } else if (st && st.state === 'nokey') {
                        notSetN++;
                    }
                }

                var checkedLabel = checkedTs
                    ? ('Checked ' + esc(_mBTConnFormatTime(checkedTs)) + ' \u00b7 free endpoint')
                    : 'Checking \u00b7 free endpoint';

                var headerStrip =
                    '<div class="flex items-center gap-4 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">' +
                        '<div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span><span id="connCountLive" class="text-[9px] font-black uppercase tracking-widest text-slate-500">' + liveN + ' live</span></div>' +
                        '<div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span><span id="connCountDown" class="text-[9px] font-black uppercase tracking-widest text-slate-500">' + downN + ' down</span></div>' +
                        '<div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-slate-300"></span><span id="connCountNotSet" class="text-[9px] font-black uppercase tracking-widest text-slate-400">' + notSetN + ' not set</span></div>' +
                        '<div class="flex-1"></div>' +
                        '<span id="connCheckedAt" class="text-[9px] font-bold text-slate-400">' + checkedLabel + '</span>' +
                        '<button type="button" onclick="window.mBT_UI_Conn_recheck()" class="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all">Recheck</button>' +
                    '</div>';

                var rowsHtml = '';
                for (pi = 0; pi < providerKeys.length; pi++) {
                    pk = providerKeys[pi];
                    rowsHtml += _mBTConnBuildRowHtml(pk, ma, activeProvider, connStatusMap[pk], esc);
                }

                var datalistOpts = providerKeys.map(function (p) {
                    return '<option value="' + esc(ma.getProviderLabel(p)) + '">';
                }).join('');

                var firstKeyLink = KEY_DASHBOARDS[activeProvider] || KEY_DASHBOARDS.openai || '#';

                var addRow =
                    '<div class="border-t-2 border-slate-900 bg-slate-50 px-4 py-3">' +
                        '<div class="flex items-center gap-2">' +
                            '<button type="button" onclick="window.mBT_UI_Conn_add()" class="w-7 h-7 shrink-0 rounded-lg bg-blue-600 text-white text-sm font-black flex items-center justify-center hover:bg-blue-500 active:scale-95 transition-all" title="Save provider key">+</button>' +
                            '<div class="w-[190px] shrink-0"><input id="connAddProvider" list="connProviderList" placeholder="Provider name" class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"><datalist id="connProviderList">' + datalistOpts + '</datalist></div>' +
                            '<div class="flex-1 min-w-0"><input id="connAddKey" type="password" placeholder="API key" class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"></div>' +
                            '<a id="connGetKeyLink" href="' + esc(firstKeyLink) + '" target="_blank" rel="noopener" class="shrink-0 text-[8px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 px-1">Get key \u2197</a>' +
                        '</div>' +
                        '<p class="text-[9px] font-bold text-slate-400 mt-2 ml-9">Stored on this device only. Sent to the provider when you use chat, fill or generation.</p>' +
                    '</div>';

                aiProvidersCardBody =
                    '<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">' +
                        headerStrip +
                        '<div id="connProviderRows" class="divide-y divide-slate-100 overflow-y-auto no-scrollbar" style="max-height:250px;">' +
                            rowsHtml +
                        '</div>' +
                        addRow +
                    '</div>';

                /* Kick status checks after paint. Do not block render. */
                setTimeout(function () {
                    if (window.mBT_UI_Conn_runStatusChecks) {
                        window.mBT_UI_Conn_runStatusChecks(false);
                    }
                }, 0);
            }

            return '<div class="h-full overflow-y-auto no-scrollbar p-4 space-y-3 animate-in fade-in duration-300">' +
                        '<div class="connection-card">' +
                            aiProvidersCardBody +
                        '</div>' +
                    '</div>';
        }
        if (tabName === 'cloud') {
            var isDark = localStorage.getItem('mbt_active_theme') === 'dark';
            var _i = isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-800';
            var _sep = isDark ? 'border-slate-700' : 'border-slate-50';
            var _sw = isDark ? 'bg-slate-600' : 'bg-slate-200';
            var ogCloudOn = JSON.parse(localStorage.getItem('moo_og_cloud_sync') || 'true');
            var isSignedIn = !!(localStorage.getItem('mbt_supabase_auth_token'));
            var signedInEmail = localStorage.getItem('mbt_supabase_user_email') || '';
            var profileName = localStorage.getItem('mbt_profile_display_name') || '';
            var profileRegion = localStorage.getItem('mbt_profile_region') || 'Jamaica';
            var profileRole = localStorage.getItem('mbt_profile_role') || '';
            var syncOnReconnect = localStorage.getItem('mbt_supabase_sync_on_reconnect') === 'true';
            var ogShareContacts = JSON.parse(localStorage.getItem('moo_og_share_contacts') || 'false');

            var authSectionHtml = isSignedIn ?
                ('<div class="flex items-center justify-between">' +
                    '<div class="flex items-center gap-3">' +
                        '<div class="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xs border border-emerald-100 uppercase tracking-tighter">' +
                            signedInEmail.charAt(0) +
                        '</div>' +
                        '<div>' +
                            '<div class="text-[10px] font-black settings-text-primary tracking-tight leading-none mb-1">' + esc(signedInEmail) + '</div>' +
                            '<div class="flex items-center gap-1.5">' +
                                '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>' +
                                '<span class="text-[8px] text-slate-400 uppercase tracking-widest font-black">Connected to Cloud</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<button onclick="mBT.features.settings.cloudSignOut()" class="px-3 py-1.5 text-slate-400 hover:text-rose-500 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all">Sign Out</button>' +
                '</div>') :
                ('<p class="text-[10px] font-bold text-slate-400 mb-3 leading-relaxed">Sign in to sync your projects and collaborate on shared budgets.</p>' +
                '<button onclick="window.mBTShowCollabAuth(function(){ mBT.features.settings.open(\'cloud\'); });" class="w-full py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95">Sign In / Create Account</button>');

            return '<div class="h-full overflow-y-auto no-scrollbar p-4 space-y-3 animate-in fade-in duration-300">' +

                        '<!-- Authentication Section -->' +
                        '<div class="settings-card transition-all duration-300">' +
                            authSectionHtml +
                        '</div>' +

                        '<!-- User Profile (visible when signed in) -->' +
                        (isSignedIn ?
                        ('<div class="settings-card space-y-3">' +
                            '<div>' +
                                '<h3 class="text-[10px] font-black uppercase tracking-widest settings-text-primary mb-0.5">Profile Identity</h3>' +
                                '<p class="text-[9px] text-slate-400 font-bold">Public identity used for community database contributions.</p>' +
                            '</div>' +
                            '<div class="grid grid-cols-1 gap-2">' +
                                '<div class="space-y-1.5">' +
                                    '<label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>' +
                                    '<input type="text" id="profileDisplayName" placeholder="e.g. Maverick J." value="' + esc(profileName) + '" class="w-full px-3 py-2 ' + _i + ' border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">' +
                                '</div>' +
                                '<div class="grid grid-cols-2 gap-2">' +
                                    '<div class="space-y-1.5">' +
                                        '<label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Home Market</label>' +
                                        '<select id="profileRegion" class="w-full px-3 py-2 ' + _i + ' border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer">' +
                                            Object.keys(mBTOG.RATE_REGIONS).map(function (r) { return '<option value="' + r + '"' + (profileRegion === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') +
                                        '</select>' +
                                    '</div>' +
                                    '<div class="space-y-1.5">' +
                                        '<label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Standard Role</label>' +
                                        '<input type="text" id="profileRole" placeholder="Producer / DP" value="' + esc(profileRole) + '" class="w-full px-3 py-2 ' + _i + ' border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="pt-3 border-t ' + _sep + '">' +
                                '<button onclick="var el=document.getElementById(\'passwordChangeSect\'); el.classList.toggle(\'hidden\');" class="text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 mb-2 transition-colors">Change Password?</button>' +
                                '<div id="passwordChangeSect" class="hidden space-y-2 animate-in slide-in-from-top-2 duration-300">' +
                                    '<input type="password" id="newPasswordInput" placeholder="New Secret Password" class="w-full px-3 py-2 ' + _i + ' border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">' +
                                    '<button onclick="mBT.features.settings.cloudChangePassword()" class="w-full py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">Update Security</button>' +
                                '</div>' +
                            '</div>' +
                            '<button onclick="mBT.features.settings.saveProfile()" class="w-full py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all active:scale-95">Synchronize Profile</button>' +
                        '</div>') : '') +

                        '<!-- DATABASE Community Rates -->' +
                        '<div class="settings-card">' +
                            '<h3 class="text-[10px] font-black uppercase tracking-widest settings-text-primary mb-0.5">Community Rates</h3>' +
                            '<p class="text-[9px] text-slate-400 font-bold mb-2">Pull updated industry rates from the shared community database. No account required.</p>' +
                            '<div class="flex items-center justify-between mb-2">' +
                                '<span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Auto-sync on start</span>' +
                                '<label class="relative inline-flex items-center cursor-pointer">' +
                                    '<input type="checkbox" id="ogCloudSyncToggle" ' + (ogCloudOn ? 'checked' : '') + ' onchange="mBT.features.settings.toggleCloudSync(this.checked);" class="sr-only peer">' +
                                    '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>' +
                                '</label>' +
                            '</div>' +
                            '<button onclick="if(window.mBTOG && mBTOG.syncFromCloud){ mBTOG.syncFromCloud().then(function(n){ mBTME.alert(\'DATABASE\', n + \' rate(s) pulled from community.\'); mBT.features.settings.open(\'cloud\'); }).catch(function(e){ console.error(\'Sync Failed:\', e); mBTME.alert(\'Sync Error\', \'Failed to sync rates from community.\'); }); } else { mBTME.alert(\'DATABASE\', \'Engine not available.\'); }" class="w-full py-2 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-500 transition-all">Sync Rates Now</button>' +
                        '</div>' +

                        '<!-- Project Backup + Sync -->' +
                        '<div class="settings-card">' +
                            '<div class="flex items-center justify-between mb-0.5">' +
                                '<h3 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Background Sync</h3>' +
                                '<div id="sync-heartbeat-pill" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-slate-100 text-slate-400">' +
                                    '<span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>' +
                                    'Status Check...' +
                                '</div>' +
                            '</div>' +
                            '<p class="text-[9px] text-slate-400 font-bold mb-2">Automatically sync your projects, stages, and rates to the cloud for cross-device access.</p>' +
                            '<div class="flex items-center justify-between mb-2">' +
                                '<span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Auto-Sync Changes</span>' +
                                '<label class="relative inline-flex items-center cursor-pointer">' +
                                    '<input type="checkbox" id="syncOnReconnectToggle" ' + (syncOnReconnect ? 'checked' : '') + ' onchange="localStorage.setItem(\'mbt_supabase_sync_on_reconnect\', this.checked ? \'true\' : \'false\');" class="sr-only peer">' +
                                    '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>' +
                                '</label>' +
                            '</div>' +
                            '<button onclick="if(window.mBTSync && localStorage.getItem(\'mbt_supabase_auth_token\')){ mBTSync.pushAll().then(function(r){ mBTME.alert(\'Backup\', r.synced + \' records pushed, \' + r.errors + \' errors.\'); }); } else { mBTME.alert(\'Backup\', \'You must be signed in to force push data.\'); }" class="w-full py-2 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 transition-all">Force Push Data Now</button>' +
                        '</div>' +

                        '<!-- Contact Sharing Privacy -->' +
                        '<div class="settings-card">' +
                            '<h3 class="text-[10px] font-black uppercase tracking-widest settings-text-primary mb-0.5">Contact Sharing</h3>' +
                            '<p class="text-[9px] text-slate-400 font-bold mb-2">Allow contacts you mark as shared to be published to the OpenGate community roster. Only contacts with sharing enabled are affected.</p>' +
                            '<div class="flex items-center justify-between">' +
                                '<span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Publish Shared Contacts</span>' +
                                '<label class="relative inline-flex items-center cursor-pointer">' +
                                    '<input type="checkbox" id="ogShareContactsToggle" ' + (ogShareContacts ? 'checked' : '') + ' onchange="mBT.features.settings.toggleContactSharing(this.checked);" class="sr-only peer">' +
                                    '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>' +
                                '</label>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
        }
        if (tabName === 'database') {
            var dbSubTab = subTab || 'contacts';
            var dbTabs = [
                { id: 'contacts', label: 'Contacts' },
                { id: 'lineItems', label: 'Rates' },
                { id: 'templates', label: 'Templates' },
                { id: 'trash', label: 'Bin' }
            ];
            var nav = '<div class="flex border-b border-slate-100 bg-slate-50/50 rounded-t-xl select-none">' +
                dbTabs.map(function (t) {
                    var isActive = t.id === dbSubTab;
                    var cls = isActive ? 'bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50';
                    return '<button type="button" data-action="nav-settings-db" data-tab="' + t.id + '" class="flex-1 py-0.5 leading-none text-[10px] font-black uppercase tracking-widest transition-all ' + cls + '">' + t.label + '</button>';
                }).join('') +
                '</div>';

            return '<div class="flex flex-col h-full p-2 pb-0 space-y-0.5">' +
                    nav +
                    '<div class="flex-grow flex flex-col min-h-0 overflow-hidden">' +
                        renderDbView(dbSubTab) +
                    '</div>' +
                '</div>';
        }
        if (tabName === 'updates') {
            var isDark = localStorage.getItem('mbt_active_theme') === 'dark';
            var _card = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100';
            var _update = isDark ? 'bg-amber-900/30 border-amber-700 text-amber-300' : 'bg-amber-50 border-amber-100 text-amber-600';
            var _checking = isDark ? 'bg-blue-900/30 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-600';
            var updateStatus = (window.mBT && window.mBT.registry && window.mBT.registry.updateStatus) || {};
            var updateAvailable = updateStatus.available || false;
            var isChecking = updateStatus.checking || false;
            /* Derive from the running build, never a hardcoded literal — a stale
               literal here reports the wrong version to every user forever. */
            var currentVersion = updateStatus.localVersion ||
                (typeof window.APP_VERSION !== 'undefined' ? 'v' + window.APP_VERSION : 'unknown');

            var statusMsg = '';
            if (isChecking) {
                statusMsg = '<div class="border rounded-lg p-3 ' + _checking + '"><p class="text-[9px] font-bold text-center">Checking for updates..</p></div>';
            } else if (updateAvailable) {
                statusMsg = '<div class="border rounded-lg p-3 ' + _update + '"><p class="text-[9px] font-bold text-center">Update ready — reload to activate the latest version</p></div>';
            } else {
                statusMsg = '<div class="border rounded-lg p-3 border-emerald-100 bg-emerald-50 text-emerald-600"><p class="text-[9px] font-bold text-center">You are on the latest version (' + esc(currentVersion) + ')</p></div>';
            }

            return '<div class="h-full overflow-y-auto no-scrollbar p-4 space-y-3 animate-in fade-in duration-300">' +
                        '<div class="border rounded-xl p-6 ' + _card + ' text-center">' +
                            '<h3 class="text-xs font-black uppercase tracking-widest mb-6 text-slate-600">Check for mBT Update</h3>' +
                            '<div class="space-y-3">' +
                                '<button onclick="mBT.features.settings.checkForUpdates()" ' + (isChecking ? 'disabled' : '') + ' class="w-full py-2.5 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 transition-all active:scale-95 ' + (isChecking ? 'opacity-50 cursor-not-allowed' : '') + '">' +
                                    (isChecking ? '⏳ Checking..' : 'Check for Updates') +
                                '</button>' +
                                (updateAvailable ? '<button onclick="if(navigator.serviceWorker && navigator.serviceWorker.controller) { navigator.serviceWorker.controller.postMessage({action: \"SKIP_WAITING\"}); window.location.reload(); } else { mBTME.alert(\"Update\", \"Offline or SW not active.\"); }" class="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95">Apply Update Now</button>' : '') +
                            '</div>' +
                            '<div class="mt-4">' +
                                statusMsg +
                            '</div>' +
                        '</div>' +
                    '</div>';
        }
        return '<div class="p-8 text-center text-slate-300 font-bold uppercase tracking-widest">Logic Stream Not Found</div>';
    };

    /* --- mBT UI Theme Logic (Bridge Implementation) --- */
    mBT.ui = mBT.ui || {};
    mBT.ui.setTheme = function (themeName) {
        themeName = themeName || 'dark';
        localStorage.setItem('mbt_active_theme', themeName);
        document.body.className = document.body.className.replace(/\bmbt-theme-\S+/g, '');
        document.body.classList.add('mbt-theme-' + themeName);
        if (themeName === 'dark') {
            document.body.classList.add('bg-slate-950');
            document.body.classList.remove('bg-slate-50');
        } else {
            document.body.classList.add('bg-slate-50');
            document.body.classList.remove('bg-slate-950');
        }
        window.dispatchEvent(new CustomEvent('mbt:theme-changed', { detail: { theme: themeName } }));
    };


    /* --- Phase 180: UI Setting Event Handlers (Anti-Injection) --- */
    window.mBT_UI_Settings_handleProviderChange = function (p) {
        var keyLinks = {
            'gemini':      'https://aistudio.google.com/app/apikey',
            'openai':      'https://platform.openai.com/api-keys',
            'deepseek':    'https://platform.deepseek.com/api_keys',
            'grok':        'https://console.x.ai/',
            'anthropic':   'https://console.anthropic.com/settings/keys',
            'openrouter':  'https://openrouter.ai/keys',
            'lmstudio':    '#'
        };
        mBT.features.ai.saveSelectedProvider(p);
        var link = document.getElementById('apiKeyLink');
        if (link) {
            link.href = keyLinks[p] || '#';
            link.style.visibility = (p === 'lmstudio') ? 'hidden' : 'visible';
        }
        var ki = document.getElementById('apiKeyInput');
        if (ki) ki.value = mBT.features.ai.getStoredApiKey(p);

        var apiRow = document.getElementById('apiCredRow');
        var lmFields = document.getElementById('lmstudioFields');
        if (apiRow) apiRow.style.display = (p === 'lmstudio') ? 'none' : 'block';
        if (lmFields) lmFields.style.display = (p === 'lmstudio') ? 'block' : 'none';

        var cached = [];
        try { cached = JSON.parse(localStorage.getItem('mbt_cached_chat_models_' + p) || '[]'); } catch (e) {}
        var cSel = document.getElementById('chatModelSelect');
        var saved = localStorage.getItem('mbt_ai_chat_model_' + p) || '';
        if (cSel) {
            if (cached.length) {
                cSel.innerHTML = cached.map(function (m) {
                    var id = m.id || m;
                    var lbl = m.name || m.id || m;
                    return '<option value="' + id + '"' + (saved === id ? ' selected' : '') + '>' + lbl + '</option>';
                }).join('');
            } else {
                cSel.innerHTML = saved ? '<option value="' + saved + '" selected>' + saved + '</option>' : '<option value="" disabled selected>— fetch models —</option>';
            }
        }
    };

    window.mBT_UI_Settings_handleChatModelChange = function (m) {
        try {
            if (!m || !String(m).trim()) { console.warn('[Settings] Chat model value is empty; ignoring.'); return; }
            var pSel = document.getElementById('aiProviderSelect');
            var p = pSel ? pSel.value : 'openai';
            var val = String(m).trim();
            var ma = window.mBTAssistant;
            if (ma && typeof ma.setChatModel === 'function') {
                ma.setChatModel(p, val);
            } else {
                localStorage.setItem('mbt_ai_chat_model_' + p, val);
                if (p === 'openrouter') {
                    localStorage.setItem('mbt_openrouter_model', val);
                }
            }
        } catch (err) {
            console.error('[Settings] Failed to persist chat model:', err);
        }
    };

    window.mBT_UI_Settings_handleImgModelChange = function (m) {
        if (!m) return;
        localStorage.setItem('mbt_ai_image_model', m);
        var ma = window.mBTAssistant || (window.mBT && window.mBT.features && window.mBT.features.ai);
        if (ma && typeof ma.setImageModel === 'function') {
            ma.setImageModel(m);
        }
    };
    
    /* Cost-tier sort for providers whose APIs return no pricing data */
    function _tierSort(models, provider) {
        function tier(id) {
            var s = (id || '').toLowerCase();
            if (provider === 'openai') {
                if (s.indexOf('o3-mini') !== -1)          return 4;
                if (s.indexOf('o3') !== -1)               return 6;
                if (s.indexOf('o1-mini') !== -1)          return 5;
                if (s.indexOf('o1') !== -1)               return 6;
                if (s.indexOf('gpt-4o-mini') !== -1)      return 1;
                if (s.indexOf('gpt-4o') !== -1)           return 2;
                if (s.indexOf('gpt-4-turbo') !== -1)      return 3;
                if (s.indexOf('gpt-4') !== -1)            return 3;
                if (s.indexOf('gpt-3') !== -1)            return 0;
                return 5;
            }
            if (provider === 'anthropic') {
                if (s.indexOf('haiku') !== -1)  return 0;
                if (s.indexOf('sonnet') !== -1) return 1;
                if (s.indexOf('opus') !== -1)   return 2;
                return 1;
            }
            if (provider === 'deepseek') {
                if (s.indexOf('chat') !== -1)     return 0;
                if (s.indexOf('reasoner') !== -1) return 1;
                return 0;
            }
            if (provider === 'grok') {
                if (s.indexOf('grok-2') !== -1 && s.indexOf('mini') !== -1) return 0;
                if (s.indexOf('grok-2') !== -1)  return 1;
                if (s.indexOf('grok-3') !== -1 && s.indexOf('mini') !== -1) return 2;
                if (s.indexOf('grok-3') !== -1)  return 3;
                return 2;
            }
            return 99;
        }
        models.sort(function (a, b) {
            var ta = tier(a.id), tb = tier(b.id);
            if (ta !== tb) return ta - tb;
            return (a.id || '').localeCompare(b.id || '');
        });
    }

    var KEY_DASHBOARDS = {
        gemini:     'https://aistudio.google.com/app/apikey',
        openai:     'https://platform.openai.com/api-keys',
        openrouter: 'https://openrouter.ai/keys',
        deepseek:   'https://platform.deepseek.com/api_keys',
        grok:       'https://console.x.ai/',
        anthropic:  'https://console.anthropic.com/settings/keys'
    };

    /* ---- Connections panel (row status, caps, free model-list ping) ---- */
    var CONN_MODELS_URLS = {
        openai:    'https://api.openai.com/v1/models',
        deepseek:  'https://api.deepseek.com/models',
        grok:      'https://api.x.ai/v1/models',
        anthropic: 'https://api.anthropic.com/v1/models',
        openrouter:'https://openrouter.ai/api/v1/models',
        lmstudio:  'http://localhost:1234/v1/models'
    };

    var CONN_CAP_PATTERNS = [
        { re: /grok-4|grok-3|grok-2-vision|grok-beta/i, caps: { chat: true, image: true, video: true } },
        { re: /grok.*image|grok-2-image|aurora/i, caps: { chat: false, image: true, video: false } },
        { re: /grok.*video|sora|veo|runway|kling|luma/i, caps: { chat: false, image: false, video: true } },
        { re: /imagen|dall-e|flux|stable-diffusion|sdxl|pollinations|gpt-image/i, caps: { chat: false, image: true, video: false } },
        { re: /gemini-.*-image|gemini.*flash-image/i, caps: { chat: true, image: true, video: false } },
        { re: /gemini/i, caps: { chat: true, image: false, video: false } },
        { re: /claude|anthropic|deepseek|gpt-4|gpt-3|gpt-5|o1|o3|o4/i, caps: { chat: true, image: false, video: false } }
    ];

    function _mBTConnEsc(str) {
        if (window.mBT && window.mBT.ui && window.mBT.ui.render && typeof window.mBT.ui.render.esc === 'function') {
            return window.mBT.ui.render.esc(str);
        }
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _mBTConnJsEsc(str) {
        return String(str == null ? '' : str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function _mBTConnFormatTime(ts) {
        try {
            var d = new Date(ts);
            var h = d.getHours();
            var m = d.getMinutes();
            return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
        } catch (e) {
            return '';
        }
    }

    function _mBTConnEnsureRegistry() {
        window.mBT = window.mBT || {};
        window.mBT.registry = window.mBT.registry || {};
        if (!window.mBT.registry.connStatus) window.mBT.registry.connStatus = {};
        return window.mBT.registry;
    }

    function _mBTConnLoadCapOverrides(provider) {
        try {
            return JSON.parse(localStorage.getItem('mbt_model_caps_' + provider) || '{}') || {};
        } catch (e) {
            return {};
        }
    }

    function _mBTConnSaveCapOverrides(provider, map) {
        try {
            localStorage.setItem('mbt_model_caps_' + provider, JSON.stringify(map || {}));
        } catch (e) {}
    }

    /* Resolve caps for a model: overrides > response meta > pattern table > chat only */
    function _mBTConnResolveCaps(provider, modelId, modelMeta) {
        var id = String(modelId || '');
        var overrides = _mBTConnLoadCapOverrides(provider);
        if (overrides[id] && typeof overrides[id] === 'object') {
            return {
                chat: !!overrides[id].chat,
                image: !!overrides[id].image,
                video: !!overrides[id].video
            };
        }
        var meta = modelMeta || null;
        if (meta && meta.architecture && meta.architecture.modality) {
            var mod = String(meta.architecture.modality).toLowerCase();
            var hasText = mod.indexOf('text') !== -1 || mod.indexOf('chat') !== -1;
            var hasImage = mod.indexOf('image') !== -1;
            var hasVideo = mod.indexOf('video') !== -1;
            return {
                chat: hasText || (!hasImage && !hasVideo),
                image: hasImage,
                video: hasVideo
            };
        }
        if (meta && meta.capabilities) {
            return {
                chat: meta.capabilities.chat !== false,
                image: !!(meta.capabilities.image || meta.capabilities.vision),
                video: !!meta.capabilities.video
            };
        }
        /* OpenAI often tags image models by id only */
        if (meta && Array.isArray(meta.supportedGenerationMethods)) {
            var methods = meta.supportedGenerationMethods.join(',').toLowerCase();
            return {
                chat: methods.indexOf('generatecontent') !== -1 || methods.indexOf('chat') !== -1,
                image: methods.indexOf('image') !== -1 || id.toLowerCase().indexOf('imagen') !== -1,
                video: methods.indexOf('video') !== -1
            };
        }
        var i, pat;
        for (i = 0; i < CONN_CAP_PATTERNS.length; i++) {
            pat = CONN_CAP_PATTERNS[i];
            if (pat.re.test(id)) {
                return { chat: !!pat.caps.chat, image: !!pat.caps.image, video: !!pat.caps.video };
            }
        }
        return { chat: true, image: false, video: false };
    }

    function _mBTConnBuildCapsHtml(provider, modelId, modelMeta) {
        var caps = _mBTConnResolveCaps(provider, modelId, modelMeta);
        var parts = [];
        var iconChat = (window.mBTAssets && mBTAssets.capChat) || (window.mBTAssets && mBTAssets.chat) || '';
        var iconImage = (window.mBTAssets && mBTAssets.capImage) || (window.mBTAssets && mBTAssets.image) || '';
        var iconVideo = (window.mBTAssets && mBTAssets.capVideo) || (window.mBTAssets && mBTAssets.film) || '';
        var pEsc = _mBTConnJsEsc(provider);
        var mEsc = _mBTConnJsEsc(modelId || '');
        /* Supported caps: full colour. Off caps: faint, still clickable so a wrong
           guess is one tap either way. Default detection only lights supported ones. */
        function capBtn(kind, title, icon, on) {
            var cls = on
                ? 'cursor-pointer rounded p-0.5 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
                : 'cursor-pointer rounded p-0.5 text-slate-300 opacity-25 hover:opacity-60';
            return '<span role="button" tabindex="0" data-conn-cap="' + kind + '" title="' + title + '" onclick="window.mBT_UI_Conn_toggleCap(\'' + pEsc + '\',\'' + mEsc + '\',\'' + kind + '\')" class="' + cls + '">' + icon + '</span>';
        }
        parts.push(capBtn('chat', 'Chat', iconChat, caps.chat));
        parts.push(capBtn('image', 'Image generation', iconImage, caps.image));
        parts.push(capBtn('video', 'Video generation', iconVideo, caps.video));
        return parts.join('');
    }

    function _mBTConnStatusView(status, hasKey) {
        if (!hasKey) {
            return {
                dot: 'bg-slate-300',
                word: 'No key',
                wordCls: 'text-slate-300',
                detail: '',
                opacity: true
            };
        }
        if (!status || status.state === 'checking') {
            return {
                dot: 'bg-blue-500 animate-pulse',
                word: 'Checking',
                wordCls: 'text-blue-500',
                detail: '',
                opacity: false
            };
        }
        if (status.state === 'live') {
            return {
                dot: 'bg-emerald-500',
                word: 'Live',
                wordCls: 'text-emerald-600',
                detail: status.ms != null ? (String(status.ms) + 'ms') : '',
                opacity: false
            };
        }
        if (status.state === 'rejected') {
            return {
                dot: 'bg-rose-500',
                word: 'Rejected',
                wordCls: 'text-rose-600',
                detail: status.code ? String(status.code) : 'unreachable',
                opacity: false
            };
        }
        if (status.state === 'nokey') {
            return {
                dot: 'bg-slate-300',
                word: 'No key',
                wordCls: 'text-slate-300',
                detail: '',
                opacity: true
            };
        }
        return {
            dot: 'bg-slate-300',
            word: 'No key',
            wordCls: 'text-slate-300',
            detail: '',
            opacity: true
        };
    }

    function _mBTConnBuildRowHtml(provider, ma, activeProvider, status, escFn) {
        var esc = escFn || _mBTConnEsc;
        var hasKey = !!(mBT.features.ai.getStoredApiKey(provider));
        if (provider === 'lmstudio') hasKey = true;
        var view = _mBTConnStatusView(status, hasKey);
        var pKeys = Object.keys(ma.ENDPOINTS || {});
        var opts = pKeys.map(function (p) {
            return '<option value="' + esc(p) + '"' + (p === provider ? ' selected' : '') + '>' + esc(ma.getProviderLabel(p)) + '</option>';
        }).join('');

        var cached = [];
        try { cached = JSON.parse(localStorage.getItem('mbt_cached_chat_models_' + provider) || '[]'); } catch (e) {}
        var storedModel = '';
        if (ma.getChatModel) storedModel = ma.getChatModel(provider) || '';
        else storedModel = localStorage.getItem('mbt_ai_chat_model_' + provider) || '';

        var modelCell = '';
        if (!hasKey && provider !== 'lmstudio') {
            modelCell = '<div class="flex-1 min-w-0 text-[9px] font-bold text-slate-300 px-2">Add a key to see models</div>';
        } else {
            var modelOpts = '';
            var mi, mid, mlbl;
            if (cached.length) {
                for (mi = 0; mi < cached.length; mi++) {
                    mid = (typeof cached[mi] === 'object') ? (cached[mi].id || cached[mi]) : cached[mi];
                    mlbl = (typeof cached[mi] === 'object') ? (cached[mi].name || cached[mi].id || mid) : mid;
                    modelOpts += '<option value="' + esc(mid) + '"' + (storedModel === mid ? ' selected' : '') + '>' + esc(mlbl) + '</option>';
                }
            } else if (storedModel) {
                modelOpts = '<option value="' + esc(storedModel) + '" selected>' + esc(storedModel) + '</option>';
            } else {
                modelOpts = '<option value="" disabled selected>Fetch models</option>';
            }
            modelCell =
                '<div class="flex-1 min-w-0">' +
                    '<select data-conn-model="' + esc(provider) + '" onchange="window.mBT_UI_Conn_modelChange(\'' + esc(provider) + '\', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer">' +
                        modelOpts +
                    '</select>' +
                '</div>';
        }

        var modelForCaps = storedModel;
        if (!modelForCaps && cached.length) {
            modelForCaps = (typeof cached[0] === 'object') ? (cached[0].id || '') : cached[0];
        }
        var capsHtml = (hasKey && modelForCaps) ? _mBTConnBuildCapsHtml(provider, modelForCaps, null) : '';

        var editLabel = hasKey ? 'Edit' : 'Add';
        var editCls = hasKey
            ? 'text-slate-400 hover:text-blue-600'
            : 'text-blue-600 hover:text-blue-500';

        var rowOpacity = view.opacity ? ' opacity-55 hover:opacity-100' : '';

        return '<div class="flex items-center gap-2 px-4 py-2 hover:bg-slate-50/70 transition-colors' + rowOpacity + '" data-conn-row="' + esc(provider) + '">' +
            '<span data-conn-dot class="w-2 h-2 rounded-full shrink-0 ' + view.dot + '"></span>' +
            '<div class="w-[190px] shrink-0 min-w-0">' +
                '<select data-conn-provider-sel="' + esc(provider) + '" onchange="window.mBT_UI_Conn_rowProviderChange(\'' + esc(provider) + '\', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer">' +
                    opts +
                '</select>' +
            '</div>' +
            '<div class="w-[124px] shrink-0 flex items-center gap-1.5" data-conn-state-cell="' + esc(provider) + '">' +
                '<button type="button" onclick="window.mBT_UI_Conn_fetch(\'' + esc(provider) + '\')" class="px-2 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-500 transition-all">Fetch</button>' +
                '<span data-conn-word class="text-[9px] font-black uppercase tracking-widest ' + view.wordCls + '">' + esc(view.word) + '</span>' +
                '<span data-conn-detail class="text-[8px] font-bold text-slate-400">' + esc(view.detail) + '</span>' +
            '</div>' +
            modelCell +
            '<div class="w-[64px] shrink-0 flex items-center justify-center gap-1 text-slate-400" data-conn-caps="' + esc(provider) + '">' + capsHtml + '</div>' +
            '<button type="button" onclick="window.mBT_UI_Conn_edit(\'' + esc(provider) + '\')" class="w-[34px] shrink-0 text-[9px] font-black uppercase tracking-widest ' + editCls + '">' + editLabel + '</button>' +
        '</div>';
    }

    function _mBTConnUpdateHeaderCounts() {
        var reg = _mBTConnEnsureRegistry();
        var ma = window.mBTAssistant;
        if (!ma || !ma.ENDPOINTS) return;
        var keys = Object.keys(ma.ENDPOINTS);
        var liveN = 0, downN = 0, notSetN = 0, i, p, st, hasKey;
        for (i = 0; i < keys.length; i++) {
            p = keys[i];
            hasKey = !!(mBT.features.ai.getStoredApiKey(p));
            if (p === 'lmstudio') hasKey = true;
            st = reg.connStatus[p];
            if (!hasKey) {
                notSetN++;
            } else if (st && st.state === 'live') {
                liveN++;
            } else if (st && st.state === 'rejected') {
                downN++;
            } else if (st && st.state === 'nokey') {
                notSetN++;
            }
        }
        var elLive = document.getElementById('connCountLive');
        var elDown = document.getElementById('connCountDown');
        var elNot = document.getElementById('connCountNotSet');
        var elTs = document.getElementById('connCheckedAt');
        if (elLive) elLive.textContent = liveN + ' live';
        if (elDown) elDown.textContent = downN + ' down';
        if (elNot) elNot.textContent = notSetN + ' not set';
        if (elTs && reg.connStatusTs) {
            elTs.textContent = 'Checked ' + _mBTConnFormatTime(reg.connStatusTs) + ' \u00b7 free endpoint';
        }
    }

    function _mBTConnPatchRow(provider) {
        var reg = _mBTConnEnsureRegistry();
        var status = reg.connStatus[provider];
        var hasKey = !!(mBT.features.ai.getStoredApiKey(provider));
        if (provider === 'lmstudio') hasKey = true;
        var view = _mBTConnStatusView(status, hasKey);
        var row = document.querySelector('[data-conn-row="' + provider + '"]');
        if (!row) return;
        var dot = row.querySelector('[data-conn-dot]');
        var word = row.querySelector('[data-conn-word]');
        var detail = row.querySelector('[data-conn-detail]');
        if (dot) {
            dot.className = 'w-2 h-2 rounded-full shrink-0 ' + view.dot;
        }
        if (word) {
            word.className = 'text-[9px] font-black uppercase tracking-widest ' + view.wordCls;
            word.textContent = view.word;
        }
        if (detail) {
            detail.textContent = view.detail || '';
        }
        if (view.opacity) row.classList.add('opacity-55');
        else row.classList.remove('opacity-55');
        _mBTConnUpdateHeaderCounts();
    }

    function _mBTConnParseModels(provider, data) {
        var items = [];
        if (!data) return items;
        if (Array.isArray(data)) items = data;
        else items = data.models || data.data || [];
        var out = [];
        var i, m, id, name, entry;
        for (i = 0; i < items.length; i++) {
            m = items[i];
            if (typeof m === 'string') {
                out.push({ id: m, name: m, _raw: null });
                continue;
            }
            id = m.id || (m.name || '').replace(/^models\//, '') || '';
            if (!id && m.name) id = String(m.name).replace(/^models\//, '');
            if (!id) continue;
            name = m.display_name || m.displayName || m.name || id;
            if (typeof name === 'string' && name.indexOf('models/') === 0) name = name.replace(/^models\//, '');
            entry = { id: id, name: name, _raw: m };
            if (m.pricing) {
                var promptPrice = parseFloat((m.pricing && m.pricing.prompt) || '0');
                entry.free = promptPrice === 0;
                entry.price = promptPrice;
            }
            out.push(entry);
        }
        if (provider === 'openai' || provider === 'anthropic' || provider === 'deepseek' || provider === 'grok') {
            _tierSort(out, provider);
        }
        if (provider === 'openrouter') {
            out.sort(function (a, b) {
                var pa = a.price != null ? a.price : (a.free ? 0 : Infinity);
                var pb = b.price != null ? b.price : (b.free ? 0 : Infinity);
                if (pa !== pb) return pa - pb;
                return (a.id || '').localeCompare(b.id || '');
            });
        }
        return out;
    }

    function _mBTConnApplyModelsToRow(provider, models) {
        var list = models || [];
        try {
            localStorage.setItem('mbt_cached_chat_models_' + provider, JSON.stringify(list.map(function (m) {
                return { id: m.id, name: m.name, free: m.free, price: m.price };
            })));
        } catch (e) {}

        var ma = window.mBTAssistant;
        var saved = '';
        if (ma && ma.getChatModel) saved = ma.getChatModel(provider) || '';
        else saved = localStorage.getItem('mbt_ai_chat_model_' + provider) || '';

        var sel = document.querySelector('[data-conn-model="' + provider + '"]');
        if (!sel) {
            /* model cell may still say "Add a key" - rebuild not required if key just added via full re-open */
            return;
        }
        var html = '';
        var i, mid, mlbl, found = false, pick = saved;
        for (i = 0; i < list.length; i++) {
            mid = list[i].id || list[i];
            if (saved && mid === saved) found = true;
        }
        if (!found || !pick) {
            pick = list.length ? (list[0].id || list[0]) : '';
            if (provider === 'openrouter') {
                for (i = 0; i < list.length; i++) {
                    if (list[i].free) { pick = list[i].id; break; }
                }
            }
        }
        for (i = 0; i < list.length; i++) {
            mid = list[i].id || list[i];
            mlbl = list[i].name || mid;
            html += '<option value="' + _mBTConnEsc(mid) + '"' + (mid === pick ? ' selected' : '') + '>' + _mBTConnEsc(mlbl) + '</option>';
        }
        sel.innerHTML = html || '<option value="" disabled selected>No models found</option>';
        if (pick) {
            if (ma && typeof ma.setChatModel === 'function') ma.setChatModel(provider, pick);
            else localStorage.setItem('mbt_ai_chat_model_' + provider, pick);
            var capsCell = document.querySelector('[data-conn-caps="' + provider + '"]');
            if (capsCell) {
                var raw = null;
                for (i = 0; i < list.length; i++) {
                    if ((list[i].id || list[i]) === pick) { raw = list[i]._raw || null; break; }
                }
                capsCell.innerHTML = _mBTConnBuildCapsHtml(provider, pick, raw);
            }
        }
    }

    /* Free model-list status check. Never hits completion endpoints. */
    function _mBTConnCheckProvider(provider, force) {
        var reg = _mBTConnEnsureRegistry();
        if (!force && reg.connStatus[provider] && reg.connStatus[provider].state !== 'checking') {
            _mBTConnPatchRow(provider);
            return Promise.resolve(reg.connStatus[provider]);
        }

        var key = mBT.features.ai.getStoredApiKey(provider) || '';
        if (!key && provider !== 'lmstudio') {
            reg.connStatus[provider] = { state: 'nokey', code: '', ms: null, ts: Date.now() };
            _mBTConnPatchRow(provider);
            return Promise.resolve(reg.connStatus[provider]);
        }

        reg.connStatus[provider] = { state: 'checking', code: '', ms: null, ts: Date.now() };
        _mBTConnPatchRow(provider);

        var t0 = Date.now();
        var url = '';
        var headers = {};
        var ctrl = null;
        var timeoutId = null;

        if (provider === 'gemini') {
            url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key);
        } else if (CONN_MODELS_URLS[provider]) {
            url = CONN_MODELS_URLS[provider];
            if (provider === 'anthropic') {
                headers['x-api-key'] = key;
                headers['anthropic-version'] = '2023-06-01';
            } else if (provider !== 'lmstudio') {
                headers['Authorization'] = 'Bearer ' + key;
                if (provider === 'openrouter') {
                    headers['HTTP-Referer'] = window.location.origin;
                    headers['X-Title'] = 'mBT';
                }
            }
        } else {
            reg.connStatus[provider] = { state: 'rejected', code: 'unsupported', ms: null, ts: Date.now() };
            _mBTConnPatchRow(provider);
            return Promise.resolve(reg.connStatus[provider]);
        }

        var fetchOpts = { method: 'GET', headers: headers };
        try {
            if (typeof AbortController !== 'undefined') {
                ctrl = new AbortController();
                fetchOpts.signal = ctrl.signal;
                timeoutId = setTimeout(function () {
                    try { ctrl.abort(); } catch (eAb) {}
                }, 12000);
            }
        } catch (eCtrl) {}

        return fetch(url, fetchOpts)
            .then(function (r) {
                if (timeoutId) clearTimeout(timeoutId);
                var ms = Date.now() - t0;
                if (r.status === 200) {
                    return r.json().then(function (data) {
                        var models = _mBTConnParseModels(provider, data);
                        if (provider === 'gemini') {
                            /* Gemini list includes image models; keep chat-capable + known ids */
                            models = models.filter(function (m) {
                                var raw = m._raw;
                                var methods = (raw && raw.supportedGenerationMethods) || [];
                                var isChat = methods.indexOf('generateContent') !== -1;
                                var isImg = (m.id || '').indexOf('imagen') !== -1;
                                return isChat || isImg;
                            });
                        }
                        reg.connStatus[provider] = { state: 'live', code: '200', ms: ms, ts: Date.now() };
                        reg.connStatusTs = Date.now();
                        _mBTConnApplyModelsToRow(provider, models);
                        _mBTConnPatchRow(provider);
                        return reg.connStatus[provider];
                    });
                }
                if (r.status === 401 || r.status === 403) {
                    reg.connStatus[provider] = { state: 'rejected', code: String(r.status), ms: ms, ts: Date.now() };
                    reg.connStatusTs = Date.now();
                    _mBTConnPatchRow(provider);
                    return reg.connStatus[provider];
                }
                reg.connStatus[provider] = { state: 'rejected', code: String(r.status), ms: ms, ts: Date.now() };
                reg.connStatusTs = Date.now();
                _mBTConnPatchRow(provider);
                return reg.connStatus[provider];
            })
            .catch(function () {
                if (timeoutId) clearTimeout(timeoutId);
                reg.connStatus[provider] = { state: 'rejected', code: 'unreachable', ms: null, ts: Date.now() };
                reg.connStatusTs = Date.now();
                _mBTConnPatchRow(provider);
                return reg.connStatus[provider];
            });
    }

    window.mBT_UI_Conn_runStatusChecks = function (force) {
        var ma = window.mBTAssistant;
        if (!ma || !ma.ENDPOINTS) return;
        var reg = _mBTConnEnsureRegistry();
        var keys = Object.keys(ma.ENDPOINTS);
        var i, p;
        for (i = 0; i < keys.length; i++) {
            p = keys[i];
            if (force) {
                delete reg.connStatus[p];
            }
            _mBTConnCheckProvider(p, !!force);
        }
    };

    window.mBT_UI_Conn_recheck = function () {
        var reg = _mBTConnEnsureRegistry();
        reg.connStatus = {};
        reg.connStatusTs = 0;
        var elTs = document.getElementById('connCheckedAt');
        if (elTs) elTs.textContent = 'Checking \u00b7 free endpoint';
        window.mBT_UI_Conn_runStatusChecks(true);
    };

    window.mBT_UI_Conn_fetch = function (provider) {
        var key = mBT.features.ai.getStoredApiKey(provider) || '';
        if (!key && provider !== 'lmstudio') {
            if (typeof mBTME !== 'undefined') mBTME.alert('No Key', 'Add an API key before fetching models.');
            return;
        }
        _mBTConnCheckProvider(provider, true);
    };

    window.mBT_UI_Conn_modelChange = function (provider, modelId) {
        if (!provider || !modelId) return;
        var ma = window.mBTAssistant;
        if (ma && typeof ma.setChatModel === 'function') {
            ma.setChatModel(provider, modelId);
        } else {
            localStorage.setItem('mbt_ai_chat_model_' + provider, modelId);
            if (provider === 'openrouter') localStorage.setItem('mbt_openrouter_model', modelId);
        }
        /* Selecting a model on a row also marks that provider active for chat */
        if (ma && typeof ma.setProvider === 'function') ma.setProvider(provider);
        else if (mBT.features.ai.saveSelectedProvider) mBT.features.ai.saveSelectedProvider(provider);

        var cached = [];
        try { cached = JSON.parse(localStorage.getItem('mbt_cached_chat_models_' + provider) || '[]'); } catch (e) {}
        var raw = null, i;
        for (i = 0; i < cached.length; i++) {
            if ((cached[i].id || cached[i]) === modelId) { raw = cached[i]._raw || null; break; }
        }
        var capsCell = document.querySelector('[data-conn-caps="' + provider + '"]');
        if (capsCell) capsCell.innerHTML = _mBTConnBuildCapsHtml(provider, modelId, raw);
    };

    window.mBT_UI_Conn_toggleCap = function (provider, modelId, cap) {
        if (!provider || !modelId || !cap) return;
        var map = _mBTConnLoadCapOverrides(provider);
        var current = _mBTConnResolveCaps(provider, modelId, null);
        var next = { chat: current.chat, image: current.image, video: current.video };
        next[cap] = !next[cap];
        /* Keep at least one capability so the row does not go empty forever */
        if (!next.chat && !next.image && !next.video) next.chat = true;
        map[modelId] = next;
        _mBTConnSaveCapOverrides(provider, map);
        var capsCell = document.querySelector('[data-conn-caps="' + provider + '"]');
        if (capsCell) capsCell.innerHTML = _mBTConnBuildCapsHtml(provider, modelId, null);
    };

    window.mBT_UI_Conn_rowProviderChange = function (fromProvider, toProvider) {
        /* Rows are fixed 1:1 with ENDPOINTS keys. Selecting this row's provider
           (or any option) activates that provider for chat. The row select snaps
           back to its own key so the list stays one row per endpoint. */
        var sel = document.querySelector('[data-conn-provider-sel="' + fromProvider + '"]');
        if (sel) sel.value = fromProvider;
        var ma = window.mBTAssistant;
        var target = (toProvider && ma && ma.ENDPOINTS && ma.ENDPOINTS[toProvider]) ? toProvider : fromProvider;
        if (ma && typeof ma.setProvider === 'function') ma.setProvider(target);
        else if (mBT.features.ai.saveSelectedProvider) mBT.features.ai.saveSelectedProvider(target);
    };

    window.mBT_UI_Conn_edit = function (provider) {
        var existing = mBT.features.ai.getStoredApiKey(provider) || '';
        var label = (window.mBTAssistant && mBTAssistant.getProviderLabel)
            ? mBTAssistant.getProviderLabel(provider)
            : provider;
        var link = KEY_DASHBOARDS[provider] || '#';
        var body =
            '<div class="p-4 space-y-3">' +
                '<p class="text-[10px] font-bold text-slate-500">API key for <span class="text-slate-800">' + _mBTConnEsc(label) + '</span>. Stored on this device only.</p>' +
                '<input type="password" id="connEditKeyInput" value="' + _mBTConnEsc(existing) + '" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-mono outline-none focus:ring-2 focus:ring-blue-100" placeholder="sk-..">' +
                (link !== '#' ? '<a href="' + _mBTConnEsc(link) + '" target="_blank" rel="noopener" class="text-[9px] font-black uppercase tracking-widest text-blue-600">Get key \u2197</a>' : '') +
                '<div class="flex gap-2 pt-1">' +
                    '<button type="button" onclick="window.mBT_UI_Conn_saveEdit(\'' + _mBTConnEsc(provider) + '\')" class="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500">Save</button>' +
                    '<button type="button" onclick="mBTME.close(\'connEditKey\')" class="px-4 py-2.5 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200">Cancel</button>' +
                '</div>' +
            '</div>';
        if (typeof mBTME !== 'undefined' && mBTME.open) {
            mBTME.open('connEditKey', 'Edit key', body, 'max-w-sm');
        }
    };

    window.mBT_UI_Conn_saveEdit = function (provider) {
        var inp = document.getElementById('connEditKeyInput');
        var key = inp ? String(inp.value || '').trim() : '';
        mBT.features.ai.saveStoredApiKey(provider, key);
        if (typeof mBTME !== 'undefined' && mBTME.close) mBTME.close('connEditKey');
        var reg = _mBTConnEnsureRegistry();
        delete reg.connStatus[provider];
        if (mBT.features.settings && typeof mBT.features.settings.open === 'function') {
            mBT.features.settings.open('connections');
        } else {
            _mBTConnCheckProvider(provider, true);
        }
    };

    window.mBT_UI_Conn_add = function () {
        var nameEl = document.getElementById('connAddProvider');
        var keyEl = document.getElementById('connAddKey');
        var name = nameEl ? String(nameEl.value || '').trim() : '';
        var key = keyEl ? String(keyEl.value || '').trim() : '';
        if (!name) {
            if (typeof mBTME !== 'undefined') mBTME.alert('Provider', 'Enter a provider name.');
            return;
        }
        if (!key) {
            if (typeof mBTME !== 'undefined') mBTME.alert('API Key', 'Enter an API key.');
            return;
        }
        var ma = window.mBTAssistant;
        var resolved = '';
        var lower = name.toLowerCase();
        var keys = ma && ma.ENDPOINTS ? Object.keys(ma.ENDPOINTS) : [];
        var i, p, lab;
        for (i = 0; i < keys.length; i++) {
            p = keys[i];
            lab = (ma.getProviderLabel(p) || p).toLowerCase();
            if (p === lower || lab === lower || lab.indexOf(lower) !== -1 || lower.indexOf(p) !== -1) {
                resolved = p;
                break;
            }
        }
        if (!resolved) {
            /* common aliases */
            if (lower.indexOf('google') !== -1 || lower.indexOf('gemini') !== -1) resolved = 'gemini';
            else if (lower.indexOf('xai') !== -1 || lower.indexOf('x.ai') !== -1 || lower.indexOf('grok') !== -1) resolved = 'grok';
            else if (lower.indexOf('openrouter') !== -1) resolved = 'openrouter';
            else if (lower.indexOf('openai') !== -1 || lower === 'gpt') resolved = 'openai';
            else if (lower.indexOf('anthropic') !== -1 || lower.indexOf('claude') !== -1) resolved = 'anthropic';
            else if (lower.indexOf('deepseek') !== -1) resolved = 'deepseek';
            else if (lower.indexOf('lm') !== -1 || lower.indexOf('local') !== -1) resolved = 'lmstudio';
        }
        if (!resolved) {
            if (typeof mBTME !== 'undefined') mBTME.alert('Unknown provider', 'Pick a known provider from the list.');
            return;
        }
        mBT.features.ai.saveStoredApiKey(resolved, key);
        if (ma && typeof ma.setProvider === 'function') ma.setProvider(resolved);
        else if (mBT.features.ai.saveSelectedProvider) mBT.features.ai.saveSelectedProvider(resolved);
        if (nameEl) nameEl.value = '';
        if (keyEl) keyEl.value = '';
        var reg = _mBTConnEnsureRegistry();
        delete reg.connStatus[resolved];
        if (mBT.features.settings && typeof mBT.features.settings.open === 'function') {
            mBT.features.settings.open('connections');
        }
    };

    var POLLINATIONS_FALLBACK_MODELS = [
        { id: 'flux',            name: 'Flux.1 Standard' },
        { id: 'flux-realism',    name: 'Flux Realism' },
        { id: 'flux-anime',      name: 'Flux Anime' },
        { id: 'flux-3d',         name: 'Flux 3D Render' },
        { id: 'flux-nanobanana', name: 'Flux NanoBanana' },
        { id: 'flux-pixel',      name: 'Flux Pixel Art' },
        { id: 'any-dark',        name: 'Any Dark' }
    ];

    /* Merge live API results with fallback list — API wins on duplicates,
       fallback fills gaps (e.g. nanobanana missing from API response) */
    function _mergePollinationModels(apiModels) {
        var seen = {};
        var merged = [];
        for (var i = 0; i < apiModels.length; i++) {
            var m = apiModels[i];
            var id = (m.id || m.name || '').toLowerCase();
            if (!id) continue;
            seen[id] = true;
            /* Improve display name: if name equals id (raw API string), capitalise words */
            var name = m.name || m.id;
            if (name === m.id) {
                name = name.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
            }
            merged.push({ id: m.id, name: name });
        }
        for (var j = 0; j < POLLINATIONS_FALLBACK_MODELS.length; j++) {
            var f = POLLINATIONS_FALLBACK_MODELS[j];
            if (!seen[f.id.toLowerCase()]) merged.push(f);
        }
        return merged;
    }

    /* Shared helper — called by fetchImgModels, fetchChatModels, syncAIProvider.
       If saved id is missing from the fresh list, pick first free (or first) and persist
       so a retired model (e.g. Ling-2.6-flash) cannot stay as a ghost selection. */
    function _populateSelect(sel, models, savedKey, groupByFree) {
        if (!sel || !models || !models.length) return;
        var saved = localStorage.getItem(savedKey) || '';
        var list = models;
        var html = '';
        var pick = saved;
        var found = false;
        var i, id, mid, m, lbl, tag;

        if (groupByFree) {
            list = models.slice().sort(function (a, b) {
                var pa = a.price != null ? a.price : (a.free ? 0 : Infinity);
                var pb = b.price != null ? b.price : (b.free ? 0 : Infinity);
                if (pa !== pb) return pa - pb;
                return (a.id || '').localeCompare(b.id || '');
            });
        }

        for (i = 0; i < list.length; i++) {
            mid = list[i].id || list[i];
            if (saved && mid === saved) {
                found = true;
                break;
            }
        }
        if (!found || !saved) {
            pick = '';
            if (groupByFree) {
                for (i = 0; i < list.length; i++) {
                    if (list[i].free) {
                        pick = list[i].id || list[i];
                        break;
                    }
                }
            }
            if (!pick) {
                pick = list[0].id || list[0];
            }
            if (pick) {
                localStorage.setItem(savedKey, pick);
                /* Dual-write chat model through mBTAssistant when key is chat model */
                if (savedKey.indexOf('mbt_ai_chat_model_') === 0) {
                    var prov = savedKey.replace('mbt_ai_chat_model_', '');
                    var maPop = window.mBTAssistant;
                    if (maPop && typeof maPop.setChatModel === 'function') {
                        maPop.setChatModel(prov, pick);
                    } else if (prov === 'openrouter') {
                        localStorage.setItem('mbt_openrouter_model', pick);
                    }
                }
            }
        }

        if (groupByFree) {
            for (i = 0; i < list.length; i++) {
                m = list[i];
                mid = m.id || m;
                tag = m.free ? ' (Free)' : (m.price ? ' ($' + (m.price * 1000000).toFixed(2) + '/M)' : '');
                html += '<option value="' + mid + '"' + (mid === pick ? ' selected' : '') + '>' + (m.name || mid) + tag + '</option>';
            }
        } else {
            for (i = 0; i < list.length; i++) {
                id  = list[i].id  || list[i];
                lbl = list[i].name || list[i].id || list[i];
                html += '<option value="' + id + '"' + (id === pick ? ' selected' : '') + '>' + lbl + '</option>';
            }
        }
        sel.innerHTML = html || '<option value="" disabled selected>No models found</option>';
        if (pick && sel.value !== pick) {
            try { sel.value = pick; } catch (eSel) {}
        }
    }

    function _refreshImgHint(ip) {
        var hint = document.getElementById('imgProviderHint');
        var link = document.getElementById('imgApiKeyLink');
        var dbUrl = KEY_DASHBOARDS[ip] || '';
        /* Update the Keys → link above the input */
        if (link) {
            link.href = dbUrl || '#';
            link.style.display = (ip === 'pollinations' || !dbUrl) ? 'none' : 'inline';
        }
        if (!hint) return;
        var chatProvider = document.getElementById('aiProviderSelect') ? document.getElementById('aiProviderSelect').value : '';
        var chatKey = mBT.features.ai.getStoredApiKey(chatProvider);
        var imgKey  = mBT.features.ai.getStoredImageApiKey(ip);
        var html = '';
        if (ip === 'pollinations') {
            html = 'No API key required — using free Pollinations service';
        } else {
            html = 'API key required.';
            if (ip === chatProvider && chatKey && !imgKey) {
                html += ' &nbsp;<span onclick="window.mBT_UI_Settings_inheritChatKey()" class="text-violet-400 cursor-pointer underline">Inherit from chat</span>';
            }
        }
        hint.innerHTML = html;
    }

    /* Expose for post-render call from _attachListeners */
    window.mBT_UI_Settings_refreshImgHint = function (ip) { _refreshImgHint(ip); };

    window.mBT_UI_Settings_inheritChatKey = function () {
        var pSel = document.getElementById('aiProviderSelect');
        var p = pSel ? pSel.value : 'gemini';
        var chatKey = mBT.features.ai.getStoredApiKey(p);
        var imgInput = document.getElementById('imgApiKeyInput');
        if (imgInput && chatKey) {
            imgInput.value = chatKey;
            if (window.mBT_syncAIProvider) window.mBT_syncAIProvider();
        }
    };

    /* Standalone image model fetch — routes through mBTAssistant service */
    window.mBT_UI_Settings_fetchImgModels = function () {
        var ip  = localStorage.getItem('mbt_ai_image_provider') || 'pollinations';
        var iSel = document.getElementById('imgModelSelect');
        var btn  = document.getElementById('fetchImgModelsBtn');
        if (btn) { btn.disabled = true; btn.textContent = '...'; }
        var done = function () { if (btn) { btn.disabled = false; btn.textContent = 'Fetch'; } };

        var ma = window.mBTAssistant || (window.mBT && window.mBT.features && window.mBT.features.ai);
        if (!ma || typeof ma.fetchAvailableImageModels !== 'function') {
            console.warn('mBTAssistant.fetchAvailableImageModels not available');
            if (iSel) iSel.innerHTML = '<option value="" disabled selected>Service unavailable</option>';
            done();
            return;
        }

        var fetchPromise;
        try {
            fetchPromise = ma.fetchAvailableImageModels(ip);
        } catch (e) {
            console.error('Exception calling fetchAvailableImageModels:', e);
            if (iSel) iSel.innerHTML = '<option value="" disabled selected>Error fetching models</option>';
            done();
            return;
        }

        if (!fetchPromise || typeof fetchPromise.then !== 'function') {
            console.error('[mBT] fetchAvailableImageModels did not return a Promise');
            if (iSel) iSel.innerHTML = '<option value="" disabled selected>Service Error</option>';
            done();
            return;
        }

        fetchPromise.then(function (models) {
            if (!Array.isArray(models) || models.length === 0) {
                /* Pollinations: fall back to merged fallback list on empty result */
                if (ip === 'pollinations') {
                    localStorage.setItem('mbt_cached_img_models_' + ip, JSON.stringify(POLLINATIONS_FALLBACK_MODELS));
                    _populateSelect(iSel, POLLINATIONS_FALLBACK_MODELS, 'mbt_ai_image_model', false);
                } else {
                    if (iSel) iSel.innerHTML = '<option value="" disabled selected>No models found</option>';
                }
                done();
                return;
            }

            /* Pollinations: merge API results with fallback list so curated names are preserved */
            var finalModels = (ip === 'pollinations') ? _mergePollinationModels(models) : models;

            var validModels = finalModels.filter(function (m) {
                var id = m.id || m;
                return id && String(id).trim().length > 0;
            });

            if (validModels.length === 0) {
                if (iSel) iSel.innerHTML = '<option value="" disabled selected>No valid models</option>';
                done();
                return;
            }

            localStorage.setItem('mbt_cached_img_models_' + ip, JSON.stringify(validModels));
            _populateSelect(iSel, validModels, 'mbt_ai_image_model', ip === 'openrouter');
            done();
        }).catch(function (err) {
            console.error('Failed to fetch image models:', err);
            if (iSel) iSel.innerHTML = '<option value="" disabled selected>Error fetching models</option>';
            done();
        });
    };

    window.mBT_UI_Settings_handleImgProviderChange = function (ip) {
        if (!ip) return;
        localStorage.setItem('mbt_ai_image_provider', ip);

        if (typeof _refreshImgHint === 'function') {
            _refreshImgHint(ip);
        } else if (typeof window.mBT_UI_Settings_refreshImgHint === 'function') {
            window.mBT_UI_Settings_refreshImgHint(ip);
        }

        var ki = document.getElementById('imgApiKeyInput');
        var ma = window.mBTAssistant || (window.mBT && window.mBT.features && window.mBT.features.ai);
        if (ki && ma && typeof ma.getStoredImageApiKey === 'function') {
            ki.value = ma.getStoredImageApiKey(ip);
        }

        var cached = [];
        try { cached = JSON.parse(localStorage.getItem('mbt_cached_img_models_' + ip) || '[]'); } catch (e) {}

        var isel = document.getElementById('imgModelSelect');
        var isaved = localStorage.getItem('mbt_ai_image_model') || '';
        var selectedModel = isaved;

        if (isel) {
            if (cached.length) {
                var modelExists = cached.some(function (m) {
                    return (m.id || m) === isaved;
                });
                if (!modelExists && cached.length > 0) {
                    var firstId = cached[0].id || cached[0];
                    selectedModel = (firstId && String(firstId).trim()) ? firstId : '';
                }
                isel.innerHTML = cached.map(function (m) {
                    var id = m.id || m;
                    var lbl = m.name || m.id || m;
                    return '<option value="' + id + '"' + (selectedModel === id ? ' selected' : '') + '>' + lbl + '</option>';
                }).join('');
                if (selectedModel) {
                    localStorage.setItem('mbt_ai_image_model', selectedModel);
                }
            } else {
                isel.innerHTML = selectedModel ? '<option value="' + selectedModel + '" selected>' + selectedModel + '</option>' : '<option value="" disabled selected>— fetch models —</option>';
            }
        }

        if (ma && typeof ma.setImageModel === 'function' && selectedModel) {
            ma.setImageModel(selectedModel);
        }
    };

    /* Shared chat-model fetch used by key blur, explicit Fetch button, and sync.
       Returns a Promise so callers can chain. */
    function _fetchChatModelsForProvider(p, k, cSel) {
        if (!k || p === 'lmstudio') return Promise.resolve();
        var cachedKey = 'mbt_cached_chat_models_' + p;
        var modelFetch;

        if (p === 'gemini') {
            modelFetch = mBT.features.ai.fetchGeminiModels(k).then(function (models) {
                localStorage.setItem(cachedKey, JSON.stringify(models));
                _populateSelect(cSel, models, 'mbt_ai_chat_model_' + p, false);
                return models;
            });
        } else if (p === 'openrouter') {
            modelFetch = mBT.features.ai.fetchOpenRouterModels(k).then(function (models) {
                localStorage.setItem(cachedKey, JSON.stringify(models));
                _populateSelect(cSel, models, 'mbt_ai_chat_model_' + p, true);
                /* Persist selected id via setChatModel so legacy OR key stays aligned */
                if (cSel && cSel.value) {
                    var maF = window.mBTAssistant;
                    if (maF && typeof maF.setChatModel === 'function') {
                        maF.setChatModel(p, cSel.value);
                    }
                }
                return models;
            });
        } else {
            var MODELS_URLS = {
                'openai':    'https://api.openai.com/v1/models',
                'deepseek':  'https://api.deepseek.com/models',
                'grok':      'https://api.x.ai/v1/models',
                'anthropic': 'https://api.anthropic.com/v1/models'
            };
            var modelsUrl = MODELS_URLS[p];
            if (modelsUrl) {
                var hdrs = { 'Authorization': 'Bearer ' + k };
                if (p === 'anthropic') { hdrs['x-api-key'] = k; hdrs['anthropic-version'] = '2023-06-01'; delete hdrs['Authorization']; }
                modelFetch = fetch(modelsUrl, { headers: hdrs })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        var items = data.models || data.data || [];
                        var models = items.map(function (m) { return { id: m.id, name: m.display_name || m.id }; });
                        _tierSort(models, p);
                        localStorage.setItem(cachedKey, JSON.stringify(models));
                        _populateSelect(cSel, models, 'mbt_ai_chat_model_' + p, false);
                        return models;
                    });
            } else {
                modelFetch = Promise.resolve();
            }
        }
        return modelFetch || Promise.resolve();
    }

    window.mBT_UI_Settings_autoFetchModelsOnKeyBlur = function () {
        var keyEl = document.getElementById('apiKeyInput');
        var pSel = document.getElementById('aiProviderSelect');
        var p = pSel ? pSel.value : mBT.features.ai.getSelectedProvider();
        var k = (keyEl && keyEl.value) ? keyEl.value.trim() : '';

        if (!k || p === 'lmstudio') return;

        var cSel = document.getElementById('chatModelSelect');
        if (cSel) {
            cSel.innerHTML = '<option value="" disabled>Fetching models...</option>';
        }

        _fetchChatModelsForProvider(p, k, cSel).catch(function () {});
    };

    /* Explicit Fetch for chat models — parity with image Fetch button */
    window.mBT_UI_Settings_fetchChatModels = function () {
        var keyEl = document.getElementById('apiKeyInput');
        var pSel = document.getElementById('aiProviderSelect');
        var p = pSel ? pSel.value : mBT.features.ai.getSelectedProvider();
        var k = (keyEl && keyEl.value) ? keyEl.value.trim() : '';
        var cSel = document.getElementById('chatModelSelect');
        var btn = document.getElementById('fetchChatModelsBtn');
        var done = function () {
            if (btn) { btn.disabled = false; btn.textContent = 'Fetch'; }
        };

        if (p === 'lmstudio') {
            if (typeof mBTME !== 'undefined') mBTME.alert('Local Model', 'LM Studio uses the model name field, not a remote list.');
            return;
        }
        if (!k) {
            if (typeof mBTME !== 'undefined') mBTME.alert('No Key', 'Enter an API key before fetching models.');
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = '...'; }
        if (cSel) {
            cSel.innerHTML = '<option value="" disabled>Fetching models...</option>';
        }

        _fetchChatModelsForProvider(p, k, cSel)
            .then(function (models) {
                if (!models || !models.length) {
                    if (cSel) cSel.innerHTML = '<option value="" disabled selected>No models found</option>';
                }
                done();
            })
            .catch(function (err) {
                console.error('[Settings] Chat model fetch failed:', err);
                if (cSel) cSel.innerHTML = '<option value="" disabled selected>Error fetching models</option>';
                done();
            });
    };

    /* --- Persistent Context toggle (Connections tab) --- */
    window.mBT_UI_Settings_setPersistentContext = function (checked) {
        if (typeof budget === 'undefined' || !budget) return;
        if (window.mBTAIModule && typeof window.mBTAIModule._ensureAiContext === 'function') {
            window.mBTAIModule._ensureAiContext(budget);
        } else if (window.mBTAssistant && typeof window.mBTAssistant.migrateBudgetAiContext === 'function') {
            window.mBTAssistant.migrateBudgetAiContext(budget);
        } else if (!budget.aiContext) {
            budget.aiContext = { chat: [], threads: [], analysis: '', activeThreadId: null };
        }
        budget.aiContext.saveHistory = !!checked;
        if (!checked) {
            /* Turning off persist clears stored conversation data for this project. */
            budget.aiContext.chat = [];
            budget.aiContext.threads = [];
            budget.aiContext.activeThreadId = null;
            if (window.mBTAssistant && typeof window.mBTAssistant.clearChat === 'function') {
                window.mBTAssistant.clearChat(window.mBTAssistant.chatProjectKey(budget));
            }
        }
        if (typeof saveBudget === 'function') saveBudget();

        /* Live-sync open AI tool iframe */
        var aiIframe = document.getElementById('mbtHubAiIframe');
        if (aiIframe && aiIframe.contentWindow && window.mBTAIContext && typeof mBTAIContext.getCurrentProjectContext === 'function') {
            mBTAIContext.getCurrentProjectContext().then(function (ctx) {
                var safeBudgetDoc;
                try { safeBudgetDoc = JSON.parse(JSON.stringify(budget)); } catch (serErr) { safeBudgetDoc = {}; }
                try {
                    aiIframe.contentWindow.postMessage({
                        type: 'budget-sync',
                        payload: { context: ctx, budgetDoc: safeBudgetDoc || {}, saveHistory: !!checked }
                    }, window.location.origin);
                } catch (pmErr) { /* ignore */ }
            }).catch(function () { /* ignore */ });
        }
    };

    /* --- Unified AI Sync: tests connection, fetches + caches chat and image models, saves all --- */
    window.mBT_syncAIProvider = function () {
        var pSel  = document.getElementById('aiProviderSelect');
        var keyEl = document.getElementById('apiKeyInput');
        var sSel  = document.getElementById('aiSystemPromptInput');
        var cSel  = document.getElementById('chatModelSelect');
        var imgPS = document.getElementById('imgProviderSelect');
        var iKeyEl = document.getElementById('imgApiKeyInput');
        var iSel  = document.getElementById('imgModelSelect');
        var btn   = document.getElementById('saveApiKeyBtn');

        var ma = window.mBTAssistant;
        if (!ma) return;

        var p  = pSel  ? pSel.value  : ma.getProvider();
        var k  = keyEl ? keyEl.value.trim() : '';
        var s  = sSel  ? sSel.value  : '';
        var ip = imgPS ? imgPS.value : (localStorage.getItem('mbt_ai_image_provider') || 'pollinations');
        var ik = iKeyEl ? iKeyEl.value.trim() : '';

        ma.setProvider(p);
        ma.setApiKey(p, k);
        ma.setSystemPrompt(s);
        localStorage.setItem('mbt_ai_image_provider', ip);
        ma.setImageApiKey(ip, ik);

        /* Persist visible chat model BEFORE connection test so callChat uses UI selection */
        if (cSel && cSel.value) {
            if (typeof ma.setChatModel === 'function') {
                ma.setChatModel(p, cSel.value);
            } else {
                localStorage.setItem('mbt_ai_chat_model_' + p, cSel.value);
                if (p === 'openrouter') localStorage.setItem('mbt_openrouter_model', cSel.value);
            }
        }

        if (p === 'lmstudio') {
            var epEl = document.getElementById('lmEndpointInput');
            var mdEl = document.getElementById('lmModelInput');
            if (epEl && epEl.value.trim()) ma.setLMStudioEndpoint(epEl.value.trim());
            if (mdEl && mdEl.value.trim()) ma.setLMStudioModel(mdEl.value.trim());
        }

        if (!k && p !== 'lmstudio' && ip !== 'pollinations') {
            if (typeof mBTME !== 'undefined') mBTME.alert('No Key', 'Enter an API key before synchronizing.');
            return;
        }

        if (btn) { btn.textContent = 'Fetching..'; btn.disabled = true; }

        /* Fetch chat models for the chat provider (shared path with Fetch button) */
        var chatFetch = _fetchChatModelsForProvider(p, k, cSel);

        /* Fetch image models for the image provider (uses independent key) */
        var imgKey = ik || mBT.features.ai.getStoredImageApiKey(ip) || k;
        var imgFetch;
        if (ip === 'pollinations') {
            imgFetch = fetch('https://image.pollinations.ai/models')
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    var raw = (Array.isArray(data) ? data : (data.models || [])).map(function (m) {
                        return typeof m === 'string' ? { id: m, name: m } : { id: m.name || m.id, name: m.name || m.id };
                    });
                    var models = _mergePollinationModels(raw);
                    localStorage.setItem('mbt_cached_img_models_' + ip, JSON.stringify(models));
                    _populateSelect(iSel, models, 'mbt_ai_image_model', false);
                }).catch(function () {
                    localStorage.setItem('mbt_cached_img_models_' + ip, JSON.stringify(POLLINATIONS_FALLBACK_MODELS));
                    _populateSelect(iSel, POLLINATIONS_FALLBACK_MODELS, 'mbt_ai_image_model', false);
                });
        } else if (ip === 'openrouter') {
            imgFetch = mBT.features.ai.fetchOpenRouterModels(imgKey).then(function (models) {
                localStorage.setItem('mbt_cached_img_models_' + ip, JSON.stringify(models));
                _populateSelect(iSel, models, 'mbt_ai_image_model', true);
            });
        } else if (ip === 'gemini') {
            imgFetch = mBT.features.ai.fetchGeminiModels(imgKey).then(function (models) {
                /* Filter to image-capable models only */
                var imgModels = models.filter(function (m) { return (m.id || '').indexOf('imagen') !== -1; });
                localStorage.setItem('mbt_cached_img_models_' + ip, JSON.stringify(imgModels));
                _populateSelect(iSel, imgModels, 'mbt_ai_image_model', false);
            });
        } else if (ip === 'openai') {
            imgFetch = fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': 'Bearer ' + imgKey } })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    var items = (data.data || []).filter(function (m) { return (m.id || '').indexOf('dall-e') !== -1; });
                    var models = items.map(function (m) { return { id: m.id, name: m.id }; });
                    localStorage.setItem('mbt_cached_img_models_' + ip, JSON.stringify(models));
                    _populateSelect(iSel, models, 'mbt_ai_image_model', false);
                });
        } else {
            imgFetch = Promise.resolve();
        }

        Promise.all([chatFetch, imgFetch])
            .then(function () {
                /* Re-save model after fetch may have re-picked a free model */
                if (cSel && cSel.value && typeof ma.setChatModel === 'function') {
                    ma.setChatModel(p, cSel.value);
                }
                /* Test connection with a lightweight chat call (same model resolution as callChat) */
                return mBT.features.ai.callUnifiedAI(p, k, 'Reply with the single word: connected', 'You are a connection test. Reply only with the word: connected');
            })
            .then(function (result) {
                if (btn) { btn.textContent = 'Synchronize Link'; btn.disabled = false; }
                /* callUnifiedAI swallows rejections into "Analysis Failed: ..." strings */
                var text = (result && typeof result === 'string') ? result : '';
                if (text.indexOf('Analysis Failed') === 0) {
                    var failDetail = text.replace(/^Analysis Failed:\s*/, '');
                    if (typeof mBTME !== 'undefined') {
                        mBTME.alert('Connection Failed', 'Could not reach ' + p + '. ' + failDetail);
                    }
                    return;
                }
                /* Save selected models from populated selects (dual-write OpenRouter keys) */
                if (cSel && cSel.value) {
                    if (typeof ma.setChatModel === 'function') {
                        ma.setChatModel(p, cSel.value);
                    } else {
                        localStorage.setItem('mbt_ai_chat_model_' + p, cSel.value);
                        if (p === 'openrouter') localStorage.setItem('mbt_openrouter_model', cSel.value);
                    }
                }
                if (iSel && iSel.value) localStorage.setItem('mbt_ai_image_model', iSel.value);
                if (typeof mBTME !== 'undefined') mBTME.alert('Connected', p.charAt(0).toUpperCase() + p.slice(1) + ' verified. Models loaded.');
            })
            .catch(function (err) {
                if (btn) { btn.textContent = 'Synchronize Link'; btn.disabled = false; }
                var detail = (err && err.message) ? String(err.message) : '';
                if (!detail && typeof err === 'string') detail = err;
                var failMsg = 'Could not reach ' + p + '. Check your key and try again.';
                if (detail) failMsg = failMsg + ' ' + detail;
                if (typeof mBTME !== 'undefined') mBTME.alert('Connection Failed', failMsg);
            });
    };

    window.mBT_UI_Settings_renderDbView = renderDbView;

    /* Phase 193: Keep imgModelSelect in sync after storyboard generates an image.
       Storyboard dispatches 'mbtImageGenerated' with the model that was actually used. */
    window.addEventListener('mbtImageGenerated', function (evt) {
        var model = evt.detail && evt.detail.model;
        if (!model) return;
        var modelSel = document.getElementById('imgModelSelect');
        if (modelSel) {
            modelSel.value = model;
            localStorage.setItem('mbt_ai_image_model', model);
        }
    });

})(window);
