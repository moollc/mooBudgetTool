/* mBT Phase 60.A/60.B: AI Module — Neural Link Bridge + Action Triggering
   Extracted from index.html monolith (L2652-3037) to restore structural hygiene.
   Phase 60.B adds: applySuggestion(jsonDiff), action-block parsing, [Preview & Apply] UI.

   Namespace: window.mBTAIModule (aliased to mBT.features.ai at monolith init).
   All closure deps resolved via window.* at call time:
   budget, displayCurrency, storageKeyPrefix, saveBudget, mBTME, mBTAssets,
   openTool, marked, mBTPublisher, mBT, mBTLE are top-level vars in index.html. */

window.mBTAIModule = {

    /* ── Configuration ─────────────────────────────────────────────────── */
    config: {
        geminiModel:      'gemini-2.5-flash',
        openAiModel:      'gpt-4o-mini',
        deepSeekModel:    'deepseek-chat',
        grokModel:        'grok-beta',
        claudeModel:      'claude-sonnet-4-6',
        lmstudioModel:    'local-model',
        lmstudioEndpoint: 'http://localhost:1234/v1/chat/completions',
        systemContext:    'ROLE: Strict Budget Auditor. MO: Brutal efficiency. No intro/outro fluff. No philosophical advice. OUTPUT: Markdown bullet points only. Start immediately with facts. CONTEXT: Film Production, Jamaica 2025 rates.',
        /* Phase 60.B: action-trigger addendum appended to systemContext in chat mode */
        chatActionPrompt: 'ACTION CAPABILITY: When you identify a specific actionable budget change, output a JSON action block immediately before your explanation:\n```json\n{"mbt_action":"update_rate|update_quantity|add_item|update_contingency","section":"Section Name","description":"Item Description","field":"rate","value":0}\n```\nKeep explanations brief.'
    },

    /* ── Storage Accessors ──────────────────────────────────────────────── */
    getStoredApiKey:    function (provider) { return localStorage.getItem((window.storageKeyPrefix || '') + provider + 'ApiKey') || ''; },
    saveStoredApiKey:   function (provider, key) { localStorage.setItem((window.storageKeyPrefix || '') + provider + 'ApiKey', key); },
    getSelectedProvider: function () { return localStorage.getItem((window.storageKeyPrefix || '') + 'selectedAiProvider') || 'gemini'; },
    getSystemPrompt:    function () { return localStorage.getItem((window.storageKeyPrefix || '') + 'aiSystemPrompt') || ''; },
    saveSystemPrompt:   function (val) { localStorage.setItem((window.storageKeyPrefix || '') + 'aiSystemPrompt', val); },

    /* ── Centralized Intelligence Dispatcher ────────────────────────────── */
    callUnifiedAI: async function (provider, apiKey, prompt, customSystemMsg) {
        var self = this;
        var userConstraints = self.getSystemPrompt();
        var baseInstruction = customSystemMsg || self.config.systemContext;
        var systemInstruction = userConstraints ? (baseInstruction + ' USER CONSTRAINTS: ' + userConstraints) : baseInstruction;

        try {
            if (provider === 'gemini') {
                var gUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + self.config.geminiModel + ':generateContent?key=' + apiKey;
                var gRes = await fetch(gUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemInstruction }] } })
                });
                if (!gRes.ok) { var gErr = await gRes.json().catch(function () { return {}; }); throw new Error('Gemini Error ' + gRes.status + ': ' + (gErr.error && gErr.error.message ? gErr.error.message : gRes.statusText)); }
                var gData = await gRes.json();
                return (gData.candidates && gData.candidates[0] && gData.candidates[0].content && gData.candidates[0].content.parts && gData.candidates[0].content.parts[0] && gData.candidates[0].content.parts[0].text) || 'Assistant: No analysis generated.';

            } else if (provider === 'anthropic') {
                var aRes = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                    body: JSON.stringify({ model: self.config.claudeModel, max_tokens: 4096, system: systemInstruction, messages: [{ role: 'user', content: prompt }] })
                });
                if (!aRes.ok) { var aErr = await aRes.json().catch(function () { return {}; }); throw new Error('Anthropic Error ' + aRes.status + ': ' + (aErr.error && aErr.error.message ? aErr.error.message : aRes.statusText)); }
                var aData = await aRes.json();
                return (aData.content && aData.content[0] && aData.content[0].text) || 'Assistant: No analysis generated.';

            } else {
                var oUrl, oModel;
                if (provider === 'openai')        { oUrl = 'https://api.openai.com/v1/chat/completions'; oModel = self.config.openAiModel; }
                else if (provider === 'deepseek') { oUrl = 'https://api.deepseek.com/chat/completions'; oModel = self.config.deepSeekModel; }
                else if (provider === 'grok')     { oUrl = 'https://api.x.ai/v1/chat/completions';      oModel = self.config.grokModel; }
                else if (provider === 'lmstudio') {
                    oUrl   = localStorage.getItem((window.storageKeyPrefix || '') + 'lmstudioEndpoint') || self.config.lmstudioEndpoint;
                    oModel = localStorage.getItem((window.storageKeyPrefix || '') + 'lmstudioModel')    || self.config.lmstudioModel;
                } else { throw new Error('Provider \'' + provider + '\' not supported.'); }

                var oRes = await fetch(oUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
                    body: JSON.stringify({ model: oModel, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }] })
                });
                if (!oRes.ok) { var oErr = await oRes.json().catch(function () { return {}; }); throw new Error(provider.toUpperCase() + ' Error ' + oRes.status + ': ' + (oErr.error && oErr.error.message ? oErr.error.message : oRes.statusText)); }
                var oData = await oRes.json();
                return (oData.choices && oData.choices[0] && oData.choices[0].message && oData.choices[0].message.content) || 'Assistant: No analysis generated.';
            }
        } catch (error) {
            console.error('mBT AI Failure:', error);
            return 'Analysis Failed: ' + error.message;
        }
    },

    /* ── Phase 60.B: Action Block Parser ───────────────────────────────── */
    _parseActionFromResponse: function (text) {
        var match = text.match(/```json\s*(\{[\s\S]*?"mbt_action"[\s\S]*?\})\s*```/);
        if (!match) return null;
        try {
            var obj = JSON.parse(match[1]);
            return (obj && obj.mbt_action) ? obj : null;
        } catch (e) { return null; }
    },

    /* ── Phase 60.B: Apply AI Suggestion ───────────────────────────────── */
    applySuggestion: function (diff) {
        if (!diff || !diff.mbt_action) return;
        var budget = window.budget;
        var mBTME  = window.mBTME;
        var mBTLE  = window.mBTLE;
        if (!budget) return mBTME.alert('Error', 'No budget loaded.');

        /* Build human-readable preview description */
        var desc = '';
        if (diff.mbt_action === 'update_rate') {
            desc = 'Set "' + (diff.description || 'item') + '" rate \u2192 ' + (mBTLE ? mBTLE.format.currency(diff.value) : diff.value);
        } else if (diff.mbt_action === 'update_quantity') {
            desc = 'Set "' + (diff.description || 'item') + '" quantity \u2192 ' + diff.value;
        } else if (diff.mbt_action === 'add_item') {
            desc = 'Add "' + (diff.description || 'item') + '" to section "' + (diff.section || '?') + '"';
        } else if (diff.mbt_action === 'update_contingency') {
            desc = 'Set contingency \u2192 ' + diff.value + '%';
        } else {
            desc = 'Apply: ' + diff.mbt_action;
        }

        mBTME.confirm('Preview Change', desc + '. Apply this change to the budget?', function () {
            var sec;

            if (diff.mbt_action === 'update_rate' || diff.mbt_action === 'update_quantity') {
                sec = budget.sections[diff.section];
                if (!sec) return mBTME.alert('Error', 'Section not found: ' + diff.section);
                var item = null;
                for (var i = 0; i < sec.items.length; i++) {
                    if ((sec.items[i].description || '').toLowerCase() === (diff.description || '').toLowerCase()) { item = sec.items[i]; break; }
                }
                if (!item) return mBTME.alert('Error', 'Item not found: ' + diff.description);
                item[diff.field || (diff.mbt_action === 'update_quantity' ? 'quantity' : 'rate')] = parseFloat(diff.value) || 0;

            } else if (diff.mbt_action === 'add_item') {
                sec = budget.sections[diff.section];
                if (!sec) return mBTME.alert('Error', 'Section not found: ' + diff.section);
                sec.items.push({
                    id: 'item_ai_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    description: diff.description || 'AI Suggestion',
                    quantity: parseFloat(diff.quantity) || 1,
                    rate: parseFloat(diff.rate || diff.value) || 0,
                    unit: diff.unit || 'Flat',
                    multiplier: 1,
                    actual: 0,
                    notes: '',
                    stageData: {}
                });

            } else if (diff.mbt_action === 'update_contingency') {
                budget.contingencyPercentage = parseFloat(diff.value) || budget.contingencyPercentage;
            }

            if (typeof window.saveBudget === 'function') window.saveBudget();
            if (mBTLE && typeof mBTLE.reconcile === 'function') mBTLE.reconcile();
            if (typeof window.render === 'function') window.render();
            mBTME.alert('Applied', 'Budget updated successfully.');
        });
    },

    /* ── Budget Analysis ────────────────────────────────────────────────── */
    analyzeCurrentBudget: async function () {
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

        if (mBTME.showLoader) mBTME.showLoader('Neural Analysis in progress...');
        var result = await self.callUnifiedAI(provider, apiKey, prompt);
        if (mBTME.hideLoader) mBTME.hideLoader();

        if (!budget.aiContext) budget.aiContext = { chat: [], analysis: '' };
        budget.aiContext.analysis = result;
        if (typeof window.saveBudget === 'function') window.saveBudget();

        var formattedResult = (typeof window.marked !== 'undefined') ? window.marked.parse(result) : result;
        mBTME.open('aiAnalysis', 'Budget Analysis',
            '<div class="p-6 text-sm leading-relaxed text-slate-700 max-h-[60vh] overflow-y-auto prose prose-sm prose-slate max-w-none">' + formattedResult + '</div>',
            'max-w-2xl');
    },

    /* ── Context Management ─────────────────────────────────────────────── */
    clearContext: function () {
        var budget = window.budget;
        var mBTME  = window.mBTME;
        mBTME.confirm('Clear Memory', 'Clear AI memory and chat history? This cannot be undone.', function () {
            budget.aiContext = { chat: [], analysis: '' };
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

        if (!budget.aiContext) budget.aiContext = { chat: [], analysis: '' };

        /* Phase 60.B: action diff store — keyed refs prevent JSON injection in onclick attrs */
        window._mbtAIDiffStore = window._mbtAIDiffStore || {};

        var renderMessages = function () {
            return budget.aiContext.chat.map(function (msg) {
                var contentHtml = msg.role === 'assistant'
                    ? (typeof window.marked !== 'undefined' ? window.marked.parse(msg.content) : msg.content)
                    : window.mBT.ui.render.esc(msg.content);

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
                    '<span id="aiMsgCount" class="text-[9px] font-black uppercase tracking-widest text-slate-400">Context: ' + budget.aiContext.chat.length + ' msgs</span>' +
                    '<div class="flex gap-2">' +
                        '<button onclick="mBT.features.ai.exportChat()" title="Export Discussion" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">' + (mBTAssets.file || '') + '</button>' +
                        '<button onclick="mBT.features.ai.clearContext()" title="Clear Memory" class="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">' + (mBTAssets.trash || '') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div id="aiChatHistory" class="flex-grow overflow-y-auto p-4 space-y-2">' +
                    (budget.aiContext.chat.length ? renderMessages() : '<div class="text-center text-slate-400 text-xs mt-10">Start a conversation...</div>') +
                '</div>' +
                '<div class="p-3 bg-white border-t border-slate-100 flex gap-2 shrink-0">' +
                    '<input type="text" id="aiChatInput" class="flex-grow p-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Ask about rates, logistics, or risks..." onkeydown="if(event.key===\'Enter\') document.getElementById(\'aiChatSendBtn\').click()">' +
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
                btn.onclick = async function () {
                    var text = input.value.trim();
                    if (!text) return;

                    budget.aiContext.chat.push({ role: 'user', content: text });
                    if (typeof window.saveBudget === 'function') window.saveBudget();
                    input.value = '';

                    var history = document.getElementById('aiChatHistory');
                    history.innerHTML = renderMessages() + '<div class="ai-message assistant animate-pulse p-3 bg-white border border-slate-100 mr-8 rounded-lg"><div class="text-xs text-slate-400">Analyzing...</div></div>';
                    history.scrollTop = history.scrollHeight;

                    var count = document.getElementById('aiMsgCount');
                    if (count) count.textContent = 'Context: ' + budget.aiContext.chat.length + ' msgs';

                    var provider = self.getSelectedProvider();
                    var apiKey   = self.getStoredApiKey(provider);

                    if (!apiKey) {
                        if (history.lastElementChild) history.lastElementChild.innerHTML = '<div class="text-rose-500 text-xs">Error: API Key missing. Check Settings.</div>';
                        return;
                    }

                    var docList      = (budget.documents || []).map(function (d) { return d.label; }).join(', ');
                    var attachList   = (budget.attachments || []).map(function (a) { return a.name; }).join(', ');
                    var prevAnalysis = ((budget.aiContext && budget.aiContext.analysis) || 'None').substring(0, 500);
                    var contextSummary = '[SYSTEM CONTEXT: Project="' + budget.projectName + '", Total=' + (window.displayCurrency || '') + ' ' + budget.grandTotal + ', Docs=[' + docList + '], Attachments=[' + attachList + '], Last Analysis Summary="' + prevAnalysis + '"]';
                    var finalPrompt    = budget.aiContext.chat.length < 2 ? (contextSummary + ' \n\n User Query: ' + text) : text;

                    /* Phase 60.B: inject action-trigger capability into chat system prompt */
                    var chatSystemMsg = self.config.systemContext + '\n\n' + self.config.chatActionPrompt;
                    var response = await self.callUnifiedAI(provider, apiKey, finalPrompt, chatSystemMsg);

                    budget.aiContext.chat.push({ role: 'assistant', content: response });
                    if (typeof window.saveBudget === 'function') window.saveBudget();
                    history.innerHTML = renderMessages();
                    history.scrollTop = history.scrollHeight;
                    if (count) count.textContent = 'Context: ' + budget.aiContext.chat.length + ' msgs';
                };
                input.focus();
            }
        }, 50);
    },

    /* ── Persona & Rules Modal (Phase 58.2) ─────────────────────────────── */
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
