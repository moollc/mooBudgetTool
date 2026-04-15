/**
 * © 2026 Jayson Moo-Young <jayson.m.y@gmail.com>
 * Part of the mBT (Moo Budget Tool) Ecosystem.
 * License: MIT
 */

(function (window) {
    'use strict';
    window.mBT_UI_Settings_getTabContent = function (tabName, subTab) {
        subTab = subTab || 'lineItems';
        function esc(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
        if (tabName === 'general') {
            var isDark = localStorage.getItem('mbt_active_theme') === 'dark';
            var _sw = isDark ? 'bg-slate-600' : 'bg-slate-200';
            var _inp = isDark ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-800';
            var _btnBg = isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
            var _btnRose = isDark ? 'bg-rose-900/30 text-rose-400 hover:bg-rose-900/50' : 'bg-rose-50 text-rose-600 hover:bg-rose-100';
            var currentDateFormat = getProjectDateFormat();
            var currentSeparator = getProjectNameSeparator();
            var isCompact = (budget.settings && budget.settings.compactMode) || false;
            var isClassic = (budget.settings && budget.settings.classicTheme) || false;
            var allowZoom = (budget.settings && budget.settings.allowZoom) || false;
            var autoFetchRates = localStorage.getItem(storageKeyPrefix + 'auto_fetch_rates') !== 'false';
            var autoHideNav = localStorage.getItem('mBT_autoHideNav') === 'true';
            var decimalPlaces = (budget.settings && budget.settings.decimalPlaces != null) ? budget.settings.decimalPlaces : 0;

            return `
                    <div class="h-full overflow-y-auto no-scrollbar p-4 space-y-3 animate-in fade-in duration-300">
                        <div class="settings-card flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl shadow border border-slate-100 overflow-hidden bg-[#fdba35] shrink-0">${mBTAssets.appLogo}</div>
                            <div>
                                <h3 class="text-xs font-black uppercase tracking-widest settings-text-primary">moo Budget Tool</h3>
                                <p class="text-[9px] text-slate-400 font-bold">Build v${APP_VERSION} &bull; ${navigator.onLine ? '<span class="text-emerald-500">Online</span>' : '<span class="text-rose-500">Offline</span>'}</p>
                            </div>
                        </div>
                        <div class="settings-card">
                            <div class="grid grid-cols-3 gap-3">
                                <div>
                                    <label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date Format</label>
                                    <select id="dateFormatSelect" onchange="localStorage.setItem('${projectDateFormatKey}', this.value)" class="w-full text-[10px] p-2 ${_inp} border-none rounded-lg font-bold outline-none cursor-pointer">
                                        <option value="YYYYMMDD" ${currentDateFormat === 'YYYYMMDD' ? 'selected' : ''}>YYYY-MM-DD</option>
                                        <option value="MMDDYYYY" ${currentDateFormat === 'MMDDYYYY' ? 'selected' : ''}>MM-DD-YYYY</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Separator</label>
                                    <input type="text" id="separatorInput" maxlength="1" value="${currentSeparator}" onchange="localStorage.setItem('${projectNameSeparatorKey}', this.value)" class="w-full text-[10px] p-2 ${_inp} border-none rounded-lg font-bold text-center outline-none">
                                </div>
                                <div>
                                    <label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Decimals</label>
                                    <select id="decimalPlacesSelect" onchange="if(!budget.settings) budget.settings={}; budget.settings.decimalPlaces=parseInt(this.value); saveBudget(); if(typeof mBTLE!=='undefined') mBTLE.reconcile(); render();" class="w-full text-[10px] p-2 ${_inp} border-none rounded-lg font-bold outline-none cursor-pointer">
                                        <option value="0" ${decimalPlaces === 0 ? 'selected' : ''}>0 — 1,500</option>
                                        <option value="1" ${decimalPlaces === 1 ? 'selected' : ''}>1 — 1,500.0</option>
                                        <option value="2" ${decimalPlaces === 2 ? 'selected' : ''}>2 — 1,500.00</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div class="settings-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Allow Page Zoom</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Enable pinch-to-zoom gestures</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="zoomToggle" ${allowZoom ? 'checked' : ''} onchange="if(!budget.settings) budget.settings={}; budget.settings.allowZoom = this.checked; saveBudget(); mBT.ui.updateViewport();" class="sr-only peer">
                                        <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            </div>
                            <div class="settings-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Display Theme</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Toggle Premium Dark / Classic Light</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="themeToggle" ${localStorage.getItem('mbt_active_theme') === 'dark' ? 'checked' : ''} onchange="mBT.ui.setTheme(this.checked ? 'dark' : 'light');" class="sr-only peer">
                                        <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                    </label>
                                </div>
                            </div>
                            <div class="settings-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Compact View</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Denser layout for small screens</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="compactModeToggle" ${isCompact ? 'checked' : ''} onchange="if(!budget.settings) budget.settings={}; budget.settings.compactMode = this.checked; saveBudget(); render();" class="sr-only peer">
                                        <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                            <div class="settings-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Classic Theme</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Legacy visual style (Pre-v19.54)</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="classicThemeToggle" ${isClassic ? 'checked' : ''} onchange="if(!budget.settings) budget.settings={}; budget.settings.classicTheme = this.checked; saveBudget(); render();" class="sr-only peer">
                                        <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-600"></div>
                                    </label>
                                </div>
                            </div>
                            <div class="settings-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Open Tools In-App</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Stages, Publish etc. open inside main window</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="navPrefToggle" ${JSON.parse(localStorage.getItem('mBT_openToolsInternal') ?? 'true') ? 'checked' : ''} onchange="localStorage.setItem('mBT_openToolsInternal', this.checked);" class="sr-only peer">
                                        <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                </div>
                            </div>
                            <div class="settings-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Auto-Fetch Rates</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Refresh exchange rates on startup</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="autoFetchRatesToggle" ${autoFetchRates ? 'checked' : ''} onchange="localStorage.setItem('${storageKeyPrefix}auto_fetch_rates', this.checked);" class="sr-only peer">
                                        <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                    </label>
                                </div>
                            </div>
                            <div class="settings-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Auto-Hide Nav</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">HUD slides away when idle</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="autoHideNavToggle" ${autoHideNav ? 'checked' : ''} onchange="localStorage.setItem('mBT_autoHideNav', this.checked); if(typeof mBTNavHUD !== 'undefined') mBTNavHUD.apply();" class="sr-only peer">
                                        <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                                    </label>
                                </div>
                            </div>
                            <div class="settings-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Navigation Visibility</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Show/Hide HUD buttons</p>
                                    </div>
                                    <button onclick="mBT.features.settings.openFooterVisModal()" class="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors flex items-center gap-1">${mBTAssets.eye} Manage</button>
                                </div>
                            </div>
                            <div class="settings-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Developer Mode</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Show advanced tools and logs</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" onchange="localStorage.setItem('mBT_devMode', this.checked); location.reload();" ${localStorage.getItem('mBT_devMode') === 'true' ? 'checked' : ''} class="sr-only peer">
                                        <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                                    </label>
                                </div>
                            </div>
                            <div class="settings-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Show Funding Bar</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Display the Secured / Gap funding meter</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" ${(budget.settings && budget.settings.showFundingBar === false) ? '' : 'checked'} onchange="if(!budget.settings) budget.settings={}; budget.settings.showFundingBar = this.checked; saveBudget(); mBT.ui.toolbar.update();" class="sr-only peer">
                                        <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                </div>
                            </div>
                            <div class="settings-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Show Timeline Bar</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Display the Stages sparkline HUD</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" ${(budget.settings && budget.settings.showTimelineBar === false) ? '' : 'checked'} onchange="if(!budget.settings) budget.settings={}; budget.settings.showTimelineBar = this.checked; saveBudget(); mBT.ui.toolbar.update();" class="sr-only peer">
                                        <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                             <a href="https://raw.githubusercontent.com/moollc/mooBudgetTool/refs/heads/main/mBT/index.html" target="_blank" download="moobudget-beta.html" class="flex items-center justify-center gap-2 px-3 py-2 ${_btnBg} rounded-xl font-black text-[9px] uppercase tracking-widest transition-colors">${mBTAssets.cloud} Get Beta</a>
                             <button onclick="hardResetApp()" class="flex items-center justify-center gap-2 px-3 py-2 ${_btnRose} rounded-xl font-black text-[9px] uppercase tracking-widest transition-colors">${mBTAssets.zap} Fix Bugs</button>
                             <button onclick="mBTME.close('settingsModal'); showCoffeeWidget();" class="flex items-center justify-center gap-2 px-3 py-2 bg-[#FFDD00] text-black rounded-xl font-black text-[9px] uppercase tracking-widest hover:opacity-90 transition-opacity">${mBTAssets.coffee} Support</button>
                        </div>
                    </div>`;
        }
        if (tabName === 'ai') {
            var provider = getSelectedProvider();
            var saveHistory = (budget.aiContext && budget.aiContext.saveHistory != null) ? budget.aiContext.saveHistory : true;
            var storedPrompt = mBT.features.ai.getSystemPrompt();
            var keyLinks = {
                'gemini': 'https://aistudio.google.com/app/apikey',
                'openai': 'https://platform.openai.com/api-keys',
                'deepseek': 'https://platform.deepseek.com/api_keys',
                'grok': 'https://console.x.ai/',
                'anthropic': 'https://console.anthropic.com/settings/keys',
                'lmstudio': '#'
            };
            var storedLmEndpoint = localStorage.getItem(storageKeyPrefix + 'lmstudioEndpoint') || 'http://localhost:1234/v1/chat/completions';
            var storedLmModel = localStorage.getItem(storageKeyPrefix + 'lmstudioModel') || 'local-model';

            return `
                    <div class="h-full overflow-y-auto no-scrollbar p-4 space-y-3 animate-in fade-in duration-300">
                        <div class="p-4 bg-slate-900 rounded-2xl border border-black shadow-lg text-white">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-400">Assistant</h3>
                                    <p class="text-[9px] text-slate-500 font-bold mt-0.5">Configure Provider Access</p>
                                </div>
                                <div class="text-slate-700">${mBTAssets.sparkle}</div>
                            </div>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Active Provider</label>
                                    <select id="aiProviderSelect" onchange="
                                        var p=this.value;
                                        var map=${JSON.stringify(keyLinks).replace(/"/g, "'")};
                                        var link=document.getElementById('apiKeyLink');
                                        link.href=map[p]||'#';
                                        link.style.visibility=(p==='lmstudio')?'hidden':'visible';
                                        document.getElementById('apiKeyInput').value=getStoredApiKey(p);
                                        document.getElementById('lmstudioFields').style.display=(p==='lmstudio')?'block':'none';
                                        document.getElementById('apiCredRow').style.display=(p==='lmstudio')?'none':'block';
                                    " class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
                                        <option value="gemini" ${provider === 'gemini' ? 'selected' : ''}>Google Gemini API</option>
                                        <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI API</option>
                                        <option value="deepseek" ${provider === 'deepseek' ? 'selected' : ''}>DeepSeek API</option>
                                        <option value="grok" ${provider === 'grok' ? 'selected' : ''}>Grok (xAI) API</option>
                                        <option value="anthropic" ${provider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude)</option>
                                        <option value="lmstudio" ${provider === 'lmstudio' ? 'selected' : ''}>LM Studio (Local)</option>
                                    </select>
                                </div>
                                <div id="apiCredRow" style="display:${provider === 'lmstudio' ? 'none' : 'block'}">
                                    <div class="flex justify-between items-center mb-1.5">
                                        <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest">API Credentials</label>
                                        <a id="apiKeyLink" href="${keyLinks[provider] || '#'}" target="_blank" class="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 transition-colors">Get API Key <span>&rarr;</span></a>
                                    </div>
                                    <input type="password" id="apiKeyInput" value="${getStoredApiKey(provider)}" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-blue-500" placeholder="sk-...">
                                </div>
                                <div id="lmstudioFields" style="display:${provider === 'lmstudio' ? 'block' : 'none'}">
                                    <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Local Endpoint URL</label>
                                    <input type="text" id="lmEndpointInput" value="${storedLmEndpoint}" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-blue-500 mb-2" placeholder="http://localhost:1234/v1/chat/completions">
                                    <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Model ID</label>
                                    <input type="text" id="lmModelInput" value="${storedLmModel}" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-blue-500" placeholder="local-model">
                                </div>
                                <div>
                                    <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Persona &amp; Constraints</label>
                                    <textarea id="aiSystemPromptInput" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-500 resize-none h-16 placeholder-slate-600" placeholder="e.g. Be sarcastic. Focus only on Below The Line. Use JMD currency symbol.">${storedPrompt}</textarea>
                                </div>
                                <div class="flex items-center gap-3 py-0.5">
                                    <div class="relative flex items-center">
                                        <input type="checkbox" id="aiContextToggle" ${saveHistory ? 'checked' : ''} onchange="if(!budget.aiContext) budget.aiContext={chat:[], analysis:''}; budget.aiContext.saveHistory = this.checked; saveBudget();" class="sr-only peer">
                                        <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                    </div>
                                    <label for="aiContextToggle" class="text-[9px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer select-none">Save Conversation Context</label>
                                </div>
                                <button id="saveApiKeyBtn" onclick="
                                    var p=document.getElementById('aiProviderSelect').value;
                                    var k=document.getElementById('apiKeyInput') ? document.getElementById('apiKeyInput').value : '';
                                    var s=document.getElementById('aiSystemPromptInput').value;
                                    saveStoredApiKey(p,k);
                                    mBT.features.ai.saveSystemPrompt(s);
                                    localStorage.setItem('${storageKeyPrefix}selectedAiProvider', p);
                                    if(p==='lmstudio'){
                                        var ep=document.getElementById('lmEndpointInput').value.trim();
                                        var md=document.getElementById('lmModelInput').value.trim();
                                        if(ep) localStorage.setItem('${storageKeyPrefix}lmstudioEndpoint', ep);
                                        if(md) localStorage.setItem('${storageKeyPrefix}lmstudioModel', md);
                                    }
                                    mBTME.alert('Success', 'Assistant Linked');
                                " class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg hover:bg-blue-500 transition-all mt-1">Synchronize Link</button>
                            </div>
                        </div>
                    </div>`;
        }
        if (tabName === 'connections') {
            var webhookUrl = localStorage.getItem(storageKeyPrefix + 'cloudWebhook') || '';

            return `
                    <div class="h-full overflow-y-auto no-scrollbar p-4 space-y-3 animate-in fade-in duration-300">
                        <div class="p-4 bg-slate-900 rounded-2xl border border-black shadow-lg text-white">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <h3 class="text-[10px] font-black uppercase tracking-widest text-emerald-400">Production Cloud</h3>
                                    <p class="text-[9px] text-slate-500 font-bold mt-0.5">Upstream Data Bridge</p>
                                </div>
                                <div class="text-slate-700">${mBTAssets.cloud}</div>
                            </div>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Webhook Endpoint</label>
                                    <div class="flex gap-2">
                                        <input type="text" id="cloudWebhookInput" value="${esc(webhookUrl)}" onchange="localStorage.setItem('${storageKeyPrefix}cloudWebhook', this.value)" class="flex-1 bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder-slate-600" placeholder="https://api.studio.com/ingest...">
                                        <button onclick="var url=document.getElementById('cloudWebhookInput').value; if(!url) return mBTME.alert('Error', 'No URL'); mBTME.showLoader('Pinging...'); fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({test:true, source:'MooBudget', project:budget.projectName, ts:new Date().toISOString()})}).then(function(r){ mBTME.hideLoader(); if(r.ok) mBTME.alert('Success','Endpoint Reachable'); else mBTME.alert('Error', 'Status: '+r.status); }).catch(function(e){ mBTME.hideLoader(); mBTME.alert('Connection Failed', e.message); })" class="px-3 bg-emerald-900/50 text-emerald-400 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-900 border border-emerald-800 transition-colors">Test</button>
                                    </div>
                                    <p class="text-[8px] text-slate-600 mt-2">Destination for "Cloud Dispatch". Accepts JSON payloads containing Ledger and Budget totals.</p>
                                </div>
                            </div>
                        </div>
                    </div>`;
        }
        if (tabName === 'cloud') {
            var isDark = localStorage.getItem('mbt_active_theme') === 'dark';
            var _i = isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-800';
            var _sep = isDark ? 'border-slate-700' : 'border-slate-50';
            var ogCloudOn = JSON.parse(localStorage.getItem('moo_og_cloud_sync') || 'true');
            var isSignedIn = !!(localStorage.getItem('mbt_supabase_auth_token'));
            var signedInEmail = localStorage.getItem('mbt_supabase_user_email') || '';
            var profileName = localStorage.getItem('mbt_profile_display_name') || '';
            var profileRegion = localStorage.getItem('mbt_profile_region') || 'Jamaica';
            var profileRole = localStorage.getItem('mbt_profile_role') || '';
            var authView = localStorage.getItem('mbt_auth_view') || 'login';
            var syncOnReconnect = localStorage.getItem('mbt_supabase_sync_on_reconnect') === 'true';

            return `
                    <div class="h-full overflow-y-auto no-scrollbar p-4 space-y-3 animate-in fade-in duration-300">

                        <!-- Authentication Section -->
                        <div class="settings-card transition-all duration-300">
                            ${isSignedIn ? `
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xs border border-emerald-100 uppercase tracking-tighter">
                                        ${signedInEmail.charAt(0)}
                                    </div>
                                    <div>
                                        <div class="text-[10px] font-black settings-text-primary tracking-tight leading-none mb-1">${esc(signedInEmail)}</div>
                                        <div class="flex items-center gap-1.5">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span class="text-[8px] text-slate-400 uppercase tracking-widest font-black">Connected to Cloud</span>
                                        </div>
                                    </div>
                                </div>
                                <button onclick="mBT.features.settings.cloudSignOut()" class="px-3 py-1.5 text-slate-400 hover:text-rose-500 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all">Sign Out</button>
                            </div>` : `
                            <div class="flex gap-4 border-b ${_sep} mb-3">
                                <button onclick="localStorage.setItem('mbt_auth_view', 'login'); mBT.features.settings.open('cloud');" class="pb-2 text-[9px] font-black uppercase tracking-widest transition-all ${authView === 'login' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300 hover:text-slate-400'}">Sign In</button>
                                <button onclick="localStorage.setItem('mbt_auth_view', 'signup'); mBT.features.settings.open('cloud');" class="pb-2 text-[9px] font-black uppercase tracking-widest transition-all ${authView === 'signup' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300 hover:text-slate-400'}">Sign Up</button>
                            </div>
                            <div class="space-y-2">
                                ${authView === 'forgot' ? `
                                    <h4 class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Reset Password</h4>
                                    <input type="email" id="cloudEmail" placeholder="Your account email" class="w-full px-3 py-2 ${_i} border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                    <div id="cloudAuthError" class="text-[9px] text-red-500 font-bold hidden px-1"></div>
                                    <button onclick="mBT.features.settings.cloudForgotPassword()" class="w-full py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95">Send recovery email</button>
                                    <button onclick="localStorage.setItem('mbt_auth_view', 'login'); mBT.features.settings.open('cloud');" class="w-full text-center text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-400 transition-colors">Back to sign in</button>
                                ` : authView === 'signup' ? `
                                    <div class="grid grid-cols-1 gap-2">
                                        <input type="text" id="cloudUsername" placeholder="Unique Username" class="w-full px-3 py-2 ${_i} border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                        <input type="email" id="cloudEmail" placeholder="Email Address" class="w-full px-3 py-2 ${_i} border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="email">
                                        <input type="password" id="cloudPassword" placeholder="Strong Password" class="w-full px-3 py-2 ${_i} border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="new-password">
                                    </div>
                                    <div id="cloudAuthError" class="text-[9px] text-red-500 font-bold hidden px-1"></div>
                                    <button onclick="mBT.features.settings.cloudSignUp()" class="w-full py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95">Create Free Account</button>
                                ` : `
                                    <div class="grid grid-cols-1 gap-2">
                                        <input type="email" id="cloudEmail" placeholder="Email Address" class="w-full px-3 py-2 ${_i} border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="email">
                                        <input type="password" id="cloudPassword" placeholder="Password" class="w-full px-3 py-2 ${_i} border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="current-password">
                                    </div>
                                    <div id="cloudAuthError" class="text-[9px] text-red-500 font-bold hidden px-1"></div>
                                    <div class="flex flex-col gap-2">
                                        <button onclick="mBT.features.settings.cloudSignIn()" class="w-full py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95">Sign In</button>
                                        <div class="flex items-center gap-2 py-0.5">
                                            <div class="h-px flex-grow bg-slate-100"></div>
                                            <span class="text-[8px] font-black text-slate-300 uppercase tracking-widest">or</span>
                                            <div class="h-px flex-grow bg-slate-100"></div>
                                        </div>
                                        <button onclick="mBT.features.settings.cloudSignInGoogle()" class="w-full py-2 bg-white border border-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                            <svg class="w-3 h-3" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.162-1.9 4.155C17.18 19.582 15.003 20.634 12.48 20.634c-4.02 0-7.27-3.25-7.27-7.27s3.25-7.27 7.27-7.27c2.17 0 3.847.85 4.97 1.948l2.315-2.315C18.17 4.18 15.59 3 12.48 3 7.302 3 3.1 7.202 3.1 12.38s4.202 9.38 9.38 9.38c2.805 0 4.925-.923 6.59-2.664 1.715-1.715 2.26-4.134 2.26-6.09 0-.58-.05-1.134-.145-1.666h-8.705z"/></svg>
                                            Continue with Google
                                        </button>
                                        <button onclick="localStorage.setItem('mbt_auth_view', 'forgot'); mBT.features.settings.open('cloud');" class="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-400 transition-colors">Forgot Password?</button>
                                    </div>
                                `}
                            </div>
                            `}
                        </div>

                        <!-- User Profile (visible when signed in) -->
                        ${isSignedIn ? `
                        <div class="settings-card space-y-3">
                            <div>
                                <h3 class="text-[10px] font-black uppercase tracking-widest settings-text-primary mb-0.5">Profile Identity</h3>
                                <p class="text-[9px] text-slate-400 font-bold">Public identity used for community database contributions.</p>
                            </div>
                            <div class="grid grid-cols-1 gap-2">
                                <div class="space-y-1.5">
                                    <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
                                    <input type="text" id="profileDisplayName" placeholder="e.g. Maverick J." value="${esc(profileName)}" class="w-full px-3 py-2 ${_i} border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="space-y-1.5">
                                        <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Home Market</label>
                                        <select id="profileRegion" class="w-full px-3 py-2 ${_i} border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer">
                                            ${Object.keys(mBTOG.RATE_REGIONS).map(function (r) { return '<option value="' + r + '"' + (profileRegion === r ? ' selected' : '') + '>' + r + '</option>'; }).join('')}
                                        </select>
                                    </div>
                                    <div class="space-y-1.5">
                                        <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Standard Role</label>
                                        <input type="text" id="profileRole" placeholder="Producer / DP" value="${esc(profileRole)}" class="w-full px-3 py-2 ${_i} border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                    </div>
                                </div>
                            </div>
                            <div class="pt-3 border-t ${_sep}">
                                <button onclick="var el=document.getElementById('passwordChangeSect'); el.classList.toggle('hidden');" class="text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 mb-2 transition-colors">Change Password?</button>
                                <div id="passwordChangeSect" class="hidden space-y-2 animate-in slide-in-from-top-2 duration-300">
                                    <input type="password" id="newPasswordInput" placeholder="New Secret Password" class="w-full px-3 py-2 ${_i} border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                    <button onclick="mBT.features.settings.cloudChangePassword()" class="w-full py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">Update Security</button>
                                </div>
                            </div>
                            <button onclick="mBT.features.settings.saveProfile()" class="w-full py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all active:scale-95">Synchronize Profile</button>
                        </div>` : ''}

                        <!-- DATABASE Community Rates -->
                        <div class="settings-card">
                            <h3 class="text-[10px] font-black uppercase tracking-widest settings-text-primary mb-0.5">Community Rates</h3>
                            <p class="text-[9px] text-slate-400 font-bold mb-2">Pull updated industry rates from the shared community database. No account required.</p>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Auto-sync on start</span>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="ogCloudSyncToggle" ${ogCloudOn ? 'checked' : ''} onchange="mBT.features.settings.toggleCloudSync(this.checked);" class="sr-only peer">
                                    <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                            <button onclick="if(window.mBTOG && mBTOG.syncFromCloud){ mBTOG.syncFromCloud().then(function(n){ mBTME.alert('DATABASE', n + ' rate(s) pulled from community.'); mBT.features.settings.open('cloud'); }).catch(function(e){ console.error('Sync Failed:', e); mBTME.alert('Sync Error', 'Failed to sync rates from community.'); }); } else { mBTME.alert('DATABASE', 'Engine not available.'); }" class="w-full py-2 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-500 transition-all">Sync Rates Now</button>
                        </div>

                        <!-- Project Backup + Sync -->
                        <div class="settings-card">
                            <div class="flex items-center justify-between mb-0.5">
                                <h3 class="text-[10px] font-black uppercase tracking-widest settings-text-primary">Background Sync</h3>
                                <div id="sync-heartbeat-pill" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-slate-100 text-slate-400">
                                    <span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                    Status Check...
                                </div>
                            </div>
                            <p class="text-[9px] text-slate-400 font-bold mb-2">Automatically sync your projects, stages, and rates to the cloud for cross-device access.</p>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Auto-Sync Changes</span>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="syncOnReconnectToggle" ${syncOnReconnect ? 'checked' : ''} onchange="localStorage.setItem('mbt_supabase_sync_on_reconnect', this.checked ? 'true' : 'false');" class="sr-only peer">
                                    <div class="w-11 h-6 ${_sw} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            <button onclick="if(window.mBTSync && localStorage.getItem('mbt_supabase_auth_token')){ mBTSync.pushAll().then(function(r){ mBTME.alert('Backup', r.synced + ' records pushed, ' + r.errors + ' errors.'); }); } else { mBTME.alert('Backup', 'You must be signed in to force push data.'); }" class="w-full py-2 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 transition-all">Force Push Data Now</button>
                        </div>
                    </div>`;
        }
        if (tabName === 'database') {
            var nav = RenderEngine.ui.tabs({
                items: [
                    { id: 'lineItems', label: 'Line Items' },
                    { id: 'contacts', label: 'Contacts' },
                    { id: 'projects', label: 'Projects' },
                    { id: 'templates', label: 'Templates' }
                ],
                activeId: subTab,
                onClick: "mBT.features.settings.open('database',"
            }).replace(/open\('database',\s*'([^']+)'\)/g, "open('database', '$1')");

            return `<div class="flex flex-col h-full p-4 pb-0 overflow-hidden space-y-3">
                    ${nav.replace(/onclick="mBT.features.settings.open\('database',\('([^']+)'\)\)"/g, "onclick=\"mBT.features.settings.open('database', '$1')\"")}
                    <div class="flex-grow flex flex-col relative overflow-hidden min-h-0">
                        ${this.renderDbView(subTab)}
                    </div>
                </div>`;
        }
        if (tabName === 'updates') {
            var isDark = localStorage.getItem('mbt_active_theme') === 'dark';
            var _card = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100';
            var _update = isDark ? 'bg-amber-900/30 border-amber-700 text-amber-300' : 'bg-amber-50 border-amber-100 text-amber-600';
            var _checking = isDark ? 'bg-blue-900/30 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-600';
            var updateStatus = (window.mBT && window.mBT.registry && window.mBT.registry.updateStatus) || {};
            var updateAvailable = updateStatus.available || false;
            var isChecking = updateStatus.checking || false;
            var currentVersion = updateStatus.localVersion || 'v22.5';
            var commitMessage = updateStatus.commitMessage || 'Update details unavailable';

            /* Status message based on update state */
            var statusMsg = '';
            if (isChecking) {
                statusMsg = '<div class="border rounded-lg p-3 ' + _checking + '"><p class="text-[9px] font-bold text-center">⏳ Checking for updates...</p></div>';
            } else if (updateAvailable) {
                statusMsg = '<div class="space-y-2"><div class="border rounded-lg p-3 ' + _update + '"><p class="text-[9px] font-bold text-center">✓ Update available</p></div><div class="border rounded-lg p-3 bg-slate-50 text-slate-600 text-center"><p class="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">Release Notes</p><p class="text-[9px] font-medium">' + esc(commitMessage) + '</p></div></div>';
            } else {
                statusMsg = '<div class="border rounded-lg p-3 border-emerald-100 bg-emerald-50 text-emerald-600"><p class="text-[9px] font-bold text-center">✓ You have the latest version (' + esc(currentVersion) + ')</p></div>';
            }

            return `
                    <div class="h-full overflow-y-auto no-scrollbar p-4 space-y-3 animate-in fade-in duration-300">
                        <div class="border rounded-xl p-6 ${_card} text-center">
                            <h3 class="text-xs font-black uppercase tracking-widest mb-6 text-slate-600">Check for mBT Update</h3>
                            <div class="space-y-3">
                                <button onclick="mBT.features.settings.checkForUpdates()" ${isChecking ? 'disabled' : ''} class="w-full py-2.5 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 transition-all active:scale-95 ${isChecking ? 'opacity-50 cursor-not-allowed' : ''}">
                                    ${isChecking ? '⏳ Checking...' : 'Check for Updates'}
                                </button>
                                ${updateAvailable ? '<button onclick="if(navigator.serviceWorker && navigator.serviceWorker.controller) { navigator.serviceWorker.controller.postMessage({action: \"SKIP_WAITING\"}); window.location.reload(); } else { mBTME.alert(\"Update\", \"Offline or SW not active.\"); }" class="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95">Apply Update Now</button>' : ''}
                            </div>
                            <div class="mt-4">
                                ${statusMsg}
                            </div>
                        </div>
                    </div>`;
        }
        return `<div class="p-8 text-center text-slate-300 font-bold uppercase tracking-widest">Logic Stream Not Found</div>`;
    };

    /* --- mBT UI Theme Logic (Bridge Implementation) --- */
    mBT.ui = mBT.ui || {};
    mBT.ui.setTheme = function (themeName) {
        themeName = themeName || 'dark';
        localStorage.setItem('mbt_active_theme', themeName);
        document.body.className = document.body.className.replace(/\bmbt-theme-\S+/g, '');
        document.body.classList.add('mbt-theme-' + themeName);
        if (themeName === 'dark') {
            document.body.classList.add('bg-slate-950');
            document.body.classList.remove('bg-slate-50');
        } else {
            document.body.classList.add('bg-slate-50');
            document.body.classList.remove('bg-slate-950');
        }
        window.dispatchEvent(new CustomEvent('mbt:theme-changed', { detail: { theme: themeName } }));
    };

})(window);
