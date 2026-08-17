/* 
 * Component: Toolbar & Summary
 * Lifecycle: render [YES] | update [YES] | bindEvents [NO] | init [YES] | renderProjectMgmt [YES - async]
 * Description: Project identity header and calculation summary metrics.
 */

(function (window) {
    'use strict';
    window.mBT = window.mBT || {};
    window.mBT.ui = window.mBT.ui || {};

    function esc(str) {
        if (window.mBT && window.mBT.ui && window.mBT.ui.render && typeof window.mBT.ui.render.esc === 'function') {
            return window.mBT.ui.render.esc(str);
        }
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    window.mBT.ui.toolbar = {
        /**
         * Renders the project identity header (L2969-2982).
         * @returns {string} HTML for the header.
         */
        renderHeader: function () {
            if (!budget) return '';
            /* Phase 115 Step 4: Show "Review Only" pill when client mode is active */
            var isClient = window.mBT && window.mBT.ui && window.mBT.ui.state && window.mBT.ui.state.isEditing === false;
            var reviewPill = isClient
                ? '        <span class="flex-shrink-0 bg-rose-500 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">Review Only</span>'
                : '';
            return '<header class="mb-3 flex flex-wrap md:flex-nowrap items-center justify-between gap-3">' +
                '    <div class="flex items-center gap-4 w-full md:w-auto flex-grow min-w-0">' +
                '        <input type="text" id="projectName" value="' + esc(budget.projectName) + '" class="text-xl sm:text-2xl md:text-3xl font-black uppercase text-slate-900 bg-transparent min-w-0 flex-grow focus:outline-none focus:bg-white p-2 rounded-xl transition-all tracking-tighter truncate" />' +
                reviewPill +
                '        <button id="loginBtn" class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shadow-xl flex-shrink-0 active:scale-90"></button>' +
                '        <div id="presence-bar" class="flex items-center gap-1 flex-shrink-0" title="Live collaborators"></div>' +
                '    </div>' +
                '    <div id="project-management-container" class="w-full md:w-auto flex-shrink-0 max-w-full"></div>' +
                '</header>';
        },

        /**
         * Renders the metrics summary / calculation toolbar (L3007-3094).
         * @returns {string} HTML for the summary.
         */
        renderSummary: function () {
            if (!budget) return '';
            var mBTAssets = window.mBTAssets || {};
            var renderBudgetSections = window.renderBudgetSections || function() { return ''; };
            
            return '<div id="summary" class="mb-4 space-y-2">' +
                '<div id="fundingCard" class="mb-2"></div>' +
                '<div id="stagesHorizontalBar" class="mb-2"></div>' +
                '    <!-- Primary Metrics Group (Est, Actual) -->' +
                '    <div class="flex flex-wrap gap-2 items-stretch">' +
                '        <div class="flex-[10_1_240px] bg-blue-600 text-white px-5 py-2.5 rounded-2xl shadow-xl flex flex-col justify-center relative overflow-hidden group min-h-[60px]">' +
                '            <div class="absolute -right-4 -top-4 opacity-10 transition-transform group-hover:scale-110 duration-700">' + (mBTAssets.money || '') + '</div>' +
                '            <p class="text-[11px] font-black uppercase tracking-widest text-blue-200 mb-0.5">Estimated Grand Total</p>' +
                '            <p id="summaryGrandTotal" class="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter truncate w-full">--</p>' +
                '        </div>' +
                '        <div class="flex-[10_1_240px] bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-xl flex flex-col justify-center relative overflow-hidden group min-h-[60px]">' +
                '            <p class="text-[11px] font-black uppercase tracking-widest text-emerald-200 mb-0.5">Actual Expenditure</p>' +
                '            <p id="summaryActualTotal" class="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter truncate w-full">--</p>' +
                '        </div>' +
                '    </div>' +
                '    <!-- Adjustments Group (Subtotal, Discount, Contingency, Tax) -->' +
                '    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 items-stretch">' +
                '        <div class="px-4 py-1 border border-slate-900 bg-slate-900 rounded-2xl shadow-md flex flex-col justify-center min-h-[52px]">' +
                '            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Project Subtotal</p>' +
                '            <p id="summarySubtotal" class="text-sm sm:text-base font-black text-white leading-tight truncate w-full">--</p>' +
                '        </div>' +
                '        <div class="flex-1 px-3 py-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center min-h-[52px]">' +
                '            <div class="flex items-center gap-2 mb-1">' +
                '                <div class="flex items-center bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 shrink-0">' +
                '                    <input type="number" step="0.1" id="discountPercentage" value="' + esc(budget.discountPercentage || 0) + '" class="w-7 text-right text-[10px] font-black text-blue-600 bg-transparent outline-none">' +
                '                    <span class="text-[9px] font-black text-slate-300 ml-0.5">%</span>' +
                '                </div>' +
                '                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Discount</label>' +
                '            </div>' +
                '            <p id="summaryDiscount" class="text-sm sm:text-base font-black text-slate-800 leading-tight ml-1 truncate">--</p>' +
                '        </div>' +
                '        <div id="contingencyFringesCard" class="flex-1 px-3 py-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center min-h-[52px] cursor-pointer hover:border-orange-200 hover:bg-orange-50 transition-all">' +
                '            <div class="flex items-center gap-2 mb-1">' +
                '                <div class="flex items-center bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 shrink-0">' +
                '                    <input type="number" step="0.1" id="contingencyPercentage" value="' + esc(budget.contingencyPercentage) + '" class="w-7 text-right text-[10px] font-black text-blue-600 bg-transparent outline-none" onclick="event.stopPropagation()">' +
                '                    <span class="text-[9px] font-black text-slate-300 ml-0.5">%</span>' +
                '                </div>' +
                '                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Contingency &amp; Fringes</label>' +
                '            </div>' +
                '            <p id="summaryContingency" class="text-sm sm:text-base font-black text-slate-800 leading-tight ml-1 truncate">--</p>' +
                '            <p id="summaryFringesInline" class="text-[10px] font-medium text-orange-500 leading-tight ml-1 truncate hidden"></p>' +
                '        </div>' +
                '        <div class="flex-1 px-3 py-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center min-h-[52px]">' +
                '            <div class="flex items-center gap-2 mb-1">' +
                '                <div class="flex items-center bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 shrink-0">' +
                '                    <input type="number" step="0.1" id="salesTaxPercentage" value="' + esc(budget.salesTaxPercentage) + '" class="w-7 text-right text-[10px] font-black text-blue-600 bg-transparent outline-none">' +
                '                    <span class="text-[9px] font-black text-slate-300 ml-0.5">%</span>' +
                '                </div>' +
                '                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Sales Tax</label>' +
                '            </div>' +
                '            <p id="summaryTax" class="text-sm sm:text-base font-black text-slate-800 leading-tight ml-1 truncate">--</p>' +
                '        </div>' +
                '    </div>' +
                '    <div id="taxIncentiveCard" class="cursor-pointer hover:border-emerald-200 hover:bg-emerald-50 transition-all px-4 py-2 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-row items-center justify-between min-h-[52px] ' + (budget.jurisdiction && budget.jurisdiction.name ? '' : 'hidden') + '">' +
                '        <div class="flex items-center gap-3 min-w-0">' +
                '            <div class="flex items-center justify-center bg-emerald-100 w-8 h-8 rounded-xl shrink-0 text-emerald-600">' +
                '                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' +
                '            </div>' +
                '            <div class="min-w-0">' +
                '                <p class="text-[10px] font-black text-emerald-600 uppercase tracking-widest truncate">Tax Incentive Rebate</p>' +
                '                <p id="taxIncentiveJurisdiction" class="text-[9px] text-slate-400 font-bold truncate">' + (budget.jurisdiction && budget.jurisdiction.name ? esc(budget.jurisdiction.name) + ' &bull; ' + (budget.jurisdiction.incentiveRate || 0) + '%' : 'Not configured') + '</p>' +
                '            </div>' +
                '        </div>' +
                '        <p id="summaryIncentiveRebate" class="text-sm font-black text-emerald-600 leading-tight ml-2 truncate flex-shrink-0">--</p>' +
                '    </div>' +
                '    <button id="taxIncentiveSetupBtn" data-action="jurisdiction-modal" class="w-full text-left px-4 py-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all flex items-center gap-3 min-h-[44px] ' + (budget.jurisdiction && budget.jurisdiction.name ? 'hidden' : '') + '">' +
                '        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-slate-300"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' +
                '        <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configure Tax Incentive Jurisdiction</span>' +
                '    </button>' +
                '    <div class="px-4 py-2 bg-gradient-to-r from-rose-50 to-white rounded-2xl border border-rose-100 shadow-sm flex flex-row items-center justify-between min-h-[52px]">' +
                '        <div class="flex items-center gap-3">' +
                '            <div class="flex items-center justify-center bg-rose-100 w-10 h-10 rounded-xl shrink-0 text-rose-500 shadow-sm">' +
                '                ' + (mBTAssets.fire || '') +
                '            </div>' +
                '            <div>' +
                '                <label class="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-0.5">Daily Burn</label>' +
                '                <p class="text-[8px] text-slate-400 font-bold leading-tight uppercase tracking-widest sm:line-clamp-1 max-w-[100px] truncate sm:max-w-none">Average per shooting segment</p>' +
                '            </div>' +
                '        </div>' +
                '        <p id="summaryBurn" class="text-lg sm:text-xl font-black text-rose-600 leading-tight text-right truncate max-w-[50%] pl-2">--</p>' +
                '    </div>' +
                '</div>' +
                '<main id="budget-sections" class="space-y-3">' + renderBudgetSections() + '</main>' +
                '<div class="mt-6 py-1.5 px-4 bg-slate-900 rounded-xl text-[11px] text-slate-400 font-bold uppercase tracking-widest border border-black shadow-2xl">' +
                '    <span class="opacity-50">Intelligence:</span> Industrial personnel rates based on 2025 verified logic. Regional data resolution applied.' +
                '    <button id="compareRatesBtn" class="ml-3 text-blue-400 hover:text-white transition-colors underline decoration-blue-500/30 underline-offset-4">Open Matrix</button>' +
                '</div>';
        },

        /**
         * Updates the metrics summary values (L3113-3200) without destroying DOM.
         */
        update: function () {
            if (!window.budget) return;
            var budget = window.budget;
            var mBTLE = window.mBTLE || {};
            /* Phase 118: apply perspective conversion before formatting */
            var _cur = (window.mBT && window.mBT.logic && window.mBT.logic.currency) ? window.mBT.logic.currency : null;
            var fmt = function (v) {
                var converted = _cur ? _cur.convert(v) : (parseFloat(v) || 0);
                return mBTLE.format && mBTLE.format.currency ? mBTLE.format.currency(converted) : converted;
            };

            // 1. Surgical update of Project Name Header
            var projNameInput = document.getElementById('projectName');
            if (projNameInput && document.activeElement !== projNameInput) {
                projNameInput.value = budget.projectName;
            }

            // 2. Update Summaries
            var setTxt = function (id, val) { 
                var el = document.getElementById(id); 
                if (el) el.textContent = val; 
            };

            var contingency = budget.subtotal * ((budget.contingencyPercentage || 0) / 100);
            var tax = budget.subtotal * ((budget.salesTaxPercentage || 0) / 100);
            var preDiscount = budget.subtotal + contingency + tax;
            var discount = preDiscount * ((budget.discountPercentage || 0) / 100);

            setTxt('summaryGrandTotal', fmt(budget.grandTotal));
            setTxt('summaryActualTotal', fmt(budget.actualTotal));
            setTxt('summarySubtotal', fmt(budget.subtotal));
            if (document.getElementById('fundingCard') && window.mBT && window.mBT.features && window.mBT.features.funding) {
                window.mBT.features.funding.updateCard();
            }

            /* Phase 108: HUD bar visibility toggles */
            var showFunding = !(budget.settings && budget.settings.showFundingBar === false);
            var showTimeline = !(budget.settings && budget.settings.showTimelineBar === false);
            var _fundingCard = document.getElementById('fundingCard');
            if (_fundingCard) _fundingCard.classList.toggle('hidden', !showFunding);

            /* Phase 108: Timeline Sparkline Bar — stage day inputs + proportional bar */
            var _stagesBar = document.getElementById('stagesHorizontalBar');
            if (_stagesBar) {
                _stagesBar.classList.toggle('hidden', !showTimeline);
                if (showTimeline) {
                    var tl = (budget.targetLock && budget.targetLock.stages) ? budget.targetLock.stages : {};
                    var STAGE_KEYS = ['dev', 'pre', 'prod', 'post', 'dist'];
                    var STAGE_COLORS = { dev: 'bg-emerald-400', pre: 'bg-blue-400', prod: 'bg-amber-400', post: 'bg-rose-400', dist: 'bg-violet-400' };
                    var STAGE_SHORT  = { dev: 'Dev', pre: 'Pre', prod: 'Prod', post: 'Post', dist: 'Dist' };
                    var workWeekVal  = (budget.settings && budget.settings.workWeek) || 5;

                    /* Build day-input pills */
                    var inputsHtml = '';
                    var totalStageDays = 0;
                    STAGE_KEYS.forEach(function (k) { totalStageDays += parseFloat((tl[k] && tl[k].days) || 0); });

                    STAGE_KEYS.forEach(function (k) {
                        var d = parseFloat((tl[k] && tl[k].days) || 0);
                        inputsHtml += '<div class="flex flex-col items-center gap-0.5 shrink-0">' +
                            '<span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">' + STAGE_SHORT[k] + '</span>' +
                            '<div class="flex items-center bg-slate-100 rounded-md px-1.5 py-0.5 border-b border-slate-300">' +
                            '<input type="number" min="0" value="' + (d || '') + '" placeholder="0" ' +
                            'onchange="updateStageDuration(\'' + k + '\', this.value); mBT.ui.toolbar.update();" ' +
                            'class="w-8 bg-transparent text-[10px] font-black text-slate-700 outline-none text-center no-spinner placeholder-slate-300">' +
                            '<span class="text-[8px] text-slate-400 font-bold">d</span>' +
                            '</div>' +
                            '</div>';
                    });

                    /* Build proportional bar segments */
                    var segsHtml = '';
                    if (totalStageDays > 0) {
                        STAGE_KEYS.forEach(function (k) {
                            var d = parseFloat((tl[k] && tl[k].days) || 0);
                            if (d > 0) {
                                var pct = (d / totalStageDays) * 100;
                                segsHtml += '<div class="h-full transition-all duration-500 ' + STAGE_COLORS[k] + '" style="width:' + pct + '%"></div>';
                            }
                        });
                    } else {
                        segsHtml = '<div class="h-full w-full bg-slate-200 rounded-full"></div>';
                    }

                    var workWeekHtml = '<div class="flex flex-col items-center gap-0.5 ml-auto shrink-0">' +
                        '<span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Work Week</span>' +
                        '<div class="flex items-center bg-slate-100 rounded-md overflow-hidden">' +
                        '<button onclick="mBT.features.funding.setWorkWeek(5)" class="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest transition-all ' + (workWeekVal === 5 ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200') + '">5</button>' +
                        '<button onclick="mBT.features.funding.setWorkWeek(6)" class="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest transition-all border-x border-slate-200 ' + (workWeekVal === 6 ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200') + '">6</button>' +
                        '<button onclick="mBT.features.funding.setWorkWeek(7)" class="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest transition-all ' + (workWeekVal === 7 ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200') + '">7</button>' +
                        '</div>' +
                        '</div>';

                    _stagesBar.innerHTML = '<div class="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 pt-3 pb-2 overflow-hidden">' +
                        '<div class="flex items-end flex-nowrap gap-x-3 mb-3 overflow-x-auto no-scrollbar">' + 
                            '<div class="flex items-end gap-2 shrink-0">' + inputsHtml + '</div>' +
                            workWeekHtml + 
                        '</div>' +
                        '<div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex cursor-pointer" onclick="mBT.ui.toolbar.handleSparklineTap()">' + segsHtml + '</div>' +
                        '</div>';
                }
            }
            setTxt('summaryDiscount', fmt(-discount));
            setTxt('summaryContingency', fmt(contingency));
            setTxt('summaryTax', fmt(tax));

            var _fringesInline = document.getElementById('summaryFringesInline');
            if (_fringesInline) {
                if (budget.fringesTotal && budget.fringesTotal > 0) {
                    _fringesInline.textContent = '+ ' + fmt(budget.fringesTotal) + ' fringes';
                    _fringesInline.classList.remove('hidden');
                } else {
                    _fringesInline.classList.add('hidden');
                }
            }

            // Incentive display
            var _rebateEl = document.getElementById('summaryIncentiveRebate');
            var _taxCard = document.getElementById('taxIncentiveCard');
            var _taxSetupBtn = document.getElementById('taxIncentiveSetupBtn');
            var _jurLabel = document.getElementById('taxIncentiveJurisdiction');
            var _hasJur = budget.jurisdiction && budget.jurisdiction.name;
            if (_taxCard) _taxCard.classList.toggle('hidden', !_hasJur);
            if (_taxSetupBtn) _taxSetupBtn.classList.toggle('hidden', !!_hasJur);
            if (_rebateEl && _hasJur) _rebateEl.textContent = fmt(budget.incentiveRebate || 0);
            if (_jurLabel && _hasJur) _jurLabel.textContent = budget.jurisdiction.name + ' \u2022 ' + (budget.jurisdiction.incentiveRate || 0) + '%';

            // Actuals toggle state
            var _actualsBtn = document.getElementById('actualsToggleBtn');
            if (_actualsBtn) {
                _actualsBtn.classList.toggle('text-amber-400', !!budget.actualsMode);
                _actualsBtn.classList.toggle('text-slate-400', !budget.actualsMode);
            }

            // Burn Rate (working days, delegated to Stages Engine)
            var _burnMetrics = window.mBTStagesEngine ? window.mBTStagesEngine.getMetrics() : null;
            if (_burnMetrics && _burnMetrics.dailyBurn > 0) {
                setTxt('summaryBurn', fmt(_burnMetrics.dailyBurn) + '/day');
            } else {
                setTxt('summaryBurn', 'Set Schedule');
            }
        },

        /* Phase 108: Triple-tap state for sparkline navigation */
        _tapCount: 0,
        _tapTimer: null,
        handleSparklineTap: function () {
            mBT.ui.toolbar._tapCount++;
            clearTimeout(mBT.ui.toolbar._tapTimer);
            if (mBT.ui.toolbar._tapCount >= 3) {
                mBT.ui.toolbar._tapCount = 0;
                openTool('./src/tools/stages/index.html?projectKey=' + encodeURIComponent(storageKeyPrefix + (budget ? budget.projectName : '')) + '&currency=' + encodeURIComponent(displayCurrency || 'JMD'));
            } else {
                mBT.ui.toolbar._tapTimer = setTimeout(function () { mBT.ui.toolbar._tapCount = 0; }, 600);
            }
        },

        /* State Bridge (Phase 100): self-registers on mBT.core.events so the toolbar
           reactively updates when budget data changes. Supplements the mBT.ui.paint() path. */
        init: function () {
            mBT.core.events.on('budget:updated', function () {
                mBT.ui.toolbar.update();
            });
        },

        /* Async fill: populates #project-management-container with project selector + file menu.
           Extracted from index.html renderProjectManagement() (Phase 100.4). */
        renderProjectMgmt: function () {
            var container = document.getElementById('project-management-container');
            if (!container) return;

            var listP = (mBT.data && mBT.data.getList) ? mBT.data.getList() : Promise.resolve([]);
            return listP.then(function (projects) {
                projects.sort().reverse();

                var menuItems = [
                    { label: 'New Budget', icon: mBTAssets.plus, color: 'text-emerald-600', bg: 'hover:bg-emerald-50', action: 'project-new' },
                    { label: 'Duplicate Budget', icon: mBTAssets.copy, color: 'text-blue-600', bg: 'hover:bg-blue-50', action: 'project-duplicate' },
                    { label: 'Save as Blueprint', icon: mBTAssets.save, color: 'text-indigo-600', bg: 'hover:bg-indigo-50', action: 'blueprint-save' },
                    { label: 'Template Manager', icon: mBTAssets.grid, color: 'text-violet-600', bg: 'hover:bg-violet-50', action: 'template-manager' },
                    { label: 'Sync Rates', icon: mBTAssets.cloud, color: 'text-sky-600', bg: 'hover:bg-sky-50', action: 'project-sync' },
                    { label: 'Import Budget', icon: mBTAssets.cloud, color: 'text-purple-600', bg: 'hover:bg-purple-50', action: 'project-import-trigger' },
                    { label: 'Export Data Package', icon: mBTAssets.cloud, color: 'text-indigo-600', bg: 'hover:bg-indigo-50', action: 'export-all-data' },
                    { label: 'Payments / Ledger', icon: mBTAssets.wallet, color: 'text-amber-600', bg: 'hover:bg-amber-50', action: 'open-payments-ledger' },
                    { label: 'Recycle Bin', icon: mBTAssets.trash, color: 'text-slate-500', bg: 'hover:bg-slate-50', action: 'project-recycle' },
                    { divider: true },
                    { label: 'Delete Budget', icon: mBTAssets.trash, color: 'text-rose-600', bg: 'hover:bg-rose-50', action: 'project-delete' }
                ];

                var menuHtml = menuItems.map(function (item) {
                    if (item.divider) return '<div class="h-px bg-slate-100 my-1"></div>';
                    return '<button data-action="' + item.action + '" class="w-full text-left px-4 py-2.5 flex items-center gap-3 ' + item.color + ' ' + item.bg + ' transition-colors group"><span class="opacity-70 group-hover:opacity-100 scale-90">' + item.icon + '</span><span class="text-[11px] font-black uppercase tracking-widest">' + item.label + '</span></button>';
                }).join('');

                var html = '<div class="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm relative z-50 w-full md:w-auto">' +
                    '<div class="relative group flex-grow md:flex-grow-0">' +
                    '<select id="projectSelect" data-action="project-switch" class="w-full md:w-auto appearance-none bg-slate-50 border-none text-[10px] font-black uppercase tracking-widest text-slate-700 rounded-xl pl-3 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer min-w-[140px] transition-all hover:bg-slate-100">';

                if (projects.length === 0 && typeof currentProjectName !== 'undefined' && currentProjectName) {
                    html += '<option value="' + esc(currentProjectName) + '" selected>' + esc(currentProjectName) + '</option>';
                }
                projects.forEach(function (p) {
                    var selected = (typeof currentProjectName !== 'undefined' && p === currentProjectName) ? 'selected' : '';
                    html += '<option value="' + esc(p) + '" ' + selected + '>' + esc(p) + '</option>';
                });

                html += '</select>' +
                    '<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 group-hover:text-slate-600">' +
                    '<svg class="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>' +
                    '</div></div>' +
                    '<div class="relative flex-shrink-0">' +
                    '<button id="fileMenuBtn" data-action="file-menu-toggle" class="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 px-4 py-2.5 rounded-xl transition-all active:scale-95 group">' +
                    '<span class="text-[11px] font-black uppercase tracking-widest">File</span>' +
                    '<svg class="w-3 h-3 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>' +
                    '</button>' +
                    '<div id="fileMenuDropdown" class="hidden absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-xl z-[200] overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200" onmouseleave="this.classList.add(\'hidden\')">'
                    + menuHtml +
                    '</div></div>' +
                    '</div>';

                container.innerHTML = html;
            });
        }
    };

})(window);
