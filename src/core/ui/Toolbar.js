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
            
            function amount(id) {
                return '<p id="' + id + '" class="mbt-summary-number">--</p>';
            }
            function stepper(id, label) {
                return '<div class="mbt-percent" onclick="event.stopPropagation()">' +
                    '<input type="number" min="0"' + (id === 'productionFeePercentage' ? ' max="100"' : '') + ' step="0.1" id="' + id + '" aria-label="' + label + ' percentage" value="' + esc(budget[id] || 0) + '">' +
                    '<span aria-hidden="true">%</span><div class="mbt-percent-arrows">' +
                    '<button type="button" aria-label="Increase ' + label + ' percentage" onclick="mBT.ui.toolbar.stepPercentage(' + esc(JSON.stringify(String(id))) + ', 1)">&#9650;</button>' +
                    '<button type="button" aria-label="Decrease ' + label + ' percentage" onclick="mBT.ui.toolbar.stepPercentage(' + esc(JSON.stringify(String(id))) + ', -1)">&#9660;</button>' +
                    '</div></div>';
            }
            return '<div id="summary" class="mb-4">' +
                '<div id="fundingCard" class="mb-2"></div><div id="stagesHorizontalBar" class="mb-2"></div>' +
                '<div class="mbt-summary-totals">' +
                    '<div class="mbt-summary-card mbt-total-estimate"><div class="mbt-summary-watermark" aria-hidden="true">' + (mBTAssets.money || '$') + '</div><p class="mbt-summary-label">Estimated Grand Total</p>' + amount('summaryGrandTotal') + '</div>' +
                    '<div class="mbt-summary-card mbt-total-actual"><div class="mbt-summary-watermark" aria-hidden="true"><svg width="92" height="92" viewBox="0 0 92 92" fill="currentColor"><rect x="8" y="55" width="18" height="30" rx="3"/><rect x="36" y="32" width="18" height="53" rx="3"/><rect x="64" y="8" width="18" height="77" rx="3"/></svg></div><p class="mbt-summary-label">Actual Expenditure</p>' + amount('summaryActualTotal') + '</div>' +
                    '<div id="summaryBudgetDeltaCard" class="mbt-summary-card mbt-total-delta bg-amber-600"><div class="mbt-summary-watermark" aria-hidden="true"><svg width="92" height="92" viewBox="0 0 92 92" fill="currentColor"><path d="M42 6a40 40 0 1 0 38 57L42 46z"/><path d="M49 3v38l36 17A40 40 0 0 0 49 3z"/></svg></div><p id="summaryBudgetDeltaLabel" class="mbt-summary-label">Remaining</p>' + amount('summaryBudgetDelta') + '</div>' +
                '</div><div class="mbt-summary-adjustments">' +
                    '<div class="mbt-summary-card mbt-subtotal"><p class="mbt-summary-label">Project Subtotal</p>' + amount('summarySubtotal') + '</div>' +
                    '<div class="mbt-summary-card mbt-adjustment"><label id="summaryProductionFeeLabel" class="mbt-summary-label" for="productionFeePercentage">Production Fee (' + esc(budget.productionFeePercentage || 0) + '%)</label><div class="mbt-adjustment-values">' + stepper('productionFeePercentage', 'Production Fee') + amount('summaryProductionFee') + '</div><select id="productionFeePreset" aria-label="Production fee tier" onchange="mBT.ui.toolbar.pickProductionFee(this.value)" class="mbt-summary-note bg-transparent w-full"><option value="custom">Custom / no tier</option><option value="10">10% — Small / favour</option><option value="15">15% — Standard</option><option value="20">20% — Rush / complex</option></select><p class="mbt-summary-note">On subtotal + contingency + tax + fringes.</p></div>' +
                    '<div class="mbt-summary-card mbt-adjustment"><label class="mbt-summary-label" for="discountPercentage">Discount</label><div class="mbt-adjustment-values">' + stepper('discountPercentage', 'Discount') + amount('summaryDiscount') + '</div><p class="mbt-summary-note" title="Taken off the subtotal, contingency, fringes, tax and production fee added together.">Percent off everything, including tax.</p></div>' +
                    '<div id="contingencyFringesCard" class="mbt-summary-card mbt-adjustment cursor-pointer"><label class="mbt-summary-label" for="contingencyPercentage">Contingency &amp; Fringes</label><div class="mbt-adjustment-values">' + stepper('contingencyPercentage', 'Contingency') + '<div class="mbt-adjustment-amount">' + amount('summaryContingency') + '<p id="summaryFringesInline" class="mbt-summary-fringes hidden"></p></div></div><p class="mbt-summary-note" title="Contingency is a percentage of the subtotal. Fringes that are switched on are added as well.">A cushion on the subtotal, plus fringes.</p></div>' +
                    '<div class="mbt-summary-card mbt-adjustment"><label class="mbt-summary-label" for="salesTaxPercentage">Sales Tax</label><div class="mbt-adjustment-values">' + stepper('salesTaxPercentage', 'Sales tax') + amount('summaryTax') + '</div><p class="mbt-summary-note" title="Sales tax is worked out on the subtotal, before the discount comes off.">Charged on the subtotal, before discount.</p></div>' +
                '</div><p id="productionFeeWarning" role="alert" class="hidden mt-2 p-3 rounded-xl border border-amber-500 bg-amber-50 text-amber-900 text-sm font-bold"></p><div class="mbt-summary-extras">' +
                    '<div id="taxIncentiveCard" class="mbt-summary-card mbt-extra mbt-rebate cursor-pointer ' + (budget.jurisdiction && budget.jurisdiction.name ? '' : 'hidden') + '">' +
                        '<div class="mbt-extra-heading"><div class="mbt-extra-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8C3 8 6 0 10 4l2 4c9 0 6-8 2-4z"/></svg></div><p class="mbt-summary-label">Tax Incentive<br>Rebate</p>' + amount('summaryIncentiveRebate') + '</div>' +
                        '<p id="taxIncentiveJurisdiction" class="mbt-summary-note">' + (budget.jurisdiction && budget.jurisdiction.name ? esc(budget.jurisdiction.name) + ' &bull; ' + esc(budget.jurisdiction.incentiveRate || 0) + '%' : 'Not configured') + '</p>' +
                    '</div>' +
                    '<button id="taxIncentiveSetupBtn" type="button" data-action="jurisdiction-modal" class="mbt-summary-card mbt-rebate ' + (budget.jurisdiction && budget.jurisdiction.name ? 'hidden' : '') + '"><span class="mbt-summary-label">Tax Incentive<br>Rebate</span><span class="mbt-summary-note">Configure tax incentive jurisdiction</span></button>' +
                    '<div class="mbt-summary-card mbt-extra mbt-burn"><div class="mbt-extra-heading"><div class="mbt-extra-icon" aria-hidden="true">' + (mBTAssets.fire || '') + '</div><p class="mbt-summary-label">Daily<br>Burn</p>' + amount('summaryBurn') + '</div><p class="mbt-summary-note" title="Grand total divided by every scheduled working day.">Grand total per scheduled working day.</p></div>' +
                '</div></div>' +
                '<main id="budget-sections" class="space-y-3">' + renderBudgetSections() + '</main>' +
                '<div class="mt-6 py-2 px-4 bg-slate-900 rounded-xl text-[11px] text-slate-300 leading-relaxed border border-black shadow-2xl">' +
                '    <span id="rateSourcesSentence">OpenGate averages contributors\' latest shared budget prices by item and region, alongside mBT reference estimates informed by IATSE, DGA, BECTU and suppliers such as Absolute Rentals.</span>' +
                '    <button type="button" id="compareRatesBtn" data-action="rate-sources" class="ml-3 text-blue-300 hover:text-white transition-colors underline underline-offset-4">Rate sources</button>' +
                '</div>';
        },

        /* Keep the existing input event owner and 0.1 percentage step. */
        stepPercentage: function (id, direction) {
            var input = document.getElementById(id);
            if (!input || input.disabled || input.readOnly) return;
            if (direction > 0) input.stepUp(); else input.stepDown();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        },

        pickProductionFee: function (value) {
            var input = document.getElementById('productionFeePercentage');
            if (!input || input.disabled || input.readOnly) return;
            if (value === 'custom') { input.focus(); input.select(); return; }
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        },

        /* Read-only explanation. Use cached aggregates, never raw contributor prices. */
        openRateSources: function () {
            var og = window.mBTOG || {}, region = (og.settings && og.settings.location) || 'Jamaica';
            var cached = {}, rows = [], seen = Object.create(null);
            try { cached = JSON.parse(localStorage.getItem('moo_og_rate_averages') || '{}') || {}; } catch (err) {}
            if (typeof cached !== 'object' || Array.isArray(cached)) cached = {};
            /* Detailed keys carry unit and currency. Prefer them over legacy aliases. */
            Object.keys(cached).sort(function (a, b) { return b.split('|').length - a.split('|').length; }).forEach(function (key) {
                var fields = key.split('|'), entry = cached[key];
                if (!entry || typeof entry !== 'object' || (fields.length !== 2 && fields.length !== 4)) return;
                if (entry.avg_rate == null || !isFinite(Number(entry.avg_rate)) || Number(entry.avg_rate) < 0) return;
                var unit = entry.unit || fields[2] || 'Not provided', currency = entry.currency || fields[3] || 'Not provided';
                var identity = fields[0] + '|' + fields[1] + '|' + unit + '|' + currency;
                if (seen[identity]) return;
                seen[identity] = true;
                var count = entry.contributor_count, countLabel = 'Not provided';
                if (count != null && count !== '' && isFinite(Number(count)) && Number(count) >= 0 && Math.floor(Number(count)) === Number(count)) countLabel = String(Number(count));
                var source = entry.source === 'used-community' ? 'Shared budget prices' : entry.source === 'community' ? 'Community rates' : 'Cached OpenGate average';
                rows.push('<tr><td class="p-2">' + esc(fields[0]) + '</td><td class="p-2">' + esc(fields[1]) + '</td><td class="p-2">' + esc(entry.avg_rate) + ' ' + esc(currency) + ' / ' + esc(unit) + '</td><td class="p-2">' + esc(countLabel) + '</td><td class="p-2">' + esc(source) + '</td></tr>');
            });
            var sync = null;
            try { sync = typeof og.lastSync === 'function' ? og.lastSync() : null; } catch (err) {}
            var date = sync ? new Date(sync) : null;
            var syncLabel = date && isFinite(date.getTime()) ? date.toISOString() : 'Not recorded';
            var following = window.mBTBatch2 && mBTBatch2.following() ? 'On' : 'Off';
            var html = '<div id="rate-sources-content" class="p-4 space-y-4 text-xs leading-relaxed overflow-y-auto min-h-0 min-w-0">' +
                '<p>Selected region: <strong>' + esc(region) + '</strong>. Following OpenGate rates: ' + following + '.</p>' +
                '<h3 class="font-bold">How the averages work</h3>' +
                '<p>Shared budget prices use the arithmetic mean of each contributor\'s latest used price for the same item, region, unit and currency. Contributors count once in each group. Sharing prices is opt-in. Raw user prices stay private.</p>' +
                '<p>OpenGate also reads a separate community-rate average feed. Its server calculation is not bundled here. The local fallback averages cached community entries by item and region, then uses reference rates where no community entries exist.</p>' +
                '<h3 class="font-bold">Reference sources</h3>' +
                '<p>mBT\'s bundled references use US price anchors and regional multipliers. They include published prices, comparable-role estimates and estimates where no quote was available. They are not current supplier quotes or guaranteed union minimums.</p>' +
                '<ul class="list-disc pl-5 space-y-1"><li>Crew research: IATSE Area Standards Agreement, Directors Guild of America (DGA), BECTU and the British Columbia Council of Film Unions (BCCFU).</li>' +
                '<li>Regional research: ProductionBase, Beverly Boy Productions and AppLabx Vietnam pricing guide.</li>' +
                '<li>Rental references: Absolute Rentals, High End TV, LensProToGo and Lensrentals. Source notes also mark peer estimates and unquoted equipment.</li></ul>' +
                '<p>Regional Production Rates Master Index and Sources &amp; Bibliography: May 5, 2026. Live Event, Hybrid Conference &amp; Broadcast Camera Rates: July 27 to 28, 2026. UK / Canada OpenGate crew multipliers: August 6, 2026. These are research dates, not a live rate update.</p>' +
                '<h3 class="font-bold">Cached averages</h3>' +
                '<p>Last successful OpenGate sync: ' + esc(syncLabel) + '. Average data updated: not provided by the cached feed. These cached values may not be applied to this budget. No sync is performed when opening this view.</p>' +
                (rows.length ? '<div class="overflow-x-auto"><table class="w-full text-left"><thead><tr><th class="p-2">Item</th><th class="p-2">Region</th><th class="p-2">Average</th><th class="p-2">Contributors</th><th class="p-2">Source</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '<p>No cached OpenGate averages are available. Bundled reference rates remain available offline.</p>') +
                '</div>';
            mBTME.open('rateSources', 'Rate sources', html, 'max-w-3xl');
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
                if (el) el.textContent = el.classList.contains('mbt-summary-number') ? String(val).replace(/([$£€])(?=\d)/, '$1 ') : val;
            };

            var totals = window.mBT_Finance.summary(budget);
            var feeWarning = document.getElementById('productionFeeWarning');
            if (feeWarning) {
                feeWarning.textContent = totals.duplicateFeeWarning ? window.mBT_Finance.duplicateFeeWarningText : '';
                feeWarning.classList.toggle('hidden', !totals.duplicateFeeWarning);
            }
            var contingency = totals.contingency, tax = totals.tax, discount = totals.discount;
            setTxt('summaryProductionFee', fmt(totals.productionFeeAmount));
            setTxt('summaryProductionFeeLabel', 'Production Fee (' + totals.productionFeePercentage + '%)');
            var feeInput = document.getElementById('productionFeePercentage');
            if (feeInput && document.activeElement !== feeInput) feeInput.value = String(totals.productionFeePercentage);
            var preset = document.getElementById('productionFeePreset');
            if (preset) preset.value = [10, 15, 20].indexOf(totals.productionFeePercentage) !== -1 ? String(totals.productionFeePercentage) : 'custom';

            setTxt('summaryGrandTotal', fmt(budget.grandTotal));
            setTxt('summaryActualTotal', fmt(budget.actualTotal));
            var _grandTotal = parseFloat(budget.grandTotal) || 0;
            var _actualTotal = parseFloat(budget.actualTotal) || 0;
            var _budgetDelta = _grandTotal - _actualTotal;
            var _deltaCard = document.getElementById('summaryBudgetDeltaCard');
            var _deltaLabel = document.getElementById('summaryBudgetDeltaLabel');
            if (_deltaLabel) _deltaLabel.textContent = _budgetDelta >= 0 ? 'Remaining' : 'Over budget';
            if (_deltaCard) {
                _deltaCard.classList.toggle('bg-amber-600', _budgetDelta >= 0);
                _deltaCard.classList.toggle('bg-rose-600', _budgetDelta < 0);
            }
            if (_deltaLabel) {
                _deltaLabel.classList.toggle('text-amber-200', _budgetDelta >= 0);
                _deltaLabel.classList.toggle('text-rose-200', _budgetDelta < 0);
            }
            setTxt('summaryBudgetDelta', fmt(Math.abs(_budgetDelta)));
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
                            'onchange="updateStageDuration(' + esc(JSON.stringify(String(k))) + ', this.value); mBT.ui.toolbar.update();" ' +
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
                /* The fringes amount sits on the subtitle line, so the subtitle is shorter while it shows. */
                var _contNote = document.querySelector('#contingencyFringesCard .mbt-summary-note');
                if (_contNote) {
                    var _hasFringes = !!(budget.fringesTotal && budget.fringesTotal > 0);
                    _contNote.textContent = _hasFringes ? 'Percent of subtotal.' : 'A cushion on the subtotal, plus fringes.';
                    _contNote.style.paddingRight = _hasFringes ? '108px' : '';
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
            if (_rebateEl && _hasJur) _rebateEl.textContent = fmt(budget.incentiveRebate || 0).replace(/([$£€])(?=\d)/, '$1 ');
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
                setTxt('summaryBurn', fmt(_burnMetrics.dailyBurn) + '/d');
            } else {
                setTxt('summaryBurn', 'Set Schedule');
            }
            mBT.ui.toolbar.fitAmounts();
        },

        /* An amount that does not fit beside its stepper shrinks a pixel at a time (down to 13 px) before anything wraps. */
        fitAmounts: function () {
            var list = document.querySelectorAll('#summary .mbt-adjustment .mbt-summary-number');
            for (var i = 0; i < list.length; i++) {
                var el = list[i];
                el.style.fontSize = '';
                var size = parseFloat(window.getComputedStyle(el).fontSize) || 25;
                var guard = 0;
                while (el.scrollWidth > el.clientWidth + 1 && size > 13 && guard < 24) {
                    size -= 1;
                    el.style.fontSize = size + 'px';
                    guard++;
                }
            }
            /* Rebate and Daily Burn: shrink the amount to stay on the icon's line; wrap only below 16 px. */
            var extras = document.querySelectorAll('#summary .mbt-extra');
            for (var j = 0; j < extras.length; j++) {
                var num = extras[j].querySelector('.mbt-summary-number');
                var icon = extras[j].querySelector('.mbt-extra-icon');
                if (!num || !icon) continue;
                num.style.fontSize = '';
                var esize = parseFloat(window.getComputedStyle(num).fontSize) || 28;
                var eguard = 0;
                while (num.getBoundingClientRect().top >= icon.getBoundingClientRect().bottom - 2 && esize > 16 && eguard < 24) {
                    esize -= 1;
                    num.style.setProperty('font-size', esize + 'px', 'important');
                    eguard++;
                }
            }
            if (!mBT.ui.toolbar._fitBound) {
                mBT.ui.toolbar._fitBound = true;
                window.addEventListener('resize', function () { mBT.ui.toolbar.fitAmounts(); });
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
            mBT.core.action('rate-sources', function () { mBT.ui.toolbar.openRateSources(); });
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
                    { label: 'Purchase orders', icon: mBTAssets.wallet, color: 'text-amber-600', bg: 'hover:bg-amber-50', action: 'open-payments-ledger' },
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
                    html += '<option value="' + esc(currentProjectName) + '" selected>Budget: ' + esc(currentProjectName) + '</option>';
                }
                projects.forEach(function (p) {
                    var selected = (typeof currentProjectName !== 'undefined' && p === currentProjectName) ? 'selected' : '';
                    html += '<option value="' + esc(p) + '" ' + selected + '>Budget: ' + esc(p) + '</option>';
                });

                html += '</select>' +
                    '</div>' +
                    '<div class="relative flex-shrink-0">' +
                    '<button id="fileMenuBtn" data-action="file-menu-toggle" class="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 px-4 py-2.5 rounded-xl transition-all active:scale-95 group">' +
                    '<span class="text-[11px] font-black uppercase tracking-widest">File</span>' +
                    '<span aria-hidden="true">&#8943;</span>' +
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
