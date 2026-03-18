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

/* --- 7. og_community_rates (Open Gate public rate database) --- */
/*
 * This is the heart of the Open Gate ethos.
 * Anyone can READ rates with the publishable key — no account required.
 * Authenticated users can CONTRIBUTE rates to help calibrate the database.
 * The gate is open.
 *
 * To seed initial data, run the INSERT block below after creating the table.
 */
CREATE TABLE IF NOT EXISTS og_community_rates (
    id              BIGSERIAL   PRIMARY KEY,
    description     TEXT        NOT NULL,
    unit            TEXT        NOT NULL DEFAULT 'Day',
    rate            NUMERIC     NOT NULL DEFAULT 0,
    currency        TEXT        NOT NULL DEFAULT 'JMD',
    region          TEXT        NOT NULL DEFAULT 'Jamaica',
    source          TEXT        NOT NULL DEFAULT 'seed',  -- 'seed' | 'community'
    contributed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE og_community_rates ENABLE ROW LEVEL SECURITY;

/* Public read — no account required. This is intentional. */
CREATE POLICY "og_rates: public read"   ON og_community_rates FOR SELECT USING (true);
/* Write requires a Supabase account */
CREATE POLICY "og_rates: auth insert"   ON og_community_rates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "og_rates: owner update"  ON og_community_rates FOR UPDATE USING (auth.uid() = contributed_by);
CREATE POLICY "og_rates: owner delete"  ON og_community_rates FOR DELETE USING (auth.uid() = contributed_by);

CREATE INDEX IF NOT EXISTS idx_og_rates_region ON og_community_rates(region);

/* --- Jamaica 2025 Seed Data --- */
/* Run this once after creating the table to populate the baseline database. */
INSERT INTO og_community_rates (description, unit, rate, currency, region, source) VALUES
('Storyboard Artist', 'Day', 45000, 'JMD', 'Jamaica', 'seed'),
('Copywriter (Pitch/Treatment)', 'Flat', 75000, 'JMD', 'Jamaica', 'seed'),
('Script Consultant / Doctor', 'Flat', 150000, 'JMD', 'Jamaica', 'seed'),
('Pitch Deck Designer', 'Flat', 120000, 'JMD', 'Jamaica', 'seed'),
('Researcher', 'Day', 25000, 'JMD', 'Jamaica', 'seed'),
('Concept Artist', 'Day', 40000, 'JMD', 'Jamaica', 'seed'),
('Legal - Rights & Clearances', 'Flat', 250000, 'JMD', 'Jamaica', 'seed'),
('Director', 'Day', 85000, 'JMD', 'Jamaica', 'seed'),
('Executive Producer', 'Flat', 500000, 'JMD', 'Jamaica', 'seed'),
('Producer', 'Day', 75000, 'JMD', 'Jamaica', 'seed'),
('Line Producer', 'Day', 65000, 'JMD', 'Jamaica', 'seed'),
('Screenwriter', 'Flat', 350000, 'JMD', 'Jamaica', 'seed'),
('Cast - Lead', 'Day', 100000, 'JMD', 'Jamaica', 'seed'),
('Cast - Supporting', 'Day', 50000, 'JMD', 'Jamaica', 'seed'),
('Stunt Coordinator', 'Day', 60000, 'JMD', 'Jamaica', 'seed'),
('Unit Production Manager (UPM)', 'Day', 60000, 'JMD', 'Jamaica', 'seed'),
('Production Coordinator', 'Day', 30000, 'JMD', 'Jamaica', 'seed'),
('1st Assistant Director (1st AD)', 'Day', 65000, 'JMD', 'Jamaica', 'seed'),
('2nd Assistant Director', 'Day', 45000, 'JMD', 'Jamaica', 'seed'),
('2nd 2nd AD', 'Day', 25000, 'JMD', 'Jamaica', 'seed'),
('Key PA', 'Day', 20000, 'JMD', 'Jamaica', 'seed'),
('Set PA', 'Day', 15000, 'JMD', 'Jamaica', 'seed'),
('Office PA', 'Day', 15000, 'JMD', 'Jamaica', 'seed'),
('Truck PA', 'Day', 18000, 'JMD', 'Jamaica', 'seed'),
('Location Manager', 'Day', 50000, 'JMD', 'Jamaica', 'seed'),
('Location Scout', 'Day', 35000, 'JMD', 'Jamaica', 'seed'),
('Script Supervisor', 'Day', 40000, 'JMD', 'Jamaica', 'seed'),
('Medic / Set Nurse', 'Day', 35000, 'JMD', 'Jamaica', 'seed'),
('Security Guard', 'Day', 12000, 'JMD', 'Jamaica', 'seed'),
('Craft Service', 'Day', 25000, 'JMD', 'Jamaica', 'seed'),
('Catering (Per Head)', 'Flat', 2500, 'JMD', 'Jamaica', 'seed'),
('Director of Photography (DP)', 'Day', 90000, 'JMD', 'Jamaica', 'seed'),
('Camera Operator', 'Day', 60000, 'JMD', 'Jamaica', 'seed'),
('1st Assistant Camera (Focus)', 'Day', 45000, 'JMD', 'Jamaica', 'seed'),
('2nd Assistant Camera', 'Day', 35000, 'JMD', 'Jamaica', 'seed'),
('Digital Imaging Tech (DIT)', 'Day', 50000, 'JMD', 'Jamaica', 'seed'),
('Steadicam Operator', 'Day', 70000, 'JMD', 'Jamaica', 'seed'),
('Drone Operator', 'Day', 55000, 'JMD', 'Jamaica', 'seed'),
('Camera Utility', 'Day', 25000, 'JMD', 'Jamaica', 'seed'),
('Gaffer', 'Day', 55000, 'JMD', 'Jamaica', 'seed'),
('Best Boy Electric', 'Day', 40000, 'JMD', 'Jamaica', 'seed'),
('Electrician', 'Day', 30000, 'JMD', 'Jamaica', 'seed'),
('Key Grip', 'Day', 50000, 'JMD', 'Jamaica', 'seed'),
('Best Boy Grip', 'Day', 40000, 'JMD', 'Jamaica', 'seed'),
('Dolly Grip', 'Day', 40000, 'JMD', 'Jamaica', 'seed'),
('Grip', 'Day', 30000, 'JMD', 'Jamaica', 'seed'),
('Generator Operator', 'Day', 35000, 'JMD', 'Jamaica', 'seed'),
('Sound Mixer', 'Day', 50000, 'JMD', 'Jamaica', 'seed'),
('Boom Operator', 'Day', 35000, 'JMD', 'Jamaica', 'seed'),
('Sound Utility', 'Day', 25000, 'JMD', 'Jamaica', 'seed'),
('Production Designer', 'Day', 65000, 'JMD', 'Jamaica', 'seed'),
('Art Director', 'Day', 50000, 'JMD', 'Jamaica', 'seed'),
('Set Decorator', 'Day', 45000, 'JMD', 'Jamaica', 'seed'),
('Set Dresser', 'Day', 30000, 'JMD', 'Jamaica', 'seed'),
('Props Master', 'Day', 45000, 'JMD', 'Jamaica', 'seed'),
('Assistant Props', 'Day', 30000, 'JMD', 'Jamaica', 'seed'),
('Costume Designer', 'Day', 55000, 'JMD', 'Jamaica', 'seed'),
('Wardrobe Stylist', 'Day', 45000, 'JMD', 'Jamaica', 'seed'),
('Wardrobe Assistant', 'Day', 25000, 'JMD', 'Jamaica', 'seed'),
('Makeup Artist (Key)', 'Day', 45000, 'JMD', 'Jamaica', 'seed'),
('Hair Stylist (Key)', 'Day', 45000, 'JMD', 'Jamaica', 'seed'),
('Makeup/Hair Assistant', 'Day', 25000, 'JMD', 'Jamaica', 'seed'),
('Post-Production Supervisor', 'Week', 200000, 'JMD', 'Jamaica', 'seed'),
('Editor', 'Day', 50000, 'JMD', 'Jamaica', 'seed'),
('Assistant Editor (AE)', 'Day', 25000, 'JMD', 'Jamaica', 'seed'),
('Colorist', 'Hour', 15000, 'JMD', 'Jamaica', 'seed'),
('VFX Supervisor', 'Day', 70000, 'JMD', 'Jamaica', 'seed'),
('VFX Artist', 'Day', 55000, 'JMD', 'Jamaica', 'seed'),
('Sound Designer', 'Flat', 150000, 'JMD', 'Jamaica', 'seed'),
('Composer', 'Flat', 200000, 'JMD', 'Jamaica', 'seed'),
('Music Supervisor', 'Flat', 100000, 'JMD', 'Jamaica', 'seed')
ON CONFLICT DO NOTHING;

/* --- Indexes for common query patterns --- */
CREATE INDEX IF NOT EXISTS idx_stages_project      ON stages(project_id);
CREATE INDEX IF NOT EXISTS idx_executions_project  ON executions(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_user       ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_stages_user         ON stages(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_user     ON executions(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user       ON contacts(user_id);
