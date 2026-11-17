/**
 * © 2026 Jayson Moo-Young <moo@moo.llc>
 * Part of the mBT (mooBudgetTool) Ecosystem.
 * License: MIT
 */

/* mBT Phase 80: Finance Engine — Wallet Bridge
   Payment entry point moved to Contacts microservice (Wallet tab).
   Direct item.actual writes removed — Phase 77 actuals engine owns that field.
   Both methods below are stubs that redirect to the correct flow. */

window.mBT_Finance_Engine = {

    /* Payments are initiated from the Contacts tool Wallet view, not from line items. */
    openModal: function (itemId) {
        mBTME.alert('Use Wallet', 'Payments are now processed via the Contacts tool. Open the Contacts tool, find your vendor, and use the Wallet panel to issue payment against an open PO.');
    },

    /* Stub — payment processing handled inside Contacts iframe via update-ledgers postMessage. */
    processPayment: function (poId) {
        mBTME.alert('Use Wallet', 'Payments are now processed via the Contacts tool Wallet panel.');
    }

};

/* ========= Phase 93: mBT.finance — Core Reconcile Engine (extracted from monolith) =========
   Pure logic — no DOM manipulation.
   Depends only on window.budget (global budget proxy) and window.mBT (namespace).
   Loaded before the main inline script so the monolith delegates to window.mBT_Finance.reconcile. */

window.mBT_Finance = (function () {

    /* --- 2-decimal precision guard for all terminal multiplications --- */
    function _round(val) {
        return Math.round((parseFloat(val) || 0) * 100) / 100;
    }

    /* --- Field validation: canonical defaults for a single line item --- */
    function _validateItem(item) {
        item.quantity = Math.max(0, parseFloat(item.quantity) || 0);
        item.rate = Math.max(0, parseFloat(item.rate) || 0);
        item.multiplier = Math.max(1, parseFloat(item.multiplier) || 1);
        /* Phase 76: qualifying spend flag */
        if (item.qualifying === undefined) item.qualifying = false;
        /* Phase 77: actuarial fields */
        if (item.actualQuantity === undefined) item.actualQuantity = 0;
        if (item.actualRate === undefined) item.actualRate = 0;
        if (!item.actualDate) item.actualDate = '';
        if (item.committedCost === undefined) item.committedCost = 0;
        return item;
    }

    /* --- Line-item cost calculation: estimated total and variance vs actual --- */
    function _calculateItem(item) {
        var qty = parseFloat(item.quantity) || 0;
        var rate = parseFloat(item.rate) || 0;
        var mult = parseFloat(item.multiplier) || 1;
        var est = _round(qty * rate * mult);
        var act = parseFloat(item.actual) || 0;
        return { estimated: est || 0, variance: (act - est) || 0 };
    }

    /* Shared adjustment math for the toolbar and every publisher format.
       Reuses reconciled line totals and refreshes each fringe's base/amount. */
    function summary(b, subtotal) {
        if (subtotal == null) {
            subtotal = parseFloat(b.subtotal);
            if (!isFinite(subtotal)) {
                subtotal = 0;
                Object.keys(b.sections || {}).forEach(function (key) {
                    (b.sections[key].items || []).forEach(function (item) {
                        subtotal += item.total != null ? (parseFloat(item.total) || 0) : _calculateItem(item).estimated;
                    });
                });
            }
        }
        var contingency = _round(subtotal * ((b.contingencyPercentage || 0) / 100));
        var tax = _round(subtotal * ((b.salesTaxPercentage || 0) / 100));
        var fringesTotal = 0;
        if (b.fringes && b.fringes.length) {
            b.fringes.forEach(function (f) {
                var base;
                var keys = f.sectionKeys;
                if (!keys || !keys.length) {
                    base = subtotal;
                } else {
                    base = 0;
                    /* Scope is a union of rows, not a sum of overlapping section totals. */
                    var seen = Object.create(null), anonymous = [];
                    Object.keys(b.sections || {}).forEach(function (part) {
                        (b.sections[part].items || []).forEach(function (item) {
                            if (keys.indexOf(part) === -1 && keys.indexOf(item._departmentSection) === -1) return;
                            if (item.id != null && item.id !== '') {
                                if (seen[item.id]) return;
                                seen[item.id] = true;
                            } else {
                                if (anonymous.indexOf(item) !== -1) return;
                                anonymous.push(item);
                            }
                            base += item.total != null ? (parseFloat(item.total) || 0) : _calculateItem(item).estimated;
                        });
                    });
                }
                var amt = _round(base * ((parseFloat(f.rate) || 0) / 100));
                f.base = base;
                f.amount = amt;
                if (f.enabled !== false) fringesTotal += amt;
            });
        }
        var preFee = subtotal + contingency + tax + fringesTotal;
        var feeRate = parseFloat(b.productionFeePercentage) || 0;
        feeRate = isFinite(feeRate) ? Math.min(100, Math.max(0, feeRate)) : 0;
        var productionFeeAmount = _round(preFee * (feeRate / 100));
        if (!isFinite(productionFeeAmount) || !isFinite(preFee + productionFeeAmount)) productionFeeAmount = 0;
        var duplicateFeeWarning = feeRate > 0 && (b.fringes || []).some(function (fringe) {
            return fringe.enabled !== false && String(fringe.name || '').trim().toLowerCase() === 'production fee';
        });
        var preDiscount = preFee + productionFeeAmount;
        var discount = _round(preDiscount * ((b.discountPercentage || 0) / 100));
        return { subtotal: subtotal, contingency: contingency, tax: tax,
            fringesTotal: fringesTotal, productionFeePercentage: feeRate,
            productionFeeAmount: productionFeeAmount, duplicateFeeWarning: duplicateFeeWarning, discount: discount,
            grandTotal: _round(preDiscount - discount) || 0 };
    }

    function normalizeProductionFee(value) {
        var n = Number(value);
        return isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
    }

    /* Shared manual/AI write path. The budget proxy owns persistence; callers
       retain their normal repaint/save transaction around this engine update. */
    function setProductionFee(b, value) {
        if (typeof value !== 'number' || !isFinite(value)) throw new Error('Production Fee must be a finite number from 0 to 100.');
        b.productionFeePercentage = normalizeProductionFee(value);
        reconcile(b);
    }

    /* --- reconcile: recomputes all section and budget-level totals ---
       Accepts optional 'target' for Shadow Budgeting (Simulations).
       Writes results back onto the budget object in place. */
    function reconcile(target) {
        var b = target || window.budget;
        if (!b || !b.sections) return;

        /* Phase 78: aggregate committedCost from POs before item calculations */
        if (b.ledgers && Array.isArray(b.ledgers.pos)) {
            /* Reset every line first, even when the PO list is now empty, so a deleted last PO leaves no stale committed cost. */
            Object.keys(b.sections).forEach(function (sk) {
                b.sections[sk].items.forEach(function (it) { it.committedCost = 0; if (it.committedUnconverted) it.committedUnconverted = 0; });
            });
            b.ledgers.pos.forEach(function (po) {
                if (po.status !== 'Committed' && po.status !== 'Invoiced' && po.status !== 'Paid') return;
                if (po.itemId && po.sectionKey && b.sections[po.sectionKey]) {
                    var _poItem = b.sections[po.sectionKey].items.find(function (it) { return it.id === po.itemId; });
                    if (_poItem) {
                        var _poAmt = parseFloat(po.paidAmount);
                        if (!_poAmt) _poAmt = parseFloat(po.amount) || 0;
                        /* A PO keeps its own currency. Convert it once, into the budget's currency, before it is added to a line. */
                        if (po.currency && b.currency && po.currency !== b.currency) {
                            var _poConv = (window.mBT && window.mBT.le && typeof window.mBT.le.convertCurrencyOrNull === 'function') ? window.mBT.le.convertCurrencyOrNull(_poAmt, po.currency, b.currency, b) : null;
                            if (typeof _poConv === 'number' && isFinite(_poConv)) _poAmt = _poConv;
                            else {
                                /* No rate for this PO's currency: keep it out of the line's committed cost and count it, so the grid can say so. */
                                _poItem.committedUnconverted = (_poItem.committedUnconverted || 0) + 1;
                                return;
                            }
                        }
                        _poItem.committedCost = (_poItem.committedCost || 0) + _poAmt;
                    }
                }
            });
        }

        /* Phase 90: Resolve temporal utilities for payable-day calculations */
        var _le = (typeof window.mBT !== 'undefined' && window.mBT.le) ? window.mBT.le : null;
        var stageStarts = (_le && _le.getStageStartDates) ? _le.getStageStartDates(b) : {};
        var workWeek = (b.targetLock && b.targetLock.workWeek) || 7;
        var blackouts = (b.targetLock && b.targetLock.blackouts) || [];

        var subtotal = 0;
        var grandActual = 0;
        var incentiveQualifyingTotal = 0;

        Object.keys(b.sections).forEach(function (sectionKey) {
            var sectionEstTotal = 0;
            var section = b.sections[sectionKey];
            section.items.forEach(function (item) {
                _validateItem(item);

                /* --- Stage Aggregation (Phase 90.RC): uses computeWorkingDays for payable days --- */
                if (item.stageData && Object.keys(item.stageData).length > 0 && item.rateType !== 'fixed') {
                    var stageSumCost = 0;
                    var stageSumDays = 0;
                    Object.keys(item.stageData).forEach(function (stageKey) {
                        var d = item.stageData[stageKey];
                        var grossDays = parseFloat(d.days) || 0;
                        var dRate = parseFloat(d.rate) || 0;
                        /* Per-stage rate multiplier: default 1, allows fractional rates (e.g. 0.5 = half rate) without mutating the preset/industry rate source of truth */
                        var dMult = (d.multiplier === undefined || d.multiplier === null || d.multiplier === '') ? 1 : (parseFloat(d.multiplier) || 0);
                        /* Apply work-week and blackout calendar if temporal utilities are available */
                        var payableDays = (_le && _le.computeWorkingDays && stageStarts[stageKey])
                            ? _le.computeWorkingDays(grossDays, stageStarts[stageKey], workWeek, blackouts)
                            : grossDays;
                        stageSumCost += (payableDays * dRate * dMult);
                        stageSumDays += payableDays;
                    });
                    item.quantity = stageSumDays;
                    item.total = _round(stageSumCost) || 0;
                    item.rate = stageSumDays > 0 ? (stageSumCost / stageSumDays) : 0;
                    if (stageSumDays > 0) item.unit = 'Day';
                } else {
                    var calc = _calculateItem(item);
                    item.total = calc.estimated || 0;
                }

                sectionEstTotal += item.total;

                /* Phase 77: actuals mode — compute actual cost from qty×rate */
                if (b.actualsMode) {
                    var _aq = parseFloat(item.actualQuantity) || 0;
                    var _ar = parseFloat(item.actualRate) || 0;
                    var _ac = _aq * _ar;
                    item.actual = _ac;
                    item.ETC = Math.max(0, item.total - (parseFloat(item.committedCost) || 0) - _ac);
                    grandActual += _ac;
                } else {
                    grandActual += parseFloat(item.actual) || 0;
                }

                /* Phase 76: qualifying spend — skip ATL sections */
                var _jAtl = (b.jurisdiction && b.jurisdiction.atlSections) || [];
                if (item.qualifying && _jAtl.indexOf(sectionKey) === -1 && _jAtl.indexOf(item._departmentSection) === -1) {
                    incentiveQualifyingTotal += item.total;
                }
            });
            section.total = sectionEstTotal;
            subtotal += sectionEstTotal;
        });

        /* Phase 135: section.ratio — each section's proportion of the budget subtotal (0–1 decimal) */
        Object.keys(b.sections).forEach(function (sectionKey) {
            b.sections[sectionKey].ratio = subtotal > 0 ? b.sections[sectionKey].total / subtotal : 0;
        });

        var totals = summary(b, subtotal);
        b.subtotal = subtotal || 0;
        b.fringesTotal = totals.fringesTotal || 0;
        b.productionFeeAmount = totals.productionFeeAmount;
        b.grandTotal = totals.grandTotal;
        b.actualTotal = grandActual || 0;

        /* Phase 76: incentive rebate — add fringes on qualifying labor then apply rate */
        var incentiveRebate = 0;
        if (b.jurisdiction && b.jurisdiction.incentiveRate > 0) {
            var _fringeRateQ = 0;
            if (b.fringes && b.fringes.length) {
                b.fringes.forEach(function (f) {
                    if (f.enabled !== false) _fringeRateQ += (parseFloat(f.rate) || 0);
                });
            }
            var _qualWithFringes = _round(incentiveQualifyingTotal * (1 + _fringeRateQ / 100));
            var _minSpend = parseFloat(b.jurisdiction.minSpend) || 0;
            if (_qualWithFringes >= _minSpend || _minSpend === 0) {
                incentiveRebate = _round(_qualWithFringes * ((parseFloat(b.jurisdiction.incentiveRate) || 0) / 100));
            }
        }
        b.incentiveQualifyingTotal = incentiveQualifyingTotal;
        b.incentiveRebate = incentiveRebate;
    }

    return { reconcile: reconcile, summary: summary, setProductionFee: setProductionFee, normalizeProductionFee: normalizeProductionFee,
        duplicateFeeWarningText: 'Production Fee is also enabled in Fringes. Both charges are included. Review the fringe or fee to avoid charging twice.' };

})();
