/* ========= v1.0 AI Report Generator v2.0 ========= */
(function () {
    'use strict';

    /* --- 1. OVERVIEW REPORT --- */

    function generateOverviewReport(context) {
        var allocations = context.allocations || [];
        var totalSpent = allocations.reduce(function (s, a) { return s + (parseFloat(a.amount || 0) || 0); }, 0);
        var budget = context.budget || 0;
        var remaining = budget - totalSpent;
        var utilization = budget > 0 ? (totalSpent / budget) * 100 : 0;

        return {
            type:    'overview',
            title:   'Budget Overview',
            budget:  budget,
            spent:   totalSpent,
            remaining: remaining,
            utilization: utilization,
            status:  remaining < 0 ? 'critical' : remaining < budget * 0.2 ? 'warning' : 'ok',
            insights: utilization > 90 ? 'Budget critically high.' :
                      utilization > 80 ? 'Budget approaching limit.' :
                      utilization < 20 ? 'Budget underutilized.' : 'Budget utilization healthy.'
        };
    }

    /* --- 2. FORECAST REPORT --- */

    function generateForecastReport(allocations, trend) {
        var totalSpent = allocations.reduce(function (s, a) { return s + (parseFloat(a.amount || 0) || 0); }, 0);

        if (!trend || allocations.length < 5) {
            return { type: 'forecast', title: 'Budget Forecast', current: totalSpent, note: 'Insufficient data for projection (need 5+ records).' };
        }

        var sevenDay = totalSpent + (trend.slope * 7);

        return {
            type:             'forecast',
            title:            'Budget Forecast',
            current:          totalSpent,
            sevenDayProjection: sevenDay.toFixed(2),
            trend:            trend.direction,
            note:             trend.direction === 'increasing' ? 'Spending trend is increasing — monitor closely.' :
                              trend.direction === 'decreasing' ? 'Spending trend is decreasing.' :
                              'Spending is stable.'
        };
    }

    /* --- 3. RISK REPORT --- */

    function generateRiskReport(context) {
        var risks = context.risks || [];
        var critical = risks.filter(function (r) { return r.severity === 'critical'; }).length;
        var warning  = risks.filter(function (r) { return r.severity === 'warning'; }).length;
        var level    = critical > 0 ? 'critical' : warning > 2 ? 'high' : warning > 0 ? 'medium' : 'low';

        return {
            type:       'risk',
            title:      'Risk Assessment',
            risks:      risks,
            riskLevel:  level,
            recommendations: risks.map(function (r) {
                if (r.type === 'over_budget')       return 'Over budget by ' + r.message.split('by ')[1] + '. Review scope or funding.';
                if (r.type === 'missing_category')  return 'Allocate budget for: ' + r.category;
                if (r.type === 'high_variance')     return r.category + ' has high cost variance — review vendor pricing.';
                return r.message;
            })
        };
    }

    /* --- 4. OPTIMIZATION REPORT --- */

    function generateOptimizationReport(allocations, opportunities) {
        var categoryTotals = {};
        var totalSpent = allocations.reduce(function (s, a) { return s + (parseFloat(a.amount || 0) || 0); }, 0);
        allocations.forEach(function (a) {
            var cat = a.category || 'misc';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(a.amount || 0);
        });

        var recommendations = [];
        Object.keys(categoryTotals).forEach(function (cat) {
            var pct = totalSpent > 0 ? (categoryTotals[cat] / totalSpent) * 100 : 0;
            if (pct > 30) recommendations.push({ category: cat, percentage: pct.toFixed(1), suggestion: 'High-usage category — review for savings' });
        });

        return {
            type:            'optimization',
            title:           'Optimization Opportunities',
            recommendations: recommendations,
            opportunities:   opportunities || []
        };
    }

    /* --- 5. EXECUTIVE SUMMARY --- */

    function generateExecutiveSummary(context, patterns) {
        var overview = generateOverviewReport(context);

        return {
            type:   'executive_summary',
            title:  'Executive Summary',
            status: overview.status,
            highlights: [
                overview.status.toUpperCase() + ' budget status',
                (context.risks || []).length + ' risk factor(s) identified',
                patterns && patterns.trend ? 'Spend trend: ' + patterns.trend.direction : 'No pattern data'
            ],
            keyMetrics: [
                { label: 'Budget',    value: '$' + (overview.budget).toLocaleString() },
                { label: 'Spent',     value: '$' + (overview.spent).toLocaleString() },
                { label: 'Remaining', value: '$' + Math.abs(overview.remaining).toLocaleString() }
            ],
            actionItems: overview.insights
        };
    }

    /* --- 6. GLOBAL EXPOSURE --- */

    window.mBTReports = {
        generateOverviewReport:      generateOverviewReport,
        generateForecastReport:      generateForecastReport,
        generateRiskReport:          generateRiskReport,
        generateOptimizationReport:  generateOptimizationReport,
        generateExecutiveSummary:    generateExecutiveSummary
    };

    console.log('[mBT] AI reports service initialized ✓');
})();
