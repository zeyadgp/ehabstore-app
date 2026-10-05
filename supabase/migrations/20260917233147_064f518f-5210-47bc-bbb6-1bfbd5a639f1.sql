ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS meta_shop_url text,
  ADD COLUMN IF NOT EXISTS instagram_shop_url text;