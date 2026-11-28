'use strict';
/* Live hospital lookup helpers: Overpass mirrors, haversine rank, phone priority, share record. */
(function (root) {
  var OVERPASS_MIRRORS = Object.freeze([
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
  ]);
  var OVERPASS_TIMEOUT_MS = 12000;
  var OVERPASS_RADIUS_M = 30000;
  var AUTO_SOURCES = Object.freeze({ live: true, opengate: true, fallback: true });

  function toRad(deg) { return (Number(deg) || 0) * Math.PI / 180; }

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatHospitalDistance(km) {
    var n = Number(km);
    if (!isFinite(n) || n < 0) return '';
    return n.toFixed(1) + ' km straight line';
  }

  function normalizeHospitalName(name) {
    if (root.mBTHospitalFallback && typeof root.mBTHospitalFallback.normalizeHospitalName === 'function') {
      return root.mBTHospitalFallback.normalizeHospitalName(name);
    }
    var s = String(name || '');
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    s = s.replace(/\([^)]*\)/g, ' ');
    s = s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    s = s.replace(/\bhospital\b/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }

  function normalizePhone(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    return s.replace(/\s+/g, ' ');
  }

  function phoneFromTags(tags) {
    if (!tags || typeof tags !== 'object') return '';
    var keys = ['phone', 'contact:phone', 'contact:mobile'];
    for (var i = 0; i < keys.length; i++) {
      var v = normalizePhone(tags[keys[i]]);
      if (v) return v;
    }
    return '';
  }

  function addressFromTags(tags) {
    if (!tags || typeof tags !== 'object') return '';
    var parts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:city'] || tags['addr:town'] || tags['addr:suburb'],
      tags['addr:state'] || tags['addr:parish'],
      tags['addr:postcode']
    ].filter(Boolean);
    return parts.join(', ');
  }

  function elementLatLon(el) {
    if (!el) return null;
    if (el.lat != null && el.lon != null) {
      return { lat: parseFloat(el.lat), lon: parseFloat(el.lon) };
    }
    if (el.center && el.center.lat != null && el.center.lon != null) {
      return { lat: parseFloat(el.center.lat), lon: parseFloat(el.center.lon) };
    }
    return null;
  }

  function parseOverpassHospitals(payload, originLat, originLon) {
    var elements = (payload && payload.elements) || [];
    var out = [];
    elements.forEach(function (el) {
      var tags = el.tags || {};
      var name = String(tags.name || '').trim();
      if (!name) return;
      var ll = elementLatLon(el);
      if (!ll || !isFinite(ll.lat) || !isFinite(ll.lon)) return;
      var km = haversineKm(originLat, originLon, ll.lat, ll.lon);
      out.push({
        name: name,
        address: addressFromTags(tags),
        phone: phoneFromTags(tags),
        lat: ll.lat,
        lon: ll.lon,
        distanceKm: km,
        distance: formatHospitalDistance(km),
        source: 'live',
        id: el.id,
        type: el.type
      });
    });
    out.sort(function (a, b) { return a.distanceKm - b.distanceKm; });
    return out;
  }

  function overpassQuery(lat, lon) {
    return '[out:json][timeout:25];(node["amenity"="hospital"](around:' + OVERPASS_RADIUS_M + ',' +
      lat + ',' + lon + ');way["amenity"="hospital"](around:' + OVERPASS_RADIUS_M + ',' +
      lat + ',' + lon + '););out center;';
  }

  function fetchWithTimeout(fetchImpl, url, opts, ms) {
    var localCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var outer = opts && opts.signal;
    var onOuterAbort = null;
    if (localCtrl && outer) {
      if (outer.aborted) localCtrl.abort();
      else {
        onOuterAbort = function () { try { localCtrl.abort(); } catch (e) {} };
        outer.addEventListener('abort', onOuterAbort);
      }
    }
    var signal = (localCtrl && localCtrl.signal) || outer;
    var timer = null;
    function releaseFetchTimeout() {
      if (timer) clearTimeout(timer);
      if (outer && onOuterAbort) {
        try { outer.removeEventListener('abort', onOuterAbort); } catch (e) {}
      }
    }
    var p = fetchImpl(url, Object.assign({}, opts || {}, signal ? { signal: signal } : {}));
    if (!ms) return p.finally(releaseFetchTimeout);
    /* Body read shares the same AbortController. Real setTimeout abort works with fake and real timers. */
    var body = p.then(function (res) {
      if (!res || !res.ok) throw new Error('Overpass HTTP ' + (res && res.status));
      return res.json();
    });
    return Promise.race([
      body,
      new Promise(function (_, reject) {
        timer = setTimeout(function () {
          if (localCtrl) {
            try { localCtrl.abort(); } catch (e) {}
          }
          var err = new Error('timeout');
          err.name = 'TimeoutError';
          reject(err);
        }, ms);
      })
    ]).finally(releaseFetchTimeout);
  }

  function fetchOverpassHospitals(lat, lon, fetchImpl, outerSignal) {
    var fetchFn = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    if (!fetchFn) return Promise.reject(new Error('No fetch'));
    var query = overpassQuery(lat, lon);
    var mirrors = OVERPASS_MIRRORS.slice();
    var attempts = mirrors.concat([mirrors[0]]);

    function tryAt(idx) {
      if (outerSignal && outerSignal.aborted) {
        var ab = new Error('Aborted');
        ab.name = 'AbortError';
        return Promise.reject(ab);
      }
      if (idx >= attempts.length) {
        return Promise.reject(new Error('All Overpass mirrors failed'));
      }
      var url = attempts[idx] + '?data=' + encodeURIComponent(query);
      return fetchWithTimeout(fetchFn, url, {
        headers: { 'Accept': 'application/json' },
        signal: outerSignal
      }, OVERPASS_TIMEOUT_MS).then(function (json) {
        return parseOverpassHospitals(json, lat, lon);
      }).catch(function (err) {
        if (err && err.name === 'AbortError') throw err;
        if (err && err.name === 'TimeoutError') return tryAt(idx + 1);
        return tryAt(idx + 1);
      });
    }
    return tryAt(0);
  }

  function isHospitalRole(contact) {
    var role = String((contact && (contact.role || contact.department)) || '').trim().toLowerCase();
    return role === 'hospital';
  }

  function phoneFromOpenGateContacts(name, contacts) {
    var key = normalizeHospitalName(name);
    if (!key || !Array.isArray(contacts)) return null;
    for (var i = 0; i < contacts.length; i++) {
      var c = contacts[i];
      if (!c || !isHospitalRole(c)) continue;
      if (normalizeHospitalName(c.name) !== key) continue;
      var phone = normalizePhone(c.phone);
      if (!phone) continue;
      return {
        phone: phone,
        source: 'opengate',
        retrievedAt: c.retrievedAt || c.retrieved_at || ''
      };
    }
    return null;
  }

  function resolveHospitalPhone(opts) {
    opts = opts || {};
    var live = normalizePhone(opts.livePhone);
    if (live) {
      return Promise.resolve({ phone: live, source: 'live', retrievedAt: opts.retrievedAt || '' });
    }
    var name = opts.hospitalName || '';
    var chain = Promise.resolve(null);
    if (typeof opts.getSharedContacts === 'function') {
      chain = Promise.resolve(opts.getSharedContacts()).then(function (rows) {
        return phoneFromOpenGateContacts(name, rows);
      }).catch(function () { return null; });
    }
    return chain.then(function (og) {
      if (og && og.phone) return og;
      if (root.mBTHospitalFallback && typeof root.mBTHospitalFallback.phoneFromFallback === 'function') {
        var fb = root.mBTHospitalFallback.phoneFromFallback(name);
        if (fb && fb.phone) {
          return { phone: fb.phone, source: 'fallback', retrievedAt: fb.retrievedAt || '' };
        }
      }
      return { phone: '', source: '', retrievedAt: '' };
    });
  }

  function canAutoFillValue(currentValue, hospitalSource) {
    if (!String(currentValue || '').trim()) return true;
    return !!AUTO_SOURCES[String(hospitalSource || '')];
  }

  function facilityRecordForSharing(hospital) {
    var h = hospital || {};
    var source = String(h.source || h.hospitalSource || '');
    var phoneSource = String(h.phoneSource || source);
    var phone = '';
    if (phoneSource === 'live' || phoneSource === 'fallback' || phoneSource === 'evidenced') {
      phone = normalizePhone(h.phone || h.hospitalPhone);
    }
    var name = String(h.name || h.hospitalName || '').trim();
    var retrievedAt = h.retrievedAt || h.hospitalRetrievedAt || '';
    var id = normalizeHospitalName(name) || 'unknown';
    return {
      name: name,
      department: 'Hospital',
      role: 'Hospital',
      phone: phone,
      source: source,
      retrievedAt: retrievedAt,
      id: id
    };
  }

  /* V4: after trim, strip trailing periods and a trailing suffix of the listed kinds, then require the text ends with the word Jamaica. */
  function locationTextEndsWithJamaica(text) {
    var s = String(text || '').trim();
    if (!s) return false;
    s = s.replace(/\.+\s*$/, '').trim();
    s = s.replace(/(?:,\s*|\s+)(?:w\.?\s*i\.?|west\s+indies|jm)\s*$/i, '').trim();
    s = s.replace(/\.+\s*$/, '').trim();
    return /\bjamaica$/i.test(s);
  }

  function isJamaicaHint(text) {
    var r = String(text || '').trim().toLowerCase();
    if (!r) return false;
    /* Country and region: exact Z7 tokens only. Location text: V4 ends-with Jamaica after suffix strip. */
    if (r === 'jamaica' || r === 'jm' || r === 'jam') return true;
    return locationTextEndsWithJamaica(text);
  }

  function jamaicaEmergencyLine(region) {
    if (isJamaicaHint(region)) return 'Ambulance and Fire 110, Police 119';
    return 'Dial 911';
  }

  /* Live budget country, region or project location only. Empty means no Jamaica line. */
  function projectRegion(budget, og) {
    if (!budget) return '';
    if (budget.country != null && String(budget.country).trim()) return String(budget.country);
    if (budget.region != null && String(budget.region).trim()) return String(budget.region);
    if (budget.projectLocation != null && String(budget.projectLocation).trim()) return String(budget.projectLocation);
    return '';
  }

  function callSheetJamaicaHint(budget, rawD, options) {
    var opts = options || {};
    var b = budget || {};
    var hints = [
      opts.country, opts.region,
      opts.budget && opts.budget.country, opts.budget && opts.budget.region, opts.budget && opts.budget.projectLocation,
      b.country, b.region, b.projectLocation
    ];
    var i;
    for (i = 0; i < hints.length; i++) {
      if (String(hints[i] || '').trim()) return String(hints[i]);
    }
    return '';
  }

  var api = {
    OVERPASS_MIRRORS: OVERPASS_MIRRORS,
    OVERPASS_TIMEOUT_MS: OVERPASS_TIMEOUT_MS,
    OVERPASS_RADIUS_M: OVERPASS_RADIUS_M,
    haversineKm: haversineKm,
    formatHospitalDistance: formatHospitalDistance,
    normalizeHospitalName: normalizeHospitalName,
    normalizePhone: normalizePhone,
    phoneFromTags: phoneFromTags,
    addressFromTags: addressFromTags,
    elementLatLon: elementLatLon,
    parseOverpassHospitals: parseOverpassHospitals,
    overpassQuery: overpassQuery,
    fetchOverpassHospitals: fetchOverpassHospitals,
    phoneFromOpenGateContacts: phoneFromOpenGateContacts,
    resolveHospitalPhone: resolveHospitalPhone,
    canAutoFillValue: canAutoFillValue,
    facilityRecordForSharing: facilityRecordForSharing,
    isJamaicaHint: isJamaicaHint,
    jamaicaEmergencyLine: jamaicaEmergencyLine,
    projectRegion: projectRegion,
    callSheetJamaicaHint: callSheetJamaicaHint
  };
  root.mBTHospitalLookup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
