import type { MetaConfig, MetaCampaign } from "./types";
import {
  getMetaAdminConfig,
  saveMetaAdminConfig,
  getMetaAdminCampaigns,
  saveMetaAdminCampaigns,
} from "./meta.functions";

const LOCAL_STORAGE_CONFIG_KEY = "ehab_meta_config_v2";
const LOCAL_STORAGE_CAMPAIGNS_KEY = "ehab_meta_campaigns_v1";

export const DEFAULT_META_CONFIG: MetaConfig = {
  connected: false,
  connected_at: null,
  status: "disconnected",
  status_message: "لم يتم ربط حساب Meta بعد. اضغط على زر تسجيل الدخول للبدء.",

  user: null,

  app_id: null,
  has_secret: false,

  discovered_pages: [],
  discovered_ad_accounts: [],
  discovered_businesses: [],
  permissions: [],

  business_id: null,
  business_name: null,

  page_id: null,
  page_name: null,
  page_picture: null,

  instagram_id: null,
  instagram_username: null,
  instagram_picture: null,

  ad_account_id: null,
  ad_account_name: null,
  ad_account_currency: "SAR",

  catalog_id: null,
  catalog_name: null,

  pixel_id: null,
  capi_token: null,
  test_event_code: null,
  track_purchases: true,
  track_add_to_cart: true,
  track_view_content: true,
  last_capi_event_at: null,
  last_capi_status: null,

  auto_sync_enabled: true,
  last_sync_at: null,
  sync_frequency: "realtime",

  shop_enabled: false,
  facebook_shop_url: null,
  instagram_shop_url: null,
  product_description_template:
    "{name} — {brand} | {category}. متوفر الآن في {store} بسعر {price}.",
  category_description_template:
    "تسوق منتجات {category} الأصلية من {store} بأفضل الأسعار وتوصيل سريع.",
  auto_update_pages: true,
  last_page_update_at: null,
};

/** حجب التوكن والبيانات السرية للعرض في الواجهة بأمان */
export function maskSecret(secret?: string | null): string {
  if (!secret) return "غير متوفر";
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

function cached<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...(fallback as object), ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

/** جلب إعدادات Meta الكاملة من الخادم */
export async function getMetaConfig(): Promise<MetaConfig> {
  try {
    const { value } = await getMetaAdminConfig();
    if (value) {
      const parsed = JSON.parse(value) as Partial<MetaConfig>;
      const merged = { ...DEFAULT_META_CONFIG, ...parsed };
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(merged));
      }
      return merged;
    }
  } catch (err) {
    console.warn("Meta config unavailable, using cache", err);
    return cached(LOCAL_STORAGE_CONFIG_KEY, DEFAULT_META_CONFIG);
  }
  return cached(LOCAL_STORAGE_CONFIG_KEY, DEFAULT_META_CONFIG);
}

/** حفظ إعدادات Meta العامة */
export async function saveMetaConfig(config: MetaConfig): Promise<void> {
  const payloadStr = JSON.stringify(config);
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, payloadStr);
  }
  await saveMetaAdminConfig({ data: { value: payloadStr } });
}

/** جلب حملات Meta الإعلانية */
export async function getMetaCampaigns(): Promise<MetaCampaign[]> {
  try {
    const { value } = await getMetaAdminCampaigns();
    if (value) {
      const list = JSON.parse(value) as MetaCampaign[];
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_CAMPAIGNS_KEY, JSON.stringify(list));
      }
      return Array.isArray(list) ? list : [];
    }
  } catch (err) {
    console.warn("Meta campaigns unavailable, using cache", err);
    return cached(LOCAL_STORAGE_CAMPAIGNS_KEY, [] as MetaCampaign[]);
  }
  return cached(LOCAL_STORAGE_CAMPAIGNS_KEY, [] as MetaCampaign[]);
}

/** حفظ حملات Meta الإعلانية */
export async function saveMetaCampaigns(campaigns: MetaCampaign[]): Promise<void> {
  const payloadStr = JSON.stringify(campaigns);
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_STORAGE_CAMPAIGNS_KEY, payloadStr);
  }
  await saveMetaAdminCampaigns({ data: { value: payloadStr } });
}
