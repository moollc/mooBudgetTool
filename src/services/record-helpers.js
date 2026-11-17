/* G1: pure ES5 helpers. No live caller, database open, schema or persistence. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.mBTRecordHelpers = factory();
}(this, function () {
    'use strict';
    var own = Object.prototype.hasOwnProperty;
    var kinds = ['typed', 'ledger', 'opengate', 'import', 'ai', 'calculated', 'default', 'legacyUnknown'];
    var derived = {
        line: ['actual', 'committedCost', 'total', 'variance', 'ETC', 'estimateToComplete'],
        budget: ['subtotal', 'grandTotal', 'actualTotal', 'fringesTotal', 'productionFeeAmount', 'incentiveRebate', 'incentiveQualifyingTotal'],
        po: ['paidAmount', 'paidDate', 'paidRef', 'paidMethod', 'settlement', 'openBalance'],
        fringe: ['base', 'amount']
    };
    function fail(code) { var e = new Error(code); e.code = code; throw e; }
    function text(v) { return typeof v === 'string' && v.replace(/^\s+|\s+$/g, '') !== ''; }
    function integer(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 0; }
    function json(v) {
        var k;
        if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
        if (typeof v === 'number' && isFinite(v)) return;
        if (typeof v !== 'object' || Object.prototype.toString.call(v) !== '[object Object]' && !Array.isArray(v)) fail('NOT_JSON');
        for (k in v) if (own.call(v, k)) json(v[k]);
    }
    function clone(v) { json(v); return JSON.parse(JSON.stringify(v)); }
    function canonical(v) {
        json(v);
        if (v === null || typeof v !== 'object') return JSON.stringify(v);
        if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
        return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canonical(v[k]); }).join(',') + '}';
    }
    function randomToken() {
        var crypto = typeof window !== 'undefined' && (window.crypto || window.msCrypto), a, out = '', i;
        if (crypto && crypto.getRandomValues && typeof Uint32Array !== 'undefined') {
            a = new Uint32Array(4); crypto.getRandomValues(a);
            for (i = 0; i < a.length; i++) out += ('00000000' + a[i].toString(16)).slice(-8);
        } else {
            for (i = 0; i < 4; i++) out += ('00000000' + Math.floor(Math.random() * 4294967296).toString(16)).slice(-8);
        }
        return out;
    }
    /* exists is a synchronous reserved-ID check. The commit still checks identity. */
    function newId(prefix, exists, random) {
        var id, i;
        if (!text(prefix) || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(prefix) || typeof exists !== 'function') fail('ID_OPTIONS');
        for (i = 0; i < 32; i++) {
            id = prefix + '_' + (random || randomToken)();
            if (!/^[a-zA-Z0-9_]+$/.test(id)) fail('INVALID_ID');
            if (!exists(id)) return id;
        }
        fail('ID_COLLISION');
    }
    function source(kind, detail) {
        var result = clone(detail || {});
        if (kinds.indexOf(kind) < 0) fail('SOURCE_KIND');
        result.kind = kind;
        return result;
    }
    function sourcesFor(fields, metadata) {
        var result = {};
        Object.keys(fields).forEach(function (k) { result[k] = source(metadata.kind, metadata); });
        return result;
    }
    function record(id, kind, budgetId, fields, sources) {
        var result = { id: id, kind: kind, budgetId: budgetId, version: 1, fields: clone(fields), sources: clone(sources), archivedAt: null };
        if (!text(id) || !text(kind) || !text(budgetId)) fail('IDENTITY');
        Object.keys(fields).forEach(function (k) { if (!sources[k] || kinds.indexOf(sources[k].kind) < 0) fail('UNSOURCED'); });
        return result;
    }
    function retainDraft(command, code, current) {
        return { command: clone(command), code: code, current: current ? clone(current) : null };
    }
    function prepareCAS(current, change, budgetId) {
        var next, fields = change.patch || {}, sources = change.sources || {}, keys = Object.keys(fields), blocked = derived[change.kind] || [];
        if (!text(change.recordId) || !text(change.kind) || !text(budgetId) || !integer(change.expectedVersion)) fail('COMMAND');
        if (current && (current.id !== change.recordId || current.kind !== change.kind || current.budgetId !== budgetId)) fail('IDENTITY_CONFLICT');
        if (current && (!integer(current.version) || current.version < 1)) fail('RECORD_VERSION');
        if ((current ? current.version : 0) !== change.expectedVersion) fail('STALE_VERSION');
        if (!keys.length) fail('EMPTY_PATCH');
        next = current ? clone(current) : record(change.recordId, change.kind, budgetId, {}, {});
        keys.forEach(function (k) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') fail('UNSAFE_FIELD');
            if (blocked.indexOf(k) >= 0) fail('CALCULATED_FIELD');
            if (!sources[k] || kinds.indexOf(sources[k].kind) < 0) fail('UNSOURCED');
            if (current && current.sources[k] && current.sources[k].kind === 'typed' && sources[k].kind !== 'typed' && change.acceptSource !== true) fail('DIFFERS_FROM_SOURCE');
            next.fields[k] = clone(fields[k]); next.sources[k] = clone(sources[k]);
        });
        next.version = current ? current.version + 1 : 1;
        return next;
    }
    function validDate(v) {
        var d;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
        d = new Date(v + 'T00:00:00Z');
        return isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }
    function frozenConversion(amount, currency, budgetCurrency, quote) {
        if (typeof amount !== 'number' || !isFinite(amount) || amount < 0 || !text(currency) || !text(budgetCurrency)) fail('MONEY');
        if (currency === budgetCurrency) return { from: currency, to: budgetCurrency, factor: 1, amount: amount, source: 'identity', at: null };
        if (!quote || quote.from !== currency || quote.to !== budgetCurrency || typeof quote.factor !== 'number' || !isFinite(quote.factor) || quote.factor <= 0 || !text(quote.source) || !text(quote.at)) fail('MISSING_RATE');
        var result = clone(quote);
        result.amount = amount * quote.factor;
        if (!isFinite(result.amount)) fail('MONEY');
        return result; /* Unrounded witness; display rounding is not a second conversion. */
    }
    function paymentEntry(input, metadata) {
        var fields, conversion, complete;
        if (typeof input.amount !== 'number' || !isFinite(input.amount) || input.amount < 0 || input.amount === 0 && input.legacy !== true) fail('PAYMENT_AMOUNT');
        complete = text(input.reference) && validDate(input.date) && text(input.method);
        if (!complete && input.legacy !== true) fail('PAYMENT_EVIDENCE');
        conversion = frozenConversion(input.amount, input.currency, input.budgetCurrency, input.quote);
        fields = {
            entryKind: 'payment', lineId: input.lineId || null, contactId: input.contactId || null,
            poId: input.poId || null, floatId: null, stageId: input.stageId || null,
            assignment: input.lineId ? 'assigned' : 'unassigned', amount: input.amount, currency: input.currency,
            budgetCurrency: input.budgetCurrency, budgetAmount: conversion.amount, frozenRate: conversion,
            date: input.date || null, reference: input.reference || null, method: input.method || null,
            receiptIds: clone(input.receiptIds || []), verification: complete ? 'verified' : 'legacy paid, evidence incomplete',
            verificationKind: 'paymentEvidence', voidedAt: null, legacy: input.legacy === true
        };
        var sources = sourcesFor(fields, metadata);
        sources.budgetAmount = source('calculated', { formula: 'frozenConversion', ref: { id: input.id, field: 'frozenRate' } });
        sources.frozenRate = source('ledger', { origin: 'frozen-quote-witness' });
        sources.verification = source('calculated', { formula: 'evidenceOrCoding' });
        sources.verificationKind = source('default', { origin: 'entry-schema' });
        sources.assignment = source('calculated', { formula: 'lineLink' });
        sources.entryKind = source('default', { origin: 'entry-schema' });
        return record(input.id, 'entry', input.budgetId, fields, sources);
    }
    function receiptEntry(input, metadata) {
        var conversion = frozenConversion(input.amount, input.currency, input.budgetCurrency, input.quote);
        var fields = {
            entryKind: 'pettyReceipt', lineId: input.lineId || null, contactId: input.contactId || null,
            poId: null, floatId: input.floatId || null, stageId: input.stageId || null,
            assignment: input.lineId ? 'assigned' : 'unassigned', amount: input.amount, currency: input.currency,
            budgetCurrency: input.budgetCurrency, budgetAmount: conversion.amount, frozenRate: conversion,
            date: input.date || null, description: input.description || '', receiptIds: clone(input.receiptIds || []),
            verification: input.lineId ? 'verified' : 'unverified', verificationKind: 'codedReceipt', voidedAt: null
        };
        if (!text(input.floatId) || !validDate(input.date) || input.amount <= 0) fail('RECEIPT');
        var sources = sourcesFor(fields, metadata);
        sources.budgetAmount = source('calculated', { formula: 'frozenConversion', ref: { id: input.id, field: 'frozenRate' } });
        sources.frozenRate = source('ledger', { origin: 'frozen-quote-witness' });
        sources.verification = source('calculated', { formula: 'evidenceOrCoding' });
        sources.verificationKind = source('default', { origin: 'entry-schema' });
        sources.assignment = source('calculated', { formula: 'lineLink' });
        sources.entryKind = source('default', { origin: 'entry-schema' });
        return record(input.id, 'entry', input.budgetId, fields, sources);
    }
    function manualAdjustment(target, otherActual, verifiedFloor) {
        if ([target, otherActual, verifiedFloor].some(function (v) { return typeof v !== 'number' || !isFinite(v) || v < 0; })) fail('MANUAL_AMOUNT');
        if (target < verifiedFloor) fail('VERIFIED_FLOOR');
        if (target < otherActual) fail('EDIT_OTHER_UNVERIFIED_ENTRIES');
        return target - otherActual;
    }
    function manualEntry(input, metadata) {
        var fields = {
            entryKind: 'manual', lineId: input.lineId || null, contactId: input.contactId || null,
            assignment: input.lineId ? 'assigned' : 'unassigned', verification: 'unverified',
            mode: input.mode || 'amount', currency: input.currency, date: input.date || null, voidedAt: null
        };
        if (!text(input.currency)) fail('MONEY');
        if (fields.mode === 'amount') {
            fields.amount = manualAdjustment(input.target, input.otherActual, input.verifiedFloor);
        } else if (fields.mode === 'quantityRate') {
            if ([input.quantity, input.rate].some(function (v) { return typeof v !== 'number' || !isFinite(v) || v < 0; })) fail('MANUAL_AMOUNT');
            manualAdjustment(input.otherActual + input.quantity * input.rate, input.otherActual, input.verifiedFloor);
            fields.quantity = input.quantity; fields.rate = input.rate;
        } else fail('MANUAL_MODE');
        return record(input.id, 'entry', input.budgetId, fields, sourcesFor(fields, metadata));
    }
    function unassign(entry) {
        var result = clone(entry);
        result.fields.formerLineId = result.fields.lineId;
        result.fields.lineId = null; result.fields.assignment = 'unassigned';
        result.sources.lineId = source('ledger', { origin: 'unassignment' });
        result.sources.formerLineId = source('ledger', { origin: 'unassignment' });
        result.sources.assignment = source('ledger', { origin: 'unassignment' });
        return result; /* Candidate only: commit with expectedVersion, never direct put. */
    }
    /* Integrity check for accidental corruption, not a cryptographic authenticity proof. */
    function checksum(textValue) {
        var h = 2166136261, i;
        for (i = 0; i < textValue.length; i++) { h ^= textValue.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); }
        return 'fnv1a32:' + ('00000000' + (h >>> 0).toString(16)).slice(-8);
    }
    function backup(id, budgetId, payload, at) {
        var bytes = JSON.stringify(clone(payload));
        if (!text(id) || !text(budgetId) || !text(at)) fail('BACKUP');
        return { id: id, budgetId: budgetId, at: at, raw: bytes, checksum: checksum(bytes), format: 'json-v1' };
    }
    function verifyBackup(value) {
        if (!value || value.format !== 'json-v1' || checksum(value.raw || '') !== value.checksum) fail('BACKUP_CORRUPT');
        return clone(JSON.parse(value.raw));
    }
    function staging(id, savedBackup) {
        verifyBackup(savedBackup);
        return { id: id, kind: 'migrationStage', budgetId: savedBackup.budgetId, version: 1,
            backupId: savedBackup.id, backupChecksum: savedBackup.checksum, status: 'staging',
            idMap: {}, records: [], unresolved: [], legacy: verifyBackup(savedBackup) };
    }
    return { clone: clone, canonical: canonical, newId: newId, source: source, sourcesFor: sourcesFor,
        record: record, prepareCAS: prepareCAS, retainDraft: retainDraft, validDate: validDate,
        frozenConversion: frozenConversion, paymentEntry: paymentEntry, receiptEntry: receiptEntry,
        manualAdjustment: manualAdjustment, manualEntry: manualEntry, unassign: unassign,
        backup: backup, verifyBackup: verifyBackup, staging: staging };
}));
