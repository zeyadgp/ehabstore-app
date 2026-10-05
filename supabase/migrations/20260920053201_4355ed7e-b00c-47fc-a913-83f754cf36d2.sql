CREATE TABLE public.page_views (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  path text not null,
  referrer text,
  country text,
  device text,
  created_at timestamp with time zone not null default now()
);
CREATE INDEX page_views_created_at_idx ON public.page_views (created_at DESC);
GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT SELECT ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone records a visit" ON public.page_views FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "signed in users read stats" ON public.page_views FOR SELECT TO authenticated USING (true);