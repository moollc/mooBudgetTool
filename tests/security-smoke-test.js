#!/usr/bin/env node
/* eslint-disable no-console */
/* mBT security smoke tests — ToolBridge + markdown sanitize (P3)
 * Run: node mBT/tests/security-smoke-test.js
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = [];

function fail(msg) { failures.push(msg); }

var bridgeSrc = fs.readFileSync(path.join(ROOT, 'src/core/components/ToolBridge.js'), 'utf8');
var mockWindow = {
  location: { origin: 'http://127.0.0.1:9173' },
  parent: {
    postMessage: function (data, origin) {
      mockWindow._lastPost = { data: data, origin: origin };
    }
  }
};
vm.runInNewContext(bridgeSrc, { window: mockWindow, console: console });
if (!mockWindow.mBTToolBridge) fail('ToolBridge did not attach to window');
else {
  mockWindow.mBTToolBridge.postToParent({ type: 'test' });
  if (!mockWindow._lastPost || mockWindow._lastPost.origin !== 'http://127.0.0.1:9173') {
    fail('postToParent must use window.location.origin');
  }
  if (!mockWindow.mBTToolBridge.originOk({ origin: 'http://127.0.0.1:9173' })) {
    fail('originOk should accept same origin');
  }
  if (mockWindow.mBTToolBridge.originOk({ origin: 'http://evil.test' })) {
    fail('originOk should reject foreign origin');
  }
}

var aiSrc = fs.readFileSync(path.join(ROOT, 'src/core/logic/AIModule.js'), 'utf8');
var aiWindow = {
  marked: { parse: function () { return '<img src=x onerror=alert(1)>'; } },
  DOMPurify: { sanitize: function (html) { return html.replace(/onerror/gi, ''); } },
  mBT: { ui: { render: { esc: function (s) { return String(s).replace(/</g, '&lt;'); } } } }
};
vm.runInNewContext(aiSrc, { window: aiWindow, console: console });
if (!aiWindow.mBTAIModule || typeof aiWindow.mBTAIModule.renderSafeMarkdown !== 'function') {
  fail('mBTAIModule.renderSafeMarkdown missing');
} else {
  var out = aiWindow.mBTAIModule.renderSafeMarkdown('hello');
  if (out.indexOf('onerror') !== -1) fail('renderSafeMarkdown must sanitize marked output');
}

function walk(dir) {
  var entries = fs.readdirSync(dir);
  for (var i = 0; i < entries.length; i++) {
    var full = path.join(dir, entries[i]);
    var stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (entries[i] === 'lib' || entries[i] === 'node_modules' || entries[i] === 'tests') continue;
      walk(full);
    } else if (/\.(js|html)$/.test(entries[i])) {
      var text = fs.readFileSync(full, 'utf8');
      if (/postMessage\([^)]*,\s*['"]\*['"]\)/.test(text)) {
        fail('wildcard postMessage target in ' + path.relative(ROOT, full));
      }
    }
  }
}
walk(ROOT);

if (failures.length) {
  console.error('security-smoke-test FAIL:');
  for (var j = 0; j < failures.length; j++) console.error('  ' + failures[j]);
  process.exit(1);
}

console.log('security-smoke-test PASS');
process.exit(0);
