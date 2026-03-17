/* ========= v1.0 AI Pattern Recognition Engine v2.0 ========= */
(function () {
    'use strict';

    /* --- 1. SPENDING PATTERNS --- */

    function detectSpendingPatterns(executions) {
        if (!executions || executions.length < 3) {
            return { patterns: [], anomalies: [], trend: null };
        }

        var dailyData = {};
        executions.forEach(function (e) {
            var date = e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : 'unknown';
            dailyData[date] = (dailyData[date] || 0) + parseFloat(e.amount || 0);
        });

        var sortedDates = Object.keys(dailyData).sort();
        var sortedData = sortedDates.map(function (date) { return { date: date, amount: dailyData[date] }; });

        var weeklyPattern = detectWeeklyPattern(sortedData);
        var anomalies = detectAnomalies(sortedData);
        var trend = calculateTrend(sortedData);

        return {
            patterns: weeklyPattern ? [weeklyPattern] : [],
            anomalies: anomalies,
            trend: trend
        };
    }

    /* --- 2. WEEKLY PATTERN --- */

    function detectWeeklyPattern(data) {
        if (data.length < 7) return null;

        var daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var weeklyTotals = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };

        data.forEach(function (row) {
            var day = daysOfWeek[new Date(row.date).getDay()];
            weeklyTotals[day] += row.amount;
        });

        var total = Object.values(weeklyTotals).reduce(function (a, b) { return a + b; }, 0);
        var peak = Object.keys(weeklyTotals).reduce(function (a, b) { return weeklyTotals[a] > weeklyTotals[b] ? a : b; });

        return { weeklyTotals: weeklyTotals, total: total, description: 'Peak spend day: ' + peak };
    }

    /* --- 3. ANOMALY DETECTION (rolling 7-day window, >2 std dev) --- */

    function detectAnomalies(data) {
        var anomalies = [];
        var windowSize = 7;

        for (var i = windowSize; i < data.length; i++) {
            var window = data.slice(i - windowSize, i);
            var sum = window.reduce(function (s, d) { return s + d.amount; }, 0);
            var mean = sum / windowSize;
            var variance = window.reduce(function (s, d) { return s + Math.pow(d.amount - mean, 2); }, 0) / windowSize;
            var stdDev = Math.sqrt(variance);
            var current = data[i].amount;
            var deviation = Math.abs(current - mean);

            if (stdDev > 0 && deviation > 2 * stdDev) {
                anomalies.push({
                    date:      data[i].date,
                    amount:    current,
                    expected:  mean,
                    deviation: deviation,
                    type:      current > mean ? 'spike' : 'dip'
                });
            }
        }

        return anomalies;
    }

    /* --- 4. TREND (linear regression) --- */

    function calculateTrend(data) {
        if (data.length < 2) return { direction: 'insufficient_data', slope: 0 };

        var n = data.length;
        var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        data.forEach(function (d, i) {
            sumX  += (i + 1);
            sumY  += d.amount;
            sumXY += (i + 1) * d.amount;
            sumX2 += (i + 1) * (i + 1);
        });

        var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

        return {
            direction:          slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
            slope:              slope,
            sevenDayProjection: (slope * 7).toFixed(2)
        };
    }

    /* --- 5. OPTIMIZATION OPPORTUNITIES --- */

    function findOptimizationOpportunities(executions, benchmarks) {
        var opportunities = [];
        var categories = {};

        executions.forEach(function (e) {
            var cat = e.category || 'misc';
            if (!categories[cat]) categories[cat] = { total: 0, count: 0 };
            categories[cat].total += parseFloat(e.amount || 0);
            categories[cat].count++;
        });

        var prodBenchmarks = (benchmarks && benchmarks.production) ? benchmarks.production : {};
        Object.keys(categories).forEach(function (cat) {
            var bench = prodBenchmarks[cat.toLowerCase()];
            if (!bench) return;
            var avg = categories[cat].total / (categories[cat].count || 1);
            if (avg > bench.max) {
                opportunities.push({
                    category:       cat,
                    current:        avg,
                    benchmark:      bench.avg,
                    savings:        (avg - bench.avg).toFixed(2),
                    recommendation: cat + ' cost is above benchmark max ($' + bench.max + ')'
                });
            }
        });

        return opportunities;
    }

    /* --- 6. GLOBAL EXPOSURE --- */

    window.mBTPatterns = {
        detectSpendingPatterns:          detectSpendingPatterns,
        detectWeeklyPattern:             detectWeeklyPattern,
        detectAnomalies:                 detectAnomalies,
        calculateTrend:                  calculateTrend,
        findOptimizationOpportunities:   findOptimizationOpportunities
    };

    console.log('[mBT] AI pattern recognition initialized ✓');
})();
