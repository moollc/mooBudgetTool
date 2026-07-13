CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id   UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    budget_data     JSONB NOT NULL DEFAULT jsonb_build_object(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT projects_budget_data_is_object CHECK (jsonb_typeof(budget_data) = 'object')
);

CREATE INDEX IF NOT EXISTS projects_owner_user_id_idx ON public.projects (owner_user_id);
CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON public.projects (updated_at DESC);

CREATE OR REPLACE FUNCTION public.mbt_collab_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS projects_touch_updated_at ON public.projects;
CREATE TRIGGER projects_touch_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.mbt_collab_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.project_members (
    project_id   UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role         TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    invited_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    joined_at    TIMESTAMPTZ,
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON public.project_members (user_id);

CREATE OR REPLACE FUNCTION public.mbt_collab_add_owner_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $body$
BEGIN
    INSERT INTO public.project_members (project_id, user_id, role, invited_at, joined_at)
    VALUES (NEW.id, NEW.owner_user_id, 'owner', now(), now())
    ON CONFLICT (project_id, user_id) DO UPDATE
        SET role = 'owner', joined_at = COALESCE(public.project_members.joined_at, now());
    RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS projects_add_owner_member ON public.projects;
CREATE TRIGGER projects_add_owner_member
    AFTER INSERT ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.mbt_collab_add_owner_member();

CREATE TABLE IF NOT EXISTS public.project_invites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    created_by      UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role_to_grant   TEXT NOT NULL CHECK (role_to_grant IN ('editor', 'viewer')),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
    used_by         UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    used_at         TIMESTAMPTZ,
    revoked         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_invites_project_id_idx ON public.project_invites (project_id);
CREATE INDEX IF NOT EXISTS project_invites_token_idx ON public.project_invites (token);

CREATE OR REPLACE FUNCTION public.mbt_collab_is_project_owner(target_project_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $body$
    SELECT EXISTS (
        SELECT 1 FROM public.projects proj
        WHERE proj.id = target_project_id AND proj.owner_user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.project_members mem
        WHERE mem.project_id = target_project_id AND mem.user_id = auth.uid() AND mem.role = 'owner'
    );
$body$;

CREATE OR REPLACE FUNCTION public.mbt_collab_member_role(target_project_id UUID)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $body$
    SELECT mem.role FROM public.project_members mem
    WHERE mem.project_id = target_project_id AND mem.user_id = auth.uid()
    LIMIT 1;
$body$;

CREATE OR REPLACE FUNCTION public.mbt_collab_can_read_project(target_project_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $body$
    SELECT public.mbt_collab_is_project_owner(target_project_id)
        OR public.mbt_collab_member_role(target_project_id) IS NOT NULL;
$body$;

CREATE OR REPLACE FUNCTION public.mbt_collab_can_write_budget(target_project_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $body$
    SELECT public.mbt_collab_is_project_owner(target_project_id)
        OR public.mbt_collab_member_role(target_project_id) IN ('owner', 'editor');
$body$;

CREATE OR REPLACE FUNCTION public.mbt_collab_guard_project_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $body$
DECLARE
    caller_role text;
BEGIN
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
        IF NOT public.mbt_collab_is_project_owner(OLD.id) THEN
            RAISE EXCEPTION 'Only the project owner can change owner_user_id' USING ERRCODE = '42501';
        END IF;
    END IF;

    caller_role := public.mbt_collab_member_role(OLD.id);
    IF NOT public.mbt_collab_is_project_owner(OLD.id) AND (caller_role IS NULL OR caller_role = 'viewer') THEN
        RAISE EXCEPTION 'Viewers cannot update project rows' USING ERRCODE = '42501';
    END IF;

    IF NOT public.mbt_collab_is_project_owner(OLD.id) AND caller_role = 'editor' THEN
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Editors may only update budget_data and name' USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS projects_guard_update ON public.projects;
CREATE TRIGGER projects_guard_update
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.mbt_collab_guard_project_update();

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_invites FORCE ROW LEVEL SECURITY;

/* SELECT policy must allow INSERT...RETURNING (PostgREST Prefer: return=representation).
   Postgres checks SELECT USING as WCO_RLS_INSERT_CHECK *before* heap insert and
   *before* AFTER INSERT triggers. Helper-only USING (can_read_project) fails then
   because the new projects row is not yet visible to a self-SELECT and project_members
   owner row is not yet created. Direct owner_user_id = auth.uid() is evaluated against
   the NEW-row slot and passes; can_read_project still covers non-owner members. */
DROP POLICY IF EXISTS projects_select_member ON public.projects;
CREATE POLICY projects_select_member ON public.projects
    FOR SELECT TO authenticated
    USING (
        owner_user_id = auth.uid()
        OR public.mbt_collab_can_read_project(id)
    );

DROP POLICY IF EXISTS projects_insert_as_owner ON public.projects;
CREATE POLICY projects_insert_as_owner ON public.projects
    FOR INSERT TO authenticated
    WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS projects_update_owner_or_editor ON public.projects;
CREATE POLICY projects_update_owner_or_editor ON public.projects
    FOR UPDATE TO authenticated
    USING (public.mbt_collab_can_write_budget(id))
    WITH CHECK (public.mbt_collab_can_write_budget(id));

DROP POLICY IF EXISTS projects_delete_owner ON public.projects;
CREATE POLICY projects_delete_owner ON public.projects
    FOR DELETE TO authenticated
    USING (public.mbt_collab_is_project_owner(id));

DROP POLICY IF EXISTS project_members_select_peer ON public.project_members;
CREATE POLICY project_members_select_peer ON public.project_members
    FOR SELECT TO authenticated
    USING (public.mbt_collab_can_read_project(project_id));

DROP POLICY IF EXISTS project_members_insert_owner ON public.project_members;
CREATE POLICY project_members_insert_owner ON public.project_members
    FOR INSERT TO authenticated
    WITH CHECK (public.mbt_collab_is_project_owner(project_id));

DROP POLICY IF EXISTS project_members_update_owner ON public.project_members;
CREATE POLICY project_members_update_owner ON public.project_members
    FOR UPDATE TO authenticated
    USING (public.mbt_collab_is_project_owner(project_id))
    WITH CHECK (public.mbt_collab_is_project_owner(project_id));

DROP POLICY IF EXISTS project_members_delete_owner ON public.project_members;
CREATE POLICY project_members_delete_owner ON public.project_members
    FOR DELETE TO authenticated
    USING (public.mbt_collab_is_project_owner(project_id));

DROP POLICY IF EXISTS project_invites_select_owner ON public.project_invites;
CREATE POLICY project_invites_select_owner ON public.project_invites
    FOR SELECT TO authenticated
    USING (public.mbt_collab_is_project_owner(project_id));

DROP POLICY IF EXISTS project_invites_insert_owner ON public.project_invites;
CREATE POLICY project_invites_insert_owner ON public.project_invites
    FOR INSERT TO authenticated
    WITH CHECK (public.mbt_collab_is_project_owner(project_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS project_invites_update_owner ON public.project_invites;
CREATE POLICY project_invites_update_owner ON public.project_invites
    FOR UPDATE TO authenticated
    USING (public.mbt_collab_is_project_owner(project_id))
    WITH CHECK (public.mbt_collab_is_project_owner(project_id));

DROP POLICY IF EXISTS project_invites_delete_owner ON public.project_invites;
CREATE POLICY project_invites_delete_owner ON public.project_invites
    FOR DELETE TO authenticated
    USING (public.mbt_collab_is_project_owner(project_id));

CREATE OR REPLACE FUNCTION public.redeem_project_invite(invite_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $body$
DECLARE
    calling_user_id uuid := auth.uid();
    invite_row      public.project_invites%ROWTYPE;
    resolved_project_id uuid;
BEGIN
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated: sign in before redeeming an invite' USING ERRCODE = '28000';
    END IF;

    IF invite_token IS NULL OR btrim(invite_token) = '' THEN
        RAISE EXCEPTION 'Invite not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO invite_row FROM public.project_invites
    WHERE token = btrim(invite_token) FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found' USING ERRCODE = 'P0002';
    END IF;

    IF invite_row.revoked THEN
        RAISE EXCEPTION 'Invite revoked' USING ERRCODE = 'P0001';
    END IF;

    IF invite_row.expires_at IS NOT NULL AND invite_row.expires_at < now() THEN
        RAISE EXCEPTION 'Invite expired' USING ERRCODE = 'P0001';
    END IF;

    IF invite_row.used_by IS NOT NULL THEN
        IF invite_row.used_by = calling_user_id THEN
            RETURN invite_row.project_id;
        END IF;
        RAISE EXCEPTION 'Invite already used' USING ERRCODE = 'P0001';
    END IF;

    resolved_project_id := invite_row.project_id;

    INSERT INTO public.project_members (project_id, user_id, role, invited_at, joined_at)
    VALUES (resolved_project_id, calling_user_id, invite_row.role_to_grant, COALESCE(invite_row.created_at, now()), now())
    ON CONFLICT (project_id, user_id) DO NOTHING;

    UPDATE public.project_invites
    SET used_by = calling_user_id, used_at = now()
    WHERE id = invite_row.id AND used_by IS NULL;

    RETURN resolved_project_id;
END;
$body$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_invites TO authenticated;

GRANT EXECUTE ON FUNCTION public.mbt_collab_is_project_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mbt_collab_member_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mbt_collab_can_read_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mbt_collab_can_write_budget(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_project_invite(text) TO authenticated;

REVOKE ALL ON public.projects FROM anon;
REVOKE ALL ON public.project_members FROM anon;
REVOKE ALL ON public.project_invites FROM anon;
REVOKE ALL ON FUNCTION public.redeem_project_invite(text) FROM anon;
