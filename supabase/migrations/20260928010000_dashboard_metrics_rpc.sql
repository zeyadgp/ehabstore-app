-- Migration: Enhanced Dashboard Aggregation RPC
CREATE OR REPLACE FUNCTION public.dashboard_stats(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_since timestamptz;
  v_result jsonb;
BEGIN
  v_since := now() - (p_days || ' days')::interval;

  SELECT jsonb_build_object(
    'total_sales', COALESCE((
      SELECT SUM(total)
      FROM public.orders
      WHERE created_at >= v_since
        AND status NOT IN ('cancelled', 'returned')
    ), 0),
    'orders_count', (
      SELECT COUNT(*)
      FROM public.orders
      WHERE created_at >= v_since
    ),
    'new_orders_today', (
      SELECT COUNT(*)
      FROM public.orders
      WHERE created_at::date = now()::date
    ),
    'non_cancelled_count', (
      SELECT COUNT(*)
      FROM public.orders
      WHERE created_at >= v_since
        AND status NOT IN ('cancelled', 'returned')
    ),
    'avg_order_value', COALESCE((
      SELECT ROUND(AVG(total)::numeric, 2)
      FROM public.orders
      WHERE created_at >= v_since
        AND status NOT IN ('cancelled', 'returned')
    ), 0),
    'low_stock_count', (
      SELECT COUNT(*)
      FROM public.products
      WHERE status = true AND stock <= 5
    ),
    'profit_available', false,
    'top_products', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT oi.product_id as id, oi.product_name as name, SUM(oi.quantity) as sold, SUM(oi.quantity * oi.price) as revenue
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE o.created_at >= v_since
          AND o.status NOT IN ('cancelled', 'returned')
        GROUP BY oi.product_id, oi.product_name
        ORDER BY sold DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Allow only authenticated admin / service role to execute
REVOKE EXECUTE ON FUNCTION public.dashboard_stats(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_stats(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_stats(int) TO service_role;
