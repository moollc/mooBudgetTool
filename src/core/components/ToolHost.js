/* ========= v1.0 ToolHost Web Component — Shadow DOM encapsulated iframe host with postMessage bridge v22.0 ========= */
(function () {
    'use strict';

    /* --- Spinner and host styles scoped inside Shadow DOM --- */
    var SHADOW_CSS = `
        :host {
            display: block;
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        .host-container {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        .mbt-tool-frame {
            display: block;
            width: 100%;
            height: 100%;
            border: none;
        }
        .mbt-tool-spinner {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.9);
            font-family: system-ui, sans-serif;
            font-size: 14px;
            color: #6b7280;
            gap: 10px;
            z-index: 10;
        }
        .spinner-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #6366f1;
            animation: mbt-bounce 1.2s ease-in-out infinite;
        }
        .spinner-dot:nth-child(2) { animation-delay: 0.2s; }
        .spinner-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes mbt-bounce {
            0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
            40%            { transform: scale(1.0); opacity: 1.0; }
        }
    `;

    class ToolHost extends HTMLElement {
        constructor() {
            super();
            this._iframe    = null;
            this._src       = '';
            this._spinner   = null;
            this._container = null;
            this._onLoadBound  = this._onLoad.bind(this);
            this._onErrorBound = this._onError.bind(this);

            /* --- Attach Shadow DOM for CSS encapsulation --- */
            var shadow = this.attachShadow({ mode: 'open' });

            var style = document.createElement('style');
            style.textContent = SHADOW_CSS;
            shadow.appendChild(style);

            this._container = document.createElement('div');
            this._container.className = 'host-container';
            shadow.appendChild(this._container);
        }

        static get observedAttributes() {
            return ['src'];
        }

        connectedCallback() {
            this._updateFrame();
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (name === 'src' && oldValue !== newValue) {
                this._updateFrame();
            }
        }

        /* --- Build or swap the iframe for the current src attribute --- */
        _updateFrame() {
            var src = this.getAttribute('src');

            if (!src) {
                this._clearFrame();
                return;
            }

            /* --- Append ?embedded=true so tools can detect iframe context --- */
            var embeddedSrc = src.includes('?') ? src + '&embedded=true' : src + '?embedded=true';

            var existing = this._container.querySelector('iframe');
            if (existing && existing.getAttribute('data-src') === src) {
                return; /* already loaded */
            }

            this._clearFrame();

            var frame = document.createElement('iframe');
            frame.className  = 'mbt-tool-frame';
            frame.src        = embeddedSrc;
            frame.setAttribute('data-src', src);
            frame.sandbox    = 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals';
            frame.setAttribute('loading', 'lazy');
            frame.setAttribute('title', 'mBT Tool');
            frame.addEventListener('load',  this._onLoadBound);
            frame.addEventListener('error', this._onErrorBound);

            this._container.appendChild(frame);
            this._iframe = frame;
            this._src = src;
            this._showSpinner();
        }

        _clearFrame() {
            var existing = this._container.querySelector('iframe');
            if (existing) {
                existing.removeEventListener('load',  this._onLoadBound);
                existing.removeEventListener('error', this._onErrorBound);
                this._container.removeChild(existing);
            }
            this._iframe = null;
            this._src = '';
            this._hideSpinner();
        }

        _onLoad() {
            this._hideSpinner();
            this.dispatchEvent(new CustomEvent('mbt:tool-loaded', {
                bubbles: true,
                composed: true,
                detail: { src: this._src }
            }));
        }

        _onError(e) {
            this._hideSpinner();
            console.error('[ToolHost] Frame load failed:', this._src, e);
            this.dispatchEvent(new CustomEvent('mbt:tool-error', {
                bubbles: true,
                composed: true,
                detail: { src: this._src, error: e }
            }));
        }

        _showSpinner() {
            if (this._spinner) { this._spinner.style.display = 'flex'; return; }
            this._spinner = document.createElement('div');
            this._spinner.className = 'mbt-tool-spinner';
            this._spinner.innerHTML = '<span class="spinner-dot"></span><span class="spinner-dot"></span><span class="spinner-dot"></span>';
            this._container.appendChild(this._spinner);
        }

        _hideSpinner() {
            if (this._spinner) this._spinner.style.display = 'none';
        }
    }

    /* --- Register the custom element --- */
    if (!customElements.get('mbt-tool-host')) {
        customElements.define('mbt-tool-host', ToolHost);
    }

    /* --- 2. TOOL-TO-SHELL BRIDGE (postMessage → CustomEvent) ---
     *
     * Tools in sandboxed iframes cannot call window.parent on file://
     * due to CORS. Instead, tools dispatch postMessage with:
     *     window.postMessage({ type: 'mbt:tool-action', action: '...', payload: {} }, '*')
     *
     * This listener relays those messages as CustomEvents on document,
     * allowing the shell to react via:
     *     document.addEventListener('mbt:tool-action', handler)
     */
    window.addEventListener('message', function (e) {
        if (!e.data || e.data.type !== 'mbt:tool-action') return;

        var detail = { action: e.data.action || '', payload: e.data.payload || {}, origin: e.origin };

        document.dispatchEvent(new CustomEvent('mbt:tool-action', {
            bubbles: false,
            detail: detail
        }));

        /* --- Built-in action handlers --- */
        if (detail.action === 'navigate' && detail.payload.url) {
            if (typeof window.openTool === 'function') {
                window.openTool(detail.payload.url);
            }
        }
        if (detail.action === 'notify' && detail.payload.message) {
            console.info('[mBT Bridge] Tool notification:', detail.payload.message);
        }
    });

    /* --- Expose globally --- */
    window.mBT = window.mBT || {};
    window.mBT.components = window.mBT.components || {};
    window.mBT.components.ToolHost = ToolHost;

})();
