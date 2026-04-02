/* =========================================================================
   Phase 68A: Async Approval Engine — mbt_pending_edits holding table
   Run this migration in the Supabase SQL editor before deploying Phase 68A.
   ========================================================================= */

CREATE TABLE IF NOT EXISTS mbt_pending_edits (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      TEXT        NOT NULL,
    user_id         UUID        NOT NULL DEFAULT auth.uid(),
    requested_by    TEXT        NOT NULL,           -- display name of submitting editor
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected')),
    budget_snapshot JSONB       NOT NULL,           -- full budget JSON at time of submission
    diff_log        JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- array of activityLog diffs
    message         TEXT        DEFAULT '',         -- optional commit message from editor
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Index for querying pending approvals per project */
CREATE INDEX IF NOT EXISTS mbt_pending_edits_project_status
    ON mbt_pending_edits (project_id, status);

/* RLS: Editors can insert and read their own submissions.
   Owners (admins) can read and update status on all submissions for their projects. */
ALTER TABLE mbt_pending_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editors_insert_own" ON mbt_pending_edits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "editors_read_own" ON mbt_pending_edits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "owner_read_all_pending" ON mbt_pending_edits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "owner_update_status" ON mbt_pending_edits
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id AND p.user_id = auth.uid()
        )
    );

/* =========================================================================
   Phase 92: Presence 2.0 — mbt_activity_log persistent activity feed table
   Run this migration in the Supabase SQL editor before deploying Phase 92.
   ========================================================================= */

CREATE TABLE IF NOT EXISTS mbt_activity_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   TEXT        NOT NULL,
    user_id      UUID        NOT NULL DEFAULT auth.uid(),
    display_name TEXT        NOT NULL DEFAULT 'Collaborator',
    action_type  TEXT        NOT NULL
                             CHECK (action_type IN ('field_edit', 'tool_open', 'field_lock', 'budget_save')),
    section      TEXT        NOT NULL DEFAULT '',
    field        TEXT        NOT NULL DEFAULT '',
    detail       TEXT        NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Index for fetching recent activity per project, sorted newest-first */
CREATE INDEX IF NOT EXISTS mbt_activity_log_project_time
    ON mbt_activity_log (project_id, created_at DESC);

/* RLS: Any authenticated user can insert their own rows.
   Rows are readable by the inserting user and by the project owner. */
ALTER TABLE mbt_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_insert_own_activity" ON mbt_activity_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members_read_own_activity" ON mbt_activity_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "owner_read_all_activity" ON mbt_activity_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id AND p.user_id = auth.uid()
        )
    );
