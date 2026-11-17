/* Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package if needed.
   Uses an isolated browser profile and synthetic data; never opens owner budgets. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const XLSX = require('../src/lib/xlsx.full.min.js');
const root = path.resolve(__dirname, '..');

test('real publisher PDF, Excel, HTML, scoped top sheet and persisted toolbar controls', { timeout: 90000 }, async () => {
    const server = http.createServer(async (req, res) => {
        try {
            const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
            if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
            const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
            res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
            res.end(await fs.readFile(file));
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    const artifacts = process.env.MBT_EXPORT_ARTIFACTS || await fs.mkdtemp(path.join(os.tmpdir(), 'mbt-fee-exports-'));
    await fs.mkdir(artifacts, { recursive: true });
    try {
        browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
        const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } });
        await context.route('**/*', route => route.request().url().startsWith(origin) || route.request().url().startsWith('blob:') ? route.continue() : route.abort());
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin + '/src/tools/publisher/index.html');
        const expected = await page.evaluate(async () => {
            const b = {
                projectName: 'Production Fee Verification', company: 'Test production', currency: 'USD',
                settings: { decimalPlaces: 2, deptSections: false },
                sections: {
                    Crew: { id: 'prod', isOpen: true, items: [{ id: 'crew', description: 'Camera operator', quantity: 2, rate: 300, unit: 'Day' }] },
                    Equipment: { id: 'gear', isOpen: true, items: [{ id: 'gear', description: 'Owner camera', quantity: 1, rate: 400, unit: 'Day', ownerOwned: true }] }
                },
                contingencyPercentage: 10, salesTaxPercentage: 15, productionFeePercentage: 15, discountPercentage: 10,
                fringes: [
                    { id: 'all', name: 'Payroll', rate: 5 },
                    { id: 'scoped', name: 'Equipment burden', rate: 2.5, sectionKeys: ['Equipment'] },
                    { id: 'disabled', name: 'Disabled burden', rate: 99, enabled: false }
                ], activityLog: []
            };
            mBT_Finance.reconcile(b);
            await localforage.setItem('prodBudget_v5_' + b.projectName, b);
            return b.grandTotal;
        });
        assert.equal(expected, 1355.85);
        await page.goto(origin + '/src/tools/publisher/index.html?projectKey=prodBudget_v5_Production%20Fee%20Verification&currency=USD');
        await page.locator('#main-ui').waitFor({ state: 'visible' });
        const card = await page.locator('#pub-summary-grid').innerText();
        assert.match(card, /Production Fee \(15%\)/i);
        assert.match(card, /196\.50/);
        assert.match(card, /-150\.65/);
        assert.match(card, /1,355\.85/);

        async function download(button, filename) {
            const pending = page.waitForEvent('download');
            await page.locator(button).click();
            const result = await pending;
            const target = path.join(artifacts, filename);
            await result.saveAs(target);
            return fs.readFile(target);
        }
        const pdf = await download('#btn-pdf', 'production-fee.pdf');
        const excel = await download('#btn-xlsx', 'production-fee.xlsx');
        const html = (await download('#btn-html', 'production-fee.html')).toString();
        assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
        assert.equal(excel.subarray(0, 2).toString(), 'PK');

        await page.addScriptTag({ url: origin + '/src/lib/pdf.min.js' });
        const pdfText = await page.evaluate(async ({ bytes, origin }) => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = origin + '/src/lib/pdf.worker.min.js';
            const doc = await pdfjsLib.getDocument({ data: Uint8Array.from(bytes) }).promise;
            let text = '';
            for (let i = 1; i <= doc.numPages; i++) {
                const content = await (await doc.getPage(i)).getTextContent();
                text += content.items.map(item => item.str).join(' ') + '\n';
            }
            return text;
        }, { bytes: Array.from(pdf), origin });
        assert.match(pdfText, /Production Fee \(15%\)\s+\$196\.50/);
        assert.match(pdfText, /Discount \(10%\)\s+-\$150\.65/);
        assert.match(pdfText, /GRAND TOTAL\s+\$1,355\.85/);
        const workbook = XLSX.read(excel, { type: 'buffer' });
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Budget, { header: 1 });
        const amount = label => rows.find(row => row[0] === label)?.[1];
        assert.equal(amount('Production Fee (15%)'), 196.5);
        assert.equal(amount('Equipment burden (2.5%)'), 10);
        assert.equal(amount('Discount (10%)'), -150.65);
        assert.equal(amount('Grand Total'), expected);
        const header = rows.find(row => row[0] === 'SECTION');
        assert.deepEqual(header, ['SECTION', 'DESCRIPTION', 'QUANTITY', 'UNIT', 'RATE', 'ESTIMATED', 'ACTUAL', 'VARIANCE', 'OWNER GEAR']);
        assert.equal(rows.find(row => row[1] === 'Owner camera')[8], 'Yes');
        assert.equal(rows.find(row => row[1] === 'Camera operator')[8] || '', '');
        const summaryRows = rows.slice(rows.findIndex(row => row[0] === 'Subtotal'), rows.findIndex(row => row[0] === 'Grand Total'));
        assert.equal(Math.round(summaryRows.reduce((sum, row) => sum + row[1], 0) * 100) / 100, expected);
        for (const label of ['Production Fee (15%)', 'Payroll (5%)', 'Equipment burden (2.5%)', 'Discount (10%)', '1,355.85']) assert.ok(html.includes(label), label);

        const topsheet = await page.evaluate(async () => {
            const b = await localforage.getItem('prodBudget_v5_Production Fee Verification');
            delete b.fringesTotal;
            delete b.fringes[1].amount;
            return mBTPublisher.templates.render('topSheet', b, { currency: 'USD' });
        });
        for (const label of ['Production Fee (15%)', 'Equipment burden (2.5%)', '1,355.85']) assert.ok(topsheet.includes(label), label);
        assert.ok(!topsheet.includes('Disabled burden'));
        console.log(`PDF grand total: $1,355.85; Excel grand total: ${amount('Grand Total')}; engine: ${expected}`);
        console.log('PDF/Excel fee: 196.50; discount: -150.65; HTML/card/top sheet: matched');

        const multiplierDownload = page.waitForEvent('download');
        const multiplierExpected = await page.evaluate(async () => {
            const b = await localforage.getItem('prodBudget_v5_Production Fee Verification');
            b.projectName = 'Multiplier and stage verification';
            b.sections.Crew.items = [
                { id: 'mult', description: 'Multiplier crew', quantity: 2, rate: 100, multiplier: 2, unit: 'Day' },
                { id: 'stage', description: 'Staged crew', quantity: 0, rate: 0, stageData: { prod: { days: 2, rate: 100, multiplier: 0.5 } } }
            ];
            mBT_Finance.reconcile(b);
            mBTPublisher.format.professionalXlsx(b);
            return { subtotal: b.subtotal, grandTotal: b.grandTotal };
        });
        const multiplierFile = path.join(artifacts, 'multiplier-stage.xlsx');
        await (await multiplierDownload).saveAs(multiplierFile);
        const multiplierBook = XLSX.read(await fs.readFile(multiplierFile), { type: 'buffer' });
        const multiplierRows = XLSX.utils.sheet_to_json(multiplierBook.Sheets.Budget, { header: 1 });
        const itemRows = multiplierRows.filter(row => typeof row[5] === 'number');
        assert.equal(multiplierRows.find(row => row[1] === 'Multiplier crew')[5], 400);
        assert.equal(multiplierRows.find(row => row[1] === 'Staged crew')[5], 100);
        assert.equal(itemRows.reduce((sum, row) => sum + row[5], 0), multiplierExpected.subtotal);
        assert.equal(multiplierRows.find(row => row[0] === 'Grand Total')[1], multiplierExpected.grandTotal);
        assert.equal(multiplierRows.find(row => row[1] === 'Owner camera')[8], 'Yes');
        console.log('Real XLSX: OWNER GEAR Yes/blank; multiplier item 400; stage item 100; rows sum to engine subtotal ' + multiplierExpected.subtotal);

        await page.evaluate(async () => {
            const b = await localforage.getItem('prodBudget_v5_Production Fee Verification');
            b.projectName = 'Duplicate fee warning';
            b.fringes.push({ id: 'duplicate', name: '  pRoDuCtIoN fEe  ', rate: 15, enabled: true });
            mBT_Finance.reconcile(b);
            await localforage.setItem('prodBudget_v5_' + b.projectName, b);
        });
        await page.goto(origin + '/src/tools/publisher/index.html?projectKey=prodBudget_v5_Duplicate%20fee%20warning&currency=USD');
        await page.locator('#publisherProductionFeeWarning').waitFor({ state: 'visible' });
        assert.match(await page.locator('#publisherProductionFeeWarning').innerText(), /Both charges are included/);
        await page.goto(origin + '/src/tools/fringes/index.html?projectKey=prodBudget_v5_Duplicate%20fee%20warning&currency=USD');
        await page.locator('#fringes-production-fee-warning').waitFor({ state: 'visible' });
        const duplicateName = page.locator('.fringe-name[data-id="duplicate"]');
        await duplicateName.fill('Payroll');
        assert.equal(await page.locator('#fringes-production-fee-warning').isVisible(), false);
        await duplicateName.fill(' Production Fee ');
        assert.equal(await page.locator('#fringes-production-fee-warning').isVisible(), true);
        await page.locator('.fringe-toggle[data-id="duplicate"]').click();
        assert.equal(await page.locator('#fringes-production-fee-warning').isVisible(), false);

        await page.goto(origin + '/index.html');
        await page.waitForFunction(() => window.mBT && mBT.data && mBT.core.actions['item-owner-owned-toggle']);
        await page.addLocatorHandler(page.locator('#alertModal'), async modal => {
            console.log('Existing app alert: ' + (await modal.innerText()).replace(/\s+/g, ' '));
            await modal.getByRole('button', { name: 'OK', exact: true }).click();
        });
        await page.evaluate(async () => { await mBT.data.load('Production Fee Verification'); });
        await page.locator('#productionFeePercentage').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#productionFeePercentage').getAttribute('max'), '100');
        await page.evaluate(() => { localStorage.setItem('prodBudget_v5_currency', 'USD'); resolveDisplayCurrency(budget, 'USD'); mBT.ui.paint(); });
        await page.evaluate(() => mBT.core.actions['publish-modal']());
        const mainHtml = (await download('[data-action="export"][data-type="html"]', 'main-menu-production-fee.html')).toString();
        const mainSummary = await page.evaluate(html => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return Array.from(doc.querySelectorAll('[data-financial-summary] tr'), row => Array.from(row.children, cell => cell.textContent));
        }, mainHtml);
        assert.deepEqual(mainSummary.map(row => row[0]), ['Subtotal', 'Payroll (5%)', 'Equipment burden (2.5%)', 'Contingency (10%)', 'Sales Tax (15%)', 'Production Fee (15%)', 'Discount (10%)', 'Grand Total']);
        assert.match(mainSummary.find(row => row[0] === 'Production Fee (15%)')[1], /196\.50/);
        assert.match(mainSummary.find(row => row[0] === 'Discount (10%)')[1], /-.*150\.65/);
        assert.match(mainSummary.find(row => row[0] === 'Grand Total')[1], /1,355\.85/);
        console.log('Main-app Publish HTML download: fee 196.50, discount -150.65, grand total 1,355.85');
        await page.evaluate(() => {
            budget.exchangeRateState = { rates: { USD: 1, JMD: 150 }, manual: {}, live: false, noticeShown: true };
            localStorage.setItem('prodBudget_v5_currency', 'JMD'); resolveDisplayCurrency(budget, 'JMD');
            mBT.ui.paint();
        });
        await page.evaluate(() => mBT.core.actions['publish-modal']());
        const convertedHtml = (await download('[data-action="export"][data-type="html"]', 'main-menu-jmd.html')).toString();
        const readExport = html => page.evaluate(text => {
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const amounts = Object.fromEntries(Array.from(doc.querySelectorAll('[data-financial-summary] tr'), row => [row.children[0].textContent, row.children[1].textContent]));
            const estimates = Array.from(doc.querySelectorAll('[data-estimated-id]'), node => node.textContent);
            return { amounts, estimates };
        }, html);
        const converted = await readExport(convertedHtml);
        for (const [label, expected] of [['Subtotal', 150000], ['Production Fee (15%)', 29475], ['Discount (10%)', -22597.5], ['Grand Total', 203377.5]]) {
            assert.match(converted.amounts[label], /J\$/);
            assert.equal(Number(converted.amounts[label].replace(/[^0-9.-]/g, '')), expected);
        }
        assert.deepEqual(converted.estimates.map(text => Number(text.replace(/[^0-9.-]/g, ''))), [90000, 60000]);
        assert.equal(converted.estimates.reduce((sum, text) => sum + Number(text.replace(/[^0-9.-]/g, '')), 0), 150000);
        await page.evaluate(() => {
            budget.exchangeRateState.rates = { USD: 1 };
            mBT.ui.paint();
        });
        await page.evaluate(() => mBT.core.actions['publish-modal']());
        const fallbackHtml = (await download('[data-action="export"][data-type="html"]', 'main-menu-missing-rate.html')).toString();
        const fallback = await readExport(fallbackHtml);
        assert.deepEqual(fallback.amounts, Object.fromEntries(mainSummary));
        assert.deepEqual(fallback.estimates.map(text => Number(text.replace(/[^0-9.-]/g, ''))), [600, 400]);
        assert.ok(fallback.estimates.every(text => text.includes('$') && !text.includes('J$')));
        // The app can resolve the view to USD before the menu export. Also
        // exercise the publisher's own fallback with JMD still requested.
        const missingRateDownload = page.waitForEvent('download');
        await page.evaluate(() => mBTPublisher.format.htmlStandalone('budget-sections', budget.projectName, budget, 'JMD'));
        const missingRateFile = path.join(artifacts, 'explicit-missing-rate.html');
        await (await missingRateDownload).saveAs(missingRateFile);
        const explicitFallbackHtml = (await fs.readFile(missingRateFile)).toString();
        const explicitFallback = await readExport(explicitFallbackHtml);
        assert.deepEqual(explicitFallback.amounts, Object.fromEntries(mainSummary));
        assert.deepEqual(explicitFallback.estimates, fallback.estimates);
        assert.ok(explicitFallbackHtml.includes('Missing exchange rate for JMD. Amounts stay in USD.'));
        await page.evaluate(() => {
            budget.exchangeRateState.rates = { USD: 1, JMD: 150 };
            localStorage.setItem('prodBudget_v5_currency', 'USD'); resolveDisplayCurrency(budget, 'USD');
            mBT.ui.paint();
        });
        await page.evaluate(() => mBT.core.actions['publish-modal']());
        const baseAgain = await readExport((await download('[data-action="export"][data-type="html"]', 'main-menu-usd.html')).toString());
        assert.deepEqual(baseAgain.amounts, Object.fromEntries(mainSummary));
        assert.deepEqual(baseAgain.estimates.map(text => Number(text.replace(/[^0-9.-]/g, ''))), [600, 400]);
        console.log('Main HTML currency: JMD subtotal 150000, fee 29475, discount -22597.50, total 203377.50; rows 90000 + 60000; USD and missing-rate fallback matched');
        await page.locator('#productionFeePreset').selectOption('20');
        await page.waitForFunction(() => budget.productionFeePercentage === 20 && budget.grandTotal === 1414.8);
        await page.locator('#productionFeePreset').selectOption('custom');
        await page.locator('#productionFeePercentage').fill('12.5');
        await page.locator('#productionFeePercentage').blur();
        await page.waitForFunction(() => budget.productionFeePercentage === 12.5 && budget.grandTotal === 1326.37);
        const ownerButton = page.locator('[data-action="item-owner-owned-toggle"][data-id="gear"]');
        await ownerButton.click();
        assert.equal(await ownerButton.getAttribute('aria-pressed'), 'false');
        const saved = await page.evaluate(async () => {
            await mBT.data.save();
            const b = await mBT.data.storage.load('prodBudget_v5_Production Fee Verification');
            return { fee: b.productionFeePercentage, owner: b.sections.Equipment.items[0].ownerOwned };
        });
        assert.deepEqual(saved, { fee: 12.5, owner: false });
        await page.reload();
        await page.waitForFunction(() => window.budget && budget.productionFeePercentage === 12.5);
        assert.equal(await page.locator('#productionFeePercentage').inputValue(), '12.5');
        assert.equal(await page.locator('[data-action="item-owner-owned-toggle"][data-id="gear"]').getAttribute('aria-pressed'), 'false');
        await page.locator('#productionFeePercentage').fill('101');
        await page.locator('#productionFeePercentage').blur();
        assert.equal(await page.locator('#productionFeePercentage').inputValue(), '100');
        assert.equal(await page.evaluate(() => budget.productionFeePercentage), 100);
        await page.locator('#productionFeePercentage').fill('12.5');
        await page.locator('#productionFeePercentage').blur();
        await page.evaluate(() => {
            budget.fringes.push({ id: 'toolbar-duplicate', name: 'Production Fee', rate: 15 });
            mBTLE.reconcile();
            mBT.ui.toolbar.update();
        });
        assert.equal(await page.locator('#productionFeeWarning').isVisible(), true);
        assert.match(await page.locator('#productionFeeWarning').innerText(), /Both charges are included/);
        await page.evaluate(() => {
            budget.fringes[budget.fringes.length - 1].enabled = false;
            mBTLE.reconcile();
            mBT.ui.toolbar.update();
        });
        assert.equal(await page.locator('#productionFeeWarning').isVisible(), false);
        console.log('Duplicate-fee warning: toolbar, Fringes and publisher verified; UI fee capped at 100');
        await page.screenshot({ path: path.join(artifacts, 'toolbar.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(artifacts, 'toolbar-mobile.png'), fullPage: true });
        console.log('Toolbar: preset 20%, custom 12.5%, owner flag toggled and saved/reloaded');
        assert.deepEqual(errors, []);
        console.log('Artifacts: ' + artifacts);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
});
