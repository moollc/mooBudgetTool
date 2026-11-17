/*
 * Voice input for the Assistant.
 *
 * Three ways to turn speech into text, picked by the "Voice input" setting:
 *   browser   the browser's own speech engine (default). Free, live words.
 *   provider  record, then send short clips to the AI provider's transcription
 *             endpoint (OpenAI, Gemini, Grok, OpenRouter).
 *   device    record, then run a small Whisper model inside the browser. Needs a
 *             one time download, works offline after that.
 *
 * All three keep listening through pauses until stop() is called. The caller
 * (AIModule) stops on Enter or on a second tap of the mic and leaves the spoken
 * text in the box.
 *
 * Host object the caller passes to start():
 *   read()            current text in the input box
 *   write(text)       replace the text in the input box
 *   notify(title,msg) show a plain sentence to the user
 *   state(name)       'listening' | 'transcribing' (for the placeholder)
 *   ended()           the session ended by itself (error), reset the mic button
 */
window.mBTVoice = (function () {
    'use strict';

    var MODE_KEY = 'mbt_voice_mode';
    var DEVICE_KEY = 'mbt_voice_device_model';
    var WORKER_URL = './src/lib/voice/whisper-worker.js';
    var DEVICE_MB = 46;
    var inflight = 0;            /* clips sent for transcription and not back yet */
    var browserBroken = false;   /* the browser's service failed once this page load */

    /* Transcription endpoints. Prices checked 2026-10-21 against each vendor's
       published rates; they are shown to the user, not used for billing. */
    var PROVIDERS = {
        openai:     { label: 'OpenAI',     price: 'about $0.003 per minute' },
        gemini:     { label: 'Gemini',     price: 'about $0.002 per minute' },
        grok:       { label: 'Grok',       price: 'about $0.002 per minute' },
        openrouter: { label: 'OpenRouter', price: 'about $0.0002 per minute' }
    };
    var NO_AUDIO = {
        anthropic: 'Anthropic has no speech to text service',
        deepseek:  'DeepSeek has no speech to text service',
        lmstudio:  'LM Studio has no speech to text service'
    };

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

    function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
    function join(a, b) {
        a = String(a || ''); b = trim(b);
        if (!b) return a;
        if (!a) return b;
        return /\s$/.test(a) ? a + b : a + ' ' + b;
    }
    function speechCtor() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
    function langCode() { try { return navigator.language || 'en-US'; } catch (e) { return 'en-US'; } }
    function isEnglish() { return /^en/i.test(langCode()); }
    function canRecord() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
            (window.AudioContext || window.webkitAudioContext));
    }

    function getMode() {
        var m = lsGet(MODE_KEY);
        return (m === 'provider' || m === 'device') ? m : 'browser';
    }
    function setMode(m) {
        if (m !== 'provider' && m !== 'device') m = 'browser';
        lsSet(MODE_KEY, m);
    }

    function currentProvider() {
        return window.mBTAIModule && window.mBTAIModule.getSelectedProvider
            ? window.mBTAIModule.getSelectedProvider() : 'gemini';
    }
    function providerKey(p) {
        return window.mBTAIModule && window.mBTAIModule.getStoredApiKey
            ? window.mBTAIModule.getStoredApiKey(p) : '';
    }

    /* Can the chosen AI provider transcribe, and is it ready to? */
    function providerInfo(p) {
        p = p || currentProvider();
        if (PROVIDERS[p]) {
            return { ok: !!providerKey(p), supported: true, label: PROVIDERS[p].label, price: PROVIDERS[p].price,
                reason: providerKey(p) ? '' : 'Add your ' + PROVIDERS[p].label + ' key in Settings first' };
        }
        return { ok: false, supported: false, label: p,
            price: '', reason: (NO_AUDIO[p] || 'This provider has no speech to text service') + ', so pick OpenAI, Gemini, Grok or OpenRouter as the AI provider to use it' };
    }

    function deviceReady() { return !!lsGet(DEVICE_KEY); }
    function deviceModelId() { return isEnglish() ? 'Xenova/whisper-tiny.en' : 'Xenova/whisper-tiny'; }

    /* ---------- plain sentences ---------- */
    var MSG = {
        blocked: 'The microphone is blocked for this site, so allow it in the site\u2019s permissions (the lock icon next to the address, or the three dot menu in an app window) and tap the mic again.',
        noMic: 'No microphone was found, so plug one in or choose one in the system sound settings and tap the mic again.',
        insecure: 'The microphone only works on a secure page, so open the app from its https address and tap the mic again.',
        dictationOff: 'This browser\u2019s speech service is turned off, so turn on Dictation (System Settings, Keyboard on a Mac, or Settings, General, Keyboard on an iPhone) or pick another Voice input in Assistant settings.',
        network: 'The browser\u2019s speech service could not be reached, so check the internet connection or pick another Voice input in Assistant settings.',
        nothing: 'Voice input does not work in this browser, so type your request or use the microphone key on the phone keyboard.',
        nothingYet: 'This browser has no built in speech service, so in Assistant settings, Voice input, download the voice model (about ' + DEVICE_MB + ' MB) or choose an AI provider that can transcribe, or type or use the microphone key on the phone keyboard.',
        needKey: 'Voice input through the AI provider needs a key, so add it in Settings or pick another Voice input in Assistant settings.',
        needDevice: 'The on device voice model is not downloaded yet, so open Assistant settings, Voice input, and tap Download voice model (about ' + DEVICE_MB + ' MB, once).',
        busyMic: 'The microphone is busy in another app, so close that app and tap the mic again.',
        micStart: 'The microphone could not start, so tap the mic again.',
        deviceStopped: 'The on device voice model stopped working, so tap the mic to try again or pick another Voice input in Assistant settings.'
    };

    function micError(e) {
        var n = e && e.name ? String(e.name) : '';
        if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return MSG.blocked;
        if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return MSG.noMic;
        if (n === 'NotReadableError' || n === 'AbortError') return MSG.busyMic;
        return MSG.micStart;
    }

    /* ---------- audio helpers ---------- */
    function resampleTo16k(buf, rate) {
        var out, ratio, n, i, start, end, j, sum, cnt;
        if (rate === 16000) return buf;
        ratio = rate / 16000;
        n = Math.floor(buf.length / ratio);
        out = new Float32Array(n);
        for (i = 0; i < n; i++) {
            start = Math.floor(i * ratio);
            end = Math.min(buf.length, Math.floor((i + 1) * ratio));
            sum = 0; cnt = 0;
            for (j = start; j < end; j++) { sum += buf[j]; cnt++; }
            out[i] = cnt ? sum / cnt : 0;
        }
        return out;
    }

    function wavBytes(samples) {
        var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), i, s;
        function str(o, t) { var k; for (k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); }
        str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        str(36, 'data'); v.setUint32(40, n * 2, true);
        for (i = 0; i < n; i++) {
            s = Math.max(-1, Math.min(1, samples[i]));
            v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return buf;
    }

    function toBase64(buf) {
        var bytes = new Uint8Array(buf), bin = '', i, step = 0x8000;
        for (i = 0; i < bytes.length; i += step) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
        return btoa(bin);
    }

    /* ---------- provider transcription ---------- */
    function httpFail(status) {
        var e = new Error('http ' + status);
        e.status = status;
        return e;
    }
    function checkOk(r) {
        if (r.ok) return r.json();
        throw httpFail(r.status);
    }

    function transcribeWithProvider(provider, key, samples) {
        var wav = wavBytes(samples), lang = langCode().split('-')[0], fd, blob;
        if (provider === 'openai' || provider === 'grok') {
            blob = new Blob([wav], { type: 'audio/wav' });
            fd = new FormData();
            if (provider === 'openai') {
                fd.append('model', 'gpt-4o-mini-transcribe');
                fd.append('language', lang);
                fd.append('file', blob, 'speech.wav');
                return fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST', headers: { 'Authorization': 'Bearer ' + key }, body: fd
                }).then(checkOk).then(function (j) { return trim(j && j.text); });
            }
            fd.append('language', lang);
            fd.append('file', blob, 'speech.wav'); /* xAI wants the file last */
            return fetch('https://api.x.ai/v1/stt', {
                method: 'POST', headers: { 'Authorization': 'Bearer ' + key }, body: fd
            }).then(checkOk).then(function (j) { return trim(j && j.text); });
        }
        if (provider === 'openrouter') {
            return fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'openai/whisper-large-v3-turbo', language: lang, input_audio: { data: toBase64(wav), format: 'wav' } })
            }).then(checkOk).then(function (j) { return trim(j && j.text); });
        }
        if (provider === 'gemini') {
            return fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
                body: JSON.stringify({ contents: [{ parts: [
                    { text: 'Transcribe this audio word for word. Reply with only the spoken words. If nobody speaks, reply with nothing.' },
                    { inline_data: { mime_type: 'audio/wav', data: toBase64(wav) } }
                ] }] })
            }).then(checkOk).then(function (j) {
                var c = j && j.candidates && j.candidates[0], p = c && c.content && c.content.parts && c.content.parts[0];
                return trim(p && p.text);
            });
        }
        return Promise.reject(new Error('unsupported'));
    }

    function providerFailText(provider, e) {
        var label = (PROVIDERS[provider] && PROVIDERS[provider].label) || 'The AI provider';
        if (e && (e.status === 401 || e.status === 403)) return label + ' did not accept the key, so check it in Settings and tap the mic again.';
        if (e && e.status === 429) return label + ' says there have been too many requests, so wait a moment and tap the mic again.';
        if (e && e.status) return label + ' could not read the audio (code ' + e.status + '), so tap the mic to try again.';
        return 'Could not reach ' + label + ', so check the internet connection and tap the mic again.';
    }

    /* ---------- on device model (module worker) ---------- */
    var dev = { worker: null, ready: null, pending: {}, nextId: 1, idle: null, onProgress: null };

    function devKill() {
        if (dev.idle) { clearTimeout(dev.idle); dev.idle = null; }
        if (dev.worker) { try { dev.worker.terminate(); } catch (e) { /* gone */ } }
        dev.worker = null; dev.ready = null; dev.pending = {};
    }
    function devTouch() {
        if (dev.idle) clearTimeout(dev.idle);
        /* Free about 300 MB after a quiet minute; the model reloads from the cache. */
        dev.idle = setTimeout(devKill, 90000);
    }
    function devLoad() {
        if (dev.ready) return dev.ready;
        dev.ready = new Promise(function (resolve, reject) {
            var w;
            try { w = new Worker(WORKER_URL, { type: 'module' }); } catch (e) { reject(e); return; }
            dev.worker = w;
            w.onmessage = function (ev) {
                var d = ev.data || {}, p;
                if (d.type === 'progress') { if (dev.onProgress) dev.onProgress(d.pct); }
                else if (d.type === 'ready') { resolve(); }
                else if (d.type === 'loaderror') { reject(new Error(d.message || 'load')); }
                else if (d.type === 'result' || d.type === 'texterror') {
                    p = dev.pending[d.id]; delete dev.pending[d.id];
                    if (p) { if (d.type === 'result') p.resolve(d.text); else p.reject(new Error(d.message || 'run')); }
                }
            };
            w.onerror = function () { reject(new Error('worker')); };
            w.postMessage({ type: 'load', model: deviceModelId() });
        });
        dev.ready.then(null, function () { devKill(); });
        return dev.ready;
    }
    function transcribeOnDevice(samples) {
        return devLoad().then(function () {
            return new Promise(function (resolve, reject) {
                var id = dev.nextId++;
                dev.pending[id] = { resolve: resolve, reject: reject };
                devTouch();
                dev.worker.postMessage({ type: 'run', id: id, audio: samples }, [samples.buffer]);
            });
        });
    }
    function downloadDevice(onProgress) {
        dev.onProgress = onProgress || null;
        return devLoad().then(function () {
            lsSet(DEVICE_KEY, deviceModelId());
            dev.onProgress = null;
            devTouch();
        }, function (e) { dev.onProgress = null; throw e; });
    }
    function removeDevice() {
        devKill();
        lsSet(DEVICE_KEY, '');
        try { localStorage.removeItem(DEVICE_KEY); } catch (e) { /* ignore */ }
        if (window.caches && caches.delete) return caches.delete('transformers-cache').then(function () { return true; }, function () { return false; });
        return Promise.resolve(true);
    }

    /* ---------- engine 1: the browser's speech recognition ---------- */
    function browserEngine(host, onFatal) {
        var Ctor = speechCtor(), rec = null, stopped = false, base = '', fin = '', fast = 0, heard = false, startedAt = 0, timer = null;

        function show(interim) { host.write(join(join(base, fin), interim)); }

        function begin() {
            var r;
            try { r = new Ctor(); } catch (e) { onFatal('start'); return; }
            rec = r;
            r.continuous = true;
            r.interimResults = true;
            try { r.lang = langCode(); } catch (eL) { /* default */ }
            fin = '';
            heard = false;
            startedAt = new Date().getTime();
            /* Each result list holds the whole utterance so far; rebuild from it
               every time so a correction never doubles. */
            r.onresult = function (ev) {
                var i, f = '', t = '', x;
                for (i = 0; i < ev.results.length; i++) {
                    x = ev.results[i][0].transcript;
                    if (ev.results[i].isFinal) f = join(f, x); else t += x;
                }
                heard = true; fast = 0;
                /* Some engines (iOS Safari after a pause) drop the list and start
                   over. A list that shrinks to a fraction of what was heard is a
                   restart, so keep what was heard. */
                if (fin && f.length < fin.length * 0.5 && (f === '' || fin.indexOf(f) !== 0)) {
                    base = join(base, fin);
                }
                fin = f;
                show(trim(t));
            };
            r.onaudiostart = function () { heard = true; };
            r.onerror = function (ev) {
                var c = ev && ev.error ? String(ev.error) : 'unknown';
                if (c === 'no-speech' || c === 'aborted') return;      /* onend restarts */
                stopped = true;
                onFatal(c);
            };
            /* Chrome ends the session after a few seconds of quiet. That is not the
               user stopping, so start again with what was heard kept in the box. */
            r.onend = function () {
                var quick;
                if (stopped) return;
                base = join(base, fin); fin = '';
                host.write(base);
                quick = (new Date().getTime() - startedAt) < 1000 && !heard;
                fast = quick ? fast + 1 : 0;
                if (fast >= 4) { stopped = true; onFatal('start'); return; }
                timer = setTimeout(function () { if (!stopped) begin(); }, quick ? 400 : 120);
            };
            try { r.start(); } catch (eS) { stopped = true; onFatal('start'); }
        }

        base = host.read();
        begin();
        host.state('listening');
        return {
            stop: function () {
                var r = rec;
                stopped = true;
                if (timer) { clearTimeout(timer); timer = null; }
                /* Whatever is showing in the box, interim words included, stays. */
                if (r) {
                    r.onresult = null; r.onerror = null; r.onend = null;
                    try { r.stop(); } catch (e) { /* already stopped */ }
                }
                return Promise.resolve();
            }
        };
    }

    /* ---------- engine 2 and 3: record, cut at pauses, transcribe each part ---------- */
    function recorderEngine(host, transcribe, onFatal, kind, provider) {
        var AC = window.AudioContext || window.webkitAudioContext;
        var ctx = new AC(), stream = null, src = null, proc = null, mute = null, dead = false;
        var pre = [], seg = null, quietBlocks = 0, loudBlocks = 0, floor = 0.004, queue = Promise.resolve(), busy = 0;
        var failed = false;

        function setBusy(d) { busy += d; inflight += d; host.state(busy > 0 ? 'transcribing' : 'listening'); }

        function concat(chunks) {
            var n = 0, i, out, o = 0;
            for (i = 0; i < chunks.length; i++) n += chunks[i].length;
            out = new Float32Array(n);
            for (i = 0; i < chunks.length; i++) { out.set(chunks[i], o); o += chunks[i].length; }
            return out;
        }

        function cut() {
            var all, samples, rate = ctx.sampleRate;
            if (!seg) return;
            all = concat(seg.chunks);
            seg = null; quietBlocks = 0;
            if (all.length < rate * 0.35) return;                     /* a click, not speech */
            samples = resampleTo16k(all, rate);
            setBusy(1);
            queue = queue.then(function () {
                if (failed) return null;
                return transcribe(samples);
            }).then(function (text) {
                text = trim(text);
                /* Models invent "[BLANK_AUDIO]" or "(silence)" for noise. Drop those. */
                if (text && !/^[\[\(].*[\]\)]$/.test(text)) host.write(join(host.read(), text));
            }, function (e) {
                if (failed) return;
                failed = true;
                onFatal(kind === 'provider' ? { text: providerFailText(provider, e) } : { text: MSG.deviceStopped });
            }).then(function () { setBusy(-1); });
        }

        function onBlock(ev) {
            var d = ev.inputBuffer.getChannelData(0), copy = new Float32Array(d.length), i, sum = 0, rms, thr, rate = ctx.sampleRate;
            if (dead) return;
            copy.set(d);
            for (i = 0; i < d.length; i++) sum += d[i] * d[i];
            rms = Math.sqrt(sum / d.length);
            thr = Math.max(0.012, floor * 3.5);
            if (rms > thr) {
                loudBlocks++; quietBlocks = 0;
                if (!seg && loudBlocks >= 2) { seg = { chunks: pre.slice(0) }; }
            } else {
                loudBlocks = 0; quietBlocks++;
                if (!seg) floor = floor * 0.95 + rms * 0.05;
            }
            if (seg) {
                seg.chunks.push(copy);
                if (quietBlocks * d.length / rate > 1.0) cut();                 /* 1 s pause */
                else if (seg && seg.chunks.length * d.length / rate > 24) cut();   /* never hold more than 24 s */
            } else {
                pre.push(copy);
                if (pre.length > 4) pre.shift();
            }
        }

        function release() {
            dead = true;
            try { if (proc) { proc.onaudioprocess = null; proc.disconnect(); } } catch (e) { /* ignore */ }
            try { if (src) src.disconnect(); } catch (e2) { /* ignore */ }
            try { if (stream) { var tr = stream.getTracks(), i; for (i = 0; i < tr.length; i++) tr[i].stop(); } } catch (e3) { /* ignore */ }
            try { ctx.close(); } catch (e4) { /* ignore */ }
        }

        if (ctx.resume) { try { ctx.resume(); } catch (eR) { /* resumes on gesture */ } }
        navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
            .then(function (s) {
                if (dead) { stream = s; release(); return; }
                stream = s;
                src = ctx.createMediaStreamSource(s);
                proc = ctx.createScriptProcessor(4096, 1, 1);
                mute = ctx.createGain(); mute.gain.value = 0;
                src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
                proc.onaudioprocess = onBlock;
                host.state('listening');
            }, function (e) {
                dead = true;
                try { ctx.close(); } catch (e5) { /* ignore */ }
                onFatal({ text: micError(e) });
            });

        return {
            stop: function () {
                var wait;
                if (!dead) { cut(); }
                release();
                wait = queue;
                return wait.then(function () { return null; });
            }
        };
    }

    /* ---------- choose and start ---------- */
    function fatalFromCode(code) {
        if (code === 'not-allowed') return MSG.blocked;
        if (code === 'service-not-allowed') return MSG.dictationOff;
        if (code === 'audio-capture') return MSG.noMic;
        if (code === 'network') return MSG.network;
        if (code === 'language-not-supported') return 'This browser’s speech service does not know the language ' + langCode() + ', so pick another Voice input in Assistant settings.';
        return canRecord() ? MSG.nothingYet : MSG.nothing;
    }

    /* What to try, in order, when the browser engine is missing or its service fails. */
    function fallbackKind() {
        var pi;
        if (!canRecord()) return '';
        if (deviceReady()) return 'device';
        pi = providerInfo();
        if (pi.ok) return 'provider';
        return '';
    }

    function start(host) {
        var mode = getMode(), session = { stop: function () { return Promise.resolve(); } }, current = null, finished = false;

        function finish(text) {
            if (finished) return;
            finished = true;
            if (current) { try { current.stop(); } catch (e) { /* ignore */ } }
            if (text) host.notify('Voice Input', text);
            host.ended();
        }

        function runRecorder(kind) {
            var pi, key, prov;
            if (!canRecord()) {
                finish(window.isSecureContext === false ? MSG.insecure : MSG.nothing);
                return;
            }
            if (kind === 'provider') {
                pi = providerInfo();
                if (!pi.supported) { finish(pi.reason + '.'); return; }
                if (!pi.ok) { finish(MSG.needKey); return; }
                /* Pin provider and key together for the whole recording, so a provider
                   change in settings mid recording cannot send one provider's key to another. */
                prov = currentProvider();
                key = providerKey(prov);
                current = recorderEngine(host, function (s) { return transcribeWithProvider(prov, key, s); },
                    function (f) { finish(f.text); }, 'provider', prov);
            } else {
                if (!deviceReady()) { finish(MSG.needDevice); return; }
                current = recorderEngine(host, transcribeOnDevice, function (f) { finish(f.text); }, 'device');
            }
        }

        if (mode === 'provider' || mode === 'device') {
            runRecorder(mode);
        } else if (!speechCtor() || browserBroken) {
            mode = fallbackKind();
            if (mode) runRecorder(mode);
            else finish(window.isSecureContext === false ? MSG.insecure : (canRecord() ? MSG.nothingYet : MSG.nothing));
        } else {
            current = browserEngine(host, function (code) {
                var fb;
                /* A permission refusal needs the same microphone, so no fallback helps. */
                if (code === 'service-not-allowed' || code === 'network' || code === 'start' || code === 'language-not-supported') {
                    fb = fallbackKind();
                    browserBroken = true;
                    if (fb && !finished) {
                        host.notify('Voice Input', 'The browser’s speech service is not available, so tap the mic again to speak and it will use ' + (fb === 'device' ? 'the voice model on this device' : providerInfo().label) + ' instead.');
                        finish('');
                        return;
                    }
                }
                finish(fatalFromCode(code));
            });
        }

        session.stop = function () {
            var c = current;
            finished = true;
            return c ? c.stop() : Promise.resolve();
        };
        return session;
    }

    return {
        start: start,
        getMode: getMode,
        setMode: setMode,
        providerInfo: providerInfo,
        deviceReady: deviceReady,
        deviceModelId: deviceModelId,
        downloadDevice: downloadDevice,
        removeDevice: removeDevice,
        pending: function () { return inflight; },
        canUse: function () { return !!speechCtor() || canRecord(); },
        DEVICE_MB: DEVICE_MB,
        _wavBytes: wavBytes,
        _resample: resampleTo16k
    };
}());
