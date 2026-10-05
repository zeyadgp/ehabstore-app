-- 1) loyalty_settings: hide developer commission / internal financial config from public
REVOKE SELECT ON public.loyalty_settings FROM anon, authenticated;
GRANT SELECT (id, is_active, base_currency, amount_per_point, min_redeem_points, point_value,
  coupon_expiry_days, daily_enabled, daily_start_points, daily_max_points, daily_after_max,
  daily_grace_days, referral_enabled, referral_referrer_points, referral_invitee_points,
  referral_commission_percent, max_points, unlock_min_order, allow_partial_redeem,
  expiry_months, expiry_basis, expiry_notify, refund_policy, created_at, updated_at)
  ON public.loyalty_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.loyalty_settings TO authenticated;
GRANT ALL ON public.loyalty_settings TO service_role;

-- 2) store_settings: hide operational fields from anonymous visitors
REVOKE SELECT ON public.store_settings FROM anon;
GRANT SELECT (id, store_name, logo, whatsapp_number, currency, currency_label, email, phone,
  address, about, instagram, seo_title, seo_description, seo_keywords, og_image, hero_title,
  hero_subtitle, hero_image, about_content, contact_content, facebook, tiktok, snapchat,
  working_hours, store_image, description, twitter, youtube, hide_lovable_badge, app_download_url,
  grid_columns, card_style, brand_text_color, swatch_enabled, swatch_shape, swatch_size,
  color_families, require_email_confirm)
  ON public.store_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;

-- 3) permissions / role_permissions: admins only
DROP POLICY IF EXISTS "permissions_read" ON public.permissions;
DROP POLICY IF EXISTS "role_permissions_read" ON public.role_permissions;

-- 4) SECURITY DEFINER functions: only expose what the app really needs
REVOKE ALL ON FUNCTION public.place_order_tx(jsonb) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.create_invoice_for_order() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.place_order_tx(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_invoice_for_order() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.my_permissions() FROM anon, public;
REVOKE ALL ON FUNCTION public.claim_first_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_rating_stats() TO anon, authenticated, service_role;