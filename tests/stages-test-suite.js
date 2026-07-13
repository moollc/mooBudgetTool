/**
 * mBT Stages Test Suite
 * @description Unit tests for the Stages tool's pure calc functions
 * (calculateMetrics, calculateTimeline, calculateCashflow), reached via
 * window.mBTStagesCalc exposed by src/tools/stages/index.html.
 * Loads the Stages tool in a hidden iframe since these functions are
 * closed inside that file's IIFE, not bundled into the core scripts
 * this runner loads directly (unlike mbtle.js / totalizer.js).
 * Run via: open mBT/tests/test-runner.html
 */

(function () {
    'use strict';

    window.mBT = window.mBT || {};
    window.mBT.tests = window.mBT.tests || {};
    window.mBT.tests.stages = window.mBT.tests.stages || {};

    window.mBT.tests.stages.results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    window.mBT.tests.stages.result = function (name, passed, message) {
        var status = passed ? '✅ PASS' : '❌ FAIL';
        var result = {
            name: name,
            passed: passed,
            message: message,
            timestamp: new Date().toISOString()
        };
        window.mBT.tests.stages.results.tests.push(result);
        if (passed) {
            window.mBT.tests.stages.results.passed++;
        } else {
            window.mBT.tests.stages.results.failed++;
        }
        console.log('[mBT Stages Test]', status, '-', name);
        return result;
    };

    /* Loads src/tools/stages/index.html in a hidden iframe and resolves
       with its window.mBTStagesCalc export, or null if unavailable. */
    function loadCalc() {
        return new Promise(function (resolve) {
            var frame = document.createElement('iframe');
            frame.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:100px;height:100px;';
            var settled = false;
            var timeout = setTimeout(function () {
                if (settled) return;
                settled = true;
                resolve(null);
            }, 5000);
            frame.onload = function () {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                var calc = (frame.contentWindow && frame.contentWindow.mBTStagesCalc) || null;
                resolve(calc);
            };
            frame.onerror = function () {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                resolve(null);
            };
            /* Cache-bust: the Stages tool's own service worker aggressively caches
               index.html, which can serve a stale mBTStagesCalc export otherwise. */
            frame.src = '../src/tools/stages/index.html?cb=' + Date.now();
            document.body.appendChild(frame);
        });
    }

    /* Minimal fixture: a 2-stage project (dev + prod) with one line item
       assigned to each stage, enough to exercise metrics/timeline/cashflow
       without needing a real saved project. */
    function makeFixture() {
        return {
            startDate: '2026-01-01',
            deliveryDate: '2026-02-01',
            grandTotal: 3000,
            actualsMode: false,
            settings: { workWeek: 7 },
            targetLock: {
                totalCap: 5000,
                stages: {
                    dev:  { days: 7, ratio: 50, locked: false, label: 'DEV' },
                    pre:  { days: 0, ratio: 0,  locked: false, label: 'PRE' },
                    prod: { days: 7, ratio: 50, locked: false, label: 'PROD' },
                    post: { days: 0, ratio: 0,  locked: false, label: 'POST' },
                    dist: { days: 0, ratio: 0,  locked: false, label: 'DIST' }
                }
            },
            sections: {
                s1: {
                    items: [
                        {
                            stageData: { dev: { days: 7, rate: 1500, quantity: 1 } },
                            actual: 0
                        },
                        {
                            stageData: { prod: { days: 7, rate: 1500, quantity: 1 } },
                            actual: 0
                        }
                    ]
                }
            }
        };
    }

    // =========================================
    // TEST: calculateMetrics returns expected shape
    // =========================================
    window.mBT.tests.stages.metricsShape = function (calc) {
        try {
            if (!calc) return window.mBT.tests.stages.result('metricsShape', false, 'Skipped — mBTStagesCalc unavailable (Stages iframe failed to load)');
            var m = calc.calculateMetrics(makeFixture());
            var hasKeys = m && m.stageTotals && m.stageActuals
                && ['dev', 'pre', 'prod', 'post', 'dist'].every(function (k) { return k in m.stageTotals; });
            var passed = !!hasKeys && typeof m.grandTotal === 'number' && typeof m.totalCap === 'number';
            return window.mBT.tests.stages.result('metricsShape', passed, passed ? 'Metrics object has expected shape' : 'Missing expected fields: ' + JSON.stringify(m));
        } catch (e) {
            return window.mBT.tests.stages.result('metricsShape', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: calculateTimeline — dev starts at project start date
    // =========================================
    window.mBT.tests.stages.timelineDevStart = function (calc) {
        try {
            if (!calc) return window.mBT.tests.stages.result('timelineDevStart', false, 'Skipped — mBTStagesCalc unavailable');
            var tl = calc.calculateTimeline(makeFixture());
            /* calculateTimeline applies its own timezone-offset correction so the
               LOCAL calendar date matches the plain "2026-01-01" input string —
               assert on local getters, not UTC ones, to match that behavior.
               Use Object.prototype.toString instead of instanceof Date: the value
               crosses an iframe boundary, so it's a Date from a different realm and
               "instanceof Date" (checked against this document's Date) always fails. */
            var isDate = tl.dev && Object.prototype.toString.call(tl.dev.start) === '[object Date]';
            var passed = isDate
                && tl.dev.start.getFullYear() === 2026 && tl.dev.start.getMonth() === 0 && tl.dev.start.getDate() === 1;
            return window.mBT.tests.stages.result('timelineDevStart', passed, passed ? 'Dev stage starts on project start date' : 'Dev start mismatch: ' + JSON.stringify(tl.dev));
        } catch (e) {
            return window.mBT.tests.stages.result('timelineDevStart', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: calculateTimeline — waterfall stages don't overlap when no offsetDays set
    // =========================================
    window.mBT.tests.stages.timelineWaterfallOrder = function (calc) {
        try {
            if (!calc) return window.mBT.tests.stages.result('timelineWaterfallOrder', false, 'Skipped — mBTStagesCalc unavailable');
            var tl = calc.calculateTimeline(makeFixture());
            var passed = tl.prod && tl.dev && tl.prod.start.getTime() >= tl.dev.end.getTime();
            return window.mBT.tests.stages.result('timelineWaterfallOrder', passed, passed ? 'Prod starts at or after dev ends' : 'Prod overlaps dev: ' + JSON.stringify({ devEnd: tl.dev.end, prodStart: tl.prod.start }));
        } catch (e) {
            return window.mBT.tests.stages.result('timelineWaterfallOrder', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: calculateCashflow — week totals sum to the stage totals sum
    //   (guards the "remainder assigned to last day" logic against drift)
    // =========================================
    window.mBT.tests.stages.cashflowWeekSumsMatchTotal = function (calc) {
        try {
            if (!calc) return window.mBT.tests.stages.result('cashflowWeekSumsMatchTotal', false, 'Skipped — mBTStagesCalc unavailable');
            var cf = calc.calculateCashflow(makeFixture());
            var summedFromWeeks = cf.weeks.reduce(function (sum, w) { return sum + w.total; }, 0);
            var passed = Math.abs(summedFromWeeks - cf.stageTotalsSum) < 0.01;
            return window.mBT.tests.stages.result('cashflowWeekSumsMatchTotal', passed, passed ? 'Week totals sum to stageTotalsSum (no drift)' : 'Drift detected: summedFromWeeks=' + summedFromWeeks + ' stageTotalsSum=' + cf.stageTotalsSum);
        } catch (e) {
            return window.mBT.tests.stages.result('cashflowWeekSumsMatchTotal', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: calculateCashflow — a project with zero stage days returns empty weeks, not a crash
    // =========================================
    window.mBT.tests.stages.cashflowHandlesNoSchedule = function (calc) {
        try {
            if (!calc) return window.mBT.tests.stages.result('cashflowHandlesNoSchedule', false, 'Skipped — mBTStagesCalc unavailable');
            var fixture = makeFixture();
            fixture.targetLock.stages.dev.days = 0;
            fixture.targetLock.stages.prod.days = 0;
            fixture.sections.s1.items = [];
            var cf = calc.calculateCashflow(fixture);
            var passed = Array.isArray(cf.weeks) && cf.weeks.length === 0 && cf.grandTotal === 0;
            return window.mBT.tests.stages.result('cashflowHandlesNoSchedule', passed, passed ? 'Empty schedule returns zero weeks without throwing' : 'Unexpected result: ' + JSON.stringify(cf));
        } catch (e) {
            return window.mBT.tests.stages.result('cashflowHandlesNoSchedule', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // RUN ALL TESTS
    // =========================================
    window.mBT.tests.stages.runAll = function () {
        console.log('[mBT Stages Test] Running all tests..\n');
        window.mBT.tests.stages.results = { passed: 0, failed: 0, tests: [] };

        return loadCalc().then(function (calc) {
            var tests = [
                window.mBT.tests.stages.metricsShape,
                window.mBT.tests.stages.timelineDevStart,
                window.mBT.tests.stages.timelineWaterfallOrder,
                window.mBT.tests.stages.cashflowWeekSumsMatchTotal,
                window.mBT.tests.stages.cashflowHandlesNoSchedule
            ];

            for (var i = 0; i < tests.length; i++) {
                tests[i](calc);
            }

            console.log('\n[mBT Stages Test] Results:');
            console.log('  Passed:', window.mBT.tests.stages.results.passed);
            console.log('  Failed:', window.mBT.tests.stages.results.failed);
            console.log('  Total:', window.mBT.tests.stages.results.passed + window.mBT.tests.stages.results.failed);

            return window.mBT.tests.stages.results;
        });
    };

})();
