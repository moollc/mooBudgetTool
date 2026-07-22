# mBT: Where your data lives, and what that means

A short, practical guide for film and event producers. This is not a legal policy. For legal terms, see `PrivacyPolicy.md` and `UserAgreement.md` in the mBT root. This page explains, in plain language, what mBT stores, where it goes, and the real tradeoffs when you use cloud sync or AI features.

**Read time:** a few minutes.

---

## The short version

- **By default, mBT keeps your work on your own device** (in the browser). mBT does not need an account just to build a budget offline.
- **If you turn on collaboration / cloud sync**, copies of project data also live on the cloud database (Supabase), limited to people you invite to that project.
- **If you configure your own AI provider API key** (OpenAI, Gemini, and so on) and use AI chat, fill, or analysis, the relevant prompt content and that key are sent to **that third-party AI company**, not to an mBT-owned AI backend.
- **Secrets** (API keys, login tokens) sit in browser storage on your device in a form that any program or person with access to that browser profile can read.

---

## What data mBT stores, and where

### On your device (always, for normal local use)

Typical production data includes:

- **Budgets and line items** (amounts, descriptions, sections, stages)
- **Crew and contact details** (names, phone numbers, emails, and related notes)
- **Documents and generated assets** you create in the app
- **AI assistant chat history** for a project (when you use the assistant)

This lives in the browser, primarily through **IndexedDB** via a library called localforage. Budget records use keys with the prefix `prodBudget_v5_`. On supported browsers, mBT may also keep a copy in **OPFS** (Origin Private File System) for speed, still on the same device. Assistant chat history is stored in the browser under keys prefixed `mbt_assistant_chat_`.

**If you never sign in for cloud / collab and never use external AI**, that data stays local. Clearing site data for mBT in the browser can erase local projects unless you exported a file or already synced to the cloud.

### On the cloud (only when you opt into collab / cloud sync)

When you use collaboration or cloud sync and are signed in, project payloads are also stored on **Supabase**. Project budget content is held in a `budget_data` field (JSONB) on the `projects` table. Membership (who can open or edit a project) is enforced server-side with roles such as owner, editor, and viewer.

**Local-only mode:** data on the device; no project copy in the cloud for that workflow.

**Collab / cloud mode:** data still exists on the device for offline use, **and** a server-side copy exists for the people who are members of that project. Turning collab on changes *where a second copy lives*, not only the UI.

---

## AI features: what they send, and where

mBT supports **bring your own (BYO)** AI providers. You paste an API key in Settings. Supported chat-style providers in the app today include:

- Google Gemini  
- OpenAI  
- DeepSeek  
- Grok (xAI)  
- Anthropic  
- OpenRouter  
- LM Studio (local server on your machine)

When you use AI Fill, LLM chat, or other features that call the model, mBT sends:

1. **The prompt content** for that request (which can include budget figures, line-item text, contact notes, or other project context depending on what you ask), and  
2. **Your configured API key** for that provider  

to **that provider’s servers** (for example OpenAI or Google), using the endpoints those products publish. Traffic does **not** go through an mBT-operated “AI server” that holds your key for you. mBT is the client app that calls the provider you chose.

**Important correction to older docs:** it is **not** true that “no data is sent to external services” when AI features are active with a cloud provider key. If you never configure a key and never use those features, that path does not send project data out. **LM Studio** is the main option that keeps chat on your own machine (or your own local network endpoint), as long as you do not also point other features at a cloud provider.

Image generation may use separate settings (including options such as Pollinations). Same rule of thumb: whatever provider you select receives the request content and any key that provider needs.

Local, rules-based analysis tools (no LLM key) can still run on-device without calling an external model. That is different from BYO LLM chat and AI Fill.

---

## Where secrets and keys live

Stored in the browser’s **localStorage** on your device (readable as plain text if someone can open DevTools or otherwise access that profile), including for example:

| Kind of secret | Example key pattern |
|----------------|---------------------|
| AI chat API keys | `mbt_<provider>_api_key` (e.g. `mbt_openai_api_key`, `mbt_gemini_api_key`) |
| Image-gen API keys | `mbt_img_<provider>_api_key` |
| Selected AI provider | `mbt_selected_ai_provider` |
| Supabase auth session | `mbt_supabase_auth_token` |
| Supabase URL / public app key (when configured) | `mbt_supabase_url`, `mbt_supabase_key` |

This is normal for a **client-only** app with no separate password vault on a backend. Tradeoffs:

- Anyone with full access to your OS account and browser profile can potentially read those values.
- A serious browser exploit against the page (XSS) could also try to read them. mBT work continues to reduce that class of risk, but **no web app can claim zero residual risk**.

Treat API keys like production credentials. Rotate them with the provider if a device is compromised.

---

## Collaboration and cloud security (plain terms)

When cloud / collab is on:

- The database uses **row-level security**: the server checks who you are and which projects you belong to before allowing reads or writes.
- The **public (anon) API key** embedded or stored for the app is **not** enough by itself to open other people's projects. Access depends on a real signed-in session and **project membership** (owner / editor / viewer), not only on what the UI shows.

### Client RBAC is UI-only

Settings and Share Hub may show owner, editor, or viewer labels from browser storage (`mbt_rbac_role`). That display is for **convenience only**. It is **not** authorization. A user can change localStorage in DevTools. **Supabase RLS and JWT membership** are the real gate. Never treat client RBAC as access control.

### WASM / Rust compute boundary

Stage reconcile and conflict diff may run in WebAssembly (`mbt_wasm`). That code validates budget math and section diffs. It does **not** sanitize HTML, validate postMessage origins, or replace RLS. Security for injection and collab still depends on esc, DOMPurify, origin checks, and live Supabase policies.

### Outbound sync privacy filter

When personal cloud sync pushes data, `applyPrivacyFilter` in `src/config/supabase.js` strips selected PII fields before upload:

| Store | Filter today | Notes |
|-------|--------------|-------|
| `og_ref` | Strips `contact_id`, `contact_name`, `contact_phone`, `contact_email` | Phase 46 |
| `contacts` | None | Full contact records may sync if table enabled |
| `mbt_projects` / collab blob | None | Full budget JSONB by design for collab |
| Other sync tables | None | Review before enabling new tables |

Collab project sync uses membership RLS on the server; the filter above applies mainly to legacy personal-sync paths.

### Content-Security-Policy (future)

mBT does not ship a strict CSP header today. A **report-only** CSP on staging or Pages deploy is the recommended next step after postMessage and XSS hygiene. Expect noise from inline handlers and vendored libs until those are narrowed.

### Third-party scripts

The Buy Me a Coffee widget loads from `cdnjs.buymeacoffee.com` in `index.html`. It runs in the app origin context. **Decision (2026-07-22):** keep for community support; documented supply-chain residual. Remove or isolate if a stricter CSP is adopted.

What this **is**: properly configured **application-level access control** on a managed cloud database, with standard platform protections (including the host's normal encryption at rest for stored data).

What this **is not**: a formal third-party security audit certification, end-to-end encryption of budget contents so even the cloud host cannot read them, or a zero-knowledge design. Do not treat marketing-style claims like “military-grade” as part of this product’s promises.

---

## What mBT does not do (honest list)

- **No app-level encryption** of budgets or contacts at rest on the device. Protection is whatever your OS and browser provide (for example full-disk encryption and your login). Cloud copies use the host’s standard storage protections, not a separate mBT zero-knowledge layer.
- **No password or PIN lock inside mBT itself.** If someone can unlock your phone or computer and open your browser profile, they can open mBT as you.
- **No automatic expiration** of project data. Things stay until you delete them, clear site data, or remove cloud data through the product’s sync/collab flows.
- **No claim that third-party AI providers will not train on or retain your prompts.** Their policies apply; mBT does not control them.

---

## Practical guidance for producers

1. **Prefer a device and browser profile that only you use.** Do not run a live production budget on a shared kiosk or a colleague’s always-logged-in browser.
2. **Use the OS lock screen** (and disk encryption if your org requires it). mBT will not replace that.
3. **Treat cloud collab as invite-only.** Only people you add as project members should see that project’s cloud data. It is not a public internet listing of your budget.
4. **Assume AI sees what you put in the prompt.** If a line item or contact note is in the context you send, the provider you configured can see it. Prefer LM Studio or skip AI for highly sensitive material if policy requires data to stay on-prem.
5. **On a shared or temporary machine:** sign out of cloud/auth if you use it, clear API keys from Settings (or rotate them at the provider), and avoid leaving the session open.

---

## Related documents

- `PrivacyPolicy.md` — privacy commitments in policy form  
- `UserAgreement.md` — terms of use, including AI accuracy disclaimers  
- `docs/ai/README.md` — AI suite overview (engineer/tool notes; security bullets should match this page)  
- `docs/supabase/SETUP.md` — how to wire cloud credentials (setup, not a risk overview)  
- `docs/supabase/mbt_collab_DESIGN.md` — engineer-facing collab and RLS design  
- `research/mBT-security-p0-rls-verification.md` — live RLS sign-off checklist (Jayson)  
- `research/mBT-security-propagation-and-hardening.md` — full security program P0–P3

If something here conflicts with how a feature behaves in your build, trust the live app and ask for an update to this file.
