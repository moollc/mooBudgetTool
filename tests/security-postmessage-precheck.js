#!/usr/bin/env node
/* eslint-disable no-console */
/* mBT security precheck — postMessage origin guards (P1 regression guard)
 * Run from workspace root: node mBT/tests/security-postmessage-precheck.js
 */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var TOOL_GLOB_DIRS = [
  path.join(ROOT, 'src', 'tools'),
  path.join(ROOT, 'src', 'core', 'ui')
];

var failures = [];
var wildcardHits = [];
var ok = 0;

function walk(dir, acc) {
  if (!fs.existsSync(dir)) return acc;
  var entries = fs.readdirSync(dir);
  for (var i = 0; i < entries.length; i++) {
    var full = path.join(dir, entries[i]);
    var stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (entries[i] === 'lib' || entries[i] === 'wasm' || entries[i] === 'rust' || entries[i] === 'node_modules') continue;
      walk(full, acc);
    } else if (/\.(html|js)$/.test(entries[i])) {
      acc.push(full);
    }
  }
  return acc;
}

function checkInbound(filePath) {
  var text = fs.readFileSync(filePath, 'utf8');
  if (text.indexOf("addEventListener('message'") === -1 && text.indexOf('addEventListener("message"') === -1) return;
  if (text.indexOf('originOk') !== -1 || text.indexOf('.origin !== window.location.origin') !== -1) {
    ok++;
    return;
  }
  failures.push(path.relative(ROOT, filePath));
}

function scanWildcards(filePath) {
  var text = fs.readFileSync(filePath, 'utf8');
  if (/postMessage\([^)]*,\s*['"]\*['"]\)/.test(text)) {
    wildcardHits.push(path.relative(ROOT, filePath));
  }
}

var files = [];
for (var d = 0; d < TOOL_GLOB_DIRS.length; d++) walk(TOOL_GLOB_DIRS[d], files);

for (var f = 0; f < files.length; f++) checkInbound(files[f]);

var coreFiles = [];
walk(path.join(ROOT, 'src'), coreFiles);
coreFiles.push(path.join(ROOT, 'index.html'));
for (var c = 0; c < coreFiles.length; c++) scanWildcards(coreFiles[c]);

console.log('security-postmessage-precheck: ' + ok + ' guarded inbound listener file(s)');

if (failures.length) {
  console.error('FAIL — message listeners without origin guard:');
  for (var j = 0; j < failures.length; j++) console.error('  ' + failures[j]);
  process.exit(1);
}

if (wildcardHits.length) {
  console.error('FAIL — postMessage wildcard target origin:');
  for (var w = 0; w < wildcardHits.length; w++) console.error('  ' + wildcardHits[w]);
  process.exit(1);
}

console.log('PASS');
process.exit(0);
