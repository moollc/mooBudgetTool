# mBT — Moo Budget Tool

**Offline-first film production budget management. No server. No account. Just open and work.**

mBT is a Progressive Web App for film producers, line producers, and production managers. It runs entirely from a single folder — no internet required after the first load, no installation, no subscriptions.

![mBT Dashboard](screenshots/mBT-dashboard.png)

---

## Quick Start

**Option A — Direct (simplest):**
1. Download or clone this repository
2. Open `dist/index.html` in Chrome, Edge, or Firefox
3. That's it — no server, no build step

**Option B — From source:**
1. Clone the repo
2. Open `src/core/index.html` in a browser
3. Or run `scripts/bundle.bat` (Windows) to build a clean `dist/`

**Option C — Install as PWA:**
1. Open `dist/index.html` in Chrome
2. Browser menu → "Install app" / "Add to Home Screen"
3. Launches as a standalone app, fully offline

---

## Features

### Budget Management
- **Database Builder** — 20 document templates covering every production document: top sheets, detail budgets, call sheets, purchase orders, petty cash, shooting schedules, script breakdowns, continuity logs, movement orders, and funding pitch decks
- **Stages** — model production phases (Pre-roll, Principal, Post/Wrap), allocate budgets per stage, track variance
- **Publisher** — export any document as PDF, Excel (XLSX), standalone HTML, or `.moo` project file
- **Export Package** — batch-export all financial documents with a cover page in one click

### Crew & Rates
- **Contacts** — crew and vendor registry with department grouping, rate tracking, phone and email
- **OpenGate** — Jamaica industry rate reference database (hourly, daily, weekly rates by department)

### Intelligence
- **AI Analytics** — local budget analysis: burn rate, forecast, risk assessment, optimization suggestions, spending patterns, executive summary — no API key required
- **LLM Chat** — connect to LM Studio (local), OpenAI-compatible endpoints, or Claude API for natural language budget queries with full project context injected automatically

### Platform
- **Offline-first** — IndexedDB stores all data locally; works indefinitely without internet
- **Supabase Sync** — optional cloud backup and cross-device sync (Settings → Cloud Sync)
- **PWA** — installs to home screen on Android and desktop; survives browser refreshes and restarts
- **Dark mode** — full dark theme toggle
- **Mobile-responsive** — bottom navigation mode, safe-area insets, touch-sized targets

---

## Architecture

```
mBT/
├── index.html              # Shell entry point
├── sw.js                   # Service worker (offline cache)
├── manifest.json           # PWA manifest
├── src/
│   ├── core/
│   │   ├── index.html      # Navigation shell (routes, nav, panels)
│   │   ├── mBT.core.js     # Hash router, theme, nav, settings
│   │   └── services/       # OpenGate.js, Contacts.js, Security.js
│   ├── scripts/
│   │   ├── storage.js      # IndexedDB layer (mBTMonolithDB)
│   │   └── engine/
│   │       ├── mbtle.js    # Math & currency engine
│   │       ├── publisher.js # 20-template document engine
│   │       └── totalizer.js # Budget reconciliation
│   ├── tools/
│   │   ├── db/             # Document Builder (mBTDB)
│   │   ├── stages/         # Stage modelling
│   │   ├── publisher/      # Export hub
│   │   ├── contacts/       # Crew registry
│   │   ├── ai/             # AI analytics + LLM chat
│   │   └── rsi/            # RSI health engine + DEBT tracker
│   ├── config/             # AI config, Supabase config
│   ├── services/           # AI context, patterns, reports, sync
│   └── lib/                # Vendored libraries (offline, no CDN)
├── dist/                   # Built release (run bundle.bat to rebuild)
├── docs/
│   └── supabase/           # Schema + self-host setup guide
└── scripts/
    ├── bundle.bat           # Windows build script
    └── bundle.ps1           # PowerShell build script
```

**Stack:** Vanilla JS — no framework, no package.json, no build tools required to run. Libraries (jsPDF, html2pdf, XLSX, localforage, Tailwind, Supabase) are vendored locally in `src/lib/`.

**Data:** IndexedDB database named `mBTMonolithDB` with stores for projects, stages, executions, og_ref, contacts, and sessions. Optional Supabase sync via Row Level Security policies (see `docs/supabase/`).

**Routing:** Hash-based (`#db`, `#stages`, `#publisher`, etc.). Tool panels render inline in the shell; the Database Builder and other full tools load as iframes.

---

## Document Templates

| Category | Templates |
|----------|-----------|
| Financial | Top Sheet, Detail Budget, Cost Report, Purchase Order, Petty Cash |
| Production | Call Sheet, Day Out of Days, Location Agreement, Equipment List, Crew Deal Memo |
| Scheduling | Script Breakdown, Shooting Schedule, Continuity Log, Movement Order |
| Legal/Admin | Release Form, NDA, Permit Request, Insurance Summary |
| Funding | Funding Pitch Deck |
| Reference | Production Bible |

All templates are editable inline, preview in browser, and export to PDF via html2pdf.

---

## Supabase Sync (Optional)

mBT works 100% offline. Supabase sync is optional for cloud backup or multi-device use.

See [`docs/supabase/SETUP.md`](docs/supabase/SETUP.md) for the setup guide.

---

## AI Features

### Local Analytics (no API key needed)
Open the AI tool and use quick commands:
- `budget` — total, spent, remaining, utilization
- `forecast` — 7-day projection with trend
- `risk` — risk level with critical flags
- `suggest` — cost-saving opportunities vs industry benchmarks
- `patterns` — spending pattern detection and anomalies
- `executive` — one-page executive summary

### LLM Chat (requires provider)
Switch to the **LLM Chat** tab, select a provider:
- **LM Studio** — run any GGUF model locally at `localhost:1234`
- **OpenAI-compatible** — any endpoint that accepts the OpenAI chat format
- **Claude API** — Anthropic Claude models via API key

Budget context (project name, total, stage breakdown) is injected as the system prompt automatically.

---

## Browser Support

| Browser | Supported |
|---------|-----------|
| Chrome 90+ | Full |
| Edge 90+ | Full |
| Firefox 88+ | Full |
| Safari 14+ | Full (PWA install via Share → Add to Home Screen) |

Requires IndexedDB API. Works on Android Chrome, iOS Safari, and desktop browsers.

---

## Building from Source

```bat
cd mBT
scripts\bundle.bat
```

Output goes to `dist/`. The script copies all source files, verifies critical paths, and produces a clean portable folder.

---

## Contributing

mBT is open-source under the MIT license. Issues and PRs welcome.

**Before contributing:**
- No framework dependencies — vanilla JS only
- No CDN references — all libs must be in `src/lib/`
- No `window.parent` in tools — use `window.mBT.storage` directly
- XSS: all user-controlled strings through `esc()` before DOM insertion
- No emoji in UI — inline SVGs only

---

## License

MIT — see [LICENSE](LICENSE).

Copyright (c) 2026 moollc
