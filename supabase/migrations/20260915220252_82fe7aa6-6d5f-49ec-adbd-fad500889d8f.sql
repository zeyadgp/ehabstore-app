ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS footer_text text,
  ADD COLUMN IF NOT EXISTS copyright_name text,
  ADD COLUMN IF NOT EXISTS copyright_url text,
  ADD COLUMN IF NOT EXISTS ios_app_url text;

COMMENT ON COLUMN public.store_settings.footer_text IS 'النص التعريفي الظاهر في الفوتر';
COMMENT ON COLUMN public.store_settings.copyright_name IS 'اسم صاحب الحقوق الظاهر في الفوتر';
COMMENT ON COLUMN public.store_settings.copyright_url IS 'الرابط المخفي خلف اسم صاحب الحقوق';
COMMENT ON COLUMN public.store_settings.ios_app_url IS 'رابط التطبيق في متجر App Store';