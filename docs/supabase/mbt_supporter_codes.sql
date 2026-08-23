/* mBT supporter redeem codes
   Additive. Do not drop mbt_generic, budget_data, budget_lines, or projects.
   Apply manually on mbt-collab (omzyycoaaxymjitlnhhj) after Lead review.
   Unused codes are not prefs. Do not hang this list off mbt_generic.
   PWA must NEVER SELECT this table. Redeem is RPC only, then pullPreferences.

   Code form: 8 chars from ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (no I, O, 0, 1).
   Store uppercase, no punctuation. Human may type a leading MOO-.
   Issue via CLI INSERT below. Do not mint from the PWA. No BMC webhook this pass. */

CREATE TABLE IF NOT EXISTS public.supporter_codes (
    code         TEXT PRIMARY KEY,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    note         TEXT,
    redeemed_by  UUID,
    redeemed_at  TIMESTAMPTZ
);

COMMENT ON TABLE public.supporter_codes IS
    'One-time supporter redeem codes. CLI insert only. PWA has no SELECT. Redeem via mbt_redeem_supporter_code.';
COMMENT ON COLUMN public.supporter_codes.code IS
    'Normalized uppercase 8-char code. Not a UUID.';
COMMENT ON COLUMN public.supporter_codes.note IS
    'Optional. Who checked the payment. No wallet dump.';
COMMENT ON COLUMN public.supporter_codes.redeemed_by IS
    'auth.users id on first successful redeem. NULL until used.';

ALTER TABLE public.supporter_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supporter_codes FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.supporter_codes FROM PUBLIC;
REVOKE ALL ON TABLE public.supporter_codes FROM anon;
REVOKE ALL ON TABLE public.supporter_codes FROM authenticated;

CREATE OR REPLACE FUNCTION public.mbt_redeem_supporter_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid;
    v_code text;
    v_claimed text;
    v_mine text;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    v_code := upper(trim(both from coalesce(p_code, '')));
    v_code := replace(v_code, ' ', '');
    IF left(v_code, 4) = 'MOO-' THEN
        v_code := substr(v_code, 5);
    END IF;
    IF v_code = '' THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    UPDATE public.supporter_codes
    SET redeemed_by = v_uid,
        redeemed_at = now()
    WHERE code = v_code
      AND redeemed_by IS NULL
    RETURNING code INTO v_claimed;

    IF v_claimed IS NULL THEN
        SELECT sc.code INTO v_mine
        FROM public.supporter_codes sc
        WHERE sc.code = v_code
          AND sc.redeemed_by = v_uid;
        IF v_mine IS NULL THEN
            RETURN jsonb_build_object('ok', false);
        END IF;
    END IF;

    INSERT INTO public.mbt_generic (user_id, key, value, updated_at)
    VALUES (
        v_uid,
        'user_preferences',
        jsonb_build_object('mBT_partnerDonateUnlocked', 'true'),
        now()
    )
    ON CONFLICT (user_id, key) DO UPDATE
    SET value = COALESCE(public.mbt_generic.value, '{}'::jsonb)
                || jsonb_build_object('mBT_partnerDonateUnlocked', 'true'),
        updated_at = now();

    RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.mbt_redeem_supporter_code(text) IS
    'Signed-in redeem. Claims an unused code or re-stamps if this uid already used it. Returns {ok} only. Does not leak missing vs used.';

REVOKE ALL ON FUNCTION public.mbt_redeem_supporter_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mbt_redeem_supporter_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mbt_redeem_supporter_code(text) TO authenticated;

NOTIFY pgrst, 'reload schema';

/* Issue a code. Table owner / CLI. Not the PWA. Do not run this example.
   Alphabet: ABCDEFGHJKLMNPQRSTUVWXYZ23456789. Token stays in AccountsDetails.

INSERT INTO public.supporter_codes (code, note)
VALUES ('K7MQ2N4P', 'example only, do not run');
*/
