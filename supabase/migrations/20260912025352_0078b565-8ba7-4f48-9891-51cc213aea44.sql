DROP VIEW IF EXISTS public.loyalty_settings_public;

CREATE POLICY "public read loyalty settings" ON public.loyalty_settings
FOR SELECT TO anon, authenticated USING (true);

REVOKE SELECT ON public.loyalty_settings FROM anon, authenticated;

GRANT SELECT (id, is_active, base_currency, amount_per_point, min_redeem_points, point_value,
  coupon_expiry_days, daily_enabled, daily_start_points, daily_max_points, daily_after_max,
  daily_grace_days, referral_enabled, referral_referrer_points, referral_invitee_points,
  referral_commission_percent, max_points, unlock_min_order, allow_partial_redeem,
  expiry_months, expiry_basis, expiry_notify, refund_policy, created_at, updated_at)
ON public.loyalty_settings TO anon, authenticated;

GRANT ALL ON public.loyalty_settings TO service_role;