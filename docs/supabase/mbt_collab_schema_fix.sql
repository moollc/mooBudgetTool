/* =========================================================================
   mBT Collab schema fix — INSERT ... RETURNING under RLS
   Target: mbt-collab (ref omzyycoaaxymjitlnhhj)
   Apply manually after review. Do NOT run from agents.

   BUG (confirmed live):
     Prefer: return=minimal  → INSERT 201, row readable on later GET
     Prefer: return=representation (PostgREST default) → 403
       {"code":"42501","message":"new row violates row-level security policy
        for table \"projects\""}
     auth.uid() is correct (SECURITY INVOKER diagnostic RPC).

   ROOT CAUSE (Postgres executor, not JWT / not FORCE RLS alone):
     PostgREST representation mode issues INSERT ... RETURNING *.
     For INSERT with RETURNING, Postgres attaches ALL/SELECT policies as
     WithCheckOptions of kind WCO_RLS_INSERT_CHECK (rowsecurity.c,
     force_using = true so the SELECT USING expr is checked like WITH CHECK).

     ExecInsert evaluates WCO_RLS_INSERT_CHECK *before* table_tuple_insert
     and *before* AFTER ROW INSERT triggers (nodeModifyTable.c):

       1. BEFORE ROW INSERT triggers
       2. ExecWithCheckOptions(WCO_RLS_INSERT_CHECK)  ← INSERT WITH CHECK
          AND SELECT USING (for RETURNING)
       3. heap insert
       4. AFTER ROW INSERT triggers  ← projects_add_owner_member
       5. RETURNING projection

     projects_select_member was only:
       USING (public.mbt_collab_can_read_project(id))

     mbt_collab_can_read_project → mbt_collab_is_project_owner does
       SELECT 1 FROM projects WHERE id = $1 AND owner_user_id = auth.uid()
     and/or project_members for membership.

     At step 2 the new projects row is not in the heap yet, and the AFTER
     INSERT member row does not exist yet. The helper sees neither path →
     false → 42501 "new row violates row-level security policy".

     return=minimal omits RETURNING, so SELECT policies are never attached
     as WCOs; only projects_insert_as_owner WITH CHECK
     (owner_user_id = auth.uid()) runs against the NEW-row slot values and
     succeeds. Later GET works because the row (and trigger member) exist.

     SECURITY DEFINER / BYPASSRLS is a secondary concern: even a perfect
     bypass cannot SELECT a row that has not been inserted yet. FORCE RLS
     does not change WCO ordering.

   FIX:
     Evaluate ownership from the row's own columns in the SELECT policy so
     WCO_RLS_INSERT_CHECK can pass from NEW-row slot values alone during
     INSERT ... RETURNING. Keep the helper for non-owner members.
   ========================================================================= */

DROP POLICY IF EXISTS projects_select_member ON public.projects;
CREATE POLICY projects_select_member ON public.projects
    FOR SELECT
    TO authenticated
    USING (
        /* Direct column check: required for INSERT ... RETURNING.
           WCO sees NEW.owner_user_id / NEW.id from the insert slot before
           heap insert; subqueries into projects cannot see that row yet. */
        owner_user_id = auth.uid()
        OR public.mbt_collab_can_read_project(id)
    );

/* -------------------------------------------------------------------------
   Hardening (optional but recommended): keep helpers correct for post-insert
   reads; explicitly document that SELECT policies used with RETURNING must
   not rely solely on AFTER INSERT side effects or self-table SELECTs.

   No change required to projects_insert_as_owner, the add-owner-member
   trigger, or FORCE ROW LEVEL SECURITY for this bug.
   ------------------------------------------------------------------------- */
