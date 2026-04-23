/* ================= TIER 5: MODULE CONTROLLERS & SMART FEATURES ================= */
/* ========= v19.54 mBT.ui.modal: MODAL ENGINE (Window orchestration) ========= */
// Previously: mBTME
mBT.ui.modal = {
    containerId: 'global-modal-container',
    // --- Phase 87B: Z-Registry LIFO Stack Array ---
    stack: [],
    focusStack: [],
    // --- Registry Resolution: Pointing to Tier 1 Asset Registry ---
    icons: {
        close: mBTAssets.close,
        alert: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    },

    // --- Phase 87B: Emergency Reset Method ---
    reset: function () {
        this.stack.forEach(function (modalId) {
            var el = document.getElementById(modalId);
            if (el) el.remove();
        });
        this.stack = [];
        this.focusStack = [];
        document.body.style.overflow = '';
        document.removeEventListener('keydown', this._escHandler, true);
    },

    // --- Phase 87B: ESC Handler (LIFO - closes topmost only) ---
    _escHandler: function (e) {
        if (e.key !== 'Escape') return;
        var topModalId = mBT.ui.modal.stack[mBT.ui.modal.stack.length - 1];
        if (topModalId) {
            e.preventDefault();
            e.stopPropagation();
            mBT.ui.modal.close(topModalId);
        }
    },

    // --- Portal Generation: Dynamic injection of overlay layers ---
    open: function (id, title, contentHtml, maxWidth = 'max-w-2xl', options = {}) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Phase 87B: Cap at 5 modals deep
        if (this.stack.length >= 5) {
            console.warn('[mBT] Modal stack depth limit reached (5). Close existing modals first.');
            return;
        }

        // Accessibility & Focus Management
        this.focusStack.push(document.activeElement);

        // Prevent background scrolling while modal is active
        document.body.style.overflow = 'hidden';

        const modalId = `${id}Modal`;
        this.close(modalId, true); // Cleanup duplicates

        // Phase 87B: Dynamic Z-index from stack depth (base 1000 + stack * 10)
        const baseZ = 1000;
        const currentZ = baseZ + (this.stack.length * 10);

        // UPDATED HEADER: Uses grid to perfectly center the title while keeping the close button right-aligned
        const headerHtml = options.hideHeader ? '' : `
                <div class="px-4 py-2.5 border-b border-slate-100 bg-white rounded-t-2xl relative grid grid-cols-[1fr_auto_1fr] items-center shrink-0">
                    <div></div> <h2 class="text-xs font-black uppercase tracking-widest text-slate-800 text-center truncate px-2">${title}</h2>
                    <div class="text-right">
                        <button onclick="mBT.ui.modal.close('${modalId}')" class="text-slate-400 hover:text-red-500 transition-all p-1 rounded-md hover:bg-slate-50">${this.icons.close}</button>
                    </div>
                </div>`;
        const fullHtml = `
                <div id="${modalId}" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 opacity-0 hidden" tabindex="-1" role="dialog" aria-modal="true" aria-label="${title || 'Dialog'}" style="z-index:${currentZ}">
                    <div id="${modalId}Content" class="bg-white rounded-2xl shadow-2xl w-full ${maxWidth} mx-auto max-h-[95vh] flex flex-col transition-all duration-300 transform scale-95 border border-white/20 overflow-hidden">
                        ${headerHtml}
                        <div class="flex-grow overflow-hidden ${options.noPadding ? 'p-0' : 'p-0'}" id="${modalId}Body">${contentHtml}</div>
                    </div>
                </div>`;
        container.insertAdjacentHTML('beforeend', fullHtml);
        const modal = document.getElementById(modalId);
        modal.classList.remove('hidden');

        // Phase 87B: Push to stack
        this.stack.push(modalId);

        // Bind ESC handler (only once, uses capture phase)
        if (this.stack.length === 1) {
            document.addEventListener('keydown', this._escHandler, true);
        }

        // Animation & Focus Trapping
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            document.getElementById(`${modalId}Content`)?.classList.remove('scale-95');

            // Auto-focus first interactive element
            const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length > 0) {
                const auto = modal.querySelector('[autofocus]');
                if (auto) auto.focus();
                else focusable[0].focus();
            } else {
                modal.focus();
            }
        }, 50);

        modal.addEventListener('click', (e) => { if (e.target === modal) this.close(modalId); });

        if (options.onOpen && typeof options.onOpen === 'function') setTimeout(options.onOpen, 50);
        return modal;
    },
    // --- Portal Dissolution: Synchronized removal of UI layers ---
    close: function (modalId, instant = false) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        // Phase 87B: Pop from stack
        var stackIdx = this.stack.indexOf(modalId);
        if (stackIdx > -1) this.stack.splice(stackIdx, 1);

        // Unbind ESC handler if stack is empty
        if (this.stack.length === 0) {
            document.removeEventListener('keydown', this._escHandler, true);
            document.body.style.overflow = '';
        }

        const finalize = () => {
            modal.remove();
            if (typeof mBTLE !== 'undefined') mBTLE.reconcile();

            // Focus Restoration
            if (this.focusStack && this.focusStack.length > 0) {
                const el = this.focusStack.pop();
                if (el && document.body.contains(el)) el.focus();
            }
        };

        if (instant) { finalize(); } else {
            modal.classList.add('opacity-0');
            document.getElementById(`${modalId}Content`)?.classList.add('scale-95');
            setTimeout(finalize, 300);
        }
    },

    // --- System: Non-blocking Confirmation Modal ---
    confirm: function (title, message, onConfirm) {
        const content = `
                <div class="p-8 text-center flex flex-col items-center justify-center">
                    <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 animate-bounce shadow-sm">
                        ${this.icons.alert}
                    </div>
                    <h3 class="text-sm font-black uppercase tracking-widest text-slate-800 mb-2">${title}</h3>
                    <p class="text-xs text-slate-500 font-bold mb-8 max-w-xs leading-relaxed">${message}</p>
                    <div class="flex gap-3 w-full max-w-xs">
                        <button id="mbtConfirmCancel" class="flex-1 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">Cancel</button>
                        <button id="mbtConfirmYes" class="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black shadow-lg transition-all transform active:scale-95">Confirm</button>
                    </div>
                </div>`;

        this.open('confirmation', '', content, 'max-w-sm', { hideHeader: true, noPadding: true });

        // Bind listeners after render
        setTimeout(() => {
            const cancelBtn = document.getElementById('mbtConfirmCancel');
            const yesBtn = document.getElementById('mbtConfirmYes');
            if (cancelBtn) cancelBtn.onclick = () => this.close('confirmationModal');
            if (yesBtn) yesBtn.onclick = () => {
                this.close('confirmationModal');
                if (onConfirm && typeof onConfirm === 'function') onConfirm();
            };
        }, 50);
    },

    // --- System: Non-blocking Alert Modal ---
    alert: function (title, message, onOk) {
        const content = `
                <div class="p-8 text-center flex flex-col items-center justify-center">
                    <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-4 shadow-sm">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <h3 class="text-sm font-black uppercase tracking-widest text-slate-800 mb-2">${title}</h3>
                    <p class="text-xs text-slate-500 font-bold mb-8 max-w-xs leading-relaxed">${message}</p>
                    <button id="mbtAlertOk" class="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black shadow-lg transition-all transform active:scale-95">OK</button>
                </div>`;

        this.open('alert', '', content, 'max-w-sm', { hideHeader: true, noPadding: true });

        setTimeout(() => {
            const okBtn = document.getElementById('mbtAlertOk');
            if (okBtn) okBtn.onclick = () => {
                this.close('alertModal');
                if (onOk && typeof onOk === 'function') onOk();
            };
        }, 50);
    },

    // --- System: Non-blocking Prompt Modal ---
    prompt: function (title, message, defaultValue, onOk) {
        const content = `
                <div class="p-8 text-center flex flex-col items-center justify-center">
                    <h3 class="text-sm font-black uppercase tracking-widest text-slate-800 mb-2">${title}</h3>
                    <p class="text-xs text-slate-500 font-bold mb-4 max-w-xs leading-relaxed">${message}</p>
                    <input type="text" id="mbtPromptInput" value="${defaultValue || ''}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-6" autofocus>
                    <div class="flex gap-3 w-full max-w-xs">
                        <button id="mbtPromptCancel" class="flex-1 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">Cancel</button>
                        <button id="mbtPromptOk" class="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black shadow-lg transition-all transform active:scale-95">OK</button>
                    </div>
                </div>`;

        this.open('prompt', '', content, 'max-w-sm', { hideHeader: true, noPadding: true });

        setTimeout(() => {
            const input = document.getElementById('mbtPromptInput');
            if (input) {
                input.focus();
                input.select();
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') document.getElementById('mbtPromptOk').click();
                });
            }
            const cancelBtn = document.getElementById('mbtPromptCancel');
            const okBtn = document.getElementById('mbtPromptOk');
            if (cancelBtn) cancelBtn.onclick = () => this.close('promptModal');
            if (okBtn) okBtn.onclick = () => {
                const val = document.getElementById('mbtPromptInput').value;
                this.close('promptModal');
                if (onOk && typeof onOk === 'function') onOk(val);
            };
        }, 50);
    },

    // --- System: Status Loader ---
    showLoader: function (message) {
        const content = `
                <div class="p-6 flex flex-col items-center justify-center">
                    <div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">${message}</p>
                </div>`;
        this.open('loader', '', content, 'max-w-xs', { hideHeader: true, noPadding: true });
    },
    hideLoader: function () {
        this.close('loaderModal');
    },

    // --- Search Integration: Filtering logic for modal lists ---
    attachSearch: function (inputId, listContainerId, dataItems, renderRowFn) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listContainerId);
        if (!input || !list) return;
        input.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = dataItems.filter(item => (item.description || item.name || item.label || '').toLowerCase().includes(term));
            // Logic Resolution: Added col-span-full to support grid layouts in "No Matches" state
            list.innerHTML = filtered.length > 0 ? filtered.map(renderRowFn).join('') : `<div class="p-12 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest col-span-full">No Matches</div>`;
        });
    }
};

// --- Global Alias for Backward Compatibility (The Bridge) ---
window.mBTME = mBT.ui.modal;

/* ========= v19.54 mBTPublisher: OUTPUT & COMMUNICATIONS ENGINE ========= */
const mBTPublisher = {
    config: {
        pdf: { margin: 0.2, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } }
    },

    /* --- 1. Communication Protocols (The "Comms" Layer) --- */
    comm: {
        // Logic Resolution: Centralized link generation for consistency
        cleanPhone: (p) => p ? p.replace(/\D/g, '') : '',

        whatsapp: function (phone, text = '') {
            const p = this.cleanPhone(phone);
            if (!p) return '#';
            // Industry Standard: Auto-append country code for Jamaica/US if missing
            const num = (p.length === 10 && (p.startsWith('876') || p.startsWith('658'))) ? '1' + p : p;
            return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
        },

        email: function (email, subject = '', body = '') {
            return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        },

        call: function (phone) {
            return `tel:${this.cleanPhone(phone)}`;
        },

        // Logic Resolution: Generates the "Share Sheet" for a document
        generateShareSheet: function (doc) {
            const title = doc.label || 'Document';
            const date = doc.content?.data?.meta?.shootDate || 'TBD';
            return `Here is the ${title} for ${date}. Please review.`;
        }
    },

    /* --- 2. IO & File Systems (The "Hard Drive" Layer) --- */
    io: {
        forceDownload: function (blob, filename) {
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        },

        saveMoo: function (budgetData) {
            const blob = new Blob([JSON.stringify(budgetData, null, 2)], { type: 'application/json' });
            this.forceDownload(blob, `${(budgetData.projectName || 'project').toLowerCase().replace(/\s+/g, '_')}.moo`);
        },

        saveTemplate: function (templateData) {
            const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' });
            this.forceDownload(blob, `${(templateData.label || 'template').toLowerCase().replace(/\s+/g, '_')}.mtemp`);
        },

        saveBundle: async function (budgetData) {
            if (typeof JSZip === 'undefined') return mBTME.alert("Error", "Bundler module (JSZip) missing.");

            const zip = new JSZip();
            const cleanName = (budgetData.projectName || 'project').toLowerCase().replace(/\s+/g, '_');

            // 1. Add Core Data
            zip.file(`${cleanName}.moo`, JSON.stringify(budgetData, null, 2));

            // 2. Add Manifest
            const readme = `Project: ${budgetData.projectName}\nExported: ${new Date().toLocaleString()}\n\nContains master budget data (.moo) and embedded assets.\nFormat: Unified Container (Zip-based)`;
            zip.file("README.txt", readme);

            // --- Asset Injection Loop ---
            const assetsFolder = zip.folder("assets");
            const cleanBase64 = (dataurl) => dataurl.split(',')[1];

            if (budgetData.documents) {
                for (const doc of budgetData.documents) {
                    if (doc.attachments) {
                        for (let i = 0; i < doc.attachments.length; i++) {
                            const file = doc.attachments[i];
                            // Sanitize filename to ensure ZIP compatibility
                            const safeName = (file.name || 'file').replace(/[^a-z0-9.]/gi, '_');
                            const fileName = `${doc.id}_${i}_${safeName}`;

                            try {
                                if (file.location === 'internal' && file.key) {
                                    // Resolve Internal Blob from IndexedDB
                                    const blobUrl = await mBT.data.storage.loadBlob(file.key);
                                    if (blobUrl) {
                                        const response = await fetch(blobUrl);
                                        const blob = await response.blob();
                                        assetsFolder.file(fileName, blob);
                                    }
                                } else if (file.data) {
                                    // Handle Legacy Base64
                                    assetsFolder.file(fileName, cleanBase64(file.data), { base64: true });
                                }
                            } catch (err) {
                                console.warn(`Failed to bundle asset: ${file.name}`, err);
                            }
                        }
                    }
                }
            }

            // 3. Generate & Download
            try {
                const content = await zip.generateAsync({ type: "blob" });
                this.forceDownload(content, `${cleanName}.moo`);
            } catch (e) {
                console.error("Bundle Error:", e);
                mBTME.alert("Export Error", "Failed to generate bundle.");
            }
        }
    },

    /* --- 3. Render Formats (The "Printer" Layer) --- */
    format: {
        // PDF Export (Studio Documents)
        pdf: function (elementId, filename) {
            const element = document.getElementById(elementId);
            if (!element) return mBTME.alert("Export Error", "Source element not found");

            // Visual Polish: Flatten inputs for print
            const originalBg = element.style.background;
            element.style.background = "white";
            element.classList.add('print-mode'); // CSS hook for hiding buttons

            html2pdf().set(mBTPublisher.config.pdf).from(element).save(filename + '.pdf')
                .then(() => {
                    element.style.background = originalBg;
                    element.classList.remove('print-mode');
                });
        },

        // Fast Preview (JPEG Snapshot) with Linearization (Batch 4.1)
        jpeg: function (elementId, callback, options = {}) {
            const source = document.getElementById(elementId);
            if (!source) return;

            // 1. Clone & Clean (WYSIWYG Capture)
            const clone = source.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.classList.remove('editing-mode');

            // Capture Background
            clone.style.background = options.bg || window.getComputedStyle(source).backgroundColor;

            // 2. Linearization Logic (The "Paper" Transform)
            if (options.linearize) {
                clone.classList.remove('grid-stack');
                clone.style.height = 'auto';
                clone.style.minHeight = 'auto';
                clone.style.width = '1200px'; // Fixed width for consistent high-res render
                clone.style.display = 'flex';
                clone.style.flexDirection = 'column';
                clone.style.gap = '24px';
                clone.style.padding = '40px';
                clone.style.overflow = 'visible';

                // Select and Sort Items (Top-Left priority)
                const items = Array.from(clone.querySelectorAll('.grid-stack-item'));
                items.sort((a, b) => {
                    const yA = parseInt(a.getAttribute('gs-y')) || 0;
                    const yB = parseInt(b.getAttribute('gs-y')) || 0;
                    const xA = parseInt(a.getAttribute('gs-x')) || 0;
                    const xB = parseInt(b.getAttribute('gs-x')) || 0;
                    return yA - yB || xA - xB;
                });

                // Flatten Items
                items.forEach(item => {
                    item.style.position = 'relative';
                    item.style.inset = 'auto';
                    item.style.width = '100%';
                    item.style.height = 'auto';
                    item.style.marginBottom = '20px';
                    item.style.border = '1px solid #000'; // Enforce strict border for standard look
                    item.style.boxShadow = 'none';
                    item.style.borderRadius = '0';

                    // Fix content scrolling & expansion
                    const content = item.querySelector('.grid-stack-item-content');
                    if (content) {
                        content.style.height = 'auto';
                        content.style.overflow = 'visible';
                        content.style.border = 'none'; // handled by wrapper
                        content.style.boxShadow = 'none';
                    }

                    const body = item.querySelector('.widget-body');
                    if (body) {
                        body.style.height = 'auto';
                        body.style.overflow = 'visible';
                        // Expand textareas to fit content
                        body.querySelectorAll('textarea').forEach(ta => {
                            ta.style.height = (ta.scrollHeight + 20) + 'px';
                        });
                    }
                    clone.appendChild(item); // Re-append sorted
                });
            } else {
                // Graphic Mode: Respect original dimensions
                const rect = source.getBoundingClientRect();
                clone.style.width = source.scrollWidth + "px";
                clone.style.height = source.scrollHeight + "px";
            }

            // 3. De-Clutter (Remove Dashboard Artifacts)
            const artifacts = [
                '.widget-tools',
                '.ui-resizable-handle',
                'button:not(.permanent)',
                '.grid-stack-handle',
                '.widget-controls',
                '.stage-remove-btn'
            ];
            clone.querySelectorAll(artifacts.join(',')).forEach(el => el.remove());

            // 4. Flatten Data (Inputs -> Text) & Copy Canvas
            clone.querySelectorAll('input').forEach(el => {
                if (el.type !== 'hidden') {
                    const span = document.createElement('span');
                    span.textContent = el.value;
                    span.className = el.className;
                    span.style.border = 'none';
                    span.style.background = 'transparent';
                    span.style.padding = '0';
                    span.style.fontWeight = 'bold';
                    span.style.width = '100%';
                    span.style.color = '#000'; // Force black text
                    if (el.type === 'checkbox') {
                        const checkSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
                        const boxSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`;
                        span.innerHTML = el.checked ? checkSvg : boxSvg;
                    }
                    el.parentNode.replaceChild(span, el);
                }
            });

            clone.querySelectorAll('textarea').forEach(el => {
                const div = document.createElement('div');
                div.innerHTML = el.value.replace(/\n/g, '<br>');
                div.className = el.className + ' whitespace-pre-wrap';
                div.style.height = 'auto';
                div.style.border = 'none';
                div.style.resize = 'none';
                div.style.background = 'transparent';
                div.style.color = '#000'; // Force black text
                el.parentNode.replaceChild(div, el);
            });

            // Canvas (MudMaps) - Must manually copy data
            const origCanvases = source.querySelectorAll('canvas');
            const cloneCanvases = clone.querySelectorAll('canvas');
            origCanvases.forEach((orig, i) => {
                if (cloneCanvases[i]) {
                    cloneCanvases[i].width = orig.width;
                    cloneCanvases[i].height = orig.height;
                    const ctx = cloneCanvases[i].getContext('2d');
                    ctx.drawImage(orig, 0, 0);
                }
            });

            // 5. Capture
            document.body.appendChild(clone);

            html2canvas(clone, {
                scale: 2, // Retina quality
                useCORS: true,
                logging: false,
                backgroundColor: null // Transparent base to respect clone background
            }).then(canvas => {
                document.body.removeChild(clone);
                if (callback) callback(canvas.toDataURL('image/jpeg', 0.9));
            }).catch(err => {
                console.error("Snapshot Failed", err);
                document.body.removeChild(clone);
            });
        },

        // Digital Export (Standalone HTML)
        htmlStandalone: function (elementId, title) {
            const source = document.getElementById(elementId);
            if (!source) return mBTME.alert("Export Error", "Content source missing.");

            // 1. Clone & Clean
            const clone = source.cloneNode(true);
            clone.classList.remove('editing-mode');

            // Remove UI artifacts
            clone.querySelectorAll('button, .widget-controls, .grid-stack-handle, .ui-resizable-handle').forEach(el => el.remove());

            // Linearize GridStack (Convert absolute grid to vertical stack for reliability)
            clone.querySelectorAll('.grid-stack-item').forEach(item => {
                item.style.position = 'relative';
                item.style.left = 'auto';
                item.style.top = 'auto';
                item.style.width = '100%';
                item.style.height = 'auto';
                item.style.marginBottom = '24px';
                const content = item.querySelector('.grid-stack-item-content');
                if (content) content.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            });
            const gridContainer = clone.querySelector('.grid-stack');
            if (gridContainer) {
                gridContainer.style.height = 'auto';
                gridContainer.className = 'flex flex-col'; // Remove grid-stack class
            }

            // Flatten Inputs to Read-Only Text
            clone.querySelectorAll('input, select').forEach(el => {
                const span = document.createElement('span');
                span.textContent = el.value;
                span.className = el.className;
                // Reset input styles
                span.style.border = 'none';
                span.style.background = 'transparent';
                span.style.display = 'inline-block';
                span.style.width = 'auto';
                if (el.type === 'date' && el.value) span.textContent = new Date(el.value).toLocaleDateString();
                el.parentNode.replaceChild(span, el);
            });

            clone.querySelectorAll('textarea').forEach(el => {
                const div = document.createElement('div');
                div.innerHTML = el.value.replace(/\n/g, '<br>');
                div.className = el.className + ' whitespace-pre-wrap';
                div.style.height = 'auto';
                div.style.border = 'none';
                div.style.resize = 'none';
                el.parentNode.replaceChild(div, el);
            });

            // 2. Build Standalone Shell
            // Note: Script tags are escaped to prevent browser parsing errors in the main app
            const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${mBT.ui.render.esc(title)}</title>
    \x3Cscript src="https://cdn.tailwindcss.com">\x3C/script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; background-color: #f3f4f6; padding: 20px; }
        .grid-stack-item-content { background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; }
        .widget-header { background: #f9fafb; padding: 12px; border-bottom: 1px solid #f3f4f6; font-weight: 900; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; color: #9ca3af; }
        .widget-body { padding: 16px; }
    </style>
</head>
<body>
    <div class="max-w-3xl mx-auto">
        <div class="text-center mb-10">
            <h1 class="text-3xl font-black uppercase tracking-tighter text-slate-900">${mBT.ui.render.esc(title)}</h1>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">MooBudget Digital Export</p>
        </div>
        ${clone.innerHTML}
        <div class="mt-12 text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest">
            Generated by MooBudget Tool
        </div>
    </div>
</body>
</html>`;

            // 3. Export
            const blob = new Blob([html], { type: 'text/html' });
            mBTPublisher.io.forceDownload(blob, `${title.replace(/\s+/g, '_')}_Digital.html`);
        },

        // --- RESTORED: Professional Typesetter Engine (v19.50 Logic) ---
        professionalPdf: function (budgetData, options = {}) {
            if (typeof window.jspdf === 'undefined') return mBTME.alert("Error", "PDF Engine missing.");

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF(mBTPublisher.config.pdf.jsPDF);
            const currency = displayCurrency || 'JMD';
            const fmt = (val) => mBTLE.format.currency(val, currency);

            // --- 1. Header & Meta ---
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text((budgetData.projectName || "Untitled Production").toUpperCase(), 105, 15, { align: "center" });

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`${budgetData.company || "Independent"} | Date: ${new Date().toLocaleDateString()}`, 105, 22, { align: "center" });

            // --- 2. Executive Summary ---
            const summaryData = [
                ["Subtotal", fmt(budgetData.subtotal)],
                [`Contingency (${budgetData.contingencyPercentage}%)`, fmt(budgetData.subtotal * (budgetData.contingencyPercentage / 100))],
                [`Sales Tax (${budgetData.salesTaxPercentage}%)`, fmt(budgetData.subtotal * (budgetData.salesTaxPercentage / 100))],
                [`Discount (${budgetData.discountPercentage}%)`, `-${fmt(budgetData.subtotal * (budgetData.discountPercentage / 100))}`],
                [{ content: "GRAND TOTAL", styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } }, { content: fmt(budgetData.grandTotal), styles: { fontStyle: 'bold', textColor: [21, 128, 61] } }] // Emerald-700
            ];

            doc.autoTable({
                startY: 30,
                head: [['Financial Summary', 'Amount']],
                body: summaryData,
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' }, // Slate-900
                columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 'auto', halign: 'right' } },
                margin: { left: 14, right: 14 }
            });

            // --- 3. Detailed Line Items ---
            let finalY = doc.lastAutoTable.finalY + 10;

            const bodyRows = [];

            Object.entries(budgetData.sections).forEach(([secName, sec]) => {
                // Section Header Row
                bodyRows.push([{ content: secName.toUpperCase(), colSpan: 5, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [71, 85, 105] } }]); // Slate-100/600

                sec.items.forEach(item => {
                    const total = parseFloat(item.total) || 0;
                    const rate = parseFloat(item.rate) || 0;
                    const qty = parseFloat(item.quantity) || 0;

                    bodyRows.push([
                        item.description,
                        qty,
                        item.unit,
                        fmt(rate),
                        fmt(total)
                    ]);
                });

                // Section Footer
                bodyRows.push([{ content: `Total ${secName}: ${fmt(sec.total)}`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] } }]); // Blue-600
            });

            doc.autoTable({
                startY: finalY,
                head: [['Description', 'Qty', 'Unit', 'Rate', 'Total']],
                body: bodyRows,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 2 },
                headStyles: { fillColor: [51, 65, 85], textColor: 255 }, // Slate-700
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    1: { cellWidth: 15, halign: 'center' },
                    2: { cellWidth: 20, halign: 'center' },
                    3: { cellWidth: 30, halign: 'right' },
                    4: { cellWidth: 30, halign: 'right' }
                },
                margin: { left: 14, right: 14 },
                didDrawPage: function (data) {
                    // Footer
                    const str = "Page " + doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setTextColor(150);
                    const pageSize = doc.internal.pageSize;
                    const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                    doc.text(str, data.settings.margin.left, pageHeight - 10);
                    doc.text(`Generated by mooBudget v${APP_VERSION}`, pageSize.width - 14, pageHeight - 10, { align: 'right' });
                }
            });

            // --- 4. Output ---
            const filename = `${(budgetData.projectName || 'Budget').replace(/[^a-z0-9]/gi, '_')}.pdf`;
            doc.save(filename);
        },

        // --- NEW: Champion Layout Engine (Strict A4) ---
        championCallSheet: function (docData) {
            const d = docData || {};
            const meta = d.meta || {};
            const contacts = d.contacts || {};
            const schedule = d.schedule || [];
            const cast = d.cast || [];
            const crew = d.crew || [];
            const locs = d.locations || [];

            // Helper: Time Format
            const t = (val) => val || '--:--';

            // 1. CSS (The "Champion" Style Definition)
            const css = `
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&display=swap');
                        .cs-body { font-family: 'Roboto Condensed', sans-serif; font-size: 10pt; color: #000; background: #fff; width: 210mm; min-height: 297mm; padding: 10mm; box-sizing: border-box; position: relative; }
                        .cs-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px; }
                        .cs-title { font-size: 24pt; font-weight: bold; text-transform: uppercase; line-height: 0.9; }
                        .cs-meta { font-size: 9pt; text-align: right; }
                        
                        .cs-grid-3 { display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 10px; margin-bottom: 10px; font-size: 8pt; }
                        .cs-box { border: 1px solid #000; }
                        .cs-box-header { background: #000; color: #fff; font-weight: bold; padding: 2px 5px; text-transform: uppercase; font-size: 8pt; }
                        .cs-box-content { padding: 5px; }
                        
                        .cs-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9pt; }
                        .cs-table th { background: #000; color: #fff; font-weight: bold; text-transform: uppercase; padding: 4px; border: 1px solid #000; text-align: left; }
                        .cs-table td { border: 1px solid #000; padding: 4px; vertical-align: top; }
                        .cs-row-grey { background: #eee; }
                        
                        .cs-banner { background: #000; color: #fff; font-weight: bold; text-align: center; padding: 3px; text-transform: uppercase; margin-bottom: 5px; font-size: 10pt; }
                        
                        .cs-weather { display: flex; justify-content: space-between; font-size: 8pt; }
                        
                        /* Density Utils */
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .w-10 { width: 10%; }
                    </style>
                `;

            // 2. HTML Structure (Mapped to Data)
            const html = `
                    <div class="cs-body">
                        <!-- HEADER -->
                        <div class="cs-header">
                            <div>
                                <div class="cs-title">${mBT.ui.render.esc(meta.productionTitle || 'UNTITLED PROJECT')}</div>
                                <div style="font-weight:bold; font-size:12pt;">CALL SHEET</div>
                            </div>
                            <div class="cs-meta">
                                <div><strong>Date:</strong> ${meta.shootDate || 'TBD'}</div>
                                <div><strong>Crew Call:</strong> ${meta.crewCallTime || '07:00'}</div>
                                <div style="margin-top:5px; font-size:12pt; font-weight:bold;">${mBTDB.calcShootDay(meta.shootDate)}</div>
                            </div>
                        </div>

                        <!-- TOP INFO GRID -->
                        <div class="cs-grid-3">
                            <!-- Left: Production -->
                            <div class="cs-box">
                                <div class="cs-box-header">Production Office</div>
                                <div class="cs-box-content">
                                    <strong>Director:</strong> ${contacts.director || 'TBD'}<br>
                                    <strong>Producer:</strong> ${contacts.producer || 'TBD'}<br>
                                    <strong>1st AD:</strong> ${contacts.ad || 'TBD'}<br>
                                    <br>
                                    ${meta.productionCompany || 'Indie Prod'}
                                </div>
                            </div>
                            
                            <!-- Center: Locations -->
                            <div class="cs-box">
                                <div class="cs-box-header">Locations</div>
                                <div class="cs-box-content">
                                    ${locs.map((l, i) => `
                                        <div style="margin-bottom:5px;">
                                            <strong>LOC ${i + 1}:</strong> ${l.name}<br>
                                            ${l.address}<br>
                                            <em style="font-size:7pt">Nearest Hosp: ${l.hospital || 'Dial 911'}</em>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Right: Weather & Specs -->
                            <div class="cs-box">
                                <div class="cs-box-header">Conditions</div>
                                <div class="cs-box-content">
                                    <div class="cs-weather">
                                        <span>Sunrise: ${meta.sunriseSunset ? meta.sunriseSunset.split('/')[0] : '06:00'}</span>
                                        <span>Sunset: ${meta.sunriseSunset ? meta.sunriseSunset.split('/')[1] : '18:00'}</span>
                                    </div>
                                    <hr style="border:0; border-top:1px dashed #ccc; margin:4px 0;">
                                    ${locs[0] && locs[0].weather ? locs[0].weather : 'Sunny, 30°C'}
                                </div>
                            </div>
                        </div>

                        <!-- SHOOTING SCHEDULE -->
                        <div class="cs-banner">Shooting Schedule</div>
                        <table class="cs-table">
                            <thead>
                                <tr>
                                    <th style="width:10%">Time</th>
                                    <th style="width:8%">Scn</th>
                                    <th style="width:8%">I/E</th>
                                    <th>Description / Action</th>
                                    <th style="width:15%">Cast</th>
                                    <th style="width:15%">Location</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${schedule.map((row, i) => {
                const isMeal = row.type === 'meal';
                if (isMeal) return `<tr class="cs-row-grey"><td class="text-center font-bold">${t(row.time)}</td><td colspan="5" class="text-center font-bold uppercase">${row.description}</td></tr>`;
                return `
                                    <tr>
                                        <td class="text-center font-bold">${t(row.time)}</td>
                                        <td class="text-center">${row.scene || '-'}</td>
                                        <td class="text-center">${row.ie || '-'}</td>
                                        <td><strong>${row.description || ''}</strong><br><em style="font-size:8pt">${row.note || ''}</em></td>
                                        <td class="text-center">${row.cast || ''}</td>
                                        <td class="text-center">${row.loc || '1'}</td>
                                    </tr>`;
            }).join('')}
                            </tbody>
                        </table>

                        <!-- CAST LIST -->
                        <div class="cs-banner">Cast & Talent</div>
                        <table class="cs-table">
                            <thead>
                                <tr>
                                    <th>Character</th>
                                    <th>Artist</th>
                                    <th class="text-center">Pickup</th>
                                    <th class="text-center">H/MU</th>
                                    <th class="text-center">Costume</th>
                                    <th class="text-center">Set Call</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cast.map(c => `
                                    <tr>
                                        <td><strong>${c.character}</strong></td>
                                        <td>${c.actor}</td>
                                        <td class="text-center">${t(c.pickup)}</td>
                                        <td class="text-center">${t(c.hmu)}</td>
                                        <td class="text-center">${t(c.costume)}</td>
                                        <td class="text-center font-bold">${t(c.setCall)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <!-- FOOTER -->
                        <div style="position: absolute; bottom: 10mm; width: 100%; border-top: 1px solid #000; padding-top:5px; font-size:8pt; text-align:center;">
                            PRODUCED BY: ${meta.productionCompany || 'Indie Prod'} | RECYCLE BIN: Please destroy this document after use.
                        </div>
                    </div>
                `;

            // 3. Render
            const win = window.open('', '_blank');
            win.document.write('<html><head><title>Call Sheet</title>' + css + '</head><body>' + html + '</body></html>');
            win.document.close();
            setTimeout(() => win.print(), 500);
        },

        professionalXlsx: function (budgetData) {
            if (typeof XLSX === 'undefined') return mBTME.alert("Error", "Excel Engine missing.");

            // 1. Setup Workbook
            const wb = XLSX.utils.book_new();
            const wsData = [];

            // 2. Headers
            wsData.push(["PROJECT", budgetData.projectName]);
            wsData.push(["COMPANY", budgetData.company]);
            wsData.push(["DATE", new Date().toLocaleDateString()]);
            wsData.push([]); // Spacer

            // 3. Summary
            wsData.push(["SUMMARY", "AMOUNT"]);
            wsData.push(["Subtotal", budgetData.subtotal]);
            wsData.push(["Contingency", budgetData.subtotal * (budgetData.contingencyPercentage / 100)]);
            wsData.push(["Grand Total", budgetData.grandTotal]);
            wsData.push([]);

            // 4. Detail Table Headers
            wsData.push(["SECTION", "DESCRIPTION", "QUANTITY", "UNIT", "RATE", "ESTIMATED", "ACTUAL", "VARIANCE"]);

            // 5. Populate Data
            Object.entries(budgetData.sections).forEach(([key, sec]) => {
                // Section Header
                wsData.push([key.toUpperCase(), "", "", "", "", "", "", ""]);

                sec.items.forEach(item => {
                    const qty = parseFloat(item.quantity) || 0;
                    const rate = parseFloat(item.rate) || 0;
                    const est = qty * rate;
                    const act = parseFloat(item.actual) || 0;

                    wsData.push([
                        "",
                        item.description,
                        qty,
                        item.unit,
                        rate,
                        est, // Formula could go here but raw numbers are safer for broad compatibility
                        act,
                        act - est
                    ]);
                });
                // Section Footer spacer
                wsData.push([]);
            });

            // 6. Generate Sheet
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Set Column Widths
            ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

            XLSX.utils.book_append_sheet(wb, ws, "Budget");
            XLSX.writeFile(wb, `${(budgetData.projectName || 'budget').replace(/\s+/g, '_')}.xlsx`);
        },
    },

    // --- Bridge: Main Entry Points ---
    exportToPDF: function (id, name) { this.format.pdf(id, name); },
    toMoo: function () { this.io.saveMoo(budget); },

    // Logic Resolution: Adapter for Batch 4.1 Linearization (Standard vs Graphic)
    generateFastPreview: function (mode, data, cb) {
        const opts = (mode === 'standard') ? { linearize: true, bg: '#ffffff' } : {};
        this.format.jpeg('mBTDB_Workspace', cb, opts);
    },

    downloadJPEG: function (url, title) {
        const a = document.createElement('a'); a.href = url; a.download = `${title}.jpg`; a.click();
    }
};

/* ========= v19.54 mBTDB: STUDIO BUILDER ENGINE ========= */
window.mBTDB = {
    config: {
        paperSizes: {
            'us-letter': { label: 'Letter', width: '8.5in', height: '11in', cols: 48 },
            'a4': { label: 'A4', width: '210mm', height: '297mm', cols: 48 },
            'us-legal': { label: 'Legal', width: '8.5in', height: '14in', cols: 48 },
            'a3': { label: 'A3', width: '297mm', height: '420mm', cols: 60 },
            'strip-12': { label: 'Strip (12)', width: '14in', height: '8.5in', cols: 12 }
        }
    },
    state: { currentDocId: null, isEditing: false, grid: null, history: [], historyPointer: -1, _cache: null },

    // --- PERSISTENCE LAYER (Phase 1.2) ---
    _saveTimer: null,
    _debouncedSave: function () {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this._triggerSave();
            // Visual Feedback for Auto-Save
            const status = document.getElementById('statusBar');
            if (status) {
                // Subtle indicator
                const indicator = document.createElement('div');
                indicator.className = "fixed bottom-4 right-4 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg animate-pulse z-[1000] pointer-events-none";
                indicator.innerText = "Auto-Saved";
                document.body.appendChild(indicator);
                setTimeout(() => indicator.remove(), 2000);
            }
        }, 1500);
    },

    // --- LIVE SYNC ENGINE (Phase 9) ---
    resolveLinkedData: function (doc) {
        // Optimization: Return cached deeply-cloned data if available for this render cycle
        // This prevents expensive JSON operations on purely visual updates (like toggling Edit Mode)
        if (this.state._cache && this.state._cache.docId === doc.id) {
            return this.state._cache.data;
        }

        // Deep clone to prevent render-cycle mutations from polluting storage
        const data = JSON.parse(JSON.stringify(doc.content.data));

        if (!budget || !budget.sections) {
            // Cache even if no budget link exists
            this.state._cache = { docId: doc.id, data: data };
            return data;
        }

        // Fast Lookup Map
        const budgetMap = new Map();
        Object.values(budget.sections).forEach(sec => {
            sec.items.forEach(i => budgetMap.set(i.id, i));
        });

        // 1. Sync Lists (Crew, Cast)
        ['crew', 'cast'].forEach(key => {
            if (Array.isArray(data[key])) {
                data[key] = data[key].map(item => {
                    if (item.linkedItemId && budgetMap.has(item.linkedItemId)) {
                        const bItem = budgetMap.get(item.linkedItemId);
                        if (key === 'crew') {
                            item.name = bItem.crew?.name || bItem.description;
                            item.contact = bItem.crew?.phone || item.contact;
                            item.position = bItem.description;
                        } else if (key === 'cast') {
                            item.actor = bItem.crew?.name || item.actor;
                            item.contact = bItem.crew?.phone || item.contact;
                        }
                    }
                    return item;
                });
            }
        });

        // Store in cache
        this.state._cache = { docId: doc.id, data: data };
        return data;
    },

    // --- 1. Registry Resolution: Tier 1 Asset Map ---
    icons: {
        trash: mBTAssets.trash, plus: mBTAssets.plus, user: mBTAssets.user,
        cloud: mBTAssets.cloud, save: mBTAssets.save, undo: mBTAssets.undo,
        redo: mBTAssets.redo, copy: mBTAssets.copy, print: mBTAssets.print,
        close: mBTAssets.close, wand: mBTAssets.wand, grid: mBTAssets.grid,
        list: mBTAssets.list, image: mBTAssets.image
    },

    // Logic Resolution: Template Registry migrated to mBTOG (Open Gate)
    // We clear this local object to enforce the Single Source of Truth rule.
    templates: {},

    // --- 2. Portal Orchestration ---
    open: function (docId) {
        this.state.currentDocId = docId;
        const doc = budget.documents.find(d => d.id === docId);
        if (!doc) return;
        if (!doc.content) doc.content = { data: {}, widgets: [] };

        // Logic Resolution: Auto-Hydrate from Central Registry (Open Gate)
        if (!doc.content.widgets || doc.content.widgets.length === 0) {
            // Tier 2.5 Handshake: Pull blueprints from Open Gate
            const registry = (typeof mBTOG !== 'undefined' && mBTOG.templates) ? mBTOG.templates : [];
            let tmpl = registry.find(t => t.id === doc.type);

            // Fallback Heuristics for Legacy Types
            if (!tmpl) {
                if (['storyboard', 'budgetRep', 'vendorBid', 'riskAI', 'carbon', 'postSched'].includes(doc.type)) {
                    // Map legacy complex types to Script defaults if specific template missing
                    tmpl = registry.find(t => t.id === 'script');
                }
                // Ultimate Fallback
                if (!tmpl) tmpl = { widgets: [{ id: 'meta_header', x: 0, y: 0, w: 12, h: 2, type: 'header' }] };
            }

            doc.content.widgets = JSON.parse(JSON.stringify(tmpl.widgets));

            // Phase 1: Hard Save - Merge Template Defaults with System Defaults
            const sysDefaults = this._generateDefaultData();
            const tmplDefaults = tmpl.defaults || {};

            // Deep merge logic for defaults
            doc.content.data = JSON.parse(JSON.stringify(sysDefaults));

            if (tmplDefaults) {
                Object.keys(tmplDefaults).forEach(key => {
                    if (Array.isArray(tmplDefaults[key])) {
                        doc.content.data[key] = [...tmplDefaults[key]];
                    } else if (typeof tmplDefaults[key] === 'object' && tmplDefaults[key] !== null) {
                        doc.content.data[key] = { ...doc.content.data[key], ...tmplDefaults[key] };
                    } else {
                        doc.content.data[key] = tmplDefaults[key];
                    }
                });
            }
        }

        if (typeof mBTME !== 'undefined') {
            // Logic Resolution: Fixed ID string to match the close() function target
            mBTME.open('documentViewer', 'Document Studio', '<div id="mBTDB_Container"></div>', 'w-full h-full max-w-full', { noPadding: true, hideHeader: true });
            this.renderFrame();
        }
    },
    close: function () {
        if (this.state.isEditing) {
            this._saveLayoutState();
            this.state.isEditing = false;
        }
        if (typeof mBTME !== 'undefined') mBTME.close('documentViewerModal');
        document.body.classList.remove('print-mode');
        this.state.currentDocId = null;
        if (typeof mBTLE !== 'undefined') mBTLE.reconcile();
        if (typeof render === 'function') render();
    },

    toggleEditMode: function () {
        if (this.state.isEditing && this.state.grid) this._saveLayoutState();
        this.state.isEditing = !this.state.isEditing;
        const container = document.getElementById('mBTDB_Workspace');
        const grid = this.state.grid;
        if (container && grid) {
            if (this.state.isEditing) {
                container.classList.add('editing-mode');
                grid.setStatic(false);
            } else {
                container.classList.remove('editing-mode');
                grid.setStatic(true);
            }

            // CRITICAL FIX: Re-render UI to update 'disabled' state on inputs
            const doc = budget.documents.find(d => d.id === this.state.currentDocId);
            if (doc) {
                this._renderMetaHeader(doc);
                doc.content.widgets.forEach(w => {
                    const el = document.querySelector(`.grid-stack-item[gs-id="${w.id}"] .widget-body`);
                    if (el) el.innerHTML = this._getContentForWidget(w, doc);
                });
                // Re-init canvas logic for MudMaps after re-render
                this._initMudMaps();
            }

            this._updateHeaderButtons();
        }
    },
    _saveLayoutState: function () {
        if (!this.state.grid) return;
        const doc = budget.documents.find(d => d.id === this.state.currentDocId);
        this.state.grid.engine.nodes.forEach(node => {
            const widget = doc.content.widgets.find(w => w.id === node.id);
            if (widget) { widget.x = node.x; widget.y = node.y; widget.w = node.w; widget.h = node.h; }
        });
        this._triggerSave();
        mBT.data.save(); // Force disk commit
    },

    // --- 3. Publishing & Intelligence Hub ---
    openPreviewSelector: function () {
        const content = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-50">
                <button onclick="mBTME.close('previewSelectorModal'); mBTDB.previewDoc('standard')" class="flex flex-col items-center gap-4 p-6 bg-white border border-slate-200 rounded-3xl hover:border-blue-500 hover:shadow-xl transition-all group text-center w-full">
                    <div class="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        ${mBTAssets.file}
                    </div>
                    <div>
                        <h4 class="font-black text-xs uppercase tracking-widest text-slate-800">Industry Standard</h4>
                        <p class="text-[9px] text-slate-400 font-bold mt-1">Clean White • High Contrast</p>
                    </div>
                </button>

                <button onclick="mBTME.close('previewSelectorModal'); mBTDB.previewDoc('graphic')" class="flex flex-col items-center gap-4 p-6 bg-white border border-slate-200 rounded-3xl hover:border-purple-500 hover:shadow-xl transition-all group text-center w-full">
                    <div class="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        ${mBTAssets.image}
                    </div>
                    <div>
                        <h4 class="font-black text-xs uppercase tracking-widest text-slate-800">Graphic Layout</h4>
                        <p class="text-[9px] text-slate-400 font-bold mt-1">Workspace Grey • Original UI</p>
                    </div>
                </button>
            </div>`;

        mBTME.open('previewSelector', 'Capture Mode', content, 'max-w-lg', { noPadding: true });
    },

    previewDoc: function (mode) {
        const doc = budget.documents.find(d => d.id === this.state.currentDocId);
        if (!doc || typeof mBTPublisher === 'undefined') return;

        const workspace = document.getElementById('mBTDB_Workspace');
        if (!workspace) return;

        // Logic Resolution: For 'standard' mode, we temporarily strip the workspace grey 
        // to ensure a high-contrast white paper export.
        if (mode === 'standard') {
            workspace.classList.remove('bg-slate-200');
            workspace.classList.add('bg-white');
        }

        if (mBTME.showLoader) mBTME.showLoader(`Rendering ${mode === 'standard' ? 'Industry' : 'Graphic'} Preview...`);

        mBTPublisher.generateFastPreview(mode, doc.content.data, (jpegURL) => {
            // Restore visual separation state
            if (mode === 'standard') {
                workspace.classList.remove('bg-white');
                workspace.classList.add('bg-slate-200');
            }

            if (mBTME.hideLoader) mBTME.hideLoader();
            mBTME.open('previewModal', `Snapshot: ${mode.toUpperCase()}`,
                `<div class="flex flex-col items-center bg-slate-900 h-full p-8 overflow-auto no-scrollbar"><img src="${jpegURL}" id="finalPreviewImage" class="shadow-2xl border border-black max-w-full h-auto mb-24 bg-white rounded-sm"><div class="fixed bottom-10 left-1/2 -translate-x-1/2 flex gap-4 z-[10001]"><button onclick="mBTPublisher.downloadJPEG('${jpegURL}', '${doc.label}')" class="flex items-center gap-3 bg-blue-600 text-white px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-blue-500 transition-all active:scale-95">Download JPEG</button><button onclick="mBTDB.sendToDistribution('${jpegURL}')" class="flex items-center gap-3 bg-emerald-600 text-white px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-emerald-500 transition-all active:scale-95">Send to Crew</button><button onclick="mBTME.close('previewModal')" class="bg-white text-slate-900 px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-slate-100 transition-all">Close</button></div></div>`, 'w-full h-full');
        });
    },

    sendToDistribution: function (jpegURL) {
        const doc = budget.documents.find(d => d.id === this.state.currentDocId);
        // Logic Resolution: Close only the preview modal, keeping the Studio active
        mBTME.close('previewModal');
        if (window.openDocumentShareSelector) window.openDocumentShareSelector(doc.id);
        else mBTME.alert("Module Error", "Distribution Hub not active.");
    },

    // --- NEW: AI Hospital Lookup ---
    autoFillHospital: async function (docId, index, address) {
        if (!address) return;
        const provider = mBT.features.ai.getSelectedProvider();
        const apiKey = mBT.features.ai.getStoredApiKey(provider);
        if (!apiKey) return; // Silent skip if no AI

        const prompt = `Identify the nearest emergency hospital to this address: "${address}". Return ONLY the name of the hospital. Do not include address or other text.`;

        try {
            const result = await mBT.features.ai.callUnifiedAI(provider, apiKey, prompt);
            // Cleanup response
            const clean = result.replace(/Here is the.*?|The nearest.*?is/gi, '').replace(/[".]/g, '').trim();
            this.updateRow(docId, 'locations', index, 'hospital', clean);
        } catch (e) { console.warn("AI Hospital Lookup failed", e); }
    },

    /* --- [Feat16]. Mud Map Intelligence (Geocoding Engine) --- */
    getCoordinates: async function (query) {
        if (!query) return null;
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                return { lat: data.results[0].latitude, lon: data.results[0].longitude };
            }
        } catch (e) { console.error("Geocoding failed", e); }
        return null;
    },

    /* --- [Feat16]. Mud Map Intelligence (Slate Generator) --- */
    loadMapBackground: async function (widgetId, docId) {
        const doc = budget.documents.find(d => d.id === docId);
        if (!doc) return;

        // 1. Find Context (First Location)
        const loc = doc.content.data.locations?.[0];
        const query = loc ? (loc.address || loc.name) : "";

        if (!query) return mBTME.alert("Map Error", "No location address found in Logistics.");

        mBTME.showLoader("Locating Site...");

        // 2. Geocode (Using logic from Batch 2.1)
        const coords = await this.getCoordinates(query);
        mBTME.hideLoader();

        if (!coords) return mBTME.alert("Not Found", "Could not locate address.");

        // 3. Generate Site Slate (Canvas Ops)
        const cvs = document.getElementById(`canvas_${widgetId}`);
        if (cvs) {
            const ctx = cvs.getContext('2d');
            const w = cvs.width;
            const h = cvs.height;

            // A. Background & Grid
            ctx.fillStyle = "#f8fafc"; // Slate-50
            ctx.fillRect(0, 0, w, h);

            ctx.strokeStyle = "#e2e8f0"; // Slate-200
            ctx.lineWidth = 1;
            for (let x = 20; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
            for (let y = 20; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

            // B. Header Block
            ctx.fillStyle = "#0f172a"; // Slate-900
            ctx.fillRect(0, 0, w, 60);

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 14px 'Arial', sans-serif";
            ctx.fillText("SITE PLAN / MUD MAP", 15, 25);

            ctx.font = "10px 'Arial', sans-serif";
            ctx.fillStyle = "#94a3b8";
            ctx.fillText(`LOC: ${loc.name.toUpperCase()}`, 15, 45);

            // C. GPS Watermark
            ctx.fillStyle = "#475569";
            ctx.font = "bold 12px 'Courier New', monospace";
            ctx.fillText(`ADDR: ${query}`, 15, 80);
            ctx.fillText(`GPS:  ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`, 15, 95);

            // D. Compass Icon
            ctx.strokeStyle = "#cbd5e1";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(w - 40, 90, 20, 0, 2 * Math.PI);
            ctx.stroke();

            ctx.fillStyle = "#64748b";
            ctx.font = "bold 12px Arial";
            ctx.fillText("N", w - 44, 94);

            // 4. Save to State (Persist as Image Data)
            this.updateData(docId, `additional.${widgetId}`, cvs.toDataURL());
        }
    },

    autoFillWidget: function (type, docId) {
        mBTME.confirm("Auto-Fill", `Auto-fill ${type}? This uses external services and AI.`, async () => {
            const doc = budget.documents.find(d => d.id === docId);
            if (!doc) return;

            if (type === 'contacts') {
                const map = { 'director': 'Director', 'producer': 'Producer', 'ad': '1st AD' };
                Object.entries(map).forEach(([key, role]) => {
                    let hit = null;
                    if (budget.sections) Object.values(budget.sections).some(s => {
                        const i = s.items.find(x => x.description.toLowerCase().includes(role.toLowerCase()) && x.crew && x.crew.name);
                        if (i) { hit = { name: i.crew.name, contact: i.crew.phone || i.crew.email }; return true; }
                    });
                    if (!hit) {
                        const g = mBTOG.contacts.find(x => x.role && x.role.toLowerCase().includes(role.toLowerCase()));
                        if (g) hit = { name: g.name, contact: g.contact || g.phone };
                    }
                    if (hit) this.updateData(docId, `contacts.${key}`, `${hit.name} ${hit.contact || ''}`);
                });
            } else if (type === 'crew') {
                Object.values(budget.sections).forEach(sec => sec.items.forEach(i => {
                    if (i.crew && i.crew.name) {
                        const exists = doc.content.data.crew.some(c => c.name === i.crew.name && c.department === i.description);
                        if (!exists) {
                            this.addRow(docId, 'crew', 'person', { department: i.description, name: i.crew.name, contact: i.crew.phone, linkedItemId: i.id });
                        }
                    }
                }));
            }
            // --- NEW: Logistics / Locations Support ---
            else if (type === 'logistics' || type === 'locations') {
                const locs = doc.content.data.locations || [];
                mBTME.showLoader("Scanning Locations...");

                // Serial execution to prevent rate limiting
                for (let i = 0; i < locs.length; i++) {
                    const l = locs[i];
                    // 1. Weather & Sun (Open-Meteo Service)
                    if (l.name) await this.autoFillWeather(docId, i, l.name);

                    // 2. Hospital (AI Analysis) - Only if address exists and hospital field is empty
                    if (l.address && !l.hospital) await this.autoFillHospital(docId, i, l.address);
                }
                mBTME.hideLoader();
            }

            // Logic Resolution: Use Surgical DOM Update instead of full RenderFrame() to preserve layout
            const widget = doc.content.widgets.find(w => w.type === type);
            if (widget) {
                const content = this._getContentForWidget(widget, doc);
                const el = document.querySelector(`.grid-stack-item[gs-id="${widget.id}"] .widget-body`);
                if (el) el.innerHTML = content;
                // Update Header Sun/Moon if modified
                if (type === 'logistics' || type === 'locations') this._renderMetaHeader(doc);
            } else {
                this.renderFrame();
            }
        });
    },

    assistantFill: async function (widgetId, docId) {
        const doc = budget.documents.find(d => d.id === docId);
        if (!doc) return;

        const widget = doc.content.widgets.find(w => w.id === widgetId);
        if (!widget) return;

        const provider = mBT.features.ai.getSelectedProvider();
        const apiKey = mBT.features.ai.getStoredApiKey(provider);

        if (!apiKey) return mBTME.alert("Assistant Offline", "Please configure API Key in settings to use Assistant Fill.");

        // --- HYBRID ROUTER (Batch 3.1) ---
        const currentVal = doc.content.data.additional?.[widgetId] || "";
        const isScript = (doc.type === 'script' || widget.label.toLowerCase().includes('script')) && widget.type === 'richText';

        // ROUTE 1: SCRIPT PARSING (Structure Extraction)
        // Trigger: Script document + RichText widget + Content > 50 chars
        if (isScript && currentVal.length > 50) {
            mBTME.confirm("Script Analysis", "Analyze script text to extract Scenes and Cast data?", async () => {
                mBTME.showLoader("Analyzing Screenplay...");
                const prompt = `Analyze this screenplay text. Return valid JSON only. No markdown. 
                Structure: { "scenes": ["INT. LOCATION - DAY", ...], "cast": ["CHARACTER NAME", ...] }. 
                Text: \n\n ${currentVal.substring(0, 15000)}`;

                try {
                    const result = await mBT.features.ai.callUnifiedAI(provider, apiKey, prompt, "ROLE: Data Parser. OUTPUT: Pure JSON. No chat.");
                    // Sanitize AI output (strip markdown code blocks)
                    const jsonStr = result.replace(/^```json\n?|```$/g, '').trim();
                    const data = JSON.parse(jsonStr);

                    let report = `Extracted ${data.scenes?.length || 0} Scenes and ${data.cast?.length || 0} Characters.\n`;
                    let updates = 0;

                    // 1. Sync Schedule (Scenes)
                    if (data.scenes && Array.isArray(data.scenes)) {
                        if (!doc.content.data.schedule) doc.content.data.schedule = [];
                        data.scenes.forEach(sc => {
                            // Dedupe: Check if description matches
                            if (!doc.content.data.schedule.some(s => s.description === sc)) {
                                const parts = sc.split('-');
                                const loc = parts[0] ? parts[0].replace(/INT\.|EXT\./i, '').trim() : '';

                                mBTDB.addRow(docId, 'schedule', 'shot', {
                                    id: Date.now() + Math.random(),
                                    description: sc,
                                    scene: (doc.content.data.schedule.length + 1).toString(),
                                    time: "00:00",
                                    ie: sc.toUpperCase().includes("INT") ? "INT" : "EXT",
                                    loc: loc,
                                    cast: ""
                                });
                                updates++;
                            }
                        });
                    }

                    // 2. Sync Cast (Characters)
                    if (data.cast && Array.isArray(data.cast)) {
                        if (!doc.content.data.cast) doc.content.data.cast = [];
                        data.cast.forEach(c => {
                            if (!doc.content.data.cast.some(existing => existing.character === c)) {
                                mBTDB.addRow(docId, 'cast', 'talent', {
                                    id: Date.now() + Math.random(),
                                    character: c,
                                    actor: "", swf: "W", pickup: "", hmu: "", setCall: "", costume: ""
                                });
                                updates++;
                            }
                        });
                    }

                    mBTME.hideLoader();
                    if (updates > 0) {
                        mBTDB.renderFrame(); // Refresh UI to show new rows
                        mBTME.alert("Analysis Complete", report + `\n${updates} items added to lists.`);
                    }
                    else mBTME.alert("Analysis Complete", "No new items found to add.");

                } catch (e) {
                    mBTME.hideLoader();
                    mBTME.alert("Parsing Error", "AI response could not be mapped to data structure.");
                    console.error(e);
                }
            });
            return;
        }

        // ROUTE 2: CONTENT GENERATION (Creative)
        mBTME.showLoader("Generating Content...");
        let prompt = "";

        if (widget.type === 'footer') {
            // Safety Footer Specific Logic
            const locSetting = (typeof mBTOG !== 'undefined' && mBTOG.settings) ? mBTOG.settings.location : 'Jamaica';
            const prodAddr = doc.content.data.production?.address || "";
            const locationContext = prodAddr.length > 5 ? `Production Address: ${prodAddr}` : `Jurisdiction: ${locSetting}`;

            prompt = `Generate a professional film production call sheet footer. 
             CONTEXT: ${locationContext}. 
             REQUIREMENTS: 
             1. Include a Health & Safety Disclaimer referencing specific local acts (e.g., "Health and Safety at Work Act 1974" for UK, "Factories Act" for Jamaica, "OSHA" for USA). Pick the one matching the context.
             2. Include a strict Anti-Harassment/Bullying Policy statement with a placeholder for a contact number.
             3. Keep it concise, serious, legalistic, and formatted as a compact block. No markdown, just text.`;
        } else if (isScript) {
            // Empty Script Generation
            prompt = `Write a sample screenplay scene for a film titled "${budget.projectName}". Format: Standard Screenplay format (Scene Heading, Action, Character, Dialogue). Keep it short (1 page).`;
        } else {
            // General Logic
            prompt = `Generate content for a section labeled "${widget.label}" for a film production named "${budget.projectName}" (${doc.label}). Context: Film Production. Keep it professional and concise.`;
        }

        try {
            const result = await mBT.features.ai.callUnifiedAI(provider, apiKey, prompt);

            // Logic Resolution: Sanitize output (remove markdown code fences if AI adds them)
            const cleanResult = result.replace(/^```[a-z]*\n|```$/g, '').trim();

            this.updateData(docId, `additional.${widgetId}`, cleanResult);
            mBTME.hideLoader();

            // Surgical update to avoid grid flicker
            const el = document.querySelector(`.grid-stack-item[gs-id="${widgetId}"] .widget-body textarea`);
            if (el) el.value = cleanResult;
            else this.renderFrame(); // Fallback if DOM lost

        } catch (e) {
            mBTME.hideLoader();
            mBTME.alert("Generation Failed", e.message);
        }
    },

    autoFillWeather: async function (docId, index, name) {
        const btn = document.getElementById(`w-btn-${index}`);
        if (btn) btn.innerHTML = `<span class="animate-spin inline-block">...</span>`;
        try {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
            const geo = await geoRes.json();
            if (!geo.results) throw new Error("Location not found");
            const { latitude, longitude } = geo.results[0];
            const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`);
            const wData = await wRes.json();
            const today = wData.daily;
            const code = today.weather_code[0];
            let summary = "Clear Skies"; if (code > 3) summary = "Cloudy"; if (code > 50) summary = "Rainy";

            const sunrise = today.sunrise[0].split('T')[1];
            const sunset = today.sunset[0].split('T')[1];

            const str = `${summary} | Max: ${today.temperature_2m_max[0]}°C / Min: ${today.temperature_2m_min[0]}°C\nSunrise: ${sunrise} / Sunset: ${sunset}`;

            // Logic Fix: Sync Sunrise/Sunset to Header
            this.updateData(docId, 'meta.sunriseSunset', `${sunrise}/${sunset}`);
            this.updateRow(docId, 'locations', index, 'weather', str);

            this.renderFrame();
        } catch (e) { mBTME.alert("Sync Error", "Weather Synchronization Failure"); if (btn) btn.innerHTML = this.icons.cloud; }
    },

    // --- NEW: Header Sync Logic ---
    syncProductionInfo: function (docId) {
        // 1. Search Open Gate for "Production Office" contact
        const contact = mBTOG.contacts.find(c => c.name.toLowerCase().includes('production office'));

        if (contact) {
            const data = {
                address: contact.address || '',
                phone: contact.phone || '',
                email: contact.email || '',
                wifi: contact.wifi || '',
                pass: contact.pass || ''
            };

            // Batch update manually to avoid multiple re-renders
            const doc = budget.documents.find(d => d.id === docId);
            if (doc) {
                if (!doc.content.data.production) doc.content.data.production = {};
                Object.assign(doc.content.data.production, data);
                this._triggerSave();
                this.renderFrame();
                mBTME.alert("Synced", "Production Office details updated from Open Gate.");
            }
        } else {
            // Fallback: Use Budget Company Name
            this.updateData(docId, 'production.address', budget.company || '');
            mBTME.alert("Partial Sync", "No 'Production Office' contact found in Open Gate. Synced Company Name.");
        }
    },

    syncAgencyInfo: function (docId) {
        // Search Open Gate for Agency roles
        const producer = mBTOG.contacts.find(c => c.role && (c.role.toLowerCase().includes('agency producer') || c.role.toLowerCase().includes('client')));
        const creative = mBTOG.contacts.find(c => c.role && (c.role.toLowerCase().includes('creative') || c.role.toLowerCase().includes('director')));

        let updates = 0;
        if (producer) { this.updateData(docId, 'agency.producer', producer.name); updates++; }
        if (creative) { this.updateData(docId, 'agency.creative', creative.name); updates++; }

        if (updates > 0) this.renderFrame();
        else mBTME.alert("No Matches", "No contacts with 'Agency' or 'Client' roles found.");
    },

    // --- 4. Render Engine Handshake ---
    renderFrame: function () {
        const doc = budget.documents.find(d => d.id === this.state.currentDocId);
        const container = document.getElementById('mBTDB_Container');
        if (!container) return;

        // Standardized Studio Actions
        const actions = [
            { icon: mBTAssets.sync, title: "Sync Budget", onClick: "mBTDB.syncFromBudget()", color: "emerald" },
            { icon: mBTAssets.refresh, title: "Sync Previous", onClick: "mBTDB.syncFromPrevious()", color: "blue" },
            { icon: mBTAssets.image, title: "Preview", onClick: "mBTDB.previewDoc('standard')", color: "purple" },
            { icon: mBTAssets.close, title: "Close", onClick: "mBTDB.close()", color: "rose" }
        ];

        // --- NEW: Paper Protocol Structure ---
        const contentHtml = `
            <div class="sheet-workspace" id="mBTDB_ScrollArea">
                <div class="sheet-a4 cs-theme" id="mBTDB_Paper">
                    <!-- Embedded Header (Part of the Page) -->
                    <div id="mBTDB_MetaArea" class="mb-4"></div>
                    <!-- The Grid (Flexible Content) -->
                    <div class="grid-stack flex-grow"></div>
                    <!-- Footer Branding -->
                    <div class="mt-auto pt-4 border-t-2 border-slate-700 flex justify-between text-[8px] font-bold uppercase tracking-widest text-slate-500">
                        <span>${budget.company || 'Production Office'}</span>
                        <span>Generated by mooBudget</span>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = RenderEngine.layouts.assistantPanel({
            title: `Assistant: ${doc.label}`,
            searchId: 'mBTDB_Search',
            searchPlaceholder: 'SEARCH DOCUMENT...',
            contentId: 'mBTDB_Workspace',
            contentHtml: contentHtml,
            actions: actions,
            toolbarId: 'mBTDB_Buttons',
            containerClasses: 'p-0 overflow-hidden !bg-[#0f172a]' // Logic Resolution: Force Deep Slate Background
        });

        this._renderMetaHeader(doc);
        setTimeout(() => {
            if (typeof GridStack === 'undefined') return console.error("GridStack resolution failure.");
            const wrapper = document.getElementById('mBTDB_Workspace');
            // Re-apply editing class if state persisted
            if (this.state.isEditing) wrapper.classList.add('editing-mode');

            // Batch 2.1: Grid Physics Refinement
            // Reduced cellHeight (30px) for granular text matching. Increased margin for visual breathing room.
            this.state.grid = GridStack.init({
                column: 12,
                cellHeight: 30,
                minRow: 1,
                margin: 5,
                animate: true,
                float: false, // Gravity Enabled (Widgets snap up)
                resizable: { handles: 'n,e,s,w,ne,se,sw,nw' },
                staticGrid: !this.state.isEditing
            }, wrapper.querySelector('.grid-stack'));

            this._loadWidgetsToGrid(doc);
            this._updateHeaderButtons();
            this.state.grid.on('change', () => this._triggerSave());
            this._initMudMaps(); // Initialize canvases
        }, 50);
    },

    _loadWidgetsToGrid: function (doc) {
        const grid = this.state.grid; grid.removeAll(); grid.batchUpdate();
        doc.content.widgets.forEach(w => { if (w.type === 'header') return; grid.addWidget({ x: w.x, y: w.y, w: w.w, h: w.h, content: this._generateWidgetHTML(w, doc), id: w.id }); });
        grid.commit();
    },
    _generateWidgetHTML: function (widget, doc) {
        const cleanTitle = widget.label || (widget.type.charAt(0).toUpperCase() + widget.type.slice(1));

        let tools = '';
        if (widget.type === 'contacts') {
            tools += `<button type="button" aria-label="Toggle View" data-action="widget-toggle-view" data-id="${widget.id}" class="p-1 rounded transition-colors">${widget.vertical ? this.icons.grid : this.icons.list}</button>`;
        }
        if (widget.type !== 'image') {
            // Logic Resolution: Enable AI Wand for text-heavy or structural widgets (Hybrid Router)
            // Added 'footer' to enable Safety Logic and 'script' awareness for the Parser
            const isAssistantEnabled = ['richText', 'treatment', 'breakdown', 'footer', 'script'].includes(widget.type) || ['script', 'screenplay'].some(s => (widget.label || '').toLowerCase().includes(s));
            const action = isAssistantEnabled ? 'widget-assistant-fill' : 'widget-autofill';
            const title = isAssistantEnabled ? 'AI Generate / Parse' : 'Auto-Fill';
            tools += `<button type="button" aria-label="${title}" data-action="${action}" data-type="${widget.type}" data-doc-id="${doc.id}" data-id="${widget.id}" class="p-1 rounded transition-all" title="${title}">${this.icons.wand}</button>`;
        }

        return `<div class="grid-stack-item-content group">
            <div class="widget-header flex justify-between items-center">
                <input value="${cleanTitle}" onchange="mBTDB.updateWidgetLabel('${doc.id}', '${widget.id}', this.value)" class="bg-transparent border-none w-48 outline-none transition-colors">
                <div class="widget-tools flex items-center gap-1">
                    ${tools}
                    <button type="button" aria-label="Delete Widget" data-action="widget-delete" data-id="${widget.id}" class="p-1 rounded transition-colors">${this.icons.trash}</button>
                </div>
            </div>
            <div class="widget-body flex-grow overflow-y-auto no-scrollbar relative text-slate-800 h-full bg-white">${this._getContentForWidget(widget, doc)}</div>
        </div>`;
    },
    _getContentForWidget: function (widget, doc) {
        const data = this.resolveLinkedData(doc); // LIVE SYNC (Phase 9)        
        if (widget.type === 'contacts') return this._renderContacts(doc.id, data, widget);
        if (['logistics', 'locations'].includes(widget.type)) return this._renderLogistics(doc.id, data);
        if (widget.type === 'schedule') return this._renderSchedule(doc.id, data);
        if (widget.type === 'crew') return this._renderCrew(doc.id, data);
        if (widget.type === 'cast') return this._renderTalent(doc.id, data);
        if (widget.type === 'richText') return this._renderRichText(doc.id, widget.id, data);
        if (widget.type === 'image') return this._renderImage(doc.id, widget.id, data);
        // --- Batch 2: Logistics Routing ---
        if (widget.type === 'transport') return this._renderTransport(doc.id, data);
        if (widget.type === 'mudmap') return this._renderMudMap(doc.id, widget.id, data);
        if (widget.type === 'footer') return this._renderFooter(doc.id, widget.id, data);
        return '';
    },

    // --- Helper: Open Contact from Name ---
    openContactByName: function (name) {
        if (!name) return;
        // Logic Resolution: Clean name by removing parenthetical contact info often added by the system
        const rawName = name.split('(')[0].trim();
        const cleanName = rawName.toLowerCase();

        // 1. Search Active Budget Line Items First (Priority Scan)
        let foundInBudget = null;
        let sectionKey = null;

        if (budget && budget.sections) {
            Object.entries(budget.sections).some(([secName, sec]) => {
                const item = sec.items.find(i =>
                    i.crew &&
                    i.crew.name &&
                    (i.crew.name.toLowerCase() === cleanName ||
                        i.crew.name.toLowerCase().includes(cleanName) ||
                        cleanName.includes(i.crew.name.toLowerCase()))
                );
                if (item) {
                    foundInBudget = item;
                    sectionKey = secName;
                    return true;
                }
                return false;
            });
        }

        if (foundInBudget) {
            openCrewProfile(null, null, foundInBudget.id, sectionKey);
            return;
        }

        // 2. Fallback to Global Open Gate Database
        const contact = mBTOG.contacts.find(c => c.name.toLowerCase().includes(cleanName) || cleanName.includes(c.name.toLowerCase()));

        if (contact) {
            openCrewProfile(null, null, contact.id, null);
        } else {
            mBTME.confirm("Contact Not Found", `Create a new profile for "${rawName}"?`, () => {
                const dummyId = 'dummy_new_contact_' + Date.now();
                openCrewProfile(null, null, dummyId, null);
                setTimeout(() => {
                    const nameInput = document.getElementById('crewName');
                    if (nameInput) nameInput.value = rawName;
                }, 100);
            });
        }
    },

    _renderMetaHeader: function (doc) {
        const d = doc.content.data;
        const lock = this.state.isEditing ? '' : 'disabled';
        const is24h = d.meta.is24h || false;

        // Ensure agency object exists
        if (!d.agency) d.agency = {};
        if (!d.production) d.production = { address: '', phone: '', email: '', wifi: '', pass: '' }; // New Prod Office Data

        // Champion Layout Masthead (3-Column Grid)
        const html = `
        <div class="flex justify-between items-end border-b-4 border-black pb-2 mb-2">
            <input ${lock} value="${d.meta.productionTitle || 'UNTITLED PROJECT'}" onchange="mBTDB.updateData('${doc.id}', 'meta.productionTitle', this.value)" class="text-4xl font-black uppercase w-full outline-none leading-none tracking-tighter" placeholder="TITLE">
            <div class="text-right shrink-0">
                <div class="text-2xl font-black">CALL SHEET</div>
                <div class="flex gap-4 text-xs font-bold mt-1">
                    <div>DATE: <input type="date" value="${d.meta.shootDate}" onchange="mBTDB.updateData('${doc.id}', 'meta.shootDate', this.value); mBTDB.renderFrame();" class="inline-block w-auto border-b border-slate-300"></div>
                    <div>CALL: <input type="time" value="${d.meta.crewCallTime}" onchange="mBTDB.updateData('${doc.id}', 'meta.crewCallTime', this.value)" class="inline-block w-24 text-center border-b border-slate-300"></div>
                    <div class="flex items-center gap-1.5 ${this.state.isEditing ? '' : 'hidden'}"><input type="checkbox" ${is24h ? 'checked' : ''} onchange="mBTDB.updateData('${doc.id}', 'meta.is24h', this.checked); mBTDB.renderFrame();" class="w-3 h-3 cursor-pointer"> 24h</div>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-3 gap-2 mb-4 text-[10px]">
            <!-- Left: Production Office (Address & Logistics) -->
            <div class="cs-box p-2 flex flex-col h-full">
                <div class="font-bold border-b border-black mb-1 flex justify-between">
                    <span>PRODUCTION OFFICE</span>
                    <span>${this.icons.mapPin}</span>
                </div>
                <div class="flex-grow space-y-1">
                    <textarea ${lock} onchange="mBTDB.updateData('${doc.id}','production.address',this.value)" class="w-full resize-none h-8 leading-tight font-bold" placeholder="Office Address...">${d.production.address || ''}</textarea>
                    <div class="grid grid-cols-[auto_1fr] gap-x-2 items-center">
                        <span class="font-bold">PH:</span> <input ${lock} value="${d.production.phone || ''}" onchange="mBTDB.updateData('${doc.id}','production.phone',this.value)" class="w-full" placeholder="Office Phone">
                        <span class="font-bold">EMAIL:</span> <input ${lock} value="${d.production.email || ''}" onchange="mBTDB.updateData('${doc.id}','production.email',this.value)" class="w-full" placeholder="production@email.com">
                    </div>
                    <div class="flex gap-2 pt-1 border-t border-slate-100 mt-1">
                        <div class="flex-1"><span class="font-bold">WIFI:</span> <input ${lock} value="${d.production.wifi || ''}" onchange="mBTDB.updateData('${doc.id}','production.wifi',this.value)" class="w-16" placeholder="Network"></div>
                        <div class="flex-1"><span class="font-bold">PASS:</span> <input ${lock} value="${d.production.pass || ''}" onchange="mBTDB.updateData('${doc.id}','production.pass',this.value)" class="w-16" placeholder="Password"></div>
                    </div>
                </div>
            </div>
            
            <!-- Center: Locations -->
            <div class="cs-box p-2">
                <div class="font-bold border-b border-black mb-1">LOCATIONS</div>
                ${(d.locations || []).map((l, i) => `
                    <div class="mb-2">
                        <div class="flex justify-between"><span class="font-bold">                             <span class="opacity-50">HOSP:</span>
                             <input ${lock} value="${l.hospital || ''}" onchange="mBTDB.updateRow('${doc.id}','locations',${i},'hospital',this.value)" class="w-full bg-transparent border-b border-red-100 focus:border-red-500 text-red-600" placeholder="Nearest Hospital...">
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Right: Agency & Weather -->
            <div class="cs-box p-2 flex flex-col h-full">
                <!-- Agency Block -->
                <div class="font-bold border-b border-black mb-1 flex justify-between items-center cursor-pointer hover:bg-slate-50" onclick="if(!event.target.closest('button')) { const b=this.nextElementSibling; b.classList.toggle('hidden'); }">
                    <span>AGENCY / CLIENT</span> 
                    <div class="flex gap-2">
                        <button onclick="mBTDB.syncAgencyInfo('${doc.id}')" class="text-slate-400 hover:text-blue-600 transition-colors" title="Sync from Database">${this.icons.sync}</button>
                        <span class="text-[8px] text-slate-400">▼</span>
                    </div>
                </div>
                <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 items-center mb-2 hidden">
                    <span class="font-bold">PRODUCER:</span>
                    <div class="flex items-center gap-1">
                        <input ${lock} value="${d.agency.producer || ''}" onchange="mBTDB.updateData('${doc.id}','agency.producer',this.value)" class="w-full" placeholder="Name">
                        ${d.agency.producer ? `<button onclick="mBTDB.openContactByName('${d.agency.producer}')" class="text-blue-600 hover:scale-110 transition-transform">${this.icons.user}</button>` : ''}
                    </div>
                    <span class="font-bold">CREATIVE:</span>
                    <div class="flex items-center gap-1">
                        <input ${lock} value="${d.agency.creative || ''}" onchange="mBTDB.updateData('${doc.id}','agency.creative',this.value)" class="w-full" placeholder="Name">
                        ${d.agency.creative ? `<button onclick="mBTDB.openContactByName('${d.agency.creative}')" class="text-blue-600 hover:scale-110 transition-transform">${this.icons.user}</button>` : ''}
                    </div>
                </div>

                <div class="font-bold border-b border-black mb-1 mt-auto">CONDITIONS</div>
                <div class="flex justify-between mb-1">
                    <span>Sunrise: <input ${lock} value="${d.meta.sunriseSunset?.split('/')[0] || ''}" class="w-12 text-center border-b border-slate-200"></span>
                    <span>Sunset: <input ${lock} value="${d.meta.sunriseSunset?.split('/')[1] || ''}" class="w-12 text-center border-b border-slate-200"></span>
                </div>
                <textarea ${lock} class="w-full h-8 resize-none" placeholder="Weather forecast...">${d.locations?.[0]?.weather || ''}</textarea>
            </div>
        </div>`;

        const container = document.getElementById('mBTDB_MetaArea'); if (container) container.innerHTML = html;
    },

    _renderContacts: function (docId, d, widget) {
        const lock = this.state.isEditing ? '' : 'disabled';
        const hideTool = this.state.isEditing ? '' : 'hidden';

        // Data Migration: Permanent Fix for Legacy Objects to Arrays
        if (!Array.isArray(d.contacts)) {
            const newArray = [
                { role: 'DIRECTOR', name: d.contacts.director || '' },
                { role: 'PRODUCER', name: d.contacts.producer || '' },
                { role: '1ST AD', name: d.contacts.ad || '' }
            ];
            // Persist migration immediately so Add/Delete works
            setTimeout(() => mBTDB.updateData(docId, 'contacts', newArray), 0);
            d.contacts = newArray;
        }

        const renderRow = (c, i) => {
            return `
            <div class="flex flex-col border-b border-slate-100 pb-1 mb-1 last:border-0 group/row">
                <!-- Role Header -->
                <input ${lock} value="${c.role || ''}" onchange="mBTDB.updateRow('${docId}','contacts',${i},'role',this.value)" class="text-[7px] font-black uppercase tracking-widest text-slate-400 bg-transparent border-none p-0 w-full outline-none mb-0.5 focus:text-blue-600 transition-colors" placeholder="ROLE">
                
                <!-- Name Row -->
                <div class="flex items-center gap-2">
                    <!-- Import Button (Left) -->
                    ${this.state.isEditing ? `
                    <button class="text-slate-300 hover:text-blue-500 transition-colors shrink-0" onclick="mBTDB.pullFromOpenGate('${docId}', 'contacts.${i}.name', '${c.role || 'crew'}')" title="Import from DB">
                        ${this.icons.user}
                    </button>` : ''}
                    
                    <!-- Name Input -->
                    <input ${lock} value="${c.name || ''}" onchange="mBTDB.updateRow('${docId}','contacts',${i},'name',this.value)" class="flex-grow bg-transparent border-none p-0 text-[10px] font-bold text-slate-900 outline-none placeholder-slate-300" placeholder="Name...">
                    
                    <!-- Delete Button (Right) -->
                    <button onclick="mBTDB.deleteRow('${docId}','contacts',${i},'contacts')" class="text-slate-200 hover:text-red-500 transition-colors shrink-0 ${hideTool}" title="Remove Contact">
                        ${this.icons.trash}
                    </button>
                </div>
            </div>`;
        };

        return `
        <div class="h-full flex flex-col cs-box border-none">
            <div class="flex-grow overflow-y-auto p-2 no-scrollbar bg-white widget-list-grid">
                ${d.contacts.map((c, i) => renderRow(c, i)).join('')}
            </div>
            <div class="p-2 border-t border-black bg-slate-50 ${hideTool}">
                <button onclick="mBTDB.addRow('${docId}','contacts','contact')" class="w-full bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100">+ Add Contact</button>
            </div>
        </div>`;
    },

    _renderLogistics: function (docId, d) {
        const lock = this.state.isEditing ? '' : 'disabled';
        const hideTool = this.state.isEditing ? '' : 'hidden';

        // Parse Sun Data for Display
        const sunRaw = d.meta.sunriseSunset || '/';
        const [sunrise, sunset] = sunRaw.split('/');

        return `<div class="flex flex-col h-full">
            <!-- Compact Sun Header (Horizontal) -->
            <div class="px-2 py-1 border-b border-black flex justify-center items-center gap-4 bg-slate-50">
                <div class="flex items-center gap-1">
                    <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">SUN</span>
                    <input type="text" ${lock} value="${sunrise || ''}" onchange="mBTDB.formatTime(this, '${docId}'); const current = '${sunRaw}'.split('/'); current[0]=this.value; mBTDB.updateData('${docId}','meta.sunriseSunset',current.join('/'))" class="bg-transparent text-[10px] font-bold w-16 text-center outline-none disabled:text-slate-800" placeholder="06:00">
                </div>
                <div class="flex items-center gap-1">
                    <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">SET</span>
                    <input type="text" ${lock} value="${sunset || ''}" onchange="mBTDB.formatTime(this, '${docId}'); const current = '${sunRaw}'.split('/'); current[1]=this.value; mBTDB.updateData('${docId}','meta.sunriseSunset',current.join('/'))" class="bg-transparent text-[10px] font-bold w-16 text-center outline-none disabled:text-slate-800" placeholder="18:00">
                </div>
            </div>
            
            <div class="flex-grow overflow-y-auto p-2 space-y-3 no-scrollbar widget-list-grid">${(d.locations || []).map((l, i) => `<div class="flex flex-col gap-1 border-b-2 border-black pb-2 mb-1 relative group/loc">
            
            <!-- Row 1: Name and Time (Refined Font Size & Width) -->
            <div class="flex justify-between items-end gap-2 mb-1">
                <div class="flex-grow">
                    <label class="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">LOCATION ${i + 1}</label>
                    <input ${lock} value="${l.name}" onchange="mBTDB.updateRow('${docId}','locations',${i},'name',this.value)" class="w-full bg-transparent border-none p-0 text-sm font-black text-slate-900 uppercase tracking-tight outline-none placeholder-slate-300" placeholder="NAME">
                </div>
                <div class="w-20 text-right shrink-0">
                     <label class="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">CALL</label>
                     <input ${lock} type="text" value="${l.timeOnLocation || ''}" onchange="mBTDB.formatTime(this, '${docId}'); mBTDB.updateRow('${docId}','locations',${i},'timeOnLocation',this.value)" class="w-full bg-transparent border-none p-0 text-xs font-black text-blue-600 text-center outline-none" placeholder="00:00">
                </div>
            </div>
            
            <!-- Row 2: Address (Compact Height) -->
            <div class="w-full">
                 <textarea ${lock} onchange="mBTDB.updateRow('${docId}','locations',${i},'address',this.value)" class="w-full bg-slate-50 border-none rounded px-2 py-1 text-[9px] font-bold text-slate-700 placeholder-slate-400 h-10 resize-none leading-relaxed" placeholder="Full Address...">${l.address}</textarea>
            </div>

            <!-- Row 3: Hospital -->
            <div class="flex items-center gap-1 bg-red-50 px-2 py-1 rounded border border-red-100">
                <span class="text-[8px] font-black text-red-500 uppercase tracking-widest shrink-0">HOSP</span>
                <input ${lock} value="${l.hospital || ''}" onchange="mBTDB.updateRow('${docId}','locations',${i},'hospital',this.value)" class="w-full bg-transparent border-none p-0 text-[9px] font-bold text-red-700 placeholder-red-200" placeholder="Nearest Medical...">
            </div>
            
            <!-- Row 4: Weather (Stacked Below, Compact) -->
            <div class="relative bg-blue-50 px-2 py-1 rounded border border-blue-100 h-8 flex items-center">
                <input ${lock} value="${l.weather || ''}" onchange="mBTDB.updateRow('${docId}','locations',${i},'weather',this.value)" class="w-full bg-transparent border-none p-0 text-[9px] font-bold text-blue-800 placeholder-blue-200 pr-5" placeholder="Weather...">
                <button id="w-btn-${i}" onclick="mBTDB.autoFillLocationDetails('${docId}', ${i})" class="absolute top-1/2 -translate-y-1/2 right-1 text-blue-400 hover:text-blue-600 transition-colors ${hideTool}" title="Auto-Fill details">
                    ${this.icons.wand}
                </button>
            </div>

            <button onclick="mBTDB.deleteRow('${docId}','locations',${i},'logistics')" class="absolute top-0 right-0 text-slate-200 hover:text-red-500 transition-colors ${hideTool}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>`).join('')}</div>
        <div class="p-2 border-t border-black bg-slate-50 ${hideTool}">
            <button onclick="mBTDB.addRow('${docId}','locations','loc')" class="w-full bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100">+ Add Location</button>
        </div>
        </div>`;
    },

    autoFillLocationDetails: async function (docId, index) {
        const btn = document.getElementById(`w-btn-${index}`);
        if (btn) btn.innerHTML = `...`;

        const doc = budget.documents.find(d => d.id === docId);
        if (!doc || !doc.content.data.locations[index]) return;

        const loc = doc.content.data.locations[index];
        // Prioritize address for accuracy
        const query = loc.address && loc.address.length > 5 ? loc.address : loc.name;

        try {
            // 1. Geocoding
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
            const geo = await geoRes.json();

            if (!geo.results) throw new Error("Location not found via Geocoding.");
            const { latitude, longitude, name: geoName } = geo.results[0];

            // 2. Weather
            const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`);
            const wData = await wRes.json();

            const today = wData.daily;
            const code = today.weather_code[0];

            // WMO Code Mapping
            let summary = "Clear";
            if (code === 1 || code === 2 || code === 3) summary = "Partly Cloudy";
            else if (code === 45 || code === 48) summary = "Foggy";
            else if (code >= 51 && code <= 57) summary = "Drizzle";
            else if (code >= 61 && code <= 67) summary = "Rain";
            else if (code >= 80 && code <= 82) summary = "Showers";
            else if (code >= 95) summary = "Thunderstorm";

            const sunrise = today.sunrise[0].split('T')[1];
            const sunset = today.sunset[0].split('T')[1];

            // Logic Fix: Stripped Sunrise/Sunset info from weather string
            const weatherStr = `${summary} ${Math.round(today.temperature_2m_max[0])}°/${Math.round(today.temperature_2m_min[0])}°C`;

            // Update Weather
            this.updateRow(docId, 'locations', index, 'weather', weatherStr);

            // Update Global Sun (First location only)
            if (index === 0) {
                this.updateData(docId, 'meta.sunriseSunset', `${sunrise}/${sunset}`);
            }

            // 3. Hospital AI
            const provider = mBT.features.ai.getSelectedProvider();
            const apiKey = mBT.features.ai.getStoredApiKey(provider);

            if (apiKey) {
                const prompt = `Find nearest emergency hospital to ${latitude},${longitude} (${geoName}). Return ONLY Hospital Name.`;
                const hospitalName = await mBT.features.ai.callUnifiedAI(provider, apiKey, prompt);
                const cleanHost = hospitalName.replace(/^(The nearest.*?is|Here is|Name:|Hospital:)/i, '').trim().replace(/\.$/, '');
                this.updateRow(docId, 'locations', index, 'hospital', cleanHost);
            }

            // Refresh
            // Logic Resolution: Trigger a repaint of this specific widget if possible to avoid full reload
            // But for safety in single-file, we call renderFrame.
            this.renderFrame();

        } catch (e) {
            console.error("Autofill Logic Error:", e);
            mBTME.alert("Sync Error", "Could not fetch location data.");
            if (btn) btn.innerHTML = this.icons.wand;
        }
    },

    // Legacy Bridge: Prevents crash if old buttons invoke this
    autoFillWeather: async function (docId, index, name) {
        return this.autoFillLocationDetails(docId, index);
    },
    _renderSchedule: function (docId, d) {
        const lock = this.state.isEditing ? '' : 'disabled';
        const hideTool = this.state.isEditing ? '' : 'hidden';

        // High-Density Table (Header Removed)
        return `
        <div class="h-full flex flex-col border-none">
            <div class="flex-grow overflow-auto no-scrollbar">
                <table class="cs-table w-full">
                    <thead>
                        <tr>
                            <th class="w-20 text-center">TIME</th>
                            <th class="w-10 text-center">SCN</th>
                            <th class="w-10 text-center">I/E</th>
                            <th class="text-left">DESCRIPTION / ACTION / NOTES</th>
                            <th class="w-16 text-center">CAST</th>
                            <th class="w-20 text-left">LOC</th>
                            <th class="w-6"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${d.schedule.map((row, i) => {
            const isMeal = row.type === 'meal';
            const rowBg = isMeal ? 'bg-slate-100 font-bold' : '';
            return `
                            <tr class="${rowBg} hover:bg-blue-50 transition-colors">
                                <td class="p-1"><input ${lock} type="text" value="${row.time}" onchange="mBTDB.formatTime(this, '${docId}'); mBTDB.updateRow('${docId}','schedule',${i},'time',this.value)" class="text-center font-bold" placeholder="00:00"></td>
                                ${isMeal ?
                    `<td colspan="5" class="p-1 text-center uppercase tracking-widest text-[10px]"><input ${lock} value="${row.description}" onchange="mBTDB.updateRow('${docId}','schedule',${i},'description',this.value)" class="text-center w-full uppercase"></td>` :
                    `
                                <td class="p-1"><input ${lock} value="${row.scene}" onchange="mBTDB.updateRow('${docId}','schedule',${i},'scene',this.value)" class="text-center"></td>
                                <td class="p-1"><input ${lock} value="${row.ie}" onchange="mBTDB.updateRow('${docId}','schedule',${i},'ie',this.value)" class="text-center uppercase"></td>
                                <td class="p-1"><input ${lock} value="${row.description}" onchange="mBTDB.updateRow('${docId}','schedule',${i},'description',this.value)" class="font-medium w-full"></td>
                                <td class="p-1"><input ${lock} value="${row.cast}" onchange="mBTDB.updateRow('${docId}','schedule',${i},'cast',this.value)" class="text-center font-bold text-slate-600"></td>
                                <td class="p-1"><input ${lock} value="${row.loc}" onchange="mBTDB.updateRow('${docId}','schedule',${i},'loc',this.value)" class="text-xs"></td>
                                `}
                                <td class="p-1 text-center ${hideTool}"><button onclick="mBTDB.deleteRow('${docId}','schedule',${i}, 'schedule')" class="text-slate-300 hover:text-red-500">×</button></td>
                            </tr>`;
        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="flex gap-2 p-2 border-t border-black bg-slate-50 ${hideTool}">
                <button onclick="mBTDB.addRow('${docId}','schedule','shot')" class="flex-1 bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100">+ Shot</button>
                <button onclick="mBTDB.addRow('${docId}','schedule','meal')" class="flex-1 bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100">+ Meal</button>
            </div>
        </div>`;
    },
    _renderCrew: function (docId, d) {
        const lock = this.state.isEditing ? '' : 'disabled';
        const hideTool = this.state.isEditing ? '' : 'hidden';
        // Updated: High Density Crew List (Header Removed)
        return `
        <div class="h-full flex flex-col border-none">
            <div class="flex-grow overflow-auto no-scrollbar">
                <table class="cs-table w-full">
                    <thead>
                        <tr>
                            <th class="w-1/4">DEPARTMENT / POSITION</th>
                            <th class="w-1/4">NAME</th>
                            <th class="w-20 text-center">CALL</th>
                            <th>NOTES / INSTRUCTIONS</th>
                            <th class="w-6"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(d.crew || []).map((c, i) => `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="p-1">
                                <input ${lock} value="${c.department || ''}" onchange="mBTDB.updateRow('${docId}','crew',${i},'department',this.value)" class="font-black uppercase text-[8px] text-slate-400 block w-full mb-0.5" placeholder="DEPT">
                                <input ${lock} value="${c.position || ''}" onchange="mBTDB.updateRow('${docId}','crew',${i},'position',this.value)" class="font-bold text-slate-800" placeholder="Position">
                            </td>
                            <td class="p-1">
                                <div class="flex items-center gap-1">
                                    <input ${lock} value="${c.name || ''}" onchange="mBTDB.updateRow('${docId}','crew',${i},'name',this.value)" class="font-bold text-slate-900 w-full" placeholder="Name">
                                    ${this.state.isEditing ? `<div class="cursor-pointer text-slate-300 hover:text-blue-500" onclick="mBTDB.pullFromOpenGate('${docId}','crew.${i}.name','${c.position || 'crew'}')">${this.icons.user}</div>` :
                (c.name ? `<button onclick="mBTDB.openContactByName('${c.name}')" class="text-blue-600 hover:scale-110 transition-transform">${this.icons.user}</button>` : '')}
                                </div>
                                <input ${lock} value="${c.contact || ''}" onchange="mBTDB.updateRow('${docId}','crew',${i},'contact',this.value)" class="text-[8px] font-mono text-slate-400 w-full" placeholder="Phone/Email">
                            </td>
                            <td class="p-1"><input ${lock} type="text" value="${c.callTime || ''}" onchange="mBTDB.formatTime(this, '${docId}'); mBTDB.updateRow('${docId}','crew',${i},'callTime',this.value)" class="text-center font-black text-blue-600" placeholder="00:00"></td>
                            <td class="p-1"><input ${lock} value="${c.notes || ''}" onchange="mBTDB.updateRow('${docId}','crew',${i},'notes',this.value)" class="italic text-slate-600 w-full" placeholder="Specific notes..."></td>
                            <td class="p-1 text-center ${hideTool}"><button onclick="mBTDB.deleteRow('${docId}','crew',${i}, 'crew')" class="text-slate-300 hover:text-red-500">×</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="p-2 border-t border-black bg-slate-50 ${hideTool}">
                <button onclick="mBTDB.addRow('${docId}','crew','person')" class="w-full bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100">+ Add Crew</button>
            </div>
        </div>`;
    },
    _renderTalent: function (docId, d) {
        const lock = this.state.isEditing ? '' : 'disabled';
        const hideTool = this.state.isEditing ? '' : 'hidden';
        // Updated: High Density Cast Grid (Header Removed)
        return `
        <div class="h-full flex flex-col border-none">
            <div class="flex-grow overflow-auto no-scrollbar">
                <table class="cs-table w-full">
                    <thead>
                        <tr>
                            <th class="w-24">CHARACTER</th>
                            <th>ARTIST</th>
                            <th class="w-10 text-center">SWF</th>
                            <th class="w-20 text-center">PU</th>
                            <th class="w-20 text-center">BF</th>
                            <th class="w-20 text-center">H/MU</th>
                            <th class="w-20 text-center">COST</th>
                            <th class="w-20 text-center bg-slate-100 text-black border-black">SET</th>
                            <th class="w-6"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(d.cast || []).map((c, i) => `
                        <tr>
                            <td class="p-1"><input ${lock} value="${c.character || ''}" onchange="mBTDB.updateRow('${docId}','cast',${i},'character',this.value)" class="font-bold text-slate-500 uppercase"></td>
                            <td class="p-1">
                                <div class="flex items-center gap-1">
                                    <input ${lock} value="${c.actor || ''}" onchange="mBTDB.updateRow('${docId}','cast',${i},'actor',this.value)" class="font-black text-slate-900 w-full">
                                    ${this.state.isEditing ? `<div class="cursor-pointer text-slate-300 hover:text-blue-500" onclick="mBTDB.pullFromOpenGate('${docId}','cast.${i}.actor','actor')">${this.icons.user}</div>` :
                (c.actor ? `<button onclick="mBTDB.openContactByName('${c.actor}')" class="text-blue-600 hover:scale-110 transition-transform">${this.icons.user}</button>` : '')}
                                </div>
                            </td>
                            <td class="p-1"><input ${lock} value="${c.swf || 'W'}" onchange="mBTDB.updateRow('${docId}','cast',${i},'swf',this.value)" class="text-center font-black uppercase text-[9px]" placeholder="S/W/F"></td>
                            <td class="p-1"><input ${lock} type="text" value="${c.pickup || ''}" onchange="mBTDB.formatTime(this, '${docId}'); mBTDB.updateRow('${docId}','cast',${i},'pickup',this.value)" class="text-center" placeholder="--:--"></td>
                            <td class="p-1"><input ${lock} type="text" value="${c.bf || ''}" onchange="mBTDB.formatTime(this, '${docId}'); mBTDB.updateRow('${docId}','cast',${i},'bf',this.value)" class="text-center" placeholder="--:--"></td>
                            <td class="p-1"><input ${lock} type="text" value="${c.hmu || ''}" onchange="mBTDB.formatTime(this, '${docId}'); mBTDB.updateRow('${docId}','cast',${i},'hmu',this.value)" class="text-center" placeholder="--:--"></td>
                            <td class="p-1"><input ${lock} type="text" value="${c.costume || ''}" onchange="mBTDB.formatTime(this, '${docId}'); mBTDB.updateRow('${docId}','cast',${i},'costume',this.value)" class="text-center" placeholder="--:--"></td>
                            <td class="p-1 bg-slate-50"><input ${lock} type="text" value="${c.setCall || ''}" onchange="mBTDB.formatTime(this, '${docId}'); mBTDB.updateRow('${docId}','cast',${i},'setCall',this.value)" class="text-center font-black text-slate-900" placeholder="00:00"></td>
                            <td class="p-1 text-center ${hideTool}"><button onclick="mBTDB.deleteRow('${docId}','cast',${i}, 'cast')" class="text-slate-300 hover:text-red-500">×</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="p-2 border-t border-black bg-slate-50 ${hideTool}">
                <button onclick="mBTDB.addRow('${docId}','cast','talent', {id:Date.now(), character:'', actor:'', swf:'W', pickup:'', bf:'', hmu:'', costume:'', setCall:'', contact:''})" class="w-full bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100">+ Add Talent</button>
            </div>
        </div>`;
    },

    // Logic Resolution: 1/8th Page Calculation Heuristic
    // Standard screenplay format: ~54 lines per page. 1/8th page ~= 7 lines (approx 1 inch).
    _calcPages: function (text) {
        if (!text) return "0 Pgs";
        // Count newlines to estimate vertical length
        const lines = text.split(/\r\n|\r|\n/).length;
        // Basic heuristic: 55 lines = 1 page (Courier 12pt standard)
        const eighths = Math.ceil(lines / 7); // 7 lines per 1/8th
        const pages = Math.floor(eighths / 8);
        const rem = eighths % 8;

        if (pages === 0 && rem === 0) return "0 Pgs";
        if (pages === 0) return `${rem}/8 Pgs`;
        if (rem === 0) return `${pages} Pgs`;
        return `${pages} ${rem}/8 Pgs`;
    },

    // Logic Resolution: Live DOM Update for Script Metrics (Batch 1.2)
    _updateScriptHUD: function (widgetId, text) {
        const hud = document.getElementById(`hud_${widgetId}`);
        if (hud) hud.textContent = this._calcPages(text);
    },

    _renderRichText: function (docId, widgetId, data) {
        const lock = this.state.isEditing ? '' : 'disabled';
        const val = data.additional ? data.additional[widgetId] : (data[widgetId] || "");

        // Logic Resolution: Typography Enforcement for Screenplays (Batch 1.2.2)
        const doc = budget.documents.find(d => d.id === docId);
        const widget = doc.content.widgets.find(w => w.id === widgetId);

        // Detect Script Mode via Document Type or Widget Label
        const isScript = (doc && (doc.type === 'script' || (widget && widget.label && widget.label.toLowerCase().includes('screenplay'))));

        // Industry Standard: Courier Prime/New, 12pt, Single Spacing (1 page ~= 1 min)
        const styleClass = isScript
            ? "font-mono text-sm leading-none bg-white text-black font-bold whitespace-pre-wrap border-none outline-none resize-none"
            : "studio-input h-full p-3 text-xs text-slate-800 font-medium leading-relaxed resize-none";

        const customStyle = isScript ? 'font-family: "Courier Prime", "Courier New", monospace; font-size: 12pt; line-height: 1.0; padding: 40px;' : '';
        const placeholder = isScript ? 'INT. LOCATION - DAY\n\nAction description...' : 'Type notes...';

        // HUD Logic: Inject Visual Counter for Scripts (Batch 1.3)
        // Note: Initial calculation happens here on render. Live updates via oninput.
        const hudHtml = isScript
            ? `<div id="hud_${widgetId}" class="absolute bottom-4 right-4 bg-slate-900/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-slate-500 border border-slate-200 pointer-events-none select-none transition-opacity z-10">
                ${this._calcPages(val)}
               </div>`
            : '';

        // Added 'relative group' to container for HUD positioning
        // Added 'oninput' for real-time math (surgical)
        // Kept 'onchange' for data persistence (debounced)
        return `<div class="h-full flex flex-col p-2 relative group">
            <div class="flex-grow relative h-full">
                <textarea ${lock} 
                    id="input_${widgetId}"
                    oninput="mBTDB._updateScriptHUD('${widgetId}', this.value); mBTDB.updateDataDebounced('${doc.id}', 'additional.${widgetId}', this.value)"
                    onchange="mBTDB.updateData('${doc.id}', 'additional.${widgetId}', this.value)" 
                    class="${styleClass} w-full h-full disabled:bg-transparent disabled:border-none" 
                    style="${customStyle}" 
                    placeholder="${placeholder}">${val || ''}</textarea>
                ${hudHtml}
            </div>
        </div>`;
    },
    // Logic Resolution: New Image Rendering Logic with Optimization
    _renderImage: function (docId, widgetId, data) {
        const val = data.additional ? data.additional[widgetId] : (data[widgetId] || "");

        if (val) {
            // Image Display State
            return `
            <div class="relative w-full h-full group bg-slate-50 flex items-center justify-center overflow-hidden">
                <img src="${val}" class="max-w-full max-h-full object-contain">
                ${this.state.isEditing ? `
                <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onclick="document.getElementById('file_${widgetId}').click()" class="bg-white text-slate-900 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-50">Change</button>
                    <button onclick="mBTDB.updateData('${docId}', 'additional.${widgetId}', '')" class="bg-white text-rose-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-50">Remove</button>
                </div>
                <input type="file" id="file_${widgetId}" accept="image/*" class="hidden" onchange="mBTDB._handleImageUpload(this, '${docId}', '${widgetId}')">` : ''}
            </div>`;
        } else {
            // Empty State
            if (!this.state.isEditing) return `<div class="w-full h-full flex items-center justify-center bg-slate-50 text-[10px] text-slate-300 font-bold uppercase tracking-widest">Empty Image Block</div>`;
            return `
            <div class="w-full h-full flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/50 transition-colors border-2 border-dashed border-slate-100 hover:border-blue-200 cursor-pointer p-4 group" onclick="document.getElementById('file_${widgetId}').click()">
                <div class="text-slate-300 group-hover:text-blue-400 mb-2 scale-125 transition-transform group-hover:scale-150">${this.icons.image}</div>
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-500">Upload Image</span>
                <input type="file" id="file_${widgetId}" accept="image/*" class="hidden" onchange="mBTDB._handleImageUpload(this, '${docId}', '${widgetId}')">
            </div>`;
        }
    },

    // --- Batch 2: Logistics Widgets (Transport, MudMap, Footer) ---
    _renderTransport: function (docId, d) {
        const lock = this.state.isEditing ? '' : 'disabled';
        const hideTool = this.state.isEditing ? '' : 'hidden';
        // Updated: Header Removed
        return `
        <div class="h-full flex flex-col border-none">
            <div class="flex-grow overflow-auto no-scrollbar">
                <table class="cs-table w-full text-[9px]">
                    <thead>
                        <tr>
                            <th class="w-1/4">DRIVER / CONTACT</th>
                            <th class="w-1/5">VEHICLE</th>
                            <th class="w-10 text-center">PAX</th>
                            <th class="w-20 text-center">TIME</th>
                            <th>FROM > TO</th>
                            <th class="w-6"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(d.transport || []).map((t, i) => `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="p-1">
                                <input ${lock} value="${t.driver || ''}" onchange="mBTDB.updateRow('${docId}','transport',${i},'driver',this.value)" class="font-bold text-slate-900 w-full" placeholder="Driver Name">
                            </td>
                            <td class="p-1">
                                <input ${lock} value="${t.vehicle || ''}" onchange="mBTDB.updateRow('${docId}','transport',${i},'vehicle',this.value)" class="text-slate-600 w-full" placeholder="Type/Plate">
                            </td>
                            <td class="p-1">
                                <input ${lock} value="${t.pax || ''}" onchange="mBTDB.updateRow('${docId}','transport',${i},'pax',this.value)" class="text-center font-mono" placeholder="#">
                            </td>
                            <td class="p-1">
                                <input ${lock} type="time" value="${t.pickup || ''}" onchange="mBTDB.updateRow('${docId}','transport',${i},'pickup',this.value)" class="text-center font-black text-blue-600">
                            </td>
                            <td class="p-1">
                                <input ${lock} value="${t.route || ''}" onchange="mBTDB.updateRow('${docId}','transport',${i},'route',this.value)" class="w-full italic text-slate-500" placeholder="Loc A > Loc B">
                            </td>
                            <td class="p-1 text-center ${hideTool}">
                                <button onclick="mBTDB.deleteRow('${docId}','transport',${i},'transport')" class="text-slate-300 hover:text-red-500 font-bold">×</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="p-2 border-t border-black bg-slate-50 ${hideTool}">
                <button onclick="mBTDB.addRow('${docId}','transport','move')" class="w-full bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100">+ Add Movement</button>
            </div>
        </div>`;
    },

    _renderMudMap: function (docId, widgetId, data) {
        // Logic Resolution: Use data-attributes to store ID references for the init function
        return `
        <div class="w-full h-full bg-white relative group border-2 border-black" id="mudmap_container_${widgetId}">
            <canvas id="canvas_${widgetId}" class="mudmap-canvas absolute inset-0 w-full h-full z-10 cursor-crosshair" data-doc-id="${docId}" data-widget-id="${widgetId}"></canvas>
            
            ${this.state.isEditing ? `
            <div class="absolute bottom-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <!-- [Feat16] Satellite Trigger -->
                <button onclick="mBTDB.loadMapBackground('${widgetId}', '${docId}')" class="bg-white text-blue-600 px-2 py-1 rounded shadow text-[9px] font-black uppercase tracking-widest border border-blue-200 hover:bg-blue-50" title="Load Site Plan from Logistics Address">Satellite</button>
                <button onclick="mBTDB._clearMudMap('${docId}', '${widgetId}')" class="bg-white text-rose-600 px-2 py-1 rounded shadow text-[9px] font-black uppercase tracking-widest border border-rose-200 hover:bg-rose-50">Clear</button>
            </div>
            <div class="absolute top-2 left-2 z-0 text-[10px] font-black text-slate-100 uppercase pointer-events-none select-none tracking-widest">
                SKETCH AREA (MUD MAP)
            </div>` : ''}
        </div>`;
    },

    _renderFooter: function (docId, widgetId, data) {
        const lock = this.state.isEditing ? '' : 'disabled';
        const val = data.additional ? data.additional[widgetId] : "";
        // Logic Resolution: Default Caribbean/UK Safety Standard if empty
        const defaultSafety = "EMERGENCY: DIAL 110/119 (JA) | NEAREST HOSPITAL: See Locations | SAFETY OFFICER: 1st AD\n\nHARASSMENT POLICY: This production operates a zero-tolerance policy towards harassment and bullying. Report concerns to the Producer or Unit Manager.";

        return `
        <div class="h-full flex flex-col justify-end p-3 border-t-4 border-black mt-2 bg-slate-50">
            <div class="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-2">
                ${this.icons.hazard} HEALTH & SAFETY PROTOCOLS
            </div>
            <textarea ${lock} onchange="mBTDB.updateData('${docId}', 'additional.${widgetId}', this.value)" class="w-full h-full resize-none text-[9px] font-bold text-slate-800 bg-transparent outline-none leading-relaxed" placeholder="Enter safety details...">${val || defaultSafety}</textarea>
        </div>`;
    },

    _initMudMaps: function () {
        const canvases = document.querySelectorAll('.mudmap-canvas');
        canvases.forEach(cvs => {
            if (cvs.dataset.initialized) return;

            // 1. Resize Logic
            const rect = cvs.parentElement.getBoundingClientRect();
            cvs.width = rect.width;
            cvs.height = rect.height;

            const ctx = cvs.getContext('2d');
            const docId = cvs.dataset.docId;
            const widgetId = cvs.dataset.widgetId;

            // 2. Hydrate Data
            const doc = budget.documents.find(d => d.id === docId);
            if (doc && doc.content.data.additional && doc.content.data.additional[widgetId]) {
                const img = new Image();
                img.onload = () => ctx.drawImage(img, 0, 0);
                img.src = doc.content.data.additional[widgetId];
            }

            // 3. Drawing Logic
            let isDrawing = false;

            const start = (e) => {
                if (!mBTDB.state.isEditing) return;
                isDrawing = true;
                ctx.beginPath();
                // Fix: Calculate offset correctly relative to canvas, not window
                const bounds = cvs.getBoundingClientRect();
                const x = (e.clientX || e.touches[0].clientX) - bounds.left;
                const y = (e.clientY || e.touches[0].clientY) - bounds.top;
                ctx.moveTo(x, y);
            };

            const draw = (e) => {
                if (!isDrawing) return;
                const bounds = cvs.getBoundingClientRect();
                const x = (e.clientX || e.touches[0].clientX) - bounds.left;
                const y = (e.clientY || e.touches[0].clientY) - bounds.top;

                ctx.lineTo(x, y);
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 2;
                ctx.lineCap = "round";
                ctx.stroke();
            };

            const end = () => {
                if (!isDrawing) return;
                isDrawing = false;
                // Auto-save on stroke end
                mBTDB.updateData(docId, `additional.${widgetId}`, cvs.toDataURL());
            };

            // 4. Bind Events (Mouse & Touch)
            cvs.addEventListener('mousedown', start);
            cvs.addEventListener('mousemove', draw);
            cvs.addEventListener('mouseup', end);
            cvs.addEventListener('mouseout', end);

            cvs.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
            cvs.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
            cvs.addEventListener('touchend', end);

            cvs.dataset.initialized = "true";
        });
    },

    _clearMudMap: function (docId, widgetId) {
        const cvs = document.getElementById(`canvas_${widgetId}`);
        if (cvs) {
            const ctx = cvs.getContext('2d');
            ctx.clearRect(0, 0, cvs.width, cvs.height);
            this.updateData(docId, `additional.${widgetId}`, '');
        }
    },

    // Logic Resolution: Silent High-Fidelity Image Processing (2K Max)
    _handleImageUpload: function (input, docId, widgetId) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Constraint: Max width 2048px (2K) for retina quality but safe storage
                const MAX_WIDTH = 2048;

                // Only scale down if larger than max width to preserve fidelity
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    const scaleSize = MAX_WIDTH / width;
                    width = MAX_WIDTH;
                    height = img.height * scaleSize;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG 0.8 quality (High Fidelity)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                this.updateData(docId, `additional.${widgetId}`, dataUrl);
                this.renderFrame();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    // --- 5. Navigation & Logic Controllers ---
    _refreshWidget: function (docId, widgetId) {
        const doc = budget.documents.find(d => d.id === docId);
        if (!doc) return;
        const widget = doc.content.widgets.find(w => w.id === widgetId);
        if (!widget) return;

        const el = document.querySelector(`.grid-stack-item[gs-id="${widget.id}"] .widget-body`);

        if (el) {
            const currentScroll = el.scrollTop;
            el.innerHTML = this._getContentForWidget(widget, doc);

            if (widget.type === 'mudmap') this._initMudMaps();

            // Logic Resolution: Restore scroll position of the widget body surgically
            requestAnimationFrame(() => { if (el) el.scrollTop = currentScroll; });
        }
    },

    toggleVertical: function (wid) { const doc = budget.documents.find(d => d.id === this.state.currentDocId); const w = doc.content.widgets.find(x => x.id === wid); if (w) { w.vertical = !w.vertical; this._refreshWidget(doc.id, wid); } },
    updateWidgetLabel: function (docId, widgetId, newLabel) {
        const doc = budget.documents.find(d => d.id === docId);
        const w = doc.content.widgets.find(x => x.id === widgetId);
        if (w) {
            w.label = newLabel;
            this._triggerSave();
            // Sprint 2: Surgical Label Sync
            const input = document.querySelector(`.grid-stack-item[gs-id="${widgetId}"] .widget-header input`);
            if (input && input.value !== newLabel) input.value = newLabel;
        }
    },

    updateData: function (docId, path, value) {
        const doc = budget.documents.find(d => d.id === docId);
        // Invalidate Cache
        if (this.state._cache && this.state._cache.docId === docId) this.state._cache = null;

        const parts = path.split('.');
        let target = doc.content.data;
        for (let i = 0; i < parts.length - 1; i++) { if (!target[parts[i]]) target[parts[i]] = {}; target = target[parts[i]]; }
        target[parts[parts.length - 1]] = value;

        // Phase 9: Sync Request Broadcast
        if (mBT.core && mBT.core.events) mBT.core.events.emit('sync-req', { docId, path });

        this._triggerSave();
    },

    updateDataDebounced: function (docId, path, value) {
        const doc = budget.documents.find(d => d.id === docId);
        if (this.state._cache && this.state._cache.docId === docId) this.state._cache = null;

        const parts = path.split('.');
        let target = doc.content.data;
        for (let i = 0; i < parts.length - 1; i++) { if (!target[parts[i]]) target[parts[i]] = {}; target = target[parts[i]]; }
        target[parts[parts.length - 1]] = value;

        if (mBT.core && mBT.core.events) mBT.core.events.emit('sync-req', { docId, path });

        this._debouncedSave();
    },

    updateRow: function (docId, section, index, key, value) {
        const doc = budget.documents.find(d => d.id === docId);
        if (doc.content.data[section][index]) {
            // Invalidate Cache
            if (this.state._cache && this.state._cache.docId === docId) this.state._cache = null;

            doc.content.data[section][index][key] = value;
            this._triggerSave();
            // Batch 3.2: Removed auto-resize logic. Data saves silently without moving UI.
        }
    },

    addRow: function (docId, section, type, presetData) {
        const doc = budget.documents.find(d => d.id === docId);
        // Invalidate Cache
        if (this.state._cache && this.state._cache.docId === docId) this.state._cache = null;

        if (!doc.content.data[section]) doc.content.data[section] = [];
        let newRow = presetData || { id: Date.now() };
        if (!presetData) {
            if (section === 'schedule') newRow = { ...newRow, type, time: "", scene: "", description: type === 'meal' ? "LUNCH" : "New Shot", cast: "", ie: "", loc: "", note: "" };
            else if (section === 'cast') newRow = { ...newRow, character: "", actor: "", status: "W", pickup: "", hmu: "", setCall: "", contact: "" };
            else if (section === 'crew') newRow = { ...newRow, department: "", position: "", name: "", contact: "", callTime: "" };
            else if (section === 'contacts') newRow = { ...newRow, role: "", name: "" };
            else if (section === 'locations') newRow = { ...newRow, name: "", address: "", weather: "", hospital: "", mapLink: "", timeOnLocation: "" };
            else if (section === 'transport') newRow = { ...newRow, driver: "", vehicle: "", pax: "", pickup: "", loc: "", dest: "" };
        }
        doc.content.data[section].push(newRow);
        this._triggerSave();

        // Surgical Widget Refresh
        const widgetType = (section === 'locations') ? 'logistics' : section;
        const widget = doc.content.widgets.find(w => w.type === widgetType);
        if (widget) this._refreshWidget(docId, widget.id);
        else this.renderFrame();
    },

    deleteRow: function (docId, section, index, widgetType) {
        const doc = budget.documents.find(d => d.id === docId);
        // Invalidate Cache
        if (this.state._cache && this.state._cache.docId === docId) this.state._cache = null;

        doc.content.data[section].splice(index, 1);
        this._triggerSave();

        // Surgical Widget Refresh
        const type = widgetType || section;
        const widget = doc.content.widgets.find(w => w.type === type);
        if (widget) this._refreshWidget(docId, widget.id);
        else this.renderFrame();
    },
    deleteWidget: function (id) {
        mBTME.confirm("Delete Widget", "Remove this block from layout?", () => {
            const doc = budget.documents.find(d => d.id === this.state.currentDocId);
            const el = document.querySelector(`.grid-stack-item[gs-id="${id}"]`);
            if (el) this.state.grid.removeWidget(el);
            doc.content.widgets = doc.content.widgets.filter(w => w.id !== id);
            this._triggerSave();
        });
    },
    addWidget: function () {
        const select = document.getElementById('mBTDB_WidgetSelect');
        if (!select) return;
        const type = select.value;
        const doc = budget.documents.find(d => d.id === this.state.currentDocId);
        const w = { id: type + '_' + Date.now(), type, w: 6, h: 4, autoPosition: true, label: type.toUpperCase() };
        const html = this._generateWidgetHTML(w, doc);
        const node = this.state.grid.addWidget({ w: 6, h: 4, content: html, id: w.id, autoPosition: true });
        w.x = node.gridstackNode.x; w.y = node.gridstackNode.y;
        doc.content.widgets.push(w);
        this._triggerSave();
        // Logic Fix: Ensure canvas initializes immediately after adding
        if (type === 'mudmap') setTimeout(() => this._initMudMaps(), 50);
    },
    _autoResizeWidget: function (widgetId) {
        // Batch 3.2: Deprecated.
        // We rely on GridStack manual sizing + Internal Flex Scrollbars (Batch 3.1).
        // No-op to prevent logic errors in legacy calls.
        return;
    },
    formatTime: function (el, docId) {
        // Logic Resolution: Robust manual time formatting (Smart Text)
        // 1400 -> 14:00, 930 -> 09:30
        let val = el.value.replace(/[^0-9]/g, '');
        if (val.length < 3) return; // Wait for at least 3 digits

        // Pad 3 digits to 4 (e.g., 800 -> 0800)
        if (val.length === 3) val = '0' + val;
        // Truncate if too long (e.g., pasted 12345)
        if (val.length > 4) val = val.substring(0, 4);

        let hh = parseInt(val.substring(0, 2));
        let mm = parseInt(val.substring(2, 4));

        // Logic Resolution: Enforce Military Time Constraint from Header Setting
        // This ensures the row data matches the document's declared format
        let is24h = false;
        if (docId) {
            const doc = budget.documents.find(d => d.id === docId);
            if (doc && doc.content.data.meta.is24h) is24h = true;
        }

        if (is24h) {
            // Military Clamp
            if (hh > 23) hh = 23;
        } else {
            // Standard Time Heuristics (Optional intelligent conversion could go here)
            if (hh > 23) hh = 23;
        }

        if (mm > 59) mm = 59;

        // Output format is always HH:MM for data consistency
        el.value = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    },
    saveTemplate: function () {
        const doc = budget.documents.find(d => d.id === this.state.currentDocId);
        mBTME.prompt("Save Template", "Template Name:", doc.label + " Preset", (name) => {
            if (!name) return;
            const tmpl = { id: 'tmpl_' + Date.now(), label: name, widgets: JSON.parse(JSON.stringify(doc.content.widgets)) };
            if (!budget.templates) budget.templates = [];
            budget.templates.push(tmpl);
            mBTME.alert("Success", `Template "${name}" saved.`);
        });
    },
    calcShootDay: function (dateStr) { if (!budget.startDate) return "Day 1"; const start = new Date(budget.startDate); const current = new Date(dateStr); if (isNaN(start) || isNaN(current)) return "Day 1"; const diffDays = Math.ceil((current - start) / (1000 * 60 * 60 * 24)) + 1; return `Day ${diffDays}`; },

    syncFromBudget: function () {
        mBTME.confirm("Sync Data", "Import crew & data from current Budget?", () => {
            const doc = budget.documents.find(d => d.id === this.state.currentDocId);
            // Invalidate Cache
            if (this.state._cache && this.state._cache.docId === doc.id) this.state._cache = null;

            // 1. Crew Map Logic (Budget Line Items -> Crew List)
            Object.values(budget.sections).forEach(sec => sec.items.forEach(i => {
                if (i.crew && i.crew.name) {
                    // Check if already in list to avoid duplicates
                    const exists = doc.content.data.crew.some(c => c.name === i.crew.name && c.department === i.description);
                    if (!exists) {
                        this.addRow(doc.id, 'crew', 'person', {
                            department: i.description,
                            name: i.crew.name,
                            contact: i.crew.phone,
                            linkedItemId: i.id
                        });
                    }
                }
            }));

            // 2. Key Contacts Logic (Map Specific Roles)
            const map = { 'director': 'Director', 'producer': 'Producer', 'ad': '1st AD' };
            Object.entries(map).forEach(([key, role]) => {
                // Scan Budget Line Items
                let found = null;
                Object.values(budget.sections).some(s => {
                    const i = s.items.find(x => x.description.toLowerCase().includes(role.toLowerCase()) && x.crew && x.crew.name);
                    if (i) { found = i.crew.name; return true; }
                });
                if (found) doc.content.data.contacts[key] = found;
            });

            // 3. Refresh
            mBTLE.reconcile();
            this.renderFrame();
            mBTME.alert("Sync Complete", "Budget personnel imported.");
        });
    },
    syncFromPrevious: function () {
        const cur = budget.documents.find(d => d.id === this.state.currentDocId);
        if (!cur) return;

        let prev = null;
        let msg = "";

        if (cur.type === 'prodReport') {
            // Logic Resolution: Cross-Document Inheritance (DPR pulls from Call Sheet)
            const sheets = budget.documents.filter(d => d.type === 'callSheet')
                .sort((a, b) => (parseInt(b.id.split('_')[1]) || 0) - (parseInt(a.id.split('_')[1]) || 0));
            prev = sheets[0];
            msg = `Import data from Call Sheet "${prev?.label}"?`;
        } else {
            // Standard History: Inherit from previous of same type
            const others = budget.documents.filter(d => d.type === cur.type && d.id !== cur.id)
                .sort((a, b) => (parseInt(b.id.split('_')[1]) || 0) - (parseInt(a.id.split('_')[1]) || 0));
            prev = others[0];
            msg = `Import crew & contacts from "${prev?.label}"?`;
        }

        if (!prev) return mBTME.alert("Sync Info", "No source document found.");

        mBTME.confirm("Sync Previous", msg, () => {
            // Invalidate Cache
            if (this.state._cache && this.state._cache.docId === cur.id) this.state._cache = null;

            if (prev.content?.data?.contacts) cur.content.data.contacts = JSON.parse(JSON.stringify(prev.content.data.contacts));
            if (prev.content?.data?.crew) cur.content.data.crew = JSON.parse(JSON.stringify(prev.content.data.crew));

            // Logic Resolution: Date Inheritance for DPR
            if (cur.type === 'prodReport' && prev.content?.data?.meta?.shootDate) {
                cur.content.data.meta.shootDate = prev.content.data.meta.shootDate;
            }

            this._triggerSave();
            this.renderFrame();
        });
    },

    snapshotDoc: function () { const doc = budget.documents.find(d => d.id === this.state.currentDocId); const newDoc = JSON.parse(JSON.stringify(doc)); newDoc.id = 'doc_' + Date.now(); newDoc.label = doc.label + " (Copy)"; budget.documents.push(newDoc); mBTDB.open(newDoc.id); },
    pullFromOpenGate: function (docId, path, roleQuery) {
        if (typeof mBTOG === 'undefined') return mBTME.alert("System Error", "Database Resolution Failure.");

        // Logic Resolution: Tier 5 Context-Aware Search
        // 1. Scan Active Budget First (Inheritance)
        const matches = [];
        const seen = new Set(); // Prevent duplicates

        if (budget.sections) {
            Object.values(budget.sections).forEach(sec => {
                sec.items.forEach(i => {
                    if (i.crew && i.crew.name && i.description.toLowerCase().includes(roleQuery.toLowerCase())) {
                        const key = `${i.crew.name}|${i.crew.phone}`;
                        if (!seen.has(key)) {
                            matches.push({
                                name: i.crew.name,
                                contact: i.crew.phone || i.crew.email,
                                role: i.description,
                                source: 'Budget' // Logic Resolution: Source tagging
                            });
                            seen.add(key);
                        }
                    }
                });
            });
        }

        // 2. Scan Global DB (Fallback)
        const globalMatches = mBTOG.contacts.filter(c => c.role?.toLowerCase().includes(roleQuery.toLowerCase()));
        globalMatches.forEach(c => {
            const key = `${c.name}|${c.contact || c.phone}`;
            if (!seen.has(key)) {
                matches.push({ ...c, source: 'Global DB' });
                seen.add(key);
            }
        });

        if (matches.length === 0) return mBTME.alert("Not Found", `No ${roleQuery} found.`);

        const apply = (c) => {
            const parts = path.split('.');
            if (parts.length === 3 && (parts[0] === 'crew' || parts[0] === 'cast')) {
                this.updateRow(docId, parts[0], parseInt(parts[1]), parts[2], c.name);
                if (c.contact) this.updateRow(docId, parts[0], parseInt(parts[1]), 'contact', c.contact);
            } else {
                this.updateData(docId, path, `${c.name} ${c.contact ? '(' + c.contact + ')' : ''}`);
            }
            this.renderFrame();
        };

        if (matches.length === 1) {
            apply(matches[0]);
        } else {
            // Modern UI Replacement: Custom Modal with Buttons
            const listHtml = matches.map((c, i) =>
                `<button onclick="mBTDB._resolveOGSelection(${i})" class="w-full text-left p-3 bg-slate-50 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-xl transition-all group mb-2">
                    <div class="flex justify-between items-center">
                        <div class="text-[10px] font-black uppercase text-slate-700 group-hover:text-blue-700">${c.name}</div>
                        <div class="text-[8px] font-bold text-slate-300 bg-white border border-slate-200 rounded px-1.5 py-0.5">${c.source}</div>
                    </div>
                    <div class="text-[9px] text-slate-400 font-mono">${c.contact || 'No Contact'}</div>
                </button>`
            ).join('');

            // Temporary resolver stored on the object to handle the async click
            this._resolveOGSelection = (idx) => {
                mBTME.close('ogSelectModal');
                if (matches[idx]) apply(matches[idx]);
                delete this._resolveOGSelection;
            };

            mBTME.open('ogSelect', `Select ${roleQuery}`, `<div class="p-4 max-h-[400px] overflow-y-auto no-scrollbar">${listHtml}</div>`, 'max-w-sm');
        }
    },
    printToPDF: function (mode) {
        if (typeof mBTPublisher === 'undefined') return mBTME.alert("Error", "Publisher Resolution Failure.");
        const original = document.getElementById('mBTDB_Workspace');
        const clone = original.cloneNode(true);
        clone.id = "mBTDB_Print_Container";
        clone.classList.remove('editing-mode');
        clone.classList.add('print-container', mode === 'standard' ? 'print-standard' : 'print-graphic');
        const originalInputs = original.querySelectorAll('input, textarea');
        const cloneInputs = clone.querySelectorAll('input, textarea');
        originalInputs.forEach((input, i) => { if (cloneInputs[i]) cloneInputs[i].value = input.value; });
        document.body.appendChild(clone);
        mBTPublisher.exportToPDF('mBTDB_Print_Container', `${budget.projectName}_CallSheet`);
        setTimeout(() => { document.body.removeChild(clone); }, 2000);
    },

    // --- 6. Switchboard Integration ---
    _updateHeaderButtons: function () {
        const btnContainer = document.getElementById('mBTDB_Buttons');
        if (!btnContainer) return;
        const isEd = this.state.isEditing;

        const pencilIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
        const checkIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

        // Widget Selector (Edit Mode Only)
        const widgetSelector = isEd ? `
            <div class="flex items-center bg-white rounded-lg pl-2 mr-3 shadow-sm animate-in fade-in zoom-in duration-200 border border-slate-700/30">
                <select id="mBTDB_WidgetSelect" class="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-900 h-7 outline-none cursor-pointer border-none mr-2">
                    <option value="richText">Note</option>
                    <option value="image">Image</option>
                    <option value="schedule">Schedule</option>
                    <option value="cast">Cast List</option>
                    <option value="crew">Crew List</option>
                    <option value="logistics">Logistics</option>
                    <option value="contacts">Contacts</option>
                    <option value="transport">Transport</option>
                    <option value="mudmap">Mud Map</option>
                    <option value="footer">Safety Footer</option>
                </select>
                <button onclick="mBTDB.addWidget()" class="w-8 h-8 flex items-center justify-center text-blue-600 hover:text-white hover:bg-blue-600 transition-colors rounded-r-lg" title="Add Widget">
                    ${this.icons.plus}
                </button>
            </div>` : '';

        // Main Toolbar with Functional Grouping
        // Improvement: Added Paper Size Selector (Sprint 02)
        // Accesses mBTDB.config.paperSizes defined in Sprint 01
        btnContainer.innerHTML = `
            <div class="flex-grow overflow-x-auto no-scrollbar min-w-0">
                <div class="flex items-center gap-1 whitespace-nowrap">
                    ${widgetSelector}

                    <!-- Paper Size Selector -->
                    <div class="relative group mr-3 border-r border-slate-700/50 pr-3">
                        <select data-action="studio-set-paper" class="bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest p-2 rounded-lg outline-none cursor-pointer border border-transparent focus:border-blue-500 appearance-none hover:bg-slate-700 transition-colors" title="Canvas Size">
                            ${Object.entries(mBTDB.config.paperSizes).map(([key, conf]) => {
            const doc = budget.documents.find(d => d.id === this.state.currentDocId);
            const currentSize = doc?.content.data.meta.paperSize || 'a4';
            return `<option value="${key}" ${key === currentSize ? 'selected' : ''}>${conf.label}</option>`;
        }).join('')}
                        </select>
                    </div>
                    
                    <!-- History Controls -->
                    <div class="flex gap-1 mr-3 border-r border-slate-700/50 pr-3">
                        <button data-action="studio-undo" class="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800" title="Undo">${this.icons.undo}</button>
                        <button data-action="studio-redo" class="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800" title="Redo">${this.icons.redo}</button>
                    </div>

                    <!-- Integration Hub: Sync & Preview -->
                    <div class="flex gap-1 mr-3 border-r border-slate-700/50 pr-3">
                        <button data-action="studio-sync" class="p-2 text-emerald-500 hover:text-emerald-400 transition-colors rounded-lg hover:bg-slate-800" title="Sync from Budget">${mBTAssets.sync}</button>
                        <button data-action="studio-sync-prev" class="p-2 text-blue-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800" title="Sync from Previous">${mBTAssets.refresh}</button>
                        <button data-action="studio-preview" class="p-2 text-purple-500 hover:text-purple-400 transition-colors rounded-lg hover:bg-slate-800" title="Document Preview">${mBTAssets.image}</button>
                    </div>

                    <!-- Snapshot Tools -->
                    <div class="flex gap-1 mr-3 border-r border-slate-700/50 pr-3">
                        <button data-action="studio-snapshot" class="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800" title="Duplicate Document">${this.icons.copy}</button>
                        <button data-action="studio-template" class="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800" title="Save Blueprint">${this.icons.save}</button>
                    </div>

                    <!-- Layout Toggle -->
                    <button data-action="studio-toggle-edit" class="p-2 rounded-lg transition-all ${isEd ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}" title="${isEd ? 'Finish Editing' : 'Edit Layout'}">
                        ${isEd ? checkIcon : pencilIcon}
                    </button>
                </div>
            </div>
        `;
    },

    _triggerSave: function () {
        clearTimeout(this._saveTimer);
        if (typeof mBTLE !== 'undefined') mBTLE.reconcile();
        if (typeof saveBudget === 'function') saveBudget();
    },
    _generateDefaultData: function () {
        // Phase 1: Hard Save - Base Schema Definition
        return {
            meta: {
                productionTitle: budget.projectName || "",
                productionCompany: budget.company || "",
                shootDate: new Date().toISOString().split('T')[0],
                crewCallTime: "08:00",
                is24h: false,
                sunriseSunset: ""
            },
            contacts: { director: "", producer: "", ad: "" },
            agency: { producer: "", creative: "" },
            production: { address: "", phone: "", email: "", wifi: "", pass: "" },
            schedule: [],
            crew: [],
            cast: [],
            locations: [{ name: "Base Camp", address: "", weather: "", hospital: "", mapLink: "", timeOnLocation: "" }],
            transport: [],
            additional: {}
        };
    }
};

/* ======= TIER 5: Part 2: Module Controllers & Intelligence ======== */
// --- ROOT NAMESPACE DECLARATION ---
// Note: Namespace definition hoisted to Tier 1. 
// We extend it here for Feature modules.

/* ========= v19.54 BLUEPRINT ENGINE (mBT.features.blueprints) ========= */
mBT.features.blueprints = {
    saveCurrentAsBlueprint: function () {
        if (!budget) return;
        mBTME.prompt("Save Blueprint", "Name this template:", budget.projectName + " Template", (name) => {
            if (!name) return;

            const structure = [];
            Object.values(budget.sections).forEach(sec => {
                structure.push({
                    id: sec.id,
                    name: sec.name,
                    items: sec.items.map(i => ({
                        description: i.description,
                        unit: i.unit,
                        rate: i.rate,
                        multiplier: i.multiplier,
                        rateType: i.rateType
                        // Note: We strip actuals, crew, and transient IDs to create a clean template
                    }))
                });
            });

            mBT.data.templates.saveTemplate(name, {
                structure: structure,
                label: name,
                desc: 'Custom User Blueprint',
                icon: 'file'
            });

            mBTME.alert("Success", `Blueprint "${name}" saved! It is now available in the New Project menu.`);
        });
    }
};

// Core Action Binding for Blueprint
mBT.core.action('blueprint-save', () => mBT.features.blueprints.saveCurrentAsBlueprint());

/* ========= v19.54 ACTIVITY HISTORY (mBT.features.history) ========= */
mBT.features.history = {
    open: function () {
        // Get logs, newest first
        const logs = (budget.activityLog || []).slice().reverse();

        const renderDiff = (diff) => {
            if (!diff || (diff.oldValue === undefined && diff.newValue === undefined)) return '';
            // Logic Resolution: Render visual diff for transparency
            return `<div class="mt-1 text-[9px] font-mono text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 flex items-center gap-2">
                    <span class="line-through text-red-400 opacity-70">${mBT.ui.render.esc(diff.oldValue)}</span>
                    <span class="text-slate-300">→</span>
                    <span class="text-emerald-600 font-bold">${mBT.ui.render.esc(diff.newValue)}</span>
                </div>`;
        };

        const listHtml = logs.length ? logs.map(l => {
            let iconColor = 'bg-blue-500';
            if (l.action === 'DELETE') iconColor = 'bg-rose-500';
            if (l.action === 'ADD') iconColor = 'bg-emerald-500';
            if (l.action === 'REORDER') iconColor = 'bg-amber-500';
            if (l.action === 'REVERT') iconColor = 'bg-purple-500';

            // Tier 5 Logic: Inject Revert Button for Reversible Actions
            let revertBtn = '';
            if (l.diff && l.action === 'UPDATE' && l.itemId) {
                revertBtn = `<button onclick="mBT.data.history.revert('${l.id}')" class="opacity-0 group-hover:opacity-100 transition-opacity ml-2 px-2 py-1 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded text-[8px] font-black uppercase tracking-widest" title="Revert value">Revert</button>`;
            }

            return `
                <div class="p-3 bg-white border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 group">
                    <div class="flex-shrink-0 mt-1.5">
                        <div class="w-1.5 h-1.5 rounded-full ${iconColor} shadow-sm"></div>
                    </div>
                    <div class="flex-grow min-w-0">
                        <div class="flex justify-between items-start">
                            <span class="text-[10px] font-black uppercase text-slate-700 tracking-widest truncate pr-2">${l.action}: ${mBT.ui.render.esc(l.target)}</span>
                            <span class="text-[8px] font-mono text-slate-400 shrink-0">${new Date(l.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">${l.section}</div>
                            ${revertBtn}
                        </div>
                        ${renderDiff(l.diff)}
                    </div>
                </div>`;
        }).join('') : RenderEngine.ui.emptyState({ icon: mBTAssets.list, message: 'No Activity Recorded' });

        const content = `
                <div class="flex flex-col h-[500px] bg-slate-50">
                    <div class="p-4 bg-white border-b border-slate-100 shrink-0 flex justify-between items-center shadow-sm z-10">
                        <div>
                            <h3 class="text-xs font-black uppercase tracking-widest text-slate-800">Project Audit Log</h3>
                            <p class="text-[9px] text-slate-400 font-bold mt-0.5">${logs.length} Events</p>
                        </div>
                        <button onclick="mBT.features.history.export()" class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-[9px] font-black uppercase tracking-widest">
                            ${mBTAssets.save} Export CSV
                        </button>
                    </div>
                    <div class="flex-grow overflow-y-auto no-scrollbar">
                        ${listHtml}
                    </div>
                </div>`;

        mBTME.open('activityLog', 'History', content, 'max-w-md', { hideHeader: true, noPadding: true });
    },

    export: function () {
        if (!budget.activityLog?.length) return mBTME.alert("Empty", "No history to export.");

        // Logic Resolution: ISO Standard CSV Generation
        const headers = ["Timestamp", "User", "Action", "Target", "Section", "Old Value", "New Value"];
        const rows = budget.activityLog.map(e => {
            const escapeCsv = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
            return [
                e.ts,
                e.user,
                e.action,
                e.target,
                e.section,
                e.diff?.oldValue,
                e.diff?.newValue
            ].map(escapeCsv).join(",");
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${budget.projectName}_AuditLog_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

/* ========= v19.54 ANALYTICS CORTEX (mBT.features.cortex) ========= */
mBT.features.cortex = {
    // --- 1. Logic Engine (The Brain) ---
    logic: {
        analyze: function () {
            const data = {
                financials: { topCosts: [], bleeders: [], burnRate: 0 },
                crew: { burnout: [], departmentLoad: {} },
                stats: { totalItems: 0, assignedCrew: 0 }
            };

            const crewMap = {};
            let totalEst = 0;
            let totalAct = 0;
            let allItems = [];

            // A. Aggregation Loop
            if (budget && budget.sections) {
                Object.values(budget.sections).forEach(sec => {
                    sec.items.forEach(item => {
                        data.stats.totalItems++;
                        const est = parseFloat(item.total) || 0;
                        const act = parseFloat(item.actual) || 0;
                        const variance = act - est;

                        totalEst += est;
                        totalAct += act;

                        allItems.push({ ...item, sectionName: sec.name, est, act, variance });

                        // Crew Aggregation Logic
                        if (item.crew && item.crew.name) {
                            data.stats.assignedCrew++;
                            const key = item.crew.name.toLowerCase();
                            if (!crewMap[key]) crewMap[key] = { name: item.crew.name, days: 0, roles: [], cost: 0 };

                            // Day normalization (converting units to days for heatmap)
                            let days = parseFloat(item.quantity) || 0;
                            if (item.unit === 'Week') days *= 5;
                            else if (item.unit === 'Month') days *= 20;
                            else if (item.unit === 'Flat') days = 1; // Assumption for flat fees

                            // Check Stage Data override (More accurate time tracking)
                            if (item.stageData) {
                                let sDays = 0;
                                Object.values(item.stageData).forEach(d => sDays += (parseFloat(d.days) || 0));
                                if (sDays > 0) days = sDays;
                            }

                            crewMap[key].days += days;
                            crewMap[key].cost += est;
                            // Avoid duplicate role names
                            const roleLabel = `${item.description} (${days}d)`;
                            if (!crewMap[key].roles.includes(roleLabel)) crewMap[key].roles.push(roleLabel);
                        }
                    });
                });
            }

            // B. Financial Metrics
            data.financials.burnRate = totalEst > 0 ? (totalAct / totalEst) * 100 : 0;

            // Top Cost Drivers (The Heavy Hitters)
            data.financials.topCosts = [...allItems]
                .sort((a, b) => b.est - a.est)
                .slice(0, 5);

            // Top Bleeders (Variance > 0, highest mismatch)
            data.financials.bleeders = [...allItems]
                .filter(i => i.variance > 0.01) // Filter out floating point noise
                .sort((a, b) => b.variance - a.variance)
                .slice(0, 5);

            // C. Crew Metrics
            data.crew.burnout = Object.values(crewMap)
                .sort((a, b) => b.days - a.days)
                .slice(0, 8); // Top 8 busiest people

            return data;
        },

        // --- Phase 9: Global Studio Scanner ---
        runGlobalAudit: async function () {
            const projects = await mBT.data.getList();
            const globalData = {
                projectCount: projects.length,
                totalBudget: 0,
                totalSpend: 0,
                crewEarnings: {},
                projectSummaries: []
            };

            // Sequential load to prevent memory spike
            for (const pName of projects) {
                // Manual load to bypass state wrapper
                const raw = await mBT.data.storage.load(storageKeyPrefix + pName);
                if (!raw) continue;

                // Extract Metadata
                const grandTotal = parseFloat(raw.grandTotal) || 0;
                const actualTotal = parseFloat(raw.actualTotal) || 0;

                globalData.totalBudget += grandTotal;
                globalData.totalSpend += actualTotal;

                globalData.projectSummaries.push({
                    name: raw.projectName,
                    date: raw.startDate,
                    budget: grandTotal,
                    actual: actualTotal,
                    status: actualTotal > grandTotal ? 'Over' : 'Under'
                });

                // Deep Crew Scan
                if (raw.sections) {
                    Object.values(raw.sections).forEach(sec => {
                        sec.items.forEach(item => {
                            if (item.crew && item.crew.name) {
                                const key = item.crew.name;
                                if (!globalData.crewEarnings[key]) globalData.crewEarnings[key] = 0;
                                // Estimate earnings based on item total (Est) or Actual if available
                                // Use Actual if > 0, else Est
                                const earnings = (parseFloat(item.actual) > 0) ? parseFloat(item.actual) : (parseFloat(item.total) || 0);
                                globalData.crewEarnings[key] += earnings;
                            }
                        });
                    });
                }
            }

            // Sort Top Crew
            globalData.topCrew = Object.entries(globalData.crewEarnings)
                .map(([name, amount]) => ({ name, amount }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 10);

            return globalData;
        }
    },

    // --- 2. UI Engine (The Dashboard) ---
    ui: {
        openHub: function () {
            const analysis = mBT.features.cortex.logic.analyze();
            const fmt = mBTLE.format.currency;

            // --- Widget 1: Burn Rate KPI (Compact) ---
            // Visual logic: Green if <80%, Yellow <100%, Red >100%
            const burnRate = analysis.financials.burnRate;
            let burnColor = 'text-slate-800';
            if (burnRate > 100) burnColor = 'text-rose-600';
            else if (burnRate > 80) burnColor = 'text-amber-500';

            const burnWidget = `
                    <div class="col-span-1 md:col-span-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm h-full flex flex-col justify-center items-center text-center overflow-hidden">
                        <div class="text-[9px] font-black uppercase text-slate-300 mb-2 tracking-widest">Burn Rate</div>
                        <span class="text-3xl font-black ${burnColor} tracking-tighter truncate w-full px-2 block" title="${burnRate.toFixed(1)}%">${burnRate.toFixed(1)}%</span>
                        <span class="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-wider">of budget</span>
                    </div>`;

            // --- Widget 2: Cost Drivers (List) ---
            const renderBar = (label, val, max, colorClass, subText) => {
                const pct = max > 0 ? Math.min((val / max) * 100, 100) : 0;
                return `
                    <div class="mb-3">
                        <div class="flex justify-between text-[9px] font-black uppercase text-slate-500 mb-1">
                            <span class="truncate pr-2" title="${RenderEngine.esc(label)}">${RenderEngine.esc(label)}</span>
                            <span>${fmt(val)}</span>
                        </div>
                        <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full ${colorClass}" style="width: ${pct}%"></div>
                        </div>
                        ${subText ? `<div class="text-[8px] text-slate-400 font-mono mt-0.5 text-right">${subText}</div>` : ''}
                    </div>`;
            };

            const maxCost = analysis.financials.topCosts.length ? analysis.financials.topCosts[0].est : 1;
            const financialsWidget = `
                    <div class="col-span-1 md:col-span-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm h-full overflow-y-auto no-scrollbar">
                        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-2">Cost Drivers</h4>
                        
                        <div class="mb-6">
                            ${analysis.financials.topCosts.length ? analysis.financials.topCosts.map(i => renderBar(i.description, i.est, maxCost, 'bg-blue-600')).join('') : '<div class="text-[9px] text-slate-300 italic">No data</div>'}
                        </div>

                        ${analysis.financials.bleeders.length ? `
                            <div>
                                <div class="text-[9px] font-black uppercase text-rose-300 mb-3">Variance Alert</div>
                                ${analysis.financials.bleeders.map(i => renderBar(i.description, i.variance, i.variance, 'bg-rose-500', `Act: ${fmt(i.act)}`)).join('')}
                            </div>
                        ` : ''}
                    </div>`;

            // --- Widget 3: Human Heatmap Render ---
            const renderCrewRow = (c) => {
                let statusColor = 'bg-emerald-100 text-emerald-700'; // Safe
                let statusLabel = 'OK';

                if (c.days > 20) { statusColor = 'bg-rose-100 text-rose-700'; statusLabel = 'CRITICAL'; }
                else if (c.days > 10) { statusColor = 'bg-amber-100 text-amber-700'; statusLabel = 'HEAVY'; }

                return `
                    <div class="flex items-center justify-between p-2 mb-2 bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-colors">
                        <div class="flex items-center gap-3 overflow-hidden">
                            <div class="w-8 h-8 rounded-full bg-white text-slate-400 flex items-center justify-center font-black text-[9px] shadow-sm border border-slate-100 shrink-0">
                                ${c.name.charAt(0).toUpperCase()}
                            </div>
                            <div class="min-w-0">
                                <div class="text-[10px] font-black text-slate-700 uppercase truncate" title="${RenderEngine.esc(c.name)}">${RenderEngine.esc(c.name)}</div>
                                <div class="text-[8px] text-slate-400 font-bold truncate">${c.roles.length} roles assigned</div>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="px-2 py-1 rounded-md text-[9px] font-black ${statusColor} text-center">${statusLabel}</div>
                            <div class="text-[8px] text-slate-400 font-mono mt-0.5">${c.days} Days</div>
                        </div>
                    </div>`;
            };

            const crewWidget = `
                    <div class="col-span-1 md:col-span-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm h-full overflow-y-auto no-scrollbar">
                        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-2">Human Capital</h4>
                        
                        <div class="mb-6">
                            ${analysis.crew.burnout.length ? analysis.crew.burnout.map(renderCrewRow).join('') : '<div class="text-[9px] text-slate-300 italic">No crew data</div>'}
                        </div>
                    </div>`;

            // --- Widget 4: Live Auditor (Standardized UI) ---
            const auditorWidget = `
                    <div class="col-span-1 md:col-span-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm h-full flex flex-col relative overflow-hidden group">
                        
                        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-2 flex justify-between items-center z-10">
                            <span>Live Auditor</span>
                            <span class="flex h-2 w-2 relative">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                        </h4>
                        
                        <div id="cortex-terminal" class="flex-grow font-mono text-[10px] text-slate-600 space-y-2 overflow-y-auto no-scrollbar leading-relaxed z-10 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div class="opacity-50">> Initializing Cortex Engine v1.0...</div>
                            <div class="opacity-50">> Scanning ${analysis.stats.totalItems} data points...</div>
                            <div class="opacity-50">> Financial velocity calculated at ${analysis.financials.burnRate.toFixed(2)}%</div>
                            <div class="opacity-50">> Crew fatigue analysis complete.</div>
                            <div class="text-slate-800 mt-4 border-t border-slate-200 pt-2 font-bold">> SYSTEM READY. WAITING FOR AI AUDIT...</div>
                            <!-- AI Output targets here -->
                        </div>

                        <div class="mt-4 pt-0 z-10">
                             <button onclick="mBT.features.cortex.startLiveAuditor()" class="w-full py-3 bg-slate-900 hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2">
                                ${mBTAssets.zap} Run AI Risk Assessment
                             </button>
                        </div>
                    </div>`;


            // --- Grid Container (With Mission Control Toolbar) ---
            const content = `
                    <div class="flex flex-col h-[600px] max-h-[80vh] bg-slate-50 p-4">
                        <!-- Mission Control Toolbar -->
                        <div class="flex justify-between items-center mb-4 shrink-0">
                            <h3 class="text-xs font-black uppercase tracking-widest text-slate-400">Mission Control</h3>
                            <div class="flex gap-2">
                                <button onclick="mBT.features.cortex.ui.openGlobalDashboard()" class="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white border border-slate-900 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-sm">
                                    Global View
                                </button>
                                <button onclick="mBT.features.ai.analyzeCurrentBudget()" class="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm">
                                    ${mBTAssets.doctor} Deep Scan
                                </button>
                                <button onclick="mBT.features.ai.openChat()" class="flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-sm">
                                    ${mBTAssets.chat} Chat
                                </button>
                                <button onclick="showSettingsModal('ai')" class="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                                    ${mBTAssets.gear}
                                </button>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 flex-grow overflow-hidden min-h-0">
                            ${burnWidget}
                            ${financialsWidget}
                            ${crewWidget}
                            ${auditorWidget}
                        </div>
                    </div>`;

            mBTME.open('analyticsHub', 'Cortex Dashboard', content, 'max-w-5xl', { noPadding: true, hideHeader: true });

            // Manually inject close button since header is hidden
            const closeBtn = `<button onclick="mBTME.close('analyticsHubModal')" class="absolute top-4 right-4 z-50 p-2 bg-white rounded-full text-slate-400 hover:text-rose-500 shadow-sm transition-all hover:rotate-90">${mBTAssets.close}</button>`;
            const body = document.getElementById('analyticsHubModalBody');
            if (body) body.insertAdjacentHTML('beforeend', closeBtn);
        },

        openGlobalDashboard: async function () {
            mBTME.showLoader("Scanning Studio Archives...");
            try {
                const data = await mBT.features.cortex.logic.runGlobalAudit();
                mBTME.hideLoader();

                const fmt = mBTLE.format.currency;

                const kpiCard = (label, val, sub, color) => `
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center text-center">
                            <div class="text-[9px] font-black uppercase text-slate-300 mb-2 tracking-widest">${label}</div>
                            <span class="text-2xl font-black ${color} tracking-tighter">${val}</span>
                            <span class="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-wider">${sub}</span>
                        </div>`;

                const crewList = data.topCrew.map((c, i) => `
                        <div class="flex justify-between items-center p-2 border-b border-slate-50 last:border-0">
                            <div class="flex items-center gap-3">
                                <div class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-black">${i + 1}</div>
                                <span class="text-[10px] font-bold text-slate-700 uppercase">${RenderEngine.esc(c.name)}</span>
                            </div>
                            <span class="text-[10px] font-mono font-bold text-emerald-600">${fmt(c.amount)}</span>
                        </div>
                    `).join('');

                const projectList = data.projectSummaries.map(p => `
                        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl mb-2 border border-transparent hover:border-blue-200 transition-colors cursor-pointer" onclick="mBT.data.load('${p.name}'); mBTME.close('analyticsHubModal');">
                            <div>
                                <div class="text-[10px] font-black text-slate-800 uppercase">${RenderEngine.esc(p.name)}</div>
                                <div class="text-[8px] text-slate-400 font-bold">${p.date || 'No Date'}</div>
                            </div>
                            <div class="text-right">
                                <div class="text-[10px] font-mono font-bold text-slate-600">${fmt(p.actual)} / ${fmt(p.budget)}</div>
                                <div class="text-[8px] font-black uppercase tracking-widest ${p.status === 'Over' ? 'text-rose-500' : 'text-emerald-500'}">${p.status}</div>
                            </div>
                        </div>
                    `).join('');

                const content = `
                        <div class="flex flex-col h-[600px] max-h-[80vh] bg-slate-50 p-6 overflow-hidden">
                            <div class="flex justify-between items-center mb-6 shrink-0">
                                <div>
                                    <h3 class="text-lg font-black uppercase tracking-tighter text-slate-900">Global Studio Audit</h3>
                                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aggregate Analysis across ${data.projectCount} Projects</p>
                                </div>
                                <button onclick="mBT.features.cortex.ui.openHub()" class="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
                                    ← Back to Project
                                </button>
                            </div>

                            <div class="grid grid-cols-3 gap-4 mb-6 shrink-0">
                                ${kpiCard('Total Spend (Actual)', fmt(data.totalSpend), 'Across All Projects', 'text-slate-800')}
                                ${kpiCard('Total Budget (Est)', fmt(data.totalBudget), 'Lifetime Projection', 'text-blue-600')}
                                ${kpiCard('Project Volume', data.projectCount, 'Active Files', 'text-indigo-500')}
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow min-h-0">
                                <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                                    <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-2">Top Earners (Crew)</h4>
                                    <div class="overflow-y-auto no-scrollbar space-y-1">
                                        ${crewList || '<div class="text-center text-slate-300 text-[10px] mt-10">No crew data found.</div>'}
                                    </div>
                                </div>
                                <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                                    <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-2">Recent Projects</h4>
                                    <div class="overflow-y-auto no-scrollbar">
                                        ${projectList}
                                    </div>
                                </div>
                            </div>
                        </div>`;

                mBTME.open('analyticsHub', 'Global Dashboard', content, 'max-w-5xl', { noPadding: true, hideHeader: true });

            } catch (e) {
                mBTME.hideLoader();
                mBTME.alert("Audit Failed", "Could not scan local database.");
                console.error(e);
            }
        },

        // Phase 3: Active AI Auditor Wiring
        startAuditor: async function () {
            const term = document.getElementById('cortex-terminal');
            if (!term) return;

            // 1. UI Feedback
            term.innerHTML += `<div class="mt-4 text-blue-500 animate-pulse">> ESTABLISHING SECURE CONNECTION...</div>`;
            term.scrollTop = term.scrollHeight;

            // 2. Security Check
            const provider = mBT.features.ai.getSelectedProvider();
            const apiKey = mBT.features.ai.getStoredApiKey(provider);

            if (!apiKey) {
                term.innerHTML += `<div class="mt-2 text-rose-500 font-bold">> ERROR: NO API KEY DETECTED. CONFIGURE SETTINGS.</div>`;
                term.scrollTop = term.scrollHeight;
                return;
            }

            // 3. Payload Construction
            const analysis = mBT.features.cortex.logic.analyze();
            const context = {
                burnRate: analysis.financials.burnRate.toFixed(1) + '%',
                topCosts: analysis.financials.topCosts.map(i => `${i.description}: ${mBTLE.format.currency(i.est)}`),
                varianceBleeders: analysis.financials.bleeders.map(i => `${i.description} (Over by ${mBTLE.format.currency(i.variance)})`),
                overworkedCrew: analysis.crew.burnout.filter(c => c.days > 6).map(c => `${c.name} (${c.days} days)`),
                totalItems: analysis.stats.totalItems
            };

            const prompt = `ACT AS A HOSTILE COMPLETION GUARANTOR. 
                 DATA: ${JSON.stringify(context)}. 
                 TASK: Issue 3 short, brutal directives to reduce risk. 
                 FORMAT: Plain text, no markdown formatting (no bold/italic), typewriter style. Start lines with "> "`;

            // 4. Execution
            try {
                const response = await mBT.features.ai.callUnifiedAI(provider, apiKey, prompt);

                // 5. Typewriter Effect Render
                term.innerHTML += `<div class="mt-4 text-slate-900 border-t border-slate-200 pt-2 font-bold">> INCOMING TRANSMISSION:</div><div class="mt-2 text-blue-600 space-y-2" id="cortex-stream"></div>`;

                const streamEl = document.getElementById('cortex-stream');
                // Split by newlines but handle markdown bullet points if AI ignores instructions
                const lines = response.split('\n').filter(l => l.trim());

                let delay = 0;
                lines.forEach((line, i) => {
                    setTimeout(() => {
                        // clean markdown bold
                        const cleanLine = line.replace(/\*\*/g, '').replace(/\*/g, '').trim();
                        streamEl.innerHTML += `<div class="mb-1 font-mono text-[10px]">${mBT.ui.render.esc(cleanLine)}</div>`;
                        term.scrollTop = term.scrollHeight;
                    }, delay);
                    delay += 800; // Slow typewriter pace
                });

            } catch (err) {
                term.innerHTML += `<div class="mt-2 text-rose-500">> CONNECTION FAILURE: ${mBT.ui.render.esc(err.message)}</div>`;
                term.scrollTop = term.scrollHeight;
            }
        }
    },


    // --- Public Accessor ---
    startLiveAuditor: function () { this.ui.startAuditor(); }
};


// Core Action
mBT.core.action('analytics-hub', () => mBT.features.cortex.ui.openHub());

// Global Alias Overrides (Replacing the old AI menu with the new Dashboard)
window.openAnalyticsHub = () => mBT.features.cortex.ui.openHub();

/* ========= v19.54 STAGE INTELLIGENCE (mBT.features.stages) ========= */
mBT.features.stages = {
    definitions: {
        'dev': ['writer', 'script', 'research', 'option', 'rights', 'legal', 'development', 'story', 'attorney', 'concept'],
        'pre': ['scout', 'casting', 'rehearsal', 'director', 'producer', 'coordinator', 'location', 'travel', 'prep', 'storyboard'],
        'prod': ['camera', 'sound mixer', 'boom', 'lighting', 'grip', 'gaffer', 'electric', 'art', 'wardrobe', 'costume', 'makeup', 'hair', 'unit', 'pa', 'production assistant', 'catering', 'craft', 'medic', 'security', 'transport', 'dop', 'cinematographer', 'operator', 'dit', 'utility'],
        'post': ['editor', 'color', 'vfx', 'sound design', 'sound edit', 'mix', 'music', 'score', 'post', 'titles', 'graphic', 'visual effects', 'composer'],
        'dist': ['marketing', 'sales', 'festival', 'publicity', 'premiere', 'distribution', 'deliverables', 'trailer']
    },
    logic: {
        // Strategy A: Find items existing in budget but not linked to stage
        findMatchesInBudget: function (stageKey) {
            const keywords = mBT.features.stages.definitions[stageKey] || [];
            const matches = [];
            if (!budget || !budget.sections) return [];

            Object.entries(budget.sections).forEach(([secName, sec]) => {
                sec.items.forEach(item => {
                    // Skip if already in this stage
                    if (item.stageData && item.stageData[stageKey]) return;

                    const text = (item.description + ' ' + secName).toLowerCase();
                    if (keywords.some(w => text.includes(w))) {
                        matches.push(item);
                    }
                });
            });
            return matches;
        },
        // Strategy B: Find items in DB that are missing from budget entirely
        findMissingEssentials: function (stageKey) {
            const keywords = mBT.features.stages.definitions[stageKey] || [];
            const db = mBTOG.rates || [];
            const existingDesc = new Set();

            if (budget && budget.sections) {
                Object.values(budget.sections).forEach(s => s.items.forEach(i => existingDesc.add(i.description.toLowerCase())));
            }

            return db.filter(dbItem => {
                const text = dbItem.description.toLowerCase();
                const isRelevant = keywords.some(w => text.includes(w));
                const exists = existingDesc.has(text);
                return isRelevant && !exists;
            });
        },
        // Logic Resolution: Smart removal logic linked to UI button
        removeItem: function (btn) {
            const itemId = btn.dataset.id;
            const sectionName = btn.dataset.section;
            const stageKey = btn.dataset.stage;

            let item = null;
            // Try fast lookup
            if (sectionName && budget.sections[sectionName]) {
                item = budget.sections[sectionName].items.find(i => String(i.id) === String(itemId));
            }
            // Fallback scan
            if (!item) {
                Object.values(budget.sections).forEach(sec => {
                    if (!item) item = sec.items.find(i => String(i.id) === String(itemId));
                });
            }

            if (item) {
                // Enhanced Confirmation with item name
                mBTME.confirm("Remove from Stage", `Remove "${item.description}" from this stage? The main budget item will remain.`, () => {
                    if (item.stageData && item.stageData[stageKey]) {
                        delete item.stageData[stageKey];
                        saveBudget();
                        if (typeof mBTLE !== 'undefined') mBTLE.reconcile();
                        if (window.showStagesModal) window.showStagesModal();
                    }
                });
            }
        }
    },
    ui: {
        openAutoFillMenu: function (stageKey) {
            const matches = mBT.features.stages.logic.findMatchesInBudget(stageKey);
            const missing = mBT.features.stages.logic.findMissingEssentials(stageKey);
            const stageLabel = (budget.targetLock && budget.targetLock.stages[stageKey]) ? budget.targetLock.stages[stageKey].label : stageKey.toUpperCase();

            const content = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                    <!-- Option A: Link Existing -->
                    <div class="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex flex-col justify-between h-full group hover:border-blue-200 transition-colors">
                        <div>
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-8 h-8 rounded-lg bg-blue-200 text-blue-700 flex items-center justify-center shadow-sm">${mBTAssets.clip}</div>
                                <h4 class="font-black text-[10px] uppercase tracking-widest text-blue-800">Link Existing</h4>
                            </div>
                            <p class="text-[10px] text-blue-600/80 leading-relaxed mb-4">
                                Scan your current budget line items. We found <strong>${matches.length}</strong> items that match this stage's criteria but haven't been assigned yet.
                            </p>
                        </div>
                        <button onclick="window.handleStageAutoFill('${stageKey}', 'link'); mBTME.close('autoFillModal');" class="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2" ${matches.length === 0 ? 'disabled style="opacity:0.5"' : ''}>
                            Sync ${matches.length} Items
                        </button>
                    </div>

                    <!-- Option B: Generate Missing -->
                    <div class="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex flex-col justify-between h-full group hover:border-emerald-200 transition-colors">
                        <div>
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-8 h-8 rounded-lg bg-emerald-200 text-emerald-700 flex items-center justify-center shadow-sm">${mBTAssets.wand}</div>
                                <h4 class="font-black text-[10px] uppercase tracking-widest text-emerald-800">Generate Missing</h4>
                            </div>
                            <p class="text-[10px] text-emerald-600/80 leading-relaxed mb-4">
                                Database check complete. We found <strong>${missing.length}</strong> standard industry roles/items for this stage that are completely missing from your budget.
                            </p>
                        </div>
                        <button onclick="window.handleStageAutoFill('${stageKey}', 'generate'); mBTME.close('autoFillModal');" class="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2" ${missing.length === 0 ? 'disabled style="opacity:0.5"' : ''}>
                            ${mBTAssets.plus} Add ${missing.length} Items
                        </button>
                    </div>
                </div>
                <div class="px-4 pb-4 text-center">
                    <p class="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Changes are saved automatically upon execution</p>
                </div>`;

            mBTME.open('autoFill', `Smart Fill: ${stageLabel}`, content, 'max-w-xl');
        }
    }
};

/* ========= v19.54 RECYCLE BIN (mBT.features.trash) ========= */
mBT.features.trash = {
    state: { activeTab: 'documents', selected: new Set() },
    icons: { folder: mBTAssets.folder, file: mBTAssets.file, trash: mBTAssets.trash, undo: mBTAssets.undo, check: mBTAssets.target },

    open: function (tab = 'documents') {
        const currentTab = this.state.activeTab;
        // Logic Resolution: Clear selections only when switching context
        if (tab !== currentTab) this.state.selected.clear();
        this.state.activeTab = tab;

        const type = this.state.activeTab;
        const docTrash = budget.documentTrash || [];
        const projectTrash = JSON.parse(localStorage.getItem(trashKey) || '[]');

        const items = type === 'documents' ? docTrash : projectTrash;
        const selectedCount = this.state.selected.size;
        const hasItems = items.length > 0;

        // Tier 5 Update: Manual Tab Construction for Event Delegation
        const tabs = [
            { id: 'documents', label: 'Documents', count: docTrash.length },
            { id: 'projects', label: 'Projects', count: projectTrash.length }
        ];

        const tabHtml = `<div class="flex border-b border-slate-100 bg-slate-50/50 rounded-t-xl overflow-hidden select-none">
                ${tabs.map(t => {
            const isActive = t.id === type;
            const activeClass = "bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm";
            const inactiveClass = "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50";
            return `<button data-action="nav-trash" data-tab="${t.id}" class="flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? activeClass : inactiveClass}">
                        ${t.label} <span class="opacity-50 ml-1">(${t.count})</span>
                    </button>`;
        }).join('')}
            </div>`;

        // Logic Resolution: Dynamic Toolbar for Bulk Actions with Checkbox Logic
        const toolbarHtml = `
                <div class="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                    <div class="flex items-center gap-2">
                        <input type="checkbox" 
                               data-action="trash-toggle-all"
                               ${hasItems && selectedCount === items.length ? 'checked' : ''} 
                               ${!hasItems ? 'disabled' : ''}
                               class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
                        <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">${selectedCount} Selected</span>
                    </div>
                    <div class="flex gap-2">
                        ${selectedCount > 0 ? `
                            <button data-action="trash-bulk" data-type="restore" class="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-1">${this.icons.undo} Restore</button>
                            <button data-action="trash-bulk" data-type="delete" class="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-1">${this.icons.trash} Delete</button>
                        ` : `
                            <button data-action="trash-bulk" data-type="empty" class="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all" ${!hasItems ? 'disabled style="opacity:0.5"' : ''}>Empty Bin</button>
                        `}
                    </div>
                </div>`;

        let listHtml = '';

        if (!hasItems) {
            listHtml = RenderEngine.ui.emptyState({
                icon: this.icons.trash,
                message: 'Bin is Empty',
                subtext: type === 'documents' ? 'No deleted documents found' : 'No deleted projects found'
            });
        } else {
            listHtml = items.map(item => {
                const id = type === 'documents' ? item.id : item.projectName; // Projects use name as ID in trash
                const isSel = this.state.selected.has(id);
                const label = type === 'documents' ? (item.label || item.name || 'Untitled') : (item.projectName || 'Untitled Project');
                const meta = type === 'documents' ? `Type: ${item.type || 'Custom'}` : `Company: ${item.company || 'Indie'}`;

                return `
                    <div class="flex items-center justify-between p-3 bg-white border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group cursor-pointer" data-action="trash-toggle" data-id="${RenderEngine.esc(id)}">
                        <div class="flex items-center gap-3 overflow-hidden flex-grow">
                            <div class="flex-shrink-0">
                                <input type="checkbox" ${isSel ? 'checked' : ''} class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none">
                            </div>
                            <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-blue-500 group-hover:shadow-sm transition-all text-lg shrink-0">
                                ${type === 'documents' ? this.icons.file : this.icons.folder}
                            </div>
                            <div class="overflow-hidden min-w-0">
                                <div class="text-[10px] font-black uppercase text-slate-700 truncate">${RenderEngine.esc(label)}</div>
                                <div class="text-[9px] text-slate-400 font-bold truncate">${RenderEngine.esc(meta)}</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button data-action="trash-single" data-type="restore" data-id="${RenderEngine.esc(id)}" class="p-2 text-slate-300 hover:text-emerald-500 transition-colors" title="Restore">${this.icons.undo}</button>
                            <button data-action="trash-single" data-type="delete" data-id="${RenderEngine.esc(id)}" class="p-2 text-slate-300 hover:text-rose-500 transition-colors" title="Delete Forever">${this.icons.trash}</button>
                        </div>
                    </div>`;
            }).join('');
        }

        // Logic Resolution: Persistent UI Updates (Prevents Flickering/Re-opening)
        const domId = 'trashModal';
        const existingModal = document.getElementById(domId);

        if (existingModal) {
            const nav = document.getElementById('trashTabNav');
            const tool = document.getElementById('trashToolbarArea');
            const list = document.getElementById('trashListArea');

            if (nav) nav.innerHTML = tabHtml;
            if (tool) tool.innerHTML = toolbarHtml;
            if (list) list.innerHTML = listHtml;
            return;
        }

        const content = `
                <div class="flex flex-col h-[600px] max-h-[80vh]">
                    <div id="trashTabNav">${tabHtml}</div>
                    <div id="trashToolbarArea">${toolbarHtml}</div>
                    <div id="trashListArea" class="flex-grow overflow-y-auto p-4 bg-slate-50 no-scrollbar space-y-2">
                        ${listHtml}
                    </div>
                </div>`;
        mBTME.open('trash', 'Recycle Bin', content, 'max-w-lg', { noPadding: true, hideHeader: true });
    },

    // --- Selection Logic ---
    toggleItem: function (id) {
        if (this.state.selected.has(id)) this.state.selected.delete(id);
        else this.state.selected.add(id);
        this.open(this.state.activeTab); // Re-render state
    },
    toggleAll: function (checked) {
        this.state.selected.clear();
        if (checked) {
            const list = this.state.activeTab === 'documents' ? (budget.documentTrash || []) : JSON.parse(localStorage.getItem(trashKey) || '[]');
            list.forEach(i => this.state.selected.add(this.state.activeTab === 'documents' ? i.id : i.projectName));
        }
        this.open(this.state.activeTab);
    },

    // --- Action Routers ---
    singleAction: function (action, id) {
        this.state.selected.clear();
        this.state.selected.add(id);
        this.performAction(action);
    },

    performAction: function (action) {
        const isDoc = this.state.activeTab === 'documents';
        const count = this.state.selected.size;

        // Empty Bin Logic
        if (action === 'empty') {
            mBTME.confirm("Empty Bin", `Permanently delete ALL items in the ${isDoc ? 'Documents' : 'Projects'} bin? This cannot be undone.`, () => {
                if (isDoc) budget.documentTrash = [];
                else localStorage.setItem(trashKey, '[]');
                saveBudget();
                this.open(this.state.activeTab);
            });
            return;
        }

        if (count === 0) return;

        // Delete / Restore Logic
        if (action === 'delete') {
            mBTME.confirm("Delete Forever", `Permanently delete ${count} selected item(s)? This cannot be undone.`, () => {
                if (isDoc) {
                    budget.documentTrash = budget.documentTrash.filter(d => !this.state.selected.has(d.id));
                    saveBudget();
                } else {
                    const list = JSON.parse(localStorage.getItem(trashKey) || '[]');
                    const filtered = list.filter(p => !this.state.selected.has(p.projectName));
                    localStorage.setItem(trashKey, JSON.stringify(filtered));
                }
                this.state.selected.clear();
                this.open(this.state.activeTab);
            });
        } else if (action === 'restore') {
            mBTME.confirm("Restore Items", `Restore ${count} selected item(s)?`, () => {
                if (isDoc) {
                    const toRestore = budget.documentTrash.filter(d => this.state.selected.has(d.id));
                    budget.documentTrash = budget.documentTrash.filter(d => !this.state.selected.has(d.id));
                    if (!budget.documents) budget.documents = [];
                    budget.documents.push(...toRestore);
                    saveBudget();
                    render(); // Refresh main view to show restored docs
                } else {
                    const list = JSON.parse(localStorage.getItem(trashKey) || '[]');
                    const keptTrash = [];
                    list.forEach(p => {
                        if (this.state.selected.has(p.projectName)) {
                            const key = storageKeyPrefix + p.projectName;
                            // Check collision
                            if (localStorage.getItem(key)) {
                                // Note: Simplified logic here for restoration collision to avoid nested confirms
                                localStorage.setItem(key, JSON.stringify(p));
                            } else {
                                localStorage.setItem(key, JSON.stringify(p));
                            }
                        } else {
                            keptTrash.push(p);
                        }
                    });
                    localStorage.setItem(trashKey, JSON.stringify(keptTrash));
                    if (typeof renderProjectManagement === 'function') renderProjectManagement(); // Refresh project dropdown
                }
                this.state.selected.clear();
                this.open(this.state.activeTab);
            });
        }
    },

    // --- External Hooks ---
    trashDocument: function (docId) {
        mBTME.confirm("Archive Document", "Move this document to the Recycle Bin?", () => {
            const idx = budget.documents.findIndex(d => d.id === docId);
            if (idx > -1) {
                const doc = budget.documents.splice(idx, 1)[0];
                if (!budget.documentTrash) budget.documentTrash = [];
                budget.documentTrash.push(doc);
                saveBudget();
                render(); // Update Vault UI if open
                if (document.getElementById('documentsModal')) showDocumentsModal();
            }
        });
    }
};

// --- Backward Compatibility Alias (for buttons using old global names) ---
window.mBTTrash = mBT.features.trash;


/* ========= v19.54 SETTINGS & CONFIGURATION (mBT.features.settings) ========= */
mBT.features.settings = {

    // --- 1. Sub-View Generators ---
    renderDbView: function (subTab) {
        if (subTab === 'contacts') {
            const globalContacts = mBTOG.contacts || [];
            const assignedContacts = [];
            Object.values(budget.sections || {}).forEach(sec => {
                sec.items.forEach(item => {
                    if (item.crew && item.crew.name) {
                        assignedContacts.push({
                            id: 'assigned_' + item.id,
                            name: item.crew.name,
                            role: item.description || 'Crew',
                            phone: item.crew.phone || '',
                            email: item.crew.email || '',
                            assigned: true
                        });
                    }
                });
            });
            const allContacts = [...globalContacts];
            assignedContacts.forEach(ac => {
                if (!allContacts.some(gc => gc.name.toLowerCase() === ac.name.toLowerCase())) {
                    allContacts.push(ac);
                }
            });

            const listContent = allContacts.length > 0 ? allContacts.map(c => RenderEngine.ui.listRow({
                id: c.id,
                icon: c.name ? c.name.charAt(0).toUpperCase() : '?',
                title: c.name,
                subtitle: `${c.role || 'No Role'}${c.assigned ? ' (Assigned)' : ''}`,
                onClick: `openCrewProfile(this, event, '${c.id}', null)`,
                actions: c.assigned ? [] : [{
                    icon: mBTAssets.trash,
                    title: 'Delete',
                    color: 'rose',
                    onClick: `mBT.features.settings.deleteContact('${c.id}')`
                }]
            })).join('') : RenderEngine.ui.emptyState({ icon: mBTAssets.user, message: 'No Contacts Found' });

            return `
                    <div class="flex flex-col h-full bg-white overflow-hidden rounded-xl border border-slate-100 shadow-sm">
                        <div class="p-3 bg-indigo-50 border-b border-indigo-100 flex flex-col gap-3 shrink-0 z-10">
                            <div class="flex justify-center gap-3 flex-wrap">
                                <button onclick="mBT.features.settings.openAddContactModal()" class="bg-indigo-200 text-indigo-800 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-300 transition-all flex items-center gap-1.5">
                                    ${mBTAssets.plus} Add
                                </button>
                                <input type="file" id="csvImportInput" class="hidden" accept=".csv" onchange="importContactsCSV(this)">
                                <button onclick="document.getElementById('csvImportInput').click()" class="bg-indigo-200 text-indigo-800 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-300 transition-all flex items-center gap-1.5">
                                    ${mBTAssets.plus} Import CSV
                                </button>
                                <button onclick="mBTAssign.assignFromContacts()" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all">
                                    Auto-Assign
                                </button>
                            </div>
                            <div class="relative">
                                <input type="text" id="contactsSearchInput" placeholder="SEARCH PERSONNEL..." class="w-full p-2.5 pr-10 bg-white border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-300 transition-all">
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none">${mBTAssets.search}</div>
                            </div>
                        </div>
                        <div id="contactsListBody" class="flex-grow overflow-y-auto no-scrollbar relative bg-white">
                            ${listContent}
                        </div>
                    </div>`;
        }
        if (subTab === 'lineItems') {
            const isSharing = mBTOG.settings.optInSharing;
            return `
                    <div class="flex flex-col h-full bg-white overflow-hidden rounded-xl border border-slate-100 shadow-sm">
                        <div class="p-3 bg-slate-50 border-b border-slate-100 shrink-0 z-10 space-y-3">
                            <div class="flex gap-2">
                                <button onclick="mBT.features.settings.openAddRateModal()" class="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm flex items-center justify-center gap-2">
                                    ${mBTAssets.plus} Add Line Item
                                </button>
                                <button onclick="mBT.features.settings.toggleOpenGateSharing()" class="flex-1 py-2 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 ${isSharing ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}">
                                    ${mBTAssets.cloud} ${isSharing ? 'Sharing On' : 'Share Data'}
                                </button>
                            </div>
                            <div class="relative">
                                <input type="text" id="dbSearchInput" placeholder="SEARCH GLOBAL RATES..." class="w-full p-2.5 pr-10 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">${mBTAssets.search}</div>
                            </div>
                        </div>
                        <div id="dbListBody" class="flex-grow overflow-y-auto no-scrollbar relative min-h-0 bg-white">
                            ${mBTOG.rates.map(r => RenderEngine.ui.listRow({
                id: r.id || r.description,
                icon: mBTAssets.money,
                title: r.description,
                subtitle: `${mBTLE.format.currency(r.rate)} / ${r.unit}`,
                classes: 'border-b border-slate-50'
            })).join('')}
                        </div>
                    </div>`;
        }
        if (subTab === 'templates') {
            const templates = Array.isArray(mBTOG.templates) ? mBTOG.templates : [];
            const listContent = templates.length > 0 ? templates.map(t => RenderEngine.ui.listRow({
                id: t.id,
                icon: mBTAssets[t.icon] || mBTAssets.file,
                title: t.label,
                subtitle: t.cat || 'General',
                actions: [{
                    icon: mBTAssets.plus,
                    title: 'Use Template',
                    color: 'blue',
                    onClick: `createNewDocumentFromTemplate('${t.id}')`
                }]
            })).join('') : RenderEngine.ui.emptyState({ icon: mBTAssets.file, message: 'No Templates' });

            return `
                    <div class="flex flex-col h-full bg-white overflow-hidden rounded-xl border border-slate-100 shadow-sm">
                        <div class="p-3 bg-indigo-50 border-b border-indigo-100 shrink-0 z-10">
                             <div class="relative">
                                <input type="text" id="templateSearchInput" placeholder="SEARCH TEMPLATES..." class="w-full p-2.5 pr-10 bg-white border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-300 transition-all">
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none">${mBTAssets.search}</div>
                            </div>
                        </div>
                        <div id="templatesListBody" class="flex-grow overflow-y-auto no-scrollbar relative bg-white">
                            ${listContent}
                        </div>
                    </div>`;
        }
        return '';
    },

    // --- 2. Main Content Generator ---
    getTabContent: function (tabName, subTab = 'lineItems') {
        if (tabName === 'general') {
            const currentDateFormat = getProjectDateFormat();
            const currentSeparator = getProjectNameSeparator();
            const isCompact = budget.settings?.compactMode || false;
            const syncAoD = budget.settings?.syncAoD || false;
            // Logic Resolution: Prep for future legacy theme switch
            const isClassic = budget.settings?.classicTheme || false;
            const allowZoom = budget.settings?.allowZoom || false;

            return `
                    <div class="h-full overflow-y-auto no-scrollbar p-6 space-y-6 animate-in fade-in duration-300">
                        <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center gap-3">
                            <div class="w-16 h-16 rounded-2xl shadow-lg border-2 border-slate-50 overflow-hidden bg-[#fdba35]">${mBTAssets.appLogo}</div>
                            <div>
                                <h3 class="text-xs font-black uppercase tracking-widest text-slate-800">moo Budget Tool</h3>
                                <p class="text-[9px] text-slate-400 font-bold mt-1">Build v${APP_VERSION} • ${navigator.onLine ? '<span class="text-emerald-500">Online</span>' : '<span class="text-rose-500">Offline</span>'}</p>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date Format</label>
                                    <select id="dateFormatSelect" onchange="localStorage.setItem('${projectDateFormatKey}', this.value)" class="w-full text-[10px] p-2 bg-slate-50 border-none rounded-lg font-bold outline-none cursor-pointer">
                                        <option value="YYYYMMDD" ${currentDateFormat === 'YYYYMMDD' ? 'selected' : ''}>YYYY-MM-DD</option>
                                        <option value="MMDDYYYY" ${currentDateFormat === 'MMDDYYYY' ? 'selected' : ''}>MM-DD-YYYY</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Separator</label>
                                    <input type="text" id="separatorInput" maxlength="1" value="${currentSeparator}" onchange="localStorage.setItem('${projectNameSeparatorKey}', this.value)" class="w-full text-[10px] p-2 bg-slate-50 border-none rounded-lg font-bold text-center outline-none">
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-800">Allow Page Zoom</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Enable pinch-to-zoom gestures</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="zoomToggle" ${allowZoom ? 'checked' : ''} onchange="if(!budget.settings) budget.settings={}; budget.settings.allowZoom = this.checked; saveBudget(); mBT.ui.updateViewport();" class="sr-only peer">
                                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            </div>
                            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-800">Compact View</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Denser layout for small screens</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="compactModeToggle" ${isCompact ? 'checked' : ''} onchange="if(!budget.settings) budget.settings={}; budget.settings.compactMode = this.checked; saveBudget(); render();" class="sr-only peer">
                                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                            <!-- NEW: Classic Theme Placeholder -->
                            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-800">Classic Theme</h4>
                                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">Legacy visual style (Pre-v19.54)</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="classicThemeToggle" ${isClassic ? 'checked' : ''} onchange="if(!budget.settings) budget.settings={}; budget.settings.classicTheme = this.checked; saveBudget(); render();" class="sr-only peer">
                                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                             <a href="https://raw.githubusercontent.com/moollc/mooBudgetTool/refs/heads/main/mBT/index.html" target="_blank" download="moobudget-beta.html" class="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-colors">${mBTAssets.cloud} Get Beta</a>
                             <button onclick="hardResetApp()" class="flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-100 transition-colors">${mBTAssets.zap} Fix Bugs</button>
                        </div>
                        <div class="flex justify-center">
                             <button onclick="mBTME.close('settingsModal'); showCoffeeWidget();" class="flex items-center gap-2 px-8 py-4 bg-[#FFDD00] text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform shadow-lg">${mBTAssets.coffee} Support Development</button>
                        </div>
                    </div>`;
        }
        if (tabName === 'ai' || tabName === 'connections') {
            const provider = getSelectedProvider();
            const saveHistory = budget.aiContext?.saveHistory ?? true;
            const storedPrompt = mBT.features.ai.getSystemPrompt();
            const webhookUrl = localStorage.getItem(`${storageKeyPrefix}cloudWebhook`) || '';

            const keyLinks = {
                'gemini': 'https://aistudio.google.com/app/apikey',
                'openai': 'https://platform.openai.com/api-keys',
                'deepseek': 'https://platform.deepseek.com/api_keys',
                'grok': 'https://console.x.ai/'
            };

            return `
                    <div class="h-full overflow-y-auto no-scrollbar p-6 space-y-6 animate-in fade-in duration-300">
                        
                        <!-- Backend Cloud Bridge -->
                        <div class="p-5 bg-slate-900 rounded-2xl border border-black shadow-lg text-white">
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <h3 class="text-[10px] font-black uppercase tracking-widest text-emerald-400">Production Cloud</h3>
                                    <p class="text-[9px] text-slate-500 font-bold mt-0.5">Upstream Data Bridge</p>
                                </div>
                                <div class="text-slate-700">${mBTAssets.cloud}</div>
                            </div>
                            <div>
                                <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Webhook Endpoint</label>
                                <div class="flex gap-2">
                                    <input type="text" id="cloudWebhookInput" value="${webhookUrl}" onchange="localStorage.setItem('${storageKeyPrefix}cloudWebhook', this.value)" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder-slate-600" placeholder="https://api.studio.com/ingest...">
                                    <button onclick="const url=document.getElementById('cloudWebhookInput').value; if(!url) return mBTME.alert('Error', 'No URL'); mBTME.showLoader('Pinging...'); fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({test:true, source:'MooBudget', project:budget.projectName, ts:new Date().toISOString()})}).then(r=>{ mBTME.hideLoader(); if(r.ok) mBTME.alert('Success','Endpoint Reachable'); else mBTME.alert('Error', 'Status: '+r.status); }).catch(e=>{ mBTME.hideLoader(); mBTME.alert('Connection Failed', e.message); })" class="px-3 bg-emerald-900/50 text-emerald-400 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-900 border border-emerald-800 transition-colors">Test</button>
                                </div>
                                <p class="text-[8px] text-slate-600 mt-2 leading-relaxed">Destination for "Cloud Dispatch". Accepts JSON payloads containing Ledger and Budget totals.</p>
                            </div>
                        </div>

                        <!-- AI Configuration -->
                        <div class="p-5 bg-slate-900 rounded-2xl border border-black shadow-lg text-white">
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-400">Intelligence</h3>
                                    <p class="text-[9px] text-slate-500 font-bold mt-0.5">Assistant Provider Access</p>
                                </div>
                                <div class="text-slate-700">${mBTAssets.sparkle}</div>
                            </div>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Active Provider</label>
                                    <select id="aiProviderSelect" onchange="const link=document.getElementById('apiKeyLink'); const map=${JSON.stringify(keyLinks).replace(/"/g, "'")}; link.href=map[this.value];" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
                                        <option value="gemini" ${provider === 'gemini' ? 'selected' : ''}>Google Gemini API</option>
                                        <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI API</option>
                                        <option value="deepseek" ${provider === 'deepseek' ? 'selected' : ''}>DeepSeek API</option>
                                        <option value="grok" ${provider === 'grok' ? 'selected' : ''}>Grok (xAI) API</option>
                                    </select>
                                </div>
                                <div>
                                    <div class="flex justify-between items-center mb-1.5">
                                        <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest">API Credentials</label>
                                        <a id="apiKeyLink" href="${keyLinks[provider] || '#'}" target="_blank" class="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 transition-colors">
                                            Get API Key <span>→</span>
                                        </a>
                                    </div>
                                    <input type="password" id="apiKeyInput" value="${getStoredApiKey(provider)}" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-blue-500" placeholder="sk-...">
                                </div>
                                <div>
                                    <label class="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Persona & Constraints</label>
                                    <textarea id="aiSystemPromptInput" class="w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-500 resize-none h-16 placeholder-slate-600" placeholder="e.g. Be sarcastic. Focus only on Below The Line. Use JMD currency symbol.">${storedPrompt}</textarea>
                                </div>
                                <div class="flex items-center gap-3 py-1">
                                    <div class="relative flex items-center">
                                        <input type="checkbox" id="aiContextToggle" ${saveHistory ? 'checked' : ''} onchange="if(!budget.aiContext) budget.aiContext={chat:[], analysis:''}; budget.aiContext.saveHistory = this.checked; saveBudget();" class="sr-only peer">
                                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                    </div>
                                    <label for="aiContextToggle" class="text-[9px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer select-none">Save Conversation Context</label>
                                </div>
                                <button id="saveApiKeyBtn" onclick="const p=document.getElementById('aiProviderSelect').value; const k=document.getElementById('apiKeyInput').value; const s=document.getElementById('aiSystemPromptInput').value; saveStoredApiKey(p,k); mBT.features.ai.saveSystemPrompt(s); localStorage.setItem('${storageKeyPrefix}selectedAiProvider', p); mBTME.alert('Success', 'Settings Updated');" class="w-full bg-blue-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg hover:bg-blue-500 transition-all mt-2">Synchronize Link</button>
                            </div>
                        </div>
                    </div>`;
        }
        if (tabName === 'database') {
            const nav = RenderEngine.ui.tabs({
                items: [
                    { id: 'lineItems', label: 'Line Items' },
                    { id: 'contacts', label: 'Contacts' },
                    { id: 'templates', label: 'Templates' }
                ],
                activeId: subTab,
                onClick: "mBT.features.settings.open('database',"
            }).replace(/open\('database',\s*'([^']+)'\)/g, "open('database', '$1')");

            return `<div class="flex flex-col h-full p-6 pb-0 overflow-hidden space-y-4">
                    ${nav.replace(/onclick="mBT.features.settings.open\('database',\('([^']+)'\)\)"/g, "onclick=\"mBT.features.settings.open('database', '$1')\"")} 
                    <div class="flex-grow flex flex-col relative overflow-hidden min-h-0">
                        ${this.renderDbView(subTab)}
                    </div>
                </div>`;
        }
        return `<div class="p-8 text-center text-slate-300 font-bold uppercase tracking-widest">Logic Stream Not Found</div>`;
    },

    // --- 3. Main Entry Point ---
    open: function (tab = 'general', subTab = 'lineItems') {
        const domId = 'settingsModal';
        const contentHTML = this.getTabContent(tab, subTab);

        // Tier 5 Update: Manual Tab Construction for Event Delegation
        const tabs = [
            { id: 'general', label: `General` },
            { id: 'database', label: `Database` },
            { id: 'ai', label: `Connections` }
        ];


        const tabNavHTML = `<div class="flex border-b border-slate-100 bg-slate-50/50 rounded-t-xl overflow-hidden select-none">
                ${tabs.map(t => {
            const isActive = t.id === tab;
            const activeClass = "bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm";
            const inactiveClass = "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50";
            return `<button data-action="nav-settings" data-tab="${t.id}" class="flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? activeClass : inactiveClass}">
                        ${t.label}
                    </button>`;
        }).join('')}
            </div>`;

        const existingModal = document.getElementById(domId);
        if (existingModal) {
            const contentArea = document.getElementById('settingsContentArea');
            const navArea = document.getElementById('settingsTabNav');
            if (contentArea) contentArea.innerHTML = contentHTML;
            if (navArea) navArea.innerHTML = tabNavHTML;
            this._attachListeners(tab, subTab);
            return;
        }

        const fullContent = `
                <div class="flex flex-col min-h-[600px] max-h-[90vh] bg-slate-50/50">
                    <div id="settingsTabNav" class="shrink-0 bg-white">
                        ${tabNavHTML}
                    </div>
                    <div id="settingsContentArea" class="flex-grow flex flex-col relative overflow-hidden">
                        ${contentHTML}
                    </div>
                </div>`;
        mBTME.open('settings', 'Settings', fullContent, 'max-w-2xl', { noPadding: true, hideHeader: true });
        this._attachListeners(tab, subTab);
    },

    // --- 4. Internal Logic & Listeners ---
    _attachListeners: function (tab, subTab) {
        if (tab === 'database' && subTab === 'lineItems') {
            mBTME.attachSearch('dbSearchInput', 'dbListBody', mBTOG.rates, (r) => RenderEngine.ui.listRow({
                id: r.id || r.description,
                icon: mBTAssets.money,
                title: r.description,
                subtitle: `${mBTLE.format.currency(r.rate)} / ${r.unit}`,
                classes: 'border-b border-slate-50'
            }));
        }
        if (tab === 'database' && subTab === 'contacts') {
            const globalContacts = mBTOG.contacts || [];
            const assignedContacts = [];
            Object.values(budget.sections || {}).forEach(sec => {
                sec.items.forEach(item => {
                    if (item.crew && item.crew.name) assignedContacts.push({ id: 'assigned_' + item.id, name: item.crew.name, role: item.description || 'Crew', assigned: true });
                });
            });
            const allContacts = [...globalContacts];
            assignedContacts.forEach(ac => { if (!allContacts.some(gc => gc.name.toLowerCase() === ac.name.toLowerCase())) allContacts.push(ac); });

            mBTME.attachSearch('contactsSearchInput', 'contactsListBody', allContacts, (c) => RenderEngine.ui.listRow({
                id: c.id,
                icon: c.name ? c.name.charAt(0).toUpperCase() : '?',
                title: c.name,
                subtitle: `${c.role || 'No Role'}${c.assigned ? ' (Assigned)' : ''}`,
                actions: c.assigned ? [] : [{ icon: mBTAssets.trash, title: 'Delete', color: 'rose', onClick: `mBT.features.settings.deleteContact('${c.id}')` }]
            }));
        }
        if (tab === 'database' && subTab === 'templates') {
            mBTME.attachSearch('templateSearchInput', 'templatesListBody', mBTOG.templates, (t) => RenderEngine.ui.listRow({
                id: t.id,
                icon: mBTAssets[t.icon] || mBTAssets.file,
                title: t.label,
                subtitle: t.cat || 'General',
                actions: [{ icon: mBTAssets.plus, title: 'Use Template', color: 'blue', onClick: `createNewDocumentFromTemplate('${t.id}')` }]
            }));
        }
    },

    // --- 5. Action Handlers ---
    openAddContactModal: function () {
        const dummyItem = { id: 'dummy_new_contact', crew: { name: '', phone: '', email: '' } };
        const dummySection = 'general';
        openCrewProfile(null, null, dummyItem.id, dummySection);
    },
    addContact: function (e) {
        // ... Logic moved here if invoked directly, but mostly handled by openCrewProfile form commit ...
    },
    deleteContact: function (id) {
        mBTME.confirm("Delete Contact", "Remove this global contact?", () => {
            const idx = mBTOG.contacts.findIndex(c => c.id === id);
            if (idx > -1) {
                mBTOG.contacts.splice(idx, 1);
                localStorage.setItem('moo_contacts', JSON.stringify(mBTOG.contacts));
                this.open('database', 'contacts'); // Refresh
            }
        });
    },

    // --- 6. Database Tools (Tier 5 Additions) ---
    openAddRateModal: function () {
        const content = `
                <div class="space-y-4 p-2">
                    <div>
                        <label class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
                        <input type="text" id="newRateDesc" class="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black uppercase tracking-tighter outline-none focus:ring-2 focus:ring-blue-100" placeholder="ITEM NAME">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Rate</label>
                            <input type="number" id="newRateVal" class="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-100" placeholder="0.00">
                        </div>
                        <div>
                            <label class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Unit</label>
                            <select id="newRateUnit" class="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none cursor-pointer">
                                <option value="Day">Day</option>
                                <option value="Flat">Flat</option>
                                <option value="Week">Week</option>
                                <option value="Hour">Hour</option>
                            </select>
                        </div>
                    </div>
                    <button onclick="mBT.features.settings.addRate()" class="w-full py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-black transition-all active:scale-95 mt-4">Add to Database</button>
                </div>`;
        mBTME.open('addRate', 'New Global Rate', content, 'max-w-sm');
    },

    addRate: function () {
        const desc = document.getElementById('newRateDesc').value.trim();
        const rate = parseFloat(document.getElementById('newRateVal').value) || 0;
        const unit = document.getElementById('newRateUnit').value;

        if (!desc) return mBTME.alert("Error", "Description required");

        mBTOG.rates.push({ description: desc, rate: rate, unit: unit });
        mBTOG.saveRates(); // Calls Tier 2.5 persistence

        mBTME.close('addRateModal');
        this.open('database', 'lineItems'); // Refresh list
    },

    toggleOpenGateSharing: function () {
        mBTOG.settings.optInSharing = !mBTOG.settings.optInSharing;
        localStorage.setItem('moo_og_share', JSON.stringify(mBTOG.settings.optInSharing));

        // Visual feedback
        if (mBTOG.settings.optInSharing) {
            mBTME.alert("Sharing Active", "Open Gate Sharing Enabled. Anonymous rate data will be synchronized.");
        }
        this.open('database', 'lineItems'); // Refresh UI toggle state
    }
};

/* ========= v19.54 FINANCE ENGINE (mBT.features.finance) ========= */
mBT.features.finance = {
    // --- 1. Ledger Interface (Visuals) ---
    openLedger: function () {
        if (!budget.ledger) budget.ledger = [];
        const ledger = budget.ledger.sort((a, b) => new Date(b.date) - new Date(a.date));
        const totalSpent = ledger.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

        const rows = ledger.length > 0 ? ledger.map(tx => {
            const hasDoc = tx.receipt ? 'text-blue-500 hover:text-blue-700 cursor-pointer' : 'text-slate-200';
            const docAction = tx.receipt ? `mBT.features.finance.viewReceipt('${tx.receipt}')` : '';
            return `
                <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td class="p-3 text-[9px] font-bold text-slate-500">${tx.date}</td>
                    <td class="p-3">
                        <div class="text-[10px] font-black uppercase text-slate-700">${mBT.ui.render.esc(tx.payee)}</div>
                        <div class="text-[8px] font-bold text-slate-400">${mBT.ui.render.esc(tx.description)}</div>
                    </td>
                    <td class="p-3 text-[9px] font-mono font-bold text-slate-500 uppercase text-center bg-slate-50/50">${tx.method || 'CASH'}</td>
                    <td class="p-3 text-center">
                        <button onclick="${docAction}" class="${hasDoc} transition-colors" title="${tx.receipt ? 'View Receipt' : 'No Receipt'}">
                            ${mBTAssets.clip}
                        </button>
                    </td>
                    <td class="p-3 text-right font-mono font-black text-[10px] text-emerald-600">${mBTLE.format.currency(tx.amount)}</td>
                </tr>`;
        }).join('') : `<tr><td colspan="5" class="p-8 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest">No Transactions Recorded</td></tr>`;

        const content = `
                <div class="flex flex-col h-[600px] max-h-[80vh] bg-slate-50">
                    <div class="p-6 bg-white border-b border-slate-100 flex justify-between items-end shrink-0 z-10">
                        <div>
                            <h3 class="text-lg font-black uppercase tracking-tighter text-slate-900">General Ledger</h3>
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Master Record</p>
                        </div>
                        <div class="text-right">
                            <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Outflow</div>
                            <div class="text-2xl font-black text-emerald-600 tracking-tighter leading-none">${mBTLE.format.currency(totalSpent)}</div>
                        </div>
                    </div>
                    
                    <div class="flex-grow overflow-auto no-scrollbar p-0 bg-white">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                                <tr>
                                    <th class="p-3 text-[8px] font-black uppercase tracking-widest text-slate-400 w-24">Date</th>
                                    <th class="p-3 text-[8px] font-black uppercase tracking-widest text-slate-400">Payee / Description</th>
                                    <th class="p-3 text-[8px] font-black uppercase tracking-widest text-slate-400 text-center w-24">Method</th>
                                    <th class="p-3 text-[8px] font-black uppercase tracking-widest text-slate-400 text-center w-10">Doc</th>
                                    <th class="p-3 text-[8px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Amount</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                    
                    <div class="p-4 border-t border-slate-100 bg-white flex justify-end gap-2 shrink-0">
                        <button onclick="mBT.features.finance.showExportOptions()" class="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-lg flex items-center gap-2">
                            ${mBTAssets.cloud} Accounting Export
                        </button>
                    </div>
                </div>`;

        mBTME.open('ledger', 'Finance', content, 'max-w-2xl', { hideHeader: true, noPadding: true });
    },

    // --- 1.5 Receipt Viewer ---
    viewReceipt: async function (blobKey) {
        try {
            const blobUrl = await mBT.data.storage.loadBlob(blobKey);
            if (!blobUrl) return mBTME.alert("Error", "File not found.");
            mBTME.open('receiptView', 'Receipt Proof',
                `<div class="flex justify-center bg-slate-900 p-4 h-full"><img src="${blobUrl}" class="max-w-full max-h-[80vh] object-contain rounded shadow-lg"></div>`,
                'max-w-4xl', { noPadding: true }
            );
        } catch (e) { mBTME.alert("Error", "Could not load file."); }
    },

    // --- 2. Logic Engine (Controller) ---
    recordTransaction: function (data) {
        if (!budget.ledger) budget.ledger = [];
        const tx = {
            id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            ts: new Date().toISOString(),
            ...data
        };
        budget.ledger.push(tx);

        if (data.itemId && data.sectionName) {
            const item = budget.sections[data.sectionName]?.items.find(i => i.id === data.itemId);
            if (item) item.actual = (parseFloat(item.actual) || 0) + parseFloat(data.amount);
        }

        if (data.payee) {
            const globalContact = mBTOG.contacts.find(c => c.name.toLowerCase() === data.payee.toLowerCase());
            if (globalContact) {
                if (!globalContact.payments) globalContact.payments = [];
                globalContact.payments.push({
                    projectId: budget.projectName,
                    date: data.date,
                    amount: data.amount,
                    currency: displayCurrency,
                    service: data.method,
                    description: data.description,
                    receipt: data.receipt
                });
                mBTOG.saveContacts();
            }
        }

        mBTLE.reconcile();
        saveBudget();
        mBT.ui.paint();
        if (mBT.data.state.audit) mBT.data.state.audit('PAYMENT', `${data.payee} (${mBTLE.format.currency(data.amount)})`, { section: 'Finance' });
        return tx;
    },

    // --- 3. UI Helpers ---
    openModal: function (itemId) {
        let item = null;
        let sectionName = null;
        Object.entries(budget.sections).forEach(([secName, sec]) => {
            const found = sec.items.find(i => i.id === itemId);
            if (found) { item = found; sectionName = secName; }
        });

        if (!item) return mBTME.alert("Error", "Line item not found.");

        const est = parseFloat(item.total) || 0;
        const act = parseFloat(item.actual) || 0;
        const balance = est - act;
        const contactName = item.crew?.name || item.description;

        const content = mBT.ui.render.paymentModal(itemId, contactName, balance, displayCurrency);
        // Inject Hidden Context + File Input Container
        const wrapper = `
                <div id="paymentContext" data-section="${sectionName}" data-item-desc="${mBT.ui.render.esc(item.description)}" data-payee="${mBT.ui.render.esc(contactName)}"></div>
                <div id="paymentFormRoot">${content}</div>
            `;
        mBTME.open('payment', 'Issue Payment', wrapper, 'max-w-sm', { hideHeader: true, noPadding: true });

        setTimeout(() => {
            const formContainer = document.querySelector('#paymentFormRoot .space-y-4');
            if (formContainer) {
                const uploadHtml = `
                        <div class="pt-2 border-t border-slate-100">
                            <label class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Receipt / Invoice</label>
                            <input type="file" id="payReceipt" accept="image/*,.pdf" class="block w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all">
                        </div>`;
                formContainer.insertAdjacentHTML('beforeend', uploadHtml);
            }
            const input = document.getElementById('payAmount'); if (input) input.focus();
        }, 50);
    },

    processPayment: async function (itemId) {
        const amount = parseFloat(document.getElementById('payAmount').value);
        const method = document.getElementById('payService').value;
        const date = document.getElementById('payDate').value;
        const fileInput = document.getElementById('payReceipt');
        const ctx = document.getElementById('paymentContext');

        if (!amount || amount <= 0) return mBTME.alert("Error", "Valid amount required.");
        if (!ctx) return mBTME.alert("Error", "Context lost.");

        let receiptKey = null;
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 5 * 1024 * 1024) return mBTME.alert("Error", "File too large (Max 5MB).");
            receiptKey = `rcpt_${Date.now()}`;
            try {
                mBTME.showLoader("Saving Receipt...");
                await mBT.data.storage.saveBlob(receiptKey, file);
                mBTME.hideLoader();
            } catch (e) { mBTME.hideLoader(); return mBTME.alert("Error", "File save failed."); }
        }

        this.recordTransaction({
            itemId,
            sectionName: ctx.dataset.section,
            amount,
            date,
            method,
            receipt: receiptKey,
            payee: ctx.dataset.payee,
            description: ctx.dataset.itemDesc
        });

        mBTME.close('paymentModal');
        mBTME.alert("Success", `Logged payment of ${mBTLE.format.currency(amount)}`);
    },

    // --- 4. Export Suite (The Backend Bridge) ---
    showExportOptions: function () {
        const content = `
                <div class="grid grid-cols-1 gap-4 p-6 bg-slate-50">
                    <button onclick="mBT.features.finance.runExport('excel')" class="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all group text-left">
                        <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">${mBTAssets.grid}</div>
                        <div>
                            <h4 class="font-black text-xs uppercase tracking-widest text-slate-800">Excel / CSV Master</h4>
                            <p class="text-[10px] text-slate-400 font-bold mt-1">Full detail dump for Offline use</p>
                        </div>
                    </button>

                    <button onclick="mBT.features.finance.runExport('wise')" class="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group text-left">
                        <div class="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">${mBTAssets.globe}</div>
                        <div>
                            <h4 class="font-black text-xs uppercase tracking-widest text-slate-800">Wise Batch Payment</h4>
                            <p class="text-[10px] text-slate-400 font-bold mt-1">Bulk upload file for TransferWise</p>
                        </div>
                    </button>

                    <button onclick="mBT.features.finance.runExport('qb')" class="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all group text-left">
                        <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">${mBTAssets.file}</div>
                        <div>
                            <h4 class="font-black text-xs uppercase tracking-widest text-slate-800">QuickBooks Online</h4>
                            <p class="text-[10px] text-slate-400 font-bold mt-1">Web Connect / Bank Feed Format</p>
                        </div>
                    </button>

                    <div class="border-t border-slate-200 my-2"></div>

                    <button onclick="mBT.features.finance.runExport('api')" class="flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all group text-left">
                        <div class="w-12 h-12 bg-emerald-900 text-emerald-400 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">${mBTAssets.zap}</div>
                        <div>
                            <h4 class="font-black text-xs uppercase tracking-widest text-white">Cloud Dispatch</h4>
                            <p class="text-[10px] text-slate-500 font-bold mt-1">Push JSON to Webhook / Studio API</p>
                        </div>
                    </button>
                </div>`;

        mBTME.open('exportMenu', 'Accounting Bridge', content, 'max-w-sm', { noPadding: true });
    },

    runExport: async function (type) {
        if (!budget.ledger?.length) return mBTME.alert("Empty", "No transactions to export.");

        let content = "";
        let filename = `${budget.projectName}_Export.csv`;
        const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

        // --- ONLINE ADD-ON: API Dispatch Logic ---
        if (type === 'api') {
            if (!navigator.onLine) return mBTME.alert("Offline", "Cloud Dispatch requires an internet connection.");

            const storedUrl = localStorage.getItem(`${storageKeyPrefix}cloudWebhook`) || "https://";

            mBTME.prompt("Cloud Dispatch", "Confirm Endpoint URL:", storedUrl, async (url) => {
                if (!url || url === "https://") return;

                // Auto-save the used URL for convenience if different
                if (url !== storedUrl) localStorage.setItem(`${storageKeyPrefix}cloudWebhook`, url);

                mBTME.showLoader("Dispatching Ledger...");
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            project: budget.projectName,
                            timestamp: new Date().toISOString(),
                            ledger: budget.ledger,
                            totals: { estimated: budget.grandTotal, actual: budget.actualTotal }
                        })
                    });

                    mBTME.hideLoader();
                    if (response.ok) mBTME.alert("Success", "Ledger synchronized with Cloud Endpoint.");
                    else throw new Error(`Server responded with ${response.status}`);
                } catch (e) {
                    mBTME.hideLoader();
                    mBTME.alert("Dispatch Failed", e.message);
                }
            });
            return;
        }

        // --- OFFLINE CORE: CSV Generation Logic ---
        if (type === 'excel') {
            const headers = ["Date", "Payee", "Description", "Method", "Amount", "Currency", "Transaction ID"];
            const rows = budget.ledger.map(t => [t.date, t.payee, t.description, t.method, t.amount, displayCurrency, t.id].map(escape).join(","));
            content = headers.join(",") + "\n" + rows.join("\n");
            filename = `${budget.projectName}_MasterLedger.csv`;
        }
        else if (type === 'wise') {
            const headers = ["sourceCurrency", "targetCurrency", "amount", "recipientName", "reference"];
            const rows = budget.ledger.map(t => [displayCurrency, displayCurrency, t.amount, t.payee, `${budget.projectName}: ${t.description}`.substring(0, 30)].map(escape).join(","));
            content = headers.join(",") + "\n" + rows.join("\n");
            filename = `${budget.projectName}_WiseBatch.csv`;
        }
        else if (type === 'qb') {
            const headers = ["Date", "Description", "Amount", "Payee", "RefNumber"];
            const rows = budget.ledger.map(t => [t.date, t.description, `-${t.amount}`, t.payee, t.id.split('_')[2]].map(escape).join(","));
            content = headers.join(",") + "\n" + rows.join("\n");
            filename = `${budget.projectName}_QuickBooks.csv`;
        }

        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        mBTPublisher.io.forceDownload(blob, filename);
        mBTME.close('exportMenuModal');
    }
};

/* --- v19.54 PUBLISH BRIDGE --- */
window.showPublishModal = function () {
    const content = `
        <div class="grid grid-cols-1 gap-4 p-6">
            <!-- PDF Button -->
            <button data-action="export" data-type="pdf" class="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group text-left">
                <div class="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">${mBTAssets.print}</div>
                <div>
                    <h4 class="font-black text-xs uppercase tracking-widest text-slate-800">Export PDF (Report)</h4>
                    <p class="text-[10px] text-slate-400 font-bold mt-1">Professional Formatted Document</p>
                </div>
            </button>

            <!-- Save Project (Bundle .moo) -->
            <button data-action="export" data-type="bundle" class="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all group text-left">
                <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">${mBTAssets.save}</div>
                <div>
                    <h4 class="font-black text-xs uppercase tracking-widest text-slate-800">Master Project File</h4>
                    <p class="text-[10px] text-slate-400 font-bold mt-1">Unified Container (.moo) - Includes Assets</p>
                </div>
            </button>
            
            <!-- Digital/HTML -->
           <button data-action="export" data-type="html" class="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-purple-500 hover:shadow-lg transition-all group text-left">
                <div class="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">${mBTAssets.phone}</div>
                <div>
                    <h4 class="font-black text-xs uppercase tracking-widest text-slate-800">Digital Export</h4>
                    <p class="text-[10px] text-slate-400 font-bold mt-1">Interactive HTML Call Sheet</p>
                </div>
            </button>

            <!-- Excel -->
            <button data-action="export" data-type="xlsx" class="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all group text-left">
                <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">${mBTAssets.grid}</div>
                <div>
                    <h4 class="font-black text-xs uppercase tracking-widest text-slate-800">Excel Export</h4>
                    <p class="text-[10px] text-slate-400 font-bold mt-1">Spreadsheet (.xlsx)</p>
                </div>
            </button>
        </div>`;
    mBTME.open('publish', 'Publish & Export', content, 'max-w-sm');
};

// --- Backward Compatibility Alias ---
// Fix: We use .bind() to ensure 'this' refers to the settings object, not the window
window.showSettingsModal = mBT.features.settings.open.bind(mBT.features.settings);

// ---- Tier 5 Part 3 ---- //



/* ========= v19.54 DOCUMENTS HUB (mBT.features.documents) ========= */
mBT.features.documents = {
    // Logic Resolution: Creates a new document instance from a template definition
    createFromTemplate: function (templateId) {
        const tmpl = mBTOG.templates.find(t => t.id === templateId);
        if (!tmpl) return mBTME.alert("Error", "Template definition not found.");

        const newDoc = {
            id: 'doc_' + Date.now(),
            type: tmpl.id,
            label: tmpl.label,
            content: {
                data: mBTDB._generateDefaultData(),
                widgets: [] // Populated by mBTDB.open based on type defaults
            }
        };

        if (!budget.documents) budget.documents = [];
        budget.documents.push(newDoc);

        saveBudget();
        mBTME.close('newDocSelectorModal');

        // Refresh Vault list if open
        if (document.getElementById('documentsModal')) this.openVault();

        // Logic Resolution: Intercept auto-open. Show options instead.
        this.showOptions(newDoc.id);
    },

    // Logic Resolution: Opens the Document Vault (List of saved docs)
    openVault: function (activeTab = 'All') {
        const docs = budget.documents || [];

        // Helper: Resolve Template Metadata
        const getTmpl = (type) => mBTOG.templates.find(x => x.id === type) || { cat: 'Other', icon: 'file' };
        const getCat = (type) => getTmpl(type).cat;
        const getIcon = (type) => mBTAssets[getTmpl(type).icon] || mBTAssets.file;

        // Filter Logic
        const filteredDocs = activeTab === 'All'
            ? docs
            : docs.filter(d => getCat(d.type) === activeTab);

        // Logic Resolution: View Layout Strategy linked to Settings
        const isCompact = budget.settings?.compactMode || false;

        // 2. Define Layout Classes (Grid vs List)
        const listContainerClass = (isCompact && filteredDocs.length > 0)
            ? 'grid grid-cols-2 md:grid-cols-3 gap-4 content-start'
            : 'flex flex-col gap-3';

        // 3. Adjust Modal Width based on View
        const modalWidth = (isCompact && filteredDocs.length > 0) ? 'max-w-5xl' : 'max-w-2xl';

        // Logic Resolution: Dynamic Item Renderer (Grid Card vs List Row)
        const renderDocItem = (doc) => {
            const iconSvg = getIcon(doc.type);
            if (isCompact) {
                // Grid Card (Vertical Layout) - Tier 5 Event Delegation Update
                return `
                    <div class="relative group bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center gap-3 text-center h-full" data-action="doc-options" data-id="${doc.id}">
                         <div class="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors shrink-0">
                            ${iconSvg}
                         </div>
                         <div class="w-full overflow-hidden">
                            <div class="text-[10px] font-black uppercase text-slate-700 truncate w-full" title="${RenderEngine.esc(doc.label)}">${RenderEngine.esc(doc.label || 'Untitled')}</div>
                            <div class="text-[9px] text-slate-400 font-bold truncate w-full">${doc.type ? doc.type.toUpperCase() : 'DOC'}</div>
                         </div>
                         <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 rounded-lg shadow-sm p-1">
                            <button data-action="doc-duplicate" data-id="${doc.id}" class="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-500 rounded" title="Duplicate">${mBTAssets.copy}</button>
                            <button data-action="doc-archive" data-id="${doc.id}" class="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded" title="Archive">${mBTAssets.trash}</button>
                         </div>
                    </div>`;
            } else {
                // List Row (Horizontal Layout) - Tier 5 Event Delegation Update
                return `<div class="group bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between cursor-pointer">
                        <div class="flex items-center gap-4 flex-grow overflow-hidden" data-action="doc-options" data-id="${doc.id}">
                            <div class="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform shrink-0">
                                ${iconSvg}
                            </div>
                            <div class="min-w-0">
                                <h4 class="font-black text-slate-900 text-xs uppercase tracking-tighter truncate">${mBT.ui.render.esc(doc.label || 'Untitled Document')}</h4>
                                <p class="text-[9px] text-blue-500 font-bold uppercase tracking-widest truncate">${doc.type ? doc.type.charAt(0).toUpperCase() + doc.type.slice(1) : 'Document'}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button data-action="doc-duplicate" data-id="${doc.id}" class="p-2 text-slate-300 hover:text-blue-600 transition-colors" title="Duplicate">${mBTAssets.copy}</button>
                            <button data-action="doc-archive" data-id="${doc.id}" class="p-2 text-slate-300 hover:text-rose-600 transition-colors" title="Archive">${mBTAssets.trash}</button>
                        </div>
                    </div>`;
            }
        };

        const docsHtml = filteredDocs.length > 0
            ? filteredDocs.map(renderDocItem).join('')
            : `<div class="col-span-full">${RenderEngine.ui.emptyState({
                icon: mBTAssets.file,
                message: activeTab === 'All' ? 'Vault is Empty' : 'No Documents',
                subtext: 'Create a new document to get started'
            })}</div>`;

        // Tab Navigation
        const categories = ['All', 'Pre-Prod', 'Production', 'Post-Prod', 'Legal'];

        // Tier 5 Update: Manual Tab Construction for Event Delegation
        const tabHtml = `<div class="flex border-b border-slate-100 bg-slate-50/50 rounded-t-xl overflow-hidden select-none">
                ${categories.map(c => {
            const count = c === 'All' ? docs.length : docs.filter(d => getCat(d.type) === c).length;
            const isActive = c === activeTab;
            const activeClass = "bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm";
            const inactiveClass = "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50";
            return `<button data-action="nav-docs" data-tab="${c}" class="flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? activeClass : inactiveClass}">
                        ${c} <span class="opacity-50 ml-1">(${count})</span>
                    </button>`;
        }).join('')}
            </div>`;

        // Logic Resolution: Persistent UI Updates (Prevents Flickering/Re-opening)
        const domId = 'documentsModal';
        const existingModal = document.getElementById(domId);

        if (existingModal) {
            const nav = document.getElementById('docsTabNav');
            const list = document.getElementById('activeDocsList');

            if (nav) nav.innerHTML = tabHtml;
            if (list) {
                list.className = listContainerClass;
                list.innerHTML = docsHtml;
            }

            const searchContainer = document.getElementById('docSearchContainer');
            if (searchContainer) {
                searchContainer.innerHTML = `<input type="text" id="docSearch" placeholder="SEARCH ${activeTab.toUpperCase()}..." class="w-full p-3 pr-10 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-50 transition-all"><div class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">${mBTAssets.search}</div>`;
            }

            mBTME.attachSearch('docSearch', 'activeDocsList', filteredDocs, renderDocItem);
            return;
        }

        const content = `
                <div class="flex flex-col max-h-[90vh]">
                    <div class="p-6 pb-0 bg-white border-b border-slate-100 flex-shrink-0 z-10 space-y-4">
                        <div class="flex justify-between items-center relative">
                            <!-- Left: Add Button -->
                            <button onclick="mBT.features.documents.openTemplateSelector()" class="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-sm active:scale-95">
                                ${mBTAssets.plus} Add
                            </button>
                            
                            <!-- Center: Title -->
                            <h3 class="absolute left-1/2 -translate-x-1/2 font-black text-slate-900 text-xs uppercase tracking-widest">DOCUMENTS</h3>
                            
                            <!-- Right: Actions -->
                            <div class="flex gap-2">
                                <button onclick="mBT.features.trash.open('documents')" class="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all" title="Recycle Bin">${mBTAssets.trash}</button>
                                <button onclick="mBTME.close('documentsModal')" class="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-all">${mBTAssets.close}</button>
                            </div>
                        </div>
                        
                        <!-- Search -->
                        <div class="relative" id="docSearchContainer">
                            <input type="text" id="docSearch" placeholder="SEARCH DOCUMENTS..." class="w-full p-3 pr-10 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-50 transition-all">
                            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">${mBTAssets.search}</div>
                        </div>

                        <!-- Tab Nav -->
                        <div id="docsTabNav" class="-mb-px">
                            ${tabHtml}
                        </div>
                    </div>
                    
                    <div class="flex-grow overflow-y-auto no-scrollbar bg-slate-50/50 p-6">
                        <div id="activeDocsList" class="${listContainerClass}">
                            ${docsHtml}
                        </div>
                    </div>
                </div>`;

        mBTME.open('documents', 'Documents', content, modalWidth, { noPadding: true, hideHeader: true });

        mBTME.attachSearch('docSearch', 'activeDocsList', filteredDocs, renderDocItem);
    },

    // Logic Resolution: Opens the Template Selector (Blueprints)
    openTemplateSelector: function () {
        const templates = mBTOG.templates || [];
        const renderTmplItem = (tmpl) => RenderEngine.ui.card({
            id: tmpl.id,
            icon: mBTAssets[tmpl.icon] || mBTAssets.file,
            title: tmpl.label,
            subtitle: tmpl.cat || 'General',
            onClick: `mBT.features.documents.createFromTemplate('${tmpl.id}')`,
            actions: [{ icon: mBTAssets.plus, title: 'Create', color: 'blue', onClick: `mBT.features.documents.createFromTemplate('${tmpl.id}')` }]
        });

        const templateHtml = templates.map(renderTmplItem).join('');

        // Logic Resolution: Custom Layout (White Theme) to eliminate black studio headers
        const content = `
                <div class="flex flex-col max-h-[80vh] bg-slate-50">
                    <div class="p-4 bg-white border-b border-slate-100 flex-shrink-0 z-10 space-y-2">
                        <div class="flex justify-between items-center">
                            <h3 class="font-black text-slate-900 text-sm uppercase tracking-widest">Select Template</h3>
                            <button onclick="mBTME.close('newDocSelectorModal')" class="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-all">${mBTAssets.close}</button>
                        </div>
                        <div class="relative">
                            <input type="text" id="tmplSearch" placeholder="FILTER TEMPLATES..." class="w-full p-3 pr-10 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-50 transition-all">
                            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">${mBTAssets.search}</div>
                        </div>
                    </div>
                    <div id="templateListBody" class="flex-grow overflow-y-auto no-scrollbar p-4 space-y-3">
                        ${templateHtml}
                    </div>
                </div>`;

        mBTME.open('newDocSelector', 'Studio Blueprints', content, 'max-w-md', { noPadding: true, hideHeader: true });

        mBTME.attachSearch('tmplSearch', 'templateListBody', templates, renderTmplItem);
    },

    // Logic Resolution: Opens the Action Menu for choosing editor or storage
    showOptions: function (docId) {
        const doc = budget.documents.find(d => d.id === docId);
        if (!doc) return;

        const attachments = doc.attachments || [];
        const hasFile = attachments.length > 0;

        // Helper: Render Attachment List
        const renderAttachmentList = () => {
            if (attachments.length === 0) return '<div class="text-center text-[10px] text-slate-400 font-bold p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 col-span-2">No files attached</div>';

            return attachments.map((file, idx) => {
                const isImg = file.type && file.type.startsWith('image/');
                const src = (isImg && file.location !== 'internal') ? file.data : null;

                return RenderEngine.ui.mediaCard({
                    id: idx,
                    title: file.name,
                    type: file.type.split('/')[1]?.toUpperCase() || 'FILE',
                    size: file.size || 'N/A',
                    location: file.location || 'legacy',
                    src: src,
                    onClick: `mBT.features.documents.previewAttachment('${docId}', ${idx})`,
                    actions: [
                        { icon: mBTAssets.print, title: 'Print', color: 'slate', onClick: `mBT.features.documents.printAttachment('${docId}', ${idx})` },
                        { icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`, title: 'Download', color: 'blue', onClick: `mBT.features.documents.downloadAttachment('${docId}', ${idx})` },
                        { icon: mBTAssets.trash, title: 'Remove', color: 'rose', onClick: `mBT.features.documents.removeAttachment('${docId}', ${idx})` }
                    ]
                });
            }).join('');
        };

        const content = `
                <div class="flex flex-col h-full bg-slate-50">
                    <div class="grid grid-cols-1 gap-4 p-6 shrink-0">
                        ${!hasFile ? `
                        <button onclick="mBTME.close('docOptionsModal'); mBTDB.open('${docId}');" 
                            class="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group text-left w-full">
                            <div class="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                ${mBTAssets.wand}
                            </div>
                            <div>
                                <h4 class="font-black text-xs uppercase tracking-widest text-slate-800">Open Studio</h4>
                                <p class="text-[10px] text-slate-400 font-bold mt-1">Interactive Editor</p>
                            </div>
                        </button>` : ''}

                        <div class="relative">
                            <button onclick="document.getElementById('docUpload_${docId}').click()" 
                                class="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all group text-left w-full">
                                <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                    ${mBTAssets.cloud}
                                </div>
                                <div>
                                    <h4 class="font-black text-xs uppercase tracking-widest text-slate-800">${hasFile ? 'Replace Existing' : 'Upload Existing'}</h4>
                                    <p class="text-[10px] text-slate-400 font-bold mt-1">PDF, Word, Excel, Images</p>
                                </div>
                            </button>
                            <input type="file" id="docUpload_${docId}" class="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*" onchange="mBT.features.documents.handleFileUpload('${docId}', this)">
                        </div>
                    </div>
                    
                    <div class="px-6 pb-2">
                        <h4 class="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2 mb-3">Attachments</h4>
                    </div>
                    <div class="flex-grow overflow-y-auto px-6 pb-6 no-scrollbar grid grid-cols-2 gap-3 content-start" style="max-height: 200px;">
                        ${renderAttachmentList()}
                    </div>
                </div>`;

        mBTME.open('docOptions', 'Document Actions', content, 'max-w-sm', { noPadding: true });
    },

    // Logic Resolution: Handles file attachments with proper format support
    handleFileUpload: async function (docId, input) {
        const file = input.files[0];
        if (!file) return;

        // Stability Limit: 7MB (IndexedDB Support)
        if (file.size > 7 * 1024 * 1024) {
            mBTME.alert("File Too Large", "Please upload files smaller than 7MB to ensure offline storage stability.");
            return;
        }

        const doc = budget.documents.find(d => d.id === docId);
        if (!doc) return;
        if (!doc.attachments) doc.attachments = [];

        // Protocol Branching: Bundle Mode vs Legacy
        if (budget.storageProtocol === 'internal') {
            const blobKey = `blob_${docId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            try {
                await mBT.data.storage.saveBlob(blobKey, file);
                doc.attachments.push({
                    name: file.name,
                    type: file.type || 'application/octet-stream',
                    location: 'internal',
                    key: blobKey,
                    data: null,
                    size: (file.size / 1024).toFixed(1) + ' KB',
                    ts: new Date().toISOString()
                });
                saveBudget();
                this.showOptions(docId);
            } catch (e) {
                console.error("Blob Storage Failed", e);
                mBTME.alert("Upload Error", "Failed to store file internally.");
            }
        } else {
            // Legacy Base64 Path
            const reader = new FileReader();
            reader.onload = (e) => {
                doc.attachments.push({
                    name: file.name,
                    type: file.type || 'application/octet-stream',
                    data: e.target.result,
                    ts: new Date().toISOString()
                });
                saveBudget();
                // Instant Refresh (No blocking alert)
                this.showOptions(docId);
            };
            reader.readAsDataURL(file);
        }
    },

    // --- NEW: Binary Conversion Utility ---
    _base64ToBuffer: function (base64) {
        const binary_string = window.atob(base64.split(',')[1]);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    },

    // --- NEW: Universal Preview Engine ---
    previewAttachment: async function (docId, index) {
        const doc = budget.documents.find(d => d.id === docId);
        if (!doc || !doc.attachments || !doc.attachments[index]) return;

        // Hybrid Clone to protect state
        const file = { ...doc.attachments[index] };
        const name = file.name.toLowerCase();

        // Resolve Internal Blob
        if (file.location === 'internal' && file.key) {
            file.data = await mBT.data.storage.loadBlob(file.key);
        }

        // A. Images: Direct Render
        if (file.type.includes('image')) {
            mBTME.open('previewFile', file.name, `<div class="flex justify-center bg-slate-900 p-4"><img src="${file.data}" class="max-w-full h-auto rounded shadow-lg"></div>`, 'max-w-4xl');
            return;
        }

        // B. Binary Buffer Resolution (Legacy Base64 or Blob Fetch)
        let buffer;
        if (file.location === 'internal') {
            const response = await fetch(file.data); // file.data is blobUrl here
            buffer = await response.arrayBuffer();
        } else {
            buffer = this._base64ToBuffer(file.data);
        }

        // C. PDF: Blob URL -> iFrame
        if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
            let url;
            if (file.location === 'internal') {
                url = file.data;
            } else {
                const blob = new Blob([buffer], { type: 'application/pdf' });
                url = URL.createObjectURL(blob);
            }
            mBTME.open('previewFile', file.name, `<iframe src="${url}" class="w-full h-[80vh] border-none bg-slate-100"></iframe>`, 'max-w-5xl', { noPadding: true });
        }
        // D. Word (DOCX): Mammoth.js
        else if (name.endsWith('.docx')) {
            if (typeof mammoth === 'undefined') return mBTME.alert("Error", "Word viewer offline.");
            mBTME.showLoader("Converting DOCX...");
            mammoth.convertToHtml({ arrayBuffer: buffer })
                .then(result => {
                    mBTME.hideLoader();
                    mBTME.open('previewFile', file.name, `<div class="prose prose-sm max-w-none p-8 bg-white text-slate-800">${result.value}</div>`, 'max-w-3xl');
                })
                .catch(err => { mBTME.hideLoader(); mBTME.alert("Conversion Error", err.message); });
        }
        // E. Excel (XLSX): SheetJS
        else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            if (typeof XLSX === 'undefined') return mBTME.alert("Error", "Excel viewer offline.");
            try {
                const wb = XLSX.read(buffer, { type: 'array' });
                const sheetName = wb.SheetNames[0];
                const html = XLSX.utils.sheet_to_html(wb.Sheets[sheetName]);
                mBTME.open('previewFile', file.name, `<div class="overflow-auto p-4 bg-white text-xs spreadsheet-view">${html}</div>`, 'max-w-5xl');
            } catch (e) { mBTME.alert("Error", "Could not parse spreadsheet."); }
        }
        // Fallback
        else {
            mBTME.alert("Preview Unavailable", "This file type cannot be previewed. Please download it.");
        }
    },

    // --- NEW: Print Driver (Indirect Iframe Injection) ---
    printAttachment: async function (docId, index) {
        const doc = budget.documents.find(d => d.id === docId);
        if (!doc || !doc.attachments || !doc.attachments[index]) return;

        const file = { ...doc.attachments[index] };

        // Resolve Internal Blob if needed
        if (file.location === 'internal' && file.key) {
            file.data = await mBT.data.storage.loadBlob(file.key);
        }

        if (file.type.includes('image') || file.type === 'application/pdf') {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = file.data;
            document.body.appendChild(iframe);

            // Allow buffer time for rendering before print dialog
            iframe.onload = function () {
                setTimeout(() => {
                    try {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                    } catch (e) {
                        console.warn("Auto-print failed, opening new tab fallback.");
                        window.open(file.data, '_blank');
                    }
                    // Cleanup
                    setTimeout(() => document.body.removeChild(iframe), 60000);
                }, 500);
            };
        } else {
            mBTME.alert("Print Error", "Cannot print this file type directly. Please download it.");
        }
    },

    // Logic Resolution: Trigger download from internal DataURL
    downloadAttachment: async function (docId, index) {
        const doc = budget.documents.find(d => d.id === docId);
        if (doc && doc.attachments && doc.attachments[index]) {
            const file = doc.attachments[index];
            let blob = null;

            // Helper: DataURL to Blob for robust download
            const dataURLtoBlob = (dataurl) => {
                try {
                    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
                        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
                    while (n--) { u8arr[n] = bstr.charCodeAt(n); }
                    return new Blob([u8arr], { type: mime });
                } catch (e) {
                    console.error("Blob Conversion Failed", e);
                    return null;
                }
            };

            // Logic Upgrade: Hybrid Download
            if (file.location === 'internal' && file.key) {
                const blobUrl = await mBT.data.storage.loadBlob(file.key);
                if (blobUrl) {
                    const response = await fetch(blobUrl);
                    blob = await response.blob();
                }
            } else {
                blob = dataURLtoBlob(file.data);
            }

            // Primary Path: Use Publisher Engine
            if (blob && typeof mBTPublisher !== 'undefined' && mBTPublisher.io) {
                mBTPublisher.io.forceDownload(blob, file.name);
            }
            // Fallback Path: Direct Browser Action
            else if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        }
    },

    removeAttachment: function (docId, index) {
        mBTME.confirm("Remove Attachment", "Delete this file attachment?", () => {
            const doc = budget.documents.find(d => d.id === docId);
            if (doc && doc.attachments) {
                doc.attachments.splice(index, 1);
                saveBudget();
                this.showOptions(docId);
            }
        });
    }
};

// --- Global Aliases for Backward Compatibility (Footer Buttons & Switchboard) ---
window.showDocumentsModal = mBT.features.documents.openVault.bind(mBT.features.documents);
window.showNewDocumentSelector = mBT.features.documents.openTemplateSelector.bind(mBT.features.documents);
window.createNewDocumentFromTemplate = mBT.features.documents.createFromTemplate.bind(mBT.features.documents);

// (openAddContactModal and renderDatabaseSubView removed from global scope to enforce strict mode)

/* ======= Studio Orchestration & Switchboard ======== */

/* --- 1. Personnel Hub Intelligence (Interaction behavior) --- */
window.toggleCrewPopup = function (el, event) {
    if (event) event.stopPropagation();
    const wrapper = el.parentElement;
    document.querySelectorAll('.crew-wrapper').forEach(div => { if (div !== wrapper) div.classList.remove('mobile-active'); });
    wrapper.classList.toggle('mobile-active');
};

// Helper for Contact Card Tabs (Phase 8.1 - Tier 6)
window.toggleCrewProfileTab = function (tabId) {
    // Toggle Buttons
    document.querySelectorAll('.crew-tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        btn.className = `crew-tab-btn flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`;
    });

    // Toggle Views
    const profile = document.getElementById('tab-profile');
    const history = document.getElementById('tab-history');

    if (tabId === 'profile') {
        if (profile) profile.classList.remove('hidden');
        if (history) history.classList.add('hidden');
    } else {
        if (profile) profile.classList.add('hidden');
        if (history) history.classList.remove('hidden');
    }
};

window.openCrewProfile = function (el, event, itemId, sectionName) {
    if (event) event.stopPropagation();

    // --- LOGIC UPDATE: Phase 2 Context Detection ---
    let item = null;
    let isGlobalEdit = false;

    // 1. Try finding in Budget (Context: Line Item Click)
    if (itemId && sectionName && budget.sections && budget.sections[sectionName]) {
        item = budget.sections[sectionName].items.find(i => i.id === itemId);
    }

    // 2. Try finding in Global DB (Context: Database Manager Click)
    if (!item && !sectionName && itemId && !itemId.startsWith('dummy_')) {
        const globalC = mBTOG.contacts.find(c => c.id === itemId);
        if (globalC) {
            item = {
                id: globalC.id,
                crew: { name: globalC.name, phone: globalC.phone, email: globalC.email, wallet: globalC.wallet, walletType: globalC.walletType },
                description: globalC.role || 'Global Contact',
                payments: globalC.payments || []
            };
            isGlobalEdit = true;
        }
    }

    // 3. Fallback to Empty State (Context: Add New)
    if (!item) item = { id: itemId || 'temp', crew: { name: '', phone: '', email: '', wallet: '', walletType: 'payoneer' }, description: 'New Contact' };

    const crew = item.crew || { name: '', phone: '', email: '', wallet: '', walletType: 'payoneer' };

    // --- Render Components ---
    // 1. Ledger (History Tab)
    let ledgerHtml = '';
    if (typeof mBT.ui.render.paymentHistory === 'function') {
        let contextForHistory = item;
        if (!item.payments && item.crew && item.crew.name) {
            const globalC = mBTOG.contacts.find(c => c.name.toLowerCase() === item.crew.name.toLowerCase());
            if (globalC) contextForHistory = globalC;
        }
        ledgerHtml = mBT.ui.render.paymentHistory(contextForHistory);
    }

    // 2. Dynamic Wallet UI Generation
    // Fix: Added [&>svg]:w-4 [&>svg]:h-4 to force SVG sizing, preventing the 120px Cash icon from breaking layout
    const currentType = crew.walletType || 'payoneer';
    const methodButtons = PAYMENT_SERVICES.map(s => `
            <button type="button" data-method="${s.id}" class="wallet-method-btn w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2 ${currentType === s.id ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}" title="${s.label}">
                <div class="pointer-events-none [&>svg]:w-4 [&>svg]:h-4">${s.icon}</div>
            </button>
        `).join('');

    // 3. Profile Form (Profile Tab)
    const profileHtml = `
            <div class="space-y-4 pt-2">
                <div class="flex justify-end">
                     <button type="button" id="importContactBtn" class="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">${mBTAssets.plus} Import Contact</button>
                </div>
                <div class="space-y-3">
                    <input type="text" id="crewName" value="${mBT.ui.render.esc(crew.name || '')}" placeholder="FULL NAME" class="w-full p-3 bg-white border-none rounded-xl shadow-sm text-xs font-black uppercase tracking-tighter outline-none focus:ring-4 focus:ring-blue-50 transition-all">
                    <div class="grid grid-cols-2 gap-3">
                        <input type="tel" id="crewPhone" value="${mBT.ui.render.esc(crew.phone || '')}" placeholder="PHONE" class="w-full p-3 bg-white border-none rounded-xl shadow-sm text-xs font-mono font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all">
                        <input type="email" id="crewEmail" value="${mBT.ui.render.esc(crew.email || '')}" placeholder="EMAIL" class="w-full p-3 bg-white border-none rounded-xl shadow-sm text-xs font-mono font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all">
                    </div>
                    
                    <!-- NEW DYNAMIC WALLET IDENTITY -->
                    <div class="bg-slate-100/50 p-3 rounded-2xl border border-slate-100">
                        <label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Payment Identity</label>
                        
                        <!-- Grid Layout Fix -->
                        <div class="grid grid-cols-6 gap-2 mb-3">
                            ${methodButtons}
                        </div>
                        
                        <div class="relative">
                            <input type="hidden" id="crewWalletType" value="${currentType}">
                            <input type="text" id="crewWallet" value="${mBT.ui.render.esc(crew.wallet || '')}" placeholder="IDENTIFIER / LINK" class="w-full p-3 bg-white border-none rounded-xl shadow-sm text-xs font-mono font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-100 transition-all">
                            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 scale-75 opacity-50 pointer-events-none [&>svg]:w-5 [&>svg]:h-5">${mBTAssets.wallet}</div>
                        </div>
                    </div>
                </div>
                <div class="flex justify-between items-center pt-2">
                    ${!isGlobalEdit && sectionName ? `<button type="button" class="text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 px-4 py-3 rounded-2xl transition-all" onclick="window.clearCrewAssignment('${itemId}', '${sectionName}')">Unassign</button>` : '<div></div>'}
                    <button type="submit" class="py-3 px-8 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-black transition-all active:scale-95">Save Profile</button>
                </div>
            </div>`;

    const content = `
            <form id="crewProfileForm" class="flex flex-col h-[580px]">
                <div class="text-center relative shrink-0 p-6 bg-white border-b border-slate-50">
                    <div class="w-20 h-20 mx-auto rounded-full bg-slate-900 flex items-center justify-center text-white font-black text-3xl shadow-2xl border-4 border-white mb-2">
                        ${crew.name ? mBT.ui.render.esc(crew.name.substring(0, 1).toUpperCase()) : '?'}
                    </div>
                    <h3 class="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none">${mBT.ui.render.esc(crew.name || 'New Personnel')}</h3>
                    <p class="text-[9px] text-blue-500 font-bold uppercase tracking-widest mt-1">${mBT.ui.render.esc(item.description || 'Crew Assignment')}</p>
                </div>

                <div class="flex bg-slate-100 p-1 rounded-xl mx-6 mt-4 shrink-0">
                    <button type="button" data-tab="profile" onclick="toggleCrewProfileTab('profile')" class="crew-tab-btn flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all bg-white text-blue-600 shadow-sm">Identity</button>
                    <button type="button" data-tab="history" onclick="toggleCrewProfileTab('history')" class="crew-tab-btn flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600">Ledger</button>
                </div>

                <div class="flex-grow overflow-hidden relative bg-slate-50 mt-4 mx-6 mb-6 rounded-2xl border border-slate-100">
                    <div id="tab-profile" class="absolute inset-0 p-5 overflow-y-auto no-scrollbar">
                        ${profileHtml}
                    </div>
                    <div id="tab-history" class="absolute inset-0 overflow-y-auto no-scrollbar hidden">
                        ${ledgerHtml}
                    </div>
                </div>
            </form>`;

    mBTME.open('crewProfile', '', content, 'max-w-sm', { hideHeader: true });

    setTimeout(() => {
        const form = document.getElementById('crewProfileForm');

        // Method Swapper Logic
        document.querySelectorAll('.wallet-method-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.wallet-method-btn').forEach(b => b.classList.remove('bg-emerald-100', 'border-emerald-500', 'text-emerald-700'));
                btn.classList.add('bg-emerald-100', 'border-emerald-500', 'text-emerald-700');
                const method = btn.dataset.method;
                document.getElementById('crewWalletType').value = method;

                // Dynamic Placeholder Adjustment
                const input = document.getElementById('crewWallet');
                const placeholders = {
                    'payoneer': 'PAYONEER EMAIL',
                    'paypal': 'PAYPAL.ME LINK',
                    'lynk': 'LYNK ID / PHONE',
                    'cash': 'NAME FOR RECEIPT',
                    'transfer': 'BANK / ACC NO / ROUTING',
                    'wire': 'SWIFT / IBAN / ACC NAME'
                };
                input.placeholder = placeholders[method] || 'IDENTIFIER / LINK';
            };
        });

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('crewName').value.trim();
                const phone = document.getElementById('crewPhone').value.trim();
                const email = document.getElementById('crewEmail').value.trim();
                const wallet = document.getElementById('crewWallet').value.trim();
                const walletType = document.getElementById('crewWalletType').value;

                const data = { name, phone, email, wallet, walletType };

                if (itemId && itemId.startsWith('dummy_new_contact')) {
                    if (!name) return mBTME.alert("Required", "Name is required.");
                    mBTOG.contacts.push({ id: 'c_' + Date.now(), role: 'Crew', ...data });
                    mBTOG.saveContacts();
                    mBTME.close('crewProfileModal');
                    if (typeof showSettingsModal === 'function') showSettingsModal('database', 'contacts');
                }
                else if (isGlobalEdit) {
                    const gIdx = mBTOG.contacts.findIndex(c => c.id === itemId);
                    if (gIdx > -1) {
                        Object.assign(mBTOG.contacts[gIdx], data);
                        mBTOG.saveContacts();
                        mBTME.close('crewProfileModal');
                        if (typeof showSettingsModal === 'function') showSettingsModal('database', 'contacts');
                    }
                }
                else if (item) {
                    item.crew = data;
                    mBTME.close('crewProfileModal');
                    if (typeof mBTLE !== 'undefined') mBTLE.reconcile();
                    if (typeof render === 'function') render();
                    if (document.getElementById('stagesViewModal')) window.showStagesModal();
                }
            });
        }

        const importBtn = document.getElementById('importContactBtn');
        if (importBtn) {
            importBtn.addEventListener('click', async () => {
                if ('contacts' in navigator && 'ContactsManager' in window) {
                    try {
                        const contacts = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: false });
                        if (contacts.length) {
                            const c = contacts[0];
                            if (c.name?.[0]) document.getElementById('crewName').value = c.name[0];
                            if (c.tel?.[0]) document.getElementById('crewPhone').value = c.tel[0];
                            if (c.email?.[0]) document.getElementById('crewEmail').value = c.email[0];
                        }
                    } catch (ex) { console.log('Contact Import cancelled'); }
                } else { mBTME.alert("Not Supported", "Contact import not available in this browser."); }
            });
        }
    }, 50);
};

window.clearCrewAssignment = function (itemId, sectionName) {
    mBTME.confirm("Remove Assignment", "Remove this crew assignment?", () => {


        const item = budget.sections[sectionName].items.find(i => i.id === itemId);
        if (item) {
            delete item.crew;
            mBTME.close('crewProfileModal');
            if (typeof mBTLE !== 'undefined') mBTLE.reconcile();
            if (typeof render === 'function') render();
            if (document.getElementById('stagesViewModal')) window.showStagesModal();
        }
    });
};

/* --- 2. Stage & Analytics Interface (Orchestration) --- */

// UI Helpers for Stages Modal
window.handleStageAddItem = function (stageKey) {
    const sectionNames = Object.keys(budget.sections);
    let targetSectionName = sectionNames.find(s => s.toLowerCase().includes('production')) || sectionNames[0];

    // Intelligent Section Guessing
    if (stageKey === 'post') targetSectionName = sectionNames.find(s => /post|edit/.test(s.toLowerCase())) || targetSectionName;
    else if (stageKey === 'dev') targetSectionName = sectionNames.find(s => /dev|creative/.test(s.toLowerCase())) || targetSectionName;

    const existingItems = [];
    Object.entries(budget.sections).forEach(([secName, sec]) => {
        sec.items.forEach(i => {
            if (!(i.stageData && i.stageData[stageKey])) {
                existingItems.push({ ...i, isExisting: true, sectionName: secName });
            }
        });
    });

    const initialList = [...existingItems.slice(0, 10), ...mBTOG.rates.slice(0, 20)];
    const content = `
            <div class="flex flex-col h-[400px]">
                <div class="mb-3"><input type="text" id="stageDbSearch" placeholder="Search..." class="w-full p-3 border rounded-lg shadow-sm text-sm font-bold"></div>
                <div id="stageDbList" class="flex-grow overflow-y-auto border rounded-lg bg-gray-50 mb-3">${renderStageDatabaseList(initialList, stageKey, targetSectionName)}</div>
                <button id="toggleStageCustomForm" class="text-xs text-blue-600 font-bold hover:underline mb-2">+ Create Custom Item</button>
                <div id="stageCustomForm" class="hidden space-y-3 border-t pt-3 bg-white">
                    <input type="text" id="stageCustomDesc" class="w-full p-2 border rounded text-sm" placeholder="Item Name">
                    <div class="flex gap-2"><input type="number" id="stageCustomRate" class="flex-1 p-2 border rounded text-sm" placeholder="0.00"><select id="stageCustomUnit" class="w-1/3 p-2 border rounded text-sm"><option>Day</option><option>Flat</option></select></div>
                    <button id="stageAddCustomBtn" class="w-full py-2 bg-blue-600 text-white font-bold rounded">Add Item</button>
                </div>
            </div>`;

    mBTME.open('stageAdd', `Add to ${budget.targetLock.stages[stageKey].label}`, content, 'max-w-sm');

    // Attach Listeners
    const searchInput = document.getElementById('stageDbSearch');
    if (searchInput) searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = [...existingItems, ...mBTOG.rates].filter(i => i.description.toLowerCase().includes(term)).slice(0, 30);
        document.getElementById('stageDbList').innerHTML = renderStageDatabaseList(filtered, stageKey, targetSectionName);
    });

    document.getElementById('toggleStageCustomForm')?.addEventListener('click', (e) => {
        document.getElementById('stageCustomForm').classList.toggle('hidden');
        document.getElementById('stageDbList').classList.toggle('hidden');
    });

    document.getElementById('stageAddCustomBtn')?.addEventListener('click', () => {
        const desc = document.getElementById('stageCustomDesc').value.trim();
        const rate = parseFloat(document.getElementById('stageCustomRate').value) || 0;
        const unit = document.getElementById('stageCustomUnit').value;
        if (desc) addStageItemToBudget(desc, rate, unit, stageKey, targetSectionName);
    });
};

window.renderStageDatabaseList = function (items, stageKey, targetSectionName) {
    if (!items.length) return `<div class="p-4 text-center text-xs text-gray-400">No matches.</div>`;
    return items.map(item => `
            <div onclick="${item.isExisting ? `assignItemToStage('${item.id}', '${stageKey}')` : `addStageItemToBudget('${RenderEngine.esc(item.description)}', ${item.rate}, '${item.unit}', '${stageKey}', '${targetSectionName}')`}" 
                 class="p-3 border-b bg-white hover:bg-blue-50 cursor-pointer flex justify-between items-center group">
                <div><div class="text-sm font-bold text-gray-700">${item.description}</div>${item.isExisting ? `<div class="text-[9px] text-emerald-600 font-bold">LINK FROM: ${item.sectionName}</div>` : ''}</div>
                <div class="font-mono text-xs text-gray-500 font-bold">${mBTLE.format.currency(item.rate)}</div>
            </div>`).join('');
};

window.assignItemToStage = function (itemId, stageKey) {
    let item = null;
    Object.values(budget.sections).forEach(sec => { if (!item) item = sec.items.find(i => i.id === itemId); });
    if (item) {
        if (!item.stageData) item.stageData = {};
        if (!item.stageData[stageKey]) {
            item.stageData[stageKey] = { days: 1, rate: item.rate || 0 };
            saveBudget();
            mBTME.close('stageAddModal');
            if (document.getElementById('stagesViewModal')) window.showStagesModal();
            mBTLE.reconcile();
        }
    }
};

window.addStageItemToBudget = function (desc, rate, unit, stageKey, targetSectionName) {
    const newItem = { id: crypto.randomUUID(), description: desc, quantity: 1, unit, multiplier: 1, rate, actual: 0, rateType: 'negotiable', stageData: {} };
    newItem.stageData[stageKey] = { days: 1, rate };
    if (budget.sections[targetSectionName]) {
        budget.sections[targetSectionName].items.push(newItem);
        mBTME.close('stageAddModal');
        saveBudget();
        if (document.getElementById('stagesViewModal')) window.showStagesModal();
        if (typeof render === 'function') render();
    }
};

// Stage Drag & Drop
window.handleStageDragStart = (e, itemId, sourceStage) => { e.dataTransfer.setData('text/plain', JSON.stringify({ itemId, sourceStage })); };
window.handleStageDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
window.handleStageDrop = (e, targetStage) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const { itemId, sourceStage } = data;
    if (sourceStage === targetStage) return;
    let item = null;
    Object.values(budget.sections).forEach(sec => { if (!item) item = sec.items.find(i => i.id === itemId); });
    if (item && item.stageData && item.stageData[sourceStage]) {
        item.stageData[targetStage] = { ...item.stageData[sourceStage] }; // Clone to new stage
        saveBudget();
        showStagesModal();
    }
};

window.updateStageItem = function (itemId, sectionName, stageKey, field, value, isRealTime = false) {
    const item = budget.sections[sectionName]?.items.find(i => i.id === itemId);
    if (item && item.stageData && item.stageData[stageKey]) {
        item.stageData[stageKey][field] = parseFloat(value) || 0;

        // Surgical Paint: Update Card Cost Immediately
        const days = item.stageData[stageKey].days || 0;
        const rate = item.stageData[stageKey].rate || 0;
        const cost = days * rate;
        const costEl = document.getElementById(`cost-${itemId}-${stageKey}`);
        if (costEl) costEl.innerText = mBTLE.format.currency(cost);

        // Update Headers & Main Budget
        if (typeof window.updateAllHeaders === 'function') window.updateAllHeaders();
        mBTLE.reconcile();
        if (typeof mBT.ui.paint === 'function') mBT.ui.paint();

        // Save Strategy: Debounce if realtime
        if (isRealTime) {
            if (mBT.features.stages.state._timer) clearTimeout(mBT.features.stages.state._timer);
            mBT.features.stages.state._timer = setTimeout(saveBudget, 1000);
        } else {
            // Fix: Clear any pending debounce to prevent double-save on blur
            if (mBT.features.stages.state._timer) clearTimeout(mBT.features.stages.state._timer);
            saveBudget();
        }
    }
};

window.handleStageBulkAction = function (action) {
    const validKeys = ['dev', 'pre', 'prod', 'post', 'dist'];
    if (action === 'lockAll' || action === 'unlockAll') {
        validKeys.forEach(k => budget.targetLock.stages[k].locked = (action === 'lockAll'));
        saveBudget();
        window.showStagesModal();
    } else if (action === 'syncDays') {
        mBTME.confirm("Sync Duration", "Overwrite individual item days with Stage settings?", () => {
            validKeys.forEach(k => {
                const d = budget.targetLock.stages[k].days;
                if (d > 0) Object.values(budget.sections).forEach(s => s.items.forEach(i => { if (i.stageData?.[k]) i.stageData[k].days = d; }));
            });
            saveBudget();
            window.showStagesModal();
        });
    }
};

// --- TIER 5 UPGRADE: Manual Duration Handler (Phase 2 Fix) ---
window.updateStageDuration = function (stageKey, value) {
    if (!budget || !budget.targetLock || !budget.targetLock.stages) return;

    // 1. Update Data Model
    const days = parseFloat(value) || 0;
    if (budget.targetLock.stages[stageKey]) {
        budget.targetLock.stages[stageKey].days = days;

        // 2. Persist
        saveBudget();

        // 3. Trigger Temporal Engine (Updates Dates instantly)
        if (typeof window.updateAllHeaders === 'function') window.updateAllHeaders();

        // 4. Update Logic Engine (Burn Rates)
        if (typeof mBTLE !== 'undefined') mBTLE.reconcile();
    }
};

// --- TIER 5 UPGRADE: Smart Sync Controller ---
window.syncStageDays = function (stageKey) {
    // 1. Ask Tier 3 for the Truth
    const validation = mBT.logic.stages.validateTimeline(stageKey);

    if (validation.maxNeeded > 0) {
        // 2. Update the Governor (User Input) to match Reality
        if (!budget.targetLock.stages[stageKey]) return;

        budget.targetLock.stages[stageKey].days = validation.maxNeeded;

        // 3. Persist & Refresh
        saveBudget();
        mBTLE.reconcile(); // Recalc burn rates

        // 4. Update UI (Removes Red Warning)
        if (document.getElementById('stagesViewModal')) window.showStagesModal();
    } else {
        mBTME.alert("Sync Info", "No scheduled items found in this stage to sync with.");
    }
};

// --- NEW: Smart Auto-Fill Logic (Tier 5 Bridge) ---
window.handleStageAutoFill = function (stageKey, mode = 'link') {
    const stageLabel = (budget.targetLock && budget.targetLock.stages[stageKey]) ? budget.targetLock.stages[stageKey].label : stageKey.toUpperCase();
    let count = 0;

    if (mode === 'link') {
        const matches = mBT.features.stages.logic.findMatchesInBudget(stageKey);
        if (matches.length === 0) return mBTME.alert("No Matches", "No matching items found to link.");

        matches.forEach(item => {
            if (!item.stageData) item.stageData = {};
            item.stageData[stageKey] = { days: 1, rate: item.rate };
            count++;
        });
    }
    else if (mode === 'generate') {
        const missing = mBT.features.stages.logic.findMissingEssentials(stageKey);
        if (missing.length === 0) return mBTME.alert("Complete", "No missing essentials found.");

        // Determine target section
        const sectionNames = Object.keys(budget.sections);
        let targetSec = sectionNames.find(s => s.toLowerCase().includes('production')) || sectionNames[0];
        if (stageKey === 'post') targetSec = sectionNames.find(s => /post|edit/.test(s.toLowerCase())) || targetSec;
        else if (stageKey === 'dev') targetSec = sectionNames.find(s => /dev|creative/.test(s.toLowerCase())) || targetSec;

        if (!budget.sections[targetSec]) return mBTME.alert("Error", "Target section not found.");

        missing.forEach(dbItem => {
            const newItem = {
                id: 'item_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                description: dbItem.description,
                quantity: 1,
                unit: dbItem.unit,
                rate: dbItem.rate,
                multiplier: 1,
                actual: 0,
                rateType: 'negotiable',
                stageData: {}
            };
            newItem.stageData[stageKey] = { days: 1, rate: dbItem.rate };
            budget.sections[targetSec].items.push(newItem);
            count++;
        });
    }

    if (count > 0) {
        saveBudget();
        mBTLE.reconcile();
        if (document.getElementById('stagesViewModal')) window.showStagesModal();
        mBTME.alert("Auto-Fill Complete", `${count} items processed for ${stageLabel}.`);
    }
};

window.handleStageBulkAutoFill = function () {
    mBTME.confirm("Smart Scan", "Auto-populate ALL stages with existing budget items?", () => {
        let total = 0;
        const validKeys = ['dev', 'pre', 'prod', 'post', 'dist'];

        validKeys.forEach(k => {
            const matches = mBT.features.stages.logic.findMatchesInBudget(k);
            matches.forEach(item => {
                if (!item.stageData) item.stageData = {};
                item.stageData[k] = { days: 1, rate: item.rate };
                total++;
            });
        });

        if (total > 0) {
            saveBudget();
            mBTLE.reconcile();
            window.showStagesModal();
            mBTME.alert("Scan Complete", `Smart Scan Linked ${total} items.`);
        } else {
            mBTME.alert("Scan Complete", "No new matches found.");
        }
    });
};

window.toggleStageLock = function (stageKey) {
    if (budget.targetLock.stages[stageKey]) {
        budget.targetLock.stages[stageKey].locked = !budget.targetLock.stages[stageKey].locked;
        saveBudget();
        window.showStagesModal();
    }
};

// Main Stage Modal Render (Uses Tier 4 Components)
window.showStagesModal = function () {
    const content = mBT.ui.renderStagesView();
    mBTME.open('stagesView', '', content, 'max-w-none w-fit !bg-transparent !shadow-none !border-0', {
        hideHeader: true,
        noPadding: true,
        onOpen: () => mBT.ui.initStagesInteractions(document.getElementById('stagesView'))
    });
};

mBT.ui.renderStagesView = function () {
    if (!budget.targetLock) budget.targetLock = { enabled: false, totalCap: 0, stages: {} };
    const tl = budget.targetLock;
    const validKeys = ['dev', 'pre', 'prod', 'post', 'dist'];
    validKeys.forEach(k => { if (!tl.stages[k]) tl.stages[k] = { label: k.toUpperCase(), ratio: 20, days: 0, locked: false }; });

    const setupCard = `
            <div id="card-setup" class="stage-card min-w-[320px] w-[320px] flex-shrink-0 bg-slate-900 text-white flex flex-col snap-center border-r border-slate-800 h-full">
                <div class="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 class="font-black text-xs uppercase tracking-widest text-slate-400">Configuration</h3>
                    <div class="relative group">
                        <button class="text-slate-400 hover:text-white transition-colors">${mBTAssets.gear}</button>
                        <div class="hidden group-hover:block absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden">
                            <div class="p-2 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Bulk Actions</div>
                            <button onclick="handleStageBulkAutoFill()" class="w-full text-left text-[10px] font-bold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 px-4 py-2 transition-colors flex items-center gap-2">
                                 ${mBTAssets.wand} Smart Auto-Fill
                            </button>
                            <button onclick="handleStageBulkAction('syncDays')" class="w-full text-left text-[10px] font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 transition-colors">Sync Days</button>
                            <button onclick="handleStageBulkAction('dedupe')" class="w-full text-left text-[10px] font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 px-4 py-2 transition-colors">Remove Dupes</button>
                            <div class="border-t border-slate-100 my-1"></div>
                            <button onclick="handleStageBulkAction('lockAll')" class="w-full text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 px-4 py-2 transition-colors">Lock All</button>
                            <button onclick="handleStageBulkAction('unlockAll')" class="w-full text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 px-4 py-2 transition-colors">Unlock All</button>
                        </div>
                    </div>
                </div>
                <div class="p-5 space-y-6 overflow-y-auto no-scrollbar">
                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Project Start Date</label>
                        <input type="date" value="${budget.startDate || new Date().toISOString().split('T')[0]}" 
                               onchange="budget.startDate=this.value; saveBudget(); window.updateAllHeaders();" 
                               class="w-full bg-slate-800 text-white text-[10px] font-bold p-3 rounded-xl outline-none border border-slate-700 focus:border-blue-600 transition-colors cursor-pointer uppercase tracking-widest shadow-inner">
                    </div>
                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Target Delivery Date</label>
                        <input type="date" value="${budget.deliveryDate || ''}" 
                               onchange="budget.deliveryDate=this.value; saveBudget(); window.updateAllHeaders();" 
                               class="w-full bg-slate-800 text-white text-[10px] font-bold p-3 rounded-xl outline-none border border-slate-700 focus:border-blue-600 transition-colors cursor-pointer uppercase tracking-widest shadow-inner">
                    </div>
                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Total Cap Limit</label>
                        <div class="flex items-center gap-2 border-b border-slate-600 pb-1">
                            <span class="text-slate-500 text-lg">$</span>
                            <input type="number" value="${tl.totalCap}" onchange="budget.targetLock.totalCap=parseFloat(this.value); saveBudget(); window.updateAllHeaders();" class="w-full bg-transparent text-xl font-black text-white outline-none no-spinner placeholder-slate-700">
                        </div>
                    </div>
                    <div class="space-y-5">
                        ${validKeys.map(k => `
                            <div class="relative">
                                <div class="flex justify-between text-[9px] font-black uppercase text-slate-400 mb-1.5">
                                    <span class="tracking-widest">${tl.stages[k].label}</span>
                                    <span id="setup_perc_disp_${k}" class="text-white">${tl.stages[k].ratio.toFixed(1)}%</span>
                                </div>
                                <div class="h-2 bg-slate-800 rounded-full relative overflow-visible">
                                    <div id="setup_bar_${k}" class="absolute h-full bg-blue-600 rounded-full opacity-80 pointer-events-none transition-all duration-300" style="width:0%"></div>
                                    <input type="range" min="0" max="100" step="0.1" value="${tl.stages[k].ratio}" data-stage-key="${k}" class="stage-slider absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" ${tl.stages[k].locked ? 'disabled' : ''}>
                                    <div id="setup_knob_${k}" class="absolute w-4 h-4 bg-white rounded-full top-1/2 -translate-y-1/2 shadow-md pointer-events-none transition-all duration-75" style="left: ${tl.stages[k].ratio}%; margin-left: -8px;"></div>
                                </div>
                            </div>`).join('')}
                    </div>
                    <div class="pt-6 border-t border-slate-800">
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Distribution Model</label>
                        <select onchange="window.applyStagePreset(this.value); window.showStagesModal();" class="w-full bg-slate-800 text-white text-[10px] font-bold p-3 rounded-xl outline-none border border-slate-700 focus:border-blue-600 transition-colors cursor-pointer appearance-none">
                            <option value="" disabled selected>Load Industry Preset...</option>
                            ${Object.keys(STAGE_PRESETS).map(k => `<option value="${k}">${k}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>`;

    const overviewCard = `
            <div id="card-overview" class="stage-card min-w-[320px] w-[320px] flex-shrink-0 bg-white flex flex-col snap-center border-r border-slate-200 h-full">
                <div class="p-8 flex flex-col items-center justify-center border-b border-slate-100 flex-grow relative overflow-hidden">
                    <div class="absolute inset-0 bg-slate-50/50 -skew-y-12 scale-150 origin-bottom-left z-0 pointer-events-none"></div>
                    <div id="burnRateRing" class="w-48 h-48 rounded-full border-[16px] border-slate-100 flex items-center justify-center relative mb-8 transition-all duration-500 z-10 bg-white shadow-sm">
                        <div class="text-center w-full px-4 overflow-hidden">
                            <span id="burnRateText" class="text-3xl sm:text-5xl font-black text-slate-300 block leading-none tracking-tighter truncate">0%</span>
                            <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2 block truncate">Burn Rate</span>
                        </div>
                    </div>
                    <div class="text-center w-full z-10 space-y-4">
                        <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">
                            <span>Estimated</span>
                            <span id="ovGrandTotal" class="text-slate-800 text-xs">$0.00</span>
                        </div>
                        <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span>Cap Limit</span>
                            <span id="ovTotalCap" class="text-slate-800 text-xs">$0.00</span>
                        </div>
                    </div>
                </div>
                <div class="p-6 bg-white z-10">
                    <button onclick="openAnalyticsHub()" class="w-full py-4 bg-white border-2 border-slate-100 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-blue-50 transition-all flex items-center justify-center gap-3 group">
                        <span class="scale-125 group-hover:scale-110 transition-transform">${mBTAssets.doctor}</span> Open Analytics Hub
                    </button>
                </div>
            </div>`;

    return `
            <div class="flex flex-col h-[85vh] w-full bg-white rounded-[32px] shadow-2xl overflow-hidden font-sans border border-slate-200">
                <div class="flex items-center w-full bg-white border-b border-slate-100 h-10 flex-shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.02)] z-30 sticky top-0 divide-x divide-slate-50">
                    <button id="nav-tab-setup" onclick="document.getElementById('card-setup').scrollIntoView({behavior:'smooth',inline:'center'})" 
                            class="stage-nav-tab flex-1 h-full flex items-center justify-center text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 border-b-2 border-transparent transition-all select-none min-w-0 px-1 truncate">
                        Setup
                    </button>
                    <button id="nav-tab-overview" onclick="document.getElementById('card-overview').scrollIntoView({behavior:'smooth',inline:'center'})" 
                            class="stage-nav-tab flex-1 h-full flex items-center justify-center text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 border-b-2 border-transparent transition-all select-none min-w-0 px-1 truncate">
                        View
                    </button>
                    ${validKeys.map(k => `
                        <button id="nav-tab-${k}" onclick="document.getElementById('card-${k}').scrollIntoView({behavior:'smooth',inline:'center'})" 
                                class="stage-nav-tab flex-1 h-full flex items-center justify-center text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 border-b-2 border-transparent transition-all select-none min-w-0 px-1 truncate">
                            ${tl.stages[k].label}
                        </button>
                    `).join('')}
                </div>
                
                <div id="stagesCarousel" class="flex-grow flex overflow-x-auto snap-x snap-mandatory no-scrollbar cursor-grab active:cursor-grabbing select-none bg-slate-100">
                    ${setupCard}
                    ${overviewCard}
                    ${validKeys.map(k => {
        const config = tl.stages[k];
        const val = mBT.logic.stages.validateTimeline(k);
        const syncBtn = (val.maxNeeded > val.current)
            ? `<button onclick="syncStageDays('${k}')" class="absolute -right-3 -top-3 bg-amber-500 text-white w-6 h-6 rounded-full shadow-lg hover:bg-amber-600 transition-all z-50 flex items-center justify-center animate-bounce" title="Sync to ${val.maxNeeded} days needed">${mBTAssets.sync}</button>`
            : '';
        const fullTitles = { 'dev': 'Development', 'pre': 'Pre-Production', 'prod': 'Production', 'post': 'Post-Production', 'dist': 'Distribution' };
        const displayTitle = fullTitles[k] || config.label;

        return `
                        <div id="card-${k}" class="stage-card min-w-[340px] w-[340px] flex-shrink-0 flex flex-col h-full bg-white border-r border-slate-200 snap-center relative group">
                            <div class="p-4 bg-white border-b border-slate-50 flex-shrink-0 sticky top-0 z-20 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
                                <div class="relative flex items-center justify-between mb-4 h-8">
                                    <div class="flex items-center gap-1">
                                        <button onclick="budget.targetLock.stages['${k}'].locked = !budget.targetLock.stages['${k}'].locked; saveBudget(); showStagesModal();" class="relative z-10 text-slate-300 hover:text-blue-500 transition-colors p-1 hover:bg-slate-50 rounded-lg">
                                            ${config.locked ? mBTAssets.lock : mBTAssets.unlock}
                                        </button>
                                        <button onclick="mBT.features.stages.ui.openAutoFillMenu('${k}')" class="relative z-10 text-slate-300 hover:text-purple-500 transition-colors p-1 hover:bg-purple-50 rounded-lg" title="Auto-Fill Matching Items">
                                        ${mBTAssets.wand}
                                    </button>
                                </div>
                                <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span class="font-black text-xs text-slate-800 uppercase tracking-widest leading-none">${displayTitle}</span>
                                    <span id="date-range-${k}" class="text-[8px] font-bold text-slate-400 mt-0.5 tracking-tight">--</span>
                                </div>
                                <div class="relative z-10 flex items-center gap-2">
                                    <div class="relative w-14 group/input">
                                        <input type="number" id="header_perc_${k}" value="${config.ratio.toFixed(1)}" class="stage-number-input w-full text-right text-[10px] font-bold bg-slate-50 rounded-lg px-2 py-1 outline-none no-spinner text-slate-600 focus:text-blue-600 focus:bg-blue-50 focus:ring-2 focus:ring-blue-100 transition-all" data-stage-key="${k}" ${config.locked ? 'disabled' : ''}>
                                        <span class="absolute right-7 top-1/2 -translate-y-1/2 text-[8px] text-slate-400 group-hover/input:text-blue-400 pointer-events-none">%</span>
                                    </div>
                                    <div class="relative w-12 group/days">
                                        ${syncBtn}
                                        <input type="number" value="${config.days}" onchange="updateStageDuration('${k}', this.value)" class="w-full text-center text-[10px] font-bold ${val.maxNeeded > val.current ? 'bg-amber-50 text-amber-600 ring-2 ring-amber-100' : 'bg-slate-50 text-blue-600'} rounded-lg px-1 py-1 outline-none no-spinner focus:ring-2 focus:ring-blue-100 transition-all" placeholder="0">
                                        <span class="absolute right-1 top-1/2 -translate-y-1/2 text-[6px] text-slate-300 font-black uppercase pointer-events-none">Day</span>
                                    </div>
                                </div>
                            </div>
                            <div class="w-full bg-slate-100 rounded-full h-1.5 mb-3 overflow-hidden"><div id="bar-${k}" class="bg-blue-500 h-full transition-all duration-500" style="width: 0%"></div></div>
                            <div class="flex justify-between text-[9px] font-mono font-bold text-slate-400 mb-4"><span id="total-${k}" class="text-slate-600">$0</span><span id="limit-${k}">Cap: $0</span></div>
                            <button onclick="handleStageAddItem('${k}')" class="w-full py-3 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white hover:shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-95">${mBTAssets.plus} Add Item</button>
                        </div>
                        <div class="stage-drop-zone flex-grow overflow-y-auto p-3 space-y-3 bg-slate-50/50 no-scrollbar pb-10" data-stage-key="${k}">
                            ${renderStageItems(k)}
                        </div>
                    </div>`;
    }).join('')}
                </div>
            </div>`;
};

mBT.ui.initStagesInteractions = function (container = document) {
    if (typeof initializeStageDragAndDrop === 'function') initializeStageDragAndDrop();

    const carousel = container.querySelector('#stagesCarousel') || document.getElementById('stagesCarousel');
    if (!carousel) return;

    const cards = carousel.querySelectorAll('.stage-card');
    const tabs = document.querySelectorAll('.stage-nav-tab');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const cardId = entry.target.id;
                const tabId = cardId.replace('card-', 'nav-tab-');
                const activeTab = document.getElementById(tabId);

                if (activeTab) {
                    tabs.forEach(t => {
                        t.classList.remove('text-blue-600', 'border-blue-600', 'bg-blue-50/50');
                        t.classList.add('text-slate-400', 'border-transparent');
                        t.style.textShadow = 'none';
                    });
                    activeTab.classList.remove('text-slate-400', 'border-transparent');
                    activeTab.classList.add('text-blue-600', 'border-blue-600', 'bg-blue-50/50');
                    activeTab.style.textShadow = '0 0 12px rgba(37,99,235,0.4)';
                    activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }
        });
    }, { root: carousel, threshold: 0.6 });

    cards.forEach(card => observer.observe(card));

    const bindInput = (el) => {
        el.addEventListener('input', (e) => {
            if (typeof balanceStageSliders === 'function') balanceStageSliders(e.target.dataset.stageKey, parseFloat(e.target.value));
            if (window.updateAllHeaders) window.updateAllHeaders();
        });
        el.addEventListener('change', () => saveBudget());
    };
    carousel.querySelectorAll('.stage-slider').forEach(bindInput);
    carousel.querySelectorAll('.stage-number-input').forEach(bindInput);

    carousel.querySelectorAll('input[data-action="stage-update"]').forEach(el => {
        el.addEventListener('input', (e) => {
            if (typeof updateStageItem === 'function') updateStageItem(e.target.dataset.id, e.target.dataset.section, e.target.dataset.stage, e.target.dataset.field, e.target.value, true);
        });
    });

    if (window.updateAllHeaders) window.updateAllHeaders();

    const slider = carousel;
    let isDown = false; let startX; let scrollLeft;
    slider.addEventListener('mousedown', (e) => {
        if (['INPUT', 'BUTTON', 'SELECT'].includes(e.target.tagName) || e.target.closest('.stage-draggable')) return;
        isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => isDown = false);
    slider.addEventListener('mouseup', () => isDown = false);
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return; e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        slider.scrollLeft = scrollLeft - (x - startX) * 2;
    });
};
function renderStageItems(stageKey) {
    let stageItems = [];

    // 1. Collect all items for this stage
    Object.entries(budget.sections).forEach(([secName, sec]) => {
        sec.items.forEach(item => {
            if (item.stageData && item.stageData[stageKey]) {
                stageItems.push({
                    item: item,
                    secName: secName,
                    // Default to large number if no order exists so they go to end
                    order: (item.stageData[stageKey].order !== undefined) ? item.stageData[stageKey].order : 99999
                });
            }
        });
    });

    // 2. Sort based on 'order' property
    stageItems.sort((a, b) => a.order - b.order);

    if (stageItems.length === 0) return '<p class="text-[8px] text-center mt-10 font-black text-slate-300 uppercase">Drop Items Here</p>';

    // 3. Render
    return stageItems.map(entry => {
        return RenderEngine.stageCard({
            ...entry.item,
            _sDays: entry.item.stageData[stageKey].days,
            _sRate: entry.item.stageData[stageKey].rate,
            _sec: entry.secName
        }, stageKey);
    }).join('');
}
// --- Global Stages Header Update Logic (Available before modal open) ---
window.updateAllHeaders = () => {
    // Safety check
    if (!budget || !budget.targetLock || !budget.targetLock.stages) return;

    const metrics = mBTStagesEngine.getMetrics();
    let burn = mBTStagesEngine.getBurnStatus(metrics.grandTotal, metrics.totalCap);

    // --- Phase 3.4: The Messenger (Intelligent Risk Visuals) ---
    // We fetch the deep risk analysis calculated by the Logic Engine
    const timeline = mBTStagesEngine.calculateTimeline();
    const risk = mBTStagesEngine.analyzeRisk(metrics, timeline);

    // Logic Resolution: Risk Override
    // If a risk is detected (Critical or Warning), it overrides the standard financial display
    if (risk) {
        if (risk.status === 'CRITICAL') {
            burn.color = 'text-rose-600';
            burn.ring = 'border-rose-500';
            burn.message = "CRITICAL";
            burn.subMessage = risk.subMessage; // "Projected $X exceeds Cap"
        } else if (risk.status === 'WARNING') {
            burn.ring = 'border-amber-400';
            if (burn.color !== 'text-red-600') burn.color = 'text-amber-500';
            burn.message = "DELAY";
            burn.subMessage = risk.subMessage; // "Est. Penalty: $X"
        }

        // Visual Feedback on Delivery Input (if visible in Setup Card)
        const deliveryInput = document.querySelector('input[onchange*="budget.deliveryDate"]');
        if (deliveryInput) {
            // Apply visual border state based on health
            deliveryInput.classList.remove('border-slate-700', 'border-rose-500', 'border-amber-500', 'border-emerald-500');

            if (risk.status === 'CRITICAL') deliveryInput.classList.add('border-rose-500');
            else if (risk.status === 'WARNING') deliveryInput.classList.add('border-amber-500');
            else deliveryInput.classList.add('border-emerald-500');
        }
    }

    // Update Overview Card (Visuals)
    const ovGrandTotal = document.getElementById('ovGrandTotal');
    const ovTotalCap = document.getElementById('ovTotalCap');

    if (ovGrandTotal) ovGrandTotal.innerText = mBTLE.format.currency(metrics.grandTotal);
    if (ovTotalCap) ovTotalCap.innerText = mBTLE.format.currency(metrics.totalCap);

    // Update Burn Ring
    const ring = document.getElementById('burnRateRing');
    const ringTxt = document.getElementById('burnRateText');
    const ringLabel = ringTxt ? ringTxt.nextElementSibling : null; // "Burn Rate" text

    if (ring && ringTxt) {
        ring.className = `w-48 h-48 rounded-full border-[16px] ${burn.ring} flex items-center justify-center relative mb-8 transition-all duration-500 z-10 bg-white shadow-sm`;
        ringTxt.className = `text-3xl sm:text-5xl font-black ${burn.color} block leading-none tracking-tighter truncate`;

        if (burn.message) {
            // Time Alert Mode
            ringTxt.innerText = burn.message;
            ringTxt.style.fontSize = ""; // Reset inline style, rely on class
            ringTxt.classList.remove('text-5xl', 'sm:text-5xl');
            ringTxt.classList.add('text-2xl', 'sm:text-3xl'); // Smaller for text messages

            if (ringLabel) {
                ringLabel.innerText = burn.subMessage || "SCHEDULE CRITICAL";
                ringLabel.className = "text-[9px] font-black uppercase tracking-widest text-rose-500 mt-2 block animate-pulse truncate";
            }
        } else {
            // Standard Financial Mode
            ringTxt.innerText = Math.round(burn.pct) + '%';
            ringTxt.classList.remove('text-2xl', 'sm:text-3xl');
            ringTxt.classList.add('text-3xl', 'sm:text-5xl');

            if (ringLabel) {
                ringLabel.innerText = "Burn Rate";
                ringLabel.className = "text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2 block truncate";
            }
        }
    }

    // Update Temporal Projections (Phase 1 + 3.1 Bankruptcy)
    Object.keys(timeline).forEach(k => {
        if (k === '_analysis') return; // Skip metadata
        const el = document.getElementById(`date-range-${k}`);
        const validation = mBTStagesEngine.validateTimeline(k);

        if (el) {
            if (validation.isBankrupt) {
                el.innerText = "TIME BANKRUPTCY";
                el.className = "text-[9px] font-black text-red-600 animate-pulse bg-red-50 px-2 rounded mt-0.5 tracking-tight";
            } else {
                el.innerText = timeline[k].label;
                el.className = "text-[8px] font-bold text-slate-400 mt-0.5 tracking-tight";
            }
        }
    });

    // 3. Update Setup Sliders (Visual Synchronization)
    const stages = budget.targetLock.stages;
    const validKeys = ['dev', 'pre', 'prod', 'post', 'dist'];

    validKeys.forEach(k => {
        const cfg = stages[k];
        if (!cfg) return;

        // A. Update Text Display (Target Ratio)
        const disp = document.getElementById(`setup_perc_disp_${k}`);
        if (disp) disp.innerText = cfg.ratio.toFixed(1) + '%';

        // B. Update Bar Width (ACTUAL UTILIZATION)
        const stageCost = (metrics.stageTotals && metrics.stageTotals[k]) ? metrics.stageTotals[k] : 0;
        const stageCap = metrics.totalCap * (cfg.ratio / 100);
        const utilPct = stageCap > 0 ? (stageCost / stageCap) * 100 : 0;

        const bar = document.getElementById(`setup_bar_${k}`);
        if (bar) {
            bar.style.width = Math.min(utilPct, 100).toFixed(2) + '%';
            bar.className = `absolute h-full rounded-full opacity-80 pointer-events-none transition-all duration-300 ${stageCost > stageCap ? 'bg-red-500' : 'bg-blue-600'}`;
        }

        // C. Update Knob Position (TARGET STRATEGY)
        const knob = document.getElementById(`setup_knob_${k}`);
        if (knob) knob.style.left = cfg.ratio + '%';

        // D. Update Card Stats
        const totalEl = document.getElementById(`total-${k}`);
        const limitEl = document.getElementById(`limit-${k}`);
        if (totalEl) totalEl.innerText = mBTLE.format.currency(stageCost);
        if (limitEl) limitEl.innerText = `Cap: ${mBTLE.format.currency(stageCap)}`;
    });
};

/* ========= v19.54 CONNECTIVE UI & Interaction Handlers ========= */

/* --- 1. UI Module: Project & Status Bar Resolution --- */
// Kept here as it's the specific implementation for the Header UI
async function renderProjectManagement() {
    const container = document.getElementById('project-management-container');
    if (!container) return;

    let projects = (mBT.data && mBT.data.getList) ? await mBT.data.getList() : [];
    projects.sort().reverse();

    const menuItems = [
        { label: 'New Budget', icon: mBTAssets.plus, color: 'text-emerald-600', bg: 'hover:bg-emerald-50', action: 'project-new' },
        { label: 'Duplicate Budget', icon: mBTAssets.copy, color: 'text-blue-600', bg: 'hover:bg-blue-50', action: 'project-duplicate' },
        { label: 'Save as Blueprint', icon: mBTAssets.save, color: 'text-indigo-600', bg: 'hover:bg-indigo-50', action: 'blueprint-save' },
        { label: 'Import Budget', icon: mBTAssets.cloud, color: 'text-purple-600', bg: 'hover:bg-purple-50', action: 'project-import-trigger' },
        { label: 'Recycle Bin', icon: mBTAssets.trash, color: 'text-slate-500', bg: 'hover:bg-slate-50', action: 'project-recycle' },
        { divider: true },
        { label: 'Delete Budget', icon: mBTAssets.trash, color: 'text-rose-600', bg: 'hover:bg-rose-50', action: 'project-delete' }
    ];

    let html = `
            <div class="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm relative z-50 w-full md:w-auto">
                <div class="relative group flex-grow md:flex-grow-0">
                    <select id="projectSelect" data-action="project-switch" class="w-full md:w-auto appearance-none bg-slate-50 border-none text-[10px] font-black uppercase tracking-widest text-slate-700 rounded-xl pl-3 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer min-w-[140px] transition-all hover:bg-slate-100">
        `;
    if (projects.length === 0 && typeof currentProjectName !== 'undefined' && currentProjectName) {
        html += `<option value="${currentProjectName}" selected>${currentProjectName}</option>`;
    }
    projects.forEach(p => {
        const selected = (typeof currentProjectName !== 'undefined' && p === currentProjectName) ? 'selected' : '';
        html += `<option value="${p}" ${selected}>${p}</option>`;
    });
    html += `   </select>
                    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 group-hover:text-slate-600">
                        <svg class="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
                <div class="relative flex-shrink-0">
                    <button onclick="const m=document.getElementById('fileMenuDropdown'); m.classList.toggle('hidden');" class="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 px-4 py-2.5 rounded-xl transition-all active:scale-95 group">
                        <span class="text-[10px] font-black uppercase tracking-widest">File</span>
                        <svg class="w-3 h-3 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div id="fileMenuDropdown" class="hidden absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200" onmouseleave="this.classList.add('hidden')">
                        ${menuItems.map(item => item.divider ? `<div class="h-px bg-slate-100 my-1"></div>` : `<button data-action="${item.action}" onclick="document.getElementById('fileMenuDropdown').classList.add('hidden')" class="w-full text-left px-4 py-2.5 flex items-center gap-3 ${item.color} ${item.bg} transition-colors group"><span class="opacity-70 group-hover:opacity-100 scale-90">${item.icon}</span><span class="text-[9px] font-black uppercase tracking-widest">${item.label}</span></button>`).join('')}
                    </div>
                </div>
                <input type="file" id="importFile" class="hidden" accept=".json,.moo,.zip" data-action="project-import-file">
            </div>`;
    container.innerHTML = html;
}

function renderStatusBar() {
    const container = document.getElementById('statusBar');
    if (!container) return;

    // Logic Resolution: Interactive Status Bar (Tier 4)
    // Entry point for Audit Log (Tier 5). Pulsating dot indicates active recording.
    // Updated to remove legacy Undo/Redo and focus on Activity History.

    const isRecording = budget.activityLog && budget.activityLog.length > 0;

    // Tier 4 Logic: Prioritize Modern Audit Log > Legacy History Stack > Default
    let lastAction = "Ready to Go!";
    if (isRecording) {
        const lastEntry = budget.activityLog[budget.activityLog.length - 1];
        // Format: "ADD: Director" or "UPDATE: Production Fee"
        // Use Escaping to prevent XSS from user input
        const safeAction = mBT.ui.render.esc(lastEntry.action);
        const safeTarget = mBT.ui.render.esc(lastEntry.target);
        lastAction = `${safeAction}: ${safeTarget}`;
    } else if (typeof historyStack !== 'undefined' && historyStack.length > 0) {
        lastAction = historyStack[historyIndex]?.description || "Ready to Go!";
    }

    container.innerHTML = `
            <div class="flex items-center justify-between w-full h-full px-2">
                <!-- Left: Status & Rec -->
                <div class="flex items-center gap-3 overflow-hidden mr-4">
                     <div class="flex items-center gap-2 shrink-0">
                         <span class="relative flex h-2 w-2">
                            ${isRecording ? '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>' : ''}
                            <span class="relative inline-flex rounded-full h-2 w-2 ${isRecording ? 'bg-red-500' : 'bg-slate-600'}"></span>
                         </span>
                         <span class="text-[9px] font-mono text-slate-500 uppercase tracking-widest">REC</span>
                    </div>
                    <div class="w-px h-3 bg-slate-800"></div>
                    <span class="truncate font-mono text-slate-400 text-[10px] uppercase tracking-widest">${lastAction}</span>
                </div>
                
                <!-- Right: Activity History Button -->
                <button onclick="mBT.features.history.open()" class="flex items-center gap-2 hover:text-blue-400 transition-colors group cursor-pointer shrink-0" title="View Activity Log & Undo Changes">
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors hidden sm:block">Activity History</span>
                    <div class="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-slate-900 transition-all shadow-sm border border-slate-700">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                    </div>
                </button>
            </div>`;
}

function handleUndo() {
    if (historyIndex > 0) {
        historyIndex--;
        budget = mBTState.wrap(JSON.parse(JSON.stringify(historyStack[historyIndex].budget)));
        render();
    }
}
function handleRedo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        budget = mBTState.wrap(JSON.parse(JSON.stringify(historyStack[historyIndex].budget)));
        render();
    }
}

function handleNewProjectSelection(e) { /* Stub kept for safety */ }

function handleImportFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.projectName) throw new Error("Invalid file structure");
            mBT.data.importFile(input); // Delegate to new system
        } catch (err) { mBTME.alert("Import Failed", err.message); }
        input.value = '';
    };
    reader.readAsText(file);
}

window.importContactsCSV = function (input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        if (!text) return;
        const lines = text.split(/\r\n|\n/);
        if (lines.length < 2) return mBTME.alert("Error", "Invalid CSV format.");
        const headers = lines[0].split(',').map(h => h.trim());
        const contacts = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = line.split(',');
            const obj = {};
            headers.forEach((h, idx) => {
                let val = values[idx] ? values[idx].trim() : '';
                if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                obj[h] = val;
            });
            contacts.push(obj);
        }
        const count = mBTOG.ingest(contacts, 'contact');
        if (count > 0) {
            mBTME.alert("Success", `${count} new contacts imported.`, () => {
                if (typeof showSettingsModal === 'function') showSettingsModal('database', 'contacts');
            });
        } else {
            mBTME.alert("Info", "Import completed. No new contacts added.");
        }
        input.value = '';
    };
    reader.readAsText(file);
};

/* ================= v19.54 TIER 6: SYSTEM IGNITION & EVENTS ================= */

/* --- 1. OFFLINE ENDURANCE SERVICE (Service Worker Registration) --- */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
            .then(reg => {
                console.log('SW Synchronization active:', reg.scope);
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            mBTME.confirm("Update Available", "New production logic available! Synchronize environment now?", () => {
                                window.location.reload();
                            });
                        }
                    };
                };
            })
            .catch(err => console.log('Service Worker initialization failure:', err));
    });
}

/* --- 2. ACTION REGISTRY (The Nervous System Configuration) --- */
function registerCoreActions() {
    // A. Header / Project Actions
    mBT.core.action('project-switch', async (e, el) => {
        if (e.type !== 'change') return;
        if (el.value) {
            const originalText = el.options[el.selectedIndex].text;
            el.options[el.selectedIndex].text = "Loading...";
            await mBT.data.load(el.value);
        }
    });

    mBT.core.action('project-new', () => showNewProjectModal());
    mBT.core.action('project-duplicate', async () => await mBT.data.duplicate());
    mBT.core.action('project-delete', async () => { if (currentProjectName) await mBT.data.deleteProject(currentProjectName); });

    // New File Menu Actions
    mBT.core.action('project-recycle', () => { if (typeof mBT.features.trash !== 'undefined') mBT.features.trash.open('projects'); });
    mBT.core.action('project-sync', () => { fetchExchangeRates(); mBTME.alert("Coming Soon", "Cloud Sync infrastructure is currently in development. Local exchange rates have been refreshed."); });

    mBT.core.action('project-import-trigger', function () { var input = document.getElementById('importFile'); if (input) input.click(); });
    mBT.core.action('project-import-file', function (e, el) { if (e.type === 'change') mBT.data.importFile(el); });

    // B. Global Utilities
    mBT.core.action('set-currency', (e, el) => {
        displayCurrency = el.value;
        localStorage.setItem(`${storageKeyPrefix}currency`, displayCurrency);
        if (typeof mBTLE !== 'undefined') mBTLE.reconcile();
        if (typeof render === 'function') render();
    });

    mBT.core.action('backup-env', () => { if (typeof mBTPublisher !== 'undefined') mBTPublisher.toMoo(); });
    mBT.core.action('print-pdf', () => window.print());
    mBT.core.action('export-xlsx', () => mBTME.alert("Coming Soon", "Excel export is currently being built. All features will be free to use."));
    mBT.core.action('publish-modal', () => showPublishModal());

    // C. Footer / Global Modals
    mBT.core.action('stages-modal', () => showStagesModal());
    mBT.core.action('docs-modal', () => showDocumentsModal());
    mBT.core.action('settings-modal', () => showSettingsModal());
    mBT.core.action('support-modal', () => showCoffeeWidget());

    // D. Budget Interaction (The Synapse)
    mBT.core.action('section-toggle', (e, el) => handleToggleSection(el.dataset.id, el));
    mBT.core.action('section-add', (e, el) => showItemSelectorModal(el.dataset.id));
    mBT.core.action('row-delete', (e, el) => handleRemoveItem(el.dataset.section, el.dataset.id));

    mBT.core.action('row-lock', (e, el) => {
        const item = budget.sections[el.dataset.section]?.items.find(i => i.id === el.dataset.id);
        if (item) {
            item.rateType = item.rateType === 'fixed' ? 'negotiable' : 'fixed';
            saveBudget();
            render(); // Full render needed to swap icon state
        }
    });

    // E. Personnel Actions
    mBT.core.action('crew-toggle', (e, el) => {
        const itemId = el.closest('tr')?.dataset.itemId || el.dataset.id;
        const section = el.closest('tr')?.dataset.section || el.dataset.section;

        let item = null;
        if (section && budget.sections[section]) {
            item = budget.sections[section].items.find(i => i.id === itemId);
        }

        // Enhanced Interaction: If unassigned, go straight to Profile/Import
        if (!item || !item.crew || !item.crew.name) {
            openCrewProfile(el, e, itemId, section);
        } else {
            toggleCrewPopup(el, e);
        }
    });
    mBT.core.action('crew-profile', (e, el) => openCrewProfile(el, e, el.dataset.id, el.dataset.section));

    // --- NEW: Registry Expansion (Instruction Set 4) ---

    // 1. Export Bridge
    mBT.core.action('export', (e, el) => {
        const type = el.dataset.type;
        if (document.getElementById('publishModal')) mBTME.close('publishModal');
        if (typeof mBTPublisher === 'undefined') return;

        if (type === 'pdf') mBTPublisher.format.professionalPdf(budget);
        else if (type === 'moo') mBTPublisher.io.saveMoo(budget);
        else if (type === 'bundle') mBTPublisher.io.saveBundle(budget);
        else if (type === 'html') mBTPublisher.format.htmlStandalone('budget-sections', budget.projectName);
        else if (type === 'xlsx') mBTPublisher.format.professionalXlsx(budget);
    });

    // 2. Navigation
    mBT.core.action('nav-settings', (e, el) => mBT.features.settings.open(el.dataset.tab));

    // 3. Studio Engine
    mBT.core.action('studio-undo', () => { if (mBTDB.undo) mBTDB.undo(); });
    mBT.core.action('studio-redo', () => { if (mBTDB.redo) mBTDB.redo(); });
    mBT.core.action('studio-sync', () => mBTDB.syncFromBudget());
    mBT.core.action('studio-sync-prev', () => mBTDB.syncFromPrevious());
    mBT.core.action('studio-preview', () => mBTDB.openPreviewSelector());
    mBT.core.action('studio-snapshot', () => mBTDB.snapshotDoc());
    mBT.core.action('studio-template', () => mBTDB.saveTemplate());
    mBT.core.action('studio-toggle-edit', () => mBTDB.toggleEditMode());

    mBT.core.action('widget-toggle-view', (e, el) => mBTDB.toggleVertical(el.dataset.id));
    mBT.core.action('widget-assistant-fill', (e, el) => mBTDB.assistantFill(el.dataset.id, el.dataset.docId));
    mBT.core.action('widget-autofill', (e, el) => mBTDB.autoFillWidget(el.dataset.type, el.dataset.docId));
    mBT.core.action('widget-delete', (e, el) => mBTDB.deleteWidget(el.dataset.id));

    // --- NEW: Documents Hub Actions ---
    mBT.core.action('nav-docs', (e, el) => mBT.features.documents.openVault(el.dataset.tab));
    mBT.core.action('doc-options', (e, el) => mBT.features.documents.showOptions(el.dataset.id));
    mBT.core.action('doc-duplicate', (e, el) => mBTDB.snapshotDoc(el.dataset.id));
    mBT.core.action('doc-archive', (e, el) => window.handleDocTrash(el.dataset.id));

    // 4. Trash Logic
    mBT.core.action('nav-trash', (e, el) => mBT.features.trash.open(el.dataset.tab));
    mBT.core.action('trash-toggle', (e, el) => mBT.features.trash.toggleItem(el.dataset.id));
    mBT.core.action('trash-toggle-all', (e, el) => mBT.features.trash.toggleAll(el.checked));
    mBT.core.action('trash-bulk', (e, el) => mBT.features.trash.performAction(el.dataset.type));
    mBT.core.action('trash-single', (e, el) => mBT.features.trash.singleAction(el.dataset.type, el.dataset.id));

    // F. Stage Actions
    mBT.core.action('stage-update', (e, el) => {
        updateStageItem(el.dataset.id, el.dataset.section, el.dataset.stage, el.dataset.field, el.value);
    });

    // G. History (Tier 4/5/6 Alignment)
    // Logic Resolution: Prioritize Tier 2 Namespace if available
    mBT.core.action('undo', () => {
        if (mBT.data.history && typeof mBT.data.history.undoSnapshot === 'function') mBT.data.history.undoSnapshot();
        else if (typeof handleUndo === 'function') handleUndo();
    });
    mBT.core.action('redo', () => {
        if (mBT.data.history && typeof mBT.data.history.redoSnapshot === 'function') mBT.data.history.redoSnapshot();
        else if (typeof handleRedo === 'function') handleRedo();
    });
}

/* --- 3. GLOBAL EVENT ORCHESTRATION --- */
function bindAppEventListeners() {
    const footer = document.querySelector('footer');

    // Initialize Registry
    registerCoreActions();

    if (!document.body.dataset.listenersBound) {
        document.body.dataset.listenersBound = 'true';

        // --- Master Router (Delegation) ---
        const router = (e) => {
            if (mBT.core.route(e)) return;
            const target = e.target;
            if (target.id === 'loginBtn') handleLogin();
            if (target.closest('#openAiToolsBtn')) showAIToolsModal();
        };

        document.body.addEventListener('click', router);
        document.body.addEventListener('change', router);

        // --- Keyboard Shortcuts (Tier 6 Wiring) ---
        document.body.addEventListener('keydown', (e) => {
            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (mBT.core.actions['undo']) mBT.core.actions['undo']();
            }
            // Redo: Ctrl+Y
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                if (mBT.core.actions['redo']) mBT.core.actions['redo']();
            }
        });

        // --- Real-time Input Handling ---
        document.body.addEventListener('input', (e) => {
            const input = e.target;
            if (input.id === 'projectName') { handleProjectNameChange(e); return; }
            if (['discountPercentage', 'contingencyPercentage', 'salesTaxPercentage'].includes(input.id)) {
                budget[input.id] = parseFloat(input.value) || 0;
                if (typeof mBTLE !== 'undefined') mBTLE.reconcile();
                return;
            }
            if (input.dataset.field) {
                if (input.dataset.action === 'stage-update') {
                    if (typeof updateStageItem === 'function') updateStageItem(input.dataset.id, input.dataset.section, input.dataset.stage, input.dataset.field, input.value, true);
                } else if (!input.dataset.action) {
                    handleUpdate(input.dataset.section, input.dataset.id, input.dataset.field, input.value, 'User Input');
                }
            }
        });
    }

    if (footer) {
        footer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.id === 'stagesFooterBtn') mBT.core.actions['stages-modal']();
            else if (btn.id === 'docsFooterBtn') mBT.core.actions['docs-modal']();
            else if (btn.id === 'mainActionBtn') mBT.core.actions['settings-modal']();
            else if (btn.id === 'secondaryActionBtn') mBT.core.actions['publish-modal']();
            else if (btn.id === 'footerCoffeeBtn') mBT.core.actions['support-modal']();
        });
    }

    window.addEventListener('online', resolveConnectivityStatus);
    window.addEventListener('offline', resolveConnectivityStatus);
}

/* --- 4. INFRASTRUCTURE TELEMETRY --- */
function resolveConnectivityStatus() {
    const isOnline = navigator.onLine;
    const btn = document.getElementById('loginBtn');
    if (btn) {
        btn.className = `w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 shadow-sm flex-shrink-0 ${isOnline ? 'border-emerald-400 bg-emerald-50 text-emerald-600' : 'border-rose-400 bg-rose-50 text-rose-600'}`;
        btn.title = isOnline ? "Studio Online" : "Studio Offline";
        btn.innerHTML = mBTAssets.user;
    }
    const aiBtn = document.getElementById('openAiToolsBtn');
    if (aiBtn) {
        aiBtn.className = `p-3 text-white rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center ${isOnline ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-400 cursor-not-allowed'}`;
        if (!isOnline) aiBtn.title = "AI Consultant Offline";
    }
}

// --- NEW: Support Widget (Buy Me a Coffee) ---
function showCoffeeWidget() {
    const content = `
            <div class="text-center p-6 bg-yellow-50 min-h-[300px] flex flex-col items-center justify-center">
                <div class="w-20 h-20 bg-[#FFDD00] rounded-3xl flex items-center justify-center text-4xl shadow-xl mb-4 text-black border-4 border-white animate-bounce [&>svg]:w-10 [&>svg]:h-10">
                    ${mBTAssets.coffee}
                </div>
                <h3 class="text-xl font-black uppercase tracking-tighter text-slate-900 mb-2">Fuel the Code</h3>
                <p class="text-xs font-bold text-slate-500 mb-6 max-w-xs leading-relaxed">
                    mooBudget is free, offline-first, and built for the Caribbean industry. If it saves you time, consider buying a coffee for the dev team.
                </p>
                <div class="space-y-3 w-full max-w-xs">
                    <a href="https://buymeacoffee.com/jaysonmy" target="_blank" class="flex items-center justify-center gap-2 w-full py-4 bg-[#FFDD00] text-black rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-transform active:scale-95">
                        Open Support Page
                    </a>
                    <button onclick="mBTME.close('coffeeModal')" class="w-full py-3 bg-white border border-slate-200 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors">
                        Maybe Later
                    </button>
                </div>
            </div>`;
    mBTME.open('coffee', '', content, 'max-w-sm', { hideHeader: true, noPadding: true });
}

// --- NEW: Distribution Share Selector (Preview Handler) ---
window.openDocumentShareSelector = function (docId) {
    const doc = budget.documents.find(d => d.id === docId);
    if (!doc) return;

    // Generate Share Message
    const shareText = (typeof mBTPublisher !== 'undefined' && mBTPublisher.comm)
        ? mBTPublisher.comm.generateShareSheet(doc)
        : `Reviewing ${doc.label}`;

    // Platform Links
    const waLink = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    const mailLink = `mailto:?subject=${encodeURIComponent("Document Review: " + doc.label)}&body=${encodeURIComponent(shareText)}`;

    const content = `
            <div class="p-6 bg-white">
                <div class="text-center mb-6">
                    <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-xl">
                        ${mBTAssets.paperPlane}
                    </div>
                    <h3 class="text-sm font-black uppercase tracking-widest text-slate-900">Distribute Document</h3>
                    <p class="text-[10px] text-slate-400 font-bold mt-1">${doc.label}</p>
                </div>
                
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <a href="${waLink}" target="_blank" class="flex flex-col items-center gap-2 p-4 bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl hover:bg-[#25D366]/20 transition-all group no-underline">
                        <div class="text-[#25D366] text-2xl group-hover:scale-110 transition-transform">${mBTAssets.wa}</div>
                        <span class="text-[9px] font-black uppercase tracking-widest text-[#25D366] group-hover:text-[#128c7e]">WhatsApp</span>
                    </a>
                    <a href="${mailLink}" target="_blank" class="flex flex-col items-center gap-2 p-4 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-all group no-underline">
                        <div class="text-blue-500 text-2xl group-hover:scale-110 transition-transform">${mBTAssets.mail}</div>
                        <span class="text-[9px] font-black uppercase tracking-widest text-blue-600">Email</span>
                    </a>
                </div>
                
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Quick Copy Message</label>
                    <div class="flex gap-2">
                        <input type="text" value="${shareText}" class="flex-grow bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none" readonly>
                        <button onclick="navigator.clipboard.writeText('${shareText.replace(/'/g, "\\'")}'); this.innerHTML='Copied!';" class="px-3 bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-300 transition-colors">Copy</button>
                    </div>
                </div>
            </div>`;

    mBTME.open('shareSelector', 'Share', content, 'max-w-sm', { hideHeader: true, noPadding: true });
};

function handleLogin() {
    if (navigator.onLine) {
        mBTME.confirm("Login", "Establish secure connection to Moo Studio Cloud infrastructure?", () => {
            mBTME.alert("Connected", "Environment Authenticated.");
        });
    }
}

function injectFooterIcons() {
    const mapping = {
        'icon-stages': mBTAssets.grid,
        'icon-docs': mBTAssets.file,
        'icon-main-action': mBTAssets.gear,
        'icon-secondary-action': mBTAssets.paperPlane,
        'icon-coffee': mBTAssets.coffee
    };
    Object.entries(mapping).forEach(([id, svg]) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = svg;
    });
}

/* --- 5. GLOBAL BOOT TRIGGER --- */
// Logic Resolution: Global Bridge Hooks for external calls
window.showBinModal = () => { if (typeof mBT.features.trash !== 'undefined') mBT.features.trash.open('documents'); };
window.handleDocTrash = (id) => { if (typeof mBT.features.trash !== 'undefined') mBT.features.trash.trashDocument(id); };

/* ======= END OF mBT ========== */
