# OpenGate coverage program

**Purpose:** OpenGate is an industry reference index. Partial coverage presented without scope boundaries misleads producers. This document tracks **what must exist**, **what exists**, and **provenance quality** — not template-driven patch lists.

**Binding research log:** `docs/RATE_INDEX_RESEARCH.md` (sourced entries, calibration, paste-ready objects).

**Index source:** `src/scripts/engine/opengate.js` — `_MASTER_CREW_INDEX`, `_MASTER_EQUIPMENT_INDEX`, `_RATE_DESCRIPTION_ALIASES`.

---

## Provenance tiers (every row must declare one in `intelligence`)

| Tier | Meaning | Requirement |
|------|---------|-------------|
| **VERIFIED** | Primary source with published price or scale | Named vendor, union doc, or invoice band + date/URL in research log |
| **PEER** | 2+ independent market signals or 1 vendor + 1 peer marketplace | Log both; OpenGate mid must sit inside the band |
| **ESTIMATE** | Planning anchor only — vendor lists "Call", product sunset, or sparse market | Must say `ESTIMATE` in intelligence; never implied as verified |
| **GAP** | Known industry line item with no anchor yet | Listed here until researched; **do not** seed in templates |

**Rule:** Accumulate broadly. Validate before claiming VERIFIED. ESTIMATE rows stay in the index when producers need a planning number, but must read as ESTIMATE everywhere (intelligence string + research log).

---

## Domain checklist

Status key: **DONE** = researched rows in index · **PARTIAL** = some rows, known gaps · **GAP** = not yet accumulated

| Domain | Typical line items | Status | Notes |
|--------|-------------------|--------|-------|
| ATL creative & talent | Director, Producer, EP, Cast tiers, Screenwriter | DONE | 2026-07 doc pass |
| BTL crew (film) | Camera, grip, electric, sound, art, wardrobe, AD, PA | DONE | Core index |
| BTL crew (live/broadcast) | TD, Broadcast Engineer, Graphics, PTZ Operator, Stream Technician | PARTIAL | PTZ Operator + Stream Tech added 2026-07-22 |
| Post & finishing | Editor, Colorist, VFX, sound design, music | DONE | Core index |
| Film camera packages | Cinema kit, FX6/FX9, drone, wireless video | DONE | |
| Live signal chain | Switchers, encoders, bonded cellular, comms, converters | DONE | 2026-07-21 live pass |
| **PTZ & remote cameras** | BRC-X400, UE150, controllers, packages | **DONE** | 2026-07-22 live/venue pass |
| PA / live sound | Small PA, line array, QSC/JBL packages | DONE | |
| Transport & vehicles | Coordinator, driver, vans, fuel, parking | DONE | 2026-07-22 transport pass |
| Travel (unrated placeholders) | Flights, accommodation, carnets/visas | GAP | Template strings only — need fare/per-diem research blocks |
| Location & venue | Location mgr, permits, studio floor, power/rigging | PARTIAL | Parking & permits; venue power/rigging GAP |
| Archival & rights | Archival researcher, licensing, legal | PARTIAL | Life rights $0 anchor by design |
| Insurance & misc | Production insurance, equipment insurance | GAP | |

---

## Accumulation workflow (binding)

1. **Domain pass** — pick a checklist row (not a single user-reported hole).
2. **Source sweep** — rental houses (Absolute, ShareGrid, Lensrentals), union scales, producer invoice bands, regional peers.
3. **Log** — append `RATE_INDEX_RESEARCH.md` with sources, calibration, tier, JS snippet.
4. **Index** — add canonical rows + aliases; bump `CURRENT_VERSION` in `opengate.js`.
5. **Template wire** — only after index rows exist; use exact canonical strings.
6. **Update this checklist** — mark domain DONE/PARTIAL/GAP.

---

## Next scheduled passes (priority order)

1. **Travel & venue unrated** — Flights (planning bands), Accommodation, Venue Power Fee, Rigging
2. **Insurance** — production liability, equipment rider planning anchors
3. **Corporate/streaming crew gaps** — IT Support, Transcription, Archival Licensing
4. **Regional peer validation** — Caribbean/UK PTZ and live gear (currently USD fixed anchor for equipment)

---

## Reseed

Clients reseed local OpenGate cache when `mbt_og_db_version` (`CURRENT_VERSION` in `opengate.js`) changes. Bump `CACHE_NAME` in `sw.js` whenever `opengate.js` ships.
