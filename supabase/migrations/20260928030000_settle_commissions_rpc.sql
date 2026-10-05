-- Migration: RPCs for atomic commission settlement and reversal (staging only)

-- 1. تسوية العمولات بشكل ذري ومقفل (Atomic Settle)
CREATE OR REPLACE FUNCTION public.settle_commissions_for_order(
  order_uuid uuid,
  commission_percent numeric DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_item record;
  v_profit_cents bigint;
  v_comm_amount bigint;
  v_settled_count int := 0;
  v_total_commission bigint := 0;
  v_costs_json text;
  v_costs_map jsonb;
  v_unit_cost numeric;
  v_item_total numeric;
BEGIN
  -- قفل صف الطلب لمنع أي تعديل متزامن (Row-level lock)
  SELECT id, status, total, subtotal INTO v_order
  FROM public.orders
  WHERE id = order_uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Order not found');
  END IF;

  -- قراءة خريطة التكاليف المخزنة
  SELECT value INTO v_costs_json
  FROM public.site_settings
  WHERE key = 'admin_product_costs_map'
  LIMIT 1;

  IF v_costs_json IS NOT NULL THEN
    BEGIN
      v_costs_map := v_costs_json::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_costs_map := '{}'::jsonb;
    END;
  ELSE
    v_costs_map := '{}'::jsonb;
  END IF;

  -- فحص ومعالجة بنود الطلب مع قفل الأسطر FOR UPDATE
  FOR v_item IN
    SELECT id, product_id, quantity, price
    FROM public.order_items
    WHERE order_id = order_uuid
    FOR UPDATE
  LOOP
    -- استخراج تكلفة الوحدة
    IF v_item.product_id IS NOT NULL AND v_costs_map ? v_item.product_id::text THEN
      v_unit_cost := (v_costs_map->(v_item.product_id::text)->>'cost_price')::numeric;
    ELSE
      v_unit_cost := NULL;
    END IF;

    v_item_total := (COALESCE(v_item.price, 0) * COALESCE(v_item.quantity, 1));

    -- إذا كانت التكلفة غير محددة: لا تحتسب العمولة آلياً (سياسة أمان)
    IF v_unit_cost IS NULL OR v_unit_cost < 0 THEN
      v_profit_cents := NULL;
      v_comm_amount := 0;

      INSERT INTO public.commission_records(
        order_id, order_item_id, amount_cents, profit_cents, commission_percent, status, reason, created_at, updated_at
      )
      VALUES (
        order_uuid, v_item.id, 0, NULL, commission_percent, 'pending', 'no_cost_data', now(), now()
      )
      ON CONFLICT (order_item_id) WHERE order_item_id IS NOT NULL DO UPDATE
        SET status = 'pending', reason = 'no_cost_data', updated_at = now();

    ELSE
      -- حساب الربح والعمولة
      v_profit_cents := GREATEST(0, FLOOR(v_item_total - (v_unit_cost * v_item.quantity)));
      v_comm_amount := FLOOR((v_profit_cents * commission_percent) / 100);

      INSERT INTO public.commission_records(
        order_id, order_item_id, amount_cents, profit_cents, commission_percent, status, reason, created_at, updated_at
      )
      VALUES (
        order_uuid, v_item.id, v_comm_amount, v_profit_cents, commission_percent, 'settled', 'ok', now(), now()
      )
      ON CONFLICT (order_item_id) WHERE order_item_id IS NOT NULL DO UPDATE
        SET amount_cents = EXCLUDED.amount_cents,
            profit_cents = EXCLUDED.profit_cents,
            commission_percent = EXCLUDED.commission_percent,
            status = 'settled',
            reason = 'ok',
            updated_at = now();

      v_settled_count := v_settled_count + 1;
      v_total_commission := v_total_commission + v_comm_amount;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'settled_count', v_settled_count,
    'total_commission', v_total_commission
  );
END;
$$;

-- 2. عكس العمولات بشكل ذري (Atomic Reverse) يدعم الإلغاء الكلي والجزئي
CREATE OR REPLACE FUNCTION public.reverse_commissions_for_order(
  order_uuid uuid,
  target_item_uuid uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec record;
  v_earn record;
  v_reversed_count int := 0;
  v_reversed_amount bigint := 0;
BEGIN
  -- عكس سجلات commission_records مع قفل الصفوف FOR UPDATE
  FOR v_rec IN
    SELECT id, amount_cents, status
    FROM public.commission_records
    WHERE order_id = order_uuid
      AND (target_item_uuid IS NULL OR order_item_id = target_item_uuid)
      AND status IN ('pending', 'settled')
    FOR UPDATE
  LOOP
    UPDATE public.commission_records
    SET status = 'reversed',
        updated_at = now()
    WHERE id = v_rec.id;

    v_reversed_count := v_reversed_count + 1;
    v_reversed_amount := v_reversed_amount + COALESCE(v_rec.amount_cents, 0);
  END LOOP;

  -- عكس عمولات التسويق بالعمولة (affiliate_earnings) وخصم الرصيد ذرياً (Atomic Balance Update)
  IF target_item_uuid IS NULL THEN
    FOR v_earn IN
      SELECT id, influencer_id, commission_amount, status
      FROM public.affiliate_earnings
      WHERE order_id = order_uuid
        AND status != 'reversed'
      FOR UPDATE
    LOOP
      UPDATE public.affiliate_earnings
      SET status = 'reversed'
      WHERE id = v_earn.id;

      IF v_earn.influencer_id IS NOT NULL AND v_earn.commission_amount > 0 THEN
        UPDATE public.influencers
        SET balance = GREATEST(0, balance - v_earn.commission_amount),
            total_earned = GREATEST(0, total_earned - v_earn.commission_amount),
            updated_at = now()
        WHERE id = v_earn.influencer_id;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'reversed_count', v_reversed_count,
    'reversed_amount', v_reversed_amount
  );
END;
$$;
