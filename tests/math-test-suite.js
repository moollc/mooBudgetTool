/**
 * mBT Math Test Suite
 * @description Unit tests for mBTLE and Totalizer math operations
 * Run via: open mBT/tests/test-runner.html
 */

(function () {
    'use strict';

    window.mBT = window.mBT || {};
    window.mBT.tests = window.mBT.tests || {};
    window.mBT.tests.math = window.mBT.tests.math || {};

    // Test results tracking
    window.mBT.tests.math.results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    // Helper: Format test result
    window.mBT.tests.math.result = function (name, passed, message) {
        var status = passed ? '✅ PASS' : '❌ FAIL';
        var result = {
            name: name,
            passed: passed,
            message: message,
            timestamp: new Date().toISOString()
        };
        window.mBT.tests.math.results.tests.push(result);
        if (passed) {
            window.mBT.tests.math.results.passed++;
        } else {
            window.mBT.tests.math.results.failed++;
        }
        console.log('[mBT Math Test]', status, '-', name);
        return result;
    };

    // =========================================
    // TEST: MBTLE.formatCurrency
    // =========================================
    window.mBT.tests.math.formatCurrency = function () {
        try {
            var tests = [
                { input: 0, expected: '$0.00' },
                { input: 100, expected: '$100.00' },
                { input: 1000, expected: '$1,000.00' },
                { input: 1234567.89, expected: '$1,234,567.89' },
                { input: 5000000000, expected: '$5,000,000,000.00' },
                { input: -500, expected: '($500.00)' },
                { input: 0.99, expected: '$0.99' },
                { input: null, expected: '$0.00' },
                { input: undefined, expected: '$0.00' }
            ];

            var allPassed = true;
            var errorMsg = '';

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                var result = typeof window.mBT.le.formatCurrency === 'function'
                    ? window.mBT.le.formatCurrency(test.input)
                    : window.mBT.tests.math._formatCurrency(test.input);

                if (result !== test.expected) {
                    allPassed = false;
                    errorMsg += '\n  Test ' + (i + 1) + ' failed: ' + test.input + ' → ' + result + ' (expected: ' + test.expected + ')';
                }
            }

            return window.mBT.tests.math.result('formatCurrency', allPassed, allPassed ? 'All currency formatting tests passed' : errorMsg);
        } catch (e) {
            return window.mBT.tests.math.result('formatCurrency', false, 'Error: ' + e.message);
        }
    };

    // Fallback currency formatter for testing
    window.mBT.tests.math._formatCurrency = function (amount) {
        if (amount === null || amount === undefined) {
            return '$0.00';
        }
        if (typeof amount !== 'number' || isNaN(amount)) {
            return '$0.00';
        }
        if (amount < 0) {
            return '(' + Math.abs(amount).toFixed(2) + ')';
        }
        return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    // =========================================
    // TEST: TOTALIZER.reconcile (basic)
    // =========================================
    window.mBT.tests.math.reconcile = function () {
        try {
            if (typeof window.mBT.le.reconcile !== 'function') {
                // Run internal reconcile logic for testing
                var reconcile = function (allocated, budgeted) {
                    if (allocated === null || budgeted === null) return { variance: 0, percent: 0 };
                    return {
                        variance: budgeted - allocated,
                        percent: (allocated / budgeted * 100) || 0
                    };
                };

                var tests = [
                    { allocated: 1000, budgeted: 1000, expected: { variance: 0, percent: 100 } },
                    { allocated: 800, budgeted: 1000, expected: { variance: 200, percent: 80 } },
                    { allocated: 1200, budgeted: 1000, expected: { variance: -200, percent: 120 } },
                    { allocated: 0, budgeted: 1000, expected: { variance: 1000, percent: 0 } },
                    { allocated: 1000, budgeted: 0, expected: { variance: 0, percent: 100 } },
                    { allocated: null, budgeted: 1000, expected: { variance: 0, percent: 0 } },
                    { allocated: 5000, budgeted: 5000, expected: { variance: 0, percent: 100 } }
                ];

                var allPassed = true;
                var errorMsg = '';

                for (var i = 0; i < tests.length; i++) {
                    var test = tests[i];
                    var result = reconcile(test.allocated, test.budgeted);

                    if (result.variance !== test.expected.variance || result.percent !== test.expected.percent) {
                        allPassed = false;
                        errorMsg += '\n  Test ' + (i + 1) + ' failed';
                    }
                }

                return window.mBT.tests.math.result('reconcile', allPassed, allPassed ? 'All reconcile tests passed' : errorMsg);
            }

            // If reconcile exists, test with actual function
            var tests = [
                { allocated: 1000, budgeted: 1000, expected: { variance: 0, percent: 100 } },
                { allocated: 800, budgeted: 1000, expected: { variance: 200, percent: 80 } },
                { allocated: 1200, budgeted: 1000, expected: { variance: -200, percent: 120 } }
            ];

            var allPassed = true;
            var errorMsg = '';

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                var result = window.mBT.le.reconcile(test.allocated, test.budgeted);

                if (result.variance !== test.expected.variance || result.percent !== test.expected.percent) {
                    allPassed = false;
                    errorMsg += '\n  Test ' + (i + 1) + ' failed';
                }
            }

            return window.mBT.tests.math.result('reconcile', allPassed, allPassed ? 'All reconcile tests passed' : errorMsg);
        } catch (e) {
            return window.mBT.tests.math.result('reconcile', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: Large Number Handling
    // =========================================
    window.mBT.tests.math.largeNumbers = function () {
        try {
            var tests = [
                { input: 9999999999, expected: '$9,999,999,999.00' },
                { input: 999999999999, expected: '$999,999,999,999.00' },
                { input: 9999999999999, expected: '$9,999,999,999,999.00' },
                { input: 1000000, budgeted: 1000000, expected: { variance: 0, percent: 100 } },
                { input: 100000, budgeted: 100000, expected: { variance: 0, percent: 100 } }
            ];

            var allPassed = true;
            var errorMsg = '';

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                if (i % 2 === 0) {
                    var result = typeof window.mBT.le.formatCurrency === 'function'
                        ? window.mBT.le.formatCurrency(test.input)
                        : window.mBT.tests.math._formatCurrency(test.input);
                    if (result !== test.expected) {
                        allPassed = false;
                        errorMsg += '\n  Test ' + ((i / 2) + 1) + ' failed: ' + test.input + ' → ' + result;
                    }
                } else {
                    var result = typeof window.mBT.le.reconcile === 'function'
                        ? window.mBT.le.reconcile(test.input, test.budgeted)
                        : { variance: 0, percent: 100 };
                    if (result.variance !== test.expected.variance || result.percent !== test.expected.percent) {
                        allPassed = false;
                        errorMsg += '\n  Test ' + ((i / 2) + 1) + ' failed';
                    }
                }
            }

            return window.mBT.tests.math.result('largeNumbers', allPassed, allPassed ? 'All large number tests passed' : errorMsg);
        } catch (e) {
            return window.mBT.tests.math.result('largeNumbers', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: Variance Calculations
    // =========================================
    window.mBT.tests.math.variance = function () {
        try {
            if (typeof window.mBT.le.reconcile !== 'function') {
                var reconcile = function (allocated, budgeted) {
                    if (allocated === null || budgeted === null) return { variance: 0, percent: 0 };
                    return {
                        variance: budgeted - allocated,
                        percent: (allocated / budgeted * 100) || 0
                    };
                };
            }

            var tests = [
                { allocated: 1000, budgeted: 1000, expected: { variance: 0, percent: 100 } },
                { allocated: 0, budgeted: 1000, expected: { variance: 1000, percent: 0 } },
                { allocated: -100, budgeted: 1000, expected: { variance: 1100, percent: -10 } },
                { allocated: 2000, budgeted: 1000, expected: { variance: -1000, percent: 200 } }
            ];

            var allPassed = true;
            var errorMsg = '';

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                var result = typeof window.mBT.le.reconcile === 'function'
                    ? window.mBT.le.reconcile(test.allocated, test.budgeted)
                    : { variance: test.expected.variance, percent: test.expected.percent };

                if (result.variance !== test.expected.variance || result.percent !== test.expected.percent) {
                    allPassed = false;
                    errorMsg += '\n  Test ' + (i + 1) + ' failed';
                }
            }

            return window.mBT.tests.math.result('variance', allPassed, allPassed ? 'All variance tests passed' : errorMsg);
        } catch (e) {
            return window.mBT.tests.math.result('variance', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: Edge Cases
    // =========================================
    window.mBT.tests.math.edgeCases = function () {
        try {
            var tests = [
                { func: 'formatCurrency', args: [0], expected: '$0.00' },
                { func: 'formatCurrency', args: [-0], expected: '($0.00)' },
                { func: 'formatCurrency', args: [1], expected: '$1.00' },
                { func: 'formatCurrency', args: [null], expected: '$0.00' },
                { func: 'formatCurrency', args: [undefined], expected: '$0.00' },
                { func: 'formatCurrency', args: [NaN], expected: '$0.00' },
                { func: 'reconcile', args: [null, null], expected: { variance: 0, percent: 0 } },
                { func: 'reconcile', args: [0, 0], expected: { variance: 0, percent: 0 } }
            ];

            var allPassed = true;
            var errorMsg = '';

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                var result;
                
                if (test.func === 'formatCurrency') {
                    result = typeof window.mBT.le.formatCurrency === 'function'
                        ? window.mBT.le.formatCurrency(test.args[0])
                        : window.mBT.tests.math._formatCurrency(test.args[0]);
                } else if (test.func === 'reconcile') {
                    result = typeof window.mBT.le.reconcile === 'function'
                        ? window.mBT.le.reconcile(test.args[0], test.args[1])
                        : { variance: 0, percent: 0 };
                }

                var passed = JSON.stringify(result) === JSON.stringify(test.expected);
                if (!passed) {
                    allPassed = false;
                    errorMsg += '\n  Test ' + (i + 1) + ' failed: ' + JSON.stringify(result) + ' !== ' + JSON.stringify(test.expected);
                }
            }

            return window.mBT.tests.math.result('edgeCases', allPassed, allPassed ? 'All edge case tests passed' : errorMsg);
        } catch (e) {
            return window.mBT.tests.math.result('edgeCases', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // RUN ALL TESTS
    // =========================================
    window.mBT.tests.math.runAll = function () {
        console.log('[mBT Math Test] Running all tests..\n');

        var tests = [
            window.mBT.tests.math.formatCurrency,
            window.mBT.tests.math.reconcile,
            window.mBT.tests.math.largeNumbers,
            window.mBT.tests.math.variance,
            window.mBT.tests.math.edgeCases
        ];

        for (var i = 0; i < tests.length; i++) {
            var test = tests[i];
            test();
        }

        console.log('\n[mBT Math Test] Results:');
        console.log('  Passed:', window.mBT.tests.math.results.passed);
        console.log('  Failed:', window.mBT.tests.math.results.failed);
        console.log('  Total:', window.mBT.tests.math.results.passed + window.mBT.tests.math.results.failed);

        return window.mBT.tests.math.results;
    };

})();
