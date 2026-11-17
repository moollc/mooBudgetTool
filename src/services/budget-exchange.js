/* Currency conversion snapshots belong to budgets, not OpenGate prices. */
(function () {
    'use strict';
    var pending = null, serial = 0;
    /* Bundled starting rates, units per 1 USD. Source: fawazahmed0 currency-api (CC0, public domain), read on 2026-10-08:
       TTD 6.77844495, BBD 2, GYD 209.11442259, XCD 2.70714167, rounded to two decimals as the default table does.
       Starting figures only, informational: a producer can type their own rate, and a live pull can update them. */
    var BUNDLED_STARTING = { TTD: 6.78, BBD: 2, GYD: 209.11, XCD: 2.71 };
    /* Live sources, tried in this order. Both are keyless and send nothing about the user: a plain request for USD based rates. */
    var SOURCES = [
        { name: 'open.er-api.com', url: 'https://open.er-api.com/v6/latest/USD', parse: function (data) {
            if (!data || data.result !== 'success' || data.base_code !== 'USD' || !data.rates) throw new Error('Exchange rates response is not a USD based success.');
            var day = data.time_last_update_unix ? new Date(data.time_last_update_unix * 1000).toISOString().slice(0, 10) : null;
            return { rates: data.rates, date: day };
        } },
        { name: 'fawazahmed0 currency-api', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', parse: function (data) {
            if (!data || !data.usd) throw new Error('Exchange rates response is empty.');
            var upper = {};
            Object.keys(data.usd).forEach(function (code) { upper[String(code).toUpperCase()] = data.usd[code]; });
            return { rates: upper, date: data.date || null };
        } }
    ];
    function copy(value) { return JSON.parse(JSON.stringify(value)); }
    function initial(isNew) {
        var rates = window.exchangeRates || { USD: 1, JMD: 157.5 };
        try {
            if (!isNew && localStorage.getItem('prodBudget_v5_ratesLocked') === 'true') rates = JSON.parse(localStorage.getItem('prodBudget_v5_ratesLockedSnap')) || rates;
        } catch (err) {}
        rates = copy(rates);
        /* Preserve the bundled engine's historical offline MXN fallback in the snapshot. */
        if (!rates.MXN) rates.MXN = 17.5;
        /* Starting rates for the Caribbean currencies the live sources used before did not carry, so a new budget is never without one. */
        Object.keys(BUNDLED_STARTING).forEach(function (code) { if (!rates[code]) rates[code] = BUNDLED_STARTING[code]; });
        return rates;
    }
    /* The Settings option "New budgets start with live rates" (stored as auto_fetch_rates). Off unless it was switched on. */
    function newBudgetsStartLive() {
        try { return localStorage.getItem((window.storageKeyPrefix || 'prodBudget_v5_') + 'auto_fetch_rates') === 'true'; } catch (err) { return false; }
    }
    function addSource(list, name) {
        var out = (list || []).slice();
        if (name && out.indexOf(name) === -1) out.push(name);
        return out;
    }
    /* The live sources behind the cached seed (empty when the cache is only the bundled starting numbers). */
    function seedSourcesNow() {
        var meta = window.exchangeRatesMeta;
        if (!meta) { try { meta = JSON.parse(localStorage.getItem('prodBudget_v5_rates_sources') || 'null'); } catch (err) { meta = null; } }
        return (meta && meta.sources) || [];
    }
    function initialize(b, isNew) {
        if (!b || !b.projectName || b.exchangeRateState) return;
        var now = new Date().toISOString();
        /* Only a brand new budget follows the option. An older budget opened for the first time stays locked (batch 3). */
        b.exchangeRateState = { rates: initial(isNew), manual: {}, createdAt: isNew ? now : null, updatedAt: now, live: !!isNew && newBudgetsStartLive(), legacy: !isNew, noticeShown: !!isNew, sources: isNew ? seedSourcesNow() : [] };
        setTimeout(function () {
            if (window.budget !== b && (!window.budget || window.budget._historyBudgetId !== b._historyBudgetId)) return;
            if (!b.exchangeRateState.noticeShown) {
                b.exchangeRateState.noticeShown = true;
                if (window.mBTME) mBTME.alert('Exchange rates locked', 'This older budget had no stored exchange rates. Rates were locked when it was first opened after this update, at ' + now + '. Use live exchange rates is off.');
            }
            save();
        }, 0);
    }
    function rates(b) { initialize(b); return b && b.exchangeRateState ? b.exchangeRateState.rates : initial(); }
    function apply(b) {
        var table = rates(b);
        if (window.mBTLE && mBTLE.config && mBTLE.config.currencies) Object.keys(table).forEach(function (code) {
            if (mBTLE.config.currencies[code]) mBTLE.config.currencies[code].rate = table[code];
        });
        if (window.mBT && mBT.le && mBT.le.CURRENCY_RATES) {
            /* Do not retain a pair introduced by a different budget's live fetch. */
            Object.keys(mBT.le.CURRENCY_RATES).forEach(function (from) { delete mBT.le.CURRENCY_RATES[from]; });
            Object.keys(table).forEach(function (from) {
                var row = mBT.le.CURRENCY_RATES[from] = {};
                Object.keys(table).forEach(function (to) { row[to] = table[to] / table[from]; });
            });
        }
        return table;
    }
    function save() {
        if (window.mBT && mBT.data && window.budget) mBT.data.save().catch(function (err) { console.warn('[Exchange rates] Save failed:', err.message); });
    }
    function paint() {
        apply(window.budget);
        /* A rate typed or pulled may make a wanted display currency possible (or take it away). */
        if (window.resolveDisplayCurrency) resolveDisplayCurrency(window.budget);
        if (window.mBTLE && mBTLE.reconcile) mBTLE.reconcile();
        if (window.render) render();
        if (window.renderCurrencyBtn) renderCurrencyBtn();
        var frames = document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
            try { frames[i].contentWindow.postMessage({ type: 'mbt:displayCurrency', currency: window.displayCurrency, rates: rates(window.budget) }, location.origin); } catch (err) {}
        }
        save();
    }
    /* One request to one source. Resolves to { rates, date, source } or rejects. */
    function pull(source) {
        return fetch(source.url).then(function (res) {
            if (!res.ok) throw new Error(source.name + ' HTTP ' + res.status);
            return res.json();
        }).then(function (data) {
            var got = source.parse(data), clean = {};
            Object.keys(got.rates).forEach(function (code) {
                var n = Number(got.rates[code]);
                /* Only three letter currency codes are kept (the second source also lists coins and metals with longer codes). */
                if (!/^[A-Z]{3}$/.test(code)) return;
                if (!isFinite(n) || n <= 0) throw new Error(source.name + ' sent an invalid rate.');
                clean[code] = n;
            });
            if (!Object.keys(clean).length) throw new Error(source.name + ' sent no rates.');
            return { rates: clean, date: got.date, source: source.name };
        });
    }
    /* stillWanted() is checked before every request, so a pull that live off or another budget has made pointless asks no further source. */
    function pullFirst(index, failures, stillWanted) {
        if (!stillWanted()) { var gone = new Error('The pull is no longer wanted.'); gone.stale = true; return Promise.reject(gone); }
        if (index >= SOURCES.length) return Promise.reject(new Error('No exchange rate source could be reached (' + failures.join('; ') + ').'));
        return pull(SOURCES[index]).catch(function (err) { if (err && err.stale) throw err; failures.push(err.message); return pullFirst(index + 1, failures, stillWanted); });
    }
    function sync() {
        var b = window.budget;
        initialize(b);
        if (!b || !b.exchangeRateState || !b.exchangeRateState.live) return Promise.resolve({ status: 'locked' });
        if (!navigator.onLine) return Promise.resolve({ status: 'offline' });
        if (pending && pending.budget === b) return pending.promise;
        var ticket = ++serial, state = b.exchangeRateState;
        var stillWanted = function () { return ticket === serial && window.budget === b && state.live && navigator.onLine; };
        var promise = pullFirst(0, [], stillWanted).then(function (got) {
            var next = copy(state.rates);
            Object.keys(got.rates).forEach(function (code) { next[code] = got.rates[code]; });
            next.USD = 1;
            /* A rate the producer typed for this budget wins over the live and bundled ones. */
            var manual = state.manual || {};
            Object.keys(manual).forEach(function (code) { next[code] = manual[code]; });
            if (ticket !== serial || window.budget !== b || !state.live || !navigator.onLine) return { status: 'stale' };
            /* Only a pull that is really applied is remembered for Forget, so a discarded one can never be put back later. */
            if (!state.manualPrev) state.manualPrev = {};
            Object.keys(manual).forEach(function (code) {
                if (got.rates[code] != null) { state.manualPrev[code] = got.rates[code]; if (!state.manualLive) state.manualLive = {}; state.manualLive[code] = true; }
            });
            state.rates = next; state.updatedAt = new Date().toISOString(); state.lastPullAt = state.updatedAt; state.sourceDate = got.date || null; state.source = got.source;
            /* Every source whose numbers are in this snapshot is kept, so the credit it asks for stays while its rates are in use. */
            state.sources = addSource(state.sources, got.source);
            /* The cache seeds future budgets only, and from live numbers only: a rate typed for this budget never reaches another budget.
               For a typed code the seed gets the live number; a code that exists only because it was typed stays out. */
            var seed = copy(window.exchangeRates || {});
            Object.keys(got.rates).forEach(function (code) { seed[code] = got.rates[code]; });
            seed.USD = 1;
            window.exchangeRates = seed;
            localStorage.setItem('prodBudget_v5_rates', JSON.stringify(seed));
            /* The seed keeps where its numbers came from, so a budget made from it can carry the same credit. */
            var seedSources = addSource(seedSourcesNow(), got.source), seedMeta = { sources: seedSources, date: got.date || null };
            window.exchangeRatesMeta = seedMeta;
            try { localStorage.setItem('prodBudget_v5_rates_sources', JSON.stringify(seedMeta)); } catch (err) { /* storage full or blocked */ }
            paint();
            return { status: 'updated', at: state.updatedAt, source: got.source };
        }).catch(function (err) { return err && err.stale ? { status: 'stale' } : { status: 'error', message: err.message }; }).then(function (result) {
            if (pending && pending.ticket === ticket) pending = null;
            return result;
        });
        pending = { budget: b, ticket: ticket, promise: promise };
        return promise;
    }
    /* A rate typed by hand for one currency of the open budget: units of that currency per 1 USD. It is kept in this budget only. */
    function setManual(code, value) {
        var b = window.budget; initialize(b);
        code = String(code || '').toUpperCase(); value = Number(value);
        if (!b || !b.exchangeRateState || !/^[A-Z]{3}$/.test(code) || code === 'USD' || !isFinite(value) || value <= 0) return false;
        var state = b.exchangeRateState;
        if (!state.manual) state.manual = {};
        if (!state.manualPrev) state.manualPrev = {};
        /* The first time a code is typed, remember what the budget had before (null when it had no rate). */
        if (!state.manual[code] && !(code in state.manualPrev)) state.manualPrev[code] = state.rates[code] != null ? state.rates[code] : null;
        state.manual[code] = value; state.rates[code] = value; state.updatedAt = new Date().toISOString();
        paint();
        return true;
    }
    /* Forget a typed rate: the budget goes back to the rate it would have without it. That is the last live number when a live pull
       has supplied one, otherwise the bundled starting rate. With none of those the currency
       has no rate. The shared seed is not used here (another budget's pull may have rewritten it). Returns { code, rate, kind } where kind is 'live', 'stored' (the budget's own earlier number), 'starting' or 'none'; false when there was nothing typed. */
    function clearManual(code) {
        var b = window.budget; initialize(b);
        code = String(code || '').toUpperCase();
        var state = b && b.exchangeRateState;
        if (!state || !state.manual || !(code in state.manual)) return false;
        var prev = state.manualPrev && state.manualPrev[code] != null ? Number(state.manualPrev[code]) : null;
        var kind = state.manualLive && state.manualLive[code] ? 'live' : 'stored';
        if (prev == null) kind = 'starting';
        if (prev == null && BUNDLED_STARTING[code]) prev = BUNDLED_STARTING[code];
        delete state.manual[code];
        if (state.manualPrev) delete state.manualPrev[code];
        if (state.manualLive) delete state.manualLive[code];
        if (prev != null && isFinite(prev) && prev > 0) state.rates[code] = prev;
        else { delete state.rates[code]; kind = 'none'; prev = null; }
        state.updatedAt = new Date().toISOString();
        paint();
        return { code: code, rate: prev, kind: kind };
    }
    function setLive(value) {
        var b = window.budget; initialize(b);
        if (!b || !b.exchangeRateState) return Promise.resolve({ status: 'locked' });
        ++serial; pending = null;
        b.exchangeRateState.live = !!value;
        if (!value) b.exchangeRateState.updatedAt = new Date().toISOString();
        paint();
        return value ? sync() : Promise.resolve({ status: 'locked' });
    }
    function notify(result) {
        var text = result.status === 'updated' ? 'Exchange rates refreshed from ' + (result.source || 'the network') + '.' : result.status === 'offline' ? 'Offline. No network refresh occurred. Stored budget rates are unchanged.' : result.status === 'locked' ? 'Use live exchange rates is off. Stored budget rates are unchanged.' : result.status === 'stale' ? 'The budget or rate option changed. No rates were applied.' : 'No rates were changed. ' + result.message;
        if (window.mBTME) mBTME.alert('Exchange rates', text);
        return result;
    }
    /* The sources update once a day, so the automatic refresh waits six hours between pulls. A person pressing Sync or turning live rates on is not held back. */
    function refresh() {
        var st = window.budget && window.budget.exchangeRateState;
        if (st && st.live && (!st.lastPullAt || Date.now() - Date.parse(st.lastPullAt) > 6 * 3600 * 1000)) return sync();
        return Promise.resolve({ status: 'waiting' });
    }
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    setInterval(refresh, 15 * 60 * 1000);
    /* ---- The rates window: every rate of the open budget, each one editable, with the credit the free source asks for. ---- */
    function escText(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function editorHtml() {
        return '<div id="exchangeRatesBody" class="p-4 space-y-3 text-xs overflow-y-auto min-h-0">' + editorInner() + '</div>';
    }
    function editorInner() {
        var b = window.budget, st = b && b.exchangeRateState;
        if (!st) return '<p class="text-xs">No open budget.</p>';
        var manual = st.manual || {};
        var codes = Object.keys(st.rates).sort();
        var rows = codes.map(function (code) {
            var typed = !!manual[code], fixed = code === 'USD';
            return '<tr class="border-t border-slate-100"><td class="p-1.5 text-[11px] font-black">' + escText(code) + '</td>' +
                '<td class="p-1.5"><input type="number" step="any" min="0" data-rate-code="' + escText(code) + '" value="' + escText(st.rates[code]) + '"' + (fixed ? ' disabled' : '') + ' aria-label="Rate for ' + escText(code) + ' per 1 USD" class="w-28 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono"></td>' +
                '<td class="p-1.5 text-[9px] font-bold ' + (typed ? 'text-blue-600' : 'text-slate-400') + '">' + (fixed ? 'base' : typed ? 'typed by you' : 'stored') + '</td>' +
                '<td class="p-1.5">' + (typed ? '<button type="button" data-rate-clear="' + escText(code) + '" class="text-[9px] font-black uppercase text-slate-500 underline">Forget</button>' : '') + '</td></tr>';
        }).join('');
        var pulled = st.lastPullAt ? 'Last live pull: ' + escText(st.sourceDate || st.lastPullAt.slice(0, 10)) + ' from ' + escText(st.source || 'a live source') + '.' : 'No live pull yet. Rates are the ones stored with this budget.';
        return '<p class="leading-relaxed">Rates for this budget only, in units of the currency per 1 USD. A rate you type wins over the live and starting rates, works offline, and stays until you press Forget. Forget puts back the last live rate, or the starting rate, or leaves the currency with no rate if there is none.</p>' +
            '<div class="flex gap-2 items-end"><label class="text-[9px] font-black uppercase">Currency code<br><input id="exchangeRateNewCode" maxlength="3" placeholder="TTD" class="w-20 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono uppercase"></label>' +
            '<label class="text-[9px] font-black uppercase">Rate per 1 USD<br><input id="exchangeRateNewValue" type="number" step="any" min="0" class="w-28 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono"></label>' +
            '<button type="button" id="exchangeRateAdd" class="h-8 px-3 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase">Add or change</button></div>' +
            '<p id="exchangeRatesMsg" role="status" class="text-[10px] font-bold text-amber-700"></p>' +
            '<div class="max-h-64 overflow-y-auto border border-slate-100 rounded-xl"><table class="w-full"><thead class="bg-slate-50 text-[9px] uppercase text-slate-400"><tr><th class="p-1.5 text-left">Currency</th><th class="p-1.5 text-left">Per 1 USD</th><th class="p-1.5 text-left">Source</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<p class="text-[10px] text-slate-500 leading-relaxed">' + pulled + ' Starting rates for TTD, BBD, GYD and XCD come from fawazahmed0 currency-api (public domain, CC0), read on 2026-10-08. Rates are informational, not for paying or settling anything.</p>' +
             ((st.sources || []).indexOf('open.er-api.com') !== -1 || st.source === 'open.er-api.com' ? '<p class="text-[10px]"><a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" class="underline text-blue-600">Rates By Exchange Rate API</a></p>' : '');
    }
    function say(text) { var m = document.getElementById('exchangeRatesMsg'); if (m) m.textContent = text; }
    function refreshEditor(message) {
        var body = document.getElementById('exchangeRatesBody');
        if (!body) return;
        body.innerHTML = editorInner();
        if (message) say(message);
    }
    function openEditor() {
        if (!window.mBTME || !window.budget) return;
        initialize(window.budget);
        mBTME.open('exchangeRates', 'Exchange rates', editorHtml(), 'max-w-md');
        var box = document.getElementById('exchangeRatesBody');
        var root = box ? box.parentNode : null;
        if (!root || root._ratesWired) return;
        root._ratesWired = true;
        root.addEventListener('change', function (e) {
            var code = e.target && e.target.getAttribute && e.target.getAttribute('data-rate-code');
            if (!code) return;
            if (setManual(code, e.target.value)) refreshEditor('Saved ' + code + ' for this budget.');
            else { say('Type a number above zero for ' + code + '.'); }
        });
        root.addEventListener('click', function (e) {
            var t = e.target;
            if (t && t.getAttribute && t.getAttribute('data-rate-clear')) {
                var back = clearManual(t.getAttribute('data-rate-clear'));
                var which = t.getAttribute('data-rate-clear');
                refreshEditor(!back ? 'Nothing typed for ' + which + '.' : back.rate == null ? 'Forgot your typed rate for ' + which + '. ' + which + ' now has no rate: type one, or turn on live rates.' : 'Forgot your typed rate for ' + which + '. It is back to ' + back.rate + ' per 1 USD (' + (back.kind === 'live' ? 'the last live rate' : back.kind === 'stored' ? 'the rate this budget had before you typed' : 'the starting rate') + ').');
                return;
            }
            if (t && t.id === 'exchangeRateAdd') {
                var code = String((document.getElementById('exchangeRateNewCode') || {}).value || '').toUpperCase();
                var val = (document.getElementById('exchangeRateNewValue') || {}).value;
                if (!/^[A-Z]{3}$/.test(code) || code === 'USD') { say('Use a three letter currency code other than USD, for example TTD.'); return; }
                if (setManual(code, val)) refreshEditor('Saved ' + code + ' for this budget.');
                else say('Type a rate above zero, in units of ' + code + ' per 1 USD.');
            }
        });
    }
    window.mBTExchange = { initialize: initialize, rates: rates, apply: apply, sync: sync, setLive: setLive, notify: notify, setManual: setManual, clearManual: clearManual, refresh: refresh, openEditor: openEditor, SOURCES: SOURCES };
})();
