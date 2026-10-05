-- 1) loyalty_settings: hide internal commission fields from the public
DROP POLICY IF EXISTS "public read loyalty settings" ON public.loyalty_settings;

CREATE OR REPLACE VIEW public.loyalty_settings_public AS
SELECT id, is_active, base_currency, amount_per_point, min_redeem_points, point_value,
       coupon_expiry_days, daily_enabled, daily_start_points, daily_max_points,
       daily_after_max, daily_grace_days, referral_enabled, referral_referrer_points,
       referral_invitee_points, referral_commission_percent, max_points, unlock_min_order,
       allow_partial_redeem, expiry_months, expiry_basis, expiry_notify, refund_policy,
       created_at, updated_at
FROM public.loyalty_settings;

GRANT SELECT ON public.loyalty_settings_public TO anon, authenticated;
GRANT ALL ON public.loyalty_settings_public TO service_role;

-- 2) order_items: no anonymous inserts; orders are created by place_order_tx (definer)
DROP POLICY IF EXISTS "public insert order items" ON public.order_items;

-- 3) site_settings: public read only for non-sensitive keys
DROP POLICY IF EXISTS "site_settings public read" ON public.site_settings;
CREATE POLICY "site_settings public read safe keys" ON public.site_settings
FOR SELECT TO anon, authenticated
USING (
  coalesce("group", '') NOT IN ('meta_integration', 'internal', 'secrets', 'private')
  AND key NOT ILIKE '%secret%'
  AND key NOT ILIKE '%token%'
  AND key NOT ILIKE '%api_key%'
  AND key NOT ILIKE '%password%'
);

-- 4) SECURITY DEFINER functions: narrow EXECUTE grants
REVOKE EXECUTE ON FUNCTION public.place_order_tx(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_invoice_for_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_permissions() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.place_order_tx(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_invoice_for_order() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_rating_stats() TO anon, authenticated, service_role;