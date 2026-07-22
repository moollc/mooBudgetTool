/* ========= v1.0 mBTSmartFill — Publisher Iframe SmartFill Bridge ========= */
/* Receives SMARTFILL_DATA postMessage from the parent Budget Editor.
   Stores payload, dispatches mbt:smartfill-ready CustomEvent so the
   publisher inline script can render the action strip and trigger export.
   Sends SMARTFILL_ACK back to parent on receipt. */

window.mBTSmartFill = {

    /* Stores the last received payload { templateId, label, editorData } */
    pendingPayload: null,

    /* --- Listener bootstrap --- */
    init: function () {
        window.addEventListener('message', function (evt) {
            if (!evt || evt.origin !== window.location.origin) return;
            if (!evt.data || evt.data.type !== 'SMARTFILL_DATA') return;

            var payload = evt.data.payload || {};
            window.mBTSmartFill.pendingPayload = payload;

            /* Notify publisher inline script via CustomEvent */
            try {
                var detail = { templateId: payload.templateId || '', label: payload.label || '', editorData: payload.editorData || {} };
                document.dispatchEvent(new CustomEvent('mbt:smartfill-ready', { detail: detail }));
            } catch (e) {
                /* Fallback for environments where CustomEvent constructor is unavailable */
                var ev = document.createEvent('CustomEvent');
                ev.initCustomEvent('mbt:smartfill-ready', true, false, payload);
                document.dispatchEvent(ev);
            }

            /* ACK back to parent */
            if (evt.source) {
                evt.source.postMessage({
                    type: 'SMARTFILL_ACK',
                    templateId: evt.data.templateId || payload.templateId || ''
                }, evt.origin);
            }
        });
    }

};

window.mBTSmartFill.init();
