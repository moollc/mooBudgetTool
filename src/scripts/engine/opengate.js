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
        { "description": "Transport Coordinator", "unit": "Day", "baseRate": 650, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "Fleet/routing lead for crew, cast, and gear moves. USA mid ~$550-$750/day from production-transport coordinators and location-logistics peers. Multipliers proxy Location Manager." },
        { "description": "Production Driver", "unit": "Day", "baseRate": 250, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "Canada": 0.65, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "Dedicated production driver (passenger van/sprinter, not grip truck). USA mid ~$200-$300/day from PA/driver day bands. Multipliers proxy Truck PA." },
        { "description": "Catering (Per Head)", "unit": "Flat", "baseRate": 45, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 1.1, "Canada": 0.9, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Per Diem", "unit": "Day", "baseRate": 75, "multipliers": { "USA": 1, "Jamaica": 1, "Trinidad": 1, "Barbados": 1, "Guyana": 1, "UK": 1, "Canada": 1, "Australia": 1, "India": 0.85, "Thailand": 0.85, "Philippines": 0.75, "Vietnam": 0.85, "Poland": 0.9, "Mexico": 0.85, "Brazil": 0.9, "Colombia": 0.8, "South Africa": 0.9 }, "intelligence": "Travel/living M&IE allowance per person per day (budget quantity = person-days). SAG-AFTRA distant hire $75/day (Dec 2025); GSA M&IE ~$68-$92. Not a crew labor rate — Travel & Logistics section. Lodging is a separate line." },
        { "description": "Per Diems", "unit": "Day", "baseRate": 75, "multipliers": { "USA": 1, "Jamaica": 1, "Trinidad": 1, "Barbados": 1, "Guyana": 1, "UK": 1, "Canada": 1, "Australia": 1, "India": 0.85, "Thailand": 0.85, "Philippines": 0.75, "Vietnam": 0.85, "Poland": 0.9, "Mexico": 0.85, "Brazil": 0.9, "Colombia": 0.8, "South Africa": 0.9 }, "intelligence": "Alias: Per Diem (template Travel & Logistics string)." },
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
        { "description": "Archival Researcher", "unit": "Day", "baseRate": 400, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "Archival footage/photo sourcing and rights research labor only; license fees are separate. Above general Researcher ($250). Bectu Archive Researcher ~GBP720-1045/wk; US mid ~$350-$500/day best-effort. Multipliers proxy Researcher." },
        { "description": "Fixer/Local Producer", "unit": "Day", "baseRate": 750, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "Local in-country access/logistics hire. Film fixer market often $700-$1000/day (OnAssemble); news fixers and risky destinations vary widely -- treat USA $750 as anchor only. Multipliers proxy Location Manager." },
        { "description": "Broadcast Engineer", "unit": "Day", "baseRate": 700, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.95, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "Live/studio signal-chain engineer (not camera). USA ~$650-$850 day from live video freelancers + Local 695 TV Engineer scale. Multipliers proxy DIT." },
        { "description": "Technical Director", "unit": "Day", "baseRate": 850, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.60, "Philippines": 0.63, "Vietnam": 0.71, "Poland": 0.89, "Mexico": 0.53, "Brazil": 0.63, "Colombia": 0.42, "South Africa": 0.58 }, "intelligence": "Live multi-cam TD (switcher/shot-calling), not VFX TD. USA freelance ~$700-$1000/day (video-eng community); mid $850. Multipliers proxy Producer (live crew lead)." },
        { "description": "Concept Artist", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Legal - Rights & Clearances", "unit": "Flat", "baseRate": 2500, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.9, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Life Rights / IP Purchase", "unit": "Flat", "baseRate": 0, "multipliers": { "USA": 1, "Jamaica": 1, "Trinidad": 1, "Barbados": 1, "Guyana": 1, "UK": 1, "Canada": 1, "Australia": 1, "India": 1, "Thailand": 1, "Philippines": 1, "Vietnam": 1, "Poland": 1, "Mexico": 1, "Brazil": 1, "Colombia": 1, "South Africa": 1 }, "intelligence": "No fixed market rate exists -- real deals range roughly $35K-$75K or 2%-5% of final budget, negotiated per subject/story. Enter the actual negotiated figure. Distinct from Legal - Rights & Clearances (attorney/clearance counsel fees, which ARE a real fixed-range flat)." },
        { "description": "Host", "unit": "Day", "baseRate": 900, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.77, "Australia": 0.68, "India": 0.40, "Thailand": 0.60, "Philippines": 0.66, "Vietnam": 0.74, "Poland": 0.92, "Mexico": 0.54, "Brazil": 0.60, "Colombia": 0.40, "South Africa": 0.58 }, "intelligence": "On-camera mid-tier host. Anchored near SAG Low Budget day-player scale; celebrity and network-star hosts quote far above this." },
        { "description": "Narrator", "unit": "Flat", "baseRate": 2000, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "Voice-only doc narration package, mid-tier ~hour-long program (GVAA). Longer/denser or celebrity VO is higher; light 30-min packages lower." },
        { "description": "Story Researcher", "unit": "Flat", "baseRate": 5500, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "ATL concept and narrative research for docs (not field fact-checking). Project flat for development packages. Market also books weekly ($2k-$2.5k/wk unscripted story track) or ~$400-$550/day US mid. Multipliers proxy Screenwriter (creative)." },
        { "description": "Security Guard", "unit": "Day", "baseRate": 150, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.7, "Canada": 0.7, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Medic / Set Nurse", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        /* --- Expanded Roles (Phase 185 Expansion) --- */
        { "description": "Still Photographer", "unit": "Day", "baseRate": 750, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Construction Coordinator", "unit": "Day", "baseRate": 850, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Sculptor", "unit": "Day", "baseRate": 700, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Draftsperson", "unit": "Day", "baseRate": 600, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Assistant Art Director", "unit": "Day", "baseRate": 650, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Graphics Artist", "unit": "Day", "baseRate": 550, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "PTZ Operator", "unit": "Day", "baseRate": 500, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "VERIFIED peer — Absolute Rentals (Burbank) markets dedicated PTZ operators for multi-cam live/event alongside PTZ gear. USA mid ~$450-$550/day from live camera-operator bands. Multipliers proxy Camera Operator." },
        /* ========= HYBRID / CONFERENCE AV CREW (Phase 204, research 2026-07-27) =========
           Hybrid conference work (in-room + videoconference bridge) had no role
           vocabulary. Sourced from AV production cost guides and hybrid-event
           staffing patterns; multipliers proxy Stream Technician / Camera Operator. */
        { "description": "Videoconference Operator", "unit": "Day", "baseRate": 525, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "PEER — runs the Zoom/Teams bridge for a hybrid event: admits remote presenters, manages share-to-room, monitors remote audio. University AV guides staff this as a dedicated tech separate from the camera op (2 techs typical). USA mid aligns to Stream Technician band ~$525. Multipliers proxy Stream Technician." },
        { "description": "Remote Presenter Wrangler", "unit": "Day", "baseRate": 425, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "ESTIMATE — cues and rehearses remote speakers, manages green room and hand-offs. Below Videoconference Operator (no signal-path responsibility); above PA band. USA mid ~$425. Multipliers proxy Stream Technician." },
        { "description": "AV Technician", "unit": "Day", "baseRate": 450, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "PEER — generalist corporate/conference AV tech (projection, mics, cabling, room patch). USA mid between two-person crew guides ($900-$1500/day for 2) and specialist bands. Multipliers proxy Stream Technician." },
        { "description": "Audio Operator (Live Event)", "unit": "Day", "baseRate": 550, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "PEER — live event A1 running FOH/mix for conference audio incl. videoconference send/return. Distinct from film Sound Mixer (production sound). USA mid ~$550. Multipliers proxy Stream Technician." },
        { "description": "Graphics Operator", "unit": "Day", "baseRate": 500, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "PEER — lower-thirds/CG playback operator for live events. Sits below Technical Director, above Stream Technician. USA mid ~$500. Multipliers proxy Stream Technician." },
        { "description": "Stream Technician", "unit": "Day", "baseRate": 525, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.95, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "PEER — live streaming engineer (encoder/switcher/RTMP path, not broadcast TD). USA mid between indie stream tech (~$400) and Broadcast Engineer (~$700). Multipliers proxy Broadcast Engineer." },
        { "description": "Music Editor", "unit": "Day", "baseRate": 650, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Sound Editor", "unit": "Day", "baseRate": 750, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Location Assistant", "unit": "Day", "baseRate": 350, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.8, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } },
        { "description": "Lead Labourer", "unit": "Day", "baseRate": 400, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.7, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } }
    ];

    /* ========= EQUIPMENT RENTAL INDEX (Phase 202, block OG-Equipment-v1) =========
       Same shape as crew roles; category stored on equipment rows (itemType is
       stamped by _expandIndex). Multipliers = round(regional equipment midpoint
       USD / USA baseRate, 2) from research/rates/{SOUTHEAST_ASIA,INDIA_PRODUCTION,
       SOUTH_AFRICA,MEXICO_LATIN_AMERICA,EASTERN_EUROPE}_RATES.md. Where a region's
       table gives one combined camera-kit row (no RED/ARRI vs Sony split -- Brazil,
       Colombia, Poland), that single ratio is used for both camera SKUs.
       No Jamaica/Caribbean/UK/Canada/Australia equipment tables exist -- those
       anchor to the related crew role's regional multiplier per brief (Camera
       Kit->Camera Operator, Light Kit->Gaffer, Sound Kit->Sound Mixer,
       Grip/Drone->Key Grip), Jamaica fixed at 0.28 for all equipment. Same rule
       covers Drone Package where a region's table has no drone row (Philippines,
       Mexico, Brazil, Colombia, Poland).
       PA / live-event audio: no PA-specific regional tables in research/rates.
       PA rows reuse the Sound Kit multiplier profile (Audio Package midpoints
       in those files; gap countries already Sound Mixer-anchored via Sound Kit).
       Wireless video TX/RX: no wireless-transmission tables in research/rates.
       Wireless rows reuse the Camera Kit (4K Cinema) multiplier profile (globally
       traded video capital gear; gap countries already Camera Operator-anchored).
       **Pricing policy (2026-07-21):** equipment uses a fixed USA anchor — regional
       labor multipliers and Indie/Studio tier scalars do not apply. Jamaica still
       converts USD anchor to JMD (×155). See _expandIndex + calculateRate. */
    var _EQUIPMENT_FIXED_MULTIPLIERS = (function () {
        var m = {};
        for (var er = 0; er < RATE_REGIONS.length; er++) {
            m[RATE_REGIONS[er]] = 1.0;
        }
        return m;
    })();

    /* Template / blueprint strings → canonical index description */
    var _RATE_DESCRIPTION_ALIASES = {
        'per diems': 'Per Diem',
        'switcher/encoder': 'Live Production Switcher Package',
        'lighting package': 'Light Kit (3-Light)',
        'sound equipment rental': 'Sound Kit (Mixer + Wireless)',
        'grip & support equipment': 'Grip Kit (Dolly + Stands)',
        'grip and support equipment': 'Grip Kit (Dolly + Stands)',
        'cameras (3-cam kit)': 'Three-Camera Live Package',
        'comms system': 'Comms System (4-User Wireless)',
        'bonded cellular': 'Bonded Cellular (LiveU LU600)',
        '4g/5g backup data': 'Bonded Cellular (LiveU LU300)',
        'transport': 'Production Sprinter Van',
        'vehicle rental': 'Passenger Van (12-15 Seat)',
        'vehicles': 'Passenger Van (12-15 Seat)',
        'fuel': 'Fuel Allowance',
        'fuel allowance': 'Fuel Allowance',
        'parking & permits': 'Parking & Permits',
        'parking and permits': 'Parking & Permits',
        'ptz camera': 'Sony BRC-X400 4K PTZ Camera',
        'ptz': 'Sony BRC-X400 4K PTZ Camera',
        'ptz controller': 'PTZ Controller (RM-IP10 Class)',
        'ptz control setup': 'PTZ Package (Camera + Controller)',
        'ptz kit': 'PTZ Package (Camera + Controller)',
        'ptz package': 'PTZ Package (Camera + Controller)',
        'graphics op': 'Graphics Artist',
        'graphics operator': 'Graphics Artist'
    };
    var _MASTER_EQUIPMENT_INDEX = [
        { "description": "Camera Kit (4K Cinema Package)", "unit": "Day", "baseRate": 850, "category": "camera", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 1.06, "Thailand": 1.00, "Philippines": 0.71, "Vietnam": 1.18, "Poland": 0.94, "Mexico": 1.06, "Brazil": 1.35, "Colombia": 0.88, "South Africa": 1.26 } },
        { "description": "Camera Kit (Sony FX6/FX9)", "unit": "Day", "baseRate": 475, "category": "camera", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 1.11, "Thailand": 0.90, "Philippines": 0.71, "Vietnam": 0.84, "Poland": 0.94, "Mexico": 0.95, "Brazil": 1.35, "Colombia": 0.88, "South Africa": 1.29 } },
        { "description": "Light Kit (3-Light)", "unit": "Day", "baseRate": 350, "category": "lighting", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.78, "Australia": 0.68, "India": 0.86, "Thailand": 0.86, "Philippines": 0.71, "Vietnam": 0.86, "Poland": 0.86, "Mexico": 1.29, "Brazil": 1.50, "Colombia": 0.86, "South Africa": 1.08 } },
        { "description": "Sound Kit (Mixer + Wireless)", "unit": "Day", "baseRate": 225, "category": "sound", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 1.00, "Thailand": 0.94, "Philippines": 0.67, "Vietnam": 0.78, "Poland": 1.00, "Mexico": 1.33, "Brazil": 1.33, "Colombia": 0.78, "South Africa": 1.02 } },
        { "description": "Grip Kit (Dolly + Stands)", "unit": "Day", "baseRate": 325, "category": "arsenal", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.78, "Australia": 0.68, "India": 1.15, "Thailand": 0.92, "Philippines": 0.69, "Vietnam": 0.69, "Poland": 0.92, "Mexico": 1.15, "Brazil": 1.38, "Colombia": 0.69, "South Africa": 0.99 } },
        { "description": "Drone Package", "unit": "Day", "baseRate": 300, "category": "camera", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.68, "Australia": 0.68, "India": 1.17, "Thailand": 1.00, "Philippines": 0.39, "Vietnam": 1.00, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.81 } },
        { "description": "PA System (Small Venue/Corporate)", "unit": "Day", "baseRate": 350, "category": "sound", "intelligence": "USA gear day rate from basic PA packages (powered tops + mixer, ~$200-$500). Multipliers reuse Sound Kit profile (no PA regional tables; Sound Mixer anchor for Caribbean/UK/Canada/Australia).", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 1.00, "Thailand": 0.94, "Philippines": 0.67, "Vietnam": 0.78, "Poland": 1.00, "Mexico": 1.33, "Brazil": 1.33, "Colombia": 0.78, "South Africa": 1.02 } },
        { "description": "PA System (Live Event/Concert)", "unit": "Day", "baseRate": 1500, "category": "sound", "intelligence": "USA gear day rate for small-medium line array packages (~$1,250-$2,500). Multipliers reuse Sound Kit profile (no PA regional tables; Sound Mixer anchor for Caribbean/UK/Canada/Australia).", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 1.00, "Thailand": 0.94, "Philippines": 0.67, "Vietnam": 0.78, "Poland": 1.00, "Mexico": 1.33, "Brazil": 1.33, "Colombia": 0.78, "South Africa": 1.02 } },
        { "description": "QSC K12.2 PA Package (2 Tops + Mixer)", "unit": "Day", "baseRate": 300, "category": "sound", "intelligence": "USA day rate: 2x QSC K12.2 (~$75-$105 each) plus mixer/stands package (~$250-$350). Multipliers reuse Sound Kit profile.", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 1.00, "Thailand": 0.94, "Philippines": 0.67, "Vietnam": 0.78, "Poland": 1.00, "Mexico": 1.33, "Brazil": 1.33, "Colombia": 0.78, "South Africa": 1.02 } },
        { "description": "JBL SRX Line Array Package", "unit": "Day", "baseRate": 1250, "category": "sound", "intelligence": "USA day rate aligned to published JBL SRX small-medium line array package (~$1,250). Multipliers reuse Sound Kit profile.", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 1.00, "Thailand": 0.94, "Philippines": 0.67, "Vietnam": 0.78, "Poland": 1.00, "Mexico": 1.33, "Brazil": 1.33, "Colombia": 0.78, "South Africa": 1.02 } },
        { "description": "Wireless Video TX/RX System", "unit": "Day", "baseRate": 175, "category": "camera", "intelligence": "Generic wireless HD-SDI/HDMI TX+RX pair. USA mid between indie (~$35-$85) and pro Bolt-class (~$200-$275). Multipliers reuse Camera Kit 4K profile (no wireless regional tables; Camera Operator anchor for Caribbean/UK/Canada/Australia).", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 1.06, "Thailand": 1.00, "Philippines": 0.71, "Vietnam": 1.18, "Poland": 0.94, "Mexico": 1.06, "Brazil": 1.35, "Colombia": 0.88, "South Africa": 1.26 } },
        { "description": "Teradek Bolt 4K (750ft)", "unit": "Day", "baseRate": 250, "category": "camera", "intelligence": "USA production-house day rate for Bolt 4K / Bolt 4K LT 750 TX/RX kits (~$200-$275; CSI Rentals $275 deluxe). Multipliers reuse Camera Kit 4K profile.", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 1.06, "Thailand": 1.00, "Philippines": 0.71, "Vietnam": 1.18, "Poland": 0.94, "Mexico": 1.06, "Brazil": 1.35, "Colombia": 0.88, "South Africa": 1.26 } },
        { "description": "Teradek Bolt 4K (1500ft)", "unit": "Day", "baseRate": 350, "category": "camera", "intelligence": "USA day rate for longer-range Bolt 4K 1500 TX/RX kits; premium over 750ft tier. Multipliers reuse Camera Kit 4K profile.", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 1.06, "Thailand": 1.00, "Philippines": 0.71, "Vietnam": 1.18, "Poland": 0.94, "Mexico": 1.06, "Brazil": 1.35, "Colombia": 0.88, "South Africa": 1.26 } },
        { "description": "Accsoon CineView 2 (SDI)", "unit": "Day", "baseRate": 85, "category": "camera", "intelligence": "USA day rate for Accsoon CineView 2 SDI TX/RX (ShareGrid ~$35 peer; production-house kits ~$75-$100). Multipliers reuse Camera Kit 4K profile.", "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.85, "Canada": 0.8, "Australia": 0.68, "India": 1.06, "Thailand": 1.00, "Philippines": 0.71, "Vietnam": 1.18, "Poland": 0.94, "Mexico": 1.06, "Brazil": 1.35, "Colombia": 0.88, "South Africa": 1.26 } },
        /* ========= LIVE / BROADCAST EQUIPMENT (Phase 203, Grok+X research 2026-07-21) =========
           Fixed USA USD anchor via _expandIndex equipment path. Sources: work/grok_live_broadcast_equipment_rates.txt */
        { "description": "NewTek TriCaster Mini", "unit": "Day", "baseRate": 350, "category": "live", "intelligence": "Gear-only day. Absolute Rentals Burbank list $350/day (2024 table).", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "NewTek TriCaster TC1", "unit": "Day", "baseRate": 750, "category": "live", "intelligence": "Gear-only day. Mid Absolute $800 (with CS) and ShareGrid LA peer $699.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "NewTek TriCaster 2 Elite", "unit": "Day", "baseRate": 995, "category": "live", "intelligence": "Gear-only day. Omega Broadcast rental list $995 with 2-stripe surface.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Blackmagic ATEM Mini Pro ISO", "unit": "Day", "baseRate": 50, "category": "live", "intelligence": "Prosumer HDMI switcher/recorder. Adorama $35/day; ShareGrid-class mid ~$50.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Blackmagic ATEM 2 M/E Constellation 4K", "unit": "Day", "baseRate": 275, "category": "live", "intelligence": "Chassis only. ShareGrid Austin $289/day 4K 2 M/E; OpenGate mid 275.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Blackmagic ATEM 4 M/E Constellation 4K", "unit": "Day", "baseRate": 350, "category": "live", "intelligence": "40-input 4 M/E 4K class. Mid production-house day between mailer multi-day and 2 M/E peer.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Teradek VidiU Go Encoder", "unit": "Day", "baseRate": 45, "category": "live", "intelligence": "RTMP/Wi-Fi encoder. Lensrentals ~$45/7-day band; first-day mid ~$45.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Teradek Cube 655 HD Encoder", "unit": "Day", "baseRate": 75, "category": "live", "intelligence": "H.264 SDI/HDMI encoder. ShareGrid avg ~$97; mailer multi-day lower; mid 75.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Teradek Cube 755 HEVC Encoder", "unit": "Day", "baseRate": 85, "category": "live", "intelligence": "HEVC/H.264 premium encoder. Lensrentals weekly ~$96; single production day mid 85.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Wowza ClearCaster Encoder", "unit": "Day", "baseRate": 125, "category": "live", "intelligence": "ESTIMATE — product line sunset; mid pro rack encoder day when legacy units rent.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Decimator MD-HX Scan Converter", "unit": "Day", "baseRate": 25, "category": "live", "intelligence": "HDMI/SDI cross-converter. Motion Rental $19; ShareGrid/ProSound $25.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Blackmagic Micro Converter BiDirectional SDI/HDMI", "unit": "Day", "baseRate": 15, "category": "live", "intelligence": "Commodity 3G bidirectional converter. Canal Sound $15/day; ShareGrid ~$20.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Bonded Cellular (LiveU LU300)", "unit": "Day", "baseRate": 400, "category": "live", "intelligence": "Portable bonded encoder. Streaming Store / Feed Central ~$395-$400/day with short data.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Bonded Cellular (LiveU LU600)", "unit": "Day", "baseRate": 750, "category": "live", "intelligence": "Flagship backpack bonded encoder. Feed Central $540/day (2-day min); houses to $1500; mid 750.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Pepwave Bonded Router Backup", "unit": "Day", "baseRate": 375, "category": "live", "intelligence": "2-modem bonded cellular router gear day. Absolute Pepwave 2-cell $375/day.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Comms System (4-User Wireless)", "unit": "Day", "baseRate": 250, "category": "live", "intelligence": "Clear-Com FreeSpeak-class 4-drop wireless intercom package (base + beltpacks).", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "IFB Talent Beltpack (Single)", "unit": "Day", "baseRate": 75, "category": "live", "intelligence": "Single talent IFB listen path. Beltpack add-ons ~$50-$75/day.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Dedicated Internet Line", "unit": "Day", "baseRate": 650, "category": "live", "intelligence": "Managed temporary bonded/sat event internet day. Absolute Starlink/4-cell class $650/day cards.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Live Production Switcher Package", "unit": "Day", "baseRate": 250, "category": "live", "intelligence": "Mid generic switcher+encoder flypack (ATEM Mini-class + RTMP encoder + cabling). Alias for Switcher/Encoder.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Three-Camera Live Package", "unit": "Day", "baseRate": 1500, "category": "live", "intelligence": "Three mid pro cameras + support/tripods/cables gear-only; switcher/encoder separate.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        /* Template-exact alias rows (blueprint strings resolve in OpenGate search) */
        { "description": "Switcher/Encoder", "unit": "Day", "baseRate": 250, "category": "live", "intelligence": "Alias: Live Production Switcher Package (mid switcher + encoder bundle).", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Lighting Package", "unit": "Day", "baseRate": 350, "category": "lighting", "intelligence": "Alias: Light Kit (3-Light) rental day.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Sound Equipment Rental", "unit": "Day", "baseRate": 225, "category": "sound", "intelligence": "Alias: Sound Kit (Mixer + Wireless) rental day.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Grip & Support Equipment", "unit": "Day", "baseRate": 325, "category": "arsenal", "intelligence": "Alias: Grip Kit (Dolly + Stands) rental day.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Comms System", "unit": "Day", "baseRate": 250, "category": "live", "intelligence": "Alias: Comms System (4-User Wireless).", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Bonded Cellular", "unit": "Day", "baseRate": 750, "category": "live", "intelligence": "Alias: Bonded Cellular (LiveU LU600) flagship tier.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "4G/5G Backup Data", "unit": "Day", "baseRate": 400, "category": "live", "intelligence": "Alias: Bonded Cellular (LiveU LU300) backup uplink tier.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Cameras (3-Cam Kit)", "unit": "Day", "baseRate": 1500, "category": "live", "intelligence": "Alias: Three-Camera Live Package gear-only.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        /* ========= LIVE / BROADCAST DEFERRED (Grok+X research 2026-07-21) ========= */
        { "description": "Presidential Teleprompter (17-19 in System)", "unit": "Day", "baseRate": 500, "category": "live", "intelligence": "Gear-only dual-glass presidential/speech system. Magic Teleprompting stage gear $600+$200 paddles; ShareGrid peers $230-$750.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Compact Teleprompter (iPad Class)", "unit": "Day", "baseRate": 125, "category": "live", "intelligence": "Tablet/iPad-class beamsplitter rig gear-only. ShareGrid ~$100; AMC supported package ~$295.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "On-Air CG Hardware (LiveText / XPression Class)", "unit": "Day", "baseRate": 560, "category": "live", "intelligence": "Broadcast CG/character generator hardware day. ShareGrid NYC Ross XPression Studio $562/day.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "On-Air Graphics Software Package (BYO Hardware)", "unit": "Day", "baseRate": 275, "category": "live", "intelligence": "ESTIMATE — software seat when renter supplies qualified host PC/GPU. ~half of full XPression HW+SW day.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "CDN Live Streaming Bandwidth (Managed Egress, Event Day)", "unit": "Day", "baseRate": 850, "category": "live", "intelligence": "Managed live CDN egress planning mid for 1k-5k peak concurrent multi-hour event. Scales with GB/viewers.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Studio Lease Broadcast Control Room (Floor Day, Gear Excluded)", "unit": "Day", "baseRate": 1200, "category": "location", "intelligence": "ESTIMATE — broadcast-capable control room floor/shell only; no switcher package or engineer.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        /* ========= TRANSPORT / VEHICLE (Phase 204, 2026-07-22) ========= */
        { "description": "Passenger Van (12-15 Seat)", "unit": "Day", "baseRate": 175, "category": "transport", "intelligence": "USA 12-15 passenger production van day. ShareGrid/production-house peers ~$150-$225/day for Ford Transit / Mercedes Sprinter passenger class.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Production Sprinter Van", "unit": "Day", "baseRate": 425, "category": "transport", "intelligence": "USA crew/camera sprinter with racks or seats removed. Production rental peers ~$350-$500/day.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Box Truck (16-24 ft)", "unit": "Day", "baseRate": 275, "category": "transport", "intelligence": "USA grip/lighting box truck day. Peer bands ~$225-$350/day before driver/labor.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Fuel Allowance", "unit": "Day", "baseRate": 65, "category": "transport", "intelligence": "Per-vehicle fuel planning allowance (not pump receipts). Mid ~$50-$85/day US fleet vans/trucks on location loops.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Parking & Permits", "unit": "Flat", "baseRate": 450, "category": "transport", "intelligence": "Location parking, truck holding, and municipal permit bundle for a short shoot block. Highly market-specific — enter actual quotes when known.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Vehicle Rental", "unit": "Day", "baseRate": 175, "category": "transport", "intelligence": "Alias: Passenger Van (12-15 Seat) generic template string.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        /* ========= PTZ / REMOTE CAMERAS (Phase 205, 2026-07-22) ========= */
        { "description": "Sony BRC-X400 4K PTZ Camera", "unit": "Day", "baseRate": 175, "category": "live", "intelligence": "VERIFIED peer — ShareGrid USA peers ~$150/day; Digital Azul (PT) published €175/day (2026). OpenGate US mid $175.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "JVC KY100 PTZ Camera", "unit": "Day", "baseRate": 280, "category": "live", "intelligence": "VERIFIED — Absolute Rentals Burbank PTZ list: JVC KY100 PTZ $280/day (absoluterentals.com/camera/ptz-camera/ptz-camera-rentals/, fetched 2026-07-22).", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Panasonic AW-UE150 4K PTZ Camera", "unit": "Day", "baseRate": 350, "category": "live", "intelligence": "ESTIMATE — Absolute Rentals lists AW-UE150K (Call). Mid above JVC KY100 ($280 verified) for flagship broadcast PTZ class.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Sony SRG-X400 PTZ Camera", "unit": "Day", "baseRate": 155, "category": "live", "intelligence": "PEER — Livestream Rental NL Sony SRG-300SEC PTZ €145/day; SRG-X400 current-gen sibling. US mid ~$155.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Sony FR7 PTZ Cinema Camera", "unit": "Day", "baseRate": 450, "category": "live", "intelligence": "ESTIMATE — Absolute Rentals lists Sony FR7 PTZ Cinema (Call). Full-frame cinema PTZ premium over BRC-X400; mid $450 gear-only.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "PTZ Controller (RM-IP10 Class)", "unit": "Day", "baseRate": 85, "category": "live", "intelligence": "VERIFIED peer — Livestream Rental NL Sony RM-IP10 €75/day (livestreamrental.nl/product/329). US production mid ~$85.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "Panasonic AW-RP150 PTZ Controller", "unit": "Day", "baseRate": 150, "category": "live", "intelligence": "ESTIMATE — Absolute Rentals lists AW-RP150G (Call). Pro panel above RM-IP10 class; mid ~$150/day.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "PTZ Package (Camera + Controller)", "unit": "Day", "baseRate": 275, "category": "live", "intelligence": "PEER — BRC-X400-class camera ($175) + RM-IP10-class controller ($85) + cabling; bundled gear-only mid $275.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "PTZ Camera", "unit": "Day", "baseRate": 175, "category": "live", "intelligence": "Alias: Sony BRC-X400 4K PTZ Camera.", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "PTZ Controller", "unit": "Day", "baseRate": 85, "category": "live", "intelligence": "Alias: PTZ Controller (RM-IP10 Class).", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "PTZ Control Setup", "unit": "Day", "baseRate": 275, "category": "live", "intelligence": "Alias: PTZ Package (Camera + Controller).", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        { "description": "PTZ Kit", "unit": "Day", "baseRate": 275, "category": "live", "intelligence": "Alias: PTZ Package (Camera + Controller).", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS },
        /* ========= OSEE SWITCHERS + HYBRID/CONFERENCE AV (Phase 204, research 2026-07-27) =========
           OSEE had no entries; conference AV (projection, mics, laptops, VC bridge)
           was absent entirely, which forced AI-assisted builds to invent rates.
           Rental days derived from street purchase price on the standard
           ~10%/day prosumer and ~5%/day pro-AV convention, cross-checked to
           in-class peers already in this table. */
        { "description": "OSEE GoStream Deck", "unit": "Day", "baseRate": 45, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "ESTIMATE — 4-input HDMI switcher/recorder, street $295 (B&H/Amazon 2026). Direct ATEM Mini Pro ISO competitor (2 HDMI outs vs 1); priced just under the $50 ATEM Mini Pro ISO peer already in this table." },
        { "description": "OSEE GoStream Deck Pro", "unit": "Day", "baseRate": 60, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "ESTIMATE — NDI-updatable Pro variant of GoStream Deck. Premium over base Deck consistent with the NDI uplift on peer switchers." },
        { "description": "OSEE GoStream Omni 12 ISO", "unit": "Day", "baseRate": 150, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "ESTIMATE — 12-input live switcher with ISO record, PTZ control, instant replay. Launch indicative $1,700-$1,900 (CineD, July 2026). Sits between ATEM Mini Pro ISO ($50) and ATEM 2 M/E Constellation ($275)." },
        { "description": "Videoconference Bridge Kit (Zoom to Room)", "unit": "Day", "baseRate": 175, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "ESTIMATE — the two-way path for hybrid events: dedicated bridge laptop, USB capture in, program/audio return to the VC platform, and mix-minus so remote talent is not echoed back. Bundled gear-only day; excludes the Videoconference Operator who runs it." },
        { "description": "USB Capture Device (Program to VC)", "unit": "Day", "baseRate": 35, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "ESTIMATE — UVC capture (Cam Link / ATEM USB webcam out) presenting program video to Zoom/Teams as a camera source. Street $130-$200; prosumer 10%/day convention." },
        { "description": "Projector (5000 Lumen)", "unit": "Day", "baseRate": 300, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "VERIFIED — Houston AV Rental lists 5,000-lumen projector at $300/day; corporate AV guides quote $100-$500/day depending on lumens." },
        { "description": "Projection Screen (Tripod)", "unit": "Day", "baseRate": 50, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "VERIFIED — tripod screen $50/day (Houston AV Rental). Fast-fold and larger formats price above this." },
        { "description": "Wireless Microphone (Handheld)", "unit": "Day", "baseRate": 175, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "VERIFIED — Shure wireless handheld $175/day per channel (AV rental listings). Price is per channel, not per system." },
        { "description": "Wireless Microphone (Lavalier)", "unit": "Day", "baseRate": 175, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "VERIFIED — Shure wireless lavalier $175/day per channel; matches handheld channel pricing in AV rental listings." },
        { "description": "Presentation Laptop", "unit": "Day", "baseRate": 200, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "VERIFIED — laptop rental $200/day (AV rental rate cards). Covers slide playback or a dedicated VC bridge machine." },
        { "description": "Confidence Monitor", "unit": "Day", "baseRate": 125, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "ESTIMATE — on-stage return display so presenters see slides/remote panel. Mid of corporate AV display bands; below projector, above tripod screen." },
        { "description": "Camera Tripod (Video Head)", "unit": "Day", "baseRate": 45, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "ESTIMATE — fluid-head sticks for locked-off event cameras. ShareGrid-class prosumer day; below cine tripod bands." },
        { "description": "Conference AV Package (Projection + Mics)", "unit": "Day", "baseRate": 500, "category": "live", "multipliers": _EQUIPMENT_FIXED_MULTIPLIERS, "intelligence": "VERIFIED floor — corporate projector-and-screen packages start at $500/day; full event AV packages run $500-$1,000+. Bundle alias for projection, screen, mic channels and patch." }
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
                    var isEquipment = (itemType === 'equipment');
                    /* Equipment: fixed USA USD anchor (mult 1.0); crew: regional multipliers. */
                    var mult = isEquipment ? 1.0 : ((role.multipliers && role.multipliers[region]) ? role.multipliers[region] : 1.0);
                    rate = role.baseRate * mult;

                    /* Market tier scalars apply to crew only — capital gear stays fixed. */
                    if (!isEquipment) {
                        var currentTier = self.settings.getMarketTier();
                        if (currentTier && currentTier !== 'Standard') {
                            var scalar = MARKET_TIER_SCALARS[currentTier] || 1.0;
                            rate = rate * scalar;
                        }
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
                        }, window.location.origin);
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
                        }, window.location.origin);
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
            var CURRENT_VERSION = '2026.07.27_hybrid_conference_av_v1';

            return _loadWithMigration('prodBudget_v5_globalItems').then(function (stored) {
                return _lfGet(DB_VERSION_KEY).then(function (v) {
                    self.rates.length = 0;
                    /* Reseed if version mismatch OR if forced by a regional change. */
                    if (!stored || stored.length === 0 || v !== CURRENT_VERSION || forceReseed) {
                        var defaults = self._expandMasterIndex(self.settings.location)
                            .concat(self._expandEquipmentIndex(self.settings.location));

                        /* A reseed refreshes the DEFAULT card only. Rates the user
                           edited (source !== 'default') are their own work and must
                           survive — a straight overwrite here silently destroyed
                           every bespoke and community rate. Keep those, and let a
                           user override win over the default of the same name. */
                        var keep = [];
                        var kept = {};
                        if (stored && stored.length) {
                            for (var k = 0; k < stored.length; k++) {
                                var sr = stored[k];
                                if (sr && sr.source && sr.source !== 'default') {
                                    keep.push(sr);
                                    kept[sr.description] = true;
                                }
                            }
                        }
                        for (var i = 0; i < defaults.length; i++) {
                            if (!kept[defaults[i].description]) self.rates.push(defaults[i]);
                        }
                        for (var kp = 0; kp < keep.length; kp++) { self.rates.push(keep[kp]); }

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
                }, window.location.origin);
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
            if (_RATE_DESCRIPTION_ALIASES[d]) {
                d = _RATE_DESCRIPTION_ALIASES[d].toLowerCase().trim();
            }
            var r = region || self.settings.location;
            var t = tier || self.settings.getMarketTier();

            if (!r || !t) return null;

            /* Community rates are already region-specific; tier scalar only, no multiplier/JMD conversion */
            for (var ci = 0; ci < self.rates.length; ci++) {
                var comm = self.rates[ci];
                if (comm.description && comm.description.toLowerCase().trim() === d && comm.region === r) {
                    var commCurrency = (OG_CURRENCIES[r] || 'USD');
                    var commScalar = MARKET_TIER_SCALARS[t] || 1.0;
                    /* Equipment community rows stay fixed — no tier discount/premium. */
                    if (comm.itemType === 'equipment') commScalar = 1.0;
                    return {
                        rate: Math.round(comm.rate * commScalar),
                        unit: comm.unit || 'Day',
                        currency: commCurrency,
                        baseRate: comm.rate,
                        source: 'community'
                    };
                }
            }

            /* Find role in Master Index (crew, then equipment) */
            var role = null;
            var isEquipmentRole = false;
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
                        isEquipmentRole = true;
                        break;
                    }
                }
            }
            if (!role) return null;

            /* Currency map */
            var currencies = OG_CURRENCIES;
            var currency = currencies[r] || 'USD';

            var regionalRate;
            var finalRate;

            if (isEquipmentRole) {
                /* Fixed USA USD anchor; Jamaica JMD conversion only. No regional mult, no tier scalar. */
                regionalRate = role.baseRate;
                if (r === 'Jamaica') regionalRate = Math.round(regionalRate * 155);
                finalRate = regionalRate;
            } else {
                /* Step 1: Apply regional multiplier */
                var mult = (role.multipliers && role.multipliers[r]) ? role.multipliers[r] : 1.0;
                regionalRate = role.baseRate * mult;

                /* Step 2: Jamaica JMD conversion before tier scaling */
                if (r === 'Jamaica') {
                    regionalRate = Math.round(regionalRate * 155);
                }

                /* Step 3: Apply tier scalar (Indie: 0.7, Standard: 1.0, Studio: 1.3) */
                var scalar = MARKET_TIER_SCALARS[t] || 1.0;
                finalRate = Math.round(regionalRate * scalar);
            }

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
