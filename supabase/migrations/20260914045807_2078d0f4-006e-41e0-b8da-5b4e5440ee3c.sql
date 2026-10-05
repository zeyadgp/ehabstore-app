-- 1) دالة إحصائيات التقييمات: تعمل بصلاحيات المتصل (التقييمات المعتمدة مقروءة للجميع أصلاً)
CREATE OR REPLACE FUNCTION public.product_rating_stats()
RETURNS TABLE(product_id uuid, avg_rating numeric, review_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT product_id, round(avg(rating)::numeric, 2), count(*)
  FROM public.product_reviews
  WHERE is_approved = true
  GROUP BY product_id
$function$;

-- 2) سحب صلاحية التنفيذ عن الزوار/المستخدمين للدوال الداخلية
-- دوال المشغّلات: لا يستدعيها أحد مباشرة
REVOKE EXECUTE ON FUNCTION public.create_invoice_for_order() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
-- تنفيذ الطلبات يتم عبر الخادم (service_role) فقط
REVOKE EXECUTE ON FUNCTION public.place_order_tx(jsonb) FROM anon, authenticated;
-- دوال تتطلب تسجيل الدخول: تُسحب من الزوار فقط وتبقى للمسجلين (تستخدمها سياسات الوصول)
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_permissions() FROM anon;

-- 3) حجب أعمدة العمولات الداخلية في إعدادات الولاء عن الزوار والعملاء
REVOKE SELECT ON public.loyalty_settings FROM anon, authenticated;
GRANT SELECT (
  id, is_active, base_currency, amount_per_point, min_redeem_points, point_value,
  coupon_expiry_days, daily_enabled, daily_start_points, daily_max_points,
  daily_after_max, daily_grace_days, referral_enabled, referral_referrer_points,
  referral_invitee_points, referral_commission_percent, max_points, unlock_min_order,
  allow_partial_redeem, expiry_months, expiry_basis, expiry_notify, refund_policy,
  created_at, updated_at
) ON public.loyalty_settings TO anon, authenticated;