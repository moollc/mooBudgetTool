#!/usr/bin/env node
/* eslint-disable no-console */
/* mBT security browser verify — attach to persistent Playwright CDP (default :9230)
 * Run from workspace root:
 *   node mBT/tests/security-browser-verify.js
 *   set MBT_PLAYWRIGHT_CDP=http://127.0.0.1:9230 && node mBT/tests/security-browser-verify.js
 *
 * Does NOT close the persistent browser (disconnect only).
 */
var path = require('path');
var fs = require('fs');
var childProcess = require('child_process');

var ROOT = path.join(__dirname, '..');
var WORKSPACE = path.join(ROOT, '..');
var CDP_HELPER = path.join(WORKSPACE, 'work', 'preview-mcp', 'playwright-cdp.js');
var REPORT_PATH = path.join(WORKSPACE, 'research', 'mBT-security-browser-verify-report.json');
var BASE_URL = process.env.MBT_VERIFY_URL || 'http://localhost:9173/index.html';

function runPrecheck(script) {
  try {
    var out = childProcess.execSync('node ' + path.join(ROOT, 'tests', script), {
      cwd: WORKSPACE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { script: script, ok: true, output: out.trim() };
  } catch (e) {
    return {
      script: script,
      ok: false,
      output: ((e.stdout || '') + (e.stderr || '')).trim() || e.message
    };
  }
}

function securityPageChecks() {
  return function () {
    var out = {
      origin: window.location.origin,
      toolBridgeGlobal: !!(window.mBTToolBridge && window.mBTToolBridge.originOk),
      forgedBlocked: false,
      sameOriginBudgetSync: -1,
      indexStarCount: -1,
      eventRouterSafePm: false,
      toolBridgeNoStar: false,
      renderSafeMarkdownOk: false,
      errors: []
    };

    try {
      var checks = [];
      checks.push(
        fetch('./src/core/components/ToolBridge.js', { cache: 'no-store' }).then(function (r) {
          return r.text();
        }).then(function (t) {
          out.toolBridgeNoStar = t.indexOf("postMessage(data, '*')") === -1 && t.indexOf('targetOrigin()') !== -1;
        })
      );
      checks.push(
        fetch('./src/core/logic/EventRouter.js', { cache: 'no-store' }).then(function (r) {
          return r.text();
        }).then(function (t) {
          out.eventRouterSafePm = t.indexOf('_safePostMessage') !== -1 && t.indexOf('_pmTargetOrigin') !== -1;
          out.indexStarCount = (t.match(/postMessage\([^)]*['"]\*['"]\)/g) || []).length;
        })
      );
      checks.push(
        fetch('./index.html', { cache: 'no-store' }).then(function (r) {
          return r.text();
        }).then(function (t) {
          var stars = (t.match(/postMessage\([^)]*['"]\*['"]\)/g) || []).length;
          if (out.indexStarCount < 0) out.indexStarCount = stars;
          else out.indexStarCount += stars;
        })
      );
      return Promise.all(checks).then(function () {
        var replies = [];
        var origPM = Window.prototype.postMessage;
        Window.prototype.postMessage = function (data, targetOrigin) {
          try {
            var t = data && data.type;
            if (t === 'budget-sync' || t === 'mbt:tool-ack' || t === 'mbt:tool-reply') {
              replies.push({ type: t, targetOrigin: targetOrigin });
            }
          } catch (x) {}
          return origPM.apply(this, arguments);
        };

        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'mbt:tool-action', action: 'SYNC_FUNDING_SOURCE', payload: {} },
            origin: 'https://evil.example.com',
            source: window
          })
        );

        return new Promise(function (r) {
          setTimeout(r, 1200);
        }).then(function () {
          out.forgedBlocked = replies.filter(function (x) {
            return x.type === 'budget-sync';
          }).length === 0;

          replies.length = 0;
          window.dispatchEvent(
            new MessageEvent('message', {
              data: { type: 'mbt:tool-action', action: 'SYNC_FUNDING_SOURCE', payload: {} },
              origin: window.location.origin,
              source: window
            })
          );
          return new Promise(function (r2) {
            setTimeout(r2, 1500);
          });
        }).then(function () {
          out.sameOriginBudgetSync = replies.filter(function (x) {
            return x.type === 'budget-sync';
          }).length;
          Window.prototype.postMessage = origPM;

          if (window.mBTAIModule && typeof window.mBTAIModule.renderSafeMarkdown === 'function') {
            var raw = window.mBTAIModule.renderSafeMarkdown('**test**');
            out.renderSafeMarkdownOk = raw.indexOf('<') !== -1 || raw.indexOf('test') !== -1;
          }
          return out;
        });
      });
    } catch (e) {
      out.errors.push(String(e.message || e));
      return Promise.resolve(out);
    }
  };
}

function grade(checks, prechecks) {
  var fail = [];
  if (!prechecks.postmessage.ok) fail.push('postmessage precheck');
  if (!prechecks.smoke.ok) fail.push('smoke test');
  if (!checks.forgedBlocked) fail.push('forged origin not blocked');
  if (checks.indexStarCount > 0) fail.push('wildcard postMessage in served sources');
  if (!checks.toolBridgeNoStar) fail.push('ToolBridge still uses star target');
  if (!checks.eventRouterSafePm) fail.push('EventRouter safe postMessage missing');
  return { pass: fail.length === 0, failures: fail };
}

function main() {
  var playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    console.error('playwright not installed');
    process.exit(1);
  }

  var cdpHelper = require(CDP_HELPER);

  return cdpHelper.resolveCdpEndpoint().then(function (cdpInfo) {
    if (!cdpInfo) {
      console.error('No persistent Playwright CDP found. Start Playwright MCP browser or set MBT_PLAYWRIGHT_CDP.');
      process.exit(1);
    }

    console.log('CDP attach: ' + cdpInfo.cdpEndpoint + ' (' + cdpInfo.source + ')');

    var prechecks = {
      postmessage: runPrecheck('security-postmessage-precheck.js'),
      smoke: runPrecheck('security-smoke-test.js'),
      xss: runPrecheck('security-xss-precheck.js')
    };

    return playwright.chromium.connectOverCDP(cdpInfo.cdpEndpoint).then(function (browser) {
      var context = browser.contexts()[0];
      if (!context) {
        throw new Error('CDP browser has no contexts');
      }

      var page = null;
      var pages = context.pages();
      for (var i = 0; i < pages.length; i++) {
        if ((pages[i].url() || '').indexOf('localhost:9173') !== -1) {
          page = pages[i];
          break;
        }
      }

      return Promise.resolve(page ? page : context.newPage()).then(function (p) {
        page = p;
        var consoleErrors = [];
        page.on('console', function (msg) {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        return (page.url().indexOf('localhost:9173') === -1
          ? page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
          : Promise.resolve()
        ).then(function () {
          return new Promise(function (r) { setTimeout(r, 4000); });
        }).then(function () {
          return page.evaluate(securityPageChecks());
        }).then(function (checks) {
          var verdict = grade(checks, prechecks);
          var report = {
            at: new Date().toISOString(),
            cdp: cdpInfo,
            url: page.url(),
            prechecks: prechecks,
            browserChecks: checks,
            consoleErrors: consoleErrors.slice(0, 15),
            verdict: verdict
          };

          fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

          console.log('');
          console.log('security-browser-verify: ' + (verdict.pass ? 'PASS' : 'FAIL'));
          if (!verdict.pass) {
            console.log('Failures: ' + verdict.failures.join(', '));
          }
          console.log('Report: ' + REPORT_PATH);

          if (typeof browser.disconnect === 'function') {
            browser.disconnect();
          }
          process.exit(verdict.pass ? 0 : 1);
        });
      });
    });
  }).catch(function (err) {
    console.error('security-browser-verify FATAL:', err.message || err);
    process.exit(1);
  });
}

main();
