window.mBT_UI_Settings_getTabContent = function(tabName, subTab = 'lineItems') {
            function esc(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
            if (tabName === 'general') {
                const currentDateFormat = getProjectDateFormat();
                const currentSeparator = getProjectNameSeparator();
                const isCompact = budget.settings?.compactMode || false;
                const syncAoD = budget.settings?.syncAoD || false;
                // Logic Resolution: Prep for future legacy theme switch
                const isClassic = budget.settings?.classicTheme || false;
                const allowZoom = budget.settings?.allowZoom || false;
              
                return `
                    <div class="h-full overflow-y-auto no-scrollbar p-6 space-y-6 animate-in fade-in duration-300">
                        <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center gap-3">
                            <div class="w-16 h-16 rounded-2xl shadow-lg border-2 border-slate-50 overflow-hidden bg-[#fdba35]">${mBTAssets.appLogo}</div>
                            <div>
                                <h3 class="text-xs font-black uppercase tracking-widest text-slate-800">MooBudget Studio</h3>
                                <p class="text-[9px] text-slate-400 font-bold mt-1">Build v${APP_VERSION} • ${navigator.onLine ? '<span class="text-emerald-500">Online</span>' : '<span class="text-rose-500">Offline</span>'}</p>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date Format</label>
                                    <select id="dateFormatSelect" onchange="localStorage.setItem('${projectDateFormatKey}', this.value)" class="w-full text-[10px] p-2 bg-slate-50 border-none rounded-lg font-bold outline-none cursor-pointer">
                                        <option value="YYYYMMDD" ${currentDateFormat === 'YYYYMMDD' ? 'selected' : ''}>YYYY-MM-DD</option>
                                        <option value="MMDDYYYY" ${currentDateFormat === 'MMDDYYYY' ? 'selected' : ''}>MM-DD-YYYY</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Separator</label>
                                    <input type="text" id="separatorInput" maxlength="1" value="${currentSeparator}" onchange="localStorage.setItem('${projectNameSeparatorKey}', this.value)" class="w-full text-[10px] p-2 bg-slate-50 border-none rounded-lg font-bold text-center outline-none">
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-800">Allow Page Zoom</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Enable pinch-to-zoom gestures</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="zoomToggle" ${allowZoom ? 'checked' : ''} onchange="if(!budget.settings) budget.settings={}; budget.settings.allowZoom = this.checked; saveBudget(); mBT.ui.updateViewport();" class="sr-only peer">
                                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            </div>
                            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-800">Compact View</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Denser layout for small screens</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="compactModeToggle" ${isCompact ? 'checked' : ''} onchange="if(!budget.settings) budget.settings={}; budget.settings.compactMode = this.checked; saveBudget(); render();" class="sr-only peer">
                                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                            <!-- NEW: Classic Theme Placeholder -->
                            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-800">Classic Theme</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Legacy visual style (Pre-v19.54)</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="classicThemeToggle" ${isClassic ? 'checked' : ''} onchange="if(!budget.settings) budget.settings={}; budget.settings.classicTheme = this.checked; saveBudget(); render();" class="sr-only peer">
                                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-600"></div>
                                    </label>
                                </div>
                            </div>
                            <!-- Navigation Preference Toggle (Phase 16) -->
                            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-800">Open Tools In-App</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Stages, Publish etc. open inside main window</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="navPrefToggle" ${JSON.parse(localStorage.getItem('mBT_openToolsInternal') ?? 'true') ? 'checked' : ''} onchange="localStorage.setItem('mBT_openToolsInternal', this.checked);" class="sr-only peer">
                                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                             <a href="https://raw.githubusercontent.com/jaysonmy/moobudget/refs/heads/main/index.html" target="_blank" download="moobudget-beta.html" class="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-colors">${mBTAssets.cloud} Get Beta</a>
                             <button onclick="hardResetApp()" class="flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-100 transition-colors">${mBTAssets.zap} Fix Bugs</button>
                        </div>
                        <div class="flex justify-center">
                             <button onclick="mBTME.close('settingsModal'); showCoffeeWidget();" class="flex items-center gap-2 px-8 py-4 bg-[#FFDD00] text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform shadow-lg">${mBTAssets.coffee} Support Development</button>
                        </div>
                    </div>`;
            }
            if (tabName === 'ai') {
                const provider = getSelectedProvider();
                const saveHistory = budget.aiContext?.saveHistory ?? true;
                const storedPrompt = mBT.features.ai.getSystemPrompt();
                
                // Logic Resolution: Map for dynamic "Get API Key" links
                const keyLinks = {
                    'gemini': 'https://aistudio.google.com/app/apikey',
                    'openai': 'https://platform.openai.com/api-keys',
                    'deepseek': 'https://platform.deepseek.com/api_keys',
                    'grok': 'https://console.x.ai/'
                };
                
                return `
                    <div class="h-full overflow-y-auto no-scrollbar p-6 space-y-6 animate-in fade-in duration-300">
                        <div class="p-5 bg-slate-900 rounded-2xl border border-black shadow-lg text-white">
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-400">Assistant</h3>
                                    <p class="text-[9px] text-slate-500 font-bold mt-0.5">Configure Provider Access</p>
                                </div>
                                <div class="text-slate-700">${mBTAssets.sparkle}</div>
                            </div>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Active Provider</label>
                                    <select id="aiProviderSelect" onchange="const link=document.getElementById('apiKeyLink'); const map=${JSON.stringify(keyLinks).replace(/"/g, "'")}; link.href=map[this.value];" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
                                        <option value="gemini" ${provider === 'gemini' ? 'selected' : ''}>Google Gemini API</option>
                                        <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI API</option>
                                        <option value="deepseek" ${provider === 'deepseek' ? 'selected' : ''}>DeepSeek API</option>
                                        <option value="grok" ${provider === 'grok' ? 'selected' : ''}>Grok (xAI) API</option>
                                    </select>
                                </div>
                                <div>
                                    <div class="flex justify-between items-center mb-1.5">
                                        <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest">API Credentials</label>
                                        <a id="apiKeyLink" href="${keyLinks[provider] || '#'}" target="_blank" class="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 transition-colors">
                                            Get API Key <span>→</span>
                                        </a>
                                    </div>
                                    <input type="password" id="apiKeyInput" value="${getStoredApiKey(provider)}" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-blue-500" placeholder="sk-...">
                                </div>
                                <div>
                                    <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Persona & Constraints</label>
                                    <textarea id="aiSystemPromptInput" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-500 resize-none h-16 placeholder-slate-600" placeholder="e.g. Be sarcastic. Focus only on Below The Line. Use JMD currency symbol.">${storedPrompt}</textarea>
                                </div>
                                <div class="flex items-center gap-3 py-1">
                                    <div class="relative flex items-center">
                                        <input type="checkbox" id="aiContextToggle" ${saveHistory ? 'checked' : ''} onchange="if(!budget.aiContext) budget.aiContext={chat:[], analysis:''}; budget.aiContext.saveHistory = this.checked; saveBudget();" class="sr-only peer">
                                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                    </div>
                                    <label for="aiContextToggle" class="text-[9px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer select-none">Save Conversation Context</label>
                                </div>
                                <button id="saveApiKeyBtn" onclick="const p=document.getElementById('aiProviderSelect').value; const k=document.getElementById('apiKeyInput').value; const s=document.getElementById('aiSystemPromptInput').value; saveStoredApiKey(p,k); mBT.features.ai.saveSystemPrompt(s); localStorage.setItem('${storageKeyPrefix}selectedAiProvider', p); mBTME.alert('Success', 'Assistant Linked');" class="w-full bg-blue-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg hover:bg-blue-500 transition-all mt-2">Synchronize Link</button>
                            </div>
                        </div>
                    </div>`;
            }
            if (tabName === 'cloud') {
                var ogCloudOn = JSON.parse(localStorage.getItem('moo_og_cloud_sync') || 'true');
                var ogLastSync = (window.mBTOG && mBTOG.lastSync) ? mBTOG.lastSync() : null;
                var supaConfigured = !!(localStorage.getItem('mbt_supabase_url') && localStorage.getItem('mbt_supabase_key'));
                var isSignedIn = !!(localStorage.getItem('mbt_supabase_auth_token'));
                var signedInEmail = localStorage.getItem('mbt_supabase_user_email') || '';
                var profileName = localStorage.getItem('mbt_profile_display_name') || '';
                var profileRegion = localStorage.getItem('mbt_profile_region') || 'Jamaica';
                var profileRole = localStorage.getItem('mbt_profile_role') || '';
                var authView = localStorage.getItem('mbt_auth_view') || 'login'; // 'login', 'signup', 'forgot'
                var syncOnReconnect = localStorage.getItem('mbt_supabase_sync_on_reconnect') === 'true';

                return `
                    <div class="h-full overflow-y-auto no-scrollbar p-6 space-y-4 animate-in fade-in duration-300">

                        <!-- Authentication Section -->
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all duration-300">
                            ${isSignedIn ? `
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xs border border-emerald-100 uppercase tracking-tighter">
                                        ${signedInEmail.charAt(0)}
                                    </div>
                                    <div>
                                        <div class="text-[10px] font-black text-slate-800 tracking-tight leading-none mb-1">${esc(signedInEmail)}</div>
                                        <div class="flex items-center gap-1.5">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span class="text-[8px] text-slate-400 uppercase tracking-widest font-black">Connected to Cloud</span>
                                        </div>
                                    </div>
                                </div>
                                <button onclick="mBT.features.settings.cloudSignOut()" class="px-3 py-2 text-slate-400 hover:text-rose-500 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all">Sign Out</button>
                            </div>` : `
                            
                            <!-- Tab Header for Login/Signup -->
                            <div class="flex gap-4 border-b border-slate-50 mb-4">
                                <button onclick="localStorage.setItem('mbt_auth_view', 'login'); mBT.features.settings.open('cloud');" class="pb-2 text-[9px] font-black uppercase tracking-widest transition-all ${authView === 'login' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300 hover:text-slate-400'}">Sign In</button>
                                <button onclick="localStorage.setItem('mbt_auth_view', 'signup'); mBT.features.settings.open('cloud');" class="pb-2 text-[9px] font-black uppercase tracking-widest transition-all ${authView === 'signup' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300 hover:text-slate-400'}">Sign Up</button>
                            </div>

                            <div class="space-y-3">
                                ${authView === 'forgot' ? `
                                    <h4 class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Reset Password</h4>
                                    <input type="email" id="cloudEmail" placeholder="Your account email" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                    <div id="cloudAuthError" class="text-[9px] text-red-500 font-bold hidden px-1"></div>
                                    <button onclick="mBT.features.settings.cloudForgotPassword()" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/10 hover:bg-blue-700 transition-all active:scale-95">Send recovery email</button>
                                    <button onclick="localStorage.setItem('mbt_auth_view', 'login'); mBT.features.settings.open('cloud');" class="w-full text-center text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-400 transition-colors">Back to sign in</button>
                                ` : authView === 'signup' ? `
                                    <div class="grid grid-cols-1 gap-2">
                                        <input type="text" id="cloudUsername" placeholder="Unique Username" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                        <input type="email" id="cloudEmail" placeholder="Email Address" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="email">
                                        <input type="password" id="cloudPassword" placeholder="Strong Password" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="new-password">
                                    </div>
                                    <div id="cloudAuthError" class="text-[9px] text-red-500 font-bold hidden px-1"></div>
                                    <button onclick="mBT.features.settings.cloudSignUp()" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/10 hover:bg-blue-700 transition-all active:scale-95">Create Free Account</button>
                                ` : `
                                    <div class="grid grid-cols-1 gap-2">
                                        <input type="email" id="cloudEmail" placeholder="Email Address" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="email">
                                        <input type="password" id="cloudPassword" placeholder="Password" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="current-password">
                                    </div>
                                    <div id="cloudAuthError" class="text-[9px] text-red-500 font-bold hidden px-1"></div>
                                    <div class="flex flex-col gap-2">
                                        <button onclick="mBT.features.settings.cloudSignIn()" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/10 hover:bg-blue-700 transition-all active:scale-95">Sign In</button>
                                        <div class="flex items-center gap-2 py-1">
                                            <div class="h-px flex-grow bg-slate-50"></div>
                                            <span class="text-[8px] font-black text-slate-300 uppercase tracking-widest">or</span>
                                            <div class="h-px flex-grow bg-slate-50"></div>
                                        </div>
                                        <button onclick="mBT.features.settings.cloudSignInGoogle()" class="w-full py-3 bg-white border border-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                            <svg class="w-3 h-3" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.162-1.9 4.155C17.18 19.582 15.003 20.634 12.48 20.634c-4.02 0-7.27-3.25-7.27-7.27s3.25-7.27 7.27-7.27c2.17 0 3.847.85 4.97 1.948l2.315-2.315C18.17 4.18 15.59 3 12.48 3 7.302 3 3.1 7.202 3.1 12.38s4.202 9.38 9.38 9.38c2.805 0 4.925-.923 6.59-2.664 1.715-1.715 2.26-4.134 2.26-6.09 0-.58-.05-1.134-.145-1.666h-8.705z"/></svg>
                                            Continue with Google
                                        </button>
                                        <button onclick="localStorage.setItem('mbt_auth_view', 'forgot'); mBT.features.settings.open('cloud');" class="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-400 mt-1 transition-colors">Forgot Password?</button>
                                    </div>
                                `}
                            </div>
                            `}
                        </div>

                        <!-- User Profile (visible when signed in) -->
                        ${isSignedIn ? `
                        <div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-5">
                            <div>
                                <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-0.5">Profile Identity</h3>
                                <p class="text-[9px] text-slate-400 font-bold">Public identity used for OpenGate contributions.</p>
                            </div>
                            <div class="grid grid-cols-1 gap-3">
                                <div class="space-y-1.5">
                                    <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
                                    <input type="text" id="profileDisplayName" placeholder="e.g. Maverick J." value="${esc(profileName)}" class="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                </div>
                                <div class="grid grid-cols-2 gap-3">
                                    <div class="space-y-1.5">
                                        <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Home Market</label>
                                        <select id="profileRegion" class="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer">
                                            ${Object.keys(mBTOG.RATE_REGIONS).map(function(r){ return '<option value="' + r + '"' + (profileRegion === r ? ' selected' : '') + '>' + r + '</option>'; }).join('')}
                                        </select>
                                    </div>
                                    <div class="space-y-1.5">
                                        <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Standard Role</label>
                                        <input type="text" id="profileRole" placeholder="Producer / DP" value="${esc(profileRole)}" class="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Security Expansion -->
                            <div class="pt-4 border-t border-slate-50">
                                <button onclick="const el=document.getElementById('passwordChangeSect'); el.classList.toggle('hidden');" class="text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 mb-2 transition-colors">Change Password?</button>
                                <div id="passwordChangeSect" class="hidden space-y-2 animate-in slide-in-from-top-2 duration-300">
                                    <input type="password" id="newPasswordInput" placeholder="New Secret Password" class="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                    <button onclick="mBT.features.settings.cloudChangePassword()" class="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">Update Security</button>
                                </div>
                            </div>

                            <button onclick="mBT.features.settings.saveProfile()" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95">Synchronize Profile</button>
                        </div>` : ''}

                        <!-- OpenGate Community Rates -->
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-1">OpenGate Community Rates</h3>
                            <p class="text-[9px] text-slate-400 font-bold mb-4">Pull updated industry rates from the shared community database. No account required.</p>
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Auto-sync on start</span>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="ogCloudSyncToggle" ${ogCloudOn ? 'checked' : ''} onchange="mBT.features.settings.toggleCloudSync(this.checked);" class="sr-only peer">
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                            <button onclick="if(window.mBTOG && mBTOG.syncFromCloud){ mBTOG.syncFromCloud().then(function(n){ mBTME.alert('OpenGate', n + ' rate(s) pulled from community.'); mBT.features.settings.open('cloud'); }).catch(function(e){ console.error('Sync Failed:', e); mBTME.alert('Sync Error', 'Failed to sync rates from community.'); }); } else { mBTME.alert('OpenGate', 'Engine not available.'); }" class="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-500 transition-all">Sync Rates Now</button>
                        </div>

                        <!-- Project Backup + Sync -->
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-1">Background Sync</h3>
                            <p class="text-[9px] text-slate-400 font-bold mb-4">Automatically sync your projects, stages, and rates to the cloud for cross-device access.</p>
                            <div class="flex items-center justify-between mb-4">
                                <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Auto-Sync Changes</span>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="syncOnReconnectToggle" ${syncOnReconnect ? 'checked' : ''} onchange="localStorage.setItem('mbt_supabase_sync_on_reconnect', this.checked ? 'true' : 'false');" class="sr-only peer">
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            <button onclick="if(window.mBTSync && localStorage.getItem('mbt_supabase_auth_token')){ mBTSync.pushAll().then(function(r){ mBTME.alert('Backup', r.synced + ' records pushed, ' + r.errors + ' errors.'); }); } else { mBTME.alert('Backup', 'You must be signed in to force push data.'); }" class="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 transition-all">Force Push Data Now</button>
                        </div>
                    </div>`;
            }
            if (tabName === 'database') {
                const nav = RenderEngine.ui.tabs({
                    items: [
                        { id: 'lineItems', label: 'Line Items' },
                        { id: 'contacts', label: 'Contacts' },
                        { id: 'templates', label: 'Templates' }
                    ],
                    activeId: subTab,
                    onClick: "mBT.features.settings.open('database',"
                }).replace(/open\('database',\s*'([^']+)'\)/g, "open('database', '$1')"); 

                return `<div class="flex flex-col h-full p-6 pb-0 overflow-hidden space-y-4">
                    ${nav.replace(/onclick="mBT.features.settings.open\('database',\('([^']+)'\)\)"/g, "onclick=\"mBT.features.settings.open('database', '$1')\"")} 
                            </div>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Active Provider</label>
                                    <select id="aiProviderSelect" onchange="const link=document.getElementById('apiKeyLink'); const map=${JSON.stringify(keyLinks).replace(/"/g, "'")}; link.href=map[this.value];" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
                                        <option value="gemini" ${provider === 'gemini' ? 'selected' : ''}>Google Gemini API</option>
                                        <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI API</option>
                                        <option value="deepseek" ${provider === 'deepseek' ? 'selected' : ''}>DeepSeek API</option>
                                        <option value="grok" ${provider === 'grok' ? 'selected' : ''}>Grok (xAI) API</option>
                                    </select>
                                </div>
                                <div>
                                    <div class="flex justify-between items-center mb-1.5">
                                        <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest">API Credentials</label>
                                        <a id="apiKeyLink" href="${keyLinks[provider] || '#'}" target="_blank" class="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 transition-colors">
                                            Get API Key <span>→</span>
                                        </a>
                                    </div>
                                    <input type="password" id="apiKeyInput" value="${getStoredApiKey(provider)}" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-blue-500" placeholder="sk-...">
                                </div>
                                <div>
                                    <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Persona & Constraints</label>
                                    <textarea id="aiSystemPromptInput" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-500 resize-none h-16 placeholder-slate-600" placeholder="e.g. Be sarcastic. Focus only on Below The Line. Use JMD currency symbol.">${storedPrompt}</textarea>
                                </div>
                                <div class="flex items-center gap-3 py-1">
                                    <div class="relative flex items-center">
                                        <input type="checkbox" id="aiContextToggle" ${saveHistory ? 'checked' : ''} onchange="if(!budget.aiContext) budget.aiContext={chat:[], analysis:''}; budget.aiContext.saveHistory = this.checked; saveBudget();" class="sr-only peer">
                                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                    </div>
                                    <label for="aiContextToggle" class="text-[9px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer select-none">Save Conversation Context</label>
                                </div>
                                <button id="saveApiKeyBtn" onclick="const p=document.getElementById('aiProviderSelect').value; const k=document.getElementById('apiKeyInput').value; const s=document.getElementById('aiSystemPromptInput').value; saveStoredApiKey(p,k); mBT.features.ai.saveSystemPrompt(s); localStorage.setItem('${storageKeyPrefix}selectedAiProvider', p); mBTME.alert('Success', 'Assistant Linked');" class="w-full bg-blue-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg hover:bg-blue-500 transition-all mt-2">Synchronize Link</button>
                            </div>
                        </div>
                    </div>`;
            }
            if (tabName === 'cloud') {
                var ogCloudOn = JSON.parse(localStorage.getItem('moo_og_cloud_sync') || 'true');
                var ogLastSync = (window.mBTOG && mBTOG.lastSync) ? mBTOG.lastSync() : null;
                var supaConfigured = !!(localStorage.getItem('mbt_supabase_url') && localStorage.getItem('mbt_supabase_key'));
                var isSignedIn = !!(localStorage.getItem('mbt_supabase_auth_token'));
                var signedInEmail = localStorage.getItem('mbt_supabase_user_email') || '';
                var profileName = localStorage.getItem('mbt_profile_display_name') || '';
                var profileRegion = localStorage.getItem('mbt_profile_region') || 'Jamaica';
                var profileRole = localStorage.getItem('mbt_profile_role') || '';
                var authView = localStorage.getItem('mbt_auth_view') || 'login'; // 'login', 'signup', 'forgot'
                var syncOnReconnect = localStorage.getItem('mbt_supabase_sync_on_reconnect') === 'true';

                return `
                    <div class="h-full overflow-y-auto no-scrollbar p-6 space-y-4 animate-in fade-in duration-300">

                        <!-- Authentication Section -->
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all duration-300">
                            ${isSignedIn ? `
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xs border border-emerald-100 uppercase tracking-tighter">
                                        ${signedInEmail.charAt(0)}
                                    </div>
                                    <div>
                                        <div class="text-[10px] font-black text-slate-800 tracking-tight leading-none mb-1">${esc(signedInEmail)}</div>
                                        <div class="flex items-center gap-1.5">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span class="text-[8px] text-slate-400 uppercase tracking-widest font-black">Connected to Cloud</span>
                                        </div>
                                    </div>
                                </div>
                                <button onclick="mBT.features.settings.cloudSignOut()" class="px-3 py-2 text-slate-400 hover:text-rose-500 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all">Sign Out</button>
                            </div>` : `
                            
                            <!-- Tab Header for Login/Signup -->
                            <div class="flex gap-4 border-b border-slate-50 mb-4">
                                <button onclick="localStorage.setItem('mbt_auth_view', 'login'); mBT.features.settings.open('cloud');" class="pb-2 text-[9px] font-black uppercase tracking-widest transition-all ${authView === 'login' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300 hover:text-slate-400'}">Sign In</button>
                                <button onclick="localStorage.setItem('mbt_auth_view', 'signup'); mBT.features.settings.open('cloud');" class="pb-2 text-[9px] font-black uppercase tracking-widest transition-all ${authView === 'signup' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300 hover:text-slate-400'}">Sign Up</button>
                            </div>

                            <div class="space-y-3">
                                ${authView === 'forgot' ? `
                                    <h4 class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Reset Password</h4>
                                    <input type="email" id="cloudEmail" placeholder="Your account email" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                    <div id="cloudAuthError" class="text-[9px] text-red-500 font-bold hidden px-1"></div>
                                    <button onclick="mBT.features.settings.cloudForgotPassword()" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/10 hover:bg-blue-700 transition-all active:scale-95">Send recovery email</button>
                                    <button onclick="localStorage.setItem('mbt_auth_view', 'login'); mBT.features.settings.open('cloud');" class="w-full text-center text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-400 transition-colors">Back to sign in</button>
                                ` : authView === 'signup' ? `
                                    <div class="grid grid-cols-1 gap-2">
                                        <input type="text" id="cloudUsername" placeholder="Unique Username" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                        <input type="email" id="cloudEmail" placeholder="Email Address" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="email">
                                        <input type="password" id="cloudPassword" placeholder="Strong Password" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="new-password">
                                    </div>
                                    <div id="cloudAuthError" class="text-[9px] text-red-500 font-bold hidden px-1"></div>
                                    <button onclick="mBT.features.settings.cloudSignUp()" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/10 hover:bg-blue-700 transition-all active:scale-95">Create Free Account</button>
                                ` : `
                                    <div class="grid grid-cols-1 gap-2">
                                        <input type="email" id="cloudEmail" placeholder="Email Address" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="email">
                                        <input type="password" id="cloudPassword" placeholder="Password" class="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" autocomplete="current-password">
                                    </div>
                                    <div id="cloudAuthError" class="text-[9px] text-red-500 font-bold hidden px-1"></div>
                                    <div class="flex flex-col gap-2">
                                        <button onclick="mBT.features.settings.cloudSignIn()" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/10 hover:bg-blue-700 transition-all active:scale-95">Sign In</button>
                                        <div class="flex items-center gap-2 py-1">
                                            <div class="h-px flex-grow bg-slate-50"></div>
                                            <span class="text-[8px] font-black text-slate-300 uppercase tracking-widest">or</span>
                                            <div class="h-px flex-grow bg-slate-50"></div>
                                        </div>
                                        <button onclick="mBT.features.settings.cloudSignInGoogle()" class="w-full py-3 bg-white border border-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                            <svg class="w-3 h-3" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.162-1.9 4.155C17.18 19.582 15.003 20.634 12.48 20.634c-4.02 0-7.27-3.25-7.27-7.27s3.25-7.27 7.27-7.27c2.17 0 3.847.85 4.97 1.948l2.315-2.315C18.17 4.18 15.59 3 12.48 3 7.302 3 3.1 7.202 3.1 12.38s4.202 9.38 9.38 9.38c2.805 0 4.925-.923 6.59-2.664 1.715-1.715 2.26-4.134 2.26-6.09 0-.58-.05-1.134-.145-1.666h-8.705z"/></svg>
                                            Continue with Google
                                        </button>
                                        <button onclick="localStorage.setItem('mbt_auth_view', 'forgot'); mBT.features.settings.open('cloud');" class="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-400 mt-1 transition-colors">Forgot Password?</button>
                                    </div>
                                `}
                            </div>
                            `}
                        </div>

                        <!-- User Profile (visible when signed in) -->
                        ${isSignedIn ? `
                        <div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-5">
                            <div>
                                <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-0.5">Profile Identity</h3>
                                <p class="text-[9px] text-slate-400 font-bold">Public identity used for OpenGate contributions.</p>
                            </div>
                            <div class="grid grid-cols-1 gap-3">
                                <div class="space-y-1.5">
                                    <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
                                    <input type="text" id="profileDisplayName" placeholder="e.g. Maverick J." value="${esc(profileName)}" class="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                </div>
                                <div class="grid grid-cols-2 gap-3">
                                    <div class="space-y-1.5">
                                        <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Home Market</label>
                                        <select id="profileRegion" class="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer">
                                            ${Object.keys(mBTOG.RATE_REGIONS).map(function(r){ return '<option value="' + r + '"' + (profileRegion === r ? ' selected' : '') + '>' + r + '</option>'; }).join('')}
                                        </select>
                                    </div>
                                    <div class="space-y-1.5">
                                        <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Standard Role</label>
                                        <input type="text" id="profileRole" placeholder="Producer / DP" value="${esc(profileRole)}" class="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Security Expansion -->
                            <div class="pt-4 border-t border-slate-50">
                                <button onclick="const el=document.getElementById('passwordChangeSect'); el.classList.toggle('hidden');" class="text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 mb-2 transition-colors">Change Password?</button>
                                <div id="passwordChangeSect" class="hidden space-y-2 animate-in slide-in-from-top-2 duration-300">
                                    <input type="password" id="newPasswordInput" placeholder="New Secret Password" class="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                    <button onclick="mBT.features.settings.cloudChangePassword()" class="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">Update Security</button>
                                </div>
                            </div>

                            <button onclick="mBT.features.settings.saveProfile()" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95">Synchronize Profile</button>
                        </div>` : ''}

                        <!-- OpenGate Community Rates -->
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-1">OpenGate Community Rates</h3>
                            <p class="text-[9px] text-slate-400 font-bold mb-4">Pull updated industry rates from the shared community database. No account required.</p>
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Auto-sync on start</span>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="ogCloudSyncToggle" ${ogCloudOn ? 'checked' : ''} onchange="mBT.features.settings.toggleCloudSync(this.checked);" class="sr-only peer">
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                            <button onclick="if(window.mBTOG && mBTOG.syncFromCloud){ mBTOG.syncFromCloud().then(function(n){ mBTME.alert('OpenGate', n + ' rate(s) pulled from community.'); mBT.features.settings.open('cloud'); }).catch(function(e){ console.error('Sync Failed:', e); mBTME.alert('Sync Error', 'Failed to sync rates from community.'); }); } else { mBTME.alert('OpenGate', 'Engine not available.'); }" class="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-500 transition-all">Sync Rates Now</button>
                        </div>

                        <!-- Project Backup + Sync -->
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-1">Background Sync</h3>
                            <p class="text-[9px] text-slate-400 font-bold mb-4">Automatically sync your projects, stages, and rates to the cloud for cross-device access.</p>
                            <div class="flex items-center justify-between mb-4">
                                <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Auto-Sync Changes</span>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="syncOnReconnectToggle" ${syncOnReconnect ? 'checked' : ''} onchange="localStorage.setItem('mbt_supabase_sync_on_reconnect', this.checked ? 'true' : 'false');" class="sr-only peer">
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            <button onclick="if(window.mBTSync && localStorage.getItem('mbt_supabase_auth_token')){ mBTSync.pushAll().then(function(r){ mBTME.alert('Backup', r.synced + ' records pushed, ' + r.errors + ' errors.'); }); } else { mBTME.alert('Backup', 'You must be signed in to force push data.'); }" class="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 transition-all">Force Push Data Now</button>
                        </div>
                    </div>`;
            }
            if (tabName === 'database') {
                const nav = RenderEngine.ui.tabs({
                    items: [
                        { id: 'lineItems', label: 'Line Items' },
                        { id: 'contacts', label: 'Contacts' },
                        { id: 'templates', label: 'Templates' }
                    ],
                    activeId: subTab,
                    onClick: "mBT.features.settings.open('database',"
                }).replace(/open\('database',\s*'([^']+)'\)/g, "open('database', '$1')"); 

                return `<div class="flex flex-col h-full p-6 pb-0 overflow-hidden space-y-4">
                    ${nav.replace(/onclick="mBT.features.settings.open\('database',\('([^']+)'\)\)"/g, "onclick=\"mBT.features.settings.open('database', '$1')\"")} 
                    <div class="flex-grow flex flex-col relative overflow-hidden min-h-0">
                        ${this.renderDbView(subTab)}
                    </div>
                </div>`;
            }
            return `<div class="p-8 text-center text-slate-300 font-bold uppercase tracking-widest">Logic Stream Not Found</div>`;
        };
