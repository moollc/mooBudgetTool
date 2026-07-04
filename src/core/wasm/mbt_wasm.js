/* @ts-self-types="./mbt_wasm.d.ts" */

/**
 * @param {string} reconciliations_json
 * @returns {string}
 */
function aggregate_reconciliations(reconciliations_json) {
    var deferred2_0;
    var deferred2_1;
    try {
        var ptr0 = passStringToWasm0(reconciliations_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        var ret = wasm.aggregate_reconciliations(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {string} payload_json
 * @returns {string}
 */
function diff_sections(payload_json) {
    var deferred2_0;
    var deferred2_1;
    try {
        var ptr0 = passStringToWasm0(payload_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        var ret = wasm.diff_sections(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

function main() {
    wasm.main();
}

/**
 * @param {string} stage_json
 * @returns {string}
 */
function reconcile_stage(stage_json) {
    var deferred2_0;
    var deferred2_1;
    try {
        var ptr0 = passStringToWasm0(stage_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        var ret = wasm.reconcile_stage(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

function __wbg_get_imports() {
    var import0 = {
        __proto__: null,
        __wbindgen_init_externref_table: function() {
            var table = wasm.__wbindgen_externrefs;
            var offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./mbt_wasm_bg.js": import0,
    };
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        var buf = cachedTextEncoder.encode(arg);
        var ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    var len = arg.length;
    var ptr = malloc(len, 1) >>> 0;

    var mem = getUint8ArrayMemory0();

    var offset = 0;

    for (; offset < len; offset++) {
        var code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        var view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        var ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

var cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
var MAX_SAFARI_DECODE_BYTES = 2146435072;
var numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

var cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        var buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

var WASM_VECTOR_LEN = 0;

var wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            return WebAssembly.instantiateStreaming(module, imports).catch(function (e) {
                var validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("'WebAssembly.instantiateStreaming' failed because your server does not serve Wasm with 'application/wasm' MIME type. Falling back to 'WebAssembly.instantiate' which is slower. Original error:\n", e);

                } else { throw e; }
                
                return module.arrayBuffer().then(function (bytes) {
                    return WebAssembly.instantiate(bytes, imports);
                });
            });
        }

        return module.arrayBuffer().then(function (bytes) {
            return WebAssembly.instantiate(bytes, imports);
        });
    } else {
        return WebAssembly.instantiate(module, imports).then(function (instance) {
            if (instance instanceof WebAssembly.Instance) {
                return { instance: instance, module: module };
            } else {
                return instance;
            }
        });
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            module = module.module;
        } else {
            console.warn('using deprecated parameters for \'initSync()\'; pass a single object instead')
        }
    }

    var imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    var instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

function __wbg_init(module_or_path) {
    if (wasm !== undefined) return Promise.resolve(wasm);


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            module_or_path = module_or_path.module_or_path;
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        /* import.meta is illegal in classic scripts; callers must pass the .wasm URL explicitly */
        module_or_path = 'mbt_wasm_bg.wasm';
    }
    var imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    return Promise.resolve(module_or_path).then(function (res) {
        return __wbg_load(res, imports);
    }).then(function (result) {
        return __wbg_finalize_init(result.instance, result.module);
    });
}

window.mBT_wasm = {
    aggregate_reconciliations: aggregate_reconciliations,
    diff_sections: diff_sections,
    main: main,
    reconcile_stage: reconcile_stage,
    initSync: initSync,
    init: __wbg_init
};
