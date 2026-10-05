ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS ios_badge_image text,
  ADD COLUMN IF NOT EXISTS android_badge_image text;

COMMENT ON COLUMN public.store_settings.ios_badge_image IS 'صورة شارة App Store القابلة للتغيير';
COMMENT ON COLUMN public.store_settings.android_badge_image IS 'صورة شارة Google Play القابلة للتغيير';