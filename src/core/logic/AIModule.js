/* mBT Phase 60.A/60.B: AI Module, Assistant Bridge + Action Triggering
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
        return String(src).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
        /* Built from the action catalog at send time, see _buildActionPrompt. */
        chatActionPrompt: ''
    },

    /* ── Storage Accessors (Phase 173: thin wrappers over mBTAssistant) ──
       Legacy API kept intact so call sites in index.html, EventRouter, and
       ui.settings.js don't need to change. All actual storage I/O now goes
       through the mBTAssistant singleton, single source of truth. */
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
       The legacy (provider, apiKey) args are accepted but ignored, mBTAssistant
       reads them from its own state (which is the SAME localStorage keys, so
       behavior is identical). User constraint injection is preserved. */
    /* Plain sentence for any AI failure (raw provider text stays in the console). */
    plainError: function (raw) {
        if (window.mBTAssistant && typeof window.mBTAssistant.plainError === 'function') return window.mBTAssistant.plainError(raw);
        return 'The AI request did not work. Try again in a moment.';
    },

    /* callUnifiedAI resolves with an 'Analysis Failed: ...' string instead of rejecting.
       Returns the plain sentence when result is such a string, otherwise ''. */
    failureOf: function (result) {
        if (typeof result === 'string' && result.indexOf('Analysis Failed:') === 0) {
            return result.replace('Analysis Failed: ', '') || this.plainError('');
        }
        return '';
    },

    callUnifiedAI: function (provider, apiKey, prompt, customSystemMsg, history, imageAttachment) {
        var self = this;
        var userConstraints = self.getSystemPrompt();
        var baseInstruction = customSystemMsg || self.config.systemContext;
        var systemInstruction = userConstraints ? (baseInstruction + ' USER CONSTRAINTS: ' + userConstraints) : baseInstruction;

        if (window.mBTAssistant && typeof window.mBTAssistant.callChat === 'function') {
            var chatOpts = {
                userMessage:  prompt,
                systemPrompt: systemInstruction,
                history:      history || []
            };
            /* Vision part for an attached image. The provider layer owns whether
               it can send this; if it ignores the field the text turn still goes. */
            if (imageAttachment && imageAttachment.dataUrl) {
                chatOpts.image = {
                    name:    imageAttachment.name || 'image',
                    mime:    imageAttachment.mime || 'image/png',
                    dataUrl: imageAttachment.dataUrl
                };
            }
            return window.mBTAssistant.callChat(chatOpts).catch(function (error) {
                console.error('mBT AI Failure:', error);
                return 'Analysis Failed: ' + self.plainError(error);
            });
        }

        /* Hard fallback if mBTAssistant ever fails to load, keeps tool from crashing */
        return Promise.reject(new Error('mBTAssistant unavailable, AI service offline.')).catch(function (error) {
            console.error('mBT AI Failure:', error);
            return 'Analysis Failed: ' + self.plainError(error);
        });
    },

    /* Pulled chat sources: extracted text + a chip summary, per budget.
       Raw image/PDF is discarded after the first read. loaded=true means this
       chat injects the text. Delete the source and the text goes with it. */
    _ensureChatExtracts: function () {
        var b = window.budget;
        if (!b) return [];
        if (!Array.isArray(b.chatExtracts)) b.chatExtracts = [];
        return b.chatExtracts;
    },

    _summarizeExtract: function (att) {
        var t;
        var lines;
        var n;
        var i;
        if (!att) return 'Source';
        if (att.kind === 'image') return 'Photo';
        if (att.pages) return att.pages + (att.pages === 1 ? ' page' : ' pages');
        t = String(att.text || '');
        lines = t.split('\n');
        n = 0;
        for (i = 0; i < lines.length; i++) {
            if (String(lines[i]).replace(/\s/g, '').length) n++;
        }
        if (!n && t) n = 1;
        if (!n) return 'Source';
        return n + (n === 1 ? ' line' : ' lines');
    },

    _rememberChatExtract: function (att) {
        var list;
        var rec;
        if (!att) return;
        list = this._ensureChatExtracts();
        rec = {
            id: 'ce_' + Date.now() + '_' + Math.floor(Math.random() * 1e9),
            name: att.name || 'Attachment',
            kind: att.kind || 'text',
            summary: this._summarizeExtract(att),
            text: att.kind === 'image'
                ? ('Image "' + (att.name || 'photo') + '" was read on attach. Pixels were not kept.')
                : String(att.text || '').substring(0, 24000),
            loaded: true,
            added: Date.now()
        };
        list.push(rec);
        att.extractId = rec.id;
        if (typeof window.saveBudget === 'function') window.saveBudget(true);
        return rec;
    },

    _toggleChatExtract: function (id) {
        var list = this._ensureChatExtracts();
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === id) {
                list[i].loaded = !list[i].loaded;
                if (typeof window.saveBudget === 'function') window.saveBudget(true);
                return;
            }
        }
    },

    _deleteChatExtract: function (id) {
        var list = this._ensureChatExtracts();
        var i;
        for (i = list.length - 1; i >= 0; i--) {
            if (list[i] && list[i].id === id) list.splice(i, 1);
        }
        if (typeof window.saveBudget === 'function') window.saveBudget(true);
    },

    _isExtractLoaded: function (id) {
        var list = this._ensureChatExtracts();
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === id) return !!list[i].loaded;
        }
        return false;
    },

    _loadedExtractContext: function (skipId) {
        var list = this._ensureChatExtracts();
        var parts = [];
        var i;
        var e;
        for (i = 0; i < list.length; i++) {
            e = list[i];
            if (!e || !e.loaded || !e.text) continue;
            if (skipId && e.id === skipId) continue;
            parts.push('--- PULLED SOURCE: ' + String(e.name || 'Attachment').toUpperCase() +
                ' (' + (e.summary || 'source') + ') ---\n' + e.text);
        }
        return parts.join('\n\n');
    },

    /* ── Budget snapshot for chat ────────────────────────────────────────
       Chat used to send only the project name and grand total. The AI then had
       to guess section names and item descriptions, but applySuggestion matches
       them exactly, so a guess of "Production Crew" against a real key of
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
        var MAX_NOTES = 12;
        var MAX_NOTE_LEN = 240;
        var picked = [];
        var seen = {};
        var queryMatched = {};
        var i, r;

        /* fromQuery marks rows pulled by the user's own words in step 1. Only
           those carry a note; the spine pad stays rates-only so a simple ask
           does not drag 8 unrelated notes into the prompt. A row matched by the
           query and also on the spine keeps its note, because add() returns on
           the first sighting and the spine pass never overwrites the flag. */
        function add(rate, fromQuery) {
            if (!rate || seen[rate.description]) return;
            seen[rate.description] = true;
            if (fromQuery) queryMatched[rate.description] = true;
            picked.push(rate);
        }

        /* Notes are prose written for a producer, so they can carry newlines and
           run long. Flatten and clip for the prompt. Never assigns back onto the
           rate object: this function is read-only over OpenGate data. */
        function noteFor(rate) {
            if (!rate) return '';
            /* own-property check: a description like "constructor" would inherit
               a truthy value straight off Object.prototype otherwise */
            if (!Object.prototype.hasOwnProperty.call(queryMatched, rate.description)) return '';
            var note = rate.intelligence;
            if (typeof note !== 'string') return '';
            note = note.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
            if (!note) return '';
            if (note.length > MAX_NOTE_LEN) {
                note = note.slice(0, MAX_NOTE_LEN).replace(/\s+\S*$/, '') + '...';
            }
            return note;
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
            for (var j = 0; j < hits.length && j < 8; j++) add(hits[j], true);
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
        lines.push('Notes under a role are traps and exclusions (kit, buyouts, prep). The number on the card line is the rate. Ignore dollar figures inside notes.');
        var notesUsed = 0;
        for (i = 0; i < picked.length && i < MAX_ROWS; i++) {
            r = picked[i];
            lines.push('  ' + r.description + ' = ' + r.rate + ' per ' + (r.unit || 'Day') +
                       (r.itemType === 'equipment' ? ' [gear]' : ' [crew]'));
            if (notesUsed < MAX_NOTES) {
                var note = noteFor(r);
                if (note) {
                    lines.push('    note: ' + note);
                    notesUsed++;
                }
            }
        }
        lines.push('If something the user needs is NOT on this list, say so plainly and give your best estimate clearly labelled as an estimate. Never silently invent a rate that contradicts this card.');
        return lines.join('\n');
    },

    /* Stage day rollup: the SPAN of a stage, never the SUM. If crew A works 3
       days and crew B works 1 day in the same stage, the stage is 3 days, not
       4. Take the max stageData[k].days seen across all items, per stage.
       This is the single place that rule lives; _applyOne and the context
       builder both read from it so the AI and the confirm preview agree. */
    _rollupStageDays: function () {
        var budget = window.budget;
        var STAGE_KEYS = ['dev', 'pre', 'prod', 'post', 'dist'];
        var rolled = { dev: 0, pre: 0, prod: 0, post: 0, dist: 0 };
        if (!budget || !budget.sections) return rolled;

        var names = Object.keys(budget.sections);
        for (var s = 0; s < names.length; s++) {
            var sec = budget.sections[names[s]];
            if (!sec || !sec.items) continue;
            for (var i = 0; i < sec.items.length; i++) {
                var it = sec.items[i];
                if (!it || !it.stageData) continue;
                for (var k = 0; k < STAGE_KEYS.length; k++) {
                    var key = STAGE_KEYS[k];
                    var sd = it.stageData[key];
                    if (!sd) continue;
                    var d = parseFloat(sd.days);
                    if (isNaN(d)) continue;
                    if (d > rolled[key]) rolled[key] = d; /* max, not sum */
                }
            }
        }
        return rolled;
    },

    _buildBudgetContext: function () {
        var budget = window.budget;
        if (!budget || !budget.sections) return '';

        var MAX_ITEMS_TOTAL = 40;
        var MAX_PER_SECTION = 12;
        var emitted = 0;
        var lines = [];
        /* Every amount below is stored in the budget's own currency, so that is the label. */
        var cur = budget.currency || window.displayCurrency || '';

        lines.push('CURRENT BUDGET, use these names exactly as written:');
        lines.push('Project: ' + (budget.projectName || 'Untitled'));
        lines.push('Budget currency: ' + cur);
        lines.push('Grand total: ' + cur + ' ' + (budget.grandTotal || 0));
        var capNow = (budget.targetLock && parseFloat(budget.targetLock.totalCap)) || 0;
        var grandNow = parseFloat(budget.grandTotal) || 0;
        if (capNow > 0) {
            lines.push('Budget cap: ' + cur + ' ' + this._money(capNow) + ' (the grand total is ' + (grandNow > capNow ? 'OVER it by ' + this._money(grandNow - capNow) : 'under it by ' + this._money(capNow - grandNow)) + ')');
        } else {
            lines.push('Budget cap: none set');
        }
        var rateText = this._rateLines(budget);
        if (rateText) lines.push(rateText);
        if (budget.contingencyPercentage !== undefined) {
            lines.push('Contingency: ' + budget.contingencyPercentage + '%');
        }
        var fee = window.mBT_Finance.summary(JSON.parse(JSON.stringify(budget)));
        lines.push('productionFeePercentage: ' + fee.productionFeePercentage);
        lines.push('productionFeeAmount: ' + cur + ' ' + fee.productionFeeAmount);
        lines.push('duplicateFeeWarning: ' + fee.duplicateFeeWarning);
        lines.push('Production fee tiers: 10% small/favour, 15% standard, 20% rush/complex/heavy crew.');
        if (fee.duplicateFeeWarning) lines.push(window.mBT_Finance.duplicateFeeWarningText);
        if (this._lastApply && this._lastApply.text) {
            lines.push('');
            lines.push('LAST APPLY (what the app really did when the user pressed Apply; it is the truth, your own arithmetic is not): ' + this._lastApply.title);
            lines.push(this._lastApply.text.length > 1500 ? this._lastApply.text.slice(0, 1500) + '...' : this._lastApply.text);
        }

        var names = Object.keys(budget.sections);
        for (var s = 0; s < names.length; s++) {
            var sec = budget.sections[names[s]];
            if (!sec) continue;
            var items = sec.items || [];
            lines.push('');
            lines.push('Section: ' + names[s]);
            var shown = 0;
            var nameCount = {};
            for (var ni = 0; ni < items.length; ni++) {
                if (!items[ni]) continue;
                var nk = this._normalizeName(items[ni].description);
                nameCount[nk] = (nameCount[nk] || 0) + 1;
            }
            for (var i = 0; i < items.length; i++) {
                if (emitted >= MAX_ITEMS_TOTAL || shown >= MAX_PER_SECTION) break;
                var it = items[i];
                if (!it) continue;
                var qty = parseFloat(it.quantity);
                if (isNaN(qty)) qty = 0;
                var rate = parseFloat(it.rate);
                if (isNaN(rate)) rate = 0;
                var stageSuffix = '';
                if (it.stageData) {
                    var sdParts = [];
                    var STAGE_KEYS = ['dev', 'pre', 'prod', 'post', 'dist'];
                    for (var sk = 0; sk < STAGE_KEYS.length; sk++) {
                        var sdv = it.stageData[STAGE_KEYS[sk]];
                        if (!sdv) continue;
                        var sdDays = parseFloat(sdv.days);
                        if (isNaN(sdDays)) continue;
                        sdParts.push(STAGE_KEYS[sk] + ': ' + sdDays + 'd');
                    }
                    if (sdParts.length) stageSuffix = ', stages ' + sdParts.join(', ');
                }
                lines.push('  - ' + (it.description || 'Item') +
                           ' (' + (nameCount[this._normalizeName(it.description)] > 1 ? 'line ' + (i + 1) + ', the name repeats, ' : '') + 'qty ' + qty + (it.unit ? ' ' + it.unit : '') +
                           ', rate ' + cur + ' ' + rate + stageSuffix + ')');
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

        /* SCHEDULE: workweek, per-stage day counts (including zero, so the
           model can see what is unfilled), and the rolled up span per stage
           computed by the max rule, so the model can compare assigned days
           against what the header shows. */
        var workWeek = (budget.settings && budget.settings.workWeek) || 5;
        lines.push('');
        lines.push('SCHEDULE:');
        lines.push('Work week: ' + workWeek + ' days' +
                   (workWeek === 5 ? ' (Mon to Fri)' : (workWeek === 6 ? ' (Mon to Sat)' : ' (Mon to Sun)')));

        var stageLabels = { dev: 'Development', pre: 'Pre-Production', prod: 'Production', post: 'Post-Production', dist: 'Distribution' };
        var STAGE_KEYS2 = ['dev', 'pre', 'prod', 'post', 'dist'];
        var tlStages = (budget.targetLock && budget.targetLock.stages) ? budget.targetLock.stages : {};
        var rolled = this._rollupStageDays();
        for (var ks = 0; ks < STAGE_KEYS2.length; ks++) {
            var stageKey = STAGE_KEYS2[ks];
            var stageEntry = tlStages[stageKey];
            var label = (stageEntry && stageEntry.label) ? stageEntry.label : stageLabels[stageKey];
            var setDays = stageEntry ? (parseFloat(stageEntry.days) || 0) : 0;
            var rolledDays = rolled[stageKey] || 0;
            var note = '';
            if (rolledDays > setDays) note = ' [assigned items need ' + rolledDays + 'd, exceeds the ' + setDays + 'd set on the stage]';
            lines.push('  - ' + stageKey + ' (' + label + '): ' + setDays + ' days set' +
                       (rolledDays > 0 ? ', ' + rolledDays + ' days assigned across items (span, not sum)' : ', no items assigned') +
                       note);
        }

        /* DETAILS the Assistant can change, so the model names real records. */
        var q = function (v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').substring(0, 60); };
        lines.push('');
        lines.push('DETAILS:');
        lines.push('Company: ' + q(budget.company) + '; Location: ' + q(budget.projectLocation) + '; Start date: ' + q(budget.startDate) +
                   '; Shoot date: ' + q(budget.shootDate) + '; Delivery date: ' + q(budget.deliveryDate) +
                   '; Sales tax: ' + (budget.salesTaxPercentage || 0) + '%; Discount: ' + (budget.discountPercentage || 0) + '%; Display currency: ' + cur);
        var fs = budget.fundingSources || [], fi;
        for (fi = 0; fi < fs.length && fi < 12; fi++) {
            lines.push('Funding source: ' + q(fs[fi].name) + ' (' + q(fs[fi].amount) + ' ' + q(fs[fi].currency) + ', ' + q(fs[fi].status) + ')');
        }
        var pos = (budget.ledgers && budget.ledgers.pos) || [], pi;
        for (pi = 0; pi < pos.length && pi < 12; pi++) {
            lines.push('Purchase order: ' + q(pos[pi].poNumber) + ' ' + q(pos[pi].vendor) + ' (' + q(pos[pi].amount) + ', ' + q(pos[pi].status) + ', ' + (pos[pi].contactId ? 'linked to a contact' : 'no contact linked') + ')');
        }
        var ms = budget.calendarNotes || [], mi;
        for (mi = 0; mi < ms.length && mi < 12; mi++) {
            lines.push('Milestone: ' + q(ms[mi].title) + (ms[mi].date ? ' on ' + q(ms[mi].date) : ''));
        }
        if (budget.blackoutDays && budget.blackoutDays.length) lines.push('Days off: ' + budget.blackoutDays.slice(0, 20).join(', '));
        var fr = budget.fringes || [], gi;
        for (gi = 0; gi < fr.length && gi < 12; gi++) {
            lines.push('Fringe: ' + q(fr[gi].name) + ' (' + q(fr[gi].rate) + '%' + (fr[gi].enabled === false ? ', off' : '') + ')');
        }

        return lines.join('\n');
    },

    /* Remove every json action block from text shown to the user. */
    _stripActionBlock: function (text) {
        var out = String(text || '').replace(/\x60\x60\x60(?:json|JSON)?\s*\{[\s\S]*?"mbt_action"[\s\S]*?\}\s*\x60\x60\x60/g, '');
        out = out.replace(/^\s+|\s+$/g, '');
        return out || 'Proposed budget changes are ready, use Preview & Apply below.';
    },

    /* ── Phase 60.B: Action Block Parser ─────────────────────────────────
       Every action block in the reply counts. Two or more become one batch,
       so a model that answers with one block per change loses nothing. */
    _parseActionFromResponse: function (text) {
        var ex = this._extractActionBlocks(text);
        var i, all = [];
        if (!ex.blocks.length) return null;
        if (ex.blocks.length === 1) return ex.blocks[0];
        for (i = 0; i < ex.blocks.length; i++) {
            if (ex.blocks[i].mbt_action === 'batch' && ex.blocks[i].changes) all = all.concat(ex.blocks[i].changes);
            else all.push(ex.blocks[i]);
        }
        return { mbt_action: 'batch', changes: all };
    },

    /* ── Name matching helpers ───────────────────────────────────────────
       The AI can return a near-miss: different case, extra spaces, or a
       prefix dropped ("Production Crew" vs "BTL: Production Crew"). Exact
       matching turned those into "Section not found" errors. Match loosely,
       but only accept an unambiguous hit, never guess between two. */
    _normalizeName: function (s) {
        return String(s || '')
            .toLowerCase()
            .replace(/&/g, ' and ')          /* "Logistics & Fees" == "Logistics and Fees" */
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/^\s+|\s+$/g, '');
    },

    /* Which section a name means. key is the one section, or null; hits lists every section that fits when more than one does. */
    _sectionMatch: function (wanted) {
        var budget = window.budget;
        if (!budget || !budget.sections) return { key: null, hits: [] };
        var keys = Object.keys(budget.sections);
        var i, hits = [], want, k;

        for (i = 0; i < keys.length; i++) {
            if (keys[i] === wanted) return { key: keys[i], hits: [keys[i]] };
        }
        want = this._normalizeName(wanted);
        if (!want) return { key: null, hits: [] };
        for (i = 0; i < keys.length; i++) {
            if (this._normalizeName(keys[i]) === want) hits.push(keys[i]);
        }
        if (!hits.length) {
            /* Partial match, only when exactly one section contains the text. */
            for (i = 0; i < keys.length; i++) {
                k = this._normalizeName(keys[i]);
                if (k.indexOf(want) !== -1 || want.indexOf(k) !== -1) hits.push(keys[i]);
            }
        }
        return { key: hits.length === 1 ? hits[0] : null, hits: hits };
    },

    _findSectionKey: function (wanted) {
        return this._sectionMatch(wanted).key;
    },

    /* The sentence for a section name that did not resolve: not there, or more than one fits. */
    _sectionError: function (wanted) {
        var m = this._sectionMatch(wanted);
        if (m.hits.length > 1) return 'More than one section fits "' + wanted + '": "' + m.hits.join('", "') + '". Nothing was changed. Use the full name of the one you mean.';
        return 'Section not found: ' + (wanted || '(none)');
    },

    _money: function (n) {
        var v = Math.round((parseFloat(n) || 0) * 100) / 100, p = String(Math.abs(v)).split('.');
        return (v < 0 ? '-' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (p[1] ? '.' + p[1] : '');
    },

    /* Positions (0 based) of the lines a name could mean: exact matches first, then the same ignoring case and punctuation, then a partial match. */
    _itemMatch: function (sec, wanted) {
        var items = (sec && sec.items) || [];
        var want = this._normalizeName(wanted);
        var tiers = [[], [], []], i, d;
        for (i = 0; i < items.length; i++) {
            if (!items[i]) continue;
            d = this._normalizeName(items[i].description);
            if ((items[i].description || '') === wanted) tiers[0].push(i);
            if (want && d === want) tiers[1].push(i);
            if (want && d && (d.indexOf(want) !== -1 || want.indexOf(d) !== -1)) tiers[2].push(i);
        }
        for (i = 0; i < tiers.length; i++) { if (tiers[i].length) return tiers[i]; }
        return [];
    },

    _nameFits: function (desc, wanted) {
        var d = this._normalizeName(desc), w = this._normalizeName(wanted);
        return !!w && !!d && (String(desc || '') === String(wanted) || d === w || d.indexOf(w) !== -1 || w.indexOf(d) !== -1);
    },

    /* "line 1 "Director" (quantity 1, rate 85,000); line 3 ..." for the lines at these positions. */
    _lineWords: function (items, idxs) {
        var out = [], i, it;
        for (i = 0; i < idxs.length; i++) {
            it = items[idxs[i]] || {};
            out.push('line ' + (idxs[i] + 1) + ' "' + (it.description || '') + '" (quantity ' + this._money(it.quantity) + ', rate ' + this._money(it.rate) + ')');
        }
        return out.join('; ');
    },

    /* The one line a change means. Never guesses: when two or more lines fit the name, or the line number named does not
       fit the name, there is no item and err says why, with the lines named so the model or user can pick.
       line is the 1 based position in the section, as the budget list shows it. */
    _pickItem: function (sec, secName, wanted, line) {
        var items = (sec && sec.items) || [];
        var hits, n, it;
        if (line !== undefined && line !== null && line !== '') {
            n = parseInt(line, 10);
            if (isNaN(n) || n < 1 || n > items.length) return { item: null, bad: true, err: 'Line ' + line + ' is not in "' + secName + '", which has ' + items.length + ' lines. Nothing was changed.' };
            it = items[n - 1];
            if (!it || !this._nameFits(it.description, wanted)) return { item: null, bad: true, err: 'Line ' + n + ' in "' + secName + '" is "' + ((it && it.description) || '') + '", not "' + (wanted || '(none)') + '". Nothing was changed.' };
            return { item: it };
        }
        hits = this._itemMatch(sec, wanted);
        if (hits.length === 1) return { item: items[hits[0]] };
        if (hits.length > 1) {
            return { item: null, ambiguous: true, err: 'More than one line in "' + secName + '" fits "' + (wanted || '') + '": ' + this._lineWords(items, hits) + '. Nothing was changed. Say which one with its line number, for example "line":' + (hits[0] + 1) + '.' };
        }
        return { item: null, err: 'Item not found: ' + (wanted || '(none)') + ' in ' + secName };
    },

    _findItem: function (sec, wanted) {
        return this._pickItem(sec, '', wanted).item || null;
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

    /* Where an added line will go. With "Put new lines in their department's section" on, a recognised line goes in its
       department's section (the department can be changed in the preview); otherwise it goes in the section the reply names. */
    _addItemWhere: function (c) {
        var b = window.budget;
        if (window.mBTBatch2 && mBTBatch2.deptSectionsOn(b)) {
            var p = mBTBatch2.plan(b, { description: c.description }, c.department);
            if (!p.needsChoice) return p.section + ' (' + p.label + (p.created ? ', new section' : '') + ')';
        }
        return c.section || '?';
    },

    /* The department an added line will get: the one chosen in the preview, else the one detected from its name.
       Null when neither exists; such a line is not added until a department is chosen. */
    _addItemDept: function (c) {
        if (!window.mBTBatch2) return null;
        if (mBTBatch2.groups[c.department]) return c.department;
        return mBTBatch2.classify({ description: c.description }) || null;
    },

    /* ── Action catalog ───────────────────────────────────────────────────
       One list drives the prompt the model sees, the preview text and the
       check that an action exists. Anything not listed here is refused with
       a plain sentence, never silently dropped and never reported as done.
       hand = where the user does it by hand. */
    _PRODUCTION_FEE_RULES: 'PRODUCTION FEE: Suggest a tier from job size/type for new drafts: 10% small/favour, 15% standard, 20% rush/complex/heavy crew. Use productionFeePercentage (0..100); contingency is never a substitute. Never set or add a fee retroactively to an already-agreed budget unless the user asks. Use update_production_fee for requested changes, including in batch. Never use the legacy Production Fee fringe. If duplicateFeeWarning is true, tell the user both charges are included and ask which to keep; do not add a second fee.',

    _ACTION_ORDER: [
        'update_rate', 'update_quantity', 'add_item', 'add_section', 'update_contingency', 'update_production_fee', 'set_workweek', 'set_stage_days',
        'update_item', 'delete_item', 'move_item', 'set_crew', 'set_item_days',
        'rename_section', 'delete_section',
        'duplicate_budget', 'rename_budget', 'set_field', 'set_display_currency',
        'add_funding_source', 'update_funding_source', 'delete_funding_source',
        'add_po', 'update_po', 'delete_po',
        'add_milestone', 'update_milestone', 'delete_milestone', 'add_blackout_day', 'remove_blackout_day',
        'add_fringe', 'update_fringe', 'delete_fringe',
        'set_section_cap', 'set_incentive',
        'add_float', 'update_float', 'delete_float', 'add_receipt', 'delete_receipt',
        'set_stage_share', 'set_stage_lock', 'set_stage_offset',
        'save_contact', 'rename_contact'
    ],

    _ACTIONS: {
        update_rate:           { hand: 'the Rate box on the line', ex: '{"mbt_action":"update_rate","section":"Section Name","description":"Item Description","value":0}' },
        update_quantity:       { hand: 'the Qty box on the line', ex: '{"mbt_action":"update_quantity","section":"Section Name","description":"Item Description","value":0}' },
        add_item:              { hand: 'ADD LINE ITEM under the section', ex: '{"mbt_action":"add_item","section":"Section Name","description":"Item Description","quantity":1,"rate":0,"unit":"Day"}' },
        add_section:           { hand: 'ADD SECTION at the bottom of the budget', ex: '{"mbt_action":"add_section","section":"New Section"}' },
        update_production_fee: { hand: 'the Production Fee box in the budget header', ex: '{"mbt_action":"update_production_fee","value":15}' },
        update_contingency:    { hand: 'the Contingency box in the budget header', ex: '{"mbt_action":"update_contingency","value":10}' },
        set_workweek:          { hand: 'the work week control in the header', ex: '{"mbt_action":"set_workweek","value":5}' },
        set_stage_days:        { hand: 'the Stages tool', ex: '{"mbt_action":"set_stage_days","stage":"prod","days":6}' },
        update_item:           { hand: 'the line itself', ex: '{"mbt_action":"update_item","section":"Section Name","description":"Item Description","new_description":"New name","unit":"Day","multiplier":1,"quantity":1,"rate":0,"actual":0,"actual_quantity":0,"actual_rate":0,"actual_date":"2026-01-31","qualifying":true,"rate_lock":false,"notes":"text"}' },
        delete_item:           { hand: 'the line menu, Delete', ex: '{"mbt_action":"delete_item","section":"Section Name","description":"Item Description"}' },
        move_item:             { hand: 'dragging the line to another section', ex: '{"mbt_action":"move_item","section":"From Section","description":"Item Description","to_section":"To Section"}' },
        set_crew:              { hand: 'the crew name on the line', ex: '{"mbt_action":"set_crew","section":"Section Name","description":"Item Description","name":"Person Name","phone":"","email":""}' },
        set_item_days:         { hand: 'the schedule button on the line', ex: '{"mbt_action":"set_item_days","section":"Section Name","description":"Item Description","stage":"prod","days":3,"rate":0,"multiplier":1}' },
        rename_section:        { hand: 'the section menu, Rename', ex: '{"mbt_action":"rename_section","section":"Old Name","new_name":"New Name"}' },
        delete_section:        { hand: 'the section menu, Delete', ex: '{"mbt_action":"delete_section","section":"Section Name"}' },
        duplicate_budget:      { hand: 'the Duplicate button in the project menu', ex: '{"mbt_action":"duplicate_budget","name":"New Budget Name"}' },
        rename_budget:         { hand: 'the project name at the top of the budget', ex: '{"mbt_action":"rename_budget","name":"New Budget Name"}' },
        set_field:             { hand: 'Settings, then the budget details', ex: '{"mbt_action":"set_field","field":"company","value":"Example Films"}' },
        set_display_currency:  { hand: 'the round currency button under the project name', ex: '{"mbt_action":"set_display_currency","value":"USD"}' },
        add_funding_source:    { hand: 'the Funding card', ex: '{"mbt_action":"add_funding_source","name":"Source Name","amount":0,"status":"Pending","currency":"JMD","cashInBank":0,"contactName":"","contactEmail":"","contactPhone":"","contractUrl":"","notes":""}' },
        update_funding_source: { hand: 'the Funding card', ex: '{"mbt_action":"update_funding_source","name":"Source Name","new_name":"","amount":0,"status":"Confirmed","currency":"JMD","cashInBank":0,"contactName":"","contactEmail":"","contactPhone":"","contractUrl":"","notes":""}' },
        delete_funding_source: { hand: 'the Funding card', ex: '{"mbt_action":"delete_funding_source","name":"Source Name"}' },
        add_po:                { hand: 'the Purchase orders tool', ex: '{"mbt_action":"add_po","vendor":"Vendor Name","amount":0,"description":"","date":"2026-01-31","status":"Draft","contact":"","section":"Section Name","item":"Item Description"}' },
        update_po:             { hand: 'the Purchase orders tool', ex: '{"mbt_action":"update_po","po_number":"PO-001","vendor":"","amount":0,"status":"Paid","description":"","date":"","notes":"","contact":"","section":"Section Name","item":"Item Description"}' },
        delete_po:             { hand: 'the Purchase orders tool', ex: '{"mbt_action":"delete_po","po_number":"PO-001"}' },
        add_milestone:         { hand: 'the Calendar tool', ex: '{"mbt_action":"add_milestone","title":"Milestone","date":"2026-01-31"}  or, tied to a stage instead of a date: {"mbt_action":"add_milestone","title":"Milestone","stage":"prod","offset_days":0}' },
        update_milestone:      { hand: 'the Calendar tool', ex: '{"mbt_action":"update_milestone","title":"Milestone","new_title":"","date":"2026-02-01"}  or: {"mbt_action":"update_milestone","title":"Milestone","stage":"post","offset_days":3}' },
        delete_milestone:      { hand: 'the Calendar tool', ex: '{"mbt_action":"delete_milestone","title":"Milestone"}' },
        add_blackout_day:      { hand: 'the Calendar tool', ex: '{"mbt_action":"add_blackout_day","date":"2026-01-31"}' },
        remove_blackout_day:   { hand: 'the Calendar tool', ex: '{"mbt_action":"remove_blackout_day","date":"2026-01-31"}' },
        add_fringe:            { hand: 'the Fringes tool', ex: '{"mbt_action":"add_fringe","name":"Fringe Name","rate":5,"sections":["Section Name"]}' },
        update_fringe:         { hand: 'the Fringes tool', ex: '{"mbt_action":"update_fringe","name":"Fringe Name","new_name":"","rate":5,"enabled":true,"sections":["Section Name"]}' },
        delete_fringe:         { hand: 'the Fringes tool', ex: '{"mbt_action":"delete_fringe","name":"Fringe Name"}' },
        set_section_cap:       { hand: 'the target icon on the section header', ex: '{"mbt_action":"set_section_cap","section":"Section Name","value":0}' },
        set_incentive:         { hand: 'the Tax Incentive button in the budget header', ex: '{"mbt_action":"set_incentive","jurisdiction":"JAMPRO","rate":20,"min_spend":0}' },
        add_float:             { hand: 'the Purchase orders tool, Petty cash tab', ex: '{"mbt_action":"add_float","holder":"Person Name","amount":0,"date":"2026-01-31"}' },
        update_float:          { hand: 'the Purchase orders tool, Petty cash tab', ex: '{"mbt_action":"update_float","holder":"Person Name","amount":0,"status":"Active","date":""}' },
        delete_float:          { hand: 'the Purchase orders tool, Petty cash tab', ex: '{"mbt_action":"delete_float","holder":"Person Name"}' },
        add_receipt:           { hand: 'the Purchase orders tool, Petty cash tab', ex: '{"mbt_action":"add_receipt","holder":"Person Name","description":"Receipt Description","amount":0,"date":"2026-01-31"}' },
        delete_receipt:        { hand: 'the Purchase orders tool, Petty cash tab', ex: '{"mbt_action":"delete_receipt","holder":"Person Name","description":"Receipt Description"}' },
        set_stage_share:       { hand: 'the stage sliders in the Stages tool', ex: '{"mbt_action":"set_stage_share","stage":"prod","value":40}' },
        set_stage_lock:        { hand: 'the lock on the stage card in the Stages tool', ex: '{"mbt_action":"set_stage_lock","stage":"prod","locked":true}' },
        set_stage_offset:      { hand: 'the Stage offset box in the Calendar tool', ex: '{"mbt_action":"set_stage_offset","stage":"pre","days":0}' },
        save_contact:          { hand: 'the Contacts tool', ex: '{"mbt_action":"save_contact","name":"Person Name","role":"Gaffer","email":"","phone":"","department":"","category":"Crew","rate":0,"currency":"JMD","wallet_type":"","wallet_address":"","dietary_restrictions":"","allergies":"","clear":[]}' },
        rename_contact:        { hand: 'the Contacts tool, Edit on the contact, then change the name on each crew line, purchase order and petty cash float', ex: '{"mbt_action":"rename_contact","name":"Current Contact Name","new_name":"New Contact Name"}' }
    },

    /* Things the Assistant cannot do, with where the user does them. */
    _NOT_SUPPORTED_TEXT: 'NOT SUPPORTED (say so in one plain sentence, name what you could not do and where to do it by hand, and output no action block for it): ' +
        'deleting a contact (Contacts tool), documents, call sheets and attachments (Docs tool), exchange rates (currency menu, Edit exchange rates), sharing and collaborators (Share tool), exports and imports (File menu), deleting a whole budget (project menu), ' +
        'renaming a contact inside a shared budget that is not the open one (open that shared budget and ask again there), shared read only contacts.',

    /* The block of the prompt that lists every action. Built from the catalog. */
    _buildActionPrompt: function () {
        var out = 'ACTION CAPABILITY: You can BUILD and MODIFY this budget, but only with the actions listed here. ' +
            'To make a change, output ONE JSON action block in a json code fence, then a brief explanation. ' +
            'The user must press Preview & Apply before anything changes, so never say a change is done, say it is ready to apply. ' +
            'Never invent an action name or a field that is not listed. If a request needs something not listed, say in one plain sentence what you cannot do and where the user does it by hand.\n\n';
        var i, name;
        out += this._PRODUCTION_FEE_RULES + '\n\n';
        out += 'ACTIONS (each is one object with "mbt_action"):\n';
        for (i = 0; i < this._ACTION_ORDER.length; i++) {
            name = this._ACTION_ORDER[i];
            out += this._ACTIONS[name].ex + '\n';
        }
        out += '\nSeveral changes at once (also use this to build a new section or a whole budget):\n\x60\x60\x60json\n' +
            '{"mbt_action":"batch","changes":[{"mbt_action":"add_section","section":"Camera Department"},{"mbt_action":"add_item","section":"Camera Department","description":"Camera Operator","quantity":5,"rate":40000,"unit":"Day"}]}\n\x60\x60\x60\n\n' +
            'set_field fields: company, projectCompany, projectLocation, startDate, shootDate, deliveryDate (dates as YYYY-MM-DD), salesTaxPercentage, discountPercentage, totalCap (the overall budget cap, 0 = off), actualsMode (true or false). ' +
            'Only the fields shown in the examples exist: an action with any other field is refused. A fringe with no "sections" applies to the whole budget subtotal. ' +
            'Stage is one of dev, pre, prod, post, dist. Work week is 5, 6 or 7. Funding status is Pending, LOI, Confirmed or Received. PO status is Draft, Issued, Approved or Paid.\n' +
            'When the user asks to copy, duplicate or make a version of the budget, the FIRST change must be duplicate_budget with a new name; every later change in that batch is made on the copy and the original is left alone. Without it every change goes straight into the open budget, so never edit the open budget to make a copy.\n' +
            'A cap or limit is set with set_field totalCap. If the user gives it in another currency, send "value" as the amount they said and "currency" as its three letter code, for example {"mbt_action":"set_field","field":"totalCap","value":4000,"currency":"USD"}; the app converts it with this budget\'s own exchange rate. When a cap is asked for, send totalCap; do not only say what it would be.\n' +
            'Two lines in a section can share a name. The CURRENT BUDGET list marks them "line N, the name repeats"; for those add "line":N to the change (update_rate, update_quantity, update_item, delete_item, move_item, set_crew, set_item_days). A change by name alone to a repeated name is refused. Do not add_item a line whose name is already in the section: change the existing line instead.\n' +
            'Other records can share a name too: a petty cash float holder, a receipt description, a funding source, a purchase order number, a milestone title, a fringe. A change by name alone to a name two records share is refused, and the refusal lists them as "number N"; send the change again with "position":N (for delete_receipt, "receipt_position":N picks the receipt and "position":N the float).\n' +
            'After the user presses Apply the app puts LAST APPLY and the grand total against the budget cap in the CURRENT BUDGET list. Only what LAST APPLY says happened happened; a change it lists as "Nothing changed" or refused did not work. Use those totals, not your own arithmetic. When fitting a budget to a cap, if the grand total is still over the cap say by how much and what you would change next; never say the work is done while it is over.\n' +
            'Contacts: you cannot see the Contacts list, so never say a contact exists or is missing. When the user names a contact, propose the action with the name exactly as the user gave it; the app checks it against Contacts and tells the user plainly if it is not saved. ' +
            'rename_contact changes the name of a saved contact, and the same name on every crew line, purchase order and petty cash float of the open budget and of every other saved budget on this device that is not shared. Shared budgets belong to the people who share them and are never changed by a rename: they are reported, and the user opens each and asks again there. ' +
            'add_po and update_po take "contact": the name of a saved contact. It links the purchase order to that contact and sets the vendor to the contact name. Leave "contact" as "" to leave the link alone. If the user asks to add a new contact and link it, put save_contact first and the link after it in the same batch. Never save a contact the user did not ask to add.\n\n' +
            this._NOT_SUPPORTED_TEXT + '\n\n' +
            'RULES: Use the OPENGATE RATE CARD rates verbatim for anything listed there, never round, adjust or invent a number that is on the card. Copy section and item names EXACTLY as they appear in the CURRENT BUDGET list. Use add_section before adding items to a section that does not exist yet. Never invent a section name that is not in the list unless you are creating it with add_section. Stage days are a span, not a sum, take the longest single assignment within a stage, never add crew days together. Keep explanations brief.';
        return out;
    },

    _isKnownAction: function (a) {
        return a === 'batch' || Object.prototype.hasOwnProperty.call(this._ACTIONS, a);
    },

    /* Every JSON action block in a reply, in order. bad counts blocks that
       mention mbt_action but could not be read. */
    _extractActionBlocks: function (text) {
        var re = /\x60\x60\x60(?:json|JSON)?\s*(\{[\s\S]*?"mbt_action"[\s\S]*?\})\s*\x60\x60\x60/g;
        var found = [], bad = 0, m, obj;
        text = String(text || '');
        while ((m = re.exec(text)) !== null) {
            try {
                obj = JSON.parse(m[1]);
                if (obj && obj.mbt_action) found.push(obj); else bad++;
            } catch (e) { bad++; }
        }
        return { blocks: found, bad: bad };
    },

    /* Plain, honest notes under an assistant message. Returns html (escaped)
       or ''. applied = the user already applied this message's change. */
    _assistantNotes: function (content, diff, applied, esc) {
        var ex = this._extractActionBlocks(content);
        var notes = [];
        var i, j, changes, bad = [], fieldBad = [], a, hand;
        if (diff) {
            changes = (diff.mbt_action === 'batch' && diff.changes && diff.changes.length) ? diff.changes : [diff];
            for (i = 0; i < changes.length; i++) {
                a = changes[i] && changes[i].mbt_action;
                if (!this._isKnownAction(a)) bad.push(String(a));
                else if (this._unsupportedField(changes[i])) fieldBad.push(this._unsupportedField(changes[i]));
            }
            if (fieldBad.length && !bad.length) {
                notes.push(fieldBad[0] + ' Nothing will be applied until the request is changed.');
            } else if (bad.length) {
                notes.push('The Assistant cannot do this yet: ' + bad.join(', ') + '. Nothing will be applied until the request is changed. Ask for it another way, or make the change by hand.');
            } else if (!applied) {
                notes.push('Not applied yet. Nothing in the budget has changed until you press Preview & Apply and confirm.');
            }
        } else if (ex.bad || /"mbt_action"/.test(content || '')) {
            notes.push('The change in this reply could not be read, so nothing was changed. Ask again.');
        } else if (/\b(i['’]?ve|i have|i did|we['’]?ve|has been|have been|is now|are now|all done|done[.!]|completed|updated|applied|duplicated|renamed|changed|added|removed|deleted|set the|created)\b/i.test(content || '')) {
            notes.push('No change was made to the budget. The Assistant only changes it through a Preview & Apply button, and none was offered here.');
        }
        if (!notes.length) return '';
        j = '';
        for (i = 0; i < notes.length; i++) {
            j += '<div data-assistant-note="1" class="mt-2 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-800">' + esc(notes[i]) + '</div>';
        }
        return j;
    },

    /* Every top level field the Assistant can change, for the undo record. */
    _UNDO_ROOTS: ['sections', 'contingencyPercentage', 'productionFeePercentage', 'settings', 'targetLock', 'company', 'projectCompany', 'projectLocation',
        'startDate', 'shootDate', 'deliveryDate', 'salesTaxPercentage', 'discountPercentage', 'fundingSources', 'ledgers',
        'calendarNotes', 'blackoutDays', 'fringes', 'jurisdiction', 'actualsMode', 'globalItems', 'shootSchedule'],

    _SET_FIELDS: { company: 'text', projectCompany: 'text', projectLocation: 'text', startDate: 'date', shootDate: 'date', deliveryDate: 'date',
        salesTaxPercentage: 'pct', discountPercentage: 'pct', totalCap: 'cap', actualsMode: 'bool' },

    /* Fields the model may put in each action, read from the examples in the
       catalog. Anything else is refused up front, so a field the app cannot
       change is never reported as changed. */
    _IGNORED_KEYS: { reason: 1, explanation: 1, comment: 1, rationale: 1 },
    _LINE_ACTIONS: { update_rate: 1, update_quantity: 1, update_item: 1, delete_item: 1, move_item: 1, set_crew: 1, set_item_days: 1 },
    /* Actions that change nothing in the budget's own saved fields, so "nothing changed" does not apply to them. */
    _NOT_TRACKED: { duplicate_budget: 1, rename_budget: 1, set_display_currency: 1, save_contact: 1, rename_contact: 1 },
    _allowedKeys: function (a) {
        var ex, re = /"([A-Za-z_]+)":/g, m, out = {};
        if (!this._allowedCache) this._allowedCache = {};
        if (this._allowedCache[a]) return this._allowedCache[a];
        ex = this._ACTIONS[a] ? this._ACTIONS[a].ex : '';
        while ((m = re.exec(ex)) !== null) out[m[1]] = 1;
        /* The preview's department picker sets this on an added line, so it is a field of add_item even though the example omits it. */
        if (a === 'add_item') out.department = 1;
        /* Two lines can share a name: "line" (the position shown in the budget list) says which one. */
        if (this._LINE_ACTIONS[a] || a === 'add_po' || a === 'update_po') out.line = 1;
        /* A cap can be given in another currency; the app converts it with the budget's own rate. */
        if (a === 'set_field') out.currency = 1;
        /* Two records can share a name (float holder, receipt, funding source, order number, milestone, fringe): "position" says which one. */
        if (this._REC_POS[a]) out.position = 1;
        if (a === 'delete_receipt') out.receipt_position = 1;
        this._allowedCache[a] = out;
        return out;
    },

    _isDate: function (s) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
        var d;
        if (!m) return false;
        d = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)));
        return d.getUTCFullYear() === parseInt(m[1], 10) && d.getUTCMonth() === parseInt(m[2], 10) - 1 && d.getUTCDate() === parseInt(m[3], 10);
    },

    _nameLegal: function (n) { return !!n && !/["<>\/\\]/.test(n); },

    /* Records the Assistant finds by name. position is the 1 based place in the list, as the refusal below prints it. */
    _REC_KINDS: {
        float:     { field: 'floatHolder', pos: 'position', noun: 'petty cash float', missing: 'Petty cash float not found for: ' },
        receipt:   { field: 'description', pos: 'receipt_position', noun: 'receipt', missing: 'Receipt not found: ' },
        funding:   { field: 'name', pos: 'position', noun: 'funding source', missing: 'Funding source not found: ' },
        po:        { field: 'poNumber', pos: 'position', noun: 'purchase order', missing: 'Purchase order not found: ' },
        milestone: { field: 'title', pos: 'position', noun: 'milestone', missing: 'Milestone not found: ' },
        fringe:    { field: 'name', pos: 'position', noun: 'fringe', missing: 'Fringe not found: ' }
    },
    _REC_POS: { update_float: 1, delete_float: 1, add_receipt: 1, delete_receipt: 1, update_funding_source: 1, delete_funding_source: 1,
        update_po: 1, delete_po: 1, update_milestone: 1, delete_milestone: 1, update_fringe: 1, delete_fringe: 1 },

    _recWords: function (kind, r) {
        var cur = r.currency ? r.currency + ' ' : '';
        if (kind === 'float') return 'amount ' + cur + this._money(r.floatAmount) + ', status ' + (r.status || '-');
        if (kind === 'receipt') return 'amount ' + cur + this._money(r.amount) + ', date ' + (r.date || '-');
        if (kind === 'funding') return 'amount ' + cur + this._money(r.amount) + ', status ' + (r.status || '-');
        if (kind === 'po') return 'vendor ' + (r.vendor || '-') + ', amount ' + cur + this._money(r.amount);
        if (kind === 'milestone') return r.type === 'relative' ? 'stage ' + (r.stageKey || '-') + ', offset ' + (r.offsetDays || 0) + ' days' : 'date ' + (r.date || '-');
        return 'rate ' + (r.rate === undefined ? '-' : r.rate);
    },

    /* The one record a change means. Never guesses: exact name first, then the same ignoring case and punctuation, then a partial match.
       When two or more fit, or the position named does not fit the name, there is no record and err says why, naming each match. */
    _pickRecord: function (list, kind, wanted, position) {
        var K = this._REC_KINDS[kind], items = list || [], tiers = [[], [], []], i, d, n, r, want, hits, out = [];
        wanted = String(wanted == null ? '' : wanted);
        if (position !== undefined && position !== null && position !== '') {
            n = parseInt(position, 10);
            if (isNaN(n) || n < 1 || n > items.length) return { rec: null, bad: true, err: 'Number ' + position + ' is not in the list of ' + K.noun + 's, which has ' + items.length + '. Nothing was changed.' };
            r = items[n - 1];
            if (!r || !this._nameFits(r[K.field], wanted)) return { rec: null, bad: true, err: 'Number ' + n + ' is "' + ((r && r[K.field]) || '') + '", not "' + (wanted || '(none)') + '". Nothing was changed.' };
            return { rec: r };
        }
        want = this._normalizeName(wanted);
        for (i = 0; i < items.length; i++) {
            if (!items[i]) continue;
            d = this._normalizeName(items[i][K.field]);
            if (String(items[i][K.field] || '') === wanted) tiers[0].push(i);
            if (want && d === want) tiers[1].push(i);
            if (want && d && (d.indexOf(want) !== -1 || want.indexOf(d) !== -1)) tiers[2].push(i);
        }
        hits = tiers[0].length ? tiers[0] : (tiers[1].length ? tiers[1] : tiers[2]);
        if (hits.length === 1) return { rec: items[hits[0]] };
        if (hits.length > 1) {
            for (i = 0; i < hits.length; i++) out.push('number ' + (hits[i] + 1) + ' "' + (items[hits[i]][K.field] || '') + '" (' + this._recWords(kind, items[hits[i]]) + ')');
            return { rec: null, ambiguous: true, err: 'More than one ' + K.noun + ' fits "' + wanted + '": ' + out.join('; ') + '. Nothing was changed. Say which one with its number, for example "' + K.pos + '":' + (hits[0] + 1) + '.' };
        }
        return { rec: null, err: K.missing + (wanted || '(none)') };
    },

    /* The same lookup for the preview, from the budget as it stands. Only a refusal comes back, never "not found". */
    _previewRecord: function (a, c, b) {
        var led = b.ledgers || {}, p, rp;
        if (a === 'update_float' || a === 'delete_float' || a === 'add_receipt' || a === 'delete_receipt') {
            p = this._pickRecord(led.pettyCash, 'float', String(c.holder || '').replace(/^\s+|\s+$/g, ''), c.position);
            if (p.rec && a === 'delete_receipt') p = this._pickRecord(p.rec.receipts, 'receipt', c.description, c.receipt_position);
        } else if (a === 'update_funding_source' || a === 'delete_funding_source') p = this._pickRecord(b.fundingSources, 'funding', c.name, c.position);
        else if (a === 'update_po' || a === 'delete_po') p = this._pickRecord(led.pos, 'po', c.po_number, c.position);
        else if (a === 'update_milestone' || a === 'delete_milestone') p = this._pickRecord(b.calendarNotes, 'milestone', c.title, c.position);
        else p = this._pickRecord(b.fringes, 'fringe', c.name, c.position);
        return (p && (p.ambiguous || p.bad)) ? p : null;
    },

    /* Position of a record in a list. The budget is a Proxy that hands out a
       new wrapper on every read, so identity cannot be compared: match on id. */
    _indexOfRec: function (list, rec) {
        var i;
        for (i = 0; i < (list || []).length; i++) {
            if (list[i] === rec) return i;
            if (rec && rec.id != null && list[i] && list[i].id === rec.id) return i;
        }
        return -1;
    },

    _newId: function (prefix) { return prefix + '_ai_' + Date.now() + '_' + Math.floor(Math.random() * 100000); },

    _num: function (v) { var n = parseFloat(v); return isNaN(n) ? null : n; },

    _recalcItem: function (item) {
        var q = parseFloat(item.quantity);   if (isNaN(q)) q = 0;
        var r = parseFloat(item.rate);       if (isNaN(r)) r = 0;
        var m = parseFloat(item.multiplier); if (isNaN(m) || !m) m = 1;
        item.total = q * r * m;
    },

    /* Quantity and rate go through the same steps as typing in the line's Qty
       or Rate box (index.html handleLineItemUpdate): a line with a schedule keeps
       its days and stage rates in step, because the schedule is what the totals
       are worked out from. Each records what it expects in ctx.expect, which is
       checked after the budget is recalculated. Returns an error string or null. */
    _expect: function (ctx, item, field, value, name) {
        var list, i;
        if (!ctx) return;
        if (!ctx.expect) ctx.expect = [];
        list = ctx.expect;
        for (i = list.length - 1; i >= 0; i--) { if (list[i].id === item.id && list[i].field === field) list.splice(i, 1); }
        list.push({ id: item.id, field: field, value: value, name: name || item.description });
    },

    _setLineQty: function (item, q, ctx) {
        var keys, sum, scale, share, i, d;
        item.quantity = q;
        if (item.stageData && typeof item.stageData === 'object' && Object.keys(item.stageData).length > 0) {
            keys = Object.keys(item.stageData);
            if (keys.length === 1) {
                item.stageData[keys[0]].days = q;
            } else {
                sum = 0;
                for (i = 0; i < keys.length; i++) sum += parseFloat(item.stageData[keys[i]].days) || 0;
                if (sum > 0) {
                    scale = q / sum;
                    for (i = 0; i < keys.length; i++) {
                        d = parseFloat(item.stageData[keys[i]].days) || 0;
                        item.stageData[keys[i]].days = Math.round(d * scale * 10000) / 10000;
                    }
                } else {
                    share = q / keys.length;
                    for (i = 0; i < keys.length; i++) item.stageData[keys[i]].days = share;
                }
            }
            if (!(ctx && ctx.dry) && typeof window.followPlanOnCalendar === 'function') {
                for (i = 0; i < keys.length; i++) window.followPlanOnCalendar(keys[i]);
            }
        }
        this._expect(ctx, item, 'quantity', q);
        return null;
    },

    _setLineRate: function (item, v, ctx) {
        var keys, i, sd;
        v = Math.round(v * 10000) / 10000;
        if (item.rateType === 'fixed') {
            return 'The rate on "' + item.description + '" is locked. Unlock it with the lock button on the line, then ask again.';
        }
        keys = (item.stageData && typeof item.stageData === 'object') ? Object.keys(item.stageData) : [];
        for (i = 0; i < keys.length; i++) {
            sd = item.stageData[keys[i]];
            if (sd.rateOverride && Math.abs((parseFloat(sd.rate) || 0) - v) > 0.00005) {
                return 'The rate on "' + item.description + '" is set on its own for the ' + keys[i] + ' stage, so one rate cannot be applied to the whole line. Change it in the Stages tool.';
            }
        }
        item.rate = v;
        item.rateType = 'negotiable';
        item.rateSource = 'custom';
        if (window.mBTBatch2 && typeof window.mBTBatch2.manual === 'function') window.mBTBatch2.manual(item);
        if (window.mBT && window.mBT.rates && typeof window.mBT.rates.reanchorFromRate === 'function') window.mBT.rates.reanchorFromRate(item);
        else item.baseRate = v;
        for (i = 0; i < keys.length; i++) {
            if (!item.stageData[keys[i]].rateOverride) item.stageData[keys[i]].rate = v;
        }
        this._expect(ctx, item, 'rate', v);
        return null;
    },

    /* After the budget is recalculated: did each rate and quantity asked for
       actually stick? Returns plain sentences for the ones that did not. */
    _checkExpect: function (list) {
        var out = [], i, e, item, keys, sum, got, j, bad;
        var budget = window.budget;
        function findById(id) {
            var sk, k, its;
            for (sk in budget.sections) {
                if (!Object.prototype.hasOwnProperty.call(budget.sections, sk)) continue;
                its = budget.sections[sk].items || [];
                for (k = 0; k < its.length; k++) { if (its[k].id === id) return its[k]; }
            }
            return null;
        }
        for (i = 0; i < (list || []).length; i++) {
            e = list[i];
            item = findById(e.id);
            if (!item) continue;
            keys = (item.stageData && typeof item.stageData === 'object') ? Object.keys(item.stageData) : [];
            if (e.field === 'quantity') {
                /* The line's own quantity after recalculation (payable days for a scheduled line). */
                got = parseFloat(item.quantity);
                if (isNaN(got) || Math.abs(got - e.value) > 0.001) {
                    out.push('"' + e.name + '" quantity is ' + (isNaN(got) ? 'not a number' : got) + ' after the budget was recalculated, not ' + e.value + '.' + (keys.length ? ' The stage calendar (work week, days off) decides how many days are paid, so change the days in the Stages tool.' : ''));
                }
            } else if (e.field === 'rate') {
                /* The line's own rate after recalculation (a scheduled line averages its stage rates and multipliers). */
                got = parseFloat(item.rate);
                if (isNaN(got) || Math.abs(got - e.value) > 0.001) {
                    out.push('"' + e.name + '" rate is ' + (isNaN(got) ? 'not a number' : Math.round(got * 100) / 100) + ' after the budget was recalculated, not ' + e.value + '.' + (keys.length ? ' A stage multiplier changes the rate the line shows, so change it in the Stages tool.' : ''));
                }
            }
        }
        return out;
    },

    _describeNew: function (c) {
        var cur = window.displayCurrency || '';
        var a = c.mbt_action;
        var d = '"' + (c.description || 'line') + '"';
        if (a === 'update_item') {
            var parts = [], k, keys = ['new_description', 'unit', 'multiplier', 'quantity', 'rate', 'actual', 'actual_quantity', 'actual_rate', 'actual_date', 'qualifying', 'rate_lock', 'notes'];
            for (k = 0; k < keys.length; k++) { if (c[keys[k]] !== undefined) parts.push(keys[k].replace('new_description', 'name') + ' ' + c[keys[k]]); }
            return 'Change ' + d + ': ' + (parts.join(', ') || 'no fields');
        }
        if (a === 'delete_item')           return 'Remove line ' + d + ' from "' + (c.section || '?') + '"';
        if (a === 'move_item')             return 'Move ' + d + ' from "' + (c.section || '?') + '" to "' + (c.to_section || '?') + '"';
        if (a === 'set_crew')              return 'Set crew on ' + d + ' to ' + (c.name || '(none)');
        if (a === 'set_item_days') {
            var sp = [];
            if (c.days !== undefined) sp.push('days ' + c.days);
            if (c.rate !== undefined) sp.push('rate ' + c.rate);
            if (c.multiplier !== undefined) sp.push('multiplier ' + c.multiplier);
            return 'Set ' + d + ' ' + (c.stage || '?') + ' stage ' + (sp.join(', ') || 'nothing');
        }
        if (a === 'add_float')             return 'Issue a petty cash float of ' + cur + ' ' + c.amount + ' to "' + (c.holder || '?') + '"';
        if (a === 'update_float')          return 'Change the petty cash float of "' + (c.holder || '?') + '"' + (c.status ? ' (status ' + c.status + ')' : '');
        if (a === 'delete_float')          return 'Remove the petty cash float of "' + (c.holder || '?') + '"';
        if (a === 'add_receipt')           return 'Add receipt "' + (c.description || '?') + '" ' + cur + ' ' + c.amount + ' to the float of "' + (c.holder || '?') + '"';
        if (a === 'delete_receipt')        return 'Remove receipt "' + (c.description || '?') + '" from the float of "' + (c.holder || '?') + '"';
        if (a === 'set_stage_share')       return 'Give the ' + (c.stage || '?') + ' stage ' + c.value + '% of the budget (other unlocked stages adjust)';
        if (a === 'set_stage_lock')        return (c.locked === false || c.locked === 'false' ? 'Unlock' : 'Lock') + ' the ' + (c.stage || '?') + ' stage share';
        if (a === 'set_stage_offset')      return 'Start the ' + (c.stage || '?') + ' stage ' + (c.days === '' || c.days === null ? 'straight after the previous stage' : c.days + ' days after the previous stage starts');
        if (a === 'set_section_cap')       return 'Set the spending cap of section "' + (c.section || '?') + '" to ' + c.value;
        if (a === 'set_incentive')         return 'Set the tax incentive' + (c.jurisdiction !== undefined ? ' to ' + (c.jurisdiction || 'none') : '') + (c.rate !== undefined ? ', rate ' + c.rate + '%' : '') + (c.min_spend !== undefined ? ', minimum spend ' + c.min_spend : '');
        if (a === 'rename_section')        return 'Rename section "' + (c.section || '?') + '" to "' + (c.new_name || '?') + '"';
        if (a === 'delete_section')        return 'Remove section "' + (c.section || '?') + '" and every line in it';
        if (a === 'duplicate_budget')      return 'Duplicate this budget as "' + (c.name || '?') + '" (later changes go to the copy)';
        if (a === 'rename_budget')         return 'Rename this budget to "' + (c.name || '?') + '"';
        if (a === 'set_field')             return 'Set ' + (c.field || '?') + ' to "' + (c.value === undefined ? '' : c.value) + '"';
        if (a === 'set_display_currency')  return 'Show amounts in ' + (c.value || '?');
        if (a === 'add_funding_source')    return 'Add funding source "' + (c.name || '?') + '" ' + cur + ' ' + (c.amount === undefined ? 0 : c.amount) + (c.status ? ' (' + c.status + ')' : '');
        if (a === 'update_funding_source') return 'Change funding source "' + (c.name || '?') + '"';
        if (a === 'delete_funding_source') return 'Remove funding source "' + (c.name || '?') + '"';
        if (a === 'add_po')                return 'Add purchase order for "' + (c.vendor || c.contact || '?') + '" ' + cur + ' ' + (c.amount === undefined ? 0 : c.amount) + (c.contact ? ', linked to contact "' + c.contact + '"' : '');
        if (a === 'update_po')             return 'Change purchase order ' + (c.po_number || '?') + (c.contact ? ', link it to contact "' + c.contact + '"' : '');
        if (a === 'delete_po')             return 'Remove purchase order ' + (c.po_number || '?');
        if (a === 'add_milestone')         return 'Add calendar milestone "' + (c.title || '?') + '" ' + (c.stage !== undefined ? 'at the ' + c.stage + ' stage, offset ' + (c.offset_days || 0) + ' days' : 'on ' + (c.date || '?'));
        if (a === 'update_milestone')      return 'Change calendar milestone "' + (c.title || '?') + '"';
        if (a === 'delete_milestone')      return 'Remove calendar milestone "' + (c.title || '?') + '"';
        if (a === 'add_blackout_day')      return 'Mark ' + (c.date || '?') + ' as a day off';
        if (a === 'remove_blackout_day')   return 'Make ' + (c.date || '?') + ' a working day again';
        if (a === 'add_fringe')            return 'Add fringe "' + (c.name || '?') + '" at ' + (c.rate === undefined ? 0 : c.rate) + '%';
        if (a === 'update_fringe')         return 'Change fringe "' + (c.name || '?') + '"';
        if (a === 'delete_fringe')         return 'Remove fringe "' + (c.name || '?') + '"';
        if (a === 'save_contact')          return 'Save contact "' + (c.name || '?') + '" in Contacts';
        if (a === 'rename_contact')        return 'Rename contact "' + (c.name || '?') + '" to "' + (c.new_name || '?') + '" in Contacts and on every crew line, purchase order and petty cash float of this budget and of the other saved budgets on this device that show it and are not shared';
        return null;
    },

    /* ── Contacts: rename and purchase order links ───────────────────────
       A contact is the record in the shared Contacts roster. The budget keeps
       its name as text on crew lines, purchase orders and petty cash floats,
       so a rename changes the roster record and that text together. */
    _contactKey: function (s) {
        return String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '').toLowerCase();
    },

    _lookupContact: function (ctx, name) {
        var m = ctx && ctx.lookup;
        var key = this._contactKey(name);
        return (m && Object.prototype.hasOwnProperty.call(m, key)) ? m[key] : null;
    },

    /* Every place the open budget shows the contact's name. A line is the
       contact's when it carries the contact id, or has no id and shows the old
       name. Text that is not the old name (a nickname, a company label) is left
       alone and counted in "left". The ledger reads purchase orders and floats,
       so it follows them. */
    _renameInBudget: function (budget, ent) {
        var out = { crew: 0, pos: 0, floats: 0, left: 0 };
        var oldK = this._contactKey(ent.oldName);
        var secs = budget.sections || {}, keys = Object.keys(secs), si, ii, items, it, cid, hit, crewName, gl, gi, list, rec, linked;
        for (si = 0; si < keys.length; si++) {
            items = (secs[keys[si]] && secs[keys[si]].items) || [];
            for (ii = 0; ii < items.length; ii++) {
                it = items[ii];
                if (!it) continue;
                cid = it.contactId || it.contact_id || '';
                crewName = (it.crew && typeof it.crew === 'object') ? String(it.crew.name || '') : '';
                linked = cid ? cid === ent.id : (!!crewName && this._contactKey(crewName) === oldK);
                if (!linked) continue;
                hit = false;
                if (crewName) {
                    if (this._contactKey(crewName) === oldK) { it.crew.name = ent.newName; hit = true; }
                    else if (this._contactKey(crewName) !== this._contactKey(ent.newName)) out.left++;
                }
                if (this._contactKey(it.description) === oldK) { it.description = ent.newName; hit = true; }
                if (hit) out.crew++;
            }
        }
        gl = Array.isArray(budget.globalItems) ? budget.globalItems : [];
        for (gi = 0; gi < gl.length; gi++) {
            if (!gl[gi] || (gl[gi].contactId || gl[gi].contact_id) !== ent.id) continue;
            if (this._contactKey(gl[gi].description) === oldK) gl[gi].description = ent.newName;
            if (this._contactKey(gl[gi].contact_name) === oldK) gl[gi].contact_name = ent.newName;
        }
        list = (budget.ledgers && Array.isArray(budget.ledgers.pos)) ? budget.ledgers.pos : [];
        for (gi = 0; gi < list.length; gi++) {
            rec = list[gi];
            if (!rec) continue;
            linked = rec.contactId ? rec.contactId === ent.id : this._contactKey(rec.vendor) === oldK;
            if (!linked) continue;
            if (this._contactKey(rec.vendor) === oldK) { rec.vendor = ent.newName; out.pos++; }
            else if (this._contactKey(rec.vendor) !== this._contactKey(ent.newName)) out.left++;
        }
        list = (budget.ledgers && Array.isArray(budget.ledgers.pettyCash)) ? budget.ledgers.pettyCash : [];
        for (gi = 0; gi < list.length; gi++) {
            rec = list[gi];
            if (!rec) continue;
            linked = rec.contactId ? rec.contactId === ent.id : this._contactKey(rec.floatHolder) === oldK;
            if (!linked) continue;
            if (this._contactKey(rec.floatHolder) === oldK) { rec.floatHolder = ent.newName; out.floats++; }
            else if (this._contactKey(rec.floatHolder) !== this._contactKey(ent.newName)) out.left++;
        }
        return out;
    },

    /* Read the shared roster and settle every contact the batch names, before
       anything is changed. Resolves to { lookup, renames, errors }. */
    _resolveContacts: function (changes) {
        var self = this, i, c, a, renames = [], wanted = [];
        var res = { lookup: {}, renames: [], creates: [], errors: [] };
        for (i = 0; i < changes.length; i++) {
            c = changes[i];
            a = c && c.mbt_action;
            if (a === 'rename_contact') renames.push(c);
            else if ((a === 'add_po' || a === 'update_po') && c.contact !== undefined && self._contactKey(c.contact) !== '') wanted.push(String(c.contact));
        }
        if (!renames.length && !wanted.length) return Promise.resolve(res);
        if (typeof window.mBTFetchMergedContactRoster !== 'function') {
            res.errors.push('• Contacts are not available right now, so a contact cannot be renamed or linked.');
            return Promise.resolve(res);
        }
        return Promise.resolve(window.mBTFetchMergedContactRoster()).then(function (r) { return r || []; }, function () { return null; }).then(function (roster) {
            if (!roster) { res.errors.push('• Contacts could not be read, so a contact cannot be renamed or linked.'); return res; }
            function matches(name) {
                var k = self._contactKey(name), out = [], j;
                for (j = 0; j < roster.length; j++) { if (roster[j] && self._contactKey(roster[j].name) === k) out.push(roster[j]); }
                return out;
            }
            var seen = {};
            renames.forEach(function (rc) {
                var oldN = String(rc.name).replace(/^\s+|\s+$/g, ''), newN = String(rc.new_name).replace(/^\s+|\s+$/g, '');
                var ok = self._contactKey(oldN), nk = self._contactKey(newN);
                var oldM, newM, rec;
                if ((seen[ok] || seen[nk]) && ok !== nk) { res.errors.push('• The contact name "' + (seen[ok] ? oldN : newN) + '" appears in two renames in this batch. Ask for one at a time.'); return; }
                if (seen[ok] && ok === nk) { res.errors.push('• The contact "' + oldN + '" is renamed twice in this batch. Ask for one at a time.'); return; }
                seen[ok] = true; seen[nk] = true;
                oldM = matches(oldN);
                newM = matches(newN);
                if (oldM.length > 1) { res.errors.push('• More than one saved contact is named "' + oldN + '", so the Assistant cannot tell which to rename. Rename the right one in the Contacts tool.'); return; }
                if (oldM.length === 1) {
                    rec = oldM[0];
                    if (rec.readOnly) { res.errors.push('• "' + oldN + '" is a shared contact (read only), so it cannot be renamed here.'); return; }
                    if (newM.length && newM[0].id !== rec.id) { res.errors.push('• A contact named "' + newN + '" already exists, so "' + oldN + '" cannot take that name.'); return; }
                    res.renames.push({ id: rec.id, oldName: rec.name, newName: newN, rosterDone: false, before: rec });
                    res.lookup[ok] = { id: rec.id, name: newN };
                    res.lookup[nk] = { id: rec.id, name: newN };
                } else if (newM.length === 1) {
                    /* Already renamed in Contacts (for example from another budget): only this budget's text is left. */
                    rec = newM[0];
                    res.renames.push({ id: rec.id, oldName: oldN, newName: rec.name, rosterDone: true, before: null });
                    res.lookup[ok] = { id: rec.id, name: rec.name };
                    res.lookup[nk] = { id: rec.id, name: rec.name };
                } else {
                    res.errors.push('• No saved contact is named "' + oldN + '". Check the spelling, or add the contact in Contacts first.');
                }
            });
            wanted.forEach(function (w) {
                var k = self._contactKey(w), m;
                if (Object.prototype.hasOwnProperty.call(res.lookup, k)) return;
                m = matches(w);
                if (m.length > 1) res.errors.push('• More than one saved contact is named "' + w + '", so the purchase order cannot be linked to just one. Link it in the Purchase orders tool.');
                else if (!m.length) {
                    /* A new contact the same batch adds is created first, so the link can use it. */
                    var made = null, q;
                    for (q = 0; q < changes.length; q++) { if (changes[q] && changes[q].mbt_action === 'save_contact' && self._contactKey(changes[q].name) === k) { made = changes[q]; break; } }
                    if (made) { res.creates.push(made); res.lookup[k] = { id: '', name: String(made.name).replace(/^\s+|\s+$/g, ''), pending: true }; }
                    else res.errors.push('• No saved contact is named "' + w + '", so the purchase order cannot be linked to it. Add the contact in Contacts first, or ask for the new contact and the link together.');
                }
                else res.lookup[k] = { id: m[0].id, name: m[0].name };
            });
            return res;
        });
    },

    /* A contact that is renamed here cannot also be saved or put on a line in
       the same batch: the order of the steps would decide the result. */
    _renameClashes: function (changes, renames) {
        var out = [], i, j, c, k, ent;
        for (j = 0; j < renames.length; j++) {
            ent = renames[j];
            for (i = 0; i < changes.length; i++) {
                c = changes[i];
                if (!c || (c.mbt_action !== 'save_contact' && c.mbt_action !== 'set_crew')) continue;
                k = this._contactKey(c.name);
                if (k && (k === this._contactKey(ent.oldName) || k === this._contactKey(ent.newName))) {
                    out.push('• "' + ent.oldName + '" is being renamed in this batch, so ' + c.mbt_action + ' cannot use the name "' + c.name + '" in the same batch. Ask for it in a second step.');
                }
            }
        }
        return out;
    },

    _contactPayload: function (c) {
        return {
            name: c.name, role: c.role, department: c.department, email: c.email, phone: c.phone,
            category: c.category, rate: c.rate === '' ? undefined : c.rate, currency: c.currency,
            walletType: c.wallet_type, walletAddress: c.wallet_address,
            dietaryRestrictions: c.dietary_restrictions, allergies: c.allergies, overwrite: true,
            clear: c.clear
        };
    },

    /* Add the new contacts a link needs, before the budget changes. Each one is
       checked against the roster again first, so an existing contact is never
       taken for a new one. Fills in the id for the purchase order link. */
    _createInRoster: function (creates, extra) {
        var self = this, done = [], failed = [], changes = [];
        var chain = Promise.resolve();
        creates.forEach(function (c) {
            chain = chain.then(function () {
                var payload = self._contactPayload(c), key = self._contactKey(c.name);
                if (typeof window.mBTSaveContactToRoster !== 'function' || typeof window.mBTFetchMergedContactRoster !== 'function') throw new Error('no store');
                return Promise.resolve(window.mBTFetchMergedContactRoster()).then(function (roster) {
                    var i;
                    for (i = 0; i < (roster || []).length; i++) { if (roster[i] && self._contactKey(roster[i].name) === key) throw new Error('exists'); }
                    return window.mBTSaveContactToRoster(payload);
                }).then(function (saved) {
                    if (!saved || !saved.id) throw new Error('not saved');
                    extra.lookup[key] = { id: saved.id, name: saved.name || payload.name };
                    extra.createdKeys[key] = true;
                    changes.push({ id: saved.id, name: payload.name, created: true, before: null, savedAt: saved.updated_at || null });
                    done.push(payload.name);
                });
            }).catch(function () { failed.push(String(c.name)); });
        });
        return chain.then(function () { window.__mbtCrewRosterCache = null; return { done: done, failed: failed, changes: changes }; });
    },

    /* Change the roster record's name (same id, nothing else) and remember what
       it was, so Undo and a failed batch can put it back. */
    _renameInRoster: function (renames) {
        var done = [], failed = [], changes = [];
        var chain = Promise.resolve();
        var saveFn = null;
        if (typeof window.mBTOG !== 'undefined' && window.mBTOG && typeof window.mBTOG.saveContact === 'function') saveFn = function (r) { return window.mBTOG.saveContact(r); };
        else if (window.mBTStorage && typeof window.mBTStorage.saveContact === 'function') saveFn = function (r) { return window.mBTStorage.saveContact(r); };
        renames.forEach(function (ent) {
            if (ent.rosterDone) return;
            chain = chain.then(function () {
                var rec, before;
                if (!saveFn) throw new Error('no store');
                before = JSON.parse(JSON.stringify(ent.before));
                rec = JSON.parse(JSON.stringify(ent.before));
                rec.name = ent.newName;
                return saveFn(rec).then(function (saved) {
                    if (!saved) throw new Error('not saved');
                    changes.push({ id: ent.id, name: ent.oldName, created: false, before: before, savedAt: saved.updated_at || rec.updated_at || null });
                    done.push(ent.oldName);
                });
            }).catch(function () { failed.push(ent.oldName); });
        });
        return chain.then(function () {
            window.__mbtCrewRosterCache = null;
            return { done: done, failed: failed, changes: changes };
        });
    },

    /* Put renamed roster records back after a batch that did not go through.
       Resolves to a sentence for the message, or ''. */
    _giveBackRenames: function (extra) {
        var self = this, ch = extra && extra.rosterChanges;
        if (!ch || !ch.length) return Promise.resolve('');
        extra.rosterChanges = null;
        return self._undoContacts(ch).then(function (res) {
            var t = '';
            if (res.restored.length) t += ' The change to Contacts was put back: ' + res.restored.join(', ') + '.';
            if (res.kept.length) t += ' These contacts could not be put back and stay as they are now: ' + res.kept.join(', ') + '.';
            return t;
        });
    },

    /* Apply one of the newer actions to the live budget (synchronous part).
       Returns an error string or null. Contact saving, duplicate, rename and
       currency are handled by _commitSuggestion because they are asynchronous
       or touch more than the budget. */
    _applyNew: function (c, ctx) {
        var budget = window.budget;
        var a = c.mbt_action;
        var key, sec, item, i, n, s, v, rec, list, secKey, pk;

        if (a === 'duplicate_budget' || a === 'rename_budget' || a === 'set_display_currency' || a === 'save_contact') return null;

        if (a === 'rename_contact') {
            var rn = null, ri, rl = (ctx && ctx.renames) || [];
            for (ri = 0; ri < rl.length; ri++) { if (this._contactKey(rl[ri].oldName) === this._contactKey(c.name)) { rn = rl[ri]; break; } }
            if (!rn) return 'The contact "' + (c.name || '(none)') + '" was not found in Contacts, so it was not renamed.';
            var counts = this._renameInBudget(budget, rn);
            if (ctx && ctx.renamed) ctx.renamed.push({ id: rn.id, oldName: rn.oldName, newName: rn.newName, rosterDone: rn.rosterDone, crew: counts.crew, pos: counts.pos, floats: counts.floats, left: counts.left });
            return null;
        }

        if (a === 'rename_section') {
            key = this._findSectionKey(c.section);
            if (!key) return this._sectionError((c.section || '(none)'));
            n = String(c.new_name || '').replace(/^\s+|\s+$/g, '');
            if (!n) return 'The new section name is missing.';
            if (!this._nameLegal(n)) return 'Section names cannot contain quotes, slashes or < > characters.';
            if (n === key) return null;
            if (budget.sections[n]) return 'A section named "' + n + '" already exists.';
            var rebuilt = {};
            Object.keys(budget.sections).forEach(function (k) { rebuilt[k === key ? n : k] = budget.sections[k]; });
            budget.sections = rebuilt;
            (budget.sections[n].items || []).forEach(function (it) { if (it.sectionKey === key) it.sectionKey = n; });
            if (budget.ledgers && Array.isArray(budget.ledgers.pos)) {
                budget.ledgers.pos.forEach(function (po) { if (po.sectionKey === key) po.sectionKey = n; });
            }
            return null;
        }
        if (a === 'delete_section') {
            key = this._findSectionKey(c.section);
            if (!key) return this._sectionError((c.section || '(none)'));
            if (Object.keys(budget.sections).length < 2) return 'A budget needs at least one section, so "' + key + '" was not removed.';
            delete budget.sections[key];
            return null;
        }

        if (a === 'update_item' || a === 'delete_item' || a === 'move_item' || a === 'set_crew' || a === 'set_item_days') {
            key = this._findSectionKey(c.section);
            if (!key) return this._sectionError((c.section || '(none)'));
            sec = budget.sections[key];
            pk = this._pickItem(sec, key, c.description, c.line);
            if (pk.err) return pk.err;
            item = pk.item;

            if (a === 'delete_item') {
                sec.items.splice(this._indexOfRec(sec.items, item), 1);
                return null;
            }
            if (a === 'move_item') {
                var toKey = this._findSectionKey(c.to_section);
                if (!toKey) return this._sectionError((c.to_section || '(none)'));
                if (toKey === key) return null;
                sec.items.splice(this._indexOfRec(sec.items, item), 1);
                if (!budget.sections[toKey].items) budget.sections[toKey].items = [];
                budget.sections[toKey].items.push(item);
                if (item.sectionKey) item.sectionKey = toKey;
                return null;
            }
            if (a === 'set_crew') {
                var nm = String(c.name === undefined ? '' : c.name).replace(/^\s+|\s+$/g, '');
                if (!item.crew || typeof item.crew !== 'object') item.crew = {};
                item.crew.name = nm;
                if (c.phone !== undefined) item.crew.phone = String(c.phone);
                if (c.email !== undefined) item.crew.email = String(c.email);
                if (nm && ctx && ctx.contacts) ctx.contacts.push({ name: nm, phone: c.phone, email: c.email, role: item.description, undo: true });
                return null;
            }
            if (a === 'set_item_days') {
                var stages = { dev: 1, pre: 1, prod: 1, post: 1, dist: 1 };
                var st = String(c.stage || '').toLowerCase();
                var dd = c.days === undefined ? null : this._num(c.days);
                var sRate = c.rate === undefined ? null : this._num(c.rate);
                var sMult = c.multiplier === undefined ? null : this._num(c.multiplier);
                if (!stages[st]) return 'Unknown stage: ' + (c.stage || '(none)') + '. Use one of dev, pre, prod, post, dist.';
                if (c.days === undefined && c.rate === undefined && c.multiplier === undefined) return 'Nothing to set on the ' + st + ' stage: give days, rate or multiplier.';
                if (c.days !== undefined && (dd === null || dd < 0)) return 'Days must be a number that is not negative, got ' + c.days + '.';
                if (c.rate !== undefined && (sRate === null || sRate < 0)) return 'The stage rate must be a number that is not negative, got ' + c.rate + '.';
                if (c.multiplier !== undefined && (sMult === null || sMult < 0)) return 'The stage multiplier must be a number that is not negative, got ' + c.multiplier + '.';
                if (!item.stageData || typeof item.stageData !== 'object') item.stageData = {};
                if (dd !== null) {
                    if (dd > 0) {
                        if (!item.stageData[st]) item.stageData[st] = { days: dd, rate: item.rate || 0, order: 0 };
                        else item.stageData[st].days = dd;
                    } else if (item.stageData[st]) {
                        delete item.stageData[st];
                    }
                }
                if (sRate !== null || sMult !== null) {
                    if (!item.stageData[st]) return 'The ' + st + ' stage has no days on "' + item.description + '", so there is no stage rate to set. Give days as well.';
                    if (sRate !== null) {
                        item.stageData[st].rate = Math.round(sRate * 10000) / 10000;
                        if (window.mBTBatch2 && typeof window.mBTBatch2.manual === 'function') window.mBTBatch2.manual(item.stageData[st]);
                    }
                    if (sMult !== null) item.stageData[st].multiplier = sMult;
                }
                if (ctx && ctx.expect) {
                    for (var xi = ctx.expect.length - 1; xi >= 0; xi--) { if (ctx.expect[xi].id === item.id) ctx.expect.splice(xi, 1); }
                }
                if (window.mBTSchedule && typeof window.mBTSchedule.syncQtyFromSchedule === 'function') window.mBTSchedule.syncQtyFromSchedule(item);
                this._recalcItem(item);
                return null;
            }
            /* update_item */
            if (c.new_description !== undefined) {
                s = String(c.new_description).replace(/^\s+|\s+$/g, '');
                if (!s) return 'The new line name is missing.';
                item.description = s;
            }
            if (c.unit !== undefined) item.unit = String(c.unit);
            if (c.notes !== undefined) item.notes = String(c.notes);
            if (c.rate_lock !== undefined) item.rateType = (c.rate_lock === true || c.rate_lock === 'true') ? 'fixed' : 'negotiable';
            var numFields = ['quantity', 'rate', 'multiplier', 'actual', 'actual_quantity', 'actual_rate'];
            var numTarget = { actual_quantity: 'actualQuantity', actual_rate: 'actualRate' };
            for (i = 0; i < numFields.length; i++) {
                if (c[numFields[i]] === undefined) continue;
                v = this._num(c[numFields[i]]);
                if (v === null) return 'Value was not a number for ' + numFields[i] + ' on ' + (c.description || 'item');
                if (numFields[i] === 'quantity') s = this._setLineQty(item, v, ctx);
                else if (numFields[i] === 'rate') s = this._setLineRate(item, v, ctx);
                else {
                    item[numTarget[numFields[i]] || numFields[i]] = v;
                    if (numTarget[numFields[i]] && !item.actualDate) item.actualDate = new Date().toISOString().split('T')[0];
                    s = null;
                }
                if (s) return s;
            }
            if (c.actual_date !== undefined) {
                if (c.actual_date !== '' && !this._isDate(c.actual_date)) return 'actual_date must be a date like 2026-12-15, got ' + c.actual_date + '.';
                item.actualDate = c.actual_date;
            }
            if (c.qualifying !== undefined) item.qualifying = (c.qualifying === true || c.qualifying === 'true');
            this._recalcItem(item);
            return null;
        }

        if (a === 'set_field') {
            var kind = this._SET_FIELDS[c.field];
            if (!kind) return 'Unknown field: ' + (c.field || '(none)') + '. Use one of ' + Object.keys(this._SET_FIELDS).join(', ') + '.';
            if (kind === 'date') {
                if (c.value !== '' && !this._isDate(c.value)) return c.field + ' must be a date like 2026-12-15, got ' + (c.value === undefined ? '(none)' : c.value) + '.';
                if (c.value === '') delete budget[c.field]; else budget[c.field] = c.value;
            } else if (kind === 'pct') {
                v = this._num(c.value);
                if (v === null || v < 0 || v > 100) return c.field + ' must be a number from 0 to 100, got ' + (c.value === undefined ? '(none)' : c.value) + '.';
                budget[c.field] = v;
            } else if (kind === 'cap') {
                v = this._num(c.value);
                if (v === null || v < 0) return c.field + ' must be a number that is not negative, got ' + (c.value === undefined ? '(none)' : c.value) + '.';
                v = this._capInBase(v, c);
                if (typeof v === 'string') return v;
                if (!budget.targetLock || typeof budget.targetLock !== 'object') budget.targetLock = { enabled: false, totalCap: 0, stages: {} };
                budget.targetLock.totalCap = v;
            } else if (kind === 'bool') {
                if (c.value !== true && c.value !== false && c.value !== 'true' && c.value !== 'false') return c.field + ' must be true or false, got ' + (c.value === undefined ? '(none)' : c.value) + '.';
                budget[c.field] = (c.value === true || c.value === 'true');
            } else {
                budget[c.field] = String(c.value === undefined ? '' : c.value);
            }
            return null;
        }

        if (a === 'add_float' || a === 'update_float' || a === 'delete_float' || a === 'add_receipt' || a === 'delete_receipt') {
            if (!budget.ledgers || typeof budget.ledgers !== 'object') budget.ledgers = { poCounter: 1, pos: [], pettyCash: [] };
            if (!Array.isArray(budget.ledgers.pettyCash)) budget.ledgers.pettyCash = [];
            list = budget.ledgers.pettyCash;
            s = String(c.holder || '').replace(/^\s+|\s+$/g, '');
            if (!s) return 'The float holder name is missing.';
            if (a === 'add_float') {
                v = this._num(c.amount);
                if (v === null || v <= 0) return 'A petty cash float must be more than 0, got ' + (c.amount === undefined ? '(none)' : c.amount) + '.';
                if (c.date !== undefined && c.date !== '' && !this._isDate(c.date)) return 'The float date must look like 2026-12-15, got ' + c.date + '.';
                list.push({ id: this._newId('pc'), floatHolder: s, floatAmount: v, currency: window.displayCurrency || budget.currency || 'JMD',
                    issuedDate: c.date || new Date().toISOString().split('T')[0], status: 'Issued', receipts: [] });
                return null;
            }
            var floatPick = this._pickRecord(list, 'float', s, c.position);
            if (!floatPick.rec) return floatPick.err;
            rec = floatPick.rec;
            if (a === 'delete_float') { list.splice(this._indexOfRec(list, rec), 1); return null; }
            if (!Array.isArray(rec.receipts)) rec.receipts = [];
            if (a === 'add_receipt') {
                n = String(c.description || '').replace(/^\s+|\s+$/g, '');
                v = this._num(c.amount);
                if (!n) return 'The receipt description is missing.';
                if (v === null || v <= 0) return 'A receipt must be more than 0, got ' + (c.amount === undefined ? '(none)' : c.amount) + '.';
                if (c.date !== undefined && c.date !== '' && !this._isDate(c.date)) return 'The receipt date must look like 2026-12-15, got ' + c.date + '.';
                rec.receipts.push({ id: this._newId('rc'), description: n, amount: v, currency: rec.currency || window.displayCurrency || budget.currency || 'JMD', date: c.date || new Date().toISOString().split('T')[0] });
                if (rec.status === 'Issued') rec.status = 'Active';
                return null;
            }
            if (a === 'delete_receipt') {
                var rcPick = this._pickRecord(rec.receipts, 'receipt', c.description, c.receipt_position);
                if (!rcPick.rec) return rcPick.err;
                var rr = rcPick.rec;
                rec.receipts.splice(this._indexOfRec(rec.receipts, rr), 1);
                return null;
            }
            /* update_float */
            if (c.amount !== undefined) {
                v = this._num(c.amount);
                if (v === null || v <= 0) return 'A petty cash float must be more than 0, got ' + c.amount + '.';
                rec.floatAmount = v;
            }
            if (c.status !== undefined) {
                if (({ Issued: 1, Active: 1, Reconciled: 1 })[String(c.status)] !== 1) return 'Float status must be Issued, Active or Reconciled, got ' + c.status + '.';
                rec.status = String(c.status);
            }
            if (c.date !== undefined && c.date !== '') {
                if (!this._isDate(c.date)) return 'The float date must look like 2026-12-15, got ' + c.date + '.';
                rec.issuedDate = c.date;
            }
            return null;
        }

        if (a === 'set_stage_share' || a === 'set_stage_lock' || a === 'set_stage_offset') {
            var SK = { dev: 1, pre: 1, prod: 1, post: 1, dist: 1 }, ORDER = ['dev', 'pre', 'prod', 'post', 'dist'];
            var stK = String(c.stage || '').replace(/^\s+|\s+$/g, '').toLowerCase();
            if (!SK[stK]) return 'Unknown stage: ' + (c.stage || '(none)') + '. Use one of dev, pre, prod, post, dist.';
            if (!budget.targetLock || typeof budget.targetLock !== 'object') budget.targetLock = { totalCap: 0, stages: {} };
            if (!budget.targetLock.stages) budget.targetLock.stages = {};
            for (i = 0; i < ORDER.length; i++) {
                if (!budget.targetLock.stages[ORDER[i]]) budget.targetLock.stages[ORDER[i]] = { label: ORDER[i].toUpperCase(), ratio: 20, days: 0, locked: false };
            }
            var stg = budget.targetLock.stages;
            if (a === 'set_stage_lock') {
                if (c.locked !== true && c.locked !== false && c.locked !== 'true' && c.locked !== 'false') return 'locked must be true or false, got ' + (c.locked === undefined ? '(none)' : c.locked) + '.';
                stg[stK].locked = (c.locked === true || c.locked === 'true');
                return null;
            }
            if (a === 'set_stage_offset') {
                if (stK === 'dev') return 'The first stage (dev) has no offset: it starts on the project start date.';
                if (c.days === '' || c.days === null) { delete stg[stK].offsetDays; return null; }
                v = this._num(c.days);
                if (v === null || v < 0) return 'The stage offset must be 0 or more days, or empty to clear it, got ' + (c.days === undefined ? '(none)' : c.days) + '.';
                stg[stK].offsetDays = v;
                return null;
            }
            /* set_stage_share: same balancing as the stage sliders (index.html balanceStageSliders). */
            v = this._num(c.value);
            if (v === null || v < 0 || v > 100) return 'The stage share must be a number from 0 to 100, got ' + (c.value === undefined ? '(none)' : c.value) + '.';
            var lockedTotal = 0, unl = [], unlTotal = 0, rest;
            for (i = 0; i < ORDER.length; i++) {
                if (ORDER[i] === stK) continue;
                if (stg[ORDER[i]].locked) lockedTotal += (parseFloat(stg[ORDER[i]].ratio) || 0);
                else { unl.push(ORDER[i]); unlTotal += (parseFloat(stg[ORDER[i]].ratio) || 0); }
            }
            if (stg[stK].locked) return 'The ' + stK + ' stage share is locked. Unlock it first (set_stage_lock).';
            if (v > 100 - lockedTotal + 0.00005) return 'Other stages are locked at ' + Math.round(lockedTotal * 100) / 100 + '%, so the ' + stK + ' stage can have at most ' + Math.round((100 - lockedTotal) * 100) / 100 + '%.';
            rest = Math.max(0, 100 - v - lockedTotal);
            if (!unl.length && Math.abs(rest) > 0.01) return 'Every other stage is locked, so the ' + stK + ' stage cannot change.';
            stg[stK].ratio = v;
            for (i = 0; i < unl.length; i++) {
                stg[unl[i]].ratio = unlTotal <= 0.01 ? rest / unl.length : rest * ((parseFloat(stg[unl[i]].ratio) || 0) / unlTotal);
            }
            return null;
        }

        if (a === 'set_section_cap') {
            key = this._findSectionKey(c.section);
            if (!key) return this._sectionError((c.section || '(none)'));
            v = this._num(c.value);
            if (v === null || v < 0) return 'The section cap must be a number that is not negative (0 turns it off), got ' + (c.value === undefined ? '(none)' : c.value) + '.';
            budget.sections[key].targetCap = v;
            return null;
        }

        if (a === 'set_incentive') {
            var JP = { 'jampro': ['JAMPRO', 20, 0], 'uk hetv': ['UK HETV', 25, 1000000], 'georgia': ['Georgia', 20, 500000], 'louisiana': ['Louisiana', 25, 300000], 'custom': ['Custom', 0, 0] };
            var prevJ = (budget.jurisdiction && typeof budget.jurisdiction === 'object') ? budget.jurisdiction : {};
            var jName = prevJ.name || '', jRate = prevJ.incentiveRate || 0, jMin = prevJ.minSpend || 0, pre;
            if (c.jurisdiction === undefined && c.rate === undefined && c.min_spend === undefined) return 'Nothing to set: give jurisdiction, rate or min_spend.';
            if (c.jurisdiction !== undefined) {
                s = String(c.jurisdiction).replace(/^\s+|\s+$/g, '');
                if (s === '') { jName = ''; }
                else {
                    pre = JP[s.toLowerCase()];
                    if (!pre) return 'Unknown jurisdiction "' + s + '". Use JAMPRO, UK HETV, Georgia, Louisiana, Custom, or an empty name for none.';
                    jName = pre[0];
                    jRate = pre[1];
                    jMin = pre[2];
                }
            }
            if (c.rate !== undefined) {
                v = this._num(c.rate);
                if (v === null || v < 0 || v > 100) return 'The incentive rate must be a number from 0 to 100, got ' + c.rate + '.';
                jRate = v;
            }
            if (c.min_spend !== undefined) {
                v = this._num(c.min_spend);
                if (v === null || v < 0) return 'The minimum spend must be a number that is not negative, got ' + c.min_spend + '.';
                jMin = v;
            }
            budget.jurisdiction = { name: jName, incentiveRate: jRate, minSpend: jMin, atlSections: prevJ.atlSections || ['Story', 'Producer', 'Cast'] };
            return null;
        }

        if (a === 'add_funding_source' || a === 'update_funding_source' || a === 'delete_funding_source') {
            if (!Array.isArray(budget.fundingSources)) budget.fundingSources = [];
            list = budget.fundingSources;
            if (a === 'add_funding_source') {
                s = String(c.name || '').replace(/^\s+|\s+$/g, '');
                if (!s) return 'Funding source name missing.';
                v = c.amount === undefined ? 0 : this._num(c.amount);
                if (v === null) return 'Funding amount was not a number for ' + s;
                list.push({
                    id: 'funding_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10),
                    name: s, amount: v, currency: c.currency || window.displayCurrency || budget.currency || 'JMD',
                    cashInBank: this._num(c.cashInBank) || 0, status: c.status || 'Pending',
                    contactName: c.contactName || '', contactEmail: c.contactEmail || '', contactPhone: c.contactPhone || '',
                    contractUrl: c.contractUrl || '', notes: c.notes || '', attachments: []
                });
                return null;
            }
            var fundPick = this._pickRecord(list, 'funding', c.name, c.position);
            if (!fundPick.rec) return fundPick.err;
            rec = fundPick.rec;
            if (a === 'delete_funding_source') { list.splice(this._indexOfRec(list, rec), 1); return null; }
            if (c.new_name !== undefined && String(c.new_name).replace(/^\s+|\s+$/g, '')) rec.name = String(c.new_name).replace(/^\s+|\s+$/g, '');
            var fk = ['amount', 'cashInBank'];
            for (i = 0; i < fk.length; i++) {
                if (c[fk[i]] === undefined) continue;
                v = this._num(c[fk[i]]);
                if (v === null) return 'Funding ' + fk[i] + ' was not a number for ' + rec.name;
                rec[fk[i]] = v;
            }
            var tk = ['currency', 'status', 'contactName', 'contactEmail', 'contactPhone', 'contractUrl', 'notes'];
            for (i = 0; i < tk.length; i++) { if (c[tk[i]] !== undefined) rec[tk[i]] = String(c[tk[i]]); }
            return null;
        }

        if (a === 'add_po' || a === 'update_po' || a === 'delete_po') {
            if (!budget.ledgers || typeof budget.ledgers !== 'object') budget.ledgers = { poCounter: 1, pos: [], pettyCash: [] };
            if (!Array.isArray(budget.ledgers.pos)) budget.ledgers.pos = [];
            list = budget.ledgers.pos;
            if (a === 'add_po') {
                s = String(c.vendor || '').replace(/^\s+|\s+$/g, '');
                var poLink = null;
                if (c.contact !== undefined && String(c.contact).replace(/^\s+|\s+$/g, '') !== '') {
                    poLink = this._lookupContact(ctx, c.contact);
                    if (!poLink) return 'Contact not found in Contacts: ' + c.contact + '. Save it first, then link it in a later step.';
                    if (s && this._contactKey(s) !== this._contactKey(poLink.name)) return 'The vendor "' + s + '" and the contact "' + poLink.name + '" are different names. Give the contact alone, or the same name for both.';
                    s = poLink.name;
                }
                if (!s) return 'Purchase order vendor missing.';
                v = c.amount === undefined ? 0 : this._num(c.amount);
                if (v === null) return 'Purchase order amount was not a number for ' + s;
                secKey = '';
                var itemId = '';
                if (c.section) {
                    secKey = this._findSectionKey(c.section);
                    if (!secKey) return this._sectionError(c.section);
                    if (c.item) {
                        var poPick = this._pickItem(budget.sections[secKey], secKey, c.item, c.line);
                        if (poPick.err) return poPick.err;
                        itemId = poPick.item.id;
                    }
                }
                var num = parseInt(budget.ledgers.poCounter, 10) || 1;
                budget.ledgers.poCounter = num + 1;
                var po = {
                    id: 'po_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    poNumber: 'PO-' + (num < 10 ? '00' : (num < 100 ? '0' : '')) + num,
                    vendor: s, contactId: poLink ? poLink.id : null, description: c.description || '', amount: v,
                    currency: window.displayCurrency || budget.currency || 'JMD', date: c.date || '',
                    status: c.status || 'Draft', sectionKey: secKey, itemId: itemId, notes: c.notes || ''
                };
                if (po.status === 'Paid') po.paidAmount = v;
                list.push(po);
                return null;
            }
            var poPick = this._pickRecord(list, 'po', c.po_number, c.position);
            if (!poPick.rec) return poPick.err;
            rec = poPick.rec;
            if (a === 'delete_po') { list.splice(this._indexOfRec(list, rec), 1); return null; }
            if (c.vendor !== undefined && String(c.vendor).replace(/^\s+|\s+$/g, '')) rec.vendor = String(c.vendor);
            if (c.contact !== undefined && String(c.contact).replace(/^\s+|\s+$/g, '') !== '') {
                var upLink = this._lookupContact(ctx, c.contact);
                if (!upLink) return 'Contact not found in Contacts: ' + c.contact + '. Save it first, then link it in a later step.';
                if (c.vendor !== undefined && String(c.vendor).replace(/^\s+|\s+$/g, '') && this._contactKey(c.vendor) !== this._contactKey(upLink.name)) return 'The vendor "' + c.vendor + '" and the contact "' + upLink.name + '" are different names. Give the contact alone, or the same name for both.';
                rec.contactId = upLink.id;
                rec.vendor = upLink.name;
            }
            if (c.description !== undefined) rec.description = String(c.description);
            if (c.date !== undefined) rec.date = String(c.date);
            if (c.notes !== undefined) rec.notes = String(c.notes);
            if (c.section !== undefined || c.item !== undefined) {
                var linkSec = c.section !== undefined ? String(c.section) : rec.sectionKey;
                if (!linkSec) {
                    if (c.item) return 'Give the section as well as the item to link purchase order ' + rec.poNumber + ' to a line.';
                    rec.sectionKey = '';
                    rec.itemId = '';
                } else {
                    secKey = this._findSectionKey(linkSec);
                    if (!secKey) return this._sectionError(linkSec);
                    rec.sectionKey = secKey;
                    if (c.item !== undefined && String(c.item) !== '') {
                        var linkPick = this._pickItem(budget.sections[secKey], secKey, c.item, c.line);
                        if (linkPick.err) return linkPick.err;
                        rec.itemId = linkPick.item.id;
                    } else if (c.section !== undefined || c.item !== undefined) {
                        rec.itemId = '';
                    }
                }
            }
            if (c.amount !== undefined) {
                v = this._num(c.amount);
                if (v === null) return 'Purchase order amount was not a number for ' + rec.poNumber;
                rec.amount = v;
            }
            if (c.status !== undefined) {
                rec.status = String(c.status);
                if (rec.status === 'Paid') rec.paidAmount = rec.amount; else delete rec.paidAmount;
            } else if (c.amount !== undefined && rec.status === 'Paid') {
                rec.paidAmount = rec.amount;
            }
            return null;
        }

        if (a === 'add_milestone' || a === 'update_milestone' || a === 'delete_milestone') {
            if (!Array.isArray(budget.calendarNotes)) budget.calendarNotes = [];
            list = budget.calendarNotes;
            if (a === 'add_milestone') {
                s = String(c.title || '').replace(/^\s+|\s+$/g, '');
                if (!s) return 'Milestone title missing.';
                if (c.stage !== undefined || c.offset_days !== undefined) {
                    if (c.date !== undefined) return 'Give a date or a stage with offset_days for a milestone, not both.';
                    var rst = String(c.stage || '').toLowerCase(), rOff = c.offset_days === undefined ? 0 : this._num(c.offset_days);
                    if (!({ dev: 1, pre: 1, prod: 1, post: 1, dist: 1 })[rst]) return 'Unknown stage: ' + (c.stage || '(none)') + '. Use one of dev, pre, prod, post, dist.';
                    if (rOff === null) return 'offset_days must be a number, got ' + c.offset_days + '.';
                    list.push({ id: this._newId('ms'), type: 'relative', stageKey: rst, offsetDays: Math.round(rOff), title: s });
                    return null;
                }
                if (!this._isDate(c.date)) return 'Milestone date must look like 2026-12-15, got ' + (c.date === undefined ? '(none)' : c.date) + '.';
                list.push({ id: this._newId('ms'), date: c.date, title: s });
                return null;
            }
            var msPick = this._pickRecord(list, 'milestone', c.title, c.position);
            if (!msPick.rec) return msPick.err;
            rec = msPick.rec;
            if (a === 'delete_milestone') { list.splice(this._indexOfRec(list, rec), 1); return null; }
            if (c.new_title !== undefined && String(c.new_title).replace(/^\s+|\s+$/g, '')) rec.title = String(c.new_title).replace(/^\s+|\s+$/g, '');
            if (c.date !== undefined && (c.stage !== undefined || c.offset_days !== undefined)) return 'Give a date or a stage with offset_days for a milestone, not both.';
            if (c.date !== undefined) {
                if (!this._isDate(c.date)) return 'Milestone date must look like 2026-12-15, got ' + c.date + '.';
                rec.date = c.date;
                if (rec.type === 'relative') { delete rec.type; delete rec.stageKey; delete rec.offsetDays; }
            }
            if (c.stage !== undefined || c.offset_days !== undefined) {
                var ust = c.stage !== undefined ? String(c.stage).toLowerCase() : (rec.stageKey || 'prod');
                var uOff = c.offset_days !== undefined ? this._num(c.offset_days) : (parseFloat(rec.offsetDays) || 0);
                if (!({ dev: 1, pre: 1, prod: 1, post: 1, dist: 1 })[ust]) return 'Unknown stage: ' + c.stage + '. Use one of dev, pre, prod, post, dist.';
                if (uOff === null) return 'offset_days must be a number, got ' + c.offset_days + '.';
                rec.type = 'relative';
                rec.stageKey = ust;
                rec.offsetDays = Math.round(uOff);
                delete rec.date;
            }
            return null;
        }

        if (a === 'add_blackout_day' || a === 'remove_blackout_day') {
            if (!this._isDate(c.date)) return 'The date must look like 2026-12-15, got ' + (c.date === undefined ? '(none)' : c.date) + '.';
            if (!Array.isArray(budget.blackoutDays)) budget.blackoutDays = [];
            i = budget.blackoutDays.indexOf(c.date);
            if (a === 'add_blackout_day') { if (i === -1) budget.blackoutDays.push(c.date); }
            else if (i !== -1) budget.blackoutDays.splice(i, 1);
            return null;
        }

        if (a === 'add_fringe' || a === 'update_fringe' || a === 'delete_fringe') {
            if (!Array.isArray(budget.fringes)) budget.fringes = [];
            list = budget.fringes;
            if (a === 'add_fringe') {
                s = String(c.name || '').replace(/^\s+|\s+$/g, '');
                if (!s) return 'Fringe name missing.';
                v = c.rate === undefined ? 0 : this._num(c.rate);
                if (v === null) return 'Fringe rate was not a number for ' + s;
                var newFringe = { id: this._newId('fringe'), name: s, rate: v, enabled: true };
                if (c.sections !== undefined) {
                    var fkeys = this._sectionKeysFrom(c.sections);
                    if (typeof fkeys === 'string') return fkeys;
                    if (fkeys.length) newFringe.sectionKeys = fkeys;
                }
                list.push(newFringe);
                return null;
            }
            var frPick = this._pickRecord(list, 'fringe', c.name, c.position);
            if (!frPick.rec) return frPick.err;
            rec = frPick.rec;
            if (a === 'delete_fringe') { list.splice(this._indexOfRec(list, rec), 1); return null; }
            if (c.new_name !== undefined && String(c.new_name).replace(/^\s+|\s+$/g, '')) rec.name = String(c.new_name).replace(/^\s+|\s+$/g, '');
            if (c.rate !== undefined) {
                v = this._num(c.rate);
                if (v === null) return 'Fringe rate was not a number for ' + rec.name;
                rec.rate = v;
            }
            if (c.enabled !== undefined) rec.enabled = (c.enabled === true || c.enabled === 'true');
            if (c.sections !== undefined) {
                var ukeys = this._sectionKeysFrom(c.sections);
                if (typeof ukeys === 'string') return ukeys;
                if (ukeys.length) rec.sectionKeys = ukeys; else delete rec.sectionKeys;
            }
            return null;
        }
        return 'Unknown action: ' + a;
    },

    /* A cap given in another currency, in the budget's own currency (its own exchange rate). A number, or an error sentence. */
    _capInBase: function (v, c) {
        var budget = window.budget, base = (budget && budget.currency) || 'JMD', code, out;
        if (c.currency === undefined || c.currency === '') return v;
        code = String(c.currency).replace(/\s/g, '').toUpperCase();
        if (!/^[A-Z]{3}$/.test(code)) return 'The currency of the cap must be a three letter code such as USD, got ' + c.currency + '.';
        if (code === base) return v;
        out = (window.mBT && window.mBT.le && typeof window.mBT.le.convertCurrencyOrNull === 'function') ? window.mBT.le.convertCurrencyOrNull(v, code, base, budget) : null;
        if (out === null) return 'This budget has no exchange rate between ' + code + ' and ' + base + ', so the cap was not set. Add the rate in the currency menu, Edit exchange rates, then ask again.';
        return out;
    },

    /* The plain sentence for a cap change in the preview. */
    _describeCap: function (c) {
        var b = window.budget, base = (b && b.currency) || 'JMD';
        var code = c.currency ? String(c.currency).replace(/\s/g, '').toUpperCase() : base;
        var v = this._num(c.value), t, conv;
        if (v === null) return 'Set the budget cap to "' + (c.value === undefined ? '' : c.value) + '"';
        t = 'Set the budget cap to ' + code + ' ' + this._money(v) + (v === 0 ? ' (cap off)' : '');
        if (code !== base && /^[A-Z]{3}$/.test(code) && v > 0) {
            conv = this._capInBase(v, c);
            t += typeof conv === 'string' ? ' (this budget has no exchange rate for ' + code + ', so this will be refused)' : ' (' + base + ' ' + this._money(conv) + ' at this budget\'s rate)';
        }
        return t;
    },

    /* Where the budget stands against its cap, for the report after an apply. */
    _capLine: function () {
        var b = window.budget, cur, cap, grand;
        if (!b) return '';
        cur = b.currency || window.displayCurrency || '';
        cap = (b.targetLock && parseFloat(b.targetLock.totalCap)) || 0;
        grand = parseFloat(b.grandTotal) || 0;
        if (cap > 0) {
            return 'Grand total is now ' + cur + ' ' + this._money(grand) + ' against the budget cap of ' + cur + ' ' + this._money(cap) + ': ' +
                (grand > cap ? 'OVER the cap by ' + cur + ' ' + this._money(grand - cap) + '.' : 'under the cap by ' + cur + ' ' + this._money(cap - grand) + '.');
        }
        return 'Grand total is now ' + cur + ' ' + this._money(grand) + '. No budget cap is set.';
    },

    _rateLines: function (budget) {
        var snap = budget && budget.exchangeRateState && budget.exchangeRateState.rates, base = (budget && budget.currency) || 'JMD', out = [], k;
        if (!snap || !(Number(snap[base]) > 0)) return '';
        for (k in snap) {
            if (!Object.prototype.hasOwnProperty.call(snap, k) || k === base || !(Number(snap[k]) > 0)) continue;
            out.push('1 ' + k + ' = ' + (Math.round(snap[base] / snap[k] * 10000) / 10000) + ' ' + base);
            if (out.length >= 8) break;
        }
        return out.length ? 'Exchange rates in this budget: ' + out.join('; ') + '.' : '';
    },

    /* Record what the app said after an apply, so the next question to the model carries the real outcome. */
    _tell: function (title, text) {
        this._lastApply = { title: String(title || ''), text: String(text || ''), at: Date.now() };
        return this._alertSafe(title, text);
    },

    /* Section names (an array, or one name) to the budget's section keys. An
       empty list means the whole budget. A string result is an error sentence. */
    _sectionKeysFrom: function (v) {
        var names = Array.isArray(v) ? v : (v === '' || v === null ? [] : [v]);
        var out = [], i, k;
        for (i = 0; i < names.length; i++) {
            k = this._findSectionKey(names[i]);
            if (!k) return this._sectionError(names[i]);
            if (out.indexOf(k) === -1) out.push(k);
        }
        return out;
    },

    /* Checks that need no change to the budget: runs before anything is touched. */
    /* A field the action does not have: named, with where to do it by hand. */
    _unsupportedField: function (c) {
        var a = c && c.mbt_action, allowed, k;
        if (!a || a === 'batch' || !this._ACTIONS[a]) return null;
        allowed = this._allowedKeys(a);
        for (k in c) {
            if (!Object.prototype.hasOwnProperty.call(c, k) || k === 'mbt_action' || allowed[k] || this._IGNORED_KEYS[k]) continue;
            /* Models often restate the field the action already sets ("field":"quantity" on update_quantity). Harmless, so accepted. */
            if (k === 'field' && this._impliedField(a, c.field)) continue;
            return 'The Assistant cannot set "' + k + '" with ' + a + '. Do it by hand in ' + this._ACTIONS[a].hand + '.';
        }
        return null;
    },

    _impliedField: function (a, f) {
        f = String(f || '').toLowerCase().replace(/[^a-z]/g, '');
        if (a === 'update_quantity') return f === 'quantity' || f === 'qty';
        if (a === 'update_rate') return f === 'rate';
        return false;
    },

    _preflightChange: function (c) {
        var a = c && c.mbt_action;
        if (!this._isKnownAction(a)) {
            return '"' + a + '" is not something the Assistant can do. Do it by hand instead.';
        }
        if (a === 'update_production_fee' && (typeof c.value !== 'number' || !isFinite(c.value) || c.value < 0 || c.value > 100)) return 'Production Fee must be a finite number from 0 to 100.';
        var badField = this._unsupportedField(c);
        if (badField) return badField;
        if (a === 'duplicate_budget' || a === 'rename_budget') {
            var n = String(c.name || '').replace(/^\s+|\s+$/g, '');
            if (!n) return 'The new budget name is missing.';
            if (n.length < 2 || n.length > 100 || !/^[a-zA-Z0-9À-ÿ '&.,!#\-()–—]+$/.test(n)) return 'The budget name "' + n + '" uses characters the app does not allow in a project name.';
        }
        if (a === 'set_field' && c.currency !== undefined && c.field !== 'totalCap') return 'A currency can only be given with the totalCap field.';
        if (a === 'set_display_currency') {
            var code = String(c.value || '').toUpperCase();
            if (!/^[A-Z]{3}$/.test(code)) return 'The currency must be a three letter code such as USD, got ' + (c.value === undefined ? '(none)' : c.value) + '.';
        }
        if (a === 'rename_contact') {
            var rcOld = String(c.name || '').replace(/^\s+|\s+$/g, ''), rcNew = String(c.new_name || '').replace(/^\s+|\s+$/g, '');
            if (!rcOld) return 'The contact to rename is missing.';
            if (!rcNew) return 'The new contact name is missing.';
            if (rcNew.length > 100 || /[<>]/.test(rcNew)) return 'The new contact name "' + rcNew + '" is too long or uses < or > characters.';
            if (rcOld === rcNew) return 'The contact "' + rcOld + '" already has that name.';
        }
        if ((a === 'add_po' || a === 'update_po') && c.contact !== undefined && typeof c.contact !== 'string') return 'The contact on a purchase order must be a contact name.';
        if (a === 'save_contact') {
            if (!String(c.name || '').replace(/^\s+|\s+$/g, '')) return 'The contact name is missing.';
            if (c.rate !== undefined && c.rate !== null && c.rate !== '' && (this._num(c.rate) === null || this._num(c.rate) < 0)) return 'The contact rate must be a number that is not negative, got ' + c.rate + '.';
            if (c.currency !== undefined && c.currency !== '' && !/^[A-Za-z]{3}$/.test(String(c.currency))) return 'The contact currency must be a three letter code such as USD, got ' + c.currency + '.';
            if (c.wallet_type !== undefined && c.wallet_type !== '' && !/^[A-Za-z0-9_-]{1,30}$/.test(String(c.wallet_type))) return 'The wallet type "' + c.wallet_type + '" is not valid.';
            if (c.clear !== undefined) {
                var okClear = { phone: 1, email: 1, wallet_type: 1, wallet_address: 1 }, ci;
                if (Object.prototype.toString.call(c.clear) !== '[object Array]') return 'The "clear" list on contact "' + c.name + '" must be a list of field names.';
                for (ci = 0; ci < c.clear.length; ci++) {
                    if (!okClear[c.clear[ci]]) return 'A contact field cannot be cleared this way: "' + c.clear[ci] + '". Only phone, email, wallet_type and wallet_address can.';
                    var given = c[c.clear[ci]];
                    if (given !== undefined && given !== '') return 'Contact "' + c.name + '" both sets and clears "' + c.clear[ci] + '".';
                }
            }
        }
        return null;
    },

    /* One change, described in plain English for the preview. */
    _describeChange: function (c) {
        var a = c && c.mbt_action, t;
        if (a === 'set_field' && c.field === 'totalCap') t = this._describeCap(c);
        else t = this._describeChangeBase(c);
        if (this._LINE_ACTIONS[a] && c.line !== undefined && c.line !== null && c.line !== '') t += ' (line ' + c.line + ')';
        if (this._REC_POS[a] && c.position !== undefined && c.position !== null && c.position !== '') t += ' (number ' + c.position + ')';
        return t;
    },

    _describeChangeBase: function (c) {
        var cur = window.displayCurrency || '';
        var a = c.mbt_action;
        var described = this._describeNew(c);
        if (described) return described;
        if (a === 'update_rate')        return 'Set "' + (c.description || 'item') + '" rate to ' + cur + ' ' + c.value;
        if (a === 'update_quantity')    return 'Set "' + (c.description || 'item') + '" quantity to ' + c.value;
        if (a === 'add_item')           return this._addItemDept(c)
            ? 'Add "' + (c.description || 'item') + '" to ' + this._addItemWhere(c)
            : 'Choose a department for "' + (c.description || 'item') + '"; it is not added until you do';
        if (a === 'add_section')        return 'Create section "' + (c.section || '?') + '"';
        if (a === 'update_production_fee') return 'Set Production Fee to ' + c.value + '%';
        if (a === 'update_contingency') return 'Set contingency to ' + c.value + '%';
        if (a === 'set_workweek')       return 'Set work week to ' + c.value + ' days';
        if (a === 'set_stage_days')     return 'Set ' + (c.stage || '?') + ' stage to ' + c.days + ' days';
        return 'Cannot do: ' + a + ' (not something the Assistant can do)';
    },

    /* Apply a single change. Returns an error string, or null on success. */
    _applyOne: function (c, ctx) {
        var budget = window.budget;
        var a = c.mbt_action;
        var LEGACY = { update_rate: 1, update_quantity: 1, add_item: 1, add_section: 1, update_contingency: 1, set_workweek: 1, set_stage_days: 1 };
        if (!this._isKnownAction(a) || a === 'batch') return '"' + a + '" is not something the Assistant can do. Do it by hand instead.';
        if (a === 'update_production_fee') {
            var feeError = this._preflightChange(c);
            if (feeError) return feeError;
            window.mBT_Finance.setProductionFee(budget, c.value);
            return null;
        }
        if (!LEGACY[a]) return this._applyNew(c, ctx);

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

        if (a === 'set_workweek') {
            var wk = parseInt(c.value, 10);
            if (wk !== 5 && wk !== 6 && wk !== 7) return 'Work week must be 5, 6 or 7 days, got ' + (c.value === undefined ? '(none)' : c.value) + '.';
            if (ctx && ctx.dry) return null;
            /* Route through the same entry point the header control uses
               (index.html mBT.features.funding.setWorkWeek), so reconcile,
               header refresh and the mbt:workWeek postMessage to open tool
               iframes all fire exactly as they do for a manual change. */
            if (window.mBT && window.mBT.features && window.mBT.features.funding && typeof window.mBT.features.funding.setWorkWeek === 'function') {
                window.mBT.features.funding.setWorkWeek(wk);
            } else {
                if (!budget.settings) budget.settings = {};
                budget.settings.workWeek = wk;
            }
            return null;
        }

        if (a === 'set_stage_days') {
            var STAGE_KEYS = { dev: 1, pre: 1, prod: 1, post: 1, dist: 1 };
            var stageKey = String(c.stage || '').replace(/^\s+|\s+$/g, '').toLowerCase();
            if (!STAGE_KEYS[stageKey]) return 'Unknown stage: ' + (c.stage || '(none)') + '. Use one of dev, pre, prod, post, dist.';
            var days = parseFloat(c.days);
            if (isNaN(days) || days < 0) return 'Stage days must be a non negative number, got ' + (c.days === undefined ? '(none)' : c.days) + '.';
            if (ctx && ctx.dry) return null;
            /* Route through the same entry point the Stages tool uses
               (index.html window.updateStageDuration), so it scaffolds
               targetLock on a fresh budget, saves, and fires updateAllHeaders
               plus mBTLE.reconcile exactly as a manual edit does. */
            if (typeof window.updateStageDuration === 'function') {
                window.updateStageDuration(stageKey, days);
            } else {
                if (!budget.targetLock) budget.targetLock = { totalCap: 0, stages: {} };
                if (!budget.targetLock.stages) budget.targetLock.stages = {};
                if (!budget.targetLock.stages[stageKey]) {
                    budget.targetLock.stages[stageKey] = { label: stageKey.toUpperCase(), ratio: 20, days: 0, locked: false };
                }
                budget.targetLock.stages[stageKey].days = days;
            }
            return null;
        }

        var addedDept = null;
        if (a === 'add_item' && window.mBTBatch2) {
            addedDept = this._addItemDept(c);
            c._notAdded = false;
            /* Nothing is guessed: with no department the line is left out and the user is told. */
            if (!addedDept) { c._notAdded = true; (this._unplacedAdds = this._unplacedAdds || []).push(c.description || 'item'); return null; }
            if (mBTBatch2.deptSectionsOn(budget)) {
                var madeItem = this._makeItem(c), madeClass = { description: madeItem.description };
                var deptSec = mBTBatch2.section(budget, madeClass, undefined, addedDept);
                madeItem.department = madeClass.department;
                budget.sections[deptSec].items.push(madeItem);
                return null;
            }
        }

        var key = this._findSectionKey(c.section);
        if (!key) return this._sectionError((c.section || '(none)'));
        var sec = budget.sections[key];
        if (!sec.items) sec.items = [];

        if (a === 'add_item') {
            var plainItem = this._makeItem(c);
            if (addedDept) plainItem.department = addedDept;
            sec.items.push(plainItem);
            return null;
        }

        if (a === 'update_rate' || a === 'update_quantity') {
            var itemPick = this._pickItem(sec, key, c.description, c.line);
            if (itemPick.err) return itemPick.err;
            var item = itemPick.item;
            var val = parseFloat(c.value);
            if (isNaN(val)) return 'Value was not a number for ' + (c.description || 'item');
            var field = a === 'update_quantity' ? 'quantity' : 'rate';
            var was = parseFloat(item[field]);
            var lineErr = field === 'rate' ? this._setLineRate(item, val, ctx) : this._setLineQty(item, val, ctx);
            if (lineErr) return lineErr;
            this._recalcItem(item);
            /* The line already had this value: the run reports it as nothing changed. */
            if (ctx && !isNaN(was) && Math.abs(was - parseFloat(item[field])) < 0.000001) ctx.sameValue = true;
            return null;
        }

        return 'Unknown action: ' + a;
    },

    /* Apply an AI suggestion: one change, or a batch that builds a whole
       section. Batches are all-or-nothing. The budget is snapshotted first,
       and any failure restores it, so a half-applied batch is impossible.
       Preview confirms inline inside the chat panel (Expanded and PiP). */
    applySuggestion: function (diff, diffKey) {
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
            self._chatSession.pendingDiff = { diff: diff, changes: changes, diffKey: diffKey || '' };
            if (typeof self._chatRender === 'function') self._chatRender();
            return;
        }

        /* Fallback if chat host failed to mount. */
        var esc = (window.mBT && window.mBT.ui && window.mBT.ui.render && window.mBT.ui.render.esc)
            ? window.mBT.ui.render.esc
            : function (v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
        var i, rows = [];
        var warnAll = self._previewWarnings(changes, diffKey || '');
        for (i = 0; i < warnAll.top.length; i++) rows.push('<li style="margin:0 0 4px 0;color:#92400e;">' + esc(warnAll.top[i]) + '</li>');
        for (i = 0; i < changes.length; i++) {
            rows.push('<li style="margin:0 0 4px 0;">' + esc(self._describeChange(changes[i])) + (warnAll.per[i] || []).map(function (w) { return '<br><span style="color:#92400e;">' + esc(w) + '</span>'; }).join('') + '</li>');
        }
        var title = changes.length > 1 ? ('Preview ' + changes.length + ' Changes') : 'Preview Change';
        var body = '<div style="text-align:left;max-height:260px;overflow-y:auto;margin:0 0 8px 0;"><ol style="margin:0;padding-left:18px;font-size:11px;line-height:1.5;color:#475569;">' + rows.join('') + '</ol></div><span style="font-weight:800;">Apply to the budget?</span>';
        mBTME.confirmHTML(title, body, function () { self._commitSuggestion(changes); });
    },

    /* Did the user's request just before this reply ask for a copy of the budget? */
    _userAskedForCopy: function (diffKey) {
        var sess = this._chatSession, chat = sess && sess.activeChat, idx, parts, n, i;
        if (!chat || !chat.length) return false;
        idx = chat.length;
        if (diffKey) {
            parts = String(diffKey).split('_');
            n = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(n)) idx = n;
        }
        for (i = Math.min(idx, chat.length) - 1; i >= 0; i--) {
            if (chat[i] && chat[i].role === 'user') return /\b(duplicate|duplicated|duplicating|copy|copies|clone|cloned|save as|new version|version of)\b/i.test(String(chat[i].content || ''));
        }
        return false;
    },

    /* Warnings for the preview, from the budget as it stands. per[i] belongs to change i; top apply to the whole reply. Nothing here changes the budget. */
    _previewWarnings: function (changes, diffKey) {
        var self = this, b = window.budget, per = {}, top = [], seen = {}, hasDup = false, touches = false;
        var i, j, c, a, sk, its, hits, secName, plan, pk, nm, m, cur, nv, key;
        function add(n, t) { (per[n] = per[n] || []).push(t); }
        if (!b || !b.sections) return { per: per, top: top };
        for (i = 0; i < (changes || []).length; i++) {
            c = changes[i]; a = c && c.mbt_action;
            if (!a) continue;
            if (a === 'duplicate_budget') { hasDup = true; continue; }
            if (!self._NOT_TRACKED[a] || a === 'rename_budget') touches = true;
            if (a === 'add_item') {
                secName = c.section;
                try {
                    if (window.mBTBatch2 && mBTBatch2.deptSectionsOn(b)) {
                        plan = mBTBatch2.plan(b, { description: c.description }, c.department);
                        if (!plan.needsChoice) secName = plan.section;
                    }
                } catch (eP) { /* the section named in the reply is used */ }
                sk = self._findSectionKey(secName);
                key = (sk || String(secName)) + '|' + self._normalizeName(c.description);
                hits = [];
                its = (sk && b.sections[sk] && b.sections[sk].items) || [];
                for (j = 0; j < its.length; j++) { if (its[j] && self._normalizeName(its[j].description) === self._normalizeName(c.description)) hits.push(j); }
                if (hits.length) add(i, 'The section "' + sk + '" already has "' + (c.description || '') + '" (' + self._lineWords(its, hits) + '). Adding it again makes a second line with the same name. Change the existing line instead.');
                else if (seen[key]) add(i, 'This reply adds "' + (c.description || '') + '" to "' + secName + '" more than once.');
                seen[key] = true;
                continue;
            }
            if (self._REC_POS[a]) {
                pk = self._previewRecord(a, c, b);
                if (pk) add(i, 'This will be refused: ' + pk.err);
            }
            if (self._LINE_ACTIONS[a] || a === 'add_po' || a === 'update_po') {
                nm = self._LINE_ACTIONS[a] ? c.description : c.item;
                if (c.section && nm !== undefined && nm !== '') {
                    sk = self._findSectionKey(c.section);
                    if (!sk) {
                        m = self._sectionMatch(c.section);
                        if (m.hits.length > 1) add(i, 'This will be refused: ' + self._sectionError(c.section));
                    } else if (b.sections[sk]) {
                        pk = self._pickItem(b.sections[sk], sk, nm, c.line);
                        if (pk.err && (pk.ambiguous || pk.bad)) add(i, 'This will be refused: ' + pk.err);
                        else if (pk.item && (a === 'update_rate' || a === 'update_quantity')) {
                            cur = parseFloat(pk.item[a === 'update_rate' ? 'rate' : 'quantity']);
                            nv = parseFloat(c.value);
                            if (!isNaN(cur) && !isNaN(nv) && Math.abs(cur - nv) < 0.000001) add(i, 'This line already has that value, so this would change nothing.');
                        }
                    }
                }
            }
        }
        if (!hasDup && touches && self._userAskedForCopy(diffKey)) {
            top.push('You asked for a copy, but nothing here duplicates the budget first, so every change goes straight into the original "' + (b.projectName || '') + '". Cancel and ask again if you want the original left alone.');
        }
        return { per: per, top: top };
    },

    /* Mark the assistant bubble that offered this diff so the button becomes Reapply. */
    _stampChatApplied: function (diffKey) {
        var sess = this._chatSession;
        var chat;
        var idx;
        var parts;
        if (!sess || !diffKey) return;
        chat = sess.activeChat;
        if (!chat || !chat.length) return;
        parts = String(diffKey).split('_');
        idx = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(idx) && chat[idx] && chat[idx].role === 'assistant') {
            chat[idx]._applied = true;
        }
    },

    /* Flatten a change list: a batch inside a batch is still one list. */
    _flattenChanges: function (changes) {
        var out = [], i, c;
        for (i = 0; i < (changes || []).length; i++) {
            c = changes[i];
            if (c && c.mbt_action === 'batch' && c.changes && c.changes.length) out = out.concat(this._flattenChanges(c.changes));
            else out.push(c);
        }
        return out;
    },

    _prefix: function () { return window.storageKeyPrefix || 'prodBudget_v5_'; },

    _alertSafe: function (title, text) {
        if (window.mBTME && typeof window.mBTME.alert === 'function') window.mBTME.alert(title, text);
    },

    /* Copy the whole budget under a new name and switch to the copy. The
       original is saved first and is not touched again. Rejects with a plain
       sentence when the name is taken or either save fails. */
    _doDuplicate: function (name, extra) {
        var self = this;
        var original = window.budget.projectName;
        return Promise.resolve(window.getProjectList()).then(function (list) {
            if ((list || []).indexOf(name) !== -1) throw new Error('A budget named "' + name + '" already exists. Pick another name.');
            return window.saveBudget(true);
        }).then(function () {
            return window.mBT.data.duplicate(name);
        }).then(function () {
            if (!window.budget || window.budget.projectName !== name) throw new Error('The copy was not created.');
            extra.dup = { originalName: original, copyName: name };
        });
    },

    /* Rename the open budget. The record moves to the new name; the old
       record goes to the app's Recycle Bin, so nothing is lost. */
    _doRename: function (name, extra) {
        var self = this;
        var oldName = window.budget.projectName;
        var prefix = self._prefix();
        var oldKey = prefix + oldName;
        var newKey = prefix + name;
        if (name === oldName) return Promise.resolve();
        return Promise.resolve(window.getProjectList()).then(function (list) {
            if ((list || []).indexOf(name) !== -1) throw new Error('A budget named "' + name + '" already exists. Pick another name.');
            return window.mBTBudgetStorage.load(oldKey);
        }).then(function (oldRecord) {
            extra._oldRecord = oldRecord || null;
            window.budget.projectName = name;
            window.currentProjectName = name;
            return window.saveBudget(true);
        }).then(function () {
            return window.mBTBudgetStorage.load(newKey);
        }).then(function (saved) {
            if (!saved || saved.projectName !== name) throw new Error('The renamed budget could not be saved.');
            if (extra._oldRecord) {
                try {
                    var trashKey = prefix + 'trash';
                    var trashed = JSON.parse(localStorage.getItem(trashKey) || '[]');
                    trashed.push(extra._oldRecord);
                    localStorage.setItem(trashKey, JSON.stringify(trashed));
                } catch (eT) { /* the old record is only removed below if it was kept */ throw new Error('The old record could not be kept in the Recycle Bin, so the rename was stopped.'); }
            }
            return window.mBTBudgetStorage.remove(oldKey);
        }).then(function () {
            try { localStorage.removeItem(oldKey); } catch (eL) { /* ignore */ }
            extra.renamedFrom = oldName;
            if (window.mBT && window.mBT.ui && window.mBT.ui.toolbar && typeof window.mBT.ui.toolbar.renderProjectMgmt === 'function') window.mBT.ui.toolbar.renderProjectMgmt();
        });
    },

    /* Switch the display currency through the same click path the currency
       menu uses, then check it took. Returns an error string or null. */
    _doCurrency: function (code) {
        var btn = document.createElement('button');
        code = String(code || '').toUpperCase();
        btn.setAttribute('data-currency-code', code);
        btn.style.display = 'none';
        document.body.appendChild(btn);
        try { btn.click(); } finally { if (btn.parentNode) btn.parentNode.removeChild(btn); }
        if (window.displayCurrency !== code) {
            return 'Amounts stay in ' + window.displayCurrency + ' because this budget has no exchange rate for ' + code + '. Add the rate in the currency menu, Edit exchange rates, then ask again.';
        }
        return null;
    },

    /* Save people through the shared Contacts roster, never a second list.
       Each save also records what the contact looked like before (or that it
       was new), so Undo can put the shared roster back. */
    _saveContacts: function (people) {
        var done = [], failed = [], changes = [];
        var chain = Promise.resolve();
        if (typeof window.mBTSaveContactToRoster !== 'function') {
            return Promise.resolve({ done: [], failed: people.map(function (p) { return p.name; }), changes: [] });
        }
        function findByName(roster, name) {
            var key = String(name || '').toLowerCase(), i;
            for (i = 0; i < (roster || []).length; i++) {
                if (roster[i] && String(roster[i].name || '').toLowerCase() === key) return roster[i];
            }
            return null;
        }
        people.forEach(function (p) {
            chain = chain.then(function () {
                var before = null;
                var fetch = (typeof window.mBTFetchMergedContactRoster === 'function') ? window.mBTFetchMergedContactRoster() : Promise.resolve([]);
                return Promise.resolve(fetch).catch(function () { return []; }).then(function (roster) {
                    var ex = findByName(roster, p.name);
                    try { before = ex ? JSON.parse(JSON.stringify(ex)) : null; } catch (eB) { before = null; }
                    return window.mBTSaveContactToRoster(p);
                }).then(function (saved) {
                    if (saved) {
                        done.push(p.name);
                        if (p.overwrite || p.undo) changes.push({ id: saved.id, name: p.name, created: !before, before: before, savedAt: saved.updated_at || null });
                    } else failed.push(p.name);
                });
            }).catch(function () { failed.push(p.name); });
        });
        return chain.then(function () { return { done: done, failed: failed, changes: changes }; });
    },

    /* Put the shared roster back the way it was before the last batch. A
       contact is only touched if nobody has saved it since the Assistant did.
       Resolves to { restored: [names], kept: [names] }. */
    _undoContacts: function (changes) {
        var restored = [], kept = [];
        var chain = Promise.resolve();
        var storage = window.mBTStorage;
        if (!changes || !changes.length) return Promise.resolve({ restored: restored, kept: kept });
        if (!storage || typeof storage.saveContact !== 'function' || typeof storage.deleteContact !== 'function' || typeof window.mBTFetchMergedContactRoster !== 'function') {
            return Promise.resolve({ restored: [], kept: changes.map(function (ch) { return ch.name; }) });
        }
        changes.slice().reverse().forEach(function (ch) {
            chain = chain.then(function () {
                return window.mBTFetchMergedContactRoster();
            }).then(function (roster) {
                var cur = null, i;
                for (i = 0; i < roster.length; i++) { if (roster[i] && roster[i].id === ch.id) { cur = roster[i]; break; } }
                if (!cur || (ch.savedAt && cur.updated_at !== ch.savedAt)) { kept.push(ch.name); return null; }
                if (ch.created) return storage.deleteContact(ch.id).then(function () { restored.push(ch.name); });
                return storage.saveContact(JSON.parse(JSON.stringify(ch.before))).then(function () { restored.push(ch.name); });
            }).catch(function () { kept.push(ch.name); });
        });
        return chain.then(function () {
            window.__mbtCrewRosterCache = null;
            if (window.mBTOG && typeof window.mBTOG.refreshContacts === 'function') {
                return Promise.resolve(window.mBTOG.refreshContacts()).catch(function () { }).then(function () { return { restored: restored, kept: kept }; });
            }
            return { restored: restored, kept: kept };
        });
    },

    _backupJson: function (budget) {
        var snap = { id: budget.id, projectName: budget.projectName, collab_project_id: budget.collab_project_id };
        var i, k;
        for (i = 0; i < this._UNDO_ROOTS.length; i++) {
            k = this._UNDO_ROOTS[i];
            if (Object.prototype.hasOwnProperty.call(budget, k)) snap[k] = budget[k];
        }
        return JSON.stringify(snap);
    },

    _restoreRoots: function (budget, backup) {
        var prev = JSON.parse(backup);
        var i, k;
        for (i = 0; i < this._UNDO_ROOTS.length; i++) {
            k = this._UNDO_ROOTS[i];
            if (Object.prototype.hasOwnProperty.call(prev, k)) budget[k] = prev[k];
            else delete budget[k];
        }
    },

    /* Run every change in order on the open budget, with the per change
       save, reconcile and header passes switched off. Returns the errors. */
    _runChanges: function (changes, ctx) {
        var self = this;
        var mBTLE = window.mBTLE;
        var _realSave = window.saveBudget;
        var _realReconcile = (mBTLE && mBTLE.reconcile) ? mBTLE.reconcile : null;
        var _realHeaders = window.updateAllHeaders;
        var _noop = function () { };
        var errors = [];
        var j, err, track, before;
        self._unplacedAdds = [];
        try {
            if (typeof _realSave === 'function') window.saveBudget = _noop;
            if (_realReconcile) mBTLE.reconcile = _noop;
            if (typeof _realHeaders === 'function') window.updateAllHeaders = _noop;
            if (ctx) ctx.noops = [];
            for (j = 0; j < changes.length; j++) {
                track = !!ctx && !ctx.dry && !self._NOT_TRACKED[changes[j] && changes[j].mbt_action];
                before = track ? self._backupJson(window.budget) : '';
                if (ctx) ctx.sameValue = false;
                err = self._applyOne(changes[j], ctx);
                if (err) errors.push('• ' + err);
                else if (track && !changes[j]._notAdded && (ctx.sameValue || self._backupJson(window.budget) === before)) ctx.noops.push(changes[j]);
            }
        } finally {
            if (typeof _realSave === 'function') window.saveBudget = _realSave;
            if (_realReconcile) mBTLE.reconcile = _realReconcile;
            if (typeof _realHeaders === 'function') window.updateAllHeaders = _realHeaders;
        }
        return errors;
    },

    /* Run the apply path after the user confirms (inline or fallback).
       Checks first, applies as one batch, saves, reads the saved copy back,
       and only then says what happened. */
    _commitSuggestion: function (changes, diffKey) {
        var self = this;
        var budget = window.budget;
        var mBTME = window.mBTME;
        if (!budget || !changes || !changes.length) return;
        changes = self._flattenChanges(changes);

        var errors = [], i, c, a, pre;
        var dupC = null, renameC = null, curC = null, rest = [], contactChanges = [];
        for (i = 0; i < changes.length; i++) {
            c = changes[i];
            pre = self._preflightChange(c);
            if (pre) { errors.push('• ' + pre); continue; }
            a = c.mbt_action;
            if (a === 'duplicate_budget') { if (dupC) errors.push('• Only one duplicate_budget fits in one batch.'); else dupC = c; }
            else if (a === 'rename_budget') { if (renameC) errors.push('• Only one rename_budget fits in one batch.'); else renameC = c; }
            else if (a === 'set_display_currency') curC = c;
            else if (a === 'save_contact') contactChanges.push(c);
            else rest.push(c);
        }
        if (dupC && renameC) errors.push('• duplicate_budget and rename_budget cannot be in the same batch, the copy already has its own name.');
        if (errors.length) {
            return self._tell('Nothing Applied', 'The budget was left unchanged because ' + (errors.length === 1 ? 'this failed:' : 'these failed:') + '\n\n' + errors.join('\n'));
        }

        var extra = { dup: null, renamedFrom: null, currencyBefore: null, contactsSaved: [], contactsFailed: [], lookup: {}, renames: [], creates: [], createdKeys: {}, rosterChanges: null, budgetCommitted: false };

        var proceed = function () {
        /* A copy or a rename touches storage, so prove the other changes will
           work on a throwaway clone first. Nothing is created if any would fail. */
        if ((dupC || renameC) && rest.length) {
            var live = window.budget;
            var dry = null, dryErrors = [];
            try { dry = JSON.parse(JSON.stringify(live)); } catch (eDry) { dry = null; }
            if (!dry) return self._tell('Nothing Applied', 'Could not check the changes safely, so nothing was applied.');
            try {
                window.budget = dry;
                dryErrors = self._runChanges(rest, { dry: true, contacts: [], lookup: extra.lookup, renames: extra.renames, renamed: [] });
            } finally { window.budget = live; }
            if (dryErrors.length) {
                return self._tell('Nothing Applied', 'No copy was made and the budget was left unchanged because ' + (dryErrors.length === 1 ? 'this failed:' : 'these failed:') + '\n\n' + dryErrors.join('\n'));
            }
        }

        var pipeline = Promise.resolve();
        if (dupC) pipeline = pipeline.then(function () { return self._doDuplicate(String(dupC.name).replace(/^\s+|\s+$/g, ''), extra); });
        if (renameC) pipeline = pipeline.then(function () { return self._doRename(String(renameC.name).replace(/^\s+|\s+$/g, ''), extra); });
        pipeline.then(function () {
            return self._commitOnActive(rest, changes, curC, contactChanges, diffKey, extra);
        }).catch(function (err) {
            var msg = (err && err.message) ? err.message : 'Something went wrong.';
            if (extra.dup) {
                msg = 'The copy "' + extra.dup.copyName + '" was made, but it was not finished: ' + msg;
            }
            var back = extra.budgetCommitted ? Promise.resolve('') : self._giveBackRenames(extra);
            back.then(function (note) {
                self._tell('Not Fully Applied', msg + note + '\n\nWhat the app did not confirm was not applied.');
                if (typeof window.render === 'function') window.render();
            });
        });
        };

        return self._resolveContacts(changes).then(function (res) {
            var cerr = res.errors.slice();
            if (!cerr.length) cerr = self._renameClashes(changes, res.renames);
            if (cerr.length) {
                return self._tell('Nothing Applied', 'The budget and Contacts were left unchanged because ' + (cerr.length === 1 ? 'this failed:' : 'these failed:') + '\n\n' + cerr.join('\n'));
            }
            extra.lookup = res.lookup;
            extra.renames = res.renames;
            extra.creates = res.creates;
            return proceed();
        });
    },

    /* The part of an apply that runs on the open budget (the copy, after a duplicate). */
    _commitOnActive: function (rest, allChanges, curC, contactChanges, diffKey, extra) {
        var self = this;
        var todo = (extra.renames || []).filter(function (r) { return !r.rosterDone; });
        var creates = extra.creates || [];
        if (!todo.length && !creates.length) return self._commitBody(rest, allChanges, curC, contactChanges, diffKey, extra);
        /* Contacts first: if the roster cannot be changed the budget is not touched,
           and if the budget then fails the roster is put back. */
        return self._renameInRoster(todo).then(function (r) {
            extra.rosterChanges = r.changes;
            if (r.failed.length) return { failed: r.failed };
            return self._createInRoster(creates, extra).then(function (c) {
                extra.rosterChanges = extra.rosterChanges.concat(c.changes);
                return { failed: c.failed };
            });
        }).then(function (r) {
            if (r.failed.length) {
                return self._giveBackRenames(extra).then(function (note) {
                    self._tell('Nothing Applied', 'Contacts could not change: ' + r.failed.join(', ') + '. The budget was left unchanged.' + note);
                });
            }
            return self._commitBody(rest, allChanges, curC, contactChanges, diffKey, extra);
        });
    },

    /* An error thrown while applying: put every budget field and the shared
       Contacts back, then say plainly what state the app is in. */
    _failApply: function (budget, backup, extra, err) {
        var self = this;
        var mBTLE = window.mBTLE;
        var budgetBack = true;
        try {
            self._restoreRoots(budget, backup);
            if (mBTLE && typeof mBTLE.reconcile === 'function') mBTLE.reconcile();
        } catch (eBack) { budgetBack = false; }
        try { if (typeof window.render === 'function') window.render(); } catch (eRen) { /* screen refresh is best effort */ }
        return self._giveBackRenames(extra).then(function (note) {
            var why = (err && err.message) ? err.message : 'Something went wrong.';
            if (budgetBack) {
                self._tell('Nothing Applied', 'Something went wrong while applying, so the budget was put back as it was: ' + why + note);
            } else {
                self._tell('Not Fully Applied', 'Something went wrong while applying (' + why + ') and the budget could not be fully put back. Check it before you continue, and use the app history if a change is still there.' + note);
            }
        });
    },

    _commitBody: function (rest, allChanges, curC, contactChanges, diffKey, extra) {
        var self = this;
        var budget = window.budget;
        var mBTLE = window.mBTLE;
        var ctx = { contacts: [], expect: [], lookup: extra.lookup || {}, renames: extra.renames || [], renamed: [] };
        var backup, errors = [], j;

        try { backup = self._backupJson(budget); } catch (e) { backup = null; }
        try { extra.sectionOrder = Object.keys(budget.sections); } catch (eOrd) { extra.sectionOrder = null; }
        if (!backup) {
            return self._giveBackRenames(extra).then(function (note) {
                self._tell('Nothing Applied', 'Could not create a safe undo record. No AI changes were applied.' + note);
            });
        }

        try {
            errors = self._runChanges(rest, ctx);
        } catch (eRun) {
            return self._failApply(budget, backup, extra, eRun);
        }
        var unplaced = (self._unplacedAdds || []).slice();
        var noops = (ctx.noops || []).slice();
        self._unplacedAdds = [];
        if (errors.length) {
            self._restoreRoots(budget, backup);
            return self._giveBackRenames(extra).then(function (note) {
                self._tell('Nothing Applied', 'The budget was left unchanged because ' + (errors.length === 1 ? 'this failed:' : 'these failed:') + '\n\n' + errors.join('\n') + note);
            });
        }

        /* Recalculate first, then check that every rate and quantity asked for
           is really what the budget now says. If not, nothing is kept. */
        var stuck;
        try {
            if (mBTLE && typeof mBTLE.reconcile === 'function') mBTLE.reconcile();
            stuck = self._checkExpect(ctx.expect);
        } catch (eRec) {
            return self._failApply(budget, backup, extra, eRec);
        }
        if (stuck.length) {
            self._restoreRoots(budget, backup);
            if (mBTLE && typeof mBTLE.reconcile === 'function') mBTLE.reconcile();
            if (typeof window.render === 'function') window.render();
            return self._giveBackRenames(extra).then(function (note) {
                self._tell('Nothing Applied', 'The budget was left unchanged because the app did not keep these:\n\n' + stuck.map(function (t) { return '• ' + t; }).join('\n') + note);
            });
        }
        extra.budgetCommitted = true;

        try {
            var thr = self._activeThread();
            if (thr) {
                thr.changeCount = (parseInt(thr.changeCount, 10) || 0) + allChanges.length;
                thr.updated = Date.now();
            }
        } catch (eThr) { /* ignore thread counter errors */ }
        self._stampChatApplied(diffKey);

        var savePromise = (typeof window.saveBudget === 'function') ? window.saveBudget() : Promise.resolve();

        var record = null;
        try {
            record = mBTBudgetSafety.capture(JSON.parse(backup), budget, self._UNDO_ROOTS);
        } catch (eCap) { record = null; }
        window._mbtAILastBackup = record ? JSON.stringify(record) : null;
        window._mbtAILastExtra = extra;
        if (!record && !extra.dup) {
            self._tell('Applied, but no undo', 'The changes were applied, but a safe undo record could not be made. Use the app history to reverse them.');
        }

        if (curC) {
            extra.currencyBefore = window.displayCurrency;
            var curErr = self._doCurrency(curC.value);
            if (curErr) { extra.currencyError = curErr; extra.currencyBefore = null; }
        }
        if (typeof window.updateAllHeaders === 'function') window.updateAllHeaders();
        if (typeof window.forceSectionRebuild === 'function') window.forceSectionRebuild();
        if (typeof window.render === 'function') window.render();
        if (window.mBT && window.mBT.features && window.mBT.features.funding && typeof window.mBT.features.funding.updateCard === 'function') {
            try { window.mBT.features.funding.updateCard(); } catch (eFund) { /* card not on screen */ }
        }
        if (typeof self.refreshUndoButton === 'function') self.refreshUndoButton();

        var people = ctx.contacts.slice();
        for (j = 0; j < contactChanges.length; j++) {
            if (extra.createdKeys && extra.createdKeys[self._contactKey(contactChanges[j].name)]) continue;
            people.push(self._contactPayload(contactChanges[j]));
        }

        return Promise.resolve(savePromise).then(function () {
            return self._verifySaved(budget);
        }).then(function (verify) {
            return self._renameInOtherBudgets(ctx.renamed, extra).then(function (ob) {
            return self._saveContacts(people).then(function (cres) {
                var lines = [];
                var total = allChanges.length;
                var ok = [], k, cc, a2;
                extra.contactChanges = (extra.rosterChanges || []).concat(cres.changes);
                /* Only changes the app confirmed are counted as applied. */
                for (k = 0; k < allChanges.length; k++) {
                    cc = allChanges[k];
                    a2 = cc.mbt_action;
                    if (a2 === 'set_display_currency' && extra.currencyError) continue;
                    if (a2 === 'save_contact' && cres.failed.indexOf(cc.name) !== -1) continue;
                    if (a2 === 'add_item' && cc._notAdded) continue;
                    if (noops.indexOf(cc) !== -1) continue;
                    ok.push(cc);
                }
                var n = ok.length;
                if (extra.dup) lines.push('Made a copy named "' + extra.dup.copyName + '". The original "' + extra.dup.originalName + '" was not changed.');
                for (k = 0; k < ok.length; k++) {
                    if (k >= 8) { lines.push('and ' + (n - 8) + ' more'); break; }
                    lines.push('• ' + self._describeChange(ok[k]));
                }
                for (k = 0; k < noops.length; k++) {
                    if (k >= 8) { lines.push('and ' + (noops.length - 8) + ' more that changed nothing'); break; }
                    lines.push('Nothing changed: ' + self._describeChange(noops[k]) + ' (the budget already had it that way).');
                }
                if (extra.currencyError) lines.push('Not done: ' + extra.currencyError);
                if (unplaced.length) lines.push('Not added, because no department was chosen: ' + unplaced.join(', ') + '. Ask again and choose a department in the preview.');
                for (k = 0; k < ctx.renamed.length; k++) lines.push(self._renameLine(ctx.renamed[k]));
                if (ctx.renamed.length) {
                    if (ob.changed.length) lines.push('Other saved budgets updated: ' + ob.changed.map(function (b) { return b.name + ' (' + b.lines + (b.lines === 1 ? ' line' : ' lines') + ')'; }).join(', ') + '.');
                    else if (!ob.skipped.length && !ob.failed.length) lines.push('No other saved budget shows ' + (ctx.renamed.length === 1 ? 'this contact' : 'these contacts') + '.');
                    if (ob.left) lines.push(ob.left + (ob.left === 1 ? ' linked line in another budget shows' : ' linked lines in other budgets show') + ' a different label and ' + (ob.left === 1 ? 'was' : 'were') + ' left alone.');
                    if (ob.skipped.length) lines.push('Shared budgets not changed: ' + ob.skipped.join(', ') + '. Open each shared budget and ask again to update its lines.');
                    if (ob.failed.length) lines.push('Could not update: ' + ob.failed.join(', ') + '. Check ' + (ob.failed.length === 1 ? 'it' : 'them') + ', or open each and ask again.');
                }
                var madeNames = [], mk2;
                for (mk2 in extra.createdKeys) { if (Object.prototype.hasOwnProperty.call(extra.createdKeys, mk2)) madeNames.push(extra.lookup[mk2] ? extra.lookup[mk2].name : mk2); }
                if (cres.done.length || madeNames.length) lines.push('Saved in Contacts: ' + madeNames.concat(cres.done).join(', ') + '.');
                if (cres.failed.length) lines.push('Not saved in Contacts: ' + cres.failed.join(', ') + '. Add them in the Contacts tool.');
                var title = 'Applied';
                if (n === 0) {
                    title = noops.length ? 'Nothing Changed' : 'Nothing Applied';
                    lines.unshift(noops.length ? 'Nothing in the budget changed.' : 'None of the changes could be confirmed, so nothing was applied.');
                    if (!extra.dup) { window._mbtAILastBackup = null; window._mbtAILastExtra = null; }
                } else if (!verify.ok) {
                    title = 'Applied on screen, not confirmed saved';
                    lines.unshift('The changes show on screen, but the saved copy could not be confirmed (' + verify.why + '). Save again before closing the app.');
                } else if (n < total) {
                    title = 'Partly Applied';
                    lines.unshift('Applied ' + n + ' of ' + total + ' changes and saved. Use the undo arrow in chat to reverse.');
                } else {
                    lines.unshift('Applied ' + (n === 1 ? '1 change' : n + ' changes') + ' and saved. Use the undo arrow in chat to reverse.');
                }
                if (ob.failed.length && title === 'Applied') title = 'Partly Applied';
                if (typeof self.refreshUndoButton === 'function') self.refreshUndoButton();
                if (self._chatSession) {
                    self._chatSession.pendingDiff = null;
                    if (typeof self._chatRender === 'function') self._chatRender();
                }
                lines.push(self._capLine());
                self._tell(title, lines.join('\n'));
            });
            });
        });
    },

    /* The same rename in every other saved budget on this device. The open
       budget (and the original of a duplicate) is not touched here. A shared
       budget is left alone, because saving it here would not reach the people
       it is shared with. Each budget that changes is kept in extra so Undo can
       put its record back. Never rejects; resolves to { changed, skipped, failed, left }. */
    _renameInOtherBudgets: function (renamed, extra) {
        var self = this, out = { changed: [], skipped: [], failed: [], left: 0 };
        var storage = window.mBTBudgetStorage;
        var open = window.budget ? window.budget.projectName : '';
        var original = extra && extra.dup ? extra.dup.originalName : '';
        var prefix = self._prefix();
        if (!renamed || !renamed.length) return Promise.resolve(out);
        if (!storage || typeof storage.load !== 'function' || typeof storage.save !== 'function' || typeof window.getProjectList !== 'function') {
            return Promise.resolve(out);
        }
        extra.otherBudgets = extra.otherBudgets || [];
        return Promise.resolve(window.getProjectList()).then(function (list) {
            var chain = Promise.resolve();
            (list || []).forEach(function (name) {
                if (name === open || name === original) return;
                chain = chain.then(function () {
                    var key = prefix + name, before = null;
                    return storage.load(key).then(function (rec) {
                        var cnt = 0, ri, c, after, saveAt;
                        if (!rec || typeof rec !== 'object' || !rec.sections || typeof rec.sections !== 'object') return null;
                        if (rec.collab_project_id) { out.skipped.push(name); return null; }
                        before = JSON.stringify(rec);
                        for (ri = 0; ri < renamed.length; ri++) {
                            c = self._renameInBudget(rec, { id: renamed[ri].id, oldName: renamed[ri].oldName, newName: renamed[ri].newName });
                            cnt += c.crew + c.pos + c.floats;
                            out.left += c.left;
                        }
                        after = JSON.stringify(rec);
                        if (after === before) return null;
                        saveAt = new Date().toISOString();
                        rec.updated_at = saveAt;
                        return storage.save(key, rec).then(function () {
                            return storage.load(key);
                        }).then(function (check) {
                            if (!check || check.updated_at !== saveAt) throw new Error('not confirmed');
                            extra.otherBudgets.push({ key: key, name: name, before: before, savedAt: saveAt });
                            out.changed.push({ name: name, lines: cnt });
                            try { if (window.mBTSync && window.mBTSync.scheduleAutoSync) window.mBTSync.scheduleAutoSync(); } catch (eSy) { /* cloud sync is best effort */ }
                        });
                    }).catch(function () {
                        out.failed.push(name);
                        if (!before) return null;
                        return Promise.resolve().then(function () { return storage.save(key, JSON.parse(before)); }).catch(function () { /* the message tells the user to check it */ });
                    });
                });
            });
            return chain;
        }).catch(function () {
            out.failed.push('the list of saved budgets');
        }).then(function () { return out; });
    },

    /* Put other saved budgets back the way they were before the last batch. A
       budget is only touched if nobody has saved it since the Assistant did, and
       not while it is the open budget (the screen would overwrite it).
       Resolves to { restored: [names], kept: [names] }. */
    _undoOtherBudgets: function (list) {
        var restored = [], kept = [], chain = Promise.resolve();
        var storage = window.mBTBudgetStorage;
        var open = window.budget ? window.budget.projectName : '';
        if (!list || !list.length) return Promise.resolve({ restored: restored, kept: kept });
        if (!storage || typeof storage.load !== 'function' || typeof storage.save !== 'function') {
            return Promise.resolve({ restored: [], kept: list.map(function (b) { return b.name; }) });
        }
        list.slice().reverse().forEach(function (b) {
            chain = chain.then(function () {
                if (b.name === open) { kept.push(b.name); return null; }
                return storage.load(b.key).then(function (cur) {
                    if (!cur || cur.updated_at !== b.savedAt) { kept.push(b.name); return null; }
                    return storage.save(b.key, JSON.parse(b.before)).then(function () { restored.push(b.name); });
                });
            }).catch(function () { kept.push(b.name); });
        });
        return chain.then(function () { return { restored: restored, kept: kept }; });
    },

    /* The Contacts tool's own Edit calls this after it has saved the contact
       under its new name. It makes the same change the Assistant's
       rename_contact makes: the open budget, and every other saved budget on
       this device that is not shared. A shared budget is only reported. One
       undo, kept apart from the Assistant's, puts all of it back.
       ent: { id, oldName, newName }. Undo puts back the old name only, not the other details of the edit.
       Never rejects; resolves to { title, lines: [sentences], undo: true or false }. */
    renameFromContacts: function (ent) {
        var self = this, budget = window.budget, mBTLE = window.mBTLE;
        var rn, extra = { otherBudgets: [] }, backup = null, counts = null, changed = false, rec = null, verify = { ok: true }, mine = null;
        function plural(k, one, many) { return k + ' ' + (k === 1 ? one : many); }
        function stop(title, text) { return { title: title, lines: [text], undo: false }; }
        if (!ent || !ent.id || !self._contactKey(ent.oldName) || !self._contactKey(ent.newName) || String(ent.oldName) === String(ent.newName)) {
            return Promise.resolve(stop('Not changed', 'There was no new name to carry into the budgets.'));
        }
        rn = { id: ent.id, oldName: String(ent.oldName), newName: String(ent.newName) };
        if (typeof window.mBTFetchMergedContactRoster !== 'function') {
            return Promise.resolve(stop('Contact saved', 'Budget lines were not changed because Contacts could not be read to check the name.'));
        }
        return Promise.resolve(window.mBTFetchMergedContactRoster()).then(function (r) { return r || []; }, function () { return null; }).then(function (roster) {
            var i, k;
            if (!roster) return stop('Contact saved', 'Budget lines were not changed because Contacts could not be read to check the name.');
            for (i = 0; i < roster.length; i++) { if (roster[i] && roster[i].id === rn.id) { mine = roster[i]; break; } }
            if (!mine) return stop('Contact saved', 'Budget lines were not changed because the saved contact could not be found in Contacts.');
            for (i = 0; i < roster.length; i++) {
                if (!roster[i] || roster[i].id === rn.id) continue;
                k = self._contactKey(roster[i].name);
                if (k === self._contactKey(rn.newName)) return stop('Contact saved', 'Budget lines were not changed because another contact is already named "' + rn.newName + '". Change the lines by hand, or give one of the two contacts another name.');
                if (k === self._contactKey(rn.oldName)) return stop('Contact saved', 'Budget lines were not changed because another contact is also named "' + rn.oldName + '", so the lines cannot be told apart. Change the lines by hand.');
            }
            var open = !!(budget && budget.sections && typeof budget.sections === 'object');
            if (open) {
                try { backup = self._backupJson(budget); } catch (eB) { backup = null; }
                if (!backup) return stop('Contact saved', 'Budget lines were not changed because a safe undo record could not be made.');
                try {
                    counts = self._renameInBudget(budget, rn);
                    changed = self._backupJson(budget) !== backup;
                    if (changed && mBTLE && typeof mBTLE.reconcile === 'function') mBTLE.reconcile();
                } catch (eRen) {
                    try { self._restoreRoots(budget, backup); if (mBTLE && typeof mBTLE.reconcile === 'function') mBTLE.reconcile(); } catch (eBack) { /* the message says what state it is in */ }
                    try { if (typeof window.render === 'function') window.render(); } catch (eR) { /* screen refresh is best effort */ }
                    return stop('Contact saved', 'The budget lines could not be changed (' + ((eRen && eRen.message) || 'something went wrong') + '), so the budget was put back as it was. Change the lines by hand.');
                }
            }
            return Promise.resolve(changed && typeof window.saveBudget === 'function' ? window.saveBudget() : null).then(function () {
                return changed ? self._verifySaved(budget) : { ok: true };
            }).then(function (v) {
                verify = v;
                if (changed) { try { rec = mBTBudgetSafety.capture(JSON.parse(backup), budget, self._UNDO_ROOTS); } catch (eCap) { rec = null; } }
                return self._renameInOtherBudgets([rn], extra);
            }).then(function (ob) {
                var lines = [], title = 'Renamed';
                window.__mbtCrewRosterCache = null;
                if (changed || ob.changed.length) {
                    window._mbtContactRenameUndo = {
                        projectName: open ? budget.projectName : '',
                        record: rec ? JSON.stringify(rec) : null,
                        change: { id: rn.id, name: rn.oldName, created: false, before: (function () { var b = JSON.parse(JSON.stringify(mine)); b.name = rn.oldName; return b; })(), savedAt: mine.updated_at || null },
                        otherBudgets: extra.otherBudgets
                    };
                } else {
                    window._mbtContactRenameUndo = null;
                }
                if (changed) {
                    if (typeof window.updateAllHeaders === 'function') window.updateAllHeaders();
                    if (typeof window.forceSectionRebuild === 'function') window.forceSectionRebuild();
                    if (typeof window.render === 'function') window.render();
                    if (window.mBT && window.mBT.features && window.mBT.features.funding && typeof window.mBT.features.funding.updateCard === 'function') {
                        try { window.mBT.features.funding.updateCard(); } catch (eFund) { /* card not on screen */ }
                    }
                }
                if (open) {
                    lines.push('Renamed "' + rn.oldName + '" to "' + rn.newName + '" in Contacts. In this budget: ' + plural(counts.crew, 'crew line', 'crew lines') + ', ' + plural(counts.pos, 'purchase order', 'purchase orders') + ', ' + plural(counts.floats, 'petty cash float', 'petty cash floats') + ' updated; the ledger follows them.');
                    if (counts.left) lines.push(plural(counts.left, 'linked line shows', 'linked lines show') + ' a different label and ' + (counts.left === 1 ? 'was' : 'were') + ' left alone.');
                } else {
                    lines.push('Renamed "' + rn.oldName + '" to "' + rn.newName + '" in Contacts. No budget is open.');
                }
                if (ob.changed.length) lines.push('Other saved budgets updated: ' + ob.changed.map(function (b) { return b.name + ' (' + b.lines + (b.lines === 1 ? ' line' : ' lines') + ')'; }).join(', ') + '.');
                else if (!ob.skipped.length && !ob.failed.length) lines.push('No other saved budget shows this contact.');
                if (ob.left) lines.push(plural(ob.left, 'linked line in another budget shows', 'linked lines in other budgets show') + ' a different label and ' + (ob.left === 1 ? 'was' : 'were') + ' left alone.');
                if (ob.skipped.length) lines.push('Shared budgets not changed: ' + ob.skipped.join(', ') + '. Open each shared budget and ask the Assistant to rename "' + rn.oldName + '" to "' + rn.newName + '" there.');
                if (ob.failed.length) { lines.push('Could not update: ' + ob.failed.join(', ') + '. Check ' + (ob.failed.length === 1 ? 'it' : 'them') + ', or open each and ask the Assistant to rename the contact there.'); title = 'Partly renamed'; }
                if (!verify.ok) { lines.push('The change shows on screen, but the saved copy could not be confirmed (' + verify.why + '). Save again before closing the app.'); title = 'Renamed, not confirmed saved'; }
                if (window._mbtContactRenameUndo) lines.push('Undo puts back the old name here and in the budgets.');
                return { title: title, lines: lines, undo: !!window._mbtContactRenameUndo };
            });
        }).catch(function (err) {
            return stop('Contact saved', 'The budget lines could not be checked (' + ((err && err.message) || 'something went wrong') + '). Change them by hand.');
        });
    },

    /* Undo the last rename made from the Contacts tool: the open budget, the
       other saved budgets and the contact. Each part is only touched if nobody
       has changed it since. Resolves to { ok, text }. */
    undoContactRename: function () {
        var self = this, u = window._mbtContactRenameUndo, budget = window.budget, mBTLE = window.mBTLE;
        var notes = [], gotContacts = null;
        if (!u) return Promise.resolve({ ok: false, text: 'There is no contact rename to undo.' });
        if (u.projectName && (!budget || budget.projectName !== u.projectName)) {
            return Promise.resolve({ ok: false, text: 'Undo belongs to the budget "' + u.projectName + '". Open that budget first.' });
        }
        if (u.record) {
            var res = mBTBudgetSafety.restore(JSON.parse(u.record), budget);
            if (!res.ok) return Promise.resolve({ ok: false, text: res.message });
            try { if (mBTLE && typeof mBTLE.reconcile === 'function') mBTLE.reconcile(); } catch (eRec) { /* the screen refresh below shows the result */ }
        }
        return Promise.resolve(u.record && typeof window.saveBudget === 'function' ? window.saveBudget() : null).then(function () {
            return self._undoContacts([u.change]);
        }).then(function (cres) {
            gotContacts = cres;
            return self._undoOtherBudgets(u.otherBudgets);
        }).then(function (ores) {
            window._mbtContactRenameUndo = null;
            window.__mbtCrewRosterCache = null;
            if (typeof window.updateAllHeaders === 'function') window.updateAllHeaders();
            if (typeof window.forceSectionRebuild === 'function') window.forceSectionRebuild();
            if (typeof window.render === 'function') window.render();
            if (window.mBT && window.mBT.features && window.mBT.features.funding && typeof window.mBT.features.funding.updateCard === 'function') {
                try { window.mBT.features.funding.updateCard(); } catch (eFund) { /* card not on screen */ }
            }
            if (gotContacts.restored.length) notes.push(u.change && u.change.rateBack ? 'The contact has its old name and rate again.' : 'The contact has its old name again.');
            if (gotContacts.kept.length) notes.push('The contact was left as it is because it was changed or removed since.');
            if (ores.restored.length) notes.push('Other budgets put back: ' + ores.restored.join(', ') + '.');
            if (ores.kept.length) notes.push('Other budgets left as they are because they were changed since or are open now: ' + ores.kept.join(', ') + '.');
            return { ok: true, text: 'The rename was reversed' + (u.record ? ' in this budget.' : '.') + (notes.length ? ' ' + notes.join(' ') : '') };
        }).catch(function (err) {
            return { ok: false, text: (err && err.message) ? err.message : 'Undo could not finish.' };
        });
    },

    /* The Contacts tool's Edit calls this once per save, after the contact is saved.
       ent: { rename: { id, oldName, newName } or null,
              rate: { contactId, name, rate, currency, userPrice, userPriceId, userPriceAt, userPriceUserId } or null }.
       rename is sent only when the name changed, rate only when the user changed the rate
       field in this edit, so a rename or a phone edit never touches the rates on budget lines.
       The rename runs first; the rate follows. Undo (undoContactEdit) reverses them in the
       opposite order. Never rejects; resolves to { title, lines: [sentences], undo } or null. */
    contactEdit: function (ent) {
        var self = this, first;
        window._mbtContactRateUndo = null;
        window._mbtContactRenameUndo = null;   /* each edit has its own Undo; an older one is never carried along */
        /* The contact as it was before this edit saved it, with the updated_at the save gave it. Undo writes
           this copy back, so the contact's own rate returns with the rest (only if nobody saved it since). */
        function contactBack() {
            if (!ent || !ent.rate || !ent.before || !ent.before.id || typeof window.mBTFetchMergedContactRoster !== 'function') return Promise.resolve(null);
            return Promise.resolve(window.mBTFetchMergedContactRoster()).then(function (roster) {
                var i, cur = null;
                for (i = 0; i < (roster || []).length; i++) { if (roster[i] && roster[i].id === ent.before.id) { cur = roster[i]; break; } }
                if (!cur || !cur.updated_at) return null;
                return { id: ent.before.id, name: ent.before.name, created: false, before: JSON.parse(JSON.stringify(ent.before)), savedAt: cur.updated_at, rateBack: true };
            }, function () { return null; });
        }
        return contactBack().then(function (back) {
            first = (ent && ent.rename) ? self.renameFromContacts(ent.rename) : Promise.resolve(null);
            return first.then(function (r) {
                if (!ent || !ent.rate) return r;
                return self._applyContactRate(ent.rate).then(function (rr) {
                    var out = r ? { title: r.title, lines: r.lines.concat(rr.lines), undo: !!(r.undo || rr.undo) } : rr;
                    if (back) {
                        if (window._mbtContactRenameUndo) window._mbtContactRenameUndo.change = back;   /* replaces the post-save copy, which still has the new rate */
                        else if (window._mbtContactRateUndo) window._mbtContactRateUndo.contactChange = back;
                        if (window._mbtContactRenameUndo || window._mbtContactRateUndo) out.lines = out.lines.concat(['Undo puts back the contact\'s old rate as well.']);
                    }
                    return out;
                });
            });
        });
    },

    /* Sets the new rate on the contact's linked lines in the open budget. */
    _applyContactRate: function (rt) {
        var self = this, budget = window.budget, mBTLE = window.mBTLE, router = window.mBTRouter;
        var label = String(rt.rate) + (rt.currency ? ' ' + rt.currency : '');
        var backup = null, res = null, rec = null;
        function plural(k, one, many) { return k + ' ' + (k === 1 ? one : many); }
        function done(title, lines, undo) { return { title: title, lines: lines, undo: !!undo }; }
        function reconcile() { try { if (mBTLE && typeof mBTLE.reconcile === 'function') mBTLE.reconcile(); } catch (eRec) { /* the screen refresh shows the result */ } }
        function repaint() {
            try { if (typeof window.updateAllHeaders === 'function') window.updateAllHeaders(); } catch (eH) { /* best effort */ }
            try { if (typeof window.forceSectionRebuild === 'function') window.forceSectionRebuild(); } catch (eS) { /* best effort */ }
            try { if (window.mBT && window.mBT.ui && typeof window.mBT.ui.paint === 'function') window.mBT.ui.paint(); else if (typeof window.render === 'function') window.render(); } catch (eP) { /* best effort */ }
            if (window.mBT && window.mBT.features && window.mBT.features.funding && typeof window.mBT.features.funding.updateCard === 'function') {
                try { window.mBT.features.funding.updateCard(); } catch (eFund) { /* card not on screen */ }
            }
        }
        if (!budget || !budget.sections || typeof budget.sections !== 'object') {
            return Promise.resolve(done('Contact saved', ['No budget is open, so no budget line got the new rate. The contact keeps it.'], false));
        }
        if (!router || typeof router.applyContactRate !== 'function') {
            return Promise.resolve(done('Contact saved', ['Budget lines did not get the new rate because the rate sync is not available. The contact keeps it.'], false));
        }
        try { backup = self._backupJson(budget); } catch (eB) { backup = null; }
        if (!backup) return Promise.resolve(done('Contact saved', ['Budget lines did not get the new rate because a safe undo record could not be made. The contact keeps it.'], false));
        try {
            res = router.applyContactRate(budget, { contactId: rt.contactId, name: rt.name, rate: rt.rate, userPrice: rt.userPrice, userPriceId: rt.userPriceId, userPriceAt: rt.userPriceAt, userPriceUserId: rt.userPriceUserId });
        } catch (eApply) {
            try { self._restoreRoots(budget, backup); reconcile(); repaint(); } catch (eBack) { /* the message says what state it is in */ }
            return Promise.resolve(done('Contact saved', ['The new rate could not be put on the budget lines (' + ((eApply && eApply.message) || 'something went wrong') + '), so the budget was put back as it was.'], false));
        }
        var changed = self._backupJson(budget) !== backup;
        var keptText = res.kept ? ' ' + plural(res.kept, 'linked line keeps', 'linked lines keep') + ' its own price and was left alone.' : '';
        if (!changed) {
            if (res.set) return Promise.resolve(done('Contact saved', [plural(res.set, 'linked budget line already had', 'linked budget lines already had') + ' the rate ' + label + '. Nothing changed in the budget.' + keptText], false));
            if (res.kept) return Promise.resolve(done('Contact saved', ['No budget line got the new rate.' + keptText], false));
            return Promise.resolve(done('Contact saved', ['No budget line is linked to this contact, so no rate was changed in the budget.'], false));
        }
        reconcile();
        return Promise.resolve(typeof window.saveBudget === 'function' ? window.saveBudget() : null).then(function () {
            return self._verifySaved(budget);
        }).then(function (v) {
            var lines = [];
            try { rec = mBTBudgetSafety.capture(JSON.parse(backup), budget, self._UNDO_ROOTS); } catch (eCap) { rec = null; }
            window._mbtContactRateUndo = rec ? { projectName: budget.projectName, record: JSON.stringify(rec) } : null;
            repaint();
            lines.push(res.set ? 'Rate ' + label + ' set on ' + plural(res.set, 'linked budget line', 'linked budget lines') + ' in this budget.' + keptText : 'Rate ' + label + ' saved on the contact\'s entry in this budget. No crew line is linked to it.' + keptText);
            if (!v.ok) lines.push('The change shows on screen, but the saved copy could not be confirmed (' + v.why + '). Save again before closing the app.');
            if (window._mbtContactRateUndo) lines.push('Undo puts the old rates back on those lines.');
            return done(v.ok ? 'Rate updated in the budget' : 'Rate updated, not confirmed saved', lines, !!window._mbtContactRateUndo);
        }).catch(function (err) {
            return done('Contact saved', ['The new rate was put on the budget lines, but the save could not be checked (' + ((err && err.message) || 'something went wrong') + '). Save again before closing the app.'], false);
        });
    },

    /* Undo for the Contacts tool's Edit: the rates first, then the rename. Each part is only
       touched if nobody changed it since. Resolves to { ok, text }. */
    undoContactEdit: function () {
        var self = this, u = window._mbtContactRateUndo, budget = window.budget, mBTLE = window.mBTLE;
        var rateNote = '', step = Promise.resolve(null);
        if (u) {
            if (u.projectName && (!budget || budget.projectName !== u.projectName)) {
                return Promise.resolve({ ok: false, text: 'Undo belongs to the budget "' + u.projectName + '". Open that budget first.' });
            }
            var res = mBTBudgetSafety.restore(JSON.parse(u.record), budget);
            if (!res.ok) return Promise.resolve({ ok: false, text: res.message });
            try { if (mBTLE && typeof mBTLE.reconcile === 'function') mBTLE.reconcile(); } catch (eRec) { /* the screen refresh shows the result */ }
            rateNote = 'The old rates are back on the budget lines.';
            window._mbtContactRateUndo = null;
            step = Promise.resolve(typeof window.saveBudget === 'function' ? window.saveBudget() : null);
            if (u.contactChange) {
                step = step.then(function () { return self._undoContacts([u.contactChange]); }).then(function (c) {
                    rateNote += c.restored.length ? ' The contact\'s old rate is back as well.' : ' The contact was left as it is because it was changed or removed since.';
                });
            }
        }
        return step.then(function () {
            if (window._mbtContactRenameUndo) {
                return self.undoContactRename().then(function (r) { return { ok: r.ok, text: (rateNote ? rateNote + ' ' : '') + r.text }; });
            }
            if (!u) return { ok: false, text: 'There is nothing to undo.' };
            try { if (typeof window.updateAllHeaders === 'function') window.updateAllHeaders(); } catch (eH) { /* best effort */ }
            try { if (typeof window.forceSectionRebuild === 'function') window.forceSectionRebuild(); } catch (eS) { /* best effort */ }
            try { if (window.mBT && window.mBT.ui && typeof window.mBT.ui.paint === 'function') window.mBT.ui.paint(); else if (typeof window.render === 'function') window.render(); } catch (eP) { /* best effort */ }
            return { ok: true, text: rateNote };
        }).catch(function (err) {
            return { ok: false, text: (err && err.message) ? err.message : 'Undo could not finish.' };
        });
    },

    _renameLine: function (r) {
        function n(k, one, many) { return k + ' ' + (k === 1 ? one : many); }
        var t = 'Renamed contact "' + r.oldName + '" to "' + r.newName + '"' + (r.rosterDone ? ' (it already had the new name in Contacts)' : ' in Contacts') + '. In this budget: ' +
            n(r.crew, 'crew line', 'crew lines') + ', ' + n(r.pos, 'purchase order', 'purchase orders') + ', ' + n(r.floats, 'petty cash float', 'petty cash floats') + ' updated; the ledger follows them.';
        if (r.left) t += ' ' + n(r.left, 'linked line shows', 'linked lines show') + ' a different label and ' + (r.left === 1 ? 'was' : 'were') + ' left alone.';
        return t;
    },

    /* Read the saved record back and compare it with the open budget. */
    _verifySaved: function (budget) {
        var self = this;
        var key = self._prefix() + budget.projectName;
        return Promise.resolve(window.mBTBudgetStorage.load(key)).then(function (stored) {
            if (!stored) return { ok: false, why: 'no saved copy was found' };
            try {
                var live = JSON.parse(JSON.stringify(budget));
                var rec = mBTBudgetSafety.capture(stored, live, self._UNDO_ROOTS);
                return rec.fields.length ? { ok: false, why: rec.fields.length + ' saved field' + (rec.fields.length === 1 ? '' : 's') + ' differ' } : { ok: true };
            } catch (e) { return { ok: false, why: 'the saved copy belongs to a different budget' }; }
        }).catch(function () { return { ok: false, why: 'the saved copy could not be read' }; });
    },

    /* Show or hide the chat's undo button to match whether an undo exists. */
    refreshUndoButton: function () {
        var btn = document.getElementById('aiUndoBtn');
        if (!btn) return;
        if (window._mbtAILastBackup || (window._mbtAILastExtra && window._mbtAILastExtra.dup)) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    },

    /* Roll the budget back to the state before the last applied AI change.
       One step undoes the whole batch. */
    undoLastSuggestion: function () {
        var self = this;
        var mBTME = window.mBTME;
        var extra = window._mbtAILastExtra || {};
        if (!window._mbtAILastBackup && !extra.dup) return mBTME.alert('Undo', 'No AI change to undo.');
        var budget = window.budget;

        function contactNote(res) {
            var t = '';
            if (res && res.restored.length) t += ' Contacts put back: ' + res.restored.join(', ') + '.';
            if (res && res.kept.length) t += ' Contacts left as they are because they were changed or removed since: ' + res.kept.join(', ') + '.';
            return t;
        }

        function otherNote(res) {
            var t = '';
            if (res && res.restored.length) t += ' Other budgets put back: ' + res.restored.join(', ') + '.';
            if (res && res.kept.length) t += ' Other budgets left as they are because they were changed since or are open now: ' + res.kept.join(', ') + '.';
            return t;
        }

        function finish(text) {
            window._mbtAILastBackup = null;
            window._mbtAILastExtra = null;
            if (typeof self.refreshUndoButton === 'function') self.refreshUndoButton();
            if (typeof window.updateAllHeaders === 'function') window.updateAllHeaders();
            if (typeof window.forceSectionRebuild === 'function') window.forceSectionRebuild();
            if (typeof window.render === 'function') window.render();
            if (window.mBT && window.mBT.features && window.mBT.features.funding && typeof window.mBT.features.funding.updateCard === 'function') {
                try { window.mBT.features.funding.updateCard(); } catch (eF) { /* card not on screen */ }
            }
            if (self._chatSession && typeof self._chatRender === 'function') self._chatRender();
            self._tell('Undone', text);
        }

        /* A duplicate is undone by going back to the original. The copy stays in
           the project list, nothing is deleted. */
        if (extra.dup) {
            if (budget.projectName !== extra.dup.copyName) return mBTME.alert('Undo Not Applied', 'Undo belongs to the copy "' + extra.dup.copyName + '". Open that budget first.');
            var dupContacts = null;
            Promise.resolve(window.saveBudget(true)).then(function () {
                return window.loadBudget(extra.dup.originalName);
            }).then(function () {
                return self._undoContacts(extra.contactChanges);
            }).then(function (cres) {
                dupContacts = cres;
                return self._undoOtherBudgets(extra.otherBudgets);
            }).then(function (ores) {
                finish('Back on "' + extra.dup.originalName + '". The copy "' + extra.dup.copyName + '" is still in your project list; remove it from the project menu if you do not want it.' + contactNote(dupContacts) + otherNote(ores));
            }).catch(function () {
                mBTME.alert('Undo Not Applied', 'Could not switch back to "' + extra.dup.originalName + '". Open it from the project list.');
            });
            return;
        }

        var prev = JSON.parse(window._mbtAILastBackup);
        var restored = mBTBudgetSafety.restore(prev, budget);
        if (!restored.ok) return mBTME.alert('Undo Not Applied', restored.message);
        /* Sections are keyed by name; put them back in the order they had. */
        if (extra.sectionOrder && budget.sections) {
            var ordered = {}, oi;
            for (oi = 0; oi < extra.sectionOrder.length; oi++) {
                if (Object.prototype.hasOwnProperty.call(budget.sections, extra.sectionOrder[oi])) ordered[extra.sectionOrder[oi]] = budget.sections[extra.sectionOrder[oi]];
            }
            Object.keys(budget.sections).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(ordered, k)) ordered[k] = budget.sections[k]; });
            budget.sections = ordered;
        }
        var steps = Promise.resolve();
        if (extra.renamedFrom) {
            steps = steps.then(function () { return self._doRename(extra.renamedFrom, {}); });
        }
        var undoneContacts = null;
        steps.then(function () {
            if (extra.currencyBefore && extra.currencyBefore !== window.displayCurrency) self._doCurrency(extra.currencyBefore);
            if (typeof window.saveBudget === 'function') return window.saveBudget();
        }).then(function () {
            return self._undoContacts(extra.contactChanges);
        }).then(function (cres) {
            undoneContacts = cres;
            return self._undoOtherBudgets(extra.otherBudgets);
        }).then(function (ores) {
            if (window.mBTLE && typeof window.mBTLE.reconcile === 'function') window.mBTLE.reconcile();
            finish('The last AI change was reversed.' + (extra.renamedFrom ? ' The budget has its old name again.' : '') + contactNote(undoneContacts) + otherNote(ores));
        }).catch(function (err) {
            mBTME.alert('Undo Not Applied', (err && err.message) ? err.message : 'Undo could not finish.');
        });
    },

    /* Inject budget context into chat prompts (default on). Stored in localStorage. */
    /* Inject budget context into chat prompts (default on). Stored in localStorage. */
    isInjectBudgetContext: function () {
        try {
            var v = localStorage.getItem('mbt_ai_inject_budget_context');
            if (v === '0' || v === 'false') return false;
        } catch (e) {}
        return true;
    },
    setInjectBudgetContext: function (on) {
        try { localStorage.setItem('mbt_ai_inject_budget_context', on ? '1' : '0'); } catch (e) {}
    },

    /* Apply an AI-generated full budget (replaces the active project). Ported from
       EventRouter load-budget so Generate works without the old iframe. */
    applyGeneratedBudget: function (budgetData) {
        var mBTME = window.mBTME;
        var mBT = window.mBT;
        if (!budgetData || !mBT || !mBT.data) {
            if (mBTME) mBTME.alert('Error', 'Budget data or data layer unavailable.');
            return false;
        }
        function sanitizeBudgetNode(node) {
            if (typeof node === 'string') return node.replace(/<[^>]*>/g, '').substring(0, 500);
            if (Array.isArray(node)) {
                var arr = [];
                var ai;
                for (ai = 0; ai < node.length; ai++) arr.push(sanitizeBudgetNode(node[ai]));
                return arr;
            }
            if (node && typeof node === 'object') {
                var c = {};
                var keys = Object.keys(node);
                var ki;
                for (ki = 0; ki < keys.length; ki++) c[keys[ki]] = sanitizeBudgetNode(node[keys[ki]]);
                return c;
            }
            return node;
        }
        var lbSanitized = sanitizeBudgetNode(budgetData);
        if (!lbSanitized.projectName || typeof lbSanitized.sections !== 'object') {
            if (mBTME) mBTME.alert('Invalid Budget', 'The AI returned an incomplete structure. Try again with more detail.');
            return false;
        }
        var sNames = Object.keys(lbSanitized.sections);
        var si;
        for (si = 0; si < sNames.length; si++) {
            var sName = sNames[si];
            var sec = lbSanitized.sections[sName];
            if (!sec.id) sec.id = sName.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
            if (sec.isOpen === undefined) sec.isOpen = true;
            if (!Array.isArray(sec.items)) { sec.items = []; continue; }
            var nextItems = [];
            var ii;
            for (ii = 0; ii < sec.items.length; ii++) {
                var it = sec.items[ii];
                if (!it || typeof it.description !== 'string') continue;
                it.id = it.id || ('item_' + ii + '_' + Math.random().toString(36).substr(2, 4));
                it.quantity = Number(it.quantity) || 1;
                it.rate = Number(it.rate) || 0;
                it.multiplier = Number(it.multiplier) || 1;
                it.actual = Number(it.actual) || 0;
                it.unit = it.unit || 'Flat';
                it.rateType = it.rateType || 'negotiable';
                it.crew = it.crew || {};
                nextItems.push(it);
            }
            sec.items = nextItems;
        }
        lbSanitized.company = lbSanitized.company || 'Independent';
        lbSanitized.startDate = lbSanitized.startDate || new Date().toISOString().split('T')[0];
        lbSanitized.contingencyPercentage = Number(lbSanitized.contingencyPercentage) || 10;
        lbSanitized.salesTaxPercentage = Number(lbSanitized.salesTaxPercentage) || 0;
        lbSanitized.discountPercentage = Number(lbSanitized.discountPercentage) || 0;
        if (Object.prototype.hasOwnProperty.call(lbSanitized, 'productionFeePercentage')) lbSanitized.productionFeePercentage = window.mBT_Finance.normalizeProductionFee(lbSanitized.productionFeePercentage);
        window.mBT_Finance.reconcile(lbSanitized);
        lbSanitized.documents = Array.isArray(lbSanitized.documents) ? lbSanitized.documents : [];
        lbSanitized.attachments = Array.isArray(lbSanitized.attachments) ? lbSanitized.attachments : [];
        lbSanitized.globalItems = Array.isArray(lbSanitized.globalItems) ? lbSanitized.globalItems : [];
        lbSanitized.aiContext = lbSanitized.aiContext || { chat: [], threads: [], analysis: '', activeThreadId: null };
        lbSanitized.activityLog = lbSanitized.activityLog || [];
        var lbBase = lbSanitized.projectName.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'AI Budget';
        lbSanitized.projectName = lbBase + ' ' + new Date().toISOString().split('T')[0];
        if (mBT.data.state && typeof mBT.data.state.wrap === 'function') {
            window.budget = mBT.data.state.wrap(lbSanitized);
        } else {
            window.budget = lbSanitized;
        }
        if (typeof window.currentProjectName !== 'undefined') window.currentProjectName = lbSanitized.projectName;
        if (mBT.data.save) {
            mBT.data.save().then(function () {
                if (mBT.data.load) mBT.data.load(lbSanitized.projectName);
            });
        }
        if (typeof window.saveBudget === 'function') {
            try { window.saveBudget(); } catch (eSave) { /* ignore */ }
        }
        if (typeof window.forceSectionRebuild === 'function') window.forceSectionRebuild();
        if (typeof window.render === 'function') window.render();
        if (mBTME) mBTME.alert('Budget Loaded', '"' + lbSanitized.projectName + '" is now active in the editor.');
        return true;
    },

    /* AI Generate: builds a full budget from a brief + optional type hint. Replaces current budget. */
    generateBudgetFromPrompt: function (userPrompt, templateHint) {
        var self = this;
        var mBTME = window.mBTME;
        var provider = self.getSelectedProvider();
        var apiKey = self.getStoredApiKey(provider);
        userPrompt = String(userPrompt || '').replace(/^\s+|\s+$/g, '');
        if (!userPrompt) {
            if (mBTME) mBTME.alert('Generate', 'Enter a production description first.');
            return Promise.resolve(false);
        }
        if (!apiKey && provider !== 'lmstudio') {
            if (mBTME) mBTME.alert('Assistant Offline', 'Configure an API key in Settings > Connections.');
            return Promise.resolve(false);
        }
        var genCurrency = window.displayCurrency || 'USD';
        var schemaGuide = [
            'Return ONLY a valid JSON object - no markdown fences, no explanation, no comments.',
            'Schema: { "projectName": string, "company": string, "startDate": "YYYY-MM-DD",',
            '"contingencyPercentage": number, "salesTaxPercentage": number, "discountPercentage": number, "productionFeePercentage": number,',
            '"sections": { "Section Name": { "id": "snake_id", "isOpen": true, "items": [',
            '{ "id": "item_001", "description": string, "quantity": number,',
            '"unit": "Day|Week|Flat|Hour", "rate": number, "multiplier": 1, "actual": 0, "rateType": "negotiable" }',
            '] } } }',
            'Rules: plain text strings only (no HTML tags). All "rate" values MUST be in ' + genCurrency +
            '. 3-5 sections, 4-8 items each.',
            'For any role or item that appears on the OPENGATE RATE CARD below, copy its rate exactly, do not estimate it.',
            templateHint ? ('Use a ' + templateHint + ' budget structure.') : ''
        ].join(' ');
        schemaGuide += '\n' + self._PRODUCTION_FEE_RULES;
        var genRateCtx = self._buildRateContext(userPrompt + ' ' + (templateHint || ''));
        if (genRateCtx) {
            schemaGuide += '\n\n' + genRateCtx;
        } else {
            schemaGuide += '\n\nNo local rate card is available. State clearly that rates are estimates in ' + genCurrency + '.';
        }
        if (mBTME && mBTME.showLoader) mBTME.showLoader('Generating budget..');
        return self.callUnifiedAI(provider, apiKey, 'Generate a production budget for: ' + userPrompt, schemaGuide).then(function (result) {
            if (mBTME && mBTME.hideLoader) mBTME.hideLoader();
            if (typeof result === 'string' && result.indexOf('Analysis Failed:') === 0) {
                if (mBTME) mBTME.alert('Generate Failed', result.replace('Analysis Failed: ', '') || 'AI request failed.');
                return false;
            }
            var text = String(result || '').replace(/^[\x60]{3}json\s*/i, '').replace(/^[\x60]{3}\s*/i, '').replace(/\s*[\x60]{3}$/i, '').replace(/^\s+|\s+$/g, '');
            var raw;
            try {
                raw = JSON.parse(text);
            } catch (e) {
                if (mBTME) mBTME.alert('Generate Failed', 'The AI returned invalid JSON. Simplify your prompt and try again.');
                return false;
            }
            return self.applyGeneratedBudget(raw);
        });
    },

    /* ── Budget Analysis ────────────────────────────────────────────────── */
    analyzeCurrentBudget: function () {
        var self     = this;
        var budget   = window.budget;
        var mBTME    = window.mBTME;
        var provider = self.getSelectedProvider();
        var apiKey   = self.getStoredApiKey(provider);

        /* Same shape as openSourcingAnalysis: this reads budget.sections below,
           so with no project loaded it would throw before any AI call. */
        if (!budget) { mBTME.alert('No Project', 'Load a project before running Budget Analysis.'); return; }

        if (!apiKey) return mBTME.alert('Assistant Offline', 'Please configure API Key in settings.');

        var context = {
            project:          budget.projectName,
            total:            budget.grandTotal,
            currency:         window.displayCurrency || '',
            sections:         Object.keys(budget.sections).map(function (k) {
                return { name: k, total: budget.sections[k].total, itemCount: budget.sections[k].items.length };
            }),
            documents:        (budget.documents || []).map(function (d) { return { type: d.type, label: d.label }; }),
            attachments:      (budget.attachments || []).map(function (a) { return a.name; }),
            /* Object.values is ES2017; this tree is ES5. Same count over the
               same items.filter, reached through the section keys instead. */
            crewSummary:      Object.keys(budget.sections).reduce(function (acc, k) {
                var sec = budget.sections[k];
                return acc + sec.items.filter(function (i) { return i.crew && i.crew.name; }).length;
            }, 0) + ' assigned',
            previousAnalysis: ((budget.aiContext && budget.aiContext.analysis) || '').substring(0, 1000)
        };

        var prompt = 'Analyze this budget data: ' + JSON.stringify(context) + '. Review financials, logistics (documents), and staffing. Identify 3 risks and 3 savings opportunities. Be concise.';

        if (mBTME.showLoader) mBTME.showLoader('Assistant Analysis in progress..');
        return self.callUnifiedAI(provider, apiKey, prompt).then(function (result) {
            if (mBTME.hideLoader) mBTME.hideLoader();

            /* callUnifiedAI resolves with an 'Analysis Failed: ...' string rather
               than rejecting. Without this the error text was written into
               budget.aiContext.analysis, saved, shown in a modal titled Budget
               Analysis, and fed back as previousAnalysis on the next run. Same
               check generateBudgetFromPrompt does. */
            if (typeof result === 'string' && result.indexOf('Analysis Failed:') === 0) {
                mBTME.alert('Analysis Failed', result.replace('Analysis Failed: ', '') || 'AI request failed.');
                return;
            }

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
        /* Release the microphone. Closing the panel with dictation running would
           otherwise leave the browser recording with no visible indicator. */
        if (this._voiceSession) {
            try { this._voiceSession.stop(); } catch (eMic) { /* already stopped */ }
            this._voiceSession = null;
        }
        sess.micOn = false;
        sess.inflight = false;
        sess.genId = (sess.genId || 0) + 1;
        if (sess.root && sess.root.parentNode) sess.root.parentNode.removeChild(sess.root);
        if (this._pipResizeHandler) {
            window.removeEventListener('resize', this._pipResizeHandler);
            this._pipResizeHandler = null;
        }
        this._chatSession = null;
        document.body.style.overflow = '';
        /* Leave the shared modal/history stack if registered. */
        if (window.mBTME && typeof window.mBTME.unregisterLayer === 'function') {
            window.mBTME.unregisterLayer('mbtAiChat');
        }
    },

    /* True under the Expanded mobile breakpoint (CSS @media max-width 767px). */
    _isMobileChatLayout: function () {
        try {
            if (window.matchMedia) return window.matchMedia('(max-width: 767px)').matches;
        } catch (eMq) { /* ignore */ }
        return (window.innerWidth || 0) < 768;
    },

    /*
     * Voice input. The engines (browser speech, AI provider, on device model)
     * live in VoiceInput.js; this function only wires one into the chat box.
     * Dictation keeps listening through pauses until the user taps the mic
     * again or presses Enter. Either one stops it and leaves the spoken text in
     * the box, without sending it. Text typed before the mic stays.
     *
     * Words are written straight into the live input element rather than
     * through _chatRender, because a re-render on every syllable would fight
     * the user's own typing and lose the caret.
     */
    _voicePlaceholder: function (state) {
        return state === 'transcribing' ? 'Transcribing..' : 'Listening, Enter or the mic stops';
    },

    _startDictation: function () {
        var self = this;
        var sess = self._chatSession;
        var voice = window.mBTVoice;
        var started;
        var typed;
        if (!sess || sess.micOn) return;
        if (!voice) {
            if (window.mBTME) window.mBTME.alert('Voice Input', 'Voice input did not load, so reload the page or type your request.');
            return;
        }

        /* Text already typed stays; the re-render below would clear the box. */
        typed = document.getElementById('aiChatInput');
        typed = typed ? String(typed.value || '') : '';
        sess.micOn = true;
        sess.micState = 'listening';
        started = voice.start({
            read: function () {
                var el = document.getElementById('aiChatInput');
                return el ? String(el.value || '') : '';
            },
            write: function (text) {
                var el = document.getElementById('aiChatInput');
                if (el) el.value = text;
            },
            notify: function (title, msg) {
                if (window.mBTME) window.mBTME.alert(title, msg);
            },
            state: function (st) {
                var el = document.getElementById('aiChatInput');
                if (self._chatSession) self._chatSession.micState = st;
                if (el) el.placeholder = self._voicePlaceholder(st);
            },
            ended: function () {
                if (self._chatSession && self._chatSession.micOn) self._stopDictation();
            }
        });
        /* An engine that fails at once has already reset the button. */
        if (!sess.micOn) return;
        self._voiceSession = started;
        self._chatRender();
        var focusEl = document.getElementById('aiChatInput');
        if (focusEl) {
            if (!focusEl.value) focusEl.value = typed;
            focusEl.focus();
        }
    },

    _stopDictation: function () {
        var sess = this._chatSession;
        var vs = this._voiceSession;
        this._voiceSession = null;
        if (vs) {
            try { vs.stop(); } catch (eStop) { /* already stopped */ }
        }
        if (!sess) return;
        /* Keep the dictated text across the re-render. */
        var el = document.getElementById('aiChatInput');
        var kept = el ? el.value : '';
        sess.micOn = false;
        if (typeof this._chatRender === 'function') this._chatRender();
        var after = document.getElementById('aiChatInput');
        if (after && kept) {
            after.value = kept;
            after.focus();
        }
    },

    /*
     * Context drawer section collapse state, persisted per section.
     * Defaults: the two bulky sections (context sources, section totals) start
     * closed. Everything else opens. Keeping them all open pushed "At a glance"
     * about 740px down the panel, so the summary was never visible without
     * scrolling, which was the whole complaint.
     */
    _CTX_DEFAULT_CLOSED: { sources: true, sections: true },

    _ctxSectionClosed: function (key) {
        try {
            var v = localStorage.getItem('mbt_ctx_sec_' + key);
            if (v === '0') return false;
            if (v === '1') return true;
        } catch (e) { /* ignore */ }
        return !!this._CTX_DEFAULT_CLOSED[key];
    },

    _ctxToggleSection: function (key) {
        var next = !this._ctxSectionClosed(key);
        try { localStorage.setItem('mbt_ctx_sec_' + key, next ? '1' : '0'); } catch (e) { /* ignore */ }
        /* Toggle the class in place. Calling _chatRender here rebuilt the whole
           panel, which replaced the composer input with a fresh empty node and
           silently threw away anything half typed. Collapsing a drawer section
           must never touch the message the user is writing. */
        var btn = document.querySelector('[data-ctx-key="' + key + '"]');
        var sec = btn ? btn.parentNode : null;
        if (sec && sec.classList) {
            if (next) sec.classList.add('mbt-ctx-closed');
            else sec.classList.remove('mbt-ctx-closed');
            return;
        }
        /* Section not on screen (drawer closed, PiP mode): fall back to a
           re-render so the stored state is still reflected when it reappears. */
        if (typeof this._chatRender === 'function') this._chatRender();
    },

    /* Single writer for drawer prefs. Mobile must never rewrite desktop values. */
    _persistDrawerPref: function (key, open) {
        if (this._isMobileChatLayout()) return;
        try { localStorage.setItem(key, open ? '1' : '0'); } catch (eDr) { /* ignore */ }
    },

    /*
     * Dismiss one assistant surface, top first (matches Escape and Android back):
     * source modal, settings/generate, drawer, pending confirm, then the shell.
     * Returns true if the assistant is still open after the dismiss.
     */
    _dismissChatTopLayer: function () {
        var sess = this._chatSession;
        if (!sess) return false;
        if (sess.sourceModalOpen) {
            sess.sourceModalOpen = false;
            sess.sourceEdit = null;
            if (typeof this._chatRender === 'function') this._chatRender();
            return true;
        }
        if (sess.generateOpen) {
            sess.generateOpen = false;
            if (typeof this._chatRender === 'function') this._chatRender();
            return true;
        }
        if (sess.settingsOpen) {
            sess.settingsOpen = false;
            if (typeof this._chatRender === 'function') this._chatRender();
            return true;
        }
        if (sess.leftOpen || sess.rightOpen) {
            /* Dismiss ONE drawer per press. Mobile only ever has one open. On desktop
               both can be open, and back must not collapse both at once. Right is the
               context drawer and sits above history, so it goes first. */
            if (sess.rightOpen) {
                sess.rightOpen = false;
                this._persistDrawerPref('mbt_chat_drawer_right', false);
            } else {
                sess.leftOpen = false;
                this._persistDrawerPref('mbt_chat_drawer_left', false);
            }
            if (typeof this._chatRender === 'function') this._chatRender();
            return true;
        }
        if (sess.pendingDiff) {
            /* Cancel like the Cancel button: leave budget untouched, stay in chat. */
            sess.pendingDiff = null;
            if (typeof this._chatRender === 'function') this._chatRender();
            return true;
        }
        this.closeChat();
        return false;
    },

    /* ── AI Chat: Expanded + PiP (Build 2) ───────────────────────────────── */
    openChat: function (opts) {
        var self = this;
        var budget = window.budget;
        var mBTME = window.mBTME;
        var mBTAssets = window.mBTAssets || {};
        var persist = self.isPersistentContext();
        opts = opts || {};

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

        function writeDrawer(key, open) {
            try { localStorage.setItem(key, open ? '1' : '0'); } catch (e) {}
        }

        /* Mobile must not rewrite desktop drawer prefs stored in localStorage. */
        function persistDrawer(key, open) {
            if (self._isMobileChatLayout()) return;
            writeDrawer(key, open);
        }

        function isMobileChatLayout() {
            return self._isMobileChatLayout();
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

        /* Header engine picker. Provider ids come from mBTAssistant ENDPOINTS so
           the header can never offer a provider the send path cannot call.
           Models come from the cache the Settings / Connections fetch already
           wrote; the header never fetches. Change is applied on 'change' at the
           root, never on click: bindRootEvents preventDefaults every
           data-chat-act, which would kill a native dropdown. */
        function providerIds() {
            var ma = window.mBTAssistant;
            var ids = [];
            var k;
            if (ma && ma.ENDPOINTS) {
                for (k in ma.ENDPOINTS) {
                    if (Object.prototype.hasOwnProperty.call(ma.ENDPOINTS, k)) ids.push(k);
                }
            }
            if (!ids.length) {
                ids = ['gemini', 'openai', 'deepseek', 'grok', 'anthropic', 'openrouter', 'lmstudio'];
            }
            return ids;
        }

        function providerLabel(p) {
            var ma = window.mBTAssistant;
            if (ma && typeof ma.getProviderLabel === 'function') return ma.getProviderLabel(p);
            return p;
        }

        function cachedChatModels(provider) {
            var list = [];
            try { list = JSON.parse(localStorage.getItem('mbt_cached_chat_models_' + provider) || '[]'); } catch (e) {}
            if (!Array.isArray(list)) list = [];
            return list;
        }

        function providerOptionsHtml(selected) {
            var ids = providerIds();
            var out = '';
            var i, p;
            for (i = 0; i < ids.length; i++) {
                p = ids[i];
                out += '<option value="' + esc(p) + '"' + (p === selected ? ' selected' : '') + '>' + esc(providerLabel(p)) + '</option>';
            }
            return out;
        }

        /* Header selects, provider then model for that provider. If the cache for
           the provider is empty, the stored model is the only option so the pick
           in view still matches what the next turn will call. */
        function engineSelectsHtml(isPip) {
            var provider = self.getSelectedProvider();
            var current = modelName();
            var models = cachedChatModels(provider);
            var cls = isPip
                ? 'max-w-[110px] bg-transparent border-none text-[9px] font-black text-slate-600 outline-none cursor-pointer'
                : 'max-w-[140px] bg-transparent border-none text-[10px] font-black text-slate-600 outline-none cursor-pointer';
            if (!models.length && current) models = [{ id: current, name: current }];
            return '<select id="aiEngineProvider' + (isPip ? 'Pip' : '') + '" data-chat-change="engine-provider" title="AI provider" class="' + cls + '">' +
                    providerOptionsHtml(provider) +
                '</select>' +
                '<select id="aiEngineModel' + (isPip ? 'Pip' : '') + '" data-chat-change="engine-model" title="Chat model" class="' + cls + ' truncate">' +
                    modelOptionsHtml(models, current) +
                '</select>';
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

        /* Resize asset SVGs for the chat header so file/trash/gear/etc share one size.
           Use \\s (not \\s*) before width/height so stroke-width is not torn apart. */
        function iconAtSize(name, sizePx, fallback) {
            var raw = mBTAssets[name] || fallback || '';
            if (!raw) return '';
            var s = String(sizePx);
            var out = String(raw);
            /* Rewrite ONLY the opening <svg> tag. A global strip of width and
               height also tore the attributes off inner <rect> elements, which
               made any rect based icon render as nothing at all: the PiP icon is
               two rects, so its button appeared empty. Match the svg tag, edit
               inside that match, and leave every child element untouched. */
            out = out.replace(/<svg\b[^>]*>/i, function (tag) {
                var t = tag;
                t = t.replace(/\swidth="[^"]*"/gi, '');
                t = t.replace(/\sheight="[^"]*"/gi, '');
                t = t.replace(/\sstroke-width="[^"]*"/gi, '');
                t = t.replace(/\sstyle="[^"]*"/gi, '');
                return t.replace(/^<svg\b/i,
                    '<svg width="' + s + '" height="' + s + '" stroke-width="2.5"' +
                    ' style="display:block;width:' + s + 'px;height:' + s + 'px;"');
            });
            return out;
        }

        function headerIcon(name, fallback, isPip) {
            var sz = isPip ? 16 : 18;
            return '<span class="inline-flex items-center justify-center shrink-0" style="width:' + sz + 'px;height:' + sz + 'px;">' +
                iconAtSize(name, sz, fallback) +
            '</span>';
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
                        if (msg._applied) {
                            actionBtn = '<button type="button" data-chat-act="preview" data-diff-key="' + esc(diffKey) + '" title="Already applied. Preview and apply again." class="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-600 active:scale-95 transition-all">Reapply</button>';
                        } else {
                            actionBtn = '<button type="button" data-chat-act="preview" data-diff-key="' + esc(diffKey) + '" class="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-500 active:scale-95 transition-all">' +
                                (icon('zap', '') || '') + ' Preview &amp; Apply</button>';
                        }
                    }
                }
                if (msg.role === 'assistant') actionBtn += self._assistantNotes(msg.content, diff, !!msg._applied, esc);
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
                (isPip ? '' : (
                    '<button type="button" data-chat-act="open-generate" class="mt-4 px-4 py-2 rounded-xl bg-violet-50 border border-violet-200 text-[9px] font-black uppercase tracking-widest text-violet-700 hover:bg-violet-100">' +
                        'Generate from template (replaces budget)' +
                    '</button>'
                )) +
            '</div>';
        }

        function renderConfirmHtml(changes, isPip) {
            var title = changes.length > 1
                ? ('Preview ' + changes.length + ' changes')
                : 'Preview change';
            var list = [];
            var i, maxShow, more, wi;
            var warnCls = 'mt-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-800';
            var warn = self._previewWarnings(changes, self._chatSession && self._chatSession.pendingDiff ? self._chatSession.pendingDiff.diffKey : '');
            maxShow = isPip ? 10 : 20;
            for (wi = 0; wi < warn.top.length; wi++) list.push('<div data-assistant-warning="1" class="' + warnCls + '">' + esc(warn.top[wi]) + '</div>');
            for (i = 0; i < changes.length && i < maxShow; i++) {
                var deptPick = '';
                if (changes[i].mbt_action === 'add_item' && window.mBTBatch2) {
                    var curDept = mBTBatch2.groups[changes[i].department] ? changes[i].department : mBTBatch2.classify({ description: changes[i].description });
                    deptPick = '<div class="mt-1.5"><select data-chat-change="dept-change" data-idx="' + i + '" aria-label="Department for ' + esc(changes[i].description || 'this line') + '" class="w-full p-1.5 border border-slate-200 rounded-lg text-[10px] font-bold bg-white">' +
                        mBTBatch2.pickerOptions(esc, curDept || false) + '</select></div>';
                }
                list.push(
                    '<div class="' + (isPip ? 'px-2 py-1.5 rounded-lg' : 'px-3.5 py-2.5 rounded-xl') + ' bg-white border border-slate-100 text-[10px] font-bold text-slate-700">' +
                        esc((i + 1) + '. ' + self._describeChange(changes[i])) + deptPick +
                        (warn.per[i] || []).map(function (w) { return '<div data-assistant-warning="1" class="' + warnCls + '">' + esc(w) + '</div>'; }).join('') +
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
            var placeholder = micOn ? self._voicePlaceholder(sess.micState) : 'Ask about rates, logistics, or risks..';
            var phCls = micOn ? 'placeholder:text-rose-400' : 'placeholder:text-slate-300';
            /* Always shown. Where the browser has no speech engine the tap says
               what to do instead of leaving a missing button. */
            var micTitle = micOn ? 'Stop listening' : 'Voice input';
            var micHtml = '<button type="button" data-chat-act="mic" title="' + micTitle + '" class="' + micCls + '">' +
                       micExtra + icon('mic', '') +
                   '</button>';
            var attRow = '';
            var pend = sess.pendingAttachment;
            var extracts = [];
            var ei;
            var ex;
            var chipCls;
            try { extracts = self._ensureChatExtracts(); } catch (eEx) { extracts = []; }
            if (sess.attachBusy) {
                attRow = '<div class="px-1 pb-1.5 text-[9px] font-bold text-slate-400 truncate">Reading ' + esc(sess.attachBusy) + '..</div>';
            } else if (sess.attachError) {
                attRow = '<div class="px-1 pb-1.5 text-[9px] font-bold text-rose-500">' + esc(sess.attachError) + '</div>';
            }
            if (pend && !pend.extractId) {
                attRow += '<div class="px-1 pb-1.5 flex items-center gap-1.5">' +
                    '<span class="inline-flex items-center gap-1 max-w-full px-2 py-1 rounded-lg bg-slate-100 text-[9px] font-bold text-slate-600">' +
                        '<span class="truncate">' + esc(pend.name) + '</span>' +
                        '<button type="button" data-chat-act="attach-clear" title="Remove attachment" class="shrink-0 text-slate-400 hover:text-rose-500">&times;</button>' +
                    '</span>' +
                '</div>';
            }
            if (extracts.length) {
                attRow += '<div class="px-1 pb-1.5 flex flex-wrap gap-1">';
                for (ei = 0; ei < extracts.length; ei++) {
                    ex = extracts[ei];
                    if (!ex || !ex.id) continue;
                    chipCls = ex.loaded
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-500';
                    attRow += '<span class="inline-flex items-center gap-0.5 max-w-full">' +
                        '<button type="button" data-chat-act="toggle-extract" data-extract-id="' + esc(ex.id) + '" title="' + (ex.loaded ? 'Loaded in this chat. Tap to unload.' : 'Sitting ready. Tap to load.') + '" class="inline-flex items-center gap-1 max-w-[180px] px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ' + chipCls + '">' +
                            '<span class="truncate">' + esc(ex.summary || 'Source') + '</span>' +
                        '</button>' +
                        '<button type="button" data-chat-act="delete-extract" data-extract-id="' + esc(ex.id) + '" title="Remove pulled source" class="shrink-0 text-slate-300 hover:text-rose-500 text-[11px] leading-none px-0.5">&times;</button>' +
                    '</span>';
                }
                attRow += '</div>';
            }

            return '<div class="' + (isPip ? 'p-2' : 'p-4') + ' border-t border-slate-100 bg-white shrink-0">' +
                attRow +
                '<div class="flex gap-2">' +
                '<div class="flex-1 min-w-0 flex items-center gap-0.5 ' + (isPip ? 'p-1 pl-1.5 rounded-lg' : 'p-1.5 pl-2 rounded-xl') + ' bg-slate-50">' +
                    '<span class="shrink-0 relative flex items-center justify-center text-slate-400" style="position:relative;width:28px;height:28px;">' +
                        '<input type="file" id="aiChatFileInput" accept="image/*,application/pdf,.pdf,text/*" title="Attach file" style="position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;font-size:16px;cursor:pointer;">' +
                        '<span class="pointer-events-none flex items-center justify-center">' + icon('clip', '') + '</span>' +
                    '</span>' +
                    micHtml +
                    '<input type="text" id="aiChatInput" placeholder="' + esc(placeholder) + '" class="flex-1 min-w-0 p-2 bg-transparent border-none text-[10px] font-bold outline-none ' + phCls + '">' +
                '</div>' +
                sendHtml +
            '</div></div>';
        }

        function renderHeaderHtml(isPip) {
            var undoHidden = window._mbtAILastBackup ? '' : ' hidden';
            /* Uniform hit area and icon size. Gear differs by colour only (slate-600). */
            var hdrBtn = 'p-1.5 rounded';
            var modeBtn = isPip
                ? ('<button type="button" data-chat-act="mode-expand" title="Expand to full window" class="' + hdrBtn + ' text-blue-600 hover:bg-blue-50">' + headerIcon('expandTall', icon('maximize', ''), isPip) + '</button>')
                : ('<button type="button" data-chat-act="mode-pip" title="Shrink to PiP" class="' + hdrBtn + ' text-blue-600 bg-blue-50">' + headerIcon('pip', '', isPip) + '</button>');
            var grip = isPip
                ? ('<span class="text-slate-300 shrink-0" aria-hidden="true">' + headerIcon('drag', '', isPip) + '</span>')
                : '';
            var drawerBtns = isPip ? '' : (
                '<button type="button" data-chat-act="toggle-left" title="History" class="' + hdrBtn + ' mbt-chat-hdr-drawer text-slate-400 hover:text-blue-600 hover:bg-blue-50">' + headerIcon('list', 'H', isPip) + '</button>' +
                '<button type="button" data-chat-act="toggle-right" title="Context" class="' + hdrBtn + ' mbt-chat-hdr-drawer text-slate-400 hover:text-blue-600 hover:bg-blue-50">' + headerIcon('barChart', 'C', isPip) + '</button>'
            );
            return '<div id="aiChatHeader" class="' + (isPip ? 'mbt-chat-pip-grip px-2.5 py-2' : 'px-4 py-3') + ' bg-white border-b border-slate-100 flex items-center gap-1.5 shrink-0">' +
                grip +
                '<h3 class="text-[11px] font-black uppercase tracking-widest text-slate-800">Assistant</h3>' +
                '<span class="w-2 h-2 rounded-full ' + liveDotClass() + ' shrink-0" title="Connection status"></span>' +
                (isPip ? '' : ('<span class="text-slate-400 shrink-0">' + headerIcon('chat', '', isPip) + '</span>' + engineSelectsHtml(isPip))) +
                '<div class="flex-1"></div>' +
                (isPip ? '' : '<span class="text-[8px] font-black uppercase tracking-widest text-slate-400 mr-1 hidden lg:inline">Sees your budget &amp; OpenGate rates</span>') +
                drawerBtns +
                '<button type="button" id="aiUndoBtn" data-chat-act="undo" title="Undo last AI budget change" class="' + hdrBtn + ' text-slate-400 hover:text-amber-600 hover:bg-amber-50' + undoHidden + '">' + headerIcon('undo', '\u21B6', isPip) + '</button>' +
                '<button type="button" data-chat-act="export" title="Export" class="' + hdrBtn + ' text-slate-400 hover:text-blue-600 hover:bg-blue-50">' + headerIcon('file', '', isPip) + '</button>' +
                '<button type="button" data-chat-act="clear" title="Clear" class="' + hdrBtn + ' text-slate-400 hover:text-rose-500 hover:bg-rose-50">' + headerIcon('trash', '', isPip) + '</button>' +
                '<button type="button" data-chat-act="settings" title="Settings" class="' + hdrBtn + ' text-slate-600 hover:text-slate-900 hover:bg-slate-100">' + headerIcon('gear', '', isPip) + '</button>' +
                '<div class="w-px h-4 bg-slate-200 mx-0.5"></div>' +
                modeBtn +
                '<button type="button" data-chat-act="close" title="Close" class="' + hdrBtn + ' text-slate-300 hover:text-slate-600">' + headerIcon('close', 'x', isPip) + '</button>' +
            '</div>';
        }

        function renderEngineLineHtml(isPip) {
            if (!isPip) return '';
            return '<div class="px-2.5 py-1.5 bg-slate-50/70 border-b border-slate-100 flex items-center gap-2 shrink-0">' +
                '<span class="text-slate-400 shrink-0">' + icon('chat', '') + '</span>' +
                engineSelectsHtml(isPip) +
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

        function formatTokens(n) {
            n = parseInt(n, 10) || 0;
            if (n < 1000) return String(n);
            if (n < 10000) return (n / 1000).toFixed(1) + 'k';
            return Math.round(n / 1000) + 'k';
        }

        function ledgerSummary() {
            try {
                if (window.mBTContextLedger && typeof window.mBTContextLedger.summary === 'function') {
                    return window.mBTContextLedger.summary() || {};
                }
            } catch (e) {}
            return { totalTokens: 0, entryCount: 0, byType: {} };
        }

        function userSources() {
            try {
                if (window.mBTAssistant && typeof window.mBTAssistant.getSources === 'function') {
                    return window.mBTAssistant.getSources() || [];
                }
            } catch (e) {}
            return [];
        }

        function renderRightDrawerHtml(rightOpen) {
            var colCls = rightOpen ? 'w-[340px]' : 'mbt-chat-drawer-collapsed w-[36px]';
            var sess = self._chatSession || {};
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
            var srcs = userSources();
            var srcHtml = [];
            var sj, src, prev;
            for (sj = 0; sj < srcs.length; sj++) {
                src = srcs[sj];
                if (!src) continue;
                prev = String(src.text || '').substring(0, 80);
                srcHtml.push(
                    '<div class="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2">' +
                        '<div class="flex items-start gap-2">' +
                            '<button type="button" data-chat-act="edit-source" data-source-id="' + esc(src.id) + '" class="flex-1 min-w-0 text-left">' +
                                '<div class="text-[9px] font-black uppercase tracking-widest text-slate-700 truncate">' + esc(src.title || 'Source') + '</div>' +
                                '<div class="text-[9px] font-bold text-slate-500 mt-0.5 line-clamp-2">' + esc(prev) + (String(src.text || '').length > 80 ? '\u2026' : '') + '</div>' +
                            '</button>' +
                            '<button type="button" data-chat-act="delete-source" data-source-id="' + esc(src.id) + '" title="Remove source" class="shrink-0 p-1 text-slate-300 hover:text-rose-500">' + icon('close', 'x') + '</button>' +
                        '</div>' +
                    '</div>'
                );
            }
            if (!srcHtml.length) {
                srcHtml.push('<p class="text-[9px] font-bold text-slate-400">No custom sources yet. Add a treatment, script or notes.</p>');
            }

            var led = ledgerSummary();
            var tokTotal = led.totalTokens || 0;
            var tokBudget = 100000;
            var tokPct = Math.min(100, (tokTotal / tokBudget) * 100);
            var tokColor = tokPct < 20 ? 'bg-emerald-500' : (tokPct < 50 ? 'bg-amber-400' : 'bg-rose-500');
            var typeKeys = Object.keys(led.byType || {});
            var chipHtml = [];
            var ti, tk, tb;
            var typeLabels = {
                'treatment': 'Treatment',
                'script': 'Script',
                'budget-snapshot': 'Snapshot',
                'template-fill': 'Doc Fills',
                'attachment': 'Attachments',
                'receipt': 'Receipts',
                'source': 'Sources'
            };
            for (ti = 0; ti < typeKeys.length; ti++) {
                tk = typeKeys[ti];
                tb = led.byType[tk] || {};
                chipHtml.push(
                    '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[8px] font-bold text-indigo-700">' +
                        '<strong>' + (tb.count || 0) + '</strong> ' + esc(typeLabels[tk] || tk) +
                        ' <span class="text-indigo-400">(' + formatTokens(tb.tokens) + ')</span>' +
                    '</span>'
                );
            }
            if (!chipHtml.length) {
                chipHtml.push('<span class="text-[8px] font-bold text-slate-400">No indexed artifacts yet.</span>');
            }

            /* One icon row instead of two stacked rows of text buttons. Same four
               actions, a quarter of the vertical space. Labels kept under each
               icon: four unlabelled glyphs is a guessing game. */
            function ctxAction(act, iconName, label, title, tone) {
                return '<button type="button" data-chat-act="' + act + '" title="' + esc(title) + '" ' +
                    'class="flex-1 py-1.5 rounded-lg border border-slate-200 bg-white flex flex-col items-center gap-0.5 ' + tone + ' transition-colors">' +
                        icon(iconName, '') +
                        '<span class="text-[7px] font-black uppercase tracking-widest">' + esc(label) + '</span>' +
                    '</button>';
            }
            var actionRow =
                '<div class="px-3 py-2 border-b border-slate-100 shrink-0 flex gap-1.5">' +
                    ctxAction('ledger-rescan', 'refresh', 'Rescan', 'Rescan artifacts into the context ledger', 'text-slate-600 hover:bg-slate-100') +
                    ctxAction('ledger-purge', 'trash', 'Purge', 'Drop receipts older than 90 days', 'text-slate-600 hover:bg-slate-100') +
                    ctxAction('run-analytics', 'barChart', 'Analytics', 'Analyse the current budget', 'text-indigo-600 hover:bg-indigo-50') +
                    ctxAction('open-generate', 'wand', 'Generate', 'Generate a budget from a template', 'text-violet-600 hover:bg-violet-50') +
                '</div>';

            /* Collapsible section wrapper. Header is the toggle. */
            function ctxSection(key, label, meta, bodyHtml) {
                var closed = self._ctxSectionClosed(key);
                return '<div class="mbt-ctx-sec' + (closed ? ' mbt-ctx-closed' : '') + ' border-b border-slate-100 shrink-0">' +
                        '<button type="button" data-chat-act="ctx-toggle" data-ctx-key="' + esc(key) + '" class="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50">' +
                            '<span class="text-slate-300 mbt-ctx-chev shrink-0">' + icon('chevronDown', 'v') + '</span>' +
                            '<span class="flex-1 text-left text-[8px] font-black uppercase tracking-widest text-slate-400">' + esc(label) + '</span>' +
                            '<span class="text-[8px] font-bold text-slate-400 shrink-0">' + esc(meta) + '</span>' +
                        '</button>' +
                        '<div class="mbt-ctx-sec-body">' + bodyHtml + '</div>' +
                    '</div>';
            }

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
                '<div class="mbt-chat-drawer-body flex-1 min-h-0 flex flex-col overflow-hidden">' +
                    actionRow +
                    '<div class="flex-1 min-h-0 overflow-y-auto no-scrollbar">' +
                    ctxSection('sources', 'Context sources', 'Budget, rates, memory',
                    '<div class="px-4 pb-2">' +
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
                    '</div>') +
                    ctxSection('custom', 'Custom sources', String(srcs.length),
                    '<div class="px-4 pb-3 space-y-2">' +
                        '<div class="space-y-1.5 max-h-28 no-scrollbar overflow-y-auto">' + srcHtml.join('') + '</div>' +
                        '<button type="button" data-chat-act="add-source" class="w-full py-2 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 text-[8px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50">+ Add source</button>' +
                    '</div>') +
                    ctxSection('tokens', 'Token usage', formatTokens(tokTotal),
                    '<div class="px-4 pb-3 space-y-2">' +
                        '<div class="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div class="' + tokColor + ' h-full" style="width:' + tokPct.toFixed(1) + '%"></div></div>' +
                        '<div class="flex flex-wrap gap-1">' + chipHtml.join('') + '</div>' +
                    '</div>') +
                    /* Grand total is never collapsible, it is the one number that
                       must always be on screen. */
                    '<div class="px-4 py-3 border-b border-slate-100 shrink-0">' +
                        '<div class="text-[8px] font-black uppercase tracking-widest text-slate-400">Estimated grand total</div>' +
                        '<div class="text-[18px] font-black tracking-tighter text-slate-900 leading-tight">' + esc(fmtMoney(s.grand)) + '</div>' +
                    '</div>' +
                    ctxSection('sections', 'Sections', String(s.rows.length),
                    '<div class="divide-y divide-slate-50">' + secRows.join('') +
                        '<div class="px-4 py-2 text-[8px] font-bold text-slate-400">Updates as changes apply</div>' +
                    '</div>') +
                    '<div class="px-4 py-3">' +
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

        function voiceNoteText(mode) {
            var v = window.mBTVoice;
            var pi;
            if (!v) return 'Voice input did not load.';
            if (mode === 'provider') {
                pi = v.providerInfo();
                if (!pi.supported) return pi.reason + '.';
                if (!pi.ok) return pi.reason + '.';
                return 'Sends each spoken sentence to ' + pi.label + ' as a short audio clip, ' + pi.price + '. Words appear after each pause.';
            }
            if (mode === 'device') {
                if (v.deviceReady()) return 'Ready. Speech is turned into text on this device and never leaves it. Words appear after each pause.';
                return 'Not downloaded yet. Tap Download voice model (about ' + v.DEVICE_MB + ' MB, once).';
            }
            return 'Uses the speech service built into this browser. If this browser has none, or it stops working, the mic uses the downloaded voice model or your AI provider instead when one is ready.';
        }

        function renderVoiceBoxHtml() {
            var v = window.mBTVoice;
            var mode;
            var ready;
            var provInfo;
            var provLabel;
            if (!v) return '';
            mode = v.getMode();
            ready = v.deviceReady();
            provInfo = v.providerInfo();
            provLabel = provInfo.supported ? 'AI provider (' + provInfo.label + ')' : 'AI provider (not available for ' + provInfo.label + ')';
            return '<div class="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">' +
                '<label class="block text-[8px] font-black uppercase tracking-widest text-slate-400" for="aiVoiceMode">Voice input</label>' +
                '<select id="aiVoiceMode" data-chat-change="voice-mode" class="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100">' +
                    '<option value="browser"' + (mode === 'browser' ? ' selected' : '') + '>Browser speech (default)</option>' +
                    '<option value="provider"' + (mode === 'provider' ? ' selected' : '') + '>' + esc(provLabel) + '</option>' +
                    '<option value="device"' + (mode === 'device' ? ' selected' : '') + '>On this device (' + v.DEVICE_MB + ' MB download)</option>' +
                '</select>' +
                '<p id="aiVoiceNote" class="text-[8px] font-bold text-slate-400">' + esc(voiceNoteText(mode)) + '</p>' +
                '<div class="flex gap-2">' +
                    (ready
                        ? '<button type="button" data-chat-act="voice-remove" class="flex-1 py-2 rounded-lg bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Remove voice model</button>'
                        : '<button type="button" data-chat-act="voice-download" class="flex-1 py-2 rounded-lg bg-white border border-blue-200 text-[9px] font-black uppercase tracking-widest text-blue-700 hover:bg-blue-50">Download voice model</button>') +
                '</div>' +
            '</div>';
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
            var injectOn = self.isInjectBudgetContext();
            var webhook = '';
            try { webhook = localStorage.getItem((window.storageKeyPrefix || '') + 'cloudWebhook') || ''; } catch (e5) {}
            var prefix = window.storageKeyPrefix || '';
            var voiceHtml = renderVoiceBoxHtml();

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
                    '<label class="flex items-center justify-between gap-3 py-2">' +
                        '<span class="text-[10px] font-bold text-slate-700">Inject budget context</span>' +
                        '<input type="checkbox" id="aiChatInjectBudget" ' + (injectOn ? 'checked' : '') + ' class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" title="When off, chat is a bare conversation without the budget snapshot">' +
                    '</label>' +
                    '<p class="text-[8px] font-bold text-slate-400 -mt-2">Default is on. Turn off for a bare conversation with no budget snapshot in the prompt.</p>' +
                    voiceHtml +
                    '<div class="p-3 rounded-xl border border-violet-100 bg-violet-50/40 space-y-2">' +
                        '<div class="text-[9px] font-black uppercase tracking-widest text-violet-700">Actions</div>' +
                        '<button type="button" data-chat-act="run-analytics" class="w-full py-2.5 rounded-lg bg-white border border-indigo-100 text-[9px] font-black uppercase tracking-widest text-indigo-700 hover:bg-indigo-50">Run budget analytics</button>' +
                        '<button type="button" data-chat-act="open-generate" class="w-full py-2.5 rounded-lg bg-white border border-violet-200 text-[9px] font-black uppercase tracking-widest text-violet-700 hover:bg-violet-50">Generate from template (replaces budget)</button>' +
                    '</div>' +
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

        function renderGenerateSheetHtml() {
            return '<div id="aiChatGenerate" class="absolute inset-0 z-20 bg-white flex flex-col">' +
                '<div class="px-4 py-3 border-b border-slate-100 flex items-center gap-2 shrink-0">' +
                    '<h4 class="text-[11px] font-black uppercase tracking-widest text-slate-800">Generate budget</h4>' +
                    '<div class="flex-1"></div>' +
                    '<button type="button" data-chat-act="generate-close" class="p-1.5 text-slate-300 hover:text-slate-600 rounded">' + icon('close', 'x') + '</button>' +
                '</div>' +
                '<div class="flex-1 min-h-0 no-scrollbar overflow-y-auto p-4 space-y-4">' +
                    '<p class="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">This replaces the current budget structure. Confirm before running.</p>' +
                    '<div>' +
                        '<div class="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Quick blueprint (structure only)</div>' +
                        '<div class="flex flex-wrap gap-2 mb-2">' +
                            '<button type="button" data-chat-act="apply-blueprint" data-tmpl="commercial" class="px-3 py-1.5 rounded-full border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-violet-300 hover:text-violet-700">TVC</button>' +
                            '<button type="button" data-chat-act="apply-blueprint" data-tmpl="documentary" class="px-3 py-1.5 rounded-full border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-violet-300 hover:text-violet-700">DOCU</button>' +
                            '<button type="button" data-chat-act="apply-blueprint" data-tmpl="live_stream" class="px-3 py-1.5 rounded-full border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-violet-300 hover:text-violet-700">BCAST</button>' +
                            '<button type="button" data-chat-act="apply-blueprint" data-tmpl="music_video" class="px-3 py-1.5 rounded-full border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-violet-300 hover:text-violet-700">MV</button>' +
                        '</div>' +
                        '<label class="flex items-center gap-2 text-[10px] font-bold text-slate-600">' +
                            '<input type="checkbox" id="aiChatRatesToggle" checked class="w-4 h-4 rounded border-slate-300 text-blue-600">' +
                            'Inject OpenGate rates when applying a blueprint' +
                        '</label>' +
                    '</div>' +
                    '<div class="border-t border-slate-100 pt-4 space-y-3">' +
                        '<div class="text-[8px] font-black uppercase tracking-widest text-slate-400">AI generate full budget</div>' +
                        '<textarea id="aiGenPrompt" rows="4" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-violet-100 resize-none" placeholder="e.g. 3-day TVC shoot in Kingston, $80k budget, 10-person crew.."></textarea>' +
                        '<div>' +
                            '<label class="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Production type</label>' +
                            '<select id="aiGenType" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none">' +
                                '<option value="">Auto-detect from description</option>' +
                                '<option value="Commercial">TVC / Commercial</option>' +
                                '<option value="Documentary">Documentary</option>' +
                                '<option value="Live Stream">Live Broadcast / Stream</option>' +
                                '<option value="Music Video">Music Video</option>' +
                            '</select>' +
                        '</div>' +
                        '<button type="button" data-chat-act="run-generate" class="w-full py-3 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-violet-500">Generate and replace budget</button>' +
                    '</div>' +
                    '<div class="border-t border-slate-100 pt-4 space-y-3">' +
                        '<div class="text-[8px] font-black uppercase tracking-widest text-slate-400">Push funding source</div>' +
                        '<p class="text-[9px] font-bold text-slate-500">Add one funding source to the active budget. Duplicates by name are skipped.</p>' +
                        '<input type="text" id="aiFundName" placeholder="Source name" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none">' +
                        '<div class="flex gap-2">' +
                            '<input type="number" id="aiFundAmount" placeholder="Amount" class="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none">' +
                            '<select id="aiFundStatus" class="w-28 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none">' +
                                '<option value="Pending">Pending</option>' +
                                '<option value="Confirmed">Confirmed</option>' +
                                '<option value="LOI">LOI</option>' +
                            '</select>' +
                        '</div>' +
                        '<button type="button" data-chat-act="push-funding" class="w-full py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-[9px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100">Push to budget</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }

        function renderSourceModalHtml() {
            var sess = self._chatSession || {};
            var edit = sess.sourceEdit || null;
            var isEdit = !!(edit && edit.id);
            var title = isEdit ? (edit.title || '') : '';
            var text = isEdit ? (edit.text || '') : '';
            return '<div id="aiChatSourceModal" class="absolute inset-0 z-30 flex items-center justify-center p-4" style="background:rgba(15,23,42,0.45);">' +
                '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 space-y-3" data-chat-act="source-modal-stop">' +
                    '<div class="flex items-center gap-2">' +
                        '<h4 class="text-[11px] font-black uppercase tracking-widest text-slate-800">' + (isEdit ? 'Edit source' : 'Add source') + '</h4>' +
                        '<div class="flex-1"></div>' +
                        '<button type="button" data-chat-act="source-close" class="p-1.5 text-slate-300 hover:text-slate-600 rounded">' + icon('close', 'x') + '</button>' +
                    '</div>' +
                    '<input type="text" id="aiSourceTitle" value="' + esc(title) + '" placeholder="Title (optional)" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100">' +
                    '<textarea id="aiSourceText" rows="7" placeholder="Paste treatment, script, notes or brief.." class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 resize-none">' + esc(text) + '</textarea>' +
                    '<div class="flex gap-2">' +
                        '<button type="button" data-chat-act="source-close" class="flex-1 py-2.5 rounded-xl bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-600">Cancel</button>' +
                        '<button type="button" data-chat-act="source-save" class="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-500">' + (isEdit ? 'Save changes' : 'Add source') + '</button>' +
                    '</div>' +
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

            var drawerScrim = '';
            if (!isPip && (sess.leftOpen || sess.rightOpen)) {
                /* One scrim; tap closes whichever drawer is open (mobile overlay only). */
                drawerScrim = '<div class="mbt-chat-drawer-scrim" data-chat-act="' +
                    (sess.leftOpen ? 'toggle-left' : 'toggle-right') + '" aria-hidden="true"></div>';
            }

            var panelInner =
                renderHeaderHtml(isPip) +
                renderEngineLineHtml(isPip) +
                (isPip
                    ? ('<div class="relative flex-1 min-h-0 flex flex-col">' + centre + '</div>')
                    : ('<div class="mbt-ai-chat-body flex-1 min-h-0 flex">' +
                        renderLeftDrawerHtml(sess.leftOpen) +
                        '<div class="mbt-ai-chat-main relative flex-1 min-w-0 flex flex-col">' + centre + '</div>' +
                        renderRightDrawerHtml(sess.rightOpen) +
                        drawerScrim +
                      '</div>')) +
                (sess.settingsOpen ? renderSettingsSheetHtml() : '') +
                (sess.generateOpen ? renderGenerateSheetHtml() : '') +
                (sess.sourceModalOpen ? renderSourceModalHtml() : '');

            if (isPip) {
                var geo = pipGeometry(sess.pipPos || readPipPos());
                sess.pipPos = { x: geo.x, y: geo.y };
                return '<div id="mbtAiChatRoot" class="mbt-ai-chat-root mbt-ai-mode-pip" style="position:fixed;inset:0;z-index:980;pointer-events:none;">' +
                    '<div id="mbtAiChatPanel" class="bg-white rounded-xl shadow-2xl ring-1 ring-slate-900/15 flex flex-col overflow-hidden" style="position:fixed;left:' + geo.x + 'px;top:' + geo.y + 'px;width:330px;height:' + geo.h + 'px;max-height:calc(100vh - 28px);pointer-events:auto;z-index:981;">' +
                        panelInner +
                    '</div>' +
                '</div>';
            }

            /* Desktop geometry stays inline; under 768px CSS forces full-bleed overlay drawers. */
            return '<div id="mbtAiChatRoot" class="mbt-ai-chat-root mbt-ai-mode-expanded" style="position:fixed;inset:0;z-index:980;">' +
                '<div class="mbt-ai-chat-backdrop" data-chat-act="backdrop" style="position:absolute;inset:0;background:rgba(15,23,42,0.35);"></div>' +
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

        /* PiP is a floating column: 330px wide, near full height but inset 14px top and bottom. */
        function pipGeometry(rawPos) {
            var inset = 14;
            var w = 330;
            var vw = window.innerWidth || 800;
            var vh = window.innerHeight || 600;
            var minH = 120;
            var maxH = Math.max(minH, vh - inset * 2);
            var raw = rawPos || {};
            var x = typeof raw.x === 'number' ? raw.x : Math.max(inset, vw - w - inset);
            var y = typeof raw.y === 'number' ? raw.y : inset;
            /* Keep top inset. Cap y so a minimum panel still fits above the bottom inset. */
            y = Math.max(inset, Math.min(y, Math.max(inset, vh - minH - inset)));
            /* Height fills down to the bottom inset, never past max working height. */
            var h = Math.max(minH, vh - y - inset);
            if (h > maxH) h = maxH;
            if (y + h > vh - inset) {
                y = Math.max(inset, vh - inset - h);
            }
            x = Math.max(0, Math.min(x, Math.max(0, vw - w)));
            return { x: x, y: y, h: h, w: w };
        }

        function clampPip(x, y) {
            var g = pipGeometry({ x: x, y: y });
            return { x: g.x, y: g.y, h: g.h };
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
                if (typeof c.h === 'number') {
                    panel.style.height = c.h + 'px';
                    panel.style.maxHeight = 'calc(100vh - 28px)';
                }
                sess.pipPos = { x: c.x, y: c.y };
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

            /* Keep inset margins when the viewport is resized. */
            if (self._pipResizeHandler) {
                window.removeEventListener('resize', self._pipResizeHandler);
            }
            self._pipResizeHandler = function () {
                if (!self._chatSession || self._chatSession.mode !== 'pip') return;
                var p = document.getElementById('mbtAiChatPanel');
                if (!p) return;
                var g = pipGeometry(self._chatSession.pipPos || { x: p.offsetLeft, y: p.offsetTop });
                p.style.left = g.x + 'px';
                p.style.top = g.y + 'px';
                p.style.height = g.h + 'px';
                p.style.maxHeight = 'calc(100vh - 28px)';
                self._chatSession.pipPos = { x: g.x, y: g.y };
            };
            window.addEventListener('resize', self._pipResizeHandler);
        }

        function doSend(text, isRetry) {
            var sess = self._chatSession;
            if (!sess || sess.inflight) return;
            text = String(text || '').replace(/^\s+|\s+$/g, '');
            /* An attachment on its own is a valid turn: a photo of a budget with
               no typed question still needs a default ask. */
            var att = sess.pendingAttachment || null;
            /* An unloaded chip contributes nothing, so it cannot carry a bare
               turn on its own. Only a source that will actually be sent counts. */
            if (att && att.extractId && !self._isExtractLoaded(att.extractId)) att = null;
            if (!text && !att) return;
            if (!text && att) text = 'Review this attachment.';

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

            /* Attachment rides the same turn the user just sent. Text extracts go
               inline in the prompt; images go as a vision part when the provider
               layer supports one. */
            var sendAtt = att;
            var skipExtractId = (sendAtt && sendAtt.kind === 'image' && sendAtt.extractId) ? sendAtt.extractId : '';
            if (!isRetry) sess.pendingAttachment = null;
            if (sendAtt && sendAtt.kind === 'text' && sendAtt.text && !sendAtt.extractId) {
                finalPrompt = finalPrompt +
                    '\n\n[Attached file: ' + sendAtt.name +
                    (sendAtt.pages ? ' (' + sendAtt.pages + ' page' + (sendAtt.pages === 1 ? '' : 's') +
                        (sendAtt.truncatedPages ? ', truncated' : '') + ')' : '') +
                    ']\n' + sendAtt.text;
            }

            var chatSystemMsg = self.config.systemContext + '\n\n' + self._buildActionPrompt();
            if (self.isInjectBudgetContext()) {
                var budgetCtx = self._buildBudgetContext();
                var rateCtx = self._buildRateContext(text);
                if (budgetCtx) chatSystemMsg += '\n\n' + budgetCtx;
                if (rateCtx) chatSystemMsg += '\n\n' + rateCtx;
            }
            try {
                if (window.mBTAssistant && typeof window.mBTAssistant.buildSourceContext === 'function') {
                    var srcCtx = window.mBTAssistant.buildSourceContext();
                    if (srcCtx) chatSystemMsg += '\n\n' + srcCtx;
                }
            } catch (eSrc) { /* ignore */ }
            try {
                var pulled = self._loadedExtractContext(skipExtractId);
                if (pulled) chatSystemMsg += '\n\n' + pulled;
            } catch (ePull) { /* ignore */ }
            try {
                if (window.mBTContextLedger && typeof window.mBTContextLedger.asPromptFragment === 'function') {
                    var ledFrag = window.mBTContextLedger.asPromptFragment({ maxTokens: 4000 });
                    if (ledFrag && ledFrag.text) chatSystemMsg += '\n\n' + ledFrag.text;
                }
            } catch (eLed) { /* ignore */ }

            return self.callUnifiedAI(provider, apiKey, finalPrompt, chatSystemMsg, apiHistory,
                (sendAtt && sendAtt.kind === 'image') ? sendAtt : null
            ).then(function (response) {
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
                if (sendAtt && sendAtt.kind === 'image' && sendAtt.extractId) {
                    var _visionExList = self._ensureChatExtracts();
                    var _vexi;
                    for (_vexi = 0; _vexi < _visionExList.length; _vexi++) {
                        if (_visionExList[_vexi] && _visionExList[_vexi].id === sendAtt.extractId) {
                            _visionExList[_vexi].text = String(response).substring(0, 24000);
                            break;
                        }
                    }
                    if (typeof window.saveBudget === 'function') window.saveBudget(true);
                }
                activeChat.push({ role: 'assistant', content: response });
                if (persist && activeThread) {
                    self._touchThread(activeThread);
                    if (typeof window.saveBudget === 'function') window.saveBudget();
                }
                self._chatSession.lastFailedText = '';
                self._chatSession.lastFailedMsg = '';
                self._chatRender();
            }).catch(function (err) {
                /* inflight is cleared inside the handler above, so a throw there
                   (or a rejection callUnifiedAI did not swallow) used to leave it
                   true and doSend would return early on every later message.
                   Reuses the existing failed-send banner, no new modal. */
                if (!self._chatSession || self._chatSession.genId !== myGen) return;
                self._chatSession.inflight = false;
                self._chatSession.lastFailedText = text;
                console.error('mBT chat send failed:', err);
                self._chatSession.lastFailedMsg = self.plainError(err);
                self._chatRender();
            });
        }

        function handleAction(act, el, e) {
            var sess = self._chatSession;
            if (!sess) return;
            var id, thr, changes, ma, p, val, wh, prefix, appliedKey, extractId;

            /* Header engine picker. Applied on change, not on the Settings Save
               button; both writes go down the same path Settings already uses so
               nothing new owns the stored model. */
            if (act === 'voice-mode') {
                if (window.mBTVoice && el) window.mBTVoice.setMode(el.value);
                self._chatRender();
                return;
            }
            if (act === 'voice-download') {
                if (!window.mBTVoice) return;
                el.disabled = true;
                var vNote = document.getElementById('aiVoiceNote');
                if (vNote) vNote.textContent = 'Downloading the voice model, 0%..';
                window.mBTVoice.downloadDevice(function (pct) {
                    var n2 = document.getElementById('aiVoiceNote');
                    if (n2) n2.textContent = 'Downloading the voice model, ' + pct + '%..';
                }).then(function () {
                    if (self._chatSession) self._chatRender();
                }, function () {
                    var n3 = document.getElementById('aiVoiceNote');
                    if (n3) n3.textContent = 'The voice model did not download, so check the internet connection and tap Download voice model again.';
                    el.disabled = false;
                });
                return;
            }
            if (act === 'voice-remove') {
                if (!window.mBTVoice) return;
                window.mBTVoice.removeDevice().then(function () {
                    if (self._chatSession) self._chatRender();
                });
                return;
            }
            if (act === 'engine-provider') {
                val = el && el.value;
                if (!val) return;
                self.saveSelectedProvider(val);
                self._chatRender();
                return;
            }
            if (act === 'engine-model') {
                val = el && el.value;
                if (!val) return;
                p = self.getSelectedProvider();
                ma = window.mBTAssistant;
                /* setChatModel also dual-writes the legacy OpenRouter key. */
                if (ma && typeof ma.setChatModel === 'function') ma.setChatModel(p, val);
                else try { localStorage.setItem('mbt_ai_chat_model_' + p, val); } catch (eEng) {}
                self._chatRender();
                return;
            }

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
                if (sess.leftOpen && isMobileChatLayout()) sess.rightOpen = false;
                persistDrawer('mbt_chat_drawer_left', sess.leftOpen);
                self._chatRender();
                return;
            }
            if (act === 'toggle-right') {
                sess.rightOpen = !sess.rightOpen;
                if (sess.rightOpen && isMobileChatLayout()) sess.leftOpen = false;
                persistDrawer('mbt_chat_drawer_right', sess.rightOpen);
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
                var inj = document.getElementById('aiChatInjectBudget');
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
                if (inj) self.setInjectBudgetContext(!!inj.checked);
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
                    body: JSON.stringify({ test: true, source: 'mooBudgetTool', project: budget.projectName, ts: new Date().toISOString() })
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
                /* Release the mic first (the typed and spoken words stay in the box),
                   so nothing is dictated into the box after it is cleared. */
                if (sess.micOn) self._stopDictation();
                var inp = document.getElementById('aiChatInput');
                /* Spoken words still being turned into text would be left behind. */
                if (window.mBTVoice && window.mBTVoice.pending() > 0) {
                    if (inp) inp.placeholder = 'Transcribing, then press Enter again';
                    return;
                }
                var toSend = inp ? inp.value : '';
                doSend(toSend);
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
                /* Clip is a native file input. Do not open the context drawer. */
                return;
            }
            if (act === 'attach-clear') {
                if (sess.pendingAttachment && sess.pendingAttachment.extractId) {
                    self._deleteChatExtract(sess.pendingAttachment.extractId);
                }
                sess.pendingAttachment = null;
                sess.attachError = '';
                self._chatRender();
                return;
            }
            if (act === 'toggle-extract') {
                extractId = el.getAttribute('data-extract-id') || '';
                if (extractId) self._toggleChatExtract(extractId);
                self._chatRender();
                return;
            }
            if (act === 'delete-extract') {
                extractId = el.getAttribute('data-extract-id') || '';
                if (extractId) {
                    if (sess.pendingAttachment && sess.pendingAttachment.extractId === extractId) {
                        sess.pendingAttachment = null;
                    }
                    self._deleteChatExtract(extractId);
                }
                self._chatRender();
                return;
            }
            if (act === 'mic') {
                if (sess.micOn) self._stopDictation();
                else self._startDictation();
                return;
            }
            if (act === 'preview') {
                var dk = el.getAttribute('data-diff-key');
                var d = window._mbtAIDiffStore && window._mbtAIDiffStore[dk];
                if (d) self.applySuggestion(d, dk);
                return;
            }
            if (act === 'dept-change') {
                if (sess.pendingDiff && sess.pendingDiff.changes) {
                    var changeAt = sess.pendingDiff.changes[parseInt(el.getAttribute('data-idx'), 10)];
                    if (changeAt) {
                        if (el.value) changeAt.department = el.value; else delete changeAt.department;
                        self._chatRender();
                    }
                }
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
                    appliedKey = sess.pendingDiff.diffKey || '';
                    sess.pendingDiff = null;
                    self._commitSuggestion(changes, appliedKey);
                }
                return;
            }
            if (act === 'run-analytics') {
                sess.settingsOpen = false;
                sess.generateOpen = false;
                self.analyzeCurrentBudget();
                return;
            }
            if (act === 'open-generate') {
                sess.generateOpen = true;
                sess.settingsOpen = false;
                self._chatRender();
                return;
            }
            if (act === 'generate-close') {
                sess.generateOpen = false;
                self._chatRender();
                return;
            }
            if (act === 'apply-blueprint') {
                var tmpl = el.getAttribute('data-tmpl') || '';
                if (!tmpl) return;
                if (window.mBT && window.mBT.features && window.mBT.features.blueprints &&
                    typeof window.mBT.features.blueprints.applyFromHub === 'function') {
                    window.mBT.features.blueprints.applyFromHub(tmpl);
                }
                return;
            }
            if (act === 'run-generate') {
                var genPromptEl = document.getElementById('aiGenPrompt');
                var genTypeEl = document.getElementById('aiGenType');
                var gPrompt = genPromptEl ? genPromptEl.value : '';
                var gType = genTypeEl ? genTypeEl.value : '';
                mBTME.confirm(
                    'Replace current budget?',
                    'AI Generate will build a new budget structure and load it as the active project. This replaces the current sections.',
                    function () {
                        self.generateBudgetFromPrompt(gPrompt, gType).then(function (ok) {
                            if (ok && self._chatSession) {
                                self._chatSession.generateOpen = false;
                                if (typeof self._chatRender === 'function') self._chatRender();
                            }
                        });
                    }
                );
                return;
            }
            if (act === 'add-source') {
                sess.sourceEdit = null;
                sess.sourceModalOpen = true;
                self._chatRender();
                return;
            }
            if (act === 'edit-source') {
                id = el.getAttribute('data-source-id');
                var srcs = userSources();
                var found = null;
                var fi;
                for (fi = 0; fi < srcs.length; fi++) {
                    if (srcs[fi] && srcs[fi].id === id) { found = srcs[fi]; break; }
                }
                if (!found) return;
                sess.sourceEdit = { id: found.id, title: found.title || '', text: found.text || '' };
                sess.sourceModalOpen = true;
                self._chatRender();
                return;
            }
            if (act === 'delete-source') {
                id = el.getAttribute('data-source-id');
                if (!id) return;
                mBTME.confirm('Remove source?', 'This source will no longer be sent with chat context.', function () {
                    if (window.mBTAssistant && typeof window.mBTAssistant.removeSource === 'function') {
                        window.mBTAssistant.removeSource(id);
                    }
                    if (self._chatSession && typeof self._chatRender === 'function') self._chatRender();
                });
                return;
            }
            if (act === 'source-close') {
                sess.sourceModalOpen = false;
                sess.sourceEdit = null;
                self._chatRender();
                return;
            }
            if (act === 'source-modal-stop') {
                /* Stop clicks inside the modal card from closing via backdrop. */
                if (e && e.stopPropagation) e.stopPropagation();
                return;
            }
            if (act === 'source-save') {
                var stEl = document.getElementById('aiSourceTitle');
                var sxEl = document.getElementById('aiSourceText');
                var st = stEl ? String(stEl.value || '').replace(/^\s+|\s+$/g, '') : '';
                var sx = sxEl ? String(sxEl.value || '').replace(/^\s+|\s+$/g, '') : '';
                if (!sx) {
                    mBTME.alert('Source', 'Paste or type some content first.');
                    return;
                }
                if (!st) {
                    st = sx.split('\n')[0].replace(/^#+\s*/, '').substring(0, 50) || 'Source';
                }
                if (sess.sourceEdit && sess.sourceEdit.id && window.mBTAssistant && typeof window.mBTAssistant.updateSource === 'function') {
                    window.mBTAssistant.updateSource(sess.sourceEdit.id, st, sx);
                } else if (window.mBTAssistant && typeof window.mBTAssistant.addSource === 'function') {
                    window.mBTAssistant.addSource(st, sx);
                }
                sess.sourceModalOpen = false;
                sess.sourceEdit = null;
                sess.rightOpen = true;
                if (isMobileChatLayout()) sess.leftOpen = false;
                persistDrawer('mbt_chat_drawer_right', true);
                self._chatRender();
                return;
            }
            if (act === 'ledger-rescan') {
                try {
                    if (window.mBTContextLedger && budget && budget.projectName) {
                        window.mBTContextLedger.setActiveProject(budget.projectName).then(function () {
                            return Promise.all([
                                window.mBTContextLedger.ingestBudget(budget),
                                window.mBTContextLedger.ingestSidebar()
                            ]);
                        }).then(function () {
                            if (self._chatSession && typeof self._chatRender === 'function') self._chatRender();
                        }).catch(function () {
                            if (self._chatSession && typeof self._chatRender === 'function') self._chatRender();
                        });
                    }
                } catch (eRs) { /* ignore */ }
                return;
            }
            if (act === 'ctx-toggle') {
                self._ctxToggleSection(el.getAttribute('data-ctx-key') || '');
                return;
            }
            if (act === 'ledger-purge') {
                mBTME.confirm('Purge old receipts?', 'Drop context ledger receipts older than 90 days?', function () {
                    try {
                        if (window.mBTContextLedger && typeof window.mBTContextLedger.purge === 'function') {
                            window.mBTContextLedger.purge(90);
                        }
                    } catch (ePg) { /* ignore */ }
                    if (self._chatSession && typeof self._chatRender === 'function') self._chatRender();
                });
                return;
            }
            if (act === 'push-funding') {
                var fnEl = document.getElementById('aiFundName');
                var faEl = document.getElementById('aiFundAmount');
                var fsEl = document.getElementById('aiFundStatus');
                var fName = fnEl ? String(fnEl.value || '').replace(/^\s+|\s+$/g, '') : '';
                var fAmt = faEl ? (parseFloat(faEl.value) || 0) : 0;
                var fStatus = fsEl ? (fsEl.value || 'Pending') : 'Pending';
                if (!fName) {
                    mBTME.alert('Funding', 'Enter a source name first.');
                    return;
                }
                if (!budget.fundingSources) budget.fundingSources = [];
                var lower = fName.toLowerCase();
                var exists = false;
                var fxi;
                for (fxi = 0; fxi < budget.fundingSources.length; fxi++) {
                    if ((budget.fundingSources[fxi].name || '').toLowerCase() === lower) { exists = true; break; }
                }
                if (exists) {
                    mBTME.alert('Funding', 'A source with that name already exists.');
                    return;
                }
                budget.fundingSources.push({
                    name: fName,
                    amount: fAmt,
                    currency: window.displayCurrency || 'JMD',
                    status: fStatus
                });
                if (typeof window.saveBudget === 'function') window.saveBudget();
                if (window.mBT && window.mBT.features && window.mBT.features.funding && window.mBT.features.funding.updateCard) {
                    window.mBT.features.funding.updateCard();
                }
                if (fnEl) fnEl.value = '';
                if (faEl) faEl.value = '';
                mBTME.alert('Funding', '"' + fName + '" added to the budget.');
                self._chatRender();
                return;
            }
        }

        function bindRootEvents() {
            var root = self._chatSession && self._chatSession.root;
            if (!root) return;

            root.onclick = function (e) {
                var t = e.target;
                /* A file input must keep its own click. preventDefault here is why
                   phone attach did nothing (or fell through to an older drawer path). */
                if (t && t.id === 'aiChatFileInput') return;
                var el = t;
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

            /* Native dropdowns are driven here, not through root.onclick: that
               handler preventDefaults every data-chat-act and would stop the
               select from opening. No preventDefault on change. */
            root.onchange = function (e) {
                var t = e.target;
                if (!t || t.nodeType !== 1) return;
                var cAct = t.getAttribute && t.getAttribute('data-chat-change');
                if (!cAct) return;
                handleAction(cAct, t, e);
            };

            root.onkeydown = function (e) {
                if (e.key === 'Enter' && e.target && e.target.id === 'aiChatInput') {
                    e.preventDefault();
                    if (e.isComposing) return;
                    /* While listening, Enter ends the dictation and keeps the words
                       in the box. The next Enter sends. */
                    if (self._chatSession && self._chatSession.micOn) { self._stopDictation(); return; }
                    handleAction('send', e.target, e);
                }
                if (e.key === 'Escape') {
                    /* Same dismiss order as Android back (top internal layer first). */
                    e.preventDefault();
                    self._dismissChatTopLayer();
                }
            };

            /* Attach a real file to the next turn. Images go as a data URL for a
               vision-capable model; PDFs are text-extracted locally with the
               already-bundled PDF.js; anything else is read as text. Never forces
               the right drawer open (that was the attach/drawer conflict). */
            function ingestChatFile(file, persist) {
                    if (!self._chatSession || !file) return;

                    var MAX_BYTES = 8 * 1024 * 1024;
                    if (file.size > MAX_BYTES) {
                        self._chatSession.attachError = 'That file is too large. Keep attachments under 8MB.';
                        if (typeof self._chatRender === 'function') self._chatRender();
                        return;
                    }

                    var name = file.name || 'Attachment';
                    var type = file.type || '';
                    self._chatSession.attachError = '';
                    self._chatSession.attachBusy = name;
                    if (typeof self._chatRender === 'function') self._chatRender();

                    function done(att) {
                        if (persist) self._rememberChatExtract(att);
                        if (!self._chatSession) return;
                        self._chatSession.attachBusy = '';
                        self._chatSession.pendingAttachment = att;
                        if (typeof self._chatRender === 'function') self._chatRender();
                    }
                    /* Worker is src/lib/pdf.worker.min.js. If it 404s or
                       rejects, say the build cannot read PDFs, not the file. */
                    function failPdf(err) {
                        var m = (err && err.message) || '';
                        if (/worker/i.test(m)) {
                            fail('PDF reading is unavailable in this build. Attach a photo of the page instead.');
                        } else {
                            fail('Could not read that PDF.');
                        }
                    }
                    function fail(msg) {
                        if (!self._chatSession) return;
                        self._chatSession.attachBusy = '';
                        self._chatSession.pendingAttachment = null;
                        self._chatSession.attachError = msg || 'Could not read that file.';
                        if (typeof self._chatRender === 'function') self._chatRender();
                    }

                    if (type.indexOf('image/') === 0) {
                        var imgReader = new FileReader();
                        imgReader.onload = function (ev) {
                            var url = String((ev && ev.target && ev.target.result) || '');
                            if (!url) return fail('Could not read that image.');
                            done({ kind: 'image', name: name, mime: type, dataUrl: url });
                        };
                        imgReader.onerror = function () { fail('Could not read that image.'); };
                        imgReader.readAsDataURL(file);
                        return;
                    }

                    if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
                        if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') {
                            return fail('PDF reading is unavailable.');
                        }
                        var pdfReader = new FileReader();
                        pdfReader.onload = function (ev) {
                            var buf = ev && ev.target && ev.target.result;
                            if (!buf) return fail('Could not read that PDF.');
                            try {
                                if (window.pdfjsLib.GlobalWorkerOptions) {
                                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = './src/lib/pdf.worker.min.js';
                                }
                                window.pdfjsLib.getDocument({
                                    data: new Uint8Array(buf),
                                    isEvalSupported: false
                                }).promise.then(function (pdf) {
                                    var MAX_PAGES = 20;
                                    var total = Math.min(pdf.numPages || 0, MAX_PAGES);
                                    var chain = Promise.resolve('');
                                    var i;
                                    function readPage(n) {
                                        return function (acc) {
                                            return pdf.getPage(n).then(function (page) {
                                                return page.getTextContent();
                                            }).then(function (tc) {
                                                var items = (tc && tc.items) || [];
                                                var line = items.map(function (it) { return (it && it.str) || ''; }).join(' ');
                                                return acc + line + '\n';
                                            });
                                        };
                                    }
                                    for (i = 1; i <= total; i++) chain = chain.then(readPage(i));
                                    return chain.then(function (text) {
                                        text = String(text || '').replace(/[ \t]+/g, ' ').replace(/^\s+|\s+$/g, '');
                                        if (!text) {
                                            return fail('That PDF has no selectable text. Attach a photo of the page instead.');
                                        }
                                        done({
                                            kind: 'text',
                                            name: name,
                                            mime: 'application/pdf',
                                            text: text.substring(0, 24000),
                                            pages: total,
                                            truncatedPages: (pdf.numPages || 0) > MAX_PAGES
                                        });
                                    });
                                }).catch(failPdf);
                            } catch (ePdf) {
                                failPdf(ePdf);
                            }
                        };
                        pdfReader.onerror = function () { fail('Could not read that PDF.'); };
                        pdfReader.readAsArrayBuffer(file);
                        return;
                    }

                    var txtReader = new FileReader();
                    txtReader.onload = function (ev) {
                        var body = String((ev && ev.target && ev.target.result) || '').substring(0, 24000);
                        if (!body) return fail('That file is empty.');
                        done({ kind: 'text', name: name, mime: type || 'text/plain', text: body });
                    };
                    txtReader.onerror = function () { fail('Could not read that file.'); };
                    txtReader.readAsText(file);
            }
            self._ingestChatFile = ingestChatFile;

            var fileIn = document.getElementById('aiChatFileInput');
            if (fileIn) {
                fileIn.onchange = function () {
                    var files = fileIn.files;
                    if (!files || !files.length) return;
                    var file = files[0];
                    fileIn.value = '';
                    ingestChatFile(file, true);
                };
            }

            /* Backdrop click on source modal closes it. */
            var srcModal = document.getElementById('aiChatSourceModal');
            if (srcModal) {
                srcModal.addEventListener('click', function (ev) {
                    if (ev.target === srcModal) {
                        sess.sourceModalOpen = false;
                        sess.sourceEdit = null;
                        self._chatRender();
                    }
                });
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

        function registerChatLayer() {
            if (!window.mBTME || typeof window.mBTME.registerLayer !== 'function') return;
            window.mBTME.registerLayer('mbtAiChat', function () {
                return self._dismissChatTopLayer();
            });
        }

        /* Mount or refresh session */
        if (self._chatSession && self._chatSession.root && document.body.contains(self._chatSession.root)) {
            var ac0 = activeThreadAndChat();
            self._chatSession.activeChat = ac0.chat;
            self._chatSession.activeThread = ac0.thread;
            self._chatSession.persist = persist;
            if (opts.openGenerate) self._chatSession.generateOpen = true;
            if (opts.openSettings) self._chatSession.settingsOpen = true;
            self._chatRender();
            registerChatLayer();
            return;
        }

        var mode = readMode();
        /* Chat always opens with both side drawers closed; stored prefs are kept
           for other uses but never restore an open drawer on mount. */
        var leftOpen = false;
        var rightOpen = false;
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
            settingsOpen: !!opts.openSettings,
            generateOpen: !!opts.openGenerate,
            sourceModalOpen: false,
            sourceEdit: null,
            micOn: false,
            pipPos: readPipPos()
        };
        if (!persist) {
            self._chatSession.sessionOnlyChat = [];
            self._chatSession.activeChat = self._chatSession.sessionOnlyChat;
        }

        self._chatRender();
        registerChatLayer();
    },

    /* ── Persona & Rules Modal (Phase 58.2) ─────────────────────────────── */
    /* ── Phase 144: Sourcing Analysis, AI Interview Wizard ─────────────── */
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
            'FUNDING GAP: ' + (gap > 0 ? gap + ' ' + displayCurrency : 'None, fully covered') + '\n' +
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
            console.error('mBT sourcing analysis failed:', err);
            mBTME.alert('Analysis Failed', self.plainError(err));
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
                '<button onclick="mBTME.close(\'aiToolsModal\'); mBT.features.ai.openChat({ openGenerate: true });" class="col-span-2 p-4 bg-violet-50 border border-violet-200 rounded-2xl flex items-center gap-3 hover:bg-violet-100 transition-all group">' +
                    '<div class="w-10 h-10 bg-white rounded-full shadow-sm flex-shrink-0 flex items-center justify-center text-violet-500 group-hover:scale-110 transition-all">' + (mBTAssets.wand || '') + '</div>' +
                    '<div class="text-left"><h4 class="font-black text-[10px] uppercase tracking-widest text-slate-700">Generate Budget</h4><p class="text-[8px] text-slate-400 font-bold">Describe a production - AI builds the full structure</p></div>' +
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
