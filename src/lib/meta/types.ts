/**
 * أنواع بيانات تكامل Meta (Facebook & Instagram)
 * Graph API v22.0 / v21.0
 * لإدارة الصفحات، الحسابات الإعلانية، الكتالوج، وتتبع Pixel / Conversions API
 */

export type MetaObjective =
  "OUTCOME_SALES" | "OUTCOME_TRAFFIC" | "OUTCOME_LEADS" | "OUTCOME_ENGAGEMENT";

export type MetaPlatform = "facebook" | "instagram";

export type MetaBudgetType = "daily" | "lifetime";

export type MetaCampaignStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

export type MetaGender = "all" | "female" | "male";

export type MetaUserProfile = {
  id: string;
  name: string;
  email?: string | null;
  picture_url?: string | null;
};

export type MetaPermissionItem = {
  permission: string;
  status: "granted" | "declined";
  description?: string;
  required_for?: string;
  requires_app_review?: boolean;
};

export type MetaInstagramAccount = {
  id: string;
  username: string;
  name?: string | null;
  profile_picture_url?: string | null;
  followers_count?: number | null;
  media_count?: number | null;
};

export type MetaFacebookPage = {
  id: string;
  name: string;
  category?: string | null;
  access_token?: string | null;
  picture_url?: string | null;
  followers_count?: number | null;
  tasks?: string[];
  is_selected?: boolean;
  instagram_account?: MetaInstagramAccount | null;
};

export type MetaAdAccount = {
  id: string; // e.g. act_123456789
  account_id: string; // e.g. 123456789
  name: string;
  currency: string;
  account_status?: number | null;
  account_status_label?: string;
  amount_spent?: string | null;
  is_selected?: boolean;
  business?: {
    id: string;
    name: string;
  } | null;
};

export type MetaBusinessAccount = {
  id: string;
  name: string;
  verification_status?: string | null;
  primary_page?: {
    id: string;
    name: string;
  } | null;
};

export type MetaCatalog = {
  id: string;
  name: string;
  product_count?: number | null;
  vertical?: string | null;
};

export type MetaConnectionStatus =
  "connected" | "needs_reauth" | "disconnected" | "insufficient_permissions";

export type MetaConfig = {
  connected: boolean;
  connected_at: string | null;
  status: MetaConnectionStatus;
  status_message?: string | null;

  // معلومات الحساب المرتبط الحقيقي
  user: MetaUserProfile | null;

  // التطبيق والتوكن (التوكن السري لا يرسل للعميل أبداً)
  app_id: string | null;
  has_secret: boolean;
  access_token?: string | null; // للمدير فقط عبر الخادم
  token_expires_at?: string | null;

  // الحسابات والأصول المكتشفة من API
  discovered_pages: MetaFacebookPage[];
  discovered_ad_accounts: MetaAdAccount[];
  discovered_businesses: MetaBusinessAccount[];
  permissions: MetaPermissionItem[];

  // الأصول المختارة للربط مع المتجر
  business_id: string | null;
  business_name: string | null;

  page_id: string | null;
  page_name: string | null;
  page_picture: string | null;

  instagram_id: string | null;
  instagram_username: string | null;
  instagram_picture: string | null;

  ad_account_id: string | null;
  ad_account_name: string | null;
  ad_account_currency: string;

  catalog_id: string | null;
  catalog_name: string | null;

  // إعدادات التتبع Pixel و Conversions API
  pixel_id: string | null;
  capi_token: string | null;
  test_event_code: string | null;
  track_purchases: boolean;
  track_add_to_cart: boolean;
  track_view_content: boolean;
  last_capi_event_at: string | null;
  last_capi_status: string | null;

  // المزامنة التلقائية
  auto_sync_enabled: boolean;
  last_sync_at: string | null;
  sync_frequency: "realtime" | "hourly" | "daily";

  // إعدادات متجر ميتا (Facebook / Instagram Shop)
  shop_enabled: boolean;
  facebook_shop_url: string | null;
  instagram_shop_url: string | null;
  product_description_template: string | null;
  category_description_template: string | null;
  auto_update_pages: boolean;
  last_page_update_at: string | null;
};

export type MetaProductSyncItem = {
  id: string; // SKU or Product ID
  product_id: string;
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: "new";
  price: string;
  sale_price?: string | null;
  link: string;
  image_link: string;
  additional_image_links: string[];
  brand: string;
  google_product_category?: string | null;
  product_type: string;
  color?: string | null;
  size?: string | null;
  item_group_id?: string | null;
  status: "active" | "archived";
  sync_status: "synced" | "pending" | "error";
  sync_error?: string | null;
  last_synced_at?: string | null;
};

export type MetaTargeting = {
  countries: string[];
  cities: string[];
  age_min: number;
  age_max: number;
  genders: MetaGender;
  interests: string[];
};

export type MetaCampaign = {
  id: string;
  name: string;
  objective: MetaObjective;
  status: MetaCampaignStatus;
  platforms: MetaPlatform[];
  budget_type: MetaBudgetType;
  budget_amount: number;
  currency: string;
  start_date: string;
  end_date: string | null;
  targeting: MetaTargeting;
  product_selection_type: "single" | "multiple" | "category" | "all_catalog";
  selected_product_ids: string[];
  selected_category_id?: string | null;
  is_dynamic_catalog: boolean;
  meta_campaign_id?: string;
  meta_ad_set_id?: string;
  meta_ad_id?: string;
  created_at: string;
  updated_at: string;
  metrics?: {
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    purchases: number;
    purchase_value: number;
    roas: number;
    cpc: number;
    cpm: number;
    ctr: number;
  };
};

export type MetaPerformanceReport = {
  period: "today" | "last_7_days" | "last_30_days" | "custom";
  total_spend: number;
  total_sales: number;
  total_orders: number;
  total_clicks: number;
  total_reach: number;
  total_impressions: number;
  average_ctr: number;
  average_cpc: number;
  average_cpm: number;
  roas: number;
  cost_per_purchase: number;
  top_selling_products: {
    product_id: string;
    product_name: string;
    image_url: string;
    orders_count: number;
    sales_amount: number;
    ad_spend: number;
    roas: number;
  }[];
  daily_trends: {
    date: string;
    spend: number;
    sales: number;
    clicks: number;
    purchases: number;
  }[];
};
