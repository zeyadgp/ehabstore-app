-- Migration: create or update commission_records table supporting item-level tracking and idempotency (staging only)
CREATE TABLE IF NOT EXISTS public.commission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  order_item_id uuid NULL, -- لكل صنف عند توفره لدعم العائدات الجزئية
  seller_id uuid NULL,
  amount_cents bigint NOT NULL,
  profit_cents bigint NULL,
  commission_percent numeric(5,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | settled | reversed
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ضمان وجود الأعمدة إذا كان الجدول موجوداً مسبقاً
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS order_item_id uuid NULL;
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS reason text NULL;

CREATE INDEX IF NOT EXISTS idx_commission_order_id ON public.commission_records(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_order_item_id ON public.commission_records(order_item_id);
CREATE INDEX IF NOT EXISTS idx_commission_status ON public.commission_records(status);

-- منع التكرار على مستوى الصنف (Idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_order_item_unique 
  ON public.commission_records(order_item_id) 
  WHERE order_item_id IS NOT NULL;

-- سياسات الأمان وتحديد الصلاحيات
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
