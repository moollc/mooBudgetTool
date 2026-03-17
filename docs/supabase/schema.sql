/* ========= mBT Supabase Schema v1.0 =========
   6 tables mirroring mBTMonolithDB IndexedDB stores.
   Every table includes user_id (auth.uid()) and RLS scoped to that column.
   Run this SQL in the Supabase SQL editor for a new project.
   ============================================= */

/* --- 1. projects (mirrors mbt_projects store) --- */
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT        PRIMARY KEY,
    user_id     UUID        NOT NULL DEFAULT auth.uid(),
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects: owner read"   ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects: owner insert" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects: owner update" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects: owner delete" ON projects FOR DELETE USING (auth.uid() = user_id);

/* --- 2. stages (mirrors mbt_stages store) --- */
CREATE TABLE IF NOT EXISTS stages (
    id          TEXT        PRIMARY KEY,
    user_id     UUID        NOT NULL DEFAULT auth.uid(),
    project_id  TEXT        REFERENCES projects(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stages: owner read"   ON stages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "stages: owner insert" ON stages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stages: owner update" ON stages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "stages: owner delete" ON stages FOR DELETE USING (auth.uid() = user_id);

/* --- 3. executions (mirrors mbt_executions store) --- */
CREATE TABLE IF NOT EXISTS executions (
    id          TEXT        PRIMARY KEY,
    user_id     UUID        NOT NULL DEFAULT auth.uid(),
    project_id  TEXT        REFERENCES projects(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "executions: owner read"   ON executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "executions: owner insert" ON executions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "executions: owner update" ON executions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "executions: owner delete" ON executions FOR DELETE USING (auth.uid() = user_id);

/* --- 4. og_ref (mirrors og_ref store — OpenGate industry rate reference) --- */
/* og_ref is reference data seeded by the app. Users can extend it, not share it. */
CREATE TABLE IF NOT EXISTS og_ref (
    id          TEXT        PRIMARY KEY,
    user_id     UUID        NOT NULL DEFAULT auth.uid(),
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE og_ref ENABLE ROW LEVEL SECURITY;

CREATE POLICY "og_ref: owner read"   ON og_ref FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "og_ref: owner insert" ON og_ref FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "og_ref: owner update" ON og_ref FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "og_ref: owner delete" ON og_ref FOR DELETE USING (auth.uid() = user_id);

/* --- 5. contacts (mirrors contacts store — crew/vendor registry) --- */
CREATE TABLE IF NOT EXISTS contacts (
    id          TEXT        PRIMARY KEY,
    user_id     UUID        NOT NULL DEFAULT auth.uid(),
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts: owner read"   ON contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contacts: owner insert" ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contacts: owner update" ON contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "contacts: owner delete" ON contacts FOR DELETE USING (auth.uid() = user_id);

/* --- 6. sessions (mirrors sessions store — auth session state) --- */
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT        PRIMARY KEY,
    user_id     UUID        NOT NULL DEFAULT auth.uid(),
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions: owner read"   ON sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sessions: owner insert" ON sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions: owner update" ON sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sessions: owner delete" ON sessions FOR DELETE USING (auth.uid() = user_id);

/* --- Indexes for common query patterns --- */
CREATE INDEX IF NOT EXISTS idx_stages_project      ON stages(project_id);
CREATE INDEX IF NOT EXISTS idx_executions_project  ON executions(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_user       ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_stages_user         ON stages(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_user     ON executions(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user       ON contacts(user_id);
