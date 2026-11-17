/* Apply after 001, 002 and 005. Plain PostgreSQL, no hosted-only dependencies.
   Publish the new app first. Live is the default; pending edits stay pending.
   Realtime is optional: run the Realtime service and add public.projects to
   supabase_realtime publication if absent. The app polls every ten seconds.
   Never run optional 003 over this migration. */
BEGIN;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS collab_mode TEXT NOT NULL DEFAULT 'live'
    CHECK (collab_mode IN ('live', 'paused'));
CREATE OR REPLACE FUNCTION public.mbt_guard_approved_budget() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF (NEW.name IS DISTINCT FROM OLD.name OR NEW.collab_mode IS DISTINCT FROM OLD.collab_mode)
       AND public.mbt_collab_is_project_owner(OLD.id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Only the owner controls the shared budget name and mode';
    END IF;
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.budget_data IS DISTINCT FROM OLD.budget_data
       OR NEW.revision IS DISTINCT FROM OLD.revision THEN
        IF public.mbt_collab_is_project_owner(OLD.id) IS NOT TRUE AND NOT
           (NEW.owner_user_id IS NOT DISTINCT FROM OLD.owner_user_id AND OLD.collab_mode = 'live'
            AND coalesce(current_setting('mbt.approval_rpc', true), '') = 'on'
            AND public.mbt_collab_can_write_budget(OLD.id) IS TRUE) THEN
            RAISE EXCEPTION 'Shared budget changes require an owner decision';
        END IF;
    END IF;
    /* Owner direct saves and approval RPCs both advance exactly one revision. */
    IF NEW.budget_data IS DISTINCT FROM OLD.budget_data THEN
        NEW.revision := OLD.revision + 1;
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mbt_approved_budget_guard ON public.projects;
CREATE TRIGGER mbt_approved_budget_guard BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.mbt_guard_approved_budget();

CREATE OR REPLACE FUNCTION public.mbt_guard_owner_lines() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        IF public.mbt_collab_is_project_owner(OLD.project_id) IS NOT TRUE AND NOT
           (coalesce(current_setting('mbt.approval_rpc', true), '') = 'on'
            AND public.mbt_collab_can_write_budget(OLD.project_id) IS TRUE
            AND EXISTS (SELECT 1 FROM public.projects WHERE id = OLD.project_id AND collab_mode = 'live')) THEN
            RAISE EXCEPTION 'Owner ledger writes required';
        END IF;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF public.mbt_collab_is_project_owner(NEW.project_id) IS NOT TRUE AND NOT
           (coalesce(current_setting('mbt.approval_rpc', true), '') = 'on'
            AND public.mbt_collab_can_write_budget(NEW.project_id) IS TRUE
            AND EXISTS (SELECT 1 FROM public.projects WHERE id = NEW.project_id AND collab_mode = 'live')) THEN
            RAISE EXCEPTION 'Owner ledger writes required';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mbt_owner_line_guard ON public.budget_lines;
CREATE TRIGGER mbt_owner_line_guard BEFORE INSERT OR UPDATE OR DELETE ON public.budget_lines
    FOR EACH ROW EXECUTE FUNCTION public.mbt_guard_owner_lines();
CREATE OR REPLACE FUNCTION public.mbt_apply_edit_internal(p_edit_id UUID, p_approve BOOLEAN)
RETURNS public.project_edits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    edit        public.project_edits;
    project     public.projects;
    actual      TEXT[];
    present     BOOLEAN;
    next_budget JSONB;
BEGIN
    SELECT * INTO edit FROM public.project_edits WHERE id = p_edit_id;
    IF NOT FOUND OR NOT (public.mbt_collab_is_project_owner(edit.project_id) OR
        (p_approve AND edit.user_id = auth.uid() AND public.mbt_collab_can_write_budget(edit.project_id) IS TRUE
         AND EXISTS (SELECT 1 FROM public.projects WHERE id = edit.project_id AND collab_mode = 'live'))) THEN
        RAISE EXCEPTION 'Owner decision required';
    END IF;
    SELECT * INTO project FROM public.projects WHERE id = edit.project_id FOR UPDATE;
    SELECT * INTO edit FROM public.project_edits WHERE id = p_edit_id FOR UPDATE;
    IF edit.status <> 'pending' THEN
        IF (edit.status = 'approved') <> p_approve THEN
            RAISE EXCEPTION 'Edit already decided';
        END IF;
        RETURN edit;
    END IF;
    next_budget := project.budget_data;
    IF p_approve THEN
        actual := public.mbt_edit_path(project.budget_data, edit.path);
        present := (project.budget_data #> actual) IS NOT NULL;
        IF present <> edit.before_present
           OR (present AND (project.budget_data #> actual) IS DISTINCT FROM edit.before_value) THEN
            RAISE EXCEPTION 'Edit conflicts with owner value';
        END IF;
        IF edit.operation = 'delete' THEN
            next_budget := next_budget #- actual;
        ELSE
            IF cardinality(actual) > 1 AND next_budget #> actual[1:cardinality(actual) - 1] IS NULL THEN
                RAISE EXCEPTION 'Parent missing';
            END IF;
            next_budget := jsonb_set(next_budget, actual, coalesce(edit.after_value, 'null'::jsonb), true);
            IF cardinality(actual) > 1 AND actual[cardinality(actual)] = 'rate'
               AND jsonb_typeof(next_budget #> actual[1:cardinality(actual) - 1]) = 'object' THEN
                next_budget := jsonb_set(next_budget, actual[1:cardinality(actual) - 1],
                                         (next_budget #> actual[1:cardinality(actual) - 1]) || edit.tags, true);
            END IF;
        END IF;
    END IF;
    /* Lets the optional write guard (003) tell this path from a direct write. */
    PERFORM set_config('mbt.approval_rpc', 'on', true);
    UPDATE public.projects
    SET budget_data = next_budget, revision = revision + 1, updated_at = now()
    WHERE id = project.id;
    IF p_approve THEN
        PERFORM public.mbt_apply_line_delta(project.id, project.budget_data, next_budget);
    END IF;
    UPDATE public.project_edits
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        decided_at = now(), decided_by = auth.uid(), decision_revision = project.revision + 1
    WHERE id = edit.id
    RETURNING * INTO edit;
    PERFORM set_config('mbt.approval_rpc', '', true);
    RETURN edit;
END;
$$;

CREATE OR REPLACE FUNCTION public.mbt_decide_edit(p_edit_id UUID, p_approve BOOLEAN)
RETURNS public.project_edits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.project_edits;
BEGIN
    SELECT * INTO e FROM public.project_edits WHERE id = p_edit_id;
    IF NOT FOUND OR public.mbt_collab_is_project_owner(e.project_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Owner decision required';
    END IF;
    RETURN public.mbt_apply_edit_internal(p_edit_id, p_approve);
END $$;
CREATE OR REPLACE FUNCTION public.mbt_set_collab_mode(p_project_id UUID, p_mode TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM 1 FROM public.projects WHERE id = p_project_id FOR UPDATE;
    IF auth.uid() IS NULL OR public.mbt_collab_is_project_owner(p_project_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Only the owner controls Live or Paused';
    END IF;
    IF p_mode IS NULL OR p_mode NOT IN ('live', 'paused') THEN RAISE EXCEPTION 'Invalid collaboration mode'; END IF;
    UPDATE public.projects SET collab_mode = p_mode, updated_at = now() WHERE id = p_project_id;
    RETURN p_mode;
END $$;
REVOKE ALL ON FUNCTION public.mbt_apply_edit_internal(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mbt_set_collab_mode(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mbt_set_collab_mode(UUID, TEXT) TO authenticated;
CREATE OR REPLACE FUNCTION public.mbt_submit_edit(
    p_id UUID, p_project_id UUID, p_path TEXT[], p_before JSONB, p_present BOOLEAN,
    p_after JSONB, p_operation TEXT, p_revision BIGINT, p_tags JSONB DEFAULT '{}'::jsonb)
RETURNS public.project_edits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    edit public.project_edits;
    mode TEXT;
    inserted BOOLEAN;
BEGIN
    /* The live helper returns NULL (not false) for a non member, so test with IS NOT TRUE. */
    IF auth.uid() IS NULL OR public.mbt_collab_can_write_budget(p_project_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Editor membership required';
    END IF;
    IF cardinality(p_path) < 1 OR p_revision < 0 OR p_operation NOT IN ('set', 'delete') THEN
        RAISE EXCEPTION 'Invalid edit';
    END IF;
    IF p_path[1] IN ('activityLog', 'collab_project_id', 'id', 'owner_user_id', 'revision') THEN
        RAISE EXCEPTION 'Reserved budget field';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(p_path) p WHERE p IN ('__proto__', 'constructor', 'prototype')) THEN
        RAISE EXCEPTION 'Unsafe path';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_tags) k
               WHERE k NOT IN ('rateOverride', 'rateSource', 'baseRate', 'userPrice', 'userPriceAt', 'userPriceId', 'userPriceUserId')) THEN
        RAISE EXCEPTION 'Invalid price metadata';
    END IF;
    IF coalesce(p_tags ->> 'userPriceUserId', '') <> '' AND p_tags ->> 'userPriceUserId' <> auth.uid()::text THEN
        RAISE EXCEPTION 'Price author must match actor';
    END IF;
    SELECT collab_mode INTO mode FROM public.projects WHERE id = p_project_id FOR UPDATE;
    INSERT INTO public.project_edits (id, project_id, user_id, path, before_value, before_present, after_value,
                                      operation, base_revision, tags)
    VALUES (p_id, p_project_id, auth.uid(), p_path, p_before, p_present, p_after, p_operation, p_revision, p_tags)
    ON CONFLICT (id) DO NOTHING;
    inserted := FOUND;
    SELECT * INTO edit FROM public.project_edits WHERE id = p_id;
    IF edit.project_id <> p_project_id OR edit.user_id <> auth.uid() OR edit.path <> p_path
       OR edit.before_value IS DISTINCT FROM p_before OR edit.after_value IS DISTINCT FROM p_after
       OR edit.before_present <> p_present OR edit.operation <> p_operation OR edit.tags <> p_tags THEN
        RAISE EXCEPTION 'Event id collision';
    END IF;
    IF inserted AND edit.status = 'pending' THEN
        IF public.mbt_collab_is_project_owner(p_project_id) THEN
            edit := public.mbt_apply_edit_internal(p_id, true);
        ELSIF mode = 'live' THEN
            BEGIN
                edit := public.mbt_apply_edit_internal(p_id, true);
            EXCEPTION WHEN raise_exception THEN
                IF SQLERRM NOT IN ('Edit conflicts with owner value', 'Target item missing', 'Parent missing', 'Expected array', 'New item id conflicts with an existing line') THEN RAISE; END IF;
                /* A stale live change remains a proposal, without endless retries. */
            WHEN invalid_text_representation OR numeric_value_out_of_range THEN
                /* Invalid ledger numbers stay proposals; the shared budget is unchanged. */
                NULL;
            END;
        END IF;
    END IF;
    RETURN edit;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
