# mBT Collab schema — design notes

**Status:** design only. Schema file: [`mbt_collab_schema.sql`](./mbt_collab_schema.sql).  
**Do not apply** until reviewed. This document is not a migration runner.

**Target backend:** Supabase project **mbt-collab** (ref `omzyycoaaxymjitlnhhj`).  
**Not** the OpenGate Community Rates project.  
**Not** a user’s personal-backup Supabase project documented in `SETUP.md` / `schema.sql`.

Prior audits (do not re-derive):  
`work/grok45_multiplayer_hub_audit.txt`, `work/grok45_auth_reality_audit.txt`.

---

## Problem this schema fixes

| Gap (from audits) | Schema answer |
|-------------------|---------------|
| No `project_members` / shared RLS | `project_members` + membership helpers drive RLS on `projects.budget_data` |
| Invite tokens never validated | `project_invites` + `redeem_project_invite(token)` |
| Guests use fake `anon_*` ids, no JWT → no realtime | Redeem requires real `auth.uid()`; collab clients must sign in first |
| `budget.id` vs `budget.projectName` drift | Collab identity is **`projects.id` (UUID)** only |

Login UI already exists (Settings → Cloud). Collab needs **membership + this project’s URL/key**, not a new auth product.

---

## Tables (summary)

### `projects`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | **Stable collab project id** |
| `owner_user_id` | uuid → auth.users | Creator |
| `name` | text | Display title (often mirrors budget title) |
| `budget_data` | jsonb | Full mBT budget monolith |
| `created_at` / `updated_at` | timestamptz | `updated_at` touch trigger |

**Why JSONB for `budget_data`:**  
The editor’s source of truth is one object (`budget`). `mBT.data.save()` stringifies that object and stores it under `prodBudget_v5_<projectName>`. A new budget already includes `sections`, `fringes`, `ledgers`, `documents`, `targetLock`, `jurisdiction`, `currency`, `activityLog`, etc. Personal sync already pushes that blob as `data`. Normalizing into SQL line-item tables would rewrite the monolith and every tool. Collab v1 shares the **same blob**; SQL adds **who may read/write it**.

**Identity mapping (explicit):**

| System | Project id | Access model |
|--------|------------|--------------|
| **mbt-collab (this schema)** | `projects.id` UUID | Membership RLS |
| **Personal Cloud Sync (other Supabase)** | TEXT `budget.id \|\| budget.projectName` | `auth.uid() = user_id` only |
| **Local device** | localforage key `prodBudget_v5_<projectName>` | Offline-first |

A collab session’s authoritative id is **`projects.id`**. Do not require it to equal `budget.id` or `budget.projectName`. Optionally keep `budget.projectName` inside `budget_data` for UI labels and local cache keys.

### `project_members`

Composite PK `(project_id, user_id)`. Roles: `owner` | `editor` | `viewer`.  
Trigger on `projects` INSERT adds the creator as `owner`.  
App RBAC should read role from this table (or a pull of it), not only `localStorage.mbt_rbac_role`.

### `project_invites`

Single-use tokens. Default token: `encode(gen_random_bytes(32), 'hex')` (256-bit, unguessable).  
`role_to_grant`: `editor` | `viewer` only (cannot mint a second owner via link).  
Flags: `expires_at`, `revoked`, `used_by` / `used_at`.

**RLS:** only project **owners** can SELECT/INSERT/UPDATE/DELETE invite rows (Share Hub management). Guests **must not** rely on direct table SELECT by token; they call **`redeem_project_invite`**.

---

## RLS role matrix

| Actor | Read `budget_data` | Write `budget_data` | Manage members/invites | Delete project |
|-------|--------------------|---------------------|------------------------|----------------|
| `owner_user_id` / role owner | yes | yes | yes | yes |
| role editor | yes | yes (name + budget_data only; trigger-enforced) | no | no |
| role viewer | yes | no | no | no |
| non-member | no | no | no | no |

`anon` has no grants. All collab API access is **`authenticated`** + JWT.

---

## End-to-end flow this schema enables

```
1. Owner is signed into mbt-collab (Supabase Auth JWT).
2. Owner creates a collab project:
     INSERT projects (owner_user_id, name, budget_data)
     → trigger inserts project_members (role=owner).
3. Owner creates an invite (Share Hub):
     INSERT project_invites (project_id, created_by, role_to_grant)
     → DB generates token; UI builds link:
       .../index.html?invite=<token>&collabProjectId=<optional>
4. Second person opens the link on another device.
5. They sign in or sign up (existing Cloud auth UI, pointed at mbt-collab URL+anon key).
6. Client calls RPC: redeem_project_invite(invite_token)
     → validates not found / expired / revoked / already used
     → INSERT project_members for auth.uid() with role_to_grant
     → marks invite used_by / used_at
     → returns project_id
7. Client loads:
     SELECT budget_data, name, updated_at FROM projects WHERE id = project_id
     (RLS allows because they are now a member)
8. Client hydrates local `budget` from budget_data and renders the normal editor.
9. Editor saves → client UPDATE projects SET budget_data = … WHERE id = …
     (RLS allows editor/owner; blocks viewer)
10. Owner reloads or later pulls the same project_id and sees the change.
```

Realtime presence can later subscribe on a channel keyed by **`projects.id`**, only after a real JWT (already how `mBTRealtime` is gated). Fake `anon_*` guests are not part of this path.

### Redeem error messages (client mapping)

| Exception text | User-facing meaning |
|----------------|---------------------|
| `Not authenticated: …` | Force sign-in / sign-up |
| `Invite not found` | Bad or mistyped link |
| `Invite expired` | Ask owner for a new link |
| `Invite revoked` | Owner burned the link |
| `Invite already used` | Single-use; ask owner for a new invite |

Same user re-opening an already-used (by them) link returns `project_id` idempotently.

---

## What mBT application code must change next

**Do not implement in the schema pass.** Rough wiring map:

| Area | Files (approx.) | Change |
|------|-----------------|--------|
| Collab backend config | `src/config/supabase.js`, Settings / Cloud UI (`ui.settings.js`, `index.html` cloud handlers) | Point collab flows at **mbt-collab** URL + anon key (separate from OpenGate and from personal BYO backup if both remain). Product decision: default baked collab endpoint vs user paste. |
| Auth gate on invite | `index.html` ~690–708 invite bootstrap | **Remove** `anon_*` guest path as primary collab entry. Require sign-in, then call redeem RPC. |
| Redeem client | new helper in `supabase-sync.js` (or small collab service) | `POST /rest/v1/rpc/redeem_project_invite` with `{ invite_token }`, JWT headers. |
| Create/publish collab project | Share Hub `src/tools/share/index.html`; parent EventRouter | Owner upsert into `projects` with current `budget` as `budget_data`; stop using `mbt_generic` invite keys. |
| Invite create/burn | Share Hub | `INSERT project_invites` / set `revoked=true` (owner JWT). Link uses DB token. Fix credential key: use `mbt_supabase_key`, not `mbt_supabase_anon_key`. |
| Load shared budget | `mBT.data.load` / post-redeem path | Fetch `projects.budget_data` by UUID; wrap with `mBT.data.state.wrap`; store `collab_project_id` on session or budget metadata. |
| Save shared budget | `mBT.data.save` → sync hook | If collab session: `UPDATE projects.budget_data` for that UUID (respect role). Local localforage can still cache. |
| Role source of truth | `Security.js` (`mbt_rbac_role`) | After redeem/load members, set role from `project_members.role`. Stop treating localStorage alone as membership. |
| Realtime channel id | `supabase-realtime.js`, load path | Use **collab `projects.id`**, not `budget.projectName`. |
| Hub peers / activity | Share Hub, EventRouter | After membership works: fix peer field names and activity contracts (audit §C). Optional later tables for activity/pending can be reintroduced **on mbt-collab** with member RLS. |
| Personal backup | `docs/supabase/schema.sql`, BYO sync | Leave alone for v1; do not merge personal-backup RLS with collab membership. |

### Out of scope for first app wire (but schema-ready)

- Multi-use invites (schema is single-use).
- Owner transfer / demote owner via invite.
- Normalized line items, OT, proposals queue on this project (can add later tables with the same membership helpers).
- Automatic conflict CRDT; v1 is last-write-wins on `budget_data` + `updated_at` (same spirit as monolith save).

---

## Apply checklist (human, later)

1. Open **mbt-collab** → SQL Editor.  
2. Paste `mbt_collab_schema.sql`, run.  
3. Confirm Table Editor shows three tables with RLS enabled.  
4. Confirm RPC `redeem_project_invite` appears under Database → Functions.  
5. Auth: enable Email (and Google if desired); set redirect URLs for the app origin.  
6. Only then wire client code.

**This pass did not execute SQL, open a DB connection, or call Supabase APIs.**
