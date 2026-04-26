/* =============================================================================
   mBTAssistant.js  —  Singleton AI service for mooBudgetTool
   Phase 171A — ES5 strict, no const/let/arrow/spread/backticks
   =============================================================================

   ARCHITECTURE
   ------------
   mBTAssistant is the single source of truth for all AI-related state AND
   all AI API calls. No tool should call fetch() against an AI provider
   directly — all calls go through callChat() or callImageGen().

   LAYERS
   ------
   mBTAssistant.js  (this file)  — state + API calls
   ai/index.html                 — UI shell only, calls mBTAssistant methods
   ui.settings.js                — settings UI, calls mBTAssistant setters on save
   db/index.html storyboard      — calls mBTAssistant.callImageGen()

   SLICE VIEW PROTOCOL (Phase 172+)
   ---------------------------------
   mBTAssistant.openSlice(sliceType, context)

   sliceType: 'chat' | 'imagegen' | 'sources' | 'settings'
   context:   { budgetDoc, stagesData, frameId, docId, projectKey }

   KEY CONSTANTS
   =============================================================================
*/

/* jshint esversion: 5 */
'use strict';

var mBTAssistant = (function () {

    /* =========================================================================
       STORAGE KEY CONSTANTS — single source of truth for all localStorage keys
    ========================================================================= */
    var K = {
        /* Provider */
        PROVIDER:         'mbt_selected_ai_provider',
        /* Per-provider chat model: mbt_ai_chat_model_<provider> */
        MODEL_CHAT_PFX:   'mbt_ai_chat_model_',
        /* Single image gen model (provider-agnostic selection) */
        MODEL_IMAGE:      'mbt_ai_image_model',
        /* Per-provider config */
        GEMINI_MODEL:     'mbt_gemini_model',
        OR_MODEL:         'mbt_openrouter_model',
        LM_ENDPOINT:      'mbt_lmstudio_endpoint',
        LM_MODEL:         'mbt_lmstudio_model',
        /* System prompt (written by monolith settings) */
        SYSTEM_PROMPT:    'prodBudget_v5_aiSystemPrompt',
        /* Sources */
        SOURCES:          'mbt_ai_sources',
        /* Chat history prefix: mbt_assistant_chat_<projectKey> */
        CHAT_PREFIX:      'mbt_assistant_chat_',
        /* Generated assets */
        ASSETS:           'mbt_assistant_assets',
        /* Legacy keys — kept in sync for tools not yet migrated */
        LEGACY_TREATMENT: 'mbt_ai_treatment',
        LEGACY_SCRIPT:    'mbt_ai_script'
    };

    /* Provider endpoint definitions */
    var ENDPOINTS = {
        gemini:     { url: 'https://generativelanguage.googleapis.com/v1beta/models/', label: 'Google Gemini' },
        openai:     { url: 'https://api.openai.com/v1/chat/completions',               label: 'OpenAI',        model: 'gpt-4o-mini' },
        deepseek:   { url: 'https://api.deepseek.com/chat/completions',                label: 'DeepSeek',      model: 'deepseek-chat' },
        grok:       { url: 'https://api.x.ai/v1/chat/completions',                     label: 'Grok (xAI)',    model: 'grok-beta' },
        anthropic:  { url: 'https://api.anthropic.com/v1/messages',                    label: 'Anthropic',     model: 'claude-sonnet-4-6' },
        openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions',            label: 'OpenRouter',    model: 'openai/gpt-4o-mini' },
        lmstudio:   { url: 'http://localhost:1234/v1/chat/completions',                label: 'LM Studio',     model: 'local-model' }
    };

    /* Image gen endpoint definitions */
    var IMAGE_ENDPOINTS = {
        gemini:     { url: 'https://generativelanguage.googleapis.com/v1beta/models/', defaultModel: 'imagen-3.0-generate-001' },
        openai:     { url: 'https://api.openai.com/v1/images/generations',             defaultModel: 'dall-e-3' },
        openrouter: { url: 'https://openrouter.ai/api/v1/images/generations',         defaultModel: 'black-forest-labs/flux-schnell' },
        pollinations: { url: 'https://image.pollinations.ai/prompt/',                  defaultModel: 'pollinations' }
    };

    /* =========================================================================
       INTERNAL HELPERS
    ========================================================================= */

    function _get(key) {
        try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
    }

    function _set(key, val) {
        try { localStorage.setItem(key, val); } catch (e) {}
    }

    function _parse(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
        catch (e) { return fallback; }
    }

    function _store(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }

    /* Resolve the active chat model for a provider */
    function _resolveChatModel(provider) {
        /* Check per-provider override first */
        var override = _get(K.MODEL_CHAT_PFX + provider);
        if (override) return override;
        /* Then check legacy per-provider keys */
        if (provider === 'gemini')     return _get(K.GEMINI_MODEL) || 'gemini-2.5-flash';
        if (provider === 'openrouter') return _get(K.OR_MODEL)     || 'openai/gpt-4o-mini';
        if (provider === 'lmstudio')   return _get(K.LM_MODEL)     || 'local-model';
        return (ENDPOINTS[provider] || {}).model || '';
    }

    /* Resolve the active image model */
    function _resolveImageModel(provider) {
        var stored = _get(K.MODEL_IMAGE);
        if (stored) return stored;
        return ((IMAGE_ENDPOINTS[provider] || IMAGE_ENDPOINTS.pollinations).defaultModel);
    }

    /* Build system instruction string */
    function _buildSysInstruction(basePrompt) {
        var constraints = _get(K.SYSTEM_PROMPT);
        return constraints ? basePrompt + ' USER CONSTRAINTS: ' + constraints : basePrompt;
    }

    /* =========================================================================
       MIGRATION
    ========================================================================= */

    function _migrateLegacy() {
        var sources = _parse(K.SOURCES, null);
        if (sources !== null) return;
        sources = [];
        var treatment = (_get(K.LEGACY_TREATMENT) || '').trim();
        var script    = (_get(K.LEGACY_SCRIPT)    || '').trim();
        if (treatment) sources.push({ id: 'legacy_treatment', title: 'Treatment', text: treatment });
        if (script)    sources.push({ id: 'legacy_script',    title: 'Script',    text: script });
        _store(K.SOURCES, sources);
    }

    /* =========================================================================
       PUBLIC API — PROVIDER & KEYS
    ========================================================================= */

    function getProvider() { return _get(K.PROVIDER) || 'gemini'; }
    function setProvider(p) { _set(K.PROVIDER, p); }

    function getApiKey(provider) { return _get('mbt_' + (provider || getProvider()) + '_api_key'); }
    function setApiKey(provider, key) { _set('mbt_' + provider + '_api_key', key); }

    function getImageApiKey(provider) {
        var ip = provider || _get('mbt_ai_image_provider') || 'pollinations';
        return _get('mbt_img_' + ip + '_api_key');
    }
    function setImageApiKey(provider, key) {
        _set('mbt_img_' + provider + '_api_key', key);
    }

    function getProviderLabel(provider) { return (ENDPOINTS[provider] || {}).label || provider; }

    /* =========================================================================
       PUBLIC API — MODELS
    ========================================================================= */

    function getChatModel(provider) { return _resolveChatModel(provider || getProvider()); }
    function setChatModel(provider, model) { _set(K.MODEL_CHAT_PFX + provider, model); }

    function getImageModel() { return _resolveImageModel(getProvider()); }
    function setImageModel(model) { _set(K.MODEL_IMAGE, model); }

    /* Legacy per-provider model accessors (used by Settings UI) */
    function getGeminiModel()         { return _get(K.GEMINI_MODEL)    || 'gemini-2.5-flash'; }
    function setGeminiModel(m)        { _set(K.GEMINI_MODEL, m); }
    function getOpenRouterModel()     { return _get(K.OR_MODEL)        || 'openai/gpt-4o-mini'; }
    function setOpenRouterModel(m)    { _set(K.OR_MODEL, m); }
    function getLMStudioEndpoint()    { return _get(K.LM_ENDPOINT)     || 'http://localhost:1234/v1'; }
    function setLMStudioEndpoint(ep)  { _set(K.LM_ENDPOINT, ep); }
    function getLMStudioModel()       { return _get(K.LM_MODEL)        || 'local-model'; }
    function setLMStudioModel(m)      { _set(K.LM_MODEL, m); }

    function getSystemPrompt()        { return _get(K.SYSTEM_PROMPT); }
    function setSystemPrompt(p)       { _set(K.SYSTEM_PROMPT, p); }

    /* =========================================================================
       PUBLIC API — SOURCES
    ========================================================================= */

    function getSources() { return _parse(K.SOURCES, []); }

    function addSource(title, text) {
        var sources = getSources();
        var id = 'src_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        var firstLine = (text || '').split('\n')[0].replace(/^#+\s*/, '').slice(0, 60) || title || 'Source';
        sources.push({ id: id, title: title || firstLine, text: (text || '').slice(0, 12000) });
        _store(K.SOURCES, sources);
        _syncLegacyTreatment(sources);
        return id;
    }

    function removeSource(id) {
        var sources = getSources().filter(function (s) { return s.id !== id; });
        _store(K.SOURCES, sources);
        _syncLegacyTreatment(sources);
    }

    function updateSource(id, title, text) {
        var sources = getSources().map(function (s) {
            if (s.id !== id) return s;
            var firstLine = (text || '').split('\n')[0].replace(/^#+\s*/, '').slice(0, 60) || title || 'Source';
            return { id: id, title: title || firstLine, text: (text || '').slice(0, 12000) };
        });
        _store(K.SOURCES, sources);
        _syncLegacyTreatment(sources);
    }

    function clearSources() {
        _store(K.SOURCES, []);
        localStorage.removeItem(K.LEGACY_TREATMENT);
    }

    function _syncLegacyTreatment(sources) {
        var combined = (sources || []).map(function (s) { return s.text; }).join('\n\n');
        _set(K.LEGACY_TREATMENT, combined.slice(0, 8000));
    }

    /* Build a context string from all sources (for injection into prompts) */
    function buildSourceContext() {
        var sources = getSources();
        if (!sources.length) return '';
        return sources.map(function (s, i) {
            return '--- SOURCE ' + (i + 1) + ': ' + s.title.toUpperCase() + ' ---\n' + s.text.slice(0, 6000);
        }).join('\n\n');
    }

    /* =========================================================================
       PUBLIC API — CHAT HISTORY
    ========================================================================= */

    function getChatHistory(projectKey) {
        return _parse(K.CHAT_PREFIX + (projectKey || 'default'), []);
    }

    function appendChat(projectKey, role, content) {
        var history = getChatHistory(projectKey);
        history.push({ role: role, content: content, ts: Date.now() });
        if (history.length > 200) history = history.slice(history.length - 200);
        _store(K.CHAT_PREFIX + (projectKey || 'default'), history);
    }

    function clearChat(projectKey) {
        localStorage.removeItem(K.CHAT_PREFIX + (projectKey || 'default'));
    }

    /* =========================================================================
       PUBLIC API — GENERATED ASSETS
    ========================================================================= */

    function getAsset(docId, frameId) {
        var assets = _parse(K.ASSETS, {});
        return assets[docId + '.' + frameId] || null;
    }

    function saveAsset(docId, frameId, dataUrl) {
        var assets = _parse(K.ASSETS, {});
        assets[docId + '.' + frameId] = dataUrl;
        _store(K.ASSETS, assets);
    }

    function removeAsset(docId, frameId) {
        var assets = _parse(K.ASSETS, {});
        delete assets[docId + '.' + frameId];
        _store(K.ASSETS, assets);
    }

    /* =========================================================================
       PUBLIC API — callChat(options) → Promise<string>
       The single entry point for all LLM text generation.

       options: {
         userMessage:  string   (required)
         systemPrompt: string   (optional base instruction)
         history:      array    (optional [{role,content},...] for multi-turn)
         projectKey:   string   (optional — if set, persists history)
       }
    ========================================================================= */

    function callChat(options) {
        var userMessage  = options.userMessage  || '';
        var basePrompt   = options.systemPrompt || 'You are a helpful film production assistant.';
        var history      = options.history      || [];
        var projectKey   = options.projectKey   || null;

        var provider = getProvider();
        var apiKey   = getApiKey(provider);
        var model    = getChatModel(provider);
        var sysInstr = _buildSysInstruction(basePrompt);
        var ep       = ENDPOINTS[provider] || ENDPOINTS.lmstudio;
        var url      = ep.url;

        /* Persist to history if projectKey given */
        if (projectKey) appendChat(projectKey, 'user', userMessage);

        /* ---- Gemini ---- */
        if (provider === 'gemini') {
            /* Build multi-turn contents array */
            var gemContents = [];
            history.forEach(function (m) {
                gemContents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
            });
            gemContents.push({ role: 'user', parts: [{ text: userMessage }] });

            return fetch(url + model + ':generateContent?key=' + apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: gemContents,
                    systemInstruction: { parts: [{ text: sysInstr }] }
                })
            })
            .then(function (r) {
                if (!r.ok) return r.json().then(function (e) { throw new Error('Gemini ' + r.status + ': ' + ((e.error && e.error.message) || r.statusText)); });
                return r.json();
            })
            .then(function (d) {
                var text = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0] && d.candidates[0].content.parts[0].text) || 'No response.';
                if (projectKey) appendChat(projectKey, 'assistant', text);
                return text;
            });
        }

        /* ---- Anthropic ---- */
        if (provider === 'anthropic') {
            var anMsgs = history.filter(function (m) { return m.role !== 'system'; });
            anMsgs.push({ role: 'user', content: userMessage });
            return fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model: model, max_tokens: 4096, system: sysInstr, messages: anMsgs })
            })
            .then(function (r) {
                if (!r.ok) return r.json().then(function (e) { throw new Error('Anthropic ' + r.status + ': ' + ((e.error && e.error.message) || r.statusText)); });
                return r.json();
            })
            .then(function (d) {
                var text = (d.content && d.content[0] && d.content[0].text) || 'No response.';
                if (projectKey) appendChat(projectKey, 'assistant', text);
                return text;
            });
        }

        /* ---- OpenAI-compatible: OpenAI, DeepSeek, Grok, OpenRouter, LM Studio ---- */
        if (provider === 'lmstudio') {
            url   = getLMStudioEndpoint() + '/chat/completions';
            model = getLMStudioModel();
        }
        if (provider === 'openrouter') {
            model = getOpenRouterModel();
        }

        var oaMsgs = [];
        if (sysInstr) oaMsgs.push({ role: 'system', content: sysInstr });
        history.forEach(function (m) { oaMsgs.push(m); });
        oaMsgs.push({ role: 'user', content: userMessage });

        var oaHdrs = { 'Content-Type': 'application/json' };
        if (apiKey) oaHdrs['Authorization'] = 'Bearer ' + apiKey;
        if (provider === 'openrouter') { oaHdrs['HTTP-Referer'] = window.location.origin; oaHdrs['X-Title'] = 'mBT'; }

        return fetch(url, {
            method: 'POST',
            headers: oaHdrs,
            body: JSON.stringify({ model: model, messages: oaMsgs, temperature: 0.7 })
        })
        .then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw new Error(provider + ' ' + r.status + ': ' + ((e.error && e.error.message) || r.statusText)); });
            return r.json();
        })
        .then(function (d) {
            var text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || 'No response.';
            if (projectKey) appendChat(projectKey, 'assistant', text);
            return text;
        });
    }

    /* =========================================================================
       PUBLIC API — callImageGen(options) → Promise<string> (base64 data URL)
       The single entry point for all image generation.

       options: {
         prompt:      string  (required)
         model:       string  (optional override — defaults to getImageModel())
         aspectRatio: string  (optional — '16:9', '1:1' etc. — provider-dependent)
       }
    ========================================================================= */

    /* Map form factor id → { w, h, gemini, dalle } */
    var _FF_MAP = {
        '16:9':   { w: 1024, h: 576,  gemini: '16:9',  dalle: '1792x1024' },
        '2.39:1': { w: 1024, h: 428,  gemini: '16:9',  dalle: '1792x1024' },
        '4:3':    { w: 1024, h: 768,  gemini: '4:3',   dalle: '1024x1024' },
        '1:1':    { w: 1024, h: 1024, gemini: '1:1',   dalle: '1024x1024' },
        '9:16':   { w: 576,  h: 1024, gemini: '9:16',  dalle: '1024x1792' }
    };

    function callImageGen(options) {
        var prompt      = options.prompt || '';
        /* Image provider is independent from chat provider — reads its own key */
        var provider    = _get('mbt_ai_image_provider') || getProvider();
        var apiKey      = getImageApiKey(provider);
        var model       = options.model || _get(K.MODEL_IMAGE) || ((IMAGE_ENDPOINTS[provider] || IMAGE_ENDPOINTS.pollinations).defaultModel);
        var aspectRatio = options.aspectRatio || '16:9';
        var ff          = _FF_MAP[aspectRatio] || _FF_MAP['16:9'];
        var ep          = IMAGE_ENDPOINTS[provider] || IMAGE_ENDPOINTS.pollinations;

        if (!prompt) return Promise.reject(new Error('No prompt provided'));

        /* ---- Gemini Imagen ---- */
        if (provider === 'gemini') {
            return fetch(ep.url + model + ':predict?key=' + apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [{ prompt: prompt }],
                    parameters: { sampleCount: 1, aspectRatio: ff.gemini }
                })
            })
            .then(function (r) {
                if (!r.ok) return r.text().then(function (t) { throw new Error('Gemini Imagen ' + r.status + ': ' + t.slice(0, 120)); });
                return r.json();
            })
            .then(function (res) {
                if (res.predictions && res.predictions[0] && res.predictions[0].bytesBase64Encoded) {
                    var mime = res.predictions[0].mimeType || 'image/jpeg';
                    return 'data:' + mime + ';base64,' + res.predictions[0].bytesBase64Encoded;
                }
                throw new Error(res.error ? res.error.message : 'No image returned');
            });
        }

        /* ---- OpenAI DALL-E ---- */
        if (provider === 'openai') {
            return fetch(ep.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
                body: JSON.stringify({ model: model, prompt: prompt, n: 1, size: ff.dalle, response_format: 'b64_json' })
            })
            .then(function (r) {
                if (!r.ok) return r.text().then(function (t) { throw new Error('OpenAI DALL-E ' + r.status + ': ' + t.slice(0, 120)); });
                return r.json();
            })
            .then(function (res) {
                if (res.data && res.data[0] && res.data[0].b64_json) return 'data:image/png;base64,' + res.data[0].b64_json;
                throw new Error(res.error ? res.error.message : 'No image returned');
            });
        }

        /* ---- OpenRouter image models ----
           OpenRouter routes image-capable models through /chat/completions with a
           content block requesting an image URL — /images/generations is not a valid
           OpenRouter endpoint and returns 404. We request a URL response and convert. */
        if (provider === 'openrouter') {
            return fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey, 'HTTP-Referer': window.location.origin, 'X-Title': 'mooBudgetTool' },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }]
                })
            })
            .then(function (r) {
                if (!r.ok) return r.text().then(function (t) { throw new Error('OpenRouter ' + r.status + ': ' + t.slice(0, 120)); });
                return r.json();
            })
            .then(function (res) {
                var content = (res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) || '';
                /* Image models return a URL or markdown image — extract first URL */
                var urlMatch = content.match(/https?:\/\/\S+?(?:\.(png|jpg|jpeg|webp))[^\s)]*/i);
                if (urlMatch) return urlMatch[0];
                /* Fallback: return the raw content as a URL if it looks like one */
                if (content.indexOf('http') === 0) return content.trim();
                throw new Error('OpenRouter returned no image URL. Try a different image model.');
            });
        }

        /* ---- Pollinations fallback (no key required) ---- */
        var _polModel = (model && model !== 'pollinations') ? '&model=' + encodeURIComponent(model) : '';
        return fetch('https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=' + ff.w + '&height=' + ff.h + '&nologo=true&seed=' + Date.now() + _polModel)
            .then(function (r) {
                if (!r.ok) throw new Error('Pollinations ' + r.status + ': image generation failed. Try a different provider or test from a non-localhost URL.');
                return r.blob();
            })
            .then(function (blob) {
                return new Promise(function (resolve, reject) {
                    var rd = new FileReader();
                    rd.onload = function (e) { resolve(e.target.result); };
                    rd.onerror = reject;
                    rd.readAsDataURL(blob);
                });
            });
    }

    /* =========================================================================
       PUBLIC API — SLICE (stub — Phase 172+)
    ========================================================================= */

    function openSlice(sliceType, context) {
        /* Phase 172: resolve sliceType → panel component, inject or postMessage.
           sliceType: 'chat' | 'imagegen' | 'sources' | 'settings'
           context:   { budgetDoc, stagesData, frameId, docId, projectKey }      */
        if (typeof console !== 'undefined') console.log('[mBTAssistant] openSlice stub:', sliceType, context);
    }

    /* =========================================================================
       INIT
    ========================================================================= */

    function init() { _migrateLegacy(); }

    /* =========================================================================
       EXPOSE PUBLIC API
    ========================================================================= */
    return {
        /* Provider */
        getProvider:         getProvider,
        setProvider:         setProvider,
        getApiKey:           getApiKey,
        setApiKey:           setApiKey,
        getImageApiKey:      getImageApiKey,
        setImageApiKey:      setImageApiKey,
        getProviderLabel:    getProviderLabel,
        /* Chat models */
        getChatModel:        getChatModel,
        setChatModel:        setChatModel,
        getGeminiModel:      getGeminiModel,
        setGeminiModel:      setGeminiModel,
        getOpenRouterModel:  getOpenRouterModel,
        setOpenRouterModel:  setOpenRouterModel,
        getLMStudioEndpoint: getLMStudioEndpoint,
        setLMStudioEndpoint: setLMStudioEndpoint,
        getLMStudioModel:    getLMStudioModel,
        setLMStudioModel:    setLMStudioModel,
        /* Image model */
        getImageModel:       getImageModel,
        setImageModel:       setImageModel,
        /* System prompt */
        getSystemPrompt:     getSystemPrompt,
        setSystemPrompt:     setSystemPrompt,
        /* Sources */
        getSources:          getSources,
        addSource:           addSource,
        removeSource:        removeSource,
        updateSource:        updateSource,
        clearSources:        clearSources,
        buildSourceContext:  buildSourceContext,
        /* Chat history */
        getChatHistory:      getChatHistory,
        appendChat:          appendChat,
        clearChat:           clearChat,
        /* Generated assets */
        getAsset:            getAsset,
        saveAsset:           saveAsset,
        removeAsset:         removeAsset,
        /* API callers */
        callChat:            callChat,
        callImageGen:        callImageGen,
        /* Slice (stub) */
        openSlice:           openSlice,
        /* Init */
        init:                init,
        /* Key constants for tools doing direct localStorage reads (deprecated) */
        KEYS:                K,
        ENDPOINTS:           ENDPOINTS,
        IMAGE_ENDPOINTS:     IMAGE_ENDPOINTS
    };

}());

/* Auto-init */
mBTAssistant.init();

if (typeof window !== 'undefined') window.mBTAssistant = mBTAssistant;
