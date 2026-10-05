CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.order_status AS ENUM ('new','reviewing','confirmed','processing','shipped','completed','cancelled','ready','delivered','returned','no_contact','on_hold');

CREATE TABLE public.banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    subtitle text,
    badge text,
    image text,
    cta_label text,
    cta_url text,
    placement text DEFAULT 'hero'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    image text,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    image text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_id uuid,
    description text,
    icon text,
    color text,
    cover_image text,
    is_active boolean DEFAULT true NOT NULL,
    kind text DEFAULT 'standard'::text NOT NULL,
    smart_rule jsonb,
    seo_title text,
    seo_description text,
    seo_keywords text
);
CREATE TABLE public.coupon_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coupon_id uuid NOT NULL,
    code text NOT NULL,
    order_id uuid,
    order_number integer,
    customer_phone text,
    customer_name text,
    discount_amount numeric DEFAULT 0 NOT NULL,
    order_total numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.currencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    symbol text NOT NULL,
    rate numeric DEFAULT 1 NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.delivery_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    governorate text NOT NULL,
    fee numeric DEFAULT 2000 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.discount_coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    description text,
    discount_type text DEFAULT 'percent'::text NOT NULL,
    discount_value numeric DEFAULT 0 NOT NULL,
    min_order numeric DEFAULT 0 NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    owner_name text,
    owner_phone text,
    commission_percent numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.invoice_number_seq START WITH 1000 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number integer DEFAULT nextval('public.invoice_number_seq'::regclass) NOT NULL,
    order_id uuid NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    customer_name text DEFAULT ''::text NOT NULL,
    subtotal numeric DEFAULT 0 NOT NULL,
    discount numeric DEFAULT 0 NOT NULL,
    delivery_fee numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    currency_label text DEFAULT ''::text NOT NULL,
    payment_method text,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    points_awarded integer DEFAULT 0 NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.loyalty_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone text NOT NULL,
    customer_name text,
    points integer DEFAULT 0 NOT NULL,
    pending_points integer DEFAULT 0 NOT NULL,
    total_spent numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.loyalty_coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    account_id uuid NOT NULL,
    reward_id uuid,
    discount_type text DEFAULT 'amount'::text NOT NULL,
    discount_value numeric DEFAULT 0 NOT NULL,
    points_spent integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    expires_at timestamp with time zone,
    used_order_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.loyalty_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    points_required integer DEFAULT 100 NOT NULL,
    discount_type text DEFAULT 'amount'::text NOT NULL,
    discount_value numeric DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.loyalty_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    base_currency text DEFAULT 'YER'::text NOT NULL,
    amount_per_point numeric DEFAULT 1000 NOT NULL,
    min_redeem_points integer DEFAULT 100 NOT NULL,
    point_value numeric DEFAULT 10 NOT NULL,
    coupon_expiry_days integer DEFAULT 60 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.loyalty_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    type text DEFAULT 'earn'::text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    order_id uuid,
    order_number integer,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    color_name text,
    size_name text,
    sku text,
    image text,
    option_value_id uuid
);
CREATE SEQUENCE public.order_number_seq START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number integer DEFAULT nextval('public.order_number_seq'::regclass) NOT NULL,
    customer_name text NOT NULL,
    phone text NOT NULL,
    city text NOT NULL,
    address text NOT NULL,
    notes text,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'SAR'::text NOT NULL,
    status public.order_status DEFAULT 'new'::public.order_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    currency_label text DEFAULT 'ر.س'::text NOT NULL,
    currency_rate numeric DEFAULT 1 NOT NULL,
    payment_method text,
    receipt_url text,
    district text,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    delivery_fee numeric DEFAULT 0 NOT NULL,
    last_contact_at timestamp with time zone,
    client_token text,
    latitude double precision,
    longitude double precision
);
CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    icon text,
    account_details text,
    instructions text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.product_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    category_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.product_option_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    option_id uuid NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    swatch text,
    images text[] DEFAULT '{}'::text[] NOT NULL,
    price numeric,
    compare_at_price numeric,
    stock integer DEFAULT 0 NOT NULL,
    sku text,
    is_available boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.product_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    kind text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_options_kind_check CHECK ((kind = ANY (ARRAY['color'::text, 'size'::text])))
);
CREATE TABLE public.product_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    currency_code text NOT NULL,
    price numeric,
    discount_price numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.product_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    customer_name text DEFAULT 'زائر'::text NOT NULL,
    rating integer DEFAULT 5 NOT NULL,
    comment text,
    is_approved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid
);
CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    discount_price numeric(12,2),
    images text[] DEFAULT '{}'::text[] NOT NULL,
    category_id uuid,
    stock integer DEFAULT 0 NOT NULL,
    status boolean DEFAULT true NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    is_bestseller boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sku text,
    brand_id uuid
);
CREATE SEQUENCE public.products_sku_seq START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    phone text,
    governorate text,
    district text,
    address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    addresses jsonb DEFAULT '[]'::jsonb NOT NULL,
    latitude double precision,
    longitude double precision
);
CREATE TABLE public.store_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_name text DEFAULT 'إيهاب ستور للعناية والتجميل'::text NOT NULL,
    logo text,
    whatsapp_number text DEFAULT '967780187409'::text NOT NULL,
    currency text DEFAULT 'SAR'::text NOT NULL,
    currency_label text DEFAULT 'ر.س'::text NOT NULL,
    email text,
    phone text,
    address text,
    about text,
    instagram text,
    seo_title text,
    seo_description text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    seo_keywords text,
    og_image text,
    hero_title text,
    hero_subtitle text,
    hero_image text,
    about_content text,
    contact_content text,
    facebook text,
    tiktok text,
    snapchat text,
    working_hours text,
    store_image text,
    description text,
    twitter text,
    youtube text,
    hide_lovable_badge boolean DEFAULT true NOT NULL,
    grid_columns integer DEFAULT 2 NOT NULL,
    card_style text DEFAULT 'classic'::text NOT NULL,
    brand_text_color text DEFAULT 'black'::text NOT NULL,
    free_delivery_until timestamp with time zone,
    delivery_default_fee numeric DEFAULT 2000 NOT NULL,
    delivery_enabled boolean DEFAULT true NOT NULL,
    require_email_confirm boolean DEFAULT false NOT NULL
);
CREATE TABLE public.testimonials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_name text NOT NULL,
    content text NOT NULL,
    rating integer DEFAULT 5 NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.themes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    primary_color text DEFAULT '#C9A227'::text NOT NULL,
    accent_color text DEFAULT '#E8B4B8'::text NOT NULL,
    background_color text DEFAULT '#FFFDF8'::text NOT NULL,
    foreground_color text DEFAULT '#2B2320'::text NOT NULL,
    card_color text DEFAULT '#FFFFFF'::text NOT NULL,
    radius text DEFAULT '0.75rem'::text NOT NULL,
    nav_position text DEFAULT 'bottom'::text NOT NULL,
    nav_style text DEFAULT 'pill'::text NOT NULL,
    show_labels boolean DEFAULT true NOT NULL,
    nav_items jsonb DEFAULT '["home", "search", "categories", "cart", "account"]'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    thumbnail text
);
CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.whatsapp_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    phone text NOT NULL,
    template text,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.banners ADD CONSTRAINT banners_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.brands ADD CONSTRAINT brands_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.brands ADD CONSTRAINT brands_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.categories ADD CONSTRAINT categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.categories ADD CONSTRAINT categories_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.coupon_redemptions ADD CONSTRAINT coupon_redemptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.currencies ADD CONSTRAINT currencies_code_key UNIQUE (code);
ALTER TABLE ONLY public.currencies ADD CONSTRAINT currencies_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.delivery_zones ADD CONSTRAINT delivery_zones_governorate_key UNIQUE (governorate);
ALTER TABLE ONLY public.delivery_zones ADD CONSTRAINT delivery_zones_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.discount_coupons ADD CONSTRAINT discount_coupons_code_key UNIQUE (code);
ALTER TABLE ONLY public.discount_coupons ADD CONSTRAINT discount_coupons_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.loyalty_accounts ADD CONSTRAINT loyalty_accounts_phone_key UNIQUE (phone);
ALTER TABLE ONLY public.loyalty_accounts ADD CONSTRAINT loyalty_accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.loyalty_coupons ADD CONSTRAINT loyalty_coupons_code_key UNIQUE (code);
ALTER TABLE ONLY public.loyalty_coupons ADD CONSTRAINT loyalty_coupons_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.loyalty_rewards ADD CONSTRAINT loyalty_rewards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.loyalty_settings ADD CONSTRAINT loyalty_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.loyalty_transactions ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payment_methods ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_categories ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_categories ADD CONSTRAINT product_categories_product_id_category_id_key UNIQUE (product_id, category_id);
ALTER TABLE ONLY public.product_option_values ADD CONSTRAINT product_option_values_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_options ADD CONSTRAINT product_options_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_options ADD CONSTRAINT product_options_product_id_kind_key UNIQUE (product_id, kind);
ALTER TABLE ONLY public.product_prices ADD CONSTRAINT product_prices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_prices ADD CONSTRAINT product_prices_product_id_currency_code_key UNIQUE (product_id, currency_code);
ALTER TABLE ONLY public.product_reviews ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_slug_key UNIQUE (slug);
ALTER TABLE public.products ADD CONSTRAINT products_stock_non_negative CHECK ((stock >= 0)) NOT VALID;
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.store_settings ADD CONSTRAINT store_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.testimonials ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.themes ADD CONSTRAINT themes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE ONLY public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id);

CREATE INDEX categories_parent_id_idx ON public.categories USING btree (parent_id);
CREATE INDEX idx_categories_active_sort ON public.categories USING btree (is_active, sort_order);
CREATE INDEX idx_loyalty_tx_account ON public.loyalty_transactions USING btree (account_id, created_at DESC);
CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);
CREATE INDEX idx_product_categories_cat ON public.product_categories USING btree (category_id);
CREATE INDEX idx_product_categories_prod ON public.product_categories USING btree (product_id);
CREATE INDEX idx_product_prices_prod ON public.product_prices USING btree (product_id);
CREATE INDEX idx_products_brand_id ON public.products USING btree (brand_id);
CREATE INDEX idx_products_category ON public.products USING btree (category_id);
CREATE INDEX idx_products_slug ON public.products USING btree (slug);
CREATE INDEX idx_products_status_created ON public.products USING btree (status, created_at DESC);
CREATE INDEX idx_reviews_product_approved ON public.product_reviews USING btree (product_id, is_approved);
CREATE INDEX idx_reviews_user ON public.product_reviews USING btree (user_id);
CREATE UNIQUE INDEX invoices_order_id_key ON public.invoices USING btree (order_id);
CREATE UNIQUE INDEX orders_client_token_key ON public.orders USING btree (client_token) WHERE (client_token IS NOT NULL);
CREATE INDEX product_option_values_option_idx ON public.product_option_values USING btree (option_id, sort_order);
CREATE INDEX product_option_values_product_idx ON public.product_option_values USING btree (product_id);
CREATE INDEX product_options_product_idx ON public.product_options USING btree (product_id);
CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku) WHERE (sku IS NOT NULL);
CREATE UNIQUE INDEX uniq_review_per_user_product ON public.product_reviews USING btree (product_id, user_id) WHERE (user_id IS NOT NULL);

ALTER TABLE ONLY public.categories ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.coupon_redemptions ADD CONSTRAINT coupon_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.discount_coupons(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.coupon_redemptions ADD CONSTRAINT coupon_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.loyalty_coupons ADD CONSTRAINT loyalty_coupons_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.loyalty_coupons ADD CONSTRAINT loyalty_coupons_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.loyalty_coupons ADD CONSTRAINT loyalty_coupons_used_order_id_fkey FOREIGN KEY (used_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.loyalty_transactions ADD CONSTRAINT loyalty_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.loyalty_transactions ADD CONSTRAINT loyalty_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.product_categories ADD CONSTRAINT product_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.product_categories ADD CONSTRAINT product_categories_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.product_option_values ADD CONSTRAINT product_option_values_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.product_options(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.product_option_values ADD CONSTRAINT product_option_values_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.product_options ADD CONSTRAINT product_options_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.product_prices ADD CONSTRAINT product_prices_currency_code_fkey FOREIGN KEY (currency_code) REFERENCES public.currencies(code) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.product_prices ADD CONSTRAINT product_prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.product_reviews ADD CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.products ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

GRANT ALL ON TABLE public.banners TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.brands TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.categories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.coupon_redemptions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.currencies TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.delivery_zones TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.discount_coupons TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.invoice_number_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.invoices TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.loyalty_accounts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.loyalty_coupons TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.loyalty_rewards TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.loyalty_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.loyalty_transactions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.order_items TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.order_number_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.orders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.payment_methods TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.product_categories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.product_option_values TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.product_options TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.product_prices TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.product_reviews TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.products_sku_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.testimonials TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.themes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_roles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.whatsapp_messages TO anon, authenticated, service_role;