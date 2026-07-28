/* mBT Phase 60.A/60.B: AI Module — Assistant Bridge + Action Triggering
   Extracted from index.html monolith (L2652-3037) to restore structural hygiene.
   Phase 60.B adds: applySuggestion(jsonDiff), action-block parsing, [Preview & Apply] UI.

   Namespace: window.mBTAIModule (aliased to mBT.features.ai at monolith init).
   All closure deps resolved via window.* at call time:
   budget, displayCurrency, storageKeyPrefix, saveBudget, mBTME, mBTAssets,
   openTool, marked, mBTPublisher, mBT, mBTLE are top-level vars in index.html. */

window.mBTAIModule = {

    /* Safe markdown → HTML for AI-generated content (analysis + assistant chat).
       marked.parse alone is XSS-unsafe; always sanitize. If DOMPurify is missing,
       escape source markdown text rather than emit raw HTML. */
    renderSafeMarkdown: function (text) {
        var src = text || '';
        var raw = (typeof window.marked !== 'undefined') ? window.marked.parse(src) : src;
        if (typeof window.DOMPurify !== 'undefined' && typeof window.DOMPurify.sanitize === 'function') {
            return window.DOMPurify.sanitize(raw);
        }
        /* DOMPurify failed to load (offline edge case, blocked script, etc.):
           escape the SOURCE markdown, never the raw unsanitized marked HTML. */
        if (window.mBT && window.mBT.ui && window.mBT.ui.render && typeof window.mBT.ui.render.esc === 'function') {
            return window.mBT.ui.render.esc(src);
        }
        return String(src).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    /* ── Configuration ─────────────────────────────────────────────────── */
    config: {
        geminiModel:        'gemini-2.5-flash',
        openAiModel:        'gpt-4o-mini',
        deepSeekModel:      'deepseek-chat',
        grokModel:          'grok-beta',
        claudeModel:        'claude-sonnet-4-6',
        lmstudioModel:      'local-model',
        lmstudioEndpoint:   'http://localhost:1234/v1/chat/completions',
        openrouterModel:    'openai/gpt-4o-mini',
        openrouterEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
        systemContext:    'ROLE: Strict Budget Auditor. MO: Brutal efficiency. No intro/outro fluff. No philosophical advice. OUTPUT: Markdown bullet points only. Start immediately with facts. CONTEXT: Film Production, Jamaica 2025 rates.',
        /* Phase 60.B: action-trigger addendum appended to systemContext in chat mode */
        chatActionPrompt: 'ACTION CAPABILITY: You can BUILD and MODIFY the budget. When the user asks for any change, output ONE JSON action block immediately before a brief explanation.\n\n' +
            'Single change:\n\x60\x60\x60json\n{"mbt_action":"update_rate|update_quantity|add_item|update_contingency","section":"Section Name","description":"Item Description","field":"rate","value":0}\n\x60\x60\x60\n\n' +
            'Several changes at once (also use this to build a new section or a whole budget):\n\x60\x60\x60json\n{"mbt_action":"batch","changes":[{"mbt_action":"add_section","section":"Camera Department"},{"mbt_action":"add_item","section":"Camera Department","description":"Camera Operator","quantity":5,"rate":40000,"unit":"Day"}]}\n\x60\x60\x60\n\n' +
            'RULES: Use the OPENGATE RATE CARD rates verbatim for anything listed there — never round, adjust or invent a number that is on the card. Copy section and item names EXACTLY as they appear in the CURRENT BUDGET list. Use add_section before adding items to a section that does not exist yet. Never invent a section name that is not in the list unless you are creating it with add_section. Keep explanations brief.'
    },

    /* ── Storage Accessors (Phase 173: thin wrappers over mBTAssistant) ──
       Legacy API kept intact so call sites in index.html, EventRouter, and
       ui.settings.js don't need to change. All actual storage I/O now goes
       through the mBTAssistant singleton — single source of truth. */
    getStoredApiKey: function (provider) {
        if (window.mBTAssistant) return window.mBTAssistant.getApiKey(provider) || '';
        return localStorage.getItem('mbt_' + provider + '_api_key') || '';
    },
    saveStoredApiKey: function (provider, key) {
        if (window.mBTAssistant) { window.mBTAssistant.setApiKey(provider, key); return; }
        localStorage.setItem('mbt_' + provider + '_api_key', key);
    },
    getStoredImageApiKey: function (provider) {
        if (window.mBTAssistant && typeof window.mBTAssistant.getImageApiKey === 'function') return window.mBTAssistant.getImageApiKey(provider) || '';
        return localStorage.getItem('mbt_img_' + provider + '_api_key') || '';
    },
    saveStoredImageApiKey: function (provider, key) {
        if (window.mBTAssistant && typeof window.mBTAssistant.setImageApiKey === 'function') { window.mBTAssistant.setImageApiKey(provider, key); return; }
        localStorage.setItem('mbt_img_' + provider + '_api_key', key);
    },
    setImageModel: function (model) {
        if (!model) return;
        if (window.mBTAssistant && typeof window.mBTAssistant.setImageModel === 'function') {
            window.mBTAssistant.setImageModel(model);
        } else {
            localStorage.setItem('mbt_ai_image_model', model);
        }
    },
    fetchAvailableImageModels: function (provider) {
        if (!provider) return Promise.resolve([]);
        if (window.mBTAssistant && typeof window.mBTAssistant.fetchAvailableImageModels === 'function') {
            return window.mBTAssistant.fetchAvailableImageModels(provider);
        }
        console.warn('mBTAssistant.fetchAvailableImageModels not available');
        return Promise.resolve([]);
    },
    getSelectedProvider: function () {
        if (window.mBTAssistant) return window.mBTAssistant.getProvider();
        var stored = localStorage.getItem('mbt_selected_ai_provider');
        if (stored) return stored;
        var endpoint = localStorage.getItem('mbt_ai_endpoint') || '';
        if (endpoint && endpoint.indexOf('localhost') > -1) return 'lmstudio';
        return 'gemini';
    },
    saveSelectedProvider: function (provider) {
        if (window.mBTAssistant) { window.mBTAssistant.setProvider(provider); return; }
        localStorage.setItem('mbt_selected_ai_provider', provider);
    },
    getSystemPrompt:    function () { return localStorage.getItem((window.storageKeyPrefix || '') + 'aiSystemPrompt') || ''; },
    saveSystemPrompt:   function (val) { localStorage.setItem((window.storageKeyPrefix || '') + 'aiSystemPrompt', val); },

    isPersistentContext: function () {
        var b = window.budget;
        return !!(b && b.aiContext && b.aiContext.saveHistory);
    },

    clearStoredAssistantChat: function (budgetDoc) {
        if (window.mBTAssistant && typeof window.mBTAssistant.clearChat === 'function') {
            window.mBTAssistant.clearChat(window.mBTAssistant.chatProjectKey(budgetDoc || window.budget));
        }
    },

    /* ── Centralized Intelligence Dispatcher ──────────────────────────────
       Phase 173: collapsed to a thin wrapper over mBTAssistant.callChat().
       The legacy (provider, apiKey) args are accepted but ignored — mBTAssistant
       reads them from its own state (which is the SAME localStorage keys, so
       behavior is identical). User constraint injection is preserved. */
    callUnifiedAI: function (provider, apiKey, prompt, customSystemMsg, history) {
        var self = this;
        var userConstraints = self.getSystemPrompt();
        var baseInstruction = customSystemMsg || self.config.systemContext;
        var systemInstruction = userConstraints ? (baseInstruction + ' USER CONSTRAINTS: ' + userConstraints) : baseInstruction;

        if (window.mBTAssistant && typeof window.mBTAssistant.callChat === 'function') {
            return window.mBTAssistant.callChat({
                userMessage:  prompt,
                systemPrompt: systemInstruction,
                history:      history || []
            }).catch(function (error) {
                console.error('mBT AI Failure:', error);
                var msg = error && error.message ? error.message : 'Unknown';
                if (msg === 'AI_RATE_LIMITED') {
                    msg = 'Wait a few seconds before another AI request.';
                }
                return 'Analysis Failed: ' + msg;
            });
        }

        /* Hard fallback if mBTAssistant ever fails to load — keeps tool from crashing */
        return Promise.reject(new Error('mBTAssistant unavailable — AI service offline.')).catch(function (error) {
            console.error('mBT AI Failure:', error);
            return 'Analysis Failed: ' + error.message;
        });
    },

    /* ── Budget snapshot for chat ────────────────────────────────────────
       Chat used to send only the project name and grand total. The AI then had
       to guess section names and item descriptions, but applySuggestion matches
       them exactly — so a guess of "Production Crew" against a real key of
       "BTL: Production Crew" failed every time. The AI looked like it lied.
       This sends the real names so it can quote them back exactly.
       Capped so a large budget cannot bloat the prompt. */
    /* ── OpenGate rate lookup for chat ───────────────────────────────────
       Without this the AI invents rates: it guessed J$30,000 for a Camera
       Operator when OpenGate holds J$23,870, and J$6,000 for a sound package
       actually rated J$34,875. A budget that looks right and is quietly wrong
       is worse than one that fails loudly, so chat gets the real rate card.

       All 182 rates would bloat every prompt, so this selects by relevance to
       what the user actually asked, and always includes a spine of common
       roles so simple asks still land on real numbers. */
    _buildRateContext: function (query) {
        var og = window.mBTOG;
        if (!og || !og.rates || !og.rates.length) return '';

        var MAX_ROWS = 60;
        var picked = [];
        var seen = {};
        var i, r;

        function add(rate) {
            if (!rate || seen[rate.description]) return;
            seen[rate.description] = true;
            picked.push(rate);
        }

        /* 1. Match words from the user's request against the rate card. */
        var words = String(query || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/);
        var STOP = { the:1, a:1, an:1, and:1, or:1, for:1, to:1, of:1, in:1, on:1, at:1,
                     with:1, add:1, set:1, make:1, budget:1, section:1, item:1, items:1,
                     line:1, rate:1, rates:1, day:1, days:1, use:1, need:1, want:1,
                     build:1, create:1, from:1, into:1, each:1, also:1, that:1, this:1 };
        for (i = 0; i < words.length; i++) {
            var w = words[i];
            if (!w || w.length < 3 || STOP[w]) continue;
            var hits = og.search(w) || [];
            for (var j = 0; j < hits.length && j < 8; j++) add(hits[j]);
            if (picked.length >= MAX_ROWS) break;
        }

        /* 2. Always include a spine of the most commonly needed roles. */
        var SPINE = ['Director', 'Producer', 'Camera Operator', 'Technical Director',
                     'Stream Technician', 'Sound Mixer', 'Gaffer', 'Editor'];
        for (i = 0; i < SPINE.length && picked.length < MAX_ROWS; i++) {
            var sh = og.search(SPINE[i]) || [];
            if (sh.length) add(sh[0]);
        }

        if (!picked.length) return '';

        var cur = window.displayCurrency || '';
        var lines = [];
        lines.push('OPENGATE RATE CARD (' + (og.settings && og.settings.location ? og.settings.location : 'local') + ', ' + cur + '):');
        lines.push('These are researched market rates. USE THESE NUMBERS. Do not estimate a rate for anything listed here.');
        for (i = 0; i < picked.length && i < MAX_ROWS; i++) {
            r = picked[i];
            lines.push('  ' + r.description + ' = ' + r.rate + ' per ' + (r.unit || 'Day') +
                       (r.itemType === 'equipment' ? ' [gear]' : ' [crew]'));
        }
        lines.push('If something the user needs is NOT on this list, say so plainly and give your best estimate clearly labelled as an estimate. Never silently invent a rate that contradicts this card.');
        return lines.join('\n');
    },

    _buildBudgetContext: function () {
        var budget = window.budget;
        if (!budget || !budget.sections) return '';

        var MAX_ITEMS_TOTAL = 40;
        var MAX_PER_SECTION = 12;
        var emitted = 0;
        var lines = [];
        var cur = window.displayCurrency || '';

        lines.push('CURRENT BUDGET — use these names exactly as written:');
        lines.push('Project: ' + (budget.projectName || 'Untitled'));
        lines.push('Grand total: ' + cur + ' ' + (budget.grandTotal || 0));
        if (budget.contingencyPercentage !== undefined) {
            lines.push('Contingency: ' + budget.contingencyPercentage + '%');
        }

        var names = Object.keys(budget.sections);
        for (var s = 0; s < names.length; s++) {
            var sec = budget.sections[names[s]];
            if (!sec) continue;
            var items = sec.items || [];
            lines.push('');
            lines.push('Section: ' + names[s]);
            var shown = 0;
            for (var i = 0; i < items.length; i++) {
                if (emitted >= MAX_ITEMS_TOTAL || shown >= MAX_PER_SECTION) break;
                var it = items[i];
                if (!it) continue;
                var qty = parseFloat(it.quantity);
                if (isNaN(qty)) qty = 0;
                var rate = parseFloat(it.rate);
                if (isNaN(rate)) rate = 0;
                lines.push('  - ' + (it.description || 'Item') +
                           ' (qty ' + qty + (it.unit ? ' ' + it.unit : '') +
                           ', rate ' + cur + ' ' + rate + ')');
                shown++;
                emitted++;
            }
            var left = items.length - shown;
            if (left > 0) lines.push('  ...and ' + left + ' more item' + (left === 1 ? '' : 's'));
        }

        if (emitted >= MAX_ITEMS_TOTAL) {
            lines.push('');
            lines.push('(Item list truncated. Ask the user if you need a section not shown.)');
        }
        return lines.join('\n');
    },

    /* Remove the ```json action block from text shown to the user. */
    _stripActionBlock: function (text) {
        var out = String(text || '').replace(/\x60\x60\x60json\s*\{[\s\S]*?"mbt_action"[\s\S]*?\}\s*\x60\x60\x60/g, '');
        out = out.replace(/^\s+|\s+$/g, '');
        return out || 'Proposed budget changes are ready — use Preview & Apply below.';
    },

    /* ── Phase 60.B: Action Block Parser ───────────────────────────────── */
    _parseActionFromResponse: function (text) {
        var match = text.match(/\x60\x60\x60json\s*(\{[\s\S]*?"mbt_action"[\s\S]*?\})\s*\x60\x60\x60/);
        if (!match) return null;
        try {
            var obj = JSON.parse(match[1]);
            return (obj && obj.mbt_action) ? obj : null;
        } catch (e) { return null; }
    },

    /* ── Name matching helpers ───────────────────────────────────────────
       The AI can return a near-miss: different case, extra spaces, or a
       prefix dropped ("Production Crew" vs "BTL: Production Crew"). Exact
       matching turned those into "Section not found" errors. Match loosely,
       but only accept an unambiguous hit — never guess between two. */
    _normalizeName: function (s) {
        return String(s || '')
            .toLowerCase()
            .replace(/&/g, ' and ')          /* "Logistics & Fees" == "Logistics and Fees" */
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/^\s+|\s+$/g, '');
    },

    _findSectionKey: function (wanted) {
        var budget = window.budget;
        if (!budget || !budget.sections) return null;
        var keys = Object.keys(budget.sections);
        var i;

        for (i = 0; i < keys.length; i++) {
            if (keys[i] === wanted) return keys[i];
        }
        var want = this._normalizeName(wanted);
        if (!want) return null;
        for (i = 0; i < keys.length; i++) {
            if (this._normalizeName(keys[i]) === want) return keys[i];
        }
        /* Partial match — only when exactly one section contains the text. */
        var hits = [];
        for (i = 0; i < keys.length; i++) {
            var k = this._normalizeName(keys[i]);
            if (k.indexOf(want) !== -1 || want.indexOf(k) !== -1) hits.push(keys[i]);
        }
        return hits.length === 1 ? hits[0] : null;
    },

    _findItem: function (sec, wanted) {
        var items = (sec && sec.items) || [];
        var i;
        for (i = 0; i < items.length; i++) {
            if ((items[i].description || '') === wanted) return items[i];
        }
        var want = this._normalizeName(wanted);
        if (!want) return null;
        for (i = 0; i < items.length; i++) {
            if (this._normalizeName(items[i].description) === want) return items[i];
        }
        var hits = [];
        for (i = 0; i < items.length; i++) {
            var d = this._normalizeName(items[i].description);
            if (d.indexOf(want) !== -1 || want.indexOf(d) !== -1) hits.push(items[i]);
        }
        return hits.length === 1 ? hits[0] : null;
    },

    /* Build a line item in the shape the budget engine expects.
       baseRate and total matter: an item missing them shows a rate in the row
       but totals as zero. The old add_item omitted both. */
    _makeItem: function (spec) {
        var qty  = parseFloat(spec.quantity);
        if (isNaN(qty)) qty = 1;
        var rate = parseFloat(spec.rate !== undefined ? spec.rate : spec.value);
        if (isNaN(rate)) rate = 0;
        return {
            id: 'item_ai_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
            description: spec.description || 'AI Suggestion',
            quantity: qty,
            unit: spec.unit || 'Flat',
            baseRate: rate,
            rate: rate,
            multiplier: 1,
            actual: 0,
            rateType: 'negotiable',
            rateSource: 'ai',
            tier: (window.budget && window.budget.tier) || 'Standard',
            region: (window.budget && window.budget.region) || '',
            crew: {},
            qualifying: false,
            actualQuantity: 0,
            actualRate: 0,
            actualDate: '',
            committedCost: 0,
            total: qty * rate
        };
    },

    /* One change, described in plain English for the preview. */
    _describeChange: function (c) {
        var cur = window.displayCurrency || '';
        var a = c.mbt_action;
        if (a === 'update_rate')        return 'Set "' + (c.description || 'item') + '" rate to ' + cur + ' ' + c.value;
        if (a === 'update_quantity')    return 'Set "' + (c.description || 'item') + '" quantity to ' + c.value;
        if (a === 'add_item')           return 'Add "' + (c.description || 'item') + '" to ' + (c.section || '?');
        if (a === 'add_section')        return 'Create section "' + (c.section || '?') + '"';
        if (a === 'update_contingency') return 'Set contingency to ' + c.value + '%';
        return 'Apply: ' + a;
    },

    /* Apply a single change. Returns an error string, or null on success. */
    _applyOne: function (c) {
        var budget = window.budget;
        var a = c.mbt_action;

        if (a === 'add_section') {
            var wanted = String(c.section || '').replace(/^\s+|\s+$/g, '');
            if (!wanted) return 'Section name missing.';
            if (this._findSectionKey(wanted)) return null; /* already there, not an error */
            budget.sections[wanted] = {
                id: 'sec_ai_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                isOpen: true,
                items: [],
                total: 0,
                ratio: 0
            };
            return null;
        }

        if (a === 'update_contingency') {
            var pct = parseFloat(c.value);
            if (isNaN(pct)) return 'Contingency value was not a number.';
            budget.contingencyPercentage = pct;
            return null;
        }

        var key = this._findSectionKey(c.section);
        if (!key) return 'Section not found: ' + (c.section || '(none)');
        var sec = budget.sections[key];
        if (!sec.items) sec.items = [];

        if (a === 'add_item') {
            sec.items.push(this._makeItem(c));
            return null;
        }

        if (a === 'update_rate' || a === 'update_quantity') {
            var item = this._findItem(sec, c.description);
            if (!item) return 'Item not found: ' + (c.description || '(none)') + ' in ' + key;
            var val = parseFloat(c.value);
            if (isNaN(val)) return 'Value was not a number for ' + (c.description || 'item');
            var field = c.field || (a === 'update_quantity' ? 'quantity' : 'rate');
            item[field] = val;
            if (field === 'rate') item.baseRate = val;
            var q = parseFloat(item.quantity);   if (isNaN(q)) q = 0;
            var r = parseFloat(item.rate);       if (isNaN(r)) r = 0;
            var m = parseFloat(item.multiplier); if (isNaN(m) || !m) m = 1;
            item.total = q * r * m;
            return null;
        }

        return 'Unknown action: ' + a;
    },

    /* Apply an AI suggestion: one change, or a batch that builds a whole
       section. Batches are all-or-nothing. The budget is snapshotted first,
       and any failure restores it, so a half-applied batch is impossible. */
    applySuggestion: function (diff) {
        if (!diff || !diff.mbt_action) return;
        var self   = this;
        var budget = window.budget;
        var mBTME  = window.mBTME;
        var mBTLE  = window.mBTLE;
        if (!budget) return mBTME.alert('Error', 'No budget loaded.');

        var changes = (diff.mbt_action === 'batch' && diff.changes && diff.changes.length)
            ? diff.changes
            : [diff];

        /* mBTME.confirm renders into a narrow <p>, so newlines collapse into one
           dense paragraph. Build a scrollable list instead — a 31-change batch
           has to be readable before anyone can honestly approve it. */
        var esc = (window.mBT && window.mBT.ui && window.mBT.ui.render && window.mBT.ui.render.esc)
            ? window.mBT.ui.render.esc
            : function (v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

        var i, rows = [];
        for (i = 0; i < changes.length; i++) {
            rows.push('<li style="margin:0 0 4px 0;">' + esc(self._describeChange(changes[i])) + '</li>');
        }
        var listHtml =
            '<div style="text-align:left;max-height:260px;overflow-y:auto;margin:0 0 8px 0;">' +
                '<ol style="margin:0;padding-left:18px;font-size:11px;line-height:1.5;color:#475569;">' +
                    rows.join('') +
                '</ol>' +
            '</div>';

        var title = changes.length > 1 ? ('Preview ' + changes.length + ' Changes') : 'Preview Change';
        var body  = listHtml + '<span style="font-weight:800;">Apply to the budget?</span>';

        mBTME.confirm(title, body, function () {
            var backup;
            try {
                backup = JSON.stringify({
                    sections: budget.sections,
                    contingencyPercentage: budget.contingencyPercentage
                });
            } catch (e) { backup = null; }

            var errors = [];
            for (var j = 0; j < changes.length; j++) {
                var err = self._applyOne(changes[j]);
                if (err) errors.push('\u2022 ' + err);
            }

            if (errors.length) {
                if (backup) {
                    var undoState = JSON.parse(backup);
                    budget.sections = undoState.sections;
                    budget.contingencyPercentage = undoState.contingencyPercentage;
                }
                return mBTME.alert('Nothing Applied',
                    'The budget was left unchanged because ' +
                    (errors.length === 1 ? 'this failed:' : 'these failed:') +
                    '\n\n' + errors.join('\n'));
            }

            if (backup) window._mbtAILastBackup = backup;

            if (typeof window.saveBudget === 'function') window.saveBudget();
            if (mBTLE && typeof mBTLE.reconcile === 'function') mBTLE.reconcile();
            if (typeof window.forceSectionRebuild === 'function') window.forceSectionRebuild();
            if (typeof window.render === 'function') window.render();

            if (typeof self.refreshUndoButton === 'function') self.refreshUndoButton();

            mBTME.alert('Applied', changes.length === 1
                ? 'Budget updated.'
                : (changes.length + ' changes applied. Use the undo arrow in chat to reverse.'));
        });
    },

    /* Show or hide the chat's undo button to match whether an undo exists. */
    refreshUndoButton: function () {
        var btn = document.getElementById('aiUndoBtn');
        if (!btn) return;
        if (window._mbtAILastBackup) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    },

    /* Roll the budget back to the state before the last applied AI change. */
    undoLastSuggestion: function () {
        var mBTME = window.mBTME;
        if (!window._mbtAILastBackup) return mBTME.alert('Undo', 'No AI change to undo.');
        var budget = window.budget;
        var prev = JSON.parse(window._mbtAILastBackup);
        budget.sections = prev.sections;
        budget.contingencyPercentage = prev.contingencyPercentage;
        window._mbtAILastBackup = null;
        if (typeof this.refreshUndoButton === 'function') this.refreshUndoButton();
        if (typeof window.saveBudget === 'function') window.saveBudget();
        if (window.mBTLE && typeof window.mBTLE.reconcile === 'function') window.mBTLE.reconcile();
        if (typeof window.forceSectionRebuild === 'function') window.forceSectionRebuild();
        if (typeof window.render === 'function') window.render();
        mBTME.alert('Undone', 'The last AI change was reversed.');
    },

    /* ── Budget Analysis ────────────────────────────────────────────────── */
    analyzeCurrentBudget: function () {
        var self     = this;
        var budget   = window.budget;
        var mBTME    = window.mBTME;
        var provider = self.getSelectedProvider();
        var apiKey   = self.getStoredApiKey(provider);

        if (!apiKey) return mBTME.alert('Assistant Offline', 'Please configure API Key in settings.');

        var context = {
            project:          budget.projectName,
            total:            budget.grandTotal,
            currency:         window.displayCurrency,
            sections:         Object.keys(budget.sections).map(function (k) {
                return { name: k, total: budget.sections[k].total, itemCount: budget.sections[k].items.length };
            }),
            documents:        (budget.documents || []).map(function (d) { return { type: d.type, label: d.label }; }),
            attachments:      (budget.attachments || []).map(function (a) { return a.name; }),
            crewSummary:      Object.values(budget.sections).reduce(function (acc, sec) {
                return acc + sec.items.filter(function (i) { return i.crew && i.crew.name; }).length;
            }, 0) + ' assigned',
            previousAnalysis: ((budget.aiContext && budget.aiContext.analysis) || '').substring(0, 1000)
        };

        var prompt = 'Analyze this budget data: ' + JSON.stringify(context) + '. Review financials, logistics (documents), and staffing. Identify 3 risks and 3 savings opportunities. Be concise.';

        if (mBTME.showLoader) mBTME.showLoader('Assistant Analysis in progress..');
        return self.callUnifiedAI(provider, apiKey, prompt).then(function (result) {
            if (mBTME.hideLoader) mBTME.hideLoader();

            if (!budget.aiContext) budget.aiContext = { chat: [], analysis: '' };
            budget.aiContext.analysis = result;
            if (typeof window.saveBudget === 'function') window.saveBudget();

            var formattedResult = self.renderSafeMarkdown(result);
            mBTME.open('aiAnalysis', 'Budget Analysis',
                '<div class="p-6 text-sm leading-relaxed text-slate-700 max-h-[60vh] overflow-y-auto prose prose-sm prose-slate max-w-none">' + formattedResult + '</div>',
                'max-w-2xl');
        });
    },

    /* ── Context Management ─────────────────────────────────────────────── */
    clearContext: function () {
        var budget = window.budget;
        var mBTME  = window.mBTME;
        var self   = this;
        var keepPersist = self.isPersistentContext();
        mBTME.confirm('Clear Memory', 'Clear AI memory and chat history? This cannot be undone.', function () {
            budget.aiContext = { chat: [], analysis: '', saveHistory: keepPersist };
            self.clearStoredAssistantChat(budget);
            if (typeof window.saveBudget === 'function') window.saveBudget();
            var history = document.getElementById('aiChatHistory');
            if (history) history.innerHTML = '<div class="text-center text-slate-400 text-xs mt-10">Memory Cleared. Start fresh.</div>';
            var count = document.getElementById('aiMsgCount');
            if (count) count.textContent = 'Context: 0 msgs';
        });
    },

    exportChat: function () {
        var budget = window.budget;
        var mBTME  = window.mBTME;
        if (!budget.aiContext || !budget.aiContext.chat || !budget.aiContext.chat.length) {
            return mBTME.alert('Export Error', 'No chat history to export.');
        }
        var text = budget.aiContext.chat.map(function (m) {
            return '[' + m.role.toUpperCase() + ']: ' + m.content;
        }).join('\n\n-------------------\n\n');
        var blob = new Blob([text], { type: 'text/plain' });
        if (typeof window.mBTPublisher !== 'undefined' && window.mBTPublisher.io) {
            window.mBTPublisher.io.forceDownload(blob, budget.projectName + '_AI_Chat.txt');
        }
    },

    /* ── AI Chat (Phase 60 + 60.B: Preview & Apply) ─────────────────────── */
    openChat: function () {
        var self      = this;
        var budget    = window.budget;
        var mBTME     = window.mBTME;
        var mBTAssets = window.mBTAssets || {};
        var persist   = self.isPersistentContext();

        if (!budget.aiContext) budget.aiContext = { chat: [], analysis: '' };
        if (persist && !Array.isArray(budget.aiContext.chat)) budget.aiContext.chat = [];

        /* When persistent context is off, use a fresh in-modal thread (not budget.aiContext.chat) */
        var activeChat = persist ? budget.aiContext.chat : [];

        /* Phase 60.B: action diff store — keyed refs prevent JSON injection in onclick attrs */
        window._mbtAIDiffStore = window._mbtAIDiffStore || {};

        var renderMessages = function () {
            return activeChat.map(function (msg) {
                /* The action block is machine payload, not conversation. It is
                   already parsed into the Preview & Apply button, so hide it —
                   otherwise 30 lines of raw JSON bury the actual reply. */
                var shown = (msg.role === 'assistant')
                    ? self._stripActionBlock(msg.content)
                    : msg.content;
                var contentHtml = msg.role === 'assistant'
                    ? self.renderSafeMarkdown(shown)
                    : window.mBT.ui.render.esc(shown);

                /* Phase 60.B: detect action block and add [Preview & Apply] button */
                var actionBtn = '';
                if (msg.role === 'assistant') {
                    var diff = self._parseActionFromResponse(msg.content);
                    if (diff) {
                        var diffKey = 'k_' + Math.abs(msg.content.length * 31 + (diff.mbt_action.charCodeAt(0) || 0));
                        window._mbtAIDiffStore[diffKey] = diff;
                        actionBtn = '<button onclick="window.mBTAIModule.applySuggestion(window._mbtAIDiffStore[\'' + diffKey + '\'])" ' +
                            'class="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-500 active:scale-95 transition-all">' +
                            (mBTAssets.zap || '') + ' Preview &amp; Apply</button>';
                    }
                }

                return '<div class="ai-message ' + msg.role + ' mb-4 p-3 rounded-lg ' +
                    (msg.role === 'user' ? 'bg-blue-50 ml-8 text-right' : 'bg-white border border-slate-100 mr-8') + '">' +
                    '<strong class="block text-[9px] uppercase tracking-widest text-slate-400 mb-1">' + (msg.role === 'user' ? 'You' : 'Assistant') + '</strong>' +
                    '<div class="text-xs leading-relaxed text-slate-700 prose prose-sm max-w-none' + (msg.role === 'user' ? '' : ' prose-headings:text-slate-800 prose-strong:text-slate-900') + '">' + contentHtml + '</div>' +
                    actionBtn +
                    '</div>';
            }).join('');
        };

        var content =
            '<div class="flex flex-col h-[500px] bg-slate-50">' +
                '<div class="flex justify-between items-center px-4 py-2 bg-white border-b border-slate-100 shrink-0">' +
                    '<span id="aiMsgCount" class="text-[9px] font-black uppercase tracking-widest text-slate-400">Context: ' + activeChat.length + ' msgs' + (persist ? '' : ' (session only)') + '</span>' +
                    '<div class="flex gap-2">' +
                        '<button id="aiUndoBtn" onclick="window.mBTAIModule.undoLastSuggestion(); mBT.features.ai.refreshUndoButton();" title="Undo last AI budget change" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all' + (window._mbtAILastBackup ? '' : ' hidden') + '">' + (mBTAssets.undo || '\u21B6') + '</button>' +
                        '<button onclick="mBT.features.ai.exportChat()" title="Export Discussion" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">' + (mBTAssets.file || '') + '</button>' +
                        '<button onclick="mBT.features.ai.clearContext()" title="Clear Memory" class="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">' + (mBTAssets.trash || '') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div id="aiChatHistory" class="flex-grow overflow-y-auto p-4 space-y-2">' +
                    (activeChat.length ? renderMessages() : '<div class="text-center text-slate-400 text-xs mt-10">Start a conversation..</div>') +
                '</div>' +
                '<div class="p-3 bg-white border-t border-slate-100 flex gap-2 shrink-0">' +
                    '<input type="text" id="aiChatInput" class="flex-grow p-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Ask about rates, logistics, or risks.." onkeydown="if(event.key===\'Enter\') document.getElementById(\'aiChatSendBtn\').click()">' +
                    '<button id="aiChatSendBtn" class="p-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-500 transition-all w-12 flex items-center justify-center shrink-0">' + (mBTAssets.paperPlane || '&rarr;') + '</button>' +
                '</div>' +
            '</div>';

        mBTME.open('aiChat', 'Discussions', content, 'max-w-lg', { noPadding: true });

        var historyEl = document.getElementById('aiChatHistory');
        if (historyEl) setTimeout(function () { historyEl.scrollTop = historyEl.scrollHeight; }, 10);

        setTimeout(function () {
            var btn   = document.getElementById('aiChatSendBtn');
            var input = document.getElementById('aiChatInput');
            if (btn && input) {
                btn.onclick = function () {
                    var text = input.value.trim();
                    if (!text) return;

                    activeChat.push({ role: 'user', content: text });
                    if (persist && typeof window.saveBudget === 'function') window.saveBudget();
                    input.value = '';

                    var history = document.getElementById('aiChatHistory');
                    history.innerHTML = renderMessages() + '<div class="ai-message assistant animate-pulse p-3 bg-white border border-slate-100 mr-8 rounded-lg"><div class="text-xs text-slate-400">Analyzing..</div></div>';
                    history.scrollTop = history.scrollHeight;

                    var count = document.getElementById('aiMsgCount');
                    if (count) count.textContent = 'Context: ' + activeChat.length + ' msgs' + (persist ? '' : ' (session only)');

                    var provider = self.getSelectedProvider();
                    var apiKey   = self.getStoredApiKey(provider);

                    if (!apiKey) {
                        if (history.lastElementChild) history.lastElementChild.innerHTML = '<div class="text-rose-500 text-xs">Error: API Key missing. Check Settings.</div>';
                        return;
                    }

                    var docList      = (budget.documents || []).map(function (d) { return d.label; }).join(', ');
                    var attachList   = (budget.attachments || []).map(function (a) { return a.name; }).join(', ');
                    var prevAnalysis = ((budget.aiContext && budget.aiContext.analysis) || 'None').substring(0, 500);
                    /* Docs/attachments/last-analysis ride along; the budget itself
                       now goes in the system message via _buildBudgetContext. */
                    var contextSummary = 'Docs=[' + docList + '], Attachments=[' + attachList + '], Last Analysis Summary="' + prevAnalysis + '"';
                    var apiHistory = [];
                    var finalPrompt = text;
                    if (persist && activeChat.length > 1) {
                        apiHistory = activeChat.slice(0, -1).map(function (m) {
                            return { role: m.role, content: m.content };
                        });
                    } else {
                        finalPrompt = '[' + contextSummary + ']\n\nUser Query: ' + text;
                    }

                    /* Phase 60.B: inject action-trigger capability into chat system prompt */
                    /* Put the live budget in the system message so it survives on
                       every turn — the old code dropped context once a saved
                       conversation had history, leaving the AI blind mid-chat. */
                    var budgetCtx = self._buildBudgetContext();
                    var rateCtx   = self._buildRateContext(text);
                    var chatSystemMsg = self.config.systemContext + '\n\n' + self.config.chatActionPrompt;
                    if (budgetCtx) chatSystemMsg += '\n\n' + budgetCtx;
                    if (rateCtx)   chatSystemMsg += '\n\n' + rateCtx;
                    return self.callUnifiedAI(provider, apiKey, finalPrompt, chatSystemMsg, apiHistory).then(function (response) {
                        /* callUnifiedAI swallows rejections into Analysis Failed: strings */
                        if (typeof response === 'string' && response.indexOf('Analysis Failed:') === 0) {
                            var failMsg = response.replace('Analysis Failed: ', '');
                            if (history.lastElementChild) {
                                var _esc = (window.mBT && window.mBT.ui && window.mBT.ui.render && window.mBT.ui.render.esc) ? window.mBT.ui.render.esc(failMsg) : String(failMsg).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                history.lastElementChild.innerHTML = '<div class="text-rose-500 text-xs">Error: ' + _esc + '</div>';
                            }
                            return;
                        }
                        activeChat.push({ role: 'assistant', content: response });
                        if (persist && typeof window.saveBudget === 'function') window.saveBudget();
                        history.innerHTML = renderMessages();
                        history.scrollTop = history.scrollHeight;
                        if (count) count.textContent = 'Context: ' + activeChat.length + ' msgs' + (persist ? '' : ' (session only)');
                    });
                };
                input.focus();
            }
        }, 50);
    },

    /* ── Persona & Rules Modal (Phase 58.2) ─────────────────────────────── */
    /* ── Phase 144: Sourcing Analysis — AI Interview Wizard ─────────────── */
    /* Generates a Funding Strategy document via AI analysis of live budget funding
       sources, then sends the result to the publisher iframe via SmartFill bridge. */
    openSourcingAnalysis: function () {
        var self             = this;
        var budget           = window.budget;
        var mBTME            = window.mBTME;
        var displayCurrency  = window.displayCurrency || 'JMD';
        var storageKeyPrefix = window.storageKeyPrefix || '';

        if (!budget) { mBTME.alert('No Project', 'Load a project before running Sourcing Analysis.'); return; }

        var provider = self.getSelectedProvider();
        var apiKey   = self.getStoredApiKey(provider);
        if (!apiKey) { mBTME.alert('Assistant Offline', 'Configure an API key in AI settings.'); return; }

        /* Build funding context from live budget */
        var sources     = (budget.fundingSources || []).filter(function (f) { return f.name; });
        var totalFunding = sources.reduce(function (s, f) { return s + (parseFloat(f.amount) || 0); }, 0);
        var totalBudget  = budget.grandTotal || budget.subtotal || 0;
        var gap          = totalBudget - totalFunding;

        var sourcesText = sources.length
            ? sources.map(function (f) { return '- ' + f.name + ' | Status: ' + (f.status || 'Pending') + ' | Amount: ' + (parseFloat(f.amount) || 0) + ' ' + displayCurrency; }).join('\n')
            : 'No funding sources defined yet.';

        var prompt =
            'PROJECT: ' + (budget.projectName || 'Untitled') + '\n' +
            'FORMAT: ' + (budget.format || 'Feature Film') + '\n' +
            'TOTAL BUDGET: ' + totalBudget + ' ' + displayCurrency + '\n' +
            'SECURED FUNDING: ' + totalFunding + ' ' + displayCurrency + '\n' +
            'FUNDING GAP: ' + (gap > 0 ? gap + ' ' + displayCurrency : 'None — fully covered') + '\n' +
            'SOURCES:\n' + sourcesText + '\n\n' +
            'Generate a concise Funding Strategy document. Output a raw JSON object with these exact keys:\n' +
            '- execSummary: 1-2 paragraph project pitch and financing goals\n' +
            '- sourcingApproach: how each funding source was identified and how to close them\n' +
            '- investorProfile: ideal investor type and motivation for this project\n' +
            '- fundingTimeline: key milestones to close the funding gap\n' +
            '- askDetails: what is being offered to investors (equity %, licensing, co-production terms)\n' +
            '- riskMitigation: how financing risks (gap, currency, timeline) are managed\n\n' +
            'IMPORTANT: Output raw JSON only. No markdown fences, no preamble, no explanation.';

        var systemMsg = 'ROLE: Film Finance Strategist specializing in Caribbean and independent productions. OUTPUT: Raw JSON object only. No code fences, no intro text. Keys: execSummary, sourcingApproach, investorProfile, fundingTimeline, askDetails, riskMitigation. Values: concise plain-text strings (1-2 paragraphs each).';

        mBTME.close('aiToolsModal');
        mBTME.alert('Sourcing Analysis Running', 'AI is generating your Funding Strategy. The publisher will update when ready.');

        return self.callUnifiedAI(provider, apiKey, prompt, systemMsg).then(function (response) {
            /* callUnifiedAI returns Analysis Failed: strings instead of rejecting */
            if (typeof response === 'string' && response.indexOf('Analysis Failed:') === 0) {
                mBTME.alert('Analysis Failed', response.replace('Analysis Failed: ', '') || 'AI request failed.');
                return;
            }
            var editorData = {};
            try {
                editorData = JSON.parse(response.trim());
            } catch (e) {
                /* Fallback: extract JSON block if AI prefaced with text */
                var jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try { editorData = JSON.parse(jsonMatch[0]); } catch (e2) {
                        editorData = { execSummary: response };
                    }
                } else {
                    editorData = { execSummary: response };
                }
            }

            /* Merge project identity fields */
            editorData.productionTitle = budget.projectName || '';
            editorData.contactName     = budget.producerName  || '';
            editorData.contactEmail    = budget.producerEmail || '';

            /* Open publisher tool */
            if (typeof window.openTool === 'function') {
                window.openTool('./src/tools/publisher/index.html?projectKey=' + encodeURIComponent(storageKeyPrefix + (budget.projectName || '')) + '&currency=' + encodeURIComponent(displayCurrency) + '&embedded=true');
            }

            /* After iframe load delay, send SmartFill payload */
            setTimeout(function () {
                var toolIframe = document.querySelector('[data-modal-id="tool-window"] iframe, #global-modal-container iframe');
                if (toolIframe && toolIframe.contentWindow) {
                    toolIframe.contentWindow.postMessage({
                        type: 'SMARTFILL_DATA',
                        templateId: 'fundingStrategy',
                        payload: {
                            templateId: 'fundingStrategy',
                            label: 'Sourcing Analysis',
                            editorData: editorData
                        }
                    }, window.location.origin);
                }
            }, 1500);
        }).catch(function (err) {
            var em = (err && err.message) || 'AI request failed. Check your API key and connection.';
            if (em === 'AI_RATE_LIMITED') em = 'Wait a few seconds before another AI request.';
            mBTME.alert('Analysis Failed', em);
        });
    },

    /* ── OpenRouter: Fetch available models ────────────────────────────── */
    fetchGeminiModels: function (apiKey) {
        return fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey)
            .then(function (res) {
                if (!res.ok) throw new Error('Gemini models fetch failed: ' + res.status);
                return res.json();
            }).then(function (data) {
                var models = [];
                var items = data.models || [];
                for (var i = 0; i < items.length; i++) {
                    var m = items[i];
                    var isChat = m.supportedGenerationMethods && m.supportedGenerationMethods.indexOf('generateContent') !== -1;
                    var isImage = (m.name || '').indexOf('imagen') !== -1;
                    if (!isChat && !isImage) continue;
                    var id = (m.name || '').replace('models/', '');
                    if (!id) continue;
                    models.push({ id: id, name: m.displayName || id });
                }
                /* Sort by known cost tier: flash-lite < flash < pro < ultra/deep-research/exp */
                function _geminiTier(id) {
                    var s = (id || '').toLowerCase();
                    if (s.indexOf('deep-research') !== -1) return 5;
                    if (s.indexOf('ultra') !== -1)         return 4;
                    if (s.indexOf('pro-exp') !== -1 || s.indexOf('2.5-pro') !== -1) return 3;
                    if (s.indexOf('pro') !== -1)           return 2;
                    if (s.indexOf('flash-lite') !== -1)    return 0;
                    if (s.indexOf('flash') !== -1)         return 1;
                    return 3;
                }
                models.sort(function (a, b) {
                    var ta = _geminiTier(a.id), tb = _geminiTier(b.id);
                    if (ta !== tb) return ta - tb;
                    return (a.id || '').localeCompare(b.id || '');
                });
                return models;
            });
    },

    fetchOpenRouterModels: function (apiKey) {
        return fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': 'Bearer ' + apiKey, 'HTTP-Referer': window.location.origin, 'X-Title': 'mBT' }
        }).then(function (res) {
            if (!res.ok) throw new Error('OpenRouter models fetch failed: ' + res.status);
            return res.json();
        }).then(function (data) {
            var models = (data.data || []).map(function (m) {
                var promptPrice = parseFloat((m.pricing && m.pricing.prompt) || '0');
                return { id: m.id, name: m.name || m.id, free: promptPrice === 0, price: promptPrice };
            });
            /* Sort cheapest first: free ($0) at top, then ascending by prompt price */
            models.sort(function (a, b) {
                if (a.price !== b.price) return a.price - b.price;
                return (a.id || '').localeCompare(b.id || '');
            });
            return models;
        });
    },

    openPersonaModal: function () {
        var self  = this;
        var mBTME = window.mBTME;
        var content =
            '<div class="p-5 space-y-4">' +
                '<div class="bg-slate-900 rounded-xl p-4 space-y-3">' +
                    '<div><label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Persona &amp; Behavioral Rules</label>' +
                    '<textarea id="personaPromptInput" class="w-full bg-slate-800 text-white border-none rounded-lg p-3 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-28 placeholder-slate-600" ' +
                    'placeholder="e.g. You are a Jamaican film producer. Focus only on Below The Line costs. Always use JMD. Be concise.">' + window.mBT.ui.render.esc(self.getSystemPrompt()) + '</textarea></div>' +
                    '<p class="text-[8px] text-slate-500 font-bold">These rules are prepended to every AI request as system-level constraints. Leave blank for default behavior.</p>' +
                '</div>' +
                '<div class="flex gap-2">' +
                    '<button onclick="mBT.features.ai.saveSystemPrompt(document.getElementById(\'personaPromptInput\').value); mBTME.close(\'personaModal\'); mBTME.alert(\'Saved\', \'Persona rules updated.\');" class="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-indigo-500 transition-all">Save Rules</button>' +
                    '<button onclick="document.getElementById(\'personaPromptInput\').value=\'\'; mBT.features.ai.saveSystemPrompt(\'\'); mBTME.close(\'personaModal\'); mBTME.alert(\'Cleared\', \'AI persona reset to default.\');" class="px-4 bg-slate-100 text-slate-500 py-3 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-slate-200 transition-all">Reset</button>' +
                '</div>' +
            '</div>';
        mBTME.open('persona', 'AI Persona', content, 'max-w-sm');
    },

    /* ── Tools Dashboard ────────────────────────────────────────────────── */
    openTools: function () {
        var self      = this;
        var mBTME     = window.mBTME;
        var mBTAssets = window.mBTAssets || {};
        var apiKey      = self.getStoredApiKey(self.getSelectedProvider());
        var statusColor = apiKey ? 'text-emerald-500' : 'text-rose-500';
        var statusText  = apiKey ? 'Online' : 'Offline';

        var content =
            '<div class="grid grid-cols-2 gap-4 p-4">' +
                '<button onclick="mBT.features.ai.analyzeCurrentBudget(); mBTME.close(\'aiToolsModal\');" class="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col items-center gap-2 hover:bg-indigo-100 transition-all group">' +
                    '<div class="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-all">' + (mBTAssets.doctor || '') + '</div>' +
                    '<div class="text-center"><h4 class="font-black text-[10px] uppercase tracking-widest text-slate-700">Budget Analysis</h4><p class="text-[8px] text-slate-400 font-bold">Deep Scan</p></div>' +
                '</button>' +
                '<button onclick="mBT.features.ai.openChat(); mBTME.close(\'aiToolsModal\');" class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center gap-2 hover:bg-emerald-100 transition-all group">' +
                    '<div class="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-all">' + (mBTAssets.chat || '') + '</div>' +
                    '<div class="text-center"><h4 class="font-black text-[10px] uppercase tracking-widest text-slate-700">Discussions</h4><p class="text-[8px] text-slate-400 font-bold">Chat &amp; Consult</p></div>' +
                '</button>' +
                '<button onclick="mBTME.close(\'aiToolsModal\'); openTool(\'./src/tools/ai/index.html?projectKey=\' + encodeURIComponent(storageKeyPrefix + (budget ? budget.projectName : \'\')) + \'&mode=generate\');" class="col-span-2 p-4 bg-violet-50 border border-violet-200 rounded-2xl flex items-center gap-3 hover:bg-violet-100 transition-all group">' +
                    '<div class="w-10 h-10 bg-white rounded-full shadow-sm flex-shrink-0 flex items-center justify-center text-violet-500 group-hover:scale-110 transition-all">' + (mBTAssets.wand || '') + '</div>' +
                    '<div class="text-left"><h4 class="font-black text-[10px] uppercase tracking-widest text-slate-700">Generate Budget</h4><p class="text-[8px] text-slate-400 font-bold">Describe a production \u2014 AI builds the full structure</p></div>' +
                '</button>' +
                '<button onclick="mBT.features.ai.openSourcingAnalysis();" class="col-span-2 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 hover:bg-emerald-100 transition-all group">' +
                    '<div class="w-10 h-10 bg-white rounded-full shadow-sm flex-shrink-0 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-all"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>' +
                    '<div class="text-left"><h4 class="font-black text-[10px] uppercase tracking-widest text-slate-700">Sourcing Analysis</h4><p class="text-[8px] text-slate-400 font-bold">AI generates a Funding Strategy document from your live budget data</p></div>' +
                '</button>' +
            '</div>' +
            '<div class="px-4 pb-4 space-y-2">' +
                '<button onclick="mBT.features.ai.openPersonaModal(); mBTME.close(\'aiToolsModal\');" class="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-between hover:border-indigo-500 transition-all group">' +
                    '<div class="flex items-center gap-3"><div class="w-8 h-8 bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-400">' + (mBTAssets.wand || '') + '</div>' +
                    '<div class="text-left"><h4 class="font-black text-[9px] uppercase tracking-widest text-white">Persona &amp; Rules</h4><p class="text-[8px] font-bold text-slate-500 mt-0.5">Customize AI behavior &amp; constraints</p></div></div>' +
                    '<span class="text-slate-600 group-hover:text-indigo-400">\u2192</span>' +
                '</button>' +
                '<button onclick="showSettingsModal(\'ai\'); mBTME.close(\'aiToolsModal\');" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-white transition-all group">' +
                    '<div class="flex items-center gap-3"><div class="w-8 h-8 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400">' + (mBTAssets.gear || '') + '</div>' +
                    '<div class="text-left"><h4 class="font-black text-[9px] uppercase tracking-widest text-slate-700">Configuration</h4><p class="text-[8px] font-bold ' + statusColor + ' mt-0.5">' + statusText + '</p></div></div>' +
                    '<span class="text-slate-300 group-hover:text-blue-500">\u2192</span>' +
                '</button>' +
            '</div>';

        mBTME.open('aiTools', 'Assistant', content, 'max-w-sm');
    }

};
