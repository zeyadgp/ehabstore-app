DROP POLICY IF EXISTS "public read loyalty settings" ON public.loyalty_settings;
CREATE POLICY "public read active loyalty settings"
ON public.loyalty_settings
FOR SELECT
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "store images public read" ON storage.objects;