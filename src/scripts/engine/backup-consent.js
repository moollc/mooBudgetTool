'use strict';
/* Offline backup reminder, storage.persist request, Open Gate facility consent (no upload). */
(function (root) {
  var BANNER_TEXT = 'Your budget is stored only in this browser. Download a backup (.moo) to keep a safe copy on your computer.';
  var CONSENT_TEXT = 'Help grow Open Gate, our free community directory. When you look up public facilities, would you like to share their names and public phone numbers? We never share your budgets or project locations. Default is off, and you can change this anytime in Settings.';
  var DAY_MS = 7 * 86400000;
  var EDIT_THRESHOLD = 50;
  var POLICY_VERSION = 1;
  var KEY_EXPORT_TS = 'mbt_last_export_timestamp';
  var KEY_EXPORT_EDITS = 'mbt_last_export_edit_count';
  var KEY_SNOOZE = 'mbt_backup_snooze_until';
  var KEY_REMINDERS = 'mbt_show_backup_reminders';
  var KEY_PERSISTED = 'mbt_storage_persisted';
  var KEY_CONSENT = 'mbt_og_facility_consent';
  var KEY_CONSENT_ASKS = 'mbt_og_facility_consent_asks';
  var KEY_SESSION_BANNER = 'mbt_backup_banner_session';
  var KEY_SESSION_CONSENT = 'mbt_og_consent_session';
  var KEY_SHARE = 'moo_og_share';
  var KEY_SHARE_CONTACTS = 'moo_og_share_contacts';
  var BANNER_ID = 'mbt-backup-reminder-banner';

  function lsGet(store, key) {
    try {
      if (!store || typeof store.getItem !== 'function') return null;
      return store.getItem(key);
    } catch (e) { return null; }
  }

  function lsSet(store, key, value) {
    try {
      if (!store || typeof store.setItem !== 'function') return;
      store.setItem(key, value);
    } catch (e) { /* ignore */ }
  }

  function readMap(store, key) {
    var raw = lsGet(store, key);
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) { return {}; }
  }

  function writeMap(store, key, map) {
    lsSet(store, key, JSON.stringify(map || {}));
  }

  function projectGet(store, key, project) {
    var map = readMap(store, key);
    var v = map[project];
    return v === undefined ? null : v;
  }

  function projectSet(store, key, project, value) {
    var map = readMap(store, key);
    map[project] = value;
    writeMap(store, key, map);
  }

  function remindersEnabled(store) {
    return lsGet(store, KEY_REMINDERS) !== 'false';
  }

  function setRemindersEnabled(store, on) {
    lsSet(store, KEY_REMINDERS, on ? 'true' : 'false');
  }

  function isLoggedInFromSession(session) {
    return !!(session && session.token);
  }

  function shouldShowBackupBanner(opts) {
    opts = opts || {};
    var ls = opts.localStorage;
    var project = String(opts.project || '');
    if (!project) return false;
    if (opts.loggedIn) return false;
    if (!remindersEnabled(ls)) return false;
    if (opts.sessionShown) return false;
    if (lsGet(opts.sessionStorage, KEY_SESSION_BANNER) === '1') return false;
    var now = Number(opts.now) || 0;
    var snoozeUntil = Number(projectGet(ls, KEY_SNOOZE, project) || 0);
    if (snoozeUntil && now < snoozeUntil) return false;
    var editCount = Number(opts.editCount) || 0;
    var exportTs = projectGet(ls, KEY_EXPORT_TS, project);
    if (exportTs == null || exportTs === '') {
      return editCount >= EDIT_THRESHOLD;
    }
    var exportMs = Number(exportTs) || 0;
    if (!(now - exportMs > DAY_MS)) return false;
    var exportEdits = Number(projectGet(ls, KEY_EXPORT_EDITS, project) || 0);
    return editCount > exportEdits;
  }

  function markBannerShown(sessionStorage) {
    lsSet(sessionStorage, KEY_SESSION_BANNER, '1');
  }

  function onDownloadBackup(opts) {
    opts = opts || {};
    if (typeof opts.runExport === 'function') {
      try { opts.runExport(); } catch (e) { /* ignore */ }
    }
    noteExport(opts);
    return true;
  }

  function noteExport(opts) {
    opts = opts || {};
    var project = String(opts.project || '');
    if (!project) return;
    var now = Number(opts.now) || Date.now();
    var editCount = Number(opts.editCount) || 0;
    projectSet(opts.localStorage, KEY_EXPORT_TS, project, now);
    projectSet(opts.localStorage, KEY_EXPORT_EDITS, project, editCount);
  }

  function onLaterBackup(opts) {
    opts = opts || {};
    var project = String(opts.project || '');
    if (!project) return;
    var now = Number(opts.now) || Date.now();
    projectSet(opts.localStorage, KEY_SNOOZE, project, now + DAY_MS);
  }

  function requestStoragePersist(opts) {
    opts = opts || {};
    var ls = opts.localStorage;
    var storage = opts.storage;
    function write(v) { lsSet(ls, KEY_PERSISTED, v); }

    if (!storage || typeof storage.persist !== 'function') {
      write('unsupported');
      return Promise.resolve('unsupported');
    }

    var check = (typeof storage.persisted === 'function')
      ? Promise.resolve().then(function () { return storage.persisted(); })
      : Promise.resolve(false);

    return check.then(function (already) {
      if (already) {
        write('yes');
        return 'yes';
      }
      return Promise.resolve().then(function () { return storage.persist(); }).then(function (ok) {
        write(ok ? 'yes' : 'no');
        return ok ? 'yes' : 'no';
      });
    }).catch(function () {
      write('no');
      return 'no';
    });
  }

  function readConsent(store) {
    var raw = lsGet(store, KEY_CONSENT);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function askCount(store) {
    var n = parseInt(lsGet(store, KEY_CONSENT_ASKS) || '0', 10);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function shouldOfferFacilityConsent(opts) {
    opts = opts || {};
    var existing = readConsent(opts.localStorage);
    if (existing && typeof existing.consent_given === 'boolean') return false;
    if (askCount(opts.localStorage) >= 2) return false;
    if (lsGet(opts.sessionStorage, KEY_SESSION_CONSENT) === '1') return false;
    return true;
  }

  function randomConsentId() {
    try {
      if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    } catch (e) { /* ignore */ }
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function toUtc(now) {
    if (now instanceof Date) return now.toISOString();
    var d = new Date(Number(now) || Date.now());
    return d.toISOString();
  }

  function sharingAllowed(store) {
    return lsGet(store, KEY_SHARE) === 'true';
  }

  function writeShareContacts(store, on) {
    lsSet(store, KEY_SHARE_CONTACTS, on ? 'true' : 'false');
  }

  function recordFacilityConsent(opts) {
    opts = opts || {};
    var given = !!opts.consentGiven;
    var rec = {
      consent_given: given,
      timestamp_utc: toUtc(opts.now),
      policy_version: POLICY_VERSION,
      consent_id: String(opts.consentId || randomConsentId())
    };
    lsSet(opts.localStorage, KEY_CONSENT, JSON.stringify(rec));
    lsSet(opts.sessionStorage, KEY_SESSION_CONSENT, '1');
    if (given && sharingAllowed(opts.localStorage)) {
      writeShareContacts(opts.localStorage, true);
    }
    return rec;
  }

  function softDismissFacilityConsent(opts) {
    opts = opts || {};
    var n = askCount(opts.localStorage) + 1;
    lsSet(opts.localStorage, KEY_CONSENT_ASKS, String(n));
    lsSet(opts.sessionStorage, KEY_SESSION_CONSENT, '1');
    if (n >= 2) {
      return recordFacilityConsent({
        localStorage: opts.localStorage,
        sessionStorage: opts.sessionStorage,
        consentGiven: false,
        now: opts.now,
        consentId: opts.consentId || randomConsentId()
      });
    }
    return null;
  }

  function contributeFacilityEnabled(store) {
    var rec = readConsent(store);
    if (rec && typeof rec.consent_given === 'boolean') return !!rec.consent_given;
    return lsGet(store, KEY_SHARE_CONTACTS) === 'true';
  }

  function setContributeFacilityInfo(opts) {
    opts = opts || {};
    var enabled = !!opts.enabled;
    var rec = recordFacilityConsent({
      localStorage: opts.localStorage,
      sessionStorage: opts.sessionStorage,
      consentGiven: enabled,
      now: opts.now,
      consentId: opts.consentId || randomConsentId()
    });
    writeShareContacts(opts.localStorage, enabled);
    return rec;
  }

  function plainSafe(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function facilityConsentPromptHtml() {
    return '' +
      '<div class="p-6 flex flex-col gap-4">' +
      '<div tabindex="0" autofocus id="mbt-og-consent-focus" style="outline:none;width:0;height:0;overflow:hidden"></div>' +
      '<p class="text-xs text-slate-600 font-bold leading-relaxed">' + plainSafe(CONSENT_TEXT) + '</p>' +
      '<div class="flex gap-3 w-full">' +
      '<button type="button" id="mbt-og-consent-no" class="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">No thanks</button>' +
      '<button type="button" id="mbt-og-consent-yes" class="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all">Share public info</button>' +
      '</div></div>';
  }

  function backupBannerHtml() {
    return '' +
      '<div id="' + BANNER_ID + '" class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9000] max-w-xl w-[min(92vw,36rem)] bg-white border border-slate-200 shadow-lg rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">' +
      '<p class="text-[11px] leading-4 font-bold text-slate-700 flex-1">' + plainSafe(BANNER_TEXT) + '</p>' +
      '<div class="flex gap-2 shrink-0">' +
      '<button type="button" id="mbt-backup-download" class="h-8 px-3 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500">Download backup</button>' +
      '<button type="button" id="mbt-backup-later" class="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">Later</button>' +
      '</div></div>';
  }

  function hideBackupBanner(doc) {
    doc = doc || (root.document || null);
    if (!doc) return;
    var el = doc.getElementById(BANNER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function showBackupBanner(opts) {
    opts = opts || {};
    var doc = opts.document || root.document;
    if (!doc || !doc.body) return null;
    hideBackupBanner(doc);
    doc.body.insertAdjacentHTML('beforeend', backupBannerHtml());
    var rootEl = doc.getElementById(BANNER_ID);
    var dl = doc.getElementById('mbt-backup-download');
    var later = doc.getElementById('mbt-backup-later');
    if (dl) dl.addEventListener('click', function () {
      if (typeof opts.onDownload === 'function') opts.onDownload();
      hideBackupBanner(doc);
    });
    if (later) later.addEventListener('click', function () {
      if (typeof opts.onLater === 'function') opts.onLater();
      hideBackupBanner(doc);
    });
    markBannerShown(opts.sessionStorage || root.sessionStorage);
    return rootEl;
  }

  function offerFacilityConsent(opts) {
    opts = opts || {};
    var ls = opts.localStorage || root.localStorage;
    var sess = opts.sessionStorage || root.sessionStorage;
    if (!shouldOfferFacilityConsent({ localStorage: ls, sessionStorage: sess })) return false;
    var modalApi = opts.modal || root.mBTME || (root.parent && root.parent.mBTME);
    if (!modalApi || typeof modalApi.open !== 'function') return false;

    var decided = false;
    var modalId = 'og-facility-consentModal';
    function finishClose() {
      if (typeof modalApi.close === 'function') modalApi.close(modalId);
    }
    function onNo() {
      if (decided) return;
      decided = true;
      recordFacilityConsent({
        localStorage: ls,
        sessionStorage: sess,
        consentGiven: false,
        now: opts.now || new Date(),
        consentId: opts.consentId
      });
      finishClose();
    }
    function onYes() {
      if (decided) return;
      decided = true;
      recordFacilityConsent({
        localStorage: ls,
        sessionStorage: sess,
        consentGiven: true,
        now: opts.now || new Date(),
        consentId: opts.consentId
      });
      finishClose();
    }
    function onSoft() {
      if (decided) return;
      decided = true;
      softDismissFacilityConsent({
        localStorage: ls,
        sessionStorage: sess,
        now: opts.now || new Date(),
        consentId: opts.consentId
      });
    }

    modalApi.open('og-facility-consent', 'Open Gate', facilityConsentPromptHtml(), 'max-w-sm', { hideHeader: false });
    var doc = opts.document || root.document;
    var noBtn = doc && doc.getElementById('mbt-og-consent-no');
    var yesBtn = doc && doc.getElementById('mbt-og-consent-yes');
    if (noBtn) noBtn.addEventListener('click', onNo);
    if (yesBtn) yesBtn.addEventListener('click', onYes);

    var container = doc && doc.getElementById((modalApi.containerId || 'global-modal-container'));
    if (container && typeof root.MutationObserver === 'function') {
      var obs = new root.MutationObserver(function () {
        if (!doc.getElementById(modalId)) {
          onSoft();
          obs.disconnect();
        }
      });
      obs.observe(container, { childList: true });
    }
    return true;
  }

  var api = {
    BANNER_TEXT: BANNER_TEXT,
    CONSENT_TEXT: CONSENT_TEXT,
    DAY_MS: DAY_MS,
    EDIT_THRESHOLD: EDIT_THRESHOLD,
    POLICY_VERSION: POLICY_VERSION,
    KEY_EXPORT_TS: KEY_EXPORT_TS,
    KEY_EXPORT_EDITS: KEY_EXPORT_EDITS,
    KEY_SNOOZE: KEY_SNOOZE,
    KEY_REMINDERS: KEY_REMINDERS,
    KEY_PERSISTED: KEY_PERSISTED,
    KEY_CONSENT: KEY_CONSENT,
    remindersEnabled: remindersEnabled,
    setRemindersEnabled: setRemindersEnabled,
    isLoggedInFromSession: isLoggedInFromSession,
    shouldShowBackupBanner: shouldShowBackupBanner,
    markBannerShown: markBannerShown,
    onDownloadBackup: onDownloadBackup,
    onLaterBackup: onLaterBackup,
    noteExport: noteExport,
    requestStoragePersist: requestStoragePersist,
    shouldOfferFacilityConsent: shouldOfferFacilityConsent,
    recordFacilityConsent: recordFacilityConsent,
    softDismissFacilityConsent: softDismissFacilityConsent,
    contributeFacilityEnabled: contributeFacilityEnabled,
    setContributeFacilityInfo: setContributeFacilityInfo,
    facilityConsentPromptHtml: facilityConsentPromptHtml,
    backupBannerHtml: backupBannerHtml,
    showBackupBanner: showBackupBanner,
    hideBackupBanner: hideBackupBanner,
    offerFacilityConsent: offerFacilityConsent,
    projectGet: projectGet,
    projectSet: projectSet
  };

  root.mBTBackupConsent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
