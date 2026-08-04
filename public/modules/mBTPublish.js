// mBTPublish.js - Web Component for the Publish Tool

function MBTPublish() {
    var self = HTMLElement.call(this) || this;
    return self;
}

MBTPublish.prototype = Object.create(HTMLElement.prototype);
MBTPublish.prototype.constructor = MBTPublish;

MBTPublish.prototype.connectedCallback = function () {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render();
};

MBTPublish.prototype.render = function () {
    this.shadowRoot.innerHTML = 
        '<link href="/globals.css" rel="stylesheet"/>' +
        '<div class="flex flex-col items-center justify-center h-[60vh] text-center">' +
            '<div class="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-6 text-indigo-300">' +
                '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>' +
            '</div>' +
            '<h2 class="text-2xl font-black text-slate-800 mb-2">Publish & Export</h2>' +
            '<p class="text-slate-500 mb-8">Export your budget and documents to PDF, Excel, or share securely.</p>' +
            '<button class="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md">' +
                'Export Project' +
            '</button>' +
        '</div>';
};

customElements.define('mbt-publish', MBTPublish);
