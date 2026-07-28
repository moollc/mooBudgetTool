# mBT User Guide

**Moo Budget Tool — Film Production Budget Manager**

> [!WARNING]
> **BETA VERSION**: This software is still being tested. While we try to be 100% accurate, bugs can happen. **Always check your final totals yourself** before showing your budget to investors or signing off on final paperwork. 

---

## Getting Started

### Open on Desktop
1. Download or clone the repository
2. Serve the folder with any static file server (e.g. `npx http-server . -p 3000`)
3. Open `http://localhost:3000/index.html` — after the first load it works offline

Opening `index.html` straight from disk works for a quick look, but offline caching and app installation need it served over HTTP.

### Install as Desktop App (Chrome / Edge)
1. Open the served `index.html` in Chrome or Edge
2. Look for the install icon in the address bar, or go to **menu → Install app**
3. mBT installs as a standalone window — launches without opening a browser tab

### Install on Android (Add to Home Screen)
1. Open the served `index.html` in **Chrome for Android**
2. Tap the three-dot menu → **Add to Home Screen**
3. Tap **Add** — mBT appears on your home screen like a native app
4. Works fully offline after the first load

### Install on iPhone / iPad (iOS Safari)
1. Open the served `index.html` in **Safari**
2. Tap the **Share** button (box with arrow)
3. Scroll down → **Add to Home Screen**
4. Tap **Add** — the app icon appears on your home screen

---

## Navigation

mBT uses a floating dock at the bottom of the screen: Stages, Docs, Crew, Undo/Redo, Settings, Calendar, Publish, and Support.

- **Auto-Hide Nav** (Settings → General) slides the dock away when idle — tap anywhere to bring it back
- **Navigation Visibility → Manage** (Settings → General) lets you show or hide individual dock buttons

---

## Feature Tour

### Database (DB)
The document builder. Select a template from the left panel, fill in the editor, preview on the right.

**How to use:**
1. Click any template card on the left (e.g. "Call Sheet")
2. Fill in the fields — sections, times, crew, locations
3. Click **Preview** to see the rendered document
4. Click **PDF** to export, or **Save** to keep in your project

**Export options in the toolbar:**
- **PDF** — rendered via html2pdf (print-quality)
- **PDF (Alt)** — jsPDF with auto-table (spreadsheet-style)
- **XLSX** — Excel-compatible spreadsheet
- **Package** — batch export of all financial docs with a cover page

### Stages
Model your production budget by phase.

1. Create stages: Pre-roll, Principal, Post/Wrap (or your own)
2. Set a budget per stage
3. As you allocate, the burn ring shows utilization
4. Variance tracker highlights over/under

### Publisher
The export hub. Access all 20 templates and export formats in one place.

- **Professional PDF** — formatted budget document
- **Excel / XLSX** — editable spreadsheet
- **Standalone HTML** — self-contained file you can email or archive
- **Save .moo** — project backup file

### Contacts
Crew and vendor registry.

- Add crew with name, department, role, rate, phone, email
- Filter by department tab
- Print a full directory (toolbar → Print)
- Rate lookup syncs with the OpenGate database

### OpenGate
Jamaica industry rate reference. Hourly, daily, and weekly rates by department.

Use it to sanity-check quoted rates or populate crew deal memos.

### AI Assistant
Two modes:

**Analytics tab** (no API key needed)
- Type `budget`, `forecast`, `risk`, `suggest`, `patterns`, or `executive`
- Or click the quick command buttons
- Reads your active project data from IndexedDB

**LLM Chat tab** (requires a provider)
- Select a provider: LM Studio, OpenAI-compatible, or Claude API
- Click **Settings** to enter your endpoint URL and API key
- Toggle "Inject budget context" to include your project data in the system prompt
- Ask anything: "What's my biggest risk?", "Where can I cut costs?", "Summarise the production budget"

**LM Studio setup (free, local):**
1. Download LM Studio from lmstudio.ai
2. Download any GGUF model (Llama, Mistral, Phi, etc.)
3. Start the local server (default: `http://localhost:1234`)
4. In mBT AI → Settings, set endpoint to `http://localhost:1234/v1/chat/completions`
5. Leave API key blank

### Settings
- **Currency** — set display currency (JMD, USD, GBP, etc.)
- **Dark Mode** — toggle dark/light theme
- **Auto-Hide Nav / Navigation Visibility** — dock behavior and which buttons show
- **Cloud Sync** — connect to Supabase for cross-device backup
- **AI Settings** — configure LLM endpoint and API key

---

## Data & Storage

All your data is saved in your browser's **IndexedDB** — it stays on your device unless you explicitly sync, export, or use an AI feature.

**When AI features send data out:** AI is off until you add your own API key. Once you do, the questions you ask and the budget details needed to answer them are sent to that provider (OpenAI, Gemini, Anthropic, OpenRouter, etc.) along with your key. Rate guides, templates, and all other budget work stay local. If you want AI without anything leaving your machine, point Settings → AI at a local LM Studio endpoint.

**To back up your data:**
- Publisher → Save `.moo` file to your computer
- Settings → Cloud Sync (requires Supabase account — see below)

**To restore:**
- Drag a `.moo` file onto the app, or use Publisher → Import

**Storage location:** browser storage for the domain/file path you opened mBT from. If you move the folder to a different path, you start fresh (IndexedDB is path-scoped on `file://`).

---

## Cloud Sync (Supabase)

mBT can sync to a free Supabase project for backup and cross-device access.

1. Create a free account at supabase.com
2. Follow the setup guide: [`docs/supabase/SETUP.md`](docs/supabase/SETUP.md)
3. In mBT: Settings → Cloud Sync → enter your Supabase URL and anon key

Your data remains private — Row Level Security ensures each user only sees their own data.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank white screen on open | Make sure you're opening `index.html` directly (not a subfolder). Try Chrome or Edge. |
| Data not saving | IndexedDB must be available. Don't open from a zip archive — extract first. |
| App shows old version after update | Go to browser Settings → Clear site data for the file path, then reopen |
| AI tab shows "Could not reach provider" | Check your LM Studio server is running. In AI → Settings, verify the endpoint URL. |
| PDF export is blank or cut off | Make sure you're on the Preview tab before exporting. Try the PDF (Alt) button for tables. |
| Icons not showing | Open from the repository root, not a renamed or partial copy. Relative paths must resolve. |
| Bottom dock missing | Settings → General → Navigation Visibility → Manage, or disable Auto-Hide Nav |
| Installed PWA opens wrong page | Uninstall the app, clear browser cache, reinstall from the current `index.html` location |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send AI message |
| `Enter` (in table row) | Confirm edit |
| Browser zoom (`Ctrl +/-`) | Scale the interface |

---

## Mobile Tips (Note 20 / Android)

- Use **landscape mode** for the Database Builder — tables are data-dense and benefit from width
- Bottom nav auto-collapses after 8 seconds — tap anywhere to expand it again
- Touch and hold on table rows to scroll horizontally
- AI message boxes grow with the viewport — rotate to landscape for more chat space
- The app works fully offline once loaded — no Wi-Fi needed on set

---

## Requirements

- Chrome 90+, Edge 90+, Firefox 88+, or Safari 14+
- IndexedDB API (available in all modern browsers)
- ~50MB free browser storage for projects
- For LLM Chat: a running LM Studio instance or API key for an external provider

---

## License

MIT — Copyright (c) 2026 moollc
