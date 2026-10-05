ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ingredients text,
  ADD COLUMN IF NOT EXISTS usage_instructions text;

COMMENT ON COLUMN public.products.ingredients IS 'Product ingredients shown in the product details tabs';
COMMENT ON COLUMN public.products.usage_instructions IS 'Product usage instructions shown in the product details tabs';