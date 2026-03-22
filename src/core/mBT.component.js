/**
 * mBT.component.js
 * Phase 49: Native Web Component Migration
 * Replaces sandboxed <iframe> tools with localized Shadow DOM elements for ultra-fast performance.
 */

class MBTTool extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        const src = this.getAttribute('data-src');
        if (!src) return;

        try {
            const response = await fetch(src);
            const html = await response.text();

            // Parse the fetched HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Find all scripts to execute them
            const scripts = doc.querySelectorAll('script');
            const newHead = document.createElement('div');
            const newBody = document.createElement('div');

            // Move styles and structure into shadow DOM
            const st = doc.querySelectorAll('style');
            st.forEach(s => this.shadowRoot.appendChild(s.cloneNode(true)));
            
            // Extract body content and place in shadow DOM
            newBody.innerHTML = doc.body.innerHTML;
            this.shadowRoot.appendChild(newBody);

            // Re-create scripts so they execute inside the Shadow DOM context
            // Note: Inline scripts run globally, so tools must be refactored to IIFEs
            // and use `document.currentScript.getRootNode()` or similar to scope.
            scripts.forEach(script => {
                const newScript = document.createElement('script');
                if (script.src) {
                    newScript.src = script.src;
                } else {
                    newScript.textContent = `
                        (function(shadowRoot) {
                            ${script.textContent}
                        })(document.currentScript.getRootNode());
                    `;
                }
                this.shadowRoot.appendChild(newScript);
            });

        } catch (e) {
            // Logic Resolution: Fallback to classic iframe if fetch is blocked by CORS (e.g. file:/// protocol)
            console.warn('[mBT.component] Shadow DOM fetch failed, falling back to iframe:', e.message);
            this.shadowRoot.innerHTML = `<iframe src="${src}" style="width:100%; height:100%; border:none; display:block;"></iframe>`;
        }
    }
}

customElements.define('mbt-tool', MBTTool);
