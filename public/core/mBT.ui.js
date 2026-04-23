"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
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
        alert: "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"12\"/><line x1=\"12\" y1=\"16\" x2=\"12.01\" y2=\"16\"/></svg>"
    },
    // --- Phase 87B: Emergency Reset Method ---
    reset: function () {
        this.stack.forEach(function (modalId) {
            var el = document.getElementById(modalId);
            if (el)
                el.remove();
        });
        this.stack = [];
        this.focusStack = [];
        document.body.style.overflow = '';
        document.removeEventListener('keydown', this._escHandler, true);
    },
    // --- Phase 87B: ESC Handler (LIFO - closes topmost only) ---
    _escHandler: function (e) {
        if (e.key !== 'Escape')
            return;
        var topModalId = mBT.ui.modal.stack[mBT.ui.modal.stack.length - 1];
        if (topModalId) {
            e.preventDefault();
            e.stopPropagation();
            mBT.ui.modal.close(topModalId);
        }
    },
    // --- Portal Generation: Dynamic injection of overlay layers ---
    open: function (id, title, contentHtml, maxWidth, options) {
        var _this = this;
        if (maxWidth === void 0) { maxWidth = 'max-w-2xl'; }
        if (options === void 0) { options = {}; }
        var container = document.getElementById(this.containerId);
        if (!container)
            return;
        // Phase 87B: Cap at 5 modals deep
        if (this.stack.length >= 5) {
            console.warn('[mBT] Modal stack depth limit reached (5). Close existing modals first.');
            return;
        }
        // Accessibility & Focus Management
        this.focusStack.push(document.activeElement);
        // Prevent background scrolling while modal is active
        document.body.style.overflow = 'hidden';
        var modalId = "".concat(id, "Modal");
        this.close(modalId, true); // Cleanup duplicates
        // Phase 87B: Dynamic Z-index from stack depth (base 1000 + stack * 10)
        var baseZ = 1000;
        var currentZ = baseZ + (this.stack.length * 10);
        // UPDATED HEADER: Uses grid to perfectly center the title while keeping the close button right-aligned
        var headerHtml = options.hideHeader ? '' : "\n                <div class=\"px-4 py-2.5 border-b border-slate-100 bg-white rounded-t-2xl relative grid grid-cols-[1fr_auto_1fr] items-center shrink-0\">\n                    <div></div> <h2 class=\"text-xs font-black uppercase tracking-widest text-slate-800 text-center truncate px-2\">".concat(title, "</h2>\n                    <div class=\"text-right\">\n                        <button onclick=\"mBT.ui.modal.close('").concat(modalId, "')\" class=\"text-slate-400 hover:text-red-500 transition-all p-1 rounded-md hover:bg-slate-50\">").concat(this.icons.close, "</button>\n                    </div>\n                </div>");
        var fullHtml = "\n                <div id=\"".concat(modalId, "\" class=\"fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 opacity-0 hidden\" tabindex=\"-1\" role=\"dialog\" aria-modal=\"true\" aria-label=\"").concat(title || 'Dialog', "\" style=\"z-index:").concat(currentZ, "\">\n                    <div id=\"").concat(modalId, "Content\" class=\"bg-white rounded-2xl shadow-2xl w-full ").concat(maxWidth, " mx-auto max-h-[95vh] flex flex-col transition-all duration-300 transform scale-95 border border-white/20 overflow-hidden\">\n                        ").concat(headerHtml, "\n                        <div class=\"flex-grow overflow-hidden ").concat(options.noPadding ? 'p-0' : 'p-0', "\" id=\"").concat(modalId, "Body\">").concat(contentHtml, "</div>\n                    </div>\n                </div>");
        container.insertAdjacentHTML('beforeend', fullHtml);
        var modal = document.getElementById(modalId);
        modal.classList.remove('hidden');
        // Phase 87B: Push to stack
        this.stack.push(modalId);
        // Bind ESC handler (only once, uses capture phase)
        if (this.stack.length === 1) {
            document.addEventListener('keydown', this._escHandler, true);
        }
        // Animation & Focus Trapping
        setTimeout(function () {
            var _a;
            modal.classList.remove('opacity-0');
            (_a = document.getElementById("".concat(modalId, "Content"))) === null || _a === void 0 ? void 0 : _a.classList.remove('scale-95');
            // Auto-focus first interactive element
            var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length > 0) {
                var auto = modal.querySelector('[autofocus]');
                if (auto)
                    auto.focus();
                else
                    focusable[0].focus();
            }
            else {
                modal.focus();
            }
        }, 50);
        modal.addEventListener('click', function (e) { if (e.target === modal)
            _this.close(modalId); });
        if (options.onOpen && typeof options.onOpen === 'function')
            setTimeout(options.onOpen, 50);
        return modal;
    },
    // --- Portal Dissolution: Synchronized removal of UI layers ---
    close: function (modalId, instant) {
        var _this = this;
        var _a;
        if (instant === void 0) { instant = false; }
        var modal = document.getElementById(modalId);
        if (!modal)
            return;
        // Phase 87B: Pop from stack
        var stackIdx = this.stack.indexOf(modalId);
        if (stackIdx > -1)
            this.stack.splice(stackIdx, 1);
        // Unbind ESC handler if stack is empty
        if (this.stack.length === 0) {
            document.removeEventListener('keydown', this._escHandler, true);
            document.body.style.overflow = '';
        }
        var finalize = function () {
            modal.remove();
            if (typeof mBTLE !== 'undefined')
                mBTLE.reconcile();
            // Focus Restoration
            if (_this.focusStack && _this.focusStack.length > 0) {
                var el = _this.focusStack.pop();
                if (el && document.body.contains(el))
                    el.focus();
            }
        };
        if (instant) {
            finalize();
        }
        else {
            modal.classList.add('opacity-0');
            (_a = document.getElementById("".concat(modalId, "Content"))) === null || _a === void 0 ? void 0 : _a.classList.add('scale-95');
            setTimeout(finalize, 300);
        }
    },
    // --- System: Non-blocking Confirmation Modal ---
    confirm: function (title, message, onConfirm) {
        var _this = this;
        var content = "\n                <div class=\"p-8 text-center flex flex-col items-center justify-center\">\n                    <div class=\"w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 animate-bounce shadow-sm\">\n                        ".concat(this.icons.alert, "\n                    </div>\n                    <h3 class=\"text-sm font-black uppercase tracking-widest text-slate-800 mb-2\">").concat(title, "</h3>\n                    <p class=\"text-xs text-slate-500 font-bold mb-8 max-w-xs leading-relaxed\">").concat(message, "</p>\n                    <div class=\"flex gap-3 w-full max-w-xs\">\n                        <button id=\"mbtConfirmCancel\" class=\"flex-1 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all\">Cancel</button>\n                        <button id=\"mbtConfirmYes\" class=\"flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black shadow-lg transition-all transform active:scale-95\">Confirm</button>\n                    </div>\n                </div>");
        this.open('confirmation', '', content, 'max-w-sm', { hideHeader: true, noPadding: true });
        // Bind listeners after render
        setTimeout(function () {
            var cancelBtn = document.getElementById('mbtConfirmCancel');
            var yesBtn = document.getElementById('mbtConfirmYes');
            if (cancelBtn)
                cancelBtn.onclick = function () { return _this.close('confirmationModal'); };
            if (yesBtn)
                yesBtn.onclick = function () {
                    _this.close('confirmationModal');
                    if (onConfirm && typeof onConfirm === 'function')
                        onConfirm();
                };
        }, 50);
    },
    // --- System: Non-blocking Alert Modal ---
    alert: function (title, message, onOk) {
        var _this = this;
        var content = "\n                <div class=\"p-8 text-center flex flex-col items-center justify-center\">\n                    <div class=\"w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-4 shadow-sm\">\n                        <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"12\"/><line x1=\"12\" y1=\"16\" x2=\"12.01\" y2=\"16\"/></svg>\n                    </div>\n                    <h3 class=\"text-sm font-black uppercase tracking-widest text-slate-800 mb-2\">".concat(title, "</h3>\n                    <p class=\"text-xs text-slate-500 font-bold mb-8 max-w-xs leading-relaxed\">").concat(message, "</p>\n                    <button id=\"mbtAlertOk\" class=\"w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black shadow-lg transition-all transform active:scale-95\">OK</button>\n                </div>");
        this.open('alert', '', content, 'max-w-sm', { hideHeader: true, noPadding: true });
        setTimeout(function () {
            var okBtn = document.getElementById('mbtAlertOk');
            if (okBtn)
                okBtn.onclick = function () {
                    _this.close('alertModal');
                    if (onOk && typeof onOk === 'function')
                        onOk();
                };
        }, 50);
    },
    // --- System: Non-blocking Prompt Modal ---
    prompt: function (title, message, defaultValue, onOk) {
        var _this = this;
        var content = "\n                <div class=\"p-8 text-center flex flex-col items-center justify-center\">\n                    <h3 class=\"text-sm font-black uppercase tracking-widest text-slate-800 mb-2\">".concat(title, "</h3>\n                    <p class=\"text-xs text-slate-500 font-bold mb-4 max-w-xs leading-relaxed\">").concat(message, "</p>\n                    <input type=\"text\" id=\"mbtPromptInput\" value=\"").concat(defaultValue || '', "\" class=\"w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-6\" autofocus>\n                    <div class=\"flex gap-3 w-full max-w-xs\">\n                        <button id=\"mbtPromptCancel\" class=\"flex-1 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all\">Cancel</button>\n                        <button id=\"mbtPromptOk\" class=\"flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black shadow-lg transition-all transform active:scale-95\">OK</button>\n                    </div>\n                </div>");
        this.open('prompt', '', content, 'max-w-sm', { hideHeader: true, noPadding: true });
        setTimeout(function () {
            var input = document.getElementById('mbtPromptInput');
            if (input) {
                input.focus();
                input.select();
                input.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter')
                        document.getElementById('mbtPromptOk').click();
                });
            }
            var cancelBtn = document.getElementById('mbtPromptCancel');
            var okBtn = document.getElementById('mbtPromptOk');
            if (cancelBtn)
                cancelBtn.onclick = function () { return _this.close('promptModal'); };
            if (okBtn)
                okBtn.onclick = function () {
                    var val = document.getElementById('mbtPromptInput').value;
                    _this.close('promptModal');
                    if (onOk && typeof onOk === 'function')
                        onOk(val);
                };
        }, 50);
    },
    // --- System: Status Loader ---
    showLoader: function (message) {
        var content = "\n                <div class=\"p-6 flex flex-col items-center justify-center\">\n                    <div class=\"w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4\"></div>\n                    <p class=\"text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse\">".concat(message, "</p>\n                </div>");
        this.open('loader', '', content, 'max-w-xs', { hideHeader: true, noPadding: true });
    },
    hideLoader: function () {
        this.close('loaderModal');
    },
    // --- Search Integration: Filtering logic for modal lists ---
    attachSearch: function (inputId, listContainerId, dataItems, renderRowFn) {
        var input = document.getElementById(inputId);
        var list = document.getElementById(listContainerId);
        if (!input || !list)
            return;
        input.addEventListener('input', function (e) {
            var term = e.target.value.toLowerCase();
            var filtered = dataItems.filter(function (item) { return (item.description || item.name || item.label || '').toLowerCase().includes(term); });
            // Logic Resolution: Added col-span-full to support grid layouts in "No Matches" state
            list.innerHTML = filtered.length > 0 ? filtered.map(renderRowFn).join('') : "<div class=\"p-12 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest col-span-full\">No Matches</div>";
        });
    }
};
// --- Global Alias for Backward Compatibility (The Bridge) ---
window.mBTME = mBT.ui.modal;
/* ========= v19.54 mBTPublisher: OUTPUT & COMMUNICATIONS ENGINE ========= */
var mBTPublisher = {
    config: {
        pdf: { margin: 0.2, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } }
    },
    /* --- 1. Communication Protocols (The "Comms" Layer) --- */
    comm: {
        // Logic Resolution: Centralized link generation for consistency
        cleanPhone: function (p) { return p ? p.replace(/\D/g, '') : ''; },
        whatsapp: function (phone, text) {
            if (text === void 0) { text = ''; }
            var p = this.cleanPhone(phone);
            if (!p)
                return '#';
            // Industry Standard: Auto-append country code for Jamaica/US if missing
            var num = (p.length === 10 && (p.startsWith('876') || p.startsWith('658'))) ? '1' + p : p;
            return "https://wa.me/".concat(num, "?text=").concat(encodeURIComponent(text));
        },
        email: function (email, subject, body) {
            if (subject === void 0) { subject = ''; }
            if (body === void 0) { body = ''; }
            return "mailto:".concat(email, "?subject=").concat(encodeURIComponent(subject), "&body=").concat(encodeURIComponent(body));
        },
        call: function (phone) {
            return "tel:".concat(this.cleanPhone(phone));
        },
        // Logic Resolution: Generates the "Share Sheet" for a document
        generateShareSheet: function (doc) {
            var _a, _b, _c;
            var title = doc.label || 'Document';
            var date = ((_c = (_b = (_a = doc.content) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.meta) === null || _c === void 0 ? void 0 : _c.shootDate) || 'TBD';
            return "Here is the ".concat(title, " for ").concat(date, ". Please review.");
        }
    },
    /* --- 2. IO & File Systems (The "Hard Drive" Layer) --- */
    io: {
        forceDownload: function (blob, filename) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        },
        saveMoo: function (budgetData) {
            var blob = new Blob([JSON.stringify(budgetData, null, 2)], { type: 'application/json' });
            this.forceDownload(blob, "".concat((budgetData.projectName || 'project').toLowerCase().replace(/\s+/g, '_'), ".moo"));
        },
        saveTemplate: function (templateData) {
            var blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' });
            this.forceDownload(blob, "".concat((templateData.label || 'template').toLowerCase().replace(/\s+/g, '_'), ".mtemp"));
        },
        saveBundle: function (budgetData) {
            return __awaiter(this, void 0, void 0, function () {
                var zip, cleanName, readme, assetsFolder, cleanBase64, _i, _a, doc, i, file, safeName, fileName, blobUrl, response, blob, err_1, content, e_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (typeof JSZip === 'undefined')
                                return [2 /*return*/, mBTME.alert("Error", "Bundler module (JSZip) missing.")];
                            zip = new JSZip();
                            cleanName = (budgetData.projectName || 'project').toLowerCase().replace(/\s+/g, '_');
                            // 1. Add Core Data
                            zip.file("".concat(cleanName, ".moo"), JSON.stringify(budgetData, null, 2));
                            readme = "Project: ".concat(budgetData.projectName, "\nExported: ").concat(new Date().toLocaleString(), "\n\nContains master budget data (.moo) and embedded assets.\nFormat: Unified Container (Zip-based)");
                            zip.file("README.txt", readme);
                            assetsFolder = zip.folder("assets");
                            cleanBase64 = function (dataurl) { return dataurl.split(',')[1]; };
                            if (!budgetData.documents) return [3 /*break*/, 13];
                            _i = 0, _a = budgetData.documents;
                            _b.label = 1;
                        case 1:
                            if (!(_i < _a.length)) return [3 /*break*/, 13];
                            doc = _a[_i];
                            if (!doc.attachments) return [3 /*break*/, 12];
                            i = 0;
                            _b.label = 2;
                        case 2:
                            if (!(i < doc.attachments.length)) return [3 /*break*/, 12];
                            file = doc.attachments[i];
                            safeName = (file.name || 'file').replace(/[^a-z0-9.]/gi, '_');
                            fileName = "".concat(doc.id, "_").concat(i, "_").concat(safeName);
                            _b.label = 3;
                        case 3:
                            _b.trys.push([3, 10, , 11]);
                            if (!(file.location === 'internal' && file.key)) return [3 /*break*/, 8];
                            return [4 /*yield*/, mBT.data.storage.loadBlob(file.key)];
                        case 4:
                            blobUrl = _b.sent();
                            if (!blobUrl) return [3 /*break*/, 7];
                            return [4 /*yield*/, fetch(blobUrl)];
                        case 5:
                            response = _b.sent();
                            return [4 /*yield*/, response.blob()];
                        case 6:
                            blob = _b.sent();
                            assetsFolder.file(fileName, blob);
                            _b.label = 7;
                        case 7: return [3 /*break*/, 9];
                        case 8:
                            if (file.data) {
                                // Handle Legacy Base64
                                assetsFolder.file(fileName, cleanBase64(file.data), { base64: true });
                            }
                            _b.label = 9;
                        case 9: return [3 /*break*/, 11];
                        case 10:
                            err_1 = _b.sent();
                            console.warn("Failed to bundle asset: ".concat(file.name), err_1);
                            return [3 /*break*/, 11];
                        case 11:
                            i++;
                            return [3 /*break*/, 2];
                        case 12:
                            _i++;
                            return [3 /*break*/, 1];
                        case 13:
                            _b.trys.push([13, 15, , 16]);
                            return [4 /*yield*/, zip.generateAsync({ type: "blob" })];
                        case 14:
                            content = _b.sent();
                            this.forceDownload(content, "".concat(cleanName, ".moo"));
                            return [3 /*break*/, 16];
                        case 15:
                            e_1 = _b.sent();
                            console.error("Bundle Error:", e_1);
                            mBTME.alert("Export Error", "Failed to generate bundle.");
                            return [3 /*break*/, 16];
                        case 16: return [2 /*return*/];
                    }
                });
            });
        }
    },
    /* --- 3. Render Formats (The "Printer" Layer) --- */
    format: {
        // PDF Export (Studio Documents)
        pdf: function (elementId, filename) {
            var element = document.getElementById(elementId);
            if (!element)
                return mBTME.alert("Export Error", "Source element not found");
            // Visual Polish: Flatten inputs for print
            var originalBg = element.style.background;
            element.style.background = "white";
            element.classList.add('print-mode'); // CSS hook for hiding buttons
            html2pdf().set(mBTPublisher.config.pdf).from(element).save(filename + '.pdf')
                .then(function () {
                element.style.background = originalBg;
                element.classList.remove('print-mode');
            });
        },
        // Fast Preview (JPEG Snapshot) with Linearization (Batch 4.1)
        jpeg: function (elementId, callback, options) {
            if (options === void 0) { options = {}; }
            var source = document.getElementById(elementId);
            if (!source)
                return;
            // 1. Clone & Clean (WYSIWYG Capture)
            var clone = source.cloneNode(true);
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
                var items = Array.from(clone.querySelectorAll('.grid-stack-item'));
                items.sort(function (a, b) {
                    var yA = parseInt(a.getAttribute('gs-y')) || 0;
                    var yB = parseInt(b.getAttribute('gs-y')) || 0;
                    var xA = parseInt(a.getAttribute('gs-x')) || 0;
                    var xB = parseInt(b.getAttribute('gs-x')) || 0;
                    return yA - yB || xA - xB;
                });
                // Flatten Items
                items.forEach(function (item) {
                    item.style.position = 'relative';
                    item.style.inset = 'auto';
                    item.style.width = '100%';
                    item.style.height = 'auto';
                    item.style.marginBottom = '20px';
                    item.style.border = '1px solid #000'; // Enforce strict border for standard look
                    item.style.boxShadow = 'none';
                    item.style.borderRadius = '0';
                    // Fix content scrolling & expansion
                    var content = item.querySelector('.grid-stack-item-content');
                    if (content) {
                        content.style.height = 'auto';
                        content.style.overflow = 'visible';
                        content.style.border = 'none'; // handled by wrapper
                        content.style.boxShadow = 'none';
                    }
                    var body = item.querySelector('.widget-body');
                    if (body) {
                        body.style.height = 'auto';
                        body.style.overflow = 'visible';
                        // Expand textareas to fit content
                        body.querySelectorAll('textarea').forEach(function (ta) {
                            ta.style.height = (ta.scrollHeight + 20) + 'px';
                        });
                    }
                    clone.appendChild(item); // Re-append sorted
                });
            }
            else {
                // Graphic Mode: Respect original dimensions
                var rect = source.getBoundingClientRect();
                clone.style.width = source.scrollWidth + "px";
                clone.style.height = source.scrollHeight + "px";
            }
            // 3. De-Clutter (Remove Dashboard Artifacts)
            var artifacts = [
                '.widget-tools',
                '.ui-resizable-handle',
                'button:not(.permanent)',
                '.grid-stack-handle',
                '.widget-controls',
                '.stage-remove-btn'
            ];
            clone.querySelectorAll(artifacts.join(',')).forEach(function (el) { return el.remove(); });
            // 4. Flatten Data (Inputs -> Text) & Copy Canvas
            clone.querySelectorAll('input').forEach(function (el) {
                if (el.type !== 'hidden') {
                    var span = document.createElement('span');
                    span.textContent = el.value;
                    span.className = el.className;
                    span.style.border = 'none';
                    span.style.background = 'transparent';
                    span.style.padding = '0';
                    span.style.fontWeight = 'bold';
                    span.style.width = '100%';
                    span.style.color = '#000'; // Force black text
                    if (el.type === 'checkbox') {
                        var checkSvg = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\"><polyline points=\"20 6 9 17 4 12\"/></svg>";
                        var boxSvg = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/></svg>";
                        span.innerHTML = el.checked ? checkSvg : boxSvg;
                    }
                    el.parentNode.replaceChild(span, el);
                }
            });
            clone.querySelectorAll('textarea').forEach(function (el) {
                var div = document.createElement('div');
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
            var origCanvases = source.querySelectorAll('canvas');
            var cloneCanvases = clone.querySelectorAll('canvas');
            origCanvases.forEach(function (orig, i) {
                if (cloneCanvases[i]) {
                    cloneCanvases[i].width = orig.width;
                    cloneCanvases[i].height = orig.height;
                    var ctx = cloneCanvases[i].getContext('2d');
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
            }).then(function (canvas) {
                document.body.removeChild(clone);
                if (callback)
                    callback(canvas.toDataURL('image/jpeg', 0.9));
            }).catch(function (err) {
                console.error("Snapshot Failed", err);
                document.body.removeChild(clone);
            });
        },
        // Digital Export (Standalone HTML)
        htmlStandalone: function (elementId, title) {
            var source = document.getElementById(elementId);
            if (!source)
                return mBTME.alert("Export Error", "Content source missing.");
            // 1. Clone & Clean
            var clone = source.cloneNode(true);
            clone.classList.remove('editing-mode');
            // Remove UI artifacts
            clone.querySelectorAll('button, .widget-controls, .grid-stack-handle, .ui-resizable-handle').forEach(function (el) { return el.remove(); });
            // Linearize GridStack (Convert absolute grid to vertical stack for reliability)
            clone.querySelectorAll('.grid-stack-item').forEach(function (item) {
                item.style.position = 'relative';
                item.style.left = 'auto';
                item.style.top = 'auto';
                item.style.width = '100%';
                item.style.height = 'auto';
                item.style.marginBottom = '24px';
                var content = item.querySelector('.grid-stack-item-content');
                if (content)
                    content.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            });
            var gridContainer = clone.querySelector('.grid-stack');
            if (gridContainer) {
                gridContainer.style.height = 'auto';
                gridContainer.className = 'flex flex-col'; // Remove grid-stack class
            }
            // Flatten Inputs to Read-Only Text
            clone.querySelectorAll('input, select').forEach(function (el) {
                var span = document.createElement('span');
                span.textContent = el.value;
                span.className = el.className;
                // Reset input styles
                span.style.border = 'none';
                span.style.background = 'transparent';
                span.style.display = 'inline-block';
                span.style.width = 'auto';
                if (el.type === 'date' && el.value)
                    span.textContent = new Date(el.value).toLocaleDateString();
                el.parentNode.replaceChild(span, el);
            });
            clone.querySelectorAll('textarea').forEach(function (el) {
                var div = document.createElement('div');
                div.innerHTML = el.value.replace(/\n/g, '<br>');
                div.className = el.className + ' whitespace-pre-wrap';
                div.style.height = 'auto';
                div.style.border = 'none';
                div.style.resize = 'none';
                el.parentNode.replaceChild(div, el);
            });
            // 2. Build Standalone Shell
            // Note: Script tags are escaped to prevent browser parsing errors in the main app
            var html = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>".concat(mBT.ui.render.esc(title), "</title>\n    <script src=\"https://cdn.tailwindcss.com\"></script>\n    <style>\n        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');\n        body { font-family: 'Inter', sans-serif; background-color: #f3f4f6; padding: 20px; }\n        .grid-stack-item-content { background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; }\n        .widget-header { background: #f9fafb; padding: 12px; border-bottom: 1px solid #f3f4f6; font-weight: 900; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; color: #9ca3af; }\n        .widget-body { padding: 16px; }\n    </style>\n</head>\n<body>\n    <div class=\"max-w-3xl mx-auto\">\n        <div class=\"text-center mb-10\">\n            <h1 class=\"text-3xl font-black uppercase tracking-tighter text-slate-900\">").concat(mBT.ui.render.esc(title), "</h1>\n            <p class=\"text-xs font-bold text-slate-400 uppercase tracking-widest mt-2\">MooBudget Digital Export</p>\n        </div>\n        ").concat(clone.innerHTML, "\n        <div class=\"mt-12 text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest\">\n            Generated by MooBudget Tool\n        </div>\n    </div>\n</body>\n</html>");
            // 3. Export
            var blob = new Blob([html], { type: 'text/html' });
            mBTPublisher.io.forceDownload(blob, "".concat(title.replace(/\s+/g, '_'), "_Digital.html"));
        },
        // --- RESTORED: Professional Typesetter Engine (v19.50 Logic) ---
        professionalPdf: function (budgetData, options) {
            if (options === void 0) { options = {}; }
            if (typeof window.jspdf === 'undefined')
                return mBTME.alert("Error", "PDF Engine missing.");
            var jsPDF = window.jspdf.jsPDF;
            var doc = new jsPDF(mBTPublisher.config.pdf.jsPDF);
            var currency = displayCurrency || 'JMD';
            var fmt = function (val) { return mBTLE.format.currency(val, currency); };
            // --- 1. Header & Meta ---
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text((budgetData.projectName || "Untitled Production").toUpperCase(), 105, 15, { align: "center" });
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text("".concat(budgetData.company || "Independent", " | Date: ").concat(new Date().toLocaleDateString()), 105, 22, { align: "center" });
            // --- 2. Executive Summary ---
            var summaryData = [
                ["Subtotal", fmt(budgetData.subtotal)],
                ["Contingency (".concat(budgetData.contingencyPercentage, "%)"), fmt(budgetData.subtotal * (budgetData.contingencyPercentage / 100))],
                ["Sales Tax (".concat(budgetData.salesTaxPercentage, "%)"), fmt(budgetData.subtotal * (budgetData.salesTaxPercentage / 100))],
                ["Discount (".concat(budgetData.discountPercentage, "%)"), "-".concat(fmt(budgetData.subtotal * (budgetData.discountPercentage / 100)))],
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
            var finalY = doc.lastAutoTable.finalY + 10;
            var bodyRows = [];
            Object.entries(budgetData.sections).forEach(function (_a) {
                var secName = _a[0], sec = _a[1];
                // Section Header Row
                bodyRows.push([{ content: secName.toUpperCase(), colSpan: 5, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [71, 85, 105] } }]); // Slate-100/600
                sec.items.forEach(function (item) {
                    var total = parseFloat(item.total) || 0;
                    var rate = parseFloat(item.rate) || 0;
                    var qty = parseFloat(item.quantity) || 0;
                    bodyRows.push([
                        item.description,
                        qty,
                        item.unit,
                        fmt(rate),
                        fmt(total)
                    ]);
                });
                // Section Footer
                bodyRows.push([{ content: "Total ".concat(secName, ": ").concat(fmt(sec.total)), colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] } }]); // Blue-600
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
                    var str = "Page " + doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setTextColor(150);
                    var pageSize = doc.internal.pageSize;
                    var pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                    doc.text(str, data.settings.margin.left, pageHeight - 10);
                    doc.text("Generated by mooBudget v".concat(APP_VERSION), pageSize.width - 14, pageHeight - 10, { align: 'right' });
                }
            });
            // --- 4. Output ---
            var filename = "".concat((budgetData.projectName || 'Budget').replace(/[^a-z0-9]/gi, '_'), ".pdf");
            doc.save(filename);
        },
        // --- NEW: Champion Layout Engine (Strict A4) ---
        championCallSheet: function (docData) {
            var d = docData || {};
            var meta = d.meta || {};
            var contacts = d.contacts || {};
            var schedule = d.schedule || [];
            var cast = d.cast || [];
            var crew = d.crew || [];
            var locs = d.locations || [];
            // Helper: Time Format
            var t = function (val) { return val || '--:--'; };
            // 1. CSS (The "Champion" Style Definition)
            var css = "\n                    <style>\n                        @import url('https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&display=swap');\n                        .cs-body { font-family: 'Roboto Condensed', sans-serif; font-size: 10pt; color: #000; background: #fff; width: 210mm; min-height: 297mm; padding: 10mm; box-sizing: border-box; position: relative; }\n                        .cs-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px; }\n                        .cs-title { font-size: 24pt; font-weight: bold; text-transform: uppercase; line-height: 0.9; }\n                        .cs-meta { font-size: 9pt; text-align: right; }\n                        \n                        .cs-grid-3 { display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 10px; margin-bottom: 10px; font-size: 8pt; }\n                        .cs-box { border: 1px solid #000; }\n                        .cs-box-header { background: #000; color: #fff; font-weight: bold; padding: 2px 5px; text-transform: uppercase; font-size: 8pt; }\n                        .cs-box-content { padding: 5px; }\n                        \n                        .cs-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9pt; }\n                        .cs-table th { background: #000; color: #fff; font-weight: bold; text-transform: uppercase; padding: 4px; border: 1px solid #000; text-align: left; }\n                        .cs-table td { border: 1px solid #000; padding: 4px; vertical-align: top; }\n                        .cs-row-grey { background: #eee; }\n                        \n                        .cs-banner { background: #000; color: #fff; font-weight: bold; text-align: center; padding: 3px; text-transform: uppercase; margin-bottom: 5px; font-size: 10pt; }\n                        \n                        .cs-weather { display: flex; justify-content: space-between; font-size: 8pt; }\n                        \n                        /* Density Utils */\n                        .text-right { text-align: right; }\n                        .text-center { text-align: center; }\n                        .font-bold { font-weight: bold; }\n                        .w-10 { width: 10%; }\n                    </style>\n                ";
            // 2. HTML Structure (Mapped to Data)
            var html = "\n                    <div class=\"cs-body\">\n                        <!-- HEADER -->\n                        <div class=\"cs-header\">\n                            <div>\n                                <div class=\"cs-title\">".concat(mBT.ui.render.esc(meta.productionTitle || 'UNTITLED PROJECT'), "</div>\n                                <div style=\"font-weight:bold; font-size:12pt;\">CALL SHEET</div>\n                            </div>\n                            <div class=\"cs-meta\">\n                                <div><strong>Date:</strong> ").concat(meta.shootDate || 'TBD', "</div>\n                                <div><strong>Crew Call:</strong> ").concat(meta.crewCallTime || '07:00', "</div>\n                                <div style=\"margin-top:5px; font-size:12pt; font-weight:bold;\">").concat(mBTDB.calcShootDay(meta.shootDate), "</div>\n                            </div>\n                        </div>\n\n                        <!-- TOP INFO GRID -->\n                        <div class=\"cs-grid-3\">\n                            <!-- Left: Production -->\n                            <div class=\"cs-box\">\n                                <div class=\"cs-box-header\">Production Office</div>\n                                <div class=\"cs-box-content\">\n                                    <strong>Director:</strong> ").concat(contacts.director || 'TBD', "<br>\n                                    <strong>Producer:</strong> ").concat(contacts.producer || 'TBD', "<br>\n                                    <strong>1st AD:</strong> ").concat(contacts.ad || 'TBD', "<br>\n                                    <br>\n                                    ").concat(meta.productionCompany || 'Indie Prod', "\n                                </div>\n                            </div>\n                            \n                            <!-- Center: Locations -->\n                            <div class=\"cs-box\">\n                                <div class=\"cs-box-header\">Locations</div>\n                                <div class=\"cs-box-content\">\n                                    ").concat(locs.map(function (l, i) { return "\n                                        <div style=\"margin-bottom:5px;\">\n                                            <strong>LOC ".concat(i + 1, ":</strong> ").concat(l.name, "<br>\n                                            ").concat(l.address, "<br>\n                                            <em style=\"font-size:7pt\">Nearest Hosp: ").concat(l.hospital || 'Dial 911', "</em>\n                                        </div>\n                                    "); }).join(''), "\n                                </div>\n                            </div>\n\n                            <!-- Right: Weather & Specs -->\n                            <div class=\"cs-box\">\n                                <div class=\"cs-box-header\">Conditions</div>\n                                <div class=\"cs-box-content\">\n                                    <div class=\"cs-weather\">\n                                        <span>Sunrise: ").concat(meta.sunriseSunset ? meta.sunriseSunset.split('/')[0] : '06:00', "</span>\n                                        <span>Sunset: ").concat(meta.sunriseSunset ? meta.sunriseSunset.split('/')[1] : '18:00', "</span>\n                                    </div>\n                                    <hr style=\"border:0; border-top:1px dashed #ccc; margin:4px 0;\">\n                                    ").concat(locs[0] && locs[0].weather ? locs[0].weather : 'Sunny, 30°C', "\n                                </div>\n                            </div>\n                        </div>\n\n                        <!-- SHOOTING SCHEDULE -->\n                        <div class=\"cs-banner\">Shooting Schedule</div>\n                        <table class=\"cs-table\">\n                            <thead>\n                                <tr>\n                                    <th style=\"width:10%\">Time</th>\n                                    <th style=\"width:8%\">Scn</th>\n                                    <th style=\"width:8%\">I/E</th>\n                                    <th>Description / Action</th>\n                                    <th style=\"width:15%\">Cast</th>\n                                    <th style=\"width:15%\">Location</th>\n                                </tr>\n                            </thead>\n                            <tbody>\n                                ").concat(schedule.map(function (row, i) {
                var isMeal = row.type === 'meal';
                if (isMeal)
                    return "<tr class=\"cs-row-grey\"><td class=\"text-center font-bold\">".concat(t(row.time), "</td><td colspan=\"5\" class=\"text-center font-bold uppercase\">").concat(row.description, "</td></tr>");
                return "\n                                    <tr>\n                                        <td class=\"text-center font-bold\">".concat(t(row.time), "</td>\n                                        <td class=\"text-center\">").concat(row.scene || '-', "</td>\n                                        <td class=\"text-center\">").concat(row.ie || '-', "</td>\n                                        <td><strong>").concat(row.description || '', "</strong><br><em style=\"font-size:8pt\">").concat(row.note || '', "</em></td>\n                                        <td class=\"text-center\">").concat(row.cast || '', "</td>\n                                        <td class=\"text-center\">").concat(row.loc || '1', "</td>\n                                    </tr>");
            }).join(''), "\n                            </tbody>\n                        </table>\n\n                        <!-- CAST LIST -->\n                        <div class=\"cs-banner\">Cast & Talent</div>\n                        <table class=\"cs-table\">\n                            <thead>\n                                <tr>\n                                    <th>Character</th>\n                                    <th>Artist</th>\n                                    <th class=\"text-center\">Pickup</th>\n                                    <th class=\"text-center\">H/MU</th>\n                                    <th class=\"text-center\">Costume</th>\n                                    <th class=\"text-center\">Set Call</th>\n                                </tr>\n                            </thead>\n                            <tbody>\n                                ").concat(cast.map(function (c) { return "\n                                    <tr>\n                                        <td><strong>".concat(c.character, "</strong></td>\n                                        <td>").concat(c.actor, "</td>\n                                        <td class=\"text-center\">").concat(t(c.pickup), "</td>\n                                        <td class=\"text-center\">").concat(t(c.hmu), "</td>\n                                        <td class=\"text-center\">").concat(t(c.costume), "</td>\n                                        <td class=\"text-center font-bold\">").concat(t(c.setCall), "</td>\n                                    </tr>\n                                "); }).join(''), "\n                            </tbody>\n                        </table>\n                        \n                        <!-- FOOTER -->\n                        <div style=\"position: absolute; bottom: 10mm; width: 100%; border-top: 1px solid #000; padding-top:5px; font-size:8pt; text-align:center;\">\n                            PRODUCED BY: ").concat(meta.productionCompany || 'Indie Prod', " | RECYCLE BIN: Please destroy this document after use.\n                        </div>\n                    </div>\n                ");
            // 3. Render
            var win = window.open('', '_blank');
            win.document.write('<html><head><title>Call Sheet</title>' + css + '</head><body>' + html + '</body></html>');
            win.document.close();
            setTimeout(function () { return win.print(); }, 500);
        },
        professionalXlsx: function (budgetData) {
            if (typeof XLSX === 'undefined')
                return mBTME.alert("Error", "Excel Engine missing.");
            // 1. Setup Workbook
            var wb = XLSX.utils.book_new();
            var wsData = [];
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
            Object.entries(budgetData.sections).forEach(function (_a) {
                var key = _a[0], sec = _a[1];
                // Section Header
                wsData.push([key.toUpperCase(), "", "", "", "", "", "", ""]);
                sec.items.forEach(function (item) {
                    var qty = parseFloat(item.quantity) || 0;
                    var rate = parseFloat(item.rate) || 0;
                    var est = qty * rate;
                    var act = parseFloat(item.actual) || 0;
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
            var ws = XLSX.utils.aoa_to_sheet(wsData);
            // Set Column Widths
            ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, ws, "Budget");
            XLSX.writeFile(wb, "".concat((budgetData.projectName || 'budget').replace(/\s+/g, '_'), ".xlsx"));
        },
    },
    // --- Bridge: Main Entry Points ---
    exportToPDF: function (id, name) { this.format.pdf(id, name); },
    toMoo: function () { this.io.saveMoo(budget); },
    // Logic Resolution: Adapter for Batch 4.1 Linearization (Standard vs Graphic)
    generateFastPreview: function (mode, data, cb) {
        var opts = (mode === 'standard') ? { linearize: true, bg: '#ffffff' } : {};
        this.format.jpeg('mBTDB_Workspace', cb, opts);
    },
    downloadJPEG: function (url, title) {
        var a = document.createElement('a');
        a.href = url;
        a.download = "".concat(title, ".jpg");
        a.click();
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
        var _this = this;
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(function () {
            _this._triggerSave();
            // Visual Feedback for Auto-Save
            var status = document.getElementById('statusBar');
            if (status) {
                // Subtle indicator
                var indicator_1 = document.createElement('div');
                indicator_1.className = "fixed bottom-4 right-4 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg animate-pulse z-[1000] pointer-events-none";
                indicator_1.innerText = "Auto-Saved";
                document.body.appendChild(indicator_1);
                setTimeout(function () { return indicator_1.remove(); }, 2000);
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
        var data = JSON.parse(JSON.stringify(doc.content.data));
        if (!budget || !budget.sections) {
            // Cache even if no budget link exists
            this.state._cache = { docId: doc.id, data: data };
            return data;
        }
        // Fast Lookup Map
        var budgetMap = new Map();
        Object.values(budget.sections).forEach(function (sec) {
            sec.items.forEach(function (i) { return budgetMap.set(i.id, i); });
        });
        // 1. Sync Lists (Crew, Cast)
        ['crew', 'cast'].forEach(function (key) {
            if (Array.isArray(data[key])) {
                data[key] = data[key].map(function (item) {
                    var _a, _b, _c, _d;
                    if (item.linkedItemId && budgetMap.has(item.linkedItemId)) {
                        var bItem = budgetMap.get(item.linkedItemId);
                        if (key === 'crew') {
                            item.name = ((_a = bItem.crew) === null || _a === void 0 ? void 0 : _a.name) || bItem.description;
                            item.contact = ((_b = bItem.crew) === null || _b === void 0 ? void 0 : _b.phone) || item.contact;
                            item.position = bItem.description;
                        }
                        else if (key === 'cast') {
                            item.actor = ((_c = bItem.crew) === null || _c === void 0 ? void 0 : _c.name) || item.actor;
                            item.contact = ((_d = bItem.crew) === null || _d === void 0 ? void 0 : _d.phone) || item.contact;
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
        var doc = budget.documents.find(function (d) { return d.id === docId; });
        if (!doc)
            return;
        if (!doc.content)
            doc.content = { data: {}, widgets: [] };
        // Logic Resolution: Auto-Hydrate from Central Registry (Open Gate)
        if (!doc.content.widgets || doc.content.widgets.length === 0) {
            // Tier 2.5 Handshake: Pull blueprints from Open Gate
            var registry = (typeof mBTOG !== 'undefined' && mBTOG.templates) ? mBTOG.templates : [];
            var tmpl = registry.find(function (t) { return t.id === doc.type; });
            // Fallback Heuristics for Legacy Types
            if (!tmpl) {
                if (['storyboard', 'budgetRep', 'vendorBid', 'riskAI', 'carbon', 'postSched'].includes(doc.type)) {
                    // Map legacy complex types to Script defaults if specific template missing
                    tmpl = registry.find(function (t) { return t.id === 'script'; });
                }
                // Ultimate Fallback
                if (!tmpl)
                    tmpl = { widgets: [{ id: 'meta_header', x: 0, y: 0, w: 12, h: 2, type: 'header' }] };
            }
            doc.content.widgets = JSON.parse(JSON.stringify(tmpl.widgets));
            // Phase 1: Hard Save - Merge Template Defaults with System Defaults
            var sysDefaults = this._generateDefaultData();
            var tmplDefaults_1 = tmpl.defaults || {};
            // Deep merge logic for defaults
            doc.content.data = JSON.parse(JSON.stringify(sysDefaults));
            if (tmplDefaults_1) {
                Object.keys(tmplDefaults_1).forEach(function (key) {
                    if (Array.isArray(tmplDefaults_1[key])) {
                        doc.content.data[key] = __spreadArray([], tmplDefaults_1[key], true);
                    }
                    else if (typeof tmplDefaults_1[key] === 'object' && tmplDefaults_1[key] !== null) {
                        doc.content.data[key] = __assign(__assign({}, doc.content.data[key]), tmplDefaults_1[key]);
                    }
                    else {
                        doc.content.data[key] = tmplDefaults_1[key];
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
        if (typeof mBTME !== 'undefined')
            mBTME.close('documentViewerModal');
        document.body.classList.remove('print-mode');
        this.state.currentDocId = null;
        if (typeof mBTLE !== 'undefined')
            mBTLE.reconcile();
        if (typeof render === 'function')
            render();
    },
    toggleEditMode: function () {
        var _this = this;
        if (this.state.isEditing && this.state.grid)
            this._saveLayoutState();
        this.state.isEditing = !this.state.isEditing;
        var container = document.getElementById('mBTDB_Workspace');
        var grid = this.state.grid;
        if (container && grid) {
            if (this.state.isEditing) {
                container.classList.add('editing-mode');
                grid.setStatic(false);
            }
            else {
                container.classList.remove('editing-mode');
                grid.setStatic(true);
            }
            // CRITICAL FIX: Re-render UI to update 'disabled' state on inputs
            var doc_1 = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
            if (doc_1) {
                this._renderMetaHeader(doc_1);
                doc_1.content.widgets.forEach(function (w) {
                    var el = document.querySelector(".grid-stack-item[gs-id=\"".concat(w.id, "\"] .widget-body"));
                    if (el)
                        el.innerHTML = _this._getContentForWidget(w, doc_1);
                });
                // Re-init canvas logic for MudMaps after re-render
                this._initMudMaps();
            }
            this._updateHeaderButtons();
        }
    },
    _saveLayoutState: function () {
        var _this = this;
        if (!this.state.grid)
            return;
        var doc = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
        this.state.grid.engine.nodes.forEach(function (node) {
            var widget = doc.content.widgets.find(function (w) { return w.id === node.id; });
            if (widget) {
                widget.x = node.x;
                widget.y = node.y;
                widget.w = node.w;
                widget.h = node.h;
            }
        });
        this._triggerSave();
        mBT.data.save(); // Force disk commit
    },
    // --- 3. Publishing & Intelligence Hub ---
    openPreviewSelector: function () {
        var content = "\n            <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-50\">\n                <button onclick=\"mBTME.close('previewSelectorModal'); mBTDB.previewDoc('standard')\" class=\"flex flex-col items-center gap-4 p-6 bg-white border border-slate-200 rounded-3xl hover:border-blue-500 hover:shadow-xl transition-all group text-center w-full\">\n                    <div class=\"w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform\">\n                        ".concat(mBTAssets.file, "\n                    </div>\n                    <div>\n                        <h4 class=\"font-black text-xs uppercase tracking-widest text-slate-800\">Industry Standard</h4>\n                        <p class=\"text-[9px] text-slate-400 font-bold mt-1\">Clean White \u2022 High Contrast</p>\n                    </div>\n                </button>\n\n                <button onclick=\"mBTME.close('previewSelectorModal'); mBTDB.previewDoc('graphic')\" class=\"flex flex-col items-center gap-4 p-6 bg-white border border-slate-200 rounded-3xl hover:border-purple-500 hover:shadow-xl transition-all group text-center w-full\">\n                    <div class=\"w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform\">\n                        ").concat(mBTAssets.image, "\n                    </div>\n                    <div>\n                        <h4 class=\"font-black text-xs uppercase tracking-widest text-slate-800\">Graphic Layout</h4>\n                        <p class=\"text-[9px] text-slate-400 font-bold mt-1\">Workspace Grey \u2022 Original UI</p>\n                    </div>\n                </button>\n            </div>");
        mBTME.open('previewSelector', 'Capture Mode', content, 'max-w-lg', { noPadding: true });
    },
    previewDoc: function (mode) {
        var _this = this;
        var doc = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
        if (!doc || typeof mBTPublisher === 'undefined')
            return;
        var workspace = document.getElementById('mBTDB_Workspace');
        if (!workspace)
            return;
        // Logic Resolution: For 'standard' mode, we temporarily strip the workspace grey 
        // to ensure a high-contrast white paper export.
        if (mode === 'standard') {
            workspace.classList.remove('bg-slate-200');
            workspace.classList.add('bg-white');
        }
        if (mBTME.showLoader)
            mBTME.showLoader("Rendering ".concat(mode === 'standard' ? 'Industry' : 'Graphic', " Preview..."));
        mBTPublisher.generateFastPreview(mode, doc.content.data, function (jpegURL) {
            // Restore visual separation state
            if (mode === 'standard') {
                workspace.classList.remove('bg-white');
                workspace.classList.add('bg-slate-200');
            }
            if (mBTME.hideLoader)
                mBTME.hideLoader();
            mBTME.open('previewModal', "Snapshot: ".concat(mode.toUpperCase()), "<div class=\"flex flex-col items-center bg-slate-900 h-full p-8 overflow-auto no-scrollbar\"><img src=\"".concat(jpegURL, "\" id=\"finalPreviewImage\" class=\"shadow-2xl border border-black max-w-full h-auto mb-24 bg-white rounded-sm\"><div class=\"fixed bottom-10 left-1/2 -translate-x-1/2 flex gap-4 z-[10001]\"><button onclick=\"mBTPublisher.downloadJPEG('").concat(jpegURL, "', '").concat(doc.label, "')\" class=\"flex items-center gap-3 bg-blue-600 text-white px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-blue-500 transition-all active:scale-95\">Download JPEG</button><button onclick=\"mBTDB.sendToDistribution('").concat(jpegURL, "')\" class=\"flex items-center gap-3 bg-emerald-600 text-white px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-emerald-500 transition-all active:scale-95\">Send to Crew</button><button onclick=\"mBTME.close('previewModal')\" class=\"bg-white text-slate-900 px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-slate-100 transition-all\">Close</button></div></div>"), 'w-full h-full');
        });
    },
    sendToDistribution: function (jpegURL) {
        var _this = this;
        var doc = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
        // Logic Resolution: Close only the preview modal, keeping the Studio active
        mBTME.close('previewModal');
        if (window.openDocumentShareSelector)
            window.openDocumentShareSelector(doc.id);
        else
            mBTME.alert("Module Error", "Distribution Hub not active.");
    },
    // --- NEW: AI Hospital Lookup ---
    autoFillHospital: function (docId, index, address) {
        return __awaiter(this, void 0, void 0, function () {
            var provider, apiKey, prompt, result, clean, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!address)
                            return [2 /*return*/];
                        provider = mBT.features.ai.getSelectedProvider();
                        apiKey = mBT.features.ai.getStoredApiKey(provider);
                        if (!apiKey)
                            return [2 /*return*/]; // Silent skip if no AI
                        prompt = "Identify the nearest emergency hospital to this address: \"".concat(address, "\". Return ONLY the name of the hospital. Do not include address or other text.");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, mBT.features.ai.callUnifiedAI(provider, apiKey, prompt)];
                    case 2:
                        result = _a.sent();
                        clean = result.replace(/Here is the.*?|The nearest.*?is/gi, '').replace(/[".]/g, '').trim();
                        this.updateRow(docId, 'locations', index, 'hospital', clean);
                        return [3 /*break*/, 4];
                    case 3:
                        e_2 = _a.sent();
                        console.warn("AI Hospital Lookup failed", e_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    },
    /* --- [Feat16]. Mud Map Intelligence (Geocoding Engine) --- */
    getCoordinates: function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var res, data, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!query)
                            return [2 /*return*/, null];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch("https://geocoding-api.open-meteo.com/v1/search?name=".concat(encodeURIComponent(query), "&count=1&language=en&format=json"))];
                    case 2:
                        res = _a.sent();
                        return [4 /*yield*/, res.json()];
                    case 3:
                        data = _a.sent();
                        if (data.results && data.results.length > 0) {
                            return [2 /*return*/, { lat: data.results[0].latitude, lon: data.results[0].longitude }];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        e_3 = _a.sent();
                        console.error("Geocoding failed", e_3);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/, null];
                }
            });
        });
    },
    /* --- [Feat16]. Mud Map Intelligence (Slate Generator) --- */
    loadMapBackground: function (widgetId, docId) {
        return __awaiter(this, void 0, void 0, function () {
            var doc, loc, query, coords, cvs, ctx, w, h, x, y;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        doc = budget.documents.find(function (d) { return d.id === docId; });
                        if (!doc)
                            return [2 /*return*/];
                        loc = (_a = doc.content.data.locations) === null || _a === void 0 ? void 0 : _a[0];
                        query = loc ? (loc.address || loc.name) : "";
                        if (!query)
                            return [2 /*return*/, mBTME.alert("Map Error", "No location address found in Logistics.")];
                        mBTME.showLoader("Locating Site...");
                        return [4 /*yield*/, this.getCoordinates(query)];
                    case 1:
                        coords = _b.sent();
                        mBTME.hideLoader();
                        if (!coords)
                            return [2 /*return*/, mBTME.alert("Not Found", "Could not locate address.")];
                        cvs = document.getElementById("canvas_".concat(widgetId));
                        if (cvs) {
                            ctx = cvs.getContext('2d');
                            w = cvs.width;
                            h = cvs.height;
                            // A. Background & Grid
                            ctx.fillStyle = "#f8fafc"; // Slate-50
                            ctx.fillRect(0, 0, w, h);
                            ctx.strokeStyle = "#e2e8f0"; // Slate-200
                            ctx.lineWidth = 1;
                            for (x = 20; x < w; x += 40) {
                                ctx.beginPath();
                                ctx.moveTo(x, 0);
                                ctx.lineTo(x, h);
                                ctx.stroke();
                            }
                            for (y = 20; y < h; y += 40) {
                                ctx.beginPath();
                                ctx.moveTo(0, y);
                                ctx.lineTo(w, y);
                                ctx.stroke();
                            }
                            // B. Header Block
                            ctx.fillStyle = "#0f172a"; // Slate-900
                            ctx.fillRect(0, 0, w, 60);
                            ctx.fillStyle = "#ffffff";
                            ctx.font = "bold 14px 'Arial', sans-serif";
                            ctx.fillText("SITE PLAN / MUD MAP", 15, 25);
                            ctx.font = "10px 'Arial', sans-serif";
                            ctx.fillStyle = "#94a3b8";
                            ctx.fillText("LOC: ".concat(loc.name.toUpperCase()), 15, 45);
                            // C. GPS Watermark
                            ctx.fillStyle = "#475569";
                            ctx.font = "bold 12px 'Courier New', monospace";
                            ctx.fillText("ADDR: ".concat(query), 15, 80);
                            ctx.fillText("GPS:  ".concat(coords.lat.toFixed(6), ", ").concat(coords.lon.toFixed(6)), 15, 95);
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
                            this.updateData(docId, "additional.".concat(widgetId), cvs.toDataURL());
                        }
                        return [2 /*return*/];
                }
            });
        });
    },
    autoFillWidget: function (type, docId) {
        var _this = this;
        mBTME.confirm("Auto-Fill", "Auto-fill ".concat(type, "? This uses external services and AI."), function () { return __awaiter(_this, void 0, void 0, function () {
            var doc, map, locs, i, l, widget, content, el;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        doc = budget.documents.find(function (d) { return d.id === docId; });
                        if (!doc)
                            return [2 /*return*/];
                        if (!(type === 'contacts')) return [3 /*break*/, 1];
                        map = { 'director': 'Director', 'producer': 'Producer', 'ad': '1st AD' };
                        Object.entries(map).forEach(function (_a) {
                            var key = _a[0], role = _a[1];
                            var hit = null;
                            if (budget.sections)
                                Object.values(budget.sections).some(function (s) {
                                    var i = s.items.find(function (x) { return x.description.toLowerCase().includes(role.toLowerCase()) && x.crew && x.crew.name; });
                                    if (i) {
                                        hit = { name: i.crew.name, contact: i.crew.phone || i.crew.email };
                                        return true;
                                    }
                                });
                            if (!hit) {
                                var g = mBTOG.contacts.find(function (x) { return x.role && x.role.toLowerCase().includes(role.toLowerCase()); });
                                if (g)
                                    hit = { name: g.name, contact: g.contact || g.phone };
                            }
                            if (hit)
                                _this.updateData(docId, "contacts.".concat(key), "".concat(hit.name, " ").concat(hit.contact || ''));
                        });
                        return [3 /*break*/, 9];
                    case 1:
                        if (!(type === 'crew')) return [3 /*break*/, 2];
                        Object.values(budget.sections).forEach(function (sec) { return sec.items.forEach(function (i) {
                            if (i.crew && i.crew.name) {
                                var exists = doc.content.data.crew.some(function (c) { return c.name === i.crew.name && c.department === i.description; });
                                if (!exists) {
                                    _this.addRow(docId, 'crew', 'person', { department: i.description, name: i.crew.name, contact: i.crew.phone, linkedItemId: i.id });
                                }
                            }
                        }); });
                        return [3 /*break*/, 9];
                    case 2:
                        if (!(type === 'logistics' || type === 'locations')) return [3 /*break*/, 9];
                        locs = doc.content.data.locations || [];
                        mBTME.showLoader("Scanning Locations...");
                        i = 0;
                        _a.label = 3;
                    case 3:
                        if (!(i < locs.length)) return [3 /*break*/, 8];
                        l = locs[i];
                        if (!l.name) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.autoFillWeather(docId, i, l.name)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        if (!(l.address && !l.hospital)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.autoFillHospital(docId, i, l.address)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        i++;
                        return [3 /*break*/, 3];
                    case 8:
                        mBTME.hideLoader();
                        _a.label = 9;
                    case 9:
                        widget = doc.content.widgets.find(function (w) { return w.type === type; });
                        if (widget) {
                            content = this._getContentForWidget(widget, doc);
                            el = document.querySelector(".grid-stack-item[gs-id=\"".concat(widget.id, "\"] .widget-body"));
                            if (el)
                                el.innerHTML = content;
                            // Update Header Sun/Moon if modified
                            if (type === 'logistics' || type === 'locations')
                                this._renderMetaHeader(doc);
                        }
                        else {
                            this.renderFrame();
                        }
                        return [2 /*return*/];
                }
            });
        }); });
    },
    assistantFill: function (widgetId, docId) {
        return __awaiter(this, void 0, void 0, function () {
            var doc, widget, provider, apiKey, currentVal, isScript, prompt, locSetting, prodAddr, locationContext, result, cleanResult, el, e_4;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        doc = budget.documents.find(function (d) { return d.id === docId; });
                        if (!doc)
                            return [2 /*return*/];
                        widget = doc.content.widgets.find(function (w) { return w.id === widgetId; });
                        if (!widget)
                            return [2 /*return*/];
                        provider = mBT.features.ai.getSelectedProvider();
                        apiKey = mBT.features.ai.getStoredApiKey(provider);
                        if (!apiKey)
                            return [2 /*return*/, mBTME.alert("Assistant Offline", "Please configure API Key in settings to use Assistant Fill.")];
                        currentVal = ((_a = doc.content.data.additional) === null || _a === void 0 ? void 0 : _a[widgetId]) || "";
                        isScript = (doc.type === 'script' || widget.label.toLowerCase().includes('script')) && widget.type === 'richText';
                        // ROUTE 1: SCRIPT PARSING (Structure Extraction)
                        // Trigger: Script document + RichText widget + Content > 50 chars
                        if (isScript && currentVal.length > 50) {
                            mBTME.confirm("Script Analysis", "Analyze script text to extract Scenes and Cast data?", function () { return __awaiter(_this, void 0, void 0, function () {
                                var prompt, result, jsonStr, data, report, updates_1, e_5;
                                var _a, _b;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            mBTME.showLoader("Analyzing Screenplay...");
                                            prompt = "Analyze this screenplay text. Return valid JSON only. No markdown. \n                Structure: { \"scenes\": [\"INT. LOCATION - DAY\", ...], \"cast\": [\"CHARACTER NAME\", ...] }. \n                Text: \n\n ".concat(currentVal.substring(0, 15000));
                                            _c.label = 1;
                                        case 1:
                                            _c.trys.push([1, 3, , 4]);
                                            return [4 /*yield*/, mBT.features.ai.callUnifiedAI(provider, apiKey, prompt, "ROLE: Data Parser. OUTPUT: Pure JSON. No chat.")];
                                        case 2:
                                            result = _c.sent();
                                            jsonStr = result.replace(/^```json\n?|```$/g, '').trim();
                                            data = JSON.parse(jsonStr);
                                            report = "Extracted ".concat(((_a = data.scenes) === null || _a === void 0 ? void 0 : _a.length) || 0, " Scenes and ").concat(((_b = data.cast) === null || _b === void 0 ? void 0 : _b.length) || 0, " Characters.\n");
                                            updates_1 = 0;
                                            // 1. Sync Schedule (Scenes)
                                            if (data.scenes && Array.isArray(data.scenes)) {
                                                if (!doc.content.data.schedule)
                                                    doc.content.data.schedule = [];
                                                data.scenes.forEach(function (sc) {
                                                    // Dedupe: Check if description matches
                                                    if (!doc.content.data.schedule.some(function (s) { return s.description === sc; })) {
                                                        var parts = sc.split('-');
                                                        var loc = parts[0] ? parts[0].replace(/INT\.|EXT\./i, '').trim() : '';
                                                        mBTDB.addRow(docId, 'schedule', 'shot', {
                                                            id: Date.now() + Math.random(),
                                                            description: sc,
                                                            scene: (doc.content.data.schedule.length + 1).toString(),
                                                            time: "00:00",
                                                            ie: sc.toUpperCase().includes("INT") ? "INT" : "EXT",
                                                            loc: loc,
                                                            cast: ""
                                                        });
                                                        updates_1++;
                                                    }
                                                });
                                            }
                                            // 2. Sync Cast (Characters)
                                            if (data.cast && Array.isArray(data.cast)) {
                                                if (!doc.content.data.cast)
                                                    doc.content.data.cast = [];
                                                data.cast.forEach(function (c) {
                                                    if (!doc.content.data.cast.some(function (existing) { return existing.character === c; })) {
                                                        mBTDB.addRow(docId, 'cast', 'talent', {
                                                            id: Date.now() + Math.random(),
                                                            character: c,
                                                            actor: "", swf: "W", pickup: "", hmu: "", setCall: "", costume: ""
                                                        });
                                                        updates_1++;
                                                    }
                                                });
                                            }
                                            mBTME.hideLoader();
                                            if (updates_1 > 0) {
                                                mBTDB.renderFrame(); // Refresh UI to show new rows
                                                mBTME.alert("Analysis Complete", report + "\n".concat(updates_1, " items added to lists."));
                                            }
                                            else
                                                mBTME.alert("Analysis Complete", "No new items found to add.");
                                            return [3 /*break*/, 4];
                                        case 3:
                                            e_5 = _c.sent();
                                            mBTME.hideLoader();
                                            mBTME.alert("Parsing Error", "AI response could not be mapped to data structure.");
                                            console.error(e_5);
                                            return [3 /*break*/, 4];
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); });
                            return [2 /*return*/];
                        }
                        // ROUTE 2: CONTENT GENERATION (Creative)
                        mBTME.showLoader("Generating Content...");
                        prompt = "";
                        if (widget.type === 'footer') {
                            locSetting = (typeof mBTOG !== 'undefined' && mBTOG.settings) ? mBTOG.settings.location : 'Jamaica';
                            prodAddr = ((_b = doc.content.data.production) === null || _b === void 0 ? void 0 : _b.address) || "";
                            locationContext = prodAddr.length > 5 ? "Production Address: ".concat(prodAddr) : "Jurisdiction: ".concat(locSetting);
                            prompt = "Generate a professional film production call sheet footer. \n             CONTEXT: ".concat(locationContext, ". \n             REQUIREMENTS: \n             1. Include a Health & Safety Disclaimer referencing specific local acts (e.g., \"Health and Safety at Work Act 1974\" for UK, \"Factories Act\" for Jamaica, \"OSHA\" for USA). Pick the one matching the context.\n             2. Include a strict Anti-Harassment/Bullying Policy statement with a placeholder for a contact number.\n             3. Keep it concise, serious, legalistic, and formatted as a compact block. No markdown, just text.");
                        }
                        else if (isScript) {
                            // Empty Script Generation
                            prompt = "Write a sample screenplay scene for a film titled \"".concat(budget.projectName, "\". Format: Standard Screenplay format (Scene Heading, Action, Character, Dialogue). Keep it short (1 page).");
                        }
                        else {
                            // General Logic
                            prompt = "Generate content for a section labeled \"".concat(widget.label, "\" for a film production named \"").concat(budget.projectName, "\" (").concat(doc.label, "). Context: Film Production. Keep it professional and concise.");
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, mBT.features.ai.callUnifiedAI(provider, apiKey, prompt)];
                    case 2:
                        result = _c.sent();
                        cleanResult = result.replace(/^```[a-z]*\n|```$/g, '').trim();
                        this.updateData(docId, "additional.".concat(widgetId), cleanResult);
                        mBTME.hideLoader();
                        el = document.querySelector(".grid-stack-item[gs-id=\"".concat(widgetId, "\"] .widget-body textarea"));
                        if (el)
                            el.value = cleanResult;
                        else
                            this.renderFrame(); // Fallback if DOM lost
                        return [3 /*break*/, 4];
                    case 3:
                        e_4 = _c.sent();
                        mBTME.hideLoader();
                        mBTME.alert("Generation Failed", e_4.message);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    },
    autoFillWeather: function (docId, index, name) {
        return __awaiter(this, void 0, void 0, function () {
            var btn, geoRes, geo, _a, latitude, longitude, wRes, wData, today, code, summary, sunrise, sunset, str, e_6;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        btn = document.getElementById("w-btn-".concat(index));
                        if (btn)
                            btn.innerHTML = "<span class=\"animate-spin inline-block\">...</span>";
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, fetch("https://geocoding-api.open-meteo.com/v1/search?name=".concat(encodeURIComponent(name), "&count=1&language=en&format=json"))];
                    case 2:
                        geoRes = _b.sent();
                        return [4 /*yield*/, geoRes.json()];
                    case 3:
                        geo = _b.sent();
                        if (!geo.results)
                            throw new Error("Location not found");
                        _a = geo.results[0], latitude = _a.latitude, longitude = _a.longitude;
                        return [4 /*yield*/, fetch("https://api.open-meteo.com/v1/forecast?latitude=".concat(latitude, "&longitude=").concat(longitude, "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto"))];
                    case 4:
                        wRes = _b.sent();
                        return [4 /*yield*/, wRes.json()];
                    case 5:
                        wData = _b.sent();
                        today = wData.daily;
                        code = today.weather_code[0];
                        summary = "Clear Skies";
                        if (code > 3)
                            summary = "Cloudy";
                        if (code > 50)
                            summary = "Rainy";
                        sunrise = today.sunrise[0].split('T')[1];
                        sunset = today.sunset[0].split('T')[1];
                        str = "".concat(summary, " | Max: ").concat(today.temperature_2m_max[0], "\u00B0C / Min: ").concat(today.temperature_2m_min[0], "\u00B0C\nSunrise: ").concat(sunrise, " / Sunset: ").concat(sunset);
                        // Logic Fix: Sync Sunrise/Sunset to Header
                        this.updateData(docId, 'meta.sunriseSunset', "".concat(sunrise, "/").concat(sunset));
                        this.updateRow(docId, 'locations', index, 'weather', str);
                        this.renderFrame();
                        return [3 /*break*/, 7];
                    case 6:
                        e_6 = _b.sent();
                        mBTME.alert("Sync Error", "Weather Synchronization Failure");
                        if (btn)
                            btn.innerHTML = this.icons.cloud;
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    },
    // --- NEW: Header Sync Logic ---
    syncProductionInfo: function (docId) {
        // 1. Search Open Gate for "Production Office" contact
        var contact = mBTOG.contacts.find(function (c) { return c.name.toLowerCase().includes('production office'); });
        if (contact) {
            var data = {
                address: contact.address || '',
                phone: contact.phone || '',
                email: contact.email || '',
                wifi: contact.wifi || '',
                pass: contact.pass || ''
            };
            // Batch update manually to avoid multiple re-renders
            var doc = budget.documents.find(function (d) { return d.id === docId; });
            if (doc) {
                if (!doc.content.data.production)
                    doc.content.data.production = {};
                Object.assign(doc.content.data.production, data);
                this._triggerSave();
                this.renderFrame();
                mBTME.alert("Synced", "Production Office details updated from Open Gate.");
            }
        }
        else {
            // Fallback: Use Budget Company Name
            this.updateData(docId, 'production.address', budget.company || '');
            mBTME.alert("Partial Sync", "No 'Production Office' contact found in Open Gate. Synced Company Name.");
        }
    },
    syncAgencyInfo: function (docId) {
        // Search Open Gate for Agency roles
        var producer = mBTOG.contacts.find(function (c) { return c.role && (c.role.toLowerCase().includes('agency producer') || c.role.toLowerCase().includes('client')); });
        var creative = mBTOG.contacts.find(function (c) { return c.role && (c.role.toLowerCase().includes('creative') || c.role.toLowerCase().includes('director')); });
        var updates = 0;
        if (producer) {
            this.updateData(docId, 'agency.producer', producer.name);
            updates++;
        }
        if (creative) {
            this.updateData(docId, 'agency.creative', creative.name);
            updates++;
        }
        if (updates > 0)
            this.renderFrame();
        else
            mBTME.alert("No Matches", "No contacts with 'Agency' or 'Client' roles found.");
    },
    // --- 4. Render Engine Handshake ---
    renderFrame: function () {
        var _this = this;
        var doc = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
        var container = document.getElementById('mBTDB_Container');
        if (!container)
            return;
        // Standardized Studio Actions
        var actions = [
            { icon: mBTAssets.sync, title: "Sync Budget", onClick: "mBTDB.syncFromBudget()", color: "emerald" },
            { icon: mBTAssets.refresh, title: "Sync Previous", onClick: "mBTDB.syncFromPrevious()", color: "blue" },
            { icon: mBTAssets.image, title: "Preview", onClick: "mBTDB.previewDoc('standard')", color: "purple" },
            { icon: mBTAssets.close, title: "Close", onClick: "mBTDB.close()", color: "rose" }
        ];
        // --- NEW: Paper Protocol Structure ---
        var contentHtml = "\n            <div class=\"sheet-workspace\" id=\"mBTDB_ScrollArea\">\n                <div class=\"sheet-a4 cs-theme\" id=\"mBTDB_Paper\">\n                    <!-- Embedded Header (Part of the Page) -->\n                    <div id=\"mBTDB_MetaArea\" class=\"mb-4\"></div>\n                    <!-- The Grid (Flexible Content) -->\n                    <div class=\"grid-stack flex-grow\"></div>\n                    <!-- Footer Branding -->\n                    <div class=\"mt-auto pt-4 border-t-2 border-slate-700 flex justify-between text-[8px] font-bold uppercase tracking-widest text-slate-500\">\n                        <span>".concat(budget.company || 'Production Office', "</span>\n                        <span>Generated by mooBudget</span>\n                    </div>\n                </div>\n            </div>\n        ");
        container.innerHTML = RenderEngine.layouts.assistantPanel({
            title: "Assistant: ".concat(doc.label),
            searchId: 'mBTDB_Search',
            searchPlaceholder: 'SEARCH DOCUMENT...',
            contentId: 'mBTDB_Workspace',
            contentHtml: contentHtml,
            actions: actions,
            toolbarId: 'mBTDB_Buttons',
            containerClasses: 'p-0 overflow-hidden !bg-[#0f172a]' // Logic Resolution: Force Deep Slate Background
        });
        this._renderMetaHeader(doc);
        setTimeout(function () {
            if (typeof GridStack === 'undefined')
                return console.error("GridStack resolution failure.");
            var wrapper = document.getElementById('mBTDB_Workspace');
            // Re-apply editing class if state persisted
            if (_this.state.isEditing)
                wrapper.classList.add('editing-mode');
            // Batch 2.1: Grid Physics Refinement
            // Reduced cellHeight (30px) for granular text matching. Increased margin for visual breathing room.
            _this.state.grid = GridStack.init({
                column: 12,
                cellHeight: 30,
                minRow: 1,
                margin: 5,
                animate: true,
                float: false, // Gravity Enabled (Widgets snap up)
                resizable: { handles: 'n,e,s,w,ne,se,sw,nw' },
                staticGrid: !_this.state.isEditing
            }, wrapper.querySelector('.grid-stack'));
            _this._loadWidgetsToGrid(doc);
            _this._updateHeaderButtons();
            _this.state.grid.on('change', function () { return _this._triggerSave(); });
            _this._initMudMaps(); // Initialize canvases
        }, 50);
    },
    _loadWidgetsToGrid: function (doc) {
        var _this = this;
        var grid = this.state.grid;
        grid.removeAll();
        grid.batchUpdate();
        doc.content.widgets.forEach(function (w) { if (w.type === 'header')
            return; grid.addWidget({ x: w.x, y: w.y, w: w.w, h: w.h, content: _this._generateWidgetHTML(w, doc), id: w.id }); });
        grid.commit();
    },
    _generateWidgetHTML: function (widget, doc) {
        var cleanTitle = widget.label || (widget.type.charAt(0).toUpperCase() + widget.type.slice(1));
        var tools = '';
        if (widget.type === 'contacts') {
            tools += "<button type=\"button\" aria-label=\"Toggle View\" data-action=\"widget-toggle-view\" data-id=\"".concat(widget.id, "\" class=\"p-1 rounded transition-colors\">").concat(widget.vertical ? this.icons.grid : this.icons.list, "</button>");
        }
        if (widget.type !== 'image') {
            // Logic Resolution: Enable AI Wand for text-heavy or structural widgets (Hybrid Router)
            // Added 'footer' to enable Safety Logic and 'script' awareness for the Parser
            var isAssistantEnabled = ['richText', 'treatment', 'breakdown', 'footer', 'script'].includes(widget.type) || ['script', 'screenplay'].some(function (s) { return (widget.label || '').toLowerCase().includes(s); });
            var action = isAssistantEnabled ? 'widget-assistant-fill' : 'widget-autofill';
            var title = isAssistantEnabled ? 'AI Generate / Parse' : 'Auto-Fill';
            tools += "<button type=\"button\" aria-label=\"".concat(title, "\" data-action=\"").concat(action, "\" data-type=\"").concat(widget.type, "\" data-doc-id=\"").concat(doc.id, "\" data-id=\"").concat(widget.id, "\" class=\"p-1 rounded transition-all\" title=\"").concat(title, "\">").concat(this.icons.wand, "</button>");
        }
        return "<div class=\"grid-stack-item-content group\">\n            <div class=\"widget-header flex justify-between items-center\">\n                <input value=\"".concat(cleanTitle, "\" onchange=\"mBTDB.updateWidgetLabel('").concat(doc.id, "', '").concat(widget.id, "', this.value)\" class=\"bg-transparent border-none w-48 outline-none transition-colors\">\n                <div class=\"widget-tools flex items-center gap-1\">\n                    ").concat(tools, "\n                    <button type=\"button\" aria-label=\"Delete Widget\" data-action=\"widget-delete\" data-id=\"").concat(widget.id, "\" class=\"p-1 rounded transition-colors\">").concat(this.icons.trash, "</button>\n                </div>\n            </div>\n            <div class=\"widget-body flex-grow overflow-y-auto no-scrollbar relative text-slate-800 h-full bg-white\">").concat(this._getContentForWidget(widget, doc), "</div>\n        </div>");
    },
    _getContentForWidget: function (widget, doc) {
        var data = this.resolveLinkedData(doc); // LIVE SYNC (Phase 9)        
        if (widget.type === 'contacts')
            return this._renderContacts(doc.id, data, widget);
        if (['logistics', 'locations'].includes(widget.type))
            return this._renderLogistics(doc.id, data);
        if (widget.type === 'schedule')
            return this._renderSchedule(doc.id, data);
        if (widget.type === 'crew')
            return this._renderCrew(doc.id, data);
        if (widget.type === 'cast')
            return this._renderTalent(doc.id, data);
        if (widget.type === 'richText')
            return this._renderRichText(doc.id, widget.id, data);
        if (widget.type === 'image')
            return this._renderImage(doc.id, widget.id, data);
        // --- Batch 2: Logistics Routing ---
        if (widget.type === 'transport')
            return this._renderTransport(doc.id, data);
        if (widget.type === 'mudmap')
            return this._renderMudMap(doc.id, widget.id, data);
        if (widget.type === 'footer')
            return this._renderFooter(doc.id, widget.id, data);
        return '';
    },
    // --- Helper: Open Contact from Name ---
    openContactByName: function (name) {
        if (!name)
            return;
        // Logic Resolution: Clean name by removing parenthetical contact info often added by the system
        var rawName = name.split('(')[0].trim();
        var cleanName = rawName.toLowerCase();
        // 1. Search Active Budget Line Items First (Priority Scan)
        var foundInBudget = null;
        var sectionKey = null;
        if (budget && budget.sections) {
            Object.entries(budget.sections).some(function (_a) {
                var secName = _a[0], sec = _a[1];
                var item = sec.items.find(function (i) {
                    return i.crew &&
                        i.crew.name &&
                        (i.crew.name.toLowerCase() === cleanName ||
                            i.crew.name.toLowerCase().includes(cleanName) ||
                            cleanName.includes(i.crew.name.toLowerCase()));
                });
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
        var contact = mBTOG.contacts.find(function (c) { return c.name.toLowerCase().includes(cleanName) || cleanName.includes(c.name.toLowerCase()); });
        if (contact) {
            openCrewProfile(null, null, contact.id, null);
        }
        else {
            mBTME.confirm("Contact Not Found", "Create a new profile for \"".concat(rawName, "\"?"), function () {
                var dummyId = 'dummy_new_contact_' + Date.now();
                openCrewProfile(null, null, dummyId, null);
                setTimeout(function () {
                    var nameInput = document.getElementById('crewName');
                    if (nameInput)
                        nameInput.value = rawName;
                }, 100);
            });
        }
    },
    _renderMetaHeader: function (doc) {
        var _a, _b, _c, _d;
        var d = doc.content.data;
        var lock = this.state.isEditing ? '' : 'disabled';
        var is24h = d.meta.is24h || false;
        // Ensure agency object exists
        if (!d.agency)
            d.agency = {};
        if (!d.production)
            d.production = { address: '', phone: '', email: '', wifi: '', pass: '' }; // New Prod Office Data
        // Champion Layout Masthead (3-Column Grid)
        var html = "\n        <div class=\"flex justify-between items-end border-b-4 border-black pb-2 mb-2\">\n            <input ".concat(lock, " value=\"").concat(d.meta.productionTitle || 'UNTITLED PROJECT', "\" onchange=\"mBTDB.updateData('").concat(doc.id, "', 'meta.productionTitle', this.value)\" class=\"text-4xl font-black uppercase w-full outline-none leading-none tracking-tighter\" placeholder=\"TITLE\">\n            <div class=\"text-right shrink-0\">\n                <div class=\"text-2xl font-black\">CALL SHEET</div>\n                <div class=\"flex gap-4 text-xs font-bold mt-1\">\n                    <div>DATE: <input type=\"date\" value=\"").concat(d.meta.shootDate, "\" onchange=\"mBTDB.updateData('").concat(doc.id, "', 'meta.shootDate', this.value); mBTDB.renderFrame();\" class=\"inline-block w-auto border-b border-slate-300\"></div>\n                    <div>CALL: <input type=\"time\" value=\"").concat(d.meta.crewCallTime, "\" onchange=\"mBTDB.updateData('").concat(doc.id, "', 'meta.crewCallTime', this.value)\" class=\"inline-block w-24 text-center border-b border-slate-300\"></div>\n                    <div class=\"flex items-center gap-1.5 ").concat(this.state.isEditing ? '' : 'hidden', "\"><input type=\"checkbox\" ").concat(is24h ? 'checked' : '', " onchange=\"mBTDB.updateData('").concat(doc.id, "', 'meta.is24h', this.checked); mBTDB.renderFrame();\" class=\"w-3 h-3 cursor-pointer\"> 24h</div>\n                </div>\n            </div>\n        </div>\n        \n        <div class=\"grid grid-cols-3 gap-2 mb-4 text-[10px]\">\n            <!-- Left: Production Office (Address & Logistics) -->\n            <div class=\"cs-box p-2 flex flex-col h-full\">\n                <div class=\"font-bold border-b border-black mb-1 flex justify-between\">\n                    <span>PRODUCTION OFFICE</span>\n                    <span>").concat(this.icons.mapPin, "</span>\n                </div>\n                <div class=\"flex-grow space-y-1\">\n                    <textarea ").concat(lock, " onchange=\"mBTDB.updateData('").concat(doc.id, "','production.address',this.value)\" class=\"w-full resize-none h-8 leading-tight font-bold\" placeholder=\"Office Address...\">").concat(d.production.address || '', "</textarea>\n                    <div class=\"grid grid-cols-[auto_1fr] gap-x-2 items-center\">\n                        <span class=\"font-bold\">PH:</span> <input ").concat(lock, " value=\"").concat(d.production.phone || '', "\" onchange=\"mBTDB.updateData('").concat(doc.id, "','production.phone',this.value)\" class=\"w-full\" placeholder=\"Office Phone\">\n                        <span class=\"font-bold\">EMAIL:</span> <input ").concat(lock, " value=\"").concat(d.production.email || '', "\" onchange=\"mBTDB.updateData('").concat(doc.id, "','production.email',this.value)\" class=\"w-full\" placeholder=\"production@email.com\">\n                    </div>\n                    <div class=\"flex gap-2 pt-1 border-t border-slate-100 mt-1\">\n                        <div class=\"flex-1\"><span class=\"font-bold\">WIFI:</span> <input ").concat(lock, " value=\"").concat(d.production.wifi || '', "\" onchange=\"mBTDB.updateData('").concat(doc.id, "','production.wifi',this.value)\" class=\"w-16\" placeholder=\"Network\"></div>\n                        <div class=\"flex-1\"><span class=\"font-bold\">PASS:</span> <input ").concat(lock, " value=\"").concat(d.production.pass || '', "\" onchange=\"mBTDB.updateData('").concat(doc.id, "','production.pass',this.value)\" class=\"w-16\" placeholder=\"Password\"></div>\n                    </div>\n                </div>\n            </div>\n            \n            <!-- Center: Locations -->\n            <div class=\"cs-box p-2\">\n                <div class=\"font-bold border-b border-black mb-1\">LOCATIONS</div>\n                ").concat((d.locations || []).map(function (l, i) { return "\n                    <div class=\"mb-2\">\n                        <div class=\"flex justify-between\"><span class=\"font-bold\">                             <span class=\"opacity-50\">HOSP:</span>\n                             <input ".concat(lock, " value=\"").concat(l.hospital || '', "\" onchange=\"mBTDB.updateRow('").concat(doc.id, "','locations',").concat(i, ",'hospital',this.value)\" class=\"w-full bg-transparent border-b border-red-100 focus:border-red-500 text-red-600\" placeholder=\"Nearest Hospital...\">\n                        </div>\n                    </div>\n                "); }).join(''), "\n            </div>\n\n            <!-- Right: Agency & Weather -->\n            <div class=\"cs-box p-2 flex flex-col h-full\">\n                <!-- Agency Block -->\n                <div class=\"font-bold border-b border-black mb-1 flex justify-between items-center cursor-pointer hover:bg-slate-50\" onclick=\"if(!event.target.closest('button')) { const b=this.nextElementSibling; b.classList.toggle('hidden'); }\">\n                    <span>AGENCY / CLIENT</span> \n                    <div class=\"flex gap-2\">\n                        <button onclick=\"mBTDB.syncAgencyInfo('").concat(doc.id, "')\" class=\"text-slate-400 hover:text-blue-600 transition-colors\" title=\"Sync from Database\">").concat(this.icons.sync, "</button>\n                        <span class=\"text-[8px] text-slate-400\">\u25BC</span>\n                    </div>\n                </div>\n                <div class=\"grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 items-center mb-2 hidden\">\n                    <span class=\"font-bold\">PRODUCER:</span>\n                    <div class=\"flex items-center gap-1\">\n                        <input ").concat(lock, " value=\"").concat(d.agency.producer || '', "\" onchange=\"mBTDB.updateData('").concat(doc.id, "','agency.producer',this.value)\" class=\"w-full\" placeholder=\"Name\">\n                        ").concat(d.agency.producer ? "<button onclick=\"mBTDB.openContactByName('".concat(d.agency.producer, "')\" class=\"text-blue-600 hover:scale-110 transition-transform\">").concat(this.icons.user, "</button>") : '', "\n                    </div>\n                    <span class=\"font-bold\">CREATIVE:</span>\n                    <div class=\"flex items-center gap-1\">\n                        <input ").concat(lock, " value=\"").concat(d.agency.creative || '', "\" onchange=\"mBTDB.updateData('").concat(doc.id, "','agency.creative',this.value)\" class=\"w-full\" placeholder=\"Name\">\n                        ").concat(d.agency.creative ? "<button onclick=\"mBTDB.openContactByName('".concat(d.agency.creative, "')\" class=\"text-blue-600 hover:scale-110 transition-transform\">").concat(this.icons.user, "</button>") : '', "\n                    </div>\n                </div>\n\n                <div class=\"font-bold border-b border-black mb-1 mt-auto\">CONDITIONS</div>\n                <div class=\"flex justify-between mb-1\">\n                    <span>Sunrise: <input ").concat(lock, " value=\"").concat(((_a = d.meta.sunriseSunset) === null || _a === void 0 ? void 0 : _a.split('/')[0]) || '', "\" class=\"w-12 text-center border-b border-slate-200\"></span>\n                    <span>Sunset: <input ").concat(lock, " value=\"").concat(((_b = d.meta.sunriseSunset) === null || _b === void 0 ? void 0 : _b.split('/')[1]) || '', "\" class=\"w-12 text-center border-b border-slate-200\"></span>\n                </div>\n                <textarea ").concat(lock, " class=\"w-full h-8 resize-none\" placeholder=\"Weather forecast...\">").concat(((_d = (_c = d.locations) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.weather) || '', "</textarea>\n            </div>\n        </div>");
        var container = document.getElementById('mBTDB_MetaArea');
        if (container)
            container.innerHTML = html;
    },
    _renderContacts: function (docId, d, widget) {
        var _this = this;
        var lock = this.state.isEditing ? '' : 'disabled';
        var hideTool = this.state.isEditing ? '' : 'hidden';
        // Data Migration: Permanent Fix for Legacy Objects to Arrays
        if (!Array.isArray(d.contacts)) {
            var newArray_1 = [
                { role: 'DIRECTOR', name: d.contacts.director || '' },
                { role: 'PRODUCER', name: d.contacts.producer || '' },
                { role: '1ST AD', name: d.contacts.ad || '' }
            ];
            // Persist migration immediately so Add/Delete works
            setTimeout(function () { return mBTDB.updateData(docId, 'contacts', newArray_1); }, 0);
            d.contacts = newArray_1;
        }
        var renderRow = function (c, i) {
            return "\n            <div class=\"flex flex-col border-b border-slate-100 pb-1 mb-1 last:border-0 group/row\">\n                <!-- Role Header -->\n                <input ".concat(lock, " value=\"").concat(c.role || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','contacts',").concat(i, ",'role',this.value)\" class=\"text-[7px] font-black uppercase tracking-widest text-slate-400 bg-transparent border-none p-0 w-full outline-none mb-0.5 focus:text-blue-600 transition-colors\" placeholder=\"ROLE\">\n                \n                <!-- Name Row -->\n                <div class=\"flex items-center gap-2\">\n                    <!-- Import Button (Left) -->\n                    ").concat(_this.state.isEditing ? "\n                    <button class=\"text-slate-300 hover:text-blue-500 transition-colors shrink-0\" onclick=\"mBTDB.pullFromOpenGate('".concat(docId, "', 'contacts.").concat(i, ".name', '").concat(c.role || 'crew', "')\" title=\"Import from DB\">\n                        ").concat(_this.icons.user, "\n                    </button>") : '', "\n                    \n                    <!-- Name Input -->\n                    <input ").concat(lock, " value=\"").concat(c.name || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','contacts',").concat(i, ",'name',this.value)\" class=\"flex-grow bg-transparent border-none p-0 text-[10px] font-bold text-slate-900 outline-none placeholder-slate-300\" placeholder=\"Name...\">\n                    \n                    <!-- Delete Button (Right) -->\n                    <button onclick=\"mBTDB.deleteRow('").concat(docId, "','contacts',").concat(i, ",'contacts')\" class=\"text-slate-200 hover:text-red-500 transition-colors shrink-0 ").concat(hideTool, "\" title=\"Remove Contact\">\n                        ").concat(_this.icons.trash, "\n                    </button>\n                </div>\n            </div>");
        };
        return "\n        <div class=\"h-full flex flex-col cs-box border-none\">\n            <div class=\"flex-grow overflow-y-auto p-2 no-scrollbar bg-white widget-list-grid\">\n                ".concat(d.contacts.map(function (c, i) { return renderRow(c, i); }).join(''), "\n            </div>\n            <div class=\"p-2 border-t border-black bg-slate-50 ").concat(hideTool, "\">\n                <button onclick=\"mBTDB.addRow('").concat(docId, "','contacts','contact')\" class=\"w-full bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100\">+ Add Contact</button>\n            </div>\n        </div>");
    },
    _renderLogistics: function (docId, d) {
        var _this = this;
        var lock = this.state.isEditing ? '' : 'disabled';
        var hideTool = this.state.isEditing ? '' : 'hidden';
        // Parse Sun Data for Display
        var sunRaw = d.meta.sunriseSunset || '/';
        var _a = sunRaw.split('/'), sunrise = _a[0], sunset = _a[1];
        return "<div class=\"flex flex-col h-full\">\n            <!-- Compact Sun Header (Horizontal) -->\n            <div class=\"px-2 py-1 border-b border-black flex justify-center items-center gap-4 bg-slate-50\">\n                <div class=\"flex items-center gap-1\">\n                    <span class=\"text-[9px] font-black text-slate-500 uppercase tracking-widest\">SUN</span>\n                    <input type=\"text\" ".concat(lock, " value=\"").concat(sunrise || '', "\" onchange=\"mBTDB.formatTime(this, '").concat(docId, "'); const current = '").concat(sunRaw, "'.split('/'); current[0]=this.value; mBTDB.updateData('").concat(docId, "','meta.sunriseSunset',current.join('/'))\" class=\"bg-transparent text-[10px] font-bold w-16 text-center outline-none disabled:text-slate-800\" placeholder=\"06:00\">\n                </div>\n                <div class=\"flex items-center gap-1\">\n                    <span class=\"text-[9px] font-black text-slate-500 uppercase tracking-widest\">SET</span>\n                    <input type=\"text\" ").concat(lock, " value=\"").concat(sunset || '', "\" onchange=\"mBTDB.formatTime(this, '").concat(docId, "'); const current = '").concat(sunRaw, "'.split('/'); current[1]=this.value; mBTDB.updateData('").concat(docId, "','meta.sunriseSunset',current.join('/'))\" class=\"bg-transparent text-[10px] font-bold w-16 text-center outline-none disabled:text-slate-800\" placeholder=\"18:00\">\n                </div>\n            </div>\n            \n            <div class=\"flex-grow overflow-y-auto p-2 space-y-3 no-scrollbar widget-list-grid\">").concat((d.locations || []).map(function (l, i) { return "<div class=\"flex flex-col gap-1 border-b-2 border-black pb-2 mb-1 relative group/loc\">\n            \n            <!-- Row 1: Name and Time (Refined Font Size & Width) -->\n            <div class=\"flex justify-between items-end gap-2 mb-1\">\n                <div class=\"flex-grow\">\n                    <label class=\"text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5\">LOCATION ".concat(i + 1, "</label>\n                    <input ").concat(lock, " value=\"").concat(l.name, "\" onchange=\"mBTDB.updateRow('").concat(docId, "','locations',").concat(i, ",'name',this.value)\" class=\"w-full bg-transparent border-none p-0 text-sm font-black text-slate-900 uppercase tracking-tight outline-none placeholder-slate-300\" placeholder=\"NAME\">\n                </div>\n                <div class=\"w-20 text-right shrink-0\">\n                     <label class=\"text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5\">CALL</label>\n                     <input ").concat(lock, " type=\"text\" value=\"").concat(l.timeOnLocation || '', "\" onchange=\"mBTDB.formatTime(this, '").concat(docId, "'); mBTDB.updateRow('").concat(docId, "','locations',").concat(i, ",'timeOnLocation',this.value)\" class=\"w-full bg-transparent border-none p-0 text-xs font-black text-blue-600 text-center outline-none\" placeholder=\"00:00\">\n                </div>\n            </div>\n            \n            <!-- Row 2: Address (Compact Height) -->\n            <div class=\"w-full\">\n                 <textarea ").concat(lock, " onchange=\"mBTDB.updateRow('").concat(docId, "','locations',").concat(i, ",'address',this.value)\" class=\"w-full bg-slate-50 border-none rounded px-2 py-1 text-[9px] font-bold text-slate-700 placeholder-slate-400 h-10 resize-none leading-relaxed\" placeholder=\"Full Address...\">").concat(l.address, "</textarea>\n            </div>\n\n            <!-- Row 3: Hospital -->\n            <div class=\"flex items-center gap-1 bg-red-50 px-2 py-1 rounded border border-red-100\">\n                <span class=\"text-[8px] font-black text-red-500 uppercase tracking-widest shrink-0\">HOSP</span>\n                <input ").concat(lock, " value=\"").concat(l.hospital || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','locations',").concat(i, ",'hospital',this.value)\" class=\"w-full bg-transparent border-none p-0 text-[9px] font-bold text-red-700 placeholder-red-200\" placeholder=\"Nearest Medical...\">\n            </div>\n            \n            <!-- Row 4: Weather (Stacked Below, Compact) -->\n            <div class=\"relative bg-blue-50 px-2 py-1 rounded border border-blue-100 h-8 flex items-center\">\n                <input ").concat(lock, " value=\"").concat(l.weather || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','locations',").concat(i, ",'weather',this.value)\" class=\"w-full bg-transparent border-none p-0 text-[9px] font-bold text-blue-800 placeholder-blue-200 pr-5\" placeholder=\"Weather...\">\n                <button id=\"w-btn-").concat(i, "\" onclick=\"mBTDB.autoFillLocationDetails('").concat(docId, "', ").concat(i, ")\" class=\"absolute top-1/2 -translate-y-1/2 right-1 text-blue-400 hover:text-blue-600 transition-colors ").concat(hideTool, "\" title=\"Auto-Fill details\">\n                    ").concat(_this.icons.wand, "\n                </button>\n            </div>\n\n            <button onclick=\"mBTDB.deleteRow('").concat(docId, "','locations',").concat(i, ",'logistics')\" class=\"absolute top-0 right-0 text-slate-200 hover:text-red-500 transition-colors ").concat(hideTool, "\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"></line><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"></line></svg></button>\n        </div>"); }).join(''), "</div>\n        <div class=\"p-2 border-t border-black bg-slate-50 ").concat(hideTool, "\">\n            <button onclick=\"mBTDB.addRow('").concat(docId, "','locations','loc')\" class=\"w-full bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100\">+ Add Location</button>\n        </div>\n        </div>");
    },
    autoFillLocationDetails: function (docId, index) {
        return __awaiter(this, void 0, void 0, function () {
            var btn, doc, loc, query, geoRes, geo, _a, latitude, longitude, geoName, wRes, wData, today, code, summary, sunrise, sunset, weatherStr, provider, apiKey, prompt, hospitalName, cleanHost, e_7;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        btn = document.getElementById("w-btn-".concat(index));
                        if (btn)
                            btn.innerHTML = "...";
                        doc = budget.documents.find(function (d) { return d.id === docId; });
                        if (!doc || !doc.content.data.locations[index])
                            return [2 /*return*/];
                        loc = doc.content.data.locations[index];
                        query = loc.address && loc.address.length > 5 ? loc.address : loc.name;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 8, , 9]);
                        return [4 /*yield*/, fetch("https://geocoding-api.open-meteo.com/v1/search?name=".concat(encodeURIComponent(query), "&count=1&language=en&format=json"))];
                    case 2:
                        geoRes = _b.sent();
                        return [4 /*yield*/, geoRes.json()];
                    case 3:
                        geo = _b.sent();
                        if (!geo.results)
                            throw new Error("Location not found via Geocoding.");
                        _a = geo.results[0], latitude = _a.latitude, longitude = _a.longitude, geoName = _a.name;
                        return [4 /*yield*/, fetch("https://api.open-meteo.com/v1/forecast?latitude=".concat(latitude, "&longitude=").concat(longitude, "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto"))];
                    case 4:
                        wRes = _b.sent();
                        return [4 /*yield*/, wRes.json()];
                    case 5:
                        wData = _b.sent();
                        today = wData.daily;
                        code = today.weather_code[0];
                        summary = "Clear";
                        if (code === 1 || code === 2 || code === 3)
                            summary = "Partly Cloudy";
                        else if (code === 45 || code === 48)
                            summary = "Foggy";
                        else if (code >= 51 && code <= 57)
                            summary = "Drizzle";
                        else if (code >= 61 && code <= 67)
                            summary = "Rain";
                        else if (code >= 80 && code <= 82)
                            summary = "Showers";
                        else if (code >= 95)
                            summary = "Thunderstorm";
                        sunrise = today.sunrise[0].split('T')[1];
                        sunset = today.sunset[0].split('T')[1];
                        weatherStr = "".concat(summary, " ").concat(Math.round(today.temperature_2m_max[0]), "\u00B0/").concat(Math.round(today.temperature_2m_min[0]), "\u00B0C");
                        // Update Weather
                        this.updateRow(docId, 'locations', index, 'weather', weatherStr);
                        // Update Global Sun (First location only)
                        if (index === 0) {
                            this.updateData(docId, 'meta.sunriseSunset', "".concat(sunrise, "/").concat(sunset));
                        }
                        provider = mBT.features.ai.getSelectedProvider();
                        apiKey = mBT.features.ai.getStoredApiKey(provider);
                        if (!apiKey) return [3 /*break*/, 7];
                        prompt = "Find nearest emergency hospital to ".concat(latitude, ",").concat(longitude, " (").concat(geoName, "). Return ONLY Hospital Name.");
                        return [4 /*yield*/, mBT.features.ai.callUnifiedAI(provider, apiKey, prompt)];
                    case 6:
                        hospitalName = _b.sent();
                        cleanHost = hospitalName.replace(/^(The nearest.*?is|Here is|Name:|Hospital:)/i, '').trim().replace(/\.$/, '');
                        this.updateRow(docId, 'locations', index, 'hospital', cleanHost);
                        _b.label = 7;
                    case 7:
                        // Refresh
                        // Logic Resolution: Trigger a repaint of this specific widget if possible to avoid full reload
                        // But for safety in single-file, we call renderFrame.
                        this.renderFrame();
                        return [3 /*break*/, 9];
                    case 8:
                        e_7 = _b.sent();
                        console.error("Autofill Logic Error:", e_7);
                        mBTME.alert("Sync Error", "Could not fetch location data.");
                        if (btn)
                            btn.innerHTML = this.icons.wand;
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/];
                }
            });
        });
    },
    // Legacy Bridge: Prevents crash if old buttons invoke this
    autoFillWeather: function (docId, index, name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.autoFillLocationDetails(docId, index)];
            });
        });
    },
    _renderSchedule: function (docId, d) {
        var lock = this.state.isEditing ? '' : 'disabled';
        var hideTool = this.state.isEditing ? '' : 'hidden';
        // High-Density Table (Header Removed)
        return "\n        <div class=\"h-full flex flex-col border-none\">\n            <div class=\"flex-grow overflow-auto no-scrollbar\">\n                <table class=\"cs-table w-full\">\n                    <thead>\n                        <tr>\n                            <th class=\"w-20 text-center\">TIME</th>\n                            <th class=\"w-10 text-center\">SCN</th>\n                            <th class=\"w-10 text-center\">I/E</th>\n                            <th class=\"text-left\">DESCRIPTION / ACTION / NOTES</th>\n                            <th class=\"w-16 text-center\">CAST</th>\n                            <th class=\"w-20 text-left\">LOC</th>\n                            <th class=\"w-6\"></th>\n                        </tr>\n                    </thead>\n                    <tbody>\n                        ".concat(d.schedule.map(function (row, i) {
            var isMeal = row.type === 'meal';
            var rowBg = isMeal ? 'bg-slate-100 font-bold' : '';
            return "\n                            <tr class=\"".concat(rowBg, " hover:bg-blue-50 transition-colors\">\n                                <td class=\"p-1\"><input ").concat(lock, " type=\"text\" value=\"").concat(row.time, "\" onchange=\"mBTDB.formatTime(this, '").concat(docId, "'); mBTDB.updateRow('").concat(docId, "','schedule',").concat(i, ",'time',this.value)\" class=\"text-center font-bold\" placeholder=\"00:00\"></td>\n                                ").concat(isMeal ?
                "<td colspan=\"5\" class=\"p-1 text-center uppercase tracking-widest text-[10px]\"><input ".concat(lock, " value=\"").concat(row.description, "\" onchange=\"mBTDB.updateRow('").concat(docId, "','schedule',").concat(i, ",'description',this.value)\" class=\"text-center w-full uppercase\"></td>") :
                "\n                                <td class=\"p-1\"><input ".concat(lock, " value=\"").concat(row.scene, "\" onchange=\"mBTDB.updateRow('").concat(docId, "','schedule',").concat(i, ",'scene',this.value)\" class=\"text-center\"></td>\n                                <td class=\"p-1\"><input ").concat(lock, " value=\"").concat(row.ie, "\" onchange=\"mBTDB.updateRow('").concat(docId, "','schedule',").concat(i, ",'ie',this.value)\" class=\"text-center uppercase\"></td>\n                                <td class=\"p-1\"><input ").concat(lock, " value=\"").concat(row.description, "\" onchange=\"mBTDB.updateRow('").concat(docId, "','schedule',").concat(i, ",'description',this.value)\" class=\"font-medium w-full\"></td>\n                                <td class=\"p-1\"><input ").concat(lock, " value=\"").concat(row.cast, "\" onchange=\"mBTDB.updateRow('").concat(docId, "','schedule',").concat(i, ",'cast',this.value)\" class=\"text-center font-bold text-slate-600\"></td>\n                                <td class=\"p-1\"><input ").concat(lock, " value=\"").concat(row.loc, "\" onchange=\"mBTDB.updateRow('").concat(docId, "','schedule',").concat(i, ",'loc',this.value)\" class=\"text-xs\"></td>\n                                "), "\n                                <td class=\"p-1 text-center ").concat(hideTool, "\"><button onclick=\"mBTDB.deleteRow('").concat(docId, "','schedule',").concat(i, ", 'schedule')\" class=\"text-slate-300 hover:text-red-500\">\u00D7</button></td>\n                            </tr>");
        }).join(''), "\n                    </tbody>\n                </table>\n            </div>\n            <div class=\"flex gap-2 p-2 border-t border-black bg-slate-50 ").concat(hideTool, "\">\n                <button onclick=\"mBTDB.addRow('").concat(docId, "','schedule','shot')\" class=\"flex-1 bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100\">+ Shot</button>\n                <button onclick=\"mBTDB.addRow('").concat(docId, "','schedule','meal')\" class=\"flex-1 bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100\">+ Meal</button>\n            </div>\n        </div>");
    },
    _renderCrew: function (docId, d) {
        var _this = this;
        var lock = this.state.isEditing ? '' : 'disabled';
        var hideTool = this.state.isEditing ? '' : 'hidden';
        // Updated: High Density Crew List (Header Removed)
        return "\n        <div class=\"h-full flex flex-col border-none\">\n            <div class=\"flex-grow overflow-auto no-scrollbar\">\n                <table class=\"cs-table w-full\">\n                    <thead>\n                        <tr>\n                            <th class=\"w-1/4\">DEPARTMENT / POSITION</th>\n                            <th class=\"w-1/4\">NAME</th>\n                            <th class=\"w-20 text-center\">CALL</th>\n                            <th>NOTES / INSTRUCTIONS</th>\n                            <th class=\"w-6\"></th>\n                        </tr>\n                    </thead>\n                    <tbody>\n                        ".concat((d.crew || []).map(function (c, i) { return "\n                        <tr class=\"hover:bg-slate-50 transition-colors\">\n                            <td class=\"p-1\">\n                                <input ".concat(lock, " value=\"").concat(c.department || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','crew',").concat(i, ",'department',this.value)\" class=\"font-black uppercase text-[8px] text-slate-400 block w-full mb-0.5\" placeholder=\"DEPT\">\n                                <input ").concat(lock, " value=\"").concat(c.position || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','crew',").concat(i, ",'position',this.value)\" class=\"font-bold text-slate-800\" placeholder=\"Position\">\n                            </td>\n                            <td class=\"p-1\">\n                                <div class=\"flex items-center gap-1\">\n                                    <input ").concat(lock, " value=\"").concat(c.name || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','crew',").concat(i, ",'name',this.value)\" class=\"font-bold text-slate-900 w-full\" placeholder=\"Name\">\n                                    ").concat(_this.state.isEditing ? "<div class=\"cursor-pointer text-slate-300 hover:text-blue-500\" onclick=\"mBTDB.pullFromOpenGate('".concat(docId, "','crew.").concat(i, ".name','").concat(c.position || 'crew', "')\">").concat(_this.icons.user, "</div>") :
            (c.name ? "<button onclick=\"mBTDB.openContactByName('".concat(c.name, "')\" class=\"text-blue-600 hover:scale-110 transition-transform\">").concat(_this.icons.user, "</button>") : ''), "\n                                </div>\n                                <input ").concat(lock, " value=\"").concat(c.contact || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','crew',").concat(i, ",'contact',this.value)\" class=\"text-[8px] font-mono text-slate-400 w-full\" placeholder=\"Phone/Email\">\n                            </td>\n                            <td class=\"p-1\"><input ").concat(lock, " type=\"text\" value=\"").concat(c.callTime || '', "\" onchange=\"mBTDB.formatTime(this, '").concat(docId, "'); mBTDB.updateRow('").concat(docId, "','crew',").concat(i, ",'callTime',this.value)\" class=\"text-center font-black text-blue-600\" placeholder=\"00:00\"></td>\n                            <td class=\"p-1\"><input ").concat(lock, " value=\"").concat(c.notes || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','crew',").concat(i, ",'notes',this.value)\" class=\"italic text-slate-600 w-full\" placeholder=\"Specific notes...\"></td>\n                            <td class=\"p-1 text-center ").concat(hideTool, "\"><button onclick=\"mBTDB.deleteRow('").concat(docId, "','crew',").concat(i, ", 'crew')\" class=\"text-slate-300 hover:text-red-500\">\u00D7</button></td>\n                        </tr>"); }).join(''), "\n                    </tbody>\n                </table>\n            </div>\n            <div class=\"p-2 border-t border-black bg-slate-50 ").concat(hideTool, "\">\n                <button onclick=\"mBTDB.addRow('").concat(docId, "','crew','person')\" class=\"w-full bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100\">+ Add Crew</button>\n            </div>\n        </div>");
    },
    _renderTalent: function (docId, d) {
        var _this = this;
        var lock = this.state.isEditing ? '' : 'disabled';
        var hideTool = this.state.isEditing ? '' : 'hidden';
        // Updated: High Density Cast Grid (Header Removed)
        return "\n        <div class=\"h-full flex flex-col border-none\">\n            <div class=\"flex-grow overflow-auto no-scrollbar\">\n                <table class=\"cs-table w-full\">\n                    <thead>\n                        <tr>\n                            <th class=\"w-24\">CHARACTER</th>\n                            <th>ARTIST</th>\n                            <th class=\"w-10 text-center\">SWF</th>\n                            <th class=\"w-20 text-center\">PU</th>\n                            <th class=\"w-20 text-center\">BF</th>\n                            <th class=\"w-20 text-center\">H/MU</th>\n                            <th class=\"w-20 text-center\">COST</th>\n                            <th class=\"w-20 text-center bg-slate-100 text-black border-black\">SET</th>\n                            <th class=\"w-6\"></th>\n                        </tr>\n                    </thead>\n                    <tbody>\n                        ".concat((d.cast || []).map(function (c, i) { return "\n                        <tr>\n                            <td class=\"p-1\"><input ".concat(lock, " value=\"").concat(c.character || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','cast',").concat(i, ",'character',this.value)\" class=\"font-bold text-slate-500 uppercase\"></td>\n                            <td class=\"p-1\">\n                                <div class=\"flex items-center gap-1\">\n                                    <input ").concat(lock, " value=\"").concat(c.actor || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','cast',").concat(i, ",'actor',this.value)\" class=\"font-black text-slate-900 w-full\">\n                                    ").concat(_this.state.isEditing ? "<div class=\"cursor-pointer text-slate-300 hover:text-blue-500\" onclick=\"mBTDB.pullFromOpenGate('".concat(docId, "','cast.").concat(i, ".actor','actor')\">").concat(_this.icons.user, "</div>") :
            (c.actor ? "<button onclick=\"mBTDB.openContactByName('".concat(c.actor, "')\" class=\"text-blue-600 hover:scale-110 transition-transform\">").concat(_this.icons.user, "</button>") : ''), "\n                                </div>\n                            </td>\n                            <td class=\"p-1\"><input ").concat(lock, " value=\"").concat(c.swf || 'W', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','cast',").concat(i, ",'swf',this.value)\" class=\"text-center font-black uppercase text-[9px]\" placeholder=\"S/W/F\"></td>\n                            <td class=\"p-1\"><input ").concat(lock, " type=\"text\" value=\"").concat(c.pickup || '', "\" onchange=\"mBTDB.formatTime(this, '").concat(docId, "'); mBTDB.updateRow('").concat(docId, "','cast',").concat(i, ",'pickup',this.value)\" class=\"text-center\" placeholder=\"--:--\"></td>\n                            <td class=\"p-1\"><input ").concat(lock, " type=\"text\" value=\"").concat(c.bf || '', "\" onchange=\"mBTDB.formatTime(this, '").concat(docId, "'); mBTDB.updateRow('").concat(docId, "','cast',").concat(i, ",'bf',this.value)\" class=\"text-center\" placeholder=\"--:--\"></td>\n                            <td class=\"p-1\"><input ").concat(lock, " type=\"text\" value=\"").concat(c.hmu || '', "\" onchange=\"mBTDB.formatTime(this, '").concat(docId, "'); mBTDB.updateRow('").concat(docId, "','cast',").concat(i, ",'hmu',this.value)\" class=\"text-center\" placeholder=\"--:--\"></td>\n                            <td class=\"p-1\"><input ").concat(lock, " type=\"text\" value=\"").concat(c.costume || '', "\" onchange=\"mBTDB.formatTime(this, '").concat(docId, "'); mBTDB.updateRow('").concat(docId, "','cast',").concat(i, ",'costume',this.value)\" class=\"text-center\" placeholder=\"--:--\"></td>\n                            <td class=\"p-1 bg-slate-50\"><input ").concat(lock, " type=\"text\" value=\"").concat(c.setCall || '', "\" onchange=\"mBTDB.formatTime(this, '").concat(docId, "'); mBTDB.updateRow('").concat(docId, "','cast',").concat(i, ",'setCall',this.value)\" class=\"text-center font-black text-slate-900\" placeholder=\"00:00\"></td>\n                            <td class=\"p-1 text-center ").concat(hideTool, "\"><button onclick=\"mBTDB.deleteRow('").concat(docId, "','cast',").concat(i, ", 'cast')\" class=\"text-slate-300 hover:text-red-500\">\u00D7</button></td>\n                        </tr>"); }).join(''), "\n                    </tbody>\n                </table>\n            </div>\n            <div class=\"p-2 border-t border-black bg-slate-50 ").concat(hideTool, "\">\n                <button onclick=\"mBTDB.addRow('").concat(docId, "','cast','talent', {id:Date.now(), character:'', actor:'', swf:'W', pickup:'', bf:'', hmu:'', costume:'', setCall:'', contact:''})\" class=\"w-full bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100\">+ Add Talent</button>\n            </div>\n        </div>");
    },
    // Logic Resolution: 1/8th Page Calculation Heuristic
    // Standard screenplay format: ~54 lines per page. 1/8th page ~= 7 lines (approx 1 inch).
    _calcPages: function (text) {
        if (!text)
            return "0 Pgs";
        // Count newlines to estimate vertical length
        var lines = text.split(/\r\n|\r|\n/).length;
        // Basic heuristic: 55 lines = 1 page (Courier 12pt standard)
        var eighths = Math.ceil(lines / 7); // 7 lines per 1/8th
        var pages = Math.floor(eighths / 8);
        var rem = eighths % 8;
        if (pages === 0 && rem === 0)
            return "0 Pgs";
        if (pages === 0)
            return "".concat(rem, "/8 Pgs");
        if (rem === 0)
            return "".concat(pages, " Pgs");
        return "".concat(pages, " ").concat(rem, "/8 Pgs");
    },
    // Logic Resolution: Live DOM Update for Script Metrics (Batch 1.2)
    _updateScriptHUD: function (widgetId, text) {
        var hud = document.getElementById("hud_".concat(widgetId));
        if (hud)
            hud.textContent = this._calcPages(text);
    },
    _renderRichText: function (docId, widgetId, data) {
        var lock = this.state.isEditing ? '' : 'disabled';
        var val = data.additional ? data.additional[widgetId] : (data[widgetId] || "");
        // Logic Resolution: Typography Enforcement for Screenplays (Batch 1.2.2)
        var doc = budget.documents.find(function (d) { return d.id === docId; });
        var widget = doc.content.widgets.find(function (w) { return w.id === widgetId; });
        // Detect Script Mode via Document Type or Widget Label
        var isScript = (doc && (doc.type === 'script' || (widget && widget.label && widget.label.toLowerCase().includes('screenplay'))));
        // Industry Standard: Courier Prime/New, 12pt, Single Spacing (1 page ~= 1 min)
        var styleClass = isScript
            ? "font-mono text-sm leading-none bg-white text-black font-bold whitespace-pre-wrap border-none outline-none resize-none"
            : "studio-input h-full p-3 text-xs text-slate-800 font-medium leading-relaxed resize-none";
        var customStyle = isScript ? 'font-family: "Courier Prime", "Courier New", monospace; font-size: 12pt; line-height: 1.0; padding: 40px;' : '';
        var placeholder = isScript ? 'INT. LOCATION - DAY\n\nAction description...' : 'Type notes...';
        // HUD Logic: Inject Visual Counter for Scripts (Batch 1.3)
        // Note: Initial calculation happens here on render. Live updates via oninput.
        var hudHtml = isScript
            ? "<div id=\"hud_".concat(widgetId, "\" class=\"absolute bottom-4 right-4 bg-slate-900/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-slate-500 border border-slate-200 pointer-events-none select-none transition-opacity z-10\">\n                ").concat(this._calcPages(val), "\n               </div>")
            : '';
        // Added 'relative group' to container for HUD positioning
        // Added 'oninput' for real-time math (surgical)
        // Kept 'onchange' for data persistence (debounced)
        return "<div class=\"h-full flex flex-col p-2 relative group\">\n            <div class=\"flex-grow relative h-full\">\n                <textarea ".concat(lock, " \n                    id=\"input_").concat(widgetId, "\"\n                    oninput=\"mBTDB._updateScriptHUD('").concat(widgetId, "', this.value); mBTDB.updateDataDebounced('").concat(doc.id, "', 'additional.").concat(widgetId, "', this.value)\"\n                    onchange=\"mBTDB.updateData('").concat(doc.id, "', 'additional.").concat(widgetId, "', this.value)\" \n                    class=\"").concat(styleClass, " w-full h-full disabled:bg-transparent disabled:border-none\" \n                    style=\"").concat(customStyle, "\" \n                    placeholder=\"").concat(placeholder, "\">").concat(val || '', "</textarea>\n                ").concat(hudHtml, "\n            </div>\n        </div>");
    },
    // Logic Resolution: New Image Rendering Logic with Optimization
    _renderImage: function (docId, widgetId, data) {
        var val = data.additional ? data.additional[widgetId] : (data[widgetId] || "");
        if (val) {
            // Image Display State
            return "\n            <div class=\"relative w-full h-full group bg-slate-50 flex items-center justify-center overflow-hidden\">\n                <img src=\"".concat(val, "\" class=\"max-w-full max-h-full object-contain\">\n                ").concat(this.state.isEditing ? "\n                <div class=\"absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2\">\n                    <button onclick=\"document.getElementById('file_".concat(widgetId, "').click()\" class=\"bg-white text-slate-900 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-50\">Change</button>\n                    <button onclick=\"mBTDB.updateData('").concat(docId, "', 'additional.").concat(widgetId, "', '')\" class=\"bg-white text-rose-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-50\">Remove</button>\n                </div>\n                <input type=\"file\" id=\"file_").concat(widgetId, "\" accept=\"image/*\" class=\"hidden\" onchange=\"mBTDB._handleImageUpload(this, '").concat(docId, "', '").concat(widgetId, "')\">") : '', "\n            </div>");
        }
        else {
            // Empty State
            if (!this.state.isEditing)
                return "<div class=\"w-full h-full flex items-center justify-center bg-slate-50 text-[10px] text-slate-300 font-bold uppercase tracking-widest\">Empty Image Block</div>";
            return "\n            <div class=\"w-full h-full flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/50 transition-colors border-2 border-dashed border-slate-100 hover:border-blue-200 cursor-pointer p-4 group\" onclick=\"document.getElementById('file_".concat(widgetId, "').click()\">\n                <div class=\"text-slate-300 group-hover:text-blue-400 mb-2 scale-125 transition-transform group-hover:scale-150\">").concat(this.icons.image, "</div>\n                <span class=\"text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-500\">Upload Image</span>\n                <input type=\"file\" id=\"file_").concat(widgetId, "\" accept=\"image/*\" class=\"hidden\" onchange=\"mBTDB._handleImageUpload(this, '").concat(docId, "', '").concat(widgetId, "')\">\n            </div>");
        }
    },
    // --- Batch 2: Logistics Widgets (Transport, MudMap, Footer) ---
    _renderTransport: function (docId, d) {
        var lock = this.state.isEditing ? '' : 'disabled';
        var hideTool = this.state.isEditing ? '' : 'hidden';
        // Updated: Header Removed
        return "\n        <div class=\"h-full flex flex-col border-none\">\n            <div class=\"flex-grow overflow-auto no-scrollbar\">\n                <table class=\"cs-table w-full text-[9px]\">\n                    <thead>\n                        <tr>\n                            <th class=\"w-1/4\">DRIVER / CONTACT</th>\n                            <th class=\"w-1/5\">VEHICLE</th>\n                            <th class=\"w-10 text-center\">PAX</th>\n                            <th class=\"w-20 text-center\">TIME</th>\n                            <th>FROM > TO</th>\n                            <th class=\"w-6\"></th>\n                        </tr>\n                    </thead>\n                    <tbody>\n                        ".concat((d.transport || []).map(function (t, i) { return "\n                        <tr class=\"hover:bg-slate-50 transition-colors\">\n                            <td class=\"p-1\">\n                                <input ".concat(lock, " value=\"").concat(t.driver || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','transport',").concat(i, ",'driver',this.value)\" class=\"font-bold text-slate-900 w-full\" placeholder=\"Driver Name\">\n                            </td>\n                            <td class=\"p-1\">\n                                <input ").concat(lock, " value=\"").concat(t.vehicle || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','transport',").concat(i, ",'vehicle',this.value)\" class=\"text-slate-600 w-full\" placeholder=\"Type/Plate\">\n                            </td>\n                            <td class=\"p-1\">\n                                <input ").concat(lock, " value=\"").concat(t.pax || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','transport',").concat(i, ",'pax',this.value)\" class=\"text-center font-mono\" placeholder=\"#\">\n                            </td>\n                            <td class=\"p-1\">\n                                <input ").concat(lock, " type=\"time\" value=\"").concat(t.pickup || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','transport',").concat(i, ",'pickup',this.value)\" class=\"text-center font-black text-blue-600\">\n                            </td>\n                            <td class=\"p-1\">\n                                <input ").concat(lock, " value=\"").concat(t.route || '', "\" onchange=\"mBTDB.updateRow('").concat(docId, "','transport',").concat(i, ",'route',this.value)\" class=\"w-full italic text-slate-500\" placeholder=\"Loc A > Loc B\">\n                            </td>\n                            <td class=\"p-1 text-center ").concat(hideTool, "\">\n                                <button onclick=\"mBTDB.deleteRow('").concat(docId, "','transport',").concat(i, ",'transport')\" class=\"text-slate-300 hover:text-red-500 font-bold\">\u00D7</button>\n                            </td>\n                        </tr>"); }).join(''), "\n                    </tbody>\n                </table>\n            </div>\n            <div class=\"p-2 border-t border-black bg-slate-50 ").concat(hideTool, "\">\n                <button onclick=\"mBTDB.addRow('").concat(docId, "','transport','move')\" class=\"w-full bg-white border border-slate-300 text-[9px] font-bold uppercase py-1 hover:bg-slate-100\">+ Add Movement</button>\n            </div>\n        </div>");
    },
    _renderMudMap: function (docId, widgetId, data) {
        // Logic Resolution: Use data-attributes to store ID references for the init function
        return "\n        <div class=\"w-full h-full bg-white relative group border-2 border-black\" id=\"mudmap_container_".concat(widgetId, "\">\n            <canvas id=\"canvas_").concat(widgetId, "\" class=\"mudmap-canvas absolute inset-0 w-full h-full z-10 cursor-crosshair\" data-doc-id=\"").concat(docId, "\" data-widget-id=\"").concat(widgetId, "\"></canvas>\n            \n            ").concat(this.state.isEditing ? "\n            <div class=\"absolute bottom-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity\">\n                <!-- [Feat16] Satellite Trigger -->\n                <button onclick=\"mBTDB.loadMapBackground('".concat(widgetId, "', '").concat(docId, "')\" class=\"bg-white text-blue-600 px-2 py-1 rounded shadow text-[9px] font-black uppercase tracking-widest border border-blue-200 hover:bg-blue-50\" title=\"Load Site Plan from Logistics Address\">Satellite</button>\n                <button onclick=\"mBTDB._clearMudMap('").concat(docId, "', '").concat(widgetId, "')\" class=\"bg-white text-rose-600 px-2 py-1 rounded shadow text-[9px] font-black uppercase tracking-widest border border-rose-200 hover:bg-rose-50\">Clear</button>\n            </div>\n            <div class=\"absolute top-2 left-2 z-0 text-[10px] font-black text-slate-100 uppercase pointer-events-none select-none tracking-widest\">\n                SKETCH AREA (MUD MAP)\n            </div>") : '', "\n        </div>");
    },
    _renderFooter: function (docId, widgetId, data) {
        var lock = this.state.isEditing ? '' : 'disabled';
        var val = data.additional ? data.additional[widgetId] : "";
        // Logic Resolution: Default Caribbean/UK Safety Standard if empty
        var defaultSafety = "EMERGENCY: DIAL 110/119 (JA) | NEAREST HOSPITAL: See Locations | SAFETY OFFICER: 1st AD\n\nHARASSMENT POLICY: This production operates a zero-tolerance policy towards harassment and bullying. Report concerns to the Producer or Unit Manager.";
        return "\n        <div class=\"h-full flex flex-col justify-end p-3 border-t-4 border-black mt-2 bg-slate-50\">\n            <div class=\"text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-2\">\n                ".concat(this.icons.hazard, " HEALTH & SAFETY PROTOCOLS\n            </div>\n            <textarea ").concat(lock, " onchange=\"mBTDB.updateData('").concat(docId, "', 'additional.").concat(widgetId, "', this.value)\" class=\"w-full h-full resize-none text-[9px] font-bold text-slate-800 bg-transparent outline-none leading-relaxed\" placeholder=\"Enter safety details...\">").concat(val || defaultSafety, "</textarea>\n        </div>");
    },
    _initMudMaps: function () {
        var canvases = document.querySelectorAll('.mudmap-canvas');
        canvases.forEach(function (cvs) {
            if (cvs.dataset.initialized)
                return;
            // 1. Resize Logic
            var rect = cvs.parentElement.getBoundingClientRect();
            cvs.width = rect.width;
            cvs.height = rect.height;
            var ctx = cvs.getContext('2d');
            var docId = cvs.dataset.docId;
            var widgetId = cvs.dataset.widgetId;
            // 2. Hydrate Data
            var doc = budget.documents.find(function (d) { return d.id === docId; });
            if (doc && doc.content.data.additional && doc.content.data.additional[widgetId]) {
                var img_1 = new Image();
                img_1.onload = function () { return ctx.drawImage(img_1, 0, 0); };
                img_1.src = doc.content.data.additional[widgetId];
            }
            // 3. Drawing Logic
            var isDrawing = false;
            var start = function (e) {
                if (!mBTDB.state.isEditing)
                    return;
                isDrawing = true;
                ctx.beginPath();
                // Fix: Calculate offset correctly relative to canvas, not window
                var bounds = cvs.getBoundingClientRect();
                var x = (e.clientX || e.touches[0].clientX) - bounds.left;
                var y = (e.clientY || e.touches[0].clientY) - bounds.top;
                ctx.moveTo(x, y);
            };
            var draw = function (e) {
                if (!isDrawing)
                    return;
                var bounds = cvs.getBoundingClientRect();
                var x = (e.clientX || e.touches[0].clientX) - bounds.left;
                var y = (e.clientY || e.touches[0].clientY) - bounds.top;
                ctx.lineTo(x, y);
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 2;
                ctx.lineCap = "round";
                ctx.stroke();
            };
            var end = function () {
                if (!isDrawing)
                    return;
                isDrawing = false;
                // Auto-save on stroke end
                mBTDB.updateData(docId, "additional.".concat(widgetId), cvs.toDataURL());
            };
            // 4. Bind Events (Mouse & Touch)
            cvs.addEventListener('mousedown', start);
            cvs.addEventListener('mousemove', draw);
            cvs.addEventListener('mouseup', end);
            cvs.addEventListener('mouseout', end);
            cvs.addEventListener('touchstart', function (e) { e.preventDefault(); start(e); });
            cvs.addEventListener('touchmove', function (e) { e.preventDefault(); draw(e); });
            cvs.addEventListener('touchend', end);
            cvs.dataset.initialized = "true";
        });
    },
    _clearMudMap: function (docId, widgetId) {
        var cvs = document.getElementById("canvas_".concat(widgetId));
        if (cvs) {
            var ctx = cvs.getContext('2d');
            ctx.clearRect(0, 0, cvs.width, cvs.height);
            this.updateData(docId, "additional.".concat(widgetId), '');
        }
    },
    // Logic Resolution: Silent High-Fidelity Image Processing (2K Max)
    _handleImageUpload: function (input, docId, widgetId) {
        var _this = this;
        if (!input.files || !input.files[0])
            return;
        var file = input.files[0];
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                var canvas = document.createElement('canvas');
                // Constraint: Max width 2048px (2K) for retina quality but safe storage
                var MAX_WIDTH = 2048;
                // Only scale down if larger than max width to preserve fidelity
                var width = img.width;
                var height = img.height;
                if (width > MAX_WIDTH) {
                    var scaleSize = MAX_WIDTH / width;
                    width = MAX_WIDTH;
                    height = img.height * scaleSize;
                }
                canvas.width = width;
                canvas.height = height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to JPEG 0.8 quality (High Fidelity)
                var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                _this.updateData(docId, "additional.".concat(widgetId), dataUrl);
                _this.renderFrame();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },
    // --- 5. Navigation & Logic Controllers ---
    _refreshWidget: function (docId, widgetId) {
        var doc = budget.documents.find(function (d) { return d.id === docId; });
        if (!doc)
            return;
        var widget = doc.content.widgets.find(function (w) { return w.id === widgetId; });
        if (!widget)
            return;
        var el = document.querySelector(".grid-stack-item[gs-id=\"".concat(widget.id, "\"] .widget-body"));
        if (el) {
            var currentScroll_1 = el.scrollTop;
            el.innerHTML = this._getContentForWidget(widget, doc);
            if (widget.type === 'mudmap')
                this._initMudMaps();
            // Logic Resolution: Restore scroll position of the widget body surgically
            requestAnimationFrame(function () { if (el)
                el.scrollTop = currentScroll_1; });
        }
    },
    toggleVertical: function (wid) {
        var _this = this;
        var doc = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
        var w = doc.content.widgets.find(function (x) { return x.id === wid; });
        if (w) {
            w.vertical = !w.vertical;
            this._refreshWidget(doc.id, wid);
        }
    },
    updateWidgetLabel: function (docId, widgetId, newLabel) {
        var doc = budget.documents.find(function (d) { return d.id === docId; });
        var w = doc.content.widgets.find(function (x) { return x.id === widgetId; });
        if (w) {
            w.label = newLabel;
            this._triggerSave();
            // Sprint 2: Surgical Label Sync
            var input = document.querySelector(".grid-stack-item[gs-id=\"".concat(widgetId, "\"] .widget-header input"));
            if (input && input.value !== newLabel)
                input.value = newLabel;
        }
    },
    updateData: function (docId, path, value) {
        var doc = budget.documents.find(function (d) { return d.id === docId; });
        // Invalidate Cache
        if (this.state._cache && this.state._cache.docId === docId)
            this.state._cache = null;
        var parts = path.split('.');
        var target = doc.content.data;
        for (var i = 0; i < parts.length - 1; i++) {
            if (!target[parts[i]])
                target[parts[i]] = {};
            target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;
        // Phase 9: Sync Request Broadcast
        if (mBT.core && mBT.core.events)
            mBT.core.events.emit('sync-req', { docId: docId, path: path });
        this._triggerSave();
    },
    updateDataDebounced: function (docId, path, value) {
        var doc = budget.documents.find(function (d) { return d.id === docId; });
        if (this.state._cache && this.state._cache.docId === docId)
            this.state._cache = null;
        var parts = path.split('.');
        var target = doc.content.data;
        for (var i = 0; i < parts.length - 1; i++) {
            if (!target[parts[i]])
                target[parts[i]] = {};
            target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;
        if (mBT.core && mBT.core.events)
            mBT.core.events.emit('sync-req', { docId: docId, path: path });
        this._debouncedSave();
    },
    updateRow: function (docId, section, index, key, value) {
        var doc = budget.documents.find(function (d) { return d.id === docId; });
        if (doc.content.data[section][index]) {
            // Invalidate Cache
            if (this.state._cache && this.state._cache.docId === docId)
                this.state._cache = null;
            doc.content.data[section][index][key] = value;
            this._triggerSave();
            // Batch 3.2: Removed auto-resize logic. Data saves silently without moving UI.
        }
    },
    addRow: function (docId, section, type, presetData) {
        var doc = budget.documents.find(function (d) { return d.id === docId; });
        // Invalidate Cache
        if (this.state._cache && this.state._cache.docId === docId)
            this.state._cache = null;
        if (!doc.content.data[section])
            doc.content.data[section] = [];
        var newRow = presetData || { id: Date.now() };
        if (!presetData) {
            if (section === 'schedule')
                newRow = __assign(__assign({}, newRow), { type: type, time: "", scene: "", description: type === 'meal' ? "LUNCH" : "New Shot", cast: "", ie: "", loc: "", note: "" });
            else if (section === 'cast')
                newRow = __assign(__assign({}, newRow), { character: "", actor: "", status: "W", pickup: "", hmu: "", setCall: "", contact: "" });
            else if (section === 'crew')
                newRow = __assign(__assign({}, newRow), { department: "", position: "", name: "", contact: "", callTime: "" });
            else if (section === 'contacts')
                newRow = __assign(__assign({}, newRow), { role: "", name: "" });
            else if (section === 'locations')
                newRow = __assign(__assign({}, newRow), { name: "", address: "", weather: "", hospital: "", mapLink: "", timeOnLocation: "" });
            else if (section === 'transport')
                newRow = __assign(__assign({}, newRow), { driver: "", vehicle: "", pax: "", pickup: "", loc: "", dest: "" });
        }
        doc.content.data[section].push(newRow);
        this._triggerSave();
        // Surgical Widget Refresh
        var widgetType = (section === 'locations') ? 'logistics' : section;
        var widget = doc.content.widgets.find(function (w) { return w.type === widgetType; });
        if (widget)
            this._refreshWidget(docId, widget.id);
        else
            this.renderFrame();
    },
    deleteRow: function (docId, section, index, widgetType) {
        var doc = budget.documents.find(function (d) { return d.id === docId; });
        // Invalidate Cache
        if (this.state._cache && this.state._cache.docId === docId)
            this.state._cache = null;
        doc.content.data[section].splice(index, 1);
        this._triggerSave();
        // Surgical Widget Refresh
        var type = widgetType || section;
        var widget = doc.content.widgets.find(function (w) { return w.type === type; });
        if (widget)
            this._refreshWidget(docId, widget.id);
        else
            this.renderFrame();
    },
    deleteWidget: function (id) {
        var _this = this;
        mBTME.confirm("Delete Widget", "Remove this block from layout?", function () {
            var doc = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
            var el = document.querySelector(".grid-stack-item[gs-id=\"".concat(id, "\"]"));
            if (el)
                _this.state.grid.removeWidget(el);
            doc.content.widgets = doc.content.widgets.filter(function (w) { return w.id !== id; });
            _this._triggerSave();
        });
    },
    addWidget: function () {
        var _this = this;
        var select = document.getElementById('mBTDB_WidgetSelect');
        if (!select)
            return;
        var type = select.value;
        var doc = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
        var w = { id: type + '_' + Date.now(), type: type, w: 6, h: 4, autoPosition: true, label: type.toUpperCase() };
        var html = this._generateWidgetHTML(w, doc);
        var node = this.state.grid.addWidget({ w: 6, h: 4, content: html, id: w.id, autoPosition: true });
        w.x = node.gridstackNode.x;
        w.y = node.gridstackNode.y;
        doc.content.widgets.push(w);
        this._triggerSave();
        // Logic Fix: Ensure canvas initializes immediately after adding
        if (type === 'mudmap')
            setTimeout(function () { return _this._initMudMaps(); }, 50);
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
        var val = el.value.replace(/[^0-9]/g, '');
        if (val.length < 3)
            return; // Wait for at least 3 digits
        // Pad 3 digits to 4 (e.g., 800 -> 0800)
        if (val.length === 3)
            val = '0' + val;
        // Truncate if too long (e.g., pasted 12345)
        if (val.length > 4)
            val = val.substring(0, 4);
        var hh = parseInt(val.substring(0, 2));
        var mm = parseInt(val.substring(2, 4));
        // Logic Resolution: Enforce Military Time Constraint from Header Setting
        // This ensures the row data matches the document's declared format
        var is24h = false;
        if (docId) {
            var doc = budget.documents.find(function (d) { return d.id === docId; });
            if (doc && doc.content.data.meta.is24h)
                is24h = true;
        }
        if (is24h) {
            // Military Clamp
            if (hh > 23)
                hh = 23;
        }
        else {
            // Standard Time Heuristics (Optional intelligent conversion could go here)
            if (hh > 23)
                hh = 23;
        }
        if (mm > 59)
            mm = 59;
        // Output format is always HH:MM for data consistency
        el.value = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    },
    saveTemplate: function () {
        var _this = this;
        var doc = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
        mBTME.prompt("Save Template", "Template Name:", doc.label + " Preset", function (name) {
            if (!name)
                return;
            var tmpl = { id: 'tmpl_' + Date.now(), label: name, widgets: JSON.parse(JSON.stringify(doc.content.widgets)) };
            if (!budget.templates)
                budget.templates = [];
            budget.templates.push(tmpl);
            mBTME.alert("Success", "Template \"".concat(name, "\" saved."));
        });
    },
    calcShootDay: function (dateStr) { if (!budget.startDate)
        return "Day 1"; var start = new Date(budget.startDate); var current = new Date(dateStr); if (isNaN(start) || isNaN(current))
        return "Day 1"; var diffDays = Math.ceil((current - start) / (1000 * 60 * 60 * 24)) + 1; return "Day ".concat(diffDays); },
    syncFromBudget: function () {
        var _this = this;
        mBTME.confirm("Sync Data", "Import crew & data from current Budget?", function () {
            var doc = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
            // Invalidate Cache
            if (_this.state._cache && _this.state._cache.docId === doc.id)
                _this.state._cache = null;
            // 1. Crew Map Logic (Budget Line Items -> Crew List)
            Object.values(budget.sections).forEach(function (sec) { return sec.items.forEach(function (i) {
                if (i.crew && i.crew.name) {
                    // Check if already in list to avoid duplicates
                    var exists = doc.content.data.crew.some(function (c) { return c.name === i.crew.name && c.department === i.description; });
                    if (!exists) {
                        _this.addRow(doc.id, 'crew', 'person', {
                            department: i.description,
                            name: i.crew.name,
                            contact: i.crew.phone,
                            linkedItemId: i.id
                        });
                    }
                }
            }); });
            // 2. Key Contacts Logic (Map Specific Roles)
            var map = { 'director': 'Director', 'producer': 'Producer', 'ad': '1st AD' };
            Object.entries(map).forEach(function (_a) {
                var key = _a[0], role = _a[1];
                // Scan Budget Line Items
                var found = null;
                Object.values(budget.sections).some(function (s) {
                    var i = s.items.find(function (x) { return x.description.toLowerCase().includes(role.toLowerCase()) && x.crew && x.crew.name; });
                    if (i) {
                        found = i.crew.name;
                        return true;
                    }
                });
                if (found)
                    doc.content.data.contacts[key] = found;
            });
            // 3. Refresh
            mBTLE.reconcile();
            _this.renderFrame();
            mBTME.alert("Sync Complete", "Budget personnel imported.");
        });
    },
    syncFromPrevious: function () {
        var _this = this;
        var cur = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
        if (!cur)
            return;
        var prev = null;
        var msg = "";
        if (cur.type === 'prodReport') {
            // Logic Resolution: Cross-Document Inheritance (DPR pulls from Call Sheet)
            var sheets = budget.documents.filter(function (d) { return d.type === 'callSheet'; })
                .sort(function (a, b) { return (parseInt(b.id.split('_')[1]) || 0) - (parseInt(a.id.split('_')[1]) || 0); });
            prev = sheets[0];
            msg = "Import data from Call Sheet \"".concat(prev === null || prev === void 0 ? void 0 : prev.label, "\"?");
        }
        else {
            // Standard History: Inherit from previous of same type
            var others = budget.documents.filter(function (d) { return d.type === cur.type && d.id !== cur.id; })
                .sort(function (a, b) { return (parseInt(b.id.split('_')[1]) || 0) - (parseInt(a.id.split('_')[1]) || 0); });
            prev = others[0];
            msg = "Import crew & contacts from \"".concat(prev === null || prev === void 0 ? void 0 : prev.label, "\"?");
        }
        if (!prev)
            return mBTME.alert("Sync Info", "No source document found.");
        mBTME.confirm("Sync Previous", msg, function () {
            var _a, _b, _c, _d, _e, _f, _g;
            // Invalidate Cache
            if (_this.state._cache && _this.state._cache.docId === cur.id)
                _this.state._cache = null;
            if ((_b = (_a = prev.content) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.contacts)
                cur.content.data.contacts = JSON.parse(JSON.stringify(prev.content.data.contacts));
            if ((_d = (_c = prev.content) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.crew)
                cur.content.data.crew = JSON.parse(JSON.stringify(prev.content.data.crew));
            // Logic Resolution: Date Inheritance for DPR
            if (cur.type === 'prodReport' && ((_g = (_f = (_e = prev.content) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.meta) === null || _g === void 0 ? void 0 : _g.shootDate)) {
                cur.content.data.meta.shootDate = prev.content.data.meta.shootDate;
            }
            _this._triggerSave();
            _this.renderFrame();
        });
    },
    snapshotDoc: function () {
        var _this = this;
        var doc = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
        var newDoc = JSON.parse(JSON.stringify(doc));
        newDoc.id = 'doc_' + Date.now();
        newDoc.label = doc.label + " (Copy)";
        budget.documents.push(newDoc);
        mBTDB.open(newDoc.id);
    },
    pullFromOpenGate: function (docId, path, roleQuery) {
        var _this = this;
        if (typeof mBTOG === 'undefined')
            return mBTME.alert("System Error", "Database Resolution Failure.");
        // Logic Resolution: Tier 5 Context-Aware Search
        // 1. Scan Active Budget First (Inheritance)
        var matches = [];
        var seen = new Set(); // Prevent duplicates
        if (budget.sections) {
            Object.values(budget.sections).forEach(function (sec) {
                sec.items.forEach(function (i) {
                    if (i.crew && i.crew.name && i.description.toLowerCase().includes(roleQuery.toLowerCase())) {
                        var key = "".concat(i.crew.name, "|").concat(i.crew.phone);
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
        var globalMatches = mBTOG.contacts.filter(function (c) { var _a; return (_a = c.role) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(roleQuery.toLowerCase()); });
        globalMatches.forEach(function (c) {
            var key = "".concat(c.name, "|").concat(c.contact || c.phone);
            if (!seen.has(key)) {
                matches.push(__assign(__assign({}, c), { source: 'Global DB' }));
                seen.add(key);
            }
        });
        if (matches.length === 0)
            return mBTME.alert("Not Found", "No ".concat(roleQuery, " found."));
        var apply = function (c) {
            var parts = path.split('.');
            if (parts.length === 3 && (parts[0] === 'crew' || parts[0] === 'cast')) {
                _this.updateRow(docId, parts[0], parseInt(parts[1]), parts[2], c.name);
                if (c.contact)
                    _this.updateRow(docId, parts[0], parseInt(parts[1]), 'contact', c.contact);
            }
            else {
                _this.updateData(docId, path, "".concat(c.name, " ").concat(c.contact ? '(' + c.contact + ')' : ''));
            }
            _this.renderFrame();
        };
        if (matches.length === 1) {
            apply(matches[0]);
        }
        else {
            // Modern UI Replacement: Custom Modal with Buttons
            var listHtml = matches.map(function (c, i) {
                return "<button onclick=\"mBTDB._resolveOGSelection(".concat(i, ")\" class=\"w-full text-left p-3 bg-slate-50 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-xl transition-all group mb-2\">\n                    <div class=\"flex justify-between items-center\">\n                        <div class=\"text-[10px] font-black uppercase text-slate-700 group-hover:text-blue-700\">").concat(c.name, "</div>\n                        <div class=\"text-[8px] font-bold text-slate-300 bg-white border border-slate-200 rounded px-1.5 py-0.5\">").concat(c.source, "</div>\n                    </div>\n                    <div class=\"text-[9px] text-slate-400 font-mono\">").concat(c.contact || 'No Contact', "</div>\n                </button>");
            }).join('');
            // Temporary resolver stored on the object to handle the async click
            this._resolveOGSelection = function (idx) {
                mBTME.close('ogSelectModal');
                if (matches[idx])
                    apply(matches[idx]);
                delete _this._resolveOGSelection;
            };
            mBTME.open('ogSelect', "Select ".concat(roleQuery), "<div class=\"p-4 max-h-[400px] overflow-y-auto no-scrollbar\">".concat(listHtml, "</div>"), 'max-w-sm');
        }
    },
    printToPDF: function (mode) {
        if (typeof mBTPublisher === 'undefined')
            return mBTME.alert("Error", "Publisher Resolution Failure.");
        var original = document.getElementById('mBTDB_Workspace');
        var clone = original.cloneNode(true);
        clone.id = "mBTDB_Print_Container";
        clone.classList.remove('editing-mode');
        clone.classList.add('print-container', mode === 'standard' ? 'print-standard' : 'print-graphic');
        var originalInputs = original.querySelectorAll('input, textarea');
        var cloneInputs = clone.querySelectorAll('input, textarea');
        originalInputs.forEach(function (input, i) { if (cloneInputs[i])
            cloneInputs[i].value = input.value; });
        document.body.appendChild(clone);
        mBTPublisher.exportToPDF('mBTDB_Print_Container', "".concat(budget.projectName, "_CallSheet"));
        setTimeout(function () { document.body.removeChild(clone); }, 2000);
    },
    // --- 6. Switchboard Integration ---
    _updateHeaderButtons: function () {
        var _this = this;
        var btnContainer = document.getElementById('mBTDB_Buttons');
        if (!btnContainer)
            return;
        var isEd = this.state.isEditing;
        var pencilIcon = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z\"/></svg>";
        var checkIcon = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg>";
        // Widget Selector (Edit Mode Only)
        var widgetSelector = isEd ? "\n            <div class=\"flex items-center bg-white rounded-lg pl-2 mr-3 shadow-sm animate-in fade-in zoom-in duration-200 border border-slate-700/30\">\n                <select id=\"mBTDB_WidgetSelect\" class=\"bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-900 h-7 outline-none cursor-pointer border-none mr-2\">\n                    <option value=\"richText\">Note</option>\n                    <option value=\"image\">Image</option>\n                    <option value=\"schedule\">Schedule</option>\n                    <option value=\"cast\">Cast List</option>\n                    <option value=\"crew\">Crew List</option>\n                    <option value=\"logistics\">Logistics</option>\n                    <option value=\"contacts\">Contacts</option>\n                    <option value=\"transport\">Transport</option>\n                    <option value=\"mudmap\">Mud Map</option>\n                    <option value=\"footer\">Safety Footer</option>\n                </select>\n                <button onclick=\"mBTDB.addWidget()\" class=\"w-8 h-8 flex items-center justify-center text-blue-600 hover:text-white hover:bg-blue-600 transition-colors rounded-r-lg\" title=\"Add Widget\">\n                    ".concat(this.icons.plus, "\n                </button>\n            </div>") : '';
        // Main Toolbar with Functional Grouping
        // Improvement: Added Paper Size Selector (Sprint 02)
        // Accesses mBTDB.config.paperSizes defined in Sprint 01
        btnContainer.innerHTML = "\n            <div class=\"flex-grow overflow-x-auto no-scrollbar min-w-0\">\n                <div class=\"flex items-center gap-1 whitespace-nowrap\">\n                    ".concat(widgetSelector, "\n\n                    <!-- Paper Size Selector -->\n                    <div class=\"relative group mr-3 border-r border-slate-700/50 pr-3\">\n                        <select data-action=\"studio-set-paper\" class=\"bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest p-2 rounded-lg outline-none cursor-pointer border border-transparent focus:border-blue-500 appearance-none hover:bg-slate-700 transition-colors\" title=\"Canvas Size\">\n                            ").concat(Object.entries(mBTDB.config.paperSizes).map(function (_a) {
            var key = _a[0], conf = _a[1];
            var doc = budget.documents.find(function (d) { return d.id === _this.state.currentDocId; });
            var currentSize = (doc === null || doc === void 0 ? void 0 : doc.content.data.meta.paperSize) || 'a4';
            return "<option value=\"".concat(key, "\" ").concat(key === currentSize ? 'selected' : '', ">").concat(conf.label, "</option>");
        }).join(''), "\n                        </select>\n                    </div>\n                    \n                    <!-- History Controls -->\n                    <div class=\"flex gap-1 mr-3 border-r border-slate-700/50 pr-3\">\n                        <button data-action=\"studio-undo\" class=\"p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800\" title=\"Undo\">").concat(this.icons.undo, "</button>\n                        <button data-action=\"studio-redo\" class=\"p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800\" title=\"Redo\">").concat(this.icons.redo, "</button>\n                    </div>\n\n                    <!-- Integration Hub: Sync & Preview -->\n                    <div class=\"flex gap-1 mr-3 border-r border-slate-700/50 pr-3\">\n                        <button data-action=\"studio-sync\" class=\"p-2 text-emerald-500 hover:text-emerald-400 transition-colors rounded-lg hover:bg-slate-800\" title=\"Sync from Budget\">").concat(mBTAssets.sync, "</button>\n                        <button data-action=\"studio-sync-prev\" class=\"p-2 text-blue-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800\" title=\"Sync from Previous\">").concat(mBTAssets.refresh, "</button>\n                        <button data-action=\"studio-preview\" class=\"p-2 text-purple-500 hover:text-purple-400 transition-colors rounded-lg hover:bg-slate-800\" title=\"Document Preview\">").concat(mBTAssets.image, "</button>\n                    </div>\n\n                    <!-- Snapshot Tools -->\n                    <div class=\"flex gap-1 mr-3 border-r border-slate-700/50 pr-3\">\n                        <button data-action=\"studio-snapshot\" class=\"p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800\" title=\"Duplicate Document\">").concat(this.icons.copy, "</button>\n                        <button data-action=\"studio-template\" class=\"p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800\" title=\"Save Blueprint\">").concat(this.icons.save, "</button>\n                    </div>\n\n                    <!-- Layout Toggle -->\n                    <button data-action=\"studio-toggle-edit\" class=\"p-2 rounded-lg transition-all ").concat(isEd ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800', "\" title=\"").concat(isEd ? 'Finish Editing' : 'Edit Layout', "\">\n                        ").concat(isEd ? checkIcon : pencilIcon, "\n                    </button>\n                </div>\n            </div>\n        ");
    },
    _triggerSave: function () {
        clearTimeout(this._saveTimer);
        if (typeof mBTLE !== 'undefined')
            mBTLE.reconcile();
        if (typeof saveBudget === 'function')
            saveBudget();
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
        if (!budget)
            return;
        mBTME.prompt("Save Blueprint", "Name this template:", budget.projectName + " Template", function (name) {
            if (!name)
                return;
            var structure = [];
            Object.values(budget.sections).forEach(function (sec) {
                structure.push({
                    id: sec.id,
                    name: sec.name,
                    items: sec.items.map(function (i) { return ({
                        description: i.description,
                        unit: i.unit,
                        rate: i.rate,
                        multiplier: i.multiplier,
                        rateType: i.rateType
                        // Note: We strip actuals, crew, and transient IDs to create a clean template
                    }); })
                });
            });
            mBT.data.templates.saveTemplate(name, {
                structure: structure,
                label: name,
                desc: 'Custom User Blueprint',
                icon: 'file'
            });
            mBTME.alert("Success", "Blueprint \"".concat(name, "\" saved! It is now available in the New Project menu."));
        });
    }
};
// Core Action Binding for Blueprint
mBT.core.action('blueprint-save', function () { return mBT.features.blueprints.saveCurrentAsBlueprint(); });
/* ========= v19.54 ACTIVITY HISTORY (mBT.features.history) ========= */
mBT.features.history = {
    open: function () {
        // Get logs, newest first
        var logs = (budget.activityLog || []).slice().reverse();
        var renderDiff = function (diff) {
            if (!diff || (diff.oldValue === undefined && diff.newValue === undefined))
                return '';
            // Logic Resolution: Render visual diff for transparency
            return "<div class=\"mt-1 text-[9px] font-mono text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 flex items-center gap-2\">\n                    <span class=\"line-through text-red-400 opacity-70\">".concat(mBT.ui.render.esc(diff.oldValue), "</span>\n                    <span class=\"text-slate-300\">\u2192</span>\n                    <span class=\"text-emerald-600 font-bold\">").concat(mBT.ui.render.esc(diff.newValue), "</span>\n                </div>");
        };
        var listHtml = logs.length ? logs.map(function (l) {
            var iconColor = 'bg-blue-500';
            if (l.action === 'DELETE')
                iconColor = 'bg-rose-500';
            if (l.action === 'ADD')
                iconColor = 'bg-emerald-500';
            if (l.action === 'REORDER')
                iconColor = 'bg-amber-500';
            if (l.action === 'REVERT')
                iconColor = 'bg-purple-500';
            // Tier 5 Logic: Inject Revert Button for Reversible Actions
            var revertBtn = '';
            if (l.diff && l.action === 'UPDATE' && l.itemId) {
                revertBtn = "<button onclick=\"mBT.data.history.revert('".concat(l.id, "')\" class=\"opacity-0 group-hover:opacity-100 transition-opacity ml-2 px-2 py-1 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded text-[8px] font-black uppercase tracking-widest\" title=\"Revert value\">Revert</button>");
            }
            return "\n                <div class=\"p-3 bg-white border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 group\">\n                    <div class=\"flex-shrink-0 mt-1.5\">\n                        <div class=\"w-1.5 h-1.5 rounded-full ".concat(iconColor, " shadow-sm\"></div>\n                    </div>\n                    <div class=\"flex-grow min-w-0\">\n                        <div class=\"flex justify-between items-start\">\n                            <span class=\"text-[10px] font-black uppercase text-slate-700 tracking-widest truncate pr-2\">").concat(l.action, ": ").concat(mBT.ui.render.esc(l.target), "</span>\n                            <span class=\"text-[8px] font-mono text-slate-400 shrink-0\">").concat(new Date(l.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), "</span>\n                        </div>\n                        <div class=\"flex justify-between items-center\">\n                            <div class=\"text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5\">").concat(l.section, "</div>\n                            ").concat(revertBtn, "\n                        </div>\n                        ").concat(renderDiff(l.diff), "\n                    </div>\n                </div>");
        }).join('') : RenderEngine.ui.emptyState({ icon: mBTAssets.list, message: 'No Activity Recorded' });
        var content = "\n                <div class=\"flex flex-col h-[500px] bg-slate-50\">\n                    <div class=\"p-4 bg-white border-b border-slate-100 shrink-0 flex justify-between items-center shadow-sm z-10\">\n                        <div>\n                            <h3 class=\"text-xs font-black uppercase tracking-widest text-slate-800\">Project Audit Log</h3>\n                            <p class=\"text-[9px] text-slate-400 font-bold mt-0.5\">".concat(logs.length, " Events</p>\n                        </div>\n                        <button onclick=\"mBT.features.history.export()\" class=\"flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-[9px] font-black uppercase tracking-widest\">\n                            ").concat(mBTAssets.save, " Export CSV\n                        </button>\n                    </div>\n                    <div class=\"flex-grow overflow-y-auto no-scrollbar\">\n                        ").concat(listHtml, "\n                    </div>\n                </div>");
        mBTME.open('activityLog', 'History', content, 'max-w-md', { hideHeader: true, noPadding: true });
    },
    export: function () {
        var _a;
        if (!((_a = budget.activityLog) === null || _a === void 0 ? void 0 : _a.length))
            return mBTME.alert("Empty", "No history to export.");
        // Logic Resolution: ISO Standard CSV Generation
        var headers = ["Timestamp", "User", "Action", "Target", "Section", "Old Value", "New Value"];
        var rows = budget.activityLog.map(function (e) {
            var _a, _b;
            var escapeCsv = function (val) { return "\"".concat(String(val || '').replace(/"/g, '""'), "\""); };
            return [
                e.ts,
                e.user,
                e.action,
                e.target,
                e.section,
                (_a = e.diff) === null || _a === void 0 ? void 0 : _a.oldValue,
                (_b = e.diff) === null || _b === void 0 ? void 0 : _b.newValue
            ].map(escapeCsv).join(",");
        });
        var csvContent = "data:text/csv;charset=utf-8," + __spreadArray([headers.join(",")], rows, true).join("\n");
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "".concat(budget.projectName, "_AuditLog_").concat(new Date().toISOString().split('T')[0], ".csv"));
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
            var data = {
                financials: { topCosts: [], bleeders: [], burnRate: 0 },
                crew: { burnout: [], departmentLoad: {} },
                stats: { totalItems: 0, assignedCrew: 0 }
            };
            var crewMap = {};
            var totalEst = 0;
            var totalAct = 0;
            var allItems = [];
            // A. Aggregation Loop
            if (budget && budget.sections) {
                Object.values(budget.sections).forEach(function (sec) {
                    sec.items.forEach(function (item) {
                        data.stats.totalItems++;
                        var est = parseFloat(item.total) || 0;
                        var act = parseFloat(item.actual) || 0;
                        var variance = act - est;
                        totalEst += est;
                        totalAct += act;
                        allItems.push(__assign(__assign({}, item), { sectionName: sec.name, est: est, act: act, variance: variance }));
                        // Crew Aggregation Logic
                        if (item.crew && item.crew.name) {
                            data.stats.assignedCrew++;
                            var key = item.crew.name.toLowerCase();
                            if (!crewMap[key])
                                crewMap[key] = { name: item.crew.name, days: 0, roles: [], cost: 0 };
                            // Day normalization (converting units to days for heatmap)
                            var days = parseFloat(item.quantity) || 0;
                            if (item.unit === 'Week')
                                days *= 5;
                            else if (item.unit === 'Month')
                                days *= 20;
                            else if (item.unit === 'Flat')
                                days = 1; // Assumption for flat fees
                            // Check Stage Data override (More accurate time tracking)
                            if (item.stageData) {
                                var sDays_1 = 0;
                                Object.values(item.stageData).forEach(function (d) { return sDays_1 += (parseFloat(d.days) || 0); });
                                if (sDays_1 > 0)
                                    days = sDays_1;
                            }
                            crewMap[key].days += days;
                            crewMap[key].cost += est;
                            // Avoid duplicate role names
                            var roleLabel = "".concat(item.description, " (").concat(days, "d)");
                            if (!crewMap[key].roles.includes(roleLabel))
                                crewMap[key].roles.push(roleLabel);
                        }
                    });
                });
            }
            // B. Financial Metrics
            data.financials.burnRate = totalEst > 0 ? (totalAct / totalEst) * 100 : 0;
            // Top Cost Drivers (The Heavy Hitters)
            data.financials.topCosts = __spreadArray([], allItems, true).sort(function (a, b) { return b.est - a.est; })
                .slice(0, 5);
            // Top Bleeders (Variance > 0, highest mismatch)
            data.financials.bleeders = __spreadArray([], allItems, true).filter(function (i) { return i.variance > 0.01; }) // Filter out floating point noise
                .sort(function (a, b) { return b.variance - a.variance; })
                .slice(0, 5);
            // C. Crew Metrics
            data.crew.burnout = Object.values(crewMap)
                .sort(function (a, b) { return b.days - a.days; })
                .slice(0, 8); // Top 8 busiest people
            return data;
        },
        // --- Phase 9: Global Studio Scanner ---
        runGlobalAudit: function () {
            return __awaiter(this, void 0, void 0, function () {
                var projects, globalData, _i, projects_1, pName, raw, grandTotal, actualTotal;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, mBT.data.getList()];
                        case 1:
                            projects = _a.sent();
                            globalData = {
                                projectCount: projects.length,
                                totalBudget: 0,
                                totalSpend: 0,
                                crewEarnings: {},
                                projectSummaries: []
                            };
                            _i = 0, projects_1 = projects;
                            _a.label = 2;
                        case 2:
                            if (!(_i < projects_1.length)) return [3 /*break*/, 5];
                            pName = projects_1[_i];
                            return [4 /*yield*/, mBT.data.storage.load(storageKeyPrefix + pName)];
                        case 3:
                            raw = _a.sent();
                            if (!raw)
                                return [3 /*break*/, 4];
                            grandTotal = parseFloat(raw.grandTotal) || 0;
                            actualTotal = parseFloat(raw.actualTotal) || 0;
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
                                Object.values(raw.sections).forEach(function (sec) {
                                    sec.items.forEach(function (item) {
                                        if (item.crew && item.crew.name) {
                                            var key = item.crew.name;
                                            if (!globalData.crewEarnings[key])
                                                globalData.crewEarnings[key] = 0;
                                            // Estimate earnings based on item total (Est) or Actual if available
                                            // Use Actual if > 0, else Est
                                            var earnings = (parseFloat(item.actual) > 0) ? parseFloat(item.actual) : (parseFloat(item.total) || 0);
                                            globalData.crewEarnings[key] += earnings;
                                        }
                                    });
                                });
                            }
                            _a.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5:
                            // Sort Top Crew
                            globalData.topCrew = Object.entries(globalData.crewEarnings)
                                .map(function (_a) {
                                var name = _a[0], amount = _a[1];
                                return ({ name: name, amount: amount });
                            })
                                .sort(function (a, b) { return b.amount - a.amount; })
                                .slice(0, 10);
                            return [2 /*return*/, globalData];
                    }
                });
            });
        }
    },
    // --- 2. UI Engine (The Dashboard) ---
    ui: {
        openHub: function () {
            var analysis = mBT.features.cortex.logic.analyze();
            var fmt = mBTLE.format.currency;
            // --- Widget 1: Burn Rate KPI (Compact) ---
            // Visual logic: Green if <80%, Yellow <100%, Red >100%
            var burnRate = analysis.financials.burnRate;
            var burnColor = 'text-slate-800';
            if (burnRate > 100)
                burnColor = 'text-rose-600';
            else if (burnRate > 80)
                burnColor = 'text-amber-500';
            var burnWidget = "\n                    <div class=\"col-span-1 md:col-span-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm h-full flex flex-col justify-center items-center text-center overflow-hidden\">\n                        <div class=\"text-[9px] font-black uppercase text-slate-300 mb-2 tracking-widest\">Burn Rate</div>\n                        <span class=\"text-3xl font-black ".concat(burnColor, " tracking-tighter truncate w-full px-2 block\" title=\"").concat(burnRate.toFixed(1), "%\">").concat(burnRate.toFixed(1), "%</span>\n                        <span class=\"text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-wider\">of budget</span>\n                    </div>");
            // --- Widget 2: Cost Drivers (List) ---
            var renderBar = function (label, val, max, colorClass, subText) {
                var pct = max > 0 ? Math.min((val / max) * 100, 100) : 0;
                return "\n                    <div class=\"mb-3\">\n                        <div class=\"flex justify-between text-[9px] font-black uppercase text-slate-500 mb-1\">\n                            <span class=\"truncate pr-2\" title=\"".concat(RenderEngine.esc(label), "\">").concat(RenderEngine.esc(label), "</span>\n                            <span>").concat(fmt(val), "</span>\n                        </div>\n                        <div class=\"h-1.5 bg-slate-100 rounded-full overflow-hidden\">\n                            <div class=\"h-full ").concat(colorClass, "\" style=\"width: ").concat(pct, "%\"></div>\n                        </div>\n                        ").concat(subText ? "<div class=\"text-[8px] text-slate-400 font-mono mt-0.5 text-right\">".concat(subText, "</div>") : '', "\n                    </div>");
            };
            var maxCost = analysis.financials.topCosts.length ? analysis.financials.topCosts[0].est : 1;
            var financialsWidget = "\n                    <div class=\"col-span-1 md:col-span-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm h-full overflow-y-auto no-scrollbar\">\n                        <h4 class=\"text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-2\">Cost Drivers</h4>\n                        \n                        <div class=\"mb-6\">\n                            ".concat(analysis.financials.topCosts.length ? analysis.financials.topCosts.map(function (i) { return renderBar(i.description, i.est, maxCost, 'bg-blue-600'); }).join('') : '<div class="text-[9px] text-slate-300 italic">No data</div>', "\n                        </div>\n\n                        ").concat(analysis.financials.bleeders.length ? "\n                            <div>\n                                <div class=\"text-[9px] font-black uppercase text-rose-300 mb-3\">Variance Alert</div>\n                                ".concat(analysis.financials.bleeders.map(function (i) { return renderBar(i.description, i.variance, i.variance, 'bg-rose-500', "Act: ".concat(fmt(i.act))); }).join(''), "\n                            </div>\n                        ") : '', "\n                    </div>");
            // --- Widget 3: Human Heatmap Render ---
            var renderCrewRow = function (c) {
                var statusColor = 'bg-emerald-100 text-emerald-700'; // Safe
                var statusLabel = 'OK';
                if (c.days > 20) {
                    statusColor = 'bg-rose-100 text-rose-700';
                    statusLabel = 'CRITICAL';
                }
                else if (c.days > 10) {
                    statusColor = 'bg-amber-100 text-amber-700';
                    statusLabel = 'HEAVY';
                }
                return "\n                    <div class=\"flex items-center justify-between p-2 mb-2 bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-colors\">\n                        <div class=\"flex items-center gap-3 overflow-hidden\">\n                            <div class=\"w-8 h-8 rounded-full bg-white text-slate-400 flex items-center justify-center font-black text-[9px] shadow-sm border border-slate-100 shrink-0\">\n                                ".concat(c.name.charAt(0).toUpperCase(), "\n                            </div>\n                            <div class=\"min-w-0\">\n                                <div class=\"text-[10px] font-black text-slate-700 uppercase truncate\" title=\"").concat(RenderEngine.esc(c.name), "\">").concat(RenderEngine.esc(c.name), "</div>\n                                <div class=\"text-[8px] text-slate-400 font-bold truncate\">").concat(c.roles.length, " roles assigned</div>\n                            </div>\n                        </div>\n                        <div class=\"text-right shrink-0\">\n                            <div class=\"px-2 py-1 rounded-md text-[9px] font-black ").concat(statusColor, " text-center\">").concat(statusLabel, "</div>\n                            <div class=\"text-[8px] text-slate-400 font-mono mt-0.5\">").concat(c.days, " Days</div>\n                        </div>\n                    </div>");
            };
            var crewWidget = "\n                    <div class=\"col-span-1 md:col-span-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm h-full overflow-y-auto no-scrollbar\">\n                        <h4 class=\"text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-2\">Human Capital</h4>\n                        \n                        <div class=\"mb-6\">\n                            ".concat(analysis.crew.burnout.length ? analysis.crew.burnout.map(renderCrewRow).join('') : '<div class="text-[9px] text-slate-300 italic">No crew data</div>', "\n                        </div>\n                    </div>");
            // --- Widget 4: Live Auditor (Standardized UI) ---
            var auditorWidget = "\n                    <div class=\"col-span-1 md:col-span-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm h-full flex flex-col relative overflow-hidden group\">\n                        \n                        <h4 class=\"text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-2 flex justify-between items-center z-10\">\n                            <span>Live Auditor</span>\n                            <span class=\"flex h-2 w-2 relative\">\n                                <span class=\"animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75\"></span>\n                                <span class=\"relative inline-flex rounded-full h-2 w-2 bg-blue-500\"></span>\n                            </span>\n                        </h4>\n                        \n                        <div id=\"cortex-terminal\" class=\"flex-grow font-mono text-[10px] text-slate-600 space-y-2 overflow-y-auto no-scrollbar leading-relaxed z-10 bg-slate-50 p-3 rounded-xl border border-slate-100\">\n                            <div class=\"opacity-50\">> Initializing Cortex Engine v1.0...</div>\n                            <div class=\"opacity-50\">> Scanning ".concat(analysis.stats.totalItems, " data points...</div>\n                            <div class=\"opacity-50\">> Financial velocity calculated at ").concat(analysis.financials.burnRate.toFixed(2), "%</div>\n                            <div class=\"opacity-50\">> Crew fatigue analysis complete.</div>\n                            <div class=\"text-slate-800 mt-4 border-t border-slate-200 pt-2 font-bold\">> SYSTEM READY. WAITING FOR AI AUDIT...</div>\n                            <!-- AI Output targets here -->\n                        </div>\n\n                        <div class=\"mt-4 pt-0 z-10\">\n                             <button onclick=\"mBT.features.cortex.startLiveAuditor()\" class=\"w-full py-3 bg-slate-900 hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2\">\n                                ").concat(mBTAssets.zap, " Run AI Risk Assessment\n                             </button>\n                        </div>\n                    </div>");
            // --- Grid Container (With Mission Control Toolbar) ---
            var content = "\n                    <div class=\"flex flex-col h-[600px] max-h-[80vh] bg-slate-50 p-4\">\n                        <!-- Mission Control Toolbar -->\n                        <div class=\"flex justify-between items-center mb-4 shrink-0\">\n                            <h3 class=\"text-xs font-black uppercase tracking-widest text-slate-400\">Mission Control</h3>\n                            <div class=\"flex gap-2\">\n                                <button onclick=\"mBT.features.cortex.ui.openGlobalDashboard()\" class=\"flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white border border-slate-900 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-sm\">\n                                    Global View\n                                </button>\n                                <button onclick=\"mBT.features.ai.analyzeCurrentBudget()\" class=\"flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm\">\n                                    ".concat(mBTAssets.doctor, " Deep Scan\n                                </button>\n                                <button onclick=\"mBT.features.ai.openChat()\" class=\"flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-sm\">\n                                    ").concat(mBTAssets.chat, " Chat\n                                </button>\n                                <button onclick=\"showSettingsModal('ai')\" class=\"flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm\">\n                                    ").concat(mBTAssets.gear, "\n                                </button>\n                            </div>\n                        </div>\n\n                        <div class=\"grid grid-cols-1 md:grid-cols-12 gap-4 flex-grow overflow-hidden min-h-0\">\n                            ").concat(burnWidget, "\n                            ").concat(financialsWidget, "\n                            ").concat(crewWidget, "\n                            ").concat(auditorWidget, "\n                        </div>\n                    </div>");
            mBTME.open('analyticsHub', 'Cortex Dashboard', content, 'max-w-5xl', { noPadding: true, hideHeader: true });
            // Manually inject close button since header is hidden
            var closeBtn = "<button onclick=\"mBTME.close('analyticsHubModal')\" class=\"absolute top-4 right-4 z-50 p-2 bg-white rounded-full text-slate-400 hover:text-rose-500 shadow-sm transition-all hover:rotate-90\">".concat(mBTAssets.close, "</button>");
            var body = document.getElementById('analyticsHubModalBody');
            if (body)
                body.insertAdjacentHTML('beforeend', closeBtn);
        },
        openGlobalDashboard: function () {
            return __awaiter(this, void 0, void 0, function () {
                var data, fmt_1, kpiCard, crewList, projectList, content, e_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            mBTME.showLoader("Scanning Studio Archives...");
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, mBT.features.cortex.logic.runGlobalAudit()];
                        case 2:
                            data = _a.sent();
                            mBTME.hideLoader();
                            fmt_1 = mBTLE.format.currency;
                            kpiCard = function (label, val, sub, color) { return "\n                        <div class=\"bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center text-center\">\n                            <div class=\"text-[9px] font-black uppercase text-slate-300 mb-2 tracking-widest\">".concat(label, "</div>\n                            <span class=\"text-2xl font-black ").concat(color, " tracking-tighter\">").concat(val, "</span>\n                            <span class=\"text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-wider\">").concat(sub, "</span>\n                        </div>"); };
                            crewList = data.topCrew.map(function (c, i) { return "\n                        <div class=\"flex justify-between items-center p-2 border-b border-slate-50 last:border-0\">\n                            <div class=\"flex items-center gap-3\">\n                                <div class=\"w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-black\">".concat(i + 1, "</div>\n                                <span class=\"text-[10px] font-bold text-slate-700 uppercase\">").concat(RenderEngine.esc(c.name), "</span>\n                            </div>\n                            <span class=\"text-[10px] font-mono font-bold text-emerald-600\">").concat(fmt_1(c.amount), "</span>\n                        </div>\n                    "); }).join('');
                            projectList = data.projectSummaries.map(function (p) { return "\n                        <div class=\"flex justify-between items-center p-3 bg-slate-50 rounded-xl mb-2 border border-transparent hover:border-blue-200 transition-colors cursor-pointer\" onclick=\"mBT.data.load('".concat(p.name, "'); mBTME.close('analyticsHubModal');\">\n                            <div>\n                                <div class=\"text-[10px] font-black text-slate-800 uppercase\">").concat(RenderEngine.esc(p.name), "</div>\n                                <div class=\"text-[8px] text-slate-400 font-bold\">").concat(p.date || 'No Date', "</div>\n                            </div>\n                            <div class=\"text-right\">\n                                <div class=\"text-[10px] font-mono font-bold text-slate-600\">").concat(fmt_1(p.actual), " / ").concat(fmt_1(p.budget), "</div>\n                                <div class=\"text-[8px] font-black uppercase tracking-widest ").concat(p.status === 'Over' ? 'text-rose-500' : 'text-emerald-500', "\">").concat(p.status, "</div>\n                            </div>\n                        </div>\n                    "); }).join('');
                            content = "\n                        <div class=\"flex flex-col h-[600px] max-h-[80vh] bg-slate-50 p-6 overflow-hidden\">\n                            <div class=\"flex justify-between items-center mb-6 shrink-0\">\n                                <div>\n                                    <h3 class=\"text-lg font-black uppercase tracking-tighter text-slate-900\">Global Studio Audit</h3>\n                                    <p class=\"text-[10px] font-bold text-slate-400 uppercase tracking-widest\">Aggregate Analysis across ".concat(data.projectCount, " Projects</p>\n                                </div>\n                                <button onclick=\"mBT.features.cortex.ui.openHub()\" class=\"text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 text-[9px] font-black uppercase tracking-widest\">\n                                    \u2190 Back to Project\n                                </button>\n                            </div>\n\n                            <div class=\"grid grid-cols-3 gap-4 mb-6 shrink-0\">\n                                ").concat(kpiCard('Total Spend (Actual)', fmt_1(data.totalSpend), 'Across All Projects', 'text-slate-800'), "\n                                ").concat(kpiCard('Total Budget (Est)', fmt_1(data.totalBudget), 'Lifetime Projection', 'text-blue-600'), "\n                                ").concat(kpiCard('Project Volume', data.projectCount, 'Active Files', 'text-indigo-500'), "\n                            </div>\n\n                            <div class=\"grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow min-h-0\">\n                                <div class=\"bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden\">\n                                    <h4 class=\"text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-2\">Top Earners (Crew)</h4>\n                                    <div class=\"overflow-y-auto no-scrollbar space-y-1\">\n                                        ").concat(crewList || '<div class="text-center text-slate-300 text-[10px] mt-10">No crew data found.</div>', "\n                                    </div>\n                                </div>\n                                <div class=\"bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden\">\n                                    <h4 class=\"text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-2\">Recent Projects</h4>\n                                    <div class=\"overflow-y-auto no-scrollbar\">\n                                        ").concat(projectList, "\n                                    </div>\n                                </div>\n                            </div>\n                        </div>");
                            mBTME.open('analyticsHub', 'Global Dashboard', content, 'max-w-5xl', { noPadding: true, hideHeader: true });
                            return [3 /*break*/, 4];
                        case 3:
                            e_8 = _a.sent();
                            mBTME.hideLoader();
                            mBTME.alert("Audit Failed", "Could not scan local database.");
                            console.error(e_8);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        },
        // Phase 3: Active AI Auditor Wiring
        startAuditor: function () {
            return __awaiter(this, void 0, void 0, function () {
                var term, provider, apiKey, analysis, context, prompt, response, streamEl_1, lines, delay_1, err_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            term = document.getElementById('cortex-terminal');
                            if (!term)
                                return [2 /*return*/];
                            // 1. UI Feedback
                            term.innerHTML += "<div class=\"mt-4 text-blue-500 animate-pulse\">> ESTABLISHING SECURE CONNECTION...</div>";
                            term.scrollTop = term.scrollHeight;
                            provider = mBT.features.ai.getSelectedProvider();
                            apiKey = mBT.features.ai.getStoredApiKey(provider);
                            if (!apiKey) {
                                term.innerHTML += "<div class=\"mt-2 text-rose-500 font-bold\">> ERROR: NO API KEY DETECTED. CONFIGURE SETTINGS.</div>";
                                term.scrollTop = term.scrollHeight;
                                return [2 /*return*/];
                            }
                            analysis = mBT.features.cortex.logic.analyze();
                            context = {
                                burnRate: analysis.financials.burnRate.toFixed(1) + '%',
                                topCosts: analysis.financials.topCosts.map(function (i) { return "".concat(i.description, ": ").concat(mBTLE.format.currency(i.est)); }),
                                varianceBleeders: analysis.financials.bleeders.map(function (i) { return "".concat(i.description, " (Over by ").concat(mBTLE.format.currency(i.variance), ")"); }),
                                overworkedCrew: analysis.crew.burnout.filter(function (c) { return c.days > 6; }).map(function (c) { return "".concat(c.name, " (").concat(c.days, " days)"); }),
                                totalItems: analysis.stats.totalItems
                            };
                            prompt = "ACT AS A HOSTILE COMPLETION GUARANTOR. \n                 DATA: ".concat(JSON.stringify(context), ". \n                 TASK: Issue 3 short, brutal directives to reduce risk. \n                 FORMAT: Plain text, no markdown formatting (no bold/italic), typewriter style. Start lines with \"> \"");
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, mBT.features.ai.callUnifiedAI(provider, apiKey, prompt)];
                        case 2:
                            response = _a.sent();
                            // 5. Typewriter Effect Render
                            term.innerHTML += "<div class=\"mt-4 text-slate-900 border-t border-slate-200 pt-2 font-bold\">> INCOMING TRANSMISSION:</div><div class=\"mt-2 text-blue-600 space-y-2\" id=\"cortex-stream\"></div>";
                            streamEl_1 = document.getElementById('cortex-stream');
                            lines = response.split('\n').filter(function (l) { return l.trim(); });
                            delay_1 = 0;
                            lines.forEach(function (line, i) {
                                setTimeout(function () {
                                    // clean markdown bold
                                    var cleanLine = line.replace(/\*\*/g, '').replace(/\*/g, '').trim();
                                    streamEl_1.innerHTML += "<div class=\"mb-1 font-mono text-[10px]\">".concat(mBT.ui.render.esc(cleanLine), "</div>");
                                    term.scrollTop = term.scrollHeight;
                                }, delay_1);
                                delay_1 += 800; // Slow typewriter pace
                            });
                            return [3 /*break*/, 4];
                        case 3:
                            err_2 = _a.sent();
                            term.innerHTML += "<div class=\"mt-2 text-rose-500\">> CONNECTION FAILURE: ".concat(mBT.ui.render.esc(err_2.message), "</div>");
                            term.scrollTop = term.scrollHeight;
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        }
    },
    // --- Public Accessor ---
    startLiveAuditor: function () { this.ui.startAuditor(); }
};
// Core Action
mBT.core.action('analytics-hub', function () { return mBT.features.cortex.ui.openHub(); });
// Global Alias Overrides (Replacing the old AI menu with the new Dashboard)
window.openAnalyticsHub = function () { return mBT.features.cortex.ui.openHub(); };
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
            var keywords = mBT.features.stages.definitions[stageKey] || [];
            var matches = [];
            if (!budget || !budget.sections)
                return [];
            Object.entries(budget.sections).forEach(function (_a) {
                var secName = _a[0], sec = _a[1];
                sec.items.forEach(function (item) {
                    // Skip if already in this stage
                    if (item.stageData && item.stageData[stageKey])
                        return;
                    var text = (item.description + ' ' + secName).toLowerCase();
                    if (keywords.some(function (w) { return text.includes(w); })) {
                        matches.push(item);
                    }
                });
            });
            return matches;
        },
        // Strategy B: Find items in DB that are missing from budget entirely
        findMissingEssentials: function (stageKey) {
            var keywords = mBT.features.stages.definitions[stageKey] || [];
            var db = mBTOG.rates || [];
            var existingDesc = new Set();
            if (budget && budget.sections) {
                Object.values(budget.sections).forEach(function (s) { return s.items.forEach(function (i) { return existingDesc.add(i.description.toLowerCase()); }); });
            }
            return db.filter(function (dbItem) {
                var text = dbItem.description.toLowerCase();
                var isRelevant = keywords.some(function (w) { return text.includes(w); });
                var exists = existingDesc.has(text);
                return isRelevant && !exists;
            });
        },
        // Logic Resolution: Smart removal logic linked to UI button
        removeItem: function (btn) {
            var itemId = btn.dataset.id;
            var sectionName = btn.dataset.section;
            var stageKey = btn.dataset.stage;
            var item = null;
            // Try fast lookup
            if (sectionName && budget.sections[sectionName]) {
                item = budget.sections[sectionName].items.find(function (i) { return String(i.id) === String(itemId); });
            }
            // Fallback scan
            if (!item) {
                Object.values(budget.sections).forEach(function (sec) {
                    if (!item)
                        item = sec.items.find(function (i) { return String(i.id) === String(itemId); });
                });
            }
            if (item) {
                // Enhanced Confirmation with item name
                mBTME.confirm("Remove from Stage", "Remove \"".concat(item.description, "\" from this stage? The main budget item will remain."), function () {
                    if (item.stageData && item.stageData[stageKey]) {
                        delete item.stageData[stageKey];
                        saveBudget();
                        if (typeof mBTLE !== 'undefined')
                            mBTLE.reconcile();
                        if (window.showStagesModal)
                            window.showStagesModal();
                    }
                });
            }
        }
    },
    ui: {
        openAutoFillMenu: function (stageKey) {
            var matches = mBT.features.stages.logic.findMatchesInBudget(stageKey);
            var missing = mBT.features.stages.logic.findMissingEssentials(stageKey);
            var stageLabel = (budget.targetLock && budget.targetLock.stages[stageKey]) ? budget.targetLock.stages[stageKey].label : stageKey.toUpperCase();
            var content = "\n                <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 p-4\">\n                    <!-- Option A: Link Existing -->\n                    <div class=\"bg-blue-50 border border-blue-100 p-5 rounded-2xl flex flex-col justify-between h-full group hover:border-blue-200 transition-colors\">\n                        <div>\n                            <div class=\"flex items-center gap-2 mb-2\">\n                                <div class=\"w-8 h-8 rounded-lg bg-blue-200 text-blue-700 flex items-center justify-center shadow-sm\">".concat(mBTAssets.clip, "</div>\n                                <h4 class=\"font-black text-[10px] uppercase tracking-widest text-blue-800\">Link Existing</h4>\n                            </div>\n                            <p class=\"text-[10px] text-blue-600/80 leading-relaxed mb-4\">\n                                Scan your current budget line items. We found <strong>").concat(matches.length, "</strong> items that match this stage's criteria but haven't been assigned yet.\n                            </p>\n                        </div>\n                        <button onclick=\"window.handleStageAutoFill('").concat(stageKey, "', 'link'); mBTME.close('autoFillModal');\" class=\"w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2\" ").concat(matches.length === 0 ? 'disabled style="opacity:0.5"' : '', ">\n                            Sync ").concat(matches.length, " Items\n                        </button>\n                    </div>\n\n                    <!-- Option B: Generate Missing -->\n                    <div class=\"bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex flex-col justify-between h-full group hover:border-emerald-200 transition-colors\">\n                        <div>\n                            <div class=\"flex items-center gap-2 mb-2\">\n                                <div class=\"w-8 h-8 rounded-lg bg-emerald-200 text-emerald-700 flex items-center justify-center shadow-sm\">").concat(mBTAssets.wand, "</div>\n                                <h4 class=\"font-black text-[10px] uppercase tracking-widest text-emerald-800\">Generate Missing</h4>\n                            </div>\n                            <p class=\"text-[10px] text-emerald-600/80 leading-relaxed mb-4\">\n                                Database check complete. We found <strong>").concat(missing.length, "</strong> standard industry roles/items for this stage that are completely missing from your budget.\n                            </p>\n                        </div>\n                        <button onclick=\"window.handleStageAutoFill('").concat(stageKey, "', 'generate'); mBTME.close('autoFillModal');\" class=\"w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2\" ").concat(missing.length === 0 ? 'disabled style="opacity:0.5"' : '', ">\n                            ").concat(mBTAssets.plus, " Add ").concat(missing.length, " Items\n                        </button>\n                    </div>\n                </div>\n                <div class=\"px-4 pb-4 text-center\">\n                    <p class=\"text-[8px] font-bold text-slate-300 uppercase tracking-widest\">Changes are saved automatically upon execution</p>\n                </div>");
            mBTME.open('autoFill', "Smart Fill: ".concat(stageLabel), content, 'max-w-xl');
        }
    }
};
/* ========= v19.54 RECYCLE BIN (mBT.features.trash) ========= */
mBT.features.trash = {
    state: { activeTab: 'documents', selected: new Set() },
    icons: { folder: mBTAssets.folder, file: mBTAssets.file, trash: mBTAssets.trash, undo: mBTAssets.undo, check: mBTAssets.target },
    open: function (tab) {
        var _this = this;
        if (tab === void 0) { tab = 'documents'; }
        var currentTab = this.state.activeTab;
        // Logic Resolution: Clear selections only when switching context
        if (tab !== currentTab)
            this.state.selected.clear();
        this.state.activeTab = tab;
        var type = this.state.activeTab;
        var docTrash = budget.documentTrash || [];
        var projectTrash = JSON.parse(localStorage.getItem(trashKey) || '[]');
        var items = type === 'documents' ? docTrash : projectTrash;
        var selectedCount = this.state.selected.size;
        var hasItems = items.length > 0;
        // Tier 5 Update: Manual Tab Construction for Event Delegation
        var tabs = [
            { id: 'documents', label: 'Documents', count: docTrash.length },
            { id: 'projects', label: 'Projects', count: projectTrash.length }
        ];
        var tabHtml = "<div class=\"flex border-b border-slate-100 bg-slate-50/50 rounded-t-xl overflow-hidden select-none\">\n                ".concat(tabs.map(function (t) {
            var isActive = t.id === type;
            var activeClass = "bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm";
            var inactiveClass = "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50";
            return "<button data-action=\"nav-trash\" data-tab=\"".concat(t.id, "\" class=\"flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ").concat(isActive ? activeClass : inactiveClass, "\">\n                        ").concat(t.label, " <span class=\"opacity-50 ml-1\">(").concat(t.count, ")</span>\n                    </button>");
        }).join(''), "\n            </div>");
        // Logic Resolution: Dynamic Toolbar for Bulk Actions with Checkbox Logic
        var toolbarHtml = "\n                <div class=\"px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-20 shadow-sm\">\n                    <div class=\"flex items-center gap-2\">\n                        <input type=\"checkbox\" \n                               data-action=\"trash-toggle-all\"\n                               ".concat(hasItems && selectedCount === items.length ? 'checked' : '', " \n                               ").concat(!hasItems ? 'disabled' : '', "\n                               class=\"w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer\">\n                        <span class=\"text-[9px] font-black uppercase tracking-widest text-slate-400\">").concat(selectedCount, " Selected</span>\n                    </div>\n                    <div class=\"flex gap-2\">\n                        ").concat(selectedCount > 0 ? "\n                            <button data-action=\"trash-bulk\" data-type=\"restore\" class=\"px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-1\">".concat(this.icons.undo, " Restore</button>\n                            <button data-action=\"trash-bulk\" data-type=\"delete\" class=\"px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-1\">").concat(this.icons.trash, " Delete</button>\n                        ") : "\n                            <button data-action=\"trash-bulk\" data-type=\"empty\" class=\"px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all\" ".concat(!hasItems ? 'disabled style="opacity:0.5"' : '', ">Empty Bin</button>\n                        "), "\n                    </div>\n                </div>");
        var listHtml = '';
        if (!hasItems) {
            listHtml = RenderEngine.ui.emptyState({
                icon: this.icons.trash,
                message: 'Bin is Empty',
                subtext: type === 'documents' ? 'No deleted documents found' : 'No deleted projects found'
            });
        }
        else {
            listHtml = items.map(function (item) {
                var id = type === 'documents' ? item.id : item.projectName; // Projects use name as ID in trash
                var isSel = _this.state.selected.has(id);
                var label = type === 'documents' ? (item.label || item.name || 'Untitled') : (item.projectName || 'Untitled Project');
                var meta = type === 'documents' ? "Type: ".concat(item.type || 'Custom') : "Company: ".concat(item.company || 'Indie');
                return "\n                    <div class=\"flex items-center justify-between p-3 bg-white border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group cursor-pointer\" data-action=\"trash-toggle\" data-id=\"".concat(RenderEngine.esc(id), "\">\n                        <div class=\"flex items-center gap-3 overflow-hidden flex-grow\">\n                            <div class=\"flex-shrink-0\">\n                                <input type=\"checkbox\" ").concat(isSel ? 'checked' : '', " class=\"w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none\">\n                            </div>\n                            <div class=\"w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-blue-500 group-hover:shadow-sm transition-all text-lg shrink-0\">\n                                ").concat(type === 'documents' ? _this.icons.file : _this.icons.folder, "\n                            </div>\n                            <div class=\"overflow-hidden min-w-0\">\n                                <div class=\"text-[10px] font-black uppercase text-slate-700 truncate\">").concat(RenderEngine.esc(label), "</div>\n                                <div class=\"text-[9px] text-slate-400 font-bold truncate\">").concat(RenderEngine.esc(meta), "</div>\n                            </div>\n                        </div>\n                        <div class=\"flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0\">\n                            <button data-action=\"trash-single\" data-type=\"restore\" data-id=\"").concat(RenderEngine.esc(id), "\" class=\"p-2 text-slate-300 hover:text-emerald-500 transition-colors\" title=\"Restore\">").concat(_this.icons.undo, "</button>\n                            <button data-action=\"trash-single\" data-type=\"delete\" data-id=\"").concat(RenderEngine.esc(id), "\" class=\"p-2 text-slate-300 hover:text-rose-500 transition-colors\" title=\"Delete Forever\">").concat(_this.icons.trash, "</button>\n                        </div>\n                    </div>");
            }).join('');
        }
        // Logic Resolution: Persistent UI Updates (Prevents Flickering/Re-opening)
        var domId = 'trashModal';
        var existingModal = document.getElementById(domId);
        if (existingModal) {
            var nav = document.getElementById('trashTabNav');
            var tool = document.getElementById('trashToolbarArea');
            var list = document.getElementById('trashListArea');
            if (nav)
                nav.innerHTML = tabHtml;
            if (tool)
                tool.innerHTML = toolbarHtml;
            if (list)
                list.innerHTML = listHtml;
            return;
        }
        var content = "\n                <div class=\"flex flex-col h-[600px] max-h-[80vh]\">\n                    <div id=\"trashTabNav\">".concat(tabHtml, "</div>\n                    <div id=\"trashToolbarArea\">").concat(toolbarHtml, "</div>\n                    <div id=\"trashListArea\" class=\"flex-grow overflow-y-auto p-4 bg-slate-50 no-scrollbar space-y-2\">\n                        ").concat(listHtml, "\n                    </div>\n                </div>");
        mBTME.open('trash', 'Recycle Bin', content, 'max-w-lg', { noPadding: true, hideHeader: true });
    },
    // --- Selection Logic ---
    toggleItem: function (id) {
        if (this.state.selected.has(id))
            this.state.selected.delete(id);
        else
            this.state.selected.add(id);
        this.open(this.state.activeTab); // Re-render state
    },
    toggleAll: function (checked) {
        var _this = this;
        this.state.selected.clear();
        if (checked) {
            var list = this.state.activeTab === 'documents' ? (budget.documentTrash || []) : JSON.parse(localStorage.getItem(trashKey) || '[]');
            list.forEach(function (i) { return _this.state.selected.add(_this.state.activeTab === 'documents' ? i.id : i.projectName); });
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
        var _this = this;
        var isDoc = this.state.activeTab === 'documents';
        var count = this.state.selected.size;
        // Empty Bin Logic
        if (action === 'empty') {
            mBTME.confirm("Empty Bin", "Permanently delete ALL items in the ".concat(isDoc ? 'Documents' : 'Projects', " bin? This cannot be undone."), function () {
                if (isDoc)
                    budget.documentTrash = [];
                else
                    localStorage.setItem(trashKey, '[]');
                saveBudget();
                _this.open(_this.state.activeTab);
            });
            return;
        }
        if (count === 0)
            return;
        // Delete / Restore Logic
        if (action === 'delete') {
            mBTME.confirm("Delete Forever", "Permanently delete ".concat(count, " selected item(s)? This cannot be undone."), function () {
                if (isDoc) {
                    budget.documentTrash = budget.documentTrash.filter(function (d) { return !_this.state.selected.has(d.id); });
                    saveBudget();
                }
                else {
                    var list = JSON.parse(localStorage.getItem(trashKey) || '[]');
                    var filtered = list.filter(function (p) { return !_this.state.selected.has(p.projectName); });
                    localStorage.setItem(trashKey, JSON.stringify(filtered));
                }
                _this.state.selected.clear();
                _this.open(_this.state.activeTab);
            });
        }
        else if (action === 'restore') {
            mBTME.confirm("Restore Items", "Restore ".concat(count, " selected item(s)?"), function () {
                var _a;
                if (isDoc) {
                    var toRestore = budget.documentTrash.filter(function (d) { return _this.state.selected.has(d.id); });
                    budget.documentTrash = budget.documentTrash.filter(function (d) { return !_this.state.selected.has(d.id); });
                    if (!budget.documents)
                        budget.documents = [];
                    (_a = budget.documents).push.apply(_a, toRestore);
                    saveBudget();
                    render(); // Refresh main view to show restored docs
                }
                else {
                    var list = JSON.parse(localStorage.getItem(trashKey) || '[]');
                    var keptTrash_1 = [];
                    list.forEach(function (p) {
                        if (_this.state.selected.has(p.projectName)) {
                            var key = storageKeyPrefix + p.projectName;
                            // Check collision
                            if (localStorage.getItem(key)) {
                                // Note: Simplified logic here for restoration collision to avoid nested confirms
                                localStorage.setItem(key, JSON.stringify(p));
                            }
                            else {
                                localStorage.setItem(key, JSON.stringify(p));
                            }
                        }
                        else {
                            keptTrash_1.push(p);
                        }
                    });
                    localStorage.setItem(trashKey, JSON.stringify(keptTrash_1));
                    if (typeof renderProjectManagement === 'function')
                        renderProjectManagement(); // Refresh project dropdown
                }
                _this.state.selected.clear();
                _this.open(_this.state.activeTab);
            });
        }
    },
    // --- External Hooks ---
    trashDocument: function (docId) {
        mBTME.confirm("Archive Document", "Move this document to the Recycle Bin?", function () {
            var idx = budget.documents.findIndex(function (d) { return d.id === docId; });
            if (idx > -1) {
                var doc = budget.documents.splice(idx, 1)[0];
                if (!budget.documentTrash)
                    budget.documentTrash = [];
                budget.documentTrash.push(doc);
                saveBudget();
                render(); // Update Vault UI if open
                if (document.getElementById('documentsModal'))
                    showDocumentsModal();
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
            var globalContacts = mBTOG.contacts || [];
            var assignedContacts_1 = [];
            Object.values(budget.sections || {}).forEach(function (sec) {
                sec.items.forEach(function (item) {
                    if (item.crew && item.crew.name) {
                        assignedContacts_1.push({
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
            var allContacts_1 = __spreadArray([], globalContacts, true);
            assignedContacts_1.forEach(function (ac) {
                if (!allContacts_1.some(function (gc) { return gc.name.toLowerCase() === ac.name.toLowerCase(); })) {
                    allContacts_1.push(ac);
                }
            });
            var listContent = allContacts_1.length > 0 ? allContacts_1.map(function (c) { return RenderEngine.ui.listRow({
                id: c.id,
                icon: c.name ? c.name.charAt(0).toUpperCase() : '?',
                title: c.name,
                subtitle: "".concat(c.role || 'No Role').concat(c.assigned ? ' (Assigned)' : ''),
                onClick: "openCrewProfile(this, event, '".concat(c.id, "', null)"),
                actions: c.assigned ? [] : [{
                        icon: mBTAssets.trash,
                        title: 'Delete',
                        color: 'rose',
                        onClick: "mBT.features.settings.deleteContact('".concat(c.id, "')")
                    }]
            }); }).join('') : RenderEngine.ui.emptyState({ icon: mBTAssets.user, message: 'No Contacts Found' });
            return "\n                    <div class=\"flex flex-col h-full bg-white overflow-hidden rounded-xl border border-slate-100 shadow-sm\">\n                        <div class=\"p-3 bg-indigo-50 border-b border-indigo-100 flex flex-col gap-3 shrink-0 z-10\">\n                            <div class=\"flex justify-center gap-3 flex-wrap\">\n                                <button onclick=\"mBT.features.settings.openAddContactModal()\" class=\"bg-indigo-200 text-indigo-800 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-300 transition-all flex items-center gap-1.5\">\n                                    ".concat(mBTAssets.plus, " Add\n                                </button>\n                                <input type=\"file\" id=\"csvImportInput\" class=\"hidden\" accept=\".csv\" onchange=\"importContactsCSV(this)\">\n                                <button onclick=\"document.getElementById('csvImportInput').click()\" class=\"bg-indigo-200 text-indigo-800 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-300 transition-all flex items-center gap-1.5\">\n                                    ").concat(mBTAssets.plus, " Import CSV\n                                </button>\n                                <button onclick=\"mBTAssign.assignFromContacts()\" class=\"bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all\">\n                                    Auto-Assign\n                                </button>\n                            </div>\n                            <div class=\"relative\">\n                                <input type=\"text\" id=\"contactsSearchInput\" placeholder=\"SEARCH PERSONNEL...\" class=\"w-full p-2.5 pr-10 bg-white border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-300 transition-all\">\n                                <div class=\"absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none\">").concat(mBTAssets.search, "</div>\n                            </div>\n                        </div>\n                        <div id=\"contactsListBody\" class=\"flex-grow overflow-y-auto no-scrollbar relative bg-white\">\n                            ").concat(listContent, "\n                        </div>\n                    </div>");
        }
        if (subTab === 'lineItems') {
            var isSharing = mBTOG.settings.optInSharing;
            return "\n                    <div class=\"flex flex-col h-full bg-white overflow-hidden rounded-xl border border-slate-100 shadow-sm\">\n                        <div class=\"p-3 bg-slate-50 border-b border-slate-100 shrink-0 z-10 space-y-3\">\n                            <div class=\"flex gap-2\">\n                                <button onclick=\"mBT.features.settings.openAddRateModal()\" class=\"flex-1 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm flex items-center justify-center gap-2\">\n                                    ".concat(mBTAssets.plus, " Add Line Item\n                                </button>\n                                <button onclick=\"mBT.features.settings.toggleOpenGateSharing()\" class=\"flex-1 py-2 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 ").concat(isSharing ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600', "\">\n                                    ").concat(mBTAssets.cloud, " ").concat(isSharing ? 'Sharing On' : 'Share Data', "\n                                </button>\n                            </div>\n                            <div class=\"relative\">\n                                <input type=\"text\" id=\"dbSearchInput\" placeholder=\"SEARCH GLOBAL RATES...\" class=\"w-full p-2.5 pr-10 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-100 transition-all\">\n                                <div class=\"absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none\">").concat(mBTAssets.search, "</div>\n                            </div>\n                        </div>\n                        <div id=\"dbListBody\" class=\"flex-grow overflow-y-auto no-scrollbar relative min-h-0 bg-white\">\n                            ").concat(mBTOG.rates.map(function (r) { return RenderEngine.ui.listRow({
                id: r.id || r.description,
                icon: mBTAssets.money,
                title: r.description,
                subtitle: "".concat(mBTLE.format.currency(r.rate), " / ").concat(r.unit),
                classes: 'border-b border-slate-50'
            }); }).join(''), "\n                        </div>\n                    </div>");
        }
        if (subTab === 'templates') {
            var templates = Array.isArray(mBTOG.templates) ? mBTOG.templates : [];
            var listContent = templates.length > 0 ? templates.map(function (t) { return RenderEngine.ui.listRow({
                id: t.id,
                icon: mBTAssets[t.icon] || mBTAssets.file,
                title: t.label,
                subtitle: t.cat || 'General',
                actions: [{
                        icon: mBTAssets.plus,
                        title: 'Use Template',
                        color: 'blue',
                        onClick: "createNewDocumentFromTemplate('".concat(t.id, "')")
                    }]
            }); }).join('') : RenderEngine.ui.emptyState({ icon: mBTAssets.file, message: 'No Templates' });
            return "\n                    <div class=\"flex flex-col h-full bg-white overflow-hidden rounded-xl border border-slate-100 shadow-sm\">\n                        <div class=\"p-3 bg-indigo-50 border-b border-indigo-100 shrink-0 z-10\">\n                             <div class=\"relative\">\n                                <input type=\"text\" id=\"templateSearchInput\" placeholder=\"SEARCH TEMPLATES...\" class=\"w-full p-2.5 pr-10 bg-white border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-300 transition-all\">\n                                <div class=\"absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none\">".concat(mBTAssets.search, "</div>\n                            </div>\n                        </div>\n                        <div id=\"templatesListBody\" class=\"flex-grow overflow-y-auto no-scrollbar relative bg-white\">\n                            ").concat(listContent, "\n                        </div>\n                    </div>");
        }
        return '';
    },
    // --- 2. Main Content Generator ---
    getTabContent: function (tabName, subTab) {
        var _a, _b, _c, _d, _e, _f;
        if (subTab === void 0) { subTab = 'lineItems'; }
        if (tabName === 'general') {
            var currentDateFormat = getProjectDateFormat();
            var currentSeparator = getProjectNameSeparator();
            var isCompact = ((_a = budget.settings) === null || _a === void 0 ? void 0 : _a.compactMode) || false;
            var syncAoD = ((_b = budget.settings) === null || _b === void 0 ? void 0 : _b.syncAoD) || false;
            // Logic Resolution: Prep for future legacy theme switch
            var isClassic = ((_c = budget.settings) === null || _c === void 0 ? void 0 : _c.classicTheme) || false;
            var allowZoom = ((_d = budget.settings) === null || _d === void 0 ? void 0 : _d.allowZoom) || false;
            return "\n                    <div class=\"h-full overflow-y-auto no-scrollbar p-6 space-y-6 animate-in fade-in duration-300\">\n                        <div class=\"bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center gap-3\">\n                            <div class=\"w-16 h-16 rounded-2xl shadow-lg border-2 border-slate-50 overflow-hidden bg-[#fdba35]\">".concat(mBTAssets.appLogo, "</div>\n                            <div>\n                                <h3 class=\"text-xs font-black uppercase tracking-widest text-slate-800\">moo Budget Tool</h3>\n                                <p class=\"text-[9px] text-slate-400 font-bold mt-1\">Build v").concat(APP_VERSION, " \u2022 ").concat(navigator.onLine ? '<span class="text-emerald-500">Online</span>' : '<span class="text-rose-500">Offline</span>', "</p>\n                            </div>\n                        </div>\n                        <div class=\"bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3\">\n                            <div class=\"grid grid-cols-2 gap-4\">\n                                <div>\n                                    <label class=\"block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5\">Date Format</label>\n                                    <select id=\"dateFormatSelect\" onchange=\"localStorage.setItem('").concat(projectDateFormatKey, "', this.value)\" class=\"w-full text-[10px] p-2 bg-slate-50 border-none rounded-lg font-bold outline-none cursor-pointer\">\n                                        <option value=\"YYYYMMDD\" ").concat(currentDateFormat === 'YYYYMMDD' ? 'selected' : '', ">YYYY-MM-DD</option>\n                                        <option value=\"MMDDYYYY\" ").concat(currentDateFormat === 'MMDDYYYY' ? 'selected' : '', ">MM-DD-YYYY</option>\n                                    </select>\n                                </div>\n                                <div>\n                                    <label class=\"block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5\">Separator</label>\n                                    <input type=\"text\" id=\"separatorInput\" maxlength=\"1\" value=\"").concat(currentSeparator, "\" onchange=\"localStorage.setItem('").concat(projectNameSeparatorKey, "', this.value)\" class=\"w-full text-[10px] p-2 bg-slate-50 border-none rounded-lg font-bold text-center outline-none\">\n                                </div>\n                            </div>\n                        </div>\n                        <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4\">\n                            <div class=\"bg-white p-4 rounded-2xl border border-slate-100 shadow-sm\">\n                                <div class=\"flex items-center justify-between\">\n                                    <div>\n                                        <h4 class=\"text-[10px] font-black uppercase tracking-widest text-slate-800\">Allow Page Zoom</h4>\n                                        <p class=\"text-[9px] text-slate-400 font-bold mt-0.5\">Enable pinch-to-zoom gestures</p>\n                                    </div>\n                                    <label class=\"relative inline-flex items-center cursor-pointer\">\n                                        <input type=\"checkbox\" id=\"zoomToggle\" ").concat(allowZoom ? 'checked' : '', " onchange=\"if(!budget.settings) budget.settings={}; budget.settings.allowZoom = this.checked; saveBudget(); mBT.ui.updateViewport();\" class=\"sr-only peer\">\n                                        <div class=\"w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600\"></div>\n                                    </label>\n                                </div>\n                            </div>\n                            <div class=\"bg-white p-4 rounded-2xl border border-slate-100 shadow-sm\">\n                                <div class=\"flex items-center justify-between\">\n                                    <div>\n                                        <h4 class=\"text-[10px] font-black uppercase tracking-widest text-slate-800\">Compact View</h4>\n                                        <p class=\"text-[9px] text-slate-400 font-bold mt-0.5\">Denser layout for small screens</p>\n                                    </div>\n                                    <label class=\"relative inline-flex items-center cursor-pointer\">\n                                        <input type=\"checkbox\" id=\"compactModeToggle\" ").concat(isCompact ? 'checked' : '', " onchange=\"if(!budget.settings) budget.settings={}; budget.settings.compactMode = this.checked; saveBudget(); render();\" class=\"sr-only peer\">\n                                        <div class=\"w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600\"></div>\n                                    </label>\n                                </div>\n                            </div>\n                            <!-- NEW: Classic Theme Placeholder -->\n                            <div class=\"bg-white p-4 rounded-2xl border border-slate-100 shadow-sm\">\n                                <div class=\"flex items-center justify-between\">\n                                    <div>\n                                        <h4 class=\"text-[10px] font-black uppercase tracking-widest text-slate-800\">Classic Theme</h4>\n                                        <p class=\"text-[9px] text-slate-400 font-bold mt-0.5\">Legacy visual style (Pre-v19.54)</p>\n                                    </div>\n                                    <label class=\"relative inline-flex items-center cursor-pointer\">\n                                        <input type=\"checkbox\" id=\"classicThemeToggle\" ").concat(isClassic ? 'checked' : '', " onchange=\"if(!budget.settings) budget.settings={}; budget.settings.classicTheme = this.checked; saveBudget(); render();\" class=\"sr-only peer\">\n                                        <div class=\"w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-600\"></div>\n                                    </label>\n                                </div>\n                            </div>\n                        </div>\n                        <div class=\"grid grid-cols-2 gap-3\">\n                             <a href=\"https://raw.githubusercontent.com/moollc/mooBudgetTool/refs/heads/main/mBT/index.html\" target=\"_blank\" download=\"moobudget-beta.html\" class=\"flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-colors\">").concat(mBTAssets.cloud, " Get Beta</a>\n                             <button onclick=\"hardResetApp()\" class=\"flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-100 transition-colors\">").concat(mBTAssets.zap, " Fix Bugs</button>\n                        </div>\n                        <div class=\"flex justify-center\">\n                             <button onclick=\"mBTME.close('settingsModal'); showCoffeeWidget();\" class=\"flex items-center gap-2 px-8 py-4 bg-[#FFDD00] text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform shadow-lg\">").concat(mBTAssets.coffee, " Support Development</button>\n                        </div>\n                    </div>");
        }
        if (tabName === 'ai' || tabName === 'connections') {
            var provider = getSelectedProvider();
            var saveHistory = (_f = (_e = budget.aiContext) === null || _e === void 0 ? void 0 : _e.saveHistory) !== null && _f !== void 0 ? _f : true;
            var storedPrompt = mBT.features.ai.getSystemPrompt();
            var webhookUrl = localStorage.getItem("".concat(storageKeyPrefix, "cloudWebhook")) || '';
            var keyLinks = {
                'gemini': 'https://aistudio.google.com/app/apikey',
                'openai': 'https://platform.openai.com/api-keys',
                'deepseek': 'https://platform.deepseek.com/api_keys',
                'grok': 'https://console.x.ai/'
            };
            return "\n                    <div class=\"h-full overflow-y-auto no-scrollbar p-6 space-y-6 animate-in fade-in duration-300\">\n                        \n                        <!-- Backend Cloud Bridge -->\n                        <div class=\"p-5 bg-slate-900 rounded-2xl border border-black shadow-lg text-white\">\n                            <div class=\"flex justify-between items-start mb-4\">\n                                <div>\n                                    <h3 class=\"text-[10px] font-black uppercase tracking-widest text-emerald-400\">Production Cloud</h3>\n                                    <p class=\"text-[9px] text-slate-500 font-bold mt-0.5\">Upstream Data Bridge</p>\n                                </div>\n                                <div class=\"text-slate-700\">".concat(mBTAssets.cloud, "</div>\n                            </div>\n                            <div>\n                                <label class=\"block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5\">Webhook Endpoint</label>\n                                <div class=\"flex gap-2\">\n                                    <input type=\"text\" id=\"cloudWebhookInput\" value=\"").concat(webhookUrl, "\" onchange=\"localStorage.setItem('").concat(storageKeyPrefix, "cloudWebhook', this.value)\" class=\"w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder-slate-600\" placeholder=\"https://api.studio.com/ingest...\">\n                                    <button onclick=\"const url=document.getElementById('cloudWebhookInput').value; if(!url) return mBTME.alert('Error', 'No URL'); mBTME.showLoader('Pinging...'); fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({test:true, source:'MooBudget', project:budget.projectName, ts:new Date().toISOString()})}).then(r=>{ mBTME.hideLoader(); if(r.ok) mBTME.alert('Success','Endpoint Reachable'); else mBTME.alert('Error', 'Status: '+r.status); }).catch(e=>{ mBTME.hideLoader(); mBTME.alert('Connection Failed', e.message); })\" class=\"px-3 bg-emerald-900/50 text-emerald-400 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-900 border border-emerald-800 transition-colors\">Test</button>\n                                </div>\n                                <p class=\"text-[8px] text-slate-600 mt-2 leading-relaxed\">Destination for \"Cloud Dispatch\". Accepts JSON payloads containing Ledger and Budget totals.</p>\n                            </div>\n                        </div>\n\n                        <!-- AI Configuration -->\n                        <div class=\"p-5 bg-slate-900 rounded-2xl border border-black shadow-lg text-white\">\n                            <div class=\"flex justify-between items-start mb-4\">\n                                <div>\n                                    <h3 class=\"text-[10px] font-black uppercase tracking-widest text-slate-400\">Intelligence</h3>\n                                    <p class=\"text-[9px] text-slate-500 font-bold mt-0.5\">Assistant Provider Access</p>\n                                </div>\n                                <div class=\"text-slate-700\">").concat(mBTAssets.sparkle, "</div>\n                            </div>\n                            <div class=\"space-y-3\">\n                                <div>\n                                    <label class=\"block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5\">Active Provider</label>\n                                    <select id=\"aiProviderSelect\" onchange=\"const link=document.getElementById('apiKeyLink'); const map=").concat(JSON.stringify(keyLinks).replace(/"/g, "'"), "; link.href=map[this.value];\" class=\"w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer\">\n                                        <option value=\"gemini\" ").concat(provider === 'gemini' ? 'selected' : '', ">Google Gemini API</option>\n                                        <option value=\"openai\" ").concat(provider === 'openai' ? 'selected' : '', ">OpenAI API</option>\n                                        <option value=\"deepseek\" ").concat(provider === 'deepseek' ? 'selected' : '', ">DeepSeek API</option>\n                                        <option value=\"grok\" ").concat(provider === 'grok' ? 'selected' : '', ">Grok (xAI) API</option>\n                                    </select>\n                                </div>\n                                <div>\n                                    <div class=\"flex justify-between items-center mb-1.5\">\n                                        <label class=\"block text-[8px] font-black text-slate-500 uppercase tracking-widest\">API Credentials</label>\n                                        <a id=\"apiKeyLink\" href=\"").concat(keyLinks[provider] || '#', "\" target=\"_blank\" class=\"text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 transition-colors\">\n                                            Get API Key <span>\u2192</span>\n                                        </a>\n                                    </div>\n                                    <input type=\"password\" id=\"apiKeyInput\" value=\"").concat(getStoredApiKey(provider), "\" class=\"w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-blue-500\" placeholder=\"sk-...\">\n                                </div>\n                                <div>\n                                    <label class=\"block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5\">Persona & Constraints</label>\n                                    <textarea id=\"aiSystemPromptInput\" class=\"w-full bg-slate-800 text-white border-none rounded-lg p-2.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-500 resize-none h-16 placeholder-slate-600\" placeholder=\"e.g. Be sarcastic. Focus only on Below The Line. Use JMD currency symbol.\">").concat(storedPrompt, "</textarea>\n                                </div>\n                                <div class=\"flex items-center gap-3 py-1\">\n                                    <div class=\"relative flex items-center\">\n                                        <input type=\"checkbox\" id=\"aiContextToggle\" ").concat(saveHistory ? 'checked' : '', " onchange=\"if(!budget.aiContext) budget.aiContext={chat:[], analysis:''}; budget.aiContext.saveHistory = this.checked; saveBudget();\" class=\"sr-only peer\">\n                                        <div class=\"w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500\"></div>\n                                    </div>\n                                    <label for=\"aiContextToggle\" class=\"text-[9px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer select-none\">Save Conversation Context</label>\n                                </div>\n                                <button id=\"saveApiKeyBtn\" onclick=\"const p=document.getElementById('aiProviderSelect').value; const k=document.getElementById('apiKeyInput').value; const s=document.getElementById('aiSystemPromptInput').value; saveStoredApiKey(p,k); mBT.features.ai.saveSystemPrompt(s); localStorage.setItem('").concat(storageKeyPrefix, "selectedAiProvider', p); mBTME.alert('Success', 'Settings Updated');\" class=\"w-full bg-blue-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg hover:bg-blue-500 transition-all mt-2\">Synchronize Link</button>\n                            </div>\n                        </div>\n                    </div>");
        }
        if (tabName === 'database') {
            var nav = RenderEngine.ui.tabs({
                items: [
                    { id: 'lineItems', label: 'Line Items' },
                    { id: 'contacts', label: 'Contacts' },
                    { id: 'templates', label: 'Templates' }
                ],
                activeId: subTab,
                dataAction: 'nav-settings-db'
            });
            return "<div class=\"flex flex-col h-full p-6 pb-0 overflow-hidden space-y-4\">\n                    ".concat(nav, " \n                    <div class=\"flex-grow flex flex-col relative overflow-hidden min-h-0\">\n                        ").concat(this.renderDbView(subTab), "\n                    </div>\n                </div>");
        }
        return "<div class=\"p-8 text-center text-slate-300 font-bold uppercase tracking-widest\">Logic Stream Not Found</div>";
    },
    // --- 3. Main Entry Point ---
    open: function (tab, subTab) {
        if (tab === void 0) { tab = 'general'; }
        if (subTab === void 0) { subTab = 'lineItems'; }
        var domId = 'settingsModal';
        var contentHTML = this.getTabContent(tab, subTab);
        // Tier 5 Update: Manual Tab Construction for Event Delegation
        var tabs = [
            { id: 'general', label: "General" },
            { id: 'database', label: "Database" },
            { id: 'ai', label: "Connections" }
        ];
        var tabNavHTML = "<div class=\"flex border-b border-slate-100 bg-slate-50/50 rounded-t-xl overflow-hidden select-none\">\n                ".concat(tabs.map(function (t) {
            var isActive = t.id === tab;
            var activeClass = "bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm";
            var inactiveClass = "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50";
            return "<button data-action=\"nav-settings\" data-tab=\"".concat(t.id, "\" class=\"flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ").concat(isActive ? activeClass : inactiveClass, "\">\n                        ").concat(t.label, "\n                    </button>");
        }).join(''), "\n            </div>");
        var existingModal = document.getElementById(domId);
        if (existingModal) {
            var contentArea = document.getElementById('settingsContentArea');
            var navArea = document.getElementById('settingsTabNav');
            if (contentArea)
                contentArea.innerHTML = contentHTML;
            if (navArea)
                navArea.innerHTML = tabNavHTML;
            this._attachListeners(tab, subTab);
            return;
        }
        var fullContent = "\n                <div class=\"flex flex-col min-h-[600px] max-h-[90vh] bg-slate-50/50\">\n                    <div id=\"settingsTabNav\" class=\"shrink-0 bg-white\">\n                        ".concat(tabNavHTML, "\n                    </div>\n                    <div id=\"settingsContentArea\" class=\"flex-grow flex flex-col relative overflow-hidden\">\n                        ").concat(contentHTML, "\n                    </div>\n                </div>");
        mBTME.open('settings', 'Settings', fullContent, 'max-w-2xl', { noPadding: true, hideHeader: true });
        this._attachListeners(tab, subTab);
    },
    // --- 4. Internal Logic & Listeners ---
    _attachListeners: function (tab, subTab) {
        if (tab === 'database' && subTab === 'lineItems') {
            mBTME.attachSearch('dbSearchInput', 'dbListBody', mBTOG.rates, function (r) { return RenderEngine.ui.listRow({
                id: r.id || r.description,
                icon: mBTAssets.money,
                title: r.description,
                subtitle: "".concat(mBTLE.format.currency(r.rate), " / ").concat(r.unit),
                classes: 'border-b border-slate-50'
            }); });
        }
        if (tab === 'database' && subTab === 'contacts') {
            var globalContacts = mBTOG.contacts || [];
            var assignedContacts_2 = [];
            Object.values(budget.sections || {}).forEach(function (sec) {
                sec.items.forEach(function (item) {
                    if (item.crew && item.crew.name)
                        assignedContacts_2.push({ id: 'assigned_' + item.id, name: item.crew.name, role: item.description || 'Crew', assigned: true });
                });
            });
            var allContacts_2 = __spreadArray([], globalContacts, true);
            assignedContacts_2.forEach(function (ac) { if (!allContacts_2.some(function (gc) { return gc.name.toLowerCase() === ac.name.toLowerCase(); }))
                allContacts_2.push(ac); });
            mBTME.attachSearch('contactsSearchInput', 'contactsListBody', allContacts_2, function (c) { return RenderEngine.ui.listRow({
                id: c.id,
                icon: c.name ? c.name.charAt(0).toUpperCase() : '?',
                title: c.name,
                subtitle: "".concat(c.role || 'No Role').concat(c.assigned ? ' (Assigned)' : ''),
                actions: c.assigned ? [] : [{ icon: mBTAssets.trash, title: 'Delete', color: 'rose', onClick: "mBT.features.settings.deleteContact('".concat(c.id, "')") }]
            }); });
        }
        if (tab === 'database' && subTab === 'templates') {
            mBTME.attachSearch('templateSearchInput', 'templatesListBody', mBTOG.templates, function (t) { return RenderEngine.ui.listRow({
                id: t.id,
                icon: mBTAssets[t.icon] || mBTAssets.file,
                title: t.label,
                subtitle: t.cat || 'General',
                actions: [{ icon: mBTAssets.plus, title: 'Use Template', color: 'blue', onClick: "createNewDocumentFromTemplate('".concat(t.id, "')") }]
            }); });
        }
    },
    // --- 5. Action Handlers ---
    openAddContactModal: function () {
        var dummyItem = { id: 'dummy_new_contact', crew: { name: '', phone: '', email: '' } };
        var dummySection = 'general';
        openCrewProfile(null, null, dummyItem.id, dummySection);
    },
    addContact: function (e) {
        // ... Logic moved here if invoked directly, but mostly handled by openCrewProfile form commit ...
    },
    deleteContact: function (id) {
        var _this = this;
        mBTME.confirm("Delete Contact", "Remove this global contact?", function () {
            var idx = mBTOG.contacts.findIndex(function (c) { return c.id === id; });
            if (idx > -1) {
                mBTOG.contacts.splice(idx, 1);
                localStorage.setItem('moo_contacts', JSON.stringify(mBTOG.contacts));
                _this.open('database', 'contacts'); // Refresh
            }
        });
    },
    // --- 6. Database Tools (Tier 5 Additions) ---
    openAddRateModal: function () {
        var content = "\n                <div class=\"space-y-4 p-2\">\n                    <div>\n                        <label class=\"block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5\">Description</label>\n                        <input type=\"text\" id=\"newRateDesc\" class=\"w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black uppercase tracking-tighter outline-none focus:ring-2 focus:ring-blue-100\" placeholder=\"ITEM NAME\">\n                    </div>\n                    <div class=\"grid grid-cols-2 gap-3\">\n                        <div>\n                            <label class=\"block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5\">Rate</label>\n                            <input type=\"number\" id=\"newRateVal\" class=\"w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-100\" placeholder=\"0.00\">\n                        </div>\n                        <div>\n                            <label class=\"block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5\">Unit</label>\n                            <select id=\"newRateUnit\" class=\"w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none cursor-pointer\">\n                                <option value=\"Day\">Day</option>\n                                <option value=\"Flat\">Flat</option>\n                                <option value=\"Week\">Week</option>\n                                <option value=\"Hour\">Hour</option>\n                            </select>\n                        </div>\n                    </div>\n                    <button onclick=\"mBT.features.settings.addRate()\" class=\"w-full py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-black transition-all active:scale-95 mt-4\">Add to Database</button>\n                </div>";
        mBTME.open('addRate', 'New Global Rate', content, 'max-w-sm');
    },
    addRate: function () {
        var desc = document.getElementById('newRateDesc').value.trim();
        var rate = parseFloat(document.getElementById('newRateVal').value) || 0;
        var unit = document.getElementById('newRateUnit').value;
        if (!desc)
            return mBTME.alert("Error", "Description required");
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
        if (!budget.ledger)
            budget.ledger = [];
        var ledger = budget.ledger.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
        var totalSpent = ledger.reduce(function (sum, tx) { return sum + (parseFloat(tx.amount) || 0); }, 0);
        var rows = ledger.length > 0 ? ledger.map(function (tx) {
            var hasDoc = tx.receipt ? 'text-blue-500 hover:text-blue-700 cursor-pointer' : 'text-slate-200';
            var docAction = tx.receipt ? "mBT.features.finance.viewReceipt('".concat(tx.receipt, "')") : '';
            return "\n                <tr class=\"border-b border-slate-50 hover:bg-slate-50 transition-colors\">\n                    <td class=\"p-3 text-[9px] font-bold text-slate-500\">".concat(tx.date, "</td>\n                    <td class=\"p-3\">\n                        <div class=\"text-[10px] font-black uppercase text-slate-700\">").concat(mBT.ui.render.esc(tx.payee), "</div>\n                        <div class=\"text-[8px] font-bold text-slate-400\">").concat(mBT.ui.render.esc(tx.description), "</div>\n                    </td>\n                    <td class=\"p-3 text-[9px] font-mono font-bold text-slate-500 uppercase text-center bg-slate-50/50\">").concat(tx.method || 'CASH', "</td>\n                    <td class=\"p-3 text-center\">\n                        <button onclick=\"").concat(docAction, "\" class=\"").concat(hasDoc, " transition-colors\" title=\"").concat(tx.receipt ? 'View Receipt' : 'No Receipt', "\">\n                            ").concat(mBTAssets.clip, "\n                        </button>\n                    </td>\n                    <td class=\"p-3 text-right font-mono font-black text-[10px] text-emerald-600\">").concat(mBTLE.format.currency(tx.amount), "</td>\n                </tr>");
        }).join('') : "<tr><td colspan=\"5\" class=\"p-8 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest\">No Transactions Recorded</td></tr>";
        var content = "\n                <div class=\"flex flex-col h-[600px] max-h-[80vh] bg-slate-50\">\n                    <div class=\"p-6 bg-white border-b border-slate-100 flex justify-between items-end shrink-0 z-10\">\n                        <div>\n                            <h3 class=\"text-lg font-black uppercase tracking-tighter text-slate-900\">General Ledger</h3>\n                            <p class=\"text-[10px] font-bold text-slate-400 uppercase tracking-widest\">Project Master Record</p>\n                        </div>\n                        <div class=\"text-right\">\n                            <div class=\"text-[9px] font-black uppercase tracking-widest text-slate-400\">Total Outflow</div>\n                            <div class=\"text-2xl font-black text-emerald-600 tracking-tighter leading-none\">".concat(mBTLE.format.currency(totalSpent), "</div>\n                        </div>\n                    </div>\n                    \n                    <div class=\"flex-grow overflow-auto no-scrollbar p-0 bg-white\">\n                        <table class=\"w-full text-left border-collapse\">\n                            <thead class=\"bg-slate-50 sticky top-0 z-10 border-b border-slate-100\">\n                                <tr>\n                                    <th class=\"p-3 text-[8px] font-black uppercase tracking-widest text-slate-400 w-24\">Date</th>\n                                    <th class=\"p-3 text-[8px] font-black uppercase tracking-widest text-slate-400\">Payee / Description</th>\n                                    <th class=\"p-3 text-[8px] font-black uppercase tracking-widest text-slate-400 text-center w-24\">Method</th>\n                                    <th class=\"p-3 text-[8px] font-black uppercase tracking-widest text-slate-400 text-center w-10\">Doc</th>\n                                    <th class=\"p-3 text-[8px] font-black uppercase tracking-widest text-slate-400 text-right w-24\">Amount</th>\n                                </tr>\n                            </thead>\n                            <tbody>").concat(rows, "</tbody>\n                        </table>\n                    </div>\n                    \n                    <div class=\"p-4 border-t border-slate-100 bg-white flex justify-end gap-2 shrink-0\">\n                        <button onclick=\"mBT.features.finance.showExportOptions()\" class=\"px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-lg flex items-center gap-2\">\n                            ").concat(mBTAssets.cloud, " Accounting Export\n                        </button>\n                    </div>\n                </div>");
        mBTME.open('ledger', 'Finance', content, 'max-w-2xl', { hideHeader: true, noPadding: true });
    },
    // --- 1.5 Receipt Viewer ---
    viewReceipt: function (blobKey) {
        return __awaiter(this, void 0, void 0, function () {
            var blobUrl, e_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, mBT.data.storage.loadBlob(blobKey)];
                    case 1:
                        blobUrl = _a.sent();
                        if (!blobUrl)
                            return [2 /*return*/, mBTME.alert("Error", "File not found.")];
                        mBTME.open('receiptView', 'Receipt Proof', "<div class=\"flex justify-center bg-slate-900 p-4 h-full\"><img src=\"".concat(blobUrl, "\" class=\"max-w-full max-h-[80vh] object-contain rounded shadow-lg\"></div>"), 'max-w-4xl', { noPadding: true });
                        return [3 /*break*/, 3];
                    case 2:
                        e_9 = _a.sent();
                        mBTME.alert("Error", "Could not load file.");
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    },
    // --- 2. Logic Engine (Controller) ---
    recordTransaction: function (data) {
        var _a;
        if (!budget.ledger)
            budget.ledger = [];
        var tx = __assign({ id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), ts: new Date().toISOString() }, data);
        budget.ledger.push(tx);
        if (data.itemId && data.sectionName) {
            var item = (_a = budget.sections[data.sectionName]) === null || _a === void 0 ? void 0 : _a.items.find(function (i) { return i.id === data.itemId; });
            if (item)
                item.actual = (parseFloat(item.actual) || 0) + parseFloat(data.amount);
        }
        if (data.payee) {
            var globalContact = mBTOG.contacts.find(function (c) { return c.name.toLowerCase() === data.payee.toLowerCase(); });
            if (globalContact) {
                if (!globalContact.payments)
                    globalContact.payments = [];
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
        if (mBT.data.state.audit)
            mBT.data.state.audit('PAYMENT', "".concat(data.payee, " (").concat(mBTLE.format.currency(data.amount), ")"), { section: 'Finance' });
        return tx;
    },
    // --- 3. UI Helpers ---
    openModal: function (itemId) {
        var _a;
        var item = null;
        var sectionName = null;
        Object.entries(budget.sections).forEach(function (_a) {
            var secName = _a[0], sec = _a[1];
            var found = sec.items.find(function (i) { return i.id === itemId; });
            if (found) {
                item = found;
                sectionName = secName;
            }
        });
        if (!item)
            return mBTME.alert("Error", "Line item not found.");
        var est = parseFloat(item.total) || 0;
        var act = parseFloat(item.actual) || 0;
        var balance = est - act;
        var contactName = ((_a = item.crew) === null || _a === void 0 ? void 0 : _a.name) || item.description;
        var content = mBT.ui.render.paymentModal(itemId, contactName, balance, displayCurrency);
        // Inject Hidden Context + File Input Container
        var wrapper = "\n                <div id=\"paymentContext\" data-section=\"".concat(sectionName, "\" data-item-desc=\"").concat(mBT.ui.render.esc(item.description), "\" data-payee=\"").concat(mBT.ui.render.esc(contactName), "\"></div>\n                <div id=\"paymentFormRoot\">").concat(content, "</div>\n            ");
        mBTME.open('payment', 'Issue Payment', wrapper, 'max-w-sm', { hideHeader: true, noPadding: true });
        setTimeout(function () {
            var formContainer = document.querySelector('#paymentFormRoot .space-y-4');
            if (formContainer) {
                var uploadHtml = "\n                        <div class=\"pt-2 border-t border-slate-100\">\n                            <label class=\"block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1\">Receipt / Invoice</label>\n                            <input type=\"file\" id=\"payReceipt\" accept=\"image/*,.pdf\" class=\"block w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all\">\n                        </div>";
                formContainer.insertAdjacentHTML('beforeend', uploadHtml);
            }
            var input = document.getElementById('payAmount');
            if (input)
                input.focus();
        }, 50);
    },
    processPayment: function (itemId) {
        return __awaiter(this, void 0, void 0, function () {
            var amount, method, date, fileInput, ctx, receiptKey, file, e_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        amount = parseFloat(document.getElementById('payAmount').value);
                        method = document.getElementById('payService').value;
                        date = document.getElementById('payDate').value;
                        fileInput = document.getElementById('payReceipt');
                        ctx = document.getElementById('paymentContext');
                        if (!amount || amount <= 0)
                            return [2 /*return*/, mBTME.alert("Error", "Valid amount required.")];
                        if (!ctx)
                            return [2 /*return*/, mBTME.alert("Error", "Context lost.")];
                        receiptKey = null;
                        if (!(fileInput && fileInput.files.length > 0)) return [3 /*break*/, 4];
                        file = fileInput.files[0];
                        if (file.size > 5 * 1024 * 1024)
                            return [2 /*return*/, mBTME.alert("Error", "File too large (Max 5MB).")];
                        receiptKey = "rcpt_".concat(Date.now());
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        mBTME.showLoader("Saving Receipt...");
                        return [4 /*yield*/, mBT.data.storage.saveBlob(receiptKey, file)];
                    case 2:
                        _a.sent();
                        mBTME.hideLoader();
                        return [3 /*break*/, 4];
                    case 3:
                        e_10 = _a.sent();
                        mBTME.hideLoader();
                        return [2 /*return*/, mBTME.alert("Error", "File save failed.")];
                    case 4:
                        this.recordTransaction({
                            itemId: itemId,
                            sectionName: ctx.dataset.section,
                            amount: amount,
                            date: date,
                            method: method,
                            receipt: receiptKey,
                            payee: ctx.dataset.payee,
                            description: ctx.dataset.itemDesc
                        });
                        mBTME.close('paymentModal');
                        mBTME.alert("Success", "Logged payment of ".concat(mBTLE.format.currency(amount)));
                        return [2 /*return*/];
                }
            });
        });
    },
    // --- 4. Export Suite (The Backend Bridge) ---
    showExportOptions: function () {
        var content = "\n                <div class=\"grid grid-cols-1 gap-4 p-6 bg-slate-50\">\n                    <button onclick=\"mBT.features.finance.runExport('excel')\" class=\"flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all group text-left\">\n                        <div class=\"w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform\">".concat(mBTAssets.grid, "</div>\n                        <div>\n                            <h4 class=\"font-black text-xs uppercase tracking-widest text-slate-800\">Excel / CSV Master</h4>\n                            <p class=\"text-[10px] text-slate-400 font-bold mt-1\">Full detail dump for Offline use</p>\n                        </div>\n                    </button>\n\n                    <button onclick=\"mBT.features.finance.runExport('wise')\" class=\"flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group text-left\">\n                        <div class=\"w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform\">").concat(mBTAssets.globe, "</div>\n                        <div>\n                            <h4 class=\"font-black text-xs uppercase tracking-widest text-slate-800\">Wise Batch Payment</h4>\n                            <p class=\"text-[10px] text-slate-400 font-bold mt-1\">Bulk upload file for TransferWise</p>\n                        </div>\n                    </button>\n\n                    <button onclick=\"mBT.features.finance.runExport('qb')\" class=\"flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all group text-left\">\n                        <div class=\"w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform\">").concat(mBTAssets.file, "</div>\n                        <div>\n                            <h4 class=\"font-black text-xs uppercase tracking-widest text-slate-800\">QuickBooks Online</h4>\n                            <p class=\"text-[10px] text-slate-400 font-bold mt-1\">Web Connect / Bank Feed Format</p>\n                        </div>\n                    </button>\n\n                    <div class=\"border-t border-slate-200 my-2\"></div>\n\n                    <button onclick=\"mBT.features.finance.runExport('api')\" class=\"flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all group text-left\">\n                        <div class=\"w-12 h-12 bg-emerald-900 text-emerald-400 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform\">").concat(mBTAssets.zap, "</div>\n                        <div>\n                            <h4 class=\"font-black text-xs uppercase tracking-widest text-white\">Cloud Dispatch</h4>\n                            <p class=\"text-[10px] text-slate-500 font-bold mt-1\">Push JSON to Webhook / Studio API</p>\n                        </div>\n                    </button>\n                </div>");
        mBTME.open('exportMenu', 'Accounting Bridge', content, 'max-w-sm', { noPadding: true });
    },
    runExport: function (type) {
        return __awaiter(this, void 0, void 0, function () {
            var content, filename, escape, storedUrl_1, headers, rows, headers, rows, headers, rows, blob;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                if (!((_a = budget.ledger) === null || _a === void 0 ? void 0 : _a.length))
                    return [2 /*return*/, mBTME.alert("Empty", "No transactions to export.")];
                content = "";
                filename = "".concat(budget.projectName, "_Export.csv");
                escape = function (val) { return "\"".concat(String(val || '').replace(/"/g, '""'), "\""); };
                // --- ONLINE ADD-ON: API Dispatch Logic ---
                if (type === 'api') {
                    if (!navigator.onLine)
                        return [2 /*return*/, mBTME.alert("Offline", "Cloud Dispatch requires an internet connection.")];
                    storedUrl_1 = localStorage.getItem("".concat(storageKeyPrefix, "cloudWebhook")) || "https://";
                    mBTME.prompt("Cloud Dispatch", "Confirm Endpoint URL:", storedUrl_1, function (url) { return __awaiter(_this, void 0, void 0, function () {
                        var response, e_11;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!url || url === "https://")
                                        return [2 /*return*/];
                                    // Auto-save the used URL for convenience if different
                                    if (url !== storedUrl_1)
                                        localStorage.setItem("".concat(storageKeyPrefix, "cloudWebhook"), url);
                                    mBTME.showLoader("Dispatching Ledger...");
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, fetch(url, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                project: budget.projectName,
                                                timestamp: new Date().toISOString(),
                                                ledger: budget.ledger,
                                                totals: { estimated: budget.grandTotal, actual: budget.actualTotal }
                                            })
                                        })];
                                case 2:
                                    response = _a.sent();
                                    mBTME.hideLoader();
                                    if (response.ok)
                                        mBTME.alert("Success", "Ledger synchronized with Cloud Endpoint.");
                                    else
                                        throw new Error("Server responded with ".concat(response.status));
                                    return [3 /*break*/, 4];
                                case 3:
                                    e_11 = _a.sent();
                                    mBTME.hideLoader();
                                    mBTME.alert("Dispatch Failed", e_11.message);
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [2 /*return*/];
                }
                // --- OFFLINE CORE: CSV Generation Logic ---
                if (type === 'excel') {
                    headers = ["Date", "Payee", "Description", "Method", "Amount", "Currency", "Transaction ID"];
                    rows = budget.ledger.map(function (t) { return [t.date, t.payee, t.description, t.method, t.amount, displayCurrency, t.id].map(escape).join(","); });
                    content = headers.join(",") + "\n" + rows.join("\n");
                    filename = "".concat(budget.projectName, "_MasterLedger.csv");
                }
                else if (type === 'wise') {
                    headers = ["sourceCurrency", "targetCurrency", "amount", "recipientName", "reference"];
                    rows = budget.ledger.map(function (t) { return [displayCurrency, displayCurrency, t.amount, t.payee, "".concat(budget.projectName, ": ").concat(t.description).substring(0, 30)].map(escape).join(","); });
                    content = headers.join(",") + "\n" + rows.join("\n");
                    filename = "".concat(budget.projectName, "_WiseBatch.csv");
                }
                else if (type === 'qb') {
                    headers = ["Date", "Description", "Amount", "Payee", "RefNumber"];
                    rows = budget.ledger.map(function (t) { return [t.date, t.description, "-".concat(t.amount), t.payee, t.id.split('_')[2]].map(escape).join(","); });
                    content = headers.join(",") + "\n" + rows.join("\n");
                    filename = "".concat(budget.projectName, "_QuickBooks.csv");
                }
                blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
                mBTPublisher.io.forceDownload(blob, filename);
                mBTME.close('exportMenuModal');
                return [2 /*return*/];
            });
        });
    }
};
/* --- v19.54 PUBLISH BRIDGE --- */
window.showPublishModal = function () {
    var content = "\n        <div class=\"grid grid-cols-1 gap-4 p-6\">\n            <!-- PDF Button -->\n            <button data-action=\"export\" data-type=\"pdf\" class=\"flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group text-left\">\n                <div class=\"w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform\">".concat(mBTAssets.print, "</div>\n                <div>\n                    <h4 class=\"font-black text-xs uppercase tracking-widest text-slate-800\">Export PDF (Report)</h4>\n                    <p class=\"text-[10px] text-slate-400 font-bold mt-1\">Professional Formatted Document</p>\n                </div>\n            </button>\n\n            <!-- Save Project (Bundle .moo) -->\n            <button data-action=\"export\" data-type=\"bundle\" class=\"flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all group text-left\">\n                <div class=\"w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform\">").concat(mBTAssets.save, "</div>\n                <div>\n                    <h4 class=\"font-black text-xs uppercase tracking-widest text-slate-800\">Master Project File</h4>\n                    <p class=\"text-[10px] text-slate-400 font-bold mt-1\">Unified Container (.moo) - Includes Assets</p>\n                </div>\n            </button>\n            \n            <!-- Digital/HTML -->\n           <button data-action=\"export\" data-type=\"html\" class=\"flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-purple-500 hover:shadow-lg transition-all group text-left\">\n                <div class=\"w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform\">").concat(mBTAssets.phone, "</div>\n                <div>\n                    <h4 class=\"font-black text-xs uppercase tracking-widest text-slate-800\">Digital Export</h4>\n                    <p class=\"text-[10px] text-slate-400 font-bold mt-1\">Interactive HTML Call Sheet</p>\n                </div>\n            </button>\n\n            <!-- Excel -->\n            <button data-action=\"export\" data-type=\"xlsx\" class=\"flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all group text-left\">\n                <div class=\"w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform\">").concat(mBTAssets.grid, "</div>\n                <div>\n                    <h4 class=\"font-black text-xs uppercase tracking-widest text-slate-800\">Excel Export</h4>\n                    <p class=\"text-[10px] text-slate-400 font-bold mt-1\">Spreadsheet (.xlsx)</p>\n                </div>\n            </button>\n        </div>");
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
        var tmpl = mBTOG.templates.find(function (t) { return t.id === templateId; });
        if (!tmpl)
            return mBTME.alert("Error", "Template definition not found.");
        var newDoc = {
            id: 'doc_' + Date.now(),
            type: tmpl.id,
            label: tmpl.label,
            content: {
                data: mBTDB._generateDefaultData(),
                widgets: [] // Populated by mBTDB.open based on type defaults
            }
        };
        if (!budget.documents)
            budget.documents = [];
        budget.documents.push(newDoc);
        saveBudget();
        mBTME.close('newDocSelectorModal');
        // Refresh Vault list if open
        if (document.getElementById('documentsModal'))
            this.openVault();
        // Logic Resolution: Intercept auto-open. Show options instead.
        this.showOptions(newDoc.id);
    },
    // Logic Resolution: Opens the Document Vault (List of saved docs)
    openVault: function (activeTab) {
        var _a;
        if (activeTab === void 0) { activeTab = 'All'; }
        var docs = budget.documents || [];
        // Helper: Resolve Template Metadata
        var getTmpl = function (type) { return mBTOG.templates.find(function (x) { return x.id === type; }) || { cat: 'Other', icon: 'file' }; };
        var getCat = function (type) { return getTmpl(type).cat; };
        var getIcon = function (type) { return mBTAssets[getTmpl(type).icon] || mBTAssets.file; };
        // Filter Logic
        var filteredDocs = activeTab === 'All'
            ? docs
            : docs.filter(function (d) { return getCat(d.type) === activeTab; });
        // Logic Resolution: View Layout Strategy linked to Settings
        var isCompact = ((_a = budget.settings) === null || _a === void 0 ? void 0 : _a.compactMode) || false;
        // 2. Define Layout Classes (Grid vs List)
        var listContainerClass = (isCompact && filteredDocs.length > 0)
            ? 'grid grid-cols-2 md:grid-cols-3 gap-4 content-start'
            : 'flex flex-col gap-3';
        // 3. Adjust Modal Width based on View
        var modalWidth = (isCompact && filteredDocs.length > 0) ? 'max-w-5xl' : 'max-w-2xl';
        // Logic Resolution: Dynamic Item Renderer (Grid Card vs List Row)
        var renderDocItem = function (doc) {
            var iconSvg = getIcon(doc.type);
            if (isCompact) {
                // Grid Card (Vertical Layout) - Tier 5 Event Delegation Update
                return "\n                    <div class=\"relative group bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center gap-3 text-center h-full\" data-action=\"doc-options\" data-id=\"".concat(doc.id, "\">\n                         <div class=\"w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors shrink-0\">\n                            ").concat(iconSvg, "\n                         </div>\n                         <div class=\"w-full overflow-hidden\">\n                            <div class=\"text-[10px] font-black uppercase text-slate-700 truncate w-full\" title=\"").concat(RenderEngine.esc(doc.label), "\">").concat(RenderEngine.esc(doc.label || 'Untitled'), "</div>\n                            <div class=\"text-[9px] text-slate-400 font-bold truncate w-full\">").concat(doc.type ? doc.type.toUpperCase() : 'DOC', "</div>\n                         </div>\n                         <div class=\"absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 rounded-lg shadow-sm p-1\">\n                            <button data-action=\"doc-duplicate\" data-id=\"").concat(doc.id, "\" class=\"p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-500 rounded\" title=\"Duplicate\">").concat(mBTAssets.copy, "</button>\n                            <button data-action=\"doc-archive\" data-id=\"").concat(doc.id, "\" class=\"p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded\" title=\"Archive\">").concat(mBTAssets.trash, "</button>\n                         </div>\n                    </div>");
            }
            else {
                // List Row (Horizontal Layout) - Tier 5 Event Delegation Update
                return "<div class=\"group bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between cursor-pointer\">\n                        <div class=\"flex items-center gap-4 flex-grow overflow-hidden\" data-action=\"doc-options\" data-id=\"".concat(doc.id, "\">\n                            <div class=\"w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform shrink-0\">\n                                ").concat(iconSvg, "\n                            </div>\n                            <div class=\"min-w-0\">\n                                <h4 class=\"font-black text-slate-900 text-xs uppercase tracking-tighter truncate\">").concat(mBT.ui.render.esc(doc.label || 'Untitled Document'), "</h4>\n                                <p class=\"text-[9px] text-blue-500 font-bold uppercase tracking-widest truncate\">").concat(doc.type ? doc.type.charAt(0).toUpperCase() + doc.type.slice(1) : 'Document', "</p>\n                            </div>\n                        </div>\n                        <div class=\"flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0\">\n                            <button data-action=\"doc-duplicate\" data-id=\"").concat(doc.id, "\" class=\"p-2 text-slate-300 hover:text-blue-600 transition-colors\" title=\"Duplicate\">").concat(mBTAssets.copy, "</button>\n                            <button data-action=\"doc-archive\" data-id=\"").concat(doc.id, "\" class=\"p-2 text-slate-300 hover:text-rose-600 transition-colors\" title=\"Archive\">").concat(mBTAssets.trash, "</button>\n                        </div>\n                    </div>");
            }
        };
        var docsHtml = filteredDocs.length > 0
            ? filteredDocs.map(renderDocItem).join('')
            : "<div class=\"col-span-full\">".concat(RenderEngine.ui.emptyState({
                icon: mBTAssets.file,
                message: activeTab === 'All' ? 'Vault is Empty' : 'No Documents',
                subtext: 'Create a new document to get started'
            }), "</div>");
        // Tab Navigation
        var categories = ['All', 'Pre-Prod', 'Production', 'Post-Prod', 'Legal'];
        // Tier 5 Update: Manual Tab Construction for Event Delegation
        var tabHtml = "<div class=\"flex border-b border-slate-100 bg-slate-50/50 rounded-t-xl overflow-hidden select-none\">\n                ".concat(categories.map(function (c) {
            var count = c === 'All' ? docs.length : docs.filter(function (d) { return getCat(d.type) === c; }).length;
            var isActive = c === activeTab;
            var activeClass = "bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm";
            var inactiveClass = "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50";
            return "<button data-action=\"nav-docs\" data-tab=\"".concat(c, "\" class=\"flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ").concat(isActive ? activeClass : inactiveClass, "\">\n                        ").concat(c, " <span class=\"opacity-50 ml-1\">(").concat(count, ")</span>\n                    </button>");
        }).join(''), "\n            </div>");
        // Logic Resolution: Persistent UI Updates (Prevents Flickering/Re-opening)
        var domId = 'documentsModal';
        var existingModal = document.getElementById(domId);
        if (existingModal) {
            var nav = document.getElementById('docsTabNav');
            var list = document.getElementById('activeDocsList');
            if (nav)
                nav.innerHTML = tabHtml;
            if (list) {
                list.className = listContainerClass;
                list.innerHTML = docsHtml;
            }
            var searchContainer = document.getElementById('docSearchContainer');
            if (searchContainer) {
                searchContainer.innerHTML = "<input type=\"text\" id=\"docSearch\" placeholder=\"SEARCH ".concat(activeTab.toUpperCase(), "...\" class=\"w-full p-3 pr-10 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-50 transition-all\"><div class=\"absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none\">").concat(mBTAssets.search, "</div>");
            }
            mBTME.attachSearch('docSearch', 'activeDocsList', filteredDocs, renderDocItem);
            return;
        }
        var content = "\n                <div class=\"flex flex-col max-h-[90vh]\">\n                    <div class=\"p-6 pb-0 bg-white border-b border-slate-100 flex-shrink-0 z-10 space-y-4\">\n                        <div class=\"flex justify-between items-center relative\">\n                            <!-- Left: Add Button -->\n                            <button onclick=\"mBT.features.documents.openTemplateSelector()\" class=\"px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-sm active:scale-95\">\n                                ".concat(mBTAssets.plus, " Add\n                            </button>\n                            \n                            <!-- Center: Title -->\n                            <h3 class=\"absolute left-1/2 -translate-x-1/2 font-black text-slate-900 text-xs uppercase tracking-widest\">DOCUMENTS</h3>\n                            \n                            <!-- Right: Actions -->\n                            <div class=\"flex gap-2\">\n                                <button onclick=\"mBT.features.trash.open('documents')\" class=\"p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all\" title=\"Recycle Bin\">").concat(mBTAssets.trash, "</button>\n                                <button onclick=\"mBTME.close('documentsModal')\" class=\"p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-all\">").concat(mBTAssets.close, "</button>\n                            </div>\n                        </div>\n                        \n                        <!-- Search -->\n                        <div class=\"relative\" id=\"docSearchContainer\">\n                            <input type=\"text\" id=\"docSearch\" placeholder=\"SEARCH DOCUMENTS...\" class=\"w-full p-3 pr-10 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-50 transition-all\">\n                            <div class=\"absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none\">").concat(mBTAssets.search, "</div>\n                        </div>\n\n                        <!-- Tab Nav -->\n                        <div id=\"docsTabNav\" class=\"-mb-px\">\n                            ").concat(tabHtml, "\n                        </div>\n                    </div>\n                    \n                    <div class=\"flex-grow overflow-y-auto no-scrollbar bg-slate-50/50 p-6\">\n                        <div id=\"activeDocsList\" class=\"").concat(listContainerClass, "\">\n                            ").concat(docsHtml, "\n                        </div>\n                    </div>\n                </div>");
        mBTME.open('documents', 'Documents', content, modalWidth, { noPadding: true, hideHeader: true });
        mBTME.attachSearch('docSearch', 'activeDocsList', filteredDocs, renderDocItem);
    },
    // Logic Resolution: Opens the Template Selector (Blueprints)
    openTemplateSelector: function () {
        var templates = mBTOG.templates || [];
        var renderTmplItem = function (tmpl) { return RenderEngine.ui.card({
            id: tmpl.id,
            icon: mBTAssets[tmpl.icon] || mBTAssets.file,
            title: tmpl.label,
            subtitle: tmpl.cat || 'General',
            onClick: "mBT.features.documents.createFromTemplate('".concat(tmpl.id, "')"),
            actions: [{ icon: mBTAssets.plus, title: 'Create', color: 'blue', onClick: "mBT.features.documents.createFromTemplate('".concat(tmpl.id, "')") }]
        }); };
        var templateHtml = templates.map(renderTmplItem).join('');
        // Logic Resolution: Custom Layout (White Theme) to eliminate black studio headers
        var content = "\n                <div class=\"flex flex-col max-h-[80vh] bg-slate-50\">\n                    <div class=\"p-4 bg-white border-b border-slate-100 flex-shrink-0 z-10 space-y-2\">\n                        <div class=\"flex justify-between items-center\">\n                            <h3 class=\"font-black text-slate-900 text-sm uppercase tracking-widest\">Select Template</h3>\n                            <button onclick=\"mBTME.close('newDocSelectorModal')\" class=\"p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-all\">".concat(mBTAssets.close, "</button>\n                        </div>\n                        <div class=\"relative\">\n                            <input type=\"text\" id=\"tmplSearch\" placeholder=\"FILTER TEMPLATES...\" class=\"w-full p-3 pr-10 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-50 transition-all\">\n                            <div class=\"absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none\">").concat(mBTAssets.search, "</div>\n                        </div>\n                    </div>\n                    <div id=\"templateListBody\" class=\"flex-grow overflow-y-auto no-scrollbar p-4 space-y-3\">\n                        ").concat(templateHtml, "\n                    </div>\n                </div>");
        mBTME.open('newDocSelector', 'Studio Blueprints', content, 'max-w-md', { noPadding: true, hideHeader: true });
        mBTME.attachSearch('tmplSearch', 'templateListBody', templates, renderTmplItem);
    },
    // Logic Resolution: Opens the Action Menu for choosing editor or storage
    showOptions: function (docId) {
        var doc = budget.documents.find(function (d) { return d.id === docId; });
        if (!doc)
            return;
        var attachments = doc.attachments || [];
        var hasFile = attachments.length > 0;
        // Helper: Render Attachment List
        var renderAttachmentList = function () {
            if (attachments.length === 0)
                return '<div class="text-center text-[10px] text-slate-400 font-bold p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 col-span-2">No files attached</div>';
            return attachments.map(function (file, idx) {
                var _a;
                var isImg = file.type && file.type.startsWith('image/');
                var src = (isImg && file.location !== 'internal') ? file.data : null;
                return RenderEngine.ui.mediaCard({
                    id: idx,
                    title: file.name,
                    type: ((_a = file.type.split('/')[1]) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'FILE',
                    size: file.size || 'N/A',
                    location: file.location || 'legacy',
                    src: src,
                    onClick: "mBT.features.documents.previewAttachment('".concat(docId, "', ").concat(idx, ")"),
                    actions: [
                        { icon: mBTAssets.print, title: 'Print', color: 'slate', onClick: "mBT.features.documents.printAttachment('".concat(docId, "', ").concat(idx, ")") },
                        { icon: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/></svg>", title: 'Download', color: 'blue', onClick: "mBT.features.documents.downloadAttachment('".concat(docId, "', ").concat(idx, ")") },
                        { icon: mBTAssets.trash, title: 'Remove', color: 'rose', onClick: "mBT.features.documents.removeAttachment('".concat(docId, "', ").concat(idx, ")") }
                    ]
                });
            }).join('');
        };
        var content = "\n                <div class=\"flex flex-col h-full bg-slate-50\">\n                    <div class=\"grid grid-cols-1 gap-4 p-6 shrink-0\">\n                        ".concat(!hasFile ? "\n                        <button onclick=\"mBTME.close('docOptionsModal'); mBTDB.open('".concat(docId, "');\" \n                            class=\"flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group text-left w-full\">\n                            <div class=\"w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform\">\n                                ").concat(mBTAssets.wand, "\n                            </div>\n                            <div>\n                                <h4 class=\"font-black text-xs uppercase tracking-widest text-slate-800\">Open Studio</h4>\n                                <p class=\"text-[10px] text-slate-400 font-bold mt-1\">Interactive Editor</p>\n                            </div>\n                        </button>") : '', "\n\n                        <div class=\"relative\">\n                            <button onclick=\"document.getElementById('docUpload_").concat(docId, "').click()\" \n                                class=\"flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all group text-left w-full\">\n                                <div class=\"w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform\">\n                                    ").concat(mBTAssets.cloud, "\n                                </div>\n                                <div>\n                                    <h4 class=\"font-black text-xs uppercase tracking-widest text-slate-800\">").concat(hasFile ? 'Replace Existing' : 'Upload Existing', "</h4>\n                                    <p class=\"text-[10px] text-slate-400 font-bold mt-1\">PDF, Word, Excel, Images</p>\n                                </div>\n                            </button>\n                            <input type=\"file\" id=\"docUpload_").concat(docId, "\" class=\"hidden\" accept=\".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*\" onchange=\"mBT.features.documents.handleFileUpload('").concat(docId, "', this)\">\n                        </div>\n                    </div>\n                    \n                    <div class=\"px-6 pb-2\">\n                        <h4 class=\"text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2 mb-3\">Attachments</h4>\n                    </div>\n                    <div class=\"flex-grow overflow-y-auto px-6 pb-6 no-scrollbar grid grid-cols-2 gap-3 content-start\" style=\"max-height: 200px;\">\n                        ").concat(renderAttachmentList(), "\n                    </div>\n                </div>");
        mBTME.open('docOptions', 'Document Actions', content, 'max-w-sm', { noPadding: true });
    },
    // Logic Resolution: Handles file attachments with proper format support
    handleFileUpload: function (docId, input) {
        return __awaiter(this, void 0, void 0, function () {
            var file, doc, blobKey, e_12, reader;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        file = input.files[0];
                        if (!file)
                            return [2 /*return*/];
                        // Stability Limit: 7MB (IndexedDB Support)
                        if (file.size > 7 * 1024 * 1024) {
                            mBTME.alert("File Too Large", "Please upload files smaller than 7MB to ensure offline storage stability.");
                            return [2 /*return*/];
                        }
                        doc = budget.documents.find(function (d) { return d.id === docId; });
                        if (!doc)
                            return [2 /*return*/];
                        if (!doc.attachments)
                            doc.attachments = [];
                        if (!(budget.storageProtocol === 'internal')) return [3 /*break*/, 5];
                        blobKey = "blob_".concat(docId, "_").concat(Date.now(), "_").concat(Math.floor(Math.random() * 1000));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, mBT.data.storage.saveBlob(blobKey, file)];
                    case 2:
                        _a.sent();
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
                        return [3 /*break*/, 4];
                    case 3:
                        e_12 = _a.sent();
                        console.error("Blob Storage Failed", e_12);
                        mBTME.alert("Upload Error", "Failed to store file internally.");
                        return [3 /*break*/, 4];
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        reader = new FileReader();
                        reader.onload = function (e) {
                            doc.attachments.push({
                                name: file.name,
                                type: file.type || 'application/octet-stream',
                                data: e.target.result,
                                ts: new Date().toISOString()
                            });
                            saveBudget();
                            // Instant Refresh (No blocking alert)
                            _this.showOptions(docId);
                        };
                        reader.readAsDataURL(file);
                        _a.label = 6;
                    case 6: return [2 /*return*/];
                }
            });
        });
    },
    // --- NEW: Binary Conversion Utility ---
    _base64ToBuffer: function (base64) {
        var binary_string = window.atob(base64.split(',')[1]);
        var len = binary_string.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    },
    // --- NEW: Universal Preview Engine ---
    previewAttachment: function (docId, index) {
        return __awaiter(this, void 0, void 0, function () {
            var doc, file, name, _a, buffer, response, url, blob, wb, sheetName, html;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        doc = budget.documents.find(function (d) { return d.id === docId; });
                        if (!doc || !doc.attachments || !doc.attachments[index])
                            return [2 /*return*/];
                        file = __assign({}, doc.attachments[index]);
                        name = file.name.toLowerCase();
                        if (!(file.location === 'internal' && file.key)) return [3 /*break*/, 2];
                        _a = file;
                        return [4 /*yield*/, mBT.data.storage.loadBlob(file.key)];
                    case 1:
                        _a.data = _b.sent();
                        _b.label = 2;
                    case 2:
                        // A. Images: Direct Render
                        if (file.type.includes('image')) {
                            mBTME.open('previewFile', file.name, "<div class=\"flex justify-center bg-slate-900 p-4\"><img src=\"".concat(file.data, "\" class=\"max-w-full h-auto rounded shadow-lg\"></div>"), 'max-w-4xl');
                            return [2 /*return*/];
                        }
                        if (!(file.location === 'internal')) return [3 /*break*/, 5];
                        return [4 /*yield*/, fetch(file.data)];
                    case 3:
                        response = _b.sent();
                        return [4 /*yield*/, response.arrayBuffer()];
                    case 4:
                        buffer = _b.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        buffer = this._base64ToBuffer(file.data);
                        _b.label = 6;
                    case 6:
                        // C. PDF: Blob URL -> iFrame
                        if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
                            url = void 0;
                            if (file.location === 'internal') {
                                url = file.data;
                            }
                            else {
                                blob = new Blob([buffer], { type: 'application/pdf' });
                                url = URL.createObjectURL(blob);
                            }
                            mBTME.open('previewFile', file.name, "<iframe src=\"".concat(url, "\" class=\"w-full h-[80vh] border-none bg-slate-100\"></iframe>"), 'max-w-5xl', { noPadding: true });
                        }
                        // D. Word (DOCX): Mammoth.js
                        else if (name.endsWith('.docx')) {
                            if (typeof mammoth === 'undefined')
                                return [2 /*return*/, mBTME.alert("Error", "Word viewer offline.")];
                            mBTME.showLoader("Converting DOCX...");
                            mammoth.convertToHtml({ arrayBuffer: buffer })
                                .then(function (result) {
                                mBTME.hideLoader();
                                mBTME.open('previewFile', file.name, "<div class=\"prose prose-sm max-w-none p-8 bg-white text-slate-800\">".concat(result.value, "</div>"), 'max-w-3xl');
                            })
                                .catch(function (err) { mBTME.hideLoader(); mBTME.alert("Conversion Error", err.message); });
                        }
                        // E. Excel (XLSX): SheetJS
                        else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
                            if (typeof XLSX === 'undefined')
                                return [2 /*return*/, mBTME.alert("Error", "Excel viewer offline.")];
                            try {
                                wb = XLSX.read(buffer, { type: 'array' });
                                sheetName = wb.SheetNames[0];
                                html = XLSX.utils.sheet_to_html(wb.Sheets[sheetName]);
                                mBTME.open('previewFile', file.name, "<div class=\"overflow-auto p-4 bg-white text-xs spreadsheet-view\">".concat(html, "</div>"), 'max-w-5xl');
                            }
                            catch (e) {
                                mBTME.alert("Error", "Could not parse spreadsheet.");
                            }
                        }
                        // Fallback
                        else {
                            mBTME.alert("Preview Unavailable", "This file type cannot be previewed. Please download it.");
                        }
                        return [2 /*return*/];
                }
            });
        });
    },
    // --- NEW: Print Driver (Indirect Iframe Injection) ---
    printAttachment: function (docId, index) {
        return __awaiter(this, void 0, void 0, function () {
            var doc, file, _a, iframe_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        doc = budget.documents.find(function (d) { return d.id === docId; });
                        if (!doc || !doc.attachments || !doc.attachments[index])
                            return [2 /*return*/];
                        file = __assign({}, doc.attachments[index]);
                        if (!(file.location === 'internal' && file.key)) return [3 /*break*/, 2];
                        _a = file;
                        return [4 /*yield*/, mBT.data.storage.loadBlob(file.key)];
                    case 1:
                        _a.data = _b.sent();
                        _b.label = 2;
                    case 2:
                        if (file.type.includes('image') || file.type === 'application/pdf') {
                            iframe_1 = document.createElement('iframe');
                            iframe_1.style.display = 'none';
                            iframe_1.src = file.data;
                            document.body.appendChild(iframe_1);
                            // Allow buffer time for rendering before print dialog
                            iframe_1.onload = function () {
                                setTimeout(function () {
                                    try {
                                        iframe_1.contentWindow.focus();
                                        iframe_1.contentWindow.print();
                                    }
                                    catch (e) {
                                        console.warn("Auto-print failed, opening new tab fallback.");
                                        window.open(file.data, '_blank');
                                    }
                                    // Cleanup
                                    setTimeout(function () { return document.body.removeChild(iframe_1); }, 60000);
                                }, 500);
                            };
                        }
                        else {
                            mBTME.alert("Print Error", "Cannot print this file type directly. Please download it.");
                        }
                        return [2 /*return*/];
                }
            });
        });
    },
    // Logic Resolution: Trigger download from internal DataURL
    downloadAttachment: function (docId, index) {
        return __awaiter(this, void 0, void 0, function () {
            var doc, file, blob, dataURLtoBlob, blobUrl, response, url, a;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        doc = budget.documents.find(function (d) { return d.id === docId; });
                        if (!(doc && doc.attachments && doc.attachments[index])) return [3 /*break*/, 7];
                        file = doc.attachments[index];
                        blob = null;
                        dataURLtoBlob = function (dataurl) {
                            try {
                                var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
                                while (n--) {
                                    u8arr[n] = bstr.charCodeAt(n);
                                }
                                return new Blob([u8arr], { type: mime });
                            }
                            catch (e) {
                                console.error("Blob Conversion Failed", e);
                                return null;
                            }
                        };
                        if (!(file.location === 'internal' && file.key)) return [3 /*break*/, 5];
                        return [4 /*yield*/, mBT.data.storage.loadBlob(file.key)];
                    case 1:
                        blobUrl = _a.sent();
                        if (!blobUrl) return [3 /*break*/, 4];
                        return [4 /*yield*/, fetch(blobUrl)];
                    case 2:
                        response = _a.sent();
                        return [4 /*yield*/, response.blob()];
                    case 3:
                        blob = _a.sent();
                        _a.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        blob = dataURLtoBlob(file.data);
                        _a.label = 6;
                    case 6:
                        // Primary Path: Use Publisher Engine
                        if (blob && typeof mBTPublisher !== 'undefined' && mBTPublisher.io) {
                            mBTPublisher.io.forceDownload(blob, file.name);
                        }
                        // Fallback Path: Direct Browser Action
                        else if (blob) {
                            url = URL.createObjectURL(blob);
                            a = document.createElement('a');
                            a.href = url;
                            a.download = file.name;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }
                        _a.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        });
    },
    removeAttachment: function (docId, index) {
        var _this = this;
        mBTME.confirm("Remove Attachment", "Delete this file attachment?", function () {
            var doc = budget.documents.find(function (d) { return d.id === docId; });
            if (doc && doc.attachments) {
                doc.attachments.splice(index, 1);
                saveBudget();
                _this.showOptions(docId);
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
    if (event)
        event.stopPropagation();
    var wrapper = el.parentElement;
    document.querySelectorAll('.crew-wrapper').forEach(function (div) { if (div !== wrapper)
        div.classList.remove('mobile-active'); });
    wrapper.classList.toggle('mobile-active');
};
// Helper for Contact Card Tabs (Phase 8.1 - Tier 6)
window.toggleCrewProfileTab = function (tabId) {
    // Toggle Buttons
    document.querySelectorAll('.crew-tab-btn').forEach(function (btn) {
        var isActive = btn.dataset.tab === tabId;
        btn.className = "crew-tab-btn flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ".concat(isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600');
    });
    // Toggle Views
    var profile = document.getElementById('tab-profile');
    var history = document.getElementById('tab-history');
    if (tabId === 'profile') {
        if (profile)
            profile.classList.remove('hidden');
        if (history)
            history.classList.add('hidden');
    }
    else {
        if (profile)
            profile.classList.add('hidden');
        if (history)
            history.classList.remove('hidden');
    }
};
window.openCrewProfile = function (el, event, itemId, sectionName) {
    var _this = this;
    if (event)
        event.stopPropagation();
    // --- LOGIC UPDATE: Phase 2 Context Detection ---
    var item = null;
    var isGlobalEdit = false;
    // 1. Try finding in Budget (Context: Line Item Click)
    if (itemId && sectionName && budget.sections && budget.sections[sectionName]) {
        item = budget.sections[sectionName].items.find(function (i) { return i.id === itemId; });
    }
    // 2. Try finding in Global DB (Context: Database Manager Click)
    if (!item && !sectionName && itemId && !itemId.startsWith('dummy_')) {
        var globalC = mBTOG.contacts.find(function (c) { return c.id === itemId; });
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
    if (!item)
        item = { id: itemId || 'temp', crew: { name: '', phone: '', email: '', wallet: '', walletType: 'payoneer' }, description: 'New Contact' };
    var crew = item.crew || { name: '', phone: '', email: '', wallet: '', walletType: 'payoneer' };
    // --- Render Components ---
    // 1. Ledger (History Tab)
    var ledgerHtml = '';
    if (typeof mBT.ui.render.paymentHistory === 'function') {
        var contextForHistory = item;
        if (!item.payments && item.crew && item.crew.name) {
            var globalC = mBTOG.contacts.find(function (c) { return c.name.toLowerCase() === item.crew.name.toLowerCase(); });
            if (globalC)
                contextForHistory = globalC;
        }
        ledgerHtml = mBT.ui.render.paymentHistory(contextForHistory);
    }
    // 2. Dynamic Wallet UI Generation
    // Fix: Added [&>svg]:w-4 [&>svg]:h-4 to force SVG sizing, preventing the 120px Cash icon from breaking layout
    var currentType = crew.walletType || 'payoneer';
    var methodButtons = PAYMENT_SERVICES.map(function (s) { return "\n            <button type=\"button\" data-method=\"".concat(s.id, "\" class=\"wallet-method-btn w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2 ").concat(currentType === s.id ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200', "\" title=\"").concat(s.label, "\">\n                <div class=\"pointer-events-none [&>svg]:w-4 [&>svg]:h-4\">").concat(s.icon, "</div>\n            </button>\n        "); }).join('');
    // 3. Profile Form (Profile Tab)
    var profileHtml = "\n            <div class=\"space-y-4 pt-2\">\n                <div class=\"flex justify-end\">\n                     <button type=\"button\" id=\"importContactBtn\" class=\"text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg\">".concat(mBTAssets.plus, " Import Contact</button>\n                </div>\n                <div class=\"space-y-3\">\n                    <input type=\"text\" id=\"crewName\" value=\"").concat(mBT.ui.render.esc(crew.name || ''), "\" placeholder=\"FULL NAME\" class=\"w-full p-3 bg-white border-none rounded-xl shadow-sm text-xs font-black uppercase tracking-tighter outline-none focus:ring-4 focus:ring-blue-50 transition-all\">\n                    <div class=\"grid grid-cols-2 gap-3\">\n                        <input type=\"tel\" id=\"crewPhone\" value=\"").concat(mBT.ui.render.esc(crew.phone || ''), "\" placeholder=\"PHONE\" class=\"w-full p-3 bg-white border-none rounded-xl shadow-sm text-xs font-mono font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all\">\n                        <input type=\"email\" id=\"crewEmail\" value=\"").concat(mBT.ui.render.esc(crew.email || ''), "\" placeholder=\"EMAIL\" class=\"w-full p-3 bg-white border-none rounded-xl shadow-sm text-xs font-mono font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all\">\n                    </div>\n                    \n                    <!-- NEW DYNAMIC WALLET IDENTITY -->\n                    <div class=\"bg-slate-100/50 p-3 rounded-2xl border border-slate-100\">\n                        <label class=\"block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1\">Payment Identity</label>\n                        \n                        <!-- Grid Layout Fix -->\n                        <div class=\"grid grid-cols-6 gap-2 mb-3\">\n                            ").concat(methodButtons, "\n                        </div>\n                        \n                        <div class=\"relative\">\n                            <input type=\"hidden\" id=\"crewWalletType\" value=\"").concat(currentType, "\">\n                            <input type=\"text\" id=\"crewWallet\" value=\"").concat(mBT.ui.render.esc(crew.wallet || ''), "\" placeholder=\"IDENTIFIER / LINK\" class=\"w-full p-3 bg-white border-none rounded-xl shadow-sm text-xs font-mono font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-100 transition-all\">\n                            <div class=\"absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 scale-75 opacity-50 pointer-events-none [&>svg]:w-5 [&>svg]:h-5\">").concat(mBTAssets.wallet, "</div>\n                        </div>\n                    </div>\n                </div>\n                <div class=\"flex justify-between items-center pt-2\">\n                    ").concat(!isGlobalEdit && sectionName ? "<button type=\"button\" class=\"text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 px-4 py-3 rounded-2xl transition-all\" onclick=\"window.clearCrewAssignment('".concat(itemId, "', '").concat(sectionName, "')\">Unassign</button>") : '<div></div>', "\n                    <button type=\"submit\" class=\"py-3 px-8 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-black transition-all active:scale-95\">Save Profile</button>\n                </div>\n            </div>");
    var content = "\n            <form id=\"crewProfileForm\" class=\"flex flex-col h-[580px]\">\n                <div class=\"text-center relative shrink-0 p-6 bg-white border-b border-slate-50\">\n                    <div class=\"w-20 h-20 mx-auto rounded-full bg-slate-900 flex items-center justify-center text-white font-black text-3xl shadow-2xl border-4 border-white mb-2\">\n                        ".concat(crew.name ? mBT.ui.render.esc(crew.name.substring(0, 1).toUpperCase()) : '?', "\n                    </div>\n                    <h3 class=\"text-lg font-black text-slate-900 uppercase tracking-tighter leading-none\">").concat(mBT.ui.render.esc(crew.name || 'New Personnel'), "</h3>\n                    <p class=\"text-[9px] text-blue-500 font-bold uppercase tracking-widest mt-1\">").concat(mBT.ui.render.esc(item.description || 'Crew Assignment'), "</p>\n                </div>\n\n                <div class=\"flex bg-slate-100 p-1 rounded-xl mx-6 mt-4 shrink-0\">\n                    <button type=\"button\" data-tab=\"profile\" onclick=\"toggleCrewProfileTab('profile')\" class=\"crew-tab-btn flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all bg-white text-blue-600 shadow-sm\">Identity</button>\n                    <button type=\"button\" data-tab=\"history\" onclick=\"toggleCrewProfileTab('history')\" class=\"crew-tab-btn flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600\">Ledger</button>\n                </div>\n\n                <div class=\"flex-grow overflow-hidden relative bg-slate-50 mt-4 mx-6 mb-6 rounded-2xl border border-slate-100\">\n                    <div id=\"tab-profile\" class=\"absolute inset-0 p-5 overflow-y-auto no-scrollbar\">\n                        ").concat(profileHtml, "\n                    </div>\n                    <div id=\"tab-history\" class=\"absolute inset-0 overflow-y-auto no-scrollbar hidden\">\n                        ").concat(ledgerHtml, "\n                    </div>\n                </div>\n            </form>");
    mBTME.open('crewProfile', '', content, 'max-w-sm', { hideHeader: true });
    setTimeout(function () {
        var form = document.getElementById('crewProfileForm');
        // Method Swapper Logic
        document.querySelectorAll('.wallet-method-btn').forEach(function (btn) {
            btn.onclick = function () {
                document.querySelectorAll('.wallet-method-btn').forEach(function (b) { return b.classList.remove('bg-emerald-100', 'border-emerald-500', 'text-emerald-700'); });
                btn.classList.add('bg-emerald-100', 'border-emerald-500', 'text-emerald-700');
                var method = btn.dataset.method;
                document.getElementById('crewWalletType').value = method;
                // Dynamic Placeholder Adjustment
                var input = document.getElementById('crewWallet');
                var placeholders = {
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
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var name = document.getElementById('crewName').value.trim();
                var phone = document.getElementById('crewPhone').value.trim();
                var email = document.getElementById('crewEmail').value.trim();
                var wallet = document.getElementById('crewWallet').value.trim();
                var walletType = document.getElementById('crewWalletType').value;
                var data = { name: name, phone: phone, email: email, wallet: wallet, walletType: walletType };
                if (itemId && itemId.startsWith('dummy_new_contact')) {
                    if (!name)
                        return mBTME.alert("Required", "Name is required.");
                    mBTOG.contacts.push(__assign({ id: 'c_' + Date.now(), role: 'Crew' }, data));
                    mBTOG.saveContacts();
                    mBTME.close('crewProfileModal');
                    if (typeof showSettingsModal === 'function')
                        showSettingsModal('database', 'contacts');
                }
                else if (isGlobalEdit) {
                    var gIdx = mBTOG.contacts.findIndex(function (c) { return c.id === itemId; });
                    if (gIdx > -1) {
                        Object.assign(mBTOG.contacts[gIdx], data);
                        mBTOG.saveContacts();
                        mBTME.close('crewProfileModal');
                        if (typeof showSettingsModal === 'function')
                            showSettingsModal('database', 'contacts');
                    }
                }
                else if (item) {
                    item.crew = data;
                    mBTME.close('crewProfileModal');
                    if (typeof mBTLE !== 'undefined')
                        mBTLE.reconcile();
                    if (typeof render === 'function')
                        render();
                    if (document.getElementById('stagesViewModal'))
                        window.showStagesModal();
                }
            });
        }
        var importBtn = document.getElementById('importContactBtn');
        if (importBtn) {
            importBtn.addEventListener('click', function () { return __awaiter(_this, void 0, void 0, function () {
                var contacts, c, ex_1;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            if (!('contacts' in navigator && 'ContactsManager' in window)) return [3 /*break*/, 5];
                            _d.label = 1;
                        case 1:
                            _d.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, navigator.contacts.select(['name', 'tel', 'email'], { multiple: false })];
                        case 2:
                            contacts = _d.sent();
                            if (contacts.length) {
                                c = contacts[0];
                                if ((_a = c.name) === null || _a === void 0 ? void 0 : _a[0])
                                    document.getElementById('crewName').value = c.name[0];
                                if ((_b = c.tel) === null || _b === void 0 ? void 0 : _b[0])
                                    document.getElementById('crewPhone').value = c.tel[0];
                                if ((_c = c.email) === null || _c === void 0 ? void 0 : _c[0])
                                    document.getElementById('crewEmail').value = c.email[0];
                            }
                            return [3 /*break*/, 4];
                        case 3:
                            ex_1 = _d.sent();
                            console.log('Contact Import cancelled');
                            return [3 /*break*/, 4];
                        case 4: return [3 /*break*/, 6];
                        case 5:
                            mBTME.alert("Not Supported", "Contact import not available in this browser.");
                            _d.label = 6;
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
        }
    }, 50);
};
window.clearCrewAssignment = function (itemId, sectionName) {
    mBTME.confirm("Remove Assignment", "Remove this crew assignment?", function () {
        var item = budget.sections[sectionName].items.find(function (i) { return i.id === itemId; });
        if (item) {
            delete item.crew;
            mBTME.close('crewProfileModal');
            if (typeof mBTLE !== 'undefined')
                mBTLE.reconcile();
            if (typeof render === 'function')
                render();
            if (document.getElementById('stagesViewModal'))
                window.showStagesModal();
        }
    });
};
/* --- 2. Stage & Analytics Interface (Orchestration) --- */
// UI Helpers for Stages Modal
window.handleStageAddItem = function (stageKey) {
    var _a, _b;
    var sectionNames = Object.keys(budget.sections);
    var targetSectionName = sectionNames.find(function (s) { return s.toLowerCase().includes('production'); }) || sectionNames[0];
    // Intelligent Section Guessing
    if (stageKey === 'post')
        targetSectionName = sectionNames.find(function (s) { return /post|edit/.test(s.toLowerCase()); }) || targetSectionName;
    else if (stageKey === 'dev')
        targetSectionName = sectionNames.find(function (s) { return /dev|creative/.test(s.toLowerCase()); }) || targetSectionName;
    var existingItems = [];
    Object.entries(budget.sections).forEach(function (_a) {
        var secName = _a[0], sec = _a[1];
        sec.items.forEach(function (i) {
            if (!(i.stageData && i.stageData[stageKey])) {
                existingItems.push(__assign(__assign({}, i), { isExisting: true, sectionName: secName }));
            }
        });
    });
    var initialList = __spreadArray(__spreadArray([], existingItems.slice(0, 10), true), mBTOG.rates.slice(0, 20), true);
    var content = "\n            <div class=\"flex flex-col h-[400px]\">\n                <div class=\"mb-3\"><input type=\"text\" id=\"stageDbSearch\" placeholder=\"Search...\" class=\"w-full p-3 border rounded-lg shadow-sm text-sm font-bold\"></div>\n                <div id=\"stageDbList\" class=\"flex-grow overflow-y-auto border rounded-lg bg-gray-50 mb-3\">".concat(renderStageDatabaseList(initialList, stageKey, targetSectionName), "</div>\n                <button id=\"toggleStageCustomForm\" class=\"text-xs text-blue-600 font-bold hover:underline mb-2\">+ Create Custom Item</button>\n                <div id=\"stageCustomForm\" class=\"hidden space-y-3 border-t pt-3 bg-white\">\n                    <input type=\"text\" id=\"stageCustomDesc\" class=\"w-full p-2 border rounded text-sm\" placeholder=\"Item Name\">\n                    <div class=\"flex gap-2\"><input type=\"number\" id=\"stageCustomRate\" class=\"flex-1 p-2 border rounded text-sm\" placeholder=\"0.00\"><select id=\"stageCustomUnit\" class=\"w-1/3 p-2 border rounded text-sm\"><option>Day</option><option>Flat</option></select></div>\n                    <button id=\"stageAddCustomBtn\" class=\"w-full py-2 bg-blue-600 text-white font-bold rounded\">Add Item</button>\n                </div>\n            </div>");
    mBTME.open('stageAdd', "Add to ".concat(budget.targetLock.stages[stageKey].label), content, 'max-w-sm');
    // Attach Listeners
    var searchInput = document.getElementById('stageDbSearch');
    if (searchInput)
        searchInput.addEventListener('input', function (e) {
            var term = e.target.value.toLowerCase();
            var filtered = __spreadArray(__spreadArray([], existingItems, true), mBTOG.rates, true).filter(function (i) { return i.description.toLowerCase().includes(term); }).slice(0, 30);
            document.getElementById('stageDbList').innerHTML = renderStageDatabaseList(filtered, stageKey, targetSectionName);
        });
    (_a = document.getElementById('toggleStageCustomForm')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', function (e) {
        document.getElementById('stageCustomForm').classList.toggle('hidden');
        document.getElementById('stageDbList').classList.toggle('hidden');
    });
    (_b = document.getElementById('stageAddCustomBtn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', function () {
        var desc = document.getElementById('stageCustomDesc').value.trim();
        var rate = parseFloat(document.getElementById('stageCustomRate').value) || 0;
        var unit = document.getElementById('stageCustomUnit').value;
        if (desc)
            addStageItemToBudget(desc, rate, unit, stageKey, targetSectionName);
    });
};
window.renderStageDatabaseList = function (items, stageKey, targetSectionName) {
    if (!items.length)
        return "<div class=\"p-4 text-center text-xs text-gray-400\">No matches.</div>";
    return items.map(function (item) { return "\n            <div onclick=\"".concat(item.isExisting ? "assignItemToStage('".concat(item.id, "', '").concat(stageKey, "')") : "addStageItemToBudget('".concat(RenderEngine.esc(item.description), "', ").concat(item.rate, ", '").concat(item.unit, "', '").concat(stageKey, "', '").concat(targetSectionName, "')"), "\" \n                 class=\"p-3 border-b bg-white hover:bg-blue-50 cursor-pointer flex justify-between items-center group\">\n                <div><div class=\"text-sm font-bold text-gray-700\">").concat(item.description, "</div>").concat(item.isExisting ? "<div class=\"text-[9px] text-emerald-600 font-bold\">LINK FROM: ".concat(item.sectionName, "</div>") : '', "</div>\n                <div class=\"font-mono text-xs text-gray-500 font-bold\">").concat(mBTLE.format.currency(item.rate), "</div>\n            </div>"); }).join('');
};
window.assignItemToStage = function (itemId, stageKey) {
    var item = null;
    Object.values(budget.sections).forEach(function (sec) { if (!item)
        item = sec.items.find(function (i) { return i.id === itemId; }); });
    if (item) {
        if (!item.stageData)
            item.stageData = {};
        if (!item.stageData[stageKey]) {
            item.stageData[stageKey] = { days: 1, rate: item.rate || 0 };
            saveBudget();
            mBTME.close('stageAddModal');
            if (document.getElementById('stagesViewModal'))
                window.showStagesModal();
            mBTLE.reconcile();
        }
    }
};
window.addStageItemToBudget = function (desc, rate, unit, stageKey, targetSectionName) {
    var newItem = { id: crypto.randomUUID(), description: desc, quantity: 1, unit: unit, multiplier: 1, rate: rate, actual: 0, rateType: 'negotiable', stageData: {} };
    newItem.stageData[stageKey] = { days: 1, rate: rate };
    if (budget.sections[targetSectionName]) {
        budget.sections[targetSectionName].items.push(newItem);
        mBTME.close('stageAddModal');
        saveBudget();
        if (document.getElementById('stagesViewModal'))
            window.showStagesModal();
        if (typeof render === 'function')
            render();
    }
};
// Stage Drag & Drop
window.handleStageDragStart = function (e, itemId, sourceStage) { e.dataTransfer.setData('text/plain', JSON.stringify({ itemId: itemId, sourceStage: sourceStage })); };
window.handleStageDragOver = function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
window.handleStageDrop = function (e, targetStage) {
    e.preventDefault();
    var data = JSON.parse(e.dataTransfer.getData('text/plain'));
    var itemId = data.itemId, sourceStage = data.sourceStage;
    if (sourceStage === targetStage)
        return;
    var item = null;
    Object.values(budget.sections).forEach(function (sec) { if (!item)
        item = sec.items.find(function (i) { return i.id === itemId; }); });
    if (item && item.stageData && item.stageData[sourceStage]) {
        item.stageData[targetStage] = __assign({}, item.stageData[sourceStage]); // Clone to new stage
        saveBudget();
        showStagesModal();
    }
};
window.updateStageItem = function (itemId, sectionName, stageKey, field, value, isRealTime) {
    var _a;
    if (isRealTime === void 0) { isRealTime = false; }
    var item = (_a = budget.sections[sectionName]) === null || _a === void 0 ? void 0 : _a.items.find(function (i) { return i.id === itemId; });
    if (item && item.stageData && item.stageData[stageKey]) {
        item.stageData[stageKey][field] = parseFloat(value) || 0;
        // Surgical Paint: Update Card Cost Immediately
        var days = item.stageData[stageKey].days || 0;
        var rate = item.stageData[stageKey].rate || 0;
        var cost = days * rate;
        var costEl = document.getElementById("cost-".concat(itemId, "-").concat(stageKey));
        if (costEl)
            costEl.innerText = mBTLE.format.currency(cost);
        // Update Headers & Main Budget
        if (typeof window.updateAllHeaders === 'function')
            window.updateAllHeaders();
        mBTLE.reconcile();
        if (typeof mBT.ui.paint === 'function')
            mBT.ui.paint();
        // Save Strategy: Debounce if realtime
        if (isRealTime) {
            if (mBT.features.stages.state._timer)
                clearTimeout(mBT.features.stages.state._timer);
            mBT.features.stages.state._timer = setTimeout(saveBudget, 1000);
        }
        else {
            // Fix: Clear any pending debounce to prevent double-save on blur
            if (mBT.features.stages.state._timer)
                clearTimeout(mBT.features.stages.state._timer);
            saveBudget();
        }
    }
};
window.handleStageBulkAction = function (action) {
    var validKeys = ['dev', 'pre', 'prod', 'post', 'dist'];
    if (action === 'lockAll' || action === 'unlockAll') {
        validKeys.forEach(function (k) { return budget.targetLock.stages[k].locked = (action === 'lockAll'); });
        saveBudget();
        window.showStagesModal();
    }
    else if (action === 'syncDays') {
        mBTME.confirm("Sync Duration", "Overwrite individual item days with Stage settings?", function () {
            validKeys.forEach(function (k) {
                var d = budget.targetLock.stages[k].days;
                if (d > 0)
                    Object.values(budget.sections).forEach(function (s) { return s.items.forEach(function (i) { var _a; if ((_a = i.stageData) === null || _a === void 0 ? void 0 : _a[k])
                        i.stageData[k].days = d; }); });
            });
            saveBudget();
            window.showStagesModal();
        });
    }
};
// --- TIER 5 UPGRADE: Manual Duration Handler (Phase 2 Fix) ---
window.updateStageDuration = function (stageKey, value) {
    if (!budget || !budget.targetLock || !budget.targetLock.stages)
        return;
    // 1. Update Data Model
    var days = parseFloat(value) || 0;
    if (budget.targetLock.stages[stageKey]) {
        budget.targetLock.stages[stageKey].days = days;
        // 2. Persist
        saveBudget();
        // 3. Trigger Temporal Engine (Updates Dates instantly)
        if (typeof window.updateAllHeaders === 'function')
            window.updateAllHeaders();
        // 4. Update Logic Engine (Burn Rates)
        if (typeof mBTLE !== 'undefined')
            mBTLE.reconcile();
    }
};
// --- TIER 5 UPGRADE: Smart Sync Controller ---
window.syncStageDays = function (stageKey) {
    // 1. Ask Tier 3 for the Truth
    var validation = mBT.logic.stages.validateTimeline(stageKey);
    if (validation.maxNeeded > 0) {
        // 2. Update the Governor (User Input) to match Reality
        if (!budget.targetLock.stages[stageKey])
            return;
        budget.targetLock.stages[stageKey].days = validation.maxNeeded;
        // 3. Persist & Refresh
        saveBudget();
        mBTLE.reconcile(); // Recalc burn rates
        // 4. Update UI (Removes Red Warning)
        if (document.getElementById('stagesViewModal'))
            window.showStagesModal();
    }
    else {
        mBTME.alert("Sync Info", "No scheduled items found in this stage to sync with.");
    }
};
// --- NEW: Smart Auto-Fill Logic (Tier 5 Bridge) ---
window.handleStageAutoFill = function (stageKey, mode) {
    if (mode === void 0) { mode = 'link'; }
    var stageLabel = (budget.targetLock && budget.targetLock.stages[stageKey]) ? budget.targetLock.stages[stageKey].label : stageKey.toUpperCase();
    var count = 0;
    if (mode === 'link') {
        var matches = mBT.features.stages.logic.findMatchesInBudget(stageKey);
        if (matches.length === 0)
            return mBTME.alert("No Matches", "No matching items found to link.");
        matches.forEach(function (item) {
            if (!item.stageData)
                item.stageData = {};
            item.stageData[stageKey] = { days: 1, rate: item.rate };
            count++;
        });
    }
    else if (mode === 'generate') {
        var missing = mBT.features.stages.logic.findMissingEssentials(stageKey);
        if (missing.length === 0)
            return mBTME.alert("Complete", "No missing essentials found.");
        // Determine target section
        var sectionNames = Object.keys(budget.sections);
        var targetSec_1 = sectionNames.find(function (s) { return s.toLowerCase().includes('production'); }) || sectionNames[0];
        if (stageKey === 'post')
            targetSec_1 = sectionNames.find(function (s) { return /post|edit/.test(s.toLowerCase()); }) || targetSec_1;
        else if (stageKey === 'dev')
            targetSec_1 = sectionNames.find(function (s) { return /dev|creative/.test(s.toLowerCase()); }) || targetSec_1;
        if (!budget.sections[targetSec_1])
            return mBTME.alert("Error", "Target section not found.");
        missing.forEach(function (dbItem) {
            var newItem = {
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
            budget.sections[targetSec_1].items.push(newItem);
            count++;
        });
    }
    if (count > 0) {
        saveBudget();
        mBTLE.reconcile();
        if (document.getElementById('stagesViewModal'))
            window.showStagesModal();
        mBTME.alert("Auto-Fill Complete", "".concat(count, " items processed for ").concat(stageLabel, "."));
    }
};
window.handleStageBulkAutoFill = function () {
    mBTME.confirm("Smart Scan", "Auto-populate ALL stages with existing budget items?", function () {
        var total = 0;
        var validKeys = ['dev', 'pre', 'prod', 'post', 'dist'];
        validKeys.forEach(function (k) {
            var matches = mBT.features.stages.logic.findMatchesInBudget(k);
            matches.forEach(function (item) {
                if (!item.stageData)
                    item.stageData = {};
                item.stageData[k] = { days: 1, rate: item.rate };
                total++;
            });
        });
        if (total > 0) {
            saveBudget();
            mBTLE.reconcile();
            window.showStagesModal();
            mBTME.alert("Scan Complete", "Smart Scan Linked ".concat(total, " items."));
        }
        else {
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
    var content = mBT.ui.renderStagesView();
    mBTME.open('stagesView', '', content, 'max-w-none w-fit !bg-transparent !shadow-none !border-0', {
        hideHeader: true,
        noPadding: true,
        onOpen: function () { return mBT.ui.initStagesInteractions(document.getElementById('stagesView')); }
    });
};
mBT.ui.renderStagesView = function () {
    if (!budget.targetLock)
        budget.targetLock = { enabled: false, totalCap: 0, stages: {} };
    var tl = budget.targetLock;
    var validKeys = ['dev', 'pre', 'prod', 'post', 'dist'];
    validKeys.forEach(function (k) { if (!tl.stages[k])
        tl.stages[k] = { label: k.toUpperCase(), ratio: 20, days: 0, locked: false }; });
    var setupCard = "\n            <div id=\"card-setup\" class=\"stage-card min-w-[320px] w-[320px] flex-shrink-0 bg-slate-900 text-white flex flex-col snap-center border-r border-slate-800 h-full\">\n                <div class=\"p-4 border-b border-slate-700 flex justify-between items-center\">\n                    <h3 class=\"font-black text-xs uppercase tracking-widest text-slate-400\">Configuration</h3>\n                    <div class=\"relative group\">\n                        <button class=\"text-slate-400 hover:text-white transition-colors\">".concat(mBTAssets.gear, "</button>\n                        <div class=\"hidden group-hover:block absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden\">\n                            <div class=\"p-2 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50\">Bulk Actions</div>\n                            <button onclick=\"handleStageBulkAutoFill()\" class=\"w-full text-left text-[10px] font-bold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 px-4 py-2 transition-colors flex items-center gap-2\">\n                                 ").concat(mBTAssets.wand, " Smart Auto-Fill\n                            </button>\n                            <button onclick=\"handleStageBulkAction('syncDays')\" class=\"w-full text-left text-[10px] font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 transition-colors\">Sync Days</button>\n                            <button onclick=\"handleStageBulkAction('dedupe')\" class=\"w-full text-left text-[10px] font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 px-4 py-2 transition-colors\">Remove Dupes</button>\n                            <div class=\"border-t border-slate-100 my-1\"></div>\n                            <button onclick=\"handleStageBulkAction('lockAll')\" class=\"w-full text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 px-4 py-2 transition-colors\">Lock All</button>\n                            <button onclick=\"handleStageBulkAction('unlockAll')\" class=\"w-full text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 px-4 py-2 transition-colors\">Unlock All</button>\n                        </div>\n                    </div>\n                </div>\n                <div class=\"p-5 space-y-6 overflow-y-auto no-scrollbar\">\n                    <div>\n                        <label class=\"text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2\">Project Start Date</label>\n                        <input type=\"date\" value=\"").concat(budget.startDate || new Date().toISOString().split('T')[0], "\" \n                               onchange=\"budget.startDate=this.value; saveBudget(); window.updateAllHeaders();\" \n                               class=\"w-full bg-slate-800 text-white text-[10px] font-bold p-3 rounded-xl outline-none border border-slate-700 focus:border-blue-600 transition-colors cursor-pointer uppercase tracking-widest shadow-inner\">\n                    </div>\n                    <div>\n                        <label class=\"text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2\">Target Delivery Date</label>\n                        <input type=\"date\" value=\"").concat(budget.deliveryDate || '', "\" \n                               onchange=\"budget.deliveryDate=this.value; saveBudget(); window.updateAllHeaders();\" \n                               class=\"w-full bg-slate-800 text-white text-[10px] font-bold p-3 rounded-xl outline-none border border-slate-700 focus:border-blue-600 transition-colors cursor-pointer uppercase tracking-widest shadow-inner\">\n                    </div>\n                    <div>\n                        <label class=\"text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2\">Total Cap Limit</label>\n                        <div class=\"flex items-center gap-2 border-b border-slate-600 pb-1\">\n                            <span class=\"text-slate-500 text-lg\">$</span>\n                            <input type=\"number\" value=\"").concat(tl.totalCap, "\" onchange=\"budget.targetLock.totalCap=parseFloat(this.value); saveBudget(); window.updateAllHeaders();\" class=\"w-full bg-transparent text-xl font-black text-white outline-none no-spinner placeholder-slate-700\">\n                        </div>\n                    </div>\n                    <div class=\"space-y-5\">\n                        ").concat(validKeys.map(function (k) { return "\n                            <div class=\"relative\">\n                                <div class=\"flex justify-between text-[9px] font-black uppercase text-slate-400 mb-1.5\">\n                                    <span class=\"tracking-widest\">".concat(tl.stages[k].label, "</span>\n                                    <span id=\"setup_perc_disp_").concat(k, "\" class=\"text-white\">").concat(tl.stages[k].ratio.toFixed(1), "%</span>\n                                </div>\n                                <div class=\"h-2 bg-slate-800 rounded-full relative overflow-visible\">\n                                    <div id=\"setup_bar_").concat(k, "\" class=\"absolute h-full bg-blue-600 rounded-full opacity-80 pointer-events-none transition-all duration-300\" style=\"width:0%\"></div>\n                                    <input type=\"range\" min=\"0\" max=\"100\" step=\"0.1\" value=\"").concat(tl.stages[k].ratio, "\" data-stage-key=\"").concat(k, "\" class=\"stage-slider absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10\" ").concat(tl.stages[k].locked ? 'disabled' : '', ">\n                                    <div id=\"setup_knob_").concat(k, "\" class=\"absolute w-4 h-4 bg-white rounded-full top-1/2 -translate-y-1/2 shadow-md pointer-events-none transition-all duration-75\" style=\"left: ").concat(tl.stages[k].ratio, "%; margin-left: -8px;\"></div>\n                                </div>\n                            </div>"); }).join(''), "\n                    </div>\n                    <div class=\"pt-6 border-t border-slate-800\">\n                        <label class=\"text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 block\">Distribution Model</label>\n                        <select onchange=\"window.applyStagePreset(this.value); window.showStagesModal();\" class=\"w-full bg-slate-800 text-white text-[10px] font-bold p-3 rounded-xl outline-none border border-slate-700 focus:border-blue-600 transition-colors cursor-pointer appearance-none\">\n                            <option value=\"\" disabled selected>Load Industry Preset...</option>\n                            ").concat(Object.keys(STAGE_PRESETS).map(function (k) { return "<option value=\"".concat(k, "\">").concat(k, "</option>"); }).join(''), "\n                        </select>\n                    </div>\n                </div>\n            </div>");
    var overviewCard = "\n            <div id=\"card-overview\" class=\"stage-card min-w-[320px] w-[320px] flex-shrink-0 bg-white flex flex-col snap-center border-r border-slate-200 h-full\">\n                <div class=\"p-8 flex flex-col items-center justify-center border-b border-slate-100 flex-grow relative overflow-hidden\">\n                    <div class=\"absolute inset-0 bg-slate-50/50 -skew-y-12 scale-150 origin-bottom-left z-0 pointer-events-none\"></div>\n                    <div id=\"burnRateRing\" class=\"w-48 h-48 rounded-full border-[16px] border-slate-100 flex items-center justify-center relative mb-8 transition-all duration-500 z-10 bg-white shadow-sm\">\n                        <div class=\"text-center w-full px-4 overflow-hidden\">\n                            <span id=\"burnRateText\" class=\"text-3xl sm:text-5xl font-black text-slate-300 block leading-none tracking-tighter truncate\">0%</span>\n                            <span class=\"text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2 block truncate\">Burn Rate</span>\n                        </div>\n                    </div>\n                    <div class=\"text-center w-full z-10 space-y-4\">\n                        <div class=\"flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2\">\n                            <span>Estimated</span>\n                            <span id=\"ovGrandTotal\" class=\"text-slate-800 text-xs\">$0.00</span>\n                        </div>\n                        <div class=\"flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400\">\n                            <span>Cap Limit</span>\n                            <span id=\"ovTotalCap\" class=\"text-slate-800 text-xs\">$0.00</span>\n                        </div>\n                    </div>\n                </div>\n                <div class=\"p-6 bg-white z-10\">\n                    <button onclick=\"openAnalyticsHub()\" class=\"w-full py-4 bg-white border-2 border-slate-100 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-blue-50 transition-all flex items-center justify-center gap-3 group\">\n                        <span class=\"scale-125 group-hover:scale-110 transition-transform\">".concat(mBTAssets.doctor, "</span> Open Analytics Hub\n                    </button>\n                </div>\n            </div>");
    return "\n            <div class=\"flex flex-col h-[85vh] w-full bg-white rounded-[32px] shadow-2xl overflow-hidden font-sans border border-slate-200\">\n                <div class=\"flex items-center w-full bg-white border-b border-slate-100 h-10 flex-shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.02)] z-30 sticky top-0 divide-x divide-slate-50\">\n                    <button id=\"nav-tab-setup\" onclick=\"document.getElementById('card-setup').scrollIntoView({behavior:'smooth',inline:'center'})\" \n                            class=\"stage-nav-tab flex-1 h-full flex items-center justify-center text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 border-b-2 border-transparent transition-all select-none min-w-0 px-1 truncate\">\n                        Setup\n                    </button>\n                    <button id=\"nav-tab-overview\" onclick=\"document.getElementById('card-overview').scrollIntoView({behavior:'smooth',inline:'center'})\" \n                            class=\"stage-nav-tab flex-1 h-full flex items-center justify-center text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 border-b-2 border-transparent transition-all select-none min-w-0 px-1 truncate\">\n                        View\n                    </button>\n                    ".concat(validKeys.map(function (k) { return "\n                        <button id=\"nav-tab-".concat(k, "\" onclick=\"document.getElementById('card-").concat(k, "').scrollIntoView({behavior:'smooth',inline:'center'})\" \n                                class=\"stage-nav-tab flex-1 h-full flex items-center justify-center text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 border-b-2 border-transparent transition-all select-none min-w-0 px-1 truncate\">\n                            ").concat(tl.stages[k].label, "\n                        </button>\n                    "); }).join(''), "\n                </div>\n                \n                <div id=\"stagesCarousel\" class=\"flex-grow flex overflow-x-auto snap-x snap-mandatory no-scrollbar cursor-grab active:cursor-grabbing select-none bg-slate-100\">\n                    ").concat(setupCard, "\n                    ").concat(overviewCard, "\n                    ").concat(validKeys.map(function (k) {
        var config = tl.stages[k];
        var val = mBT.logic.stages.validateTimeline(k);
        var syncBtn = (val.maxNeeded > val.current)
            ? "<button onclick=\"syncStageDays('".concat(k, "')\" class=\"absolute -right-3 -top-3 bg-amber-500 text-white w-6 h-6 rounded-full shadow-lg hover:bg-amber-600 transition-all z-50 flex items-center justify-center animate-bounce\" title=\"Sync to ").concat(val.maxNeeded, " days needed\">").concat(mBTAssets.sync, "</button>")
            : '';
        var fullTitles = { 'dev': 'Development', 'pre': 'Pre-Production', 'prod': 'Production', 'post': 'Post-Production', 'dist': 'Distribution' };
        var displayTitle = fullTitles[k] || config.label;
        return "\n                        <div id=\"card-".concat(k, "\" class=\"stage-card min-w-[340px] w-[340px] flex-shrink-0 flex flex-col h-full bg-white border-r border-slate-200 snap-center relative group\">\n                            <div class=\"p-4 bg-white border-b border-slate-50 flex-shrink-0 sticky top-0 z-20 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]\">\n                                <div class=\"relative flex items-center justify-between mb-4 h-8\">\n                                    <div class=\"flex items-center gap-1\">\n                                        <button onclick=\"budget.targetLock.stages['").concat(k, "'].locked = !budget.targetLock.stages['").concat(k, "'].locked; saveBudget(); showStagesModal();\" class=\"relative z-10 text-slate-300 hover:text-blue-500 transition-colors p-1 hover:bg-slate-50 rounded-lg\">\n                                            ").concat(config.locked ? mBTAssets.lock : mBTAssets.unlock, "\n                                        </button>\n                                        <button onclick=\"mBT.features.stages.ui.openAutoFillMenu('").concat(k, "')\" class=\"relative z-10 text-slate-300 hover:text-purple-500 transition-colors p-1 hover:bg-purple-50 rounded-lg\" title=\"Auto-Fill Matching Items\">\n                                        ").concat(mBTAssets.wand, "\n                                    </button>\n                                </div>\n                                <div class=\"absolute inset-0 flex flex-col items-center justify-center pointer-events-none\">\n                                    <span class=\"font-black text-xs text-slate-800 uppercase tracking-widest leading-none\">").concat(displayTitle, "</span>\n                                    <span id=\"date-range-").concat(k, "\" class=\"text-[8px] font-bold text-slate-400 mt-0.5 tracking-tight\">--</span>\n                                </div>\n                                <div class=\"relative z-10 flex items-center gap-2\">\n                                    <div class=\"relative w-14 group/input\">\n                                        <input type=\"number\" id=\"header_perc_").concat(k, "\" value=\"").concat(config.ratio.toFixed(1), "\" class=\"stage-number-input w-full text-right text-[10px] font-bold bg-slate-50 rounded-lg px-2 py-1 outline-none no-spinner text-slate-600 focus:text-blue-600 focus:bg-blue-50 focus:ring-2 focus:ring-blue-100 transition-all\" data-stage-key=\"").concat(k, "\" ").concat(config.locked ? 'disabled' : '', ">\n                                        <span class=\"absolute right-7 top-1/2 -translate-y-1/2 text-[8px] text-slate-400 group-hover/input:text-blue-400 pointer-events-none\">%</span>\n                                    </div>\n                                    <div class=\"relative w-12 group/days\">\n                                        ").concat(syncBtn, "\n                                        <input type=\"number\" value=\"").concat(config.days, "\" onchange=\"updateStageDuration('").concat(k, "', this.value)\" class=\"w-full text-center text-[10px] font-bold ").concat(val.maxNeeded > val.current ? 'bg-amber-50 text-amber-600 ring-2 ring-amber-100' : 'bg-slate-50 text-blue-600', " rounded-lg px-1 py-1 outline-none no-spinner focus:ring-2 focus:ring-blue-100 transition-all\" placeholder=\"0\">\n                                        <span class=\"absolute right-1 top-1/2 -translate-y-1/2 text-[6px] text-slate-300 font-black uppercase pointer-events-none\">Day</span>\n                                    </div>\n                                </div>\n                            </div>\n                            <div class=\"w-full bg-slate-100 rounded-full h-1.5 mb-3 overflow-hidden\"><div id=\"bar-").concat(k, "\" class=\"bg-blue-500 h-full transition-all duration-500\" style=\"width: 0%\"></div></div>\n                            <div class=\"flex justify-between text-[9px] font-mono font-bold text-slate-400 mb-4\"><span id=\"total-").concat(k, "\" class=\"text-slate-600\">$0</span><span id=\"limit-").concat(k, "\">Cap: $0</span></div>\n                            <button onclick=\"handleStageAddItem('").concat(k, "')\" class=\"w-full py-3 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white hover:shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-95\">").concat(mBTAssets.plus, " Add Item</button>\n                        </div>\n                        <div class=\"stage-drop-zone flex-grow overflow-y-auto p-3 space-y-3 bg-slate-50/50 no-scrollbar pb-10\" data-stage-key=\"").concat(k, "\">\n                            ").concat(renderStageItems(k), "\n                        </div>\n                    </div>");
    }).join(''), "\n                </div>\n            </div>");
};
mBT.ui.initStagesInteractions = function (container) {
    if (container === void 0) { container = document; }
    if (typeof initializeStageDragAndDrop === 'function')
        initializeStageDragAndDrop();
    var carousel = container.querySelector('#stagesCarousel') || document.getElementById('stagesCarousel');
    if (!carousel)
        return;
    var cards = carousel.querySelectorAll('.stage-card');
    var tabs = document.querySelectorAll('.stage-nav-tab');
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                var cardId = entry.target.id;
                var tabId = cardId.replace('card-', 'nav-tab-');
                var activeTab = document.getElementById(tabId);
                if (activeTab) {
                    tabs.forEach(function (t) {
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
    cards.forEach(function (card) { return observer.observe(card); });
    var bindInput = function (el) {
        el.addEventListener('input', function (e) {
            if (typeof balanceStageSliders === 'function')
                balanceStageSliders(e.target.dataset.stageKey, parseFloat(e.target.value));
            if (window.updateAllHeaders)
                window.updateAllHeaders();
        });
        el.addEventListener('change', function () { return saveBudget(); });
    };
    carousel.querySelectorAll('.stage-slider').forEach(bindInput);
    carousel.querySelectorAll('.stage-number-input').forEach(bindInput);
    carousel.querySelectorAll('input[data-action="stage-update"]').forEach(function (el) {
        el.addEventListener('input', function (e) {
            if (typeof updateStageItem === 'function')
                updateStageItem(e.target.dataset.id, e.target.dataset.section, e.target.dataset.stage, e.target.dataset.field, e.target.value, true);
        });
    });
    if (window.updateAllHeaders)
        window.updateAllHeaders();
    var slider = carousel;
    var isDown = false;
    var startX;
    var scrollLeft;
    slider.addEventListener('mousedown', function (e) {
        if (['INPUT', 'BUTTON', 'SELECT'].includes(e.target.tagName) || e.target.closest('.stage-draggable'))
            return;
        isDown = true;
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', function () { return isDown = false; });
    slider.addEventListener('mouseup', function () { return isDown = false; });
    slider.addEventListener('mousemove', function (e) {
        if (!isDown)
            return;
        e.preventDefault();
        var x = e.pageX - slider.offsetLeft;
        slider.scrollLeft = scrollLeft - (x - startX) * 2;
    });
};
function renderStageItems(stageKey) {
    var stageItems = [];
    // 1. Collect all items for this stage
    Object.entries(budget.sections).forEach(function (_a) {
        var secName = _a[0], sec = _a[1];
        sec.items.forEach(function (item) {
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
    stageItems.sort(function (a, b) { return a.order - b.order; });
    if (stageItems.length === 0)
        return '<p class="text-[8px] text-center mt-10 font-black text-slate-300 uppercase">Drop Items Here</p>';
    // 3. Render
    return stageItems.map(function (entry) {
        return RenderEngine.stageCard(__assign(__assign({}, entry.item), { _sDays: entry.item.stageData[stageKey].days, _sRate: entry.item.stageData[stageKey].rate, _sec: entry.secName }), stageKey);
    }).join('');
}
// --- Global Stages Header Update Logic (Available before modal open) ---
window.updateAllHeaders = function () {
    // Safety check
    if (!budget || !budget.targetLock || !budget.targetLock.stages)
        return;
    var metrics = mBTStagesEngine.getMetrics();
    var burn = mBTStagesEngine.getBurnStatus(metrics.grandTotal, metrics.totalCap);
    // --- Phase 3.4: The Messenger (Intelligent Risk Visuals) ---
    // We fetch the deep risk analysis calculated by the Logic Engine
    var timeline = mBTStagesEngine.calculateTimeline();
    var risk = mBTStagesEngine.analyzeRisk(metrics, timeline);
    // Logic Resolution: Risk Override
    // If a risk is detected (Critical or Warning), it overrides the standard financial display
    if (risk) {
        if (risk.status === 'CRITICAL') {
            burn.color = 'text-rose-600';
            burn.ring = 'border-rose-500';
            burn.message = "CRITICAL";
            burn.subMessage = risk.subMessage; // "Projected $X exceeds Cap"
        }
        else if (risk.status === 'WARNING') {
            burn.ring = 'border-amber-400';
            if (burn.color !== 'text-red-600')
                burn.color = 'text-amber-500';
            burn.message = "DELAY";
            burn.subMessage = risk.subMessage; // "Est. Penalty: $X"
        }
        // Visual Feedback on Delivery Input (if visible in Setup Card)
        var deliveryInput = document.querySelector('input[onchange*="budget.deliveryDate"]');
        if (deliveryInput) {
            // Apply visual border state based on health
            deliveryInput.classList.remove('border-slate-700', 'border-rose-500', 'border-amber-500', 'border-emerald-500');
            if (risk.status === 'CRITICAL')
                deliveryInput.classList.add('border-rose-500');
            else if (risk.status === 'WARNING')
                deliveryInput.classList.add('border-amber-500');
            else
                deliveryInput.classList.add('border-emerald-500');
        }
    }
    // Update Overview Card (Visuals)
    var ovGrandTotal = document.getElementById('ovGrandTotal');
    var ovTotalCap = document.getElementById('ovTotalCap');
    if (ovGrandTotal)
        ovGrandTotal.innerText = mBTLE.format.currency(metrics.grandTotal);
    if (ovTotalCap)
        ovTotalCap.innerText = mBTLE.format.currency(metrics.totalCap);
    // Update Burn Ring
    var ring = document.getElementById('burnRateRing');
    var ringTxt = document.getElementById('burnRateText');
    var ringLabel = ringTxt ? ringTxt.nextElementSibling : null; // "Burn Rate" text
    if (ring && ringTxt) {
        ring.className = "w-48 h-48 rounded-full border-[16px] ".concat(burn.ring, " flex items-center justify-center relative mb-8 transition-all duration-500 z-10 bg-white shadow-sm");
        ringTxt.className = "text-3xl sm:text-5xl font-black ".concat(burn.color, " block leading-none tracking-tighter truncate");
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
        }
        else {
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
    Object.keys(timeline).forEach(function (k) {
        if (k === '_analysis')
            return; // Skip metadata
        var el = document.getElementById("date-range-".concat(k));
        var validation = mBTStagesEngine.validateTimeline(k);
        if (el) {
            if (validation.isBankrupt) {
                el.innerText = "TIME BANKRUPTCY";
                el.className = "text-[9px] font-black text-red-600 animate-pulse bg-red-50 px-2 rounded mt-0.5 tracking-tight";
            }
            else {
                el.innerText = timeline[k].label;
                el.className = "text-[8px] font-bold text-slate-400 mt-0.5 tracking-tight";
            }
        }
    });
    // 3. Update Setup Sliders (Visual Synchronization)
    var stages = budget.targetLock.stages;
    var validKeys = ['dev', 'pre', 'prod', 'post', 'dist'];
    validKeys.forEach(function (k) {
        var cfg = stages[k];
        if (!cfg)
            return;
        // A. Update Text Display (Target Ratio)
        var disp = document.getElementById("setup_perc_disp_".concat(k));
        if (disp)
            disp.innerText = cfg.ratio.toFixed(1) + '%';
        // B. Update Bar Width (ACTUAL UTILIZATION)
        var stageCost = (metrics.stageTotals && metrics.stageTotals[k]) ? metrics.stageTotals[k] : 0;
        var stageCap = metrics.totalCap * (cfg.ratio / 100);
        var utilPct = stageCap > 0 ? (stageCost / stageCap) * 100 : 0;
        var bar = document.getElementById("setup_bar_".concat(k));
        if (bar) {
            bar.style.width = Math.min(utilPct, 100).toFixed(2) + '%';
            bar.className = "absolute h-full rounded-full opacity-80 pointer-events-none transition-all duration-300 ".concat(stageCost > stageCap ? 'bg-red-500' : 'bg-blue-600');
        }
        // C. Update Knob Position (TARGET STRATEGY)
        var knob = document.getElementById("setup_knob_".concat(k));
        if (knob)
            knob.style.left = cfg.ratio + '%';
        // D. Update Card Stats
        var totalEl = document.getElementById("total-".concat(k));
        var limitEl = document.getElementById("limit-".concat(k));
        if (totalEl)
            totalEl.innerText = mBTLE.format.currency(stageCost);
        if (limitEl)
            limitEl.innerText = "Cap: ".concat(mBTLE.format.currency(stageCap));
    });
};
/* ========= v19.54 CONNECTIVE UI & Interaction Handlers ========= */
/* --- 1. UI Module: Project & Status Bar Resolution --- */
// Kept here as it's the specific implementation for the Header UI
function renderProjectManagement() {
    return __awaiter(this, void 0, void 0, function () {
        var container, projects, _a, menuItems, html;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    container = document.getElementById('project-management-container');
                    if (!container)
                        return [2 /*return*/];
                    if (!(mBT.data && mBT.data.getList)) return [3 /*break*/, 2];
                    return [4 /*yield*/, mBT.data.getList()];
                case 1:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = [];
                    _b.label = 3;
                case 3:
                    projects = _a;
                    projects.sort().reverse();
                    menuItems = [
                        { label: 'New Budget', icon: mBTAssets.plus, color: 'text-emerald-600', bg: 'hover:bg-emerald-50', action: 'project-new' },
                        { label: 'Duplicate Budget', icon: mBTAssets.copy, color: 'text-blue-600', bg: 'hover:bg-blue-50', action: 'project-duplicate' },
                        { label: 'Save as Blueprint', icon: mBTAssets.save, color: 'text-indigo-600', bg: 'hover:bg-indigo-50', action: 'blueprint-save' },
                        { label: 'Import Budget', icon: mBTAssets.cloud, color: 'text-purple-600', bg: 'hover:bg-purple-50', action: 'project-import-trigger' },
                        { label: 'Recycle Bin', icon: mBTAssets.trash, color: 'text-slate-500', bg: 'hover:bg-slate-50', action: 'project-recycle' },
                        { divider: true },
                        { label: 'Delete Budget', icon: mBTAssets.trash, color: 'text-rose-600', bg: 'hover:bg-rose-50', action: 'project-delete' }
                    ];
                    html = "\n            <div class=\"flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm relative z-50 w-full md:w-auto\">\n                <div class=\"relative group flex-grow md:flex-grow-0\">\n                    <select id=\"projectSelect\" data-action=\"project-switch\" class=\"w-full md:w-auto appearance-none bg-slate-50 border-none text-[10px] font-black uppercase tracking-widest text-slate-700 rounded-xl pl-3 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer min-w-[140px] transition-all hover:bg-slate-100\">\n        ";
                    if (projects.length === 0 && typeof currentProjectName !== 'undefined' && currentProjectName) {
                        html += "<option value=\"".concat(currentProjectName, "\" selected>").concat(currentProjectName, "</option>");
                    }
                    projects.forEach(function (p) {
                        var selected = (typeof currentProjectName !== 'undefined' && p === currentProjectName) ? 'selected' : '';
                        html += "<option value=\"".concat(p, "\" ").concat(selected, ">").concat(p, "</option>");
                    });
                    html += "   </select>\n                    <div class=\"pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 group-hover:text-slate-600\">\n                        <svg class=\"fill-current h-3 w-3\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\"><path d=\"M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z\"/></svg>\n                    </div>\n                </div>\n                <div class=\"relative flex-shrink-0\">\n                    <button onclick=\"const m=document.getElementById('fileMenuDropdown'); m.classList.toggle('hidden');\" class=\"flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 px-4 py-2.5 rounded-xl transition-all active:scale-95 group\">\n                        <span class=\"text-[10px] font-black uppercase tracking-widest\">File</span>\n                        <svg class=\"w-3 h-3 transition-transform group-hover:rotate-180\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M19 9l-7 7-7-7\"></path></svg>\n                    </button>\n                    <div id=\"fileMenuDropdown\" class=\"hidden absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200\" onmouseleave=\"this.classList.add('hidden')\">\n                        ".concat(menuItems.map(function (item) { return item.divider ? "<div class=\"h-px bg-slate-100 my-1\"></div>" : "<button data-action=\"".concat(item.action, "\" onclick=\"document.getElementById('fileMenuDropdown').classList.add('hidden')\" class=\"w-full text-left px-4 py-2.5 flex items-center gap-3 ").concat(item.color, " ").concat(item.bg, " transition-colors group\"><span class=\"opacity-70 group-hover:opacity-100 scale-90\">").concat(item.icon, "</span><span class=\"text-[9px] font-black uppercase tracking-widest\">").concat(item.label, "</span></button>"); }).join(''), "\n                    </div>\n                </div>\n                <input type=\"file\" id=\"importFile\" class=\"hidden\" accept=\".json,.moo,.zip\" data-action=\"project-import-file\">\n            </div>");
                    container.innerHTML = html;
                    return [2 /*return*/];
            }
        });
    });
}
function renderStatusBar() {
    var _a;
    var container = document.getElementById('statusBar');
    if (!container)
        return;
    // Logic Resolution: Interactive Status Bar (Tier 4)
    // Entry point for Audit Log (Tier 5). Pulsating dot indicates active recording.
    // Updated to remove legacy Undo/Redo and focus on Activity History.
    var isRecording = budget.activityLog && budget.activityLog.length > 0;
    // Tier 4 Logic: Prioritize Modern Audit Log > Legacy History Stack > Default
    var lastAction = "Ready to Go!";
    if (isRecording) {
        var lastEntry = budget.activityLog[budget.activityLog.length - 1];
        // Format: "ADD: Director" or "UPDATE: Production Fee"
        // Use Escaping to prevent XSS from user input
        var safeAction = mBT.ui.render.esc(lastEntry.action);
        var safeTarget = mBT.ui.render.esc(lastEntry.target);
        lastAction = "".concat(safeAction, ": ").concat(safeTarget);
    }
    else if (typeof historyStack !== 'undefined' && historyStack.length > 0) {
        lastAction = ((_a = historyStack[historyIndex]) === null || _a === void 0 ? void 0 : _a.description) || "Ready to Go!";
    }
    container.innerHTML = "\n            <div class=\"flex items-center justify-between w-full h-full px-2\">\n                <!-- Left: Status & Rec -->\n                <div class=\"flex items-center gap-3 overflow-hidden mr-4\">\n                     <div class=\"flex items-center gap-2 shrink-0\">\n                         <span class=\"relative flex h-2 w-2\">\n                            ".concat(isRecording ? '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>' : '', "\n                            <span class=\"relative inline-flex rounded-full h-2 w-2 ").concat(isRecording ? 'bg-red-500' : 'bg-slate-600', "\"></span>\n                         </span>\n                         <span class=\"text-[9px] font-mono text-slate-500 uppercase tracking-widest\">REC</span>\n                    </div>\n                    <div class=\"w-px h-3 bg-slate-800\"></div>\n                    <span class=\"truncate font-mono text-slate-400 text-[10px] uppercase tracking-widest\">").concat(lastAction, "</span>\n                </div>\n                \n                <!-- Right: Activity History Button -->\n                <button onclick=\"mBT.features.history.open()\" class=\"flex items-center gap-2 hover:text-blue-400 transition-colors group cursor-pointer shrink-0\" title=\"View Activity Log & Undo Changes\">\n                    <span class=\"text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors hidden sm:block\">Activity History</span>\n                    <div class=\"w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-slate-900 transition-all shadow-sm border border-slate-700\">\n                        <svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z\"/></svg>\n                    </div>\n                </button>\n            </div>");
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
function handleNewProjectSelection(e) { }
function handleImportFile(input) {
    var file = input.files[0];
    if (!file)
        return;
    var reader = new FileReader();
    reader.onload = function (e) {
        try {
            var data = JSON.parse(e.target.result);
            if (!data.projectName)
                throw new Error("Invalid file structure");
            mBT.data.importFile(input); // Delegate to new system
        }
        catch (err) {
            mBTME.alert("Import Failed", err.message);
        }
        input.value = '';
    };
    reader.readAsText(file);
}
window.importContactsCSV = function (input) {
    var file = input.files[0];
    if (!file)
        return;
    var reader = new FileReader();
    reader.onload = function (e) {
        var text = e.target.result;
        if (!text)
            return;
        var lines = text.split(/\r\n|\n/);
        if (lines.length < 2)
            return mBTME.alert("Error", "Invalid CSV format.");
        var headers = lines[0].split(',').map(function (h) { return h.trim(); });
        var contacts = [];
        var _loop_1 = function (i) {
            var line = lines[i].trim();
            if (!line)
                return "continue";
            var values = line.split(',');
            var obj = {};
            headers.forEach(function (h, idx) {
                var val = values[idx] ? values[idx].trim() : '';
                if (val.startsWith('"') && val.endsWith('"'))
                    val = val.slice(1, -1);
                obj[h] = val;
            });
            contacts.push(obj);
        };
        for (var i = 1; i < lines.length; i++) {
            _loop_1(i);
        }
        var count = mBTOG.ingest(contacts, 'contact');
        if (count > 0) {
            mBTME.alert("Success", "".concat(count, " new contacts imported."), function () {
                if (typeof showSettingsModal === 'function')
                    showSettingsModal('database', 'contacts');
            });
        }
        else {
            mBTME.alert("Info", "Import completed. No new contacts added.");
        }
        input.value = '';
    };
    reader.readAsText(file);
};
/* ================= v19.54 TIER 6: SYSTEM IGNITION & EVENTS ================= */
/* --- 1. OFFLINE ENDURANCE SERVICE (Service Worker Registration) --- */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
            .then(function (reg) {
            console.log('SW Synchronization active:', reg.scope);
            reg.onupdatefound = function () {
                var installingWorker = reg.installing;
                installingWorker.onstatechange = function () {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        mBTME.confirm("Update Available", "New production logic available! Synchronize environment now?", function () {
                            window.location.reload();
                        });
                    }
                };
            };
        })
            .catch(function (err) { return console.log('Service Worker initialization failure:', err); });
    });
}
/* --- 2. ACTION REGISTRY (The Nervous System Configuration) --- */
function registerCoreActions() {
    var _this = this;
    // A. Header / Project Actions
    mBT.core.action('project-switch', function (e, el) { return __awaiter(_this, void 0, void 0, function () {
        var originalText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (e.type !== 'change')
                        return [2 /*return*/];
                    if (!el.value) return [3 /*break*/, 2];
                    originalText = el.options[el.selectedIndex].text;
                    el.options[el.selectedIndex].text = "Loading...";
                    return [4 /*yield*/, mBT.data.load(el.value)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); });
    mBT.core.action('project-new', function () { return showNewProjectModal(); });
    mBT.core.action('project-duplicate', function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, mBT.data.duplicate()];
            case 1: return [2 /*return*/, _a.sent()];
        }
    }); }); });
    mBT.core.action('project-delete', function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!currentProjectName) return [3 /*break*/, 2];
                return [4 /*yield*/, mBT.data.deleteProject(currentProjectName)];
            case 1:
                _a.sent();
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    }); }); });
    // New File Menu Actions
    mBT.core.action('project-recycle', function () { if (typeof mBT.features.trash !== 'undefined')
        mBT.features.trash.open('projects'); });
    mBT.core.action('project-sync', function () { fetchExchangeRates(); mBTME.alert("Coming Soon", "Cloud Sync infrastructure is currently in development. Local exchange rates have been refreshed."); });
    mBT.core.action('project-import-trigger', function () { var input = document.getElementById('importFile'); if (input)
        input.click(); });
    mBT.core.action('project-import-file', function (e, el) { if (e.type === 'change')
        mBT.data.importFile(el); });
    // B. Global Utilities
    mBT.core.action('set-currency', function (e, el) {
        displayCurrency = el.value;
        localStorage.setItem("".concat(storageKeyPrefix, "currency"), displayCurrency);
        if (typeof mBTLE !== 'undefined')
            mBTLE.reconcile();
        if (typeof render === 'function')
            render();
    });
    mBT.core.action('backup-env', function () { if (typeof mBTPublisher !== 'undefined')
        mBTPublisher.toMoo(); });
    mBT.core.action('print-pdf', function () { return window.print(); });
    mBT.core.action('export-xlsx', function () { return mBTME.alert("Coming Soon", "Excel export is currently being built. All features will be free to use."); });
    mBT.core.action('publish-modal', function () { return showPublishModal(); });
    // C. Footer / Global Modals
    mBT.core.action('stages-modal', function () { return showStagesModal(); });
    mBT.core.action('docs-modal', function () { return showDocumentsModal(); });
    mBT.core.action('settings-modal', function () { return showSettingsModal(); });
    mBT.core.action('support-modal', function () { return showCoffeeWidget(); });
    // D. Budget Interaction (The Synapse)
    mBT.core.action('section-toggle', function (e, el) { return handleToggleSection(el.dataset.id, el); });
    mBT.core.action('section-add', function (e, el) { return showItemSelectorModal(el.dataset.id); });
    mBT.core.action('row-delete', function (e, el) { return handleRemoveItem(el.dataset.section, el.dataset.id); });
    mBT.core.action('row-lock', function (e, el) {
        var _a;
        var item = (_a = budget.sections[el.dataset.section]) === null || _a === void 0 ? void 0 : _a.items.find(function (i) { return i.id === el.dataset.id; });
        if (item) {
            item.rateType = item.rateType === 'fixed' ? 'negotiable' : 'fixed';
            saveBudget();
            render(); // Full render needed to swap icon state
        }
    });
    // E. Personnel Actions
    mBT.core.action('crew-toggle', function (e, el) {
        var _a, _b;
        var itemId = ((_a = el.closest('tr')) === null || _a === void 0 ? void 0 : _a.dataset.itemId) || el.dataset.id;
        var section = ((_b = el.closest('tr')) === null || _b === void 0 ? void 0 : _b.dataset.section) || el.dataset.section;
        var item = null;
        if (section && budget.sections[section]) {
            item = budget.sections[section].items.find(function (i) { return i.id === itemId; });
        }
        // Enhanced Interaction: If unassigned, go straight to Profile/Import
        if (!item || !item.crew || !item.crew.name) {
            openCrewProfile(el, e, itemId, section);
        }
        else {
            toggleCrewPopup(el, e);
        }
    });
    mBT.core.action('crew-profile', function (e, el) { return openCrewProfile(el, e, el.dataset.id, el.dataset.section); });
    // --- NEW: Registry Expansion (Instruction Set 4) ---
    // 1. Export Bridge
    mBT.core.action('export', function (e, el) {
        var type = el.dataset.type;
        if (document.getElementById('publishModal'))
            mBTME.close('publishModal');
        if (typeof mBTPublisher === 'undefined')
            return;
        if (type === 'pdf')
            mBTPublisher.format.professionalPdf(budget);
        else if (type === 'moo')
            mBTPublisher.io.saveMoo(budget);
        else if (type === 'bundle')
            mBTPublisher.io.saveBundle(budget);
        else if (type === 'html')
            mBTPublisher.format.htmlStandalone('budget-sections', budget.projectName);
        else if (type === 'xlsx')
            mBTPublisher.format.professionalXlsx(budget);
    });
    // 2. Navigation
    mBT.core.action('nav-settings', function (e, el) { return mBT.features.settings.open(el.dataset.tab); });
    mBT.core.action('nav-settings-db', function (e, el) { return mBT.features.settings.open('database', el.dataset.tab); });
    // 3. Studio Engine
    mBT.core.action('studio-undo', function () { if (mBTDB.undo)
        mBTDB.undo(); });
    mBT.core.action('studio-redo', function () { if (mBTDB.redo)
        mBTDB.redo(); });
    mBT.core.action('studio-sync', function () { return mBTDB.syncFromBudget(); });
    mBT.core.action('studio-sync-prev', function () { return mBTDB.syncFromPrevious(); });
    mBT.core.action('studio-preview', function () { return mBTDB.openPreviewSelector(); });
    mBT.core.action('studio-snapshot', function () { return mBTDB.snapshotDoc(); });
    mBT.core.action('studio-template', function () { return mBTDB.saveTemplate(); });
    mBT.core.action('studio-toggle-edit', function () { return mBTDB.toggleEditMode(); });
    mBT.core.action('widget-toggle-view', function (e, el) { return mBTDB.toggleVertical(el.dataset.id); });
    mBT.core.action('widget-assistant-fill', function (e, el) { return mBTDB.assistantFill(el.dataset.id, el.dataset.docId); });
    mBT.core.action('widget-autofill', function (e, el) { return mBTDB.autoFillWidget(el.dataset.type, el.dataset.docId); });
    mBT.core.action('widget-delete', function (e, el) { return mBTDB.deleteWidget(el.dataset.id); });
    // --- NEW: Documents Hub Actions ---
    mBT.core.action('nav-docs', function (e, el) { return mBT.features.documents.openVault(el.dataset.tab); });
    mBT.core.action('doc-options', function (e, el) { return mBT.features.documents.showOptions(el.dataset.id); });
    mBT.core.action('doc-duplicate', function (e, el) { return mBTDB.snapshotDoc(el.dataset.id); });
    mBT.core.action('doc-archive', function (e, el) { return window.handleDocTrash(el.dataset.id); });
    // 4. Trash Logic
    mBT.core.action('nav-trash', function (e, el) { return mBT.features.trash.open(el.dataset.tab); });
    mBT.core.action('trash-toggle', function (e, el) { return mBT.features.trash.toggleItem(el.dataset.id); });
    mBT.core.action('trash-toggle-all', function (e, el) { return mBT.features.trash.toggleAll(el.checked); });
    mBT.core.action('trash-bulk', function (e, el) { return mBT.features.trash.performAction(el.dataset.type); });
    mBT.core.action('trash-single', function (e, el) { return mBT.features.trash.singleAction(el.dataset.type, el.dataset.id); });
    // F. Stage Actions
    mBT.core.action('stage-update', function (e, el) {
        updateStageItem(el.dataset.id, el.dataset.section, el.dataset.stage, el.dataset.field, el.value);
    });
    // G. History (Tier 4/5/6 Alignment)
    // Logic Resolution: Prioritize Tier 2 Namespace if available
    mBT.core.action('undo', function () {
        if (mBT.data.history && typeof mBT.data.history.undoSnapshot === 'function')
            mBT.data.history.undoSnapshot();
        else if (typeof handleUndo === 'function')
            handleUndo();
    });
    mBT.core.action('redo', function () {
        if (mBT.data.history && typeof mBT.data.history.redoSnapshot === 'function')
            mBT.data.history.redoSnapshot();
        else if (typeof handleRedo === 'function')
            handleRedo();
    });
}
/* --- 3. GLOBAL EVENT ORCHESTRATION --- */
function bindAppEventListeners() {
    var footer = document.querySelector('footer');
    // Initialize Registry
    registerCoreActions();
    if (!document.body.dataset.listenersBound) {
        document.body.dataset.listenersBound = 'true';
        // --- Master Router (Delegation) ---
        var router = function (e) {
            if (mBT.core.route(e))
                return;
            var target = e.target;
            if (target.id === 'loginBtn')
                handleLogin();
            if (target.closest('#openAiToolsBtn'))
                showAIToolsModal();
        };
        document.body.addEventListener('click', router);
        document.body.addEventListener('change', router);
        // --- Keyboard Shortcuts (Tier 6 Wiring) ---
        document.body.addEventListener('keydown', function (e) {
            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (mBT.core.actions['undo'])
                    mBT.core.actions['undo']();
            }
            // Redo: Ctrl+Y
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                if (mBT.core.actions['redo'])
                    mBT.core.actions['redo']();
            }
        });
        // --- Real-time Input Handling ---
        document.body.addEventListener('input', function (e) {
            var input = e.target;
            if (input.id === 'projectName') {
                handleProjectNameChange(e);
                return;
            }
            if (['discountPercentage', 'contingencyPercentage', 'salesTaxPercentage'].includes(input.id)) {
                budget[input.id] = parseFloat(input.value) || 0;
                if (typeof mBTLE !== 'undefined')
                    mBTLE.reconcile();
                return;
            }
            if (input.dataset.field) {
                if (input.dataset.action === 'stage-update') {
                    if (typeof updateStageItem === 'function')
                        updateStageItem(input.dataset.id, input.dataset.section, input.dataset.stage, input.dataset.field, input.value, true);
                }
                else if (!input.dataset.action) {
                    handleUpdate(input.dataset.section, input.dataset.id, input.dataset.field, input.value, 'User Input');
                }
            }
        });
    }
    if (footer) {
        footer.addEventListener('click', function (e) {
            var btn = e.target.closest('button');
            if (!btn)
                return;
            if (btn.id === 'stagesFooterBtn')
                mBT.core.actions['stages-modal']();
            else if (btn.id === 'docsFooterBtn')
                mBT.core.actions['docs-modal']();
            else if (btn.id === 'mainActionBtn')
                mBT.core.actions['settings-modal']();
            else if (btn.id === 'secondaryActionBtn')
                mBT.core.actions['publish-modal']();
            else if (btn.id === 'footerCoffeeBtn')
                mBT.core.actions['support-modal']();
        });
    }
    window.addEventListener('online', resolveConnectivityStatus);
    window.addEventListener('offline', resolveConnectivityStatus);
}
/* --- 4. INFRASTRUCTURE TELEMETRY --- */
function resolveConnectivityStatus() {
    var isOnline = navigator.onLine;
    var btn = document.getElementById('loginBtn');
    if (btn) {
        btn.className = "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 shadow-sm flex-shrink-0 ".concat(isOnline ? 'border-emerald-400 bg-emerald-50 text-emerald-600' : 'border-rose-400 bg-rose-50 text-rose-600');
        btn.title = isOnline ? "Studio Online" : "Studio Offline";
        btn.innerHTML = mBTAssets.user;
    }
    var aiBtn = document.getElementById('openAiToolsBtn');
    if (aiBtn) {
        aiBtn.className = "p-3 text-white rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center ".concat(isOnline ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-400 cursor-not-allowed');
        if (!isOnline)
            aiBtn.title = "AI Consultant Offline";
    }
}
// --- NEW: Support Widget (Buy Me a Coffee) ---
function showCoffeeWidget() {
    var content = "\n            <div class=\"text-center p-6 bg-yellow-50 min-h-[300px] flex flex-col items-center justify-center\">\n                <div class=\"w-20 h-20 bg-[#FFDD00] rounded-3xl flex items-center justify-center text-4xl shadow-xl mb-4 text-black border-4 border-white animate-bounce [&>svg]:w-10 [&>svg]:h-10\">\n                    ".concat(mBTAssets.coffee, "\n                </div>\n                <h3 class=\"text-xl font-black uppercase tracking-tighter text-slate-900 mb-2\">Fuel the Code</h3>\n                <p class=\"text-xs font-bold text-slate-500 mb-6 max-w-xs leading-relaxed\">\n                    mooBudget is free, offline-first, and built for the Caribbean industry. If it saves you time, consider buying a coffee for the dev team.\n                </p>\n                <div class=\"space-y-3 w-full max-w-xs\">\n                    <a href=\"https://buymeacoffee.com/jaysonmy\" target=\"_blank\" class=\"flex items-center justify-center gap-2 w-full py-4 bg-[#FFDD00] text-black rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-transform active:scale-95\">\n                        Open Support Page\n                    </a>\n                    <button onclick=\"mBTME.close('coffeeModal')\" class=\"w-full py-3 bg-white border border-slate-200 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors\">\n                        Maybe Later\n                    </button>\n                </div>\n            </div>");
    mBTME.open('coffee', '', content, 'max-w-sm', { hideHeader: true, noPadding: true });
}
// --- NEW: Distribution Share Selector (Preview Handler) ---
window.openDocumentShareSelector = function (docId) {
    var doc = budget.documents.find(function (d) { return d.id === docId; });
    if (!doc)
        return;
    // Generate Share Message
    var shareText = (typeof mBTPublisher !== 'undefined' && mBTPublisher.comm)
        ? mBTPublisher.comm.generateShareSheet(doc)
        : "Reviewing ".concat(doc.label);
    // Platform Links
    var waLink = "https://wa.me/?text=".concat(encodeURIComponent(shareText));
    var mailLink = "mailto:?subject=".concat(encodeURIComponent("Document Review: " + doc.label), "&body=").concat(encodeURIComponent(shareText));
    var content = "\n            <div class=\"p-6 bg-white\">\n                <div class=\"text-center mb-6\">\n                    <div class=\"w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-xl\">\n                        ".concat(mBTAssets.paperPlane, "\n                    </div>\n                    <h3 class=\"text-sm font-black uppercase tracking-widest text-slate-900\">Distribute Document</h3>\n                    <p class=\"text-[10px] text-slate-400 font-bold mt-1\">").concat(doc.label, "</p>\n                </div>\n                \n                <div class=\"grid grid-cols-2 gap-3 mb-4\">\n                    <a href=\"").concat(waLink, "\" target=\"_blank\" class=\"flex flex-col items-center gap-2 p-4 bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl hover:bg-[#25D366]/20 transition-all group no-underline\">\n                        <div class=\"text-[#25D366] text-2xl group-hover:scale-110 transition-transform\">").concat(mBTAssets.wa, "</div>\n                        <span class=\"text-[9px] font-black uppercase tracking-widest text-[#25D366] group-hover:text-[#128c7e]\">WhatsApp</span>\n                    </a>\n                    <a href=\"").concat(mailLink, "\" target=\"_blank\" class=\"flex flex-col items-center gap-2 p-4 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-all group no-underline\">\n                        <div class=\"text-blue-500 text-2xl group-hover:scale-110 transition-transform\">").concat(mBTAssets.mail, "</div>\n                        <span class=\"text-[9px] font-black uppercase tracking-widest text-blue-600\">Email</span>\n                    </a>\n                </div>\n                \n                <div class=\"bg-slate-50 p-3 rounded-xl border border-slate-100\">\n                    <label class=\"block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5\">Quick Copy Message</label>\n                    <div class=\"flex gap-2\">\n                        <input type=\"text\" value=\"").concat(shareText, "\" class=\"flex-grow bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none\" readonly>\n                        <button onclick=\"navigator.clipboard.writeText('").concat(shareText.replace(/'/g, "\\'"), "'); this.innerHTML='Copied!';\" class=\"px-3 bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-300 transition-colors\">Copy</button>\n                    </div>\n                </div>\n            </div>");
    mBTME.open('shareSelector', 'Share', content, 'max-w-sm', { hideHeader: true, noPadding: true });
};
function handleLogin() {
    if (navigator.onLine) {
        mBTME.confirm("Login", "Establish secure connection to Moo Studio Cloud infrastructure?", function () {
            mBTME.alert("Connected", "Environment Authenticated.");
        });
    }
}
function injectFooterIcons() {
    var mapping = {
        'icon-stages': mBTAssets.grid,
        'icon-docs': mBTAssets.file,
        'icon-main-action': mBTAssets.gear,
        'icon-secondary-action': mBTAssets.paperPlane,
        'icon-coffee': mBTAssets.coffee
    };
    Object.entries(mapping).forEach(function (_a) {
        var id = _a[0], svg = _a[1];
        var el = document.getElementById(id);
        if (el)
            el.innerHTML = svg;
    });
}
/* --- 5. GLOBAL BOOT TRIGGER --- */
// Logic Resolution: Global Bridge Hooks for external calls
window.showBinModal = function () { if (typeof mBT.features.trash !== 'undefined')
    mBT.features.trash.open('documents'); };
window.handleDocTrash = function (id) { if (typeof mBT.features.trash !== 'undefined')
    mBT.features.trash.trashDocument(id); };
/* ======= END OF mBT ========== */
