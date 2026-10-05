CREATE FUNCTION public.admin_exists() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') $$;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE FUNCTION public.claim_first_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;

CREATE FUNCTION public.create_invoice_for_order() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.invoices (order_id, phone, customer_name, subtotal, delivery_fee, total, currency_label, payment_method, payment_status)
  VALUES (NEW.id, NEW.phone, NEW.customer_name, GREATEST(NEW.total - COALESCE(NEW.delivery_fee,0), 0),
          COALESCE(NEW.delivery_fee,0), NEW.total, COALESCE(NEW.currency_label,''), NEW.payment_method, COALESCE(NEW.payment_status,'unpaid'))
  ON CONFLICT (order_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.place_order_tx(p jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_token text := nullif(p->>'client_token','');
  v_order public.orders%ROWTYPE;
  v_line jsonb;
  v_updated uuid;
  v_size uuid;
  v_coupon_id uuid := nullif(p->>'discount_coupon_id','')::uuid;
  v_loyalty_coupon_id uuid := nullif(p->>'loyalty_coupon_id','')::uuid;
  v_account public.loyalty_accounts%ROWTYPE;
  v_points int := coalesce((p->>'loyalty_points')::int, 0);
  v_phone text := coalesce(p->>'loyalty_phone', p->>'phone');
BEGIN
  IF v_token IS NOT NULL THEN
    SELECT * INTO v_order FROM public.orders WHERE client_token = v_token;
    IF FOUND THEN
      RETURN jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number, 'duplicate', true);
    END IF;
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
    v_size := nullif(v_line->>'size_value_id','')::uuid;
    v_updated := NULL;
    IF v_size IS NOT NULL THEN
      UPDATE public.product_option_values
         SET stock = stock - (v_line->>'quantity')::int
       WHERE id = v_size
         AND is_available = true
         AND stock >= (v_line->>'quantity')::int
      RETURNING id INTO v_updated;
    ELSE
      UPDATE public.products
         SET stock = stock - (v_line->>'quantity')::int
       WHERE id = (v_line->>'product_id')::uuid
         AND status = true
         AND stock >= (v_line->>'quantity')::int
      RETURNING id INTO v_updated;
    END IF;
    IF v_updated IS NULL THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%', coalesce(v_line->>'product_name','');
    END IF;
  END LOOP;
  INSERT INTO public.orders (
    customer_name, phone, city, district, address, notes, total, delivery_fee,
    payment_status, currency, currency_label, currency_rate, payment_method, receipt_url, client_token
  ) VALUES (
    p->>'customer_name', p->>'phone', p->>'city', nullif(p->>'district',''), p->>'address',
    nullif(p->>'notes',''), (p->>'total')::numeric, (p->>'delivery_fee')::numeric,
    coalesce(p->>'payment_status','unpaid'), p->>'currency', p->>'currency_label',
    (p->>'currency_rate')::numeric, nullif(p->>'payment_method',''), nullif(p->>'receipt_url',''), v_token
  ) RETURNING * INTO v_order;
  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, price, color_name, size_name, sku, image, option_value_id)
  SELECT v_order.id, (l->>'product_id')::uuid, l->>'product_name', (l->>'quantity')::int, (l->>'price')::numeric,
         nullif(l->>'color_name',''), nullif(l->>'size_name',''), nullif(l->>'sku',''), nullif(l->>'image',''),
         nullif(l->>'size_value_id','')::uuid
  FROM jsonb_array_elements(p->'lines') l;
  IF v_coupon_id IS NOT NULL THEN
    UPDATE public.discount_coupons
       SET used_count = used_count + 1
     WHERE id = v_coupon_id
       AND is_active = true
       AND (max_uses IS NULL OR used_count < max_uses)
    RETURNING id INTO v_updated;
    IF v_updated IS NULL THEN
      RAISE EXCEPTION 'COUPON_EXHAUSTED';
    END IF;
    INSERT INTO public.coupon_redemptions (coupon_id, code, order_id, order_number, customer_phone, customer_name, discount_amount, order_total)
    VALUES (v_coupon_id, p->>'coupon_code', v_order.id, v_order.order_number, p->>'phone', p->>'customer_name',
            (p->>'discount')::numeric, (p->>'total')::numeric);
  END IF;
  IF v_loyalty_coupon_id IS NOT NULL THEN
    UPDATE public.loyalty_coupons
       SET status = 'used', used_order_id = v_order.id
     WHERE id = v_loyalty_coupon_id AND status = 'available'
    RETURNING id INTO v_updated;
    IF v_updated IS NULL THEN
      RAISE EXCEPTION 'COUPON_USED';
    END IF;
  END IF;
  IF (p->>'loyalty_active')::boolean IS TRUE AND v_phone IS NOT NULL THEN
    SELECT * INTO v_account FROM public.loyalty_accounts WHERE phone = v_phone;
    IF NOT FOUND THEN
      INSERT INTO public.loyalty_accounts (phone, customer_name) VALUES (v_phone, p->>'customer_name')
      RETURNING * INTO v_account;
    END IF;
    IF v_points > 0 THEN
      UPDATE public.loyalty_accounts
         SET pending_points = pending_points + v_points,
             total_spent = total_spent + coalesce((p->>'loyalty_amount')::numeric, 0)
       WHERE id = v_account.id;
      INSERT INTO public.loyalty_transactions (account_id, type, points, order_id, order_number, description)
      VALUES (v_account.id, 'pending', v_points, v_order.id, v_order.order_number,
              'نقاط بانتظار تأكيد الطلب #' || coalesce(v_order.order_number::text,''));
    END IF;
    IF v_loyalty_coupon_id IS NOT NULL THEN
      INSERT INTO public.loyalty_transactions (account_id, type, points, order_id, order_number, description)
      VALUES (v_account.id, 'coupon', 0, v_order.id, v_order.order_number,
              'استخدام كوبون ' || coalesce(p->>'coupon_code','') || ' في الطلب #' || coalesce(v_order.order_number::text,''));
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'duplicate', false,
    'points_balance', coalesce(v_account.points, 0)
  );
END;
$$;

CREATE FUNCTION public.product_rating_stats() RETURNS TABLE(product_id uuid, avg_rating numeric, review_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT product_id, round(avg(rating)::numeric, 2), count(*)
  FROM public.product_reviews
  WHERE is_approved = true
  GROUP BY product_id
$$;

CREATE FUNCTION public.set_product_sku() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.sku IS NULL OR btrim(NEW.sku) = '' THEN
    NEW.sku := 'PR-' || nextval('public.products_sku_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER banners_set_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER discount_coupons_updated_at BEFORE UPDATE ON public.discount_coupons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_option_values_updated_at BEFORE UPDATE ON public.product_option_values FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_options_updated_at BEFORE UPDATE ON public.product_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_reviews_set_updated_at BEFORE UPDATE ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_set_sku BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_product_sku();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER themes_updated_at BEFORE UPDATE ON public.themes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_brands_updated BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_currencies_updated BEFORE UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_delivery_zones_updated BEFORE UPDATE ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_loyalty_accounts_updated BEFORE UPDATE ON public.loyalty_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_loyalty_coupons_updated BEFORE UPDATE ON public.loyalty_coupons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_loyalty_rewards_updated BEFORE UPDATE ON public.loyalty_rewards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_loyalty_settings_updated BEFORE UPDATE ON public.loyalty_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orders_invoice AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.create_invoice_for_order();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_product_prices_updated BEFORE UPDATE ON public.product_prices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can create store settings" ON public.store_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin delete reviews" ON public.product_reviews FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage banners" ON public.banners TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage categories" ON public.categories TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage coupons" ON public.loyalty_coupons TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage currencies" ON public.currencies TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage loyalty accounts" ON public.loyalty_accounts TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage loyalty settings" ON public.loyalty_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage loyalty transactions" ON public.loyalty_transactions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage order items" ON public.order_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage payment methods" ON public.payment_methods TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage product prices" ON public.product_prices TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage products" ON public.products TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage rewards" ON public.loyalty_rewards TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage testimonials" ON public.testimonials TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin manage themes" ON public.themes TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin read order items" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin read reviews" ON public.product_reviews FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin update reviews" ON public.product_reviews FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin update settings" ON public.store_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "anyone can create order" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can create pending review" ON public.product_reviews FOR INSERT WITH CHECK (((rating >= 1) AND (rating <= 5) AND (is_approved = false)));
CREATE POLICY brands_admin_write ON public.brands TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY brands_public_read ON public.brands FOR SELECT USING (((is_active = true) OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY coupons_admin_all ON public.discount_coupons TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY delivery_zones_admin_all ON public.delivery_zones TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY delivery_zones_public_read ON public.delivery_zones FOR SELECT USING (true);
CREATE POLICY invoices_admin_all ON public.invoices TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY product_categories_admin_write ON public.product_categories TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY product_categories_public_read ON public.product_categories FOR SELECT USING (true);
CREATE POLICY product_option_values_admin ON public.product_option_values TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY product_option_values_read ON public.product_option_values FOR SELECT USING (true);
CREATE POLICY product_options_admin ON public.product_options TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY product_options_read ON public.product_options FOR SELECT USING (true);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "public read active banners" ON public.banners FOR SELECT USING ((is_active = true));
CREATE POLICY "public read active payment methods" ON public.payment_methods FOR SELECT USING ((is_active = true));
CREATE POLICY "public read active products" ON public.products FOR SELECT USING ((status = true));
CREATE POLICY "public read active rewards" ON public.loyalty_rewards FOR SELECT USING ((is_active = true));
CREATE POLICY "public read approved reviews" ON public.product_reviews FOR SELECT USING ((is_approved = true));
CREATE POLICY "public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "public read currencies" ON public.currencies FOR SELECT USING (true);
CREATE POLICY "public read loyalty settings" ON public.loyalty_settings FOR SELECT USING (true);
CREATE POLICY "public read product prices" ON public.product_prices FOR SELECT USING (true);
CREATE POLICY "public read settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "public read testimonials" ON public.testimonials FOR SELECT USING ((is_visible = true));
CREATE POLICY "public read themes" ON public.themes FOR SELECT USING (true);
CREATE POLICY redemptions_admin_read ON public.coupon_redemptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reviews_insert_own ON public.product_reviews FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY reviews_select_own ON public.product_reviews FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY reviews_update_own ON public.product_reviews FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY wa_admin_all ON public.whatsapp_messages TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT ALL ON FUNCTION public.admin_exists() TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.claim_first_admin() TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.create_invoice_for_order() TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.handle_new_user() TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.place_order_tx(p jsonb) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.product_rating_stats() TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.set_product_sku() TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.set_updated_at() TO anon, authenticated, service_role;