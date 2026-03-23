/* ========= v22.0 EmbeddedMode — tool-side embedded context detection ========= */
/*
 * Include in any tool to enable embedded mode awareness:
 *   <script src="../../core/components/EmbeddedMode.js"></script>
 *
 * When loaded inside <mbt-tool-host> (via ?embedded=true), this script:
 *   1. Adds class "embedded" to <body> for CSS targeting
 *   2. Exposes window.mBTEmbedded (bool) for JS feature gates
 *   3. Provides window.mBTBridge.send(action, payload) for shell communication
 */
(function () {
    'use strict';

    var params   = new URLSearchParams(window.location.search);
    var embedded = params.get('embedded') === 'true';

    /* --- 1. CSS class on body for layout adjustments --- */
    if (embedded) {
        document.documentElement.classList.add('embedded');
        document.addEventListener('DOMContentLoaded', function () {
            document.body.classList.add('embedded');
        });
    }

    /* --- 2. Global flag --- */
    window.mBTEmbedded = embedded;

    /* --- 3. Bridge: send postMessage to shell --- */
    window.mBTBridge = {
        /*
         * Send an action to the shell.
         *   action  — string key (e.g. 'navigate', 'notify', 'refresh')
         *   payload — plain object with action-specific data
         *
         * Shell listens via:
         *   document.addEventListener('mbt:tool-action', handler)
         */
        send: function (action, payload) {
            window.parent.postMessage(
                { type: 'mbt:tool-action', action: action, payload: payload || {} },
                '*'
            );
        },

        /* --- Convenience: navigate to another tool from within a tool --- */
        openTool: function (url) {
            window.mBTBridge.send('navigate', { url: url });
        },

        /* --- Convenience: surface a notification in the shell --- */
        notify: function (message) {
            window.mBTBridge.send('notify', { message: message });
        }
    };

})();
