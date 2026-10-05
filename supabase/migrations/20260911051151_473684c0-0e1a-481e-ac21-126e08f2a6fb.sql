-- Tighten EXECUTE on SECURITY DEFINER functions: revoke from PUBLIC, grant only where required.
REVOKE ALL ON FUNCTION public.admin_exists() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_permissions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_rating_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_invoice_for_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_order_tx(jsonb) FROM PUBLIC, anon, authenticated;

-- Only what the app genuinely needs:
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.product_rating_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.place_order_tx(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_invoice_for_order() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;