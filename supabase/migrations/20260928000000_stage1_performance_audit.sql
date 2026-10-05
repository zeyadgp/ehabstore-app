-- Stage 1 Performance & Audit Migration

-- 1. Dashboard Stats Aggregation RPC
CREATE OR REPLACE FUNCTION public.dashboard_stats() RETURNS jsonb
LANGUAGE sql STABLE
AS $$
SELECT jsonb_build_object(
  'total_sales', (SELECT COALESCE(SUM(total),0) FROM public.orders WHERE created_at > now() - interval '30 days'),
  'orders_count', (SELECT COUNT(*) FROM public.orders WHERE created_at > now() - interval '30 days'),
  'new_orders_today', (SELECT COUNT(*) FROM public.orders WHERE created_at::date = now()::date),
  'top_products', (SELECT jsonb_agg(row_to_json(t)) FROM (
      SELECT p.id, p.name, SUM(oi.quantity) as sold
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.created_at > now() - interval '30 days'
      GROUP BY p.id, p.name
      ORDER BY sold DESC LIMIT 10
    ) t)
);
$$;

-- 2. Admin Audit Log Table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NULL,
  actor_email text NULL,
  action text NOT NULL,
  target_table text NULL,
  target_id text NULL,
  details jsonb NULL,
  ip text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
