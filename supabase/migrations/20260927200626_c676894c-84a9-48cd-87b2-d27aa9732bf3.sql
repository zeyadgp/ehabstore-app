DROP POLICY IF EXISTS "anyone records a visit" ON public.page_views;
CREATE POLICY "anyone records a valid visit" ON public.page_views
FOR INSERT TO anon, authenticated
WITH CHECK (
  length(path) BETWEEN 1 AND 500
  AND left(path, 1) = '/'
  AND (session_id IS NULL OR length(session_id) <= 100)
  AND (referrer IS NULL OR length(referrer) <= 1000)
  AND (country IS NULL OR length(country) <= 10)
  AND (device IS NULL OR device IN ('mobile','tablet','desktop','other'))
);