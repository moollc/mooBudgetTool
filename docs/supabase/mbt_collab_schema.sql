/* =========================================================================
   mBT Collab schema — multiplayer / shared-budget membership
   Target Supabase project: mbt-collab (ref omzyycoaaxymjitlnhhj)
   File: docs/supabase/mbt_collab_schema.sql

   DESIGN ONLY / APPLY MANUALLY after review.
   Do NOT confuse this with docs/supabase/schema.sql which targets the
   personal-backup Supabase world (owner-only projects, mbt_pending_edits,
   mbt_activity_log). Those are different systems.

   Project settings assumed at creation:
     - Data API: ON
     - Automatically expose new tables: OFF  → explicit GRANTs required
     - Enable automatic RLS: ON              → every table needs explicit policies

   This migration creates:
     1. projects          — one shared budget document per collab project
     2. project_members   — durable membership + role (owner/editor/viewer)
     3. project_invites   — single-use unguessable invite tokens
     4. RLS policies      — membership-gated read/write of budget_data
     5. redeem_project_invite(token) — SECURITY DEFINER redeem RPC
   ========================================================================= */

/* -------------------------------------------------------------------------
   Extensions
   gen_random_bytes() needs pgcrypto. Supabase usually has this; IF NOT EXISTS
   is safe. gen_random_uuid() is available in modern Postgres without it, but
   we prefer 32 random bytes for invite tokens (unguessable link material).
   ------------------------------------------------------------------------- */
CREATE EXTENSION IF NOT EXISTS pgcrypto;

/* =========================================================================
   1. projects
   =========================================================================
   DESIGN: budget_data is JSONB holding the ENTIRE mBT budget object.

   Why JSONB (not normalized line-item tables)?
   - The live app model is a single in-memory object `budget` (index.html).
   - mBT.data.save() does JSON.parse(JSON.stringify(budget)) and writes that
     blob to localforage under prodBudget_v5_<projectName>.
   - New budgets already include a deep tree: projectName, sections{}, fringes[],
     ledgers{pos,pettyCash}, documents[], attachments[], targetLock.stages,
     jurisdiction, currency, activityLog, aiContext, etc. (index.html ~1644+).
   - Personal-backup sync already treats the monolith as one payload
     (supabase-sync.js monolithPayload.data = cleanBudget).
   - Normalizing sections/items into SQL rows would force a rewrite of the
     editor, every tool iframe, and conflict/merge paths. For collab v1 the
     shared document IS the budget JSON; membership is what we add in SQL.

   Project identity (IMPORTANT — do not conflate systems):
   - THIS table's id is a UUID primary key. It is the stable collab project_id
     for membership, invites, RLS, and future realtime channel names.
   - The personal-backup Supabase project uses a different model: TEXT ids
     derived from budget.id || budget.projectName, plus user_id owner-only RLS.
   - budget.projectName is a human label and localforage key suffix; it can
     rename. budget.id is optional/legacy and often missing on new budgets.
   - A collab-loaded budget's identity lives in projects.id HERE. Client code
     should store collab_project_id alongside the local budget and MUST NOT
     assume projects.id equals budget.id or budget.projectName.
   - name is a denormalized display title (usually mirrors budget_data.projectName
     at create/update time) so the Share Hub can list projects without parsing
     the full JSONB.
   ========================================================================= */

CREATE TABLE IF NOT EXISTS public.projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id   UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    budget_data     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    /* Soft constraint: budget blob must be an object (the monolith shape). */
    CONSTRAINT projects_budget_data_is_object CHECK (jsonb_typeof(budget_data) = 'object')
);

CREATE INDEX IF NOT EXISTS projects_owner_user_id_idx
    ON public.projects (owner_user_id);

CREATE INDEX IF NOT EXISTS projects_updated_at_idx
    ON public.projects (updated_at DESC);

COMMENT ON TABLE public.projects IS
    'mbt-collab shared budget documents. Identity is projects.id (UUID), not personal-backup budget.id/projectName.';
COMMENT ON COLUMN public.projects.budget_data IS
    'Full mBT budget monolith (same shape as localforage prodBudget_v5_* blob / mBT.data.save).';
COMMENT ON COLUMN public.projects.owner_user_id IS
    'Creating account. Also mirrored as project_members.role = owner via trigger.';

/* Keep updated_at honest on every row change (client may also set it). */
CREATE OR REPLACE FUNCTION public.mbt_collab_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_touch_updated_at ON public.projects;
CREATE TRIGGER projects_touch_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.mbt_collab_touch_updated_at();

/* =========================================================================
   2. project_members
   =========================================================================
   Durable membership is the source of truth for collab access and role.
   App localStorage mbt_rbac_role is NOT authoritative (see auth audit).
   ========================================================================= */

CREATE TABLE IF NOT EXISTS public.project_members (
    project_id   UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role         TEXT NOT NULL
                 CHECK (role IN ('owner', 'editor', 'viewer')),
    invited_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    joined_at    TIMESTAMPTZ,
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_user_id_idx
    ON public.project_members (user_id);

COMMENT ON TABLE public.project_members IS
    'Who can open a collab project and at what role. RLS on projects reads this table.';
COMMENT ON COLUMN public.project_members.joined_at IS
    'Set when the member first redeems or when owner row is created; null only if you pre-stage invites separately.';

/* Auto-enroll the creator as owner when a project row is inserted. */
CREATE OR REPLACE FUNCTION public.mbt_collab_add_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.project_members (project_id, user_id, role, invited_at, joined_at)
    VALUES (NEW.id, NEW.owner_user_id, 'owner', now(), now())
    ON CONFLICT (project_id, user_id) DO UPDATE
        SET role = 'owner',
            joined_at = COALESCE(public.project_members.joined_at, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_add_owner_member ON public.projects;
CREATE TRIGGER projects_add_owner_member
    AFTER INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.mbt_collab_add_owner_member();

/* =========================================================================
   3. project_invites
   =========================================================================
   Single-use invite links. Tokens are generated in the database so the client
   never invents weak tokens. Share Hub stores/returns the token string in the
   link (?invite=<token>); join path must call redeem_project_invite, not
   SELECT this table as the guest.

   Token generation approach:
   - DEFAULT encode(gen_random_bytes(32), 'hex') → 64 hex chars, 256 bits entropy.
   - Prefer this over gen_random_uuid() alone (122 bits, structured UUID format).
   - Client INSERT as project owner (or owner-only RPC later); SELECT the
     returned token for the share URL. Guests never need SELECT privilege
     that returns other columns without knowing the token — and we do not
     grant open SELECT to authenticated for token fishing; redeem is the path.
   ========================================================================= */

CREATE TABLE IF NOT EXISTS public.project_invites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE
                    DEFAULT encode(gen_random_bytes(32), 'hex'),
    created_by      UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    /* Invite cannot mint a second owner; ownership transfers are out of scope. */
    role_to_grant   TEXT NOT NULL
                    CHECK (role_to_grant IN ('editor', 'viewer')),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
    used_by         UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    used_at         TIMESTAMPTZ,
    revoked         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_invites_project_id_idx
    ON public.project_invites (project_id);

CREATE INDEX IF NOT EXISTS project_invites_token_idx
    ON public.project_invites (token);

COMMENT ON TABLE public.project_invites IS
    'Single-use collab invite tokens. Redeem only via redeem_project_invite(); guests must not SELECT this table broadly.';
COMMENT ON COLUMN public.project_invites.token IS
    'Unguessable secret in share URL. Default: 32-byte hex from gen_random_bytes.';

/* =========================================================================
   4. RLS helper functions (SECURITY DEFINER)
   =========================================================================
   Helpers bypass RLS on project_members/projects so policies do not recurse
   (projects policy → members → projects …). Always SET search_path.
   ========================================================================= */

CREATE OR REPLACE FUNCTION public.mbt_collab_is_project_owner(p_project_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = p_project_id
          AND p.owner_user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM public.project_members m
        WHERE m.project_id = p_project_id
          AND m.user_id = auth.uid()
          AND m.role = 'owner'
    );
$$;

CREATE OR REPLACE FUNCTION public.mbt_collab_member_role(p_project_id UUID)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT m.role
    FROM public.project_members m
    WHERE m.project_id = p_project_id
      AND m.user_id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.mbt_collab_can_read_project(p_project_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.mbt_collab_is_project_owner(p_project_id)
        OR public.mbt_collab_member_role(p_project_id) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.mbt_collab_can_write_budget(p_project_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.mbt_collab_is_project_owner(p_project_id)
        OR public.mbt_collab_member_role(p_project_id) IN ('owner', 'editor');
$$;

COMMENT ON FUNCTION public.mbt_collab_can_read_project(UUID) IS
    'True if auth.uid() is projects.owner_user_id or any project_members row.';
COMMENT ON FUNCTION public.mbt_collab_can_write_budget(UUID) IS
    'True if auth.uid() may UPDATE projects.budget_data (owner or editor).';

/* Prevent non-owners from stealing ownership or deleting via sneaky UPDATE. */
CREATE OR REPLACE FUNCTION public.mbt_collab_guard_project_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
BEGIN
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
        IF NOT public.mbt_collab_is_project_owner(OLD.id) THEN
            RAISE EXCEPTION 'Only the project owner can change owner_user_id'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    /* Viewers must not update any column (belt + RLS). */
    v_role := public.mbt_collab_member_role(OLD.id);
    IF NOT public.mbt_collab_is_project_owner(OLD.id)
       AND (v_role IS NULL OR v_role = 'viewer') THEN
        RAISE EXCEPTION 'Viewers cannot update project rows'
            USING ERRCODE = '42501';
    END IF;

    /* Editors may only touch budget_data, name (display), and updated_at. */
    IF NOT public.mbt_collab_is_project_owner(OLD.id)
       AND v_role = 'editor' THEN
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Editors may only update budget_data and name'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_guard_update ON public.projects;
CREATE TRIGGER projects_guard_update
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.mbt_collab_guard_project_update();

/* =========================================================================
   5. RLS policies
   ========================================================================= */

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

/* Force RLS for table owners too (Supabase/postgres best practice). */
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_invites FORCE ROW LEVEL SECURITY;

/* --- projects --- */

/* SELECT policy must allow INSERT...RETURNING (PostgREST Prefer: return=representation).
   Postgres checks SELECT USING as WCO_RLS_INSERT_CHECK *before* heap insert and
   *before* AFTER INSERT triggers. Helper-only USING fails then: self-SELECT cannot
   see the uninserted row; AFTER INSERT member row does not exist yet.
   Direct owner_user_id = auth.uid() uses NEW-row slot values and passes. */
DROP POLICY IF EXISTS projects_select_member ON public.projects;
CREATE POLICY projects_select_member ON public.projects
    FOR SELECT
    TO authenticated
    USING (
        owner_user_id = auth.uid()
        OR public.mbt_collab_can_read_project(id)
    );

DROP POLICY IF EXISTS projects_insert_as_owner ON public.projects;
CREATE POLICY projects_insert_as_owner ON public.projects
    FOR INSERT
    TO authenticated
    WITH CHECK (owner_user_id = auth.uid());

/* Owner: full update. Editor: update allowed by RLS; column guard trigger
   limits them to budget_data + name. Viewer: no update. */
DROP POLICY IF EXISTS projects_update_owner_or_editor ON public.projects;
CREATE POLICY projects_update_owner_or_editor ON public.projects
    FOR UPDATE
    TO authenticated
    USING (public.mbt_collab_can_write_budget(id))
    WITH CHECK (public.mbt_collab_can_write_budget(id));

DROP POLICY IF EXISTS projects_delete_owner ON public.projects;
CREATE POLICY projects_delete_owner ON public.projects
    FOR DELETE
    TO authenticated
    USING (public.mbt_collab_is_project_owner(id));

/* --- project_members ---
   Members can see the roster for projects they belong to.
   Only owners can insert/update/delete membership rows (except redeem RPC,
   which runs as SECURITY DEFINER and bypasses these policies).
*/

DROP POLICY IF EXISTS project_members_select_peer ON public.project_members;
CREATE POLICY project_members_select_peer ON public.project_members
    FOR SELECT
    TO authenticated
    USING (public.mbt_collab_can_read_project(project_id));

DROP POLICY IF EXISTS project_members_insert_owner ON public.project_members;
CREATE POLICY project_members_insert_owner ON public.project_members
    FOR INSERT
    TO authenticated
    WITH CHECK (public.mbt_collab_is_project_owner(project_id));

DROP POLICY IF EXISTS project_members_update_owner ON public.project_members;
CREATE POLICY project_members_update_owner ON public.project_members
    FOR UPDATE
    TO authenticated
    USING (public.mbt_collab_is_project_owner(project_id))
    WITH CHECK (public.mbt_collab_is_project_owner(project_id));

DROP POLICY IF EXISTS project_members_delete_owner ON public.project_members;
CREATE POLICY project_members_delete_owner ON public.project_members
    FOR DELETE
    TO authenticated
    USING (public.mbt_collab_is_project_owner(project_id));

/* --- project_invites ---
   Arbitrary authenticated users must NOT SELECT/UPDATE invites by token
   fishing. Only project owners manage invites (create, list, revoke).
   Token redemption is exclusively via redeem_project_invite().
*/

DROP POLICY IF EXISTS project_invites_select_owner ON public.project_invites;
CREATE POLICY project_invites_select_owner ON public.project_invites
    FOR SELECT
    TO authenticated
    USING (public.mbt_collab_is_project_owner(project_id));

DROP POLICY IF EXISTS project_invites_insert_owner ON public.project_invites;
CREATE POLICY project_invites_insert_owner ON public.project_invites
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.mbt_collab_is_project_owner(project_id)
        AND created_by = auth.uid()
    );

DROP POLICY IF EXISTS project_invites_update_owner ON public.project_invites;
CREATE POLICY project_invites_update_owner ON public.project_invites
    FOR UPDATE
    TO authenticated
    USING (public.mbt_collab_is_project_owner(project_id))
    WITH CHECK (public.mbt_collab_is_project_owner(project_id));

DROP POLICY IF EXISTS project_invites_delete_owner ON public.project_invites;
CREATE POLICY project_invites_delete_owner ON public.project_invites
    FOR DELETE
    TO authenticated
    USING (public.mbt_collab_is_project_owner(project_id));

/* =========================================================================
   6. redeem_project_invite(invite_token text)
   =========================================================================
   SECURITY DEFINER so the callee does not need SELECT on project_invites.
   Validates: exists, not revoked, not expired, not already used by another.
   On success: insert project_members for auth.uid(), mark invite used,
   return project_id. Clear SQLSTATE-friendly messages for the client UI.
   ========================================================================= */

CREATE OR REPLACE FUNCTION public.redeem_project_invite(invite_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid        uuid := auth.uid();
    v_invite     public.project_invites%ROWTYPE;
    v_project_id uuid;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated: sign in before redeeming an invite'
            USING ERRCODE = '28000'; /* invalid_authorization_specification */
    END IF;

    IF invite_token IS NULL OR btrim(invite_token) = '' THEN
        RAISE EXCEPTION 'Invite not found'
            USING ERRCODE = 'P0002'; /* no_data_found */
    END IF;

    SELECT *
    INTO v_invite
    FROM public.project_invites
    WHERE token = btrim(invite_token)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_invite.revoked THEN
        RAISE EXCEPTION 'Invite revoked'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
        RAISE EXCEPTION 'Invite expired'
            USING ERRCODE = 'P0001';
    END IF;

    /* Already used: same user can re-open link (idempotent); others blocked. */
    IF v_invite.used_by IS NOT NULL THEN
        IF v_invite.used_by = v_uid THEN
            RETURN v_invite.project_id;
        END IF;
        RAISE EXCEPTION 'Invite already used'
            USING ERRCODE = 'P0001';
    END IF;

    v_project_id := v_invite.project_id;

    /* Grant membership. If already a member, keep existing role unless they
       had no row (ON CONFLICT DO NOTHING preserves an owner who re-redeems
       an old editor invite — ownership is never downgraded here). */
    INSERT INTO public.project_members (project_id, user_id, role, invited_at, joined_at)
    VALUES (
        v_project_id,
        v_uid,
        v_invite.role_to_grant,
        COALESCE(v_invite.created_at, now()),
        now()
    )
    ON CONFLICT (project_id, user_id) DO NOTHING;

    UPDATE public.project_invites
    SET used_by = v_uid,
        used_at = now()
    WHERE id = v_invite.id
      AND used_by IS NULL;

    RETURN v_project_id;
END;
$$;

COMMENT ON FUNCTION public.redeem_project_invite(text) IS
    'Validate invite token, insert project_members for auth.uid(), mark used, return project_id. Raises: not found / expired / revoked / already used / not authenticated.';

/* =========================================================================
   7. Grants (Automatically expose new tables = OFF)
   =========================================================================
   Without these, PostgREST will not serve the tables/RPC to clients even
   when RLS policies exist. No grants to anon for private collab data.
   ========================================================================= */

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_invites TO authenticated;

GRANT EXECUTE ON FUNCTION public.mbt_collab_is_project_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mbt_collab_member_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mbt_collab_can_read_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mbt_collab_can_write_budget(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_project_invite(text) TO authenticated;

/* Explicitly lock anon out of collab tables (belt + suspenders). */
REVOKE ALL ON public.projects FROM anon;
REVOKE ALL ON public.project_members FROM anon;
REVOKE ALL ON public.project_invites FROM anon;
REVOKE ALL ON FUNCTION public.redeem_project_invite(text) FROM anon;

/* =========================================================================
   End of mbt_collab_schema.sql
   Apply in Supabase SQL Editor on project mbt-collab only, after review.
   ========================================================================= */
