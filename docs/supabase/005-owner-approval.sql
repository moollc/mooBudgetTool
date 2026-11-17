/* Shared-edit owner enforcement. Apply with the matching app after review.
   Requires history tables/RPCs from 001. No data rewrite. Owners retain direct
   saves; editors submit drafts through mbt_submit_edit. Test locally first. */
BEGIN;
CREATE OR REPLACE FUNCTION public.mbt_guard_approved_budget() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.budget_data IS DISTINCT FROM OLD.budget_data
       OR NEW.revision IS DISTINCT FROM OLD.revision THEN
        IF public.mbt_collab_is_project_owner(OLD.id) IS NOT TRUE THEN
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
        IF public.mbt_collab_is_project_owner(OLD.project_id) IS NOT TRUE THEN
            RAISE EXCEPTION 'Owner ledger writes required';
        END IF;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF public.mbt_collab_is_project_owner(NEW.project_id) IS NOT TRUE THEN
            RAISE EXCEPTION 'Owner ledger writes required';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mbt_owner_line_guard ON public.budget_lines;
CREATE TRIGGER mbt_owner_line_guard BEFORE INSERT OR UPDATE OR DELETE ON public.budget_lines
    FOR EACH ROW EXECUTE FUNCTION public.mbt_guard_owner_lines();
COMMIT;
/* Rollback only the enforcement triggers if the coordinated rollout fails:
   DROP TRIGGER mbt_approved_budget_guard ON public.projects;
   DROP TRIGGER mbt_owner_line_guard ON public.budget_lines;
   Keep history and pending drafts. Older optional003 has different owner-save
   semantics and must not be reapplied over005. */
