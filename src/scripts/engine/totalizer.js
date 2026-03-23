/**
 * mBT Totalizer Engine
 * @description Core mathematical reconciliation engine for budget calculation.
 * Clean, decoupled, and standalone.
 */

(function () {
    'use strict';

    window.mBT = window.mBT || {};

    /* --- Production type crew day defaults --- */
    /* Defines expected principal photography days per type (used by stageCrewDays) */
    var PROD_TYPE_DAYS = {
        indie:      { prePro: 10, principal: 15, post: 20 },
        commercial: { prePro: 3,  principal: 5,  post: 7  },
        feature:    { prePro: 20, principal: 40, post: 60 }
    };

    /* --- Stage presence rules per section id --- */
    /* 'all' = present in every stage; 'principal' = shoot days only; 'post' = post only */
    var SECTION_STAGE_MAP = {
        atl:    'all',
        prod:   'principal',
        tech:   'principal',
        gear:   'principal',
        conn:   'principal',
        post:   'post',
        pub:    'post',
        dist:   'post',
        travel: 'all',
        other:  'all'
    };

    window.mBT.totalizer = {

        PROD_TYPE_DAYS: PROD_TYPE_DAYS,
        SECTION_STAGE_MAP: SECTION_STAGE_MAP,

        /**
         * Reconcile a project/budget object and calculate all totals.
         * Supports per-item discountPercent field in addition to global discountPercentage.
         * Returns: { subtotal, contingency, tax, itemDiscounts, globalDiscount, discount,
         *            grandTotal, actualTotal, egt, atc }
         */
        reconcile: function (project) {
            if (!project) return null;

            var subtotal = 0;
            var actualTotal = 0;
            var itemDiscounts = 0; /* aggregate of per-item discount amounts */

            /* --- 1. Sum categories/sections --- */
            if (project.categories) {
                Object.values(project.categories).forEach(function (cat) {
                    var catSum = 0;
                    if (cat.items && Array.isArray(cat.items)) {
                        cat.items.forEach(function (item) {
                            var qty  = parseFloat(item.quantity)   || 0;
                            var rate = parseFloat(item.rate)        || 0;
                            var mult = parseFloat(item.multiplier)  || 1;
                            item.total = qty * rate * mult;

                            /* Per-item discount — stored as discountPercent (0-100) on the item */
                            var itemDiscPct = parseFloat(item.discountPercent) || 0;
                            if (itemDiscPct > 0) {
                                var itemDisc = item.total * (itemDiscPct / 100);
                                item.discountAmount = itemDisc;
                                item.total -= itemDisc;
                                itemDiscounts += itemDisc;
                            } else {
                                item.discountAmount = 0;
                            }

                            catSum += item.total;
                            actualTotal += parseFloat(item.actual) || 0;
                        });
                    }
                    cat.amount = catSum;
                    subtotal += catSum;
                });
            } else if (project.sections) {
                Object.values(project.sections).forEach(function (section) {
                    var sectionSum = 0;
                    if (section.items && Array.isArray(section.items)) {
                        section.items.forEach(function (item) {
                            var qty  = parseFloat(item.quantity)   || 0;
                            var rate = parseFloat(item.rate)        || 0;
                            var mult = parseFloat(item.multiplier)  || 1;
                            item.total = qty * rate * mult;

                            var itemDiscPct = parseFloat(item.discountPercent) || 0;
                            if (itemDiscPct > 0) {
                                var itemDisc = item.total * (itemDiscPct / 100);
                                item.discountAmount = itemDisc;
                                item.total -= itemDisc;
                                itemDiscounts += itemDisc;
                            } else {
                                item.discountAmount = 0;
                            }

                            sectionSum += item.total;
                            actualTotal += parseFloat(item.actual) || 0;
                        });
                    }
                    section.total = sectionSum;
                    subtotal += sectionSum;
                });
            } else {
                subtotal = parseFloat(project.total_budget || project.budget || 0);
            }

            /* --- 2. Global overhead adjustments (applied after item discounts) --- */
            var contingencyPercent = parseFloat(project.contingencyPercentage) || 0;
            var taxPercent         = parseFloat(project.salesTaxPercentage)    || 0;
            var globalDiscPct      = parseFloat(project.discountPercentage)    || 0;

            var contingency  = subtotal * (contingencyPercent / 100);
            var tax          = subtotal * (taxPercent          / 100);
            var preDiscount  = subtotal + contingency + tax;
            var globalDiscount = preDiscount * (globalDiscPct  / 100);
            var grandTotal   = preDiscount - globalDiscount;

            /* discount = combined item-level + global for summary display */
            var discount = itemDiscounts + globalDiscount;

            /* --- 3. Persist back to project --- */
            project.subtotal     = subtotal;
            project.grandTotal   = grandTotal;
            project.actualTotal  = actualTotal;
            project.itemDiscounts = itemDiscounts;
            if (!project.total_budget) project.total_budget = grandTotal;

            /* egt / atc are the canonical names used in budget summary UI */
            return {
                subtotal,
                contingency,
                tax,
                itemDiscounts,
                globalDiscount,
                discount,
                grandTotal,
                actualTotal,
                egt: grandTotal,     /* Estimated Grand Total */
                atc: actualTotal     /* Actual Total Cost */
            };
        },

        /**
         * Return expected stage-day defaults for a given production type.
         * @param {string} productionType - 'indie' | 'commercial' | 'feature'
         * @returns {{ prePro, principal, post }}
         */
        stageDayDefaults: function (productionType) {
            return PROD_TYPE_DAYS[productionType] || PROD_TYPE_DAYS.commercial;
        },

        /**
         * Calculate effective days for a line item given production stage days.
         * Items in sections that are 'principal'-only don't incur pre-pro or post days.
         * @param {Object} item        - Line item with quantity (days) and optional sectionId
         * @param {string} sectionId   - Parent section id (maps to SECTION_STAGE_MAP)
         * @param {Object} stageDays   - { prePro, principal, post } actual scheduled days
         * @returns {number}           - Adjusted quantity (days) to use for cost calculation
         */
        effectiveDays: function (item, sectionId, stageDays) {
            if (!stageDays) return parseFloat(item.quantity) || 0;

            var presence = SECTION_STAGE_MAP[(sectionId || '').toLowerCase()] || 'all';
            var prePro    = parseFloat(stageDays.prePro)    || 0;
            var principal = parseFloat(stageDays.principal) || 0;
            var post      = parseFloat(stageDays.post)      || 0;

            if (presence === 'principal') return principal;
            if (presence === 'post')      return post;
            /* 'all' — total across all active stages */
            return prePro + principal + post;
        }
    };

})();
