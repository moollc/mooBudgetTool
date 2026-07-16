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
            var webhookUrl = localStorage.getItem(storageKeyPrefix + 'cloudWebhook') || '';
            var ma = window.mBTAssistant;
            var isDarkConn = localStorage.getItem('mbt_active_theme') === 'dark';
            var _sw = isDarkConn ? 'bg-slate-600' : 'bg-slate-200';
            var aiProvidersCardBody = '';

            if (!ma) {
                aiProvidersCardBody = '<div class="p-4 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">AI Service Unavailable</div>';
            } else {
                var saveHistory = (budget && budget.aiContext && budget.aiContext.saveHistory) || false;
                var provider = ma.getProvider();
                var storedPrompt = ma.getSystemPrompt() || '';
                var keyLinks = {
                    'gemini':      'https://aistudio.google.com/app/apikey',
                    'openai':      'https://platform.openai.com/api-keys',
                    'deepseek':    'https://platform.deepseek.com/api_keys',
                    'grok':        'https://console.x.ai/',
                    'anthropic':   'https://console.anthropic.com/settings/keys',
                    'openrouter':  'https://openrouter.ai/keys',
                    'lmstudio':    '#'
                };

                var storedLmEndpoint = ma.getLMStudioEndpoint();
                var storedLmModel = ma.getLMStudioModel();

                var cachedChatModels = [];
                try { cachedChatModels = JSON.parse(localStorage.getItem('mbt_cached_chat_models_' + provider) || '[]'); } catch (e) {}
                var storedChatModel = ma.getChatModel(provider);

                var storedImgProvider = localStorage.getItem('mbt_ai_image_provider') || 'pollinations';
                var storedImgModel    = ma.getImageModel();
                var cachedImgModels = [];
                try { cachedImgModels = JSON.parse(localStorage.getItem('mbt_cached_img_models_' + storedImgProvider) || '[]'); } catch (e) {}

                var chatModelOpts = cachedChatModels.length
                    ? cachedChatModels.map(function (m) {
                        var id = (typeof m === 'object') ? (m.id || m) : m;
                        var label = (typeof m === 'object') ? (m.name || m.id || m) : m;
                        return '<option value="' + id + '"' + (storedChatModel === id ? ' selected' : '') + '>' + label + '</option>';
                      }).join('')
                    : (storedChatModel ? '<option value="' + storedChatModel + '" selected>' + storedChatModel + '</option>' : '<option value="" disabled selected>— fetch models —</option>');

                var imgModelOpts = cachedImgModels.length
                    ? cachedImgModels.map(function (m) {
                        var id = (typeof m === 'object') ? (m.id || m) : m;
                        var label = (typeof m === 'object') ? (m.name || m.id || m) : m;
                        return '<option value="' + id + '"' + (storedImgModel === id ? ' selected' : '') + '>' + label + '</option>';
                      }).join('')
                    : (storedImgModel ? '<option value="' + storedImgModel + '" selected>' + storedImgModel + '</option>' : '<option value="" disabled selected>— fetch models —</option>');

                aiProvidersCardBody =
                        '<div class="p-4 bg-slate-900 rounded-3xl border border-black shadow-2xl text-white">' +
                            '<div class="flex justify-between items-start mb-2">' +
                                '<div>' +
                                    '<h3 class="text-[11px] font-black uppercase tracking-tighter text-blue-400">Assistant Engine</h3>' +
                                    '<p class="text-[9px] text-slate-500 font-bold mt-0.5">mBTAssistant v22.78</p>' +
                                '</div>' +
                                '<div class="text-slate-700 opacity-50">' + mBTAssets.sparkle + '</div>' +
                            '</div>' +
                            '<div class="space-y-3">' +
                                '<div class="space-y-3">' +
                                    '<div class="flex items-center gap-2 mb-1">' +
                                        '<div class="w-1 h-3 bg-blue-500 rounded-full"></div>' +
                                        '<h4 class="text-[9px] font-black uppercase tracking-widest text-slate-400">Chat & Logic</h4>' +
                                    '</div>' +
                                    '<div class="grid grid-cols-2 gap-4">' +
                                        '<div>' +
                                            '<label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Provider</label>' +
                                            '<select id="aiProviderSelect" onchange="window.mBT_UI_Settings_handleProviderChange(this.value)" class="w-full bg-slate-800 text-white border-none rounded-xl p-3 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-600/50 cursor-pointer transition-all">' +
                                                Object.keys(ma.ENDPOINTS).map(function(p){ return '<option value="'+p+'"'+(provider===p?' selected':'')+'>'+ma.getProviderLabel(p)+'</option>'; }).join('') +
                                            '</select>' +
                                        '</div>' +
                                        '<div>' +
                                            '<label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Model</label>' +
                                            '<select id="chatModelSelect" onchange="window.mBT_UI_Settings_handleChatModelChange(this.value)" class="w-full bg-slate-800 text-white border-none rounded-xl p-3 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-600/50 cursor-pointer transition-all">' + chatModelOpts + '</select>' +
                                        '</div>' +
                                    '</div>' +
                                    '<div>' +
                                        '<div class="flex justify-between items-center mb-1.5 px-1">' +
                                            '<label class="text-[8px] font-black text-slate-500 uppercase tracking-widest">API Key</label>' +
                                            (keyLinks[provider] ? '<a href="' + keyLinks[provider] + '" target="_blank" class="text-[8px] font-black text-blue-400 uppercase tracking-widest hover:underline">Get Key \u2197</a>' : '') +
                                        '</div>' +
                                        '<input type="password" id="apiKeyInput" value="' + ma.getApiKey(provider) + '" onblur="window.mBT_UI_Settings_autoFetchModelsOnKeyBlur()" class="w-full bg-slate-800 text-white border-none rounded-xl p-3 text-[10px] font-mono outline-none focus:ring-2 focus:ring-blue-600/50 transition-all" placeholder="sk-..">' +
                                    '</div>' +
                                '</div>' +
                                '<div id="lmStudioExtra" class="' + (provider === 'lmstudio' ? '' : 'hidden') + ' space-y-3 pt-2 border-t border-slate-800">' +
                                    '<div class="grid grid-cols-2 gap-4">' +
                                        '<div>' +
                                            '<label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Local Endpoint</label>' +
                                            '<input type="text" id="lmEndpointInput" value="' + esc(storedLmEndpoint) + '" class="w-full bg-slate-800 text-white border-none rounded-xl p-3 text-[10px] font-mono outline-none focus:ring-1 focus:ring-slate-700" placeholder="http://..">' +
                                        '</div>' +
                                        '<div>' +
                                            '<label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Model Name</label>' +
                                            '<input type="text" id="lmModelInput" value="' + esc(storedLmModel) + '" class="w-full bg-slate-800 text-white border-none rounded-xl p-3 text-[10px] font-mono outline-none focus:ring-1 focus:ring-slate-700" placeholder="local-model">' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="space-y-3 pt-4 border-t border-slate-800">' +
                                    '<div class="flex items-center gap-2 mb-1">' +
                                        '<div class="w-1 h-3 bg-violet-500 rounded-full"></div>' +
                                        '<h4 class="text-[9px] font-black uppercase tracking-widest text-slate-400">Visual Engine (Image Gen)</h4>' +
                                    '</div>' +
                                    '<div class="grid grid-cols-2 gap-4">' +
                                        '<div>' +
                                            '<label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Provider</label>' +
                                            '<select id="imgProviderSelect" onchange="window.mBT_UI_Settings_handleImgProviderChange(this.value)" class="w-full bg-slate-800 text-white border-none rounded-xl p-3 text-[10px] font-bold outline-none focus:ring-2 focus:ring-violet-600/50 cursor-pointer transition-all">' +
                                                '<option value="pollinations"' + (storedImgProvider === 'pollinations' ? ' selected' : '') + '>Pollinations (Free)</option>' +
                                                '<option value="openai"' + (storedImgProvider === 'openai' ? ' selected' : '') + '>OpenAI DALL-E</option>' +
                                                '<option value="gemini"' + (storedImgProvider === 'gemini' ? ' selected' : '') + '>Google Imagen</option>' +
                                                '<option value="openrouter"' + (storedImgProvider === 'openrouter' ? ' selected' : '') + '>OpenRouter</option>' +
                                            '</select>' +
                                        '</div>' +
                                        '<div>' +
                                            '<div class="flex justify-between items-center mb-1.5 px-1">' +
                                                '<label class="block text-[8px] font-black text-violet-400 uppercase tracking-widest">Image API Key</label>' +
                                                '<a id="imgApiKeyLink" href="' + (KEY_DASHBOARDS[storedImgProvider] || '#') + '" target="_blank" class="text-[8px] font-black text-violet-400 hover:text-violet-300 uppercase tracking-widest transition-colors" style="display:' + (storedImgProvider === 'pollinations' ? 'none' : 'inline') + '">Keys &rarr;</a>' +
                                            '</div>' +
                                            '<input type="password" id="imgApiKeyInput" value="' + mBT.features.ai.getStoredImageApiKey(storedImgProvider) + '" class="w-full bg-slate-800 text-white border-none rounded-xl p-3 text-[10px] font-mono outline-none focus:ring-2 focus:ring-violet-600/50 transition-all" placeholder="sk-..">' +
                                        '</div>' +
                                    '</div>' +
                                    '<div>' +
                                        '<div class="flex justify-between items-center mb-1.5 px-1">' +
                                            '<label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Image Model</label>' +
                                            '<button id="fetchImgModelsBtn" onclick="window.mBT_UI_Settings_fetchImgModels()" class="text-[7px] font-black text-violet-400 hover:text-violet-300 uppercase tracking-widest transition-colors bg-transparent border-none cursor-pointer p-0">Fetch</button>' +
                                        '</div>' +
                                        '<select id="imgModelSelect" onchange="window.mBT_UI_Settings_handleImgModelChange(this.value)" class="w-full bg-slate-800 text-white border-none rounded-xl p-3 text-[10px] font-mono outline-none focus:ring-2 focus:ring-violet-600/50 cursor-pointer transition-all">' +
                                            imgModelOpts +
                                        '</select>' +
                                    '</div>' +
                                '</div>' +

                                '<div class="h-px bg-slate-800/50"></div>' +

                                '<!-- System Context -->' +
                                '<div>' +
                                    '<label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">System Persona & Constraints</label>' +
                                    '<textarea id="aiSystemPromptInput" class="w-full bg-slate-800 text-white border-none rounded-xl p-4 text-[10px] font-medium outline-none focus:ring-2 focus:ring-blue-600/50 resize-none h-14 placeholder-slate-700 transition-all" placeholder="e.g. Focus strictly on film production logistics. Use JMD rates.">' + storedPrompt + '</textarea>' +
                                '</div>' +

                                '<div class="flex items-center justify-between py-1">' +
                                    '<div class="flex items-center gap-3">' +
                                        '<div class="relative flex items-center">' +
                                            '<input type="checkbox" id="aiContextToggle" ' + (saveHistory ? 'checked' : '') + ' onchange="if(!budget.aiContext) budget.aiContext={chat:[], analysis:\'\'}; budget.aiContext.saveHistory = this.checked; saveBudget();" class="sr-only peer">' +
                                            '<div class="w-11 h-6 ' + _sw + ' peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>' +
                                        '</div>' +
                                        '<label for="aiContextToggle" class="text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer">Persistent Context</label>' +
                                    '</div>' +
                                '</div>' +

                                '<button id="saveApiKeyBtn" onclick="mBT_syncAIProvider()" class="w-full bg-blue-600 text-white py-2.5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-blue-500 active:scale-95 transition-all border-b-4 border-blue-800">Synchronize AI Link</button>' +
                            '</div>' +
                        '</div>';
            }

            return '<div class="h-full overflow-y-auto no-scrollbar p-4 space-y-3 animate-in fade-in duration-300">' +
                        '<input type="text" id="connectionsSearchInput" placeholder="Search connections..." oninput="var q=this.value.toLowerCase();var cards=document.querySelectorAll(\'.connection-card\');for(var i=0;i<cards.length;i++){var el=cards[i];var txt=el.textContent.toLowerCase();if(!q){el.classList.remove(\'hidden\');}else{el.classList.toggle(\'hidden\',txt.indexOf(q)===-1);}}" class="w-full bg-slate-100 text-slate-800 border border-slate-200 rounded-xl p-3 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder-slate-400">' +
                        '<div class="space-y-3">' +
                            '<div class="connection-card">' +
                                '<div class="p-4 bg-slate-900 rounded-2xl border border-black shadow-lg text-white">' +
                                    '<div class="flex justify-between items-start mb-3">' +
                                        '<div>' +
                                            '<h3 class="text-[10px] font-black uppercase tracking-widest text-blue-400">AI Providers</h3>' +
                                            '<p class="text-[9px] text-slate-500 font-bold mt-0.5">Chat, image generation, and assistant configuration</p>' +
                                        '</div>' +
                                        '<div class="text-slate-700 opacity-50">' + mBTAssets.sparkle + '</div>' +
                                    '</div>' +
                                    aiProvidersCardBody +
                                '</div>' +
                            '</div>' +
                            '<div class="connection-card">' +
                                '<div class="p-4 bg-slate-900 rounded-2xl border border-black shadow-lg text-white">' +
                                    '<div class="flex justify-between items-start mb-3">' +
                                        '<div>' +
                                            '<h3 class="text-[10px] font-black uppercase tracking-widest text-emerald-400">Production Webhook</h3>' +
                                            '<p class="text-[9px] text-slate-500 font-bold mt-0.5">Upstream Data Bridge</p>' +
                                        '</div>' +
                                        '<div class="text-slate-700">' + mBTAssets.cloud + '</div>' +
                                    '</div>' +
                                    '<div class="space-y-3">' +
                                        '<div>' +
                                            '<label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Webhook Endpoint</label>' +
                                            '<div class="flex gap-2">' +
                                                '<input type="text" id="cloudWebhookInput" value="' + esc(webhookUrl) + '" onchange="localStorage.setItem(\'' + storageKeyPrefix + 'cloudWebhook\', this.value)" class="flex-1 bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder-slate-600" placeholder="https://api.mbt-assistant.com/ingest..">' +
                                                '<button onclick="var url=document.getElementById(\'cloudWebhookInput\').value; if(!url) return mBTME.alert(\'Error\', \'No URL\'); mBTME.showLoader(\'Pinging..\'); fetch(url, {method:\'POST\', headers:{\'Content-Type\':\'application/json\'}, body:JSON.stringify({test:true, source:\'MooBudget\', project:budget.projectName, ts:new Date().toISOString()})}).then(function(r){ mBTME.hideLoader(); if(r.ok) mBTME.alert(\'Success\',\'Endpoint Reachable\'); else mBTME.alert(\'Error\', \'Status: \'+r.status); }).catch(function(e){ mBTME.hideLoader(); mBTME.alert(\'Connection Failed\', e.message); })" class="px-3 bg-emerald-900/50 text-emerald-400 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-900 border border-emerald-800 transition-colors">Test</button>' +
                                            '</div>' +
                                            '<p class="text-[8px] text-slate-600 mt-2">Destination for "Cloud Dispatch". Accepts JSON payloads containing Ledger and Budget totals.</p>' +
                                            '<p class="text-[8px] text-amber-500 font-bold mt-1">Note: automatic dispatch is not yet implemented. The Test button only checks connectivity. It does not send live budget data.</p>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
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
            var currentVersion = updateStatus.localVersion || 'v23.89';

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
            localStorage.setItem('mbt_ai_chat_model_' + p, String(m).trim());
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

    /* Shared helper — called by fetchImgModels AND syncAIProvider (and any future handler) */
    function _populateSelect(sel, models, savedKey, groupByFree) {
        if (!sel || !models || !models.length) return;
        var saved = localStorage.getItem(savedKey) || '';
        var html = '';
        if (groupByFree) {
            var sorted = models.slice().sort(function (a, b) {
                var pa = a.price != null ? a.price : (a.free ? 0 : Infinity);
                var pb = b.price != null ? b.price : (b.free ? 0 : Infinity);
                if (pa !== pb) return pa - pb;
                return (a.id || '').localeCompare(b.id || '');
            });
            for (var j = 0; j < sorted.length; j++) {
                var m = sorted[j];
                var mid = m.id || m;
                var tag = m.free ? ' (Free)' : (m.price ? ' ($' + (m.price * 1000000).toFixed(2) + '/M)' : '');
                html += '<option value="' + mid + '"' + (mid === saved ? ' selected' : '') + '>' + (m.name || mid) + tag + '</option>';
            }
        } else {
            for (var i = 0; i < models.length; i++) {
                var id  = models[i].id  || models[i];
                var lbl = models[i].name || models[i].id || models[i];
                html += '<option value="' + id + '"' + (id === saved ? ' selected' : '') + '>' + lbl + '</option>';
            }
        }
        sel.innerHTML = html || '<option value="" disabled selected>No models found</option>';
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

    window.mBT_UI_Settings_autoFetchModelsOnKeyBlur = function () {
        var keyEl = document.getElementById('apiKeyInput');
        var pSel = document.getElementById('aiProviderSelect');
        var p = pSel ? pSel.value : mBT.features.ai.getSelectedProvider();
        var k = (keyEl && keyEl.value) ? keyEl.value.trim() : '';

        if (!k || p === 'lmstudio') return;

        var cSel = document.getElementById('chatModelSelect');
        if (cSel) {
            cSel.innerHTML = '<option value="" disabled>⏳ Fetching models...</option>';
        }

        var cachedKey = 'mbt_cached_chat_models_' + p;
        var modelFetch;

        if (p === 'gemini') {
            modelFetch = mBT.features.ai.fetchGeminiModels(k).then(function (models) {
                localStorage.setItem(cachedKey, JSON.stringify(models));
                _populateSelect(cSel, models, 'mbt_ai_chat_model_' + p, false);
            });
        } else if (p === 'openrouter') {
            modelFetch = mBT.features.ai.fetchOpenRouterModels(k).then(function (models) {
                localStorage.setItem(cachedKey, JSON.stringify(models));
                _populateSelect(cSel, models, 'mbt_ai_chat_model_' + p, true);
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
                    });
            } else {
                modelFetch = Promise.resolve();
            }
        }
        if (modelFetch) modelFetch.catch(function () {});
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

        /* Fetch chat models for the chat provider */
        var chatFetch;
        if (p === 'gemini') {
            chatFetch = mBT.features.ai.fetchGeminiModels(k).then(function (models) {
                localStorage.setItem('mbt_cached_chat_models_' + p, JSON.stringify(models));
                _populateSelect(cSel, models, 'mbt_ai_chat_model_' + p, false);
            });
        } else if (p === 'openrouter') {
            chatFetch = mBT.features.ai.fetchOpenRouterModels(k).then(function (models) {
                localStorage.setItem('mbt_cached_chat_models_' + p, JSON.stringify(models));
                _populateSelect(cSel, models, 'mbt_ai_chat_model_' + p, true);
            });
        } else {
            /* OpenAI, DeepSeek, Grok, Anthropic — all support /models endpoint */
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
                chatFetch = fetch(modelsUrl, { headers: hdrs })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        var items = data.models || data.data || [];
                        var models = items.map(function (m) { return { id: m.id, name: m.display_name || m.id }; });
                        _tierSort(models, p);
                        localStorage.setItem('mbt_cached_chat_models_' + p, JSON.stringify(models));
                        _populateSelect(cSel, models, 'mbt_ai_chat_model_' + p, false);
                    });
            } else {
                chatFetch = Promise.resolve();
            }
        }

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
                /* Test connection with a lightweight chat call */
                return mBT.features.ai.callUnifiedAI(p, k, 'Reply with the single word: connected', 'You are a connection test. Reply only with the word: connected');
            })
            .then(function () {
                if (btn) { btn.textContent = 'Synchronize Link'; btn.disabled = false; }
                /* Save selected models from populated selects */
                if (cSel && cSel.value) localStorage.setItem('mbt_ai_chat_model_' + p, cSel.value);
                if (iSel && iSel.value) localStorage.setItem('mbt_ai_image_model', iSel.value);
                if (typeof mBTME !== 'undefined') mBTME.alert('Connected', p.charAt(0).toUpperCase() + p.slice(1) + ' verified. Models loaded.');
            })
            .catch(function () {
                if (btn) { btn.textContent = 'Synchronize Link'; btn.disabled = false; }
                if (typeof mBTME !== 'undefined') mBTME.alert('Connection Failed', 'Could not reach ' + p + '. Check your key and try again.');
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
