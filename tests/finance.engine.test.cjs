const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'src/core/finance.engine.js'), 'utf8'), context);
const finance = context.window.mBT_Finance;

function fixture(overrides = {}) {
    return {
        projectName: 'Production fee verification', company: 'Test production', currency: 'USD',
        settings: { decimalPlaces: 2, deptSections: false },
        sections: {
            Crew: { id: 'prod', isOpen: true, items: [{ id: 'crew', description: 'Camera operator', quantity: 2, rate: 300, unit: 'Day' }] },
            Equipment: { id: 'gear', isOpen: true, items: [{ id: 'gear', description: 'Owner camera', quantity: 1, rate: 400, unit: 'Day', ownerOwned: true }] }
        },
        contingencyPercentage: 10, salesTaxPercentage: 15, discountPercentage: 0,
        fringes: [
            { id: 'all', name: 'Payroll', rate: 5 },
            { id: 'gear-fringe', name: 'Equipment burden', rate: 2.5, sectionKeys: ['Equipment'] },
            { id: 'disabled', name: 'Disabled', rate: 99, enabled: false }
        ],
        ...overrides
    };
}

test('old budget without a fee preserves its established grand total', () => {
    const b = fixture({ discountPercentage: 10 });
    finance.reconcile(b);
    assert.equal(b.subtotal, 1000);
    assert.equal(b.fringesTotal, 60);
    assert.equal(b.grandTotal, 1179);
    assert.equal(b.productionFeeAmount, 0);
    assert.equal(Object.hasOwn(b, 'productionFeePercentage'), false);
});

test('fee only adds the selected percentage to the subtotal', () => {
    const b = fixture({ contingencyPercentage: 0, salesTaxPercentage: 0, fringes: [], productionFeePercentage: 15 });
    finance.reconcile(b);
    assert.equal(b.productionFeeAmount, 150);
    assert.equal(b.grandTotal, 1150);
});

test('fee includes contingency, tax and enabled scoped fringes exactly once', () => {
    const b = fixture({ productionFeePercentage: 15 });
    finance.reconcile(b);
    assert.equal(b.fringes[1].base, 400);
    assert.equal(b.fringesTotal, 60);
    assert.equal(b.productionFeeAmount, 196.50);
    assert.equal(b.grandTotal, 1506.50);
    finance.reconcile(b);
    assert.equal(b.grandTotal, 1506.50);
});

test('discount applies last to the complete total including the production fee', () => {
    const b = fixture({ productionFeePercentage: 15, discountPercentage: 10 });
    finance.reconcile(b);
    assert.equal(finance.summary(b).discount, 150.65);
    assert.equal(b.grandTotal, 1355.85);
});

test('owner flag and custom fee survive JSON persistence without adding owner revenue', () => {
    const b = fixture({ productionFeePercentage: 12.5 });
    finance.reconcile(b);
    const loaded = JSON.parse(JSON.stringify(b));
    finance.reconcile(loaded);
    assert.equal(loaded.productionFeePercentage, 12.5);
    assert.equal(loaded.productionFeeAmount, 163.75);
    assert.equal(loaded.grandTotal, 1473.75);
    assert.equal(loaded.sections.Equipment.items[0].ownerOwned, true);
    loaded.sections.Equipment.items[0].ownerOwned = false;
    finance.reconcile(loaded);
    assert.equal(loaded.grandTotal, b.grandTotal);
});

test('round each adjustment to cents before calculating fee and discount', () => {
    const b = fixture({
        sections: { Crew: { items: [{ id: 'cents', quantity: 3, rate: 33.335 }] } },
        contingencyPercentage: 7.5, salesTaxPercentage: 8.25,
        fringes: [{ rate: 3.75 }], productionFeePercentage: 12.5, discountPercentage: 2.5
    });
    finance.reconcile(b);
    assert.equal(b.subtotal, 100.01);
    assert.equal(b.productionFeeAmount, 14.94);
    assert.equal(finance.summary(b).discount, 3.36);
    assert.equal(b.grandTotal, 131.09);
});

test('overlapping fringe scopes remain a union when calculating the fee', () => {
    const b = fixture({ productionFeePercentage: 10 });
    b.sections.Crew.items[0]._departmentSection = 'Camera';
    b.fringes = [{ rate: 10, sectionKeys: ['Crew', 'Camera'] }];
    finance.reconcile(b);
    assert.equal(b.fringesTotal, 60);
    assert.equal(b.productionFeeAmount, 131);
    assert.equal(b.grandTotal, 1441);
});

test('unreconciled legacy top sheet calculates subtotal and scoped fringe from its rows', () => {
    const b = fixture({ productionFeePercentage: 15, discountPercentage: 10 });
    const totals = finance.summary(b);
    assert.equal(totals.subtotal, 1000);
    assert.equal(totals.fringesTotal, 60);
    assert.equal(totals.productionFeeAmount, 196.5);
    assert.equal(totals.grandTotal, 1355.85);
});

test('record commands reject edits to computed fee amounts', () => {
    const helpers = require('../src/services/record-helpers.js');
    assert.throws(() => helpers.prepareCAS(null, {
        recordId: 'budget1', kind: 'budget', expectedVersion: 0,
        patch: { productionFeeAmount: 10 }, sources: { productionFeeAmount: { kind: 'typed' } }
    }, 'budget1'), error => error.code === 'CALCULATED_FIELD');
});


test('duplicate production fee warns without changing either user charge', () => {
    const b = fixture({ contingencyPercentage: 0, salesTaxPercentage: 0,
        fringes: [{ id: 'duplicate', name: '  pRoDuCtIoN fEe  ', rate: 15, enabled: true }], productionFeePercentage: 15 });
    finance.reconcile(b);
    assert.equal(finance.summary(b).duplicateFeeWarning, true);
    assert.equal(b.grandTotal, 1322.5);
    assert.equal(b.fringes[0].name, '  pRoDuCtIoN fEe  ');
    assert.equal(b.fringes[0].rate, 15);
    assert.equal(b.fringes[0].enabled, true);
    assert.equal(b.productionFeePercentage, 15);
    b.fringes[0].enabled = false;
    assert.equal(finance.summary(b).duplicateFeeWarning, false);
    b.fringes[0].enabled = true;
    b.productionFeePercentage = 0;
    assert.equal(finance.summary(b).duplicateFeeWarning, false);
    b.productionFeePercentage = 15;
    b.fringes[0].name = 'Payroll';
    assert.equal(finance.summary(b).duplicateFeeWarning, false);
});

test('fee calculation caps finite percentages to 0..100 and rejects non-finite rates', () => {
    for (const [rate, expected] of [[1e308, 100], [101, 100], [-1, 0], [Infinity, 0], ['Infinity', 0], [NaN, 0]]) {
        const b = fixture({ contingencyPercentage: 0, salesTaxPercentage: 0, fringes: [], productionFeePercentage: rate });
        finance.reconcile(b);
        assert.equal(finance.summary(b).productionFeePercentage, expected);
        assert.equal(b.productionFeeAmount, 1000 * expected / 100);
        assert.equal(b.grandTotal, 1000 + b.productionFeeAmount);
        assert.ok(Number.isFinite(b.grandTotal));
        assert.ok(!JSON.stringify(b).includes('"grandTotal":null'));
    }
});

test('an overflowing calculated fee falls back to zero', () => {
    const totals = finance.summary({ subtotal: 1e307, productionFeePercentage: 100 });
    assert.equal(totals.productionFeeAmount, 0);
});
