/* ============================================================
   mBT Phase 121: Global Event Router
   Extracted from index.html monolith (L10503-11397).

   Namespace:     window.mBTRouter (aliased to mBT.router at init).
   Initialization: mBT.router.init(ctx) — called from bindAppEventListeners().

   ctx contract — provides closure access to monolith-private state:
     storageKeyPrefix       {string}   — immutable key prefix
     getBudget              {fn}       — returns current budget proxy
     setBudget              {fn}       — assigns new budget proxy
     getCurrentProjectName  {fn}       — returns currentProjectName
     setCurrentProjectName  {fn}       — assigns currentProjectName
     getDisplayCurrency     {fn}       — returns displayCurrency
     setDisplayCurrency     {fn}       — assigns displayCurrency
     getMBTActiveTool       {fn}       — returns mBTActiveTool
     setMBTActiveTool       {fn}       — assigns mBTActiveTool
     getDiffActive          {fn}       — returns _diffActive
     setDiffActive          {fn}       — assigns _diffActive
     getDiffPendingRecord   {fn}       — returns _diffPendingRecord
     setDiffPendingRecord   {fn}       — assigns _diffPendingRecord
     handleProjectNameChange {fn}      — project rename handler
     renderCurrencyBtn      {fn}       — re-renders currency popover button
     fetchExchangeRates     {fn}       — triggers live FX rate fetch
     unsealRealtimeRenderer {fn}       — clears diff seal flag
   ============================================================ */

window.mBTRouter = (function () {

    var _ctx = null;

    /* ============================================================
       PUBLIC METHODS — available before init(), no ctx required
       ============================================================ */

    /* --- Infrastructure Telemetry: connectivity + login UI state --- */
    function resolveConnectivityStatus() {
        var isOnline   = navigator.onLine;
        var isSignedIn = !!(localStorage.getItem('mbt_supabase_auth_token'));
        var isUpdateAvailable = !!(window.mBT && window.mBT.registry && window.mBT.registry.updateStatus && window.mBT.registry.updateStatus.available);
        var btn = document.getElementById('loginBtn');
        if (btn) {
            var updateIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.2em; height:1.2em;"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>';
            btn.className = 'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 shadow-sm flex-shrink-0 cursor-pointer ' +
                (isUpdateAvailable && isSignedIn
                    ? 'border-amber-400 bg-amber-50 text-amber-600'
                    : (isSignedIn
                        ? 'border-blue-400 bg-blue-50 text-blue-600'
                        : (isOnline
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
                            : 'border-rose-400 bg-rose-50 text-rose-600')));
            btn.title     = isUpdateAvailable && isSignedIn ? 'Update Available' : (isSignedIn ? 'Signed In' : (isOnline ? 'mBT Online' : 'mBT Offline'));
            btn.innerHTML = isUpdateAvailable && isSignedIn ? updateIcon : (window.mBTAssets ? window.mBTAssets.user : '');
            btn.onclick = function() {
                if (isUpdateAvailable && isSignedIn) {
                    /* Update available — navigate to Settings > Updates */
                    if (window.mBT && window.mBT.features && window.mBT.features.settings) {
                        window.mBT.features.settings.open('updates');
                    }
                } else if (!isSignedIn) {
                    /* Not logged in — handle login */
                    if (window.mBTRouter && typeof window.mBTRouter.handleLogin === 'function') {
                        window.mBTRouter.handleLogin();
                    }
                }
            };
        }
        var aiBtn = document.getElementById('openAiToolsBtn');
        if (aiBtn) {
            aiBtn.className = 'p-3 text-white rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center ' +
                (isOnline ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-400 cursor-not-allowed');
            if (!isOnline) aiBtn.title = 'AI Consultant Offline';
        }
    }

    /* --- Support Widget (Buy Me a Coffee) --- */
    function showCoffeeWidget() {
        var coffeeIcon = window.mBTAssets ? window.mBTAssets.coffee : '';
        var content =
            '<div class="text-center p-6 bg-yellow-50 min-h-[300px] flex flex-col items-center justify-center">' +
            '<div class="w-20 h-20 bg-[#FFDD00] rounded-3xl flex items-center justify-center text-4xl shadow-xl mb-4 text-black border-4 border-white animate-bounce [&>svg]:w-10 [&>svg]:h-10">' +
            coffeeIcon +
            '</div>' +
            '<h3 class="text-xl font-black uppercase tracking-tighter text-slate-900 mb-2">Fuel the Code</h3>' +
            '<p class="text-xs font-bold text-slate-500 mb-6 max-w-xs leading-relaxed">' +
            'mooBudget is free, offline-first, and built for the Caribbean industry. If it saves you time, consider buying a coffee for the dev team.' +
            '</p>' +
            '<div class="space-y-3 w-full max-w-xs">' +
            '<a href="https://buymeacoffee.com/jaysonmy" target="_blank" class="flex items-center justify-center gap-2 w-full py-4 bg-[#FFDD00] text-black rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-transform active:scale-95">' +
            'Open Support Page' +
            '</a>' +
            '<button onclick="mBTME.close(\'coffeeModal\')" class="w-full py-3 bg-white border border-slate-200 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors">' +
            'Maybe Later' +
            '</button>' +
            '</div></div>';
        if (window.mBTME) mBTME.open('coffee', '', content, 'max-w-sm', { hideHeader: true, noPadding: true });
    }

    /* --- Distribution Share Selector (Preview Handler) --- */
    function openDocumentShareSelector(docId) {
        var budget = _ctx ? _ctx.getBudget() : null;
        if (!budget || !budget.documents) return;
        var doc = null;
        for (var di = 0; di < budget.documents.length; di++) {
            if (budget.documents[di].id === docId) { doc = budget.documents[di]; break; }
        }
        if (!doc) return;

        var shareText = (typeof mBTPublisher !== 'undefined' && mBTPublisher.comm)
            ? mBTPublisher.comm.generateShareSheet(doc)
            : 'Reviewing ' + doc.label;

        var waLink   = 'https://wa.me/?text=' + encodeURIComponent(shareText);
        var mailLink = 'mailto:?subject=' + encodeURIComponent('Document Review: ' + doc.label) + '&body=' + encodeURIComponent(shareText);
        var safeST   = shareText.replace(/'/g, "\\'");
        var assets   = window.mBTAssets || {};

        var content =
            '<div class="p-6 bg-white">' +
            '<div class="text-center mb-6">' +
            '<div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-xl">' +
            (assets.paperPlane || '') + '</div>' +
            '<h3 class="text-sm font-black uppercase tracking-widest text-slate-900">Distribute Document</h3>' +
            '<p class="text-[10px] text-slate-400 font-bold mt-1">' + doc.label + '</p>' +
            '</div>' +
            '<div class="grid grid-cols-2 gap-3 mb-4">' +
            '<a href="' + waLink + '" target="_blank" class="flex flex-col items-center gap-2 p-4 bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl hover:bg-[#25D366]/20 transition-all group no-underline">' +
            '<div class="text-[#25D366] text-2xl group-hover:scale-110 transition-transform">' + (assets.wa || '') + '</div>' +
            '<span class="text-[9px] font-black uppercase tracking-widest text-[#25D366] group-hover:text-[#128c7e]">WhatsApp</span>' +
            '</a>' +
            '<a href="' + mailLink + '" target="_blank" class="flex flex-col items-center gap-2 p-4 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-all group no-underline">' +
            '<div class="text-blue-500 text-2xl group-hover:scale-110 transition-transform">' + (assets.mail || '') + '</div>' +
            '<span class="text-[9px] font-black uppercase tracking-widest text-blue-600">Email</span>' +
            '</a></div>' +
            '<div class="bg-slate-50 p-3 rounded-xl border border-slate-100">' +
            '<label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Quick Copy Message</label>' +
            '<div class="flex gap-2">' +
            '<input type="text" value="' + shareText + '" class="flex-grow bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none" readonly>' +
            '<button onclick="navigator.clipboard.writeText(\'' + safeST + '\'); this.innerHTML=\'Copied!\';" class="px-3 bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-300 transition-colors">Copy</button>' +
            '</div></div></div>';

        if (window.mBTME) mBTME.open('shareSelector', 'Share', content, 'max-w-sm', { hideHeader: true, noPadding: true });
    }

    /* --- Cloud Login: opens Settings → Cloud tab --- */
    function handleLogin() {
        if (typeof mBT !== 'undefined' && mBT.features && mBT.features.settings) {
            mBT.features.settings.open('cloud');
        } else {
            if (window.mBTME) mBTME.alert('Cloud Engine', 'Cloud settings module not found.');
        }
    }

    /* --- Footer Icon Injection: maps slot IDs to SVG assets --- */
    function injectFooterIcons() {
        var assets  = window.mBTAssets || {};
        var mapping = {
            'icon-docs':             assets.file        || '',
            'icon-main-action':      assets.gear        || '',
            'icon-secondary-action': assets.paperPlane  || '',
            'icon-coffee':           assets.coffee      || ''
        };
        var keys = Object.keys(mapping);
        for (var ki = 0; ki < keys.length; ki++) {
            var el = document.getElementById(keys[ki]);
            if (el) el.innerHTML = mapping[keys[ki]];
        }
    }

    /* ============================================================
       PRIVATE HELPERS — used inside _bindListeners
       ============================================================ */

    /* --- Phase 81: CSV Accounting Export helpers --- */
    function escapeCSVField(field) {
        if (field == null) return '';
        var str = String(field);
        if (str.indexOf(',') > -1 || str.indexOf('\n') > -1 || str.indexOf('"') > -1) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    function generateWiseCSV(budget) {
        var lines = ['Source Currency,Recipient Name,Amount,Reference'];
        if (!budget.ledgers || !budget.ledgers.pos) return lines.join('\n');
        var currency = (budget.settings && budget.settings.displayCurrency) || 'USD';
        budget.ledgers.pos.forEach(function (po) {
            if (po.status !== 'Invoiced') return;
            lines.push(
                currency + ',' +
                escapeCSVField(po.vendor || '\u2014') + ',' +
                (parseFloat(po.amount) || 0).toFixed(2) + ',' +
                escapeCSVField(po.id || '')
            );
        });
        return lines.join('\n');
    }

    function generateQuickBooksCSV(budget) {
        var lines = ['Date,Vendor,Amount,Category,Memo'];
        if (!budget.ledgers || !budget.ledgers.pos) return lines.join('\n');
        budget.ledgers.pos.forEach(function (po) {
            if (po.status !== 'Paid') return;
            var category = 'Uncategorized';
            if (budget.sections && budget.sections[po.sectionKey]) {
                category = budget.sections[po.sectionKey].name || po.sectionKey;
            }
            lines.push(
                (po.date || new Date().toISOString().split('T')[0]) + ',' +
                escapeCSVField(po.vendor || '\u2014') + ',' +
                (parseFloat(po.amount) || 0).toFixed(2) + ',' +
                escapeCSVField(category) + ',' +
                escapeCSVField(po.id || '')
            );
        });
        return lines.join('\n');
    }

    function triggerCSVDownload(csvContent, fileName) {
        var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        var url  = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /* --- Phase 117: File Export helpers --- */
    function _mbtForceDownload(blob, filename) {
        var a = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 1000);
    }

    function exportWithPicker(blob, filename) {
        if (!window.showSaveFilePicker) { _mbtForceDownload(blob, filename); return; }
        var ext     = (filename.split('.').pop() || '').toLowerCase();
        var mimeMap = {
            pdf: 'application/pdf',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            moo: 'application/json', json: 'application/json',
            html: 'text/html', csv: 'text/csv', zip: 'application/zip'
        };
        var accept = {};
        accept[mimeMap[ext] || 'application/octet-stream'] = ['.' + ext];
        window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'Budget File', accept: accept }] })
            .then(function (handle)   { return handle.createWritable(); })
            .then(function (writable) { return writable.write(blob).then(function () { return writable.close(); }); })
            .then(function ()         { if (window.mBTME) mBTME.alert('Saved', 'File saved to disk.'); })
            .catch(function (err)     { if (err.name !== 'AbortError' && window.mBTME) mBTME.alert('Save Failed', err.message || 'Could not write file.'); });
    }

    function shareWithOS(blob, filename) {
        if (!navigator.canShare) { if (window.mBTME) mBTME.alert('Not Supported', 'Web Share API is not available in this browser.'); return; }
        var budget = _ctx ? _ctx.getBudget() : null;
        var file   = new File([blob], filename, { type: blob.type });
        if (!navigator.canShare({ files: [file] })) { if (window.mBTME) mBTME.alert('Not Supported', 'This file type cannot be shared via the OS.'); return; }
        navigator.share({ files: [file], title: (budget && budget.projectName) ? budget.projectName + ' \u2014 Budget' : 'Budget Export' })
            .catch(function (err) { if (err.name !== 'AbortError' && window.mBTME) mBTME.alert('Share Failed', err.message || 'Could not share file.'); });
    }

    function showExportChoice(blob, filename) {
        var hasPicker = !!window.showSaveFilePicker;
        var hasShare  = !!(navigator.canShare);
        var escFn     = (window.mBT && window.mBT.ui && window.mBT.ui.render && window.mBT.ui.render.esc)
            ? window.mBT.ui.render.esc
            : function (s) { return s; };
        var assets  = window.mBTAssets || {};
        var content = '<div class="p-6 space-y-4">' +
            '<p class="text-[10px] font-mono text-slate-400 truncate">' + escFn(filename) + '</p>' +
            '<div class="space-y-2">';
        if (hasPicker) {
            content += '<button onclick="window._mbtExChoiceAct(\'pick\')" class="w-full flex items-center gap-4 p-4 bg-slate-900 text-white rounded-xl hover:bg-slate-700 active:scale-95 transition-all">' +
                '<div class="shrink-0">' + (assets.save || '') + '</div>' +
                '<div class="text-left"><div class="text-[11px] font-black uppercase tracking-widest">Save to Disk</div>' +
                '<div class="text-[9px] text-white/50 font-medium">Choose save location on device</div></div></button>';
        }
        if (hasShare) {
            content += '<button onclick="window._mbtExChoiceAct(\'share\')" class="w-full flex items-center gap-4 p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-500 active:scale-95 transition-all">' +
                '<div class="shrink-0">' + (assets.globe || '') + '</div>' +
                '<div class="text-left"><div class="text-[11px] font-black uppercase tracking-widest">Share via OS</div>' +
                '<div class="text-[9px] text-white/50 font-medium">Email, AirDrop, Messages\u2026</div></div></button>';
        }
        content += '<button onclick="window._mbtExChoiceAct(\'download\')" class="w-full flex items-center gap-4 p-4 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 active:scale-95 transition-all">' +
            '<div class="shrink-0">' + (assets.creditCard || '') + '</div>' +
            '<div class="text-left"><div class="text-[11px] font-black uppercase tracking-widest">Browser Download</div>' +
            '<div class="text-[9px] text-slate-500 font-medium">Standard browser save dialog</div></div></button>' +
            '</div></div>';
        window._mbtExChoiceAct = function (action) {
            if (window.mBTME) mBTME.close('export-choice');
            if (action === 'pick')          exportWithPicker(blob, filename);
            else if (action === 'share')    shareWithOS(blob, filename);
            else                            _mbtForceDownload(blob, filename);
        };
        if (window.mBTME) mBTME.open('export-choice', 'Export File', content, 'max-w-sm');
    }

    /* --- Phase 133: persist helper — reconcile totals, save async, ACK source on commit --- */
    function _persistBudget(source, actionName, budget) {
        if (window.mBT_Finance) window.mBT_Finance.reconcile(budget);
        if (window.saveBudget) {
            saveBudget().then(function () {
                if (source) {
                    try { source.postMessage({ type: 'mbt:tool-ack', action: actionName, status: 'success' }, '*'); } catch (er) {}
                }
            });
        }
    }

    /* --- Phase 150: tool broadcast helper --- */
    function _broadcastToTool(type, payload) {
        var iframe = document.querySelector('[data-modal-id="tool-window"] iframe, #global-modal-container iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: type, payload: payload }, '*');
        }
    }

    /* --- Phase 133: centralized postMessage dispatcher extracted from inline listener --- */
    function _handleToolAction(e) {
        if (!e.data || e.data.type !== 'mbt:tool-action') return;
        var action  = e.data.action;
        var payload = e.data.payload || {};
        var budget             = _ctx.getBudget();
        var currentProjectName = _ctx.getCurrentProjectName();

        /* --- reconcile: reload budget from storage --- */
        if (action === 'reconcile' && currentProjectName) {
            mBT.data.load(currentProjectName);

        /* --- Phase 73/78: update-fringes + update-ledgers (consolidated save path) --- */
        } else if ((action === 'update-fringes' || action === 'update-ledgers') && currentProjectName && budget) {
            if (action === 'update-fringes') {
                budget.fringes = Array.isArray(payload.fringes) ? payload.fringes : [];
            } else {
                if (!budget.ledgers) budget.ledgers = { poCounter: 1, pos: [], pettyCash: [] };
                if (Array.isArray(payload.pos))        budget.ledgers.pos        = payload.pos;
                if (Array.isArray(payload.pettyCash))  budget.ledgers.pettyCash  = payload.pettyCash;
                if (payload.poCounter != null)         budget.ledgers.poCounter  = payload.poCounter;
                if (window.render) render();
                if (_ctx.getMBTActiveTool() === 'po') {
                    var _poIframe = document.querySelector('[data-modal-id="tool-window"] iframe, #global-modal-container iframe');
                    if (_poIframe && _poIframe.contentWindow) {
                        _poIframe.contentWindow.postMessage({ type: 'mbt:tool-action', action: 'reload-ledgers', payload: { pos: budget.ledgers.pos, pettyCash: budget.ledgers.pettyCash } }, '*');
                    }
                }
            }
            _persistBudget(e.source, action, budget);

        /* --- close-tool: dismiss tool modal and lifecycle sync --- */
        } else if (action === 'close-tool') {
            if (window.mBTME && mBTME.close) mBTME.close('tool-windowModal');
            _ctx.setMBTActiveTool(null);
            if (window.mBTRealtime && mBTRealtime.isConnected()) mBTRealtime.broadcastFocus('Budget Editor');
            var _rtLiveClose = window.mBTRealtime && mBTRealtime.isConnected();
            if (!_rtLiveClose && window.mBTSync && localStorage.getItem('mbt_supabase_sync_on_reconnect') === 'true' && localStorage.getItem('mbt_supabase_auth_token')) {
                mBTSync.pushAll().catch(function (e2) { console.warn('[mBT] Lifecycle push on tool close failed:', e2); });
            }

        /* --- inject-contact: push a contact as a crew line item --- */
        } else if (action === 'inject-contact' && currentProjectName) {
            if (payload.name && budget) {
                var crewItem = {
                    id:            'crew_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    description:   payload.name,
                    rate:          payload.rate || 0,
                    qty:           1,
                    unit:          'day',
                    contact_id:    payload.email || null,
                    contact_name:  payload.name,
                    contact_phone: payload.phone || null,
                    contact_email: payload.email || null
                };
                if (!budget.globalItems) budget.globalItems = [];
                budget.globalItems.push(crewItem);
                _persistBudget(e.source, action, budget);
                console.log('[mBT] Injected contact:', payload.name);
            }

        /* --- calendar-updated: reload milestones --- */
        } else if (action === 'calendar-updated' && currentProjectName) {
            mBT.data.load(currentProjectName);

        /* --- update-contact-rate: sync edited CRM rate to matching budget line items --- */
        } else if (action === 'update-contact-rate' && budget) {
            var crName = (payload.name || '').toLowerCase();
            var crRate = parseFloat(payload.rate);
            if (crName && crRate && budget.globalItems) {
                var crUpdated = false;
                for (var ci = 0; ci < budget.globalItems.length; ci++) {
                    if ((budget.globalItems[ci].description || '').toLowerCase() === crName) {
                        budget.globalItems[ci].rate = crRate;
                        crUpdated = true;
                    }
                }
                if (crUpdated) {
                    _persistBudget(e.source, action, budget);
                    console.log('[mBT] Contact rate synced:', payload.name, crRate);
                }
            }

        /* --- user-focus-changed: peripheral tool reports focus --- */
        } else if (action === 'user-focus-changed') {
            if (window.mBTRealtime && mBTRealtime.isConnected()) mBTRealtime.broadcastFocus(payload.tool || 'unknown');

        /* --- og-rate-changed: update matching line items with new rate --- */
        } else if (action === 'og-rate-changed' && budget) {
            var ogDesc = (payload.description || '').toLowerCase();
            var newRate = payload.rate;
            if (ogDesc && newRate && budget.globalItems) {
                var ogUpdated = false;
                for (var ri = 0; ri < budget.globalItems.length; ri++) {
                    if ((budget.globalItems[ri].description || '').toLowerCase() === ogDesc) {
                        budget.globalItems[ri].rate = newRate;
                        ogUpdated = true;
                    }
                }
                if (ogUpdated) {
                    _persistBudget(e.source, action, budget);
                    console.log('[mBT] Rate updated for:', payload.description);
                }
            }

        /* --- Phase 64: Share Hub Peer Roster Request --- */
        } else if (action === 'get-peers') {
            if (window.mBTRealtime && typeof mBTRealtime.getPresencePeers === 'function') {
                e.source.postMessage({ type: 'mbt-tools-response', action: 'peers-list', payload: mBTRealtime.getPresencePeers() }, '*');
            } else {
                e.source.postMessage({ type: 'mbt-tools-response', action: 'peers-list', payload: [] }, '*');
            }

        /* --- Phase 64: Share Hub Role Management --- */
        } else if (action === 'role-change' && payload.targetUserId && payload.newRole) {
            if (window.mBTRealtime && mBTRealtime.broadcastRoleChange) mBTRealtime.broadcastRoleChange(payload.targetUserId, payload.newRole);

        /* --- Phase 64: Share Hub Link Revocation --- */
        } else if (action === 'revoke-link' || action === 'revoke-user') {
            window.dispatchEvent(new CustomEvent('mbt:auth-changed', { detail: { evictAll: action === 'revoke-link', userId: payload.userId } }));

        /* --- Phase 68B: approve-pending-edit --- */
        } else if (action === 'approve-pending-edit' && payload.editId) {
            if (window.mBTSync && window.mBTSync.sbPatchPendingEdit) {
                mBTSync.sbPatchPendingEdit(payload.editId, { status: 'approved', updated_at: new Date().toISOString() })
                    .then(function () {
                        if (payload.projectId && payload.budgetSnapshot) return mBTSync.forcePushProject(payload.projectId, payload.budgetSnapshot);
                    })
                    .then(function () {
                        if (window.mBTRealtime && window.mBTRealtime.broadcastApproval && payload.editorUserId) mBTRealtime.broadcastApproval(payload.editorUserId, payload.projectId, 'approved');
                        if (typeof window.mBTClearPendingBadge === 'function') window.mBTClearPendingBadge();
                    })
                    .catch(function (err) { console.error('[mBT] Approval failed:', err); });
            }

        /* --- Phase 68B: reject-pending-edit --- */
        } else if (action === 'reject-pending-edit' && payload.editId) {
            if (window.mBTSync && window.mBTSync.sbPatchPendingEdit) {
                mBTSync.sbPatchPendingEdit(payload.editId, { status: 'rejected', updated_at: new Date().toISOString() })
                    .then(function () {
                        if (window.mBTRealtime && window.mBTRealtime.broadcastApproval && payload.editorUserId) mBTRealtime.broadcastApproval(payload.editorUserId, payload.projectId, 'rejected');
                    })
                    .catch(function (err) { console.error('[mBT] Rejection failed:', err); });
            }

        /* --- Phase 81: export-accounting --- */
        } else if (action === 'export-accounting' && payload.type && currentProjectName && budget) {
            var csvContent = '';
            if (payload.type === 'wise')      csvContent = generateWiseCSV(budget);
            else if (payload.type === 'qb')   csvContent = generateQuickBooksCSV(budget);
            else { console.warn('[mBT] Unknown export type:', payload.type); return; }
            triggerCSVDownload(csvContent, 'mbt_export_' + payload.type + '_' + new Date().toISOString().split('T')[0] + '.csv');

        /* --- Phase 116 Step 5: apply-template --- */
        } else if (action === 'apply-template' && budget) {
            if (payload.templateKey && mBT.features.blueprints && typeof mBT.features.blueprints.applyTemplate === 'function') {
                mBT.features.blueprints.applyTemplate(payload.templateKey, !!payload.withRates, false);
            }
            if (window.mBTME) mBTME.close('tool-window');
            _ctx.setMBTActiveTool(null);

        /* --- Phase 117 Step 4: export-file — Publisher blob via postMessage --- */
        } else if (action === 'export-file' && payload.data && payload.filename) {
            var _arr  = payload.data.split(',');
            var _bstr = atob(_arr[1] || '');
            var _n    = _bstr.length;
            var _u8   = new Uint8Array(_n);
            while (_n--) _u8[_n] = _bstr.charCodeAt(_n);
            showExportChoice(new Blob([_u8], { type: payload.mimeType || 'application/octet-stream' }), payload.filename);

        /* --- load-budget: AI-generated .moo payload from Oracle iframe --- */
        } else if (action === 'load-budget' && payload.budgetData) {
            function sanitizeBudgetNode(node) {
                if (typeof node === 'string') return node.replace(/<[^>]*>/g, '').substring(0, 500);
                if (Array.isArray(node)) return node.map(sanitizeBudgetNode);
                if (node && typeof node === 'object') {
                    var c = {};
                    Object.keys(node).forEach(function (k) { c[k] = sanitizeBudgetNode(node[k]); });
                    return c;
                }
                return node;
            }
            var lbSanitized = sanitizeBudgetNode(payload.budgetData);
            if (!lbSanitized.projectName || typeof lbSanitized.sections !== 'object') {
                if (window.mBTME) mBTME.alert('Invalid Budget', 'The AI returned an incomplete structure. Try again with more detail.');
                return;
            }
            Object.keys(lbSanitized.sections).forEach(function (sName) {
                var sec = lbSanitized.sections[sName];
                if (!sec.id) sec.id = sName.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
                if (sec.isOpen === undefined) sec.isOpen = true;
                if (!Array.isArray(sec.items)) { sec.items = []; return; }
                sec.items = sec.items
                    .filter(function (it) { return it && typeof it.description === 'string'; })
                    .map(function (it, idx) {
                        it.id         = it.id || ('item_' + idx + '_' + Math.random().toString(36).substr(2, 4));
                        it.quantity   = Number(it.quantity)   || 1;
                        it.rate       = Number(it.rate)       || 0;
                        it.multiplier = Number(it.multiplier) || 1;
                        it.actual     = Number(it.actual)     || 0;
                        it.unit       = it.unit     || 'Flat';
                        it.rateType   = it.rateType || 'negotiable';
                        it.crew       = it.crew     || {};
                        return it;
                    });
            });
            lbSanitized.company                = lbSanitized.company                || 'Independent';
            lbSanitized.startDate              = lbSanitized.startDate              || new Date().toISOString().split('T')[0];
            lbSanitized.contingencyPercentage  = Number(lbSanitized.contingencyPercentage)  || 10;
            lbSanitized.salesTaxPercentage     = Number(lbSanitized.salesTaxPercentage)     || 0;
            lbSanitized.discountPercentage     = Number(lbSanitized.discountPercentage)     || 0;
            lbSanitized.documents              = Array.isArray(lbSanitized.documents)    ? lbSanitized.documents    : [];
            lbSanitized.attachments            = Array.isArray(lbSanitized.attachments)  ? lbSanitized.attachments  : [];
            lbSanitized.globalItems            = Array.isArray(lbSanitized.globalItems)  ? lbSanitized.globalItems  : [];
            lbSanitized.aiContext              = lbSanitized.aiContext    || { chat: [], analysis: '' };
            lbSanitized.activityLog            = lbSanitized.activityLog  || [];
            var lbBase = lbSanitized.projectName.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'AI Budget';
            lbSanitized.projectName = lbBase + ' ' + new Date().toISOString().split('T')[0];
            _ctx.setBudget(mBT.data.state.wrap(lbSanitized));
            _ctx.setCurrentProjectName(lbSanitized.projectName);
            mBT.data.save().then(function () { mBT.data.load(lbSanitized.projectName); });
            if (window.mBTME) mBTME.close('tool-window');
            _ctx.setMBTActiveTool(null);
            if (window.mBTME) mBTME.alert('Budget Loaded', '\u201c' + lbSanitized.projectName + '\u201d is now active in the editor.');

        /* --- Phase 150: push-funding — AI tool pushes funding source proposals into the active budget --- */
        } else if (action === 'push-funding' && Array.isArray(payload.sources) && payload.sources.length) {
            if (!budget) {
                if (window.mBTME) mBTME.alert('No Budget Open', 'Open a budget before pushing funding sources.');
                return;
            }
            if (!budget.fundingSources) budget.fundingSources = [];
            var pfAdded = 0;
            for (var pfI = 0; pfI < payload.sources.length; pfI++) {
                var pfSrc = payload.sources[pfI];
                if (!pfSrc || typeof pfSrc.name !== 'string' || !pfSrc.name.trim()) continue;
                /* Deduplicate by name (case-insensitive) — skip if already present */
                var pfName = pfSrc.name.trim();
                var pfExists = false;
                for (var pfJ = 0; pfJ < budget.fundingSources.length; pfJ++) {
                    if ((budget.fundingSources[pfJ].name || '').toLowerCase() === pfName.toLowerCase()) {
                        pfExists = true;
                        break;
                    }
                }
                if (pfExists) continue;
                budget.fundingSources.push({
                    name:         pfName,
                    amount:       parseFloat(pfSrc.amount)  || 0,
                    currency:     pfSrc.currency            || (budget.currency || 'JMD'),
                    cashInBank:   parseFloat(pfSrc.cashInBank) || 0,
                    status:       pfSrc.status              || 'Pending',
                    contactName:  pfSrc.contactName         || '',
                    contactEmail: pfSrc.contactEmail        || '',
                    contactPhone: pfSrc.contactPhone        || '',
                    contractUrl:  pfSrc.contractUrl         || '',
                    notes:        pfSrc.notes               || '',
                    attachments:  []
                });
                pfAdded++;
            }
            if (pfAdded === 0) {
                if (window.mBTME) mBTME.alert('No New Sources', 'All proposed sources already exist in this budget.');
                return;
            }
            mBT.data.save().then(function () {
                if (window.mBTLE) mBTLE.reconcile();
                if (mBT.features && mBT.features.funding && mBT.features.funding.updateCard) {
                    mBT.features.funding.updateCard();
                }
                if (window.mBTAIContext) {
                    mBTAIContext.getCurrentProjectContext().then(function(ctx) {
                        _broadcastToTool('budget-sync', { context: ctx, budgetDoc: budget });
                    });
                }
            });
            if (window.mBTME) mBTME.alert('Funding Sources Added', pfAdded + ' source' + (pfAdded === 1 ? '' : 's') + ' pushed to \u201c' + budget.projectName + '\u201d.');

        /* --- Phase 150: SYNC_FUNDING_SOURCE — AI tool requests current funding state --- */
        } else if (action === 'SYNC_FUNDING_SOURCE') {
            if (window.mBTAIContext) {
                mBTAIContext.getCurrentProjectContext().then(function(ctx) {
                    if (e.source) e.source.postMessage({ type: 'budget-sync', payload: { context: ctx, budgetDoc: budget } }, '*');
                });
            }

        /* --- Phase 63: resolve-diff --- */
        } else if (action === 'resolve-diff' && payload.mergedSections) {
            _ctx.setDiffActive(false);
            _ctx.unsealRealtimeRenderer();
            if (window.mBTME) mBTME.close('tool-window');
            _ctx.setMBTActiveTool(null);
            if (budget) {
                budget.sections    = payload.mergedSections;
                budget.updated_at  = new Date().toISOString();
                mBT.data.save().then(function () {
                    if (window.mBTLE) mBTLE.reconcile();
                    if (window.mBTSync && budget) {
                        mBTSync.forcePushProject(budget.id || budget.projectName, budget)
                            .catch(function (er) { console.warn('[mBT] Force-push after diff resolution failed:', er); });
                    }
                });
                _ctx.setDiffPendingRecord(null);
                if (window.mBTME) mBTME.alert('Conflict Resolved', 'Merged budget saved and pushed to cloud.');
            }

        /* --- Phase 63: abort-diff --- */
        } else if (action === 'abort-diff') {
            _ctx.setDiffActive(false);
            _ctx.setDiffPendingRecord(null);
            _ctx.unsealRealtimeRenderer();
            if (window.mBTME) mBTME.close('tool-window');
            _ctx.setMBTActiveTool(null);
            if (window.mBTME) mBTME.alert('Sync Aborted', 'The pending sync was cancelled. Your local budget is unchanged.');

        /* --- Phase 144: sync-funding-source — AI Funding Strategy data convergence --- */
        /* Publisher iframe sends editorData back after SmartFill PDF generation.
           Saved to budget.aiContext.fundingStrategy for cross-session persistence. */
        } else if (action === 'sync-funding-source' && budget && payload.editorData) {
            if (!budget.aiContext) budget.aiContext = { chat: [], analysis: '' };
            budget.aiContext.fundingStrategy = payload.editorData;
            _persistBudget(e.source, action, budget);
            console.log('[mBT] Funding strategy synced from publisher.');

        /* --- Phase 149.3: Context Ledger rescan / purge from Assistant iframe --- */
        } else if (action === 'ledger-rescan') {
            try {
                if (window.mBTContextLedger && typeof budget !== 'undefined' && budget && budget.projectName) {
                    mBTContextLedger.setActiveProject(budget.projectName).then(function () {
                        return Promise.all([
                            mBTContextLedger.ingestBudget(budget),
                            mBTContextLedger.ingestSidebar()
                        ]);
                    }).catch(function (err) {
                        console.warn('[EventRouter] Ledger sync failed:', err);
                    });
                }
            } catch (lx) { /* ignore */ }

        } else if (action === 'ledger-purge') {
            try {
                if (window.mBTContextLedger) {
                    var days = (payload && payload.olderThanDays) || 90;
                    mBTContextLedger.purge(days);
                }
            } catch (lx) { /* ignore */ }

        /* --- Phase 149.2: Generic document autofill via Context Ledger ---
           Accepts { templateId, fields[], context{}, maxTokens? } and returns a JSON
           object with one key per requested field. Falls back to an empty object on
           any failure so callers never crash. Back-compat: ai-funding-fill rewrites
           to templateId='fundingPackage'. */
        } else if (action === 'ai-funding-fill' || action === 'ai-doc-fill') {
            var _rid = e.data.requestId;
            var _src = e.source;
            var _fields = (payload.fields || []).slice(0, 12);
            var _ctxData = payload.context || {};
            var _templateId = (action === 'ai-funding-fill') ? 'fundingPackage' : (payload.templateId || 'generic');
            var _maxTokens = payload.maxTokens || 6000;
            var _reply = function (obj) {
                if (_src) _src.postMessage({ type: 'mbt:tool-reply', requestId: _rid, payload: obj || {} }, '*');
            };
            if (!window.mBTAIModule || typeof mBTAIModule.callUnifiedAI !== 'function' || !_fields.length) {
                _reply({}); return;
            }

            /* Rescan sidebar and budget first so ledger is fresh before we build the prompt */
            var _syncP = (window.mBTContextLedger && typeof budget !== 'undefined' && budget)
                ? mBTContextLedger.setActiveProject(budget.projectName).then(function() {
                    return Promise.all([mBTContextLedger.ingestBudget(budget), mBTContextLedger.ingestSidebar()]);
                  })
                : Promise.resolve();

            _syncP.catch(function() { return Promise.resolve(); }).then(function () {

            var _provider = mBTAIModule.getSelectedProvider();
            var _apiKey   = mBTAIModule.getStoredApiKey(_provider);
            /* lmstudio does not require a key — allow empty key through */
            if (!_apiKey && _provider !== 'lmstudio') {
                if (_src) _src.postMessage({ type: 'mbt:tool-reply', requestId: _rid, payload: { _error: 'no-api-key' } }, '*');
                return;
            }

            /* Per-template field rules registry — tightly bounds AI output for each known field */
            var TPL_RULES = {
                fundingPackage: {
                    logline:     'one sentence, max 25 words, hooks emotionally',
                    genre:       'short phrase (e.g., "Feature Documentary", "TV Commercial")',
                    format:      'one of: Feature Film | Short Film | Documentary | Series | Commercial | Music Video',
                    synopsis:    '2-3 paragraph plain text, no headings',
                    director:    'full name or empty string',
                    producer:    'full name or empty string',
                    writer:      'full name or empty string'
                },
                callSheet: {
                    weather:     'short phrase e.g. "Partly cloudy, 82F, 30% rain"',
                    notes:       'one or two concise bullet points',
                    safetyNote:  'one sentence hazard/safety call-out based on location'
                },
                crewList: {
                    notes:       'optional one-line commentary'
                },
                pitchDeck: {
                    logline:          'one sentence, max 25 words, emotionally hooks the reader',
                    synopsis:         '2-3 paragraphs plain text, no headings',
                    targetMarket:     'one paragraph on target audience and market positioning',
                    comparables:      'short list of 2-3 comparable titles with brief reason each',
                    directorStatement:'one paragraph, first-person voice, why this story matters to the director',
                    directorBio:      'two to three sentences, third-person, key credits and background',
                    useOfFunds:       'one paragraph explaining how the requested funding will be allocated'
                }
            };

            var rules = TPL_RULES[_templateId] || {};
            var ruleLines = [];
            _fields.forEach(function (f) {
                if (rules[f]) ruleLines.push('- ' + f + ': ' + rules[f]);
                else          ruleLines.push('- ' + f + ': short plain value');
            });

            /* Pull relevant slices from Context Ledger (treatment + script + snapshot + recent receipts) */
            var ctxFragment = '';
            var usedEntries = [];
            if (window.mBTContextLedger) {
                try {
                    var want = ['treatment', 'script', 'budget-snapshot', 'attachment'];
                    /* Receipts only matter for receipt-aware templates */
                    if (_templateId === 'purchaseOrder' || _templateId === 'pettyCash' || _templateId === 'topSheet' || _templateId === 'costReport') {
                        want.push('receipt');
                    }
                    var frag = mBTContextLedger.asPromptFragment({ types: want, maxTokens: _maxTokens });
                    ctxFragment = frag.text || '';
                    usedEntries = frag.usedEntries || [];
                } catch (lex) { /* ledger failed → continue with inline ctx only */ }
            }

            /* Inline quick-context overrides ledger when provided (direct field values known from caller) */
            var inlineCtx = [];
            Object.keys(_ctxData).forEach(function (k) {
                if (k === 'treatment') return; /* treatment is in ledger */
                var v = _ctxData[k];
                if (v == null || v === '') return;
                inlineCtx.push(k + ': ' + String(v).slice(0, 200));
            });

            /* If ledger has no treatment fragment, fall back to direct localStorage read */
            if (!ctxFragment) {
                try {
                    var _rawTreatment = localStorage.getItem('mbt_ai_treatment') || '';
                    if (_rawTreatment.trim()) ctxFragment = '--- TREATMENT ---\n' + _rawTreatment.slice(0, 3000);
                } catch (_le) { /* ignore */ }
            }

            var _hasContext = !!(ctxFragment || inlineCtx.length);
            var _sys = 'You are a professional film production assistant completing a production document. ' +
                       (_hasContext
                           ? 'Derive ALL field values strictly from the project context provided — do not invent facts not supported by it. '
                           : 'No treatment or script has been provided. Use the project name, budget figures, and any known metadata to write professional placeholder values. Clearly base them on what is known. ') +
                       'CRITICAL: Return ONLY a valid JSON object. No prose, no explanation, no markdown fences. ' +
                       'Ensure valid JSON escaping.';

            /* Cap context at 1500 chars for doc fill — keeps prompt small, avoids 503 on Gemini */
            var _prompt = 'Populate these ' + _templateId + ' fields using the project context provided.\n' +
                          'JSON keys to return: ' + _fields.join(', ') + '.\n\n' +
                          (inlineCtx.length ? '--- PROJECT INFO ---\n' + inlineCtx.join('\n') + '\n\n' : '') +
                          (ctxFragment ? ctxFragment.slice(0, 1500) + '\n\n' : 'No treatment provided — use only project name and budget context.\n\n') +
                          '--- FIELD RULES ---\n' + ruleLines.join('\n') + '\n\n' +
                          'Final Answer as JSON Object:';

            /* Single retry on 503 (Gemini high-demand) with 4s backoff */
            function _callWithRetry() {
                return mBTAIModule.callUnifiedAI(_provider, _apiKey, _prompt, _sys)
                    .then(function (resp) {
                        if (typeof resp === 'string' && resp.indexOf('503') > -1 && resp.indexOf('Analysis Failed:') === 0) {
                            return new Promise(function (resolve) { setTimeout(resolve, 4000); })
                                .then(function () { return mBTAIModule.callUnifiedAI(_provider, _apiKey, _prompt, _sys); });
                        }
                        return resp;
                    });
            }

            try {
                _callWithRetry()
                    .then(function (resp) {
                        var out = {};
                        if (typeof resp === 'string') {
                            /* Robust JSON extraction: look for the outermost { } pair */
                            var cleaned = resp.replace(/^\x60\x60\x60json\s*/i, '').replace(/^\x60\x60\x60\s*/i, '').replace(/\s*\x60\x60\x60\s*$/i, '').trim();
                            var startIdx = cleaned.indexOf('{');
                            var endIdx = cleaned.lastIndexOf('}');
                            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                                var jsonStr = cleaned.substring(startIdx, endIdx + 1);
                                try { 
                                    out = JSON.parse(jsonStr); 
                                } catch (je) { 
                                    /* Last ditch repair for Gemma: remove trailing commas or common small errors */
                                    try {
                                        var repaired = jsonStr.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');
                                        out = JSON.parse(repaired);
                                    } catch (je2) { out = {}; }
                                }
                            }
                        }
                        /* Surface API-level failures so the caller can show the real error */
                        if (typeof resp === 'string' && resp.indexOf('Analysis Failed:') === 0) {
                            _reply({ _error: resp.replace('Analysis Failed: ', '') });
                            return;
                        }
                        var cleanOut = {};
                        _fields.forEach(function (f) {
                            if (out[f] != null && String(out[f]).trim() !== '') cleanOut[f] = out[f];
                        });
                        if (window.mBTContextLedger && Object.keys(cleanOut).length) {
                            try {
                                mBTContextLedger.add({
                                    type: 'template-fill',
                                    name: _templateId + ' autofill',
                                    text: JSON.stringify(cleanOut, null, 2),
                                    meta: { templateId: _templateId, fields: _fields, provider: _provider, usedEntries: usedEntries }
                                });
                            } catch (lx) { /* ignore */ }
                        }
                        _reply(cleanOut);
                    })
                    .catch(function (err) { console.warn('[mBT] ai-doc-fill failed:', err); _reply({ _error: err.message || 'ai-failed' }); });
            } catch (ex) { console.warn('[mBT] ai-doc-fill threw:', ex); _reply({}); }

            }); /* end _sidebarP.then */
        }
    }

    /* ============================================================
       INIT — accepts ctx object, binds all event listeners
       ============================================================ */

    function init(ctx) {
        _ctx = ctx;
        /* Expose window.openDocumentShareSelector for inline onclick handlers */
        window.openDocumentShareSelector = openDocumentShareSelector;
        _bindListeners();
    }

    /* ============================================================
       PRIVATE: _bindListeners — registers all DOM/window events
       ============================================================ */

    function _bindListeners() {

        /* --- Currency Popover: toggle, select, outside-click dismiss --- */
        document.addEventListener('click', function (e) {
            var container = document.getElementById('currencyContainer');
            var popover   = document.getElementById('currencyPopover');
            var btn       = e.target.closest('#currencyBtn');
            var choice    = e.target.closest('[data-currency-code]');

            if (choice) {
                _ctx.setDisplayCurrency(choice.dataset.currencyCode);
                localStorage.setItem(_ctx.storageKeyPrefix + 'currency', choice.dataset.currencyCode);
                if (typeof mBTLE !== 'undefined') mBTLE.reconcile();
                if (window.render) render();
                _ctx.renderCurrencyBtn();
                if (popover) popover.classList.add('hidden');
                return;
            }

            if (btn) {
                if (popover) {
                    _ctx.renderCurrencyBtn();
                    popover.classList.toggle('hidden');
                }
                return;
            }

            if (popover && container && !container.contains(e.target)) {
                popover.classList.add('hidden');
            }
        });

        /* --- Phase 121 Bug Fix: #projectName on change (not input) --- */
        document.body.addEventListener('change', function (e) {
            if (e.target.id === 'projectName') _ctx.handleProjectNameChange(e);
        });

        window.addEventListener('online',  function () { resolveConnectivityStatus(); _ctx.fetchExchangeRates(); });
        window.addEventListener('offline', resolveConnectivityStatus);

        /* Phase 50C.8 Step C: Broadcast editor focus when main window regains focus */
        window.addEventListener('focus', function () {
            if (window.mBTRealtime && mBTRealtime.isConnected()) mBTRealtime.broadcastFocus('Budget Editor');
        });

        /* ========= Phase 59: Auto-Hide Navigation HUD ========= */
        window.mBTNavHUD = (function () {
            var hideTimer  = null;
            var _left = null, _right = null, _nav = null;
            var _expandedW = 0;
            var _collapsed = false;
            var _active    = false;

            function els() {
                _left  = _left  || document.getElementById('nav-left');
                _right = _right || document.getElementById('nav-right');
                _nav   = _nav   || document.getElementById('nav');
            }

            function measure() {
                els();
                if (!_nav) return;
                _expandedW = _nav.offsetWidth;
            }

            function hide() {
                els();
                if (!_nav) return;
                _collapsed = true;
                _left.style.maxWidth = '0'; _left.style.opacity = '0'; _left.style.pointerEvents = 'none';
                _right.style.maxWidth = '0'; _right.style.opacity = '0'; _right.style.pointerEvents = 'none';
                _nav.style.width = '52px'; _nav.style.padding = '6px'; _nav.style.borderRadius = '50%';
            }

            function show() {
                clearTimeout(hideTimer);
                els();
                if (!_nav) return;
                _collapsed = false;
                _left.style.maxWidth = '400px'; _left.style.opacity = '1'; _left.style.pointerEvents = '';
                _right.style.maxWidth = '400px'; _right.style.opacity = '1'; _right.style.pointerEvents = '';
                _nav.style.width = _expandedW + 'px'; _nav.style.padding = '6px 16px'; _nav.style.borderRadius = '28px';
                if (_active) hideTimer = setTimeout(hide, 3000);
            }

            function onNavClick(e) {
                if (_collapsed) { e.stopPropagation(); e.preventDefault(); show(); }
            }

            function onDocClick(e) {
                if (!_collapsed && _nav && !_nav.contains(e.target)) hide();
            }

            function onLeave() {
                clearTimeout(hideTimer);
                hideTimer = setTimeout(hide, 400);
            }

            function apply() {
                els();
                if (!_nav) return;
                _active = localStorage.getItem('mBT_autoHideNav') === 'true';
                if (_active) {
                    measure(); show();
                    _nav.addEventListener('mouseenter', show);
                    _nav.addEventListener('mouseleave', onLeave);
                    _nav.addEventListener('click', onNavClick, true);
                    document.addEventListener('click', onDocClick);
                } else {
                    clearTimeout(hideTimer);
                    _collapsed = false;
                    _nav.style.width = ''; _nav.style.padding = ''; _nav.style.borderRadius = '';
                    _left.style.maxWidth = ''; _left.style.opacity = ''; _left.style.pointerEvents = '';
                    _right.style.maxWidth = ''; _right.style.opacity = ''; _right.style.pointerEvents = '';
                    _nav.removeEventListener('mouseenter', show);
                    _nav.removeEventListener('mouseleave', onLeave);
                    _nav.removeEventListener('click', onNavClick, true);
                    document.removeEventListener('click', onDocClick);
                }
            }

            window.addEventListener('resize', function () { if (_active && !_collapsed) measure(); });

            return { apply: apply, show: show, hide: hide };
        })();
        mBTNavHUD.apply();

        /* --- Feat 92.5. Pill Layout — Dynamic footer button rebalancer --- */
        /* Phase 100.1: Object.assign extends mBT.ui.footer preserving Footer.js render() */
        mBT.ui.footer = Object.assign(mBT.ui.footer || {}, (function () {
            var _ids = [
                'stagesFooterBtn', 'docsFooterBtn', 'contactsFooterBtn',
                'actualsToggleBtn', 'searchFooterBtn', 'toolsDrawerBtn',
                'calendarFooterBtn', 'secondaryActionBtn', 'footerCoffeeBtn',
                'footerHelpBtn', 'activityFeedBtn',
                'cloudShareBtn', 'undoBtn', 'redoBtn', 'sync-status-pill'
            ];

            function _getBtns() {
                return _ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
            }

            function _restoreDefaults() {
                var navLeft  = document.getElementById('nav-left');
                var navRight = document.getElementById('nav-right');
                if (!navLeft || !navRight) return;
                /* Task 2: remove 400px inline ceiling so restored layout is unbiased */
                navLeft.style.maxWidth  = '';
                navRight.style.maxWidth = '';
                var undoEl = document.getElementById('undoBtn');
                var redoEl = document.getElementById('redoBtn');
                if (undoEl) navLeft.appendChild(undoEl);
                if (redoEl) navRight.insertBefore(redoEl, navRight.firstChild);
                _getBtns().filter(function (btn) {
                    return btn.id !== 'undoBtn' && btn.id !== 'redoBtn';
                }).forEach(function (btn) {
                    if (parseInt(btn.getAttribute('data-pill-order'), 10) <= 4) navLeft.insertBefore(btn, undoEl || null);
                    else navRight.appendChild(btn);
                });
            }

            function rebalance() {
                var navLeft  = document.getElementById('nav-left');
                var navRight = document.getElementById('nav-right');
                if (!navLeft || !navRight) return;
                var undoBtn = document.getElementById('undoBtn');
                var redoBtn = document.getElementById('redoBtn');

                /* Task 1 (Revision): clear stale flex values — w-fit parent defeats flex:1 on children */
                navLeft.style.flex           = '';
                navLeft.style.justifyContent = '';
                navRight.style.flex          = '';

                /* visibility via classList — toggle targets button elements by ID only;
                   inner <span> labels with 'hidden md:block' are child nodes, unaffected (Task 3 guard).
                   searchFooterBtn/toolsDrawerBtn start with 'hidden' in template — toggle correctly removes it. */
                var hiddenRaw = localStorage.getItem('mBT_footerHiddenBtns');
                var hidden = [];
                try { hidden = hiddenRaw ? JSON.parse(hiddenRaw) : []; } catch (ex) { hidden = []; }
                _getBtns().forEach(function (btn) {
                    btn.style.display = '';                              /* clear any stale inline display */
                    btn.classList.toggle('hidden', hidden.indexOf(btn.id) > -1);
                });

                if (localStorage.getItem('mBT_pillLayout') !== 'true') {
                    _restoreDefaults();
                    if (typeof mBTNavHUD !== 'undefined') mBTNavHUD.apply();
                    return;
                }
                navLeft.appendChild(undoBtn);
                navRight.insertBefore(redoBtn, navRight.firstChild);

                /* classList check — offsetParent is unreliable while hidden class is applied */
                var active = _getBtns().filter(function (el) {
                    return !el.classList.contains('hidden') && el.id !== 'undoBtn' && el.id !== 'redoBtn';
                });
                active.sort(function (a, b) {
                    return parseInt(a.getAttribute('data-pill-order'), 10) - parseInt(b.getAttribute('data-pill-order'), 10);
                });
                var mid = Math.ceil(active.length / 2);
                active.forEach(function (btn, i) {
                    if (i < mid) navLeft.insertBefore(btn, undoBtn);
                    else navRight.appendChild(btn);
                });

                /* Clear inline constraints from mBTNavHUD animation; native flex handles symmetry */
                navLeft.style.maxWidth  = '';
                navRight.style.maxWidth = '';
                navLeft.style.minWidth  = '';
                navRight.style.minWidth = '';
                if (typeof mBTNavHUD !== 'undefined') mBTNavHUD.apply();
            }

            rebalance();
            return { rebalance: rebalance };
        })());

        /* ========= Tool Bridge: unified event bus for cross-tool integration ========= */
        window.addEventListener('message', _handleToolAction);

        /* --- Phase 63 / Phase 62 bridge: relay RBAC eviction into open diff iframe --- */
        window.addEventListener('mbt:auth-changed', function () {
            if (!_ctx.getDiffActive()) return;
            var modal = document.querySelector('[data-modal-id="tool-window"] iframe, #global-modal-container iframe');
            if (modal && modal.contentWindow) modal.contentWindow.postMessage({ type: 'mbt:rbac-eviction' }, '*');
            _ctx.setDiffActive(false);
            _ctx.setDiffPendingRecord(null);
            _ctx.unsealRealtimeRenderer();
        });

        /* ========= Phase 96: Sync Status Badge Listener ========= */
        window.addEventListener('mbt:sync-status', function (e) {
            var pill = document.getElementById('sync-status-pill');
            if (!pill) return;
            var status = (e.detail && e.detail.status) || 'offline';
            var dot    = pill.querySelector('span');
            if (status === 'syncing') {
                pill.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20';
                if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse';
                pill.lastChild.textContent = 'Syncing';
            } else if (status === 'saved') {
                pill.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse';
                pill.lastChild.textContent = 'Saved';
            } else if (status === 'error') {
                pill.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20';
                if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-400';
                pill.lastChild.textContent = 'Error';
            } else {
                pill.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-slate-500/10 text-slate-400 border border-slate-500/20';
                pill.lastChild.textContent = 'Offline';
            }
        });

        /* ========= Phase 96: Toast System ========= */
        window.addEventListener('mbt:activity-log', function (e) {
            var detail  = e.detail || {};
            var type    = detail.type    || 'Activity';
            var message = detail.message || '';
            var toolIframe = document.querySelector('[data-modal-id="tool-window"] iframe, #global-modal-container iframe');
            if (toolIframe && toolIframe.contentWindow && _ctx.getMBTActiveTool() === 'share') {
                toolIframe.contentWindow.postMessage({ type: 'mbt:activity-log', payload: detail }, '*');
            } else {
                if (typeof window.mBTAddActivityBadge === 'function') window.mBTAddActivityBadge();
            }
            if (detail.toast !== false && typeof mBTSurfaceToast !== 'undefined') {
                mBTSurfaceToast.info(type + ': ' + message, 3000);
            }
        });

        /* mbt:peer-typing-status — brief typing indicator toast */
        window.addEventListener('mbt:peer-typing-status', function (e) {
            var detail = e.detail || {};
            var user   = detail.displayName || 'Peer';
            var field  = detail.field       || '';
            if (typeof mBTSurfaceToast !== 'undefined') {
                mBTSurfaceToast.info(user + ' is editing' + (field ? ' "' + field + '"' : ''), 2000);
            }
        });

        /* --- Phase 130.A: Command Palette action bridge ---
           openPalette lives in the monolith IIFE; exposed via mBT.features.search (Phase 130.B).
           Registration here overrides any stale monolith registration set before router.init(). */
        mBT.core.action('command-palette', function () {
            if (window.mBT && mBT.features && mBT.features.search) mBT.features.search.open();
        });
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */

    return {
        init:                      init,
        resolveConnectivityStatus: resolveConnectivityStatus,
        showCoffeeWidget:          showCoffeeWidget,
        openDocumentShareSelector: openDocumentShareSelector,
        handleLogin:               handleLogin,
        injectFooterIcons:         injectFooterIcons
    };

})();
