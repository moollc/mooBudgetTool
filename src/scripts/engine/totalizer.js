/**
 * mBT Totalizer Engine
 * @description Core mathematical reconciliation engine for budget calculation.
 * Clean, decoupled, and standalone.
 */

(function () {
    'use strict';

    window.mBT = window.mBT || {};
    window.mBT.totalizer = {
        /**
         * Reconcile a project/budget object and calculate all totals.
         * @param {Object} project - The project data to calculate.
         * @returns {Object} The calculated totals.
         */
        reconcile: function (project) {
            if (!project) return null;

            let subtotal = 0;
            let actualTotal = 0;

            // 1. Calculate Sections
            if (project.categories) {
                // If it's the new "categories" structure
                Object.values(project.categories).forEach(cat => {
                    let catSum = 0;
                    if (cat.items && Array.isArray(cat.items)) {
                        cat.items.forEach(item => {
                            // Item math: qty * rate * multiplier
                            const qty = parseFloat(item.quantity) || 0;
                            const rate = parseFloat(item.rate) || 0;
                            const mult = parseFloat(item.multiplier) || 1;
                            item.total = qty * rate * mult;
                            catSum += item.total;
                            actualTotal += parseFloat(item.actual) || 0;
                        });
                    }
                    cat.amount = catSum;
                    subtotal += catSum;
                });
            } else if (project.sections) {
                // Compatibility for old "sections" structure
                Object.values(project.sections).forEach(section => {
                    let sectionSum = 0;
                    if (section.items && Array.isArray(section.items)) {
                        section.items.forEach(item => {
                            const qty = parseFloat(item.quantity) || 0;
                            const rate = parseFloat(item.rate) || 0;
                            const mult = parseFloat(item.multiplier) || 1;
                            item.total = qty * rate * mult;
                            sectionSum += item.total;
                            actualTotal += parseFloat(item.actual) || 0;
                        });
                    }
                    section.total = sectionSum;
                    subtotal += sectionSum;
                });
            } else {
                // Default fallback to project.total_budget if no categories/sections
                subtotal = parseFloat(project.total_budget || project.budget || 0);
            }

            // 2. Calculate Executive Overheads
            const contingencyPercent = parseFloat(project.contingencyPercentage) || 0;
            const taxPercent = parseFloat(project.salesTaxPercentage) || 0;
            const discountPercent = parseFloat(project.discountPercentage) || 0;

            const contingency = subtotal * (contingencyPercent / 100);
            const tax = subtotal * (taxPercent / 100);
            const preDiscount = subtotal + contingency + tax;
            const discount = preDiscount * (discountPercent / 100);
            const grandTotal = preDiscount - discount;

            // 3. Update Project Object (optional, but keeps state in sync)
            project.subtotal = subtotal;
            project.grandTotal = grandTotal;
            project.actualTotal = actualTotal;
            if (!project.total_budget) project.total_budget = grandTotal;

            return {
                subtotal,
                contingency,
                tax,
                discount,
                grandTotal,
                actualTotal
            };
        }
    };

    console.log('[mBT] Totalizer Engine initialized ✓');
})();
