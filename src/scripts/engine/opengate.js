/**
 * © 2026 Jayson Moo-Young <jayson.m.y@gmail.com>
 * Part of the mBT (Moo Budget Tool) Ecosystem.
 * License: MIT
 */

/**
 * mBTOG : Open Gate Engine
 *
 * The name comes from several places.
 *
 * In film, "opening the gate" is a camera check, physically
 * openning the film gate after a take to inspect the aperture for anything 
 * that ould ruin the image. Today the term "shooting open gate" means
 * exposing the full sensor area without cropping.
 * Both are moments of acquiring visual truth.
 *
 * The third, I propose is akin to literally openning a gate:
 * removing the gatekeeping.
 * Industry rate information, production processes, document standards;
 * this knowledge has always been held by the few
 * (understandably, people worked and suffered years to accumulate it),
 * especially in smaller markets like the Caribbean, where there is
 * no union rate card, no published guild scale,
 * and no authoritative source a new producer can point to and say
 * "this is what things cost here."
 *
 * Open Gate is the answer to that. A living, community-calibrated reference
 * that gives any producer in Jamaica, Trinidad, Barbados, or anywhere else
 * the same baseline knowledge that used to require years of industry access
 * to accumulate.
 *
 * The gate is open. Go through it. Take a look.
 *
 * -------------------------------------------------------------------------
 * Shared engine loaded by both the Budget Editor (mBT/index.html) and the
 * App Shell (src/core/index.html). Depends only on window.localforage.
 * Sets window.mBTOG.
 * -------------------------------------------------------------------------
 */

(function () {
    'use strict';
    console.log('[mBTOG] Starting Engine Initialization...');

    try {

    /* ========= REGIONAL RATE REGISTRY ========= */
    /* Multipliers are now strictly Role-Specific within the _MASTER_CREW_INDEX. */
    var RATE_REGIONS = [
        'USA', 'Jamaica', 'Trinidad', 'Barbados', 'Guyana', 'UK', 'Canada', 'Australia',
        /* Phase 197 — Regional Expansion */
        'India', 'Thailand', 'Philippines', 'Vietnam', 'Poland', 'Mexico', 'Brazil', 'Colombia', 'South Africa'
    ];

    /* ========= CLOUD CONFIG ========= */
    /*
     * Publishable key : safe to embed in client code.
     * Supabase RLS ensures public can only READ og_community_rates.
     * All other tables require authentication.
     * The secret key is never embedded here.
     */
    var OG_CLOUD_URL = 'https://gdrgxlicnvtrbenfxypt.supabase.co';
    var OG_CLOUD_KEY = 'sb_publishable_1e5RuNmbdBzqC_n_-dFYHw_gBJzA73k';
    var OG_TABLE     = 'og_community_rates';
    var OG_SYNC_KEY  = 'moo_og_last_sync';

    /* ========= CURRENCY MAP (Phase 197) ========= */
    /* Single source of truth for region->currency lookups. Used by _expandMasterIndex and calculateRate. */
    var OG_CURRENCIES = {
        'USA': 'USD', 'UK': 'GBP', 'Canada': 'CAD', 'Australia': 'AUD',
        'Jamaica': 'JMD', 'Trinidad': 'USD', 'Barbados': 'USD', 'Guyana': 'USD',
        /* Phase 197 — Regional Expansion */
        'India': 'INR', 'Thailand': 'THB', 'Philippines': 'PHP', 'Vietnam': 'VND',
        'Poland': 'PLN', 'Mexico': 'MXN', 'Brazil': 'BRL', 'Colombia': 'COP', 'South Africa': 'ZAR'
    };

    /* ========= STORAGE HELPERS ========= */
    /* Use localforage directly, works in both Budget Editor and App Shell. */

    function _lfGet(key) {
        return window.localforage.getItem(key).catch(function () { return null; });
    }

    function _lfSet(key, val) {
        return window.localforage.setItem(key, val).catch(function () {});
    }

    /* Legacy migration bridge: if localforage has nothing, check localStorage. */
    function _loadWithMigration(key) {
        return _lfGet(key).then(function (data) {
            if (data) return data;
            var raw = localStorage.getItem(key);
            if (raw) {
                try {
                    var parsed = JSON.parse(raw);
                    _lfSet(key, parsed);
                    return parsed;
                } catch (e) {}
            }
            return null;
        });
    }

    /* ========= OPEN GATE ENGINE ========= */
    /* ========= MASTER CREW INDEX (Unified Role Database) ========= */
    /* Each role is defined once. Regional rates are derived via multipliers. 
       Formula: Local Rate = baseRate * multipliers[region].
       Jamaica multipliers are derived from 2025 Market Truth (Hardcoded JMD / 155 / USA USD). */

    var _MASTER_CREW_INDEX = [
        { "description": "Director", "unit": "Day", "baseRate": 1200, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.77, "Australia": 0.68, "India": 0.40, "Thailand": 0.60, "Philippines": 0.66, "Vietnam": 0.74, "Poland": 0.92, "Mexico": 0.54, "Brazil": 0.60, "Colombia": 0.40, "South Africa": 0.58 } },
        { "description": "Colorist", "unit": "Day", "baseRate": 900, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 1.2, "Canada": 1.1, "Australia": 0.68, "India": 0.38, "Thailand": 0.24, "Philippines": 0.19, "Vietnam": 0.30, "Poland": 0.61, "Mexico": 0.42, "Brazil": 0.46, "Colombia": 0.31, "South Africa": 0.51 }, "intelligence": "Senior Freelance rate. Post-facility suites typically billed separately in Post-Production Extras." },
        { "description": "Producer", "unit": "Day", "baseRate": 950, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.60, "Philippines": 0.63, "Vietnam": 0.71, "Poland": 0.89, "Mexico": 0.53, "Brazil": 0.63, "Colombia": 0.42, "South Africa": 0.58 } },
        { "description": "Executive Producer", "unit": "Day", "baseRate": 3000, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Line Producer", "unit": "Day", "baseRate": 867, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Screenwriter", "unit": "Flat", "baseRate": 4000, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "Bespoke creative role. Rates vary significantly by experience and credits." },
        { "description": "Director of Photography (DP)", "unit": "Day", "baseRate": 950, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 1.2, "Canada": 0.78, "Australia": 0.68, "India": 0.40, "Thailand": 0.45, "Philippines": 0.65, "Vietnam": 0.62, "Poland": 0.94, "Mexico": 0.55, "Brazil": 0.63, "Colombia": 0.42, "South Africa": 0.65 } },
        { "description": "Camera Operator", "unit": "Day", "baseRate": 550, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "1st Assistant Camera (Focus)", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.82, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "2nd Assistant Camera", "unit": "Day", "baseRate": 350, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.77, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Digital Imaging Tech (DIT)", "unit": "Day", "baseRate": 590, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.95, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Steadicam Operator", "unit": "Day", "baseRate": 600, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 1.1, "Canada": 0.9, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "Typically fly-in crew or bespoke negotiation. USA anchor applied for regional gaps." },
        { "description": "Drone Operator", "unit": "Day", "baseRate": 500, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Camera Utility", "unit": "Day", "baseRate": 300, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Unit Production Manager (UPM)", "unit": "Day", "baseRate": 911, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "1st Assistant Director (1st AD)", "unit": "Day", "baseRate": 867, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "2nd Assistant Director", "unit": "Day", "baseRate": 557, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "2nd 2nd AD", "unit": "Day", "baseRate": 400, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.7, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Key PA", "unit": "Day", "baseRate": 300, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.65, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Set PA", "unit": "Day", "baseRate": 250, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.65, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Office PA", "unit": "Day", "baseRate": 250, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.65, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Truck PA", "unit": "Day", "baseRate": 250, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.65, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Gaffer", "unit": "Day", "baseRate": 600, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.78, "Australia": 0.68, "India": 0.35, "Thailand": 0.33, "Philippines": 0.29, "Vietnam": 0.29, "Poland": 0.68, "Mexico": 0.46, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Best Boy Electric", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Electrician", "unit": "Day", "baseRate": 350, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.75, "Canada": 0.77, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Key Grip", "unit": "Day", "baseRate": 600, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.78, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Best Boy Grip", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Dolly Grip", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.78, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Grip", "unit": "Day", "baseRate": 350, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.75, "Canada": 0.77, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Generator Operator", "unit": "Day", "baseRate": 350, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Sound Mixer", "unit": "Day", "baseRate": 950, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 0.35, "Thailand": 0.38, "Philippines": 0.16, "Vietnam": 0.31, "Poland": 0.58, "Mexico": 0.34, "Brazil": 0.38, "Colombia": 0.26, "South Africa": 0.41 } },
        { "description": "Boom Operator", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Sound Utility", "unit": "Day", "baseRate": 300, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Production Designer", "unit": "Day", "baseRate": 750, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Art Director", "unit": "Day", "baseRate": 544, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.77, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Set Decorator", "unit": "Day", "baseRate": 550, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Set Dresser", "unit": "Day", "baseRate": 350, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Props Master", "unit": "Day", "baseRate": 550, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.77, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Assistant Props", "unit": "Day", "baseRate": 350, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Costume Designer", "unit": "Day", "baseRate": 750, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Wardrobe Stylist", "unit": "Day", "baseRate": 550, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Wardrobe Assistant", "unit": "Day", "baseRate": 300, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Makeup Artist (Key)", "unit": "Day", "baseRate": 550, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.77, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Hair Stylist (Key)", "unit": "Day", "baseRate": 550, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.77, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Makeup/Hair Assistant", "unit": "Day", "baseRate": 300, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Editor", "unit": "Day", "baseRate": 850, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.78, "Australia": 0.68, "India": 0.40, "Thailand": 0.39, "Philippines": 0.29, "Vietnam": 0.48, "Poland": 0.78, "Mexico": 0.47, "Brazil": 0.53, "Colombia": 0.35, "South Africa": 0.54 } },
        { "description": "Assistant Editor (AE)", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.75, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Post-Production Supervisor", "unit": "Day", "baseRate": 650, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "VFX Artist", "unit": "Day", "baseRate": 750, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "VFX Supervisor", "unit": "Day", "baseRate": 1100, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.9, "Australia": 0.68, "India": 0.40, "Thailand": 0.39, "Philippines": 0.28, "Vietnam": 0.50, "Poland": 0.69, "Mexico": 0.45, "Brazil": 0.52, "Colombia": 0.36, "South Africa": 0.49 } },
        { "description": "Sound Designer", "unit": "Flat", "baseRate": 900, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Composer", "unit": "Flat", "baseRate": 3000, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "Creative bespoke role. Rates usually include home-studio overhead." },
        { "description": "Music Supervisor", "unit": "Flat", "baseRate": 300, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Cast - Lead", "unit": "Day", "baseRate": 1500, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Cast - Supporting", "unit": "Day", "baseRate": 1000, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Location Manager", "unit": "Day", "baseRate": 650, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Location Scout", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Catering (Per Head)", "unit": "Flat", "baseRate": 45, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 1.1, "Canada": 0.9, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Craft Service", "unit": "Day", "baseRate": 300, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Script Supervisor", "unit": "Day", "baseRate": 550, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Production Accountant", "unit": "Day", "baseRate": 650, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Stunt Coordinator", "unit": "Day", "baseRate": 1100, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 1.1, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Publicist", "unit": "Day", "baseRate": 600, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Colorist", "unit": "Hour", "baseRate": 800, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 1.2, "Australia": 0.68, "India": 0.38, "Thailand": 0.24, "Philippines": 0.19, "Vietnam": 0.30, "Poland": 0.61, "Mexico": 0.42, "Brazil": 0.46, "Colombia": 0.31, "South Africa": 0.51 } },
        { "description": "Copywriter (Pitch/Treatment)", "unit": "Flat", "baseRate": 750, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Casting Director", "unit": "Day", "baseRate": 650, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Storyboard Artist", "unit": "Day", "baseRate": 600, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.77, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Script Consultant / Doctor", "unit": "Flat", "baseRate": 1500, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.9, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "Consultancy role. Usually remote/fly-in from major hubs." },
        { "description": "Pitch Deck Designer", "unit": "Flat", "baseRate": 800, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.9, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Researcher", "unit": "Day", "baseRate": 250, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Concept Artist", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Legal - Rights & Clearances", "unit": "Flat", "baseRate": 2500, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.9, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Security Guard", "unit": "Day", "baseRate": 150, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.7, "Canada": 0.7, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Medic / Set Nurse", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        /* --- Expanded Roles (Phase 185 Expansion) --- */
        { "description": "Still Photographer", "unit": "Day", "baseRate": 750, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Construction Coordinator", "unit": "Day", "baseRate": 850, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Sculptor", "unit": "Day", "baseRate": 700, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Draftsperson", "unit": "Day", "baseRate": 600, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Assistant Art Director", "unit": "Day", "baseRate": 650, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Graphics Artist", "unit": "Day", "baseRate": 550, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Music Editor", "unit": "Day", "baseRate": 650, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Sound Editor", "unit": "Day", "baseRate": 750, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Location Assistant", "unit": "Day", "baseRate": 350, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Lead Labourer", "unit": "Day", "baseRate": 400, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.7, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } }
    ];

    /* ========= EQUIPMENT RENTAL INDEX (Phase 202, block OG-Equipment-v1) =========
       Same shape as crew roles minus 'intelligence' text; itemType/category are
       stamped by _expandIndex, not stored here (keeps master rows uniform).
       Multipliers = round(regional equipment midpoint USD / USA baseRate, 2) from
       research/rates/{SOUTHEAST_ASIA,INDIA_PRODUCTION,SOUTH_AFRICA,
       MEXICO_LATIN_AMERICA,EASTERN_EUROPE}_RATES.md. Where a region's table gives
       one combined camera-kit row (no RED/ARRI vs Sony split -- Brazil, Colombia,
       Poland), that single ratio is used for both camera SKUs.
       No Jamaica/Caribbean/UK/Canada/Australia equipment tables exist -- those
       anchor to the related crew role's regional multiplier per brief (Camera
       Kit->Camera Operator, Light Kit->Gaffer, Sound Kit->Sound Mixer,
       Grip/Drone->Key Grip), Jamaica fixed at 0.28 for all equipment. Same rule
       covers Drone Package where a region's table has no drone row (Philippines,
       Mexico, Brazil, Colombia, Poland). */
    var _MASTER_EQUIPMENT_INDEX = [
        { "description": "Camera Kit (4K Cinema Package)", "unit": "Day", "baseRate": 850, "category": "camera", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 1.06, "Thailand": 1.00, "Philippines": 0.71, "Vietnam": 1.18, "Poland": 0.94, "Mexico": 1.06, "Brazil": 1.35, "Colombia": 0.88, "South Africa": 1.26 } },
        { "description": "Camera Kit (Sony FX6/FX9)", "unit": "Day", "baseRate": 475, "category": "camera", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 1.11, "Thailand": 0.90, "Philippines": 0.71, "Vietnam": 0.84, "Poland": 0.94, "Mexico": 0.95, "Brazil": 1.35, "Colombia": 0.88, "South Africa": 1.29 } },
        { "description": "Light Kit (3-Light)", "unit": "Day", "baseRate": 350, "category": "lighting", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.78, "Australia": 0.68, "India": 0.86, "Thailand": 0.86, "Philippines": 0.71, "Vietnam": 0.86, "Poland": 0.86, "Mexico": 1.29, "Brazil": 1.50, "Colombia": 0.86, "South Africa": 1.08 } },
        { "description": "Sound Kit (Mixer + Wireless)", "unit": "Day", "baseRate": 225, "category": "sound", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 1.00, "Thailand": 0.94, "Philippines": 0.67, "Vietnam": 0.78, "Poland": 1.00, "Mexico": 1.33, "Brazil": 1.33, "Colombia": 0.78, "South Africa": 1.02 } },
        { "description": "Grip Kit (Dolly + Stands)", "unit": "Day", "baseRate": 325, "category": "arsenal", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.78, "Australia": 0.68, "India": 1.15, "Thailand": 0.92, "Philippines": 0.69, "Vietnam": 0.69, "Poland": 0.92, "Mexico": 1.15, "Brazil": 1.38, "Colombia": 0.69, "South Africa": 0.99 } },
        { "description": "Drone Package", "unit": "Day", "baseRate": 300, "category": "camera", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.68, "Australia": 0.68, "India": 1.17, "Thailand": 1.00, "Philippines": 0.39, "Vietnam": 1.00, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.81 } }
    ];

    /* ========= MARKET TRUTH INTELLIGENCE (Citations) ========= */
    var REGION_INTELLIGENCE = {
        'Jamaica':      'INTELLIGENCE: RATES BASED ON AGGREGATED HISTORICAL INVOICING (2025). NO FORMAL UNION SCALES EXIST. NEGOTIATIONS BESPOKE PER PROJECT.',
        'USA':          'INTELLIGENCE: ESTIMATES REFLECT IATSE / DGA LOW-TIER AVERAGES (2025). EXCLUDES FRINGES, OVERTIME, AND MEAL PENALTIES.',
        'UK':           'INTELLIGENCE: ESTIMATES TARGET BECTU 2025 RECOMMENDED RATES. SUBJECT TO PACT/BECTU TERMS & CONDITIONS.',
        'Australia':    'INTELLIGENCE: RATES ALIGN WITH FWC MA000091 MODERN AWARD (2025). FINAL TOTALS REQUIRE SUPERANNUATION ADJUSTMENT.',
        'Canada':       'INTELLIGENCE: ESTIMATES REFLECT BCCFU TIER 1 & IATSE 873 (2025). LOCAL PROVINCIAL TAX INCENTIVES NOT APPLIED.',
        /* Phase 197 — Regional Expansion */
        'India':        'INTELLIGENCE: RATES DERIVED FROM MUMBAI/BOLLYWOOD INDUSTRY DATA (2025). NO FORMAL NATIONAL UNION SCALES. STATE INCENTIVES VARY (0-25%). FFO PROVIDES SINGLE-WINDOW CLEARANCE FOR FOREIGN PRODUCTIONS.',
        'Thailand':     'INTELLIGENCE: RATES FROM THAILAND FILM OFFICE & CPA INDUSTRY STANDARDS (2025). 20-30% CASH REBATE AVAILABLE WITH MINIMUM SPEND THB 50M (~$1.43M USD). MUST USE THAI CREW/SERVICES FOR QUALIFYING SPEND.',
        'Philippines':  'INTELLIGENCE: RATES FROM MANILA PRODUCTION SURVEYS (2025). GAFFER SCALAR (0.29) & SOUND MIXER (0.16) ACCURATELY REFLECT EXTREMELY COMPETITIVE DOMESTIC FREELANCE MARKET. KIT FEES ARE ADDITIONAL.',
        'Vietnam':      'INTELLIGENCE: RATES FROM HO CHI MINH CITY & HANOI FREELANCE/AGENCY DATA (2025). NO FORMAL CASH REBATE. IMPORT DUTY EXEMPTIONS ON EQUIPMENT. CONTENT REVIEW REQUIRED FOR FOREIGN PRODUCTIONS.',
        'Poland':       'INTELLIGENCE: RATES FROM WARSAW FILM INDUSTRY DATA (2025). 30% PFI CASH REBATE WITH LOW MINIMUM SPEND (100K PLN / ~$26K USD). CULTURAL TEST REQUIRED.',
        'Mexico':       'INTELLIGENCE: RATES FROM MEXICO CITY PRODUCTION DATA (2025). 7.5% FIDECINE TAX INCENTIVE (CAPPED FUND). PROXIMITY TO US MAKES USD PREFERRED PAYMENT CURRENCY.',
        'Brazil':       'INTELLIGENCE: RATES FROM SAO PAULO/RIO DATA (2025). 20-35% ANCINE TAX REBATE. COMPLEX TAX SYSTEM. REQUIRES BRAZILIAN CO-PRODUCER.',
        'Colombia':     'INTELLIGENCE: RATES FROM BOGOTA PRODUCTION DATA (2025). 40% FDC CASH REBATE — BEST INCENTIVE IN LATIN AMERICA. NO STRICT MINIMUM SPEND.',
        'South Africa': 'INTELLIGENCE: RATES FROM CAPE TOWN & JOHANNESBURG DATA (2025). 35-50% SAFP&TR REBATE WITH LOW MINIMUM SPEND (R1M / ~$54K USD). MAJOR INTERNATIONAL PRODUCTION HUB.'
    };

    /* ========= MARKET TIER SCALARS (Phase 190) ========= */
    var MARKET_TIERS = ['Standard', 'Indie', 'Studio'];
    var MARKET_TIER_SCALARS = {
        'Standard': 1.0,
        'Indie': 0.7,   // 30% reduction
        'Studio': 1.3   // 30% premium
    };

    var mBTOG = {
        rates: [],
        contacts: [],
        templates: [],
        settings: {
            optInSharing: JSON.parse(localStorage.getItem('moo_og_share') || 'false'),
            location: localStorage.getItem('moo_og_loc') || 'Jamaica'
        },

        /* Legacy UI Compatibility: The shell expects an object to build the region dropdown. */
        RATE_REGIONS: (function () {
            var obj = {};
            RATE_REGIONS.forEach(function (r) { obj[r] = 1.0; });
            return obj;
        })(),

        currencies: OG_CURRENCIES,

        REGION_INTELLIGENCE: REGION_INTELLIGENCE,
        MARKET_TIERS: MARKET_TIERS,
        MARKET_TIER_SCALARS: MARKET_TIER_SCALARS,

        /**
         * ROLE_MULTIPLIERS (Parity Matrix)
         * Generated dynamically from the Master Crew Index for mBT.rates.resolve().
         */
        ROLE_MULTIPLIERS: (function () {
            var matrix = {};
            RATE_REGIONS.forEach(function (region) {
                matrix[region] = {};
                _MASTER_CREW_INDEX.forEach(function (role) {
                    var key = role.description.toLowerCase().trim();
                    /* Fallback to 1.0 (USA Anchor) if no regional multiplier is researched. */
                    matrix[region][key] = (role.multipliers && role.multipliers[region]) ? role.multipliers[region] : 1.0;
                });
            });
            return matrix;
        })(),

        /**
         * _expandIndex(masterArray, region, communityData, itemType)
         * Projects a master index (crew or equipment) and merges it with
         * community-calibrated overrides. itemType is stamped on each output
         * row ('crew' default) so the item selector / substitution table can
         * tell equipment rows from labor rows.
         */
        _expandIndex: function (masterArray, region, communityData, itemType) {
            var self = this;
            var currencies = OG_CURRENCIES;
            var baseCurrency = currencies[region] || 'USD';

            return masterArray.map(function (role) {
                var key = (role.description || '').toLowerCase() + '|' + (region || '').toLowerCase();
                var comm = (communityData && communityData[key]) ? communityData[key] : null;

                var rate, source;

                if (comm && comm.avg_rate > 0) {
                    rate = comm.avg_rate;
                    source = 'community';
                } else {
                    /* Role-Specific Multiplier with a strict 1.0 fallback to prevent Drift. */
                    var mult = (role.multipliers && role.multipliers[region]) ? role.multipliers[region] : 1.0;
                    rate = role.baseRate * mult;

                    /* Phase 190: Apply Market Tier Scalar (Indie/Standard/Studio)
                       ONLY to 'default' source rates. Community overrides remain atomic. */
                    var currentTier = self.settings.getMarketTier();
                    if (currentTier && currentTier !== 'Standard') {
                        var scalar = MARKET_TIER_SCALARS[currentTier] || 1.0;
                        rate = rate * scalar;
                    }

                    if (region === 'Jamaica') rate = Math.round(rate * 155);
                    source = 'default';
                }

                return {
                    description: role.description,
                    unit: role.unit,
                    rate: rate,
                    region: region,
                    currency: baseCurrency,
                    source: source,
                    itemType: itemType || 'crew',
                    category: role.category,
                    intelligence: role.intelligence || ( (source === 'default' && (!role.multipliers || !role.multipliers[region])) ? "USA Market Anchor applied. Negotiate bespoke local rate." : "" ) || (source === 'community' ? "Community-calibrated rate based on regional research." : "")
                };
            });
        },

        /* Back-compat: existing call sites use _expandMasterIndex(region, c) for crew */
        _expandMasterIndex: function (region, communityData) {
            return this._expandIndex(_MASTER_CREW_INDEX, region, communityData, 'crew');
        },

        /* New: equipment projection, same shape, itemType stamped 'equipment' */
        _expandEquipmentIndex: function (region, communityData) {
            return this._expandIndex(_MASTER_EQUIPMENT_INDEX, region, communityData, 'equipment');
        },

        /* ========= DYNAMIC REGIONAL GETTERS ========= */
        _getJamaicaDatabase:   function (c) { return this._expandMasterIndex('Jamaica', c); },
        _getTrinidadDatabase:  function (c) { return this._expandMasterIndex('Trinidad', c); },
        _getBarbadosDatabase:  function (c) { return this._expandMasterIndex('Barbados', c); },
        _getUKDatabase:        function (c) { return this._expandMasterIndex('UK', c); },
        _getUSADatabase:       function (c) { return this._expandMasterIndex('USA', c); },
        _getCanadaDatabase:    function (c) { return this._expandMasterIndex('Canada', c); },
        _getAustraliaDatabase: function (c) { return this._expandMasterIndex('Australia', c); },

        _getRegionIntelligence: function (region) {
            return REGION_INTELLIGENCE[region] || 'INTELLIGENCE: NO REGIONAL CITATIONS AVAILABLE.';
        },

        settings: {
            optInSharing: JSON.parse(localStorage.getItem('moo_og_share') || 'false'),
            location: localStorage.getItem('moo_og_loc') || 'Jamaica',
            get regionMultiplier() { return 1.0; },
            
            /**
             * setLocation(newLoc)
             * Called by the Settings Modal. Updates location and refreshes the rate projection.
             */
            setLocation: function (newLoc) {
                /* We check against the array but update the UI-visible property. */
                if (RATE_REGIONS.indexOf(newLoc) === -1) return;
                this.location = newLoc;
                localStorage.setItem('moo_og_loc', newLoc);
                localStorage.setItem('mbt_profile_region', newLoc);
                
                var self = this;
                return mBTOG.loadRates(true).then(function() {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            type: 'mbt:tool-action',
                            action: 'og-location-changed',
                            payload: { 
                                location: newLoc,
                                intelligence: mBTOG._getRegionIntelligence(newLoc)
                            }
                        }, '*');
                    }
                    /* Dispatch local event for same-window listeners */
                    window.dispatchEvent(new CustomEvent('og:location-changed', { 
                        detail: { location: newLoc, intelligence: mBTOG._getRegionIntelligence(newLoc) } 
                    }));
                    window.dispatchEvent(new CustomEvent('mbtOG:regionChanged', { 
                        detail: { location: newLoc } 
                    }));
                    return newLoc;
                });
            },

            /**
             * getMarketTier()
             * Returns the persisted tier or 'Standard' fallback.
             */
            getMarketTier: function () {
                return localStorage.getItem('moo_og_market_tier') || 'Standard';
            },

            /**
             * setMarketTier(newTier)
             * Called by the Settings Modal. Updates tier and refreshes the rate projection.
             */
            setMarketTier: function (newTier) {
                if (MARKET_TIERS.indexOf(newTier) === -1) return;
                localStorage.setItem('moo_og_market_tier', newTier);
                
                var self = this;
                return mBTOG.loadRates(true).then(function() {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            type: 'mbt:tool-action',
                            action: 'og-tier-changed',
                            payload: { tier: newTier }
                        }, '*');
                    }
                    window.dispatchEvent(new CustomEvent('og:tier-changed', { detail: { tier: newTier } }));
                    return newTier;
                });
            }
        },

        rates: [],
        contacts: [],
        templates: [],

        search: function (query) {
            if (!query) return this.rates;
            var q = query.toLowerCase();
            return this.rates.filter(function (r) {
                return (r.description || '').toLowerCase().indexOf(q) > -1;
            });
        },

        /* --- INIT --- */

        init: function () {
            var self = this;
            return self.loadRates().then(function () {
                return self.loadContacts();
            }).then(function () {
                self.loadTemplates();
                /* Attempt cloud sync after local data is ready. Non-blocking. */
                setTimeout(function () {
                    self.syncFromCloud();
                    self.syncContactsFromCloud();
                }, 1200);
            });
        },

        /* --- RATES --- */

        loadRates: function (forceReseed) {
            var self = this;
            var DB_VERSION_KEY = 'mbt_og_db_version';
            var CURRENT_VERSION = '2026.07.09_equipment_v1';

            return _loadWithMigration('prodBudget_v5_globalItems').then(function (stored) {
                return _lfGet(DB_VERSION_KEY).then(function (v) {
                    self.rates.length = 0;
                    /* Reseed if version mismatch OR if forced by a regional change. */
                    if (!stored || stored.length === 0 || v !== CURRENT_VERSION || forceReseed) {
                        var defaults = self._expandMasterIndex(self.settings.location)
                            .concat(self._expandEquipmentIndex(self.settings.location));
                        for (var i = 0; i < defaults.length; i++) { self.rates.push(defaults[i]); }
                        _lfSet(DB_VERSION_KEY, CURRENT_VERSION);
                        return self.saveRates();
                    }
                    for (var j = 0; j < stored.length; j++) {
                        var r = stored[j];
                        /* Phase 185: Ensure bespoke/community rates have intelligence markers if missing */
                        if (!r.intelligence) {
                            if (r.source === 'community') r.intelligence = "Community-calibrated rate based on regional research.";
                            else if (r.source !== 'default') r.intelligence = "Bespoke local rate. Manually verified.";
                        }
                        self.rates.push(r);
                    }
                });
            });
        },

        saveRates: function () {
            return _lfSet('prodBudget_v5_globalItems', this.rates);
        },

        /* --- Notify parent window that a rate was added or changed --- */
        notifyRateChanged: function (description, rate, region) {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'mbt:tool-action',
                    action: 'og-rate-changed',
                    payload: { description: description, rate: rate, region: region || this.settings.location }
                }, '*');
            }
        },

        /* --- CONTACTS ---
         * mBTOG.contacts is a runtime cache of the canonical IndexedDB 'contacts' store.
         * All writes go through window.mBTStorage.saveContact().
         * mBTOG.contacts is refreshed from IndexedDB on init and after any write.
         * Legacy localforage 'moo_contacts' is migrated in on first load.
         */

        loadContacts: function () {
            var self = this;
            /* If mBTStorage is available, use it as canonical source */
            if (window.mBTStorage && typeof window.mBTStorage.getAllContacts === 'function') {
                return window.mBTStorage.getAllContacts().then(function (dbContacts) {
                    self.contacts.length = 0;
                    for (var i = 0; i < dbContacts.length; i++) { self.contacts.push(dbContacts[i]); }
                    /* One-time migration: pull any legacy moo_contacts into IndexedDB */
                    return _loadWithMigration('moo_contacts').then(function (legacy) {
                        if (!legacy || !legacy.length) return;
                        var byId = {};
                        for (var j = 0; j < dbContacts.length; j++) { byId[dbContacts[j].id] = true; }
                        var migrated = [];
                        for (var k = 0; k < legacy.length; k++) {
                            var lc = legacy[k];
                            if (!lc.id) lc.id = 'contact_' + Date.now() + '_' + k;
                            if (!byId[lc.id]) {
                                lc.portfolio = lc.portfolio || [];
                                migrated.push(window.mBTStorage.saveContact(lc));
                                self.contacts.push(lc);
                            }
                        }
                        if (migrated.length) {
                            return Promise.all(migrated).then(function () {
                                /* Clear legacy store after successful migration */
                                return _lfSet('moo_contacts', []);
                            });
                        }
                    });
                }).catch(function () { return self._loadContactsFallback(); });
            }
            return self._loadContactsFallback();
        },

        _loadContactsFallback: function () {
            var self = this;
            return _loadWithMigration('moo_contacts').then(function (stored) {
                self.contacts.length = 0;
                if (stored) {
                    for (var i = 0; i < stored.length; i++) { self.contacts.push(stored[i]); }
                }
            });
        },

        /* Refresh runtime cache from IndexedDB (call after any write) */
        refreshContacts: function () {
            var self = this;
            if (window.mBTStorage && typeof window.mBTStorage.getAllContacts === 'function') {
                return window.mBTStorage.getAllContacts().then(function (all) {
                    self.contacts.length = 0;
                    for (var i = 0; i < all.length; i++) { self.contacts.push(all[i]); }
                    return all;
                }).catch(function () { return self.contacts; });
            }
            return Promise.resolve(self.contacts);
        },

        /* Save a contact to IndexedDB and refresh the cache */
        saveContact: function (contact) {
            var self = this;
            if (window.mBTStorage && typeof window.mBTStorage.saveContact === 'function') {
                return window.mBTStorage.saveContact(contact).then(function (saved) {
                    return self.refreshContacts().then(function () { return saved; });
                });
            }
            /* Fallback: update in-memory array and persist to localforage */
            if (!contact.id) contact.id = 'contact_' + Date.now();
            var idx = -1;
            for (var i = 0; i < self.contacts.length; i++) {
                if (self.contacts[i].id === contact.id) { idx = i; break; }
            }
            if (idx > -1) { self.contacts[idx] = contact; } else { self.contacts.push(contact); }
            return _lfSet('moo_contacts', self.contacts).then(function () { return contact; });
        },

        /* Legacy shim - kept so old callers don't break during transition */
        saveContacts: function () {
            return _lfSet('moo_contacts', this.contacts);
        },

        /* --- OG_CONTACTS CLOUD SYNC (opt-in) ---
         * Pushes non-private contacts to og_contacts Supabase table.
         * Pulls shared contacts from other users and merges as read-only.
         * Controlled by localStorage key: moo_og_share_contacts ('true'/'false').
         */
        OG_CONTACTS_TABLE: 'og_contacts',

        _getOwnerId: function () {
            var uid = localStorage.getItem('mbt_user_id');
            if (!uid) {
                uid = 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
                localStorage.setItem('mbt_user_id', uid);
            }
            return uid;
        },

        syncContactsFromCloud: function () {
            var self = this;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve([]);
            var shareEnabled = localStorage.getItem('moo_og_share_contacts') === 'true';
            if (!shareEnabled) return Promise.resolve([]);

            return fetch(OG_CLOUD_URL + '/rest/v1/' + self.OG_CONTACTS_TABLE + '?select=*&order=shared_at.desc', {
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + OG_CLOUD_KEY
                }
            }).then(function (res) {
                if (!res.ok) return [];
                return res.json();
            }).then(function (rows) {
                if (!rows || !rows.length) return [];
                var ownerId = self._getOwnerId();
                var sharedByOthers = rows.filter(function (r) { return r.owner_id !== ownerId; });
                /* Store shared contacts in a separate localforage key - never mixed into IndexedDB */
                return _lfSet('moo_og_shared_contacts', sharedByOthers).then(function () {
                    window.dispatchEvent(new CustomEvent('mbt:shared-contacts-updated', { detail: { count: sharedByOthers.length } }));
                    return sharedByOthers;
                });
            }).catch(function () { return []; });
        },

        pushContactsToCloud: function () {
            var self = this;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve(0);
            var shareEnabled = localStorage.getItem('moo_og_share_contacts') === 'true';
            if (!shareEnabled) return Promise.resolve(0);

            var ownerId = self._getOwnerId();
            var ownerName = localStorage.getItem('mbt_display_name') || 'mBT User';
            var toShare = self.contacts.filter(function (c) { return !c.privateContact; });

            if (!toShare.length) return Promise.resolve(0);

            var pushed = 0;
            var promises = toShare.map(function (c) {
                var payload = {
                    id:             c.id,
                    owner_id:       ownerId,
                    owner_name:     ownerName,
                    name:           c.name,
                    department:     c.department || c.role || '',
                    role:           c.role || c.department || '',
                    email:          c.email || null,
                    phone:          c.phone || null,
                    rate:           c.rate || null,
                    /* wallet & portfolio: only share URL-type portfolio items, never Base64 file data */
                    portfolio:      (c.portfolio || []).filter(function (p) { return p.type === 'link'; }),
                    private_contact: false
                    /* wallet_type / wallet_address intentionally excluded from cloud */
                };
                return fetch(OG_CLOUD_URL + '/rest/v1/' + self.OG_CONTACTS_TABLE, {
                    method: 'POST',
                    headers: {
                        'apikey': OG_CLOUD_KEY,
                        'Authorization': 'Bearer ' + OG_CLOUD_KEY,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates,return=minimal'
                    },
                    body: JSON.stringify(payload)
                }).then(function (res) { if (res.ok) pushed++; }).catch(function () {});
            });

            return Promise.all(promises).then(function () {
                localStorage.setItem('moo_og_contacts_last_push', new Date().toISOString());
                return pushed;
            });
        },

        deleteContactFromCloud: function (contactId) {
            var self = this;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve(false);
            var shareEnabled = localStorage.getItem('moo_og_share_contacts') === 'true';
            if (!shareEnabled) return Promise.resolve(false);
            return fetch(OG_CLOUD_URL + '/rest/v1/' + self.OG_CONTACTS_TABLE + '?id=eq.' + encodeURIComponent(contactId), {
                method: 'DELETE',
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + OG_CLOUD_KEY,
                    'Prefer': 'return=minimal'
                }
            }).then(function (res) { return res.ok; }).catch(function () { return false; });
        },

        getSharedContacts: function () {
            return _lfGet('moo_og_shared_contacts').then(function (data) { return data || []; });
        },

        /* --- CLOUD SYNC --- */

        /*
         * syncFromCloud() pulls community rates from Supabase og_community_rates.
         * Uses the publishable key for public read. No account required.
         * Merges new entries only never overwrites local edits.
         * Respects the user's cloud sync toggle (moo_og_cloud_sync).
         * Silently no-ops if offline or sync is disabled.
         */
        syncFromCloud: function () {
            var self = this;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve(0);
            var syncEnabled = JSON.parse(localStorage.getItem('moo_og_cloud_sync') || 'true');
            if (!syncEnabled) return Promise.resolve(0);

            return fetch(OG_CLOUD_URL + '/rest/v1/' + OG_TABLE + '?select=*&order=id', {
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + OG_CLOUD_KEY
                }
            }).then(function (res) {
                if (!res.ok) return [];
                return res.json();
            }).then(function (rows) {
                if (!rows || !rows.length) return 0;
                var existing = {};
                for (var i = 0; i < self.rates.length; i++) {
                    existing[self.rates[i].description.toLowerCase()] = true;
                }
                var added = 0;
                for (var j = 0; j < rows.length; j++) {
                    var row = rows[j];
                    if (!existing[row.description.toLowerCase()]) {
                        self.rates.push({
                            id: row.id,
                            description: row.description,
                            unit: row.unit || 'Day',
                            rate: parseFloat(row.rate) || 0,
                            region: row.region || 'Jamaica',
                            source: row.source || 'community'
                        });
                        existing[row.description.toLowerCase()] = true;
                        added++;
                    }
                }
                if (added > 0) { self.saveRates(); }
                localStorage.setItem(OG_SYNC_KEY, new Date().toISOString());
                return added;
            }).catch(function () { return 0; });
        },

        /*
         * pushRate() - contribute a rate to the community database.
         * Requires a Supabase auth token stored at mbt_supabase_key.
         * Opt-in only - respects moo_og_share toggle.
         */
        pushRate: function (description, unit, rate, region) {
            var self = this;
            var shareEnabled = JSON.parse(localStorage.getItem('moo_og_share') || 'false');
            if (!shareEnabled) return Promise.resolve(false);
            /* Use the user JWT when signed in - required for RLS to record contributed_by. */
            var authToken = localStorage.getItem('mbt_supabase_auth_token') || OG_CLOUD_KEY;

            return fetch(OG_CLOUD_URL + '/rest/v1/' + OG_TABLE, {
                method: 'POST',
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + authToken,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    description: description,
                    unit: unit || 'Day',
                    rate: parseFloat(rate) || 0,
                    region: region || self.settings.location,
                    currency: 'JMD',
                    source: 'community'
                })
            }).then(function (res) { return res.ok; }).catch(function () { return false; });
        },

        /*
         * upsertVote() - Phase 48 voting mechanism
         * Requires auth token. Resolves to true if vote was recorded successfully.
         */
        upsertVote: function (rateId, voteType) {
            var authToken = localStorage.getItem('mbt_supabase_auth_token');
            if (!authToken) return Promise.resolve(false); // Must be signed in to vote

            var userId = localStorage.getItem('mbt_supabase_user_id');
            if (!userId) return Promise.resolve(false);

            return fetch(OG_CLOUD_URL + '/rest/v1/og_votes', {
                method: 'POST',
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + authToken,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates,return=minimal'
                },
                body: JSON.stringify({
                    rate_id: rateId,
                    user_id: userId,
                    vote_type: voteType
                })
            }).then(function (res) { return res.ok; }).catch(function () { return false; });
        },

        /* Returns ISO timestamp of last successful cloud sync, or null. */
        lastSync: function () {
            return localStorage.getItem(OG_SYNC_KEY) || null;
        },

        /*
         * fetchRateAverages() - pulls the og_rate_averages view from Supabase.
         * Returns a map of { "description|region": { avg_rate, contributor_count } }.
         * Falls back to computing averages from the local cached community rates when offline.
         * Stores result in localStorage for offline access.
         */
        fetchRateAverages: function (region) {
            var AVGS_KEY = 'moo_og_rate_averages';
            var filterRegion = region || 'Jamaica';
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                /* Offline: return cached averages or compute from local data. */
                var cached = localStorage.getItem(AVGS_KEY);
                if (cached) {
                    try { return Promise.resolve(JSON.parse(cached)); } catch (e) {}
                }
                return Promise.resolve(this._computeLocalAverages());
            }
            return fetch(OG_CLOUD_URL + '/rest/v1/og_rate_averages?select=*&region=eq.' + encodeURIComponent(filterRegion), {
                headers: {
                    'apikey': OG_CLOUD_KEY,
                    'Authorization': 'Bearer ' + OG_CLOUD_KEY
                }
            }).then(function (res) {
                if (!res.ok) return null;
                return res.json();
            }).then(function (rows) {
                if (!rows || !rows.length) return {};
                var map = {};
                for (var i = 0; i < rows.length; i++) {
                    var r = rows[i];
                    map[r.description.toLowerCase() + '|' + r.region.toLowerCase()] = {
                        avg_rate: parseFloat(r.avg_rate) || 0,
                        contributor_count: parseInt(r.contributor_count, 10) || 0
                    };
                }
                localStorage.setItem(AVGS_KEY, JSON.stringify(map));
                return map;
            }).catch(function () { return {}; });
        },

        /* Compute rate averages from local rates + regional defaults (Phase 172).
           Returns a lookup map keyed by 'description|region' (lowercase) so
           mBT.rates.applyRegion() can substitute the correct researched rate
           when a user switches region in Settings.

           Layering rules (later overrides earlier):
           1. Regional defaults (RegionalRateAccuracy.md sourced) - base layer
           2. Community-submitted rates - averaged per key, override defaults
              (community votes carry weight; if 3+ contributors agree, their
              average wins over the seeded default).
        */
        _computeLocalAverages: function () {
            var map = {};
            var i, r, key;

            /* Layer 1: Regional defaults */
            var defaults = this._getAllRegionalDefaults() || [];
            for (i = 0; i < defaults.length; i++) {
                r = defaults[i];
                key = (r.description || '').toLowerCase() + '|' + (r.region || 'Jamaica').toLowerCase();
                map[key] = {
                    avg_rate: parseFloat(r.rate) || 0,
                    currency: r.currency || 'JMD',
                    contributor_count: 0,
                    source: 'default'
                };
            }

            /* Layer 2: Community submissions (averaged) */
            var community = {};
            for (i = 0; i < this.rates.length; i++) {
                r = this.rates[i];
                if (r.source !== 'community') continue;
                key = (r.description || '').toLowerCase() + '|' + (r.region || 'Jamaica').toLowerCase();
                if (!community[key]) { community[key] = { sum: 0, count: 0, currency: r.currency || 'JMD' }; }
                community[key].sum += parseFloat(r.rate) || 0;
                community[key].count++;
            }
            for (var k in community) {
                if (community[k].count > 0) {
                    map[k] = {
                        avg_rate: Math.round(community[k].sum / community[k].count),
                        currency: community[k].currency,
                        contributor_count: community[k].count,
                        source: 'community'
                    };
                }
            }
            return map;
        },

        /* --- INTELLIGENT INGESTION --- */
        /* Deduplicates by description (rates) or name+role (contacts) before saving. */

        ingest: function (items, type) {
            var self = this;
            var added = 0;
            type = type || 'rate';

            if (type === 'rate') {
                var existingRates = {};
                for (var i = 0; i < self.rates.length; i++) {
                    existingRates[self.rates[i].description.toLowerCase()] = true;
                }
                for (var j = 0; j < items.length; j++) {
                    var item = items[j];
                    if (!existingRates[item.description.toLowerCase()]) {
                        self.rates.push({
                            description: item.description,
                            unit: item.unit || 'Day',
                            rate: parseFloat(item.rate) || 0
                        });
                        existingRates[item.description.toLowerCase()] = true;
                        added++;
                    }
                }
                if (added > 0) return self.saveRates().then(function () { return added; });

            } else if (type === 'contact') {
                var existingContacts = {};
                for (var k = 0; k < self.contacts.length; k++) {
                    var c = self.contacts[k];
                    existingContacts[(c.name + '|' + c.role).toLowerCase()] = true;
                }
                for (var m = 0; m < items.length; m++) {
                    var ci = items[m];
                    var name = (ci.Name || ci.name || '').trim();
                    var role = (ci.Role || ci.role || 'Crew').trim();
                    var phone = (ci.Phone || ci.phone || '').trim();
                    var email = (ci.Email || ci.email || '').trim();
                    if (!name) continue;
                    var ckey = (name + '|' + role).toLowerCase();
                    if (!existingContacts[ckey]) {
                        self.contacts.push({
                            id: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                            name: name,
                            role: role,
                            phone: phone,
                            email: email,
                            contact: phone || email
                        });
                        existingContacts[ckey] = true;
                        added++;
                    }
                }
                if (added > 0) return self.saveContacts().then(function () { return added; });
            }

            return Promise.resolve(added);
        },

        /* --- TEMPLATE REGISTRY --- */
        /* Document layout definitions for the Assistant Builder (GridStack). */
        /* This is the single source of truth for document schemas across both apps. */

        loadTemplates: function () {
            var t = [
                /* --- WRITING & CORE --- */
                {
                    id: 'script', cat: 'Pre-Prod', label: 'Script', icon: 'file', default: true,
                    widgets: [{ id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true }, { id: 'body', x: 0, w: 12, h: 12, type: 'richText', label: "Screenplay", autoPosition: true }],
                    defaults: { additional: { body: "INT. LOCATION - DAY\n\n" } }
                },
                {
                    id: 'treatment', cat: 'Pre-Prod', label: 'Story Treatment', icon: 'file', default: false,
                    widgets: [{ id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true }, { id: 'body', x: 0, w: 12, h: 12, type: 'richText', label: "Story Treatment", autoPosition: true }],
                    defaults: { additional: { body: "LOGLINE:\n\nSYNOPSIS:\n\n" } }
                },
                /* --- PRE-PRODUCTION --- */
                {
                    id: 'breakdown', cat: 'Pre-Prod', label: 'Script Breakdowns', icon: 'search', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'cast', x: 0, w: 6, h: 6, type: 'cast', label: "Characters", autoPosition: true },
                        { id: 'logistics', x: 6, w: 6, h: 6, type: 'logistics', label: "Locations", autoPosition: true },
                        { id: 'notes', x: 0, w: 12, h: 4, type: 'richText', label: "Scene Notes & Requirements", autoPosition: true }
                    ],
                    defaults: { cast: [], locations: [], additional: { notes: "" } }
                },
                {
                    id: 'shotlist', cat: 'Pre-Prod', label: 'Shot Lists', icon: 'film', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'schedule', x: 0, w: 12, h: 12, type: 'schedule', label: "Shot Sequence", autoPosition: true },
                        { id: 'logistics', x: 0, w: 12, h: 4, type: 'logistics', label: "Locations", autoPosition: true }
                    ],
                    defaults: { schedule: [], locations: [] }
                },
                {
                    id: 'storyboard', cat: 'Pre-Prod', label: 'Storyboards', icon: 'image', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'frame1', x: 0, w: 4, h: 6, type: 'image', label: "Frame 1", autoPosition: true },
                        { id: 'desc1', x: 0, w: 4, h: 3, type: 'richText', label: "Action 1", autoPosition: true },
                        { id: 'frame2', x: 4, w: 4, h: 6, type: 'image', label: "Frame 2", autoPosition: true },
                        { id: 'desc2', x: 4, w: 4, h: 3, type: 'richText', label: "Action 2", autoPosition: true },
                        { id: 'frame3', x: 8, w: 4, h: 6, type: 'image', label: "Frame 3", autoPosition: true },
                        { id: 'desc3', x: 8, w: 4, h: 3, type: 'richText', label: "Action 3", autoPosition: true }
                    ],
                    defaults: { additional: { desc1: "", desc2: "", desc3: "" } }
                },
                {
                    id: 'preCheck', cat: 'Pre-Prod', label: 'Pre-Prod Checklist', icon: 'check', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'logistics', x: 0, w: 6, h: 10, type: 'richText', label: "Logistics Checklist", autoPosition: true },
                        { id: 'creative', x: 6, w: 6, h: 10, type: 'richText', label: "Creative Checklist", autoPosition: true }
                    ],
                    defaults: { additional: { logistics: "- [ ] Permits\n- [ ] Insurance\n", creative: "- [ ] Script Lock\n- [ ] Storyboards\n" } }
                },
                {
                    id: 'casting', cat: 'Pre-Prod', label: 'Casting Sheets', icon: 'user', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'cast', x: 0, w: 12, h: 10, type: 'cast', label: "Audition List", autoPosition: true },
                        { id: 'notes', x: 0, w: 12, h: 4, type: 'richText', label: "Casting Director Notes", autoPosition: true }
                    ],
                    defaults: { cast: [], additional: { notes: "" } }
                },
                {
                    id: 'techScout', cat: 'Pre-Prod', label: 'Tech Scout Report', icon: 'mapPin', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'logistics', x: 0, w: 12, h: 10, type: 'logistics', label: "Location Details", autoPosition: true },
                        { id: 'notes', x: 0, w: 12, h: 6, type: 'richText', label: "Tech Notes (Power/Parking/Access)", autoPosition: true }
                    ],
                    defaults: { locations: [], additional: { notes: "" } }
                },
                { id: 'charProf', cat: 'Pre-Prod', label: 'Character Profiles', icon: 'user', default: false },
                { id: 'dood', cat: 'Pre-Prod', label: 'Day Out of Days', icon: 'calendar', default: false },
                { id: 'stripboard', cat: 'Pre-Prod', label: 'Stripboard Schedule', icon: 'calendar', default: false },
                /* --- FINANCIAL & PITCH --- */
                {
                    id: 'pitchDeck', cat: 'Pre-Prod', label: 'Funding Pitch Deck', icon: 'maximize', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'cover', x: 0, w: 6, h: 8, type: 'image', label: "Key Art", autoPosition: true },
                        { id: 'synopsis', x: 6, w: 6, h: 8, type: 'richText', label: "Logline & Synopsis", autoPosition: true },
                        { id: 'mood1', x: 0, w: 4, h: 4, type: 'image', label: "Tone Ref 1", autoPosition: true },
                        { id: 'mood2', x: 4, w: 4, h: 4, type: 'image', label: "Tone Ref 2", autoPosition: true },
                        { id: 'mood3', x: 8, w: 4, h: 4, type: 'image', label: "Tone Ref 3", autoPosition: true },
                        { id: 'team', x: 0, w: 12, h: 6, type: 'contacts', label: "Key Creative Team", autoPosition: true }
                    ],
                    defaults: { contacts: [], additional: { synopsis: "" } }
                },
                {
                    id: 'budgetRep', cat: 'Pre-Prod', label: 'Budget Report', icon: 'money', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'summary', x: 0, w: 12, h: 4, type: 'richText', label: "Executive Summary", autoPosition: true },
                        { id: 'breakdown', x: 0, w: 12, h: 12, type: 'schedule', label: "Cost Breakdown", autoPosition: true }
                    ],
                    defaults: { additional: { summary: "" } }
                },
                { id: 'vendorBid', cat: 'Pre-Prod', label: 'Vendor Bid Comparison', icon: 'alert', default: false },
                /* --- PRODUCTION --- */
                {
                    id: 'callSheet', cat: 'Production', label: 'Daily Call Sheet', icon: 'alert', default: true,
                    widgets: [
                        { id: 'contacts', x: 0, w: 6, h: 4, type: 'contacts', label: "Key Contacts", autoPosition: true },
                        { id: 'logistics', x: 6, w: 6, h: 4, type: 'logistics', label: "Logistics", autoPosition: true },
                        { id: 'schedule', x: 0, w: 12, h: 6, type: 'schedule', label: "Schedule", autoPosition: true },
                        { id: 'cast', x: 0, w: 6, h: 6, type: 'cast', label: "Cast List", autoPosition: true },
                        { id: 'crew', x: 6, w: 6, h: 6, type: 'crew', label: "Crew List", autoPosition: true },
                        { id: 'notes', x: 0, w: 12, h: 2, type: 'richText', label: "General Notes", autoPosition: true },
                        { id: 'footer', x: 0, w: 12, h: 2, type: 'footer', label: "Safety Footer", autoPosition: true }
                    ],
                    defaults: { contacts: [], locations: [], schedule: [], cast: [], crew: [], additional: { notes: "" } }
                },
                {
                    id: 'prodReport', cat: 'Production', label: 'Production Report', icon: 'barChart', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'schedule', x: 0, w: 12, h: 5, type: 'schedule', label: "Scenes Shot", autoPosition: true },
                        { id: 'crew', x: 0, w: 12, h: 5, type: 'crew', label: "Crew Attendance", autoPosition: true },
                        { id: 'notes', x: 0, w: 6, h: 4, type: 'richText', label: "Production Notes", autoPosition: true },
                        { id: 'delays', x: 6, w: 6, h: 4, type: 'richText', label: "Delays / Issues", autoPosition: true }
                    ],
                    defaults: { schedule: [], crew: [], additional: { notes: "", delays: "" } }
                },
                {
                    id: 'crewList', cat: 'Production', label: 'Crew Contact List', icon: 'phone', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'contacts', x: 0, w: 12, h: 4, type: 'contacts', label: "Production Team", autoPosition: true },
                        { id: 'crew', x: 0, w: 12, h: 12, type: 'crew', label: "Department Heads & Crew", autoPosition: true }
                    ],
                    defaults: { contacts: [], crew: [] }
                },
                { id: 'transport', cat: 'Production', label: 'Transport Schedule', icon: 'mapPin', default: false },
                { id: 'continuity', cat: 'Production', label: 'Continuity/Sound Log', icon: 'film', default: false },
                { id: 'muahCont', cat: 'Production', label: 'Hair/Makeup Continuity', icon: 'user', default: false },
                { id: 'propList', cat: 'Production', label: 'Prop List', icon: 'hazard', default: false },
                { id: 'catering', cat: 'Production', label: 'Catering/Meal Tracker', icon: 'coffee', default: false },
                { id: 'pettyCash', cat: 'Production', label: 'Petty Cash Log', icon: 'money', default: false },
                { id: 'po', cat: 'Production', label: 'Purchase Order', icon: 'receipt', default: false },
                { id: 'timecard', cat: 'Production', label: 'Timecards', icon: 'history', default: false },
                { id: 'riskAI', cat: 'Production', label: 'AI Risk Assessment', icon: 'sparkle', default: false },
                { id: 'carbon', cat: 'Production', label: 'Carbon Calculator', icon: 'sparkle', default: false },
                /* --- POST & LEGAL --- */
                {
                    id: 'talentAgr', cat: 'Legal', label: 'Talent Agreement', icon: 'check', default: true,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'terms', x: 0, w: 12, h: 14, type: 'richText', label: "Contract Terms & Conditions", autoPosition: true }
                    ],
                    defaults: { additional: { terms: "STANDARD AGREEMENT\n\n1. Services..\n2. Compensation.." } }
                },
                {
                    id: 'dealMemo', cat: 'Legal', label: 'Crew Deal Memo', icon: 'file', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'terms', x: 0, w: 12, h: 10, type: 'richText', label: "Terms of Agreement", autoPosition: true }
                    ],
                    defaults: { additional: { terms: "DEAL MEMO\n\nName:\nRole:\nRate:" } }
                },
                {
                    id: 'permit', cat: 'Legal', label: 'Filming Permit', icon: 'file', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'details', x: 0, w: 12, h: 10, type: 'richText', label: "Permit Details", autoPosition: true }
                    ],
                    defaults: { additional: { details: "PERMIT #:\nLOCATION:\nRESTRICTIONS:" } }
                },
                {
                    id: 'insurance', cat: 'Legal', label: 'Insurance Cert', icon: 'lock', default: false,
                    widgets: [
                        { id: 'meta_header', x: 0, w: 12, h: 2, type: 'header', autoPosition: true },
                        { id: 'details', x: 0, w: 12, h: 10, type: 'richText', label: "Coverage Details", autoPosition: true }
                    ],
                    defaults: { additional: { details: "INSURER:\nPOLICY #:\nCOVERAGE:" } }
                },
                { id: 'vfxBreak', cat: 'Post-Prod', label: 'VFX Breakdown', icon: 'hazard', default: false },
                { id: 'postSched', cat: 'Post-Prod', label: 'Post Schedule', icon: 'calendar', default: true },
                { id: 'delivery', cat: 'Post-Prod', label: 'Delivery Schedule', icon: 'folder', default: false },
                { id: 'festTrack', cat: 'Post-Prod', label: 'Festival Tracker', icon: 'sparkle', default: false },
                { id: 'locRel', cat: 'Legal', label: 'Location Release', icon: 'mapPin', default: true },
                { id: 'kitRental', cat: 'Legal', label: 'Kit Rental Agreement', icon: 'camera', default: false },
                { id: 'covid', cat: 'Legal', label: 'COVID Protocols', icon: 'hazard', default: false },
                { id: 'sag', cat: 'Legal', label: 'SAG-AFTRA Paperwork', icon: 'sparkle', default: false }
            ];
            this.templates.length = 0;
            for (var i = 0; i < t.length; i++) { this.templates.push(t[i]); }
        },




        /* Phase 194.2: Jurisdiction auto-defaults by region */
        getJurisdictionByRegion: function (region) {
            var jMap = {
                'Jamaica':   { name: 'Jamaica (20% Production Rebate)', incentiveRate: 20, minSpend: 50000 },
                'UK':        { name: 'UK (Film Tax Relief)',             incentiveRate: 25, minSpend: 0 },
                'Canada':    { name: 'Canada (CPTC)',                    incentiveRate: 25, minSpend: 0 },
                'USA':       { name: 'USA (Varies by State)',            incentiveRate: 0,  minSpend: 0 },
                'Australia': { name: 'Australia (PDV Offset)',           incentiveRate: 20, minSpend: 0 },
                'Trinidad':  { name: 'Trinidad',                         incentiveRate: 0,  minSpend: 0 },
                'Barbados':  { name: 'Barbados',                         incentiveRate: 0,  minSpend: 0 },
                'Guyana':    { name: 'Guyana',                           incentiveRate: 0,  minSpend: 0 },
                /* Phase 197 — Regional Expansion */
                'India':        { name: 'India (State-Based Incentives)',     incentiveRate: 0,    minSpend: 50000,   intelligence: 'No national rebate. State-level varies 0-25%. FFO provides single-window clearance.' },
                'Thailand':     { name: 'Thailand (Film Rebate)',              incentiveRate: 20,   minSpend: 1430000, intelligence: 'Up to 30% with higher spend. Minimum THB 50M (~$1.43M). Must use Thai crew/services.' },
                'Philippines':  { name: 'Philippines (FDI Film Incentive)',    incentiveRate: 20,   minSpend: 0,       intelligence: 'Up to 20% on local spend. Gaffer (0.29) and Sound Mixer (0.16) verified with FDCP day rates.' },
                'Vietnam':      { name: 'Vietnam (Limited Incentives)',        incentiveRate: 0,    minSpend: 0,       intelligence: 'No formal cash rebate. Import duty exemptions on equipment only.' },
                'Poland':       { name: 'Poland (PFI Cash Rebate)',            incentiveRate: 30,   minSpend: 26000,   intelligence: '30% cash rebate. Low minimum (100K PLN / ~$26K). Cultural test required.' },
                'Mexico':       { name: 'Mexico (Fidecine Tax Incentive)',     incentiveRate: 7.5,  minSpend: 0,       intelligence: '7.5% rebate via capped fund. Applications compete for allocation.' },
                'Brazil':       { name: 'Brazil (ANCINE Tax Rebate)',          incentiveRate: 20,   minSpend: 100000,  intelligence: '20-35% ANCINE rebate. Requires Brazilian co-producer.' },
                'Colombia':     { name: 'Colombia (FDC Cash Rebate)',          incentiveRate: 40,   minSpend: 0,       intelligence: '40% FDC rebate. Best incentive in LATAM. No strict minimum.' },
                'South Africa': { name: 'South Africa (SAFP&TR Rebate)',       incentiveRate: 35,   minSpend: 54000,   intelligence: '35-50% rebate scaled by budget size. Low minimum (R1M / ~$54K).' }
            };
            return jMap[region] || { name: region, incentiveRate: 0, minSpend: 0 };
        },

        /* Phase 194.2: Single-role rate calculator — wraps master index, no double-scaling */
        calculateRate: function (roleDescription, region, tier) {
            var self = this;
            var d = roleDescription.toLowerCase().trim();
            var r = region || self.settings.location;
            var t = tier || self.settings.getMarketTier();

            if (!r || !t) return null;

            /* Find role in Master Index (crew, then equipment -- SYNONYM_REGISTRY
               equipment keys resolve to _MASTER_EQUIPMENT_INDEX descriptions) */
            var role = null;
            for (var i = 0; i < _MASTER_CREW_INDEX.length; i++) {
                if (_MASTER_CREW_INDEX[i].description.toLowerCase() === d) {
                    role = _MASTER_CREW_INDEX[i];
                    break;
                }
            }
            if (!role) {
                for (var eq = 0; eq < _MASTER_EQUIPMENT_INDEX.length; eq++) {
                    if (_MASTER_EQUIPMENT_INDEX[eq].description.toLowerCase() === d) {
                        role = _MASTER_EQUIPMENT_INDEX[eq];
                        break;
                    }
                }
            }
            if (!role) return null;

            /* Currency map */
            var currencies = OG_CURRENCIES;
            var currency = currencies[r] || 'USD';

            /* Step 1: Apply regional multiplier */
            var mult = (role.multipliers && role.multipliers[r]) ? role.multipliers[r] : 1.0;
            var regionalRate = role.baseRate * mult;

            /* Step 2: Jamaica JMD conversion before tier scaling */
            if (r === 'Jamaica') {
                regionalRate = Math.round(regionalRate * 155);
            }

            /* Step 3: Apply tier scalar (Indie: 0.7, Standard: 1.0, Studio: 1.3) */
            var scalar = MARKET_TIER_SCALARS[t] || 1.0;
            var finalRate = Math.round(regionalRate * scalar);

            return {
                rate: finalRate,
                unit: role.unit || 'Day',
                currency: currency,
                baseRate: role.baseRate,
                source: 'master_index'
            };
        },

        /* Aggregator - returns ALL regional defaults concatenated for the substitution lookup table. */
        _getAllRegionalDefaults: function () {
            var self = this;
            var all = [];
            (window.mBTOG_REGIONS || RATE_REGIONS).forEach(function(r) {
                all = all.concat(self._expandMasterIndex(r)).concat(self._expandEquipmentIndex(r));
            });
            return all;
        }
    };

    window.mBTOG = mBTOG;
    window.mBTOG.cloud = { url: OG_CLOUD_URL, key: OG_CLOUD_KEY };

        console.log('[mBTOG] Engine initialized successfully. (v23.35)');
    } catch (e) {
        console.error('[mBTOG] FATAL INITIALIZATION ERROR:', e);
        if (e.stack) console.error(e.stack);
    }

})();
