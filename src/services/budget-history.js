/* Durable per-budget edits. Pending drafts never replace the owner's master. */
(function () {
    'use strict';
    var chains = {}, active = null, mounted = [], applying = false, epochs = {}, refreshing = null, resubmit = false;
    var ignored = { activityLog: 1, updated_at: 1, collab_project_id: 1, revision: 1, isOpen: 1, subtotal: 1, grandTotal: 1, productionFeeAmount: 1, total: 1, variance: 1 };
    var priceTags = ['rateOverride', 'rateSource', 'baseRate', 'userPrice', 'userPriceAt', 'userPriceId', 'userPriceUserId'];
    function copy(value) { return value === undefined ? null : JSON.parse(JSON.stringify(value)); }
    function actor() {
        var session = window.mBTCollab && mBTCollab.getSession();
        if (session && session.id) return session.id;
        var id = localStorage.getItem('mbt_history_local_actor');
        if (!id) { id = 'local:' + mBTBatch2.uuid(); localStorage.setItem('mbt_history_local_actor', id); }
        return id;
    }
    function key(b, project) { return 'mbt_history:' + (project || b._historyBudgetId || b.projectName) + ':' + actor(); }
    function journalKey(budget) {
        if (!budget) return key({ projectName: '' }, null);
        return key(budget, budget.collab_project_id || null);
    }
    function serialize(k, task) {
        var result = (chains[k] || Promise.resolve()).catch(function () {}).then(task);
        chains[k] = result;
        return result;
    }
    function request(path, body) {
        var config = window.mBTCollabConfig;
        if (!config || !window.mBTCollab || !mBTCollab.getSession() || !navigator.onLine) return Promise.reject(new Error('History is saved locally. Reconnect and sign in to sync.'));
        var headers = mBTCollab.getAuthHeaders(); headers.Prefer = 'return=representation';
        return fetch(config.API_URL + '/rest/v1/' + path, { method: body ? 'POST' : 'GET', headers: headers, body: body ? JSON.stringify(body) : undefined }).then(function (res) {
            return res.json().then(function (data) { if (!res.ok) throw new Error(data.message || 'History HTTP ' + res.status); return data; });
        });
    }
    function load(k, b) {
        return localforage.getItem(k).then(function (journal) {
            return journal || { observed: copy(b), canonical: null, revision: 0, entries: [], outbox: [], sequence: 0 };
        });
    }
    function differences(before, after, path, edits) {
        if (JSON.stringify(before) === JSON.stringify(after)) return;
        if (before && after && typeof before === 'object' && typeof after === 'object') {
            if (Array.isArray(before) && Array.isArray(after)) {
                var identified = before.concat(after).every(function (row) { return row && typeof row === 'object' && row.id; });
                if (identified) {
                    var sameIds = before.length === after.length && before.every(function (row) { return after.some(function (next) { return row.id === next.id; }); });
                    if (sameIds && before.map(function (row) { return row.id; }).join('|') !== after.map(function (row) { return row.id; }).join('|')) {
                        edits.push({ path: path, before_value: copy(before), before_present: true, after_value: copy(after), operation: 'set', tags: {} });
                        return;
                    }
                    var ids = {};
                    before.concat(after).forEach(function (row) { ids[row.id] = true; });
                    Object.keys(ids).forEach(function (id) {
                        var old = before.filter(function (row) { return row.id === id; })[0];
                        var next = after.filter(function (row) { return row.id === id; })[0];
                        differences(old, next, path.concat('@' + id), edits);
                    });
                    return;
                }
            } else if (!Array.isArray(before) && !Array.isArray(after)) {
                var keys = {}, rateEdit = before.rate !== undefined && after.rate !== undefined && (before.rate !== after.rate || before.userPriceId !== after.userPriceId);
                Object.keys(before).concat(Object.keys(after)).forEach(function (k) { keys[k] = true; });
                Object.keys(keys).forEach(function (k) {
                    if (ignored[k] || k.charAt(0) === '_' || k === '__proto__' || k === 'constructor' || (path.length === 0 && (k === 'id' || k === 'owner_user_id'))) return;
                    if (rateEdit && priceTags.indexOf(k) !== -1) return;
                    if (k === 'rate' && rateEdit) {
                        var tags = {};
                        priceTags.forEach(function (tag) { if (after[tag] !== undefined) tags[tag] = copy(after[tag]); });
                        edits.push({ path: path.concat(k), before_value: copy(before[k]), before_present: before[k] !== undefined, after_value: copy(after[k]), operation: 'set', tags: tags });
                    } else differences(before[k], after[k], path.concat(k), edits);
                });
                return;
            }
        }
        edits.push({ path: path, before_value: copy(before), before_present: before !== undefined, after_value: copy(after), operation: after === undefined ? 'delete' : 'set', tags: {} });
    }
    function open(budget) {
        if (!budget || !budget.projectName) return Promise.resolve();
        if (budget.collab_project_id) budget.historyEnabled = true;
        var project = budget.collab_project_id || null, k = key(budget, project);
        active = { key: k, project: project, budget: budget.projectName, actor: actor() };
        return serialize(k, function () { return load(k, budget).then(function (journal) { return localforage.setItem(k, journal); }); }).then(function () { if (project) tellKept(project); });
    }
    function addDrafts(journal, edits, user, project, revision) {
        edits.forEach(function (edit) {
            edit.id = mBTBatch2.uuid(); edit.user_id = user; edit.project_id = project;
            edit.created_at = new Date().toISOString(); edit.base_revision = revision;
            edit.status = project ? 'pending' : 'local';
            journal.entries.push(edit);
            if (project && user.indexOf('local:') !== 0) journal.outbox.push(edit);
        });
    }
    function record(budget) {
        if (applying || !budget || !budget.projectName) return Promise.resolve();
        if (budget.collab_project_id) budget.historyEnabled = true;
        var snapshot = copy(budget), project = snapshot.collab_project_id || null, k = key(snapshot, project), user = actor(), startEpoch = epochs[k] || 0;
        active = { key: k, project: project, budget: snapshot.projectName, actor: user };
        return serialize(k, function () {
            return load(k, snapshot).then(function (journal) {
                var edits = [], replaced = (epochs[k] || 0) !== startEpoch;
                differences(journal.observed, snapshot, [], edits);
                /* A master applied while this save waited already took the screen's unsaved changes as drafts (keepUnsaved), so skip what a pending draft already holds. The baseline that replacement set stays: the older snapshot must not replace it. */
                if (replaced) edits = edits.filter(function (edit) {
                    return !journal.entries.some(function (row) { return (row.status === 'pending' || row.status === 'local') && same(row.path, edit.path) && same(row.after_value, edit.after_value); });
                });
                addDrafts(journal, edits, user, project, journal.revision);
                if (!replaced) journal.observed = snapshot;
                return localforage.setItem(k, journal);
            });
        }).then(function () { draw(); if (project && navigator.onLine) return sync(); });
    }
    function fetchPages(project, sequence, rows) {
        return request('project_edits?project_id=eq.' + encodeURIComponent(project) + '&sequence=gt.' + sequence + '&order=sequence.asc&limit=100').then(function (page) {
            rows = rows.concat(page);
            if (page.length === 100) return fetchPages(project, page[page.length - 1].sequence, rows);
            return rows;
        });
    }
    function recoveryKey(project, who) { return 'mbt_history_recovery:' + project + ':' + who; }
    function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
    /* Local changes the journal does not already hold as drafts. Exchange rate bookkeeping is rewritten by every device on its own, so it never counts as a change. */
    function uncovered(journal, base, local) {
        var edits = [], a = copy(base), b = copy(local);
        if (a) delete a.exchangeRateState;
        if (b) delete b.exchangeRateState;
        differences(a, b, [], edits);
        return edits.filter(function (edit) {
            return !journal.entries.some(function (row) { return row.status !== 'rejected' && same(row.path, edit.path) && same(row.after_value, edit.after_value); });
        });
    }
    /* Plain words, once per kept copy. The app shows one alert at a time, so wait for any alert already open; open() asks again if the page closes first. */
    function tellKept(project, tries) {
        var k = recoveryKey(project, actor());
        return localforage.getItem(k).then(function (saved) {
            var fresh = ((saved && saved.copies) || []).filter(function (row) { return !row.told; });
            if (!fresh.length || !window.mBTME || !mBTME.alert) return;
            var open = document.getElementById('alertModal');
            if (open && open.getBoundingClientRect().width > 0 && (tries || 0) < 20) { setTimeout(function () { tellKept(project, (tries || 0) + 1); }, 1500); return; }
            fresh.forEach(function (row) { row.told = true; });
            return localforage.setItem(k, saved).then(function () {
                mBTME.alert('Your local copy was kept', 'This shared budget was brought up to date with the owner’s version. Your earlier copy on this device was different, so it was saved first. Nothing was sent to the owner. Open Share, then Proposals, to open your copy as its own budget or to send your changes as proposals.');
            });
        }).catch(function (err) { console.warn('[History]', err.message); });
    }
    /* Before the first master replaces a shared budget on this device, keep any local version that differs from it. */
    function keepLocalCopy(project, local, canonical, journal) {
        if (!uncovered(journal, canonical, local).length) return Promise.resolve(false);
        var k = recoveryKey(project, actor());
        return localforage.getItem(k).then(function (saved) {
            saved = saved || { project: project, actor: actor(), copies: [] };
            if (saved.copies.some(function (row) { return same(row.budget, local); })) return false;
            saved.copies.push({ id: mBTBatch2.uuid(), savedAt: new Date().toISOString(), revision: journal.revision, projectName: local.projectName, budget: local, restoredAs: null, sentAt: null, sentCount: 0, told: false });
            return localforage.setItem(k, saved).then(function () { return true; });
        }).then(function (stored) { if (stored) tellKept(project); return stored; });
    }
    function updateCopy(context, id, change) {
        return localforage.getItem(recoveryKey(context.project, context.actor)).then(function (saved) {
            var row = saved && saved.copies.filter(function (item) { return item.id === id; })[0];
            if (!row) return;
            change(row);
            return localforage.setItem(recoveryKey(context.project, context.actor), saved);
        });
    }
    /* Restore: the kept version becomes its own local budget. Nothing is sent. */
    function openCopy(context, item) {
        var base = (item.projectName || 'Shared budget') + ' (my local copy)', name = base, n = 1;
        function free() {
            return localforage.getItem('prodBudget_v5_' + name).then(function (found) {
                if (!found) return name;
                n += 1; name = base + ' ' + n;
                return free();
            });
        }
        return free().then(function (chosen) {
            var b = copy(item.budget);
            b.projectName = chosen;
            delete b.collab_project_id; delete b.historyEnabled; delete b._historyBudgetId;
            var key = 'prodBudget_v5_' + chosen;
            var saving = window.mBT && mBT.data && mBT.data.storage ? mBT.data.storage.save(key, b) : localforage.setItem(key, b);
            return Promise.resolve(saving).then(function () {
                try { if (window.mBT && mBT.ui && mBT.ui.toolbar && mBT.ui.toolbar.renderProjectMgmt) mBT.ui.toolbar.renderProjectMgmt(); } catch (err) { console.warn('[History]', err.message); }
                return updateCopy(context, item.id, function (row) { row.restoredAs = chosen; });
            });
        });
    }
    /* Submit a kept copy only after a button press, using the current server mode. */
    function sendCopy(context, item) {
        return serialize(context.key, function () {
            return load(context.key, window.budget).then(function (journal) {
                var base = copy(journal.canonical || journal.observed), mine = copy(item.budget);
                [base, mine].forEach(function (b) { if (b) { b.collab_project_id = context.project; b.historyEnabled = true; } });
                var edits = uncovered(journal, base, mine);
                edits.forEach(function (edit) {
                    edit.id = mBTBatch2.uuid(); edit.user_id = context.actor; edit.project_id = context.project;
                    edit.created_at = new Date().toISOString(); edit.base_revision = journal.revision; edit.status = 'pending';
                    journal.entries.push(edit); journal.outbox.push(edit);
                });
                return localforage.setItem(context.key, journal).then(function () {
                    return updateCopy(context, item.id, function (row) { row.sentAt = new Date().toISOString(); row.sentCount = edits.length; });
                });
            });
        }).then(function () { return sync(); });
    }
    /* Changes typed on the screen whose delayed save is still waiting become drafts against the revision the screen was showing, the same way record() would make them. They are stored before the screen is replaced; if another edit arrives while storing, the check repeats. Exchange rate bookkeeping never counts. */
    function keepUnsaved(project, journal, k, revision) {
        var local = window.budget, state = window.mBT && mBT.data && mBT.data.state;
        /* Only a delayed save that has not run yet means the screen holds changes nobody has journaled. A save that already ran has called record(), which diffs its own snapshot after the refresh. */
        if (!state || !state._savePending || !local || local.collab_project_id !== project || !journal.observed) return Promise.resolve();
        var snapshot = copy(local), before = copy(journal.observed), edits = [];
        delete snapshot.exchangeRateState; delete before.exchangeRateState;
        differences(before, snapshot, [], edits);
        if (!edits.length) return Promise.resolve();
        addDrafts(journal, edits, actor(), project, revision);
        journal.observed = copy(local);
        resubmit = true;
        return localforage.setItem(k, journal).then(function () { return keepUnsaved(project, journal, k, revision); });
    }
    function replaceScreen(project, journal, canonical) {
        /* Drafts are retained in journal entries, not overlaid as accepted values. */
        journal.observed = copy(canonical);
        journal.screenReplaced = true;
        var ek = key(canonical, project);
        epochs[ek] = (epochs[ek] || 0) + 1;
        applying = true;
        try {
            window.budget = window.mBT && mBT.data ? mBT.data.state.wrap(canonical) : canonical;
            window.currentProjectName = canonical.projectName;
            if (window.mBTLE && mBTLE.reconcile) mBTLE.reconcile();
            if (window.render) render();
            var frames = document.querySelectorAll('iframe');
            for (var i = 0; i < frames.length; i++) {
                var child = frames[i].contentWindow;
                try { if (child && child.location.origin === window.location.origin) child.postMessage({ type: 'mbt:tool-action', action: 'owner-budget-update', payload: copy(canonical) }, window.location.origin); } catch (err) {}
            }
        } finally { applying = false; }
        /* The master is saved just below. A delayed save queued by the value it replaced (or by the reconcile above) would send that older value back as a new edit. */
        var state = window.mBT && mBT.data && mBT.data.state;
        if (state) { clearTimeout(state._saveTimer); state._savePending = false; }
        var snapshot = copy(window.budget);
        localStorage.setItem('prodBudget_v5_lastLoaded', JSON.stringify({ name: snapshot.projectName, ts: Date.now() }));
        journal.observed = copy(snapshot);
        return localforage.setItem('prodBudget_v5_' + snapshot.projectName, snapshot).then(function () {
            if (window.mBT && mBT.data && mBT.data.storage) return mBT.data.storage.save('prodBudget_v5_' + snapshot.projectName, snapshot);
        });
    }
    function applyCanonical(project, journal, master) {
        journal.owner = master.owner_user_id;
        journal.collabMode = master.collab_mode === 'live' ? 'live' : 'paused';
        journal.modeAvailable = master.collab_mode === 'live' || master.collab_mode === 'paused';
        if (journal.canonical && journal.revision === master.revision) return Promise.resolve();
        var revision = journal.revision, canonical = copy(master.budget_data);
        function settle() { journal.canonical = copy(master.budget_data); journal.revision = master.revision; }
        var local = window.budget;
        if (!local || local.collab_project_id !== project) { settle(); return Promise.resolve(); }
        canonical.collab_project_id = project;
        canonical.historyEnabled = true;
        var k = key(local, project);
        /* Nothing on the screen is replaced, and no delayed save cancelled, until every unsaved change is stored as a draft. */
        return keepUnsaved(project, journal, k, revision).then(function () {
            return journal.screenReplaced ? false : keepLocalCopy(project, copy(window.budget), canonical, journal);
        }).then(function () { return keepUnsaved(project, journal, k, revision); }).then(function () {
            if (window.budget && window.budget.collab_project_id === project) return replaceScreen(project, journal, canonical);
        }).then(settle);
    }
    function sync() {
        var context = active;
        if (!context || !context.project || context.actor !== actor() || !navigator.onLine) return Promise.resolve();
        return serialize(context.key, function () {
            return load(context.key, window.budget).then(function (journal) {
                var pending = journal.outbox.slice(), chain = request('project_members?project_id=eq.' + encodeURIComponent(context.project) + '&user_id=eq.' + encodeURIComponent(context.actor) + '&select=role').then(function (members) {
                    journal.readOnly = members.length > 0 && members[0].role === 'viewer';
                });
                pending.forEach(function (edit) {
                    chain = chain.then(function () {
                        if (context.actor !== actor()) throw new Error('Account changed. Existing drafts stay with their original actor.');
                        if (journal.readOnly) return;
                        return request('rpc/mbt_submit_edit', { p_id: edit.id, p_project_id: context.project, p_path: edit.path, p_before: edit.before_value, p_present: edit.before_present, p_after: edit.after_value, p_operation: edit.operation, p_revision: edit.base_revision, p_tags: edit.tags || {} }).then(function (result) {
                            journal.outbox = journal.outbox.filter(function (row) { return row.id !== edit.id; });
                            var own = journal.entries.filter(function (row) { return row.id === edit.id; })[0];
                            if (own) Object.keys(result).forEach(function (k) { own[k] = result[k]; });
                            return localforage.setItem(context.key, journal);
                        }, function (err) {
                            if (err.message !== 'Editor membership required') throw err;
                            /* A viewer keeps local drafts but must still fetch the shared budget. */
                            journal.readOnly = true;
                        });
                    });
                });
                return chain.then(function () { return fetchPages(context.project, 0, []); }).then(function (rows) {
                    rows.forEach(function (row) {
                        var old = journal.entries.filter(function (e) { return e.id === row.id; })[0];
                        if (old) Object.keys(row).forEach(function (k) { old[k] = row[k]; }); else journal.entries.push(row);
                    });
                    return request('projects?id=eq.' + encodeURIComponent(context.project) + '&select=*');
                }).then(function (projects) {
                    if (context.actor !== actor()) throw new Error('Account changed.');
                    if (!projects[0]) throw new Error('Shared budget could not be read.');
                    return applyCanonical(context.project, journal, projects[0]);
                }).then(function () { return localforage.setItem(context.key, journal); });
            }).then(function () {
                if (context.actor === actor() && window.budget && window.budget.collab_project_id === context.project && window.mBTOG && mBTOG.contributeBudget) return mBTOG.contributeBudget(window.budget);
            });
        }).then(function () {
            var more = resubmit; resubmit = false;
            return draw().then(function () { if (more) return sync(); });
        });
    }
    function decide(id, approve) {
        return request('rpc/mbt_decide_edit', { p_edit_id: id, p_approve: approve }).then(function () { return sync(); });
    }
    /* Presentation only: journal paths and values remain unchanged for replay. */
    function fieldLabel(value) {
        var labels = { calendarNotes: 'Calendar note', sections: 'Budget line', items: 'Budget line',
            fundingSources: 'Funding source', productionDays: 'Shoot days', preProductionDays: 'Pre-production days',
            postProductionDays: 'Post-production days', shootSchedule: 'Shoot schedule', savedDocs: 'Saved documents',
            savedDocsDeleted: 'Saved document removals', stageConfig: 'Stage', projectName: 'Project name',
            purchaseOrders: 'Purchase order', contacts: 'Contact', rate: 'Rate', qty: 'Quantity' };
        if (labels[value]) return labels[value];
        var words = String(value || 'Budget').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
        return words.charAt(0).toUpperCase() + words.slice(1);
    }
    function valueLabel(value) {
        if (value === undefined || value === null) return 'Not set';
        if (value === '') return '(empty)';
        if (typeof value === 'boolean') return value ? 'On' : 'Off';
        if (Array.isArray(value)) return value.length + (value.length === 1 ? ' entry' : ' entries');
        if (typeof value === 'object') {
            var keys = ['description', 'name', 'title', 'label'];
            for (var i = 0; i < keys.length; i++) {
                if (typeof value[keys[i]] === 'string' && value[keys[i]]) return value[keys[i]];
            }
            return 'Record';
        }
        return String(value);
    }
    function editLabel(edit, journal) {
        var path = edit.path || [], root = path[0], node = journal.observed || {}, name = '';
        var identified = false;
        path.forEach(function (part) {
            if (part.charAt(0) === '@') {
                identified = true;
                var id = part.slice(1);
                node = Array.isArray(node) ? node.filter(function (row) { return row && String(row.id) === id; })[0] : null;
                if (node) name = node.description || node.name || node.title || node.label || name;
            } else node = node && node[part];
        });
        var field = path[path.length - 1] || 'Budget';
        var record = field.charAt(0) === '@' || /^\d+$/.test(field);
        var subject = fieldLabel(root), detail = record ? '' : fieldLabel(field).toLowerCase();
        if (root === 'sections') subject = name ? 'Budget line: ' + name : 'Budget line';
        else if (identified && name && root !== 'calendarNotes') subject += ': ' + name;
        if (record) {
            var row = edit.operation === 'delete' ? edit.before_value : edit.after_value;
            var rowName = row && typeof row === 'object' && !Array.isArray(row) ? valueLabel(row) : name;
            return subject + (rowName ? ': ' + rowName : '') + (edit.operation === 'delete' ? ' removed' : (edit.before_present ? ' changed' : ' added'));
        }
        if (path.length === 1) return subject + (edit.operation === 'delete' ? ' removed' : ' changed');
        return subject + ': ' + detail + (edit.operation === 'delete' ? ' removed' : ' changed');
    }
    function copyNotice(doc, context, journal, item) {
        var li = doc.createElement('li'); li.className = 'activity-entry p-4 rounded-xl border border-amber-300 bg-amber-50 text-xs text-slate-700 space-y-2';
        var heading = doc.createElement('p'); heading.className = 'activity-meta font-bold';
        heading.textContent = 'Your earlier copy of this budget was kept';
        var text = doc.createElement('p');
        text.textContent = 'It was saved on this device on ' + new Date(item.savedAt).toLocaleString() + ' because it was different from the shared budget. Nothing has been sent to the owner. ' + (journal.readOnly ? 'Read-only access: changes on this device stay local. You can open it as its own budget on this device.' : 'You can open it as its own budget on this device, or send your changes as proposals' + (journal.owner === context.actor ? ' (as the owner, they apply to the shared budget straight away).' : ' (Live applies changes that still match; Paused waits for the owner’s approval).'));
        li.appendChild(heading); li.appendChild(text);
        var status = [];
        if (item.restoredAs) status.push('Opened as the budget named “' + item.restoredAs + '”. Find it in your budget list.');
        if (item.sentAt) status.push(item.sentCount ? 'Sent ' + item.sentCount + (item.sentCount === 1 ? ' change' : ' changes') + ' on ' + new Date(item.sentAt).toLocaleString() + '.' : 'Nothing to send: the shared budget already has these changes.');
        if (status.length) { var note = doc.createElement('p'); note.textContent = status.join(' '); li.appendChild(note); }
        [['Open my copy as a new budget', openCopy], [journal.owner === context.actor ? 'Apply my changes to the shared budget' : 'Send my changes to the shared budget', sendCopy]].forEach(function (action) {
            if (action[1] === sendCopy && journal.readOnly) return;
            var button = doc.createElement('button'); button.textContent = action[0]; button.className = 'px-3 py-2 rounded-lg bg-slate-700 text-white mr-2';
            if (action[1] === sendCopy && context.actor.indexOf('local:') === 0) { button.disabled = true; button.title = 'Sign in to send changes.'; }
            button.onclick = function () {
                button.disabled = true;
                action[1](context, item).then(draw).catch(function (err) { button.disabled = false; var error = doc.createElement('p'); error.textContent = err.message; li.appendChild(error); });
            };
            li.appendChild(button);
        });
        return li;
    }
    function modeControl(element, context, journal) {
        var doc = element.ownerDocument, box = doc.createElement('li');
        box.className = 'p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2';
        var label = doc.createElement('p'); label.textContent = 'Shared editing ';
        var beta = doc.createElement('small'); beta.textContent = 'beta'; beta.className = 'px-2 py-1 rounded bg-slate-100'; label.appendChild(beta); box.appendChild(label);
        var select = doc.createElement('select'); select.setAttribute('aria-label', 'Shared editing mode');
        select.className = 'p-2 rounded border border-slate-300 bg-white text-slate-800';
        ['live', 'paused'].forEach(function (mode) { var option = doc.createElement('option'); option.value = mode; option.textContent = mode === 'live' ? 'Live' : 'Paused'; select.appendChild(option); });
        select.value = journal.collabMode || 'paused';
        select.disabled = journal.owner !== context.actor || !journal.modeAvailable || !navigator.onLine || context.actor.indexOf('local:') === 0;
        var help = doc.createElement('p');
        help.textContent = 'Live: members’ changes appear within about ten seconds. Paused: members’ changes wait for ' + (journal.owner === context.actor ? 'your approval' : 'the owner’s approval') + '. Pending proposals stay waiting when switched to Live.';
        var note = doc.createElement('p'); note.setAttribute('role', 'status');
        note.textContent = !journal.modeAvailable ? 'Live or Paused is not available on the server yet. Changes wait for owner approval.' : journal.owner !== context.actor ? 'Only the budget owner controls Live or Paused.' + (journal.readOnly ? ' Read-only access: changes on this device stay local.' : journal.collabMode !== 'live' ? ' Your changes wait for the owner’s approval.' : '') : 'You control Live or Paused for this budget.';
        select.onchange = function () {
            select.disabled = true;
            request('rpc/mbt_set_collab_mode', { p_project_id: context.project, p_mode: select.value }).then(function () { return sync(); }).catch(function (err) { select.value = journal.collabMode || 'paused'; select.disabled = false; note.textContent = err.message; });
        };
        box.appendChild(select); box.appendChild(help); box.appendChild(note); element.appendChild(box);
    }
    function paint(element, context, journal, saved) {
        element.textContent = '';
        var doc = element.ownerDocument, info = doc.createElement('li');
        info.textContent = (context.project ? (journal.collabMode === 'live' ? 'Live: members’ changes appear within about ten seconds. Conflicting changes wait for approval.' : 'Paused: members’ changes wait for ' + (journal.owner === context.actor ? 'your approval.' : 'the owner’s approval.')) : 'Local budget history. Older unrecorded changes are unavailable.') + (!navigator.onLine ? ' Offline: other users may have newer activity.' : '');
        if (journal.readOnly) info.textContent += ' Read-only access: changes on this device stay local. Only the owner and editors can send changes.';
        info.className = 'activity-meta p-4 text-xs text-slate-600'; element.appendChild(info);
        if (context.project) modeControl(element, context, journal);
        ((saved && saved.copies) || []).forEach(function (item) { element.appendChild(copyNotice(doc, context, journal, item)); });
        journal.entries.slice().sort(function (a, b) { return (b.sequence || 0) - (a.sequence || 0) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id); }).forEach(function (edit) {
            var li = doc.createElement('li'); li.className = 'activity-entry p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2';
            var heading = doc.createElement('p'); heading.className = 'activity-meta';
            var status = { local: 'Saved locally', pending: 'Awaiting approval', approved: 'Applied', accepted: 'Applied', rejected: 'Rejected' };
            if (journal.readOnly && journal.outbox.some(function (row) { return row.id === edit.id; })) status.pending = 'Kept on this device (read-only access)';
            heading.textContent = (edit.user_id === context.actor ? 'You' : 'Collaborator') + ' | ' + new Date(edit.created_at).toLocaleString() + ' | ' + (status[edit.status] || 'Recorded');
            var text = doc.createElement('p'); text.textContent = editLabel(edit, journal);
            var values = doc.createElement('p'); values.className = 'activity-meta';
            values.textContent = valueLabel(edit.before_value) + ' \u2192 ' + valueLabel(edit.after_value);
            li.appendChild(heading); li.appendChild(text); li.appendChild(values);
            if (edit.status === 'pending' && context.project) {
                /* Server authorizes decisions. Non-owner buttons are omitted after membership lookup. */
                if (journal.owner === context.actor) [true, false].forEach(function (approve) {
                    var button = doc.createElement('button'); button.textContent = approve ? 'Approve edit' : 'Reject edit'; button.className = 'px-3 py-2 rounded-lg bg-slate-700 text-white mr-2';
                    button.onclick = function () { button.disabled = true; decide(edit.id, approve).catch(function (err) { button.disabled = false; var error = doc.createElement('p'); error.textContent = err.message + (err.message.indexOf('conflict') !== -1 ? '. Reject this draft and re-enter the intended change from the current budget.' : ''); li.appendChild(error); }); };
                    li.appendChild(button);
                });
            }
            element.appendChild(li);
        });
    }
    function draw() {
        mounted = mounted.filter(function (element) { return element.isConnected; });
        if (!mounted.length || !active) return Promise.resolve();
        var elements = mounted.slice(), context = active;
        return Promise.all([localforage.getItem(context.key), context.project ? localforage.getItem(recoveryKey(context.project, context.actor)) : null]).then(function (loaded) {
            if (!loaded[0]) return;
            elements.forEach(function (element) { if (element.isConnected) paint(element, context, loaded[0], loaded[1]); });
        });
    }
    function mount(element) {
        if (element && mounted.indexOf(element) === -1) mounted.push(element);
        if (active && active.actor !== actor() && window.budget) return open(window.budget).then(function () { return mount(element); });
        if (!active && window.budget) return open(window.budget).then(function () { return mount(element); });
        if (active && active.project && navigator.onLine) {
            /* The Share tool mounts two lists at once; they share one refresh. */
            if (!refreshing) {
                var context = active;
                refreshing = request('projects?id=eq.' + encodeURIComponent(context.project) + '&select=owner_user_id').then(function (rows) {
                    return serialize(context.key, function () { return load(context.key, window.budget).then(function (journal) { journal.owner = rows[0] && rows[0].owner_user_id; return localforage.setItem(context.key, journal); }); });
                }).then(sync);
                var done = function () { refreshing = null; };
                refreshing.then(done, done);
            }
            return refreshing.catch(function (err) { return draw().then(function () { var text = element.ownerDocument.createElement('li'); text.textContent = err.message; element.appendChild(text); }); });
        }
        return draw();
    }
    window.addEventListener('online', function () { sync().catch(function (err) { console.warn('[History]', err.message); }); });
    setInterval(function () { if (active && active.project && navigator.onLine) sync().catch(function (err) { console.warn('[History]', err.message); }); }, 10000);
    window.mBTHistory = { open: open, record: record, sync: sync, decide: decide, mount: mount, differences: differences, journalKey: journalKey, isApplying: function () { return applying; } };
})();
