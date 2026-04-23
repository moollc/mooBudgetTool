var wasm = require('C:/Users/Rocket/Desktop/AntiGravity/mBT/src/core/wasm_node/mbt_wasm.js');

var budgetStr = JSON.stringify({
    "budget": 5000,
    "totalCost": 4000
});

console.log("---- RUST WASM OUTPUT ----");
try {
    var output = wasm.reconcile_stage(budgetStr);
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
