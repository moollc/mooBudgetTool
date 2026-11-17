/* ========= v1.0 AI Context Analysis Service v2.0 ========= */
(function () {
    'use strict';

    /* --- 1. PROJECT CONTEXT --- */

    /* Map Budget Editor doc.sections into a compact AI-friendly tree.
       Keeps allocations untouched: analyzeBudgetRisks/buildTimeline expect
       shell execution records ({amount, category, description, createdAt}),
       not line-item rows. */
    function extractBudgetSections(doc) {
        var out = [];
        var sections = doc && doc.sections;
        if (!sections || typeof sections !== 'object') return out;

        var names = Object.keys(sections);
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            var sec = sections[name];
            if (!sec) continue;
            var rawItems = sec.items || [];
            var items = [];
            for (var j = 0; j < rawItems.length; j++) {
                var it = rawItems[j];
                if (!it) continue;
                var desc = (it.description != null ? String(it.description) : '').trim();
                var qty = parseFloat(it.quantity);
                if (isNaN(qty)) qty = 0;
                var rate = parseFloat(it.rate != null ? it.rate : it.baseRate);
                if (isNaN(rate)) rate = 0;
                var total = parseFloat(it.total);
                if (isNaN(total)) total = 0;
                /* Skip empty placeholder rows */
                if (!desc && total === 0 && qty === 0 && rate === 0) continue;
                items.push({
                    description: desc || 'Untitled item',
                    quantity: qty,
                    unit: it.unit || '',
                    rate: rate,
                    total: total
                });
            }
            var secTotal = parseFloat(sec.total);
            if (isNaN(secTotal)) {
                secTotal = 0;
                for (var k = 0; k < items.length; k++) secTotal += items[k].total;
            }
            if (!items.length && secTotal === 0) continue;
            out.push({ name: name, total: secTotal, items: items });
        }
        return out;
    }

    /* Merge Budget Editor doc fields into a context object (localforage path + budget-sync). */
    function enrichContextFromBudgetDoc(context, doc) {
        if (!context) context = {};
        if (!doc) return context;

        context._budgetDoc = doc;
        if (!context.projectName) {
            context.projectName = doc.projectName || doc.name || 'Untitled';
        }
        /* Prefer Budget Editor grandTotal when present; it is the persisted real total */
        var gt = parseFloat(doc.grandTotal);
        var bl = parseFloat(doc.budgetLimit);
        if (!isNaN(gt) && gt > 0) {
            context.budget = gt;
        } else if (!context.budget && !isNaN(bl) && bl > 0) {
            context.budget = bl;
        }
        context.fundingSources = doc.fundingSources || context.fundingSources || [];
        if (doc.contingencyPercentage != null && doc.contingencyPercentage !== '') {
            context.contingencyPercentage = parseFloat(doc.contingencyPercentage);
        }
        if (doc.discountPercentage != null && doc.discountPercentage !== '') {
            context.discountPercentage = parseFloat(doc.discountPercentage);
        }
        if (doc.salesTaxPercentage != null && doc.salesTaxPercentage !== '') {
            context.salesTaxPercentage = parseFloat(doc.salesTaxPercentage);
        }
        context.sections = extractBudgetSections(doc);
        return context;
    }

    function getCurrentProjectContext() {
        var context = {
            projectId: null,
            projectName: null,
            budget: 0,
            stages: [],
            allocations: [],
            sections: [],
            risks: [],
            timeline: { entries: [], total: 0 },
            schedule: null,
            fundingSources: [],
            contingencyPercentage: null,
            discountPercentage: null,
            salesTaxPercentage: null
        };

        /* --- Primary path: Shell storage (IndexedDB via mBT.storage) --- */
        var shellPromise = (function () {
            try {
                var s = window.mBT && window.mBT.storage;
                if (!s || typeof s.getAllProjects !== 'function') return Promise.resolve(null);
                return s.getAllProjects().then(function (projects) {
                    if (!projects || !projects.length) return null;
                    var active = projects[0];
                    context.projectId   = active.id;
                    context.projectName = active.name || active.projectName || active.title || 'Untitled';
                    context.budget      = parseFloat(active.budget || 0);
                    if (!context.projectId) return null;
                    return Promise.all([
                        s.getStagesByProject(context.projectId).catch(function () { return []; }),
                        s.getExecutionsByProject(context.projectId).catch(function () { return []; })
                    ]).then(function (results) {
                        context.stages      = results[0] || [];
                        context.allocations = results[1] || [];
                        return context;
                    });
                }).catch(function () { return null; });
            } catch (e) { return Promise.resolve(null); }
        }());

        return shellPromise.then(function (shellCtx) {
            /* --- Fallback path: read active budget from Budget Editor localforage --- */
            var lf = window.localforage;
            if (!lf) {
                /* Neither source available — return empty context, no error */
                context.risks    = analyzeBudgetRisks(context.allocations, context.budget);
                context.timeline = buildTimeline(context.allocations);
                return context;
            }

            /* Find the most-recently-modified prodBudget_v5_* key */
            return lf.keys().then(function (keys) {
                var budgetKeys = (keys || []).filter(function (k) { return k.indexOf('prodBudget_v5_') === 0; });
                if (!budgetKeys.length) return null;
                /* Read all, pick the one with most recent updatedAt */
                var reads = budgetKeys.map(function (k) { return lf.getItem(k).catch(function () { return null; }); });
                return Promise.all(reads).then(function (docs) {
                    var best = null;
                    for (var i = 0; i < docs.length; i++) {
                        if (!docs[i]) continue;
                        if (!best || (docs[i].updatedAt || '') > (best.updatedAt || '')) best = docs[i];
                    }
                    return best;
                });
            }).then(function (doc) {
                if (doc) {
                    enrichContextFromBudgetDoc(context, doc);
                }
                context.risks    = analyzeBudgetRisks(context.allocations, context.budget);
                context.timeline = buildTimeline(context.allocations);
                if (doc) context.schedule = buildScheduleSummary(doc);
                return context;
            }).catch(function () {
                context.risks    = analyzeBudgetRisks(context.allocations, context.budget);
                context.timeline = buildTimeline(context.allocations);
                return context;
            });
        });
    }

    /* --- 2. BUDGET PATTERN ANALYSIS --- */

    function analyzeBudgetPatterns() {
        var s = window.mBT && window.mBT.storage;
        if (!s || typeof s.getAllProjects !== 'function') {
            return Promise.resolve({ categoryDistribution: {}, outliers: [], recommendations: [] });
        }
        return s.getAllProjects().then(function (projects) {
            projects = projects || [];
            var execReads = projects.map(function (p) {
                return s.getExecutionsByProject(p.id).catch(function () { return []; });
            });
            return Promise.all(execReads);
        }).then(function (execGroups) {
            var allocations = [];
            for (var i = 0; i < execGroups.length; i++) {
                allocations = allocations.concat(execGroups[i] || []);
            }

            if (allocations.length === 0) {
                return { categoryDistribution: {}, outliers: [], recommendations: [] };
            }

            var categoryTotals = {};
            var totalSpent = 0;
            allocations.forEach(function (alloc) {
                var cat = alloc.category || 'misc';
                var amt = parseFloat(alloc.amount || 0);
                categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
                totalSpent += amt;
            });

            var categoryDistribution = {};
            Object.keys(categoryTotals).forEach(function (cat) {
                categoryDistribution[cat] = {
                    amount: categoryTotals[cat],
                    percentage: totalSpent > 0 ? ((categoryTotals[cat] / totalSpent) * 100).toFixed(1) : '0.0'
                };
            });

            var values = Object.keys(categoryTotals).map(function (k) { return categoryTotals[k]; });
            var mean = values.reduce(function (a, b) { return a + b; }, 0) / (values.length || 1);
            var variance = values.reduce(function (sum, v) { return sum + Math.pow(v - mean, 2); }, 0) / (values.length || 1);
            var stdDev = Math.sqrt(variance);
            var outliers = Object.keys(categoryTotals).filter(function (c) { return Math.abs(categoryTotals[c] - mean) > 3 * stdDev; });

            var recommendations = [];
            Object.keys(categoryDistribution).forEach(function (cat) {
                if (parseFloat(categoryDistribution[cat].percentage) > 30) {
                    recommendations.push({ category: cat, recommendation: cat + ' is ' + categoryDistribution[cat].percentage + '% of budget — review allocation' });
                }
            });

            return { categoryDistribution: categoryDistribution, outliers: outliers, recommendations: recommendations };
        });
    }

    /* --- 3. RISK ASSESSMENT --- */

    function analyzeBudgetRisks(allocations, budget) {
        var risks = [];
        if (!allocations || allocations.length === 0) return risks;

        var totalAllocated = allocations.reduce(function (sum, a) { return sum + (parseFloat(a.amount || 0) || 0); }, 0);

        if (budget > 0 && totalAllocated > budget) {
            risks.push({
                type: 'over_budget',
                severity: 'critical',
                message: 'Budget exceeded by ' + (totalAllocated - budget).toFixed(2)
            });
        }

        var categoriesMap = {};
        allocations.forEach(function (a) { if (a.category) categoriesMap[a.category] = true; });

        ['labor', 'equipment', 'location', 'transport', 'insurance'].forEach(function (cat) {
            if (!categoriesMap[cat]) {
                risks.push({ type: 'missing_category', severity: 'warning', message: 'No allocation for: ' + cat, category: cat });
            }
        });

        return risks;
    }

    /* --- 4. TIMELINE --- */

    function buildTimeline(allocations) {
        var entries = (allocations || []).map(function (a) {
            return {
                date: a.createdAt ? a.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
                category: a.category || 'misc',
                amount: parseFloat(a.amount || 0),
                description: a.description || ''
            };
        }).sort(function (a, b) { return a.date > b.date ? 1 : -1; });

        return {
            entries: entries,
            total: entries.reduce(function (s, e) { return s + e.amount; }, 0)
        };
    }

    /* --- 4b. SCHEDULE SUMMARY (Phase 50C.6) --- */

    function buildScheduleSummary(budget) {
        if (!budget || !budget.startDate) {
            return 'Schedule: Not defined';
        }

        var parts = [];

        /* Timeline dates */
        var startDate = new Date(budget.startDate);
        var endDate = budget.deliveryDate ? new Date(budget.deliveryDate) : null;
        var fmtDate = function(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };

        var dateRange = 'Schedule: ' + fmtDate(startDate);
        if (endDate) dateRange += ' – ' + fmtDate(endDate);
        parts.push(dateRange);

        /* Work week type */
        var workWeek = (budget.settings && budget.settings.workWeek) || 5;
        var workWeekLabel = workWeek === 5 ? '5-day (Mon-Fri)' : (workWeek === 6 ? '6-day (Mon-Sat)' : '7-day (Full Week)');
        parts.push('Work Week: ' + workWeekLabel);

        /* Stages summary */
        if (budget.targetLock && budget.targetLock.stages) {
            var stageNames = { dev: 'Development', pre: 'Pre-Production', prod: 'Production', post: 'Post-Production', dist: 'Distribution' };
            var stages = [];
            ['dev', 'pre', 'prod', 'post', 'dist'].forEach(function(k) {
                var stageInfo = budget.targetLock.stages[k];
                if (stageInfo && stageInfo.days) {
                    var days = parseFloat(stageInfo.days);
                    stages.push(stageNames[k] + ' (' + days + ' days)');
                }
            });
            if (stages.length > 0) {
                parts.push('Stages: ' + stages.join(', '));
            }
        }

        /* Blackout days */
        var blackouts = budget.blackoutDays || [];
        if (blackouts.length > 0) {
            parts.push('Blackout Days: ' + blackouts.length);
        }

        /* Milestones */
        var milestones = budget.calendarNotes || [];
        if (milestones.length > 0) {
            var mnames = milestones.map(function(m) { return m.title || 'Unnamed'; }).join(', ');
            parts.push('Milestones: ' + mnames);
        }

        return parts.join('. ');
    }

    /* --- 5. INSIGHTS --- */

    function generateInsights(context) {
        var insights = [];
        if (context.budget > 0 && context.allocations.length > 0) {
            var spent = context.allocations.reduce(function (s, a) { return s + (parseFloat(a.amount || 0) || 0); }, 0);
            var util = (spent / context.budget) * 100;
            if (util > 80) insights.push({ type: 'alert', message: 'Budget is ' + util.toFixed(1) + '% utilized.' });
            else if (util < 20) insights.push({ type: 'info', message: 'Budget is only ' + util.toFixed(1) + '% utilized.' });
        }
        return insights;
    }

    /* --- 6. INDUSTRY BENCHMARKS --- */

    function getIndustryBenchmarks() {
        return {
            production: {
                labor:     { min: 40,  max: 150,  avg: 85 },
                equipment: { min: 100, max: 500,  avg: 300 },
                location:  { min: 500, max: 2000, avg: 1000 },
                transport: { min: 50,  max: 300,  avg: 150 },
                insurance: { min: 200, max: 1000, avg: 500 }
            }
        };
    }

    /* --- 7. GLOBAL EXPOSURE --- */

    window.mBTAIContext = {
        getCurrentProjectContext: getCurrentProjectContext,
        extractBudgetSections:    extractBudgetSections,
        enrichContextFromBudgetDoc: enrichContextFromBudgetDoc,
        analyzeBudgetPatterns:    analyzeBudgetPatterns,
        analyzeBudgetRisks:       analyzeBudgetRisks,
        buildTimeline:            buildTimeline,
        buildScheduleSummary:     buildScheduleSummary,
        generateInsights:         generateInsights,
        getIndustryBenchmarks:    getIndustryBenchmarks
    };

})();
