/* Shoot-day schedule and paid-by helpers. ES5. No network or storage side effects. */
(function (window) {
    'use strict';

    var KINDS = ['pickup', 'depart', 'arrive', 'start', 'wrap', 'return', 'interview', 'other'];
    var RELEASE = ['none', 'pending', 'signed'];
    var METHODS = [
        { id: 'cash', label: 'Cash' },
        { id: 'transfer', label: 'Bank transfer' }
    ];
    var LEGACY = ['wire', 'cheque', 'paypal', 'wise', 'payoneer'];
    var PAID_OK = { cash: 1, transfer: 1, wire: 1, cheque: 1, paypal: 1, wise: 1, payoneer: 1 };

    /* vm contexts give array/object literals a different realm than the test harness.
       JSON.parse builds host-realm values so node:assert/strict deepEqual can pass. */
    function hostList() {
        return JSON.parse('[]');
    }

    function hostData(v) {
        return JSON.parse(JSON.stringify(v));
    }

    function hostRefs(arr) {
        var out = hostList();
        var i;
        for (i = 0; i < arr.length; i++) out.push(arr[i]);
        return out;
    }

    function own(o, k) {
        return o != null && Object.prototype.hasOwnProperty.call(o, k);
    }

    function asText(v) {
        return typeof v === 'string' ? v.trim() : '';
    }

    function linkField(v) {
        if (v === null || v === undefined) return null;
        if (typeof v === 'string') return v.trim();
        return '';
    }

    function flagTrue(v) {
        return v === true;
    }

    function dayNumOf(v) {
        return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 1 ? v : null;
    }

    function kindOf(v) {
        var k = asText(v);
        return KINDS.indexOf(k) >= 0 ? k : 'other';
    }

    function releaseOf(v) {
        var r = asText(v);
        return RELEASE.indexOf(r) >= 0 ? r : 'none';
    }

    function validDate(s) {
        if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
        var p = s.split('-');
        var y = +p[0];
        var m = +p[1];
        var d = +p[2];
        var dt = new Date(Date.UTC(y, m - 1, d));
        return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    }

    function validTime(s) {
        if (typeof s !== 'string' || !/^\d{2}:\d{2}$/.test(s)) return false;
        var h = +s.slice(0, 2);
        var m = +s.slice(3, 5);
        return h >= 0 && h <= 23 && m >= 0 && m <= 59;
    }

    function dateOf(v) {
        var s = asText(v);
        return validDate(s) ? s : '';
    }

    function timeOf(v) {
        var s = asText(v);
        return validTime(s) ? s : '';
    }

    function scheduleList(input) {
        if (Array.isArray(input)) return input;
        if (input && typeof input === 'object' && Array.isArray(input.shootSchedule)) return input.shootSchedule;
        return hostList();
    }

    function isPlain(v) {
        return !!(v && typeof v === 'object' && !Array.isArray(v));
    }

    function locationOf(raw) {
        return {
            id: asText(raw.id),
            name: asText(raw.name),
            address: asText(raw.address),
            parish: asText(raw.parish),
            siteContactId: linkField(own(raw, 'siteContactId') ? raw.siteContactId : null),
            siteContactName: asText(raw.siteContactName),
            siteContactPhone: asText(raw.siteContactPhone),
            nearestHospital: asText(raw.nearestHospital),
            tbc: flagTrue(raw.tbc)
        };
    }

    function legOf(raw) {
        return {
            id: asText(raw.id),
            kind: kindOf(raw.kind),
            time: timeOf(raw.time),
            locationId: linkField(own(raw, 'locationId') ? raw.locationId : null),
            contactId: linkField(own(raw, 'contactId') ? raw.contactId : null),
            note: asText(raw.note),
            tbc: flagTrue(raw.tbc)
        };
    }

    function interviewOf(raw) {
        return {
            id: asText(raw.id),
            contactId: linkField(own(raw, 'contactId') ? raw.contactId : null),
            name: asText(raw.name),
            role: asText(raw.role),
            time: timeOf(raw.time),
            locationId: linkField(own(raw, 'locationId') ? raw.locationId : null),
            releaseStatus: releaseOf(raw.releaseStatus)
        };
    }

    function dayOf(raw) {
        var locations = [];
        var legs = [];
        var interviews = [];
        var i;
        var rawLocs = raw.locations;
        if (Array.isArray(rawLocs)) {
            for (i = 0; i < rawLocs.length; i++) {
                if (isPlain(rawLocs[i])) locations.push(locationOf(rawLocs[i]));
            }
        } else if (rawLocs && typeof rawLocs === 'object') {
            /* Z4: plain object collections become an array of values. */
            var locVals = Object.values(rawLocs);
            for (i = 0; i < locVals.length; i++) {
                if (isPlain(locVals[i])) locations.push(locationOf(locVals[i]));
            }
        }
        if (Array.isArray(raw.legs)) {
            for (i = 0; i < raw.legs.length; i++) {
                if (isPlain(raw.legs[i])) legs.push(legOf(raw.legs[i]));
            }
        }
        if (Array.isArray(raw.interviews)) {
            for (i = 0; i < raw.interviews.length; i++) {
                if (isPlain(raw.interviews[i])) interviews.push(interviewOf(raw.interviews[i]));
            }
        }
        return {
            id: asText(raw.id),
            date: dateOf(raw.date),
            dayNum: dayNumOf(raw.dayNum),
            label: asText(raw.label),
            tbc: flagTrue(raw.tbc),
            locations: locations,
            legs: legs,
            interviews: interviews
        };
    }

    function normalise(input) {
        var list = scheduleList(input);
        var out = [];
        var i;
        for (i = 0; i < list.length; i++) {
            if (isPlain(list[i])) out.push(dayOf(list[i]));
        }
        return hostData(out);
    }

    function hex8() {
        var cryptoObj = window && window.crypto;
        var s = '';
        var i;
        if (cryptoObj && typeof cryptoObj.getRandomValues === 'function' && typeof Uint8Array !== 'undefined') {
            var a = new Uint8Array(4);
            cryptoObj.getRandomValues(a);
            for (i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
            return s;
        }
        for (i = 0; i < 4; i++) s += ('0' + Math.floor(Math.random() * 256).toString(16)).slice(-2);
        return s;
    }

    function mint(prefix, seen) {
        var id;
        do {
            id = prefix + '_' + hex8();
        } while (seen[id]);
        seen[id] = 1;
        return id;
    }

    function claim(id, prefix, seen) {
        if (typeof id === 'string' && id !== '' && !seen[id]) {
            seen[id] = 1;
            return id;
        }
        return mint(prefix, seen);
    }

    function ensureRowIds(rows, prefix, seen) {
        if (!Array.isArray(rows)) return;
        var i;
        var row;
        for (i = 0; i < rows.length; i++) {
            row = rows[i];
            if (!isPlain(row)) continue;
            row.id = claim(row.id, prefix, seen);
        }
    }

    function ensureIds(budget) {
        if (budget === null || budget === undefined) return budget;
        if (!isPlain(budget) || !own(budget, 'shootSchedule')) return budget;
        var days = budget.shootSchedule;
        if (!Array.isArray(days)) return budget;
        var seen = Object.create(null);
        var i;
        var day;
        for (i = 0; i < days.length; i++) {
            day = days[i];
            if (!isPlain(day)) continue;
            day.id = claim(day.id, 'day', seen);
        }
        for (i = 0; i < days.length; i++) {
            day = days[i];
            if (!isPlain(day)) continue;
            ensureRowIds(day.locations, 'loc', seen);
            ensureRowIds(day.legs, 'leg', seen);
            ensureRowIds(day.interviews, 'int', seen);
        }
        return budget;
    }

    function dayTitle(day, index, shootDayCount, productionDays) {
        if (!day || !Number.isInteger(index) || index < 0 || index >= shootDayCount) return '';
        var planned = typeof productionDays === 'number' || typeof productionDays === 'string' ? Number(productionDays) : 0;
        var total = Number.isFinite(planned) && planned > 0 ? planned
            : (Number.isInteger(shootDayCount) && shootDayCount >= 2 ? shootDayCount : 0);
        return total ? 'Day ' + (index + 1) + ' of ' + total : '';
    }

    function sortedLegs(day) {
        if (!day || typeof day !== 'object' || !Array.isArray(day.legs)) return hostList();
        var rows = day.legs;
        var decorated = [];
        var i;
        for (i = 0; i < rows.length; i++) {
            decorated.push({ leg: rows[i], i: i });
        }
        decorated.sort(function (a, b) {
            var ta = a.leg && typeof a.leg.time === 'string' ? a.leg.time : '';
            var tb = b.leg && typeof b.leg.time === 'string' ? b.leg.time : '';
            var aBlank = ta === '';
            var bBlank = tb === '';
            if (aBlank !== bBlank) return aBlank ? 1 : -1;
            if (!aBlank && ta !== tb) return ta < tb ? -1 : 1;
            return a.i - b.i;
        });
        var ordered = [];
        for (i = 0; i < decorated.length; i++) ordered.push(decorated[i].leg);
        return hostRefs(ordered);
    }

    function validate(budget) {
        var problems = [];
        var dupes = [];
        var seen = Object.create(null);
        var days = scheduleList(budget);
        var i;
        var j;
        var day;
        var locs;
        var legs;
        var interviews;
        var loc;
        var leg;
        var row;
        var locIds;
        var kind;
        var time;
        var locationId;
        var date;

        function track(id) {
            if (typeof id !== 'string' || id === '') return;
            if (seen[id]) dupes.push('duplicate id: ' + id);
            else seen[id] = 1;
        }

        for (i = 0; i < days.length; i++) {
            day = days[i];
            if (!isPlain(day)) continue;
            track(day.id);
            date = day.date;
            if (typeof date === 'string' && date !== '' && !validDate(date)) {
                problems.push('invalid date: ' + date);
            }
            locIds = Object.create(null);
            locs = Array.isArray(day.locations) ? day.locations : [];
            for (j = 0; j < locs.length; j++) {
                loc = locs[j];
                if (!isPlain(loc)) continue;
                if (typeof loc.id === 'string' && loc.id !== '') locIds[loc.id] = 1;
                track(loc.id);
            }
            legs = Array.isArray(day.legs) ? day.legs : [];
            for (j = 0; j < legs.length; j++) {
                leg = legs[j];
                if (!isPlain(leg)) continue;
                kind = typeof leg.kind === 'string' ? leg.kind : '';
                if (kind !== '' && KINDS.indexOf(kind) < 0) problems.push('unknown kind: ' + kind);
                time = typeof leg.time === 'string' ? leg.time : '';
                if (time !== '' && !validTime(time)) problems.push('invalid time: ' + time);
                locationId = typeof leg.locationId === 'string' ? leg.locationId : '';
                if (locationId !== '' && !locIds[locationId]) problems.push('unknown location: ' + locationId);
                track(leg.id);
            }
            interviews = Array.isArray(day.interviews) ? day.interviews : [];
            for (j = 0; j < interviews.length; j++) {
                row = interviews[j];
                if (!isPlain(row)) continue;
                locationId = typeof row.locationId === 'string' ? row.locationId : '';
                if (locationId !== '' && !locIds[locationId]) problems.push('unknown location: ' + locationId);
                track(row.id);
            }
        }
        for (i = 0; i < dupes.length; i++) problems.push(dupes[i]);
        return hostData({ ok: problems.length === 0, problems: problems });
    }

    function paidNorm(row) {
        var paidMethod = '';
        var paidRef = '';
        var method;
        if (row && typeof row === 'object') {
            if (typeof row.paidMethod === 'string') {
                method = row.paidMethod.trim().toLowerCase();
                if (PAID_OK[method]) paidMethod = method;
            }
            if (typeof row.paidRef === 'string') paidRef = row.paidRef.trim().slice(0, 80);
        }
        return hostData({ paidMethod: paidMethod, paidRef: paidRef });
    }

    function paidLabel(id) {
        if (id === 'cash') return 'Cash';
        if (id === 'transfer') return 'Bank transfer';
        if (id === 'wire') return 'Wire';
        if (id === 'wise') return 'Wise';
        if (id === 'cheque') return 'Cheque';
        if (id === 'paypal') return 'Paypal';
        if (id === 'payoneer') return 'Payoneer';
        if (typeof id === 'string' && PAID_OK[id] && LEGACY.indexOf(id) >= 0) {
            return id.charAt(0).toUpperCase() + id.slice(1);
        }
        return '';
    }

    window.mBTShootSchedule = {
        KINDS: hostData(KINDS),
        normalise: normalise,
        ensureIds: ensureIds,
        dayTitle: dayTitle,
        sortedLegs: sortedLegs,
        validate: validate
    };

    window.mBTPaidBy = {
        METHODS: hostData(METHODS),
        normalise: paidNorm,
        label: paidLabel
    };
}(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this)));
