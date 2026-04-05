# LIBRARY_VERSIONS.md — mBT Vendored Dependency Audit

**Project:** mBT (Moo Budget Tool)  
**Location:** `mBT/src/lib/`  
**Last Audited:** 2026-04-03  
**Constraint:** All libraries must be ES5-compatible and loadable from `file://` protocol.

---

## Vendored Libraries

| Library | Filename | Size | Purpose | Known Latest | Status |
|---|---|---|---|---|---|
| GridStack | `gridstack-all.js` | 79 KB | Drag-and-drop widget grid for Document Studio | v10.x | ⚠️ Audit Required |
| GridStack CSS | `gridstack.min.css` | 4 KB | GridStack base styles | — | ✅ Bundled with JS |
| Lucide Icons | `lucide.min.js` | 258 KB | SVG icon system | v0.469+ | ⚠️ Audit Required |
| Tailwind CSS | `tailwind.min.js` | 265 KB | Utility CSS (Play CDN, offline) | v3.x | ⚠️ Pin version |
| Mammoth | `mammoth.browser.min.js` | 628 KB | .docx → HTML conversion | v1.8.x | ⚠️ Audit Required |
| html2pdf | `html2pdf.bundle.min.js` | 884 KB | PDF export from DOM | v0.10.x | ⚠️ Audit Required |
| SortableJS | `Sortable.min.js` | 44 KB | Drag-to-sort lists | v1.15.x | ⚠️ Audit Required |
| jsPDF | `jspdf.umd.min.js` | 356 KB | PDF generation engine | v2.5.x | ⚠️ Audit Required |
| jsPDF AutoTable | `jspdf.plugin.autotable.min.js` | 35 KB | Table plugin for jsPDF | v3.8.x | ⚠️ Audit Required |
| html2canvas | `html2canvas.min.js` | 194 KB | DOM → canvas snapshots | v1.4.x | ⚠️ Audit Required |
| SheetJS (XLSX) | `xlsx.full.min.js` | 861 KB | Excel import/export | v0.18.x | ⚠️ Audit Required |
| Marked | `marked.min.js` | 39 KB | Markdown → HTML parser | v12.x | ⚠️ Audit Required |
| PDF.js | `pdf.min.js` | 313 KB | PDF rendering in browser | v4.x | ⚠️ Audit Required |
| localForage | `localforage.min.js` | 29 KB | Offline IndexedDB wrapper | v1.10.x | ⚠️ Audit Required |
| JSZip | `jszip.min.js` | 95 KB | ZIP file creation | v3.10.x | ⚠️ Audit Required |
| Supabase JS | `supabase.min.js` | 163 KB | Backend realtime + auth client | v2.x | ⚠️ Audit Required |

---

## Audit Notes

> [!WARNING]
> All 16 libraries are vendored locally for `file://` compatibility. Version pinning was not enforced at time of bundling — exact versions unconfirmed. Run the verification steps below to identify staleness.

### How to Verify Versions

1. Open each `.min.js` file and search for a version string near the top (e.g., `* @version`, `version:`, `var VERSION =`).
2. Cross-reference with the library's GitHub releases page.
3. Update this table's "Known Latest" column with the pinned version once confirmed.

### Replacement Policy

- Libraries should only be updated when a **security vulnerability** is identified, or when a **new feature** is needed that requires a newer version.
- Before replacing any library, verify that the new version does not introduce ES6+ dependencies that break `file://` loading.
- Test in Chrome, Firefox, and Safari after any library update.

---

## Total Vendored Footprint

| Metric | Value |
|---|---|
| Total files | 16 |
| Total size (uncompressed) | ~4.2 MB |
| Largest single library | html2pdf (884 KB) |
| Smallest single library | GridStack CSS (4 KB) |
