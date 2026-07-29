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

    /* ── Conversation threads (data layer) ────────────────────────────────
       budget.aiContext.chat was a single {role,content}[] per project.
       Threads hold many conversations. Migration wraps legacy chat once
       and keeps the chat key for one release so rollback cannot lose data. */

    _makeThreadId: function () {
        return 'thr_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    },

    /* Title from first user message, 60 chars max. Fallback for empty. */
    _titleFromMessages: function (messages) {
        var i, m, t;
        if (!messages || !messages.length) return 'New conversation';
        for (i = 0; i < messages.length; i++) {
            m = messages[i];
            if (m && m.role === 'user' && m.content) {
                t = String(m.content).replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
                if (!t) continue;
                if (t.length > 60) t = t.substring(0, 60);
                return t;
            }
        }
        return 'New conversation';
    },

    _touchThread: function (thread) {
        if (!thread) return;
        thread.updated = Date.now();
        if (!thread.title) {
            thread.title = this._titleFromMessages(thread.messages || []);
        }
    },

    /* Idempotent. Safe to run on every load or access.
       If threads already exists, never re-wrap chat (would duplicate). */
    _migrateAiContext: function (budget) {
        var ctx, msgs, thr, now, title;
        if (!budget) return;
        if (!budget.aiContext || typeof budget.aiContext !== 'object') {
            budget.aiContext = {
                chat: [],
                threads: [],
                analysis: '',
                activeThreadId: null
            };
            return;
        }
        ctx = budget.aiContext;

        /* Already on threads shape: do not migrate again. */
        if (Array.isArray(ctx.threads)) {
            if (!ctx.activeThreadId && ctx.threads.length && ctx.threads[0]) {
                ctx.activeThreadId = ctx.threads[0].id;
            }
            if (!Array.isArray(ctx.chat)) ctx.chat = [];
            return;
        }

        /* Legacy: chat array present, threads absent. Wrap once. Keep chat. */
        now = Date.now();
        msgs = Array.isArray(ctx.chat) ? ctx.chat.slice() : [];
        title = msgs.length ? this._titleFromMessages(msgs) : '';
        if (title === 'New conversation' && !msgs.length) title = '';
        thr = {
            id: this._makeThreadId(),
            title: title,
            created: now,
            updated: now,
            changeCount: 0,
            messages: msgs
        };
        ctx.threads = [thr];
        ctx.activeThreadId = thr.id;
        if (!Array.isArray(ctx.chat)) ctx.chat = [];
        /* Leave ctx.chat in place for one-release rollback safety. */
    },

    _ensureAiContext: function (budget) {
        var b = budget || window.budget;
        if (!b) return null;
        this._migrateAiContext(b);
        return b.aiContext;
    },

    /* Thread array, newest first. Creates container if absent. */
    _threads: function () {
        var ctx = this._ensureAiContext(window.budget);
        if (!ctx) return [];
        if (!Array.isArray(ctx.threads)) ctx.threads = [];
        return ctx.threads;
    },

    /* Open thread. Creates one if none exist. */
    _activeThread: function () {
        var ctx = this._ensureAiContext(window.budget);
        var threads, i, id;
        if (!ctx) return null;
        threads = this._threads();
        id = ctx.activeThreadId;
        if (id) {
            for (i = 0; i < threads.length; i++) {
                if (threads[i] && threads[i].id === id) {
                    if (!Array.isArray(threads[i].messages)) threads[i].messages = [];
                    return threads[i];
                }
            }
        }
        if (threads.length && threads[0]) {
            ctx.activeThreadId = threads[0].id;
            if (!Array.isArray(threads[0].messages)) threads[0].messages = [];
            return threads[0];
        }
        return this.newThread();
    },

    newThread: function () {
        var ctx = this._ensureAiContext(window.budget);
        var now = Date.now();
        var thr;
        if (!ctx) return null;
        thr = {
            id: this._makeThreadId(),
            title: '',
            created: now,
            updated: now,
            changeCount: 0,
            messages: []
        };
        if (!Array.isArray(ctx.threads)) ctx.threads = [];
        ctx.threads.unshift(thr);
        ctx.activeThreadId = thr.id;
        if (typeof window.saveBudget === 'function') window.saveBudget();
        return thr;
    },

    switchThread: function (id) {
        var threads = this._threads();
        var ctx, i;
        if (!id || !window.budget || !window.budget.aiContext) return null;
        ctx = window.budget.aiContext;
        for (i = 0; i < threads.length; i++) {
            if (threads[i] && threads[i].id === id) {
                ctx.activeThreadId = id;
                if (typeof window.saveBudget === 'function') window.saveBudget();
                return threads[i];
            }
        }
        return null;
    },

    deleteThread: function (id) {
        var threads = this._threads();
        var ctx = window.budget && window.budget.aiContext;
        var i, wasActive;
        if (!ctx || !id) return null;
        wasActive = (ctx.activeThreadId === id);
        for (i = 0; i < threads.length; i++) {
            if (threads[i] && threads[i].id === id) {
                threads.splice(i, 1);
                break;
            }
        }
        if (wasActive) {
            if (threads.length && threads[0]) {
                ctx.activeThreadId = threads[0].id;
            } else {
                return this.newThread();
            }
        }
        if (typeof window.saveBudget === 'function') window.saveBudget();
        return true;
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
       and any failure restores it, so a half-applied batch is impossible.
       Preview confirms inline inside the chat panel (Expanded and PiP). */
    applySuggestion: function (diff) {
        if (!diff || !diff.mbt_action) return;
        var self = this;
        var budget = window.budget;
        var mBTME = window.mBTME;
        if (!budget) return mBTME.alert('Error', 'No budget loaded.');

        var changes = (diff.mbt_action === 'batch' && diff.changes && diff.changes.length)
            ? diff.changes
            : [diff];

        /* Prefer inline confirm when chat is open; open chat if needed. */
        if (!self._chatSession || !self._chatSession.root || !document.body.contains(self._chatSession.root)) {
            self.openChat();
        }
        if (self._chatSession) {
            self._chatSession.pendingDiff = { diff: diff, changes: changes };
            if (typeof self._chatRender === 'function') self._chatRender();
            return;
        }

        /* Fallback if chat host failed to mount. */
        var esc = (window.mBT && window.mBT.ui && window.mBT.ui.render && window.mBT.ui.render.esc)
            ? window.mBT.ui.render.esc
            : function (v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        var i, rows = [];
        for (i = 0; i < changes.length; i++) {
            rows.push('<li style="margin:0 0 4px 0;">' + esc(self._describeChange(changes[i])) + '</li>');
        }
        var title = changes.length > 1 ? ('Preview ' + changes.length + ' Changes') : 'Preview Change';
        var body = '<div style="text-align:left;max-height:260px;overflow-y:auto;margin:0 0 8px 0;"><ol style="margin:0;padding-left:18px;font-size:11px;line-height:1.5;color:#475569;">' + rows.join('') + '</ol></div><span style="font-weight:800;">Apply to the budget?</span>';
        mBTME.confirm(title, body, function () { self._commitSuggestion(changes); });
    },

    /* Run the apply path after the user confirms (inline or fallback). */
    _commitSuggestion: function (changes) {
        var self = this;
        var budget = window.budget;
        var mBTME = window.mBTME;
        var mBTLE = window.mBTLE;
        if (!budget || !changes || !changes.length) return;

        var backup;
        try {
            backup = JSON.stringify({
                sections: budget.sections,
                contingencyPercentage: budget.contingencyPercentage
            });
        } catch (e) { backup = null; }

        var errors = [];
        var j;
        for (j = 0; j < changes.length; j++) {
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

        try {
            var thr = self._activeThread();
            if (thr) {
                thr.changeCount = (parseInt(thr.changeCount, 10) || 0) + changes.length;
                thr.updated = Date.now();
            }
        } catch (eThr) { /* ignore thread counter errors */ }

        if (typeof window.saveBudget === 'function') window.saveBudget();
        if (mBTLE && typeof mBTLE.reconcile === 'function') mBTLE.reconcile();
        if (typeof window.forceSectionRebuild === 'function') window.forceSectionRebuild();
        if (typeof window.render === 'function') window.render();

        if (typeof self.refreshUndoButton === 'function') self.refreshUndoButton();

        if (self._chatSession) {
            self._chatSession.pendingDiff = null;
            if (typeof self._chatRender === 'function') self._chatRender();
        }

        mBTME.alert('Applied', changes.length === 1
            ? 'Budget updated.'
            : (changes.length + ' changes applied. Use the undo arrow in chat to reverse.'));
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
        if (this._chatSession && typeof this._chatRender === 'function') this._chatRender();
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

            self._ensureAiContext(budget);
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
        mBTME.confirm('Clear Conversation', 'Clear this conversation? Other conversations are kept. This cannot be undone.', function () {
            var thr = self._activeThread();
            if (thr) {
                thr.messages = [];
                thr.title = '';
                thr.changeCount = 0;
                thr.updated = Date.now();
            }
            self.clearStoredAssistantChat(budget);
            if (typeof window.saveBudget === 'function') window.saveBudget();
            if (self._chatSession) {
                self._chatSession.activeChat = thr ? thr.messages : [];
                self._chatSession.activeThread = thr;
                self._chatSession.pendingDiff = null;
                self._chatSession.lastFailedText = '';
                if (typeof self._chatRender === 'function') self._chatRender();
            }
        });
    },

    exportChat: function () {
        var budget = window.budget;
        var mBTME  = window.mBTME;
        var thr = this._activeThread();
        var msgs = thr && thr.messages;
        if (!msgs || !msgs.length) {
            return mBTME.alert('Export Error', 'No chat history to export.');
        }
        var text = msgs.map(function (m) {
            return '[' + m.role.toUpperCase() + ']: ' + m.content;
        }).join('\n\n-------------------\n\n');
        var blob = new Blob([text], { type: 'text/plain' });
        if (typeof window.mBTPublisher !== 'undefined' && window.mBTPublisher.io) {
            window.mBTPublisher.io.forceDownload(blob, budget.projectName + '_AI_Chat.txt');
        }
    },

    closeChat: function () {
        var sess = this._chatSession;
        if (!sess) return;
        sess.inflight = false;
        sess.genId = (sess.genId || 0) + 1;
        if (sess.root && sess.root.parentNode) sess.root.parentNode.removeChild(sess.root);
        this._chatSession = null;
        document.body.style.overflow = '';
    },

    /* ── AI Chat: Expanded + PiP (Build 2) ───────────────────────────────── */
    openChat: function () {
        var self = this;
        var budget = window.budget;
        var mBTME = window.mBTME;
        var mBTAssets = window.mBTAssets || {};
        var persist = self.isPersistentContext();

        if (!budget) {
            if (mBTME && mBTME.alert) mBTME.alert('No Project', 'Load a project before opening Assistant.');
            return;
        }

        self._ensureAiContext(budget);
        window._mbtAIDiffStore = window._mbtAIDiffStore || {};

        /* Registry + persistence helpers */
        if (!window.mBT) window.mBT = {};
        if (!window.mBT.registry) window.mBT.registry = {};

        function esc(v) {
            if (window.mBT && window.mBT.ui && window.mBT.ui.render && window.mBT.ui.render.esc) {
                return window.mBT.ui.render.esc(v);
            }
            return String(v == null ? '' : v)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        function readMode() {
            var m = window.mBT.registry.chatMode || localStorage.getItem('mbt_chat_mode') || 'expanded';
            if (m !== 'pip' && m !== 'expanded') m = 'expanded';
            window.mBT.registry.chatMode = m;
            return m;
        }

        function writeMode(m) {
            if (m !== 'pip' && m !== 'expanded') m = 'expanded';
            window.mBT.registry.chatMode = m;
            try { localStorage.setItem('mbt_chat_mode', m); } catch (e) {}
            if (self._chatSession) self._chatSession.mode = m;
        }

        function readDrawer(key, fallback) {
            try {
                var v = localStorage.getItem(key);
                if (v === '0' || v === 'false') return false;
                if (v === '1' || v === 'true') return true;
            } catch (e) {}
            return fallback;
        }

        function writeDrawer(key, open) {
            try { localStorage.setItem(key, open ? '1' : '0'); } catch (e) {}
        }

        function readPipPos() {
            try {
                var raw = localStorage.getItem('mbt_chat_pip_pos');
                if (raw) {
                    var p = JSON.parse(raw);
                    if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
                }
            } catch (e) {}
            return { x: Math.max(14, (window.innerWidth || 800) - 344), y: 14 };
        }

        function writePipPos(pos) {
            try { localStorage.setItem('mbt_chat_pip_pos', JSON.stringify({ x: pos.x, y: pos.y })); } catch (e) {}
        }

        function relTime(ts) {
            if (!ts) return '';
            var diff = Date.now() - ts;
            if (diff < 0) diff = 0;
            var sec = Math.floor(diff / 1000);
            if (sec < 60) return 'just now';
            var min = Math.floor(sec / 60);
            if (min < 60) return min === 1 ? '1 min ago' : (min + ' min ago');
            var hr = Math.floor(min / 60);
            if (hr < 24) return hr === 1 ? '1 hour ago' : (hr + ' hours ago');
            var day = Math.floor(hr / 24);
            if (day === 1) return 'yesterday';
            if (day < 7) return day + ' days ago';
            if (day < 14) return '1 week ago';
            if (day < 30) return Math.floor(day / 7) + ' weeks ago';
            return Math.floor(day / 30) + ' mo ago';
        }

        function fmtMoney(n) {
            var cur = window.displayCurrency || 'JMD';
            var v = parseFloat(n);
            if (isNaN(v)) v = 0;
            try {
                if (window.mBTLE && window.mBTLE.format && typeof window.mBTLE.format.currency === 'function') {
                    return window.mBTLE.format.currency(v, cur);
                }
            } catch (e) {}
            try {
                return cur + ' ' + Math.round(v).toLocaleString();
            } catch (e2) {
                return cur + ' ' + Math.round(v);
            }
        }

        function fmtPlain(n) {
            var v = parseFloat(n);
            if (isNaN(v)) v = 0;
            try { return Math.round(v).toLocaleString(); } catch (e) { return String(Math.round(v)); }
        }

        function activeThreadAndChat() {
            var thr = persist ? self._activeThread() : null;
            var chat = (persist && thr) ? thr.messages : (self._chatSession && self._chatSession.sessionOnlyChat) || [];
            if (!persist) {
                if (!self._chatSession) self._chatSession = {};
                if (!self._chatSession.sessionOnlyChat) self._chatSession.sessionOnlyChat = chat;
                chat = self._chatSession.sessionOnlyChat;
            }
            if (!Array.isArray(chat)) chat = [];
            return { thread: thr, chat: chat };
        }

        function modelName() {
            var provider = self.getSelectedProvider();
            var ma = window.mBTAssistant;
            if (ma && typeof ma.getChatModel === 'function') {
                return ma.getChatModel(provider) || provider;
            }
            try {
                return localStorage.getItem('mbt_ai_chat_model_' + provider) || provider;
            } catch (e) { return provider; }
        }

        function liveDotClass() {
            var provider = self.getSelectedProvider();
            var map = (window.mBT.registry && window.mBT.registry.connStatus) || {};
            var st = map[provider];
            if (st && st.state === 'live') return 'bg-emerald-500';
            if (st && st.state === 'rejected') return 'bg-rose-500';
            if (st && st.state === 'checking') return 'bg-amber-400';
            return 'bg-slate-300';
        }

        function budgetStats() {
            var sections = (budget && budget.sections) || {};
            var names = Object.keys(sections);
            var lineCount = 0;
            var noRate = 0;
            var largestName = '';
            var largestTotal = 0;
            var rows = [];
            var i, n, sec, items, t, j, it, rate;
            for (i = 0; i < names.length; i++) {
                n = names[i];
                sec = sections[n] || {};
                items = sec.items || [];
                lineCount += items.length;
                t = parseFloat(sec.total);
                if (isNaN(t)) {
                    t = 0;
                    for (j = 0; j < items.length; j++) {
                        t += parseFloat(items[j].total) || 0;
                    }
                }
                rows.push({ name: n, total: t });
                if (t > largestTotal) {
                    largestTotal = t;
                    largestName = n;
                }
                for (j = 0; j < items.length; j++) {
                    it = items[j];
                    rate = parseFloat(it.rate);
                    if (!rate || isNaN(rate)) noRate++;
                }
            }
            rows.sort(function (a, b) { return b.total - a.total; });

            var grand = parseFloat(budget.grandTotal);
            if (isNaN(grand)) grand = 0;
            var contPct = parseFloat(budget.contingencyPercentage);
            if (isNaN(contPct)) contPct = 0;
            var contCash = grand * (contPct / 100);
            var largestPct = grand > 0 ? ((largestTotal / grand) * 100) : 0;

            /* Secured / Pipeline / Gap (same rules as funding card) */
            var sources = budget.fundingSources || [];
            var sumConfirmed = 0, sumPending = 0, sumLOI = 0;
            var si, st, amt;
            for (si = 0; si < sources.length; si++) {
                amt = parseFloat(sources[si].amount) || 0;
                st = sources[si].status || '';
                if (st === 'Confirmed') sumConfirmed += amt;
                else if (st === 'LOI') sumLOI += amt;
                else sumPending += amt;
            }
            var pipeline = sumPending + sumLOI;
            var gap = grand - (sumConfirmed + pipeline);
            var denom = grand > 0 ? grand : 1;
            var pctSec = Math.max(0, (sumConfirmed / denom) * 100);
            var pctPipe = Math.max(0, (pipeline / denom) * 100);
            var pctGap = Math.max(0, (Math.max(0, gap) / denom) * 100);
            var totalPct = pctSec + pctPipe + pctGap;
            if (totalPct > 100 && totalPct > 0) {
                pctSec = pctSec * 100 / totalPct;
                pctPipe = pctPipe * 100 / totalPct;
                pctGap = pctGap * 100 / totalPct;
            }

            var attachN = (budget.attachments || []).length;
            var msgN = 0;
            try {
                var ac = activeThreadAndChat();
                msgN = (ac.chat && ac.chat.length) || 0;
            } catch (e) {}

            var rateMatched = 0;
            try {
                if (window.mBTOG && window.mBTOG.rates) rateMatched = Math.min(60, window.mBTOG.rates.length);
            } catch (e2) {}

            return {
                projectName: budget.projectName || 'Untitled',
                sectionCount: names.length,
                lineCount: lineCount,
                grand: grand,
                rows: rows,
                largestName: largestName || 'None',
                largestTotal: largestTotal,
                largestPct: largestPct,
                contPct: contPct,
                contCash: contCash,
                noRate: noRate,
                sumConfirmed: sumConfirmed,
                pipeline: pipeline,
                gap: gap,
                pctSec: pctSec,
                pctPipe: pctPipe,
                pctGap: pctGap,
                attachN: attachN,
                msgN: msgN,
                rateMatched: rateMatched
            };
        }

        function icon(name, fallback) {
            return mBTAssets[name] || fallback || '';
        }

        /* ── Render pieces ─────────────────────────────────────────────── */

        function renderMessagesHtml(chat, isPip) {
            var padL = isPip ? 'ml-6' : 'ml-12 sm:ml-24 md:ml-40';
            var padR = isPip ? 'mr-6' : 'mr-12 sm:mr-24 md:mr-40';
            var bubblePad = isPip ? 'p-2' : 'p-3.5';
            var html = [];
            var i, msg, shown, contentHtml, actionBtn, diff, diffKey, roleCls;

            if (!chat || !chat.length) {
                return renderEmptyHtml(isPip);
            }

            for (i = 0; i < chat.length; i++) {
                msg = chat[i];
                if (!msg) continue;
                if (msg._error) {
                    html.push(
                        '<div class="' + padR + ' ' + bubblePad + ' rounded-xl bg-rose-50 border border-rose-200">' +
                            '<div class="text-[10px] font-bold text-rose-800 mb-2">' + esc(msg.content || 'Request failed.') + '</div>' +
                            '<div class="flex items-center gap-3">' +
                                '<button type="button" data-chat-act="retry" data-retry="' + esc(msg.retryText || '') + '" class="inline-flex items-center px-2.5 py-1.5 bg-rose-600 text-white text-[8px] font-black uppercase tracking-widest rounded">Retry</button>' +
                                '<button type="button" data-chat-act="connections" class="text-[9px] font-bold text-rose-700 underline underline-offset-2">Check connections</button>' +
                            '</div>' +
                        '</div>'
                    );
                    continue;
                }
                shown = (msg.role === 'assistant') ? self._stripActionBlock(msg.content) : msg.content;
                contentHtml = msg.role === 'assistant'
                    ? self.renderSafeMarkdown(shown)
                    : esc(shown);
                actionBtn = '';
                if (msg.role === 'assistant') {
                    diff = self._parseActionFromResponse(msg.content);
                    if (diff) {
                        diffKey = 'k_' + Math.abs((msg.content || '').length * 31 + ((diff.mbt_action || '').charCodeAt(0) || 0)) + '_' + i;
                        window._mbtAIDiffStore[diffKey] = diff;
                        actionBtn = '<button type="button" data-chat-act="preview" data-diff-key="' + esc(diffKey) + '" class="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-500 active:scale-95 transition-all">' +
                            (icon('zap', '') || '') + ' Preview &amp; Apply</button>';
                    }
                }
                roleCls = msg.role === 'user'
                    ? (padL + ' ' + bubblePad + ' rounded-xl bg-blue-50 text-right')
                    : (padR + ' ' + bubblePad + ' rounded-xl bg-white border border-slate-100');
                html.push(
                    '<div class="ai-message ' + esc(msg.role || '') + ' ' + roleCls + '">' +
                        '<div class="text-[10px] font-bold text-slate-700 leading-relaxed prose prose-sm max-w-none' + (msg.role === 'user' ? '' : ' prose-headings:text-slate-800') + '">' + contentHtml + '</div>' +
                        actionBtn +
                    '</div>'
                );
            }

            if (self._chatSession && self._chatSession.inflight) {
                html.push(
                    '<div class="' + padR + ' ' + bubblePad + ' rounded-xl bg-white border border-slate-100">' +
                        '<div class="flex items-center gap-2 text-[10px] font-bold text-slate-500">' +
                            '<span class="inline-flex items-center gap-1">' +
                                '<span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>' +
                                '<span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style="animation-delay:0.15s"></span>' +
                                '<span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style="animation-delay:0.3s"></span>' +
                            '</span>' +
                            '<span>Thinking</span>' +
                        '</div>' +
                    '</div>'
                );
            }

            if (self._chatSession && self._chatSession.lastFailedText && !self._chatSession.inflight) {
                /* Error already represented if last chat item is _error; otherwise surface once. */
                var last = chat[chat.length - 1];
                if (!last || !last._error) {
                    html.push(
                        '<div class="' + padR + ' ' + bubblePad + ' rounded-xl bg-rose-50 border border-rose-200">' +
                            '<div class="text-[10px] font-bold text-rose-800 mb-2">' + esc(self._chatSession.lastFailedMsg || 'Request failed.') + '</div>' +
                            '<div class="flex items-center gap-3">' +
                                '<button type="button" data-chat-act="retry" data-retry="' + esc(self._chatSession.lastFailedText) + '" class="inline-flex items-center px-2.5 py-1.5 bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest rounded">Retry</button>' +
                                '<button type="button" data-chat-act="connections" class="text-[9px] font-bold text-rose-700 underline underline-offset-2">Check connections</button>' +
                            '</div>' +
                        '</div>'
                    );
                }
            }

            return html.join('');
        }

        function renderEmptyHtml(isPip) {
            var chips = [
                'Build a budget for a two day shoot',
                'What is my largest section',
                'Add a drone operator at the standard rate'
            ];
            var chipHtml = '';
            var c;
            for (c = 0; c < chips.length; c++) {
                chipHtml += '<button type="button" data-chat-act="chip" data-chip="' + esc(chips[c]) + '" class="px-3 py-2 rounded-full bg-white border border-slate-200 text-[9px] font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700 shadow-sm">' + esc(chips[c]) + '</button>';
            }
            return '<div class="flex flex-col items-center justify-center h-full min-h-[160px] px-4">' +
                '<p class="text-[10px] font-bold text-slate-600 text-center max-w-md mb-4 leading-relaxed">' +
                    'Ask anything about this budget. I can see your sections, line items and the OpenGate rate card.' +
                '</p>' +
                '<div class="flex flex-wrap justify-center gap-2 max-w-lg">' + chipHtml + '</div>' +
            '</div>';
        }

        function renderConfirmHtml(changes, isPip) {
            var title = changes.length > 1
                ? ('Preview ' + changes.length + ' changes')
                : 'Preview change';
            var list = [];
            var i, maxShow, more;
            maxShow = isPip ? 10 : 20;
            for (i = 0; i < changes.length && i < maxShow; i++) {
                list.push(
                    '<div class="' + (isPip ? 'px-2 py-1.5 rounded-lg' : 'px-3.5 py-2.5 rounded-xl') + ' bg-white border border-slate-100 text-[10px] font-bold text-slate-700">' +
                        esc((i + 1) + '. ' + self._describeChange(changes[i])) +
                    '</div>'
                );
            }
            more = changes.length - maxShow;
            if (more > 0) {
                list.push('<div class="text-[10px] font-bold text-slate-400">and ' + more + ' more</div>');
            }
            return '<div id="aiChatConfirm" class="relative flex-1 min-h-0 flex flex-col bg-white">' +
                '<div class="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2 shrink-0">' +
                    '<h4 class="text-[11px] font-black uppercase tracking-widest text-slate-800">' + esc(title) + '</h4>' +
                    '<div class="flex-1"></div>' +
                    '<button type="button" data-chat-act="confirm-close" title="Close" class="p-1.5 text-slate-300 hover:text-slate-600 rounded">' + icon('close', 'x') + '</button>' +
                '</div>' +
                '<div class="relative flex-1 min-h-0">' +
                    '<div id="aiChatHistory" class="no-scrollbar h-full p-3 space-y-1.5 bg-slate-50/40 overflow-y-auto">' + list.join('') + '</div>' +
                    '<div class="mbt-chat-scrolltrack"><div id="aiChatScrollDot" class="mbt-chat-scrolldot" style="top:0;"></div></div>' +
                '</div>' +
                '<div class="p-3 border-t border-slate-100 flex gap-2 bg-white shrink-0">' +
                    '<button type="button" data-chat-act="confirm-cancel" class="flex-1 py-2.5 text-[8px] font-black uppercase tracking-widest text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl">Cancel</button>' +
                    '<button type="button" data-chat-act="confirm-yes" class="flex-1 py-2.5 text-[8px] font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 rounded-xl">Confirm</button>' +
                '</div>' +
            '</div>';
        }

        function renderComposerHtml(isPip, hideComposer) {
            if (hideComposer) return '';
            var sess = self._chatSession || {};
            var inflight = !!sess.inflight;
            var micOn = !!sess.micOn;
            var btnCls = isPip ? 'w-9 h-9 rounded-lg' : 'w-12 h-12 rounded-xl';
            var sideBtn = isPip ? 'w-7 h-7 rounded-md' : 'w-9 h-9 rounded-lg';
            var sendHtml;
            if (inflight) {
                sendHtml = '<button type="button" id="aiChatSendBtn" data-chat-act="stop" title="Stop generation" class="' + btnCls + ' shrink-0 bg-rose-600 text-white flex items-center justify-center">' +
                    icon('stop', '[]') + '</button>';
            } else {
                sendHtml = '<button type="button" id="aiChatSendBtn" data-chat-act="send" title="Send" class="' + btnCls + ' shrink-0 bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500">' +
                    icon('paperPlane', '&rarr;') + '</button>';
            }
            var micCls = micOn
                ? (sideBtn + ' shrink-0 relative flex items-center justify-center text-rose-600 bg-rose-50')
                : (sideBtn + ' shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600');
            var micExtra = micOn ? '<span class="absolute inset-0 rounded-lg ring-2 ring-rose-400/50 animate-pulse"></span>' : '';
            var placeholder = micOn ? 'Listening' : 'Ask about rates, logistics, or risks..';
            var phCls = micOn ? 'placeholder:text-rose-400' : 'placeholder:text-slate-300';
            return '<div class="' + (isPip ? 'p-2' : 'p-4') + ' border-t border-slate-100 flex gap-2 bg-white shrink-0">' +
                '<div class="flex-1 min-w-0 flex items-center gap-0.5 ' + (isPip ? 'p-1 pl-1.5 rounded-lg' : 'p-1.5 pl-2 rounded-xl') + ' bg-slate-50">' +
                    '<button type="button" data-chat-act="attach" title="Attach file" class="' + sideBtn + ' shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600">' +
                        icon('clip', '') +
                    '</button>' +
                    /* Mic is a visual stub only. Recording is not implemented yet. */
                    '<button type="button" data-chat-act="mic" title="' + (micOn ? 'Recording (stub)' : 'Voice input (not implemented)') + '" class="' + micCls + '">' +
                        micExtra + icon('mic', '') +
                    '</button>' +
                    '<input type="text" id="aiChatInput" ' + (micOn ? 'readonly ' : '') + 'placeholder="' + esc(placeholder) + '" class="flex-1 min-w-0 p-2 bg-transparent border-none text-[10px] font-bold outline-none ' + phCls + '">' +
                    '<input type="file" id="aiChatFileInput" class="hidden" multiple>' +
                '</div>' +
                sendHtml +
            '</div>';
        }

        function renderHeaderHtml(isPip) {
            var m = modelName();
            var undoHidden = window._mbtAILastBackup ? '' : ' hidden';
            var modeBtn = isPip
                ? ('<button type="button" data-chat-act="mode-expand" title="Expand to full window" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded">' + icon('expandTall', icon('maximize', '')) + '</button>')
                : ('<button type="button" data-chat-act="mode-pip" title="Shrink to PiP" class="p-1.5 text-blue-600 bg-blue-50 rounded">' + icon('pip', '') + '</button>');
            var grip = isPip
                ? ('<span class="text-slate-300 shrink-0" aria-hidden="true">' + icon('drag', '') + '</span>')
                : '';
            var gearSize = isPip ? 'p-0.5 text-slate-500 hover:text-slate-900' : 'p-1.5 text-slate-500 hover:text-slate-900';
            var gearIcon = isPip
                ? '<span style="display:inline-flex;transform:scale(1.15)">' + icon('gear', '') + '</span>'
                : icon('gear', '');
            return '<div id="aiChatHeader" class="' + (isPip ? 'mbt-chat-pip-grip px-2.5 py-2' : 'px-4 py-3') + ' bg-white border-b border-slate-100 flex items-center gap-1.5 shrink-0">' +
                grip +
                '<h3 class="text-[11px] font-black uppercase tracking-widest text-slate-800">Assistant</h3>' +
                '<span class="w-2 h-2 rounded-full ' + liveDotClass() + ' shrink-0" title="Connection status"></span>' +
                (isPip ? '' : ('<span class="text-slate-400 shrink-0">' + icon('chat', '') + '</span><span class="text-[10px] font-black text-slate-600 truncate max-w-[140px]">' + esc(m) + '</span>')) +
                '<div class="flex-1"></div>' +
                (isPip ? '' : '<span class="text-[8px] font-black uppercase tracking-widest text-slate-400 mr-1 hidden lg:inline">Sees your budget &amp; OpenGate rates</span>') +
                '<button type="button" id="aiUndoBtn" data-chat-act="undo" title="Undo last AI budget change" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded' + undoHidden + '">' + icon('undo', '\u21B6') + '</button>' +
                '<button type="button" data-chat-act="export" title="Export" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">' + icon('file', '') + '</button>' +
                '<button type="button" data-chat-act="clear" title="Clear" class="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded">' + icon('trash', '') + '</button>' +
                '<button type="button" data-chat-act="settings" title="Settings" class="' + gearSize + ' rounded hover:bg-slate-100">' + gearIcon + '</button>' +
                '<div class="w-px h-4 bg-slate-200 mx-0.5"></div>' +
                modeBtn +
                '<button type="button" data-chat-act="close" title="Close" class="p-1.5 text-slate-300 hover:text-slate-600 rounded">' + icon('close', 'x') + '</button>' +
            '</div>';
        }

        function renderEngineLineHtml(isPip) {
            if (!isPip) return '';
            return '<div class="px-2.5 py-1.5 bg-slate-50/70 border-b border-slate-100 flex items-center gap-2 shrink-0">' +
                '<span class="text-slate-400 shrink-0">' + icon('chat', '') + '</span>' +
                '<span class="text-[9px] font-black text-slate-600 truncate">' + esc(modelName()) + '</span>' +
                '<div class="flex-1"></div>' +
                '<span class="text-[8px] font-bold text-slate-400">Sees your budget</span>' +
            '</div>';
        }

        function renderThreadListHtml() {
            var threads = self._threads().slice();
            threads.sort(function (a, b) {
                return (b.updated || 0) - (a.updated || 0);
            });
            var active = self._activeThread();
            var activeId = active ? active.id : null;
            var html = [];
            var i, t, title, msgs, cc, activeCls;
            if (!threads.length) {
                html.push('<p class="text-[9px] font-bold text-slate-400 text-center px-2 pt-4">No previous conversations.</p>');
            }
            for (i = 0; i < threads.length; i++) {
                t = threads[i];
                if (!t) continue;
                title = t.title || self._titleFromMessages(t.messages || []) || 'New conversation';
                msgs = (t.messages && t.messages.length) || 0;
                cc = parseInt(t.changeCount, 10) || 0;
                activeCls = (t.id === activeId)
                    ? 'border border-blue-200 bg-blue-50 ring-1 ring-blue-100'
                    : 'border border-transparent hover:bg-slate-50';
                html.push(
                    '<button type="button" data-chat-act="switch-thread" data-thread-id="' + esc(t.id) + '" class="w-full text-left px-2.5 py-2.5 rounded-lg ' + activeCls + '">' +
                        '<div class="text-[10px] font-black ' + (t.id === activeId ? 'text-blue-800' : 'text-slate-700') + ' truncate">' + esc(title) + '</div>' +
                        '<div class="flex items-center gap-2 mt-1">' +
                            '<span class="text-[8px] font-bold text-slate-500">' + esc(relTime(t.updated || t.created)) + '</span>' +
                            '<span class="text-[8px] font-bold text-slate-400">' + msgs + ' msgs</span>' +
                            (cc > 0 ? ('<span class="text-[8px] font-black text-emerald-600">' + cc + ' changes</span>') : '') +
                        '</div>' +
                    '</button>'
                );
            }
            return html.join('');
        }

        function renderLeftDrawerHtml(leftOpen) {
            var colCls = leftOpen ? 'w-[250px]' : 'mbt-chat-drawer-collapsed w-[36px]';
            return '<div id="aiChatLeft" class="' + colCls + ' shrink-0 border-r border-slate-100 bg-white flex flex-col transition-all">' +
                '<div class="mbt-chat-drawer-head px-3 pt-3 pb-2 border-b border-slate-100 shrink-0 flex items-center gap-2">' +
                    '<div class="flex-1 text-[8px] font-black uppercase tracking-widest text-slate-400">History</div>' +
                    '<button type="button" data-chat-act="toggle-left" title="Collapse history" class="w-8 h-8 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg">' +
                        icon('chevronLeft', '&lt;') +
                    '</button>' +
                '</div>' +
                '<div class="mbt-chat-drawer-reopen flex-1 flex-col items-center pt-3">' +
                    '<button type="button" data-chat-act="toggle-left" title="Open history" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">' +
                        icon('chevronRight', '&gt;') +
                    '</button>' +
                '</div>' +
                '<div class="mbt-chat-drawer-body flex-1 min-h-0 flex flex-col">' +
                    '<div class="px-3 pt-3 pb-2 shrink-0">' +
                        '<button type="button" data-chat-act="new-thread" class="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-500">' +
                            icon('plus', '+') + ' New conversation' +
                        '</button>' +
                    '</div>' +
                    '<div class="no-scrollbar flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1">' + renderThreadListHtml() + '</div>' +
                    '<div class="px-3 py-2.5 border-t border-slate-100 text-[8px] font-bold text-slate-400 text-center shrink-0">Conversations are saved with this project.</div>' +
                '</div>' +
            '</div>';
        }

        function renderRightDrawerHtml(rightOpen) {
            var colCls = rightOpen ? 'w-[340px]' : 'mbt-chat-drawer-collapsed w-[36px]';
            var s = budgetStats();
            var secRows = [];
            var i, r;
            for (i = 0; i < s.rows.length; i++) {
                r = s.rows[i];
                secRows.push(
                    '<div class="px-4 py-2.5 flex items-center justify-between">' +
                        '<span class="text-[9px] font-bold text-slate-500 truncate pr-2">' + esc(r.name) + '</span>' +
                        '<span class="text-[10px] font-black text-slate-700 shrink-0">' + esc(fmtPlain(r.total)) + '</span>' +
                    '</div>'
                );
            }
            var attachLabel = s.attachN ? (s.attachN + ' file' + (s.attachN === 1 ? '' : 's')) : 'none';
            return '<div id="aiChatRight" class="' + colCls + ' shrink-0 border-l border-slate-100 bg-white flex flex-col transition-all">' +
                '<div class="mbt-chat-drawer-head px-3 pt-3 pb-2 border-b border-slate-100 shrink-0 flex items-center gap-2">' +
                    '<div class="flex-1 text-[8px] font-black uppercase tracking-widest text-slate-400">Context</div>' +
                    '<button type="button" data-chat-act="toggle-right" title="Collapse context" class="w-8 h-8 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg">' +
                        icon('chevronRight', '&gt;') +
                    '</button>' +
                '</div>' +
                '<div class="mbt-chat-drawer-reopen flex-1 flex-col items-center pt-3">' +
                    '<button type="button" data-chat-act="toggle-right" title="Open context" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">' +
                        icon('chevronLeft', '&lt;') +
                    '</button>' +
                '</div>' +
                '<div class="mbt-chat-drawer-body flex-1 min-h-0 flex flex-col">' +
                    '<div class="px-4 pt-3 pb-2 border-b border-slate-100 shrink-0">' +
                        '<div class="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Context sources</div>' +
                        '<div class="flex items-start gap-2 py-2 border-b border-slate-50">' +
                            '<span class="text-slate-400 mt-0.5 shrink-0">' + icon('list', '') + '</span>' +
                            '<div class="flex-1 min-w-0">' +
                                '<div class="text-[9px] font-black uppercase tracking-widest text-slate-700">Budget</div>' +
                                '<div class="text-[9px] font-bold text-slate-500 mt-0.5">' + esc(s.projectName) + ' \u00b7 ' + s.sectionCount + ' sections \u00b7 ' + s.lineCount + ' lines</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="flex items-start gap-2 py-2 border-b border-slate-50">' +
                            '<span class="text-slate-400 mt-0.5 shrink-0">' + icon('receipt', '') + '</span>' +
                            '<div class="flex-1 min-w-0">' +
                                '<div class="text-[9px] font-black uppercase tracking-widest text-slate-700">OpenGate rates</div>' +
                                '<div class="text-[9px] font-bold text-slate-500 mt-0.5">' + s.rateMatched + ' rates matched to this chat</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="flex items-start gap-2 py-2 border-b border-slate-50">' +
                            '<span class="text-slate-400 mt-0.5 shrink-0">' + icon('clip', '') + '</span>' +
                            '<div class="flex-1 min-w-0">' +
                                '<div class="text-[9px] font-black uppercase tracking-widest text-slate-700">Attachments</div>' +
                                '<div class="text-[9px] font-bold text-slate-500 mt-0.5">' + esc(attachLabel) + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="flex items-start gap-2 py-2">' +
                            '<span class="text-slate-400 mt-0.5 shrink-0">' + icon('history', '') + '</span>' +
                            '<div class="flex-1 min-w-0">' +
                                '<div class="text-[9px] font-black uppercase tracking-widest text-slate-700">Chat memory</div>' +
                                '<div class="text-[9px] font-bold text-slate-500 mt-0.5">' + s.msgN + ' messages \u00b7 saved per project</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="px-4 py-3 border-b border-slate-100 shrink-0">' +
                        '<div class="text-[8px] font-black uppercase tracking-widest text-slate-400">Estimated grand total</div>' +
                        '<div class="text-[18px] font-black tracking-tighter text-slate-900 leading-tight">' + esc(fmtMoney(s.grand)) + '</div>' +
                    '</div>' +
                    '<div class="no-scrollbar overflow-y-auto divide-y divide-slate-50 shrink-0 max-h-40">' + secRows.join('') + '</div>' +
                    '<div class="px-4 py-2 border-t border-b border-slate-100 text-[8px] font-bold text-slate-400 shrink-0">Updates as changes apply</div>' +
                    '<div class="px-4 py-3 flex-1 min-h-0 no-scrollbar overflow-y-auto">' +
                        '<div class="flex items-center gap-1.5 mb-2">' +
                            '<span class="text-slate-400">' + icon('barChart', '') + '</span>' +
                            '<div class="text-[8px] font-black uppercase tracking-widest text-slate-400">At a glance</div>' +
                        '</div>' +
                        '<div class="space-y-2.5">' +
                            '<div class="rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2">' +
                                '<div class="text-[8px] font-black uppercase tracking-widest text-slate-400">Largest section</div>' +
                                '<div class="text-[10px] font-black text-slate-800 mt-0.5">' + esc(s.largestName) + '</div>' +
                                '<div class="text-[9px] font-bold text-slate-500">' + esc(fmtMoney(s.largestTotal)) + ' \u00b7 ' + s.largestPct.toFixed(1) + '% of total</div>' +
                            '</div>' +
                            '<div class="rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2">' +
                                '<div class="text-[8px] font-black uppercase tracking-widest text-slate-400">Contingency</div>' +
                                '<div class="text-[10px] font-black text-slate-800 mt-0.5">' + esc(String(s.contPct)) + '%</div>' +
                                '<div class="text-[9px] font-bold text-slate-500">' + esc(fmtMoney(s.contCash)) + ' cash held</div>' +
                            '</div>' +
                            '<div class="rounded-lg border border-amber-100 bg-amber-50/50 px-2.5 py-2">' +
                                '<div class="text-[8px] font-black uppercase tracking-widest text-amber-700">No rate set</div>' +
                                '<div class="text-[10px] font-black text-amber-900 mt-0.5">' + s.noRate + ' line items</div>' +
                                '<div class="text-[9px] font-bold text-amber-800/80">Risk: totals may understate cost</div>' +
                            '</div>' +
                            '<div class="rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2">' +
                                '<div class="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Secured / Pipeline / Gap</div>' +
                                '<div class="flex gap-1 h-2 rounded-full overflow-hidden mb-2">' +
                                    '<div class="bg-emerald-500" style="width:' + s.pctSec.toFixed(1) + '%"></div>' +
                                    '<div class="bg-blue-500" style="width:' + s.pctPipe.toFixed(1) + '%"></div>' +
                                    '<div class="bg-rose-400" style="width:' + s.pctGap.toFixed(1) + '%"></div>' +
                                '</div>' +
                                '<div class="grid grid-cols-3 gap-1">' +
                                    '<div><div class="text-[8px] font-black uppercase tracking-widest text-emerald-600">Secured</div><div class="text-[9px] font-black text-slate-800">' + esc(fmtPlain(s.sumConfirmed)) + '</div></div>' +
                                    '<div><div class="text-[8px] font-black uppercase tracking-widest text-blue-600">Pipeline</div><div class="text-[9px] font-black text-slate-800">' + esc(fmtPlain(s.pipeline)) + '</div></div>' +
                                    '<div><div class="text-[8px] font-black uppercase tracking-widest text-rose-500">Gap</div><div class="text-[9px] font-black text-slate-800">' + esc(fmtPlain(Math.max(0, s.gap))) + '</div></div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }

        function modelOptionsHtml(models, selected) {
            var out = '';
            var i, id, name;
            if (!models || !models.length) {
                return '<option value="">No models loaded</option>';
            }
            for (i = 0; i < models.length; i++) {
                id = models[i].id || models[i];
                name = models[i].name || id;
                out += '<option value="' + esc(id) + '"' + (selected === id ? ' selected' : '') + '>' + esc(name) + '</option>';
            }
            return out;
        }

        function renderSettingsSheetHtml() {
            var provider = self.getSelectedProvider();
            var chatModels = [];
            var imgModels = [];
            try { chatModels = JSON.parse(localStorage.getItem('mbt_cached_chat_models_' + provider) || '[]'); } catch (e) {}
            try { imgModels = JSON.parse(localStorage.getItem('mbt_cached_image_models') || '[]'); } catch (e2) {}
            var chatSel = modelName();
            var imgSel = '';
            try {
                if (window.mBTAssistant && window.mBTAssistant.getImageModel) imgSel = window.mBTAssistant.getImageModel() || '';
                else imgSel = localStorage.getItem('mbt_ai_image_model') || '';
            } catch (e3) {}
            var vidSel = '';
            try { vidSel = localStorage.getItem('mbt_ai_video_model') || ''; } catch (e4) {}
            var house = self.getSystemPrompt() || '';
            var remember = !!(budget.aiContext && budget.aiContext.saveHistory);
            var webhook = '';
            try { webhook = localStorage.getItem((window.storageKeyPrefix || '') + 'cloudWebhook') || ''; } catch (e5) {}
            var prefix = window.storageKeyPrefix || '';

            return '<div id="aiChatSettings" class="absolute inset-0 z-20 bg-white flex flex-col">' +
                '<div class="px-4 py-3 border-b border-slate-100 flex items-center gap-2 shrink-0">' +
                    '<h4 class="text-[11px] font-black uppercase tracking-widest text-slate-800">Assistant settings</h4>' +
                    '<div class="flex-1"></div>' +
                    '<button type="button" data-chat-act="settings-close" class="p-1.5 text-slate-300 hover:text-slate-600 rounded">' + icon('close', 'x') + '</button>' +
                '</div>' +
                '<div class="flex-1 min-h-0 no-scrollbar overflow-y-auto p-4 space-y-4">' +
                    '<div>' +
                        '<label class="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Chat model</label>' +
                        '<select id="aiChatModelSelect" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100">' +
                            modelOptionsHtml(chatModels, chatSel) +
                        '</select>' +
                    '</div>' +
                    '<div>' +
                        '<label class="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Image model</label>' +
                        '<select id="aiImgModelSelect" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100">' +
                            modelOptionsHtml(imgModels.length ? imgModels : (imgSel ? [{ id: imgSel, name: imgSel }] : []), imgSel) +
                        '</select>' +
                    '</div>' +
                    '<div>' +
                        '<label class="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Video model</label>' +
                        '<select id="aiVidModelSelect" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100">' +
                            modelOptionsHtml(vidSel ? [{ id: vidSel, name: vidSel }] : [], vidSel) +
                        '</select>' +
                        '<p class="text-[8px] font-bold text-slate-400 mt-1">Populated only when a video-capable model is available.</p>' +
                    '</div>' +
                    '<div>' +
                        '<label class="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">House rules</label>' +
                        '<textarea id="aiChatHouseRules" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 resize-none h-24" placeholder="e.g. Always use JMD. Prefer OpenGate rates.">' + esc(house) + '</textarea>' +
                    '</div>' +
                    '<label class="flex items-center justify-between gap-3 py-2">' +
                        '<span class="text-[10px] font-bold text-slate-700">Remember conversations</span>' +
                        '<input type="checkbox" id="aiChatRemember" ' + (remember ? 'checked' : '') + ' class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">' +
                    '</label>' +
                    '<div class="p-3 bg-slate-900 rounded-xl text-white space-y-2">' +
                        '<div class="text-[9px] font-black uppercase tracking-widest text-emerald-400">Webhook endpoint</div>' +
                        '<div class="flex gap-2">' +
                            '<input type="text" id="aiChatWebhook" value="' + esc(webhook) + '" class="flex-1 bg-slate-800 text-white border-none rounded-lg p-2 text-[10px] font-mono outline-none" placeholder="https://api.example.com/ingest">' +
                            '<button type="button" data-chat-act="webhook-test" class="px-3 bg-emerald-900/50 text-emerald-400 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-emerald-800">Test</button>' +
                        '</div>' +
                        '<p class="text-[8px] text-amber-500 font-bold">Note: automatic dispatch is not yet implemented. The Test button only checks connectivity. It does not send live budget data.</p>' +
                    '</div>' +
                    '<button type="button" data-chat-act="settings-save" class="w-full py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-500">Save settings</button>' +
                '</div>' +
            '</div>';
        }

        function buildShellHtml() {
            var sess = self._chatSession;
            var mode = sess.mode;
            var isPip = mode === 'pip';
            var ac = activeThreadAndChat();
            sess.activeChat = ac.chat;
            sess.activeThread = ac.thread;
            var pending = sess.pendingDiff;
            var hideComposer = !!(pending && pending.changes);
            var centre;
            if (pending && pending.changes) {
                centre = renderConfirmHtml(pending.changes, isPip);
            } else {
                centre =
                    '<div class="relative flex-1 min-h-0 flex flex-col">' +
                        '<div class="relative flex-1 min-h-0">' +
                            '<div id="aiChatHistory" class="no-scrollbar h-full ' + (isPip ? 'p-3' : 'p-6') + ' space-y-3 bg-slate-50/40 overflow-y-auto">' +
                                renderMessagesHtml(ac.chat, isPip) +
                            '</div>' +
                            '<div class="mbt-chat-scrolltrack"><div id="aiChatScrollDot" class="mbt-chat-scrolldot" style="top:0;"></div></div>' +
                        '</div>' +
                        renderComposerHtml(isPip, hideComposer) +
                    '</div>';
            }

            var panelInner =
                renderHeaderHtml(isPip) +
                renderEngineLineHtml(isPip) +
                (isPip
                    ? ('<div class="relative flex-1 min-h-0 flex flex-col">' + centre + '</div>')
                    : ('<div class="flex-1 min-h-0 flex">' +
                        renderLeftDrawerHtml(sess.leftOpen) +
                        '<div class="relative flex-1 min-w-0 flex flex-col">' + centre + '</div>' +
                        renderRightDrawerHtml(sess.rightOpen) +
                      '</div>')) +
                (sess.settingsOpen ? renderSettingsSheetHtml() : '');

            if (isPip) {
                var rawPos = sess.pipPos || readPipPos();
                var maxX = Math.max(0, (window.innerWidth || 800) - 330);
                var maxY = Math.max(0, (window.innerHeight || 600) - 120);
                var pos = {
                    x: Math.min(maxX, Math.max(0, rawPos.x)),
                    y: Math.min(maxY, Math.max(0, rawPos.y))
                };
                sess.pipPos = pos;
                var pipH = Math.max(200, (window.innerHeight || 600) - pos.y - 14);
                return '<div id="mbtAiChatRoot" class="mbt-ai-chat-root" style="position:fixed;inset:0;z-index:980;pointer-events:none;">' +
                    '<div id="mbtAiChatPanel" class="bg-white rounded-xl shadow-2xl ring-1 ring-slate-900/15 flex flex-col overflow-hidden" style="position:fixed;left:' + pos.x + 'px;top:' + pos.y + 'px;width:330px;height:' + pipH + 'px;max-height:' + pipH + 'px;pointer-events:auto;z-index:981;">' +
                        panelInner +
                    '</div>' +
                '</div>';
            }

            return '<div id="mbtAiChatRoot" class="mbt-ai-chat-root" style="position:fixed;inset:0;z-index:980;">' +
                '<div data-chat-act="backdrop" style="position:absolute;inset:0;background:rgba(15,23,42,0.35);"></div>' +
                '<div id="mbtAiChatPanel" class="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style="position:absolute;top:24px;bottom:24px;left:15%;width:70%;max-width:1400px;pointer-events:auto;">' +
                    panelInner +
                '</div>' +
            '</div>';
        }

        function bindScrollDot() {
            var hist = document.getElementById('aiChatHistory');
            var dot = document.getElementById('aiChatScrollDot');
            if (!hist || !dot) return;
            function update() {
                var max = hist.scrollHeight - hist.clientHeight;
                var track = hist.clientHeight - 20;
                var top = 0;
                if (max > 0 && track > 0) {
                    top = (hist.scrollTop / max) * Math.max(0, track - 6);
                }
                dot.style.top = top + 'px';
            }
            hist.onscroll = update;
            setTimeout(update, 20);
        }

        function clampPip(x, y) {
            var w = 330;
            var h = Math.max(120, (window.innerHeight || 600) - 28);
            var maxX = Math.max(0, (window.innerWidth || 800) - w);
            var maxY = Math.max(0, (window.innerHeight || 600) - h);
            return {
                x: Math.min(maxX, Math.max(0, x)),
                y: Math.min(maxY, Math.max(0, y))
            };
        }

        function bindPipDrag() {
            var sess = self._chatSession;
            if (!sess || sess.mode !== 'pip') return;
            var header = document.getElementById('aiChatHeader');
            var panel = document.getElementById('mbtAiChatPanel');
            if (!header || !panel) return;

            var dragging = false;
            var startX = 0, startY = 0, origX = 0, origY = 0;
            var holdTimer = null;
            var touchArmed = false;

            function onMove(clientX, clientY) {
                if (!dragging) return;
                var nx = origX + (clientX - startX);
                var ny = origY + (clientY - startY);
                var c = clampPip(nx, ny);
                panel.style.left = c.x + 'px';
                panel.style.top = c.y + 'px';
                sess.pipPos = c;
            }

            function endDrag() {
                if (!dragging) return;
                dragging = false;
                touchArmed = false;
                if (sess.pipPos) writePipPos(sess.pipPos);
                document.removeEventListener('mousemove', mouseMove);
                document.removeEventListener('mouseup', mouseUp);
                document.removeEventListener('touchmove', touchMove);
                document.removeEventListener('touchend', touchEnd);
            }

            function mouseMove(e) { onMove(e.clientX, e.clientY); }
            function mouseUp() { endDrag(); }
            function touchMove(e) {
                if (!dragging || !e.touches || !e.touches[0]) return;
                e.preventDefault();
                onMove(e.touches[0].clientX, e.touches[0].clientY);
            }
            function touchEnd() { endDrag(); }

            header.onmousedown = function (e) {
                if (e.button !== 0) return;
                if (e.target && e.target.closest && e.target.closest('button')) return;
                dragging = true;
                startX = e.clientX;
                startY = e.clientY;
                origX = sess.pipPos ? sess.pipPos.x : panel.offsetLeft;
                origY = sess.pipPos ? sess.pipPos.y : panel.offsetTop;
                document.addEventListener('mousemove', mouseMove);
                document.addEventListener('mouseup', mouseUp);
                e.preventDefault();
            };

            header.ontouchstart = function (e) {
                if (!e.touches || !e.touches[0]) return;
                if (e.target && e.target.closest && e.target.closest('button')) return;
                var t = e.touches[0];
                holdTimer = setTimeout(function () {
                    touchArmed = true;
                    dragging = true;
                    startX = t.clientX;
                    startY = t.clientY;
                    origX = sess.pipPos ? sess.pipPos.x : panel.offsetLeft;
                    origY = sess.pipPos ? sess.pipPos.y : panel.offsetTop;
                    document.addEventListener('touchmove', touchMove, { passive: false });
                    document.addEventListener('touchend', touchEnd);
                }, 300);
            };
            header.ontouchend = function () {
                if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
                if (!touchArmed) return;
                endDrag();
            };
            header.ontouchmove = function (e) {
                if (!dragging && holdTimer) {
                    /* moved before hold completed: cancel press-and-hold */
                    clearTimeout(holdTimer);
                    holdTimer = null;
                }
            };
        }

        function doSend(text, isRetry) {
            var sess = self._chatSession;
            if (!sess || sess.inflight) return;
            text = String(text || '').replace(/^\s+|\s+$/g, '');
            if (!text) return;

            var ac = activeThreadAndChat();
            var activeChat = ac.chat;
            var activeThread = ac.thread;
            var input = document.getElementById('aiChatInput');

            if (!isRetry) {
                activeChat.push({ role: 'user', content: text });
                if (persist && activeThread) {
                    self._touchThread(activeThread);
                    if (typeof window.saveBudget === 'function') window.saveBudget();
                }
            }

            sess.lastFailedText = '';
            sess.lastFailedMsg = '';
            sess.inflight = true;
            sess.genId = (sess.genId || 0) + 1;
            var myGen = sess.genId;
            sess.lastUserText = text;
            if (input) input.value = '';
            self._chatRender();

            var provider = self.getSelectedProvider();
            var apiKey = self.getStoredApiKey(provider);

            if (!apiKey && provider !== 'lmstudio') {
                sess.inflight = false;
                sess.lastFailedText = text;
                sess.lastFailedMsg = 'API key missing. Check connections.';
                /* Keep user message; do not add assistant message. */
                self._chatRender();
                return;
            }

            var docList = (budget.documents || []).map(function (d) { return d.label; }).join(', ');
            var attachList = (budget.attachments || []).map(function (a) { return a.name; }).join(', ');
            var prevAnalysis = ((budget.aiContext && budget.aiContext.analysis) || 'None').substring(0, 500);
            var contextSummary = 'Docs=[' + docList + '], Attachments=[' + attachList + '], Last Analysis Summary="' + prevAnalysis + '"';
            var apiHistory = [];
            var finalPrompt = text;
            if (persist && activeChat.length > 1) {
                /* History is prior turns; the current user text is the prompt. */
                apiHistory = activeChat.slice(0, -1).map(function (m) {
                    if (!m || m._error) return null;
                    return { role: m.role, content: m.content };
                }).filter(function (m) { return m && m.role && m.content; });
            } else {
                finalPrompt = '[' + contextSummary + ']\n\nUser Query: ' + text;
            }

            var budgetCtx = self._buildBudgetContext();
            var rateCtx = self._buildRateContext(text);
            var chatSystemMsg = self.config.systemContext + '\n\n' + self.config.chatActionPrompt;
            if (budgetCtx) chatSystemMsg += '\n\n' + budgetCtx;
            if (rateCtx) chatSystemMsg += '\n\n' + rateCtx;

            return self.callUnifiedAI(provider, apiKey, finalPrompt, chatSystemMsg, apiHistory).then(function (response) {
                if (!self._chatSession || self._chatSession.genId !== myGen) {
                    /* Abandoned by stop or close. */
                    return;
                }
                self._chatSession.inflight = false;
                if (typeof response === 'string' && response.indexOf('Analysis Failed:') === 0) {
                    var failMsg = response.replace('Analysis Failed: ', '');
                    self._chatSession.lastFailedText = text;
                    self._chatSession.lastFailedMsg = failMsg || 'Request failed.';
                    self._chatRender();
                    return;
                }
                activeChat.push({ role: 'assistant', content: response });
                if (persist && activeThread) {
                    self._touchThread(activeThread);
                    if (typeof window.saveBudget === 'function') window.saveBudget();
                }
                self._chatSession.lastFailedText = '';
                self._chatSession.lastFailedMsg = '';
                self._chatRender();
            });
        }

        function handleAction(act, el, e) {
            var sess = self._chatSession;
            if (!sess) return;
            var id, thr, changes, ma, p, val, wh, prefix;

            if (act === 'close' || act === 'backdrop') {
                if (act === 'backdrop' && sess.mode === 'pip') return;
                self.closeChat();
                return;
            }
            if (act === 'mode-pip') {
                writeMode('pip');
                sess.mode = 'pip';
                if (!sess.pipPos) sess.pipPos = readPipPos();
                document.body.style.overflow = '';
                self._chatRender();
                return;
            }
            if (act === 'mode-expand') {
                writeMode('expanded');
                sess.mode = 'expanded';
                document.body.style.overflow = 'hidden';
                self._chatRender();
                return;
            }
            if (act === 'toggle-left') {
                sess.leftOpen = !sess.leftOpen;
                writeDrawer('mbt_chat_drawer_left', sess.leftOpen);
                self._chatRender();
                return;
            }
            if (act === 'toggle-right') {
                sess.rightOpen = !sess.rightOpen;
                writeDrawer('mbt_chat_drawer_right', sess.rightOpen);
                self._chatRender();
                return;
            }
            if (act === 'new-thread') {
                thr = self.newThread();
                sess.activeThread = thr;
                sess.activeChat = thr ? thr.messages : [];
                sess.pendingDiff = null;
                sess.lastFailedText = '';
                self._chatRender();
                return;
            }
            if (act === 'switch-thread') {
                id = el.getAttribute('data-thread-id');
                thr = self.switchThread(id);
                if (thr) {
                    sess.activeThread = thr;
                    sess.activeChat = thr.messages || [];
                    sess.pendingDiff = null;
                    sess.lastFailedText = '';
                    self._chatRender();
                }
                return;
            }
            if (act === 'undo') {
                self.undoLastSuggestion();
                return;
            }
            if (act === 'export') {
                self.exportChat();
                return;
            }
            if (act === 'clear') {
                self.clearContext();
                return;
            }
            if (act === 'settings') {
                sess.settingsOpen = true;
                self._chatRender();
                return;
            }
            if (act === 'settings-close') {
                sess.settingsOpen = false;
                self._chatRender();
                return;
            }
            if (act === 'settings-save') {
                p = self.getSelectedProvider();
                ma = window.mBTAssistant;
                var cSel = document.getElementById('aiChatModelSelect');
                var iSel = document.getElementById('aiImgModelSelect');
                var vSel = document.getElementById('aiVidModelSelect');
                var rules = document.getElementById('aiChatHouseRules');
                var rem = document.getElementById('aiChatRemember');
                var whEl = document.getElementById('aiChatWebhook');
                if (cSel && cSel.value) {
                    if (ma && typeof ma.setChatModel === 'function') ma.setChatModel(p, cSel.value);
                    else try { localStorage.setItem('mbt_ai_chat_model_' + p, cSel.value); } catch (e) {}
                }
                if (iSel && iSel.value) {
                    if (ma && typeof ma.setImageModel === 'function') ma.setImageModel(iSel.value);
                    else try { localStorage.setItem('mbt_ai_image_model', iSel.value); } catch (e2) {}
                }
                if (vSel && vSel.value) {
                    try { localStorage.setItem('mbt_ai_video_model', vSel.value); } catch (e3) {}
                }
                if (rules) self.saveSystemPrompt(rules.value || '');
                if (rem) {
                    self._ensureAiContext(budget);
                    budget.aiContext.saveHistory = !!rem.checked;
                    persist = self.isPersistentContext();
                    if (typeof window.saveBudget === 'function') window.saveBudget();
                }
                if (whEl) {
                    prefix = window.storageKeyPrefix || '';
                    try { localStorage.setItem(prefix + 'cloudWebhook', whEl.value || ''); } catch (e4) {}
                }
                sess.settingsOpen = false;
                self._chatRender();
                return;
            }
            if (act === 'webhook-test') {
                wh = document.getElementById('aiChatWebhook');
                val = wh ? wh.value : '';
                if (!val) return mBTME.alert('Error', 'No URL');
                if (mBTME.showLoader) mBTME.showLoader('Pinging..');
                fetch(val, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ test: true, source: 'MooBudget', project: budget.projectName, ts: new Date().toISOString() })
                }).then(function (r) {
                    if (mBTME.hideLoader) mBTME.hideLoader();
                    if (r.ok) mBTME.alert('Success', 'Endpoint Reachable');
                    else mBTME.alert('Error', 'Status: ' + r.status);
                }).catch(function (err) {
                    if (mBTME.hideLoader) mBTME.hideLoader();
                    mBTME.alert('Connection Failed', (err && err.message) || 'Failed');
                });
                return;
            }
            if (act === 'send') {
                var inp = document.getElementById('aiChatInput');
                doSend(inp ? inp.value : '');
                return;
            }
            if (act === 'stop') {
                sess.inflight = false;
                sess.genId = (sess.genId || 0) + 1;
                self._chatRender();
                return;
            }
            if (act === 'retry') {
                var rt = el.getAttribute('data-retry') || sess.lastFailedText || sess.lastUserText || '';
                doSend(rt, true);
                return;
            }
            if (act === 'connections') {
                if (window.mBT && window.mBT.features && window.mBT.features.settings && typeof window.mBT.features.settings.open === 'function') {
                    window.mBT.features.settings.open('connections');
                } else if (typeof window.showSettingsModal === 'function') {
                    window.showSettingsModal('connections');
                }
                return;
            }
            if (act === 'chip') {
                var chip = el.getAttribute('data-chip') || '';
                var chipInput = document.getElementById('aiChatInput');
                if (chipInput) {
                    chipInput.value = chip;
                    chipInput.focus();
                }
                return;
            }
            if (act === 'attach') {
                var fi = document.getElementById('aiChatFileInput');
                if (fi) fi.click();
                return;
            }
            if (act === 'mic') {
                /* Mic recording is not implemented. Toggle UI only. */
                sess.micOn = !sess.micOn;
                self._chatRender();
                return;
            }
            if (act === 'preview') {
                var dk = el.getAttribute('data-diff-key');
                var d = window._mbtAIDiffStore && window._mbtAIDiffStore[dk];
                if (d) self.applySuggestion(d);
                return;
            }
            if (act === 'confirm-close' || act === 'confirm-cancel') {
                sess.pendingDiff = null;
                self._chatRender();
                return;
            }
            if (act === 'confirm-yes') {
                if (sess.pendingDiff && sess.pendingDiff.changes) {
                    changes = sess.pendingDiff.changes;
                    sess.pendingDiff = null;
                    self._commitSuggestion(changes);
                }
                return;
            }
        }

        function bindRootEvents() {
            var root = self._chatSession && self._chatSession.root;
            if (!root) return;

            root.onclick = function (e) {
                var el = e.target;
                if (el && el.nodeType !== 1) el = el.parentNode;
                while (el && el !== root && !(el.getAttribute && el.getAttribute('data-chat-act'))) {
                    el = el.parentNode;
                }
                if (!el || el === root) return;
                var act = el.getAttribute('data-chat-act');
                if (!act) return;
                e.preventDefault();
                e.stopPropagation();
                handleAction(act, el, e);
            };

            root.onkeydown = function (e) {
                if (e.key === 'Enter' && e.target && e.target.id === 'aiChatInput') {
                    e.preventDefault();
                    handleAction('send', e.target, e);
                }
                if (e.key === 'Escape') {
                    if (self._chatSession && self._chatSession.settingsOpen) {
                        self._chatSession.settingsOpen = false;
                        self._chatRender();
                    } else if (self._chatSession && self._chatSession.pendingDiff) {
                        self._chatSession.pendingDiff = null;
                        self._chatRender();
                    } else {
                        self.closeChat();
                    }
                }
            };

            var fileIn = document.getElementById('aiChatFileInput');
            if (fileIn) {
                fileIn.onchange = function () {
                    var files = fileIn.files;
                    if (!files || !files.length) return;
                    var names = [];
                    var i;
                    for (i = 0; i < files.length; i++) names.push(files[i].name);
                    var inp = document.getElementById('aiChatInput');
                    if (inp) {
                        var add = '[Attached: ' + names.join(', ') + '] ';
                        inp.value = add + (inp.value || '');
                        inp.focus();
                    }
                    fileIn.value = '';
                };
            }

            bindScrollDot();
            bindPipDrag();

            var focusInput = document.getElementById('aiChatInput');
            if (focusInput && !self._chatSession.pendingDiff && !self._chatSession.settingsOpen) {
                setTimeout(function () { focusInput.focus(); }, 40);
            }
            if (typeof self.refreshUndoButton === 'function') self.refreshUndoButton();

            var hist = document.getElementById('aiChatHistory');
            if (hist && self._chatSession && !self._chatSession.pendingDiff) {
                setTimeout(function () { hist.scrollTop = hist.scrollHeight; }, 20);
            }
        }

        self._chatRender = function () {
            var sess = self._chatSession;
            if (!sess) return;
            var html = buildShellHtml();
            var wrap = document.createElement('div');
            wrap.innerHTML = html;
            var newRoot = wrap.firstChild;
            if (sess.root && sess.root.parentNode) {
                sess.root.parentNode.replaceChild(newRoot, sess.root);
            } else {
                document.body.appendChild(newRoot);
            }
            sess.root = newRoot;
            if (sess.mode === 'expanded') document.body.style.overflow = 'hidden';
            else document.body.style.overflow = '';
            bindRootEvents();
        };

        /* Mount or refresh session */
        if (self._chatSession && self._chatSession.root && document.body.contains(self._chatSession.root)) {
            var ac0 = activeThreadAndChat();
            self._chatSession.activeChat = ac0.chat;
            self._chatSession.activeThread = ac0.thread;
            self._chatSession.persist = persist;
            self._chatRender();
            return;
        }

        var mode = readMode();
        var leftOpen = readDrawer('mbt_chat_drawer_left', true);
        var rightOpen = readDrawer('mbt_chat_drawer_right', true);
        var acInit = activeThreadAndChat();

        self._chatSession = {
            root: null,
            mode: mode,
            leftOpen: leftOpen,
            rightOpen: rightOpen,
            activeChat: acInit.chat,
            activeThread: acInit.thread,
            persist: persist,
            sessionOnlyChat: persist ? null : [],
            inflight: false,
            genId: 0,
            pendingDiff: null,
            lastFailedText: '',
            lastFailedMsg: '',
            lastUserText: '',
            settingsOpen: false,
            micOn: false,
            pipPos: readPipPos()
        };
        if (!persist) {
            self._chatSession.sessionOnlyChat = [];
            self._chatSession.activeChat = self._chatSession.sessionOnlyChat;
        }

        self._chatRender();
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
