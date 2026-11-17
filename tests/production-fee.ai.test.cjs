const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
    let saved, paints = 0;
    const messages = [];
    const c = { console, setTimeout, clearTimeout, Promise,
        document: { getElementById: () => null },
        localStorage: { getItem: () => null, setItem: () => {} },
        displayCurrency: 'USD', storageKeyPrefix: 'prodBudget_v5_',
        render: () => { paints++; },
        mBTME: { alert: (title, text) => messages.push({ title, text }), showLoader() {}, hideLoader() {} },
        mBT: { data: { state: { wrap: b => b } }, ui: {}, features: {} }
    };
    c.window = c;
    c.budget = { projectName: 'Existing agreed budget', currency: 'USD', contingencyPercentage: 10,
        salesTaxPercentage: 15, discountPercentage: 10, fringes: [],
        sections: { Production: { items: [{ id: 'crew', description: 'Crew', quantity: 1, rate: 1000 }] } } };
    c.saveBudget = c.mBT.data.save = async () => { saved = JSON.parse(JSON.stringify(c.budget)); };
    c.mBTBudgetStorage = { load: async () => saved };
    vm.createContext(c);
    for (const file of ['src/core/finance.engine.js', 'src/core/logic/BudgetSafety.js', 'src/core/logic/AIModule.js', 'src/services/ai-context.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), c, { filename: file });
    }
    c.mBTLE = { reconcile: () => c.mBT_Finance.reconcile(c.budget) };
    c.mBTAIModule._tell = (title, text) => messages.push({ title, text });
    c.mBT_Finance.reconcile(c.budget);
    return { c, ai: c.mBTAIModule, messages, saved: () => saved, paints: () => paints };
}

async function applyReply(h, reply) {
    const parsed = h.ai._extractActionBlocks(reply);
    assert.equal(parsed.bad, 0);
    const changes = h.ai._flattenChanges(parsed.blocks);
    for (const change of changes) assert.equal(h.ai._preflightChange(change), null);
    await h.ai._commitBody(changes, changes, null, [], '', { lookup: {}, renames: [], creates: [], createdKeys: {}, rosterChanges: [] });
}

test('mock AI reply applies fee through engine, saves and repaints', async () => {
    const h = harness();
    await applyReply(h, '```json\n{"mbt_action":"update_production_fee","value":15}\n```');
    assert.equal(h.c.budget.productionFeeAmount, 187.5);
    assert.equal(h.c.budget.grandTotal, 1293.75);
    assert.equal(h.saved().productionFeePercentage, 15);
    assert.equal(h.saved().grandTotal, 1293.75);
    assert.ok(h.paints() > 0);
    assert.ok(h.messages.some(m => m.title === 'Applied'));
    assert.ok(JSON.parse(h.c._mbtAILastBackup).fields.some(f => f.path[0] === 'productionFeePercentage'));
});

test('mock batch applies fee with other adjustments', async () => {
    const h = harness();
    await applyReply(h, '```json\n{"mbt_action":"batch","changes":[{"mbt_action":"update_contingency","value":20},{"mbt_action":"update_production_fee","value":10}]}\n```');
    assert.equal(h.c.budget.productionFeeAmount, 135);
    assert.equal(h.c.budget.grandTotal, 1336.5);
    assert.equal(h.saved().contingencyPercentage, 20);
    assert.equal(h.saved().productionFeePercentage, 10);
});

test('AI refuses out-of-range and non-finite fee actions without changing the budget', () => {
    const h = harness();
    for (const value of [-1, 101, 1e308, NaN, Infinity, null, 'NaN', '15']) {
        const before = JSON.stringify(h.c.budget);
        const action = { mbt_action: 'update_production_fee', value };
        assert.match(h.ai._preflightChange(action), /finite number from 0 to 100/);
        assert.match(h.ai._applyOne(action, {}), /finite number from 0 to 100/);
        assert.equal(JSON.stringify(h.c.budget), before);
    }
});

test('live context and system rules contain fee fields, tiers and duplicate warning', () => {
    const h = harness();
    h.c.mBT_Finance.setProductionFee(h.c.budget, 15);
    h.c.budget.fringes.push({ name: ' Production Fee ', rate: 15 });
    const context = h.ai._buildBudgetContext();
    for (const text of ['productionFeePercentage: 15', 'productionFeeAmount:', 'duplicateFeeWarning: true', '10% small/favour', '15% standard', '20% rush/complex/heavy crew']) assert.ok(context.includes(text), text);
    const prompt = h.ai._buildActionPrompt();
    for (const text of ['update_production_fee', 'contingency is never a substitute', 'already-agreed budget unless the user asks', 'Never use the legacy Production Fee fringe']) assert.ok(prompt.includes(text), text);
    const enriched = h.c.mBTAIContext.enrichContextFromBudgetDoc({}, h.c.budget);
    assert.equal(enriched.productionFeePercentage, 15);
    assert.equal(enriched.duplicateFeeWarning, true);
});

test('generate-budget parses mocked model JSON and preserves/clamps its suggested fee', async () => {
    for (const [value, expected] of [[20, 20], [150, 100], [-5, 0]]) {
        const h = harness();
        let schema;
        h.ai.getSelectedProvider = () => 'lmstudio';
        h.ai.getStoredApiKey = () => '';
        h.ai._buildRateContext = () => '';
        h.ai.callUnifiedAI = async (provider, key, prompt, system) => {
            schema = system;
            return '```json\n' + JSON.stringify({ projectName: 'New rush draft', productionFeePercentage: value,
                sections: { Production: { items: [{ description: 'Crew', quantity: 1, rate: 1000 }] } } }) + '\n```';
        };
        assert.equal(await h.ai.generateBudgetFromPrompt('New rush shoot with a heavy crew'), true);
        assert.equal(h.c.budget.productionFeePercentage, expected);
        assert.equal(h.c.budget.productionFeeAmount, 1100 * expected / 100);
        assert.ok(schema.includes('"productionFeePercentage": number'));
        assert.ok(schema.includes('20% rush/complex/heavy crew'));
    }
});

test('context and prompt generation leave old agreed budgets without a fee unchanged', () => {
    const h = harness();
    const before = JSON.stringify(h.c.budget);
    assert.ok(h.ai._buildBudgetContext().includes('productionFeePercentage: 0'));
    h.ai._buildActionPrompt();
    h.c.mBTAIContext.enrichContextFromBudgetDoc({}, h.c.budget);
    assert.equal(JSON.stringify(h.c.budget), before);
    assert.equal(Object.hasOwn(h.c.budget, 'productionFeePercentage'), false);
    assert.equal(h.c.budget.grandTotal, 1125);
});


test('building AI context never writes calculated fields onto old fringe records', () => {
    const h = harness();
    h.c.budget.fringes = [{ name: 'Production Fee', rate: 15 }];
    const before = JSON.stringify(h.c.budget);
    let writes = 0;
    h.c.budget.fringes[0] = new Proxy(h.c.budget.fringes[0], { set(target, key, value) { writes++; target[key] = value; return true; } });
    h.ai._buildBudgetContext();
    h.c.mBTAIContext.enrichContextFromBudgetDoc({}, h.c.budget);
    assert.equal(JSON.stringify(h.c.budget), before);
    assert.equal(writes, 0);
});
