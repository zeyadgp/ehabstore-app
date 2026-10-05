/**
 * واجهات التعامل مع Meta Graph API (v21.0)
 * لإدارة الكتالوج، المنتجات، الحملات، والتقارير الإعلانية
 */

import type {
  MetaConfig,
  MetaBusinessAccount,
  MetaFacebookPage,
  MetaInstagramAccount,
  MetaAdAccount,
  MetaCatalog,
  MetaCampaign,
  MetaPerformanceReport,
} from "./types";
import { getMetaConfig, saveMetaConfig, getMetaCampaigns } from "./storage";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

/**
 * فحص صحة التوكن والاتصال مع Meta
 */
export async function verifyMetaToken(token: string): Promise<{
  valid: boolean;
  user_id?: string;
  app_id?: string;
  error?: string;
}> {
  if (!token || token.trim().length < 10) {
    return { valid: false, error: "رمز الوصول (Access Token) غير صالح" };
  }

  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/me?access_token=${encodeURIComponent(token.trim())}`,
    );
    const data = await res.json();
    if (data.error) {
      return { valid: false, error: data.error.message || "فشل التحقق من Meta" };
    }
    return { valid: true, user_id: data.id };
  } catch (err) {
    return { valid: false, error: "تعذر الاتصال بخوادم Meta، تحقق من اتصالك بالإنترنت" };
  }
}

/**
 * جلب حسابات الأعمال (Business Manager Accounts) المرتبطة بالتوكن
 */
export async function fetchMetaBusinesses(token?: string | null): Promise<MetaBusinessAccount[]> {
  if (!token) {
    return [];
  }

  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/me/businesses?access_token=${encodeURIComponent(token)}`,
    );
    const data = await res.json();
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((b: any) => ({
        id: b.id,
        name: b.name,
        verification_status: b.verification_status,
      }));
    }
  } catch (err) {
    console.warn("Could not fetch businesses from Meta API", err);
  }

  return [];
}

/**
 * جلب صفحات الفيسبوك (Facebook Pages)
 */
export async function fetchMetaPages(token?: string | null): Promise<MetaFacebookPage[]> {
  if (!token) {
    return [];
  }

  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/me/accounts?fields=id,name,picture,fan_count,access_token&access_token=${encodeURIComponent(token)}`,
    );
    const data = await res.json();
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        access_token: p.access_token,
        picture_url: p.picture?.data?.url,
        followers_count: p.fan_count,
      }));
    }
  } catch (err) {
    console.warn("Could not fetch pages from Meta API", err);
  }

  return [];
}

/**
 * جلب حسابات إنستغرام المرتبطة بالصفحة
 */
export async function fetchMetaInstagramAccounts(
  token?: string | null,
  pageId?: string | null,
): Promise<MetaInstagramAccount[]> {
  if (!token || !pageId) {
    return [];
  }

  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${pageId}?fields=instagram_business_account{id,username,name,profile_picture_url,followers_count}&access_token=${encodeURIComponent(token)}`,
    );
    const data = await res.json();
    if (data.instagram_business_account) {
      const ig = data.instagram_business_account;
      return [
        {
          id: ig.id,
          username: ig.username,
          name: ig.name,
          profile_picture_url: ig.profile_picture_url,
          followers_count: ig.followers_count,
        },
      ];
    }
  } catch (err) {
    console.warn("Could not fetch Instagram account from Meta API", err);
  }

  return [];
}

/**
 * جلب الحسابات الإعلانية (Meta Ad Accounts)
 */
export async function fetchMetaAdAccounts(token?: string | null): Promise<MetaAdAccount[]> {
  if (!token) {
    return [];
  }

  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/me/adaccounts?fields=id,account_id,name,currency,account_status,amount_spent&access_token=${encodeURIComponent(token)}`,
    );
    const data = await res.json();
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((a: any) => ({
        id: a.id,
        account_id: a.account_id,
        name: a.name,
        currency: a.currency,
        account_status: a.account_status,
        amount_spent: a.amount_spent,
      }));
    }
  } catch (err) {
    console.warn("Could not fetch ad accounts from Meta API", err);
  }

  return [];
}

/**
 * جلب كتالوجات المنتجات (Product Catalogs)
 */
export async function fetchMetaCatalogs(
  token?: string | null,
  businessId?: string | null,
): Promise<MetaCatalog[]> {
  if (!token || !businessId) {
    return [];
  }

  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${businessId}/owned_product_catalogs?fields=id,name,product_count,vertical&access_token=${encodeURIComponent(token)}`,
    );
    const data = await res.json();
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((c: any) => ({
        id: c.id,
        name: c.name,
        product_count: c.product_count,
        vertical: c.vertical,
      }));
    }
  } catch (err) {
    console.warn("Could not fetch catalogs from Meta API", err);
  }

  return [];
}

/**
 * مزامنة المنتجات مع Meta Catalog (Batch Update / Feed)
 */
export async function syncProductsToMeta(
  products: Array<{
    id: string;
    name: string;
    description?: string | null | undefined;
    price: number;
    discount_price?: number | null | undefined;
    slug?: string | undefined;
    images?: string[] | undefined;
    stock: number;
    sku?: string | null | undefined;
    status: boolean;
    brand?: string;
    category?: string;
    colors?: Array<{ name: string; swatch: string; images?: string[] }>;
  }>,
  origin: string,
): Promise<{
  success: boolean;
  synced_count: number;
  catalog_id?: string;
  error?: string;
}> {
  const config = await getMetaConfig();

  // تحويل المنتجات لهيكل Meta Catalog الرسمي
  const items = products.map((p) => {
    const mainImg = p.images?.[0] || `${origin}/favicon.png`;
    const fullMainImg = mainImg.startsWith("http")
      ? mainImg
      : `${origin}${mainImg.startsWith("/") ? "" : "/"}${mainImg}`;
    const additionalImages = (p.images || [])
      .slice(1, 10)
      .map((img) =>
        img.startsWith("http") ? img : `${origin}${img.startsWith("/") ? "" : "/"}${img}`,
      );

    const colorNames = p.colors?.map((c) => c.name).join(" / ");

    const tpl = config.product_description_template;
    const templated = tpl
      ? tpl
          .replace(/{name}/g, p.name)
          .replace(/{brand}/g, p.brand || "Ehab Store")
          .replace(/{category}/g, p.category || "العناية والتجميل")
          .replace(/{store}/g, "إيهاب ستور")
          .replace(
            /{price}/g,
            `${Number(p.discount_price || p.price).toFixed(0)} ${config.ad_account_currency || "SAR"}`,
          )
          .replace(/{description}/g, p.description || "")
          .trim()
      : "";

    const categoryPath = p.category
      ? `العناية والتجميل > ${p.category}${p.brand ? ` > ${p.brand}` : ""}`
      : "العناية والتجميل";
    const richDescription = [
      templated || p.description || p.name,
      p.brand ? `الماركة: ${p.brand}` : "",
      p.category ? `القسم: ${p.category}` : "",
      colorNames ? `الألوان المتوفرة: ${colorNames}` : "",
      "شحن سريع وضمان الأصلية من إيهاب ستور.",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      id: p.sku || `EHAB-${p.id.slice(0, 8)}`,
      retailer_id: p.id,
      title: p.brand ? `${p.name} — ${p.brand}` : p.name,
      description: richDescription,
      rich_text_description: richDescription.replace(/\n/g, "<br/>"),
      availability: p.stock > 0 && p.status ? "in stock" : "out of stock",
      condition: "new",
      price: `${Number(p.price).toFixed(2)} ${config.ad_account_currency || "SAR"}`,
      sale_price:
        p.discount_price && Number(p.discount_price) > 0
          ? `${Number(p.discount_price).toFixed(2)} ${config.ad_account_currency || "SAR"}`
          : undefined,
      link: `${origin}/product/${p.slug}?utm_source=facebook&utm_medium=catalog&utm_campaign=shop`,
      // يفتح المنتج داخل تطبيق المتجر المثبّت (PWA) عند توفره، وإلا في المتصفح
      applink: {
        web: [{ url: `${origin}/product/${p.slug}`, app_name: "Ehab Store" }],
        android: [
          {
            url: `${origin}/product/${p.slug}`,
            package: "app.ehabstore.twa",
            app_name: "Ehab Store",
          },
        ],
      },
      image_link: fullMainImg,
      additional_image_link: additionalImages,
      brand: p.brand || "Ehab Store",
      google_product_category: "Health & Beauty > Personal Care > Cosmetics",
      product_type: categoryPath,
      custom_label_0: p.category || "العناية والتجميل",
      custom_label_1: p.discount_price && Number(p.discount_price) > 0 ? "عرض خاص" : "سعر عادي",
      color: colorNames || undefined,
      inventory: p.stock,
      status: p.status ? "active" : "archived",
    };
  });

  // إذا كان هناك كتالوج وتوكن حقيقي، إرسال دفعة العناصر عبر Graph API
  if (!config.access_token || !config.catalog_id) {
    return {
      success: false,
      synced_count: 0,
      error: "يجب ربط حساب Meta واختيار الكتالوج أولاً قبل مزامنة المنتجات",
    };
  }
  try {
    const requests = items.map((item) => ({
      method: "UPDATE",
      retailer_id: item.id,
      data: item,
    }));

    const res = await fetch(
      `${GRAPH_API_BASE}/${config.catalog_id}/items_batch?access_token=${encodeURIComponent(config.access_token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      },
    );

    const resData = await res.json();
    if (!res.ok || resData?.error) {
      return {
        success: false,
        synced_count: 0,
        error: resData?.error?.message || `فشلت المزامنة (كود ${res.status})`,
      };
    }
  } catch {
    return { success: false, synced_count: 0, error: "تعذر الاتصال بخوادم Meta" };
  }

  // تحديث وقت المزامنة الأخير
  await saveMetaConfig({
    ...config,
    last_sync_at: new Date().toISOString(),
  });

  return {
    success: true,
    synced_count: items.length,
    catalog_id: config.catalog_id,
  };
}

/**
 * إنشاء حملة إعلانية على Meta (Campaign + AdSet + Creative)
 */
export async function createMetaCampaignApi(
  campaign: Omit<MetaCampaign, "id" | "created_at" | "updated_at">,
): Promise<{
  success: boolean;
  campaign_id: string;
  meta_campaign_id?: string;
  local_only?: boolean;
  error?: string;
}> {
  const config = await getMetaConfig();
  const internalId = `camp-${Date.now()}`;

  // إذا كان متصلاً بحساب إعلاني وتوكن حقيقي
  if (config.access_token && config.ad_account_id) {
    let apiError = "";
    try {
      const res = await fetch(
        `${GRAPH_API_BASE}/${config.ad_account_id}/campaigns?access_token=${encodeURIComponent(config.access_token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
            special_ad_categories: [],
          }),
        },
      );
      const data = await res.json();
      if (data.id) {
        return {
          success: true,
          campaign_id: internalId,
          meta_campaign_id: data.id,
        };
      }
      apiError = data?.error?.message || "";
    } catch (err) {
      console.warn("Could not create campaign via Meta API, saved locally", err);
      apiError = "تعذر الاتصال بخوادم Meta";
    }
    return {
      success: true,
      campaign_id: internalId,
      local_only: true,
      ...(apiError ? { error: apiError } : {}),
    };
  }

  // لا يوجد حساب إعلاني مربوط — تُحفظ الحملة كمسودة داخلية فقط
  return {
    success: true,
    campaign_id: internalId,
    local_only: true,
  };
}

/**
 * تحديث حالة الحملة (تشغيل / إيقاف مؤقت)
 */
export async function toggleMetaCampaignStatusApi(
  campaignId: string,
  newStatus: "ACTIVE" | "PAUSED",
  metaCampaignId?: string,
): Promise<boolean> {
  const config = await getMetaConfig();

  if (config.access_token && metaCampaignId) {
    try {
      await fetch(
        `${GRAPH_API_BASE}/${metaCampaignId}?access_token=${encodeURIComponent(config.access_token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );
    } catch {
      /* ignore */
    }
  }

  return true;
}

/**
 * جلب تقرير الأداء الإعلاني الشامل
 */
export async function fetchMetaPerformanceReport(
  period: "today" | "last_7_days" | "last_30_days" | "custom" = "last_7_days",
): Promise<MetaPerformanceReport> {
  const campaigns = await getMetaCampaigns();

  if (!campaigns || campaigns.length === 0) {
    return {
      period,
      total_spend: 0,
      total_sales: 0,
      total_orders: 0,
      total_clicks: 0,
      total_reach: 0,
      total_impressions: 0,
      average_ctr: 0,
      average_cpc: 0,
      average_cpm: 0,
      roas: 0,
      cost_per_purchase: 0,
      top_selling_products: [],
      daily_trends: [],
    };
  }

  let total_spend = 0;
  let total_sales = 0;
  let total_orders = 0;
  let total_clicks = 0;
  let total_reach = 0;
  let total_impressions = 0;

  for (const c of campaigns) {
    if (c.metrics) {
      total_spend += Number(c.metrics.spend || 0);
      total_sales += Number(c.metrics.purchase_value || 0);
      total_orders += Number(c.metrics.purchases || 0);
      total_clicks += Number(c.metrics.clicks || 0);
      total_reach += Number(c.metrics.reach || 0);
      total_impressions += Number(c.metrics.impressions || 0);
    }
  }

  const average_ctr = total_impressions > 0 ? (total_clicks / total_impressions) * 100 : 0;
  const average_cpc = total_clicks > 0 ? total_spend / total_clicks : 0;
  const average_cpm = total_impressions > 0 ? (total_spend / total_impressions) * 1000 : 0;
  const roas = total_spend > 0 ? total_sales / total_spend : 0;
  const cost_per_purchase = total_orders > 0 ? total_spend / total_orders : 0;

  return {
    period,
    total_spend: Math.round(total_spend),
    total_sales: Math.round(total_sales),
    total_orders,
    total_clicks,
    total_reach,
    total_impressions,
    average_ctr: Number(average_ctr.toFixed(2)),
    average_cpc: Number(average_cpc.toFixed(2)),
    average_cpm: Number(average_cpm.toFixed(2)),
    roas: Number(roas.toFixed(2)),
    cost_per_purchase: Number(cost_per_purchase.toFixed(2)),
    top_selling_products: [],
    daily_trends: [],
  };
}

/**
 * مزامنة صامتة لمتوسط تقييم منتج مع عنصره في كتالوج ميتا.
 * تُستخدم عند اعتماد مراجعة جديدة — تفشل بصمت إن لم يكن الربط مكتملاً.
 */
export async function syncProductRatingToMeta(
  productId: string,
  avgRating: number,
  reviewCount: number,
): Promise<{ success: boolean }> {
  try {
    const config = await getMetaConfig();
    if (!config.access_token || !config.catalog_id) return { success: false };
    const res = await fetch(
      `${GRAPH_API_BASE}/${config.catalog_id}/items_batch?access_token=${encodeURIComponent(config.access_token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              method: "UPDATE",
              retailer_id: productId,
              data: {
                custom_label_2: `تقييم ${avgRating.toFixed(1)}/5`,
                custom_label_3: `${reviewCount} مراجعة`,
              },
            },
          ],
        }),
      },
    );
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}
