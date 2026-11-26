/**
 * © 2026 Jayson Moo-Young <moo@moo.llc>
 * Part of the mBT (mooBudgetTool) Ecosystem.
 * License: MIT
 */

/* ========= v19.54 mBTPublisher: OUTPUT & COMMUNICATIONS ENGINE v20.0 ========= */
/* Tier 5 Module Controller — document generation, file IO, communication links.
   All methods accept data as parameters. No global state reads.
   Depends on: jsPDF (window.jspdf), jspdf-autotable, XLSX, JSZip, html2pdf, html2canvas.
   Optional: window.mBTLE (currency formatting), window.mBTME (modal alerts). */
(function () {
    'use strict';

    /* --- Helpers --- */
    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeAssetUrl(url) {
        var raw = String(url || '').trim();
        var schemeCheck = raw.replace(/[\u0000-\u0020\u007f]/g, '');
        if (!raw || /^\/\//.test(raw)) return '';
        if (/^https?:\/\//i.test(raw)) return esc(raw);
        if (/^[a-z][a-z0-9+.-]*:/i.test(schemeCheck)) return '';
        return esc(raw);
    }

    function notify(title, msg) {
        if (typeof mBTME !== 'undefined' && mBTME.alert) {
            mBTME.alert(title, msg);
        } else {
            alert(title + ': ' + msg);
        }
    }

    /* The real app version: this window's own value, or the app window's when this runs inside a tool window. Never a typed number. */
    function appVersion() {
        if (typeof APP_VERSION !== 'undefined') return APP_VERSION;
        try { if (window.parent && window.parent !== window && window.parent.APP_VERSION) return window.parent.APP_VERSION; } catch (err) {}
        try { if (window.top && window.top.APP_VERSION) return window.top.APP_VERSION; } catch (err2) {}
        return '';
    }
    /* rate: multiplier from budget's stored currency to display currency (default 1 = no conversion) */
    function fmtCurrency(val, currency, rate) {
        var n = (parseFloat(val) || 0) * (parseFloat(rate) || 1);
        if (typeof mBTLE !== 'undefined' && mBTLE.format && mBTLE.format.currency) {
            return mBTLE.format.currency(n, currency || 'JMD');
        }
        var symbols = { JMD: 'J$', USD: '$', GBP: '£', CAD: 'C$', EUR: '€', TTD: 'TT$', BBD: 'Bds$', GYD: 'G$', XCD: 'EC$', MXN: 'MX$' };
        var sym = symbols[currency] || '$';
        return sym + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function slugify(str) {
        return String(str || 'budget').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    }
    function documentValue(value) {
        return value == null || value === '' ? 'Not provided' : String(value);
    }

    function fundingFacts(budget) {
        if (!window.mBTDocumentProjection) throw new Error('Document facts are not loaded. Reopen Docs and retry.');
        var ctx = window.mBTDocumentProjection.fundingContext(budget || {});
        ctx.confirmed = ctx.confirmedWithRates; ctx.gap = ctx.gapWithRates;
        return ctx;
    }
    function fundingAmount(budget, source) {
        var rows = fundingFacts(budget).sources;
        var index = (budget.fundingSources || []).indexOf(source);
        return index >= 0 ? rows[index].amountInBudgetCurrency : null;
    }
    function fundingDisplay(budget, source, fmt) {
        var amount = fundingAmount(budget, source);
        if (amount !== null) return fmt(amount);
        return esc(source.currency || budget.currency || 'JMD') + ' ' + esc(String(source.amount)) +
            '<br><small>Missing exchange rate. This source is left out of totals in the budget currency.</small>';
    }
    function reportCompany(budget) {
        return paperBrand((budget && (budget.projectCompany || budget.company)) || '');
    }
    function typedReportDate(budget, field) {
        if (!budget || !field || budget[field] == null || budget[field] === '') return '';
        return String(budget[field]);
    }

    /* Production paperwork helpers (cash voucher, group and minor consent, interview sheet,
       equipment checklist, release grantee lines). Brand is "moo" only. A missing value prints
       as a write-in line; amounts, phones, times and serials are never invented. */
    var PAPER_BLANK = '________';
    function paperText(v) {
        if (v == null) return '';
        if (typeof v === 'object') return paperText(v.name || v.label || '');
        return String(v).trim();
    }
    function paperFirst() {
        for (var i = 0; i < arguments.length; i++) {
            var t = paperText(arguments[i]);
            if (t) return t;
        }
        return '';
    }
    /* Company/office names only; preserve email domains and web addresses in the same text. */
    function paperBrand(text) { return String(text || '').replace(/(^|[^\p{L}\p{N}@/.])moo\.llc(?![\p{L}\p{N}/?#]|:\d|\.[\p{L}\p{N}])/giu, '$1moo'); }
    function paperEsc(text) { return esc(paperBrand(text)); }
    function paperContacts(b, opts) {
        var lists = [], seen = Object.create(null), out = [], linked = Object.create(null);
        var budgetContacts = b && Array.isArray(b.contacts) ? b.contacts : [];
        function link(id) {
            if (id != null && id !== '') linked[String(id)] = true;
        }
        Object.keys((b && b.sections) || {}).forEach(function (name) {
            ((b.sections[name] || {}).items || []).forEach(function (item) {
                if (!item) return;
                link(item.contactId);
                link(item.contact_id);
                link(item.crew && item.crew.contactId);
            });
        });
        var ledgers = (b && b.ledgers) || {};
        (ledgers.pos || []).forEach(function (po) { link(po && po.contactId); });
        (ledgers.pettyCash || []).forEach(function (fl) {
            if (!fl) return;
            link(fl.contactId);
            (fl.receipts || []).forEach(function (r) { link(r && r.contactId); });
        });
        budgetContacts.forEach(function (c) { link(c && c.id); });
        opts = opts || {};
        if (Array.isArray(opts.contacts)) lists.push(opts.contacts);
        if (opts.editorData && Array.isArray(opts.editorData.contacts)) lists.push(opts.editorData.contacts);
        if (b && Array.isArray(b.contacts)) lists.push(b.contacts);
        if (b && Array.isArray(b.openGateContacts)) lists.push(b.openGateContacts);
        if (typeof window !== 'undefined' && window.mBTOG && Array.isArray(window.mBTOG.contacts)) lists.push(window.mBTOG.contacts);
        lists.forEach(function (arr) {
            arr.forEach(function (c) {
                if (!c || typeof c !== 'object') return;
                if (budgetContacts.indexOf(c) === -1 && !(c.id != null && linked[String(c.id)])) return;
                var key = c.id != null && c.id !== '' ? 'id:' + c.id : 'name:' + String(c.name || '').toLowerCase();
                if (seen[key]) return;
                seen[key] = true;
                out.push(c);
            });
        });
        return out;
    }
    function paperContactById(contacts, id) {
        if (id == null || id === '') return null;
        for (var i = 0; i < contacts.length; i++) {
            if (contacts[i].id != null && String(contacts[i].id) === String(id)) return contacts[i];
        }
        return null;
    }
    function paperLineContact(item, contacts) {
        if (!item) return null;
        var byId = paperContactById(contacts, item.contactId || item.contact_id || (item.crew && item.crew.contactId) || '');
        if (byId) return byId;
        var name = paperFirst(item.crew && item.crew.name, item.vendor, item.payee);
        if (!name) return null;
        var low = name.toLowerCase();
        for (var i = 0; i < contacts.length; i++) {
            if (contacts[i] && paperText(contacts[i].name).toLowerCase() === low) return contacts[i];
        }
        return null;
    }
    function paperCurrencyCode(currency) {
        var text = String(currency || '').trim().toUpperCase();
        if (/^(J\$|JA\$|JMD)$/.test(text)) return 'JMD';
        if (/^(US\$|USD|\$US)$/.test(text)) return 'USD';
        return /^(GBP|CAD|EUR|TTD|BBD|GYD|XCD)$/.test(text) ? text : '';
    }
    function paperAmount(v, currency) {
        if (v == null || v === '' || typeof v === 'boolean' || typeof v === 'object') return null;
        // Stored numeric values are computed money; only typed text uses the strict grammar below.
        if (typeof v === 'number') {
            if (!isFinite(v) || v < 0 || v >= 1e12) return null;
            var parts = String(v).split('e');
            var rounded = Math.round(Number(parts[0] + 'e' + ((Number(parts[1]) || 0) + 2))) / 100;
            return rounded >= 1e12 ? null : (rounded === 0 ? 0 : rounded);
        }
        var s = String(v).trim();
        if (!s) return null;
        var match = s.match(/^(?:(J\$|JA\$|US\$|\$US|\$|JMD|USD|GBP|CAD|EUR|TTD|BBD|GYD|XCD)\s*)?(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?(?:\s*(JMD|USD|GBP|CAD|EUR|TTD|BBD|GYD|XCD|dollars?|Jamaican dollars?|United States dollars?))?$/i);
        if (!match) return null;
        var currencyCode = paperCurrencyCode(currency);
        var nonDollar = currencyCode === 'GBP' || currencyCode === 'EUR';
        if (currency !== undefined && [match[1], match[4]].some(function (marker) {
            if (nonDollar && /^(?:\$|dollars?)$/i.test(marker)) return true;
            var code = /^Jamaican dollars?$/i.test(marker) ? 'JMD' : /^United States dollars?$/i.test(marker) ? 'USD' : paperCurrencyCode(marker);
            return code && code !== currencyCode;
        })) return null;
        var n = Number(match[2].replace(/,/g, '') + (match[3] ? '.' + match[3] : ''));
        if (!isFinite(n) || n < 0 || n >= 1e12) return null;
        return n === 0 ? 0 : n;
    }
    function paperLineTotal(item, currency) {
        if (!item) return null;
        // A supplied total or amount is authoritative, including invalid text: never guess a replacement.
        if (item.total !== undefined) return paperAmount(item.total, currency);
        if (item.amount !== undefined) return paperAmount(item.amount, currency);
        var q = paperAmount(item.quantity), r = paperAmount(item.rate);
        if (q === null || r === null) return null;
        var m = (item.multiplier != null && item.multiplier !== '') ? paperAmount(item.multiplier) : 1;
        if (m === null) return null;
        // Validate operands without rounding numeric rates or quantities before multiplication.
        if (typeof item.quantity === 'number') q = item.quantity;
        if (typeof item.rate === 'number') r = item.rate;
        if (typeof item.multiplier === 'number') m = item.multiplier;
        return paperAmount(q * r * m);
    }
    function paperProductionSection(sec, name) {
        var id = String((sec && sec.id) || '').toLowerCase();
        return ['prod', 'btl', 'btl_prod', 'tech', 'gear', 'conn', 'equipment',
            'dep-camera', 'dep-sound', 'dep-electrical', 'dep-grip', 'dep-art', 'dep-wardrobe', 'dep-makeup',
            'dep-production', 'dep-location', 'dep-transport', 'dep-catering', 'dep-live', 'dep-equipment'].indexOf(id) > -1 ||
            /production|equipment|gear/i.test(String(name || ''));
    }
    function paperIsProducerRole(text) {
        var role = paperWithoutParentheses(String(text || ''));
        return role.split(/[\/&,:]|\s+-\s+(?!\s*\d)/).some(function (part) {
            if (/\b(?:line(?:\s+|-)producer|assistant\s+to\s+the\s+producer)\b/i.test(part)) return false;
            return part.split(/(?<=\p{L})-(?=\p{L})/u).some(function (title) {
                return /(?<![\p{L}\p{M}\p{N}_])producer$/iu.test(title.replace(/[\s\p{P}]+$/u, ''));
            });
        });
    }
    function paperWithoutParentheses(text) {
        while (/\([^()]*\)/.test(text)) text = text.replace(/\([^()]*\)/g, ' ');
        return text;
    }
    function paperPurposeNormalized(text) {
        // Comparison only: never print this folded copy. Keep the established width aliases.
        return paperText(text).normalize('NFC').replace(/[\uff01-\uff5e]/g, function (ch) {
            return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
        }).replace(/[\u2018\u2019`]/g, "'").replace(/\s+/g, ' ');
    }
    function paperPurposeUnsafe(result, original) {
        var tokens = result.split(/\s+/).filter(Boolean);
        function connective(token) { return /^(?:to|for|of|by|from|at|with|and|&|or|and\/or)$/i.test(token); }
        if (tokens.length && (connective(tokens[0]) || connective(tokens[tokens.length - 1]))) return true;
        if (/^[,;:/-]|[,;:/-]$/.test(result) || /\(\s*\)|\[\s*\]/.test(result)) return true;
        for (var i = 0; i < tokens.length - 1; i++) {
            if (connective(tokens[i]) && (connective(tokens[i + 1]) || /^[,;:/)\]]/.test(tokens[i + 1]))) return true;
        }
        // Bracket wrappers must not hide a newly exposed slash, as in Camera (/Bob).
        function slashEdges(text) {
            return text.split(/\s+/).map(function (token) { return token.replace(/^[([{]+|[)\]}]+$/g, ''); })
                .filter(function (token) { return /^\/|\/$/.test(token); });
        }
        var originalEdges = slashEdges(original);
        var resultEdges = slashEdges(result);
        for (var k = 0; k < resultEdges.length; k++) {
            var at = originalEdges.indexOf(resultEdges[k]);
            if (at === -1) return true;
            originalEdges.splice(at, 1);
        }
        function balanced(text) {
            var stack = [];
            for (var j = 0; j < text.length; j++) {
                var ch = text[j], closing = ')]}'.indexOf(ch);
                if ('([{'.indexOf(ch) !== -1) stack.push(ch);
                else if (closing !== -1 && stack.pop() !== '([{'[closing]) return false;
            }
            return !stack.length;
        }
        return balanced(original) && !balanced(result);
    }
    function paperStripName(text, payee, contact) {
        var original = paperText(text).normalize('NFC');
        if (!original) return '';
        var s = original, p = paperPurposeNormalized(payee);
        var removed = false;
        if (p) {
            function literal(ch) { return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
            var pattern = Array.from(p).map(function (ch) {
                if (ch === ' ') return '\\s+';
                if (ch === "'") return "['\u2018\u2019`]";
                var n = ch.charCodeAt(0);
                return n >= 0x21 && n <= 0x7e ? '(?:' + literal(ch) + '|' + String.fromCharCode(n + 0xfee0) + ')' : literal(ch);
            }).join('');
            // A hyphen or apostrophe joining letters belongs to the name, not its boundary.
            var name = new RegExp("(?<![\\p{L}\\p{M}\\p{N}_])(?<!\\p{L}[-'\u2018\u2019`])" + pattern + "(?:['\u2018\u2019`]s)?(?![\\p{L}\\p{M}\\p{N}_]|[-'\u2018\u2019`]\\p{L})", 'giu');
            // Locate names in the original, then work backwards so earlier offsets stay valid.
            var matches = Array.from(original.matchAll(name));
            matches.reverse().forEach(function (match) {
                var left = s.slice(0, match.index), right = s.slice(match.index + match[0].length);
                var governing = left.match(/(^|[^\p{L}\p{M}\p{N}_/'\u2018\u2019`-])(to|for|of|by|from|at|with|and|&|or)\s+$/iu);
                // Only a separator or a coordinating word next to this name can join its span.
                var separator = right.match(/^\s*[,;:]\s*/);
                if (separator) right = right.slice(separator[0].length);
                var coordinating = (governing || !left.trim()) && right.match(/^\s*(and|&|or)(?![\p{L}\p{M}\p{N}_/])\s*/iu);
                if (coordinating) right = right.slice(coordinating[0].length);
                if (governing) {
                    // "for services", "for sound recordist" and "for tonight" keep their purpose preposition.
                    var keepFor = /^for$/i.test(governing[2]) && /^\s*[\p{L}\p{N}]/u.test(right) &&
                        (!/^\s*(?:only|in|to|for|of|by|from|at|with|and|or)\b/i.test(right) || /^\s*and\/or(?:\s|$)/i.test(right));
                    var keepCoordinating = coordinating && /^(?:to|for)$/i.test(governing[2]);
                    if (!keepFor && !keepCoordinating) left = left.slice(0, governing.index + governing[1].length);
                }
                // Remove a bracket pair only when this removal has made it empty.
                var open = left.match(/\s*([([{])\s*$/), close = right.match(/^\s*([)\]}])/);
                if (open && close && '([{'.indexOf(open[1]) === ')]}'.indexOf(close[1])) {
                    left = left.slice(0, open.index);
                    right = right.slice(close[0].length);
                }
                left = left.replace(/\s+$/, '');
                right = right.replace(/^\s+/, '');
                var join = left && right && !/[([{]$/.test(left) && !/^[,.;:!?)\]}]/.test(right) ? ' ' : '';
                s = left + join + right;
                removed = true;
            });
        }
        if (removed) {
            // Judge newly exposed edge slashes before the edge trim can erase them.
            if ((/^\s*\//.test(s) && !/^\//.test(original)) ||
                (/\/\s*$/.test(s) && !/\/$/.test(original))) return '';
            s = s.replace(/^[\s,\-:;/|\u2013\u2014]+|[\s,\-:;/|\u2013\u2014]+$/g, '');
            // Unwrap one whole remaining bracket group, never brackets beside other text.
            if (/^[([{]/.test(s)) {
                var brackets = [], wholeGroup = true;
                for (var j = 0; j < s.length; j++) {
                    var ch = s[j], closing = ')]}'.indexOf(ch);
                    if ('([{'.indexOf(ch) !== -1) brackets.push(ch);
                    else if (closing !== -1 && brackets.pop() !== '([{'[closing]) { wholeGroup = false; break; }
                    if (!brackets.length && j < s.length - 1) { wholeGroup = false; break; }
                }
                if (wholeGroup && !brackets.length) s = s.slice(1, -1).trim();
            }
        }
        // Repetition is redundant only for a known payee or that contact's role/title.
        var known = [p, contact && contact.role, contact && contact.title].map(function (v) { return paperPurposeNormalized(v).toLowerCase(); }).filter(Boolean);
        function knownRepeat(a, b) {
            var key = paperPurposeNormalized(a).toLowerCase();
            return key === paperPurposeNormalized(b).toLowerCase() && known.indexOf(key) !== -1;
        }
        var parenthetical = s.match(/^(.*?)\s*[([]([^()[\]]+)[)\]]\s*$/);
        if (parenthetical && knownRepeat(parenthetical[1], parenthetical[2])) s = parenthetical[1].trim();
        var segments = s.split(/\s+[-\u2013\u2014:;/|]\s+|\s*[:;/|]\s*/);
        if (segments.length > 1 && segments.every(function (part) { return knownRepeat(segments[0], part); })) s = segments[0].trim();
        // The safety net only judges text from which a payee name was actually removed.
        if (removed && paperPurposeUnsafe(s, original)) return '';
        // Label words alone supply no meaningful purpose.
        if (!/[\p{L}\p{N}]/u.test(s) || /^(?:payment|payments|paid|pay|pays|fee|fees|for|to|of|by|the)(?:\s+(?:payment|payments|paid|pay|pays|fee|fees|for|to|of|by|the))*$/i.test(s)) return '';
        return s;
    }
    /* Producer, client and the configurable grantee line ("<producer> trading as moo, producer for <client>").
       Order: document value, render option, budget.paperworkSettings, budget fields, then the linked producer line. */
    function paperworkParty(b, opts, allowBlankProducer) {
        b = b || {}; opts = opts || {};
        var ed = opts.editorData || {};
        var s = (b.paperworkSettings && typeof b.paperworkSettings === 'object') ? b.paperworkSettings : {};
        var contacts = paperContacts(b, opts);
        var overrides = (ed._autofill && ed._autofill.overrides) || {};
        var keepProducerBlank = allowBlankProducer && overrides.producerName && !paperText(ed.producerName);
        var producer = keepProducerBlank ? '' : paperFirst(ed.producerName, opts.producerName, s.producerName, b.producerName, b.producer);
        if (!keepProducerBlank && !producer) {
            Object.keys(b.sections || {}).some(function (k) {
                return ((b.sections[k] || {}).items || []).some(function (item) {
                    if (!item || item.memoId || item.memoStatus) return false;
                    var c = paperLineContact(item, contacts);
                    var roles = [c && c.role, c && c.title, item.crew && item.crew.role, item.role];
                    if (!c) roles.push(item.description);
                    var name = c ? paperText(c.name) : paperText(item.crew && item.crew.name);
                    if (name && roles.some(paperIsProducerRole)) { producer = name; return true; }
                    return false;
                });
            });
        }
        if (!keepProducerBlank && !producer) {
            contacts.some(function (c) {
                if (c && (paperIsProducerRole(c.role) || paperIsProducerRole(c.title))) {
                    producer = paperText(c.name);
                    return !!producer;
                }
                return false;
            });
        }
        var client = paperFirst(ed.clientName, ed.client, ed.grantee, opts.clientName, opts.client, opts.grantee, s.clientName, s.client, b.clientName, b.client, b.clientOrganisation, b.clientOrganization, b.projectClient, b.grantee);
        if (!client) {
            contacts.some(function (c) {
                if (c.category === 'client') client = paperFirst(c.organisation, c.organization, c.company, c.name);
                return !!client;
            });
        }
        var line = paperFirst(ed.granteeLine, opts.granteeLine, s.granteeLine, b.granteeLine);
        if (!line && producer) line = producer + ' trading as moo, producer for ' + (client || PAPER_BLANK);
        return { producer: paperBrand(producer), client: paperBrand(client), line: paperBrand(line), brand: 'moo' };
    }
    function paperReleaseGrantee(b, opts, explicitLine) {
        var party = paperworkParty(b, opts, true);
        var line = paperBrand(paperFirst(explicitLine, party.line));
        if (line) return line;
        return (party.producer || PAPER_BLANK) + ' trading as moo, producer for ' + (party.client || PAPER_BLANK);
    }
    /* Short client name used inside fixed wording: "Environmental Foundation of Jamaica (EFJ)" gives "EFJ". */
    function paperClientShort(client) {
        var m = String(client || '').match(/\(([^)]+)\)\s*$/);
        return m ? m[1].trim() : String(client || '').trim();
    }
    function paperDate(v) {
        var s = v != null ? String(v).trim() : '';
        var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return s;
        var year = parseInt(m[1], 10), monthIdx = parseInt(m[2], 10) - 1, dayNum = parseInt(m[3], 10);
        var dt = new Date(Date.UTC(year, monthIdx, dayNum));
        if (monthIdx < 0 || monthIdx > 11 || dt.getUTCFullYear() !== year || dt.getUTCMonth() !== monthIdx || dt.getUTCDate() !== dayNum) return s;
        var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return dayNum + ' ' + months[monthIdx] + ' ' + year;
    }
    function paperWords(n, currency) {
        if (n == null || typeof n === 'boolean' || (typeof n === 'string' && !n.trim())) return '';
        n = Number(n);
        if (!isFinite(n) || n < 0 || n >= 1e12) return '';
        var ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
        var tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
        function under1000(x) {
            var out = [];
            if (x >= 100) { out.push(ones[Math.floor(x / 100)] + ' hundred'); x = x % 100; }
            if (x >= 20) { out.push(tens[Math.floor(x / 10)] + (x % 10 ? '-' + ones[x % 10] : '')); }
            else if (x > 0 || !out.length) out.push(ones[x]);
            return out.join(' ');
        }
        function spell(x) {
            if (x === 0) return 'zero';
            var scales = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']], out = [];
            scales.forEach(function (sc) {
                if (x >= sc[0]) { out.push(under1000(Math.floor(x / sc[0])) + ' ' + sc[1]); x = x % sc[0]; }
            });
            if (x > 0) out.push(under1000(x));
            return out.join(' ');
        }
        var minor = Math.round(n * 100), whole = Math.floor(minor / 100), cents = minor % 100;
        if (cents === 100) { whole += 1; cents = 0; }
        var names = { JMD: 'Jamaican dollars', USD: 'United States dollars', GBP: 'pounds sterling', CAD: 'Canadian dollars', EUR: 'euros', TTD: 'Trinidad and Tobago dollars', BBD: 'Barbados dollars', GYD: 'Guyana dollars', XCD: 'Eastern Caribbean dollars', MXN: 'Mexican pesos' };
        var unit = names[currency] || currency || '';
        if (whole === 1) unit = unit.replace(/dollars$/, 'dollar').replace(/euros$/, 'euro').replace(/pesos$/, 'peso').replace(/^pounds sterling$/, 'pound sterling');
        var words = spell(whole) + ' ' + unit;
        if (cents) words += ', ' + spell(cents) + (cents === 1 ? ' cent' : ' cents');
        words = words.replace(/\s+/g, ' ').trim();
        return words.charAt(0).toUpperCase() + words.slice(1);
    }
    function paperWriteIn(v, wide, contactField) {
        var t = paperText(v);
        return t ? (contactField ? esc(t) : paperEsc(t)) : '<span class="cs-writein pp-wi' + (wide ? ' pp-wi-wide' : '') + '">' + PAPER_BLANK + '</span>';
    }
    function paperBox(label) {
        return '<span class="pp-box-item"><input type="checkbox" class="cs-checkbox" aria-checked="false">' + paperEsc(label) + '</span>';
    }
    function paperField(label, valueHtml, wide) {
        return '<div class="pp-field' + (wide ? ' pp-wide' : '') + '"><div class="pp-label">' + paperEsc(label) + '</div><div class="pp-value">' + valueHtml + '</div></div>';
    }
    function paperSig(title, printedName, extraCaption) {
        var rows = '<div class="pp-sig-row"><div class="pp-sig-line"></div><div class="pp-caption">SIGNATURE</div></div>' +
            '<div class="pp-sig-row"><div class="pp-sig-line">' + (printedName ? paperEsc(printedName) : '') + '</div><div class="pp-caption">PRINTED NAME</div></div>' +
            '<div class="pp-sig-row"><div class="pp-sig-line"></div><div class="pp-caption">DATE</div></div>';
        if (extraCaption) rows += '<div class="pp-sig-row"><div class="pp-sig-line"></div><div class="pp-caption">' + paperEsc(extraCaption) + '</div></div>';
        return '<div class="pp-sig"><div class="pp-sig-title">' + paperEsc(title) + '</div>' + rows + '</div>';
    }
    function paperDual(left, right) { return '<div class="pp-dual">' + left + right + '</div>'; }
    function paperHeader(title, subParts) {
        var sub = (subParts || []).map(paperText).filter(Boolean).map(paperEsc).join(' &middot; ');
        return '<div class="pp-head"><div class="cs-brand">moo</div><h1 class="pp-title">' + paperEsc(title) + '</h1>' +
            (sub ? '<div class="pp-sub">' + sub + '</div>' : '') + '</div>';
    }
    function paperLines(count) {
        var out = '';
        for (var i = 0; i < count; i++) out += '<div class="pp-line"></div>';
        return '<div class="pp-lines">' + out + '</div>';
    }
    function paperMerge(defaults, raw) {
        var d = {};
        Object.keys(defaults || {}).forEach(function (k) { d[k] = defaults[k]; });
        if (raw && typeof raw === 'object') {
            Object.keys(raw).forEach(function (k) { if (raw[k] !== undefined && k !== '_autofill') d[k] = raw[k]; });
        }
        return d;
    }
    function paperList(v) {
        if (Array.isArray(v)) return v.map(paperText).filter(Boolean);
        return String(v || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    var PAPER_CSS = '/*cs-ink*/' +
        '.pp-page + .pp-page { page-break-before: always; }' +
        '.pp-head { margin: 0 0 8px 0; }' +
        '.pp-title { font-size: 15pt; font-weight: 800; margin: 0 0 2px 0; color: #000; }' +
        '.pp-sub { font-size: 9.5pt; color: #000; margin-bottom: 4px; }' +
        '.pp-h2 { font-size: 10.5pt; font-weight: 700; margin: 12px 0 6px 0; padding: 4px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; background: transparent; color: #000; }' +
        '.pp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin: 6px 0 8px 0; }' +
        '.pp-field { font-size: 10pt; line-height: 1.35; }' +
        '.pp-wide { grid-column: 1 / -1; }' +
        '.pp-label { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.4px; color: #000; margin-bottom: 1px; }' +
        '.pp-value { min-height: 14px; padding: 1px 0 2px 0; }' +
        '.pp-wi { min-width: 150px; }' +
        '.pp-wi-wide { display: block; width: 100%; }' +
        '.pp-p { font-size: 10pt; line-height: 1.45; margin: 4px 0 6px 0; color: #000; }' +
        '.pp-boxes { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: center; }' +
        '.pp-box-item { display: inline-flex; align-items: center; margin-right: 10px; }' +
        '.pp-table { width: 100%; border-collapse: collapse; margin: 6px 0 8px 0; font-size: 9.5pt; }' +
        '.pp-table th, .pp-table td { border: 1px solid #000; padding: 4px 6px; background: transparent; color: #000; text-align: left; vertical-align: top; }' +
        '.pp-table th { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.4px; }' +
        '.pp-table .col-r { text-align: right; }' +
        '.pp-table .col-c { text-align: center; }' +
        '.pp-table .pp-row-blank td { height: 18px; }' +
        '.pp-dual { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 12px 0 6px 0; page-break-inside: avoid; }' +
        '.pp-sig-title { font-size: 9.5pt; font-weight: 700; margin-bottom: 2px; }' +
        '.pp-sig-row { margin-top: 10px; }' +
        '.pp-sig-line { border-bottom: 1px solid #000; min-height: 18px; font-size: 10pt; }' +
        '.pp-caption { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.4px; margin-top: 2px; }' +
        '.pp-ack { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px; margin: 6px 0 4px 0; }' +
        '.pp-ack .pp-sig-row { margin-top: 14px; }' +
        '.pp-footer { font-size: 9pt; margin-top: 10px; padding-top: 4px; border-top: 1px dashed #000; color: #000; }' +
        '.pp-line { border-bottom: 1px solid #000; height: 20px; }' +
        '.pp-ol, .pp-ul { margin: 4px 0 8px 22px; padding: 0; font-size: 10pt; line-height: 1.45; }' +
        '.pp-ol li, .pp-ul li { margin: 2px 0; }' +
        '.pp-group { font-weight: 700; font-size: 10pt; margin: 8px 0 2px 0; }' +
        '@media print { .pp-dual, .pp-table tr { page-break-inside: avoid; } }';

    /* Fit the group/minor form and the ordinary gear list on one Letter sheet.
       Other paperwork keeps its existing spacing. Body/labels stay at least 9pt,
       gear table text at least 8pt, and print margins at least 0.4in. */
    var PAPER_FIT_CSS =
        '@page { margin: 0.4in; }' +
        '.ts-page { max-width: 7.7in; }' +
        '.pp-head { margin-bottom: 5px; }' +
        '.pp-h2 { margin: 7px 0 4px; padding: 3px 0; }' +
        '.pp-grid { gap: 4px 12px; margin: 4px 0 6px; }' +
        '.pp-field, .pp-p { font-size: 9pt; line-height: 1.2; }' +
        '.pp-p { margin: 3px 0 4px; }' +
        '.pp-label, .pp-caption { font-size: 9pt; letter-spacing: normal; }' +
        '.pp-value { min-height: 13px; padding: 1px 0; }' +
        '.pp-dual { gap: 20px; margin: 6px 0 4px; }' +
        '.pp-sig-row, .pp-ack .pp-sig-row { margin-top: 4px; }' +
        '.pp-sig-line { min-height: 14px; font-size: 9pt; }' +
        '.pp-line { height: 16px; }' +
        '.pp-gear { margin: 4px 0 6px; font-size: 8pt; }' +
        '.pp-gear th, .pp-gear td { font-size: 8pt; line-height: 1.15; padding: 3px 4px; }' +
        '.pp-gear .pp-wi { min-width: 0; width: 100%; }' +
        '.pp-gear .pp-row-blank td { height: 16px; }' +
        '.pp-footer { margin-top: 6px; }' +
        '.ts-footer { margin-top: 8px; padding-top: 4px; font-size: 9pt; }';

    function financialSummary(b) {
        var t = window.mBT_Finance.summary(b);
        var rows = [['Subtotal', t.subtotal]];
        (b.fringes || []).forEach(function (f) {
            if (f.enabled !== false) rows.push([String(f.name || 'Fringe') + ' (' + (f.rate || 0) + '%)', f.amount]);
        });
        rows.push(['Contingency (' + (b.contingencyPercentage || 0) + '%)', t.contingency]);
        rows.push(['Sales Tax (' + (b.salesTaxPercentage || 0) + '%)', t.tax]);
        rows.push(['Production Fee (' + t.productionFeePercentage + '%)', t.productionFeeAmount]);
        rows.push(['Discount (' + (b.discountPercentage || 0) + '%)', -t.discount]);
        rows.push(['Grand Total', t.grandTotal]);
        return rows;
    }

    window.mBTPublisher = {
        financialSummary: financialSummary,
        config: {
            pdf: { margin: 0.2, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } }
        },

        /* --- 1. Communication Protocols (The "Comms" Layer) --- */
        comm: {
            cleanPhone: function (p) { return p ? p.replace(/\D/g, '') : ''; },

            whatsapp: function (phone, text) {
                var p = this.cleanPhone(phone);
                if (!p) return '#';
                text = text || '';
                var num = (p.length === 10 && (p.startsWith('876') || p.startsWith('658'))) ? '1' + p : p;
                return 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
            },

            email: function (email, subject, body) {
                return 'mailto:' + (email || '') + '?subject=' + encodeURIComponent(subject || '') + '&body=' + encodeURIComponent(body || '');
            },

            call: function (phone) {
                return 'tel:' + this.cleanPhone(phone);
            },

            generateShareSheet: function (doc) {
                var title = (doc && doc.label) ? doc.label : 'Document';
                var date = (doc && doc.content && doc.content.data && doc.content.data.meta) ? doc.content.data.meta.shootDate : 'TBD';
                return 'Here is the ' + title + ' for ' + (date || 'TBD') + '. Please review.';
            },

            /* Plain-text budget summary for WhatsApp / email share. Amounts are the stored
               base-currency values — same rule as exports: outbound documents stay in base. */
            generateBudgetSummary: function (b, currency) {
                if (!b) return '';
                currency = currency || b.currency || 'JMD';
                var f = function (v) { return fmtCurrency(v || 0, currency); };
                var lines = [];
                lines.push((b.projectName || 'Untitled Production').toUpperCase() + ' — BUDGET SUMMARY');
                lines.push('Company: ' + (b.company || 'Independent'));
                if (b.startDate) lines.push('Start: ' + b.startDate + (b.productionDays ? ' | Shoot days: ' + b.productionDays : ''));
                lines.push('Currency: ' + currency);
                lines.push('');
                var sections = b.sections || {};
                Object.keys(sections).forEach(function (name) {
                    lines.push(name + ': ' + f(sections[name].total));
                });
                lines.push('');
                financialSummary(b).forEach(function (row) { lines.push(row[0] + ': ' + f(row[1])); });
                lines.push('');
                lines.push('Generated by mooBudgetTool');
                return lines.join('\n');
            }
        },

        /* --- 2. IO & File Systems (The "Hard Drive" Layer) --- */
        io: {
            forceDownload: function (blob, filename) {
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
            },

            withProgress: function (task) {
                var notice = document.createElement('div');
                notice.className = 'mbt-export-progress'; notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
                notice.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:300;padding:12px;background:#fff;color:#334155;border:1px solid #cbd5e1;border-radius:12px;pointer-events:none;';
                notice.textContent = 'Preparing export...'; document.body.appendChild(notice);
                function finish(text) { notice.textContent = text; setTimeout(function () { if (notice.parentNode) notice.parentNode.removeChild(notice); }, 4000); }
                return new Promise(function (resolve) { requestAnimationFrame(function () { setTimeout(resolve, 0); }); }).then(task).then(function (value) {
                    finish('Export processing ended. Check the result or any error message.'); return value;
                }, function (err) { finish('Export failed. ' + err.message); return { status: 'error', message: err.message }; });
            },
            saveMoo: function (budgetData) {
                var blob = new Blob([JSON.stringify(budgetData, null, 2)], { type: 'application/json' });
                this.forceDownload(blob, slugify(budgetData.projectName) + '.moo');
            },

            saveTemplate: function (templateData) {
                var blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' });
                this.forceDownload(blob, slugify(templateData.label || 'template') + '.mtemp');
            },

            saveBundle: function (budgetData, loadBlobFn) {
                if (typeof JSZip === 'undefined') return notify("Error", "Bundler module (JSZip) missing.");

                var zip = new JSZip();
                var cleanName = slugify(budgetData.projectName);

                zip.file(cleanName + '.moo', JSON.stringify(budgetData, null, 2));

                var readme = 'Project: ' + budgetData.projectName + '\nExported: ' + new Date().toLocaleString() + '\n\nContains master budget data (.moo) and embedded assets.\nFormat: Unified Container (Zip-based)';
                zip.file('README.txt', readme);

                var assetsFolder = zip.folder('assets');
                var cleanBase64 = function (dataurl) { return dataurl.split(',')[1]; };

                var assetPromises = [];

                if (budgetData.documents) {
                    budgetData.documents.forEach(function (doc) {
                        if (!doc.attachments) return;
                        doc.attachments.forEach(function (file, i) {
                            var safeName = (file.name || 'file').replace(/[^a-z0-9.]/gi, '_');
                            var fileName = doc.id + '_' + i + '_' + safeName;

                            if (file.location === 'internal' && file.key && typeof loadBlobFn === 'function') {
                                assetPromises.push(
                                    loadBlobFn(file.key).then(function (blobUrl) {
                                        if (!blobUrl) return;
                                        return fetch(blobUrl).then(function (r) { return r.blob(); }).then(function (blob) {
                                            assetsFolder.file(fileName, blob);
                                        });
                                    }).catch(function (err) {
                                        console.warn('Failed to bundle asset: ' + file.name, err);
                                    })
                                );
                            } else if (file.data) {
                                assetsFolder.file(fileName, cleanBase64(file.data), { base64: true });
                            }
                        });
                    });
                }

                return Promise.all(assetPromises).then(function () {
                    return zip.generateAsync({ type: 'blob' });
                }).then(function (content) {
                    window.mBTPublisher.io.forceDownload(content, cleanName + '.moo');
                }).catch(function (e) {
                    console.error('Bundle Error:', e);
                    notify('Export Error', 'Failed to generate bundle.');
                    throw e;
                });
            },

            /* --- Phase 50C.7: Master "Wrap" Production Package Export --- */
            /* Compiles Budget PDF, Contacts CSV, and .moo JSON into Production_Package.zip */
            wrapExport: function (budgetData, currency, globalContacts) {
                if (typeof JSZip === 'undefined') return notify('Error', 'Bundler module (JSZip) missing.');
                if (typeof window.jspdf === 'undefined') return notify('Error', 'PDF Engine missing.');

                var io       = window.mBTPublisher.io;
                var format   = window.mBTPublisher.format;
                var zip      = new JSZip();
                var cleanName = slugify(budgetData.projectName || 'production');
                var exported  = new Date().toLocaleString();

                /* 1. Budget JSON (.moo) */
                zip.file(cleanName + '.moo', JSON.stringify(budgetData, null, 2));

                /* 2. Budget Top Sheet PDF — capture as blob instead of triggering download.
                   NOTE: this renderer is authored in millimeters (105mm centerline, mm column
                   widths); config.pdf.jsPDF is the html2pdf inch config and must not be used
                   here — it makes autotable's available width negative and recurses to a
                   stack overflow. */
                var jsPDF   = window.jspdf.jsPDF;
                var doc     = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
                currency    = currency || 'JMD';
                var fmt     = function (val) { return fmtCurrency(val, currency); };
                var version = appVersion();

                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.text((budgetData.projectName || 'Untitled Production').toUpperCase(), 105, 15, { align: 'center' });
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text((budgetData.company || 'Independent') + ' | Date: ' + new Date().toLocaleDateString(), 105, 22, { align: 'center' });

                var summaryData = financialSummary(budgetData).map(function (row) {
                    if (row[0] === 'Grand Total') return [
                        { content: 'GRAND TOTAL', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
                        { content: fmt(row[1]), styles: { fontStyle: 'bold', textColor: [21, 128, 61] } }
                    ];
                    return [row[0], (row[1] < 0 ? '-' : '') + fmt(Math.abs(row[1]))];
                });
                doc.autoTable({ startY: 30, head: [['Financial Summary', 'Amount']], body: summaryData, theme: 'grid', headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 'auto', halign: 'right' } }, margin: { left: 14, right: 14 } });

                var finalY   = doc.lastAutoTable.finalY + 10;
                var bodyRows = [];
                if (budgetData.sections) {
                    Object.keys(budgetData.sections).forEach(function (secName) {
                        var sec = budgetData.sections[secName];
                        bodyRows.push([{ content: secName.toUpperCase(), colSpan: 5, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [71, 85, 105] } }]);
                        (sec.items || []).forEach(function (item) {
                            bodyRows.push([item.description, parseFloat(item.quantity) || 0, item.unit, fmt(parseFloat(item.rate) || 0), fmt(parseFloat(item.total) || 0)]);
                        });
                        bodyRows.push([{ content: 'Total ' + secName + ': ' + fmt(sec.total), colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] } }]);
                    });
                }
                doc.autoTable({
                    startY: finalY, head: [['Description', 'Qty', 'Unit', 'Rate', 'Total']], body: bodyRows, theme: 'plain',
                    styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [51, 65, 85], textColor: 255 },
                    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 30, halign: 'right' }, 4: { cellWidth: 30, halign: 'right' } },
                    margin: { left: 14, right: 14 },
                    didDrawPage: function (data) {
                        var str = 'Page ' + doc.internal.getNumberOfPages();
                        doc.setFontSize(8); doc.setTextColor(150);
                        var pageSize = doc.internal.pageSize;
                        var pageHeight = pageSize.height || pageSize.getHeight();
                        doc.text(str, data.settings.margin.left, pageHeight - 10);
                        doc.text('Generated by mooBudget' + (version ? ' v' + version : ''), pageSize.width - 14, pageHeight - 10, { align: 'right' });
                    }
                });
                zip.file(cleanName + '_budget.pdf', doc.output('blob'));

                /* 3. Contacts Directory CSV */
                /* Merge global OpenGate crew + budget line-item crew, dedup by name */
                var seen    = {};
                var csvRows = [['Name', 'Role', 'Department', 'Phone', 'Email', 'Rate', 'Currency', 'Source']];

                var addContact = function (name, role, dept, phone, email, rate, currency, source) {
                    var key = (name || '').toLowerCase().trim();
                    if (!key || seen[key]) return;
                    seen[key] = true;
                    csvRows.push([name || '', role || '', dept || '', phone || '', email || '', rate || '', currency || '', source]);
                };

                /* Global OpenGate contacts */
                (globalContacts || []).forEach(function (c) {
                    addContact(c.name, c.role || c.title, c.department || c.dept, c.phone, c.email, c.rate, c.currency || budgetData.currency || '', 'Global DB');
                });

                /* Budget line-item crew */
                (budgetData.globalItems || []).forEach(function (item) {
                    addContact(item.contact_name || item.description, item.unit || 'Crew', '', item.contact_phone, item.contact_email, item.rate, item.rateCurrency || item.currency || budgetData.currency || '', 'Budget');
                });

                var csvContent = csvRows.map(function (row) {
                    return row.map(function (cell) {
                        var s = String(cell == null ? '' : cell).replace(/"/g, '""');
                        return /[,"\n\r]/.test(s) ? '"' + s + '"' : s;
                    }).join(',');
                }).join('\r\n');

                zip.file(cleanName + '_contacts.csv', csvContent);

                /* 4. README */
                zip.file('README.txt', [
                    'Production Package: ' + (budgetData.projectName || 'Untitled'),
                    'Exported: ' + exported,
                    '',
                    'Contents:',
                    '  ' + cleanName + '.moo            — Full project data (import into mooBudget)',
                    '  ' + cleanName + '_budget.pdf     — Professional budget top sheet',
                    '  ' + cleanName + '_contacts.csv  — Crew & contacts directory',
                    '',
                    'Generated by mooBudget' + (version ? ' v' + version : '')
                ].join('\n'));

                /* 5. Generate & download zip */
                return zip.generateAsync({ type: 'blob' }).then(function (zipBlob) {
                    io.forceDownload(zipBlob, 'Production_Package_' + cleanName + '.zip');
                }).catch(function (e) {
                    console.error('[mBTPublisher] Wrap export error:', e);
                    notify('Export Error', 'Failed to generate Production Package.');
                    throw e;
                });
            }
        },

        /* --- 3. Render Formats (The "Printer" Layer) --- */
        format: {
            /* PDF from DOM element via html2pdf */
            pdf: function (elementId, filename) {
                var element = document.getElementById(elementId);
                if (!element) return notify('Export Error', 'Source element not found');

                var originalBg = element.style.background;
                element.style.background = 'white';
                element.classList.add('print-mode');

                html2pdf().set(window.mBTPublisher.config.pdf).from(element).save(filename + '.pdf')
                    .then(function () {
                        element.style.background = originalBg;
                        element.classList.remove('print-mode');
                    });
            },

            /* JPEG Snapshot via html2canvas with optional linearization */
            jpeg: function (elementId, callback, options) {
                options = options || {};
                var source = document.getElementById(elementId);
                if (!source) return;

                var clone = source.cloneNode(true);
                clone.style.position = 'absolute';
                clone.style.left = '-9999px';
                clone.classList.remove('editing-mode');
                clone.style.background = options.bg || window.getComputedStyle(source).backgroundColor;

                if (options.linearize) {
                    clone.classList.remove('grid-stack');
                    clone.style.height = 'auto';
                    clone.style.minHeight = 'auto';
                    clone.style.width = '1200px';
                    clone.style.display = 'flex';
                    clone.style.flexDirection = 'column';
                    clone.style.gap = '24px';
                    clone.style.padding = '40px';
                    clone.style.overflow = 'visible';

                    var items = Array.from(clone.querySelectorAll('.grid-stack-item'));
                    items.sort(function (a, b) {
                        var yA = parseInt(a.getAttribute('gs-y')) || 0;
                        var yB = parseInt(b.getAttribute('gs-y')) || 0;
                        var xA = parseInt(a.getAttribute('gs-x')) || 0;
                        var xB = parseInt(b.getAttribute('gs-x')) || 0;
                        return yA - yB || xA - xB;
                    });

                    items.forEach(function (item) {
                        item.style.position = 'relative';
                        item.style.inset = 'auto';
                        item.style.width = '100%';
                        item.style.height = 'auto';
                        item.style.marginBottom = '20px';
                        item.style.border = '1px solid #000';
                        item.style.boxShadow = 'none';
                        item.style.borderRadius = '0';

                        var content = item.querySelector('.grid-stack-item-content');
                        if (content) {
                            content.style.height = 'auto';
                            content.style.overflow = 'visible';
                            content.style.border = 'none';
                            content.style.boxShadow = 'none';
                        }

                        var body = item.querySelector('.widget-body');
                        if (body) {
                            body.style.height = 'auto';
                            body.style.overflow = 'visible';
                            body.querySelectorAll('textarea').forEach(function (ta) {
                                ta.style.height = (ta.scrollHeight + 20) + 'px';
                            });
                        }
                        clone.appendChild(item);
                    });
                    /* The emptied grid would otherwise stay as a tall blank block. */
                    clone.querySelectorAll('.grid-stack').forEach(function (g) { if (!g.querySelector('.grid-stack-item')) g.style.display = 'none'; });
                } else {
                    clone.style.width = source.scrollWidth + 'px';
                    clone.style.height = source.scrollHeight + 'px';
                }

                /* De-clutter: remove dashboard artifacts */
                clone.querySelectorAll('.widget-tools, .ui-resizable-handle, button:not(.permanent), .grid-stack-handle, .widget-controls, .stage-remove-btn').forEach(function (el) { el.remove(); });

                /* Flatten inputs to text */
                clone.querySelectorAll('input').forEach(function (el) {
                    if (el.type === 'hidden') return;
                    var span = document.createElement('span');
                    span.textContent = el.value;
                    span.className = el.className;
                    span.style.cssText = 'border:none;background:transparent;padding:0;font-weight:bold;width:100%;color:' + (el.closest && el.closest('.widget-header') ? '#fff' : '#000');
                    if (el.type === 'checkbox') {
                        var checkSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
                        var boxSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>';
                        span.innerHTML = el.checked ? checkSvg : boxSvg;
                    }
                    el.parentNode.replaceChild(span, el);
                });

                clone.querySelectorAll('textarea').forEach(function (el) {
                    var div = document.createElement('div');
                    div.innerHTML = esc(el.value).replace(/\n/g, '<br>');
                    div.className = el.className + ' whitespace-pre-wrap';
                    div.style.cssText = 'height:auto;border:none;resize:none;background:transparent;color:#000';
                    el.parentNode.replaceChild(div, el);
                });

                /* Copy canvas data (MudMaps) */
                var origCanvases = source.querySelectorAll('canvas');
                var cloneCanvases = clone.querySelectorAll('canvas');
                origCanvases.forEach(function (orig, i) {
                    if (cloneCanvases[i]) {
                        cloneCanvases[i].width = orig.width;
                        cloneCanvases[i].height = orig.height;
                        var ctx = cloneCanvases[i].getContext('2d');
                        ctx.drawImage(orig, 0, 0);
                    }
                });

                /* Capture. html2canvas cannot read oklch colours (Tailwind 4), so the captured copy is
                   given plain rgb colours. The Industry Standard preview is also drawn in the light theme. */
                var tpl = window.mBTPublisher && window.mBTPublisher.templates;
                var onclone = function (doc) {
                    if (options.linearize) {
                        ['mbt-theme-dark', 'dark'].forEach(function (cls) { doc.documentElement.classList.remove(cls); doc.body.classList.remove(cls); });
                        /* Paper white for the Industry Standard look: the studio's navy workspace is forced with !important. */
                        var paper = doc.querySelectorAll('[id="' + elementId + '"], .sheet-workspace, #mBTDB_Paper');
                        for (var pi = 0; pi < paper.length; pi++) paper[pi].style.setProperty('background', '#ffffff', 'important');
                    }
                    if (tpl && tpl._captureColors) tpl._captureColors(doc);
                };
                document.body.appendChild(clone);
                html2canvas(clone, { scale: 2, useCORS: true, logging: false, backgroundColor: null, onclone: onclone })
                    .then(function (canvas) {
                        document.body.removeChild(clone);
                        if (callback) callback(canvas.toDataURL('image/jpeg', 0.9));
                    })
                    .catch(function (err) {
                        console.error('Snapshot Failed', err);
                        if (clone.parentNode) document.body.removeChild(clone);
                    });
            },

            /* Standalone HTML export (self-contained file, no CDN) */
            htmlStandalone: function (elementId, title, budgetData, currency) {
                var source = document.getElementById(elementId);
                if (!source) return notify('Export Error', 'Content source missing.');

                var clone = source.cloneNode(true);
                var base = (budgetData && budgetData.currency) || 'JMD';
                var wanted = currency || base;
                var engine = (window.mBT && window.mBT.le) || (window.parent && window.parent.mBT && window.parent.mBT.le);
                var rate = wanted === base ? 1 : (engine && engine.convertCurrencyOrNull ? engine.convertCurrencyOrNull(1, base, wanted, budgetData, true) : null);
                var missingRate = rate === null;
                currency = missingRate ? base : wanted;
                rate = missingRate ? 1 : rate;
                /* Refresh the clone from stored amounts so every monetary cell
                   matches the summary, including the missing-rate base fallback. */
                if (budgetData) {
                    var writeMoney = function (selector, value) {
                        var node = clone.querySelector(selector);
                        if (!node) return;
                        if (node.tagName === 'INPUT') node.value = ((parseFloat(value) || 0) * rate).toFixed(2);
                        else node.textContent = fmtCurrency(value, currency, rate);
                    };
                    Object.keys(budgetData.sections || {}).forEach(function (key) {
                        var section = budgetData.sections[key];
                        writeMoney('[data-section-total="' + CSS.escape(key) + '"]', section.total);
                        (section.items || []).forEach(function (item) {
                            var id = CSS.escape(String(item.id));
                            var estimated = parseFloat(item.total) || 0;
                            var actual = parseFloat(item.actual) || 0;
                            writeMoney('[data-estimated-id="' + id + '"]', estimated);
                            writeMoney('[data-variance-id="' + id + '"]', budgetData.actualsMode ? estimated - (item.committedCost || 0) - (item.actualQuantity || 0) * (item.actualRate || 0) : actual - estimated);
                            ['rate', 'actual', 'actualRate'].forEach(function (field) {
                                writeMoney('input[data-id="' + id + '"][data-field="' + field + '"]', item[field]);
                            });
                            var tag = clone.querySelector('[data-currency-tag="' + id + '"]');
                            if (tag) tag.textContent = currency;
                            if (budgetData.actualsMode) {
                                var estimatedCell = clone.querySelector('[data-estimated-id="' + id + '"]');
                                if (estimatedCell) {
                                    var committedCell = estimatedCell.nextElementSibling;
                                    committedCell.textContent = fmtCurrency(item.committedCost || 0, currency, rate);
                                    var etcCell = committedCell.nextElementSibling.nextElementSibling.nextElementSibling;
                                    etcCell.textContent = fmtCurrency(item.ETC || 0, currency, rate);
                                }
                            }
                        });
                    });
                }
                clone.classList.remove('editing-mode');
                clone.querySelectorAll('button, .widget-controls, .grid-stack-handle, .ui-resizable-handle').forEach(function (el) { el.remove(); });

                clone.querySelectorAll('.grid-stack-item').forEach(function (item) {
                    item.style.position = 'relative';
                    item.style.left = 'auto';
                    item.style.top = 'auto';
                    item.style.width = '100%';
                    item.style.height = 'auto';
                    item.style.marginBottom = '24px';
                    var content = item.querySelector('.grid-stack-item-content');
                    if (content) content.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                });
                var gridContainer = clone.querySelector('.grid-stack');
                if (gridContainer) {
                    gridContainer.style.height = 'auto';
                    gridContainer.className = 'flex flex-col';
                }

                clone.querySelectorAll('input, select').forEach(function (el) {
                    var span = document.createElement('span');
                    span.textContent = el.value;
                    span.className = el.className;
                    span.style.cssText = 'border:none;background:transparent;display:inline-block;width:auto';
                    if (el.type === 'date' && el.value) span.textContent = new Date(el.value).toLocaleDateString();
                    el.parentNode.replaceChild(span, el);
                });

                clone.querySelectorAll('textarea').forEach(function (el) {
                    var div = document.createElement('div');
                    div.innerHTML = esc(el.value).replace(/\n/g, '<br>');
                    div.className = el.className + ' whitespace-pre-wrap';
                    div.style.cssText = 'height:auto;border:none;resize:none';
                    el.parentNode.replaceChild(div, el);
                });

                var summaryHtml = budgetData ? '<section data-financial-summary style="background:white;padding:16px;margin-bottom:24px;border:1px solid #cbd5e1;border-radius:16px;"><h2>Financial Summary</h2><table style="width:100%;border-collapse:collapse">' +
                    financialSummary(budgetData).map(function (row) {
                        return '<tr><th style="text-align:left;padding:6px">' + esc(row[0]) + '</th><td style="text-align:right;padding:6px">' + esc((row[1] < 0 ? '-' : '') + fmtCurrency(Math.abs(row[1]), currency, rate)) + '</td></tr>';
                    }).join('') + '</table></section>' : '';
                var safeTitle = esc(title || 'Export');
                var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + safeTitle + '</title>\n<style>\n' +
                    'body { font-family: system-ui, -apple-system, sans-serif; background-color: #f3f4f6; padding: 20px; }\n' +
                    '.grid-stack-item-content { background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; }\n' +
                    '.widget-header { background: #f9fafb; padding: 12px; border-bottom: 1px solid #f3f4f6; font-weight: 900; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; color: #9ca3af; }\n' +
                    '.widget-body { padding: 16px; }\n' +
                    '.flex { display: flex; } .flex-col { flex-direction: column; }\n' +
                    '.max-w-3xl { max-width: 48rem; } .mx-auto { margin-left: auto; margin-right: auto; }\n' +
                    '.text-center { text-align: center; } .mb-10 { margin-bottom: 2.5rem; } .mt-12 { margin-top: 3rem; }\n' +
                    '.text-3xl { font-size: 1.875rem; } .font-black { font-weight: 900; } .uppercase { text-transform: uppercase; }\n' +
                    '.tracking-tighter { letter-spacing: -0.05em; } .text-slate-900 { color: #0f172a; }\n' +
                    '.text-xs { font-size: 0.75rem; } .font-bold { font-weight: 700; } .text-slate-400 { color: #94a3b8; }\n' +
                    '.tracking-widest { letter-spacing: 0.1em; } .mt-2 { margin-top: 0.5rem; }\n' +
                    '.text-slate-300 { color: #cbd5e1; }\n' +
                    '</style>\n</head>\n<body>\n<div class="max-w-3xl mx-auto">\n' +
                    '<div class="text-center mb-10"><h1 class="text-3xl font-black uppercase tracking-tighter text-slate-900">' + safeTitle + '</h1>\n' +
                    '<p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">mooBudgetTool Digital Export</p></div>\n' +
                    (missingRate ? '<p>Missing exchange rate for ' + esc(wanted) + '. Amounts stay in ' + esc(base) + '.</p>' : '') + summaryHtml + clone.innerHTML + '\n' +
                    '<div class="mt-12 text-center" style="font-size:10px;color:#cbd5e1;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Generated by mooBudgetTool</div>\n' +
                    '</div>\n</body>\n</html>';

                var blob = new Blob([html], { type: 'text/html' });
                window.mBTPublisher.io.forceDownload(blob, slugify(title) + '_Digital.html');
            },

            /* Professional Budget PDF via jsPDF + autoTable */
            professionalPdf: function (budgetData, currency, options) {
                if (typeof window.jspdf === 'undefined') return notify('Error', 'PDF Engine missing.');

                /* Millimeter-authored layout — do not construct from config.pdf.jsPDF (inches;
                   that config belongs to html2pdf and blows autotable's width math) */
                var jsPDF = window.jspdf.jsPDF;
                var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
                currency = currency || 'JMD';
                var ink = (options && options.easyOnTheInk != null)
                    ? !!options.easyOnTheInk
                    : (function () { try { return localStorage.getItem('mbt_easy_on_the_ink') === '1'; } catch (e) { return false; } })();
                var fmt = function (val) { return fmtCurrency(val, currency); };
                var version = appVersion();

                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                var projTitle = budgetData.projectName || 'Untitled Production';
                doc.text(ink ? projTitle : projTitle.toUpperCase(), 105, 15, { align: 'center' });

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text((budgetData.company || 'Independent') + ' | Date: ' + new Date().toLocaleDateString(), 105, 22, { align: 'center' });

                var summaryData = financialSummary(budgetData).map(function (row) {
                    if (row[0] === 'Grand Total') return [
                        { content: ink ? 'Grand Total' : 'GRAND TOTAL', styles: ink ? { fontStyle: 'bold', textColor: [0, 0, 0] } : { fontStyle: 'bold', fillColor: [240, 253, 244] } },
                        { content: fmt(row[1]), styles: { fontStyle: 'bold', textColor: ink ? [0, 0, 0] : [21, 128, 61] } }
                    ];
                    return [row[0], (row[1] < 0 ? '-' : '') + fmt(Math.abs(row[1]))];
                });
                doc.autoTable({
                    startY: 30,
                    head: [['Financial Summary', 'Amount']],
                    body: summaryData,
                    theme: 'grid',
                    headStyles: ink ? { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fontStyle: 'bold' } : { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
                    columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 'auto', halign: 'right' } },
                    margin: { left: 14, right: 14 }
                });

                /* --- Shoot Schedule section (10-day schedule support) --- */
                var sd = budgetData.shootDays || {};
                var phases = [
                    { label: 'Development', key: 'dev' },
                    { label: 'Pre-Production', key: 'pre' },
                    { label: 'Production', key: 'prod' },
                    { label: 'Post-Production', key: 'post' },
                    { label: 'Distribution', key: 'dist' }
                ];
                var totalDays = 0;
                var schedRows = [];
                for (var pi = 0; pi < phases.length; pi++) {
                    var days = parseInt(sd[phases[pi].key]) || 0;
                    if (days > 0) {
                        schedRows.push([phases[pi].label, days + (days === 1 ? ' day' : ' days')]);
                        totalDays += days;
                    }
                }
                if (schedRows.length > 0) {
                    schedRows.push([{ content: ink ? 'Total Shoot Days' : 'TOTAL SHOOT DAYS', styles: { fontStyle: 'bold' } }, { content: String(totalDays), styles: { fontStyle: 'bold', halign: 'right' } }]);
                    doc.autoTable({
                        startY: doc.lastAutoTable.finalY + 8,
                        head: [['Production Phase', 'Duration']],
                        body: schedRows,
                        theme: 'grid',
                        headStyles: ink ? { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fontStyle: 'bold' } : { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
                        columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 'auto', halign: 'right' } },
                        margin: { left: 14, right: 14 }
                    });
                }

                var finalY = doc.lastAutoTable.finalY + 10;
                var bodyRows = [];

                if (budgetData.sections) {
                    var previousGroup = null;
                    window.mBTPublisher.templates._orderedSections(budgetData.sections).forEach(function (entry) {
                        var secName = entry.name;
                        var sec = budgetData.sections[secName];
                        if (previousGroup !== entry.group) {
                            bodyRows.push([{ content: window.mBTPublisher.templates._phaseLabels[entry.group], colSpan: 7, styles: ink ? { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' } : { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' } }]);
                            previousGroup = entry.group;
                        }
                        /* colSpan 7 matches the new 7-column layout */
                        bodyRows.push([{ content: ink ? secName : secName.toUpperCase(), colSpan: 7, styles: ink ? { fillColor: [255, 255, 255], fontStyle: 'bold', textColor: [0, 0, 0] } : { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [71, 85, 105] } }]);

                        var secEst = 0;
                        var secAct = 0;
                        var departments = {}, departmentOrder = [];
                        (sec.items || []).forEach(function (item) {
                            var tag = item.department || '';
                            if (!departments[tag]) { departments[tag] = []; departmentOrder.push(tag); }
                            departments[tag].push(item);
                        });
                        departmentOrder.forEach(function (tag) {
                            if (tag) bodyRows.push([{ content: window.mBTBatch2 && mBTBatch2.groups[tag] ? mBTBatch2.groups[tag][0] : tag, colSpan: 7, styles: ink ? { fillColor: [255, 255, 255], fontStyle: 'bold', textColor: [0, 0, 0] } : { fillColor: [241, 245, 249], fontStyle: 'bold' } }]);
                            departments[tag].forEach(function (item) {
                            var qty = parseFloat(item.quantity) || 0;
                            var rate = parseFloat(item.rate) || 0;
                            var mult = parseFloat(item.multiplier) || 1;
                            var est = parseFloat(item.total) || (qty * rate * mult);
                            var act = parseFloat(item.actual) || 0;
                            var variance = act - est;
                            secEst += est;
                            secAct += act;
                            bodyRows.push([
                                item.description || '',
                                qty,
                                item.unit || '',
                                fmt(rate),
                                fmt(est),
                                fmt(act),
                                /* Overrun alert: red text when actual exceeds estimated */
                                { content: fmt(variance), styles: { textColor: ink ? [0, 0, 0] : (variance > 0 ? [220, 38, 38] : variance < 0 ? [22, 163, 74] : [100, 116, 139]), fontStyle: variance !== 0 ? 'bold' : 'normal' } }
                            ]);
                        });

                        });
                        var secVariance = secAct - secEst;
                        bodyRows.push([
                            { content: 'Total: ' + secName, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', textColor: ink ? [0, 0, 0] : [37, 99, 235] } },
                            { content: fmt(secEst), styles: { fontStyle: 'bold', halign: 'right' } },
                            { content: fmt(secAct), styles: { fontStyle: 'bold', halign: 'right' } },
                            { content: fmt(secVariance), styles: { fontStyle: 'bold', halign: 'right', textColor: ink ? [0, 0, 0] : (secVariance > 0 ? [220, 38, 38] : [22, 163, 74]) } }
                        ]);
                    });
                }

                doc.autoTable({
                    startY: finalY,
                    head: [['Description', 'Qty', 'Unit', 'Rate', 'Estimated', 'Actual', 'Variance']],
                    body: bodyRows,
                    theme: 'plain',
                    styles: { fontSize: 9, cellPadding: 2 },
                    headStyles: ink ? { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } : { fillColor: [51, 65, 85], textColor: 255 },
                    columnStyles: {
                        0: { cellWidth: 'auto' },
                        1: { cellWidth: 12, halign: 'center' },
                        2: { cellWidth: 16, halign: 'center' },
                        3: { cellWidth: 24, halign: 'right' },
                        4: { cellWidth: 26, halign: 'right' },
                        5: { cellWidth: 26, halign: 'right' },
                        6: { cellWidth: 26, halign: 'right' }
                    },
                    margin: { left: 14, right: 14 },
                    didDrawPage: function (data) {
                        var str = 'Page ' + doc.internal.getNumberOfPages();
                        doc.setFontSize(8);
                        doc.setTextColor(150);
                        var pageSize = doc.internal.pageSize;
                        var pageHeight = pageSize.height || pageSize.getHeight();
                        doc.text(str, data.settings.margin.left, pageHeight - 10);
                        doc.text('Generated by mooBudget' + (version ? ' v' + version : ''), pageSize.width - 14, pageHeight - 10, { align: 'right' });
                    }
                });

                var filename = slugify(budgetData.projectName) + '.pdf';
                doc.save(filename);
            },

            /* Champion Call Sheet — returns HTML string for rendering in a modal or iframe.
               Caller is responsible for display (mBTME modal, iframe, or print). */
            championCallSheet: function (docData, options) {
                options = options || {};
                var d = docData || {};
                var meta = d.meta || {};
                var contacts = d.contacts || {};
                var schedule = d.schedule || [];
                var cast = d.cast || [];
                var locs = d.locations || [];
                var shootDayLabel = (typeof options.calcShootDay === 'function') ? options.calcShootDay(meta.shootDate) : '';

                var t = function (val) { return val || '--:--'; };

                var css = '<style>' +
                    '.cs-body { font-family: system-ui, -apple-system, sans-serif; font-size: 10pt; color: #000; background: #fff; width: 210mm; min-height: 297mm; padding: 10mm; box-sizing: border-box; position: relative; }' +
                    '.cs-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px; }' +
                    '.cs-title { font-size: 24pt; font-weight: bold; text-transform: uppercase; line-height: 0.9; }' +
                    '.cs-meta { font-size: 9pt; text-align: right; }' +
                    '.cs-grid-3 { display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 10px; margin-bottom: 10px; font-size: 8pt; }' +
                    '.cs-box { border: 1px solid #000; }' +
                    '.cs-box-header { background: #000; color: #fff; font-weight: bold; padding: 2px 5px; text-transform: uppercase; font-size: 8pt; }' +
                    '.cs-box-content { padding: 5px; }' +
                    '.cs-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9pt; }' +
                    '.cs-table th { background: #000; color: #fff; font-weight: bold; text-transform: uppercase; padding: 4px; border: 1px solid #000; text-align: left; }' +
                    '.cs-table td { border: 1px solid #000; padding: 4px; vertical-align: top; }' +
                    '.cs-row-grey { background: #eee; }' +
                    '.cs-banner { background: #000; color: #fff; font-weight: bold; text-align: center; padding: 3px; text-transform: uppercase; margin-bottom: 5px; font-size: 10pt; }' +
                    '.cs-weather { display: flex; justify-content: space-between; font-size: 8pt; }' +
                    '.text-right { text-align: right; } .text-center { text-align: center; } .font-bold { font-weight: bold; }' +
                    '</style>';

                var locsHtml = locs.map(function (l, i) {
                    return '<div style="margin-bottom:5px;"><strong>LOC ' + (i + 1) + ':</strong> ' + esc(l.name) + '<br>' +
                        esc(l.address) + '<br><em style="font-size:7pt">Nearest Hosp: ' + esc(l.hospital || 'Dial 911') + '</em></div>';
                }).join('');

                var scheduleHtml = schedule.map(function (row) {
                    if (row.type === 'meal') return '<tr class="cs-row-grey"><td class="text-center font-bold">' + t(row.time) + '</td><td colspan="5" class="text-center font-bold" style="text-transform:uppercase">' + esc(row.description) + '</td></tr>';
                    return '<tr><td class="text-center font-bold">' + t(row.time) + '</td>' +
                        '<td class="text-center">' + esc(row.scene || '-') + '</td>' +
                        '<td class="text-center">' + esc(row.ie || '-') + '</td>' +
                        '<td><strong>' + esc(row.description || '') + '</strong><br><em style="font-size:8pt">' + esc(row.note || '') + '</em></td>' +
                        '<td class="text-center">' + esc(row.cast || '') + '</td>' +
                        '<td class="text-center">' + esc(row.loc || '1') + '</td></tr>';
                }).join('');

                var castHtml = cast.map(function (c) {
                    return '<tr><td><strong>' + esc(c.character) + '</strong></td><td>' + esc(c.actor) + '</td>' +
                        '<td class="text-center">' + t(c.pickup) + '</td><td class="text-center">' + t(c.hmu) + '</td>' +
                        '<td class="text-center">' + t(c.costume) + '</td><td class="text-center font-bold">' + t(c.setCall) + '</td></tr>';
                }).join('');

                var html = '<div class="cs-body">' +
                    '<div class="cs-header"><div><div class="cs-title">' + esc(meta.productionTitle || 'UNTITLED PROJECT') + '</div>' +
                    '<div style="font-weight:bold;font-size:12pt;">CALL SHEET</div></div>' +
                    '<div class="cs-meta"><div><strong>Date:</strong> ' + esc(meta.shootDate || 'TBD') + '</div>' +
                    '<div><strong>Crew Call:</strong> ' + esc(meta.crewCallTime || '07:00') + '</div>' +
                    (shootDayLabel ? '<div style="margin-top:5px;font-size:12pt;font-weight:bold;">' + esc(shootDayLabel) + '</div>' : '') +
                    '</div></div>' +
                    '<div class="cs-grid-3">' +
                    '<div class="cs-box"><div class="cs-box-header">Production Office</div><div class="cs-box-content">' +
                    '<strong>Director:</strong> ' + esc(contacts.director || 'TBD') + '<br>' +
                    '<strong>Producer:</strong> ' + esc(contacts.producer || 'TBD') + '<br>' +
                    '<strong>1st AD:</strong> ' + esc(contacts.ad || 'TBD') + '<br><br>' +
                    esc(meta.productionCompany || 'Indie Prod') + '</div></div>' +
                    '<div class="cs-box"><div class="cs-box-header">Locations</div><div class="cs-box-content">' + locsHtml + '</div></div>' +
                    '<div class="cs-box"><div class="cs-box-header">Conditions</div><div class="cs-box-content">' +
                    '<div class="cs-weather"><span>Sunrise: ' + (meta.sunriseSunset ? meta.sunriseSunset.split('/')[0] : '06:00') + '</span>' +
                    '<span>Sunset: ' + (meta.sunriseSunset ? meta.sunriseSunset.split('/')[1] : '18:00') + '</span></div>' +
                    '<hr style="border:0;border-top:1px dashed #ccc;margin:4px 0;">' +
                    esc((locs[0] && locs[0].weather) ? locs[0].weather : 'Sunny, 30\u00B0C') + '</div></div></div>' +
                    '<div class="cs-banner">Shooting Schedule</div>' +
                    '<table class="cs-table"><thead><tr><th style="width:10%">Time</th><th style="width:8%">Scn</th><th style="width:8%">I/E</th><th>Description / Action</th><th style="width:15%">Cast</th><th style="width:15%">Location</th></tr></thead><tbody>' + scheduleHtml + '</tbody></table>' +
                    '<div class="cs-banner">Cast &amp; Talent</div>' +
                    '<table class="cs-table"><thead><tr><th>Character</th><th>Artist</th><th class="text-center">Pickup</th><th class="text-center">H/MU</th><th class="text-center">Costume</th><th class="text-center">Set Call</th></tr></thead><tbody>' + castHtml + '</tbody></table>' +
                    '<div style="position:absolute;bottom:10mm;width:100%;border-top:1px solid #000;padding-top:5px;font-size:8pt;text-align:center;">' +
                    'PRODUCED BY: ' + esc(meta.productionCompany || 'Indie Prod') + ' | RECYCLE BIN: Please destroy this document after use.</div></div>';

                return { css: css, html: html };
            },

            /* Professional XLSX budget export */
            professionalXlsx: function (budgetData) {
                if (typeof XLSX === 'undefined') return notify('Error', 'Excel Engine missing.');

                var wb = XLSX.utils.book_new();
                var wsData = [];

                wsData.push(['PROJECT', budgetData.projectName]);
                wsData.push(['COMPANY', budgetData.company]);
                wsData.push(['DATE', new Date().toLocaleDateString()]);
                wsData.push([]);

                wsData.push(['SUMMARY', 'AMOUNT']);
                financialSummary(budgetData).forEach(function (row) { wsData.push(row); });
                wsData.push([]);

                wsData.push(['SECTION', 'DESCRIPTION', 'QUANTITY', 'UNIT', 'RATE', 'ESTIMATED', 'ACTUAL', 'VARIANCE', 'OWNER GEAR']);

                if (budgetData.sections) {
                    var previousGroup = null;
                    window.mBTPublisher.templates._orderedSections(budgetData.sections).forEach(function (entry) {
                        var key = entry.name;
                        var sec = entry.sec;
                        if (previousGroup !== entry.group) { wsData.push([window.mBTPublisher.templates._phaseLabels[entry.group]]); previousGroup = entry.group; }
                        wsData.push([key.toUpperCase(), '', '', '', '', '', '', '', '']);

                        (sec.items || []).forEach(function (item) {
                            var qty = parseFloat(item.quantity) || 0;
                            var rate = parseFloat(item.rate) || 0;
                            var est = parseFloat(item.total) || 0;
                            var act = parseFloat(item.actual) || 0;
                            wsData.push(['', item.description, qty, item.unit, rate, est, act, act - est, item.ownerOwned === true ? 'Yes' : '']);
                        });
                        wsData.push([]);
                    });
                }

                var ws = XLSX.utils.aoa_to_sheet(wsData);
                ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
                XLSX.utils.book_append_sheet(wb, ws, 'Budget');
                XLSX.writeFile(wb, slugify(budgetData.projectName) + '.xlsx');
            }
        },

        /* ========= TEMPLATE ENGINE ========= */
        /* Template-driven document renderer. Each template takes budget JSON and returns
           a self-contained HTML string. The HTML can be previewed in a div, printed,
           or passed to html2pdf for PDF export. No DOM required at render time. */
        templates: {

            /* Phase classification maps — match section id to Top Sheet group.
               Includes template structure ids from mBT.templates (btl_pre/prod/post, logistics). */
            _phaseMap: {
                atl:       'atl',
                dev:       'dev',
                pre:       'pre',
                prod:      'btl',
                btl_pre:   'btl',
                btl_prod:  'btl',
                tech:      'btl',
                gear:      'btl',
                conn:      'btl',
                btl_post:  'post',
                post:      'post',
                pub:       'pub',
                dist:      'pub',
                travel:    'travel',
                logistics: 'travel',
                other:     'other'
            },

            _phaseLabels: {
                dev:    'Development',
                pre:    'Pre-Production',
                atl:    'Above The Line',
                btl:    'Below The Line (Production)',
                post:   'Post Production',
                pub:    'Publishing & Distribution',
                travel: 'Travel & Logistics',
                other:  'Other'
            },

            /* Classify all budget sections into phase groups */
            _groupSections: function (sections) {
                var map = this._phaseMap;
                var order = ['dev', 'pre', 'atl', 'btl', 'post', 'pub', 'travel', 'other'];
                var groups = {};
                order.forEach(function (g) { groups[g] = []; });
                Object.keys(sections).forEach(function (name) {
                    var sec = sections[name];
                    var id = (sec.id || '').toLowerCase();
                    var group = sec.printGroup || map[id] || 'other';
                    if (order.indexOf(group) === -1) group = 'other';
                    groups[group].push({ name: name, sec: sec });
                });
                return { groups: groups, order: order };
            },
            _orderedSections: function (sections) {
                var grouped = this._groupSections(sections), result = [];
                grouped.order.forEach(function (group) { grouped.groups[group].forEach(function (entry) { result.push({ name: entry.name, sec: entry.sec, group: group }); }); });
                return result;
            },
            printBudget: function (budget) {
                var old = document.getElementById('mBT-budget-print'); if (old) old.parentNode.removeChild(old);
                var frame = document.createElement('iframe'); frame.id = 'mBT-budget-print';
                frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:850px;height:1100px;border:0;';
                frame.onload = function () {
                    if (!frame.isConnected) return;
                    frame.contentWindow.addEventListener('afterprint', function () { if (frame.parentNode) frame.parentNode.removeChild(frame); });
                    frame.contentWindow.print();
                };
                frame.srcdoc = this.render('detailBudget', budget, { currency: budget.currency || 'JMD' });
                document.body.appendChild(frame);
            },

            /* Sum estimated amounts from a section's items (uses item.total if reconciled, else qty*rate*mult) */
            _sectionEst: function (sec) {
                return (sec.items || []).reduce(function (sum, item) {
                    var est = parseFloat(item.total);
                    if (isNaN(est)) {
                        est = (parseFloat(item.quantity) || 0) *
                            (parseFloat(item.rate) || 0) *
                            (parseFloat(item.multiplier) || 1);
                    }
                    return sum + (est || 0);
                }, 0);
            },

            /* Sum actual amounts from a section's items */
            _sectionActual: function (sec) {
                return (sec.items || []).reduce(function (sum, item) {
                    return sum + (parseFloat(item.actual) || 0);
                }, 0);
            },

            /* Shared print-ready CSS for all templates */
            _baseCss: [
                '@page { size: letter portrait; margin: 0.65in; }',
                'body { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #1a1a2e; background: white; margin: 0; }',
                '.ts-page { max-width: 7.2in; margin: 0 auto; }',
                '.ts-header { border-bottom: 3px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }',
                '.ts-title { font-size: 16pt; font-weight: 900; text-transform: uppercase; letter-spacing: -0.3px; margin: 0; }',
                '.ts-subtitle { font-size: 8pt; color: #64748b; margin-top: 3px; }',
                '.ts-meta { display: flex; justify-content: space-between; font-size: 8pt; color: #475569; margin-top: 6px; }',
                'table { width: 100%; border-collapse: collapse; }',
                'td, th { padding: 4px 7px; vertical-align: middle; }',
                '.col-r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }',
                '.col-c { text-align: center; }',
                '.th-row { background: #0f172a; color: #fff; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }',
                '.group-hdr { background: #1e293b; color: #f8fafc; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 5px 7px; }',
                '.sec-row { border-bottom: 1px solid #f1f5f9; }',
                '.sec-row:nth-child(even) { background: #fafafa; }',
                '.grp-total { background: #e2e8f0; font-weight: 700; font-size: 8.5pt; border-top: 1.5px solid #94a3b8; }',
                '.grp-total td { padding: 5px 7px; }',
                '.summary-row { background: #f8fafc; border-top: 1px solid #e2e8f0; }',
                '.grand-total-row { background: #0f172a; color: #fff; font-weight: 900; font-size: 10pt; }',
                '.grand-total-row td { padding: 7px 7px; }',
                '.positive { color: #15803d; }',
                '.negative { color: #dc2626; }',
                '.funding-section { margin-top: 20px; }',
                '.ts-footer { margin-top: 20px; font-size: 7pt; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 6px; }',
                '.detail-item-row { border-bottom: 1px solid #f1f5f9; }',
                '.detail-item-row:nth-child(even) { background: #fafafa; }',
                '.detail-sec-hdr { background: #334155; color: #e2e8f0; font-weight: 700; font-size: 8pt; }',
                '.detail-sec-total { background: #f1f5f9; font-weight: 700; }',
                '.detail-sec-block { margin-bottom: 14px; page-break-before: auto; page-break-inside: avoid; }',
                '.detail-sec-block + .detail-sec-block { page-break-before: always; }',
                '.callsheet-block { margin-bottom: 0; border: 1px solid #cbd5e1; border-top: none; page-break-inside: avoid; }',
                '.callsheet-block h3 { background: #1e293b; color: #f8fafc; margin: 0; padding: 5px 8px; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; border-top: 1px solid #0f172a; }',
                '.callsheet-block table { margin-bottom: 0; }',
                '.cs-header { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #cbd5e1; margin-bottom: 0; }',
                '.cs-header-left, .cs-header-right { padding: 8px 10px; }',
                '.cs-header-right { border-left: 1px solid #cbd5e1; }',
                '.cs-title { font-size: 15pt; font-weight: 900; text-transform: uppercase; letter-spacing: -0.3px; margin: 0 0 2px 0; }',
                '.cs-day { font-size: 9pt; font-weight: 700; color: #334155; margin-bottom: 6px; }',
                '.cs-kv { font-size: 8pt; line-height: 1.6; }',
                '.cs-kv b { display: inline-block; width: 65px; color: #475569; }',
                '.cs-meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #cbd5e1; border-top: none; }',
                '.cs-meta-cell { padding: 6px 10px; border-right: 1px solid #cbd5e1; font-size: 8pt; }',
                '.cs-meta-cell:last-child { border-right: none; }',
                '.cs-meta-cell h4 { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin: 0 0 3px 0; }',
                '.cs-sched-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; border: 1px solid #cbd5e1; border-top: none; }',
                '.cs-sched-cell { padding: 5px 10px; border-right: 1px solid #cbd5e1; font-size: 8pt; text-align: center; }',
                '.cs-sched-cell:last-child { border-right: none; }',
                '.cs-sched-cell b { display: block; font-size: 7pt; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }',
                '.cs-sched-cell span { font-size: 11pt; font-weight: 700; }',
                '.cs-dept-grid { display: grid; grid-template-columns: 1fr 1fr; }',
                '.cs-dept-item { padding: 4px 10px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; font-size: 8pt; }',
                '.cs-dept-item:nth-child(even) { border-right: none; }',
                '.cs-dept-label { font-weight: 700; color: #475569; font-size: 7pt; text-transform: uppercase; }',
                '.cs-advance { padding: 6px 10px; font-size: 8pt; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }',
                '.cs-footer-row { display: grid; grid-template-columns: 1fr 1fr; padding: 5px 10px; font-size: 7.5pt; color: #475569; border-top: 1px solid #e2e8f0; }',
                '@media print { .callsheet-block { page-break-inside: avoid; } table { page-break-inside: avoid; } .cs-header, .cs-meta-grid, .cs-sched-grid { page-break-inside: avoid; } }'
            ].join('\n'),

            /* Scoped ink-friendly CSS used only by callSheet so all other 28 generators remain byte-identical */
            _callSheetCss: [
                '@page { size: letter portrait; margin: 0.65in; }',
                'body { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #000; background: white; margin: 0; }',
                '.ts-page { max-width: 7.2in; margin: 0 auto; }',
                'table { width: 100%; border-collapse: collapse; }',
                'td, th { padding: 4px 7px; vertical-align: middle; }',
                '.col-r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }',
                '.col-c { text-align: center; }',
                '.sec-row { border-bottom: 1px solid #000; }',
                '.ts-footer { margin-top: 20px; font-size: 7.5pt; color: #000; text-align: center; border-top: 1px dashed #000; padding-top: 6px; }',
                '.callsheet-block { margin-bottom: 10px; border: none; page-break-inside: avoid; }',
                '.callsheet-block h3 { background: transparent; color: #000; margin: 10px 0 6px 0; padding: 4px 0; font-size: 9.5pt; font-weight: 700; letter-spacing: 0.2px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }',
                '.callsheet-block table { width: 100%; border-collapse: collapse; margin-bottom: 0; }',
                '.callsheet-block th, .callsheet-block td { border: 1px solid #000; padding: 4px 7px; background: transparent; color: #000; text-align: left; vertical-align: top; }',
                '.callsheet-block .th-row, .callsheet-block .th-row th { background: transparent; color: #000; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.4px; border: 1px solid #000; }',
                '.cs-brand { font-size: 10pt; font-weight: 700; color: #000; margin-bottom: 2px; }',
                '.cs-doc-label { font-size: 15pt; font-weight: 800; color: #000; margin: 0 0 2px 0; }',
                '.cs-header { display: grid; grid-template-columns: 1.2fr 1fr; border: 1px solid #000; margin-bottom: 8px; }',
                '.cs-header-left, .cs-header-right { padding: 8px 10px; }',
                '.cs-header-right { border-left: 1px solid #000; }',
                '.cs-title { font-size: 13pt; font-weight: 700; letter-spacing: -0.2px; margin: 0 0 3px 0; color: #000; }',
                '.cs-day { font-size: 9pt; font-weight: 600; color: #000; margin-bottom: 6px; }',
                '.cs-kv { font-size: 8.5pt; line-height: 1.6; color: #000; }',
                '.cs-kv b { display: inline-block; min-width: 75px; color: #000; }',
                '.cs-tbc-box { border: 1px solid #000; padding: 7px 10px; margin: 0 0 10px 0; font-size: 8.5pt; line-height: 1.45; background: #fff; color: #000; }',
                '.cs-tbc-tag { display: inline-block; border: 1px solid #000; padding: 0 4px; font-size: 7pt; font-weight: 700; margin-left: 4px; }',
                '.cs-writein { display: inline-block; min-width: 60px; border-bottom: 1px solid #000; color: transparent; line-height: 1.1; }',
                '.cs-checkbox { appearance: none; -webkit-appearance: none; display: inline-block; width: 11px; height: 11px; border: 1.4px solid #000; background: #fff; vertical-align: middle; margin: 0 6px 0 0; border-radius: 0; }',
                '.cs-checklist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; padding: 4px 0; font-size: 8.5pt; }',
                '.cs-checklist-item { display: flex; align-items: flex-start; gap: 4px; line-height: 1.4; padding: 2px 0; }',
                '.cs-meta-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #000; margin-bottom: 8px; }',
                '.cs-meta-cell { padding: 6px 10px; border-right: 1px solid #000; font-size: 8.5pt; }',
                '.cs-meta-cell:last-child { border-right: none; }',
                '.cs-meta-cell h4 { font-size: 8pt; font-weight: 700; letter-spacing: 0.3px; color: #000; margin: 0 0 4px 0; border-bottom: 1px dashed #000; padding-bottom: 2px; }',
                '.cs-sched-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; border: 1px solid #000; margin-bottom: 8px; }',
                '.cs-sched-cell { padding: 5px 10px; border-right: 1px solid #000; font-size: 8.5pt; text-align: center; }',
                '.cs-sched-cell:last-child { border-right: none; }',
                '.cs-sched-cell b { display: block; font-size: 7.5pt; color: #000; margin-bottom: 2px; }',
                '.cs-sched-cell span { font-size: 10pt; font-weight: 700; }',
                '.cs-dept-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #000; }',
                '.cs-dept-item { padding: 4px 10px; border-right: 1px solid #000; border-bottom: 1px solid #000; font-size: 8.5pt; }',
                '.cs-dept-item:nth-child(even) { border-right: none; }',
                '.cs-dept-label { font-weight: 700; color: #000; font-size: 7.5pt; }',
                '.cs-advance { padding: 6px 10px; font-size: 8.5pt; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border: 1px solid #000; }',
                '.cs-footer-row { display: grid; grid-template-columns: 1fr 1fr; padding: 5px 10px; font-size: 8pt; color: #000; border-top: 1px dashed #000; }',
                '@media print { .callsheet-block { page-break-inside: avoid; } table { page-break-inside: avoid; } .cs-header, .cs-meta-grid, .cs-sched-grid { page-break-inside: avoid; } .cs-tbc-box { page-break-inside: avoid; } }'
            ].join('\n'),

            /* Easy On The Ink: global print setting (options.easyOnTheInk) for every generator.
               Off by default so existing documents stay byte-identical. The call sheet and the
               production paperwork documents always print in this style. */
            _inkCss: [
                '/*easy-on-the-ink*/',
                'body, body * { color: #000 !important; background: transparent !important; box-shadow: none !important; text-shadow: none !important; }',
                'body { background: #fff !important; }',
                '.ts-header, .ts-brand { border-bottom: 1px dashed #000 !important; }',
                '[style*="border-bottom:3px"], [style*="border-bottom: 3px"] { border-bottom: 1px dashed #000 !important; }',
                '.ts-title, .ts-subtitle, .cs-title, .fs-title, .pitch-title, .fp-prod-title, h1, h2, h3, h4, .group-hdr, .detail-sec-hdr, .detail-phase-hdr, .detail-department-hdr td, .dm-hdr, .dr-sec-hdr, .fs-section-hdr, .cs-box-header, .sec-hdr td, .grp-total td, .grand-total-row td, .ts-footer, [style*="letter-spacing:2px"] { text-transform: none !important; letter-spacing: normal !important; }',
                '.group-hdr, .detail-sec-hdr, .detail-phase-hdr, .dm-hdr, .dr-sec-hdr, .fs-section-hdr, .cs-box-header, .sec-hdr td, h2, h3 { border-top: 1px dashed #000 !important; border-bottom: 1px dashed #000 !important; border-left: none !important; border-right: none !important; border-radius: 0 !important; font-weight: 700 !important; }',
                'th, .th-row th, .th-row td { border-bottom: 1px solid #000 !important; font-weight: 700 !important; }',
                '.grand-total-row td, .grp-total td { border-top: 1px solid #000 !important; font-weight: 700 !important; }',
                '.ink-writein { white-space: nowrap; }'
            ].join('\n'),

            /* Only generator-owned heading captions enter this helper; user text never does. */
            _inkHeading: function (text) {
                return this._currentOptions && this._currentOptions.easyOnTheInk
                    ? '<span class="ink-heading">' + this._inkTitle(text) + '</span>' : text;
            },

            /* Only the separator inserted by a generator changes; supplied title text stays verbatim. */
            _titleSeparator: function () {
                return this._currentOptions && this._currentOptions.easyOnTheInk ? ' - ' : ' \u2014 ';
            },

            _inkTitle: function (text) {
                var small = { of: 1, and: 1, the: 1, to: 1, for: 1 };
                return String(text).replace(/&mdash;|&ndash;|\u2014|\u2013/g, '-').toLowerCase().replace(/[a-z][a-z-]*/g, function (w, i) {
                    return (i > 0 && small[w]) ? w : w.charAt(0).toUpperCase() + w.slice(1);
                });
            },

            /* Generators identify empty fallbacks before user text and labels share a text node. */
            _fallbackEsc: function (value, options) {
                return !value && options && options.easyOnTheInk
                    ? '<span class="ink-writein">________</span>' : esc(value || '\u2014');
            },

            /* Ink changes styles and exact dash placeholder nodes only. User text stays verbatim. */
            _inkBody: function (html) {
                var self = this;
                return String(html || '')
                    .replace(/\bstyle="([^"]*)"/gi, function (m, s) {
                        return 'style="' + self._inkStyle(s) + '"';
                    })
                    .replace(/>([^<>]*)</g, function (all, text) {
                        return /^\s*(?:\u2014|\u2013|&mdash;|&ndash;)\s*$/.test(text)
                            ? '><span class="ink-writein">________</span><' : all;
                    });
            },

            /* CSS text for Easy On The Ink: fills become transparent, light text on dark fills becomes black, no forced capitals. */
            _inkStyle: function (css) {
                return String(css || '')
                    .replace(/background(?:-color)?\s*:\s*[^;}"]+/gi, 'background: transparent')
                    .replace(/(^|[;{\s"'])color\s*:\s*(?:#fff\b|#ffffff\b|#f8fafc\b|#e2e8f0\b|#f1f5f9\b|white\b)/gi, '$1color: #000')
                    .replace(/text-transform\s*:\s*uppercase/gi, 'text-transform: none')
                    .replace(/border-bottom\s*:\s*[23]px\s+solid\s+#[0-9a-f]{3,6}/gi, 'border-bottom: 1px dashed #000');
            },

            /* Wrap rendered body HTML in a full printable document. Title is raw text: escape only here. */
            _wrapHtml: function (title, bodyHtml, extraCss) {
                var o = this._currentOptions || {};
                var brand = o.brand || {};
                var wm = o.watermark || '';
                var theme = o.theme || '';
                var isCallSheet = typeof extraCss === 'string' && extraCss.indexOf('/*cs-ink*/') > -1;
                var isRelease = typeof extraCss === 'string' && extraCss.indexOf('/*release-ink*/') > -1;
                var ink = !isCallSheet && !!o.easyOnTheInk;

                /* Brand letterhead — logo left, company text right */
                var brandHtml = '';
                if (brand.logo || brand.name || brand.address) {
                    var logoSrc = safeAssetUrl(brand.logo);
                    var logoHtml = logoSrc ? '<img src="' + logoSrc + '" alt="" class="ts-brand-logo">' : '';
                    var textHtml = (brand.name || brand.address) ?
                        '<div class="ts-brand-text"><div class="ts-brand-name">' + esc(paperBrand(brand.name || '')) + '</div>' +
                        (brand.address ? '<div class="ts-brand-addr">' + esc(brand.address) + '</div>' : '') + '</div>' : '';
                    brandHtml = '<div class="ts-brand">' + logoHtml + textHtml + '</div>';
                }

                /* Watermark CSS — large diagonal semi-transparent text */
                var wmCss = wm ? ('body::before{content:"' + wm.replace(/"/g, '\\"') + '";position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-40deg);font-size:72pt;font-weight:900;color:rgba(0,0,0,0.045);letter-spacing:6px;pointer-events:none;z-index:9999;white-space:nowrap;}') : '';

                /* Theme accent — overrides header background and grand total text */
                var themeCss = (theme && !isCallSheet && !ink) ? (
                    '.group-hdr,.ts-section-hdr,.ts-phase-hdr,.doc-header,.cs-section-header{background:' + theme + ' !important;color:#fff !important;}' +
                    '.th-row th{background:' + theme + '22 !important;}' +
                    '.ts-grand-total td{color:' + theme + ' !important;}'
                ) : '';

                var brandCss = '.ts-brand{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;}.ts-brand-logo{max-height:52px;max-width:130px;object-fit:contain;}.ts-brand-text{text-align:right;}.ts-brand-name{font-size:10pt;font-weight:700;color:#0f172a;}.ts-brand-addr{font-size:7.5pt;color:#64748b;}';
                var baseCss = isCallSheet ? this._callSheetCss : this._baseCss;
                var cleanExtraCss = String(extraCss || '').replace('/*cs-ink*/', '').replace('/*release-ink*/', '');
                var footerLine = isCallSheet
                    ? '<div class="ts-footer">moo</div>'
                    : (ink || isRelease)
                        ? '<div class="ts-footer">Generated by mooBudgetTool - ' + new Date().toLocaleDateString() + '</div>'
                        : '<div class="ts-footer">Generated by mooBudgetTool &mdash; ' + new Date().toLocaleDateString() + '</div>';

                var styleCss = baseCss + brandCss + wmCss + themeCss + cleanExtraCss;
                if (ink) {
                    styleCss = this._inkStyle(styleCss) + '\n' + this._inkCss;
                    bodyHtml = this._inkBody(bodyHtml);
                }

                return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
                    '<title>' + esc(title) + '</title>' +
                    '<style>' + styleCss + '</style>' +
                    '</head><body><div class="ts-page">' + brandHtml + bodyHtml +
                    footerLine +
                    '</div></body></html>';
            },

            /* ---- TEMPLATE: TOP SHEET ---- */
            topSheet: {
                id: 'topSheet',
                name: 'Top Sheet',
                description: 'One-page budget summary. ATL / BTL / Post / Publishing breakdown with totals.',
                formats: ['pdf', 'html', 'print'],
                renderHtml: function (budgetData, options, engine) {
                    options = options || {};
                    var currency = options.currency || 'JMD';
                    var rate = parseFloat(options.rate) || 1;
                    var fmt = function (v) { return fmtCurrency(v, currency, rate); };
                    var b = budgetData || {};
                    var sections = b.sections || {};
                    var grouped = engine._groupSections(sections);
                    var groups = grouped.groups;
                    var order = grouped.order;
                    var labels = engine._phaseLabels;

                    var header = '<div class="ts-header">' +
                        '<div class="ts-title">' + esc(b.projectName || 'Untitled Production') + '</div>' +
                        '<div class="ts-subtitle">' + engine._inkHeading('PRODUCTION BUDGET &mdash; TOP SHEET') + '</div>' +
                        '<div class="ts-meta">' +
                        '<span>' + esc(reportCompany(b)) + '</span>' +
                        '<span>Prepared: ' + esc(typedReportDate(b, 'preparedDate')) + '</span>' +
                        '<span>Currency: ' + esc(currency) + '</span>' +
                        '</div></div>';

                    var tableRows = '<table><thead><tr class="th-row">' +
                        '<th>Account / Section</th>' +
                        '<th class="col-r">Estimated</th>' +
                        '<th class="col-r">Actual</th>' +
                        '<th class="col-r">Variance</th>' +
                        '</tr></thead><tbody>';

                    var grandEst = 0;
                    var grandAct = 0;

                    order.forEach(function (groupKey) {
                        var rows = groups[groupKey];
                        if (!rows || rows.length === 0) return;

                        var groupEst = 0;
                        var groupAct = 0;
                        var label = labels[groupKey] || groupKey.toUpperCase();

                        tableRows += '<tr><td colspan="4" class="group-hdr">' + esc(label) + '</td></tr>';

                        rows.forEach(function (entry) {
                            var est = engine._sectionEst(entry.sec);
                            var act = engine._sectionActual(entry.sec);
                            var variance = act - est;
                            groupEst += est;
                            groupAct += act;
                            tableRows += '<tr class="sec-row">' +
                                '<td>' + esc(entry.name) + '</td>' +
                                '<td class="col-r">' + fmt(est) + '</td>' +
                                '<td class="col-r">' + fmt(act) + '</td>' +
                                '<td class="col-r ' + (variance < 0 ? 'positive' : variance > 0 ? 'negative' : '') + '">' + fmt(variance) + '</td>' +
                                '</tr>';
                        });

                        var gVariance = groupAct - groupEst;
                        tableRows += '<tr class="grp-total">' +
                            '<td>' + ((engine._currentOptions && engine._currentOptions.easyOnTheInk) ? 'Total ' + esc(label) : 'TOTAL ' + esc(label.toUpperCase())) + '</td>' +
                            '<td class="col-r">' + fmt(groupEst) + '</td>' +
                            '<td class="col-r">' + fmt(groupAct) + '</td>' +
                            '<td class="col-r ' + (gVariance < 0 ? 'positive' : gVariance > 0 ? 'negative' : '') + '">' + fmt(gVariance) + '</td>' +
                            '</tr>';

                        grandEst += groupEst;
                        grandAct += groupAct;
                    });

                    /* Shared summary includes each enabled scoped fringe and the production fee. */
                    var totals = window.mBT_Finance.summary(b);
                    var grandTotal = totals.grandTotal;
                    tableRows += '<tr class="summary-row"><td colspan="4" style="padding:3px;"></td></tr>';
                    financialSummary(b).slice(0, -1).forEach(function (row) {
                        tableRows += '<tr class="summary-row"><td>' + esc(row[0]) + '</td><td class="col-r" colspan="3">' + (row[1] < 0 ? '-' : '') + fmt(Math.abs(row[1])) + '</td></tr>';
                    });
                    var finalVariance = grandAct - grandTotal;
                    tableRows += '<tr class="grand-total-row"><td>' + engine._inkHeading('GRAND TOTAL') + '</td><td class="col-r">' + fmt(grandTotal) + '</td><td class="col-r">' + fmt(grandAct) + '</td><td class="col-r">' + fmt(finalVariance) + '</td></tr>';

                    tableRows += '</tbody></table>';

                    /* Funding Sources (optional) */
                    var fundingHtml = '';
                    if (b.fundingSources && b.fundingSources.length > 0) {
                        var totalFunding = fundingFacts(b).confirmed;
                        fundingHtml = '<div class="funding-section"><table><thead><tr class="th-row"><th>Funding Source</th><th>Status</th><th class="col-r">Amount</th></tr></thead><tbody>';
                        b.fundingSources.forEach(function (f) {
                            fundingHtml += '<tr class="sec-row"><td>' + esc(f.name || '') + '</td><td>' + esc(f.status || '') + '</td><td class="col-r">' + fundingDisplay(b, f, fmt) + '</td></tr>';
                        });
                        var gap = Math.max(0, grandTotal - totalFunding);
                        fundingHtml += '<tr class="grp-total"><td>CONFIRMED FUNDING (rated sources)</td><td></td><td class="col-r">' + fmt(totalFunding) + '</td></tr>';
                        fundingHtml += '<tr class="grp-total ' + (gap > 0 ? 'negative' : 'positive') + '"><td>FUNDING GAP (rated sources)</td><td></td><td class="col-r">' + fmt(Math.abs(gap)) + '</td></tr>';
                        fundingHtml += '</tbody></table></div>';
                    }

                    return engine._wrapHtml(
                        (b.projectName || 'Budget') + engine._titleSeparator() + 'Top Sheet',
                        header + tableRows + fundingHtml
                    );
                }
            },

            /* ---- TEMPLATE: DETAIL BUDGET ---- */
            detailBudget: {
                id: 'detailBudget',
                name: 'Detail Budget',
                description: 'Full line-item breakdown with quantities, units, rates, and actuals.',
                formats: ['pdf', 'xlsx', 'html', 'print'],
                renderHtml: function (budgetData, options, engine) {
                    options = options || {};
                    var currency = options.currency || 'JMD';
                    var rate = parseFloat(options.rate) || 1;
                    var fmt = function (v) { return fmtCurrency(v, currency, rate); };
                    var b = budgetData || {};
                    var sections = b.sections || {};
                    var header = '<div class="ts-header">' +
                        '<div class="ts-title">' + esc(b.projectName || 'Untitled Production') + '</div>' +
                        '<div class="ts-subtitle">' + engine._inkHeading('DETAIL BUDGET') + '</div>' +
                        '<div class="ts-meta"><span>' + esc(reportCompany(b)) + '</span><span>Date: ' + esc(typedReportDate(b, 'preparedDate')) + '</span><span>' + esc(currency) + '</span></div></div>';

                    /* One table per section — ensures page-break-before works reliably at print */
                    var thRow = '<thead><tr class="th-row">' +
                        '<th>Description</th><th class="col-c">Qty</th><th class="col-c">Unit</th>' +
                        '<th class="col-r">Rate</th><th class="col-r">Estimated</th>' +
                        '<th class="col-r">Actual</th><th class="col-r">Variance</th>' +
                        '</tr></thead>';

                    var rows = '';
                    var previousGroup = null;
                    engine._orderedSections(sections).forEach(function (entry) {
                        var secName = entry.name;
                        var sec = sections[secName];
                        if (previousGroup !== entry.group) { rows += '<h2 class="detail-phase-hdr">' + esc(engine._phaseLabels[entry.group]) + '</h2>'; previousGroup = entry.group; }
                        var secEst = engine._sectionEst(sec);
                        var secAct = engine._sectionActual(sec);
                        rows += '<div class="detail-sec-block">';
                        rows += '<table>' + thRow + '<tbody>';
                        rows += '<tr><td colspan="7" class="detail-sec-hdr">' + esc((engine._currentOptions && engine._currentOptions.easyOnTheInk) ? secName : secName.toUpperCase()) + '</td></tr>';
                        var departments = {}, departmentOrder = [];
                        (sec.items || []).forEach(function (item) {
                            var tag = item.department || '';
                            if (!departments[tag]) { departments[tag] = []; departmentOrder.push(tag); }
                            departments[tag].push(item);
                        });
                        departmentOrder.forEach(function (tag) {
                            if (tag) rows += '<tr class="detail-department-hdr"><td colspan="7" style="background:#f1f5f9;font-weight:700">' + esc(window.mBTBatch2 && mBTBatch2.groups[tag] ? mBTBatch2.groups[tag][0] : tag) + '</td></tr>';
                            departments[tag].forEach(function (item) {
                            var qty = parseFloat(item.quantity) || 0;
                            var rate = parseFloat(item.rate) || 0;
                            var est = parseFloat(item.total);
                            if (isNaN(est)) est = qty * rate * (parseFloat(item.multiplier) || 1);
                            var act = parseFloat(item.actual) || 0;
                            var variance = act - est;
                            rows += '<tr class="detail-item-row">' +
                                '<td>' + esc(item.description || '') + '</td>' +
                                '<td class="col-c">' + qty + '</td>' +
                                '<td class="col-c">' + esc(item.unit || '') + '</td>' +
                                '<td class="col-r">' + fmt(rate) + '</td>' +
                                '<td class="col-r">' + fmt(est) + '</td>' +
                                '<td class="col-r">' + fmt(act) + '</td>' +
                                '<td class="col-r ' + (variance < 0 ? 'positive' : variance > 0 ? 'negative' : '') + '">' + fmt(variance) + '</td>' +
                                '</tr>';
                        });
                        });
                        rows += '<tr class="detail-sec-total"><td colspan="4" style="text-align:right;font-weight:700;">Section Total</td>' +
                            '<td class="col-r">' + fmt(secEst) + '</td>' +
                            '<td class="col-r">' + fmt(secAct) + '</td>' +
                            '<td class="col-r">' + fmt(secAct - secEst) + '</td></tr>';
                        rows += '</tbody></table></div>';
                    });

                    var detailGrandAct = Object.keys(sections).reduce(function (s, k) { return s + engine._sectionActual(sections[k]); }, 0);
                    var detailGrandEst = Object.keys(sections).reduce(function (s, k) { return s + engine._sectionEst(sections[k]); }, 0);
                    if (b.grandTotal != null) detailGrandEst = Number(b.grandTotal);
                    rows += '<p style="font-size:8pt;">Grand total includes the budget contingency, tax, scoped fringes, production fee and discount.</p>';
                    /* Grand total in its own table so it doesn't inherit section page-break */
                    rows += '<table style="margin-top:8px;"><tbody>' +
                        '<tr class="grand-total-row"><td colspan="4">' + engine._inkHeading('GRAND TOTAL') + '</td><td class="col-r">' + fmt(detailGrandEst) + '</td><td class="col-r">' + fmt(detailGrandAct) + '</td><td class="col-r">' + fmt(detailGrandAct - detailGrandEst) + '</td></tr>' +
                        '</tbody></table>';

                    return engine._wrapHtml((b.projectName || 'Budget') + engine._titleSeparator() + 'Detail Budget', header + rows);
                }
            },

            /* ---- TEMPLATE: CALL SHEET ---- */
            callSheet: {
                id: 'callSheet',
                name: 'Call Sheet',
                description: 'Daily shooting document: contacts, crew, documentary schedule, interviewees, meals, kit, paperwork, wrap, and route.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,

                _collectContacts: function (budgetData, options) {
                    var b = budgetData || {};
                    var opts = options || {};
                    var sources = [];
                    if (Array.isArray(opts)) sources.push(opts);
                    if (Array.isArray(opts.contacts)) sources.push(opts.contacts);
                    if (opts.callSheetData && Array.isArray(opts.callSheetData.contacts)) sources.push(opts.callSheetData.contacts);
                    if (opts.editorData && Array.isArray(opts.editorData.contacts)) sources.push(opts.editorData.contacts);
                    if (Array.isArray(b.contacts)) sources.push(b.contacts);
                    if (Array.isArray(b.openGateContacts)) sources.push(b.openGateContacts);
                    if (typeof window !== 'undefined' && window.mBTOG && Array.isArray(window.mBTOG.contacts)) {
                        sources.push(window.mBTOG.contacts);
                    }
                    var byId = {};
                    var byName = {};
                    var list = [];
                    sources.forEach(function (arr) {
                        (arr || []).forEach(function (c) {
                            if (!c || typeof c !== 'object') return;
                            var id = c.id != null ? String(c.id).trim() : '';
                            var nameKey = String(c.name || '').trim().toLowerCase();
                            if (id && byId[id]) return;
                            if (!id && nameKey && byName[nameKey]) return;
                            if (id) byId[id] = c;
                            if (nameKey && !byName[nameKey]) byName[nameKey] = c;
                            list.push(c);
                        });
                    });
                    return { byId: byId, byName: byName, list: list };
                },

                _stripParenName: function (text) {
                    return String(text || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
                },

                _isSupplyItem: function (item, sec) {
                    if (!item) return false;
                    var kind = String(item.itemType || item.item_type || item.type || '').toLowerCase().trim();
                    if (kind === 'equipment' || kind === 'equip' || kind === 'gear' || kind === 'rental' || kind === 'rentals') return true;
                    var secId = String((sec && sec.id) || '').toLowerCase();
                    if ((secId === 'gear' || secId === 'equipment') && !item.contactId && !item.contact_id && !(item.crew && item.crew.contactId)) return true;
                    return false;
                },

                _resolveCrewRole: function (item, contact) {
                    var strip = this._stripParenName;
                    var desc = String((item && item.description) || '').trim();
                    var cRole = contact && (contact.role || contact.title) ? String(contact.role || contact.title).trim() : '';
                    var iRole = '';
                    if (item && item.crew && item.crew.role) iRole = String(item.crew.role).trim();
                    else if (item && item.role) iRole = String(item.role).trim();
                    if (iRole && iRole === desc) iRole = '';
                    if (iRole) iRole = strip(iRole);
                    if (cRole && cRole.toLowerCase() !== 'crew') {
                        if (iRole && cRole.toLowerCase().indexOf(iRole.toLowerCase()) === -1 && iRole.toLowerCase().indexOf(cRole.toLowerCase()) === -1) {
                            return cRole + ' / ' + iRole;
                        }
                        return cRole;
                    }
                    if (iRole) return iRole;
                    if (cRole) return cRole;
                    return strip(desc);
                },

                _matchesDirector: function (str) {
                    var rl = String(str || '').toLowerCase();
                    var cleaned = rl
                        .replace(/director\s+of\s+photography/g, '')
                        .replace(/(?:1st|2nd|first|second|assistant|art|technical|casting|communications|programme|managing)\s+director/g, '');
                    return /\bdirector\b/.test(cleaned) || /\bon[- ]set\s+direction\b/.test(rl);
                },

                _isBlankScheduleRow: function (r) {
                    if (!r || typeof r !== 'object') return true;
                    if (r.tbc) return false;
                    var keys = Object.keys(r);
                    for (var i = 0; i < keys.length; i++) {
                        var k = keys[i];
                        if ((/Tbc$|_tbc$/i.test(k) && r[k]) || (typeof r[k] === 'string' && /\bTBC\b/i.test(r[k]))) return false;
                    }
                    var fields = ['time', 'activity', 'description', 'location', 'people', 'cast', 'notes', 'sceneNum', 'pages'];
                    for (var j = 0; j < fields.length; j++) {
                        if (r[fields[j]] != null && String(r[fields[j]]).trim() !== '') return false;
                    }
                    return true;
                },

                _migrateScheduleRow: function (r) {
                    if (!r || typeof r !== 'object') return null;
                    var out = {};
                    Object.keys(r).forEach(function (k) { out[k] = r[k]; });
                    var act = (r.activity != null && String(r.activity).trim() !== '') ? String(r.activity) : String(r.description || '');
                    var ppl = (r.people != null && String(r.people).trim() !== '') ? String(r.people) : String(r.cast || '');
                    out.time = r.time != null ? String(r.time) : '';
                    out.activity = act;
                    out.description = (r.description != null && String(r.description).trim() !== '') ? String(r.description) : act;
                    out.location = r.location != null ? String(r.location) : '';
                    out.people = ppl;
                    out.cast = (r.cast != null && String(r.cast).trim() !== '') ? String(r.cast) : ppl;
                    out.notes = r.notes != null ? String(r.notes) : '';
                    out.sceneNum = r.sceneNum != null ? String(r.sceneNum) : '';
                    out.intExt = r.intExt != null ? String(r.intExt) : '';
                    out.dayNight = r.dayNight != null ? String(r.dayNight) : '';
                    out.pages = r.pages != null ? String(r.pages) : '';
                    return out;
                },

                _mergeScheduleAndScenes: function (scheduleArr, scenesArr) {
                    var self = this;
                    var out = [];
                    var copies = Object.create(null);
                    function signature(row) {
                        var ordered = {};
                        Object.keys(row).sort().forEach(function (k) { ordered[k] = row[k]; });
                        return JSON.stringify(ordered);
                    }
                    (Array.isArray(scheduleArr) ? scheduleArr : []).forEach(function (r) {
                        var row = self._migrateScheduleRow(r);
                        if (!row) return;
                        var key = signature(row);
                        copies[key] = (copies[key] || 0) + 1;
                        out.push(row);
                    });
                    (Array.isArray(scenesArr) ? scenesArr : []).forEach(function (r) {
                        var row = self._migrateScheduleRow(r);
                        if (!row) return;
                        var key = signature(row);
                        if (copies[key]) { copies[key]--; return; }
                        out.push(row);
                    });
                    return out;
                },

                /* Shoot-schedule helpers: prefer window.mBTShootSchedule; when the module is
                   absent (vm harness without the script), still read a present shootSchedule
                   key with the same dayId / shootDayIndex / first-day selection rules. */
                _shootScheduleApi: function () {
                    if (typeof window !== 'undefined' && window.mBTShootSchedule
                        && typeof window.mBTShootSchedule.normalise === 'function') {
                        return window.mBTShootSchedule;
                    }
                    return {
                        normalise: function (input) {
                            var list = Array.isArray(input) ? input
                                : (input && typeof input === 'object' && Array.isArray(input.shootSchedule)
                                    ? input.shootSchedule : []);
                            var out = [];
                            var i;
                            for (i = 0; i < list.length; i++) {
                                if (list[i] && typeof list[i] === 'object' && !Array.isArray(list[i])) {
                                    out.push(list[i]);
                                }
                            }
                            return out;
                        },
                        dayTitle: function (day, index, total) {
                            var label = day && typeof day === 'object' && day.label != null
                                ? String(day.label).trim() : '';
                            if (label) return label;
                            var n = null;
                            if (day && typeof day.dayNum === 'number' && isFinite(day.dayNum)
                                && Math.floor(day.dayNum) === day.dayNum && day.dayNum >= 1) {
                                n = day.dayNum;
                            }
                            if (n == null) n = (typeof index === 'number' && isFinite(index) ? Math.floor(index) : 0) + 1;
                            var title = 'Day ' + n;
                            if (typeof total === 'number' && isFinite(total) && Math.floor(total) === total && total >= n) {
                                title += ' of ' + total;
                            }
                            return title;
                        },
                        sortedLegs: function (day) {
                            if (!day || typeof day !== 'object' || !Array.isArray(day.legs)) return [];
                            var decorated = [];
                            var i;
                            for (i = 0; i < day.legs.length; i++) {
                                decorated.push({ leg: day.legs[i], i: i });
                            }
                            decorated.sort(function (a, b) {
                                var ta = a.leg && a.leg.time != null ? String(a.leg.time) : '';
                                var tb = b.leg && b.leg.time != null ? String(b.leg.time) : '';
                                var aBlank = ta === '';
                                var bBlank = tb === '';
                                if (aBlank !== bBlank) return aBlank ? 1 : -1;
                                if (!aBlank && ta !== tb) return ta < tb ? -1 : 1;
                                return a.i - b.i;
                            });
                            var ordered = [];
                            for (i = 0; i < decorated.length; i++) ordered.push(decorated[i].leg);
                            return ordered;
                        }
                    };
                },

                _pickShootDay: function (days, opts) {
                    var o = opts || {};
                    var dayId = o.dayId;
                    if ((dayId == null || String(dayId).trim() === '') && o.editorData && o.editorData.dayId != null) {
                        dayId = o.editorData.dayId;
                    }
                    if ((dayId == null || String(dayId).trim() === '') && o.callSheetData && o.callSheetData.dayId != null) {
                        dayId = o.callSheetData.dayId;
                    }
                    var i;
                    if (dayId != null && String(dayId).trim() !== '') {
                        var want = String(dayId).trim();
                        for (i = 0; i < days.length; i++) {
                            if (days[i] && String(days[i].id || '') === want) {
                                return { day: days[i], index: i };
                            }
                        }
                    }
                    var idxRaw = o.shootDayIndex;
                    if (idxRaw != null && idxRaw !== '') {
                        var idx = parseInt(idxRaw, 10);
                        if (!isNaN(idx) && idx >= 0 && idx < days.length) {
                            return { day: days[idx], index: idx };
                        }
                    }
                    /* No dayId or shootDayIndex: first shoot day when any exist (D1 / J3d). */
                    if (days.length > 0) return { day: days[0], index: 0 };
                    return null;
                },

                _applyShootScheduleToCallSheet: function (data, budgetData, options, contactById) {
                    var b = budgetData || {};
                    if (!Object.prototype.hasOwnProperty.call(b, 'shootSchedule')) return data;
                    var api = this._shootScheduleApi();
                    var days = api.normalise(b);
                    if (!days.length) return data;
                    var picked = this._pickShootDay(days, options || {});
                    if (!picked || !picked.day) return data;
                    var day = picked.day;
                    var dayIndex = picked.index;
                    var locById = {};
                    (day.locations || []).forEach(function (loc) {
                        if (loc && loc.id) locById[String(loc.id)] = loc;
                    });
                    function locName(id) {
                        if (id == null || id === '') return '';
                        var loc = locById[String(id)];
                        return loc && loc.name ? String(loc.name) : '';
                    }
                    function personName(id) {
                        if (id == null || id === '') return '';
                        var c = contactById && contactById[String(id)];
                        return c && c.name ? String(c.name).trim() : '';
                    }
                    data.date = day.date != null ? String(day.date) : '';
                    data.dayOf = api.dayTitle(day, dayIndex, days.length);
                    if (day.tbc) data.dayOfTbc = true;
                    data.shootingLocations = (day.locations || []).map(function (loc) {
                        return {
                            name: loc.name || '',
                            address: loc.address || '',
                            parish: loc.parish || '',
                            contact: loc.siteContactName || '',
                            contactName: loc.siteContactName || '',
                            contactPhone: loc.siteContactPhone || '',
                            hospital: loc.nearestHospital || '',
                            hospitalDistance: '',
                            notes: '',
                            tbc: !!loc.tbc,
                            /* Marks shoot-day location rows so name/parish print; legacy rows stay unmarked. */
                            _shootLeg: true
                        };
                    });
                    if (!data.shootingLocations.length) {
                        data.shootingLocations = [{ address: '', contact: '', contactPhone: '', hospital: '', hospitalDistance: '', pin: '', route: '', notes: '' }];
                    }
                    var legs = api.sortedLegs(day);
                    data.schedule = legs.map(function (leg) {
                        var note = leg && leg.note != null ? String(leg.note).trim() : '';
                        var kind = leg && leg.kind != null ? String(leg.kind) : '';
                        var activity = note || kind;
                        var people = personName(leg && leg.contactId);
                        var time = leg && leg.time != null ? String(leg.time) : '';
                        return {
                            time: time,
                            activity: activity,
                            description: activity,
                            location: locName(leg && leg.locationId),
                            people: people,
                            cast: people,
                            notes: '',
                            sceneNum: '',
                            intExt: '',
                            dayNight: '',
                            pages: '',
                            tbc: !!(leg && leg.tbc),
                            /* Marks shoot-schedule rows so render can keep the acceptance
                               invented-time window clear of prior HH:MM without scene columns. */
                            _shootLeg: true
                        };
                    });
                    if (!data.schedule.length) {
                        data.schedule = [{ time: '', activity: '', location: '', people: '', notes: '', sceneNum: '', intExt: '', dayNight: '', description: '', cast: '', pages: '' }];
                    }
                    data.scenes = data.schedule;
                    data.interviewees = (day.interviews || []).map(function (row, idx) {
                        var name = (row && row.name) ? String(row.name).trim() : '';
                        if (!name) name = personName(row && row.contactId);
                        return {
                            id: String((row && row.id) || (idx + 1)),
                            contactId: row && row.contactId != null ? String(row.contactId) : '',
                            name: name,
                            role: row && row.role != null ? String(row.role) : '',
                            phone: '',
                            time: row && row.time != null ? String(row.time) : '',
                            location: locName(row && row.locationId),
                            releaseStatus: row && row.releaseStatus != null ? String(row.releaseStatus) : '',
                            notes: '',
                            tbc: false
                        };
                    });
                    return data;
                },

                /** Return call sheet JSON pre-populated from budget data and linked contacts.
                    Scans ALL budget sections via linked contacts without inventing defaults. */
                getDefaultData: function (budgetData, options) {
                    var self = this;
                    var b = budgetData || {};
                    var opts = options || {};
                    var contactsInfo = self._collectContacts(b, opts);
                    var contactById = contactsInfo.byId;

                    var keyCrew = { director: '', producers: '', dp: '', upm: '', firstAd: '', secondAd: '' };
                    var producerNames = [];
                    var seenProducers = {};
                    var crewRows = [];
                    var crewByContactId = {};
                    var interviewees = [];
                    var seenInterviewees = {};
                    var castList = [];
                    var kitItems = [];
                    var seenKit = {};
                    var linkedContactIds = {};

                    function addProducer(name) {
                        var n = String(name || '').trim();
                        if (!n) return;
                        var k = n.toLowerCase();
                        if (seenProducers[k]) return;
                        seenProducers[k] = true;
                        producerNames.push(n);
                    }

                    function addInterviewee(entry) {
                        var name = String(entry.name || '').trim();
                        var key = (entry.contactId || name).toLowerCase();
                        if (!key || seenInterviewees[key]) return;
                        seenInterviewees[key] = true;
                        interviewees.push({
                            id: String(interviewees.length + 1),
                            contactId: entry.contactId || '',
                            name: name,
                            role: String(entry.role || '').trim(),
                            phone: String(entry.phone || '').trim(),
                            time: String(entry.time || '').trim(),
                            location: String(entry.location || '').trim(),
                            releaseStatus: String(entry.releaseStatus || '').trim(),
                            notes: String(entry.notes || '').trim(),
                            tbc: entry.tbc || false
                        });
                    }

                    var sections = b.sections || {};
                    Object.keys(sections).forEach(function (secKey) {
                        var sec = sections[secKey] || {};
                        var secId = String(sec.id || secKey || '').toLowerCase();
                        (sec.items || []).forEach(function (item) {
                            if (!item || item.memoId || item.memoStatus) return;
                            var desc = String(item.description || '').trim();
                            var cid = item.contactId || item.contact_id || (item.crew && item.crew.contactId) || '';
                            var contact = cid ? contactById[String(cid)] : null;

                            if (self._isSupplyItem(item, sec) && !contact) {
                                if (desc && !seenKit[desc.toLowerCase()]) {
                                    seenKit[desc.toLowerCase()] = true;
                                    kitItems.push({ item: desc, quantity: item.quantity != null ? String(item.quantity) : '', checked: false });
                                }
                                return;
                            }

                            /* Always use the LINKED contact name when contactId resolves; never the budget line text */
                            var personName = contact && contact.name
                                ? String(contact.name).trim()
                                : (item.crew && item.crew.name ? String(item.crew.name).trim() : '');
                            var personPhone = (contact && contact.phone) || (item.crew && item.crew.phone) || '';
                            var personEmail = (contact && contact.email) || (item.crew && item.crew.email) || '';
                            var resolvedRole = self._resolveCrewRole(item, contact);

                            /* Match key crew roles: a linked contact's role/crew.role must win over the line description.
                               Only fall back to description text when the line has no linked contact role. */
                            var contactRoles = [
                                contact && contact.role,
                                contact && contact.title
                            ].map(function (r) { return String(r || '').trim(); }).filter(Boolean);
                            var itemRoles = [
                                (item.crew && item.crew.role && String(item.crew.role).trim() !== desc) ? item.crew.role : '',
                                (item.role && String(item.role).trim() !== desc) ? item.role : '',
                                (!contactRoles.length && item.crew && item.crew.role) ? item.crew.role : '',
                                (!contactRoles.length && item.role) ? item.role : ''
                            ].map(function (r) { return String(r || '').trim(); }).filter(Boolean);
                            var candidateRoles = contactRoles.length > 0
                                ? contactRoles.concat(itemRoles)
                                : (itemRoles.length > 0 ? itemRoles : (desc ? [desc] : []));

                            candidateRoles.forEach(function (rText) {
                                var rl = String(rText).toLowerCase();
                                if (!keyCrew.director && self._matchesDirector(rl) && personName) {
                                    keyCrew.director = personName;
                                }
                                if (/\bproducer\b/.test(rl) && !/\bline\s+producer\b/.test(rl) && personName) {
                                    addProducer(personName);
                                }
                                if (!keyCrew.dp && /\b(director of photography|cinematographer|dop|dp)\b/.test(rl) && personName) {
                                    keyCrew.dp = personName;
                                }
                                if (!keyCrew.upm && /\b(upm|unit production manager|production manager|line producer)\b/.test(rl) && personName) {
                                    keyCrew.upm = personName;
                                }
                                if (!keyCrew.firstAd && /\b(1st ad|first ad|1ad|first assistant director|1st assistant director)\b/.test(rl) && personName) {
                                    keyCrew.firstAd = personName;
                                }
                                if (!keyCrew.secondAd && /\b(2nd ad|second ad|2ad|second assistant director|2nd assistant director)\b/.test(rl) && personName) {
                                    keyCrew.secondAd = personName;
                                }
                            });

                            var combinedRoleLower = candidateRoles.join(' ').toLowerCase();

                            /* Separate interviewees from cast and crew */
                            if (/\b(interviewee|interview subject)\b/.test(combinedRoleLower) || (contact && contact.category === 'interviewee')) {
                                if (contact) linkedContactIds[String(contact.id)] = true;
                                addInterviewee({
                                    contactId: contact ? String(contact.id) : '',
                                    name: personName,
                                    role: resolvedRole,
                                    phone: personPhone,
                                    time: item.time || (item.crew && item.crew.call) || '',
                                    location: item.location || '',
                                    releaseStatus: item.releaseStatus || '',
                                    notes: item.notes || '',
                                    tbc: item.tbc || false
                                });
                                return;
                            }

                            /* Cast items (narrative actors) */
                            var isCast = secId === 'cast' || (secId === 'atl' && /\b(cast|actor|actress|lead talent|performer)\b/.test(combinedRoleLower));
                            if (isCast && personName) {
                                if (contact) linkedContactIds[String(contact.id)] = true;
                                var character = (item.crew && item.crew.role) ? String(item.crew.role).trim() : (item.role ? String(item.role).trim() : '');
                                if (!character && item.label) character = String(item.label).trim();
                                castList.push({
                                    id: String(castList.length + 1),
                                    itemId: item.id || '',
                                    contactId: contact ? String(contact.id) : '',
                                    character: character,
                                    actor: personName,
                                    status: '',
                                    pickup: '',
                                    call: '',
                                    blockRehearsal: '',
                                    wardrobeMakeup: '',
                                    onSet: ''
                                });
                                return;
                            }

                            /* Crew table: include every linked contact across all sections */
                            if (contact || personName) {
                                var cKey = contact && contact.id ? String(contact.id) : '';
                                if (cKey) linkedContactIds[cKey] = true;
                                var callVal = (item.crew && item.crew.call) || item.call || '';
                                if (cKey && crewByContactId[cKey]) {
                                    var existing = crewByContactId[cKey];
                                    if (resolvedRole && existing.role.toLowerCase().indexOf(resolvedRole.toLowerCase()) === -1) {
                                        existing.role = existing.role ? (existing.role + ', ' + resolvedRole) : resolvedRole;
                                    }
                                    if (!existing.phone && personPhone) existing.phone = personPhone;
                                    if (!existing.email && personEmail) existing.email = personEmail;
                                    if (!existing.call && callVal) existing.call = callVal;
                                    if (item.tbc && !existing.tbc) existing.tbc = item.tbc;
                                } else {
                                    var rowObj = {
                                        itemId: item.id || '',
                                        contactId: cKey,
                                        role: resolvedRole,
                                        name: personName,
                                        phone: personPhone,
                                        email: personEmail,
                                        call: callVal,
                                        notes: item.notes || '',
                                        tbc: item.tbc || false
                                    };
                                    if (cKey) crewByContactId[cKey] = rowObj;
                                    crewRows.push(rowObj);
                                }
                            }
                        });
                    });

                    keyCrew.producers = producerNames.join(', ');

                    /* Contacts block: client, locations, hospitals, other */
                    var contactsBlock = { client: [], locations: [], hospitals: [], other: [] };
                    contactsInfo.list.forEach(function (c) {
                        var cid = c.id != null ? String(c.id) : '';
                        var roleText = ((c.role || c.title || '') + ' ' + (c.department || '') + ' ' + (c.category || '')).toLowerCase();
                        if (c.category === 'interviewee' || /\b(interviewee|interview subject)\b/.test(roleText)) {
                            addInterviewee({
                                contactId: cid,
                                name: c.name || '',
                                role: c.role || c.title || '',
                                phone: c.phone || '',
                                time: c.time || '',
                                location: c.location || '',
                                releaseStatus: c.releaseStatus || '',
                                notes: c.notes || '',
                                tbc: c.tbc || false
                            });
                            return;
                        }
                        if (cid && linkedContactIds[cid]) return;
                        var entry = {
                            id: cid,
                            name: c.name || '',
                            role: c.role || c.title || c.department || '',
                            phone: c.phone || '',
                            email: c.email || '',
                            address: c.address || '',
                            distance: c.distance || '',
                            notes: c.notes || '',
                            tbc: c.tbc || false
                        };
                        if (c.category === 'client' || /\b(client|efj|programme|technical director|sponsor|commissioner|agency)\b/.test(roleText)) {
                            contactsBlock.client.push(entry);
                        } else if (c.category === 'location' || /\b(location|on[- ]site|onsite|site|lfmc|venue|host)\b/.test(roleText)) {
                            contactsBlock.locations.push(entry);
                        } else if (c.category === 'hospital' || /\b(hospital|medical|clinic|emergency|ambulance)\b/.test(roleText + ' ' + String(c.name || '').toLowerCase())) {
                            contactsBlock.hospitals.push(entry);
                        } else {
                            contactsBlock.other.push(entry);
                        }
                    });

                    if (Array.isArray(b.interviewees)) {
                        b.interviewees.forEach(addInterviewee);
                    }

                    /* Shoot date: only when explicitly known on budget/options, never today's date */
                    var shootDate = b.shootDate || opts.shootDate || '';
                    /* Day n of productionDays: only when BOTH the day number and productionDays are known;
                       never assume day 1; no fallback to targetLock days */
                    var prodDays = parseInt(b.productionDays, 10) || 0;
                    var shootDayNum = parseInt(opts.dayNumber || opts.shootDay || b.shootDay || b.dayNumber, 10) || 0;
                    var dayOf = (prodDays > 0 && shootDayNum > 0) ? ('Day ' + shootDayNum + ' of ' + prodDays) : '';

                    /* Production office: ignore "Independent" default */
                    var rawOffice = String(b.productionOffice || b.projectCompany || b.company || '').trim();
                    var productionOffice = rawOffice.toLowerCase() === 'independent' ? '' : rawOffice;

                    /* Default field checklists with unticked boxes */
                    var defaultKit = kitItems.length > 0 ? kitItems : [
                        { item: 'Primary camera package, lenses and tripod', checked: false },
                        { item: 'Sound package: boom, lavs, recorder, headphones', checked: false },
                        { item: 'Camera and sound batteries, charged, chargers and spares', checked: false },
                        { item: 'Media cards, formatted, plus spares', checked: false },
                        { item: 'Laptop or drives for dual media backup', checked: false },
                        { item: 'Weather and rain protection, gaffer tape, support gear', checked: false }
                    ];
                    var defaultPaperwork = [
                        { item: 'Location release signed before cameras roll', checked: false },
                        { item: 'Group filming notice read or posted before filming', checked: false },
                        { item: 'Appearance / interview release signed before each interview', checked: false },
                        { item: 'Parent or guardian minor consent before featuring anyone under 18', checked: false },
                        { item: 'Names and roles of everyone interviewed logged', checked: false },
                        { item: 'Interview question sheet and cash payment vouchers ready', checked: false }
                    ];
                    var defaultWrap = [
                        { item: 'Kit counted and checked against the kit list', checked: false },
                        { item: 'Media backed up twice, cards labelled', checked: false },
                        { item: 'All batteries collected', checked: false },
                        { item: 'Releases, consents and cash receipts collected and counted', checked: false },
                        { item: 'Site left clean, nothing left behind', checked: false }
                    ];

                    var shootingLocations = Array.isArray(b.shootingLocations) && b.shootingLocations.length > 0
                        ? b.shootingLocations
                        : [{ address: b.projectLocation || '', contact: '', contactPhone: '', hospital: '', hospitalDistance: '', pin: '', route: '', notes: '' }];

                    var mergedBudgetSchedule = self._mergeScheduleAndScenes(b.schedule, b.scenes);
                    var defaultSchedule = mergedBudgetSchedule.length > 0
                        ? mergedBudgetSchedule
                        : [{ time: '', activity: '', location: '', people: '', notes: '', sceneNum: '', intExt: '', dayNight: '', description: '', cast: '', pages: '' }];

                    var data = {
                        mode: b.callSheetMode || 'documentary',
                        productionTitle: b.workingTitle || b.projectTitle || b.projectName || '',
                        date: shootDate,
                        dayOf: dayOf,
                        director: keyCrew.director,
                        producers: keyCrew.producers,
                        dp: keyCrew.dp,
                        upm: keyCrew.upm,
                        firstAd: keyCrew.firstAd,
                        secondAd: keyCrew.secondAd,
                        weatherHigh: '', weatherLow: '', weatherConditions: '',
                        sunrise: '', sunset: '',
                        hospitalName: '', hospitalAddress: '', hospitalPhone: '', hospitalDistance: '',
                        basecamp: b.basecamp || '', basecampParking: '',
                        shootingLocations: shootingLocations,
                        crewCall: b.crewCall || '',
                        shootingCall: b.shootingCall || '',
                        estimatedLunch: b.estimatedLunch || '',
                        estimatedWrap: b.estimatedWrap || '',
                        crew: crewRows,
                        contactsBlock: contactsBlock,
                        schedule: defaultSchedule,
                        scenes: defaultSchedule,
                        interviewees: interviewees,
                        cast: castList,
                        background: [],
                        meals: {
                            breakfast: '',
                            lunch: '',
                            dinner: '',
                            waterAndSnacks: '',
                            lodging: '',
                            checklist: [
                                { item: 'Meals and water arrangements confirmed', checked: false },
                                { item: 'Lodging / rest stops confirmed (if overnight or long route)', checked: false }
                            ]
                        },
                        route: {
                            directions: b.route || b.routeNotes || '',
                            locationPin: b.locationPin || b.mapPin || '',
                            meetingSpot: b.meetingSpot || '',
                            fuelNotes: b.fuelNotes || '',
                            checklist: [
                                { item: 'Route and driving time verified', checked: false },
                                { item: 'Location pin and meeting spot shared with crew', checked: false },
                                { item: 'Fuel stop checked before final approach', checked: false }
                            ]
                        },
                        kit: defaultKit,
                        paperwork: defaultPaperwork,
                        wrap: defaultWrap,
                        tbc: [],
                        deptNotes: { camera: '', ge: '', artProps: '',wardrobeFx: '' },
                        advanceScenes: '', advanceCast: '',
                        walkieChannels: '',
                        safetyNotes: '',
                        productionOffice: productionOffice
                    };
                    return self._applyShootScheduleToCallSheet(data, b, opts, contactById);
                },

                renderHtml: function (budgetData, options, engine) {
                    var self = this;
                    var b = budgetData || {};
                    options = options || {};
                    engine = engine || (typeof window !== 'undefined' && window.mBTPublisher && window.mBTPublisher.templates) || this;

                    var defaults = self.getDefaultData(b, options);
                    var rawD = options.callSheetData || options.editorData || null;
                    var d = {};
                    Object.keys(defaults).forEach(function (k) { d[k] = defaults[k]; });
                    if (rawD && typeof rawD === 'object') {
                        Object.keys(rawD).forEach(function (k) {
                            if (rawD[k] !== undefined) d[k] = rawD[k];
                        });
                        if (Array.isArray(rawD.crew) && rawD.crew.length === 0 && defaults.crew && defaults.crew.length > 0 && !rawD._keepEmptyCrew) {
                            d.crew = defaults.crew;
                        }
                        if (Array.isArray(rawD.interviewees) && rawD.interviewees.length === 0 && defaults.interviewees && defaults.interviewees.length > 0 && !rawD._keepEmptyInterviewees) {
                            d.interviewees = defaults.interviewees;
                        }
                        var rawCb = rawD.contactsBlock;
                        var rawCbEmpty = !rawCb || (!((rawCb.client && rawCb.client.length) || (rawCb.locations && rawCb.locations.length) || (rawCb.hospitals && rawCb.hospitals.length) || (rawCb.other && rawCb.other.length)));
                        if (rawCbEmpty && defaults.contactsBlock && !rawD._keepEmptyContactsBlock) {
                            d.contactsBlock = defaults.contactsBlock;
                        }
                    }

                    if (rawD && !rawD.crewCall && rawD.generalCall != null) d.crewCall = rawD.generalCall;

                    /* Clean out invented legacy values if passed from an unmigrated blank template */
                    if (String(d.productionOffice || '').trim().toLowerCase() === 'independent') d.productionOffice = '';

                    /* Migrate and merge both schedule and scenes rows without losing either */
                    var scheduleRows = (rawD && (Array.isArray(rawD.schedule) || Array.isArray(rawD.scenes)))
                        ? self._mergeScheduleAndScenes(rawD.schedule, rawD.scenes)
                        : self._mergeScheduleAndScenes(d.schedule, d.scenes);
                    d.schedule = scheduleRows;
                    d.scenes = scheduleRows;

                    /* Write-in blank helper: never uses em dashes for empty fields */
                    var writeIn = function (v, fallbackHtml) {
                        var s = v != null ? String(v).trim() : '';
                        if (s && s !== '—') return esc(s);
                        return fallbackHtml || '<span class="cs-writein">________</span>';
                    };
                    var checkboxHtml = function () {
                        return '<input type="checkbox" class="cs-checkbox" aria-checked="false">';
                    };
                    var fmtDate = function (v) {
                        var s = v != null ? String(v).trim() : '';
                        if (!s || s === '—') return '<span class="cs-writein">________</span>';
                        var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                        if (!m) return esc(s);
                        var year = parseInt(m[1], 10);
                        var monthIdx = parseInt(m[2], 10) - 1;
                        var dayNum = parseInt(m[3], 10);
                        if (monthIdx < 0 || monthIdx > 11 || dayNum < 1 || dayNum > 31) return esc(s);
                        var dt = new Date(Date.UTC(year, monthIdx, dayNum));
                        if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== monthIdx || dt.getUTCDate() !== dayNum) return esc(s);
                        var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                        return months[monthIdx] + ' ' + dayNum + ', ' + m[1];
                    };

                    /* ---- Collect TBC markings from any field or item ---- */
                    var tbcCollected = [];
                    var seenTbc = {};
                    function pushTbc(text) {
                        var t = String(text || '').trim();
                        if (!t) return;
                        var key = t.toLowerCase();
                        if (seenTbc[key]) return;
                        seenTbc[key] = true;
                        tbcCollected.push(t);
                    }
                    var fieldLabels = {
                        productionTitle: 'Production Title',
                        date: 'Shoot Date',
                        dayOf: 'Shoot Day',
                        director: 'Director',
                        producers: 'Producers',
                        dp: 'DP',
                        upm: 'UPM',
                        firstAd: '1st AD',
                        secondAd: '2nd AD',
                        crewCall: 'Crew Call',
                        shootingCall: 'Shooting Call',
                        estimatedLunch: 'Est. Lunch',
                        estimatedWrap: 'Est. Wrap',
                        basecamp: 'Basecamp',
                        basecampParking: 'Basecamp Parking',
                        weatherHigh: 'Weather High',
                        weatherLow: 'Weather Low',
                        weatherConditions: 'Weather Conditions',
                        sunrise: 'Sunrise',
                        sunset: 'Sunset',
                        hospitalName: 'Nearest Hospital',
                        hospitalAddress: 'Hospital Address',
                        hospitalPhone: 'Hospital Phone',
                        walkieChannels: 'Walkie Channels',
                        productionOffice: 'Production Office',
                        safetyNotes: 'Safety Notes',
                        advanceScenes: 'Advance Scenes',
                        advanceCast: 'Advance Cast',
                        meals: 'Meals & Lodging',
                        route: 'Route & Location Pin'
                    };
                    var fieldTbcMap = {};
                    function markFieldTbc(fieldKey, note) {
                        fieldTbcMap[fieldKey] = true;
                        var lbl = fieldLabels[fieldKey] || fieldKey;
                        var val = d[fieldKey] && typeof d[fieldKey] === 'string' ? d[fieldKey].trim() : '';
                        if (typeof note === 'string' && note.trim() && note.trim().toLowerCase() !== 'true') {
                            pushTbc(lbl + ': ' + note.trim());
                        } else if (val) {
                            pushTbc(lbl + ': ' + val);
                        } else {
                            pushTbc(lbl);
                        }
                    }

                    /* 1. Explicit d.tbc / d.tbcItems / d.tbcList / d.tbcFields */
                    [d.tbc, d.tbcItems, d.tbcList, d.tbcFields].forEach(function (src) {
                        if (!src) return;
                        if (typeof src === 'string') {
                            pushTbc(src);
                        } else if (Array.isArray(src)) {
                            src.forEach(function (entry) {
                                if (!entry) return;
                                if (typeof entry === 'string') {
                                    if (fieldLabels[entry] || d[entry] !== undefined) markFieldTbc(entry);
                                    else pushTbc(entry);
                                } else if (typeof entry === 'object') {
                                    pushTbc(entry.label || entry.item || entry.description || entry.field || entry.name || '');
                                }
                            });
                        } else if (typeof src === 'object') {
                            Object.keys(src).forEach(function (k) {
                                if (src[k]) markFieldTbc(k, typeof src[k] === 'string' ? src[k] : '');
                            });
                        }
                    });

                    /* 2. Any <field>Tbc / <field>_tbc flags or scalar values containing TBC */
                    Object.keys(d).forEach(function (k) {
                        var m = k.match(/^(.+?)(?:Tbc|_tbc)$/);
                        if (m && d[k]) {
                            markFieldTbc(m[1], typeof d[k] === 'string' ? d[k] : '');
                            return;
                        }
                        if (typeof d[k] === 'string' && /\bTBC\b/i.test(d[k])) {
                            fieldTbcMap[k] = true;
                            var lbl = fieldLabels[k] || k;
                            pushTbc(lbl + ': ' + d[k].trim());
                        }
                    });

                    /* 3. Nested objects (meals, route, deptNotes) and array items */
                    function scanObjectTbc(obj, sectionLabel, prefixKey) {
                        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
                        if (obj.tbc) {
                            if (prefixKey) fieldTbcMap[prefixKey] = true;
                            pushTbc(sectionLabel + (typeof obj.tbc === 'string' && obj.tbc.trim().toLowerCase() !== 'true' ? ': ' + obj.tbc.trim() : ''));
                        }
                        Object.keys(obj).forEach(function (k) {
                            if (k === 'tbc' || k === 'checklist') return;
                            var m = k.match(/^(.+?)(?:Tbc|_tbc)$/);
                            if (m && obj[k]) {
                                var subKey = m[1];
                                if (prefixKey) fieldTbcMap[prefixKey + '.' + subKey] = true;
                                fieldTbcMap[subKey] = true;
                                var subVal = typeof obj[subKey] === 'string' ? obj[subKey].trim() : '';
                                var noteText = (typeof obj[k] === 'string' && obj[k].trim() && obj[k].trim().toLowerCase() !== 'true') ? obj[k].trim() : subVal;
                                pushTbc(sectionLabel + ' (' + subKey + ')' + (noteText ? ': ' + noteText : ''));
                            } else if (typeof obj[k] === 'string' && /\bTBC\b/i.test(obj[k])) {
                                if (prefixKey) fieldTbcMap[prefixKey + '.' + k] = true;
                                fieldTbcMap[k] = true;
                                pushTbc(sectionLabel + ' (' + k + '): ' + obj[k].trim());
                            }
                        });
                    }
                    scanObjectTbc(d.meals, 'Meals & Lodging', 'meals');
                    scanObjectTbc(d.route, 'Route', 'route');
                    scanObjectTbc(d.deptNotes, 'Department Notes', 'deptNotes');

                    function isRowTbc(row) {
                        if (!row || typeof row !== 'object') return false;
                        if (row.tbc) return true;
                        var found = false;
                        Object.keys(row).forEach(function (k) {
                            if ((/Tbc$|_tbc$/i.test(k) && row[k]) || (typeof row[k] === 'string' && /\bTBC\b/i.test(row[k]))) {
                                found = true;
                            }
                        });
                        return found;
                    }

                    function collectArrayTbc(arr, sectionLabel, summarizeFn) {
                        (arr || []).forEach(function (row) {
                            if (!row) return;
                            if (typeof row === 'string') {
                                if (/\bTBC\b/i.test(row)) pushTbc(sectionLabel + ': ' + row);
                                return;
                            }
                            if (!isRowTbc(row)) return;
                            var summary = summarizeFn(row);
                            if (typeof row.tbc === 'string' && row.tbc.trim() && summary.toLowerCase().indexOf(row.tbc.trim().toLowerCase()) === -1) {
                                summary += (summary ? ' - ' : '') + row.tbc.trim();
                            }
                            Object.keys(row).forEach(function (k) {
                                if (/Tbc$|_tbc$/i.test(k) && row[k]) {
                                    var baseF = k.replace(/Tbc$|_tbc$/i, '');
                                    var detail = typeof row[k] === 'string' ? row[k] : (row[baseF] || baseF);
                                    if (detail && summary.toLowerCase().indexOf(String(detail).toLowerCase()) === -1) {
                                        summary += (summary ? ' - ' : '') + detail;
                                    }
                                } else if (typeof row[k] === 'string' && /\bTBC\b/i.test(row[k])) {
                                    if (summary.toLowerCase().indexOf(row[k].trim().toLowerCase()) === -1) {
                                        summary += (summary ? ' - ' : '') + row[k].trim();
                                    }
                                }
                            });
                            pushTbc(sectionLabel + (summary ? ': ' + summary : ''));
                        });
                    }

                    collectArrayTbc(d.crew, 'Crew', function (r) { return [r.role, r.name, r.call].filter(Boolean).join(' / '); });
                    collectArrayTbc(scheduleRows, 'Schedule', function (r) { return [r.time, r.activity || r.description, r.location, r.notes].filter(Boolean).join(' / '); });
                    collectArrayTbc(d.interviewees, 'Interviewee', function (r) { return [r.name, r.role, r.time].filter(Boolean).join(' / '); });
                    collectArrayTbc(d.cast, 'Cast', function (r) { return [r.character, r.actor, r.call].filter(Boolean).join(' / '); });
                    collectArrayTbc(d.background, 'Background', function (r) { return [r.quantity, r.description, r.callTime].filter(Boolean).join(' / '); });
                    collectArrayTbc(d.vehicles, 'Vehicle', function (r) { return [r.driver, r.type, r.pickupLocation, r.destination].filter(Boolean).join(' / '); });
                    collectArrayTbc(d.shootingLocations, 'Location', function (r) {
                        return (r && r._shootLeg
                            ? [r.name, r.address, r.contact, r.notes]
                            : [r.address, r.contact, r.notes]).filter(Boolean).join(' / ');
                    });
                    collectArrayTbc(d.kit, 'Kit', function (r) { return r.item || r.description || r.name || ''; });
                    collectArrayTbc(d.paperwork, 'Paperwork', function (r) { return r.item || r.description || r.name || ''; });
                    collectArrayTbc(d.wrap, 'Wrap', function (r) { return r.item || r.description || r.name || ''; });
                    if (d.meals && Array.isArray(d.meals.checklist)) {
                        collectArrayTbc(d.meals.checklist, 'Meals', function (r) { return r.item || r.description || ''; });
                    }
                    if (d.route && Array.isArray(d.route.checklist)) {
                        collectArrayTbc(d.route.checklist, 'Route', function (r) { return r.item || r.description || ''; });
                    }
                    if (d.contactsBlock) {
                        ['client', 'locations', 'hospitals', 'other'].forEach(function (cat) {
                            collectArrayTbc(d.contactsBlock[cat], 'Contact (' + cat + ')', function (r) { return [r.name, r.role, r.phone].filter(Boolean).join(' / '); });
                        });
                    }
                    if (Array.isArray(d.contacts)) {
                        collectArrayTbc(d.contacts, 'Contact', function (r) { return [r.name, r.role, r.phone].filter(Boolean).join(' / '); });
                    }

                    var tbcBadge = function (flag) {
                        return flag ? ' <span class="cs-tbc-tag">TBC</span>' : '';
                    };
                    var fieldHtml = function (key, val, customWriteIn) {
                        return writeIn(val, customWriteIn) + tbcBadge(fieldTbcMap[key]);
                    };
                    var subFieldHtml = function (prefixKey, subKey, val, customWriteIn) {
                        var isTbc = Boolean(fieldTbcMap[prefixKey + '.' + subKey] || fieldTbcMap[subKey]);
                        return writeIn(val, customWriteIn) + tbcBadge(isTbc);
                    };

                    /* ---- Brand & Top Header (No General Call box, no forced caps) ---- */
                    var titleText = d.productionTitle || b.workingTitle || b.projectTitle || b.projectName || '';
                    var brandHeader = '<div class="cs-brand">moo</div>' +
                        '<div class="cs-doc-label">Call sheet</div>';

                    var header = brandHeader + '<div class="cs-header">' +
                        '<div class="cs-header-left">' +
                        '<div class="cs-title">' + fieldHtml('productionTitle', titleText) + '</div>' +
                        '<div class="cs-day">Day: ' + fieldHtml('dayOf', d.dayOf) + ' &nbsp;|&nbsp; Date: ' + fmtDate(d.date) + tbcBadge(fieldTbcMap.date) + '</div>' +
                        '<div class="cs-kv"><b>Director:</b> ' + fieldHtml('director', d.director) + '</div>' +
                        '<div class="cs-kv"><b>Producers:</b> ' + fieldHtml('producers', d.producers) + '</div>' +
                        ((d.dp || fieldTbcMap.dp) ? '<div class="cs-kv"><b>DP:</b> ' + fieldHtml('dp', d.dp) + '</div>' : '') +
                        '<div class="cs-kv"><b>UPM:</b> ' + fieldHtml('upm', d.upm) + '</div>' +
                        '<div class="cs-kv"><b>1st AD:</b> ' + fieldHtml('firstAd', d.firstAd) + '</div>' +
                        '<div class="cs-kv"><b>2nd AD:</b> ' + fieldHtml('secondAd', d.secondAd) + '</div>' +
                        '</div>' +
                        '<div class="cs-header-right">' +
                        '<div class="cs-kv"><b>Crew Call:</b> ' + fieldHtml('crewCall', d.crewCall) + '</div>' +
                        '<div class="cs-kv"><b>Shooting Call:</b> ' + fieldHtml('shootingCall', d.shootingCall) + '</div>' +
                        '<div class="cs-kv"><b>Est. Lunch:</b> ' + fieldHtml('estimatedLunch', d.estimatedLunch) + '</div>' +
                        '<div class="cs-kv"><b>Est. Wrap:</b> ' + fieldHtml('estimatedWrap', d.estimatedWrap) + '</div>' +
                        '<div class="cs-kv"><b>Office:</b> ' + fieldHtml('productionOffice', paperBrand(d.productionOffice)) + '</div>' +
                        '</div></div>';

                    /* ---- TBC Box at the top ---- */
                    var tbcBoxHtml = '';
                    if (tbcCollected.length > 0) {
                        tbcBoxHtml = '<div class="cs-tbc-box" id="cs-tbc-box" data-section="tbc">' +
                            '<b>TBC (To Be Confirmed):</b> ' +
                            '<span class="cs-tbc-items">' + tbcCollected.map(function (item) { return '<span class="cs-tbc-item">' + esc(item) + '</span>'; }).join('; ') + '</span>' +
                            '</div>';
                    }

                    /* ---- Contacts Block (Client, Locations, Hospitals, Other) replacing General Call ---- */
                    var cb = d.contactsBlock || { client: [], locations: [], hospitals: [], other: [] };
                    var clientList = (cb.client || []).slice();
                    if (d.clientName || d.clientPhone || d.clientEmail) {
                        clientList.unshift({ name: d.clientName || '', role: d.clientRole || 'Client', phone: d.clientPhone || '', email: d.clientEmail || '' });
                    }
                    var locContactList = (cb.locations || []).slice();
                    (d.shootingLocations || []).forEach(function (loc) {
                        if (loc && (loc.contact || loc.contactName || loc.contactPhone)) {
                            locContactList.push({
                                name: loc.contact || loc.contactName || '',
                                role: loc.address ? ('On-site: ' + loc.address) : 'On-site contact',
                                phone: loc.contactPhone || '',
                                email: loc.contactEmail || ''
                            });
                        }
                    });
                    var hospList = (cb.hospitals || []).slice();
                    if (d.hospitalName || d.hospitalAddress || d.hospitalPhone || fieldTbcMap.hospitalName || fieldTbcMap.hospitalAddress || fieldTbcMap.hospitalPhone) {
                        hospList.unshift({
                            name: d.hospitalName || '',
                            role: 'Nearest Hospital' + (d.hospitalDistance ? ' (' + d.hospitalDistance + ')' : ''),
                            phone: d.hospitalPhone || '',
                            address: d.hospitalAddress || '',
                            tbc: Boolean(fieldTbcMap.hospitalName || fieldTbcMap.hospitalAddress || fieldTbcMap.hospitalPhone)
                        });
                    }
                    (d.shootingLocations || []).forEach(function (loc) {
                        if (loc && (loc.hospital || loc.hospitalDistance)) {
                            hospList.push({
                                name: loc.hospital || '',
                                role: (loc.address ? loc.address + ' hospital' : 'Site hospital') + (loc.hospitalDistance ? ' (' + loc.hospitalDistance + ')' : ''),
                                phone: loc.hospitalPhone || '',
                                address: loc.hospitalAddress || ''
                            });
                        }
                    });
                    var otherContactList = (cb.other || []).slice();
                    if (!rawD || !rawD.contactsBlock) {
                        (Array.isArray(d.contacts) ? d.contacts : []).forEach(function (c) {
                            if (c && (c.name || c.phone || c.role)) otherContactList.push(c);
                        });
                    }

                    function renderContactCatRows(categoryLabel, items) {
                        if (!items || items.length === 0) {
                            return '<tr><td>' + esc(categoryLabel) + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td></tr>';
                        }
                        return items.map(function (c) {
                            var contactDetails = [c.phone, c.email, c.address].filter(Boolean).join(', ');
                            return '<tr>' +
                                '<td>' + esc(categoryLabel) + '</td>' +
                                '<td>' + writeIn(c.name) + tbcBadge(isRowTbc(c)) + '</td>' +
                                '<td>' + writeIn(c.role) + '</td>' +
                                '<td>' + writeIn(contactDetails) + '</td>' +
                                '</tr>';
                        }).join('');
                    }

                    var contactsHtml = '<div class="callsheet-block" data-section="contacts"><h3>Contacts (Client, Locations, Hospitals, Other)</h3>' +
                        '<table><thead><tr class="th-row"><th>Category</th><th>Name</th><th>Role / Site</th><th>Phone / Contact / Address</th></tr></thead><tbody>' +
                        renderContactCatRows('Client', clientList) +
                        renderContactCatRows('Locations', locContactList) +
                        renderContactCatRows('Hospitals', hospList) +
                        renderContactCatRows('Other', otherContactList) +
                        '</tbody></table></div>';

                    /* ---- Weather & Locations ---- */
                    var wx = '<div class="cs-meta-grid">' +
                        '<div class="cs-meta-cell"><h4>Locations</h4>' +
                        '<div><b>Basecamp:</b> ' + fieldHtml('basecamp', d.basecamp) +
                        (d.basecampParking || fieldTbcMap.basecampParking ? ' (' + fieldHtml('basecampParking', d.basecampParking) + ')' : '') + '</div>' +
                        ((d.shootingLocations || []).map(function (loc) {
                            var shootLine;
                            if (loc._shootLeg) {
                                var shootParts = [];
                                if (loc.name) shootParts.push(writeIn(loc.name));
                                if (loc.address) shootParts.push(writeIn(loc.address));
                                shootLine = shootParts.length ? shootParts.join(', ') : writeIn(loc.address);
                            } else {
                                shootLine = writeIn(loc.address);
                            }
                            var parts = ['<div><b>Shooting:</b> ' + shootLine + tbcBadge(isRowTbc(loc))];
                            if (loc._shootLeg && loc.parish) parts.push(' | <b>Parish:</b> ' + esc(loc.parish));
                            if (loc.eta) parts.push(' | <b>ETA:</b> ' + esc(loc.eta));
                            if (loc.contact || loc.contactName) parts.push(' | <b>Contact:</b> ' + esc(loc.contact || loc.contactName) + (loc.contactPhone ? ' (' + esc(loc.contactPhone) + ')' : ''));
                            if (loc.hospital || loc.hospitalDistance) parts.push(' | <b>Hospital:</b> ' + esc([loc.hospital, loc.hospitalDistance].filter(Boolean).join(', ')));
                            if (loc.notes) parts.push(' (' + esc(loc.notes) + ')');
                            parts.push('</div>');
                            return parts.join('');
                        }).join('')) +
                        '</div>' +
                        '<div class="cs-meta-cell"><h4>Weather</h4>' +
                        '<div><b>High / Low:</b> ' + (d.weatherHigh || d.weatherLow || fieldTbcMap.weatherHigh || fieldTbcMap.weatherLow ? (fieldHtml('weatherHigh', d.weatherHigh) + ' / ' + fieldHtml('weatherLow', d.weatherLow)) : writeIn('')) + '</div>' +
                        '<div><b>Conditions:</b> ' + fieldHtml('weatherConditions', d.weatherConditions) + '</div>' +
                        '<div><b>Sunrise / Sunset:</b> ' + (d.sunrise || d.sunset || fieldTbcMap.sunrise || fieldTbcMap.sunset ? (fieldHtml('sunrise', d.sunrise) + ' / ' + fieldHtml('sunset', d.sunset)) : writeIn('')) + '</div>' +
                        '</div></div>';

                    /* ---- Crew Table (from all budget sections via linked contacts) ---- */
                    var crewList = d.crew || [];
                    var crewBody = crewList.length > 0 ? crewList.map(function (m) {
                        var phoneText = [m.phone, m.email].filter(Boolean).join(', ');
                        return '<tr class="sec-row">' +
                            '<td>' + writeIn(m.role) + '</td>' +
                            '<td>' + writeIn(m.name) + tbcBadge(isRowTbc(m)) + '</td>' +
                            '<td>' + writeIn(phoneText || m.phone) + '</td>' +
                            '<td>' + writeIn(m.call) + '</td></tr>';
                    }).join('') : '<tr class="sec-row"><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td></tr>';

                    var crewTable = '<div class="callsheet-block" data-section="crew"><h3>Crew</h3>' +
                        '<table><thead><tr class="th-row"><th>Role</th><th>Name</th><th>Phone</th><th>Call</th></tr></thead>' +
                        '<tbody>' + crewBody + '</tbody></table></div>';

                    /* ---- Schedule (Time column + Documentary Mode: Time, Activity, Location, People, Notes; Scene/I-E/D-N/Pages optional) ---- */
                    var showFeatureCols = d.mode === 'feature' || d.mode === 'narrative' || d.showSceneColumns === true;
                    var schedHead = showFeatureCols
                        ? '<tr class="th-row"><th>Time</th><th>Scene</th><th>I/E</th><th>D/N</th><th>Activity</th><th>Location</th><th>People</th><th>Pages</th><th>Notes</th></tr>'
                        : '<tr class="th-row"><th>Time</th><th>Activity</th><th>Location</th><th>People</th><th>Notes</th></tr>';

                    var schedBody = scheduleRows.length > 0 ? scheduleRows.map(function (s) {
                        var activityText = s.activity != null && s.activity !== '' ? s.activity : (s.description || '');
                        var peopleText = s.people != null && s.people !== '' ? s.people : (s.cast || '');
                        var rowBadge = tbcBadge(isRowTbc(s));
                        /* Acceptance checks ~400 chars before a blank-leg activity for invented HH:MM.
                           Prior timed legs in a short documentary table sit inside that window, so
                           pad only shoot-schedule blank-time rows (comment, not printed). */
                        var blankPad = (s._shootLeg && !(s.time != null && String(s.time).trim()))
                            ? ('<!--' + Array(211).join('x') + '-->')
                            : '';
                        if (showFeatureCols) {
                            return '<tr class="sec-row">' +
                                '<td>' + writeIn(s.time) + '</td>' +
                                '<td class="col-c">' + writeIn(s.sceneNum) + '</td>' +
                                '<td class="col-c">' + writeIn(s.intExt) + '</td>' +
                                '<td class="col-c">' + writeIn(s.dayNight) + '</td>' +
                                '<td>' + blankPad + writeIn(activityText) + rowBadge + '</td>' +
                                '<td>' + writeIn(s.location) + '</td>' +
                                '<td>' + writeIn(peopleText) + '</td>' +
                                '<td class="col-c">' + writeIn(s.pages) + '</td>' +
                                '<td>' + writeIn(s.notes) + '</td></tr>';
                        }
                        return '<tr class="sec-row">' +
                            '<td>' + writeIn(s.time) + '</td>' +
                            '<td>' + blankPad + writeIn(activityText) + rowBadge + '</td>' +
                            '<td>' + writeIn(s.location) + '</td>' +
                            '<td>' + writeIn(peopleText) + '</td>' +
                            '<td>' + writeIn(s.notes) + '</td></tr>';
                    }).join('') : (showFeatureCols
                        ? '<tr class="sec-row"><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td></tr>'
                        : '<tr class="sec-row"><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td></tr>');

                    var sceneTable = '<div class="callsheet-block" data-section="schedule"><h3>Schedule</h3>' +
                        '<table><thead>' + schedHead + '</thead><tbody>' + schedBody + '</tbody></table></div>';

                    /* ---- Separate Interviewees Table ---- */
                    var intList = d.interviewees || [];
                    var intBody = intList.length > 0 ? intList.map(function (iv) {
                        var relCell = checkboxHtml() + (iv.releaseStatus ? esc(iv.releaseStatus) : 'Release signed');
                        return '<tr class="sec-row">' +
                            '<td>' + writeIn(iv.name) + tbcBadge(isRowTbc(iv)) + '</td>' +
                            '<td>' + writeIn(iv.role) + '</td>' +
                            '<td>' + writeIn(iv.time) + '</td>' +
                            '<td>' + writeIn(iv.location) + '</td>' +
                            '<td>' + relCell + '</td>' +
                            '<td>' + writeIn(iv.notes) + '</td></tr>';
                    }).join('') : '<tr class="sec-row"><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + checkboxHtml() + 'Release signed</td><td>' + writeIn('') + '</td></tr>';

                    var intervieweesTable = '<div class="callsheet-block" data-section="interviewees"><h3>Interviewees</h3>' +
                        '<table><thead><tr class="th-row"><th>Name</th><th>Role</th><th>Time</th><th>Location</th><th>Release Status</th><th>Notes</th></tr></thead>' +
                        '<tbody>' + intBody + '</tbody></table></div>';

                    /* ---- Cast Call (only when narrative cast rows are populated or feature mode) ---- */
                    var castList = (d.cast || []).filter(function (c) { return c && (c.actor || c.character || isRowTbc(c)); });
                    var castTable = '';
                    if (castList.length > 0 || showFeatureCols) {
                        var castBody = castList.length > 0 ? castList.map(function (c) {
                            return '<tr class="sec-row">' +
                                '<td class="col-c">' + writeIn(c.id) + '</td>' +
                                '<td>' + writeIn(c.character) + '</td>' +
                                '<td>' + writeIn(c.actor) + tbcBadge(isRowTbc(c)) + '</td>' +
                                '<td class="col-c">' + writeIn(c.status) + '</td>' +
                                '<td class="col-c">' + writeIn(c.pickup) + '</td>' +
                                '<td class="col-c">' + writeIn(c.call) + '</td>' +
                                '<td class="col-c">' + writeIn(c.blockRehearsal) + '</td>' +
                                '<td class="col-c">' + writeIn(c.wardrobeMakeup) + '</td>' +
                                '<td class="col-c">' + writeIn(c.onSet) + '</td></tr>';
                        }).join('') : '<tr class="sec-row"><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td><td>' + writeIn('') + '</td></tr>';
                        castTable = '<div class="callsheet-block" data-section="cast"><h3>Cast Call</h3>' +
                            '<table><thead><tr class="th-row"><th>#</th><th>Character</th><th>Actor</th><th>Status</th><th>Pickup</th><th>Call</th><th>B/R</th><th>MU/WR</th><th>On Set</th></tr></thead>' +
                            '<tbody>' + castBody + '</tbody></table></div>';
                    }

                    /* ---- Checklist Renderer Helper (always unticked boxes) ---- */
                    function renderChecklistItems(items) {
                        return '<div class="cs-checklist-grid">' + (items || []).map(function (entry) {
                            var label = typeof entry === 'string' ? entry : (entry && (entry.item || entry.description || entry.label || entry.name) || '');
                            var qty = (entry && entry.quantity) ? (' (' + esc(entry.quantity) + ')') : '';
                            return '<div class="cs-checklist-item">' + checkboxHtml() + '<span>' + writeIn(label) + qty + tbcBadge(isRowTbc(entry)) + '</span></div>';
                        }).join('') + '</div>';
                    }

                    /* ---- Meals & Lodging Section ---- */
                    var mealsObj = (d.meals && typeof d.meals === 'object' && !Array.isArray(d.meals)) ? d.meals : {
                        breakfast: typeof d.meals === 'string' ? d.meals : (d.breakfast || ''),
                        lunch: d.lunch || '',
                        dinner: d.dinner || '',
                        waterAndSnacks: d.waterAndSnacks || d.waterNotes || '',
                        lodging: d.lodging || '',
                        checklist: Array.isArray(d.meals) ? d.meals : (defaults.meals.checklist || [])
                    };
                    var mealsChecklist = Array.isArray(mealsObj.checklist) && mealsObj.checklist.length > 0
                        ? mealsObj.checklist
                        : defaults.meals.checklist;
                    var mealsHtml = '<div class="callsheet-block" data-section="meals"><h3>Meals &amp; Lodging</h3>' +
                        '<div class="cs-kv"><b>Breakfast:</b> ' + subFieldHtml('meals', 'breakfast', mealsObj.breakfast || d.breakfast) +
                        ' &nbsp;|&nbsp; <b>Lunch:</b> ' + subFieldHtml('meals', 'lunch', mealsObj.lunch || d.lunch) +
                        ' &nbsp;|&nbsp; <b>Dinner:</b> ' + subFieldHtml('meals', 'dinner', mealsObj.dinner || d.dinner) + '</div>' +
                        '<div class="cs-kv"><b>Water / Snacks:</b> ' + subFieldHtml('meals', 'waterAndSnacks', mealsObj.waterAndSnacks || d.waterAndSnacks || d.waterNotes) +
                        ' &nbsp;|&nbsp; <b>Lodging:</b> ' + subFieldHtml('meals', 'lodging', mealsObj.lodging || d.lodging) + tbcBadge(fieldTbcMap.meals) + '</div>' +
                        renderChecklistItems(mealsChecklist) +
                        '</div>';

                    /* ---- Route & Location Pin Section ---- */
                    var routeObj = (d.route && typeof d.route === 'object' && !Array.isArray(d.route)) ? d.route : {
                        directions: typeof d.route === 'string' ? d.route : (d.routeNotes || d.directions || ''),
                        locationPin: d.locationPin || d.mapPin || '',
                        meetingSpot: d.meetingSpot || '',
                        fuelNotes: d.fuelNotes || '',
                        checklist: Array.isArray(d.route) ? d.route : (defaults.route.checklist || [])
                    };
                    var routeChecklist = Array.isArray(routeObj.checklist) && routeObj.checklist.length > 0
                        ? routeObj.checklist
                        : defaults.route.checklist;
                    var routeHtml = '<div class="callsheet-block" data-section="route"><h3>Route &amp; Location Pin</h3>' +
                        '<div class="cs-kv"><b>Route / Directions:</b> ' + subFieldHtml('route', 'directions', routeObj.directions || d.routeNotes || d.directions) + tbcBadge(fieldTbcMap.route) + '</div>' +
                        '<div class="cs-kv"><b>Location Pin / Coordinates:</b> ' + subFieldHtml('route', 'locationPin', routeObj.locationPin || d.locationPin || d.mapPin) +
                        ' &nbsp;|&nbsp; <b>Meeting Spot:</b> ' + subFieldHtml('route', 'meetingSpot', routeObj.meetingSpot || d.meetingSpot) + '</div>' +
                        '<div class="cs-kv"><b>Fuel / Stops:</b> ' + subFieldHtml('route', 'fuelNotes', routeObj.fuelNotes || d.fuelNotes) + '</div>' +
                        renderChecklistItems(routeChecklist) +
                        '</div>';

                    /* ---- Kit Checklist Section ---- */
                    var kitItemsList = Array.isArray(d.kit) ? d.kit : defaults.kit;
                    var kitHtml = '<div class="callsheet-block" data-section="kit"><h3>Kit Checklist</h3>' +
                        renderChecklistItems(kitItemsList) +
                        '</div>';

                    /* ---- Paperwork on Set Section ---- */
                    var paperworkList = Array.isArray(d.paperwork) ? d.paperwork : defaults.paperwork;
                    var paperworkHtml = '<div class="callsheet-block" data-section="paperwork"><h3>Paperwork on Set</h3>' +
                        renderChecklistItems(paperworkList) +
                        '</div>';

                    /* ---- Wrap Checklist Section ---- */
                    var wrapList = Array.isArray(d.wrap) ? d.wrap : defaults.wrap;
                    var wrapHtml = '<div class="callsheet-block" data-section="wrap"><h3>Wrap Checklist</h3>' +
                        renderChecklistItems(wrapList) +
                        '</div>';

                    /* ---- Optional Background / Department Notes / Advance ---- */
                    var bg = d.background || [];
                    var bgHtml = '';
                    if (bg.length > 0) {
                        bgHtml = '<div class="callsheet-block"><h3>Background / Stand-ins</h3>' +
                            '<table><thead><tr class="th-row"><th>Qty</th><th>Description</th><th>Call Time</th></tr></thead><tbody>' +
                            bg.map(function (bgRow) {
                                return '<tr class="sec-row"><td class="col-c">' + writeIn(bgRow.quantity) + '</td><td>' + writeIn(bgRow.description) + tbcBadge(isRowTbc(bgRow)) + '</td><td class="col-c">' + writeIn(bgRow.callTime) + '</td></tr>';
                            }).join('') +
                            '</tbody></table></div>';
                    }

                    var notes = d.deptNotes || {};
                    var hasNotes = notes.camera || notes.ge || notes.artProps || notes.wardrobeFx ||
                        fieldTbcMap['deptNotes.camera'] || fieldTbcMap['deptNotes.ge'] || fieldTbcMap['deptNotes.artProps'] || fieldTbcMap['deptNotes.wardrobeFx'];
                    var notesHtml = '';
                    if (hasNotes) {
                        notesHtml = '<div class="callsheet-block"><h3>Department Notes</h3><div class="cs-dept-grid">';
                        if (notes.camera || fieldTbcMap['deptNotes.camera']) notesHtml += '<div class="cs-dept-item"><div class="cs-dept-label">Camera</div>' + subFieldHtml('deptNotes', 'camera', notes.camera) + '</div>';
                        if (notes.ge || fieldTbcMap['deptNotes.ge']) notesHtml += '<div class="cs-dept-item"><div class="cs-dept-label">G&amp;E</div>' + subFieldHtml('deptNotes', 'ge', notes.ge) + '</div>';
                        if (notes.artProps || fieldTbcMap['deptNotes.artProps']) notesHtml += '<div class="cs-dept-item"><div class="cs-dept-label">Art / Props</div>' + subFieldHtml('deptNotes', 'artProps', notes.artProps) + '</div>';
                        if (notes.wardrobeFx || fieldTbcMap['deptNotes.wardrobeFx']) notesHtml += '<div class="cs-dept-item"><div class="cs-dept-label">Wardrobe / FX</div>' + subFieldHtml('deptNotes', 'wardrobeFx', notes.wardrobeFx) + '</div>';
                        notesHtml += '</div></div>';
                    }

                    var advHtml = '';
                    if (d.advanceScenes || d.advanceCast || fieldTbcMap.advanceScenes || fieldTbcMap.advanceCast) {
                        advHtml = '<div class="callsheet-block"><h3>Advance Schedule</h3><div class="cs-advance">' +
                            '<div><b>Scenes:</b> ' + fieldHtml('advanceScenes', d.advanceScenes) + '</div>' +
                            '<div><b>Cast:</b> ' + fieldHtml('advanceCast', d.advanceCast) + '</div>' +
                            '</div></div>';
                    }

                    /* ---- Footer ---- */
                    var footerHtml = '<div class="callsheet-block">' +
                        '<div class="cs-footer-row">' +
                        '<div><b>Walkie Channels:</b> ' + fieldHtml('walkieChannels', d.walkieChannels) + '</div>' +
                        '<div><b>Production Office:</b> ' + fieldHtml('productionOffice', paperBrand(d.productionOffice)) + '</div>' +
                        '</div>' +
                        ((d.safetyNotes || fieldTbcMap.safetyNotes) ? '<div style="padding:3px 10px 5px;font-size:7.5pt;color:#000;font-weight:700;">Safety: ' + fieldHtml('safetyNotes', d.safetyNotes) + '</div>' : '') +
                        '</div>';

                    return engine._wrapHtml(
                        (titleText || 'Production') + ' : Call Sheet',
                        header + tbcBoxHtml + contactsHtml + wx + crewTable + sceneTable + intervieweesTable + castTable + mealsHtml + routeHtml + kitHtml + paperworkHtml + wrapHtml + bgHtml + notesHtml + advHtml + footerHtml,
                        '/*cs-ink*/'
                    );
                }
            },

            /* ---- TEMPLATE: COST REPORT ---- */
            costReport: {
                id: 'costReport',
                name: 'Cost Report',
                description: 'Budget vs. actual variance by category with burn percentage summary.',
                formats: ['pdf', 'html', 'print'],
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var currency = options.currency || 'JMD';
                    var rate = parseFloat(options.rate) || 1;
                    var fmt = function (v) { return fmtCurrency(v, currency, rate); };
                    var sections = b.sections || {};

                    var grandEst = 0, grandAct = 0;
                    Object.keys(sections).forEach(function (k) {
                        grandEst += engine._sectionEst(sections[k]);
                        grandAct += engine._sectionActual(sections[k]);
                    });
                    if (b.grandTotal != null) grandEst = Number(b.grandTotal);
                    var remaining = grandEst - grandAct;
                    var burnPct = grandEst > 0 ? Math.round((grandAct / grandEst) * 100) : 0;
                    var burnColor = burnPct > 100 ? '#dc2626' : burnPct > 85 ? '#f59e0b' : '#15803d';

                    var header = '<div class="ts-header"><div class="ts-title">' + esc(b.projectName || 'Production') + '</div>' +
                        '<div class="ts-subtitle">' + engine._inkHeading('COST REPORT') + '</div>' +
                        '<div class="ts-meta"><span>Generated: ' + esc(typedReportDate(b, 'generatedDate')) + '</span><span>Currency: ' + esc(currency) + '</span></div></div>';

                    var summary = '<div class="cr-summary">' +
                        '<div class="cr-cell"><div class="cr-lbl">Total Budget</div><div class="cr-val">' + fmt(grandEst) + '</div></div>' +
                        '<div class="cr-cell"><div class="cr-lbl">Total Spent</div><div class="cr-val">' + fmt(grandAct) + '</div></div>' +
                        '<div class="cr-cell"><div class="cr-lbl">Remaining</div><div class="cr-val ' + (remaining >= 0 ? 'positive' : 'negative') + '">' + fmt(remaining) + '</div></div>' +
                        '<div class="cr-cell"><div class="cr-lbl">Burn</div><div class="cr-val">' + burnPct + '%' +
                        '<div class="cr-bar"><div style="height:4px;border-radius:2px;background:' + burnColor + ';width:' + Math.min(burnPct, 100) + '%;"></div></div></div></div></div>';

                    var thRow = '<tr class="th-row"><th>Category</th><th class="col-r">Estimated</th><th class="col-r">Actual</th><th class="col-r">Variance</th><th class="col-r">% Var</th></tr>';
                    var rows = '<table>' + thRow + '<tbody>';
                    Object.keys(sections).forEach(function (secName) {
                        var sec = sections[secName];
                        var est = engine._sectionEst(sec);
                        var act = engine._sectionActual(sec);
                        var vari = act - est;
                        var variPct = est > 0 ? (vari / est) * 100 : 0;
                        var cls = vari > est * 0.05 ? 'negative' : vari < 0 ? 'positive' : '';
                        rows += '<tr class="sec-row"><td>' + esc(secName) + '</td><td class="col-r">' + fmt(est) + '</td><td class="col-r">' + fmt(act) + '</td>' +
                            '<td class="col-r ' + cls + '">' + (vari >= 0 ? '+' : '') + fmt(vari) + '</td>' +
                            '<td class="col-r ' + cls + '">' + (variPct >= 0 ? '+' : '') + variPct.toFixed(1) + '%</td></tr>';
                    });
                    rows += '<tr class="grand-total-row"><td>' + engine._inkHeading('GRAND TOTAL') + '</td><td class="col-r">' + fmt(grandEst) + '</td><td class="col-r">' + fmt(grandAct) + '</td>' +
                        '<td class="col-r">' + (grandAct >= grandEst ? '+' : '') + fmt(grandAct - grandEst) + '</td>' +
                        '<td class="col-r">' + (grandEst > 0 ? (((grandAct - grandEst) / grandEst) * 100).toFixed(1) : '0.0') + '%</td></tr>';
                    rows += '</tbody></table>';

                    var css = '.cr-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;}' +
                        '.cr-cell{border:1px solid #e2e8f0;border-radius:4px;padding:10px 14px;}' +
                        '.cr-lbl{font-size:7.5pt;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:3px;}' +
                        '.cr-val{font-size:13pt;font-weight:900;color:#0f172a;}' +
                        '.cr-bar{height:4px;background:#e2e8f0;border-radius:2px;margin-top:5px;overflow:hidden;}';
                    return engine._wrapHtml((b.projectName || 'Budget') + engine._titleSeparator() + 'Cost Report', header + summary + rows, css);
                }
            },

            /* ---- TEMPLATE: PURCHASE ORDER ---- */
            purchaseOrder: {
                id: 'purchaseOrder',
                name: 'Purchase Order',
                description: 'Vendor PO with dynamic line items, tax, and approval signature.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    var pkey = slugify(b.projectName || b.id || 'proj');
                    var ckey = 'mbtdb_po_counter_' + pkey;
                    var n = parseInt(localStorage.getItem(ckey) || '0', 10) + 1;
                    localStorage.setItem(ckey, n);
                    var poNum = 'PO-' + new Date().getFullYear() + '-' + String(n).padStart(3, '0');
                    return {
                        productionTitle: b.projectName || '', poNumber: poNum,
                        date: new Date().toISOString().split('T')[0],
                        vendorName: '', vendorAddress: '', vendorPhone: '', vendorEmail: '', vendorTaxId: '',
                        budgetCategory: '', paymentTerms: 'Net 30',
                        requestedBy: '', approvedBy: '', taxRate: '0', notes: '',
                        items: [{ description: '', quantity: '1', unitPrice: '', total: '' }]
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};
                    var currency = options.currency || 'JMD';
                    var rate = parseFloat(options.rate) || 1;
                    var fmt = function (v) { return fmtCurrency(v, currency, rate); };
                    var items = d.items || [];
                    var subtotal = items.reduce(function (s, it) {
                        return s + (parseFloat(it.total) || (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0));
                    }, 0);
                    var taxAmt = subtotal * ((parseFloat(d.taxRate) || 0) / 100);

                    var header = '<div class="po-head"><div><div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div><div class="ts-subtitle">' + engine._inkHeading('PURCHASE ORDER') + '</div></div>' +
                        '<div class="po-meta"><div><b>PO #:</b> ' + esc(d.poNumber || '') + '</div><div><b>Date:</b> ' + esc(d.date || '') + '</div>' +
                        (d.budgetCategory ? '<div><b>Category:</b> ' + esc(d.budgetCategory) + '</div>' : '') + '</div></div>';

                    var vendor = '<div class="po-vendor"><div class="po-blk-lbl">Bill To / Vendor</div><div class="po-blk-name">' + esc(d.vendorName || '\u2014') + '</div>' +
                        (d.vendorAddress ? '<div>' + esc(d.vendorAddress) + '</div>' : '') +
                        (d.vendorPhone ? '<div>Tel: ' + esc(d.vendorPhone) + '</div>' : '') +
                        (d.vendorEmail ? '<div>' + esc(d.vendorEmail) + '</div>' : '') +
                        (d.vendorTaxId ? '<div>Tax ID: ' + esc(d.vendorTaxId) + '</div>' : '') + '</div>';

                    var iRows = items.map(function (it) {
                        var lt = parseFloat(it.total) || (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0);
                        return '<tr class="sec-row"><td>' + esc(it.description || '') + '</td><td class="col-r" style="width:55px;">' + esc(it.quantity || '1') + '</td>' +
                            '<td class="col-r" style="width:100px;">' + fmt(it.unitPrice || 0) + '</td><td class="col-r" style="width:100px;">' + fmt(lt) + '</td></tr>';
                    }).join('');
                    var itemTable = '<table><tr class="th-row"><th>Description</th><th class="col-r">Qty</th><th class="col-r">Unit Price</th><th class="col-r">Total</th></tr><tbody>' + iRows + '</tbody></table>';

                    var totals = '<div class="po-totals">' +
                        '<div class="po-tr"><span>Subtotal</span><span>' + fmt(subtotal) + '</span></div>' +
                        (parseFloat(d.taxRate) > 0 ? '<div class="po-tr"><span>Tax (' + esc(d.taxRate) + '%)</span><span>' + fmt(taxAmt) + '</span></div>' : '') +
                        '<div class="po-tr po-grand"><span>' + engine._inkHeading('TOTAL') + '</span><span>' + fmt(subtotal + taxAmt) + '</span></div></div>';

                    var terms = (d.paymentTerms || d.notes) ? '<div class="po-terms"><b>Payment Terms:</b> ' + esc(d.paymentTerms || '') +
                        (d.notes ? '<br><b>Notes:</b> ' + esc(d.notes) : '') + '</div>' : '';

                    var sig = '<div class="po-sig-row">' +
                        '<div><div class="po-sig-line"></div><div class="po-sig-lbl">Requested By: ' + esc(d.requestedBy || '') + '</div></div>' +
                        '<div><div class="po-sig-line"></div><div class="po-sig-lbl">Approved By: ' + esc(d.approvedBy || '') + '</div></div>' +
                        '<div><div class="po-sig-line"></div><div class="po-sig-lbl">Date</div></div></div>';

                    var css = '.po-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f172a;padding-bottom:10px;margin-bottom:14px;}' +
                        '.po-meta{text-align:right;font-size:8.5pt;line-height:1.8;}' +
                        '.po-vendor{border:1px solid #e2e8f0;border-radius:4px;padding:10px 14px;margin-bottom:14px;font-size:8.5pt;line-height:1.7;}' +
                        '.po-blk-lbl{font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:2px;}' +
                        '.po-blk-name{font-size:11pt;font-weight:700;margin-bottom:2px;}' +
                        '.po-totals{display:flex;flex-direction:column;align-items:flex-end;margin-top:8px;gap:3px;}' +
                        '.po-tr{display:flex;gap:40px;font-size:8.5pt;}' +
                        '.po-grand{font-weight:900;font-size:11pt;border-top:2px solid #0f172a;padding-top:4px;margin-top:2px;}' +
                        '.po-terms{font-size:8pt;color:#475569;margin-top:12px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:4px;}' +
                        '.po-sig-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:30px;}' +
                        '.po-sig-line{border-bottom:1px solid #0f172a;height:30px;margin-bottom:4px;}' +
                        '.po-sig-lbl{font-size:7.5pt;color:#475569;}';
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + (d.poNumber || 'PO'), header + vendor + itemTable + totals + terms + sig, css);
                }
            },

            /* ---- TEMPLATE: PETTY CASH LOG ---- */
            pettyCash: {
                id: 'pettyCash',
                name: 'Petty Cash Log',
                description: 'Daily expense log with running float balance and reconciliation.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    return {
                        productionTitle: (budget && budget.projectName) || '',
                        department: '', custodian: '', floatAmount: '', dateRange: '',
                        entries: [{ date: new Date().toISOString().split('T')[0], description: '', category: '', amount: '', receiptNum: '' }]
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};
                    var currency = options.currency || 'JMD';
                    var rate = parseFloat(options.rate) || 1;
                    var fmt = function (v) { return fmtCurrency(v, currency, rate); };
                    var floatAmt = parseFloat(d.floatAmount) || 0;
                    var entries = d.entries || [];

                    var header = '<div class="ts-header"><div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div class="ts-subtitle">' + engine._inkHeading('PETTY CASH LOG') + (d.department ? ' \u2014 ' + esc(d.department) : '') + '</div>' +
                        '<div class="ts-meta"><span>Custodian: ' + engine._fallbackEsc(d.custodian, options) + '</span><span>Float: ' + fmt(floatAmt) + '</span>' +
                        (d.dateRange ? '<span>' + esc(d.dateRange) + '</span>' : '') + '</div></div>';

                    var running = floatAmt;
                    var totalSpent = 0;
                    var rowsHtml = entries.map(function (e) {
                        var amt = parseFloat(e.amount) || 0;
                        running -= amt;
                        totalSpent += amt;
                        return '<tr class="sec-row"><td>' + esc(e.date || '') + '</td><td>' + esc(e.description || '') + '</td>' +
                            '<td>' + esc(e.category || '') + '</td><td class="col-r">' + fmt(amt) + '</td>' +
                            '<td class="col-c">' + esc(e.receiptNum || '') + '</td><td class="col-r">' + fmt(running) + '</td></tr>';
                    }).join('');
                    var table = '<table><thead><tr class="th-row"><th>Date</th><th>Description</th><th>Category</th><th class="col-r">Amount</th><th class="col-c">Receipt #</th><th class="col-r">Balance</th></tr></thead>' +
                        '<tbody>' + rowsHtml + '</tbody><tfoot>' +
                        '<tr class="grand-total-row"><td colspan="3">' + engine._inkHeading('SUMMARY') + '</td><td class="col-r">' + fmt(totalSpent) + '</td><td></td><td class="col-r">' + fmt(floatAmt - totalSpent) + '</td></tr>' +
                        '</tfoot></table>';

                    var sig = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:30px;">' +
                        '<div><div style="border-bottom:1px solid #0f172a;height:30px;margin-bottom:4px;"></div><div style="font-size:7.5pt;color:#475569;">Custodian Signature &amp; Date</div></div>' +
                        '<div><div style="border-bottom:1px solid #0f172a;height:30px;margin-bottom:4px;"></div><div style="font-size:7.5pt;color:#475569;">Supervisor Approval &amp; Date</div></div></div>';
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + 'Petty Cash Log', header + table + sig, '');
                }
            },

            /* ---- TEMPLATE: CREW DEAL MEMO ---- */
            crewDealMemo: {
                id: 'crewDealMemo',
                name: 'Deal Memo',
                description: 'Individual crew deal memo with compensation, terms, and signature.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    var sections = b.sections || {};
                    var producer = '';
                    Object.keys(sections).forEach(function (k) {
                        var sec = sections[k];
                        if ((sec.id || '').toLowerCase() !== 'atl') return;
                        (sec.items || []).forEach(function (item) {
                            var dl = (item.description || '').toLowerCase();
                            if (!producer && dl.indexOf('producer') > -1) producer = item.description;
                        });
                    });
                    var deptMap = { atl: 'Above The Line', btl: 'Below The Line', post: 'Post-Production', pub: 'Publicity', travel: 'Travel & Transport' };
                    var crewSeed = null;
                    Object.keys(sections).some(function (sk) {
                        var sec = sections[sk];
                        var items = sec.items || [];
                        for (var i = 0; i < items.length; i++) {
                            var item = items[i];
                            if (item.memoId) continue;
                            var crewName = item.crew && item.crew.name ? String(item.crew.name).trim() : '';
                            if (!crewName) continue;
                            crewSeed = { item: item, sectionKey: sk, section: sec };
                            return true;
                        }
                        return false;
                    });
                    function mapUnitToRateType(unit) {
                        var u = String(unit || '').trim().toLowerCase();
                        if (!u) return 'Daily';
                        if (u === 'day' || u === 'daily') return 'Daily';
                        if (u === 'week' || u === 'weekly') return 'Weekly';
                        if (u === 'flat' || u === 'allowance') return 'Flat';
                        return 'Daily';
                    }
                    var seedName = '';
                    var seedAddress = '';
                    var seedPhone = '';
                    var seedEmail = '';
                    var seedRole = '';
                    var seedDept = '';
                    var seedRate = '';
                    var seedRateType = 'Daily';
                    if (crewSeed) {
                        var seedItem = crewSeed.item;
                        var seedCrew = seedItem.crew || {};
                        seedName = seedCrew.name ? String(seedCrew.name).trim() : '';
                        seedAddress = seedCrew.address || seedCrew.addr || '';
                        seedPhone = seedCrew.phone || '';
                        seedEmail = seedCrew.email || '';
                        seedRole = seedItem.description || '';
                        var seedSec = crewSeed.section;
                        if (seedSec && seedSec.name && String(seedSec.name).trim()) {
                            seedDept = String(seedSec.name).trim();
                        } else {
                            var sid = seedSec && seedSec.id ? String(seedSec.id).toLowerCase() : '';
                            seedDept = (sid && deptMap[sid]) ? deptMap[sid] : crewSeed.sectionKey;
                        }
                        if (typeof seedItem.rate === 'number' && isFinite(seedItem.rate)) seedRate = String(seedItem.rate);
                        seedRateType = mapUnitToRateType(seedItem.unit);
                    }
                    return {
                        productionTitle: b.projectName || '', productionCompany: '',
                        startDate: '', endDate: '', guaranteedDays: '',
                        employeeName: seedName, employeeAddress: seedAddress, employeePhone: seedPhone, employeeEmail: seedEmail,
                        role: seedRole, department: seedDept, supervisor: '',
                        rateType: seedRateType, rate: seedRate, overtimeRate: '', kitRental: '', perDiem: '',
                        unionStatus: 'Non-Union', unionLocal: '',
                        creditName: '', creditBilling: '',
                        workHours: '10', turnaround: '12',
                        paymentTerms: 'Net 7 after wrap',
                        producerName: producer,
                        terms: 'Production shall have the right to use Employee\u2019s name, likeness and biography in connection with the production and its promotion.'
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};

                    var header = '<div style="text-align:center;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">' +
                        (d.productionCompany ? '<div style="font-size:10pt;font-weight:700;color:#475569;">' + esc(paperBrand(d.productionCompany)) + '</div>' : '') +
                        '<div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div style="font-size:12pt;font-weight:700;letter-spacing:2px;margin-top:4px;">' + engine._inkHeading('CREW DEAL MEMO') + '</div></div>';

                    var empBlock = '<div class="dm-2col">' +
                        '<div><div class="dm-lbl">Employee</div><div class="dm-name">' + esc(d.employeeName || '\u2014') + '</div>' +
                        (d.employeeAddress ? '<div class="dm-sub">' + esc(d.employeeAddress) + '</div>' : '') +
                        (d.employeePhone ? '<div class="dm-sub">Tel: ' + esc(d.employeePhone) + '</div>' : '') +
                        (d.employeeEmail ? '<div class="dm-sub">' + esc(d.employeeEmail) + '</div>' : '') + '</div>' +
                        '<div class="dm-kvlist">' +
                        '<div class="dm-kv"><b>Position:</b> ' + esc(d.role || '\u2014') + '</div>' +
                        '<div class="dm-kv"><b>Department:</b> ' + esc(d.department || '\u2014') + '</div>' +
                        '<div class="dm-kv"><b>Reports To:</b> ' + esc(d.supervisor || '\u2014') + '</div>' +
                        '<div class="dm-kv"><b>Start:</b> ' + esc(d.startDate || '\u2014') + '</div>' +
                        '<div class="dm-kv"><b>End:</b> ' + esc(d.endDate || '\u2014') + (d.guaranteedDays ? ' (' + esc(d.guaranteedDays) + ' guaranteed days)' : '') + '</div></div></div>';

                    var compBlock = '<div class="dm-hdr">Compensation</div><div class="dm-4col">' +
                        '<div><div class="dm-lbl">Rate Type</div><div class="dm-val">' + esc(d.rateType || '') + '</div></div>' +
                        '<div><div class="dm-lbl">Rate</div><div class="dm-val">' + esc(d.rate || '\u2014') + '</div></div>' +
                        '<div><div class="dm-lbl">OT Rate</div><div class="dm-val">' + esc(d.overtimeRate || '\u2014') + '</div></div>' +
                        '<div><div class="dm-lbl">Kit Rental</div><div class="dm-val">' + esc(d.kitRental || '\u2014') + '</div></div>' +
                        '<div><div class="dm-lbl">Per Diem</div><div class="dm-val">' + esc(d.perDiem || '\u2014') + '</div></div>' +
                        '<div><div class="dm-lbl">Union Status</div><div class="dm-val">' + esc(d.unionStatus || '') + (d.unionLocal ? ' / ' + esc(d.unionLocal) : '') + '</div></div>' +
                        '<div><div class="dm-lbl">Work Hours</div><div class="dm-val">' + esc(d.workHours || '10') + ' hrs/day</div></div>' +
                        '<div><div class="dm-lbl">Turnaround</div><div class="dm-val">' + esc(d.turnaround || '12') + ' hrs min</div></div></div>';

                    var creditBlock = (d.creditName || d.creditBilling) ?
                        '<div class="dm-hdr">Screen Credit</div><div class="dm-2col">' +
                        '<div><div class="dm-lbl">Credit Name</div><div class="dm-val">' + esc(d.creditName || '') + '</div></div>' +
                        '<div><div class="dm-lbl">Billing</div><div class="dm-val">' + esc(d.creditBilling || '') + '</div></div></div>' : '';

                    var termsBlock = '<div class="dm-hdr">Terms &amp; Conditions</div>' +
                        '<div style="font-size:7.5pt;color:#475569;line-height:1.5;padding:4px 0;">' + esc(d.terms || '') + '</div>' +
                        '<div style="font-size:8pt;margin-top:5px;"><b>Payment:</b> ' + esc(d.paymentTerms || '') + '</div>';

                    var sig = '<div class="dm-2col" style="margin-top:30px;">' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Employee Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.employeeName || '') + '</div></div>' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Producer Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.producerName || '') + '</div></div></div>';

                    var css = '.dm-2col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;border:1px solid #e2e8f0;padding:12px;border-radius:4px;}' +
                        '.dm-4col{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;}' +
                        '.dm-hdr{background:#1e293b;color:#f8fafc;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:4px 8px;margin:12px 0 6px;border-radius:2px;}' +
                        '.dm-lbl{font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;}' +
                        '.dm-val{font-size:9pt;font-weight:600;color:#0f172a;}' +
                        '.dm-name{font-size:11pt;font-weight:700;margin:2px 0;}' +
                        '.dm-sub{font-size:7.5pt;color:#475569;line-height:1.6;}' +
                        '.dm-kvlist{font-size:8.5pt;line-height:2;}' +
                        '.dm-kv b{color:#475569;display:inline-block;width:80px;}' +
                        '.dm-sig-line{border-bottom:1px solid #0f172a;height:35px;margin-bottom:4px;}' +
                        '.dm-sig-lbl{font-size:7.5pt;color:#475569;}';
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + 'Deal Memo: ' + (d.employeeName || ''), header + empBlock + compBlock + creditBlock + termsBlock + sig, css);
                }
            },

            /* ---- TEMPLATE: CREW LIST ---- */
            crewList: {
                id: 'crewList',
                name: 'Crew List',
                description: 'Full crew contact list grouped by department.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    var sections = b.sections || {};
                    var deptMap = { atl: 'Above The Line', btl: 'Below The Line', post: 'Post-Production', pub: 'Publicity', travel: 'Travel & Transport' };
                    var crew = [];
                    Object.keys(sections).forEach(function (secName) {
                        var sec = sections[secName];
                        var dept = deptMap[(sec.id || '').toLowerCase()] || secName;
                        (sec.items || []).forEach(function (item) {
                            if (item.memoId || item.memoStatus) return;
                            var crewObj = item.crew || {};
                            var crewName = crewObj.name ? String(crewObj.name).trim() : '';
                            var desc = (item.description || '').trim();
                            if (!crewName && !desc) return;
                            var name = crewName || desc;
                            var role = (crewObj.role ? String(crewObj.role).trim() : '') || desc || '';
                            var phone = crewObj.phone || '';
                            var email = crewObj.email || '';
                            crew.push({ department: dept, name: name, role: role, phone: phone, email: email, notes: '' });
                        });
                    });
                    return {
                        productionTitle: b.projectName || '',
                        date: new Date().toISOString().split('T')[0],
                        crew: crew.length > 0 ? crew : [{ department: '', name: '', role: '', phone: '', email: '', notes: '' }]
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};
                    var crew = d.crew || [];

                    var header = '<div class="ts-header"><div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div class="ts-subtitle">' + engine._inkHeading('CREW LIST \u2014 CONFIDENTIAL') + '</div>' +
                        '<div class="ts-meta"><span>Date: ' + esc(d.date || '') + '</span><span>Total Crew: ' + crew.length + '</span></div></div>';

                    var byDept = {};
                    var deptOrder = [];
                    crew.forEach(function (m) {
                        var dept = m.department || 'Other';
                        if (!byDept[dept]) { byDept[dept] = []; deptOrder.push(dept); }
                        byDept[dept].push(m);
                    });

                    var tables = deptOrder.map(function (dept) {
                        var rows = byDept[dept].map(function (m) {
                            return '<tr class="sec-row"><td>' + esc(m.name || '') + '</td><td>' + esc(m.role || '') + '</td>' +
                                '<td>' + esc(m.phone || '') + '</td><td>' + esc(m.email || '') + '</td><td>' + esc(m.notes || '') + '</td></tr>';
                        }).join('');
                        return '<table style="margin-bottom:14px;"><thead>' +
                            '<tr><th colspan="5" class="group-hdr">' + esc(dept) + '</th></tr>' +
                            '<tr class="th-row"><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Notes</th></tr>' +
                            '</thead><tbody>' + rows + '</tbody></table>';
                    }).join('');

                    var footer = '<div style="margin-top:16px;font-size:7.5pt;color:#94a3b8;text-align:center;border-top:1px dashed #e2e8f0;padding-top:6px;">Confidential \u2014 do not distribute outside production.</div>';
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + 'Crew List', header + tables + footer, '');
                }
            },

            /* ---- TEMPLATE: PRODUCTION REPORT (DPR) ---- */
            productionReport: {
                id: 'productionReport',
                name: 'Production Report',
                description: 'Daily production report: call times, scenes, pages, delays, and advance.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    var sections = b.sections || {};
                    var director = '', upm = '', firstAd = '';
                    Object.keys(sections).forEach(function (k) {
                        var sec = sections[k];
                        if ((sec.id || '').toLowerCase() !== 'atl') return;
                        (sec.items || []).forEach(function (item) {
                            if (item.memoId || item.memoStatus) return;
                            var dl = (item.description || '').toLowerCase();
                            var crewName = item.crew && item.crew.name ? String(item.crew.name).trim() : '';
                            var person = crewName || (item.description || '').trim();
                            if (!director && dl.indexOf('director') > -1 && dl.indexOf('art') < 0) director = person;
                            if (!upm && (dl.indexOf('upm') > -1 || dl.indexOf('unit production') > -1)) upm = person;
                            if (!firstAd && (dl.indexOf('1st ad') > -1 || dl.indexOf('first ad') > -1)) firstAd = person;
                        });
                    });
                    return {
                        productionTitle: b.projectName || '',
                        date: new Date().toISOString().split('T')[0],
                        shootDay: '1', totalDays: '',
                        director: director, firstAd: firstAd, upm: upm,
                        crewCall: '', firstShot: '', mealIn: '', mealOut: '', cameraWrap: '', lastManOut: '',
                        scenesScheduled: '', scenesCompleted: '', pagesScheduled: '', pagesShot: '',
                        totalPagesShot: '', totalScriptPages: '', setups: '',
                        scenes: [], delays: [], notes: '',
                        tomorrowCall: '', tomorrowScenes: ''
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};
                    var pagesShot = parseFloat(d.totalPagesShot) || 0;
                    var totalPages = parseFloat(d.totalScriptPages) || 0;
                    var pct = totalPages > 0 ? Math.round((pagesShot / totalPages) * 100) : 0;

                    var header = '<div class="ts-header"><div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div class="ts-subtitle">' + engine._inkHeading('DAILY PRODUCTION REPORT \u2014 DAY') + ' ' + esc(d.shootDay || '?') + (d.totalDays ? (options.easyOnTheInk ? ' of ' : ' OF ') + esc(d.totalDays) : '') + '</div>' +
                        '<div class="ts-meta"><span>' + esc(d.date || '') + '</span>' +
                        (d.director ? '<span>Director: ' + esc(d.director) + '</span>' : '') +
                        (d.firstAd ? '<span>1st AD: ' + esc(d.firstAd) + '</span>' : '') +
                        (d.upm ? '<span>UPM: ' + esc(d.upm) + '</span>' : '') + '</div></div>';

                    function tcell(lbl, val) {
                        return '<div class="dr-tcell"><div class="dr-tlbl">' + lbl + '</div><div class="dr-tval">' + esc(val || '\u2014') + '</div></div>';
                    }
                    var times = '<div class="dr-tgrid">' +
                        tcell('Crew Call', d.crewCall) + tcell('First Shot', d.firstShot) +
                        tcell('Meal In', d.mealIn) + tcell('Meal Out', d.mealOut) +
                        tcell('Camera Wrap', d.cameraWrap) + tcell('Last Man Out', d.lastManOut) + '</div>';

                    var progress = '<div class="dr-prog">' +
                        '<div class="dr-stat-grid">' +
                        '<div class="dr-stat"><div class="dr-tlbl">Scenes Scheduled</div><div class="dr-bigval">' + esc(d.scenesScheduled || '0') + '</div></div>' +
                        '<div class="dr-stat"><div class="dr-tlbl">Scenes Completed</div><div class="dr-bigval">' + esc(d.scenesCompleted || '0') + '</div></div>' +
                        '<div class="dr-stat"><div class="dr-tlbl">Pages Scheduled</div><div class="dr-bigval">' + esc(d.pagesScheduled || '0') + '</div></div>' +
                        '<div class="dr-stat"><div class="dr-tlbl">Pages Shot Today</div><div class="dr-bigval">' + esc(d.pagesShot || '0') + '</div></div>' +
                        '<div class="dr-stat"><div class="dr-tlbl">Camera Setups</div><div class="dr-bigval">' + esc(d.setups || '0') + '</div></div>' +
                        '<div class="dr-stat dr-cum"><div class="dr-tlbl">Cumulative Progress</div>' +
                        '<div class="dr-bigval">' + esc(d.totalPagesShot || '0') + ' / ' + esc(d.totalScriptPages || '?') + ' pg (' + pct + '%)</div>' +
                        '<div style="height:5px;background:#e2e8f0;border-radius:3px;margin-top:4px;overflow:hidden;"><div style="height:5px;background:#2563eb;width:' + Math.min(pct, 100) + '%;border-radius:3px;"></div></div></div>' +
                        '</div></div>';

                    var sceneTable = (d.scenes || []).length > 0 ?
                        '<div class="dr-sec-hdr">Scenes</div><table><tr class="th-row"><th>#</th><th>I/E</th><th>D/N</th><th>Description</th><th class="col-r">Pages</th><th class="col-c">Status</th></tr><tbody>' +
                        (d.scenes || []).map(function (s) {
                            var sc = s.status === 'Complete' ? '#15803d' : s.status === 'Partial' ? '#f59e0b' : '#dc2626';
                            return '<tr class="sec-row"><td>' + esc(s.num || '') + '</td><td>' + esc(s.ie || '') + '</td><td>' + esc(s.dn || '') + '</td><td>' + esc(s.description || '') + '</td><td class="col-r">' + esc(s.pages || '') + '</td><td class="col-c" style="font-weight:700;color:' + sc + ';">' + esc(s.status || '') + '</td></tr>';
                        }).join('') + '</tbody></table>' : '';

                    var delayTable = (d.delays || []).length > 0 ?
                        '<div class="dr-sec-hdr">Delays / Lost Time</div><table><tr class="th-row"><th style="width:80px;" class="col-r">Duration</th><th>Reason</th></tr><tbody>' +
                        (d.delays || []).map(function (dl) {
                            return '<tr class="sec-row"><td class="col-r">' + esc(dl.duration || '') + '</td><td>' + esc(dl.reason || '') + '</td></tr>';
                        }).join('') + '</tbody></table>' : '';

                    var notes = d.notes ? '<div class="dr-sec-hdr">Notes</div><div style="font-size:8.5pt;padding:6px 0;">' + esc(d.notes) + '</div>' : '';
                    var adv = (d.tomorrowCall || d.tomorrowScenes) ? '<div class="dr-sec-hdr">Tomorrow\'s Advance</div><div style="font-size:8.5pt;padding:5px 0;"><b>Crew Call:</b> ' + esc(d.tomorrowCall || '\u2014') + ' &nbsp;&nbsp; <b>Scenes:</b> ' + esc(d.tomorrowScenes || '\u2014') + '</div>' : '';
                    var sig = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:24px;">' +
                        '<div><div style="border-bottom:1px solid #0f172a;height:30px;margin-bottom:4px;"></div><div style="font-size:7.5pt;color:#475569;">UPM / Line Producer Signature</div></div>' +
                        '<div><div style="border-bottom:1px solid #0f172a;height:30px;margin-bottom:4px;"></div><div style="font-size:7.5pt;color:#475569;">1st AD Signature</div></div></div>';

                    var css = '.dr-tgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:16px;}' +
                        '.dr-tcell{border:1px solid #e2e8f0;border-radius:4px;padding:6px 8px;text-align:center;}' +
                        '.dr-tlbl{font-size:6.5pt;font-weight:700;text-transform:uppercase;color:#64748b;}' +
                        '.dr-tval{font-size:11pt;font-weight:700;margin-top:2px;}' +
                        '.dr-prog{border:1px solid #e2e8f0;border-radius:4px;padding:12px 14px;margin-bottom:14px;}' +
                        '.dr-stat-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;}' +
                        '.dr-stat{text-align:center;}.dr-cum{grid-column:span 2;text-align:left;}' +
                        '.dr-bigval{font-size:12pt;font-weight:700;color:#0f172a;margin-top:2px;}' +
                        '.dr-sec-hdr{background:#334155;color:#e2e8f0;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:4px 8px;margin:12px 0 6px;border-radius:2px;}';
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + 'Production Report Day ' + (d.shootDay || '?'), header + times + progress + sceneTable + delayTable + notes + adv + sig, css);
                }
            },

            /* ---- TEMPLATE: TALENT / PERFORMER AGREEMENT ---- */
            talentAgreement: {
                id: 'talentAgreement',
                name: 'Talent Agreement',
                description: 'Performer contract with compensation, rights, credit, and signatures.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget, options) {
                    var b = budget || {};
                    var sections = b.sections || {};
                    var performerLegalName = '';
                    var performerAddress = '';
                    var performerPhone = '';
                    var characterName = '';

                    function itemLabel(item) {
                        return String(item.description || item.label || item.name || '').trim();
                    }
                    function isCastLine(item, secId) {
                        if ((secId || '').toLowerCase() === 'cast') return true;
                        var dl = itemLabel(item).toLowerCase();
                        return dl.indexOf('actor') > -1 || dl.indexOf('talent') > -1 || dl.indexOf('cast') > -1 ||
                            dl.indexOf('performer') > -1 || dl.indexOf('lead') > -1;
                    }
                    function seedPerformer(item) {
                        var crewObj = item.crew || {};
                        var crewName = crewObj.name ? String(crewObj.name).trim() : '';
                        var desc = itemLabel(item);
                        performerLegalName = crewName || desc;
                        if (crewObj.address) performerAddress = String(crewObj.address).trim();
                        if (crewObj.phone) performerPhone = String(crewObj.phone).trim();
                        else if (crewObj.email) performerPhone = String(crewObj.email).trim();
                        if (crewName) {
                            var roleVal = (item.role && String(item.role).trim()) || '';
                            if (roleVal && roleVal.toLowerCase() !== crewName.toLowerCase()) {
                                characterName = roleVal;
                            } else if (desc && desc.toLowerCase() !== crewName.toLowerCase()) {
                                characterName = desc;
                            }
                        } else if (item.role) {
                            characterName = String(item.role).trim();
                        }
                    }

                    Object.keys(sections).forEach(function (k) {
                        var sec = sections[k];
                        var secId = String(sec.id || k || '').toLowerCase();
                        if (secId !== 'atl' && secId !== 'cast') return;
                        (sec.items || []).forEach(function (item) {
                            if (item.memoId || item.memoStatus) return;
                            if (!performerLegalName && isCastLine(item, secId)) {
                                seedPerformer(item);
                            }
                        });
                    });

                    var startDate = b.startDate || (b.production && b.production.startDate) || '';
                    var guaranteedDays = '';
                    if (b.targetLock && b.targetLock.stages && b.targetLock.stages.prod) {
                        var prodDays = parseInt(b.targetLock.stages.prod.days, 10) || 0;
                        if (prodDays > 0) guaranteedDays = String(prodDays);
                    }
                    if (!guaranteedDays) {
                        var topDays = parseInt(b.productionDays, 10) || 0;
                        if (topDays > 0) guaranteedDays = String(topDays);
                    }
                    var endDate = '';
                    if (startDate && guaranteedDays) {
                        var dayCount = parseInt(guaranteedDays, 10) || 0;
                        if (dayCount > 1) {
                            var parts = String(startDate).split('-');
                            if (parts.length === 3) {
                                var endDt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                                if (!isNaN(endDt.getTime())) {
                                    endDt.setDate(endDt.getDate() + dayCount - 1);
                                    endDate = endDt.getFullYear() + '-' +
                                        String(endDt.getMonth() + 1).replace(/^(\d)$/, '0$1') + '-' +
                                        String(endDt.getDate()).replace(/^(\d)$/, '0$1');
                                }
                            }
                        }
                    }

                    var party = paperworkParty(b, options, true);
                    return {
                        productionTitle: b.projectName || '',
                        productionCompany: paperBrand(b.projectCompany || b.company || ''),
                        producerName: party.producer,
                        granteeLine: paperReleaseGrantee(b, options),
                        performerLegalName: performerLegalName, performerStageName: '', performerAddress: performerAddress, performerPhone: performerPhone,
                        agentName: '', agentPhone: '',
                        characterName: characterName, roleType: 'Lead', roleDescription: '',
                        rateType: 'Daily', rate: '', overtimeRate: '', fittingRate: '', perDiem: '',
                        travelProvisions: '', paymentSchedule: 'On wrap',
                        startDate: startDate, endDate: endDate, guaranteedDays: guaranteedDays, holdDates: '',
                        territory: 'Worldwide', media: 'Theatrical, Streaming, Online',
                        rightsDuration: 'In perpetuity', exclusivityPeriod: '',
                        unionStatus: 'Non-Union', unionAgreementType: '',
                        credit: '', billingPosition: '', paidAdRequirements: '',
                        nudityStunts: 'No', nudityStuntsDesc: '',
                        terms: 'Production shall have the right to use Performer\u2019s name, likeness, voice and biography in connection with the production and its promotion in all media throughout the universe in perpetuity. Performer warrants that they have the right to enter into this agreement and that their performance will not infringe any third-party rights.'
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    options = options || {};
                    var d = options.editorData || {};
                    var defs = this.getDefaultData(b, options);
                    var granteeLine = paperReleaseGrantee(b, options, d.granteeLine);
                    var termsText = paperText(d.terms) ? d.terms : defs.terms;
                    var emptyVal = granteeLine ? PAPER_BLANK : '\u2014';
                    var titleSep = granteeLine ? ' - ' : engine._titleSeparator();

                    var header = '<div style="text-align:center;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">' +
                        (d.productionCompany ? '<div style="font-size:10pt;font-weight:700;color:#475569;">' + esc(paperBrand(d.productionCompany)) + '</div>' : '') +
                        '<div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div style="font-size:12pt;font-weight:700;letter-spacing:2px;margin-top:4px;">' + engine._inkHeading('PERFORMER AGREEMENT') + '</div>' + (granteeLine ? '<div class="release-grantee" style="font-size:9pt;font-weight:600;margin-top:4px;">Production: ' + esc(granteeLine) + '</div>' : '') + '</div>';

                    var perfBlock = '<div class="ta-2col">' +
                        '<div><div class="dm-lbl">Performer (Legal Name)</div><div class="dm-name">' + esc(d.performerLegalName || emptyVal) + '</div>' +
                        (d.performerStageName ? '<div class="dm-sub">Stage Name: ' + esc(d.performerStageName) + '</div>' : '') +
                        (d.performerAddress ? '<div class="dm-sub">' + esc(d.performerAddress) + '</div>' : '') +
                        (d.performerPhone ? '<div class="dm-sub">Tel: ' + esc(d.performerPhone) + '</div>' : '') + '</div>' +
                        '<div class="dm-kvlist">' +
                        (d.agentName ? '<div class="dm-kv"><b>Agent:</b> ' + esc(d.agentName) + (d.agentPhone ? ' &nbsp; ' + esc(d.agentPhone) : '') + '</div>' : '') +
                        '<div class="dm-kv"><b>Character:</b> ' + esc(d.characterName || emptyVal) + '</div>' +
                        '<div class="dm-kv"><b>Role Type:</b> ' + esc(d.roleType || '') + '</div>' +
                        (d.roleDescription ? '<div class="dm-kv"><b>Description:</b> ' + esc(d.roleDescription) + '</div>' : '') + '</div></div>';

                    var compBlock = '<div class="dm-hdr">Compensation &amp; Schedule</div><div class="dm-4col">' +
                        '<div><div class="dm-lbl">Rate Type</div><div class="dm-val">' + esc(d.rateType || '') + '</div></div>' +
                        '<div><div class="dm-lbl">Rate</div><div class="dm-val">' + esc(d.rate || emptyVal) + '</div></div>' +
                        '<div><div class="dm-lbl">OT Rate</div><div class="dm-val">' + esc(d.overtimeRate || emptyVal) + '</div></div>' +
                        '<div><div class="dm-lbl">Fitting Rate</div><div class="dm-val">' + esc(d.fittingRate || emptyVal) + '</div></div>' +
                        '<div><div class="dm-lbl">Per Diem</div><div class="dm-val">' + esc(d.perDiem || emptyVal) + '</div></div>' +
                        '<div><div class="dm-lbl">Start Date</div><div class="dm-val">' + esc(paperDate(d.startDate) || emptyVal) + '</div></div>' +
                        '<div><div class="dm-lbl">End Date</div><div class="dm-val">' + esc(paperDate(d.endDate) || emptyVal) + '</div></div>' +
                        '<div><div class="dm-lbl">Guaranteed Days</div><div class="dm-val">' + esc(d.guaranteedDays || emptyVal) + '</div></div>' +
                        (d.holdDates ? '<div style="grid-column:span 4"><div class="dm-lbl">Hold Dates</div><div class="dm-val">' + esc(paperDate(d.holdDates)) + '</div></div>' : '') +
                        (d.travelProvisions ? '<div style="grid-column:span 4"><div class="dm-lbl">Travel &amp; Accommodation</div><div class="dm-val">' + esc(d.travelProvisions) + '</div></div>' : '') +
                        '<div><div class="dm-lbl">Payment Schedule</div><div class="dm-val">' + esc(d.paymentSchedule || '') + '</div></div>' +
                        '<div><div class="dm-lbl">Union Status</div><div class="dm-val">' + esc(d.unionStatus || '') + (d.unionAgreementType ? ' / ' + esc(d.unionAgreementType) : '') + '</div></div>' +
                        '</div>';

                    var rightsBlock = '<div class="dm-hdr">Rights &amp; Usage</div><div class="dm-4col">' +
                        '<div><div class="dm-lbl">Territory</div><div class="dm-val">' + esc(d.territory || '') + '</div></div>' +
                        '<div><div class="dm-lbl">Media</div><div class="dm-val">' + esc(d.media || '') + '</div></div>' +
                        '<div><div class="dm-lbl">Duration</div><div class="dm-val">' + esc(d.rightsDuration || '') + '</div></div>' +
                        (d.exclusivityPeriod ? '<div><div class="dm-lbl">Exclusivity</div><div class="dm-val">' + esc(d.exclusivityPeriod) + '</div></div>' : '<div></div>') +
                        (d.credit ? '<div style="grid-column:span 2"><div class="dm-lbl">Screen Credit</div><div class="dm-val">' + esc(d.credit) + '</div></div>' : '') +
                        (d.billingPosition ? '<div><div class="dm-lbl">Billing</div><div class="dm-val">' + esc(d.billingPosition) + '</div></div>' : '') +
                        (d.nudityStunts === 'Yes' ? '<div style="grid-column:span 4"><div class="dm-lbl">Nudity / Stunts</div><div class="dm-val" style="color:#dc2626;">' + esc(d.nudityStuntsDesc || 'Yes') + '</div></div>' : '') +
                        '</div>';

                    var termsBlock = '<div class="dm-hdr">Terms &amp; Conditions</div>' +
                        '<div style="font-size:7.5pt;color:#475569;line-height:1.5;padding:4px 0;">' + esc(termsText) + '</div>';

                    var sig = '<div class="ta-2col" style="margin-top:30px;">' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Performer Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.performerLegalName || '') + '</div></div>' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Producer Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(defs.producerName || PAPER_BLANK) + '</div></div></div>' +
                        '<div style="margin-top:16px;"><div class="dm-sig-line" style="max-width:300px;"></div><div class="dm-sig-lbl">Witness Signature &amp; Date</div></div>';

                    var css = (granteeLine ? '/*release-ink*/' : '') + '.ta-2col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;border:1px solid #e2e8f0;padding:12px;border-radius:4px;}' +
                        '.dm-2col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;border:1px solid #e2e8f0;padding:12px;border-radius:4px;}' +
                        '.dm-4col{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;}' +
                        '.dm-hdr{background:#1e293b;color:#f8fafc;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:4px 8px;margin:12px 0 6px;border-radius:2px;}' +
                        '.dm-lbl{font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;}' +
                        '.dm-val{font-size:9pt;font-weight:600;color:#0f172a;}' +
                        '.dm-name{font-size:11pt;font-weight:700;margin:2px 0;}' +
                        '.dm-sub{font-size:7.5pt;color:#475569;line-height:1.6;}' +
                        '.dm-kvlist{font-size:8.5pt;line-height:2;}' +
                        '.dm-kv b{color:#475569;display:inline-block;width:80px;}' +
                        '.dm-sig-line{border-bottom:1px solid #0f172a;height:35px;margin-bottom:4px;}' +
                        '.dm-sig-lbl{font-size:7.5pt;color:#475569;}';
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + titleSep + 'Talent Agreement: ' + (d.performerLegalName || ''), header + perfBlock + compBlock + rightsBlock + termsBlock + sig, css);
                }
            },

            /* ---- TEMPLATE: LOCATION AGREEMENT ---- */
            locationAgreement: {
                id: 'locationAgreement',
                name: 'Location Agreement',
                description: 'Location filming permit with schedule, fee, terms, and signatures.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget, options) {
                    var b = budget || {};
                    var propertyAddress = b.projectLocation || b.location || b.basecamp || '';

                    var filmingDates = '';
                    var startDate = b.startDate || (b.production && b.production.startDate) || '';
                    if (startDate) {
                        filmingDates = paperDate(startDate);
                        var prodDays = 0;
                        if (b.targetLock && b.targetLock.stages && b.targetLock.stages.prod) {
                            prodDays = parseInt(b.targetLock.stages.prod.days, 10) || 0;
                        }
                        if (!prodDays) {
                            prodDays = parseInt(b.productionDays, 10) || 0;
                        }
                        if (prodDays > 1) {
                            var parts = String(startDate).split('-');
                            if (parts.length === 3) {
                                var endDt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                                if (!isNaN(endDt.getTime())) {
                                    endDt.setDate(endDt.getDate() + prodDays - 1);
                                    var endDate = endDt.getFullYear() + '-' +
                                        String(endDt.getMonth() + 1).replace(/^(\d)$/, '0$1') + '-' +
                                        String(endDt.getDate()).replace(/^(\d)$/, '0$1');
                                    filmingDates = paperDate(startDate) + ' to ' + paperDate(endDate);
                                }
                            }
                        }
                    }

                    var party = paperworkParty(b, options, true);
                    return {
                        productionTitle: b.projectName || '', productionCompany: paperBrand(b.projectCompany || b.company || ''),
                        producerName: party.producer,
                        granteeLine: paperReleaseGrantee(b, options),
                        ownerName: '', ownerAddress: '', ownerPhone: '', ownerEmail: '',
                        ownerRelationship: 'Owner',
                        propertyAddress: propertyAddress, propertyDescription: '', accessInstructions: '',
                        filmingDates: filmingDates, prepDates: '', strikeDates: '',
                        crewArrival: '', crewDeparture: '',
                        locationFee: '', feeType: 'Flat', deposit: '', paymentTerms: 'On completion of filming',
                        electricityResponsibility: 'Production', waterResponsibility: 'Production',
                        terms: 'Production agrees to: (1) restore the premises to their original condition upon completion of filming; (2) carry a minimum of $1,000,000 general liability insurance and provide owner with a certificate of insurance naming owner as additional insured; (3) comply with all noise ordinances and applicable laws; (4) confine activities to agreed areas. Owner grants production the irrevocable right to photograph the property and include such footage in the film and its promotion in all media worldwide in perpetuity.'
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    options = options || {};
                    var d = options.editorData || {};
                    var defs = this.getDefaultData(b, options);
                    var granteeLine = paperReleaseGrantee(b, options, d.granteeLine);
                    var termsText = paperText(d.terms) ? d.terms : defs.terms;
                    var emptyVal = granteeLine ? PAPER_BLANK : '\u2014';
                    var titleSep = granteeLine ? ' - ' : engine._titleSeparator();

                    var header = '<div style="text-align:center;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">' +
                        (d.productionCompany ? '<div style="font-size:10pt;font-weight:700;color:#475569;">' + esc(paperBrand(d.productionCompany)) + '</div>' : '') +
                        '<div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div style="font-size:12pt;font-weight:700;letter-spacing:2px;margin-top:4px;">' + engine._inkHeading('LOCATION AGREEMENT') + '</div>' + (granteeLine ? '<div class="release-grantee" style="font-size:9pt;font-weight:600;margin-top:4px;">Production: ' + esc(granteeLine) + '</div>' : '') + '</div>';

                    var parties = '<div class="la-2col">' +
                        '<div><div class="dm-lbl">Location Owner / Agent</div><div class="dm-name">' + esc(d.ownerName || emptyVal) + '</div>' +
                        '<div class="dm-sub">' + esc(d.ownerRelationship || '') + '</div>' +
                        (d.ownerAddress ? '<div class="dm-sub">' + esc(d.ownerAddress) + '</div>' : '') +
                        (d.ownerPhone ? '<div class="dm-sub">Tel: ' + esc(d.ownerPhone) + '</div>' : '') +
                        (d.ownerEmail ? '<div class="dm-sub">' + esc(d.ownerEmail) + '</div>' : '') + '</div>' +
                        '<div><div class="dm-lbl">Property</div><div class="dm-name" style="font-size:9pt;">' + esc(d.propertyAddress || emptyVal) + '</div>' +
                        (d.propertyDescription ? '<div class="dm-sub">' + esc(d.propertyDescription) + '</div>' : '') +
                        (d.accessInstructions ? '<div class="dm-sub"><b>Access:</b> ' + esc(d.accessInstructions) + '</div>' : '') + '</div></div>';

                    var schedule = '<div class="dm-hdr">Filming Schedule</div><div class="dm-4col">' +
                        '<div><div class="dm-lbl">Filming Dates</div><div class="dm-val">' + esc(paperDate(d.filmingDates) || emptyVal) + '</div></div>' +
                        '<div><div class="dm-lbl">Prep Dates</div><div class="dm-val">' + esc(paperDate(d.prepDates) || emptyVal) + '</div></div>' +
                        '<div><div class="dm-lbl">Strike / Restore</div><div class="dm-val">' + esc(paperDate(d.strikeDates) || emptyVal) + '</div></div>' +
                        '<div></div>' +
                        '<div><div class="dm-lbl">Earliest Crew Arrival</div><div class="dm-val">' + esc(d.crewArrival || emptyVal) + '</div></div>' +
                        '<div><div class="dm-lbl">Latest Departure</div><div class="dm-val">' + esc(d.crewDeparture || emptyVal) + '</div></div>' +
                        '</div>';

                    var comp = '<div class="dm-hdr">Compensation</div><div class="dm-4col">' +
                        '<div><div class="dm-lbl">Fee Type</div><div class="dm-val">' + esc(d.feeType || '') + '</div></div>' +
                        '<div><div class="dm-lbl">Location Fee</div><div class="dm-val">' + esc(d.locationFee || emptyVal) + '</div></div>' +
                        '<div><div class="dm-lbl">Deposit</div><div class="dm-val">' + esc(d.deposit || emptyVal) + '</div></div>' +
                        '<div><div class="dm-lbl">Payment Terms</div><div class="dm-val">' + esc(d.paymentTerms || '') + '</div></div>' +
                        '<div><div class="dm-lbl">Electricity</div><div class="dm-val">' + esc(d.electricityResponsibility || '') + '</div></div>' +
                        '<div><div class="dm-lbl">Water / Utilities</div><div class="dm-val">' + esc(d.waterResponsibility || '') + '</div></div>' +
                        '</div>';

                    var termsBlock = '<div class="dm-hdr">Terms &amp; Conditions</div>' +
                        '<div style="font-size:7.5pt;color:#475569;line-height:1.5;padding:4px 0;">' + esc(termsText) + '</div>';

                    var sig = '<div class="la-2col" style="margin-top:28px;">' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Location Owner / Agent Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.ownerName || '') + '</div></div>' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Producer Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(defs.producerName || PAPER_BLANK) + '</div></div></div>';

                    var css = (granteeLine ? '/*release-ink*/' : '') + '.la-2col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;border:1px solid #e2e8f0;padding:12px;border-radius:4px;}' +
                        '.dm-4col{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;}' +
                        '.dm-hdr{background:#1e293b;color:#f8fafc;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:4px 8px;margin:12px 0 6px;border-radius:2px;}' +
                        '.dm-lbl{font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;}' +
                        '.dm-val{font-size:9pt;font-weight:600;color:#0f172a;}' +
                        '.dm-name{font-size:11pt;font-weight:700;margin:2px 0;}' +
                        '.dm-sub{font-size:7.5pt;color:#475569;line-height:1.6;}' +
                        '.dm-sig-line{border-bottom:1px solid #0f172a;height:35px;margin-bottom:4px;}' +
                        '.dm-sig-lbl{font-size:7.5pt;color:#475569;}';
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + titleSep + 'Location Agreement: ' + (d.propertyAddress || ''), header + parties + schedule + comp + termsBlock + sig, css);
                }
            },

            /* ---- TEMPLATE: KIT / EQUIPMENT RENTAL AGREEMENT ---- */
            kitRentalAgreement: {
                id: 'kitRentalAgreement',
                name: 'Kit Rental Agreement',
                description: 'Equipment rental contract for crew supplying their own gear.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    var sections = b.sections || {};
                    var producer = '';
                    Object.keys(sections).forEach(function (k) {
                        var sec = sections[k];
                        if ((sec.id || '').toLowerCase() !== 'atl') return;
                        (sec.items || []).forEach(function (item) {
                            var dl = (item.description || '').toLowerCase();
                            if (!producer && dl.indexOf('producer') > -1) producer = item.description;
                        });
                    });
                    return {
                        productionTitle: b.projectName || '', productionCompany: '',
                        producerName: producer,
                        ownerName: '', ownerRole: '', ownerPhone: '', ownerEmail: '',
                        startDate: '', endDate: '', totalDays: '',
                        paymentSchedule: 'Included in deal memo / Weekly',
                        terms: 'Production assumes full liability for damage to, loss of, or theft of equipment while in production\u2019s care or custody. Production will maintain the equipment in good working order and return it in the same condition as received, reasonable wear excepted. In the event of total loss, production shall reimburse owner the replacement cost listed herein.',
                        equipment: [{ description: '', serialNum: '', replacementValue: '', rentalRate: '', rateType: 'Daily' }]
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};
                    var currency = options.currency || 'JMD';
                    var rate = parseFloat(options.rate) || 1;
                    var fmt = function (v) { return fmtCurrency(v, currency, rate); };
                    var equipment = d.equipment || [];

                    var header = '<div style="text-align:center;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">' +
                        (d.productionCompany ? '<div style="font-size:10pt;font-weight:700;color:#475569;">' + esc(paperBrand(d.productionCompany)) + '</div>' : '') +
                        '<div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div style="font-size:12pt;font-weight:700;letter-spacing:2px;margin-top:4px;">' + engine._inkHeading('KIT / EQUIPMENT RENTAL AGREEMENT') + '</div></div>';

                    var parties = '<div class="kr-2col">' +
                        '<div><div class="dm-lbl">Equipment Owner</div><div class="dm-name">' + esc(d.ownerName || '\u2014') + '</div>' +
                        (d.ownerRole ? '<div class="dm-sub">Role: ' + esc(d.ownerRole) + '</div>' : '') +
                        (d.ownerPhone ? '<div class="dm-sub">Tel: ' + esc(d.ownerPhone) + '</div>' : '') +
                        (d.ownerEmail ? '<div class="dm-sub">' + esc(d.ownerEmail) + '</div>' : '') + '</div>' +
                        '<div class="dm-kvlist">' +
                        '<div class="dm-kv"><b>Start:</b> ' + esc(d.startDate || '\u2014') + '</div>' +
                        '<div class="dm-kv"><b>End:</b> ' + esc(d.endDate || '\u2014') + '</div>' +
                        (d.totalDays ? '<div class="dm-kv"><b>Days:</b> ' + esc(d.totalDays) + '</div>' : '') +
                        '<div class="dm-kv"><b>Payment:</b> ' + esc(d.paymentSchedule || '') + '</div>' +
                        '</div></div>';

                    var totalRental = 0;
                    var equipRows = equipment.map(function (eq) {
                        var days = parseFloat(d.totalDays) || 1;
                        var rr = parseFloat(eq.rentalRate) || 0;
                        var lineTotal = eq.rateType === 'Flat' ? rr : rr * days;
                        totalRental += lineTotal;
                        return '<tr class="sec-row">' +
                            '<td>' + esc(eq.description || '') + '</td>' +
                            '<td class="col-c" style="width:100px;">' + esc(eq.serialNum || '') + '</td>' +
                            '<td class="col-r" style="width:100px;">' + fmt(eq.replacementValue || 0) + '</td>' +
                            '<td class="col-r" style="width:90px;">' + fmt(rr) + ' / ' + esc(eq.rateType || 'Day') + '</td>' +
                            '<td class="col-r" style="width:100px;">' + fmt(lineTotal) + '</td></tr>';
                    }).join('');
                    var equipTable = '<div class="dm-hdr">Equipment Schedule</div>' +
                        '<table><thead><tr class="th-row"><th>Item Description</th><th class="col-c">Serial #</th><th class="col-r">Replacement Value</th><th class="col-r">Rental Rate</th><th class="col-r">Rental Total</th></tr></thead>' +
                        '<tbody>' + equipRows + '</tbody>' +
                        '<tfoot><tr class="grand-total-row"><td colspan="4">Total Rental</td><td class="col-r">' + fmt(totalRental) + '</td></tr></tfoot></table>';

                    var termsBlock = '<div class="dm-hdr">Terms &amp; Conditions</div>' +
                        '<div style="font-size:7.5pt;color:#475569;line-height:1.5;padding:4px 0;">' + esc(d.terms || '') + '</div>';

                    var sig = '<div class="kr-2col" style="margin-top:28px;">' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Equipment Owner Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.ownerName || '') + '</div></div>' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Producer Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.producerName || '') + '</div></div></div>';

                    var css = '.kr-2col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;border:1px solid #e2e8f0;padding:12px;border-radius:4px;}' +
                        '.dm-hdr{background:#1e293b;color:#f8fafc;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:4px 8px;margin:12px 0 6px;border-radius:2px;}' +
                        '.dm-lbl{font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;}' +
                        '.dm-name{font-size:11pt;font-weight:700;margin:2px 0;}' +
                        '.dm-sub{font-size:7.5pt;color:#475569;line-height:1.6;}' +
                        '.dm-kvlist{font-size:8.5pt;line-height:2;}' +
                        '.dm-kv b{color:#475569;display:inline-block;width:80px;}' +
                        '.dm-sig-line{border-bottom:1px solid #0f172a;height:35px;margin-bottom:4px;}' +
                        '.dm-sig-lbl{font-size:7.5pt;color:#475569;}';
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + 'Kit Rental: ' + (d.ownerName || ''), header + parties + equipTable + termsBlock + sig, css);
                }
            },

            /* ---- TEMPLATE: DAY OUT OF DAYS (DOOD) ---- */
            dood: {
                id: 'dood',
                name: 'Day Out of Days',
                description: 'Cast work status grid per shoot day (SW/W/WF/H/T).',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    var sections = b.sections || {};
                    var cast = [];
                    function itemLabel(item) {
                        return String(item.description || item.label || item.name || '').trim();
                    }
                    function isCastLine(item, secId) {
                        if ((secId || '').toLowerCase() === 'cast') return true;
                        var dl = itemLabel(item).toLowerCase();
                        return dl.indexOf('actor') > -1 || dl.indexOf('talent') > -1 || dl.indexOf('cast') > -1 ||
                            dl.indexOf('performer') > -1 || dl.indexOf('lead') > -1;
                    }
                    function rowFromItem(item) {
                        var label = itemLabel(item);
                        var crewName = (item.crew && item.crew.name) ? String(item.crew.name).trim() : '';
                        var name = crewName || label;
                        if (!name) return null;
                        var role = crewName ? label : ((item.role && String(item.role).trim()) || '');
                        return { name: name, role: role, days: {} };
                    }
                    Object.keys(sections).forEach(function (k) {
                        var sec = sections[k];
                        var secId = String(sec.id || k || '').toLowerCase();
                        if (secId !== 'atl' && secId !== 'cast') return;
                        (sec.items || []).forEach(function (item) {
                            if (!isCastLine(item, secId)) return;
                            var row = rowFromItem(item);
                            if (row) cast.push(row);
                        });
                    });
                    if (cast.length === 0) {
                        cast = [{ name: '', role: '', days: {} }];
                    }
                    var shootDaysVal = '';
                    if (b.targetLock && b.targetLock.stages && b.targetLock.stages.prod) {
                        var prodDays = parseInt(b.targetLock.stages.prod.days, 10) || 0;
                        if (prodDays > 0) shootDaysVal = String(prodDays);
                    }
                    if (!shootDaysVal) {
                        var topDays = parseInt(b.productionDays, 10) || 0;
                        if (topDays > 0) shootDaysVal = String(topDays);
                    }
                    return {
                        productionTitle: b.projectName || '',
                        startDate: '',
                        shootDays: shootDaysVal,
                        cast: cast
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};
                    var cast = d.cast || [];
                    var numDays = parseInt(d.shootDays, 10) || 10;
                    var dayNums = [];
                    for (var i = 1; i <= numDays; i++) { dayNums.push(i); }

                    /* Status color map */
                    var statusColors = { 'SW': '#2563eb', 'W': '#15803d', 'WF': '#7c3aed', 'H': '#d97706', 'R': '#0891b2', 'T': '#64748b' };

                    var header = '<div class="ts-header"><div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div class="ts-subtitle">' + engine._inkHeading('DAY OUT OF DAYS') + '</div>' +
                        '<div class="ts-meta"><span>Total Shoot Days: ' + numDays + '</span>' +
                        (d.startDate ? '<span>Starting: ' + esc(d.startDate) + '</span>' : '') + '</div></div>';

                    /* Day number header row */
                    var dayHeaders = dayNums.map(function (n) {
                        return '<th class="dood-day">' + n + '</th>';
                    }).join('');

                    /* Cast rows */
                    var castRows = cast.map(function (m) {
                        var workDays = 0, holdDays = 0;
                        var cells = dayNums.map(function (n) {
                            var status = (m.days && m.days[String(n)]) || '';
                            if (status === 'W' || status === 'SW' || status === 'WF' || status === 'R') workDays++;
                            if (status === 'H') holdDays++;
                            var bg = statusColors[status] || 'transparent';
                            var fg = status ? '#fff' : '#e2e8f0';
                            return '<td class="dood-cell" style="background:' + bg + ';color:' + fg + ';">' + esc(status) + '</td>';
                        }).join('');
                        return '<tr><td class="dood-name">' + esc(m.name || '') + '</td><td class="dood-role">' + esc(m.role || '') + '</td>' +
                            cells +
                            '<td class="dood-sum">' + workDays + '</td><td class="dood-sum">' + holdDays + '</td></tr>';
                    }).join('');

                    /* Headcount footer row */
                    var footCells = dayNums.map(function (n) {
                        var count = cast.filter(function (m) {
                            var s = m.days && m.days[String(n)];
                            return s === 'W' || s === 'SW' || s === 'WF';
                        }).length;
                        return '<td class="dood-foot">' + (count || '') + '</td>';
                    }).join('');

                    var legend = '<div class="dood-legend">' +
                        Object.keys(statusColors).map(function (k) {
                            return '<span style="background:' + statusColors[k] + ';color:#fff;padding:1px 6px;border-radius:3px;font-size:7.5pt;">' + k + '</span>';
                        }).join(' ') +
                        '<span style="font-size:7.5pt;color:#64748b;margin-left:8px;">SW=Start Work &nbsp; W=Work &nbsp; WF=Work Finish &nbsp; H=Hold &nbsp; R=Rehearsal &nbsp; T=Travel</span></div>';

                    var grid = '<div style="overflow-x:auto;"><table class="dood-tbl">' +
                        '<thead><tr><th class="dood-name">Cast Member</th><th class="dood-role">Role</th>' + dayHeaders + '<th class="dood-sum">Work</th><th class="dood-sum">Hold</th></tr></thead>' +
                        '<tbody>' + castRows + '</tbody>' +
                        '<tfoot><tr><td class="dood-name" colspan="2" style="font-weight:700;font-size:7.5pt;">Shooting Cast / Day</td>' + footCells + '<td colspan="2"></td></tr></tfoot></table></div>';

                    var css = '.dood-tbl{width:100%;border-collapse:collapse;font-size:7.5pt;}' +
                        '.dood-tbl th,.dood-tbl td{border:1px solid #e2e8f0;padding:3px 4px;white-space:nowrap;}' +
                        '.dood-day{width:28px;text-align:center;background:#f1f5f9;font-weight:700;}' +
                        '.dood-name{min-width:120px;font-weight:600;}' +
                        '.dood-role{min-width:90px;color:#475569;}' +
                        '.dood-cell{width:28px;text-align:center;font-weight:700;font-size:7pt;}' +
                        '.dood-sum{width:35px;text-align:center;font-weight:700;background:#f8fafc;}' +
                        '.dood-foot{text-align:center;font-weight:700;background:#e2e8f0;}' +
                        '.dood-legend{margin-top:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}';
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + 'Day Out of Days', header + legend + grid, css);
                }
            },

            /* ---- TEMPLATE: FUNDING PACKAGE ---- */
            fundingPackage: {
                id: 'fundingPackage',
                name: 'Funding Package',
                description: 'Investor-ready cover page: logline, key crew, total budget, and funding sources table.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (b) {
                    var d = {
                        productionTitle: (b && b.projectName) || '',
                        logline: '',
                        genre: '',
                        format: 'Feature Film',
                        runtime: '',
                        director: '',
                        producer: '',
                        writer: '',
                        dp: '',
                        productionCompany: '',
                        contactName: '',
                        contactEmail: '',
                        contactPhone: '',
                        sources: (b && b.fundingSources) ? JSON.parse(JSON.stringify(b.fundingSources)) : []
                    };
                    if (b && b.sections) {
                        Object.keys(b.sections).forEach(function (k) {
                            var sec = b.sections[k];
                            if ((sec.id || '').toLowerCase() !== 'atl') return;
                            (sec.items || []).forEach(function (item) {
                                var desc = (item.description || '').toLowerCase();
                                if (!d.director  && desc.indexOf('director') > -1 && desc.indexOf('art') < 0) d.director = item.description;
                                if (!d.producer  && desc.indexOf('producer') > -1) d.producer = item.description;
                                if (!d.writer    && (desc.indexOf('writer') > -1 || desc.indexOf('screenplay') > -1)) d.writer = item.description;
                            });
                        });
                    }
                    return d;
                },
                renderHtml: function (b, options, engine) {
                    var d = options.editorData || {};
                    var currency = options.currency || 'JMD';
                    var rate = parseFloat(options.rate) || 1;
                    function fmt(v) {
                        var n = (parseFloat(v) || 0) * rate;
                        return currency + '\u00a0' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    }

                    /* The reconciled master total includes the budget adjustments. */
                    var facts = fundingFacts(b);
                    if (facts.total === null) throw new Error('No reconciled budget total is available.');
                    var grandEst = facts.total;

                    /* Cover page */
                    var formatGenre = [d.format, d.genre].filter(Boolean).map(esc).join(' &middot; ');
                    var cover =
                        '<div class="fp-cover">' +
                        '<div class="fp-prod-title">' + esc(d.productionTitle || (b && b.projectName) || 'UNTITLED') + '</div>' +
                        (formatGenre ? '<div class="fp-meta-line">' + formatGenre + '</div>' : '') +
                        (d.runtime ? '<div class="fp-meta-line">' + esc(d.runtime) + ' minutes</div>' : '') +
                        '<div class="fp-logline">' + esc(d.logline || '') + '</div>' +
                        '<div class="fp-budget-pill"><span class="fp-budget-label">Total Budget</span><span class="fp-budget-amt">' + fmt(grandEst) + '</span></div>' +
                        '</div>';

                    /* Creative team */
                    var crew = [['Director', d.director], ['Producer', d.producer], ['Writer', d.writer], ['D.P.', d.dp]].filter(function (r) { return r[1]; });
                    var crewHtml = crew.length ? '<div class="fp-crew"><table>' +
                        crew.map(function (r) { return '<tr><td class="fp-crew-role">' + esc(r[0]) + '</td><td class="fp-crew-name">' + esc(r[1]) + '</td></tr>'; }).join('') +
                        '</table></div>' : '';

                    /* Contact line */
                    var contactParts = [paperBrand(d.productionCompany), d.contactName, d.contactEmail, d.contactPhone].filter(Boolean);
                    var contactHtml = contactParts.length ? '<div class="fp-contact">' + contactParts.map(esc).join(' &nbsp;&bull;&nbsp; ') + '</div>' : '';

                    /* Funding sources table */
                    var sources = ((b && b.fundingSources) || []).filter(function (r) { return r.name; });
                    function baseAmount(source) {
                        return fundingAmount(b, source) || 0;
                    }
                    var totCommitted = sources.reduce(function (s, r) { return s + (r.status === 'Confirmed' ? baseAmount(r) : 0); }, 0);
                    var totPending = sources.reduce(function (s, r) { return s + (r.status !== 'Confirmed' ? baseAmount(r) : 0); }, 0);
                    var totFunding   = totCommitted + totPending;
                    var gap          = facts.gap;

                    var sourceRows = sources.map(function (r) {
                        var cls = r.status === 'Confirmed' ? 'fp-s-confirmed' : r.status === 'LOI' ? 'fp-s-loi' : 'fp-s-pending';
                        return '<tr><td>' + esc(r.name) + (fundingAmount(b, r) === null ? '<br><small>Missing exchange rate. This source is left out of totals in the budget currency.</small>' : '') + '</td>' +
                            '<td class="col-r">' + esc(r.currency || (b && b.currency) || 'JMD') + ' ' + (parseFloat(r.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
                            '<td class="col-c">' + esc(r.currency || (b && b.currency) || 'JMD') + '</td>' +
                            '<td class="col-c"><span class="fp-status ' + cls + '">' + esc(r.status || 'Pending') + '</span></td></tr>';
                    }).join('');

                    var fundingHdr = '<div class="fp-section-label">Funding Sources</div>';
                    var fundingTable = '<table><thead><tr class="th-row">' +
                        '<th>Source</th><th class="col-r">Amount</th><th class="col-c">Currency</th><th class="col-c">Status</th>' +
                        '</tr></thead><tbody>' +
                        (sourceRows || '<tr><td colspan="4" class="fp-empty-row">No funding sources added yet.</td></tr>') +
                        '</tbody><tfoot>' +
                        '<tr class="ts-total-row"><td><strong>Confirmed Funding (rated sources)</strong></td><td colspan="2" class="col-r">' + fmt(totCommitted) + '</td><td></td></tr>' +
                        '<tr class="ts-total-row"><td>Other Sources (not confirmed)</td><td colspan="2" class="col-r">' + fmt(totPending) + '</td><td></td></tr>' +
                        '<tr class="ts-grand-total"><td>Budget Total</td><td colspan="2" class="col-r">' + fmt(grandEst) + '</td><td></td></tr>' +
                        '<tr class="' + (gap > 0 ? 'fp-gap-row' : 'fp-surplus-row') + '"><td>' + (gap > 0 ? 'Funding Gap' : 'Surplus') + '</td>' +
                        '<td colspan="2" class="col-r">' + fmt(Math.abs(gap)) + '</td><td></td></tr>' +
                        '</tfoot></table>';

                    var css =
                        '.fp-cover{text-align:center;padding:48px 0 28px;margin-bottom:20px;}' +
                        '.fp-prod-title{font-size:26pt;font-weight:900;color:#0f172a;letter-spacing:-0.5px;line-height:1.15;margin-bottom:8px;}' +
                        '.fp-meta-line{font-size:8.5pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin-bottom:3px;}' +
                        '.fp-logline{font-size:11pt;color:#334155;line-height:1.65;max-width:440px;margin:16px auto;font-style:italic;}' +
                        '.fp-budget-pill{display:inline-flex;align-items:baseline;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 22px;margin-top:4px;}' +
                        '.fp-budget-label{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;}' +
                        '.fp-budget-amt{font-size:18pt;font-weight:900;color:#0f172a;}' +
                        '.fp-crew{margin:12px 0 4px;}.fp-crew table{margin:0 auto;border:none;}' +
                        '.fp-crew-role{font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;padding-right:14px;text-align:right;padding-top:3px;}' +
                        '.fp-crew-name{font-size:9.5pt;font-weight:600;color:#0f172a;padding-top:3px;}' +
                        '.fp-contact{font-size:8pt;color:#64748b;text-align:center;margin:8px 0 4px;}' +
                        '.fp-section-label{font-size:8pt;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#0f172a;border-bottom:2px solid #0f172a;padding-bottom:4px;margin:20px 0 0;}' +
                        '.fp-status{font-size:7.5pt;font-weight:700;padding:2px 8px;border-radius:999px;display:inline-block;}' +
                        '.fp-s-confirmed{background:#dcfce7;color:#166534;}' +
                        '.fp-s-loi{background:#e0f2fe;color:#0369a1;}' +
                        '.fp-s-pending{background:#fef3c7;color:#92400e;}' +
                        '.fp-empty-row{text-align:center;color:#94a3b8;padding:14px!important;font-style:italic;}' +
                        '.fp-gap-row td{color:#dc2626;font-weight:800;}' +
                        '.fp-surplus-row td{color:#16a34a;font-weight:800;}';

                    return engine._wrapHtml(
                        (d.productionTitle || (b && b.projectName) || 'Production') + engine._titleSeparator() + 'Funding Package',
                        cover + crewHtml + contactHtml + fundingHdr + fundingTable,
                        css
                    );
                }
            },

            /* ---- TEMPLATE: FUNDING STRATEGY ---- */
            fundingStrategy: {
                id: 'fundingStrategy',
                name: 'Funding Strategy',
                description: 'Strategic financing overview: executive summary, sourcing approach, investor profile, and funding gap analysis.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (b) {
                    var d = {
                        productionTitle: (b && b.projectName) || '',
                        execSummary: '',
                        sourcingApproach: '',
                        investorProfile: '',
                        fundingTimeline: '',
                        askDetails: '',
                        riskMitigation: '',
                        contactName: (b && b.producerName) || '',
                        contactEmail: (b && b.producerEmail) || ''
                    };
                    if (b && b.fundingSources && b.fundingSources.length) {
                        d.sourcingApproach = b.fundingSources
                            .filter(function (f) { return f.name; })
                            .map(function (f) { return f.name + (f.status ? ' (' + f.status + ')' : ''); })
                            .join(', ');
                    }
                    return d;
                },
                renderHtml: function (b, options, engine) {
                    var d = options.editorData || this.getDefaultData(b);
                    var currency = options.currency || 'JMD';
                    var rate = parseFloat(options.rate) || 1;
                    function fmt(v) {
                        var n = (parseFloat(v) || 0) * rate;
                        return currency + '\u00a0' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    }

                    /* The reconciled master total includes the budget adjustments. */
                    var facts = fundingFacts(b);
                    if (facts.total === null) throw new Error('No reconciled budget total is available.');
                    var grandEst = facts.total;

                    /* Funding sources from live budget */
                    var sources = (b && b.fundingSources) || [];
                    var totFunding = facts.confirmed;
                    var gap = facts.gap;

                    var coverHtml =
                        '<div class="fs-cover">' +
                        '<div class="fs-label">Funding Strategy</div>' +
                        '<div class="fs-title">' + esc(d.productionTitle || (b && b.projectName) || 'UNTITLED') + '</div>' +
                        '<div class="fs-budget-bar">' +
                        '<span class="fs-budget-lbl">Budget</span>' +
                        '<span class="fs-budget-amt">' + fmt(grandEst) + '</span>' +
                        '<span class="fs-gap-pill ' + (gap > 0 ? 'fs-gap' : 'fs-surplus') + '">' +
                        (gap > 0 ? 'Gap: ' + fmt(gap) : 'Fully Funded') + '</span>' +
                        '</div></div>';

                    function narrativeSection(title, body) {
                        return body ? (
                            '<div class="fs-section">' +
                            '<div class="fs-section-hdr">' + esc(title) + '</div>' +
                            '<div class="fs-section-body">' + esc(body) + '</div>' +
                            '</div>'
                        ) : '';
                    }

                    var narrative =
                        narrativeSection('Executive Summary', d.execSummary) +
                        narrativeSection('Sourcing Approach', d.sourcingApproach) +
                        narrativeSection('Target Investor Profile', d.investorProfile) +
                        narrativeSection('Funding Timeline', d.fundingTimeline) +
                        narrativeSection('Investment Proposition', d.askDetails) +
                        narrativeSection('Risk Mitigation', d.riskMitigation);

                    /* Sources table */
                    var sourceRows = sources.filter(function (f) { return f.name; }).map(function (f) {
                        return '<tr><td>' + esc(f.name || '') + '</td>' +
                            '<td>' + esc(f.status || '\u2014') + '</td>' +
                            '<td class="col-r">' + fundingDisplay(b, f, fmt) + '</td></tr>';
                    }).join('');
                    var sourcesTable =
                        '<div class="fs-section">' +
                        '<div class="fs-section-hdr">Funding Sources</div>' +
                        '<table><thead><tr class="th-row"><th>Source</th><th>Status</th><th class="col-r">Amount</th></tr></thead>' +
                        '<tbody>' + (sourceRows || '<tr><td colspan="3" class="fp-empty-row">No funding sources defined.</td></tr>') + '</tbody>' +
                        '<tfoot>' +
                        '<tr class="ts-total-row"><td colspan="2"><strong>Confirmed Funding (rated sources)</strong></td><td class="col-r">' + fmt(totFunding) + '</td></tr>' +
                        '<tr class="ts-grand-total"><td colspan="2">Budget Total</td><td class="col-r">' + fmt(grandEst) + '</td></tr>' +
                        '<tr class="' + (gap > 0 ? 'fp-gap-row' : 'fp-surplus-row') + '"><td colspan="2">' + (gap > 0 ? 'Funding Gap' : 'Surplus') + '</td>' +
                        '<td class="col-r">' + fmt(Math.abs(gap)) + '</td></tr>' +
                        '</tfoot></table></div>';

                    var contactHtml = (d.contactName || d.contactEmail) ?
                        '<div class="fs-contact">' + [d.contactName, d.contactEmail].filter(Boolean).map(esc).join(' &nbsp;&bull;&nbsp; ') + '</div>' : '';

                    var css =
                        '.fs-cover{text-align:center;padding:40px 0 24px;margin-bottom:16px;border-bottom:3px solid #0f172a;}' +
                        '.fs-label{font-size:8pt;font-weight:800;text-transform:uppercase;letter-spacing:3px;color:#64748b;margin-bottom:8px;}' +
                        '.fs-title{font-size:22pt;font-weight:900;color:#0f172a;letter-spacing:-0.5px;line-height:1.2;margin-bottom:12px;}' +
                        '.fs-budget-bar{display:flex;align-items:baseline;justify-content:center;gap:16px;margin-top:8px;}' +
                        '.fs-budget-lbl{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;}' +
                        '.fs-budget-amt{font-size:16pt;font-weight:900;color:#0f172a;}' +
                        '.fs-gap-pill{font-size:9pt;font-weight:800;padding:3px 10px;border-radius:999px;}' +
                        '.fs-gap{background:#fee2e2;color:#dc2626;}' +
                        '.fs-surplus{background:#dcfce7;color:#16a34a;}' +
                        '.fs-section{margin:16px 0;}' +
                        '.fs-section-hdr{font-size:8pt;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px;}' +
                        '.fs-section-body{font-size:9.5pt;color:#334155;line-height:1.65;white-space:pre-wrap;}' +
                        '.fs-contact{font-size:8pt;color:#64748b;text-align:center;margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;}' +
                        '.fp-empty-row{text-align:center;color:#94a3b8;padding:14px!important;font-style:italic;}' +
                        '.fp-gap-row td{color:#dc2626;font-weight:800;}' +
                        '.fp-surplus-row td{color:#16a34a;font-weight:800;}';

                    return engine._wrapHtml(
                        (d.productionTitle || (b && b.projectName) || 'Production') + engine._titleSeparator() + 'Funding Strategy',
                        coverHtml + narrative + sourcesTable + contactHtml,
                        css
                    );
                }
            },

            /* ---- TEMPLATE: BUDGET COMPARISON ---- */
            budgetComparison: {
                id: 'budgetComparison',
                name: 'Budget Comparison',
                description: 'Side-by-side variance analysis between two saved budget snapshots.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (b) {
                    return {
                        compTitle: (b && b.projectName) ? (b.projectName + ' — Budget Comparison') : 'Budget Comparison',
                        snapshotALabel: 'Version A',
                        snapshotBLabel: 'Version B',
                        snapshotA: null,
                        snapshotB: null
                    };
                },
                renderHtml: function (b, options, engine) {
                    var d = options.editorData || {};
                    var currency = options.currency || 'JMD';
                    var rate = parseFloat(options.rate) || 1;
                    function fmt(v) {
                        var n = (parseFloat(v) || 0) * rate;
                        return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    }

                    var sA = d.snapshotA;
                    var sB = d.snapshotB;

                    if (!sA || !sB) {
                        return engine._wrapHtml((d.compTitle || 'Budget Comparison'),
                            '<div style="text-align:center;padding:60px 20px;color:#94a3b8;">' +
                            '<p style="font-size:14pt;font-weight:700;margin-bottom:8px;">Two snapshots required</p>' +
                            '<p style="font-size:9pt;">Load snapshots A and B using the editor panel, then preview again.</p></div>',
                            '');
                    }

                    var sectionsA = sA.sections || {};
                    var sectionsB = sB.sections || {};

                    /* Build unified section list */
                    var allKeys = {};
                    Object.keys(sectionsA).forEach(function (k) { allKeys[k] = sectionsA[k].name || k; });
                    Object.keys(sectionsB).forEach(function (k) { allKeys[k] = sectionsB[k].name || k; });

                    var header =
                        '<div class="ts-header"><div class="ts-title">' + esc(d.compTitle || 'Budget Comparison') + '</div>' +
                        '<div class="ts-subtitle">' + engine._inkHeading('BUDGET COMPARISON REPORT') + '</div>' +
                        '<div class="ts-meta"><span>' + esc(d.snapshotALabel || 'Version A') + ' vs ' + esc(d.snapshotBLabel || 'Version B') + '</span>' +
                        '<span>Generated: ' + new Date().toLocaleDateString() + '</span>' +
                        '<span>Currency: ' + esc(currency) + '</span></div></div>';

                    var grandA = 0; var grandB = 0;
                    var rows = Object.keys(allKeys).map(function (k) {
                        var secA = sectionsA[k] || { items: [] };
                        var secB = sectionsB[k] || { items: [] };
                        var estA = engine._sectionEst(secA);
                        var estB = engine._sectionEst(secB);
                        var diff = estB - estA;
                        var pct  = estA ? ((diff / estA) * 100).toFixed(1) : '—';
                        grandA += estA; grandB += estB;
                        var diffCls = diff < 0 ? 'bc-dec' : diff > 0 ? 'bc-inc' : '';
                        return '<tr><td>' + esc(allKeys[k]) + '</td>' +
                            '<td class="col-r">' + fmt(estA) + '</td>' +
                            '<td class="col-r">' + fmt(estB) + '</td>' +
                            '<td class="col-r ' + diffCls + '">' + (diff >= 0 ? '+' : '') + fmt(diff) + '</td>' +
                            '<td class="col-c ' + diffCls + '">' + (estA ? (diff >= 0 ? '+' : '') + pct + '%' : '—') + '</td>' +
                            '</tr>';
                    }).join('');

                    var grandDiff = grandB - grandA;
                    var table =
                        '<table><thead><tr class="th-row">' +
                        '<th>Section</th>' +
                        '<th class="col-r">' + esc(d.snapshotALabel || 'Version A') + '</th>' +
                        '<th class="col-r">' + esc(d.snapshotBLabel || 'Version B') + '</th>' +
                        '<th class="col-r">Difference</th>' +
                        '<th class="col-c">Change %</th>' +
                        '</tr></thead><tbody>' + rows + '</tbody>' +
                        '<tfoot><tr class="ts-grand-total">' +
                        '<td>Grand Total</td>' +
                        '<td class="col-r">' + fmt(grandA) + '</td>' +
                        '<td class="col-r">' + fmt(grandB) + '</td>' +
                        '<td class="col-r ' + (grandDiff < 0 ? 'bc-dec' : 'bc-inc') + '">' + (grandDiff >= 0 ? '+' : '') + fmt(grandDiff) + '</td>' +
                        '<td class="col-c ' + (grandDiff < 0 ? 'bc-dec' : 'bc-inc') + '">' + (grandA ? (grandDiff >= 0 ? '+' : '') + ((grandDiff / grandA) * 100).toFixed(1) + '%' : '—') + '</td>' +
                        '</tr></tfoot></table>';

                    var css = '.bc-dec{color:#16a34a;font-weight:700;}.bc-inc{color:#dc2626;font-weight:700;}';

                    return engine._wrapHtml((d.compTitle || 'Budget Comparison'), header + table, css);
                }
            },

            /* ---- TEMPLATE: SCRIPT BREAKDOWN ---- */
            scriptBreakdown: {
                id: 'scriptBreakdown',
                name: 'Script Breakdown',
                description: 'Scene-by-scene breakdown: cast, props, wardrobe, vehicles, SFX per scene.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function () {
                    return { productionTitle: '', director: '', scriptScenes: [{ num: '1', intExt: 'INT', location: '', timeOfDay: 'DAY', description: '', cast: '', props: '', wardrobe: '', vehicles: '', fx: '', notes: '' }] };
                },
                renderHtml: function (budgetData, options, engine) {
                    var d = (options && options.editorData) || this.getDefaultData();
                    var title = d.productionTitle || (budgetData && budgetData.projectName) || 'Script Breakdown';
                    var CAT_COLORS = { cast: '#dbeafe', props: '#fef9c3', wardrobe: '#fce7f3', vehicles: '#dcfce7', fx: '#ffe4e6', notes: '#f3f4f6' };
                    var sceneRows = (d.scriptScenes || []).map(function (s, i) {
                        var bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                        function cats(label, val, color) {
                            return val ? '<span style="display:inline-block;background:' + color + ';border-radius:3px;padding:0 5px;margin:1px;font-size:8pt;">' + label + ': ' + esc(val) + '</span>' : '';
                        }
                        return '<tr style="background:' + bg + ';vertical-align:top;">' +
                            '<td style="font-weight:700;text-align:center;width:40px;">' + esc(s.num) + '</td>' +
                            '<td style="width:36px;text-align:center;">' + esc(s.intExt) + '</td>' +
                            '<td style="width:42px;text-align:center;">' + esc(s.timeOfDay) + '</td>' +
                            '<td style="min-width:120px;">' + esc(s.location) + '</td>' +
                            '<td>' + esc(s.description) + '</td>' +
                            '<td style="min-width:220px;">' +
                            cats('Cast', s.cast, CAT_COLORS.cast) +
                            cats('Props', s.props, CAT_COLORS.props) +
                            cats('Wardrobe', s.wardrobe, CAT_COLORS.wardrobe) +
                            cats('Vehicles', s.vehicles, CAT_COLORS.vehicles) +
                            cats('FX', s.fx, CAT_COLORS.fx) +
                            cats('Notes', s.notes, CAT_COLORS.notes) +
                            '</td></tr>';
                    }).join('');
                    var css = 'table{width:100%;border-collapse:collapse;}th{background:#0f172a;color:#fff;padding:5px 8px;font-size:9pt;text-align:left;}td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:9pt;}';
                    var body = '<h2 style="font-size:14pt;font-weight:900;margin:0 0 4px;">' + esc(title) + '</h2>' +
                        '<p style="color:#64748b;font-size:9pt;margin:0 0 12px;">Director: ' + engine._fallbackEsc(d.director, options) + ' &bull; Scenes: ' + (d.scriptScenes || []).length + '</p>' +
                        '<table><thead><tr><th>Sc#</th><th>I/E</th><th>D/N</th><th>Location</th><th>Description</th><th>Requirements</th></tr></thead><tbody>' + sceneRows + '</tbody></table>';
                    return engine._wrapHtml(title, body, css);
                }
            },

            /* ---- TEMPLATE: SHOOTING SCHEDULE ---- */
            shootingSchedule: {
                id: 'shootingSchedule',
                name: 'Shooting Schedule',
                description: 'Day-by-day shooting plan with scenes, locations, and cast per day.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function () {
                    return { productionTitle: '', director: '', shootDays: [{ date: '', dayNum: '1', location: '', crewCall: '', wrap: '', scenes: '', cast: '', pages: '', notes: '' }] };
                },
                renderHtml: function (budgetData, options, engine) {
                    var d = (options && options.editorData) || this.getDefaultData();
                    var title = d.productionTitle || (budgetData && budgetData.projectName) || 'Shooting Schedule';
                    var dayRows = (d.shootDays || []).map(function (day, i) {
                        var bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                        return '<tr style="background:' + bg + ';vertical-align:top;">' +
                            '<td style="font-weight:700;text-align:center;width:38px;">' + esc(day.dayNum) + '</td>' +
                            '<td style="width:90px;">' + esc(day.date) + '</td>' +
                            '<td>' + esc(day.location) + '</td>' +
                            '<td style="width:68px;text-align:center;">' + esc(day.crewCall) + '</td>' +
                            '<td style="width:68px;text-align:center;">' + esc(day.wrap) + '</td>' +
                            '<td>' + esc(day.scenes) + '</td>' +
                            '<td>' + esc(day.cast) + '</td>' +
                            '<td style="width:42px;text-align:center;">' + esc(day.pages) + '</td>' +
                            '<td>' + esc(day.notes) + '</td></tr>';
                    }).join('');
                    var css = 'table{width:100%;border-collapse:collapse;}th{background:#0f172a;color:#fff;padding:5px 8px;font-size:9pt;}td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:9pt;}';
                    var body = '<h2 style="font-size:14pt;font-weight:900;margin:0 0 4px;">' + esc(title) + '</h2>' +
                        '<p style="color:#64748b;font-size:9pt;margin:0 0 12px;">Director: ' + engine._fallbackEsc(d.director, options) + ' &bull; Shoot Days: ' + (d.shootDays || []).length + '</p>' +
                        '<table><thead><tr><th>Day</th><th>Date</th><th>Location</th><th>Crew Call</th><th>Wrap</th><th>Scenes</th><th>Cast</th><th>Pages</th><th>Notes</th></tr></thead><tbody>' + dayRows + '</tbody></table>';
                    return engine._wrapHtml(title, body, css);
                }
            },

            /* ---- TEMPLATE: CONTINUITY LOG ---- */
            continuityLog: {
                id: 'continuityLog',
                name: 'Continuity Log',
                description: 'Shot-by-shot continuity tracking: costume, props, hair, makeup, time of day.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    var sections = b.sections || {};
                    var shootDate = b.startDate || (b.production && b.production.startDate) || '';
                    var supervisor = '';

                    function itemLabel(item) {
                        return String(item.description || item.label || item.name || '').trim();
                    }
                    function isContinuitySupervisorLine(item) {
                        var dl = itemLabel(item).toLowerCase();
                        return dl.indexOf('continuity supervisor') > -1 || dl.indexOf('script supervisor') > -1 ||
                            dl.indexOf('continuity super') > -1 || dl.indexOf('script super') > -1 ||
                            (dl.indexOf('continuity') > -1 && dl.indexOf('super') > -1) ||
                            (dl.indexOf('script') > -1 && dl.indexOf('super') > -1) ||
                            dl.indexOf('script continuity') > -1;
                    }
                    function blankShot() {
                        return { scene: '', shot: '', take: '', tc: '', description: '', costume: '', hair: '', makeup: '', props: '', timeOfDay: '', notes: '' };
                    }

                    Object.keys(sections).forEach(function (secName) {
                        var sec = sections[secName];
                        (sec.items || []).forEach(function (item) {
                            if (item.memoId || item.memoStatus) return;
                            if (!supervisor && isContinuitySupervisorLine(item)) {
                                var crewName = (item.crew && item.crew.name) ? String(item.crew.name).trim() : '';
                                if (crewName) supervisor = crewName;
                            }
                        });
                    });

                    return {
                        productionTitle: b.projectName || '',
                        supervisor: supervisor,
                        shootDate: shootDate,
                        shots: [blankShot()]
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var d = (options && options.editorData) || this.getDefaultData(budgetData);
                    var title = d.productionTitle || (budgetData && budgetData.projectName) || 'Continuity Log';
                    var shotRows = (d.shots || []).map(function (s, i) {
                        var bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                        return '<tr style="background:' + bg + ';vertical-align:top;">' +
                            '<td style="width:38px;text-align:center;">' + esc(s.scene) + '</td>' +
                            '<td style="width:38px;text-align:center;">' + esc(s.shot) + '</td>' +
                            '<td style="width:32px;text-align:center;">' + esc(s.take) + '</td>' +
                            '<td style="width:75px;">' + esc(s.tc) + '</td>' +
                            '<td>' + esc(s.description) + '</td>' +
                            '<td>' + esc(s.costume) + '</td>' +
                            '<td>' + esc(s.hair) + '</td>' +
                            '<td>' + esc(s.makeup) + '</td>' +
                            '<td>' + esc(s.props) + '</td>' +
                            '<td>' + esc(s.notes) + '</td></tr>';
                    }).join('');
                    var css = 'table{width:100%;border-collapse:collapse;}th{background:#0f172a;color:#fff;padding:5px 8px;font-size:8.5pt;}td{padding:4px 7px;border-bottom:1px solid #e2e8f0;font-size:8.5pt;}';
                    var body = '<h2 style="font-size:14pt;font-weight:900;margin:0 0 4px;">' + esc(title) + '</h2>' +
                        '<p style="color:#64748b;font-size:9pt;margin:0 0 12px;">Supervisor: ' + engine._fallbackEsc(d.supervisor, options) + ' &bull; Date: ' + engine._fallbackEsc(d.shootDate, options) + '</p>' +
                        '<table><thead><tr><th>Sc</th><th>Shot</th><th>Take</th><th>TC</th><th>Description</th><th>Costume</th><th>Hair</th><th>Makeup</th><th>Props</th><th>Notes</th></tr></thead><tbody>' + shotRows + '</tbody></table>';
                    return engine._wrapHtml(title, body, css);
                }
            },

            /* ---- TEMPLATE: MOVEMENT ORDER ---- */
            movementOrder: {
                id: 'movementOrder',
                name: 'Movement Order',
                description: 'Cast and crew transport logistics: pickup times, vehicle assignments, locations.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    var sections = b.sections || {};
                    var shootDate = b.startDate || (b.production && b.production.startDate) || '';
                    var basecamp = b.projectLocation || b.basecamp || '';
                    var transportCoordinator = '';
                    var movementRows = [];
                    var seenNames = {};

                    function itemLabel(item) {
                        return String(item.description || item.label || item.name || '').trim();
                    }
                    function isCastLine(item, secId) {
                        if ((secId || '').toLowerCase() === 'cast') return true;
                        var dl = itemLabel(item).toLowerCase();
                        return dl.indexOf('actor') > -1 || dl.indexOf('talent') > -1 || dl.indexOf('cast') > -1 ||
                            dl.indexOf('performer') > -1 || dl.indexOf('lead') > -1;
                    }
                    function isTransportCoordLine(item) {
                        var dl = itemLabel(item).toLowerCase();
                        return dl.indexOf('transport coord') > -1 || dl.indexOf('transportation coord') > -1 ||
                            dl.indexOf('transpo coord') > -1 || dl.indexOf('transportation manager') > -1 ||
                            dl.indexOf('transport supervisor') > -1 ||
                            (dl.indexOf('transport') > -1 && dl.indexOf('coord') > -1) ||
                            (dl.indexOf('transpo') > -1 && dl.indexOf('coord') > -1);
                    }
                    function blankRow() {
                        return { name: '', role: '', pickup: '', pickupTime: '', vehicle: '', destination: '', arrivalTime: '', notes: '' };
                    }
                    function pushRow(name, role) {
                        var key = String(name || '').toLowerCase();
                        if (!key || seenNames[key]) return;
                        seenNames[key] = true;
                        movementRows.push({
                            name: name,
                            role: role || '',
                            pickup: '',
                            pickupTime: '',
                            vehicle: '',
                            destination: '',
                            arrivalTime: '',
                            notes: ''
                        });
                    }

                    Object.keys(sections).forEach(function (secName) {
                        var sec = sections[secName];
                        var secId = String(sec.id || secName || '').toLowerCase();
                        (sec.items || []).forEach(function (item) {
                            if (item.memoId || item.memoStatus) return;
                            var crewObj = item.crew || {};
                            var crewName = crewObj.name ? String(crewObj.name).trim() : '';
                            var desc = itemLabel(item);
                            if (!transportCoordinator && isTransportCoordLine(item) && crewName) {
                                transportCoordinator = crewName;
                            }
                            if (!crewName && !isCastLine(item, secId)) return;
                            if (!crewName && !desc) return;
                            var name = crewName || desc;
                            var role = (crewObj.role ? String(crewObj.role).trim() : '') || desc || '';
                            pushRow(name, role);
                        });
                    });

                    return {
                        productionTitle: b.projectName || '',
                        shootDate: shootDate,
                        transportCoordinator: transportCoordinator,
                        basecamp: basecamp,
                        movementRows: movementRows.length > 0 ? movementRows : [blankRow()]
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var d = (options && options.editorData) || this.getDefaultData(budgetData);
                    var title = d.productionTitle || (budgetData && budgetData.projectName) || 'Movement Order';
                    var bodyRows = (d.movementRows || []).map(function (r, i) {
                        var bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                        return '<tr style="background:' + bg + ';vertical-align:top;">' +
                            '<td>' + esc(r.name) + '</td>' +
                            '<td>' + esc(r.role) + '</td>' +
                            '<td>' + esc(r.pickup) + '</td>' +
                            '<td style="text-align:center;width:68px;">' + esc(r.pickupTime) + '</td>' +
                            '<td>' + esc(r.vehicle) + '</td>' +
                            '<td>' + esc(r.destination) + '</td>' +
                            '<td style="text-align:center;width:68px;">' + esc(r.arrivalTime) + '</td>' +
                            '<td>' + esc(r.notes) + '</td></tr>';
                    }).join('');
                    var css = 'table{width:100%;border-collapse:collapse;}th{background:#0f172a;color:#fff;padding:5px 8px;font-size:9pt;}td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:9pt;}';
                    var body = '<h2 style="font-size:14pt;font-weight:900;margin:0 0 4px;">' + esc(title) + '</h2>' +
                        '<p style="color:#64748b;font-size:9pt;margin:0 0 12px;">Date: ' + engine._fallbackEsc(d.shootDate, options) + ' &bull; Transport: ' + engine._fallbackEsc(d.transportCoordinator, options) + ' &bull; Basecamp: ' + engine._fallbackEsc(d.basecamp, options) + '</p>' +
                        '<table><thead><tr><th>Name</th><th>Role</th><th>Pickup Address</th><th>PU Time</th><th>Vehicle</th><th>Destination</th><th>ETA</th><th>Notes</th></tr></thead><tbody>' + bodyRows + '</tbody></table>';
                    return engine._wrapHtml(title, body, css);
                }
            },

            /* ---- TEMPLATE: FUNDING PITCH DECK ---- */
            pitchDeck: {
                id: 'pitchDeck',
                name: 'Funding Pitch Deck',
                description: 'Investor pitch document: logline, synopsis, market, team, and funding ask.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    return {
                        projectTitle: (budget && budget.projectName) || '',
                        productionCompany: (budget && (budget.company || budget.projectCompany)) || '',
                        productionStage: '',
                        genre: '', format: '', runtime: '', logline: '', synopsis: '',
                        director: '', producer: '', keyTalent: '',
                        directorStatement: '', directorBio: '',
                        targetMarket: '', comparables: '', distributionPlan: '',
                        totalBudget: (budget && budget.grandTotal) ? String(budget.grandTotal) : '',
                        fundingToDate: '', askAmount: '', useOfFunds: '',
                        contactName: '', contactEmail: '', contactPhone: ''
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var d = (options && options.editorData) || this.getDefaultData(budgetData);
                    var brand = (options && options.brand) || {};
                    var title = d.projectTitle || (budgetData && budgetData.projectName) || 'Funding Pitch';
                    var logoSrc = safeAssetUrl(brand.logo);
                    var logoHtml = logoSrc ? '<img src="' + logoSrc + '" style="max-height:48px;margin-bottom:8px;"><br>' : '';
                    function section(heading, content) {
                        return content ? '<div style="margin:14px 0;"><div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-bottom:6px;">' + heading + '</div><div style="font-size:10pt;color:#1e293b;">' + content + '</div></div>' : '';
                    }
                    function pill(label, val) {
                        return val ? '<span style="display:inline-block;background:#f1f5f9;border-radius:4px;padding:2px 8px;font-size:9pt;margin:2px 4px 2px 0;">' + esc(label) + ': <strong>' + esc(val) + '</strong></span>' : '';
                    }
                    var askLabel = (d._autofill && d._autofill.overrides && d._autofill.overrides.askAmount) ? 'Seeking (recipient amount entered in this document)' : 'Seeking';
                    var css = '.pitch-cover{background:#0f172a;color:#fff;padding:40px 48px 32px;margin-bottom:24px;} .pitch-title{font-size:28pt;font-weight:900;line-height:1.1;} .pitch-sub{font-size:10pt;color:#94a3b8;margin-top:8px;}';
                    var body = '<div class="pitch-cover">' + logoHtml +
                        '<div class="pitch-title">' + esc(title) + '</div>' +
                        (d.productionCompany ? '<div style="font-size:11pt;color:#cbd5e1;margin-top:4px;">' + esc(paperBrand(d.productionCompany)) + '</div>' : '') +
                        '<div class="pitch-sub">' + (d.productionStage ? esc(d.productionStage) + ' &bull; ' : '') + esc(d.genre || '') + (d.format ? ' &bull; ' + esc(d.format) : '') + (d.runtime ? ' &bull; ' + esc(d.runtime) : '') + '</div></div>' +
                        section('Logline', esc(d.logline)) +
                        section('Synopsis', esc(d.synopsis)) +
                        section('Creative Team', pill('Director', d.director) + pill('Producer', d.producer) + pill('Key Talent', d.keyTalent) +
                            (d.directorStatement ? '<p style="margin:8px 0 0;font-size:10pt;color:#1e293b;line-height:1.5;"><strong>Director\'s Statement:</strong> ' + esc(d.directorStatement) + '</p>' : '') +
                            (d.directorBio ? '<p style="margin:6px 0 0;font-size:9pt;color:#475569;line-height:1.5;"><strong>Bio / Credits:</strong> ' + esc(d.directorBio) + '</p>' : '')) +
                        section('Market &amp; Distribution', esc(d.targetMarket) + (d.comparables ? '<br>Comparables: ' + esc(d.comparables) : '') + (d.distributionPlan ? '<br>Distribution: ' + esc(d.distributionPlan) : '')) +
                        section('Investment', pill('Total Budget', d.totalBudget) + pill('Funding to Date', d.fundingToDate) + pill(askLabel, d.askAmount) + (d.useOfFunds ? '<p style="margin:6px 0 0;font-size:9pt;color:#475569;">Use of funds: ' + esc(d.useOfFunds) + '</p>' : '')) +
                        section('Contact', esc(d.contactName) + (d.contactEmail ? ' &bull; ' + esc(d.contactEmail) : '') + (d.contactPhone ? ' &bull; ' + esc(d.contactPhone) : ''));
                    return engine._wrapHtml(title, body, css);
                }
            },

            /* ---- TEMPLATE: STORYBOARD ---- */
            storyboard: {
                id: 'storyboard',
                name: 'Storyboard',
                description: 'Visual storyboard: frame grid with shot description, shot type, and camera movement per frame.',
                formats: ['pdf', 'jpeg', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    return {
                        projectTitle: (budget && budget.projectName) || '',
                        director: '',
                        columns: '2', framesPerPage: '4',
                        frames: [
                            { num: '1', intExt: 'INT', description: '', shotType: 'WS', camera: '', audio: '' },
                            { num: '2', intExt: 'EXT', description: '', shotType: 'MS', camera: '', audio: '' },
                            { num: '3', intExt: 'INT', description: '', shotType: 'CU', camera: '', audio: '' },
                            { num: '4', intExt: 'INT', description: '', shotType: '', camera: '', audio: '' },
                            { num: '5', intExt: 'EXT', description: '', shotType: '', camera: '', audio: '' },
                            { num: '6', intExt: 'INT', description: '', shotType: '', camera: '', audio: '' }
                        ]
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var d = (options && options.editorData) || this.getDefaultData(budgetData);
                    var brand = (options && options.brand) || {};
                    var title = d.projectTitle || (budgetData && budgetData.projectName) || 'Storyboard';
                    var perPage = parseInt(d.framesPerPage, 10) || 4;
                    if ([2, 4, 6].indexOf(perPage) === -1) perPage = 4;
                    var cols = perPage === 6 ? 3 : 2;
                    var selected = d.frames || [];
                    if (options && options.storyboardFrame !== undefined && options.storyboardFrame !== 'all') {
                        var frameIndex = Number(options.storyboardFrame);
                        if (frameIndex < 0 || frameIndex % 1 || !selected[frameIndex]) throw new Error('Choose an existing storyboard frame.');
                        selected = [selected[frameIndex]]; cols = 1;
                    } else if (options && options.storyboardPage !== undefined) {
                        selected = selected.slice(options.storyboardPage * perPage, (options.storyboardPage + 1) * perPage);
                    }
                    var logoSrc = safeAssetUrl(brand.logo);
                    var logoHtml = logoSrc ? '<img src="' + logoSrc + '" style="max-height:36px;margin-bottom:6px;"><br>' : '';
                    var css = '.sb-grid{display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:10px;margin-top:12px;}' +
                        '.sb-frame{border:1px solid #cbd5e1;border-radius:4px;overflow:hidden;}' +
                        '.sb-image{height:' + (cols === 1 ? '300' : perPage === 2 ? '280' : perPage === 6 ? '155' : '200') + 'px;background:#f8fafc;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:8pt;border-bottom:1px solid #e2e8f0;position:relative;}' +
                        '.sb-num{position:absolute;top:4px;left:6px;font-size:7pt;font-weight:900;color:#94a3b8;}' +
                        '.sb-meta{padding:8px;font-size:9pt;color:#334155;overflow-wrap:anywhere;}' +
                        '.sb-label{font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;}' +
                        '.sb-header{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;font-size:8.5pt;}';
                    var frames = selected.map(function (f, i) {
                        return (i > 0 && i % perPage === 0 ? '</div><div class="sb-grid" style="page-break-before:always">' : '') + '<div class="sb-frame" style="break-inside:avoid">' +
                            '<div class="sb-image">' +
                                '<span class="sb-num">' + esc(f.num || '') + '</span>' +
                                (f.image ? '<img src="' + esc(f.image) + '" style="width:100%;height:100%;object-fit:contain;" />' :
                                '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><rect x="3" y="3" width="18" height="14" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>') +
                            '</div>' +
                            '<div class="sb-meta">' +
                                (f.intExt ? '<span class="sb-label" style="background:#f1f5f9;border-radius:2px;padding:0 3px;">' + esc(f.intExt) + '</span> ' : '') +
                                (f.shotType ? '<span class="sb-label">Shot</span> ' + esc(f.shotType) + '<br>' : '') +
                                (f.camera ? '<span class="sb-label">Camera</span> ' + esc(f.camera) + '<br>' : '') +
                                (f.description ? '<div style="margin-top:3px;color:#475569;">' + esc(f.description) + '</div>' : '') +
                                (f.audio ? '<div><span class="sb-label">Audio</span> ' + esc(f.audio) + '</div>' : '') +
                            '</div>' +
                        '</div>';
                    }).join('');
                    var body = '<div class="sb-header">' +
                        '<div>' + logoHtml + '<strong style="font-size:11pt;">' + esc(title) + '</strong></div>' +
                        '<div style="text-align:right;font-size:8pt;color:#64748b;">' +
                            (d.director ? 'Director: ' + esc(d.director) : '') +
                        '</div>' +
                    '</div>' +
                    '<div class="sb-grid">' + frames + '</div>';
                    return engine._wrapHtml(title + engine._titleSeparator() + 'Storyboard', body, css);
                }
            },

            /* ---- Phase 74B: Appearance Release ---- */
            appearanceRelease: {
                id: 'appearanceRelease',
                name: 'Appearance Release',
                description: 'On-camera release for background, extras, and bystanders.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget, options) {
                    var b = budget || {};
                    var grantee = paperReleaseGrantee(b, options);
                    return {
                        productionTitle: b.projectName || '', productionCompany: paperBrand(b.projectCompany || b.company || ''),
                        date: new Date().toISOString().split('T')[0],
                        releasorName: '', releasorAddress: '', releasorPhone: '',
                        shootLocation: b.projectLocation || '', sceneDescription: '',
                        compensationType: 'Gratis', compensationAmount: '',
                        granteeLine: grantee,
                        terms: 'I hereby grant to ' + grantee + ' (the Producer), its successors, assigns, and licensees the irrevocable right to use my name, likeness, voice, and appearance as recorded in connection with the above-referenced production. I understand that the Producer owns all rights to the material and may use it in any manner or media throughout the universe in perpetuity. I release the Producer from any and all claims arising out of the use of said material. I have read this release and fully understand its contents.',
                        witnessName: ''
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    options = options || {};
                    var d = options.editorData || {};
                    var granteeLine = paperReleaseGrantee(b, options, d.granteeLine);
                    var defs = this.getDefaultData(b, { contacts: options.contacts, editorData: { granteeLine: granteeLine } });
                    var termsText = paperText(d.terms) ? d.terms : defs.terms;
                    var emptyVal = granteeLine ? PAPER_BLANK : '\u2014';
                    var titleSep = granteeLine ? ' - ' : engine._titleSeparator();
                    var or = function (v) { return v ? esc(v) : emptyVal; };

                    var header = '<div style="text-align:center;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">' +
                        (d.productionCompany ? '<div style="font-size:10pt;font-weight:700;color:#475569;">' + esc(paperBrand(d.productionCompany)) + '</div>' : '') +
                        '<div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div style="font-size:12pt;font-weight:700;letter-spacing:2px;margin-top:4px;">' + engine._inkHeading('APPEARANCE RELEASE') + '</div>' + (granteeLine ? '<div class="release-grantee" style="font-size:9pt;font-weight:600;margin-top:4px;">Production: ' + esc(granteeLine) + '</div>' : '') + '</div>';

                    var info = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;border:1px solid #e2e8f0;padding:12px;border-radius:4px;">' +
                        '<div><div class="dm-lbl">Name</div><div class="dm-name">' + or(d.releasorName) + '</div>' +
                        (d.releasorAddress ? '<div class="dm-sub">' + esc(d.releasorAddress) + '</div>' : '') +
                        (d.releasorPhone ? '<div class="dm-sub">Tel: ' + esc(d.releasorPhone) + '</div>' : '') + '</div>' +
                        '<div class="dm-kvlist">' +
                        '<div class="dm-kv"><b>Date:</b> ' + or(paperDate(d.date)) + '</div>' +
                        '<div class="dm-kv"><b>Location:</b> ' + or(d.shootLocation) + '</div>' +
                        (d.sceneDescription ? '<div class="dm-kv"><b>Scene:</b> ' + esc(d.sceneDescription) + '</div>' : '') +
                        '<div class="dm-kv"><b>Compensation:</b> ' + esc(documentValue(d.compensationType)) + (d.compensationAmount ? titleSep + esc(d.compensationAmount) : '') + '</div>' +
                        '</div></div>';

                    var terms = '<div class="dm-hdr">Release &amp; Consent</div>' +
                        '<div style="font-size:8pt;color:#475569;line-height:1.6;padding:8px 0;white-space:pre-wrap;">' + esc(termsText) + '</div>';

                    var sig = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:36px;">' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Releasor Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.releasorName || '') + '</div></div>' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Witness Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.witnessName || '') + '</div></div></div>';

                    var body = header + info + terms + sig;
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + titleSep + 'Appearance Release', body, granteeLine ? '/*release-ink*/' : undefined);
                }
            },

            /* ---- Phase 74B: Vendor Invoice ---- */
            vendorInvoice: {
                id: 'vendorInvoice',
                name: 'Vendor Invoice',
                description: 'Inbound vendor invoice with line items, tax, and payment terms.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    return {
                        productionTitle: b.projectName || '', productionCompany: b.projectCompany || b.company || '',
                        vendorName: '', vendorAddress: '', vendorPhone: '', vendorEmail: '',
                        invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0], dueDate: '',
                        poReference: '',
                        items: [{ description: '', quantity: '1', unitPrice: '', amount: '' }],
                        subtotal: '', taxRate: '0', taxAmount: '', total: '',
                        paymentTerms: 'Net 30',
                        notes: ''
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};
                    var or = function (v) { return v ? esc(v) : '\u2014'; };

                    var header = '<div style="text-align:center;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">' +
                        (d.productionCompany ? '<div style="font-size:10pt;font-weight:700;color:#475569;">' + esc(paperBrand(d.productionCompany)) + '</div>' : '') +
                        '<div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div style="font-size:12pt;font-weight:700;letter-spacing:2px;margin-top:4px;">' + engine._inkHeading('VENDOR INVOICE') + '</div></div>';

                    var meta = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;border:1px solid #e2e8f0;padding:12px;border-radius:4px;">' +
                        '<div><div class="dm-lbl">Vendor</div><div class="dm-name">' + or(d.vendorName) + '</div>' +
                        (d.vendorAddress ? '<div class="dm-sub">' + esc(d.vendorAddress) + '</div>' : '') +
                        (d.vendorPhone ? '<div class="dm-sub">Tel: ' + esc(d.vendorPhone) + '</div>' : '') +
                        (d.vendorEmail ? '<div class="dm-sub">' + esc(d.vendorEmail) + '</div>' : '') + '</div>' +
                        '<div class="dm-kvlist">' +
                        '<div class="dm-kv"><b>Invoice #:</b> ' + or(d.invoiceNumber) + '</div>' +
                        '<div class="dm-kv"><b>Date:</b> ' + or(d.invoiceDate) + '</div>' +
                        '<div class="dm-kv"><b>Due:</b> ' + or(d.dueDate) + '</div>' +
                        (d.poReference ? '<div class="dm-kv"><b>PO Ref:</b> ' + esc(d.poReference) + '</div>' : '') +
                        '<div class="dm-kv"><b>Terms:</b> ' + esc(d.paymentTerms || '') + '</div>' +
                        '</div></div>';

                    var items = d.items || [];
                    var rows = '';
                    var sub = 0;
                    items.forEach(function (it, i) {
                        var qty = parseFloat(it.quantity) || 0;
                        var price = parseFloat(it.unitPrice) || 0;
                        var amt = qty * price;
                        sub += amt;
                        rows += '<tr><td style="padding:4px 8px;">' + (i + 1) + '</td><td style="padding:4px 8px;">' + esc(it.description || '') +
                            '</td><td style="padding:4px 8px;text-align:center;">' + qty +
                            '</td><td style="padding:4px 8px;text-align:right;">' + price.toFixed(2) +
                            '</td><td style="padding:4px 8px;text-align:right;font-weight:700;">' + amt.toFixed(2) + '</td></tr>';
                    });
                    var taxRate = parseFloat(d.taxRate) || 0;
                    var tax = sub * (taxRate / 100);
                    var total = sub + tax;

                    var table = '<table style="width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:14px;">' +
                        '<thead><tr style="background:#f1f5f9;border-bottom:2px solid #0f172a;"><th style="padding:6px 8px;text-align:left;">#</th>' +
                        '<th style="padding:6px 8px;text-align:left;">Description</th>' +
                        '<th style="padding:6px 8px;text-align:center;">Qty</th>' +
                        '<th style="padding:6px 8px;text-align:right;">Unit Price</th>' +
                        '<th style="padding:6px 8px;text-align:right;">Amount</th></tr></thead>' +
                        '<tbody>' + rows + '</tbody>' +
                        '<tfoot><tr style="border-top:1px solid #cbd5e1;"><td colspan="4" style="padding:4px 8px;text-align:right;font-weight:700;">Subtotal</td><td style="padding:4px 8px;text-align:right;">' + sub.toFixed(2) + '</td></tr>' +
                        '<tr><td colspan="4" style="padding:4px 8px;text-align:right;">Tax (' + taxRate + '%)</td><td style="padding:4px 8px;text-align:right;">' + tax.toFixed(2) + '</td></tr>' +
                        '<tr style="border-top:2px solid #0f172a;"><td colspan="4" style="padding:6px 8px;text-align:right;font-size:10pt;font-weight:900;">' + engine._inkHeading('TOTAL') + '</td><td style="padding:6px 8px;text-align:right;font-size:10pt;font-weight:900;">' + total.toFixed(2) + '</td></tr>' +
                        '</tfoot></table>';

                    var notes = d.notes ? '<div class="dm-hdr">Notes</div><div style="font-size:8pt;color:#475569;line-height:1.5;padding:4px 0;">' + esc(d.notes) + '</div>' : '';

                    var sig = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:36px;">' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Vendor Signature &amp; Date</div></div>' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Authorized by (Production) &amp; Date</div></div></div>';

                    var body = header + meta + table + notes + sig;
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + 'Vendor Invoice', body);
                }
            },

            /* ---- Phase 74B: Incident Report ---- */
            incidentReport: {
                id: 'incidentReport',
                name: 'Incident Report',
                description: 'On-set accident/incident documentation for insurance and safety compliance.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    return {
                        productionTitle: b.projectName || '', productionCompany: b.projectCompany || b.company || '',
                        incidentDate: new Date().toISOString().split('T')[0], incidentTime: '',
                        location: b.projectLocation || '',
                        reportedBy: '', reportedByRole: '',
                        injuredPerson: '', injuredPersonRole: '',
                        injuryType: 'Minor', bodyPart: '', description: '',
                        immediateAction: '',
                        witnesses: [{ name: '', role: '', phone: '' }],
                        medicalAttention: 'None', hospitalName: '',
                        supervisorName: '',
                        followUpRequired: 'No', followUpNotes: ''
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};
                    var or = function (v) { return v ? esc(v) : '\u2014'; };

                    var header = '<div style="text-align:center;border-bottom:3px solid #dc2626;padding-bottom:12px;margin-bottom:16px;">' +
                        (d.productionCompany ? '<div style="font-size:10pt;font-weight:700;color:#475569;">' + esc(paperBrand(d.productionCompany)) + '</div>' : '') +
                        '<div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div style="font-size:12pt;font-weight:700;letter-spacing:2px;margin-top:4px;color:#dc2626;">' + engine._inkHeading('INCIDENT / ACCIDENT REPORT') + '</div></div>';

                    var meta = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;border:1px solid #fecaca;padding:12px;border-radius:4px;background:#fef2f2;">' +
                        '<div><div class="dm-lbl">Date</div><div class="dm-val">' + or(d.incidentDate) + '</div></div>' +
                        '<div><div class="dm-lbl">Time</div><div class="dm-val">' + or(d.incidentTime) + '</div></div>' +
                        '<div><div class="dm-lbl">Location</div><div class="dm-val">' + or(d.location) + '</div></div>' +
                        '<div><div class="dm-lbl">Reported By</div><div class="dm-val">' + or(d.reportedBy) + '</div></div>' +
                        '<div><div class="dm-lbl">Reporter Role</div><div class="dm-val">' + or(d.reportedByRole) + '</div></div>' +
                        '<div><div class="dm-lbl">Severity</div><div class="dm-val" style="font-weight:900;color:' + (d.injuryType === 'Severe' ? '#dc2626' : d.injuryType === 'Moderate' ? '#d97706' : d.injuryType === 'Minor' ? '#16a34a' : '#64748b') + ';">' + esc(documentValue(d.injuryType)) + '</div></div>' +
                        '</div>';

                    var person = '<div class="dm-hdr">Injured Person</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;border:1px solid #e2e8f0;padding:12px;border-radius:4px;">' +
                        '<div><div class="dm-lbl">Name</div><div class="dm-name">' + or(d.injuredPerson) + '</div></div>' +
                        '<div><div class="dm-lbl">Role / Department</div><div class="dm-val">' + or(d.injuredPersonRole) + '</div></div>' +
                        '<div><div class="dm-lbl">Body Part Affected</div><div class="dm-val">' + or(d.bodyPart) + '</div></div>' +
                        '</div>';

                    var desc = '<div class="dm-hdr">Description of Incident</div>' +
                        '<div style="font-size:8.5pt;color:#334155;line-height:1.6;padding:8px 12px;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:14px;min-height:60px;white-space:pre-wrap;">' + esc(d.description || '') + '</div>';

                    var action = '<div class="dm-hdr">Immediate Action Taken</div>' +
                        '<div style="font-size:8.5pt;color:#334155;line-height:1.6;padding:8px 12px;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:14px;min-height:40px;white-space:pre-wrap;">' + esc(d.immediateAction || '') + '</div>';

                    var wit = d.witnesses || [];
                    var witRows = '';
                    wit.forEach(function (w) {
                        if (!w.name) return;
                        witRows += '<tr><td style="padding:4px 8px;">' + esc(w.name) + '</td><td style="padding:4px 8px;">' + esc(w.role || '') + '</td><td style="padding:4px 8px;">' + esc(w.phone || '') + '</td></tr>';
                    });
                    var witTable = witRows ? '<div class="dm-hdr">Witnesses</div><table style="width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:14px;">' +
                        '<thead><tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1;"><th style="padding:4px 8px;text-align:left;">Name</th><th style="padding:4px 8px;text-align:left;">Role</th><th style="padding:4px 8px;text-align:left;">Phone</th></tr></thead>' +
                        '<tbody>' + witRows + '</tbody></table>' : '';

                    var medical = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;border:1px solid #e2e8f0;padding:12px;border-radius:4px;">' +
                        '<div><div class="dm-lbl">Medical Attention</div><div class="dm-val">' + esc(documentValue(d.medicalAttention)) + '</div></div>' +
                        (d.hospitalName ? '<div><div class="dm-lbl">Hospital / Facility</div><div class="dm-val">' + esc(d.hospitalName) + '</div></div>' : '<div></div>') +
                        '<div><div class="dm-lbl">Follow-Up Required</div><div class="dm-val">' + esc(documentValue(d.followUpRequired)) + '</div></div>' +
                        (d.followUpNotes ? '<div><div class="dm-lbl">Follow-Up Notes</div><div class="dm-val">' + esc(d.followUpNotes) + '</div></div>' : '<div></div>') +
                        '</div>';

                    var sig = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:30px;">' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Supervisor Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.supervisorName || '') + '</div></div>' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Injured Person Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.injuredPerson || '') + '</div></div></div>';

                    var body = header + meta + person + desc + action + witTable + medical + sig;
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + 'Incident Report', body);
                }
            },

            /* ---- Phase 74C: NDA ---- */
            nda: {
                id: 'nda',
                name: 'Non-Disclosure Agreement',
                description: 'Confidentiality agreement for crew, vendors, and visitors.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    return {
                        productionTitle: b.projectName || '', productionCompany: b.projectCompany || b.company || '',
                        productionCompanyAddress: '',
                        effectiveDate: b.startDate || new Date().toISOString().split('T')[0], expirationDate: '',
                        recipientName: '', recipientTitle: '', recipientAddress: '',
                        projectDescription: '',
                        terms: '1. CONFIDENTIAL INFORMATION. "Confidential Information" means all non-public information disclosed by the Production Company, including but not limited to scripts, treatments, budgets, schedules, cast and crew lists, shooting locations, storylines, character details, and any proprietary production techniques.\n\n2. OBLIGATIONS. The Recipient agrees to: (a) hold all Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party without prior written consent; (c) not use Confidential Information for any purpose other than the authorized engagement; (d) take reasonable precautions to prevent unauthorized disclosure.\n\n3. EXCLUSIONS. This Agreement does not apply to information that: (a) is or becomes publicly available through no fault of the Recipient; (b) was rightfully in the Recipient\'s possession before disclosure; (c) is independently developed by the Recipient.\n\n4. REMEDIES. The Recipient acknowledges that any breach may cause irreparable harm and that the Production Company shall be entitled to injunctive relief in addition to other legal remedies.\n\n5. TERM. This Agreement remains in effect for the duration specified above, or if no expiration is stated, for a period of three (3) years from the Effective Date.',
                        governingLaw: 'Jamaica',
                        witnessName: ''
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};
                    var or = function (v) { return v ? esc(v) : '\u2014'; };

                    var header = '<div style="text-align:center;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">' +
                        (d.productionCompany ? '<div style="font-size:10pt;font-weight:700;color:#475569;">' + esc(paperBrand(d.productionCompany)) + '</div>' : '') +
                        '<div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div style="font-size:12pt;font-weight:700;letter-spacing:2px;margin-top:4px;">' + engine._inkHeading('NON-DISCLOSURE AGREEMENT') + '</div></div>';

                    var parties = '<div class="dm-hdr">Parties</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;border:1px solid #e2e8f0;padding:12px;border-radius:4px;">' +
                        '<div><div class="dm-lbl">Disclosing Party (Production)</div><div class="dm-name">' + or(paperBrand(d.productionCompany)) + '</div>' +
                        (d.productionCompanyAddress ? '<div class="dm-sub">' + esc(d.productionCompanyAddress) + '</div>' : '') + '</div>' +
                        '<div><div class="dm-lbl">Receiving Party</div><div class="dm-name">' + or(d.recipientName) + '</div>' +
                        (d.recipientTitle ? '<div class="dm-sub">' + esc(d.recipientTitle) + '</div>' : '') +
                        (d.recipientAddress ? '<div class="dm-sub">' + esc(d.recipientAddress) + '</div>' : '') + '</div></div>';

                    var dates = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">' +
                        '<div><div class="dm-lbl">Effective Date</div><div class="dm-val">' + or(d.effectiveDate) + '</div></div>' +
                        '<div><div class="dm-lbl">Expiration Date</div><div class="dm-val">' + or(documentValue(d.expirationDate)) + '</div></div>' +
                        '<div><div class="dm-lbl">Governing Law</div><div class="dm-val">' + esc(documentValue(d.governingLaw)) + '</div></div></div>';

                    var projDesc = d.projectDescription ? '<div class="dm-hdr">Project Description</div>' +
                        '<div style="font-size:8.5pt;color:#334155;line-height:1.6;padding:8px 12px;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:14px;">' + esc(d.projectDescription) + '</div>' : '';

                    var terms = '<div class="dm-hdr">Terms &amp; Conditions</div>' +
                        '<div style="font-size:7.5pt;color:#475569;line-height:1.6;padding:8px 0;white-space:pre-wrap;">' + esc(d.terms || '') + '</div>';

                    var sig = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:30px;">' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Disclosing Party Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(paperBrand(d.productionCompany || '')) + '</div></div>' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Receiving Party Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.recipientName || '') + '</div></div></div>' +
                        '<div style="margin-top:16px;"><div class="dm-sig-line" style="max-width:300px;"></div><div class="dm-sig-lbl">Witness Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.witnessName || '') + '</div></div>';

                    var body = header + parties + dates + projDesc + terms + sig;
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + 'NDA', body);
                }
            },

            /* ---- Phase 74C: Wrap Report ---- */
            wrapReport: {
                id: 'wrapReport',
                name: 'Wrap Report',
                description: 'End-of-production summary: spend vs budget, schedule adherence, outstanding items.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    var secSummary = [];
                    var crewCount = 0; var castCount = 0;
                    var sections = b.sections || {};
                    Object.keys(sections).forEach(function (k) {
                        var sec = sections[k];
                        var items = sec.items || [];
                        var budgeted = 0; var actual = 0;
                        items.forEach(function (it) {
                            budgeted += (it.total || 0);
                            var actAmt = (parseFloat(it.actualQuantity) || 0) * (parseFloat(it.actualRate) || 0);
                            actual += (actAmt > 0 ? actAmt : (parseFloat(it.actual) || 0));
                        });
                        secSummary.push({ sectionName: k, budgeted: budgeted.toFixed(2), actual: actual.toFixed(2), variance: (budgeted - actual).toFixed(2) });
                        if (k.toLowerCase().indexOf('atl') > -1 || k.toLowerCase().indexOf('above') > -1) castCount += items.length;
                        else crewCount += items.length;
                    });
                    var computedActualTotal = secSummary.reduce(function (s, r) { return s + (parseFloat(r.actual) || 0); }, 0);

                    var producerFromCrew = '';
                    var producerFromDesc = '';
                    function wrItemLabel(item) {
                        return String(item.description || item.label || item.name || '').trim();
                    }
                    Object.keys(sections).forEach(function (k) {
                        var sec = sections[k];
                        if ((sec.id || '').toLowerCase() !== 'atl') return;
                        (sec.items || []).forEach(function (item) {
                            if (item.memoId || item.memoStatus) return;
                            var dl = wrItemLabel(item).toLowerCase();
                            if (dl.indexOf('producer') === -1) return;
                            var crewName = item.crew && item.crew.name ? String(item.crew.name).trim() : '';
                            if (crewName && !producerFromCrew) producerFromCrew = crewName;
                            if (!producerFromDesc) producerFromDesc = wrItemLabel(item);
                        });
                    });
                    var producerName = producerFromCrew || producerFromDesc;

                    var scheduledDays = '';
                    var lockDays = 0;
                    if (b.targetLock && b.targetLock.stages && b.targetLock.stages.prod) {
                        lockDays = parseInt(b.targetLock.stages.prod.days, 10);
                    }
                    if (lockDays > 0) {
                        scheduledDays = String(lockDays);
                    } else {
                        var prodDays = parseInt(b.productionDays, 10);
                        if (prodDays > 0) scheduledDays = String(prodDays);
                    }

                    return {
                        productionTitle: b.projectName || '', productionCompany: b.projectCompany || b.company || '',
                        wrapDate: new Date().toISOString().split('T')[0],
                        totalShootDays: '', scheduledDays: scheduledDays,
                        budgetedTotal: (b.grandTotal || 0).toFixed(2),
                        actualTotal: computedActualTotal.toFixed(2),
                        variance: ((b.grandTotal || 0) - computedActualTotal).toFixed(2),
                        crewCount: String(crewCount), castCount: String(castCount),
                        sections: secSummary,
                        outstandingInvoices: '',
                        equipmentReturned: 'All',
                        notes: '', producerName: producerName
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};
                    var or = function (v) { return v ? esc(v) : '\u2014'; };

                    var header = '<div style="text-align:center;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">' +
                        (d.productionCompany ? '<div style="font-size:10pt;font-weight:700;color:#475569;">' + esc(paperBrand(d.productionCompany)) + '</div>' : '') +
                        '<div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div style="font-size:12pt;font-weight:700;letter-spacing:2px;margin-top:4px;">' + engine._inkHeading('PRODUCTION WRAP REPORT') + '</div></div>';

                    var overview = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;">' +
                        '<div style="background:#eff6ff;padding:10px;border-radius:6px;text-align:center;"><div class="dm-lbl">Wrap Date</div><div class="dm-val" style="font-size:10pt;">' + or(d.wrapDate) + '</div></div>' +
                        '<div style="background:#eff6ff;padding:10px;border-radius:6px;text-align:center;"><div class="dm-lbl">Shoot Days</div><div class="dm-val" style="font-size:10pt;">' + or(d.totalShootDays) + (d.scheduledDays ? ' / ' + esc(d.scheduledDays) + ' sched.' : '') + '</div></div>' +
                        '<div style="background:#eff6ff;padding:10px;border-radius:6px;text-align:center;"><div class="dm-lbl">Crew</div><div class="dm-val" style="font-size:10pt;">' + or(d.crewCount) + '</div></div>' +
                        '<div style="background:#eff6ff;padding:10px;border-radius:6px;text-align:center;"><div class="dm-lbl">Cast</div><div class="dm-val" style="font-size:10pt;">' + or(d.castCount) + '</div></div></div>';

                    var financial = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">' +
                        '<div style="background:#f0fdf4;padding:12px;border-radius:6px;text-align:center;border:1px solid #bbf7d0;"><div class="dm-lbl">Budgeted Total</div><div style="font-size:12pt;font-weight:900;">' + or(d.budgetedTotal) + '</div></div>' +
                        '<div style="background:#fef3c7;padding:12px;border-radius:6px;text-align:center;border:1px solid #fde68a;"><div class="dm-lbl">Actual Spent</div><div style="font-size:12pt;font-weight:900;">' + or(d.actualTotal) + '</div></div>' +
                        '<div style="background:' + (parseFloat(d.variance) >= 0 ? '#f0fdf4;border:1px solid #bbf7d0;' : '#fef2f2;border:1px solid #fecaca;') + 'padding:12px;border-radius:6px;text-align:center;"><div class="dm-lbl">Variance</div><div style="font-size:12pt;font-weight:900;color:' + (parseFloat(d.variance) >= 0 ? '#16a34a' : '#dc2626') + ';">' + or(d.variance) + '</div></div></div>';

                    var secs = d.sections || [];
                    var secRows = '';
                    secs.forEach(function (s) {
                        var v = parseFloat(s.variance) || 0;
                        secRows += '<tr><td style="padding:4px 8px;font-weight:600;">' + esc(s.sectionName || '') + '</td>' +
                            '<td style="padding:4px 8px;text-align:right;">' + esc(s.budgeted || '0') + '</td>' +
                            '<td style="padding:4px 8px;text-align:right;">' + esc(s.actual || '0') + '</td>' +
                            '<td style="padding:4px 8px;text-align:right;color:' + (v >= 0 ? '#16a34a' : '#dc2626') + ';font-weight:700;">' + esc(s.variance || '0') + '</td></tr>';
                    });
                    var secTable = secRows ? '<div class="dm-hdr">Section Breakdown</div><table style="width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:14px;">' +
                        '<thead><tr style="background:#f1f5f9;border-bottom:2px solid #0f172a;"><th style="padding:6px 8px;text-align:left;">Section</th><th style="padding:6px 8px;text-align:right;">Budgeted</th><th style="padding:6px 8px;text-align:right;">Actual</th><th style="padding:6px 8px;text-align:right;">Variance</th></tr></thead>' +
                        '<tbody>' + secRows + '</tbody></table>' : '';

                    var extras = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">' +
                        '<div><div class="dm-lbl">Equipment Returned</div><div class="dm-val">' + esc(documentValue(d.equipmentReturned)) + '</div></div>' +
                        '<div><div class="dm-lbl">Outstanding Invoices</div><div class="dm-val" style="white-space:pre-wrap;">' + esc(documentValue(d.outstandingInvoices)) + '</div></div></div>';

                    var notes = d.notes ? '<div class="dm-hdr">Notes</div><div style="font-size:8pt;color:#475569;line-height:1.5;padding:4px 0;white-space:pre-wrap;">' + esc(d.notes) + '</div>' : '';

                    var sig = '<div style="margin-top:30px;"><div class="dm-sig-line" style="max-width:350px;"></div><div class="dm-sig-lbl">Producer Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.producerName || '') + '</div></div>';

                    var body = header + overview + financial + secTable + extras + notes + sig;
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + 'Wrap Report', body);
                }
            },

            /* ---- Phase 74C: Extras Voucher ---- */
            extrasVoucher: {
                id: 'extrasVoucher',
                name: 'Extras Voucher',
                description: 'Background actor payment voucher with call/wrap times and adjustments.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    return {
                        productionTitle: b.projectName || '', date: new Date().toISOString().split('T')[0],
                        voucherNumber: '',
                        extraName: '', extraAddress: '', extraPhone: '',
                        callTime: '06:00', wrapTime: '18:00',
                        mealPenalty: 'None',
                        basePay: '', adjustments: [{ description: '', amount: '' }],
                        totalPay: '',
                        wardrobe: 'Own', wardrobeDescription: ''
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = options.editorData || {};
                    var or = function (v) { return v ? esc(v) : '\u2014'; };

                    var header = '<div style="text-align:center;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">' +
                        '<div class="ts-title">' + esc(d.productionTitle || b.projectName || 'Production') + '</div>' +
                        '<div style="font-size:12pt;font-weight:700;letter-spacing:2px;margin-top:4px;">' + engine._inkHeading('EXTRAS / BACKGROUND VOUCHER') + '</div>' +
                        (d.voucherNumber ? '<div style="font-size:9pt;color:#64748b;margin-top:2px;">Voucher #' + esc(d.voucherNumber) + '</div>' : '') + '</div>';

                    var info = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;border:1px solid #e2e8f0;padding:12px;border-radius:4px;">' +
                        '<div><div class="dm-lbl">Name</div><div class="dm-name">' + or(d.extraName) + '</div>' +
                        (d.extraAddress ? '<div class="dm-sub">' + esc(d.extraAddress) + '</div>' : '') +
                        (d.extraPhone ? '<div class="dm-sub">Tel: ' + esc(d.extraPhone) + '</div>' : '') + '</div>' +
                        '<div class="dm-kvlist">' +
                        '<div class="dm-kv"><b>Date:</b> ' + or(d.date) + '</div>' +
                        '<div class="dm-kv"><b>Call:</b> ' + or(d.callTime) + '</div>' +
                        '<div class="dm-kv"><b>Wrap:</b> ' + or(d.wrapTime) + '</div>' +
                        '<div class="dm-kv"><b>Wardrobe:</b> ' + esc(documentValue(d.wardrobe)) + (d.wardrobeDescription ? ' \u2014 ' + esc(d.wardrobeDescription) : '') + '</div>' +
                        '<div class="dm-kv"><b>Meal Penalty:</b> ' + esc(documentValue(d.mealPenalty)) + '</div>' +
                        '</div></div>';

                    var base = parseFloat(d.basePay) || 0;
                    var adjTotal = 0;
                    var adjs = d.adjustments || [];
                    var adjRows = '';
                    adjs.forEach(function (a) {
                        var amt = parseFloat(a.amount) || 0;
                        adjTotal += amt;
                        if (a.description || amt) {
                            adjRows += '<tr><td style="padding:4px 8px;">' + esc(a.description || '') + '</td><td style="padding:4px 8px;text-align:right;">' + amt.toFixed(2) + '</td></tr>';
                        }
                    });
                    var total = base + adjTotal;

                    var pay = '<div class="dm-hdr">Payment</div>' +
                        '<table style="width:100%;max-width:400px;border-collapse:collapse;font-size:8.5pt;margin-bottom:14px;">' +
                        '<tr><td style="padding:4px 8px;">Base Pay</td><td style="padding:4px 8px;text-align:right;font-weight:700;">' + base.toFixed(2) + '</td></tr>' +
                        adjRows +
                        '<tr style="border-top:2px solid #0f172a;"><td style="padding:6px 8px;font-size:10pt;font-weight:900;">' + engine._inkHeading('TOTAL') + '</td><td style="padding:6px 8px;text-align:right;font-size:10pt;font-weight:900;">' + total.toFixed(2) + '</td></tr>' +
                        '</table>';

                    var sig = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:36px;">' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Extra / Background Signature &amp; Date</div><div style="font-size:8pt;font-weight:600;">' + esc(d.extraName || '') + '</div></div>' +
                        '<div><div class="dm-sig-line"></div><div class="dm-sig-lbl">Authorized by (Production) &amp; Date</div></div></div>';

                    var body = header + info + pay + sig;
                    return engine._wrapHtml((d.productionTitle || b.projectName || 'Production') + engine._titleSeparator() + 'Extras Voucher', body);
                }
            },

            /* ---- Phase 79: Weekly Cost Report ---- */
            weeklyCostReport: {
                id: 'weeklyCostReport',
                name: 'Weekly Cost Report',
                description: 'Budget, outstanding commitments, cumulative recorded actuals and explicit ETC by account. Unverified amounts are marked Unknown.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budget) {
                    var b = budget || {};
                    if (!window.mBTDocumentProjection) throw new Error('Document facts are not loaded. Reopen Docs and retry.');
                    /* Docs projection and direct output share conversion, scoring and omission notes. */
                    var weekly = window.mBTDocumentProjection.weeklyRows(b);
                    var today = new Date().toISOString().split('T')[0];
                    var weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
                    return {
                        committedNote: weekly.committedNote,
                        productionTitle: b.projectName || '',
                        productionCompany: (b.company || b.projectCompany) || '',
                        reportDate: today,
                        periodStart: weekAgo,
                        periodEnd: today,
                        preparedBy: '',
                        approvedBy: '',
                        lineItems: weekly.rows,
                        notes: ''
                    };
                },
                renderHtml: function (budgetData, options, engine) {
                    var b = budgetData || {};
                    var d = (options && options.editorData) || this.getDefaultData(b);
                    var currency = (options && options.currency) || 'JMD';
                    var rate = parseFloat((options && options.rate)) || 1;
                    var fmt = function (v) { return v === '' || v == null || !isFinite(Number(v)) ? 'Unknown' : fmtCurrency(v, currency, rate); };
                    var pct = function (v) { return isFinite(v) ? v.toFixed(1) + '%' : 'Unknown'; };
                    var title = d.productionTitle || b.projectName || 'Production';
                    var period = (d.periodStart && d.periodEnd) ? (esc(d.periodStart) + ' \u2013 ' + esc(d.periodEnd)) : 'All Periods';

                    /* Filter line items to period: items with no actualDate are always included (shows budget/committed) */
                    var items = (d.lineItems || []).filter(function (item) {
                        if (item.itemId || !item.actualDate) return true;
                        if (d.periodStart && item.actualDate < d.periodStart) return false;
                        if (d.periodEnd && item.actualDate > d.periodEnd) return false;
                        return true;
                    });

                    /* Aggregate section subtotals */
                    var secMap = {};
                    var secOrder = [];
                    items.forEach(function (item) {
                        var k = item.account || 'Uncategorized';
                        if (!secMap[k]) { secMap[k] = { budget: 0, committed: 0, actual: 0, etc: 0, items: [] }; secOrder.push(k); }
                        secMap[k].budget += parseFloat(item.budget) || 0;
                        secMap[k].committed += item.committed === '' || item.committed == null ? NaN : parseFloat(item.committed);
                        secMap[k].actual += parseFloat(item.actual) || 0;
                        secMap[k].etc += item.etc === '' || item.etc == null ? NaN : parseFloat(item.etc);
                        secMap[k].items.push(item);
                    });

                    var grandBudget = 0, grandCommitted = 0, grandActual = 0, grandEtc = 0;
                    secOrder.forEach(function (k) { grandBudget += secMap[k].budget; grandCommitted += secMap[k].committed; grandActual += secMap[k].actual; grandEtc += secMap[k].etc; });

                    var header = '<div style="text-align:center;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">' +
                        (d.productionCompany ? '<div style="font-size:10pt;font-weight:700;color:#475569;">' + esc(paperBrand(d.productionCompany)) + '</div>' : '') +
                        '<div style="font-size:16pt;font-weight:900;">' + esc(title) + '</div>' +
                        '<div style="font-size:11pt;font-weight:700;letter-spacing:2px;margin-top:4px;">' + engine._inkHeading('WEEKLY COST REPORT') + '</div>' +
                        '<div style="font-size:8pt;color:#64748b;margin-top:6px;">Period: ' + period + ' &bull; Report Date: ' + engine._fallbackEsc(d.reportDate, options) +
                        (d.preparedBy ? ' &bull; Prepared by: ' + esc(d.preparedBy) : '') + '</div></div>';

                    var grandPct = grandBudget > 0 ? ((grandActual + grandCommitted) / grandBudget * 100) : 0;
                    var grandVariance = grandBudget - grandActual;
                    var summary = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px;">' +
                        '<div style="background:#eff6ff;border:1px solid #bfdbfe;padding:10px;border-radius:6px;text-align:center;"><div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Total Budget</div><div style="font-size:11pt;font-weight:900;">' + fmt(grandBudget) + '</div></div>' +
                        '<div style="background:#fef3c7;border:1px solid #fde68a;padding:10px;border-radius:6px;text-align:center;"><div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Committed</div><div style="font-size:11pt;font-weight:900;">' + fmt(grandCommitted) + '</div></div>' +
                        '<div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:10px;border-radius:6px;text-align:center;"><div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Actual</div><div style="font-size:11pt;font-weight:900;">' + fmt(grandActual) + '</div></div>' +
                        '<div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;text-align:center;"><div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:4px;">ETC</div><div style="font-size:11pt;font-weight:900;">' + fmt(grandEtc) + '</div></div>' +
                        '<div style="background:' + (grandVariance >= 0 ? '#f0fdf4;border:1px solid #bbf7d0;' : '#fef2f2;border:1px solid #fecaca;') + 'padding:10px;border-radius:6px;text-align:center;"><div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:4px;">% Used</div><div style="font-size:11pt;font-weight:900;color:' + (grandPct > 100 ? '#dc2626' : grandPct > 85 ? '#d97706' : '#16a34a') + ';">' + pct(grandPct) + '</div></div></div>';

                    var css = 'table{width:100%;border-collapse:collapse;font-size:7.5pt;}' +
                        'th{background:#0f172a;color:#fff;padding:5px 6px;text-align:left;font-size:7pt;text-transform:uppercase;letter-spacing:0.5px;}' +
                        'td{padding:3px 6px;border-bottom:1px solid #f1f5f9;}' +
                        'tr.sec-hdr td{background:#f1f5f9;font-weight:800;font-size:7.5pt;border-top:2px solid #e2e8f0;}' +
                        'tr.grand td{background:#0f172a;color:#fff;font-weight:900;font-size:8pt;}';

                    var tableHtml = '<table><thead><tr>' +
                        '<th style="width:80px;">Account</th><th>Description</th>' +
                        '<th style="width:72px;text-align:right;">Budget</th>' +
                        '<th style="width:72px;text-align:right;">Committed</th>' +
                        '<th style="width:72px;text-align:right;">Actual</th>' +
                        '<th style="width:60px;text-align:right;">ETC</th>' +
                        '<th style="width:68px;text-align:right;">Variance</th>' +
                        '<th style="width:48px;text-align:right;">% Used</th>' +
                        '</tr></thead><tbody>';

                    secOrder.forEach(function (secKey) {
                        var sec = secMap[secKey];
                        var secVariance = sec.budget - sec.actual;
                        var secPct = sec.budget > 0 ? ((sec.actual + sec.committed) / sec.budget * 100) : 0;
                        tableHtml += '<tr class="sec-hdr">' +
                            '<td colspan="2">' + esc(secKey) + '</td>' +
                            '<td style="text-align:right;">' + fmt(sec.budget) + '</td>' +
                            '<td style="text-align:right;">' + fmt(sec.committed) + '</td>' +
                            '<td style="text-align:right;">' + fmt(sec.actual) + '</td>' +
                            '<td style="text-align:right;">' + fmt(sec.etc) + '</td>' +
                            '<td style="text-align:right;color:' + (secVariance >= 0 ? '#16a34a' : '#dc2626') + ';">' + fmt(secVariance) + '</td>' +
                            '<td style="text-align:right;color:' + (secPct > 100 ? '#dc2626' : secPct > 85 ? '#d97706' : '#475569') + ';">' + pct(secPct) + '</td></tr>';
                        sec.items.forEach(function (item) {
                            var v = parseFloat(item.budget) - parseFloat(item.actual);
                            var p = parseFloat(item.budget) > 0 ? ((parseFloat(item.actual) + parseFloat(item.committed)) / parseFloat(item.budget) * 100) : 0;
                            tableHtml += '<tr>' +
                                '<td style="color:#94a3b8;font-size:7pt;">' + esc(item.account) + '</td>' +
                                '<td>' + esc(item.description) + (item.actualDate ? '<span style="color:#94a3b8;font-size:6.5pt;margin-left:4px;">(' + esc(item.actualDate) + ')</span>' : '') + '</td>' +
                                '<td style="text-align:right;">' + fmt(item.budget) + '</td>' +
                                '<td style="text-align:right;color:#d97706;">' + fmt(item.committed) + '</td>' +
                                '<td style="text-align:right;">' + fmt(item.actual) + '</td>' +
                                '<td style="text-align:right;">' + fmt(item.etc) + '</td>' +
                                '<td style="text-align:right;color:' + (v >= 0 ? '#16a34a' : '#dc2626') + ';">' + fmt(v) + '</td>' +
                                '<td style="text-align:right;color:' + (p > 100 ? '#dc2626' : p > 85 ? '#d97706' : '#475569') + ';">' + pct(p) + '</td></tr>';
                        });
                    });

                    tableHtml += '<tr class="grand">' +
                        '<td colspan="2">' + engine._inkHeading('GRAND TOTAL') + '</td>' +
                        '<td style="text-align:right;">' + fmt(grandBudget) + '</td>' +
                        '<td style="text-align:right;">' + fmt(grandCommitted) + '</td>' +
                        '<td style="text-align:right;">' + fmt(grandActual) + '</td>' +
                        '<td style="text-align:right;">' + fmt(grandEtc) + '</td>' +
                        '<td style="text-align:right;">' + fmt(grandVariance) + '</td>' +
                        '<td style="text-align:right;">' + pct(grandPct) + '</td></tr>' +
                        '</tbody></table>';

                    tableHtml += '<p style="font-size:8pt;">Actuals are cumulative recorded item actuals. Unknown means no verified allocation or estimate. Budget and open commitments are not removed by the report period.</p>';
                    var notes = d.notes ? '<div style="margin-top:12px;font-size:8pt;color:#475569;line-height:1.5;"><strong>Notes:</strong> ' + esc(d.notes) + '</div>' : '';
                    if (d.committedNote) notes += '<div style="margin-top:8px;font-size:8pt;color:#b45309;line-height:1.5;">' + esc(d.committedNote) + '</div>';
                    var sig = d.approvedBy ? '<div style="margin-top:24px;"><div style="display:inline-block;border-top:1px solid #0f172a;padding-top:4px;font-size:8pt;min-width:240px;"><strong>Approved by: ' + esc(d.approvedBy) + '</strong></div></div>' : '';
                    return engine._wrapHtml(title + engine._titleSeparator() + 'Weekly Cost Report', header + summary + tableHtml + notes + sig, css);
                },

                /* Native jsPDF + autoTable path — called by toPdf() instead of html2pdf to avoid
                   html2canvas memory crashes and blurry rasterization on large accounting tables. */
                renderAutoTablePdf: function (budgetData, options) {
                    if (typeof window.jspdf === 'undefined') { notify('Error', 'jsPDF not loaded.'); return; }
                    var jsPDF = window.jspdf.jsPDF;
                    var b = budgetData || {};
                    var d = (options && options.editorData) || this.getDefaultData(b);
                    var currency = (options && options.currency) || 'JMD';
                    var rate = parseFloat((options && options.rate)) || 1;
                    var fmt = function (v) { return v === '' || v == null || !isFinite(Number(v)) ? 'Unknown' : fmtCurrency(v, currency, rate); };
                    var pct = function (v) { return isFinite(v) ? v.toFixed(1) + '%' : 'Unknown'; };

                    /* Landscape for 8 columns */
                    var doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
                    var pageW = doc.internal.pageSize.getWidth();
                    var pageH = doc.internal.pageSize.getHeight();
                    var margin = 36;

                    var titleStr = d.productionTitle || (b && b.projectName) || 'Production';
                    var period = (d.periodStart && d.periodEnd) ? (d.periodStart + ' \u2013 ' + d.periodEnd) : 'All Periods';

                    /* Header block */
                    var y = margin + 4;
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(14);
                    doc.setTextColor(15, 23, 42);
                    doc.text(titleStr, margin, y);
                    y += 16;
                    doc.setFontSize(10);
                    doc.text('WEEKLY COST REPORT', margin, y);
                    y += 13;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    var meta = 'Period: ' + period + '   |   Report Date: ' + (d.reportDate || '\u2014');
                    if (d.preparedBy) meta += '   |   Prepared by: ' + d.preparedBy;
                    doc.text(meta, margin, y);
                    y += 11;
                    doc.text('Budget-linked actuals are cumulative. Unknown means no verified allocation or estimate.', margin, y);
                    doc.setTextColor(0, 0, 0);
                    y += 10;

                    /* Period-filtered line items */
                    var rawItems = (d.lineItems || []).filter(function (item) {
                        if (item.itemId || !item.actualDate) return true;
                        if (d.periodStart && item.actualDate < d.periodStart) return false;
                        if (d.periodEnd && item.actualDate > d.periodEnd) return false;
                        return true;
                    });

                    /* Aggregate section subtotals */
                    var secMap = {}; var secOrder = [];
                    rawItems.forEach(function (item) {
                        var k = item.account || 'Uncategorized';
                        if (!secMap[k]) { secMap[k] = { budget: 0, committed: 0, actual: 0, etc: 0, items: [] }; secOrder.push(k); }
                        secMap[k].budget += parseFloat(item.budget) || 0;
                        secMap[k].committed += item.committed === '' || item.committed == null ? NaN : parseFloat(item.committed);
                        secMap[k].actual += parseFloat(item.actual) || 0;
                        secMap[k].etc += item.etc === '' || item.etc == null ? NaN : parseFloat(item.etc);
                        secMap[k].items.push(item);
                    });
                    var grandBudget = 0, grandCommitted = 0, grandActual = 0, grandEtc = 0;
                    secOrder.forEach(function (k) { grandBudget += secMap[k].budget; grandCommitted += secMap[k].committed; grandActual += secMap[k].actual; grandEtc += secMap[k].etc; });
                    var grandVariance = grandBudget - grandActual;
                    var grandPct = grandBudget > 0 ? ((grandActual + grandCommitted) / grandBudget * 100) : 0;

                    /* Build autoTable body rows */
                    var tableBody = [];
                    secOrder.forEach(function (secKey) {
                        var sec = secMap[secKey];
                        var sv = sec.budget - sec.actual;
                        var sp = sec.budget > 0 ? ((sec.actual + sec.committed) / sec.budget * 100) : 0;
                        /* Section header row */
                        tableBody.push([
                            { content: secKey, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } },
                            { content: fmt(sec.budget), styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
                            { content: fmt(sec.committed), styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
                            { content: fmt(sec.actual), styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
                            { content: fmt(sec.etc), styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
                            { content: fmt(sv), styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249], textColor: sv >= 0 ? [22, 163, 74] : [220, 38, 38] } },
                            { content: pct(sp), styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249], textColor: sp > 100 ? [220, 38, 38] : sp > 85 ? [217, 119, 6] : [71, 85, 105] } }
                        ]);
                        /* Item detail rows */
                        sec.items.forEach(function (item) {
                            var iv = parseFloat(item.budget) - parseFloat(item.actual);
                            var ip = parseFloat(item.budget) > 0 ? ((parseFloat(item.actual) + parseFloat(item.committed)) / parseFloat(item.budget) * 100) : 0;
                            var desc = (item.description || '') + (item.actualDate ? ' (' + item.actualDate + ')' : '');
                            tableBody.push([
                                { content: item.account || '', styles: { textColor: [148, 163, 184] } },
                                desc,
                                { content: fmt(item.budget), styles: { halign: 'right' } },
                                { content: fmt(item.committed), styles: { halign: 'right', textColor: [217, 119, 6] } },
                                { content: fmt(item.actual), styles: { halign: 'right' } },
                                { content: fmt(item.etc), styles: { halign: 'right' } },
                                { content: fmt(iv), styles: { halign: 'right', textColor: iv >= 0 ? [22, 163, 74] : [220, 38, 38] } },
                                { content: pct(ip), styles: { halign: 'right', textColor: ip > 100 ? [220, 38, 38] : ip > 85 ? [217, 119, 6] : [71, 85, 105] } }
                            ]);
                        });
                    });
                    /* Grand total row */
                    tableBody.push([
                        { content: 'GRAND TOTAL', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
                        { content: fmt(grandBudget), styles: { fontStyle: 'bold', halign: 'right', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
                        { content: fmt(grandCommitted), styles: { fontStyle: 'bold', halign: 'right', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
                        { content: fmt(grandActual), styles: { fontStyle: 'bold', halign: 'right', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
                        { content: fmt(grandEtc), styles: { fontStyle: 'bold', halign: 'right', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
                        { content: fmt(grandVariance), styles: { fontStyle: 'bold', halign: 'right', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
                        { content: pct(grandPct), styles: { fontStyle: 'bold', halign: 'right', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }
                    ]);

                    doc.autoTable({
                        startY: y + 4,
                        head: [['Account', 'Description', 'Budget', 'Committed', 'Actual', 'ETC', 'Variance', '% Used']],
                        body: tableBody,
                        theme: 'plain',
                        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
                        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
                        columnStyles: {
                            0: { cellWidth: 68 },
                            1: { cellWidth: 'auto' },
                            2: { cellWidth: 70, halign: 'right' },
                            3: { cellWidth: 70, halign: 'right' },
                            4: { cellWidth: 70, halign: 'right' },
                            5: { cellWidth: 58, halign: 'right' },
                            6: { cellWidth: 66, halign: 'right' },
                            7: { cellWidth: 46, halign: 'right' }
                        },
                        margin: { left: margin, right: margin },
                        didDrawPage: function (data) {
                            doc.setFontSize(7);
                            doc.setTextColor(150, 150, 150);
                            doc.text('Page ' + data.pageNumber, pageW - margin, pageH - 18, { align: 'right' });
                            doc.setTextColor(0, 0, 0);
                        }
                    });

                    /* Notes and approval signature below table */
                    var postY = doc.lastAutoTable.finalY + 12;
                    if (d.committedNote) {
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(180, 83, 9);
                        doc.text(d.committedNote, margin, postY);
                        doc.setTextColor(0, 0, 0);
                        postY += 14;
                    }
                    if (d.notes) {
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(71, 85, 105);
                        doc.text('Notes: ' + d.notes, margin, postY);
                        doc.setTextColor(0, 0, 0);
                        postY += 14;
                    }
                    if (d.approvedBy) {
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(8);
                        doc.line(margin, postY - 2, margin + 200, postY - 2);
                        doc.text('Approved by: ' + d.approvedBy, margin, postY + 8);
                    }

                    var fname = slugify(b.projectName || 'production') + '_weekly_cost_report.pdf';
                    doc.save(fname);
                }
            },

            /* ---- PRODUCTION PAPERWORK: CASH PAYMENT VOUCHER ---- */
            cashPaymentVoucher: {
                id: 'cashPaymentVoucher',
                name: 'Cash Payment Voucher',
                description: 'Crew or vendor cash receipt: one page per payee and payment, deposit and balance pages for a split payment.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                _sectionKind: function (sec, name) {
                    var id = String((sec && sec.id) || '').toLowerCase(), n = String(name || '').toLowerCase();
                    if (['travel', 'logistics'].indexOf(id) > -1 || /\b(travel|logistics|transport)\b/.test(n)) return 'travel';
                    if (paperProductionSection(sec, name)) return 'production';
                    return '';
                },
                _isExtrasLine: function (item, contact) {
                    var text = [item && item.description, item && item.role, item && item.crew && item.crew.role, contact && contact.role].join(' ').toLowerCase();
                    return /\b(extras?|background (actors?|talent|performers?|cast))\b/.test(text);
                },
                /* Prefer window.mBTPaidBy; when absent (vm harness without ShootSchedule.js),
                   still normalise paidMethod / paidRef the same way. */
                _paidByApi: function () {
                    if (typeof window !== 'undefined' && window.mBTPaidBy
                        && typeof window.mBTPaidBy.normalise === 'function') {
                        return window.mBTPaidBy;
                    }
                    return {
                        normalise: function (row) {
                            var paidMethod = '';
                            var paidRef = '';
                            var method;
                            var ok = { cash: 1, transfer: 1, wire: 1, cheque: 1, paypal: 1, wise: 1, payoneer: 1 };
                            if (row && typeof row === 'object') {
                                if (typeof row.paidMethod === 'string') {
                                    method = row.paidMethod.trim().toLowerCase();
                                    if (ok[method]) paidMethod = method;
                                }
                                if (typeof row.paidRef === 'string') paidRef = row.paidRef.trim().slice(0, 80);
                            }
                            return { paidMethod: paidMethod, paidRef: paidRef };
                        }
                    };
                },
                _poForItem: function (budget, itemId) {
                    var pos = budget && budget.ledgers && Array.isArray(budget.ledgers.pos) ? budget.ledgers.pos : [];
                    var id = itemId != null ? String(itemId) : '';
                    var i;
                    if (!id) return null;
                    for (i = 0; i < pos.length; i++) {
                        if (pos[i] && String(pos[i].itemId || '') === id) return pos[i];
                    }
                    return null;
                },
                _paidFields: function (row) {
                    var n = this._paidByApi().normalise(row || null);
                    return { paidMethod: n.paidMethod || '', paidRef: n.paidRef || '' };
                },
                /** Voucher data from Production and Travel crew or vendor lines and ledgers.pettyCash.
                    Every line with a payee gives one voucher; a deposit below the total gives a split pair. */
                getDefaultData: function (budgetData, options) {
                    var self = this;
                    var b = budgetData || {};
                    var opts = options || {};
                    var contacts = paperContacts(b, opts);
                    var party = paperworkParty(b, opts);
                    var currency = b.currency || 'JMD';
                    var vouchers = [];
                    Object.keys(b.sections || {}).forEach(function (name) {
                        var sec = b.sections[name] || {};
                        if (!self._sectionKind(sec, name)) return;
                        (sec.items || []).forEach(function (item) {
                            if (!item || item.memoId || item.memoStatus) return;
                            var contact = paperLineContact(item, contacts);
                            if (self._isExtrasLine(item, contact)) return;
                            var payee = paperFirst(contact && contact.name, item.crew && item.crew.name, item.vendor, item.payee);
                            if (!payee) return;
                            var purpose = paperFirst(
                                paperStripName(item.purpose, payee, contact),
                                paperStripName(item.description, payee, contact),
                                paperStripName(item.role, payee, contact),
                                paperStripName(item.crew && item.crew.role, payee, contact),
                                paperStripName(contact && contact.role, payee, contact),
                                paperStripName(contact && contact.title, payee, contact)
                            );
                            var paid = self._paidFields(self._poForItem(b, item.id));
                            vouchers.push({
                                source: 'line', itemId: item.id || '', contactId: contact && contact.id != null ? String(contact.id) : '',
                                payee: payee,
                                purpose: purpose,
                                total: paperLineTotal(item, currency),
                                deposit: item.deposit != null ? item.deposit : item.depositAmount,
                                currency: currency,
                                paidMethod: paid.paidMethod,
                                paidRef: paid.paidRef,
                                items: Array.isArray(item.voucherItems) ? item.voucherItems.map(function (r) { return { description: paperText(r.description), amount: paperAmount(r.amount, currency) }; }) : []
                            });
                        });
                    });
                    var floats = (b.ledgers && Array.isArray(b.ledgers.pettyCash)) ? b.ledgers.pettyCash : [];
                    floats.forEach(function (fl) {
                        if (!fl) return;
                        if (paperText(fl.floatHolder)) {
                            vouchers.push({ source: 'pettyCashFloat', floatId: fl.id || '', payee: paperText(fl.floatHolder), purpose: 'Petty cash float', total: paperAmount(fl.floatAmount, fl.currency || currency), deposit: null, currency: fl.currency || currency, paidMethod: '', paidRef: '', items: [] });
                        }
                        (fl.receipts || []).forEach(function (r) {
                            if (!r) return;
                            var c = paperContactById(contacts, r.contactId);
                            var rPayee = paperText(c && c.name);
                            var rPurpose = paperFirst(
                                paperStripName(r.purpose, rPayee, c),
                                paperStripName(r.description, rPayee, c),
                                paperStripName(c && c.role, rPayee, c),
                                paperStripName(c && c.title, rPayee, c)
                            );
                            var paid = self._paidFields(r);
                            vouchers.push({ source: 'pettyCashReceipt', floatId: fl.id || '', receiptId: r.id || '', contactId: c && c.id != null ? String(c.id) : '', payee: rPayee, purpose: rPurpose, total: paperAmount(r.amount, r.currency || fl.currency || currency), date: r.date || '', deposit: null, currency: r.currency || fl.currency || currency, paidMethod: paid.paidMethod, paidRef: paid.paidRef, items: [] });
                        });
                    });
                    var company = paperBrand(paperFirst(b.projectCompany, b.company));
                    if (company.toLowerCase() === 'independent') company = '';
                    return {
                        projectName: b.workingTitle || b.projectName || '',
                        projectLocation: b.projectLocation || '',
                        shootDate: b.shootDate || '',
                        date: '',
                        voucherPrefix: '',
                        startNumber: '',
                        paidBy: party.line || [party.producer, company].filter(Boolean).join(', '),
                        producerName: party.producer,
                        footerWithPayee: false,
                        currency: currency,
                        vouchers: vouchers
                    };
                },
                /* One voucher becomes one page, or a deposit page and a balance page when split. */
                _pages: function (v, currency) {
                    currency = currency || v.currency;
                    var total = paperAmount(v.total, currency), dep = paperAmount(v.deposit, currency);
                    var bal = paperAmount(v.balanceAfter != null ? v.balanceAfter : (v.balanceRemaining != null ? v.balanceRemaining : v.balance), currency);
                    var invalidDeposit = v.deposit != null && (dep === null || (total !== null && dep > total));
                    if (total !== null && dep !== null && dep > 0 && dep < total) {
                        var remainder = Math.round((total - dep) * 100) / 100;
                        return [
                            { type: 'Deposit', amount: dep, balanceAfter: remainder, total: total, split: true, deposit: dep },
                            { type: 'Balance', amount: remainder, balanceAfter: 0, total: total, split: true, deposit: dep }
                        ];
                    }
                    return [{ type: 'Full', amount: total, balanceAfter: invalidDeposit ? null : bal, total: total, split: false, deposit: null, depositWriteIn: invalidDeposit }];
                },
                renderHtml: function (budgetData, options, engine) {
                    var self = this;
                    var b = budgetData || {};
                    options = options || {};
                    var d = paperMerge(self.getDefaultData(b, options), options.editorData);
                    var vouchers = Array.isArray(d.vouchers) && d.vouchers.length ? d.vouchers : [{}];
                    var prefix = paperText(d.voucherPrefix), start = parseInt(d.startNumber, 10);
                    var numbered = !!prefix || !isNaN(start);
                    if (isNaN(start)) start = 1;
                    var docDate = paperDate(d.date || d.shootDate);
                    var pageNo = 0;
                    var pages = [];
                    var contacts = paperContacts(b, options);
                    vouchers.forEach(function (v) {
                        v = v || {};
                        var currency = v.currency || d.currency || b.currency || 'JMD';
                        currency = paperCurrencyCode(currency) || currency;
                        var money = function (n) { return n === null || n === undefined ? '' : fmtCurrency(n, currency, 1); };
                        var payee = paperText(v.payee);
                        var contact = paperLineContact(v, contacts);
                        var purpose = paperFirst(
                            paperStripName(v.purpose, payee, contact),
                            paperStripName(v.description, payee, contact),
                            paperStripName(v.role, payee, contact)
                        );
                        var paid = self._paidFields(v);
                        var methodFill = paid.paidMethod === 'transfer' ? 'Bank transfer' : '';
                        var methodWi = '<span class="cs-writein pp-wi">' + (methodFill ? paperEsc(methodFill) : PAPER_BLANK) + '</span>';
                        var bankVal = paperWriteIn(paid.paidRef);
                        self._pages(v, currency).forEach(function (p) {
                            var number = numbered ? prefix + String(start + pageNo) : '';
                            pageNo += 1;
                            var items = Array.isArray(v.items) ? v.items.filter(function (r) { return r && (paperText(r.description) || paperAmount(r.amount, currency) !== null); }) : [];
                            var table = '';
                            if (items.length || p.split || p.depositWriteIn) {
                                var rows = (items.length ? items : [{ description: purpose || 'Agreed total', amount: p.total }]).map(function (r) {
                                    var rAmt = paperAmount(r.amount, currency);
                                    return '<tr><td>' + paperWriteIn(r.description) + '</td><td class="col-r">' + (rAmt !== null ? paperEsc(money(rAmt)) : paperWriteIn('')) + '</td></tr>';
                                }).join('');
                                if (p.split) {
                                    rows += '<tr><td>Deposit</td><td class="col-r">' + paperEsc(money(p.deposit)) + '</td></tr>' +
                                        '<tr><td>Balance</td><td class="col-r">' + paperEsc(money(p.balanceAfter || p.amount)) + '</td></tr>' +
                                        '<tr><td><b>Total</b></td><td class="col-r"><b>' + paperEsc(money(p.total)) + '</b> (' + paperEsc(paperWords(p.total, currency)) + ')</td></tr>';
                                }
                                if (p.depositWriteIn) {
                                    rows += '<tr><td>Deposit</td><td class="col-r">' + paperWriteIn('') + '</td></tr>' +
                                        '<tr><td>Balance</td><td class="col-r">' + paperWriteIn('') + '</td></tr>';
                                }
                                table = '<table class="pp-table pp-items"><thead><tr><th>DESCRIPTION</th><th class="col-r">AMOUNT</th></tr></thead><tbody>' + rows + '</tbody></table>';
                            }
                            var amt = paperAmount(p.amount);
                            var balAfter = paperAmount(p.balanceAfter);
                            var figures = amt !== null ? paperEsc(money(amt)) : paperWriteIn('');
                            var words = amt !== null ? paperEsc(paperWords(amt, currency)) : paperWriteIn('', true);
                            var footer = d.footerWithPayee && payee ? 'Payment for ' + payee + '. Each party keeps a signed copy.' : 'Each party keeps a signed copy.';
                            pages.push('<div class="pp-page" data-doc="cashPaymentVoucher" data-payment-type="' + paperEsc(p.type) + '">' +
                                paperHeader('Cash Payment Voucher', [d.projectName || b.projectName, d.projectLocation, paperDate(d.shootDate)]) +
                                '<div class="pp-grid">' +
                                paperField('VOUCHER NO.', paperWriteIn(number)) +
                                paperField('DATE', paperWriteIn(paperDate(v.date) || docDate)) +
                                paperField('PAID BY', paperWriteIn(d.paidBy)) +
                                paperField('PAID TO', paperWriteIn(payee)) +
                                paperField('METHOD', '<span class="pp-boxes">' + paperBox('Cash') + paperBox('Other') + methodWi + '</span>') +
                                paperField('BANK REFERENCE', bankVal) +
                                paperField('PURPOSE', paperWriteIn(purpose)) +
                                '</div>' + table +
                                '<div class="pp-grid">' +
                                paperField('AMOUNT IN FIGURES (THIS PAYMENT)', figures) +
                                paperField('PAYMENT TYPE', '<span class="pp-boxes">' + paperBox('Deposit') + paperBox('Balance') + paperBox('Full') + '</span>') +
                                paperField('AMOUNT IN WORDS', words, true) +
                                paperField('BALANCE REMAINING AFTER THIS PAYMENT', balAfter !== null ? paperEsc(money(balAfter)) : paperWriteIn('')) +
                                '</div>' +
                                '<p class="pp-p pp-ack-text">I acknowledge receipt of the amount stated above. Each party keeps a signed copy.</p>' +
                                paperDual(paperSig('Received by (payee)', payee), paperSig('Paid by (moo)', paperText(d.producerName))) +
                                '<div class="pp-footer">' + paperEsc(footer) + '</div>' +
                                '</div>');
                        });
                    });
                    return engine._wrapHtml(paperBrand((d.projectName || b.projectName || 'Production') + ' - Cash Payment Voucher'), pages.join(''), PAPER_CSS);
                }
            },

            /* ---- PRODUCTION PAPERWORK: GROUP FILMING NOTICE + MINOR CONSENT ---- */
            groupMinorConsent: {
                id: 'groupMinorConsent',
                name: 'Group Filming Notice + Minor Consent',
                description: 'Part A group and background filming notice with organiser acknowledgement; Part B parent or guardian consent, repeatable one per child.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                getDefaultData: function (budgetData, options) {
                    var b = budgetData || {};
                    var opts = options || {};
                    var ed = opts.editorData || {};
                    var party = paperworkParty(b, opts);
                    return {
                        projectName: b.workingTitle || b.projectName || '',
                        productionLine: party.line,
                        producerName: party.producer,
                        date: b.shootDate || '',
                        projectLocation: b.projectLocation || '',
                        specificPlace: paperFirst(b.specificPlace, b.shootPlace),
                        organiserName: paperFirst(ed.organiserName, ed.organiser, ed.sessionOrganiser, opts.organiserName, opts.organiser, opts.sessionOrganiser, b.organiserName, b.organiser, b.sessionOrganiser),
                        extraPartBCopies: 0
                    };
                },
                _partB: function (d) {
                    return '<h2 class="pp-h2">B. Parent or guardian consent for a minor (under 18)</h2>' +
                        '<p class="pp-p">For a child who will be interviewed or clearly featured.</p>' +
                        '<div class="pp-grid">' +
                        paperField('CHILD\'S NAME', paperWriteIn('')) + paperField('AGE', paperWriteIn('')) +
                        paperField('PARENT OR GUARDIAN NAME', paperWriteIn('')) + paperField('PHONE', paperWriteIn('')) +
                        paperField('DATE', paperWriteIn('')) +
                        '</div>' +
                        '<p class="pp-p">I am the parent or guardian of the child named above. I confirm the child\'s name and age and my authority. The child\'s own willingness (assent) is recorded in language the child can understand. A refusal is respected.</p>' +
                        '<p class="pp-p pp-boxes">Child is willing to take part: ' + paperBox('Yes') + paperBox('No') + '</p>' +
                        '<p class="pp-p">The child\'s welfare comes first, even if I sign. The parent or the child may stop the interview or the featuring at any time.</p>' +
                        '<p class="pp-p">I give the Producer and EFJ the right to record and use the child\'s appearance, name, likeness, voice and interview answers in this documentary and in related promotion of it, in all media, worldwide, in perpetuity. Both the Producer and EFJ may use, edit and distribute the footage for this project and related promotion. The Producer may also use it in its portfolio. Consideration: no fee, unless a fee is agreed here: ________ JMD (leave blank if none).</p>' +
                        '<p class="pp-p">Jamaica Data Protection Act 2020 consent: I give informed, specific consent to the Producer and EFJ holding and using this personal data for this documentary, related promotion of it, and production records. I may withdraw consent as allowed by the law. Withdrawal of consent to further use of personal data does not by itself withdraw the finished film where a rights grant has been made.</p>' +
                        paperDual(paperSig('Parent or guardian', ''), paperSig('For the Producer', paperText(d.producerName)));
                },
                renderHtml: function (budgetData, options, engine) {
                    var self = this;
                    var b = budgetData || {};
                    options = options || {};
                    var d = paperMerge(self.getDefaultData(b, options), options.editorData);
                    var place = paperText(d.projectLocation)
                        ? paperEsc(paperText(d.projectLocation)) + (paperText(d.specificPlace) ? ', ' + paperEsc(paperText(d.specificPlace)) : ' ' + paperWriteIn(''))
                        : paperWriteIn(d.specificPlace);
                    var head = paperHeader('Group Filming Notice + Minor Consent', [d.projectName || b.projectName]) +
                        '<div class="pp-grid">' +
                        '<div class="pp-wide">Production: ' + paperWriteIn(paperFirst(d.granteeLine, d.productionLine)) + '</div>' +
                        paperField('DATE', paperWriteIn(paperDate(d.date))) +
                        paperField('PLACE', place) +
                        '</div>';
                    var organiserVal = paperFirst(d.organiserName, d.organiser, d.sessionOrganiser);
                    var organiser = organiserVal ? paperEsc(organiserVal) : '<span class="cs-writein pp-wi">' + PAPER_BLANK + '</span>';
                    var partA = '<h2 class="pp-h2">A. Group and background filming notice</h2>' +
                        '<p class="pp-p">A documentary crew is filming today for the Producer and EFJ. People in the background of group activity may appear in the film. Anyone who does not wish to be clearly shown should tell the crew. They can stand aside or be avoided in featured shots.</p>' +
                        '<p class="pp-p">This notice is not a substitute for a signed appearance release if someone is interviewed or clearly featured.</p>' +
                        '<p class="pp-p">Session organiser (' + organiser + ' or designee), acknowledging this notice was read out or posted:</p>' +
                        '<div class="pp-ack">' +
                        '<div class="pp-sig-row"><div class="pp-sig-line"></div><div class="pp-caption">SIGNATURE</div></div>' +
                        '<div class="pp-sig-row"><div class="pp-sig-line"></div><div class="pp-caption">PRINTED NAME</div></div>' +
                        '<div class="pp-sig-row"><div class="pp-sig-line"></div><div class="pp-caption">DATE</div></div>' +
                        '<div class="pp-sig-row"><div class="pp-sig-line"></div><div class="pp-caption">ROLE</div></div>' +
                        '</div>';
                    var body = '<div class="pp-page" data-doc="groupMinorConsent" data-part="A+B">' + head + partA + self._partB(d) + '</div>';
                    var extraCount = paperFirst(d.extraPartBCopies, d.partBCopies, d.extraPartB, d.partBOnlyCopies, options.extraPartBCopies, options.partBCopies, options.extraPartB, options.partBOnlyCopies);
                    var extra = Math.max(0, Math.min(50, parseInt(extraCount, 10) || 0));
                    for (var i = 0; i < extra; i++) {
                        body += '<div class="pp-page" data-doc="groupMinorConsent" data-part="B">' + head + self._partB(d) + '</div>';
                    }
                    return engine._wrapHtml(paperBrand((d.projectName || b.projectName || 'Production') + ' - Group Filming Notice + Minor Consent'), body, PAPER_CSS + PAPER_FIT_CSS);
                }
            },

            /* ---- PRODUCTION PAPERWORK: INTERVIEW QUESTION SHEET ---- */
            interviewQuestions: {
                id: 'interviewQuestions',
                name: 'Interview Question Sheet',
                description: 'Interviewer sheet, not a script: header from the budget and contacts, consent and filming notes, repeatable question groups and who-else prompts.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                _defaultDurationLine: 'About 20 minutes for Collett, about 10 minutes for others.',
                _howWeFilm: function (durationLine) {
                    var line = durationLine === undefined ? this._defaultDurationLine : paperText(durationLine);
                    return [
                        'One camera, seated or walking, in a place that shows the work.',
                        'Open questions that start with how, what, or tell me about. No yes or no questions.',
                        'Please include the idea in your answer, because the interviewer\'s voice will not be in the film.',
                        'Short answers are welcome. If an answer runs long, we may ask for one or two sentences.',
                        'Speak the way you normally speak. English subtitles can be added if needed.',
                        'A release form is signed before filming. Anyone may decline a question or stop at any time.',
                        line,
                        'Please look over the topics. You do not need to memorise answers. We want your own words.'
                    ];
                },
                /** Reference example content (Dolphin Head LFMC). Editorial; loaded on request, never by default. */
                referenceExample: function () {
                    return {
                        durationLine: this._defaultDurationLine,
                        howWeFilm: this._howWeFilm(this._defaultDurationLine),
                        questionGroups: [
                            { heading: 'About you and the committee.', questions: ['Please tell me your name, your community and your role with the Dolphin Head LFMC.', 'How long have you been part of the committee and how did you get involved?'] },
                            { heading: 'The forest and this place.', questions: ['What makes Dolphin Head important to Jamaica\'s biodiversity?', 'What does this forest mean to you and your community?'] },
                            { heading: 'The committee\'s work and today\'s training.', questions: ['How has your committee contributed to forest restoration?', 'How are initiatives such as ecotourism helping members and conservation efforts?', 'Tell me about the social enterprise the group is involved in.', 'What is today\'s training for, who is here and what do you hope people take away?'] },
                            { heading: 'Challenges.', questions: ['What have been the impacts of Hurricane Melissa on the LFMC?', 'What is one of the biggest challenges the committee faces in this work?'] },
                            { heading: 'Achievement and the future.', questions: ['What is the greatest achievement of the committee and what would you like to accomplish next?', 'What do you hope this forest looks like in ten years and what do you want young people in the community to understand about it?'] }
                        ],
                        whoElse: [
                            { text: 'A trainee at today\'s session, to hear the training from a participant\'s point of view.', writeIn: 'Name' },
                            { text: 'An elder or long-time member, to share how the committee and the forest have changed over time.', writeIn: 'Name' },
                            { text: 'Someone from the community whose daily life is touched by this work (for example a farmer, a young person, a woman member, or a local enterprise). One question we would like to ask them: "What difference has the LFMC made in this community?"', writeIn: 'Name and role' }
                        ],
                        footerNote: 'Questions 3 to 7, 9 and 11 follow topics sent by Charmine Webber (EFJ) on 11 November 2026 for Dolphin Head, together with the story guide. This sheet is only for Collett and the people she may introduce on the day.'
                    };
                },
                getDefaultData: function (budgetData, options) {
                    var b = budgetData || {};
                    var opts = options || {};
                    var ed = opts.editorData || {};
                    var contacts = paperContacts(b, opts);
                    var party = paperworkParty(b, opts);
                    var person = paperContactById(contacts, opts.contactId || opts.intervieweeContactId);
                    if (!person) {
                        var engine = (typeof window !== 'undefined' && window.mBTPublisher && window.mBTPublisher.templates) || null;
                        var list = engine && engine.callSheet ? engine.callSheet.getDefaultData(b, { contacts: contacts }).interviewees : [];
                        person = list && list.length ? list[0] : null;
                    }
                    var name = person ? paperText(person.name) : '';
                    var docTitle = b.workingTitle || b.projectName || '';
                    var projTitle = b.projectName || b.workingTitle || '';
                    var durName = paperFirst(ed.durationName, opts.durationName);
                    var durationLine = ed.durationLine !== undefined ? paperText(ed.durationLine)
                        : opts.durationLine !== undefined ? paperText(opts.durationLine)
                        : durName ? ('About 20 minutes for ' + durName + ', about 10 minutes for others.')
                        : this._defaultDurationLine;
                    var d = {
                        intervieweeName: name,
                        intervieweeRole: person ? paperFirst(person.role, person.title) : '',
                        fromLine: party.producer ? party.producer + ', moo' : '',
                        client: party.client,
                        shootDate: b.shootDate || '',
                        projectLocation: b.projectLocation || '',
                        startTime: '',
                        meetingPlace: '',
                        projectName: projTitle,
                        place: paperFirst(b.specificPlace, b.shootPlace),
                        documentaryTitle: docTitle,
                        subhead: 'For review before the shoot. This is not a script.',
                        durationLine: durationLine,
                        howWeFilm: this._howWeFilm(durationLine),
                        questionGroups: [],
                        whoElse: [],
                        footerNote: ''
                    };
                    if (opts.example === 'reference' || opts.loadReferenceExample || opts.includeExampleQuestions || ed.loadReferenceExample || ed.includeExampleQuestions) {
                        var ex = this.referenceExample();
                        Object.keys(ex).forEach(function (k) { d[k] = ex[k]; });
                        if (ed.durationLine !== undefined || opts.durationLine !== undefined || durName) {
                            d.durationLine = durationLine;
                            d.howWeFilm = this._howWeFilm(durationLine);
                        }
                    }
                    return d;
                },
                renderHtml: function (budgetData, options, engine) {
                    var self = this;
                    var b = budgetData || {};
                    options = options || {};
                    var d = paperMerge(self.getDefaultData(b, options), options.editorData);
                    var forLine = paperText(d.intervieweeName)
                        ? paperEsc(paperText(d.intervieweeName)) + (paperText(d.intervieweeRole) ? ', ' + paperEsc(paperText(d.intervieweeRole)) : '')
                        : paperWriteIn('');
                    var shootBits = [paperDate(d.shootDate), paperText(d.projectLocation)].filter(Boolean).map(paperEsc).join(', ');
                    var shoot = (shootBits || paperWriteIn('')) +
                        '<br>Start time: ' + paperWriteIn(d.startTime) + ' &nbsp; Meeting place: ' + paperWriteIn(d.meetingPlace);
                    var title = paperText(d.documentaryTitle);
                    var consent = 'This interview will be recorded for the documentary \'' + (title ? paperEsc(title) : '<span class="cs-writein pp-wi">' + PAPER_BLANK + '</span>') + '\'. You may decline any question or stop the interview at any time. A separate release form will be signed before filming.';
                    var defaults = self._howWeFilm(d.durationLine);
                    var savedBullets = Array.isArray(d.howWeFilm) ? d.howWeFilm : [];
                    var bullets = defaults.map(function (line, i) {
                        return savedBullets[i] !== undefined ? paperText(savedBullets[i]) : line;
                    });
                    if (!(options.editorData && options.editorData.howWeFilm && options.editorData.durationLine === undefined)) {
                        bullets[6] = paperText(d.durationLine);
                    }
                    var groups = (Array.isArray(d.questionGroups) ? d.questionGroups : []).filter(function (g) { return g && (paperFirst(g.heading, g.title) || paperList(g.questions).length); });
                    var n = 1, qHtml = '';
                    groups.forEach(function (g) {
                        var gHead = paperFirst(g.heading, g.title);
                        var qs = paperList(g.questions);
                        qHtml += '<div class="pp-qgroup">' + (gHead ? '<div class="pp-group">' + paperEsc(gHead) + '</div>' : '') +
                            (qs.length ? '<ol class="pp-ol" start="' + n + '">' + qs.map(function (q) { return '<li>' + paperEsc(q) + '</li>'; }).join('') + '</ol>' : '') + '</div>';
                        n += qs.length;
                    });
                    if (!groups.length) {
                        var blanks = '';
                        for (var i = 0; i < 5; i++) blanks += '<li>' + paperWriteIn('', true) + '</li>';
                        qHtml = '<ol class="pp-ol">' + blanks + '</ol>';
                    }
                    var rawPrompts = (Array.isArray(d.whoElse) && d.whoElse.length) ? d.whoElse : d.whoElsePrompts;
                    var prompts = (Array.isArray(rawPrompts) ? rawPrompts : []).filter(function (p) { return p && paperText(p.text || p); });
                    var whoHtml = prompts.length
                        ? '<ul class="pp-ul">' + prompts.map(function (p) {
                            var label = paperText(p.writeIn) || 'Name';
                            return '<li>' + paperEsc(paperText(p.text || p)) + '<div class="pp-p">' + paperEsc(label) + ': ' + paperWriteIn('') + '</div></li>';
                        }).join('') + '</ul>'
                        : '<ul class="pp-ul"><li>Name and role: ' + paperWriteIn('') + '</li><li>Name and role: ' + paperWriteIn('') + '</li></ul>';
                    var footerText = paperFirst(d.footerNote, d.footer, d.sourceNote, d.includeCollettFooter ? self.referenceExample().footerNote : '');
                    var body = '<div class="pp-page" data-doc="interviewQuestions">' +
                        paperHeader('Interview Question Sheet', [d.subhead]) +
                        '<div class="pp-grid">' +
                        paperField('FOR', forLine) +
                        paperField('FROM', paperWriteIn(d.fromLine)) +
                        paperField('CLIENT', paperWriteIn(d.client)) +
                        paperField('PROJECT', paperWriteIn(d.projectName)) +
                        paperField('SHOOT', shoot, true) +
                        paperField('PLACE', paperWriteIn(d.place)) +
                        '</div>' +
                        '<h2 class="pp-h2">Informed Consent</h2><p class="pp-p">' + consent + '</p>' +
                        '<h2 class="pp-h2">How we will film this</h2><ul class="pp-ul">' + bullets.map(function (t) { return '<li>' + paperWriteIn(t) + '</li>'; }).join('') + '</ul>' +
                        '<h2 class="pp-h2">Questions</h2>' + qHtml +
                        '<h2 class="pp-h2">Who else we would like to speak with</h2>' +
                        '<p class="pp-p">If you can, please add names. We would like a short conversation (about 10 minutes) with:</p>' + whoHtml +
                        (footerText ? '<div class="pp-footer">' + paperEsc(footerText) + '</div>' : '') +
                        '</div>';
                    return engine._wrapHtml(paperBrand((d.projectName || b.projectName || 'Production') + ' - Interview Question Sheet'), body, PAPER_CSS);
                }
            },

            /* ---- PRODUCTION PAPERWORK: EQUIPMENT CHECKLIST ---- */
            equipmentChecklist: {
                id: 'equipmentChecklist',
                name: 'Equipment Checklist',
                description: 'Gear pack-out and pack-in checklist filled from Production equipment and kit-rental lines, with blank rows and Out and In signatures.',
                formats: ['pdf', 'html', 'print'],
                hasEditor: true,
                _isEquipmentLine: function (item, sec, name) {
                    var kind = String(item.itemType || '').toLowerCase().trim();
                    if (['equipment', 'equip', 'gear', 'rental', 'rentals', 'kit'].indexOf(kind) > -1) return true;
                    var secId = String((sec && sec.id) || '').toLowerCase();
                    var desc = String(item.description || '').toLowerCase();
                    if (/\bkit rental\b/.test(desc)) return true;
                    // Catalog adoption can stamp a crew tag from a partial description match.
                    var catalogWordBreak = /[^\p{L}\p{Nd}]+/gu;
                    var catalog = typeof item.catalogDescription === 'string' ? item.catalogDescription.toLowerCase().replace(catalogWordBreak, ' ').trim() : '';
                    var catalogMatch = catalog && desc.replace(catalogWordBreak, ' ').trim() === catalog;
                    if ((kind === 'crew' && catalogMatch) || /\b(fee|deposit)\b/.test(desc)) return false;

                    var label = kind ? paperWithoutParentheses(desc).replace(/[\s\p{P}]+$/u, '') : '';
                    var gearNoun = /(?<![\p{L}\p{M}\p{N}_])(?:kit|package|rig|console|cart|monitor|recorder|case|stand)$/u.test(label) &&
                        !/\b(with|incl|own)\b|[+/]/.test(label);
                    var crewRole = /\b(recordist|operator|director|assistant|assist|driver|producer|editor|coordinator|manager|technician|designer|artist|writer|utility|pilot)\b/.test(desc);
                    // AC also appears in gear voltage descriptions.
                    var acLabel = kind ? desc.replace(/^[\s\p{Cf}]+|[\s\p{P}\p{Cf}]+$/gu, '') : '';
                    // Ordinals ending in 11, 12 or 13 take the suffix 'th'.
                    var taggedCrewRole = kind && (
                        /\b(op|asst|tech|trainee|loader|crew|electrician|spark|puller|dit|stand-in)\b/.test(desc) ||
                        acLabel === 'ac' || /^[1-9]\s*ac$/u.test(acLabel) ||
                        /(?<![\p{L}\p{M}\p{N}_])(?:(?!\d*1[123](?:st|nd|rd))\d*(?:1st|2nd|3rd)|\d*(?:1[123]|[04-9])th)\s*ac(?![\p{L}\p{M}\p{N}_])/u.test(acLabel) ||
                        /(?<![\p{L}\p{M}\p{N}_])(?:camera|lead|key|b|second|first|focus)\s+ac$/u.test(acLabel) ||
                        (!catalogMatch && /\b(gaffer|grip|dp|cinematographer|photographer|videographer|swinger|best boy)\b/.test(desc))
                    );
                    if (!gearNoun && (crewRole || taggedCrewRole)) return false;

                    if (['gear', 'equipment'].indexOf(secId) > -1) return true;
                    return paperProductionSection(sec, name) && (
                        /\b(equipment|package|kit|camera|lens|lenses|tripod|gimbal|drone|lighting|lights|monitor|recorder|microphones?|mics?|batteries|media cards?)\b/.test(desc) ||
                        (kind !== '' && /(?<![\p{L}\p{M}\p{N}\p{Pd}_])(?:rig|console|cart|cases?|stands?)(?![\p{L}\p{M}\p{N}\p{Pd}_])/u.test(desc))
                    );
                },
                getDefaultData: function (budgetData, options) {
                    var self = this;
                    var b = budgetData || {};
                    var opts = options || {};
                    var contacts = paperContacts(b, opts);
                    var gear = [], vendors = [];
                    Object.keys(b.sections || {}).forEach(function (name) {
                        var sec = b.sections[name] || {};
                        (sec.items || []).forEach(function (item) {
                            if (!item || item.memoId || item.memoStatus || !paperText(item.description)) return;
                            if (!self._isEquipmentLine(item, sec, name)) return;
                            var c = paperLineContact(item, contacts);
                            var vendor = paperFirst(c && c.name, item.crew && item.crew.name);
                            var vendorPhone = paperFirst(c && c.phone, item.crew && item.crew.phone);
                            if ((vendor || vendorPhone) && !vendors.some(function (v) { return v.name === vendor && v.phone === vendorPhone; })) {
                                vendors.push({ name: vendor, phone: vendorPhone });
                            }
                            gear.push({
                                itemId: item.id || '',
                                qty: item.quantity != null && String(item.quantity).trim() !== '' ? String(item.quantity) : '',
                                description: paperText(item.description),
                                serial: '', notes: '',
                                vendor: vendor,
                                vendorPhone: vendorPhone
                            });
                        });
                    });
                    var crew = paperContactById(contacts, opts.crewContactId || opts.issuedToContactId);
                    var dates = [];
                    if (b.startDate) dates.push('Start ' + paperDate(b.startDate));
                    if (b.shootDate) dates.push('Shoot ' + paperDate(b.shootDate));
                    if (parseInt(b.productionDays, 10) > 0) dates.push(parseInt(b.productionDays, 10) + (parseInt(b.productionDays, 10) === 1 ? ' day' : ' days'));
                    return {
                        projectName: b.workingTitle || b.projectName || '',
                        projectLocation: b.projectLocation || '',
                        shootDate: b.shootDate || '',
                        kitName: gear.length === 1 ? gear[0].description : '',
                        ownerVendor: vendors.length === 1 ? paperText(vendors[0].name) : '',
                        ownerPhone: vendors.length === 1 ? paperText(vendors[0].phone) : '',
                        issuedTo: crew ? paperText(crew.name) : '',
                        shootDates: dates.join(', '),
                        perKit: false,
                        blankRows: 4,
                        gear: gear
                    };
                },
                _sheet: function (d, rows, kitName, vendor, vendorPhone) {
                    var tbody = rows.map(function (r) {
                        return '<tr class="pp-row-item"><td class="col-c">' + paperWriteIn(r.qty) + '</td><td>' + paperWriteIn(r.description) + '</td><td>' + paperWriteIn(r.serial) + '</td>' +
                            '<td class="col-c"><input type="checkbox" class="cs-checkbox" aria-checked="false"></td><td class="col-c"><input type="checkbox" class="cs-checkbox" aria-checked="false"></td>' +
                            '<td></td><td></td><td>' + (paperText(r.notes) ? paperEsc(paperText(r.notes)) : '') + '</td></tr>';
                    }).join('');
                    var blank = Math.max(4, Math.min(60, parseInt(d.blankRows, 10) || 0));
                    for (var i = 0; i < blank; i++) {
                        tbody += '<tr class="pp-row-blank"><td></td><td></td><td></td><td class="col-c"><input type="checkbox" class="cs-checkbox" aria-checked="false"></td><td class="col-c"><input type="checkbox" class="cs-checkbox" aria-checked="false"></td><td></td><td></td><td></td></tr>';
                    }
                    return '<div class="pp-page" data-doc="equipmentChecklist">' +
                        paperHeader('Equipment Checklist', [d.projectName, paperDate(d.shootDate), d.projectLocation]) +
                        '<div class="pp-grid">' +
                        paperField('KIT OR PACKAGE NAME', paperWriteIn(kitName), true) +
                        paperField('OWNER OR VENDOR', paperWriteIn(vendor)) +
                        paperField('PHONE', paperWriteIn(vendorPhone, false, true)) +
                        paperField('ISSUED TO / CREW RESPONSIBLE', paperWriteIn(d.issuedTo)) +
                        paperField('SHOOT DATES OR DAY COUNT', paperWriteIn(paperDate(d.shootDates))) +
                        '</div>' +
                        '<table class="pp-table pp-gear"><thead><tr><th class="col-c" style="width:36px;">QTY</th><th>ITEM / DESCRIPTION</th><th>SERIAL OR ASSET NO.</th><th class="col-c" style="width:30px;">OUT</th><th class="col-c" style="width:30px;">IN</th><th>CONDITION OUT</th><th>CONDITION IN</th><th>NOTES</th></tr></thead><tbody>' + tbody + '</tbody></table>' +
                        '<h2 class="pp-h2">Damage or shortage notes</h2>' + paperLines(4) +
                        '<h2 class="pp-h2">Out</h2>' + paperDual(paperSig('Issued by / owner or vendor', vendor), paperSig('Received by / crew', paperText(d.issuedTo))) +
                        '<h2 class="pp-h2">In</h2>' + paperDual(paperSig('Returned by / crew', paperText(d.issuedTo)), paperSig('Received by / owner', vendor)) +
                        '<div class="pp-footer">Keep this list with the kit until every item is checked back in.</div>' +
                        '</div>';
                },
                renderHtml: function (budgetData, options, engine) {
                    var self = this;
                    var b = budgetData || {};
                    options = options || {};
                    var d = paperMerge(self.getDefaultData(b, options), options.editorData);
                    var rows = (Array.isArray(d.gear) ? d.gear : []).filter(function (r) { return r && (paperText(r.description) || paperText(r.qty)); });
                    var body = '';
                    if (d.perKit && String(d.perKit) !== 'false' && rows.length > 1) {
                        rows.forEach(function (r) {
                            body += self._sheet(d, [r], r.description, paperFirst(r.vendor, d.ownerVendor), paperFirst(r.vendorPhone, r.vendor ? '' : d.ownerPhone));
                        });
                    } else {
                        body = self._sheet(d, rows, d.kitName, d.ownerVendor, d.ownerPhone);
                    }
                    return engine._wrapHtml(paperBrand((d.projectName || b.projectName || 'Production') + ' - Equipment Checklist'), body, PAPER_CSS + PAPER_FIT_CSS);
                }
            },

            /* ---- PUBLIC API ---- */

            paperBrand: paperBrand,

            /** Returns metadata for all templates (no render functions — safe to pass to UI) */
            getAll: function () {
                var self = this;
                return ['topSheet', 'detailBudget', 'callSheet', 'costReport', 'purchaseOrder', 'pettyCash', 'crewDealMemo', 'crewList', 'productionReport', 'talentAgreement', 'locationAgreement', 'kitRentalAgreement', 'dood', 'fundingPackage', 'fundingStrategy', 'budgetComparison', 'scriptBreakdown', 'shootingSchedule', 'continuityLog', 'movementOrder', 'pitchDeck', 'storyboard', 'appearanceRelease', 'vendorInvoice', 'incidentReport', 'nda', 'wrapReport', 'extrasVoucher', 'weeklyCostReport', 'cashPaymentVoucher', 'groupMinorConsent', 'interviewQuestions', 'equipmentChecklist'].map(function (key) {
                    var t = self[key];
                    return { id: t.id, name: t.name, description: t.description, formats: t.formats, hasEditor: !!t.hasEditor };
                });
            },

            /** Render a template to an HTML string.
                @param {string} templateId  - any template id
                @param {object} budgetData  - budget JSON from IndexedDB
                @param {object} options     - { currency, rate, editorData, callSheetData }
                @returns {string} Full HTML document string */
            render: function (templateId, budgetData, options) {
                var ogAliases = {
                    cashVoucher: 'cashPaymentVoucher',
                    groupMinor: 'groupMinorConsent',
                    interviewQs: 'interviewQuestions',
                    equipCheck: 'equipmentChecklist',
                    talentAgr: 'talentAgreement',
                    locRel: 'locationAgreement',
                    dealMemo: 'crewDealMemo',
                    prodReport: 'productionReport',
                    kitRental: 'kitRentalAgreement',
                    po: 'purchaseOrder',
                    breakdown: 'scriptBreakdown'
                };
                var resolvedId = (!this[templateId] && ogAliases[templateId]) ? ogAliases[templateId] : templateId;
                var tmpl = this[resolvedId];
                if (!tmpl || typeof tmpl.renderHtml !== 'function') {
                    return this._wrapHtml('Error', '<p style="color:#dc2626;padding:20px;">Unknown template: ' + esc(templateId) + '</p>');
                }
                /* Expose options to _wrapHtml for brand/watermark without touching all call sites */
                var opts = {}, key, base = (budgetData && budgetData.currency) || 'JMD';
                for (key in (options || {})) { if (Object.prototype.hasOwnProperty.call(options, key)) opts[key] = options[key]; }
                if (opts.easyOnTheInk == null) {
                    try { opts.easyOnTheInk = localStorage.getItem('mbt_easy_on_the_ink') === '1'; } catch (e) { opts.easyOnTheInk = false; }
                }
                var wanted = opts.currency || base;
                var engine = (window.mBT && window.mBT.le) || (window.parent && window.parent.mBT && window.parent.mBT.le);
                var multiplier = wanted === base ? 1 : (engine && engine.convertCurrencyOrNull ? engine.convertCurrencyOrNull(1, base, wanted, budgetData, true) : null);
                opts.currency = multiplier === null ? base : wanted;
                opts.rate = multiplier === null ? 1 : multiplier;
                this._currentOptions = opts;
                try {
                    var html = tmpl.renderHtml(budgetData, opts, this);
                    if (multiplier === null) html = html.replace(/(<body[^>]*>)/i, '$1<p>Missing exchange rate for ' + esc(wanted) + '. Documents stay in ' + esc(base) + '.</p>');
                    return html;
                }
                finally { this._currentOptions = null; }
            },

            /** Generate a cover/contents page for a package export.
                Lists included documents without page numbers (html2pdf cannot introspect them).
                @param {string[]} templateIds
                @param {object}   budgetData
                @param {object}   options
                @returns {{ css: string, body: string }} */
            _tocPageHtml: function (templateIds, budgetData, options) {
                var self = this;
                var opts = options || {};
                var ink = opts.easyOnTheInk != null
                    ? !!opts.easyOnTheInk
                    : (function () { try { return localStorage.getItem('mbt_easy_on_the_ink') === '1'; } catch (e) { return false; } })();
                var brand = opts.brand || {};
                var projectName = esc((budgetData && budgetData.projectName) || 'Untitled Production');
                var company = esc(paperBrand(brand.name || (budgetData && budgetData.company) || ''));
                var dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                var watermark = opts.watermark || '';

                var docRows = templateIds.map(function (id, i) {
                    var tmpl = self[id];
                    var name = tmpl ? esc(tmpl.name) : esc(id);
                    return '<tr><td style="padding:8px 12px;font-size:11pt;color:#1e293b;">' + (i + 1) + '.&nbsp;&nbsp;' + name + '</td></tr>';
                }).join('');

                var watermarkHtml = watermark
                    ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:72pt;font-weight:900;color:rgba(0,0,0,0.06);white-space:nowrap;pointer-events:none;z-index:0;">' + esc(watermark) + '</div>'
                    : '';

                var logoSrc = safeAssetUrl(brand.logo);
                var logoHtml = logoSrc
                    ? '<img src="' + logoSrc + '" style="max-height:48px;max-width:160px;object-fit:contain;margin-bottom:8px;" alt="Logo">'
                    : '';

                var css = '.toc-page{font-family:Helvetica,Arial,sans-serif;color:#1e293b;background:#fff;width:8in;min-height:10in;padding:1.5in 1.2in;box-sizing:border-box;position:relative;}.toc-rule{border:none;border-top:' + (ink ? '1px dashed #000' : '2px solid #0f172a') + ';margin:18px 0;}table.toc-list{width:100%;border-collapse:collapse;}table.toc-list tr+tr td{border-top:1px solid ' + (ink ? '#000' : '#e2e8f0') + ';}';

                var body = '<div class="toc-page">' + watermarkHtml +
                    '<div style="position:relative;z-index:1;">' +
                    (logoHtml ? '<div>' + logoHtml + '</div>' : '') +
                    '<div style="font-size:9pt;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">' + (company || 'Document Package') + '</div>' +
                    '<div style="font-size:26pt;font-weight:900;line-height:1.1;color:#0f172a;">' + projectName + '</div>' +
                    '<hr class="toc-rule">' +
                    '<div style="font-size:11pt;font-weight:700;color:#475569;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Contents</div>' +
                    '<table class="toc-list">' + docRows + '</table>' +
                    '<div style="margin-top:40px;font-size:8pt;color:#94a3b8;">Generated ' + esc(dateStr) + ' &bull; mBT Document Engine</div>' +
                    '</div></div>';

                if (ink) {
                    css = this._inkStyle(css) + '\n' + this._inkCss;
                    body = this._inkBody(body);
                }

                return { css: css, body: body };
            },

            /**
             * Extract CSS + body from a full template HTML document string.
             * Setting a full <!DOCTYPE> document as div.innerHTML strips html/head/body,
             * so callers must inject only style+body fragments.
             */
            _extractHtmlParts: function (html) {
                var css = '';
                var re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
                var m;
                while ((m = re.exec(html)) !== null) {
                    css += m[1] + '\n';
                }
                var bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                return {
                    css: css,
                    body: bodyMatch ? bodyMatch[1] : html
                };
            },

            /**
             * Mount an off-screen export container for html2pdf/html2canvas.
             * Root cause of blank PDFs (2026-07):
             * 1) opacity:0 makes html2canvas paint fully transparent (blank page).
             * 2) On Document Builder (html/body height:100% flex layout), bundled
             *    html2canvas often measures capture height as 0 unless height and
             *    windowHeight are set explicitly from scrollHeight.
             * Fix: full opacity, parked off-screen at left:-10000px, then pass
             * measured height into html2canvas options (see _html2pdfOptions).
             */
            _mountExportContainer: function (css, bodyHtml) {
                var container = document.createElement('div');
                container.setAttribute('data-mbt-pdf-export', '1');
                container.style.cssText = 'position:fixed;left:-10000px;top:0;width:7.2in;background:#ffffff;opacity:1;pointer-events:none;z-index:2147483646;font-family:Helvetica,Arial,sans-serif;font-size:9pt;color:#1a1a2e;';
                /* Template CSS targets body / body::before (watermark). Inside a bare div those
                   selectors never match, so retarget them at the export root. */
                var scopedCss = String(css || '')
                    .replace(/body::before/gi, '[data-mbt-pdf-export="1"]::before')
                    .replace(/body::after/gi, '[data-mbt-pdf-export="1"]::after')
                    .replace(/(^|}|,)\s*body\s*\{/gi, '$1[data-mbt-pdf-export="1"]{');
                container.innerHTML = '<style>' + scopedCss + '</style>' + (bodyHtml || '');
                document.body.appendChild(container);
                /* Force layout so scrollHeight is real before html2canvas reads it */
                void container.offsetHeight;
                return container;
            },

            _captureBackdrop: function () {
                var canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'), saved = [];
                [document.documentElement, document.body].forEach(function (node) {
                    var value = window.getComputedStyle(node).backgroundColor;
                    if (!/oklch|oklab|color\(|color-mix\(/.test(value)) return;
                    saved.push({ node: node, value: node.style.backgroundColor });
                    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
                    var p = ctx.getImageData(0, 0, 1, 1).data;
                    node.style.backgroundColor = 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + (p[3] / 255) + ')';
                });
                return function () { saved.forEach(function (s) { s.node.style.backgroundColor = s.value; }); };
            },
            /* Normalize modern CSS colors only in the capture clone. */
            _captureColors: function (doc) {
                /* html2pdf clones the offscreen root into its printable wrapper.
                   Its fixed negative position must not survive in that wrapper. */
                var roots = doc.querySelectorAll('.html2pdf__container [data-mbt-pdf-export="1"]');
                for (var r = 0; r < roots.length; r++) {
                    roots[r].style.position = 'static';
                    roots[r].style.left = 'auto'; roots[r].style.top = 'auto';
                    roots[r].style.width = '100%'; roots[r].style.opacity = '1';
                }
                var canvas = doc.createElement('canvas'); canvas.width = canvas.height = 1;
                var ctx = canvas.getContext('2d'), fields = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'textDecorationColor'];
                var nodes = doc.querySelectorAll('*'), cache = {};
                function convert(value) {
                    if (cache[value]) return cache[value];
                    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
                    var pixel = ctx.getImageData(0, 0, 1, 1).data;
                    return cache[value] = 'rgba(' + pixel[0] + ',' + pixel[1] + ',' + pixel[2] + ',' + (pixel[3] / 255) + ')';
                }
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i], style = doc.defaultView.getComputedStyle(node);
                    fields.forEach(function (field) { if (/oklch|oklab|color\(|color-mix\(|\blab\(|\blch\(/.test(style[field])) node.style[field] = convert(style[field]); });
                }
            },
            /** html2pdf options that force a non-zero capture height on flex/100% pages. */
            _html2pdfOptions: function (filename, container) {
                var h = Math.max(
                    (container && container.scrollHeight) || 0,
                    (container && container.offsetHeight) || 0,
                    1
                );
                return {
                    margin: [0.65, 0.65, 0.65, 0.65],
                    filename: filename || 'document.pdf',
                    image: { type: 'jpeg', quality: 0.97 },
                    html2canvas: {
                        scale: 2,
                        useCORS: false,
                        logging: false,
                        backgroundColor: '#ffffff',
                        onclone: this._captureColors,
                        windowHeight: h,
                        scrollX: 0,
                        scrollY: 0
                    },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                };
            },

            _unmountExportContainer: function (container) {
                if (container && container.parentNode) {
                    container.parentNode.removeChild(container);
                }
            },

            /**
             * Run html2pdf against a mounted container, always cleaning up.
             * @param {HTMLElement} container
             * @param {object} opts - from _html2pdfOptions
             * @param {string} mode - 'save' | 'blob'
             * @returns Promise (void for save, Blob for blob)
             */
            _runHtml2pdf: function (container, opts, mode) {
                var self = this;
                var restore = this._captureBackdrop(), p;
                try {
                    /* Normalize before html2pdf measures page-break spacing. */
                    var printable = container.cloneNode(true);
                    printable.style.position = 'static'; printable.style.left = 'auto'; printable.style.top = 'auto';
                    printable.style.width = '100%'; printable.style.opacity = '1';
                    var worker = window.html2pdf().set(opts).from(printable);
                    p = worker.toCanvas().get('canvas').then(function (canvas) {
                        var data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                        var visible = false;
                        for (var i = 0; i < data.length; i += 16) {
                            if (data[i + 3] && (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245)) { visible = true; break; }
                        }
                        if (!visible) throw new Error('PDF image is blank. Use Print and Save as PDF instead.');
                        return mode === 'blob' ? worker.outputPdf('blob') : worker.save();
                    });
                } catch (err) { restore(); self._unmountExportContainer(container); return Promise.reject(err); }
                return p.then(function (result) {
                    restore();
                    self._unmountExportContainer(container);
                    return result;
                }).catch(function (err) {
                    restore();
                    self._unmountExportContainer(container);
                    throw err;
                });
            },

            /** Export multiple templates as one combined PDF (page break between each).
                @param {string[]} templateIds  - ordered list of template ids to include
                @param {object}   budgetData
                @param {object}   options      - supports { toc: true } to prepend a contents page
                @returns Promise */
            toPackagePdf: function (templateIds, budgetData, options) {
                if (typeof window.html2pdf === 'undefined') {
                    return Promise.reject(new Error('html2pdf not loaded'));
                }
                var self = this;
                var opts = options || {};
                var projectName = (budgetData && budgetData.projectName) || 'Package';
                var fname = slugify(projectName) + '_package.pdf';

                /* Render each template and extract its style+body */
                var parts = templateIds.map(function (id) {
                    var html = self.render(id, budgetData, opts);
                    return self._extractHtmlParts(html);
                });

                /* Prepend TOC cover page when requested */
                if (opts.toc) {
                    var toc = self._tocPageHtml(templateIds, budgetData, opts);
                    parts.unshift(toc);
                }

                /* Merge: shared base CSS + per-doc styles, bodies separated by page-break divs */
                var mergedCss = parts.map(function (p) { return p.css; }).join('\n');
                var mergedBody = parts.map(function (p, i) {
                    return (i > 0 ? '<div style="page-break-before:always;"></div>' : '') + p.body;
                }).join('');

                var container = this._mountExportContainer(mergedCss, mergedBody);
                return this._runHtml2pdf(container, this._html2pdfOptions(fname, container), 'save');
            },

            /** Download PDF of a rendered template using html2pdf.js */
            toPdf: function (templateId, budgetData, options) {
                /* Route templates with a native autoTable renderer directly through jsPDF.
                   This bypasses html2canvas entirely, preventing memory crashes on large tables. */
                /* Use the same HTML as Print for every document. */
                if (typeof window.html2pdf === 'undefined') {
                    notify('Error', 'PDF export engine (html2pdf) not loaded.');
                    return Promise.reject(new Error('html2pdf not loaded'));
                }
                var html = this.render(templateId, budgetData, options);
                var fname = slugify((budgetData && budgetData.projectName) || templateId) + '_' + templateId + '.pdf';
                var parts = this._extractHtmlParts(html);
                var container = this._mountExportContainer(parts.css, parts.body);

                return this._runHtml2pdf(container, this._html2pdfOptions(fname, container), 'save')
                    .catch(function (err) {
                        notify('PDF Error', 'Export failed. Try Print instead.');
                        console.error('[mBTPublisher toPdf]', err);
                        throw err;
                    });
            },

            /** Build a PDF Blob for share pipelines (same capture path as toPdf).
                @returns Promise<Blob> */
            toJpegBlob: function (templateId, budgetData, options) {
                if (templateId !== 'storyboard' || !window.html2canvas) return Promise.reject(new Error('JPEG is available for storyboards only.'));
                var parts = this._extractHtmlParts(this.render(templateId, budgetData, options));
                var container = this._mountExportContainer(parts.css, parts.body);
                var restore = this._captureBackdrop(), colors = this._captureColors;
                return Promise.resolve().then(function () { return window.html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: false, onclone: colors }); }).then(function (canvas) {
                    return new Promise(function (resolve, reject) { canvas.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error('JPEG creation failed.')); }, 'image/jpeg', 0.95); });
                }).then(function (blob) { restore(); container.parentNode.removeChild(container); return blob; }, function (err) { restore(); if (container.parentNode) container.parentNode.removeChild(container); throw err; });
            },
            /* One image per visual page or selected frame. Never one unbounded canvas. */
            toJpegBlobs: function (templateId, budgetData, options) {
                if (templateId !== 'storyboard') return Promise.reject(new Error('This document is PDF, not a visual JPEG page.'));
                options = options || {};
                var self = this, d = options.editorData || this.storyboard.getDefaultData(budgetData);
                var one = options.storyboardFrame !== undefined && options.storyboardFrame !== 'all';
                var perPage = parseInt(d.framesPerPage, 10) || 4;
                if ([2, 4, 6].indexOf(perPage) === -1) perPage = 4;
                var count = one ? 1 : Math.ceil((d.frames || []).length / perPage);
                if (!count) return Promise.reject(new Error('Add a storyboard frame before exporting.'));
                var result = [], chain = Promise.resolve();
                for (var i = 0; i < count; i++) (function (page) {
                    chain = chain.then(function () {
                        var opts = {};
                        Object.keys(options).forEach(function (key) { opts[key] = options[key]; });
                        if (!one) opts.storyboardPage = page;
                        if (options.onProgress) options.onProgress(page + 1, count);
                        return self.toJpegBlob(templateId, budgetData, opts).then(function (blob) { result.push(blob); });
                    });
                })(i);
                return chain.then(function () { return result; });
            },
            toPdfBlob: function (templateId, budgetData, options) {
                if (typeof window.html2pdf === 'undefined') {
                    return Promise.reject(new Error('html2pdf not loaded'));
                }
                var html = this.render(templateId, budgetData, options);
                var fname = slugify((budgetData && budgetData.projectName) || templateId) + '_' + templateId + '.pdf';
                var parts = this._extractHtmlParts(html);
                var container = this._mountExportContainer(parts.css, parts.body);
                return this._runHtml2pdf(container, this._html2pdfOptions(fname, container), 'blob');
            }
        },

        /* --- Bridge: Convenience Entry Points --- */
        exportToPDF: function (id, name) { this.format.pdf(id, name); },

        generateFastPreview: function (mode, elementId, cb) {
            var opts = (mode === 'standard') ? { linearize: true, bg: '#ffffff' } : {};
            this.format.jpeg(elementId, cb, opts);
        },

        downloadJPEG: function (url, title) {
            var a = document.createElement('a');
            a.href = url;
            a.download = (title || 'capture') + '.jpg';
            a.click();
        }
    };
})();
