/* ========= v1.0 Supabase Configuration — credentials from localStorage v2.0 ========= */
(function () {
    'use strict';

    /* --- Credentials stored in localStorage per security protocol --- */
    window.mBTSupabaseConfig = {
        get API_URL()    { return localStorage.getItem('mbt_supabase_url') || ''; },
        get ANON_KEY()   { return localStorage.getItem('mbt_supabase_key') || ''; },
        get AUTH_TOKEN() { return localStorage.getItem('mbt_supabase_auth_token') || ''; },
        isConfigured: function () {
            return !!(this.API_URL && this.ANON_KEY);
        },
        isSignedIn: function () {
            return !!(this.AUTH_TOKEN);
        },
        SYNC: {
            ENABLED: localStorage.getItem('mbt_supabase_sync_enabled') !== 'false',
            AUTO_SYNC_INTERVAL: 3600000,
            LAST_SYNC_KEY: 'mbt_supabase_last_sync',
            TABLES: {
                mbt_projects: true,
                mbt_stages: true,
                mbt_executions: true,
                og_ref: true,
                contacts: true,
                sessions: true
            }
        }
    };

    /* --- Schema maps IndexedDB store names to Supabase table names --- */
    window.mBTSupabaseSchema = {
        mbt_projects:    'projects',
        mbt_stages:      'stages',
        mbt_executions:  'executions',
        og_ref:          'og_ref',
        contacts:        'contacts',
        sessions:        'sessions'
    };

    console.log('[mBT] Supabase config initialized ✓');
})();
