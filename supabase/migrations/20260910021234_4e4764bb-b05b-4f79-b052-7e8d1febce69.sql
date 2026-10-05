CREATE TABLE public.product_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text NOT NULL,
  family text NOT NULL DEFAULT 'أحمر',
  hex_code text NOT NULL DEFAULT '#000000',
  swatch_image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_colors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_colors TO authenticated;
GRANT ALL ON public.product_colors TO service_role;
ALTER TABLE public.product_colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_colors_read ON public.product_colors FOR SELECT USING (true);
CREATE POLICY product_colors_manage ON public.product_colors FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'products.manage') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_permission(auth.uid(), 'products.manage') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_product_colors_updated BEFORE UPDATE ON public.product_colors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_option_values ADD COLUMN IF NOT EXISTS color_id uuid REFERENCES public.product_colors(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_option_values_color ON public.product_option_values(color_id);

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS swatch_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS swatch_shape text NOT NULL DEFAULT 'circle',
  ADD COLUMN IF NOT EXISTS swatch_size text NOT NULL DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS color_families text[] NOT NULL DEFAULT ARRAY['أحمر','وردي','نيود','بني','بنفسجي','جريء'];

GRANT INSERT ON public.testimonials TO anon, authenticated;
CREATE POLICY testimonials_public_insert ON public.testimonials FOR INSERT TO anon, authenticated
  WITH CHECK (is_visible = false);