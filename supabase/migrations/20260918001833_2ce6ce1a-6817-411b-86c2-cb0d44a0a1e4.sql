DROP POLICY IF EXISTS brands_public_read ON public.brands;
CREATE POLICY brands_public_read ON public.brands FOR SELECT TO anon USING (is_active = true);
CREATE POLICY brands_auth_read ON public.brands FOR SELECT TO authenticated USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));