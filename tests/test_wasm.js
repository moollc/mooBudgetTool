/* Node smoke test for the canonical wasm build (src/core/wasm/).
   The browser wrapper attaches to window, so shim it, then init synchronously from disk. */
var fs = require('fs');
var path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'src', 'core', 'wasm', 'mbt_wasm.js'));

var wasmBytes = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'wasm', 'mbt_wasm_bg.wasm'));
window.mBT_wasm.initSync({ module: wasmBytes });

var budgetStr = JSON.stringify({
    "budget": 5000,
    "totalCost": 4000
});

console.log("---- RUST WASM OUTPUT ----");
try {
    var output = window.mBT_wasm.reconcile_stage(budgetStr);
    console.log("Stage JSON Output:");
    console.log(output);

    var parsed = JSON.parse(output);
    if (parsed.variance === 1000 && parsed.status === 'under') {
        console.log("TEST SUCCESSFUL!");
    } else {
        console.error("TEST FAILED: Logic error.");
    }
} catch (e) {
    console.error("WASM ERROR", e);
}
