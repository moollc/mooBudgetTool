#!/usr/bin/env node
/* eslint-disable no-console */
/* mBT security precheck — XSS sink regression guard (P2)
 * Run from workspace root: node mBT/tests/security-xss-precheck.js
 *
 * Flags innerHTML / insertAdjacentHTML assignments whose line lacks esc(,
 * renderSafeMarkdown, DOMPurify, textContent, or innerText within ±3 lines.
 * Excludes known-safe static-only blocks (see SKIP_PATTERNS).
 */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SCAN_DIRS = [
  path.join(ROOT, 'src'),
  ROOT + path.sep + 'index.html'
];

var SINK_RE = /\.(innerHTML|insertAdjacentHTML)\s*=/;
var SAFE_NEAR = /esc\s*\(|renderSafeMarkdown|DOMPurify|\.textContent\s*=|\.innerText\s*=|createElement|createTextNode|sanitize\s*\(/;
var SKIP_LINE = /Memory Cleared|Analyzing\.\.|Start a conversation|animate-pulse|Acquiring document|no matches|No matches|placeholder|svg|SVG|<button|<div class=\"text-center|<p class=\"animate-pulse\"/i;

var failures = [];
var scanned = 0;
var skipped = 0;

function collectFiles(acc) {
  for (var i = 0; i < SCAN_DIRS.length; i++) {
    var p = SCAN_DIRS[i];
    if (!fs.existsSync(p)) continue;
    var st = fs.statSync(p);
    if (st.isFile()) { acc.push(p); continue; }
    walk(p, acc);
  }
}

function walk(dir, acc) {
  var entries = fs.readdirSync(dir);
  for (var i = 0; i < entries.length; i++) {
    var full = path.join(dir, entries[i]);
    var stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (entries[i] === 'lib' || entries[i] === 'wasm' || entries[i] === 'rust') continue;
      walk(full, acc);
    } else if (/\.(js|html)$/.test(entries[i])) {
      acc.push(full);
    }
  }
}

function checkFile(filePath) {
  var text = fs.readFileSync(filePath, 'utf8');
  var lines = text.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    if (!SINK_RE.test(lines[i])) continue;
    scanned++;
    if (SKIP_LINE.test(lines[i])) { skipped++; continue; }
    var windowStart = Math.max(0, i - 3);
    var windowEnd = Math.min(lines.length - 1, i + 3);
    var block = lines.slice(windowStart, windowEnd + 1).join('\n');
    if (SAFE_NEAR.test(block)) continue;
    failures.push({
      file: path.relative(ROOT, filePath),
      line: i + 1,
      text: lines[i].trim().slice(0, 120)
    });
  }
}

var files = [];
collectFiles(files);
for (var f = 0; f < files.length; f++) checkFile(files[f]);

console.log('security-xss-precheck: scanned ' + scanned + ' sink(s), skipped ' + skipped + ' static');

if (failures.length) {
  console.error('WARN — sinks without nearby esc/sanitize (review manually):');
  var show = failures.slice(0, 40);
  for (var j = 0; j < show.length; j++) {
    console.error('  ' + show[j].file + ':' + show[j].line + '  ' + show[j].text);
  }
  if (failures.length > show.length) {
    console.error('  ... and ' + (failures.length - show.length) + ' more');
  }
  if (process.env.MBT_XSS_PRECHECK_STRICT === '1') {
    process.exit(1);
  }
}

console.log('PASS (advisory mode — set MBT_XSS_PRECHECK_STRICT=1 to fail on warnings)');
process.exit(0);
