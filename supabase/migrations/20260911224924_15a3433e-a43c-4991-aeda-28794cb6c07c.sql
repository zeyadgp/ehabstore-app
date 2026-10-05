GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_for_order() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_tx(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_rating_stats() TO anon, authenticated;

DROP POLICY IF EXISTS "public insert order items" ON public.order_items;
CREATE POLICY "public insert order items" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "site_settings public read" ON public.site_settings;
CREATE POLICY "site_settings public read" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);