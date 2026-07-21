# Rate Index Research Log

**Purpose:** Sourced research backing new/changed entries in `_MASTER_CREW_INDEX` (`mBT/src/scripts/engine/opengate.js`), tied to the ATL/BTL template correction pass that started 2026-07-18. See `docs/STAGE_PRESETS.md` for the equivalent research log covering Stages timeline percentages, and `mBT/scaffold/mbt-completion-tracker.html` (workspace root, not shipped) for the tracker item this work closes out.

Every entry below exists because the current template's role list or ATL/BTL placement was corrected during a live review with the tool's user (a working film/event producer), not invented. Only add to this file when a NEW rate entry is added or an EXISTING one is re-justified with real sourcing. Do not log routine template reshuffling that does not touch the rate index itself.

---

## ATL / BTL classification rule (established 2026-07-18)

Prior sessions used an informal "cast vs. crew" heuristic for ATL/BTL placement, which was wrong. The correct rule, from direct producer correction:

> **ATL = who the story belongs to or who funds it** (creative and financial ownership: story rights, concept, direction, lead performers, executive backing).
> **BTL = anything that scales with the physical schedule, travel demands, or hours required** (day-player crew, field labor, support roles) -- regardless of whether the role is "on-camera" or "behind the camera."

This reclassifies some roles that earlier template versions had backwards, most notably:
- **Director of Photography (DP) is BTL**, not ATL, even though DP is a senior creative role -- DP cost scales with shoot days.
- **Cast is only ATL when they are lead/principal** (the story is built around them); supporting cast is BTL.
- A role can be **either ATL or BTL depending on WHY it was hired**, not by job title alone (see Researcher, below).

---

## Documentary template (2026-07-18 correction pass)

### Story Researcher vs. field Researcher (two distinct roles, not one)

**Producer correction (verbatim):** "Hired to write the concept or major story works that Research becomes ATL, if they're hired to fill or find things and are discretion it's BTL. so a research can be ATL or BTL might need to make entries for both types."

This means "Researcher" is not one role -- it is two, differentiated by WHY they were hired, matching the ATL/BTL rule above:

- **Field/Support Researcher (BTL):** fact-checking, archival digging, discretionary/droppable hire that scales with schedule. Already correctly represented by the existing rate entry:
  ```js
  { "description": "Researcher", "unit": "Day", "baseRate": 250, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.75, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } }
  ```

- **Story Researcher (ATL):** hired to help write the concept / shape the narrative -- a creative-development hire, not day labor.

**Sourcing (Grok research, task `b516qoahe`, 2026-07-18):**
- IDA (International Documentary Association) / Robert Bahar, *A Fresh 2025 Introduction to Documentary Budgeting and Scheduling*: names "story researcher" explicitly as director-support, distinct from field/production research; treats director/producer/writer fees as project flats, while staff research is often billed over weeks/months, and shoot crew on day rates. Confirms Flat is the closer real-world "kind" of pricing for a development engagement.
- Wrapbook (2024): unscripted "Story Producer" role, weekly not daily, ~$2,000-$3,000/week (avg ~$2,500/week); supervising story producer ~$3,300-$3,500/week. Used as an upper-market anchor point, not a direct rate (network unscripted series work is a different product from indie doc development).
- BECTU (UK) published unscripted rate bands: Researcher GBP605-930/week, Assistant Producer GBP800-1,125/week.
- PBS production services rate sheet (published): Associate Producer $400/day.
- Freelance Video Collective reference table: Development Producer ~$708/day.
- AIR 2025 Rate Guide (audio/radio independents): producer hourly band $40-150/hr (~$320-1,200 for an 8-hour day).

**Unit decision:** Flat, matching Screenwriter's pricing kind (a bespoke creative-development package), not a day rate like the existing field Researcher. Confirmed with the user directly (2026-07-18) after presenting both a Flat ($5,500) and Day ($450) option backed by the same research -- Flat was chosen as the better fit for how this role is actually engaged.

**Calibration:** not an arithmetic midpoint of Researcher ($250/day) and Screenwriter ($4,000 Flat) -- built from real day-rate comparables (PBS AP $400/day, Development Producer ~$708/day, informal Story Producer weekly-equivalent ~$500/day) scaled to a realistic ~10-12 day indie development engagement (10 x $500 to 15 x $450 -> ~$5,000-$6,750 band), landing on $5,500 as the center.

```js
{ "description": "Story Researcher", "unit": "Flat", "baseRate": 5500, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "ATL concept and narrative research for docs (not field fact-checking). Project flat for development packages. Market also books weekly ($2k-$2.5k/wk unscripted story track) or ~$400-$550/day US mid. Multipliers proxy Screenwriter (creative)." }
```
Multiplier pattern: reused from **Screenwriter** (creative/narrative development role, ATL-adjacent, not field logistics -- same reasoning as Narrator, above).

**Do not rename or retarget the existing "Researcher" entry** -- Story Researcher is a new, separate index row. Field/support Researcher stays exactly as-is at $250/Day.

### Host (new entry, sourced)

**Sourcing (Grok research, task `bgw577ese`, 2026-07-18):**
- SAG-AFTRA day performer scale (theatrical/TV, mid-2020s): Full scale ~$1,246-$1,283/day; Low Budget tier (~$700K-$2M productions) ~$810-$834/day; Moderate Low ~$436-$449/day.
- Wrapbook 2026 SAG rate guide: confirms the same tiers (Basic $1,283, Low Budget $834, Moderate Low $449.05).
- UK broadcast presenter rates (JournoResources / NUJ-adjacent freelance guidance): mid-tier presenter day rates in the low hundreds of GBP, used as a cross-check that a non-celebrity working host should not be priced near US union ceilings.

**Calibration:** anchored just above the SAG Low Budget day-player floor, below the full Basic scale, and below this index's existing Director rate ($1,200/day) -- a mid-tier working host, not a celebrity or network anchor.

```js
{ "description": "Host", "unit": "Day", "baseRate": 900, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.8, "Canada": 0.77, "Australia": 0.68, "India": 0.40, "Thailand": 0.60, "Philippines": 0.66, "Vietnam": 0.74, "Poland": 0.92, "Mexico": 0.54, "Brazil": 0.60, "Colombia": 0.40, "South Africa": 0.58 }, "intelligence": "On-camera mid-tier host. Anchored near SAG Low Budget day-player scale; celebrity and network-star hosts quote far above this." }
```
Multiplier pattern: reused from **Director** (comparable on-set, principal, above-the-line creative presence). Host-specific regional rate surveys were not findable at usable density.

### Narrator (new entry, sourced)

**Sourcing (Grok research, task `bgw577ese`, 2026-07-18):**
- GVAA (Global Voice Acting Academy) rate guide, as republished by Voice Crafters: documentary/in-show narration priced by program length, not day rate -- 30-minute program $500-$1,000; 1-hour program $1,500-$3,000.
- SAG-AFTRA VO tables exist for union commercial/interactive work, but indie documentary narration is commonly non-union buyout-by-program in real practice, which is why this entry does not use SAG day-player math.

**Unit choice:** Flat, not Day -- matches how the market actually sells this (a finished-program/buyout package, similar in structure to how this index already prices Screenwriter as Flat rather than Day). A day rate would under-budget a dense hour-long narration track and over-budget a light 10-minute piece.

**Anchor:** middle of the GVAA hour-long program band ($1,500-$3,000 -> $2,250), rounded to a clean index number.

```js
{ "description": "Narrator", "unit": "Flat", "baseRate": 2000, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.85, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 }, "intelligence": "Voice-only doc narration package, mid-tier ~hour-long program (GVAA). Longer/denser or celebrity VO is higher; light 30-min packages lower." }
```
Multiplier pattern: reused from **Screenwriter** (bespoke creative flat-deliverable role; same reasoning that UK/Canada run slightly higher relative to Caribbean-scaled day roles).

**Do not merge Host and Narrator into one entry** -- confirmed by the user directly ("narration v host have different rates") and by real market structure (on-camera scale vs. voice-buyout-by-program are priced on entirely different logic).

### Story Rights & IP Acquisition: legal fees vs. life-rights purchase (do not conflate)

**Sourcing (Grok research, task `bgw577ese`, 2026-07-18):** these are two different cost categories that a single "Story Rights" line item was at risk of conflating.

**Category A -- legal/clearance counsel fees** (attorney work: chain of title, option drafting, clearance review):
- Documentary clearance counsel (Amy E. Mitchell, PLLC, public rate page as indexed): fees start at $2,500.
- Promise Legal (indie option/purchase guide): single option-agreement legal work often $2,500-$3,500; total entertainment legal for a sub-$100K film often $3,500-$5,000, with headroom to ~$6,000.
- General entertainment flat work for discrete transactional tasks: commonly hundreds to low thousands; complex rights deals scale hourly ($350-$800+/hr in CA-market examples).

**Recommendation for category A:** reuse the EXISTING rate entry as-is, no new entry needed:
```js
{ "description": "Legal - Rights & Clearances", "unit": "Flat", "baseRate": 2500, "multipliers": { "USA": 1, "Jamaica": 0.28, "Trinidad": 0.37, "Barbados": 0.43, "Guyana": 0.37, "UK": 0.9, "Canada": 0.9, "Australia": 0.68, "India": 0.38, "Thailand": 0.42, "Philippines": 0.39, "Vietnam": 0.49, "Poland": 0.76, "Mexico": 0.47, "Brazil": 0.54, "Colombia": 0.36, "South Africa": 0.54 } }
```
$2,500 is well-supported as the counsel/clearance-fee floor-to-mid range for indie documentary work.

**Category B -- life-rights / IP purchase price** (paying the subject, their estate, or an author for the rights to their story):
- Going Bionic and general life-rights acquisition industry guidance: many life-rights packages land in the $35,000-$75,000 purchase range; a common rule of thumb is roughly 2%-5% of the final approved production budget ($20K-$50K per $1M budget). Celebrity/studio-scale life-rights deals go far higher.
- Indie option practice: the option fee itself can be small (a few hundred to a few thousand dollars), with the actual purchase price negotiated separately, usually scaled to the film's budget.

**Recommendation for category B:** this is NOT a fixed legal flat -- it is inherently budget-dependent and subject-dependent. Per user decision (2026-07-18, tracker item #6 walkthrough), the Documentary template splits this into two separate line items rather than one merged "Story Rights & IP Acquisition" row:
1. `Legal - Rights & Clearances` (existing $2,500 Flat entry, for counsel fees)
2. A new producer-fillable line for the life-rights/IP purchase price itself, with no fixed baseRate (the user enters the real negotiated number, since a fixed rate would be actively misleading given the real-world $20K-$75K+ range) -- implementation detail (exact rate-index entry shape or whether this is a zero-rate placeholder role) pending the Documentary template's final implementation pass.

---

## Live / broadcast equipment pass (2026-07-21)

**Trigger:** Producer correction — live/streaming/broadcast templates reference switchers, encoders, converters, bonded cellular, and comms, but OpenGate equipment index only covered film/event rental kits (camera, light, sound, grip, PA, wireless video). TriCaster, ATEM 4K, hardware encoders, and signal-chain gear were missing.

**Research method:** Grok CLI with X.com + rental-house web sources (`work/grok_live_broadcast_equipment_research_prompt.txt`, output `work/grok_live_broadcast_equipment_rates.txt`).

**Pricing policy (binding for equipment):** Capital gear uses a **fixed USA USD anchor** in OpenGate — regional labor multipliers and Indie/Studio tier scalars do **not** apply to equipment rows. Jamaica still converts USD anchor to JMD (×155). Crew rows unchanged. Grok policy synthesis + US rental-house practice: national USD day cards for switchers/encoders; labor scales by market, gear list prices stay USD.

**Implemented in:** `mBT/src/scripts/engine/opengate.js` — `_expandIndex` equipment path, `calculateRate`, `_EQUIPMENT_DESCRIPTION_ALIASES`, `CURRENT_VERSION` `2026.07.21_live_broadcast_v3`.

### Switchers (gear-only USA day rates)

| Description | baseRate | Primary sources |
|-------------|----------|-----------------|
| NewTek TriCaster Mini | $350 | Absolute Rentals Burbank list |
| NewTek TriCaster TC1 | $750 | Absolute $800 / ShareGrid LA $699 mid |
| NewTek TriCaster 2 Elite | $995 | Omega Broadcast rental list |
| Blackmagic ATEM Mini Pro ISO | $50 | Adorama $35; ShareGrid-class mid |
| Blackmagic ATEM 2 M/E Constellation 4K | $275 | ShareGrid Austin $289 |
| Blackmagic ATEM 4 M/E Constellation 4K | $350 | Mid production-house day (above mailer multi-day, below full flypack) |

### Encoders, converters, connectivity, comms

| Description | baseRate | Notes |
|-------------|----------|-------|
| Teradek VidiU Go Encoder | $45 | Lensrentals weekly band |
| Teradek Cube 655 HD Encoder | $75 | ShareGrid avg ~$97; mid 75 |
| Teradek Cube 755 HEVC Encoder | $85 | Lensrentals weekly ~$96 |
| Wowza ClearCaster Encoder | $125 | **ESTIMATE** — product sunset |
| Decimator MD-HX Scan Converter | $25 | Motion $19; ShareGrid $25 |
| Blackmagic Micro Converter BiDirectional SDI/HDMI | $15 | Canal Sound $15 |
| Bonded Cellular (LiveU LU300) | $400 | Streaming Store / Feed Central |
| Bonded Cellular (LiveU LU600) | $750 | Feed Central $540–Absolute $1500 mid |
| Pepwave Bonded Router Backup | $375 | Absolute 2-cell Pepwave |
| Comms System (4-User Wireless) | $250 | Clear-Com FreeSpeak 4-drop class |
| IFB Talent Beltpack (Single) | $75 | Beltpack add-on band |
| Dedicated Internet Line | $650 | Absolute Starlink/4-cell day cards |

### Packages + template aliases

| Description | baseRate | Resolves |
|-------------|----------|----------|
| Live Production Switcher Package | $250 | Mid switcher + encoder flypack |
| Switcher/Encoder | $250 | Blueprint alias |
| Three-Camera Live Package | $1500 | 3× mid pro camera gear-only |
| Cameras (3-Cam Kit) | $1500 | Template alias |
| Lighting Package | $350 | Alias Light Kit (3-Light) |
| Sound Equipment Rental | $225 | Alias Sound Kit |
| Grip & Support Equipment | $325 | Alias Grip Kit |
| Comms System | $250 | Alias 4-user wireless |
| Bonded Cellular | $750 | Alias LU600 tier |
| 4G/5G Backup Data | $400 | Alias LU300 tier |

### Deferred pass (2026-07-21, Grok+X)

| Description | baseRate | Unit | Notes |
|-------------|----------|------|-------|
| Presidential Teleprompter (17-19 in System) | $500 | Day | Gear-only; Magic/ShareGrid mid |
| Compact Teleprompter (iPad Class) | $125 | Day | ShareGrid ~$100; AMC ~$295 |
| On-Air CG Hardware (LiveText / XPression Class) | $560 | Day | ShareGrid Ross XPression $562 |
| On-Air Graphics Software Package (BYO Hardware) | $275 | Day | ESTIMATE — software seat only |
| CDN Live Streaming Bandwidth (Managed Egress, Event Day) | $850 | Day | Mid event egress planning rate |
| Studio Lease Broadcast Control Room (Floor Day, Gear Excluded) | $1200 | Day | ESTIMATE — dry CR floor |

### Per Diem (travel line item — Grok recommendation: **yes**)

| Description | baseRate | Unit | Placement |
|-------------|----------|------|-----------|
| Per Diem | $75 | Day per person | `_MASTER_CREW_INDEX` (Travel & Logistics, not labor) |
| Per Diems | $75 | Day | Template alias |

**Why yes:** Union and producer practice treat per diem as a **travel/living allowance**, not a role day rate. SAG-AFTRA distant hire M&IE **$75/day** (Dec 2025); GSA CONUS M&IE **~$68–$92**. Budget quantity = **person-days** (7-day weeks, travel days, prep — not shoot days only). Lodging stays a separate line (`Accommodation`). Contacts/deal memos still carry per-diem fields in mBTDB; OpenGate now supplies the budget line anchor.

**Reseed:** `CURRENT_VERSION` → `2026.07.21_live_broadcast_v4`.

---

## How to use this log

When a future template-correction pass adds or re-justifies a rate entry, append a new dated section here following the same pattern: producer correction (verbatim if given), real sourcing with named sources, the calibration reasoning, and the final ready-to-paste JS object. Do not add entries without real research backing -- if a rate is estimated rather than sourced, say so explicitly rather than presenting it as researched.
