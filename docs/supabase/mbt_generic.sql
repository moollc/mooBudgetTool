/* mBT generic KV (user_preferences)
   Additive. Do not drop projects, budget_data, or budget_lines.
   Apply manually on mbt-collab (omzyycoaaxymjitlnhhj) after Lead review.
   Shape matches mBT/src/services/supabase-sync.js sbUpsert('mbt_generic'):
     key TEXT, user_id UUID, value JSONB, updated_at TIMESTAMPTZ
   Unique / conflict target is (user_id, key) so PostgREST
   Prefer: resolution=merge-duplicates can upsert the same four fields.
   Not a project suitcase. Do not put this on budget_data or projects.

   PWA READ: pullPreferences GET rest/v1/mbt_generic?key=eq.user_preferences
   PWA WRITE of ordinary prefs: pushPreferences upserts value JSON.
   PWA must NEVER mint or push mBT_partnerDonateUnlocked from local
   (PULL_ONLY_PREFS in supabase-sync.js). Ordinary push merges remote
   pull-only keys so an upsert does not wipe a donor stamp.

   Stamp path this pass: SQL or service-role update below. Redeem-code UI
   and BMC webhook are later. No honor button. */

CREATE TABLE IF NOT EXISTS public.mbt_generic (
    user_id     UUID NOT NULL,
    key         TEXT NOT NULL,
    value       JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mbt_generic_pkey PRIMARY KEY (user_id, key)
);

COMMENT ON TABLE public.mbt_generic IS
    'Per-user KV. key user_preferences holds ordinary prefs plus a supporter stamp when Lead or SQL writes mBT_partnerDonateUnlocked. The PWA must not mint that key.';
COMMENT ON COLUMN public.mbt_generic.key IS
    'Row kind. Prefs use user_preferences.';
COMMENT ON COLUMN public.mbt_generic.value IS
    'JSONB object. Ordinary syncable prefs plus optional mBT_partnerDonateUnlocked.';

ALTER TABLE public.mbt_generic ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mbt_generic FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mbt_generic_select_own ON public.mbt_generic;
CREATE POLICY mbt_generic_select_own ON public.mbt_generic
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS mbt_generic_insert_own ON public.mbt_generic;
CREATE POLICY mbt_generic_insert_own ON public.mbt_generic
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS mbt_generic_update_own ON public.mbt_generic;
CREATE POLICY mbt_generic_update_own ON public.mbt_generic
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.mbt_generic FROM PUBLIC;
REVOKE ALL ON public.mbt_generic FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.mbt_generic TO authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.mbt_generic FROM authenticated;

NOTIFY pgrst, 'reload schema';

/* Stamp a donor. Service role or this SQL editor. Not the PWA.
   Replace USER_UUID. value is a JSON string 'true' so localStorage.setItem
   on pull matches PartnerDrawer isDonateUnlocked.
   Test-owner on this project: 7565fc3c-8623-4a53-b45c-c3fe91f4d98e
   (AccountsDetails.md). Do not put passwords in this file.

   If a user_preferences row already exists:

UPDATE public.mbt_generic
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('mBT_partnerDonateUnlocked', 'true'),
    updated_at = now()
WHERE user_id = 'USER_UUID'::uuid
  AND key = 'user_preferences';

   If no row yet, or to stamp in one shot without a prior prefs save:

INSERT INTO public.mbt_generic (user_id, key, value, updated_at)
VALUES (
    'USER_UUID'::uuid,
    'user_preferences',
    jsonb_build_object('mBT_partnerDonateUnlocked', 'true'),
    now()
)
ON CONFLICT (user_id, key) DO UPDATE
SET value = COALESCE(public.mbt_generic.value, '{}'::jsonb) || jsonb_build_object('mBT_partnerDonateUnlocked', 'true'),
    updated_at = now();

   Unstamp (test only):

UPDATE public.mbt_generic
SET value = value - 'mBT_partnerDonateUnlocked',
    updated_at = now()
WHERE user_id = 'USER_UUID'::uuid
  AND key = 'user_preferences';
*/
