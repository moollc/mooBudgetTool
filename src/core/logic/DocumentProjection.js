/* Read only document facts. The approved field map is the eligibility registry.
   Document snapshots and overrides never become a second master pool. */
(function (window) {
    'use strict';
    var schema = null, loading = null;
    var script = document.currentScript;
    var mapUrl = script ? script.src.replace(/core\/logic\/DocumentProjection\.js.*$/, 'data/document-field-map.json') : '';
    var prose = {
        fundingPackage: ['logline'], crewList: ['notes'],
        pitchDeck: ['logline', 'synopsis', 'targetMarket', 'useOfFunds'],
        fundingStrategy: ['execSummary', 'sourcingApproach', 'investorProfile', 'fundingTimeline', 'askDetails', 'riskMitigation'],
        talentAgreement: ['roleDescription'], locationAgreement: ['propertyDescription', 'accessInstructions'],
        appearanceRelease: ['sceneDescription'], nda: ['projectDescription']
    };
    function copy(value) { return JSON.parse(JSON.stringify(value)); }
    function norm(value) { return String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
    function number(value) {
        if (value == null || typeof value === 'boolean' || typeof value === 'string' && !value.trim()) return null;
        var n = Number(value); return isFinite(n) ? n : null;
    }
    function money(value) { return Number(value).toFixed(2); }
    function convertAmount(budget, value, code) {
        var base = budget.currency || 'JMD';
        var n = number(value);
        if (n === null) throw new Error('Invalid money amount in ' + code + '.');
        if (!code || code === base) return n;
        var engine = (window.mBT && window.mBT.le) || (window.parent && window.parent.mBT && window.parent.mBT.le);
        var converted = engine && engine.convertCurrencyOrNull ? engine.convertCurrencyOrNull(n, code, base, budget, true) : null;
        if (converted === null) throw new Error('Missing exchange rate for ' + code + ' to ' + base + '.');
        return converted;
    }
    function isMissingRate(err) { return !!err && String(err.message || '').indexOf('Missing exchange rate') === 0; }
    function ownMoney(value, code) { return String(code || '') + ' ' + money(number(value)); }
    function fundingSummary(budget) {
        return fundingContext(budget);
    }
    function weeklyRows(budget) {
        budget = budget || {};
        var rows = [], warnings = [], kept = [], leftOutCount = 0;
        var base = budget.currency || 'JMD', engine = null;
        try { engine = (window.mBT && window.mBT.le) || (window.parent && window.parent.mBT && window.parent.mBT.le); } catch (err) { /* engine unavailable */ }
        function poAmount(value, currency) {
            var amount = number(value) || 0;
            if (!currency || currency === base) return amount;
            var converted = engine && typeof engine.convertCurrencyOrNull === 'function' ? engine.convertCurrencyOrNull(amount, currency, base, budget) : null;
            return typeof converted === 'number' && isFinite(converted) ? converted : null;
        }
        ((budget.ledgers && budget.ledgers.pos) || []).forEach(function (po) {
            if (['Committed', 'Invoiced', 'Paid'].indexOf(po.status) < 0) { kept.push(po); return; }
            var amount = poAmount(po.amount, po.currency);
            var paid = po.paidAmount == null || po.paidAmount === '' ? null : poAmount(po.paidAmount, po.currency);
            var incurred = po.actualAmount == null || po.actualAmount === '' ? null : poAmount(po.actualAmount, po.currency);
            if (amount === null || po.paidAmount != null && po.paidAmount !== '' && paid === null || po.actualAmount != null && po.actualAmount !== '' && incurred === null) {
                if (po.itemId && po.currency && po.currency !== base) leftOutCount++;
                return;
            }
            var next = copy(po);
            next.amount = amount; next.currency = base;
            if (paid !== null) next.paidAmount = paid;
            if (incurred !== null) next.actualAmount = incurred;
            kept.push(next);
        });
        Object.keys(budget.sections || {}).forEach(function (part) {
            (budget.sections[part].items || []).forEach(function (item) {
                var estimate = number(item.total) || 0, actual = number(item.actual) || 0, committed = 0, unverified = false;
                kept.forEach(function (po) {
                    if (po.itemId !== item.id || po.sectionKey && po.sectionKey !== part || ['Committed', 'Invoiced'].indexOf(po.status) < 0) return;
                    var amount = convertAmount(budget, po.amount, po.currency);
                    var paid = convertAmount(budget, po.paidAmount || 0, po.currency);
                    var incurred = convertAmount(budget, po.actualAmount || 0, po.currency);
                    committed += Math.max(0, amount - Math.max(paid, incurred));
                    if (actual && number(po.actualAmount) === null) {
                        unverified = true;
                        warnings.push('PO ' + (po.poNumber || po.id) + ' needs an actual allocation before its outstanding commitment can be verified.');
                    }
                });
                var etc = number(item.estimateToComplete), account = ((budget.accountingExport || {}).accounts || {})[part] || part;
                rows.push({ itemId: item.id, account: account, description: item.description || '', actualDate: item.actualDate || '', budget: money(estimate), committed: unverified ? '' : money(committed), actual: money(actual), etc: etc === null ? '' : money(etc), variance: money(estimate - actual), pctUsed: !unverified && estimate > 0 ? ((actual + committed) / estimate * 100).toFixed(1) : '' });
            });
        });
        var committedNote = leftOutCount ? 'The Committed total leaves out ' + leftOutCount + (leftOutCount === 1 ? ' purchase order' : ' purchase orders') + ' in a currency with no exchange rate.' : '';
        if (committedNote) warnings.push(committedNote);
        return { rows: rows, warnings: warnings, committedNote: committedNote };
    }
    function loadMap() {
        if (schema) return Promise.resolve(schema);
        if (!loading) loading = fetch(mapUrl).then(function (r) {
            if (!r.ok) throw new Error('Document field map could not be loaded.');
            return r.json();
        }).then(function (data) { schema = data; return data; }).catch(function (err) { loading = null; throw err; });
        return loading;
    }
    function fields(id) {
        if (!schema) throw new Error('Document field map is not loaded.');
        var rows = schema.templates.filter(function (t) { return t.template === id; });
        if (!rows.length) throw new Error('Unknown document template: ' + id);
        var out = {};
        rows[0].fields.forEach(function (f) { out[f.field] = f; });
        return out;
    }
    /* Canonical classification is itemType. type and item_type are older names. */
    function supplyClass(item) {
        var kind = norm(item && (item.itemType || item.item_type || item.type));
        if (kind === 'equip' || kind === 'gear') kind = 'equipment';
        if (kind === 'rentals') kind = 'rental';
        return kind.indexOf('equipment') === 0 || kind.indexOf('rental') === 0;
    }
    function fundingContext(budget) {
        budget = budget || {};
        var base = budget.currency || 'JMD', confirmed = 0, missing = false;
        var sources = (budget.fundingSources || []).map(function (source) {
            var row = { id: source.id || '', name: source.name || '', status: source.status || '', amount: source.amount, currency: source.currency || '' };
            try {
                row.amountInBudgetCurrency = convertAmount(budget, source.amount, source.currency);
                if (source.status === 'Confirmed') confirmed += row.amountInBudgetCurrency;
            } catch (err) {
                missing = true;
                row.amountInBudgetCurrency = null;
                row.conversion = err.message || 'Missing exchange rate.';
            }
            return row;
        });
        var total = number(budget.grandTotal);
        return {
            currency: base,
            total: total,
            confirmedWithRates: confirmed,
            gapWithRates: total === null ? null : Math.max(0, total - confirmed),
            confirmed: missing ? null : confirmed,
            gap: (missing || total === null) ? null : Math.max(0, total - confirmed),
            note: missing ? 'Missing exchange rate. This source was not treated as equal to the budget currency.' : '',
            sources: sources
        };
    }
    function fundingPrompt(projection) {
        var ctx = projection && projection.fundingContext;
        if (!ctx) return '';
        return '--- READ ONLY FUNDING FACTS (not editable document fields) ---\n' + JSON.stringify(ctx) + '\n\n';
    }
    function role(item) {
        var n = norm(item.description || item.role);
        if (/^(actor|acting|talent|cast|casting) (coach|liaison|agent|manager|coordinator|director|assistant|handler|wrangler)( |$)/.test(n)) return 'crew';
        if (/^(director|film director|commercial director|series director)$/.test(n)) return 'director';
        if (/^(producer|executive producer|co producer)$/.test(n)) return 'producer';
        if (/^(writer|screenwriter|screenplay writer|copywriter)$/.test(n)) return 'writer';
        if (/^(dp|d p|dop|director of photography|cinematographer)$/.test(n)) return 'dp';
        if (/^(1st ad|first ad|1ad|first assistant director|1st assistant director)$/.test(n)) return 'firstAd';
        if (/^(2nd ad|second ad|2ad|second assistant director|2nd assistant director)$/.test(n)) return 'secondAd';
        if (/^(upm|unit production manager|line producer|production manager)$/.test(n)) return 'upm';
        if (/^(script supervisor|continuity supervisor|script continuity)$/.test(n)) return 'supervisor';
        if (/^(transport coordinator|transportation coordinator|transpo coordinator|transportation manager|transport supervisor)$/.test(n)) return 'transportCoordinator';
        if (/^(actor|actress|performer|talent|lead talent|lead performer|lead actor|lead actress|supporting actor|background actor|background talent|voice actor|voice over talent|voice talent|extra|host|narrator)( |$)/.test(n) || /^(cast|cast lead|cast member|cast performer)$/.test(n)) return 'cast';
        return '';
    }
    function project(id, budget, contacts, options) {
        budget = budget || {}; options = options || {};
        var allowed = fields(id), values = {}, refs = {}, choices = [], warnings = [], seen = {}, assignments = [], committedNote = '';
        var selected = options.selections || {}, doc = options.document || {}, base = budget.currency || 'JMD';
        var rates = budget.exchangeRateState && budget.exchangeRateState.rates;
        var contactMap = {};
        (contacts || []).forEach(function (c) { if (c && c.id) contactMap[c.id] = c; });
        function put(k, v, ref) {
            if (!allowed[k] || v === undefined || v === null) return;
            if (allowed[k].source.indexOf('typed by the user') === 0 || allowed[k].source.indexOf('AI prose from facts') === 0) return;
            values[k] = copy(v); refs[k] = ref;
        }
        function convert(v, code) {
            return convertAmount(budget, v, code);
        }
        /* A missing rate is a result for that one amount: it stays in its own currency, is left out of converted totals, and the rest still fills. */
        var noRateCodes = {};
        function convertOrNull(v, code) {
            try { return convertAmount(budget, v, code); }
            catch (err) {
                if (!isMissingRate(err)) throw err;
                if (!noRateCodes[code]) { noRateCodes[code] = true; warnings.push('Missing exchange rate for ' + code + ' to ' + base + '. Amounts in ' + code + ' are shown in ' + code + ' and left out of totals in ' + base + '.'); }
                return null;
            }
        }
        Object.keys(budget.sections || {}).forEach(function (part) {
            (budget.sections[part].items || []).forEach(function (item) {
                if (item.memoId || item.memoStatus || supplyClass(item)) return;
                var department = window.mBTBatch2 ? window.mBTBatch2.classify(item) : item.department;
                var r = role(item), cid = item.contactId;
                if (!cid || !contactMap[cid]) {
                    if (item.crew && item.crew.name) warnings.push('Assignment ' + (item.description || item.id) + ' has no current Contacts link. Its copied name was not used.');
                    return;
                }
                if (!r && (!department || department === 'atl') && role({ description: contactMap[cid].role || contactMap[cid].department }) === 'cast') r = 'cast';
                assignments.push({ item: item, contact: contactMap[cid], part: part, department: department || '', role: r });
            });
        });
        function select(key, list, label) {
            var unique = [], ids = {};
            list.forEach(function (a) { var keyId = a.item ? a.item.id : a.id; if (!keyId) return; if (!ids[keyId]) { ids[keyId] = true; unique.push(a); } });
            var found = unique.filter(function (a) { return String(a.item ? a.item.id : a.id) === String(selected[key]); });
            if (unique.length > 1) choices.push({ key: key, label: label, selected: selected[key] || '', options: unique.map(function (a) {
                return { id: a.item ? a.item.id : a.id, label: a.contact ? a.contact.name + ' / ' + a.item.description : a.name || a.floatHolder || a.vendor || a.id };
            }) });
            if (found.length) return found[0];
            if (unique.length === 1) return unique[0];
            return null;
        }
        function forRole(r) { return assignments.filter(function (a) { return a.role === r; }); }
        function person(key, r) {
            var list = forRole(r), byId = {}, unique = [];
            list.forEach(function (a) { if (!byId[a.contact.id]) { byId[a.contact.id] = true; unique.push(a); } });
            if (key === 'producers') { if (unique.length) put(key, unique.map(function (a) { return a.contact.name; }).join(', '), 'Contacts by assigned producer IDs'); return; }
            var a = select(r, unique, 'Choose assigned ' + r);
            if (a) put(key, a.contact.name || '', 'Contacts[' + a.contact.id + '].name via budget item ' + a.item.id);
        }
        var callSheetWorkingTitle = id === 'callSheet' && budget.workingTitle;
        put('productionTitle', callSheetWorkingTitle || budget.projectName || '', callSheetWorkingTitle ? 'budget.workingTitle' : 'budget.projectName');
        put('projectTitle', budget.projectName || '', 'budget.projectName');
        put('productionCompany', budget.projectCompany || budget.company || '', 'budget.projectCompany / budget.company');
        put('currency', base, 'budget.currency');
        ['director', 'producer', 'writer', 'dp', 'upm', 'firstAd', 'secondAd', 'producers', 'producerName', 'transportCoordinator'].forEach(function (key) {
            if (allowed[key]) person(key, key === 'producers' || key === 'producerName' ? 'producer' : key);
        });
        if (id === 'continuityLog') person('supervisor', 'supervisor');
        var enquiryContact = allowed.contactName ? contactChoice('enquiryContact', 'Choose project enquiry contact from Contacts') : null;
        var enquiry = enquiryContact ? { contact: enquiryContact } : allowed.contactName ? select('enquiry', forRole('producer'), 'Choose assigned production enquiry contact') : null;
        if (enquiry) ['Name', 'Email', 'Phone'].forEach(function (suffix) { var key = suffix.toLowerCase(); put('contact' + suffix, enquiry.contact[key] || '', 'Contacts[' + enquiry.contact.id + '].' + key); });
        if (id === 'pitchDeck' || id === 'wrapReport') {
            var total = number(budget.grandTotal);
            if (total !== null) { put('totalBudget', money(total), 'budget.grandTotal'); put('budgetedTotal', money(total), 'budget.grandTotal'); }
            if (id === 'pitchDeck') {
                var funded = fundingSummary(budget).confirmed;
                if (funded !== null) put('fundingToDate', money(funded), 'budget.fundingSources: Confirmed amounts, currency converted, no cashInBank duplication');
                else warnings.push('Missing exchange rate. Funding totals are unavailable.');
                if (funded !== null && total !== null) put('askAmount', money(Math.max(0, total - funded)), 'budget.grandTotal less Confirmed funding');
            }
        }
        if (id === 'fundingPackage') put('sources', budget.fundingSources || [], 'budget.fundingSources: live master rows');
        var days = number(budget.targetLock && budget.targetLock.stages && budget.targetLock.stages.prod && budget.targetLock.stages.prod.days) || number(budget.productionDays);
        if (days > 0) { put('shootDays', String(days), 'budget.targetLock.stages.prod.days / budget.productionDays'); put('totalDays', String(days), 'budget planned production days'); put('scheduledDays', String(days), 'budget planned production days'); }
        function personFields(a, prefix) {
            ['Name', 'Address', 'Phone', 'Email'].forEach(function (suffix) {
                var field = suffix.toLowerCase();
                put(prefix + suffix, a.contact[field] || '', 'Contacts[' + a.contact.id + '].' + field);
            });
        }
        function contactChoice(key, label) {
            var chosen = contactMap[selected[key]];
            if ((contacts || []).length) choices.push({ key: key, label: label, selected: selected[key] || '', options: contacts.filter(function (c) { return c.id; }).map(function (c) { return { id: c.id, label: c.name || c.id }; }) });
            return chosen || null;
        }
        if (id === 'locationAgreement' || id === 'kitRentalAgreement' || id === 'nda') {
            var prefix = id === 'nda' ? 'recipient' : 'owner';
            var namedContact = contactChoice(prefix + 'Contact', 'Choose ' + prefix + ' from Contacts');
            if (namedContact) personFields({ contact: namedContact }, prefix);
        }
        if (id === 'crewDealMemo') {
            var crew = select('subject', assignments.filter(function (a) { return a.role !== 'cast'; }), 'Choose crew engagement');
            if (crew) {
                personFields(crew, 'employee');
                put('role', crew.item.description || '', 'budget item ' + crew.item.id + '.description');
                put('department', crew.department, 'budget item ' + crew.item.id + '.department / classifier');
                var units = { day: 'Daily', daily: 'Daily', week: 'Weekly', weekly: 'Weekly', hour: 'Hourly', hourly: 'Hourly', flat: 'Flat', allowance: 'Flat' };
                put('rateType', units[norm(crew.item.unit)] || String(crew.item.unit || ''), 'budget item ' + crew.item.id + '.unit');
                if (number(crew.item.rate) !== null) {
                    var crewRate = convertOrNull(crew.item.rate, crew.item.currency || base);
                    put('rate', crewRate === null ? ownMoney(crew.item.rate, crew.item.currency) : money(crewRate), 'budget item ' + crew.item.id + '.rate in ' + (crewRate === null ? crew.item.currency : base));
                }
            }
        }
        if (id === 'talentAgreement' || id === 'appearanceRelease' || id === 'extrasVoucher') {
            var contactKey = id === 'talentAgreement' ? 'performerContact' : id === 'extrasVoucher' ? 'extraContact' : 'releasorContact';
            var directContact = contactChoice(contactKey, 'Choose document participant from Contacts');
            var performer = directContact ? { contact: directContact, item: {} } : select('subject', forRole('cast'), 'Choose performer');
            if (directContact && id === 'talentAgreement') {
                var engagements = forRole('cast').filter(function (a) { return a.contact.id === directContact.id; });
                performer = select('subject', engagements, 'Choose performer engagement') || performer;
            }
            if (performer) {
                if (id === 'talentAgreement') {
                    put('performerLegalName', performer.contact.legalName || '', 'Contacts[' + performer.contact.id + '].legalName');
                    put('performerStageName', performer.contact.stageName || '', 'Contacts[' + performer.contact.id + '].stageName');
                    ['Address','Phone'].forEach(function (suffix) { var f = suffix.toLowerCase(); put('performer' + suffix, performer.contact[f] || '', 'Contacts[' + performer.contact.id + '].' + f); });
                    if (performer.item.role) put('characterName', performer.item.role, 'budget cast item ' + performer.item.id + '.role');
                } else personFields(performer, id === 'extrasVoucher' ? 'extra' : 'releasor');
            }
        }
        function crewRow(a) { return { itemId: a.item.id, contactId: a.contact.id, department: a.department, name: a.contact.name || '', role: a.item.description || '', phone: a.contact.phone || '', email: a.contact.email || '', notes: a.item.notes || '', rate: money(convert(a.item.rate || 0, a.item.currency || base)), rateUnit: a.item.unit || '', phases: Object.keys(a.item.stageData || {}).join(', '), union: a.contact.unionStatus || '', emergencyContact: a.contact.emergencyContact || '', emergencyPhone: a.contact.emergencyPhone || '' }; }
        if (id === 'crewList') put('crew', assignments.filter(function (a) { return a.role !== 'cast'; }).map(crewRow), 'budget assignments by item ID; Contacts by contact ID');
        if (id === 'movementOrder') {
            var movement = assignments.map(function (a) {
                var prior = (doc.movementRows || []).filter(function (row) { return row.itemId === a.item.id && row.contactId === a.contact.id; })[0] || {};
                return { itemId: a.item.id, contactId: a.contact.id, name: a.contact.name || '', role: a.item.description || '', pickup: prior.pickup || '', pickupTime: prior.pickupTime || '', vehicle: prior.vehicle || '', destination: prior.destination || '', arrivalTime: prior.arrivalTime || '', notes: prior.notes || '' };
            });
            (doc.movementRows || []).forEach(function (row) { if (!movement.some(function (m) { return m.itemId === row.itemId && m.contactId === row.contactId; })) movement.push(copy(row)); });
            put('movementRows', movement, 'budget assignments and Contacts by ID; linked transport plans and unlinked document rows retained');
        }
        if (id === 'callSheet' || id === 'dood') {
            var casts = forRole('cast').map(function (a, i) {
                var prior = (doc.cast || []).filter(function (row) { return row.itemId === a.item.id && row.contactId === a.contact.id; })[0] || {};
                if (id === 'dood') return { itemId: a.item.id, contactId: a.contact.id, name: a.contact.name || '', role: a.item.role || '', days: copy(prior.days || {}) };
                return { itemId: a.item.id, contactId: a.contact.id, id: prior.id || String(i + 1), character: a.item.role || '', actor: a.contact.name || '', status: prior.status || '', pickup: prior.pickup || '', call: prior.call || '', blockRehearsal: prior.blockRehearsal || '', wardrobeMakeup: prior.wardrobeMakeup || '', onSet: prior.onSet || '' };
            });
            /* Planned timing is reused only for the same linked assignment. User rows stay visible. */
            (doc.cast || []).forEach(function (row) {
                if (!casts.some(function (cast) { return cast.itemId === row.itemId && cast.contactId === row.contactId; })) casts.push(copy(row));
            });
            put('cast', casts, 'budget cast assignments; Contacts by contact ID; linked schedule values and unlinked document rows retained');
        }
        if (id === 'pettyCash') {
            var floats = (budget.ledgers && budget.ledgers.pettyCash) || [], float = select('float', floats, 'Choose petty cash float');
            if (float) {
                var openingConv = convertOrNull(float.floatAmount, float.currency), opening = openingConv === null ? 0 : openingConv, entries = [];
                (float.receipts || []).forEach(function (r) {
                    var receiptCode = r.currency || float.currency;
                    var amt = convertOrNull(r.amount, receiptCode);
                    if (doc.periodStart && r.date && r.date < doc.periodStart) { if (amt !== null) opening -= amt; return; }
                    if (doc.periodEnd && r.date && r.date > doc.periodEnd) return;
                    entries.push({ id: float.id && r.id ? String(r.id) : '', floatId: float.id || '', date: r.date || '', description: r.description || '', category: r.category || float.sectionKey || '', amount: amt === null ? ownMoney(r.amount, receiptCode) : money(amt), receiptNum: r.receiptNum || r.id || '', approvedBy: r.approvedBy || '' });
                });
                put('floatAmount', openingConv === null ? ownMoney(float.floatAmount, float.currency) : money(opening), 'budget.ledgers.pettyCash[' + float.id + '].floatAmount less receipts before period');
                put('entries', entries, 'budget.ledgers.pettyCash[' + float.id + '].receipts, selected period');
                put('custodian', contactMap[float.contactId] ? contactMap[float.contactId].name : float.floatHolder || '', 'selected float contactId / floatHolder');
                var floatItem = ((budget.sections || {})[float.sectionKey] || {}).items || [];
                var floatLine = floatItem.filter(function (item) { return item.id === float.itemId; })[0];
                put('department', floatLine ? (window.mBTBatch2 ? window.mBTBatch2.classify(floatLine) : floatLine.department) || '' : float.sectionKey || '', 'selected float.sectionKey and linked budget item department');
                if (doc.periodStart || doc.periodEnd) put('dateRange', (doc.periodStart || '') + ' to ' + (doc.periodEnd || ''), 'document selected period');
            }
        }
        if (id === 'purchaseOrder' || id === 'vendorInvoice') {
            var po = select('po', (budget.ledgers && budget.ledgers.pos) || [], 'Choose purchase order');
            if (po) {
                put(id === 'purchaseOrder' ? 'poNumber' : 'poReference', po.poNumber || '', 'budget.ledgers.pos[' + po.id + '].poNumber');
                var supplier = contactMap[selected.vendorContact] || contactMap[po.contactId];
                if (!supplier) supplier = contactChoice('vendorContact', 'Choose vendor from Contacts');
                if (supplier) ['Name', 'Address', 'Phone', 'Email', 'TaxId'].forEach(function (suffix) { var f = suffix.charAt(0).toLowerCase() + suffix.slice(1); put('vendor' + suffix, supplier[f] || '', 'Contacts[' + supplier.id + '].' + f); });
                else warnings.push('This PO has no current Contacts link. Choose a vendor rather than using a copied vendor name.');
                if (Array.isArray(po.items) && po.items.length) put('items', po.items.map(function (line) {
                    return { description: line.description || '', quantity: number(line.quantity) === null ? '' : line.quantity, unitPrice: number(line.unitPrice) === null ? '' : (function () { var lineCode = line.currency || po.currency, priced = convertOrNull(line.unitPrice, lineCode); return priced === null ? ownMoney(line.unitPrice, lineCode) : money(priced); })() };
                }), 'selected PO recorded line detail; unit prices converted to budget currency');
                if (id === 'purchaseOrder') {
                    var poItem = (((budget.sections || {})[po.sectionKey] || {}).items || []).filter(function (item) { return item.id === po.itemId; })[0];
                    var department = poItem ? (window.mBTBatch2 ? window.mBTBatch2.classify(poItem) : poItem.department) : '';
                    put('date', po.date || '', 'selected PO.date'); put('budgetCategory', department || po.sectionKey || '', 'selected PO item department / accounting budget part'); put('notes', po.notes || '', 'selected PO.notes');
                }
            }
        }
        if (id === 'wrapReport' || id === 'weeklyCostReport') {
            var sections = [], actualTotal = 0, crewIds = {}, castIds = {};
            assignments.forEach(function (a) { (a.role === 'cast' ? castIds : crewIds)[a.contact.id] = true; });
            Object.keys(budget.sections || {}).forEach(function (part) {
                var est = 0, act = 0;
                (budget.sections[part].items || []).forEach(function (item) {
                    est += number(item.total) || 0; act += number(item.actual) || 0;
                });
                actualTotal += act;
                sections.push({ sectionName: part, budgeted: money(est), actual: money(act), variance: money(est - act) });
            });
            if (id === 'wrapReport') {
                var unpaid = ((budget.ledgers && budget.ledgers.pos) || []).filter(function (po) { return ['Committed', 'Invoiced'].indexOf(po.status) > -1; }).map(function (po) {
                    var poAmt = convertOrNull(po.amount, po.currency), poPaid = convertOrNull(po.paidAmount || 0, po.currency);
                    if (poAmt === null || poPaid === null) {
                        var ownRemaining = Math.max(0, number(po.amount) - (number(po.paidAmount || 0) || 0));
                        return ownRemaining > 0 ? (po.poNumber || po.id) + ': ' + po.currency + ' ' + money(ownRemaining) + ' (' + po.status + ')' : '';
                    }
                    var remaining = Math.max(0, poAmt - poPaid);
                    return remaining > 0 ? (po.poNumber || po.id) + ': ' + base + ' ' + money(remaining) + ' (' + po.status + ')' : '';
                }).filter(function (line) { return line; });
                put('outstandingInvoices', unpaid.length ? unpaid.join('\n') : 'None recorded', 'budget.ledgers.pos Committed / Invoiced amounts less paidAmount; Paid excluded');
                put('crewCount', String(Object.keys(crewIds).length), 'unique assigned crew Contact IDs');
                put('castCount', String(Object.keys(castIds).length), 'unique assigned performer Contact IDs');
                put('sections', sections, 'budget.sections item estimates and actuals');
                put('actualTotal', money(actualTotal), 'budget.sections[].items[].actual');
                if (number(budget.grandTotal) !== null) put('variance', money(Number(budget.grandTotal) - actualTotal), 'budget.grandTotal less recorded actual');
            } else {
                var weekly = weeklyRows(budget);
                committedNote = weekly.committedNote;
                warnings = warnings.concat(weekly.warnings);
                put('lineItems', weekly.rows, 'budget items and outstanding linked PO commitments; actual allocation warnings retained');
            }
        }
        return { template: id, values: values, refs: refs, choices: choices, warnings: warnings, committedNote: committedNote, fundingContext: fundingContext(budget), prose: (prose[id] || []).filter(function (key) { return allowed[key] && allowed[key].source.indexOf('AI prose from facts') === 0; }) };
    }
    window.mBTDocumentProjection = { loadMap: loadMap, setMap: function (data) { schema = data; }, project: project, fields: fields, prose: prose, timeout: 120000, convertAmount: convertAmount, fundingSummary: fundingSummary, fundingContext: fundingContext, fundingPrompt: fundingPrompt, weeklyRows: weeklyRows };
})(window);
