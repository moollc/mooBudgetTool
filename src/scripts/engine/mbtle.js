/**
 * © 2026 Jayson Moo-Young <jayson.m.y@gmail.com>
 * Part of the mBT (Moo Budget Tool) Ecosystem.
 * License: MIT
 */

/**
 * mBTLE — mBT Logic Engine (JavaScript Version)
 * Core math and currency utilities for offline budget calculations
 */

// === CORE CONSTANTS ===
var CURRENCY = {
  JMD: 'JMD',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  CAD: 'CAD',
  MXN: 'MXN',
};

var CURRENCY_LOCALES = {
  JMD: 'en-JM',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  CAD: 'en-CA',
  MXN: 'es-MX',
};

var CURRENCY_RATES = {
  JMD: { JMD: 1, USD: 0.0064, EUR: 0.0059, GBP: 0.0051, CAD: 0.0088, MXN: 0.11 },
  USD: { JMD: 156.0, USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.37, MXN: 17.5 },
  EUR: { JMD: 170.0, USD: 1.09, EUR: 1, GBP: 0.86, CAD: 1.49, MXN: 19.0 },
  GBP: { JMD: 198.0, USD: 1.27, EUR: 1.15, GBP: 1, CAD: 1.73, MXN: 22.1 },
  CAD: { JMD: 114.0, USD: 0.73, EUR: 0.67, GBP: 0.58, CAD: 1, MXN: 12.8 },
  MXN: { JMD: 8.9, USD: 0.057, EUR: 0.053, GBP: 0.045, CAD: 0.078, MXN: 1 },
};

var PRECISION = 4;

// === CURRENCY UTILITIES ===

var formatCurrency = function(value, currency) {
  var safeValue = parseFloat(value) || 0;
  currency = currency || CURRENCY.JMD;
  var locale = CURRENCY_LOCALES[currency] || 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue);
};

var formatValue = function(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: PRECISION,
  }).format(value);
};

var parseCurrency = function(str, currency) {
  var clean = str.replace(/[^0-9.\-]/g, '');
  return clean ? parseFloat(clean) : 0;
};

var round = function(value, precision) {
  precision = precision || PRECISION;
  var factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
};

var convertCurrency = function(value, from, to) {
  if (from === to) return value;
  var rates = CURRENCY_RATES[from];
  if (!rates || !(to in rates)) return value;
  return round(value * rates[to]);
};

// === TEMPORAL UTILITIES (Phase 90) ===

/**
 * Compute payable working days within a date range (Work-week aware)
 * @param {number} grossDays - Total calendar days
 * @param {string|Date} startDate - Reference start date
 * @param {number} workWeek - Days per week (5, 6, 7)
 * @param {string[]} blackouts - Array of YYYY-MM-DD strings
 * @returns {number} Net working days
 */
var computeWorkingDays = function(grossDays, startDate, workWeek, blackouts) {
  if (!workWeek || workWeek >= 7) return grossDays;
  var working = 0;
  var cursor = new Date(startDate);
  /* Handle Timezone offset for pure date objects */
  if (typeof startDate === 'string') {
    cursor = new Date(cursor.getTime() + cursor.getTimezoneOffset() * 60000);
  }
  
  for (var i = 0; i < grossDays; i++) {
    var dow = cursor.getDay();
    var dateStr = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0') + '-' + String(cursor.getDate()).padStart(2, '0');
    var isWeekend = (workWeek <= 5 && (dow === 0 || dow === 6)) || (workWeek === 6 && dow === 0);
    var isBlackout = blackouts && blackouts.indexOf(dateStr) > -1;
    if (!isWeekend && !isBlackout) working++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return working;
};

/**
 * Calculate stage start dates accounting for offsets and waterfall logic
 * @param {Object} b - The budget object
 * @returns {Object} { dev: Date, pre: Date, prod: Date, post: Date, dist: Date }
 */
var getStageStartDates = function(b) {
  var starts = {};
  if (!b || !b.startDate) return starts;
  var cursor = new Date(b.startDate);
  cursor = new Date(cursor.getTime() + cursor.getTimezoneOffset() * 60000);
  var prevStart = null;

  var KEYS = ['dev', 'pre', 'prod', 'post', 'dist'];
  KEYS.forEach(function(k) {
    var stageData = (b.targetLock && b.targetLock.stages && b.targetLock.stages[k]) || {};
    var days = parseFloat(stageData.days) || 0;
    var offset = stageData.offsetDays;
    
    if (typeof offset === 'number' && prevStart) {
      cursor = new Date(prevStart);
      cursor.setDate(cursor.getDate() + offset);
    }
    
    starts[k] = new Date(cursor);
    prevStart = new Date(cursor);
    /* Increment cursor by duration for simple waterfall fallback */
    cursor = new Date(cursor.getTime() + days * 86400000);
  });
  return starts;
};

// === MATH UTILITIES ===

var sum = function(values) {
  return values.reduce(function(acc, v) { return acc + v; }, 0);
};

var weightedAverage = function(values, weights) {
  var sumWeights = sum(weights);
  if (sumWeights === 0) return 0;
  return round(values.reduce(function(acc, v, i) { return acc + v * weights[i]; }, 0) / sumWeights);
};

var clamp = function(value, min, max) {
  return Math.min(Math.max(value, min), max);
};

var lerp = function(a, b, t) {
  return a + (b - a) * t;
};

// === STAGE RECONCILIATION ===

var reconcileStage = function(stage) {
  if (typeof window !== 'undefined' && window.wasm_reconcile_stage) {
    try {
      var result = window.wasm_reconcile_stage(JSON.stringify(stage));
      return JSON.parse(result);
    } catch(e) { console.warn("[WASM fallback]", e); }
  }

  var totalBudget = stage.budget || 0;
  var totalAllocated = sum(stage.allocated || []);
  var totalCompleted = sum(stage.completed || []);
  var totalCost = stage.totalCost || 0;

  var variance = totalBudget - totalCost;
  var percentUsed = totalBudget > 0 ? (totalCost / totalBudget) * 100 : 0;

  return {
    id: stage.id || '',
    name: stage.name || '',
    budget: round(totalBudget),
    allocated: round(totalAllocated),
    completed: round(totalCompleted),
    cost: round(totalCost),
    variance: round(variance),
    percentUsed: round(percentUsed, 1),
    status: getReconciliationStatus(variance, percentUsed),
  };
};

var getReconciliationStatus = function(variance, percentUsed) {
  if (variance > 0) return 'under';
  if (Math.abs(variance) < 10) return 'on';
  return 'over';
};

var aggregateReconciliations = function(stages) {
  if (typeof window !== 'undefined' && window.wasm_aggregate_reconciliations) {
    try {
      var result = window.wasm_aggregate_reconciliations(JSON.stringify(stages));
      return JSON.parse(result);
    } catch(e) { console.warn("[WASM fallback]", e); }
  }

  var totalBudget = sum(stages.map(function(s) { return s.budget; }));
  var totalCost = sum(stages.map(function(s) { return s.cost; }));
  var totalVariance = sum(stages.map(function(s) { return s.variance; }));

  return {
    stageCount: stages.length,
    totalBudget: round(totalBudget),
    totalCost: round(totalCost),
    totalVariance: round(totalVariance),
    overallStatus: getAggregateStatus(totalVariance),
  };
};

var getAggregateStatus = function(totalVariance) {
  if (totalVariance > 0) return 'healthy';
  if (totalVariance > -100) return 'warning';
  return 'critical';
};

// === DATA VALIDATION ===

var validateProject = function(data) {
  var errors = [];

  if (!data || typeof data !== 'object') {
    return [{ field: 'root', message: 'Data must be an object' }];
  }

  if (!data.name || typeof data.name !== 'string') {
    errors.push({ field: 'name', message: 'Project name is required', value: data.name });
  }

  if (!data.budget || typeof data.budget !== 'number' || data.budget < 0) {
    errors.push({ field: 'budget', message: 'Valid non-negative budget required', value: data.budget });
  }

  if (!data.stages || !Array.isArray(data.stages)) {
    errors.push({ field: 'stages', message: 'Stages must be an array', value: data.stages });
  } else {
    for (var i = 0; i < data.stages.length; i++) {
      var stage = data.stages[i];
      if (!stage.name || typeof stage.name !== 'string') {
        errors.push({ field: 'stages[' + i + '].name', message: 'Stage name is required', value: stage.name });
      }
      if (stage.budget && (typeof stage.budget !== 'number' || stage.budget < 0)) {
        errors.push({ field: 'stages[' + i + '].budget', message: 'Valid non-negative stage budget required', value: stage.budget });
      }
    }
  }

  return errors;
};

var validateStage = function(data) {
  var errors = [];

  if (!data || typeof data !== 'object') {
    return [{ field: 'root', message: 'Data must be an object' }];
  }

  if (!data.name || typeof data.name !== 'string') {
    errors.push({ field: 'name', message: 'Stage name is required', value: data.name });
  }

  if (!data.budget || typeof data.budget !== 'number' || data.budget < 0) {
    errors.push({ field: 'budget', message: 'Valid non-negative budget required', value: data.budget });
  }

  if (data.allocated && !Array.isArray(data.allocated)) {
    errors.push({ field: 'allocated', message: 'Allocated must be an array', value: data.allocated });
  }

  return errors;
};

// === PRODUCTION TYPE CONSTANTS ===

var PRODUCTION_TYPES = {
  indie:      { label: 'Indie',      crewScale: 0.6, equipScale: 0.5 },
  commercial: { label: 'Commercial', crewScale: 1.0, equipScale: 1.0 },
  feature:    { label: 'Feature',    crewScale: 1.5, equipScale: 1.8 },
};

/* Per-role stage presence: true = present in that stage */
var ROLE_STAGE_PRESENCE = {
  director:          { prePro: true,  principal: true,  post: false },
  producer:          { prePro: true,  principal: true,  post: true  },
  upm:               { prePro: true,  principal: true,  post: false },
  '1st_ad':          { prePro: true,  principal: true,  post: false },
  '2nd_ad':          { prePro: false, principal: true,  post: false },
  dop:               { prePro: false, principal: true,  post: false },
  camera_operator:   { prePro: false, principal: true,  post: false },
  gaffer:            { prePro: false, principal: true,  post: false },
  grip:              { prePro: false, principal: true,  post: false },
  sound_mixer:       { prePro: false, principal: true,  post: false },
  editor:            { prePro: false, principal: false, post: true  },
  colorist:          { prePro: false, principal: false, post: true  },
  vfx:               { prePro: false, principal: false, post: true  },
  default:           { prePro: false, principal: true,  post: false },
};

/**
 * Calculate days a crew role should work given production stage day counts.
 * @param {string} roleKey   - Key from ROLE_STAGE_PRESENCE (or 'default')
 * @param {Object} stageDays - { prePro: number, principal: number, post: number }
 * @returns {number} Total working days for that role
 */
var stageCrewDays = function(roleKey, stageDays) {
  var presence = ROLE_STAGE_PRESENCE[roleKey] || ROLE_STAGE_PRESENCE.default;
  var days = 0;
  if (presence.prePro)    days += parseFloat(stageDays.prePro)    || 0;
  if (presence.principal) days += parseFloat(stageDays.principal) || 0;
  if (presence.post)      days += parseFloat(stageDays.post)      || 0;
  return days;
};

// === EXPORTS ===
window.mBT = window.mBT || {};
window.mBT.le = {
  CURRENCY: CURRENCY,
  CURRENCY_LOCALES: CURRENCY_LOCALES,
  CURRENCY_RATES: CURRENCY_RATES,
  PRECISION: PRECISION,
  PRODUCTION_TYPES: PRODUCTION_TYPES,
  ROLE_STAGE_PRESENCE: ROLE_STAGE_PRESENCE,
  formatCurrency: formatCurrency,
  formatValue: formatValue,
  parseCurrency: parseCurrency,
  round: round,
  convertCurrency: convertCurrency,
  sum: sum,
  weightedAverage: weightedAverage,
  clamp: clamp,
  lerp: lerp,
  reconcileStage: reconcileStage,
  aggregateReconciliations: aggregateReconciliations,
  validateProject: validateProject,
  validateStage: validateStage,
  stageCrewDays: stageCrewDays,
  /* Phase 90: Temporal utilities exposed for monolith reconcile() */
  computeWorkingDays: computeWorkingDays,
  getStageStartDates: getStageStartDates,
};

