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

    connectedCallback: function() {
        var src = this.getAttribute('data-src');
        var self = this;
        if (!src) return;

        fetch(src).then(function(response) {
            return response.text();
        }).then(function(html) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');
            var scripts = doc.querySelectorAll('script');
            var newBody = document.createElement('div');

            var st = doc.querySelectorAll('style');
            for (var si = 0; si < st.length; si++) {
                self.shadowRoot.appendChild(st[si].cloneNode(true));
            }

            newBody.innerHTML = doc.body.innerHTML;
            self.shadowRoot.appendChild(newBody);

            for (var i = 0; i < scripts.length; i++) {
                var script = scripts[i];
                var newScript = document.createElement('script');
                if (script.src) {
                    newScript.src = script.src;
                } else {
                    newScript.textContent = '(function(shadowRoot) { ' + script.textContent + ' })(document.currentScript.getRootNode());';
                }
                self.shadowRoot.appendChild(newScript);
            }
        }).catch(function(e) {
            self.shadowRoot.innerHTML = '<iframe src="' + src + '" style="width:100%; height:100%; border:none; display:block;"></iframe>';
        });
    }
}

customElements.define('mbt-tool', MBTTool);
