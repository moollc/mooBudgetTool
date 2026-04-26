/* mBT Phase 60.A/60.B: AI Module — Assistant Bridge + Action Triggering
   Extracted from index.html monolith (L2652-3037) to restore structural hygiene.
   Phase 60.B adds: applySuggestion(jsonDiff), action-block parsing, [Preview & Apply] UI.

   Namespace: window.mBTAIModule (aliased to mBT.features.ai at monolith init).
   All closure deps resolved via window.* at call time:
   budget, displayCurrency, storageKeyPrefix, saveBudget, mBTME, mBTAssets,
   openTool, marked, mBTPublisher, mBT, mBTLE are top-level vars in index.html. */

window.mBTAIModule = {

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
        chatActionPrompt: 'ACTION CAPABILITY: When you identify a specific actionable budget change, output a JSON action block immediately before your explanation:\n\x60\x60\x60json\n{"mbt_action":"update_rate|update_quantity|add_item|update_contingency","section":"Section Name","description":"Item Description","field":"rate","value":0}\n\x60\x60\x60\nKeep explanations brief.'
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

    /* ── Centralized Intelligence Dispatcher ──────────────────────────────
       Phase 173: collapsed to a thin wrapper over mBTAssistant.callChat().
       The legacy (provider, apiKey) args are accepted but ignored — mBTAssistant
       reads them from its own state (which is the SAME localStorage keys, so
       behavior is identical). User constraint injection is preserved. */
    callUnifiedAI: function (provider, apiKey, prompt, customSystemMsg) {
        var self = this;
        var userConstraints = self.getSystemPrompt();
        var baseInstruction = customSystemMsg || self.config.systemContext;
        var systemInstruction = userConstraints ? (baseInstruction + ' USER CONSTRAINTS: ' + userConstraints) : baseInstruction;

        if (window.mBTAssistant && typeof window.mBTAssistant.callChat === 'function') {
            return window.mBTAssistant.callChat({
                userMessage:  prompt,
                systemPrompt: systemInstruction
            }).catch(function (error) {
                console.error('mBT AI Failure:', error);
                return 'Analysis Failed: ' + (error && error.message ? error.message : 'Unknown');
            });
        }

        /* Hard fallback if mBTAssistant ever fails to load — keeps tool from crashing */
        return Promise.reject(new Error('mBTAssistant unavailable — AI service offline.')).catch(function (error) {
            console.error('mBT AI Failure:', error);
            return 'Analysis Failed: ' + error.message;
        });
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

            var formattedResult = (typeof window.marked !== 'undefined') ? window.marked.parse(result) : result;
            mBTME.open('aiAnalysis', 'Budget Analysis',
                '<div class="p-6 text-sm leading-relaxed text-slate-700 max-h-[60vh] overflow-y-auto prose prose-sm prose-slate max-w-none">' + formattedResult + '</div>',
                'max-w-2xl');
        });
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
                    (budget.aiContext.chat.length ? renderMessages() : '<div class="text-center text-slate-400 text-xs mt-10">Start a conversation..</div>') +
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

                    budget.aiContext.chat.push({ role: 'user', content: text });
                    if (typeof window.saveBudget === 'function') window.saveBudget();
                    input.value = '';

                    var history = document.getElementById('aiChatHistory');
                    history.innerHTML = renderMessages() + '<div class="ai-message assistant animate-pulse p-3 bg-white border border-slate-100 mr-8 rounded-lg"><div class="text-xs text-slate-400">Analyzing..</div></div>';
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
                    return self.callUnifiedAI(provider, apiKey, finalPrompt, chatSystemMsg).then(function (response) {
                        budget.aiContext.chat.push({ role: 'assistant', content: response });
                        if (typeof window.saveBudget === 'function') window.saveBudget();
                        history.innerHTML = renderMessages();
                        history.scrollTop = history.scrollHeight;
                        if (count) count.textContent = 'Context: ' + budget.aiContext.chat.length + ' msgs';
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
                    }, '*');
                }
            }, 1500);
        }).catch(function (err) {
            mBTME.alert('Analysis Failed', err.message || 'AI request failed. Check your API key and connection.');
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
                    if (!m.supportedGenerationMethods || m.supportedGenerationMethods.indexOf('generateContent') === -1) continue;
                    var id = (m.name || '').replace('models/', '');
                    if (!id) continue;
                    models.push({ id: id, name: m.displayName || id });
                }
                models.sort(function (a, b) { return (a.id || '').localeCompare(b.id || ''); });
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
                return { id: m.id, name: m.name || m.id, free: promptPrice === 0 };
            });
            models.sort(function (a, b) {
                /* Free models first, then alphabetical by id */
                if (a.free !== b.free) return a.free ? -1 : 1;
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
