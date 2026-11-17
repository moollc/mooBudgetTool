/*
 * Runs a small Whisper model inside the browser for Voice input "On this device".
 * Loaded as a module worker by src/core/logic/VoiceInput.js, only after the user
 * chooses to download the model. The library is pinned; the model files are
 * cached by the browser after the first download.
 */
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js';

var asr = null;

function load(model) {
    var files = {};
    env.allowLocalModels = false;
    return pipeline('automatic-speech-recognition', model, {
        device: 'wasm',
        dtype: 'q8',
        /* The default graph optimiser rejects the 8 bit decoder in this runtime. */
        session_options: { graphOptimizationLevel: 'basic' },
        progress_callback: function (p) {
            var k, loaded = 0, total = 0;
            if (p.status === 'progress' && p.total) {
                files[p.file] = { l: p.loaded, t: p.total };
                for (k in files) { loaded += files[k].l; total += files[k].t; }
                self.postMessage({ type: 'progress', pct: Math.min(99, Math.round(loaded / total * 100)) });
            }
        }
    });
}

self.onmessage = function (ev) {
    var d = ev.data;
    if (d.type === 'load') {
        load(d.model).then(function (p) {
            asr = p;
            self.postMessage({ type: 'progress', pct: 100 });
            self.postMessage({ type: 'ready' });
        }, function (e) {
            self.postMessage({ type: 'loaderror', message: String(e && e.message || e) });
        });
    } else if (d.type === 'run') {
        asr(d.audio).then(function (out) {
            self.postMessage({ type: 'result', id: d.id, text: out && out.text ? out.text : '' });
        }, function (e) {
            self.postMessage({ type: 'texterror', id: d.id, message: String(e && e.message || e) });
        });
    }
};
