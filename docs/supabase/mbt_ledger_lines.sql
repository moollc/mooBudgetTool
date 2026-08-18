/* mBT ledger lines, block 2
   Additive. Do not drop projects.budget_data or projects.data.
   Apply manually on mbt-collab (omzyycoaaxymjitlnhhj) after review.
   Requires collab projects.id UUID and mbt_collab_can_read_project /
   mbt_collab_can_write_budget from mbt_collab_schema.sql.
   If projects.id is TEXT, stop. Do not coerce. */

CREATE TABLE IF NOT EXISTS public.budget_lines (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    line_key         TEXT NOT NULL,
    section_key      TEXT NOT NULL DEFAULT '',
    description      TEXT NOT NULL DEFAULT '',
    unit             TEXT NOT NULL DEFAULT '',
    rate             NUMERIC,
    quantity         NUMERIC,
    actual_rate      NUMERIC,
    actual_quantity  NUMERIC,
    actual           NUMERIC,
    currency         TEXT NOT NULL DEFAULT '',
    contact_id       TEXT NOT NULL DEFAULT '',
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT budget_lines_project_line_key UNIQUE (project_id, line_key)
);

CREATE INDEX IF NOT EXISTS budget_lines_project_id_idx
    ON public.budget_lines (project_id);

COMMENT ON TABLE public.budget_lines IS
    'Row-model budget lines for export and paid custody. The editor still saves the JSON suitcase. This table is the ledger.';
COMMENT ON COLUMN public.budget_lines.line_key IS
    'Stable id from the local budget item. Unique per project.';

CREATE OR REPLACE FUNCTION public.mbt_ledger_touch_budget_lines()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budget_lines_touch_updated_at ON public.budget_lines;
CREATE TRIGGER budget_lines_touch_updated_at
    BEFORE UPDATE ON public.budget_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.mbt_ledger_touch_budget_lines();

ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_lines_select_members ON public.budget_lines;
CREATE POLICY budget_lines_select_members ON public.budget_lines
    FOR SELECT
    USING (public.mbt_collab_can_read_project(project_id));

DROP POLICY IF EXISTS budget_lines_write_editors ON public.budget_lines;
CREATE POLICY budget_lines_write_editors ON public.budget_lines
    FOR ALL
    USING (public.mbt_collab_can_write_budget(project_id))
    WITH CHECK (public.mbt_collab_can_write_budget(project_id));

REVOKE ALL ON public.budget_lines FROM PUBLIC;
REVOKE ALL ON public.budget_lines FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_lines TO authenticated;

CREATE OR REPLACE VIEW public.budget_export_lines
WITH (security_invoker = true)
AS
SELECT
    p.id AS project_id,
    p.name AS project_name,
    public.mbt_collab_member_role(p.id) AS reader_role,
    l.line_key,
    l.section_key,
    l.description,
    l.unit,
    l.rate,
    l.quantity,
    l.actual_rate,
    l.actual_quantity,
    l.actual,
    l.currency,
    l.contact_id,
    l.updated_at
FROM public.budget_lines l
JOIN public.projects p ON p.id = l.project_id;

COMMENT ON VIEW public.budget_export_lines IS
    'User dump of ledger lines. Runs as the caller. RLS on budget_lines still applies.';

GRANT SELECT ON public.budget_export_lines TO authenticated;
REVOKE ALL ON public.budget_export_lines FROM PUBLIC;
REVOKE ALL ON public.budget_export_lines FROM anon;
