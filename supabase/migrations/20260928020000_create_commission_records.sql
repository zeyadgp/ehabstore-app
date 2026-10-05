-- Migration: create commission_records table (staging first)
CREATE TABLE IF NOT EXISTS public.commission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  seller_id uuid NULL,
  amount_cents bigint NOT NULL,
  profit_cents bigint NULL,
  commission_percent numeric(5,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | settled | reversed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_order_id ON public.commission_records(order_id);

-- Row Level Security policies
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.commission_records TO service_role;
GRANT SELECT ON public.commission_records TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'commission_records' AND policyname = 'commission_records_admin_manage'
  ) THEN
    CREATE POLICY "commission_records_admin_manage" ON public.commission_records
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
  END IF;
END $$;
