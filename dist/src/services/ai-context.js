/* ========= v1.0 AI Context Analysis Service v2.0 ========= */
(function () {
    'use strict';

    /* --- 1. PROJECT CONTEXT --- */

    async function getCurrentProjectContext() {
        var s = window.mBT.storage;
        var context = { projectId: null, projectName: null, budget: 0, stages: [], allocations: [], risks: [], timeline: null };

        var projects = await s.getAllProjects();
        if (projects.length > 0) {
            var active = projects[0];
            context.projectId   = active.id;
            context.projectName = active.name || active.projectName || active.title || 'Untitled';
            context.budget      = parseFloat(active.budget || 0);
        }

        if (context.projectId) {
            context.stages      = await s.getStagesByProject(context.projectId);
            context.allocations = await s.getExecutionsByProject(context.projectId);
        }

        context.risks    = analyzeBudgetRisks(context.allocations, context.budget);
        context.timeline = buildTimeline(context.allocations);

        return context;
    }

    /* --- 2. BUDGET PATTERN ANALYSIS --- */

    async function analyzeBudgetPatterns() {
        var s = window.mBT.storage;
        var projects = await s.getAllProjects();
        var allocations = [];
        for (var i = 0; i < projects.length; i++) {
            var execs = await s.getExecutionsByProject(projects[i].id);
            allocations = allocations.concat(execs);
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

        var values = Object.values(categoryTotals);
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

        var categories = new Set(allocations.map(function (a) { return a.category; }).filter(Boolean));
        ['labor', 'equipment', 'location', 'transport', 'insurance'].forEach(function (cat) {
            if (!categories.has(cat)) {
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
        analyzeBudgetPatterns:    analyzeBudgetPatterns,
        analyzeBudgetRisks:       analyzeBudgetRisks,
        buildTimeline:            buildTimeline,
        generateInsights:         generateInsights,
        getIndustryBenchmarks:    getIndustryBenchmarks
    };

    console.log('[mBT] AI context service initialized ✓');
})();
