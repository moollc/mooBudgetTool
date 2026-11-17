/* Shared department classification and local accounting projection. ES5. */
(function () {
    'use strict';
    var groups = {
        atl: ['Above The Line', 'atl'], camera: ['Camera Department', 'btl'],
        post: ['Post-Production', 'post'], sound: ['Sound Department', 'btl'],
        electrical: ['Electrical Department', 'btl'], grip: ['Grip Department', 'btl'],
        art: ['Art Department', 'btl'], wardrobe: ['Wardrobe Department', 'btl'],
        makeup: ['Hair and Makeup Department', 'btl'], production: ['Production Department', 'btl'],
        location: ['Locations Department', 'btl'], transport: ['Transport Department', 'travel'],
        catering: ['Craft Services', 'btl'], live: ['Live Production', 'btl'],
        development: ['Development', 'btl'], equipment: ['Equipment Department', 'btl'],
        publicity: ['Publicity', 'pub']
    };
    function norm(s) { return String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
    function catalogMatch(description, rates) {
        var name = norm(description), rows = rates || [];
        var match = rows.filter(function (row) { return norm(row.description) === name; })[0];
        if (!match && name.length > 3) match = rows.filter(function (row) { return norm(row.description).indexOf(name) !== -1; })[0];
        return match || null;
    }
    function catalogs() {
        if (window.mBTOG) return mBTOG.rates || [];
        try { if (window.parent !== window && window.parent.mBTOG) return window.parent.mBTOG.rates || []; } catch (err) {}
        return [];
    }
    function classify(item) {
        item = item || {};
        var explicit = norm(item.department);
        if (item.source === 'community' && !item.departmentEvidence) explicit = '';
        var key;
        for (key in groups) {
            if (key !== 'production' && explicit && (explicit === key || explicit === norm(groups[key][0]))) return key;
        }
        var name = norm(item.description || item.role || (item.crew && item.crew.role));
        var known = catalogMatch(name, catalogs());
        if (known && known.department && groups[known.department] && (known.source !== 'community' || known.departmentEvidence)) return known.department;
        if (/^(1st ac|2nd ac|1stac|2ndac|dop|d p|dp|dit|focus puller)$/.test(name)) return 'camera';
        if (/^(ae|editing)$/.test(name)) return 'post';
        if (/editor|editing|post production|colorist|vfx|composer|music supervisor|sound designer|sound editor/.test(name)) return 'post';
        if (/assistant director|\bad\b|line producer|local producer|production manager/.test(name)) return 'production';
        if (/^director$|^producer$|executive producer|screenwriter|cast |casting director|^host$|narrator|life rights/.test(name)) return 'atl';
        if (/camera|\bdp\b|photograph|cinematograph|steadicam|drone|digital imaging|\bdit\b|lens|tripod|teradek bolt|accsoon|wireless video|video playback|video assist/.test(name)) return 'camera';
        if (/gaffer|electric|light kit|lighting|generator/.test(name)) return 'electrical';
        if (/grip|dolly/.test(name)) return 'grip';
        if (/wardrobe|costume/.test(name)) return 'wardrobe';
        if (/makeup|hair stylist|hair assistant/.test(name)) return 'makeup';
        if (/art director|production designer|decorator|dresser|props|sculptor|draftsperson|construction|concept artist|graphics artist/.test(name)) return 'art';
        if (/sound|boom|microphone|audio|pa system|qsc|jbl/.test(name)) return 'sound';
        if (/transport|driver|truck|passenger van|sprinter|vehicle|fuel|parking/.test(name)) return 'transport';
        if (/location|studio lease|permits/.test(name)) return 'location';
        if (/cater|craft service|per diem/.test(name)) return 'catering';
        if (/publicist|publicity/.test(name)) return 'publicity';
        if (/research|storyboard artist|copywriter|script consultant|pitch deck designer|legal/.test(name)) return 'development';
        if (/broadcast|technical director|ptz operator|videoconference|presenter wrangler|av technician|graphics operator|stream technician|switcher|encoder|tricas|atem|converter|cellular|router|comms|ifb|internet|data|teleprompter|on air|cdn|gostream|capture device|projector|projection|presentation|confidence monitor|conference/.test(name)) return 'live';
        if (/\bpa\b|production|script supervisor|stunt|security|medic|nurse|labourer/.test(name)) return 'production';
        var category = norm(item.category);
        var cats = { camera: 'camera', sound: 'sound', lighting: 'electrical', transport: 'transport', location: 'location', live: 'live', arsenal: 'equipment' };
        if (cats[category]) return cats[category];
        /* A type alone does not prove a department. Unknown catalog rows stay flagged. */
        if (explicit === 'production' || explicit === 'production department') return 'production';
        if (item.crew && item.crew.department) return classify({ department: item.crew.department, description: item.crew.department });
        return null;
    }
    var parts = { dev: 'Development', pre: 'Pre-Production', prod: 'Production', post: 'Post-Production', pub: 'Publishing', dist: 'Distribution' };
    var partIds = { dev: ['dev'], pre: ['pre', 'btl_pre'], prod: ['prod', 'btl', 'btl_prod'], post: ['post', 'btl_post'], pub: ['pub'], dist: ['dist'] };
    var partNames = {
        dev: ['development'], pre: ['pre production', 'pre pro', 'pre pro legal'],
        prod: ['production', 'production crew', 'field production', 'principal photography', 'event day crew'],
        post: ['post production', 'post archive', 'post finishing', 'post event recap delivery'],
        pub: ['publishing', 'publicity'], dist: ['distribution']
    };
    function partFor(item, department) {
        var stages = Object.keys(item.stageData || {}).filter(function (key) { return parts[key]; });
        return stages[0] || (department === 'development' ? 'dev' : department === 'post' ? 'post' : department === 'publicity' ? 'pub' : 'prod');
    }
    function partSection(budget, key, dry) {
        var sections = budget.sections || (budget.sections = {});
        /* Stable template IDs win over display names. Renaming a part keeps its identity. */
        var names = Object.keys(sections);
        var found = names.filter(function (name) {
            var sec = sections[name];
            return partIds[key].indexOf(sec.id) !== -1;
        })[0];
        if (!found) found = names.filter(function (name) {
            var sec = sections[name];
            if (/^dept_/.test(sec.id || '')) return false;
            /* A known ID for another part must not be reinterpreted by its title. */
            if (Object.keys(partIds).some(function (part) { return partIds[part].indexOf(sec.id) !== -1; })) return false;
            return partNames[key].indexOf(norm(name).replace(/^btl /, '')) !== -1;
        })[0];
        if (!found && dry) return null;
        if (!found) {
            found = parts[key];
            /* Never replace an existing user section with the same title. */
            if (sections[found]) found += ' (Budget Part)';
            sections[found] = { id: key, defaultPhase: key, isOpen: true, items: [] };
        }
        return found;
    }
    function migrateDepartments(budget) {
        var sections = budget.sections || {}, moved = {}, byItem = {}, touched = false;
        Object.keys(sections).forEach(function (name) {
            var sec = sections[name], department = String(sec.id || '').replace(/^dept_/, '');
            if (sec.id !== 'dept_' + department || !groups[department]) return;
            moved[name] = [];
            (sec.items || []).forEach(function (item) {
                item.department = item.department || department;
                var target = partSection(budget, partFor(item, department));
                sections[target].items.push(item);
                if (moved[name].indexOf(target) === -1) moved[name].push(target);
                if (item.id) byItem[item.id] = target;
                /* Preserve old fringe selection without expanding it to unrelated rows. */
                item._departmentSection = item._departmentSection || name;
            });
            if (!moved[name].length) moved[name].push(partSection(budget, partFor({}, department)));
            delete sections[name]; touched = true;
        });
        if (!touched) return false;
        function visit(value) {
            if (!value || typeof value !== 'object') return;
            if (value.sectionKey && moved[value.sectionKey]) {
                value._departmentSection = value.sectionKey;
                value.sectionKey = byItem[value.itemId] || moved[value.sectionKey][0];
            }
            Object.keys(value).forEach(function (key) { if (key !== 'sections') visit(value[key]); });
        }
        visit(budget);
        /* Existing fringe scope names remain visible. Finance resolves them through
           each moved row's provenance, never through the broader destination part. */
        /* Keep account choices per old department. Do not silently merge differing codes. */
        budget.departmentMigration = { version: 1, sectionMap: moved };
        return true;
    }
    /* Setting "Put new lines in their department's section" (budget.settings.deptSections). On unless the budget says false. */
    function deptSectionsOn(budget) {
        return !(budget && budget.settings && budget.settings.deptSections === false);
    }
    /* Departments that already are a budget part keep using that part's section. */
    var deptParts = { production: 'prod', development: 'dev', post: 'post', publicity: 'pub' };
    function deptNames(department) {
        var label = norm(groups[department][0]);
        return [label, label.replace(/ department$/, '')];
    }
    function sectionIdFor(department) { return department === 'atl' ? 'atl' : 'dep-' + department; }
    /* The section a department's lines live in: an existing one, or a new one named for the department. */
    function findDeptSection(budget, department) {
        var sections = budget.sections || {}, names = Object.keys(sections), ids = [sectionIdFor(department)];
        if (department === 'transport') ids.push('transport', 'travel');
        var wanted = deptNames(department);
        return names.filter(function (name) { return ids.indexOf(sections[name].id) !== -1; })[0] ||
            names.filter(function (name) {
                return !/^dept_/.test(sections[name].id || '') && wanted.indexOf(norm(name)) !== -1;
            })[0] || null;
    }
    function deptSection(budget, department) {
        if (deptParts[department]) return partSection(budget, deptParts[department]);
        var sections = budget.sections || (budget.sections = {});
        var found = findDeptSection(budget, department);
        if (!found) {
            found = department === 'atl' ? 'Above The Line' : groups[department][0];
            if (sections[found]) found += ' (Budget Part)';
            /* No defaultPhase: a new line keeps the schedule it was added with. */
            sections[found] = { id: sectionIdFor(department), isOpen: true, items: [] };
        }
        return found;
    }
    function validDepartment(key) { return key && groups[key] ? key : null; }
    /* What adding this item would do, without changing the budget. Shown beside the Department box. */
    function plan(budget, item, chosen) {
        var department = validDepartment(chosen) || classify(item);
        if (!department) return { department: null, label: '', section: '', created: false, needsChoice: true };
        var label = groups[department][0], on = deptSectionsOn(budget), name = '', created = false;
        if (on) {
            if (deptParts[department]) {
                name = partSection(budget, deptParts[department], true) || '';
                if (!name) { name = parts[deptParts[department]]; created = true; }
            } else {
                name = findDeptSection(budget, department) || '';
                if (!name) { name = department === 'atl' ? 'Above The Line' : label; created = true; }
            }
        }
        return { department: department, label: label, section: name, created: created, needsChoice: false };
    }
    function section(budget, item, preferred, chosen) {
        var department = validDepartment(chosen) || classify(item);
        if (!department) {
            item.needsClassification = true;
            console.warn('[mBT classification] Needs classification:', item.description || item.role || '(unnamed item)');
            throw new Error('Could not classify this item. Choose its department, or use a recognizable role or equipment name. Nothing was added.');
        }
        delete item.needsClassification;
        migrateDepartments(budget);
        var sections = budget.sections || (budget.sections = {});
        var found;
        if (deptSectionsOn(budget)) {
            found = deptSection(budget, department);
        } else {
            var names = Object.keys(sections);
            found = names.filter(function (name) {
                return name === preferred && !/^dept_/.test(sections[name].id || '');
            })[0];
            if (!found) {
                found = partSection(budget, parts[preferred] ? preferred : partFor(item, department));
            }
        }
        item.department = department;
        var known = catalogMatch(item.description || item.role, catalogs());
        if (known) { item.itemType = known.itemType; item.catalogDescription = known.description; }
        return found;
    }
    /* Move an existing line to another department. With the setting on the line also moves to that department's section;
       its stage days, rate and purchase orders stay with it. Returns { section, moved }. */
    function moveToDepartment(budget, itemId, department) {
        department = validDepartment(department);
        if (!department) throw new Error('Choose a department from the list.');
        var sections = budget.sections || {}, from = null, item = null;
        Object.keys(sections).forEach(function (name) {
            (sections[name].items || []).forEach(function (it) { if (!item && String(it.id) === String(itemId)) { item = it; from = name; } });
        });
        if (!item) throw new Error('That line was not found.');
        if (item.department === department && !deptSectionsOn(budget)) return { section: from, moved: false };
        item.department = department;
        delete item.needsClassification;
        if (!deptSectionsOn(budget)) return { section: from, moved: false };
        var to = deptSection(budget, department);
        if (to === from) return { section: from, moved: false };
        /* By id: the open budget hands out a fresh wrapper object on every read, so objects are never equal. */
        sections[from].items = sections[from].items.filter(function (it) { return String(it.id) !== String(itemId); });
        sections[to].items.push(item);
        if (item.sectionKey) item.sectionKey = to;
        (((budget.ledgers || {}).pos) || []).forEach(function (po) { if (po.itemId && String(po.itemId) === String(item.id)) po.sectionKey = to; });
        return { section: to, moved: true, from: from };
    }
    /* The Department box used by the add dialogs: Auto uses the item's own department. */
    function pickerOptions(esc, selected) {
        var e = esc || function (v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
        var blank = typeof selected === 'string' ? '' : '<option value="">' + (selected === false ? 'Choose a department' : 'Auto (from the item name)') + '</option>';
        return blank + Object.keys(groups).map(function (key) {
            return '<option value="' + e(key) + '"' + (key === selected ? ' selected' : '') + '>' + e(groups[key][0]) + '</option>';
        }).join('');
    }
    function boxHtml() {
        return '<div class="mbt-dept-box" style="margin:6px 0 8px;">' +
            '<label for="mbtDeptPick" style="display:block;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:3px;">Department</label>' +
            '<select id="mbtDeptPick" aria-label="Department for the new line" style="width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:11px;font-weight:700;background:#fff;color:#1e293b;">' + pickerOptions() + '</select>' +
            '<div id="mbtDeptHint" role="status" style="font-size:10px;font-weight:600;line-height:1.35;margin-top:4px;color:#475569;"></div></div>';
    }
    function pick(root) {
        var el = (root || document).getElementById('mbtDeptPick');
        return el ? validDepartment(el.value) : null;
    }
    /* Keep the sentence under the box true as the name or the choice changes. Returns the refresh function. */
    function bindBox(root, getBudget, getText) {
        var el = (root || document).getElementById('mbtDeptPick'), hint = (root || document).getElementById('mbtDeptHint');
        function refresh() {
            if (!hint) return;
            var text = String(getText() || '').replace(/^\s+|\s+$/g, ''), chosen = pick(root);
            hint.textContent = (text || chosen) ? planText(getBudget(), { description: text }, chosen) : (deptSectionsOn(getBudget()) ? 'Each item goes in its own department\'s section. Pick a department to override.' : 'Pick a department to set it on the new line.');
        }
        if (el) el.addEventListener('change', refresh);
        refresh();
        return refresh;
    }
    /* One plain sentence under a Department box: where this line will go. */
    function planText(budget, item, chosen) {
        var p = plan(budget, item, chosen);
        if (p.needsChoice) return 'Department not recognised. Choose one above before adding.';
        if (!deptSectionsOn(budget)) return 'Department: ' + p.label + '. The section is chosen as before, not by department.';
        return 'Department: ' + p.label + '. Goes in the "' + p.section + '" section' + (p.created ? ' (new)' : '') + '.';
    }
    function ledger(budget, contacts) {
        var rows = [], warnings = [], currency = budget.currency || 'JMD';
        var data = budget.ledgers || {};
        function add(source, kind, parent, index) {
            var contactId = source.contactId || (parent && parent.contactId) || '';
            var sectionKey = source.sectionKey || (parent && parent.sectionKey) || 'No budget line';
            var contact = (contacts || []).filter(function (c) { return c.id === contactId; })[0] || {};
            var amount = Number(kind === 'Float' ? source.floatAmount : source.amount);
            if (!isFinite(amount)) throw new Error('Invalid ledger amount: ' + (source.id || kind) + '. Fix it before exporting.');
            var date = source.date || source.issuedDate || (parent && parent.issuedDate) || '';
            if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00Z').getTime()) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date)) throw new Error('Invalid ledger date: ' + date + '. Fix it before exporting.');
            rows.push({ id: source.id || ((parent && parent.id) + '_receipt_' + index), kind: kind,
                section: sectionKey, date: date,
                party: source.vendor || source.floatHolder || (parent && parent.floatHolder) || contact.name || '',
                description: source.description || (kind === 'Float' ? 'Petty cash advance' : ''),
                amount: amount, currency: source.currency || (parent && parent.currency) || currency,
                status: source.status || (kind === 'Receipt' ? 'Recorded' : ''), reference: source.poNumber || source.id || '',
                contactId: contactId, destination: String(contact.walletType || '').toLowerCase() === 'wise' ? contact.walletAddress || '' : '',
                account: ((budget.accountingExport || {}).accounts || {})[(parent && parent._departmentSection) || source._departmentSection || sectionKey] || '' });
        }
        (data.pos || []).forEach(function (po) { add(po, 'PO'); });
        (data.pettyCash || []).forEach(function (float) {
            add(float, 'Float');
            (float.receipts || []).forEach(function (receipt, i) { add(receipt, 'Receipt', float, i); });
        });
        return { rows: rows, warnings: warnings };
    }
    function workbook(budget, contacts) {
        var profile = budget.accountingExport || {};
        var wise = !!profile.wise, qb = !!profile.quickbooks;
        if (!wise && !qb) throw new Error('Configure Wise details or QuickBooks account mappings before exporting.');
        var normalized = ledger(budget, contacts);
        if (!normalized.rows.length) throw new Error('This budget has no ledger records.');
        var XLSX = window.XLSX, wb = XLSX.utils.book_new();
        ['Wise', 'QuickBooks'].forEach(function (target) {
            if ((target === 'Wise' && !wise) || (target === 'QuickBooks' && !qb)) return;
            var extra = target === 'Wise' ? ['Contact ID', 'Wise Destination'] : ['Contact ID', 'Account'];
            var header = ['Record ID', 'Kind', 'Section', 'Date', 'Party', 'Description', 'Amount', 'Currency', 'Status', 'Reference'].concat(extra);
            var aoa = [[budget.projectName || 'Budget', target + ' ledger report'], ['Amounts are rounded to currency precision. Float advances are separate from expenses. This is not a payment import file.'], [], header];
            var sums = {};
            var formats = {};
            var tabWarnings = [];
            normalized.rows.forEach(function (r) {
                var digits;
                try { digits = new Intl.NumberFormat('en', { style: 'currency', currency: r.currency }).resolvedOptions().maximumFractionDigits; }
                catch (err) { throw new Error('Invalid ledger currency: ' + r.currency); }
                var scale = Math.pow(10, digits), units = Math.round(Math.abs(r.amount) * scale + 0.000000001) * (r.amount < 0 ? -1 : 1);
                var format = '#,##0' + (digits ? '.' + new Array(digits + 1).join('0') : '') + ';[Red](#,##0' + (digits ? '.' + new Array(digits + 1).join('0') : '') + ')';
                aoa.push([r.id, r.kind, r.section, r.date, r.party, r.description, units / scale, r.currency, r.status, r.reference, r.contactId, target === 'Wise' ? r.destination : r.account]);
                formats[aoa.length] = format;
                var k = r.kind + '|' + r.currency;
                if (!sums[k]) sums[k] = { units: 0, scale: scale, format: format };
                sums[k].units += units;
                if (!(target === 'Wise' ? r.destination : r.account)) { var warning = target + ' details missing for ' + r.id; normalized.warnings.push(warning); tabWarnings.push(warning); }
            });
            aoa.push([]);
            Object.keys(sums).sort().forEach(function (k) { var p = k.split('|'); aoa.push(['Total', p[0], '', '', '', '', sums[k].units / sums[k].scale, p[1]]); formats[aoa.length] = sums[k].format; });
            if (tabWarnings.length) { aoa.push([], ['Missing details']); tabWarnings.forEach(function (warning) { aoa.push([warning]); }); }
            var ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = [24, 12, 25, 12, 25, 40, 16, 12, 14, 22, 24, 32].map(function (n) { return { wch: n }; });
            ws['!autofilter'] = { ref: 'A4:L' + (normalized.rows.length + 4) };
            Object.keys(ws).forEach(function (key) { if (/^G\d+$/.test(key) && ws[key].t === 'n') ws[key].z = formats[Number(key.slice(1))]; });
            XLSX.utils.book_append_sheet(wb, ws, target);
        });
        return { book: wb, warnings: normalized.warnings, rows: normalized.rows };
    }
    function following() { return localStorage.getItem('moo_og_cloud_sync') === 'true'; }
    function protectedPrice(item) { return !!item.rateOverride || item.rateSource === 'custom' || item.rateType === 'fixed' || Object.keys(item.stageData || {}).some(function (key) { return item.stageData[key].rateOverride; }); }
    function eligible(item) { return following() && !protectedPrice(item); }
    function uuid() {
        var a = new Uint8Array(16); window.crypto.getRandomValues(a); a[6] = (a[6] & 15) | 64; a[8] = (a[8] & 63) | 128;
        var s = Array.prototype.map.call(a, function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
        return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20);
    }
    function ensureLedgerIds(budget) {
        if (budget.collab_project_id) return;
        var data = budget.ledgers || {};
        (data.pos || []).forEach(function (po) { if (!po.id) po.id = uuid(); });
        (data.pettyCash || []).forEach(function (float) { if (!float.id) float.id = uuid(); (float.receipts || []).forEach(function (receipt) { if (!receipt.id) receipt.id = uuid(); }); });
    }
    function manual(item) { item.rateOverride = true; item.rateSource = 'custom'; item.userPrice = true; item.userPriceAt = new Date().toISOString(); item.userPriceId = uuid(); item.userPriceUserId = localStorage.getItem('mbt_collab_user_id') || localStorage.getItem('mbt_supabase_user_id') || ''; }
    function adoptCatalog(item, rates) {
        var match = catalogMatch(item.description, rates);
        item.itemType = (match && match.itemType) || item.itemType || 'crew';
        item.department = item.department || (match && match.department) || classify(item);
        if (match) item.catalogDescription = match.description;
        if (match && match.source === 'override') { manual(item); if (match.userPriceUserId) item.userPriceUserId = match.userPriceUserId; }
        else item.rateSource = 'opengate';
        return item;
    }
    function shareFile(file, title, isCurrent) {
        return new Promise(function (resolve, reject) {
            var files = Array.isArray(file) ? file : [file];
            var data = { files: files, title: title || 'Document' };
            if (!navigator.share || !navigator.canShare || !navigator.canShare(data)) { reject(new Error('This device cannot share this file. Use Export to download it.')); return; }
            var old = document.getElementById('mBT-share-ready');
            if (old) { reject(new Error('Close the prepared share first.')); return; }
            var panel = document.createElement('div');
            panel.id = 'mBT-share-ready';
            panel.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:200;padding:20px;background:#fff;color:#334155;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 12px 32px #0002';
            var text = document.createElement('p'); text.textContent = 'File ready: ' + files.map(function (f) { return f.name; }).join(', ') + '. Choose a destination on your device.';
            var send = document.createElement('button'); send.className = 'toolbar-btn'; send.textContent = 'Share prepared file';
            var cancel = document.createElement('button'); cancel.className = 'toolbar-btn'; cancel.textContent = 'Cancel';
            function close() { if (panel.parentNode) panel.parentNode.removeChild(panel); }
            send.onclick = function () {
                if (isCurrent && !isCurrent()) { close(); reject(new Error('The document changed. Prepare it again before sharing.')); return; }
                send.disabled = true;
                try { Promise.resolve(navigator.share(data)).then(function () { close(); resolve(); }, function (err) { close(); if (err.name === 'AbortError') resolve(); else reject(err); }); }
                catch (err) { close(); reject(err); }
            };
            cancel.onclick = function () { close(); resolve(); };
            panel.appendChild(text); panel.appendChild(send); panel.appendChild(cancel); document.body.appendChild(panel);
        });
    }
    window.mBTBatch2 = { classify: classify, section: section, plan: plan, planText: planText, pick: pick, boxHtml: boxHtml, bindBox: bindBox, pickerOptions: pickerOptions, moveToDepartment: moveToDepartment, deptSectionsOn: deptSectionsOn, migrateDepartments: migrateDepartments, groups: groups, ledger: ledger, workbook: workbook, following: following, eligible: eligible, protectedPrice: protectedPrice, manual: manual, adoptCatalog: adoptCatalog, shareFile: shareFile, uuid: uuid, ensureLedgerIds: ensureLedgerIds, catalogMatch: catalogMatch };
})();
