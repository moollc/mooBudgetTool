'use strict';
/* Evidenced hospital phones from research R4 and R5. Fallback only when live and Open Gate lack a phone. */
(function (root) {
  var LIST = Object.freeze(
[
  {
    "name": "Alexandria Community Hospital",
    "parish": "Saint Ann",
    "phones": [
      {
        "number": "876-975-1007",
        "label": "Tel"
      }
    ],
    "sourceUrl": "https://www.nerha.gov.jm/health-centres",
    "retrievedAt": "2026-11-27T22:13:01.406400+00:00"
  },
  {
    "name": "Annotto Bay Hospital",
    "parish": "Saint Mary",
    "phones": [
      {
        "number": "876-613-8300"
      },
      {
        "number": "876-996-2222"
      },
      {
        "number": "876-996-9883"
      }
    ],
    "sourceUrl": "https://www.nerha.gov.jm/directory",
    "retrievedAt": "2026-11-27T21:52:32.459056+00:00"
  },
  {
    "name": "Bellevue Hospital",
    "parish": "Kingston and Saint Andrew",
    "phones": [
      {
        "number": "876-928-1380",
        "label": "Telephone Number"
      }
    ],
    "sourceUrl": "http://web.archive.org/web/20231117122504/https://bellevuehospital.org.jm/",
    "retrievedAt": "2026-11-27T22:12:58.362691+00:00"
  },
  {
    "name": "Black River Hospital",
    "parish": "Saint Elizabeth",
    "phones": [
      {
        "number": "876-965-2224"
      }
    ],
    "sourceUrl": "https://www.srha.gov.jm/hospitals.php",
    "retrievedAt": "2026-11-27T21:52:30.208756+00:00"
  },
  {
    "name": "Bustamante Hospital for Children",
    "parish": "Kingston and Saint Andrew",
    "phones": [
      {
        "number": "876-926-5721"
      }
    ],
    "sourceUrl": "http://web.archive.org/web/20220627032340/https://www.serha.gov.jm/bustamante-hospital-for-children",
    "retrievedAt": "2026-11-27T22:12:32.556782+00:00"
  },
  {
    "name": "Chapelton Community Hospital",
    "parish": "Clarendon",
    "phones": [
      {
        "number": "876-676-6083"
      },
      {
        "number": "876-986-3226"
      }
    ],
    "sourceUrl": "https://www.srha.gov.jm/hospitals.php",
    "retrievedAt": "2026-11-27T21:52:30.208756+00:00"
  },
  {
    "name": "Cornwall Regional Hospital",
    "parish": "Saint James",
    "phones": [
      {
        "number": "876-952-5100"
      }
    ],
    "sourceUrl": "https://www.wrha.gov.jm/health-facilities/st-james/",
    "retrievedAt": "2026-11-27T21:52:26.289624+00:00"
  },
  {
    "name": "Falmouth Public General Hospital",
    "parish": "Trelawny",
    "phones": [
      {
        "number": "876-954-3255"
      }
    ],
    "sourceUrl": "https://www.wrha.gov.jm/health-facilities/trelawny/",
    "retrievedAt": "2026-11-27T21:52:26.944785+00:00"
  },
  {
    "name": "Kingston Public Hospital",
    "parish": "Kingston and Saint Andrew",
    "phones": [
      {
        "number": "876-922-0210"
      }
    ],
    "sourceUrl": "http://web.archive.org/web/20220627032444/https://www.serha.gov.jm/kingston-public-hospital",
    "retrievedAt": "2026-11-27T22:12:23.905104+00:00"
  },
  {
    "name": "Linstead Hospital",
    "parish": "Saint Catherine",
    "phones": [
      {
        "number": "876-985-2241"
      },
      {
        "number": "876-985-2359"
      }
    ],
    "sourceUrl": "http://web.archive.org/web/20220627032244/https://www.serha.gov.jm/linstead-public-hospital",
    "retrievedAt": "2026-11-27T22:12:38.971274+00:00"
  },
  {
    "name": "Lionel Town Hospital",
    "parish": "Clarendon",
    "phones": [
      {
        "number": "876-613-8453"
      }
    ],
    "sourceUrl": "https://www.srha.gov.jm/hospitals.php",
    "retrievedAt": "2026-11-27T21:52:30.208756+00:00"
  },
  {
    "name": "Mandeville Regional Hospital",
    "parish": "Manchester",
    "phones": [
      {
        "number": "876-962-2067"
      },
      {
        "number": "876-962-3370"
      },
      {
        "number": "876-962-2744"
      }
    ],
    "sourceUrl": "https://www.srha.gov.jm/contact.php",
    "retrievedAt": "2026-11-27T21:52:29.444469+00:00"
  },
  {
    "name": "May Pen Hospital",
    "parish": "Clarendon",
    "phones": [
      {
        "number": "876-986-2528"
      }
    ],
    "sourceUrl": "https://www.srha.gov.jm/hospitals.php",
    "retrievedAt": "2026-11-27T21:52:30.208756+00:00"
  },
  {
    "name": "National Chest Hospital",
    "parish": "Kingston and Saint Andrew",
    "phones": [
      {
        "number": "876-927-0000"
      },
      {
        "number": "876-970-0655"
      },
      {
        "number": "876-977-7656"
      },
      {
        "number": "876-970-1205"
      }
    ],
    "sourceUrl": "http://web.archive.org/web/20220627032537/https://www.serha.gov.jm/national-chest-hospital",
    "retrievedAt": "2026-11-27T22:12:44.432715+00:00"
  },
  {
    "name": "Noel Holmes Hospital",
    "parish": "Hanover",
    "phones": [
      {
        "number": "876-956-2733"
      }
    ],
    "sourceUrl": "https://www.wrha.gov.jm/health-facilities/hanover/",
    "retrievedAt": "2026-11-27T21:52:25.586282+00:00"
  },
  {
    "name": "Percy Junor Hospital",
    "parish": "Clarendon",
    "phones": [
      {
        "number": "876-964-2222"
      }
    ],
    "sourceUrl": "https://www.srha.gov.jm/hospitals.php",
    "retrievedAt": "2026-11-27T21:52:30.208756+00:00"
  },
  {
    "name": "Port Antonio Hospital",
    "parish": "Portland",
    "phones": [
      {
        "number": "876-613-8400"
      },
      {
        "number": "876-993-2646"
      }
    ],
    "sourceUrl": "https://www.nerha.gov.jm/directory",
    "retrievedAt": "2026-11-27T21:52:32.459056+00:00"
  },
  {
    "name": "Port Maria Hospital",
    "parish": "Saint Mary",
    "phones": [
      {
        "number": "876-994-9979"
      }
    ],
    "sourceUrl": "https://www.nerha.gov.jm/directory",
    "retrievedAt": "2026-11-27T21:52:32.459056+00:00"
  },
  {
    "name": "Princess Margaret Hospital",
    "parish": "Saint Thomas",
    "phones": [
      {
        "number": "876-982-2304"
      }
    ],
    "sourceUrl": "http://web.archive.org/web/20220627032138/https://www.serha.gov.jm/princess-margaret-hospital",
    "retrievedAt": "2026-11-27T22:12:41.267588+00:00"
  },
  {
    "name": "Savanna-la-Mar Public General Hospital",
    "parish": "Westmoreland",
    "phones": [
      {
        "number": "876-955-2533"
      }
    ],
    "sourceUrl": "https://www.wrha.gov.jm/health-facilities/westmoreland/",
    "retrievedAt": "2026-11-27T21:52:27.796495+00:00"
  },
  {
    "name": "Spanish Town Hospital",
    "parish": "Saint Catherine",
    "phones": [
      {
        "number": "876-984-3031",
        "label": "Tel"
      }
    ],
    "sourceUrl": "http://web.archive.org/web/20220627032751/https://www.serha.gov.jm/spanish-town-hospital",
    "retrievedAt": "2026-11-27T22:12:35.203086+00:00"
  },
  {
    "name": "St. Ann's Bay Regional Hospital",
    "parish": "Saint Ann",
    "phones": [
      {
        "number": "876-633-7945"
      },
      {
        "number": "876-972-0150"
      }
    ],
    "sourceUrl": "https://www.nerha.gov.jm/directory",
    "retrievedAt": "2026-11-27T21:52:32.459056+00:00"
  },
  {
    "name": "University Hospital of the West Indies",
    "parish": "Kingston and Saint Andrew",
    "phones": [
      {
        "number": "876-927-1620",
        "label": "Telephone"
      },
      {
        "number": "876-927-1630",
        "label": "Telephone"
      },
      {
        "number": "876-822-2486",
        "label": "Fixed Line"
      }
    ],
    "sourceUrl": "http://web.archive.org/web/20261017133207/http://uhwi.gov.jm/about/contact",
    "retrievedAt": "2026-11-27T22:12:53.876188+00:00"
  },
  {
    "name": "Victoria Jubilee Hospital",
    "parish": "Kingston and Saint Andrew",
    "phones": [
      {
        "number": "876-922-0210"
      }
    ],
    "sourceUrl": "http://web.archive.org/web/20220627032114/https://www.serha.gov.jm/victoria-jubilee-hospital",
    "retrievedAt": "2026-11-27T22:12:26.384252+00:00"
  }
]);
  function normalizeHospitalName(name) {
    var s = String(name || '');
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    /* Drop parenthesised abbreviations such as "(KPH)" before punctuation strip. */
    s = s.replace(/\([^)]*\)/g, ' ');
    s = s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    /* Only the word hospital is stripped. Keep regional, public, general, community. */
    s = s.replace(/\bhospital\b/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }
  function phoneFromFallback(name) {
    var key = normalizeHospitalName(name);
    if (!key) return null;
    for (var i = 0; i < LIST.length; i++) {
      var row = LIST[i];
      if (normalizeHospitalName(row.name) !== key) continue;
      var phones = row.phones || [];
      if (!phones.length || !phones[0].number) return null;
      return {
        phone: String(phones[0].number),
        phones: phones.map(function (p) { return { number: p.number, label: p.label || '' }; }),
        name: row.name,
        parish: row.parish || '',
        source: 'fallback',
        sourceUrl: row.sourceUrl || '',
        retrievedAt: row.retrievedAt || ''
      };
    }
    return null;
  }
  var api = Object.freeze({
    LIST: LIST,
    normalizeHospitalName: normalizeHospitalName,
    phoneFromFallback: phoneFromFallback
  });
  root.mBTHospitalFallback = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
