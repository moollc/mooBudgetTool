/* ========= mBT Collab Supabase config (product-hosted multiplayer) =========
   SEPARATE from personal-backup (mBTSupabaseConfig) and OpenGate community rates.
   Project: mbt-collab (omzyycoaaxymjitlnhhj)                                    */
(function () {
    'use strict';

    /* Hardcoded product collab endpoint. localStorage overrides only for advanced debugging. */
    var COLLAB_DEFAULT_URL = 'https://omzyycoaaxymjitlnhhj.supabase.co';
    var COLLAB_DEFAULT_ANON = 'sb_publishable_u_aiS0VvZNMOXEfr0F4fuQ_WYFW1w_k';

    var cfg = {
        isConfigured: function () {
            return !!(this.API_URL && this.ANON_KEY);
        },
        isSignedIn: function () {
            return !!(this.AUTH_TOKEN);
        }
    };

    Object.defineProperty(cfg, 'API_URL', {
        get: function () {
            return localStorage.getItem('mbt_collab_url') || COLLAB_DEFAULT_URL;
        },
        enumerable: true
    });
    Object.defineProperty(cfg, 'ANON_KEY', {
        get: function () {
            return localStorage.getItem('mbt_collab_key') || COLLAB_DEFAULT_ANON;
        },
        enumerable: true
    });
    Object.defineProperty(cfg, 'AUTH_TOKEN', {
        get: function () {
            return localStorage.getItem('mbt_collab_auth_token') || '';
        },
        enumerable: true
    });

    window.mBTCollabConfig = cfg;
    console.log('[mBT] Collab config initialized (mbt-collab) ✓');
})();
