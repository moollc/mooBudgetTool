/* ========= ToolBridge — same-origin postMessage helpers for tool iframes ========= */
(function () {
    'use strict';

    function targetOrigin() {
        return window.location.origin;
    }

    window.mBTToolBridge = {
        targetOrigin: targetOrigin,

        originOk: function (e) {
            return !!(e && e.origin === window.location.origin);
        },

        postToParent: function (data) {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(data, targetOrigin());
            }
        },

        postTo: function (win, data) {
            if (win) {
                try {
                    win.postMessage(data, targetOrigin());
                } catch (err) { /* ignore */ }
            }
        }
    };
})();
