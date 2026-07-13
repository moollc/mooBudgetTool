/* =========================================================================
   mBT Collab — project_activity (Activity tab for real collab)
   Target: mbt-collab (ref omzyycoaaxymjitlnhhj)
   Apply manually after review. Do NOT run from agents.

   CONTEXT
   -------
   Share Hub Activity previously called getBaseUrl() → mbt_supabase_url
   (personal-backup project) and mbt_activity_log (owner-only RLS there).
   Real collab users have empty mbt_supabase_url, so the tab was dead.

   This migration adds project_activity on the mbt-collab project only.
   Proposals / approval queue are explicitly out of scope (editors write
   budget_data directly).

   WHY THIS IS SIMPLER THAN project_invites
   ----------------------------------------
   Invites need: opaque token, expiry, revoke, one-time use, SECURITY DEFINER
   redeem RPC (guest is not a member yet, so RLS cannot let them SELECT the
   invite row or INSERT themselves into project_members).

   Activity is membership-gated only:
     - SELECT: any member (mbt_collab_can_read_project)
     - INSERT: writers who attribute the row to themselves
       (mbt_collab_can_write_budget AND user_id = auth.uid())
   No token, no redeem function, no system actor. Append-only log.

   INSERT ... RETURNING note
   -------------------------
   SELECT policy uses mbt_collab_can_read_project(project_id). That helper
   checks membership of auth.uid(), not visibility of the new activity row,
   so WCO_RLS_INSERT_CHECK during Prefer: return=representation is fine
   (unlike the projects self-SELECT bug fixed in mbt_collab_schema_fix.sql).
   ========================================================================= */

CREATE TABLE IF NOT EXISTS public.project_activity (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    /* Self-attributed only (app + RLS). NOT NULL: no system/anon actors in v1. */
    user_id      UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    action_type  TEXT NOT NULL
                 CHECK (action_type IN (
                     'field_edit',
                     'save',
                     'member_joined',
                     'invite_created'
                 )),
    description  TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Typical query: latest N rows for one project (Share Hub Activity tab). */
CREATE INDEX IF NOT EXISTS project_activity_project_created_idx
    ON public.project_activity (project_id, created_at DESC);

ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity FORCE ROW LEVEL SECURITY;

/* Members can read the log for projects they can open. */
DROP POLICY IF EXISTS project_activity_select_member ON public.project_activity;
CREATE POLICY project_activity_select_member ON public.project_activity
    FOR SELECT
    TO authenticated
    USING (public.mbt_collab_can_read_project(project_id));

/* Writers may append rows only as themselves (cannot spoof user_id).
   No UPDATE/DELETE policies: append-only. Missing policies = deny. */
DROP POLICY IF EXISTS project_activity_insert_writer_self ON public.project_activity;
CREATE POLICY project_activity_insert_writer_self ON public.project_activity
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.mbt_collab_can_write_budget(project_id)
        AND user_id = auth.uid()
    );

/* Explicit grants: this project has "Automatically expose new tables" OFF. */
GRANT SELECT, INSERT ON public.project_activity TO authenticated;
REVOKE ALL ON public.project_activity FROM anon;

/* No UPDATE/DELETE table grants either — matches append-only design. */
