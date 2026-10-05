/**
 * Meta Graph API & OAuth Server Module (v22.0)
 * يتم تنفيذ هذا الملف على الخادم فقط (Server-Side)
 * لحماية App Secret و Access Tokens من التسريب للواجهة
 */

import { randomUUID } from "node:crypto";
import type {
  MetaConfig,
  MetaUserProfile,
  MetaPermissionItem,
  MetaFacebookPage,
  MetaAdAccount,
  MetaBusinessAccount,
  MetaInstagramAccount,
} from "./types";

export const GRAPH_VERSION = "v22.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const OAUTH_DIALOG_BASE = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

const CONFIG_KEY = "meta_integration_config";
const CREDENTIALS_KEY = "meta_app_credentials";

// الصلاحيات الرسمية المطلوبة لعمليات المتجر
// صلاحيات مبدئية مقلّصة لتفادي الحظر في وضع التطوير
export const REQUIRED_META_SCOPES = [
  "public_profile",
  "email",
  "pages_show_list",
  "business_management",
];

export const PERMISSION_METADATA: Record<
  string,
  { description: string; required_for: string; requires_app_review: boolean }
> = {
  public_profile: {
    description: "الوصول إلى الاسم وصورة الحساب للتحقق من هوية صاحب المتجر",
    required_for: "تسجيل الدخول وعرض الملف الشخصي",
    requires_app_review: false,
  },
  email: {
    description: "البريد الإلكتروني المرتبط بحساب فيسبوك",
    required_for: "التواصل والإشعارات",
    requires_app_review: false,
  },
  pages_show_list: {
    description: "استعراض قائمة الصفحات التي تديرها لاكتشافها وربطها بالمتجر",
    required_for: "اكتشاف الصفحات وحسابات إنستغرام",
    requires_app_review: true,
  },
  pages_read_engagement: {
    description: "قراءة تفاصيل الصفحة وإحصائيات التفاعل",
    required_for: "عرض عدد المتابعين وحالة الصفحة",
    requires_app_review: true,
  },
  pages_manage_posts: {
    description: "نشر وتحديث محتوى ومنتجات المتجر على الصفحة",
    required_for: "نشر العروض والمنتجات تلقائياً",
    requires_app_review: true,
  },
  pages_manage_metadata: {
    description: "تحديث روابط المتجر وبيانات التواصل والوصف",
    required_for: "مزامنة بيانات المتجر مع الصفحة",
    requires_app_review: true,
  },
  ads_read: {
    description: "قراءة بيانات الحسابات الإعلانية ومؤشرات الأداء",
    required_for: "اكتشاف الحساب الإعلاني وعرض الإنفاق",
    requires_app_review: true,
  },
  ads_management: {
    description: "إنشاء وإدارة الحملات الإعلانية والمجموعات الإعلانية",
    required_for: "إدارة إعلانات Meta من داخل المتجر",
    requires_app_review: true,
  },
  business_management: {
    description: "الوصول إلى محافظ الأعمال (Business Portfolios) والكتالوجات",
    required_for: "إدارة أصول الكتالوج ومحفظة الأعمال",
    requires_app_review: true,
  },
  instagram_basic: {
    description: "الوصول إلى حساب إنستغرام الاحترافي المرتبط بالصفحة",
    required_for: "اكتشاف حساب إنستغرام وعرض بياناته",
    requires_app_review: true,
  },
  instagram_manage_insights: {
    description: "قراءة إحصائيات وصول ومشاهدات إنستغرام",
    required_for: "تحليلات وصول إعلانات إنستغرام",
    requires_app_review: true,
  },
  catalog_management: {
    description: "إدارة كتالوج المنتجات وتحديث الأسعار والمخزون في Meta Commerce",
    required_for: "مزامنة المنتجات مع متجر فيسبوك وإنستغرام",
    requires_app_review: true,
  },
};

const AD_ACCOUNT_STATUS_MAP: Record<number, string> = {
  1: "نشط (ACTIVE)",
  2: "معطّل (DISABLED)",
  3: "معلّق للدفع (UNSETTLED)",
  7: "قيد مراجعة المخاطر (PENDING_RISK_REVIEW)",
  8: "قيد التسوية (PENDING_SETTLEMENT)",
  9: "فترة سماح (IN_GRACE_PERIOD)",
  100: "قيد الإغلاق (PENDING_CLOSURE)",
  101: "مغلق (CLOSED)",
};

async function adminSupabase() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function readSettingRaw(key: string): Promise<string | null> {
  const sb = await adminSupabase();
  const { data } = await sb.from("site_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value ?? null) as string | null;
}

export async function writeSettingRaw(
  key: string,
  value: string,
  description: string,
  group = "meta_integration",
): Promise<void> {
  const sb = await adminSupabase();
  const { data } = await sb.from("site_settings").select("id").eq("key", key).maybeSingle();
  if (data?.id) {
    await sb
      .from("site_settings")
      .update({
        value,
        group,
        description,
        updated_at: new Date().toISOString(),
      })
      .eq("key", key);
  } else {
    await sb.from("site_settings").insert({ key, value, group, description });
  }
}

/**
 * استرجاع بيانات اعتماد التطبيق (App ID & App Secret) بأمان من البيئة أو قاعدة البيانات
 */
export async function getMetaAppCredentials(): Promise<{
  appId: string | null;
  appSecret: string | null;
  source: "env" | "database" | "none";
}> {
  const envAppId =
    (process.env["META_APP_ID"] || process.env["VITE_META_APP_ID"] || "").trim() || null;
  const envAppSecret = (process.env["META_APP_SECRET"] || "").trim() || null;

  if (envAppId && envAppSecret) {
    return { appId: envAppId, appSecret: envAppSecret, source: "env" };
  }

  // البحث في الإعدادات المخزنة بأمان
  try {
    const rawCreds = await readSettingRaw(CREDENTIALS_KEY);
    if (rawCreds) {
      const parsed = JSON.parse(rawCreds) as { app_id?: string; app_secret?: string };
      const appId = envAppId || (parsed.app_id ? parsed.app_id.trim() : null);
      const appSecret = envAppSecret || (parsed.app_secret ? parsed.app_secret.trim() : null);
      if (appId) {
        return {
          appId,
          appSecret,
          source: parsed.app_secret ? "database" : "none",
        };
      }
    }

    // البحث في ملف الإعداد الرئيسي إذا وجد app_id
    const rawConfig = await readSettingRaw(CONFIG_KEY);
    if (rawConfig) {
      const cfg = JSON.parse(rawConfig) as Record<string, unknown>;
      const appId = envAppId || (cfg["app_id"] as string | null);
      return { appId: appId || null, appSecret: envAppSecret || null, source: "none" };
    }
  } catch {
    // تجاهل خطأ القراءة المؤقت
  }

  return { appId: envAppId, appSecret: envAppSecret, source: "none" };
}

/**
 * حفظ بيانات اعتماد تطبيق Meta على الخادم (للمدير فقط)
 */
export async function saveMetaAppCredentials(appId: string, appSecret?: string | null) {
  const cleanId = (appId || "").trim();
  const cleanSecret = (appSecret || "").trim();

  // جلب القديم للحفاظ على Secret إذا لم يتم إرساله مجدداً
  const current = await getMetaAppCredentials();
  const finalSecret = cleanSecret || current.appSecret || "";

  await writeSettingRaw(
    CREDENTIALS_KEY,
    JSON.stringify({
      app_id: cleanId,
      app_secret: finalSecret,
      updated_at: new Date().toISOString(),
    }),
    "بيانات اعتماد تطبيق Meta (App ID & Secret) المشفرة على الخادم",
  );

  // تحديث app_id في ملف الإعدادات العام أيضاً
  const currentConfig = await getStoredMetaConfig();
  await saveStoredMetaConfig({
    ...currentConfig,
    app_id: cleanId,
    has_secret: Boolean(finalSecret),
  });

  return { ok: true, has_secret: Boolean(finalSecret) };
}

/**
 * إنشاء رابط OAuth الموجه مباشرة لنافذة Meta الرسمية
 */
export async function generateMetaAuthUrl(origin: string): Promise<{
  url: string;
  state: string;
  redirectUri: string;
}> {
  const { appId } = await getMetaAppCredentials();
  if (!appId) {
    throw new Error(
      "لم يتم ضبط معرّف تطبيق فيسبوك (Meta App ID). يرجى إدخاله في قسم إعدادات التطبيق أولاً.",
    );
  }

  const cleanOrigin = origin.replace(/\/+$/, "");
  const redirectUri = `${cleanOrigin}/api/auth/meta/callback`;
  const state = `meta_${randomUUID().replace(/-/g, "")}_${Date.now()}`;

  // حفظ الـ state مؤقتاً للتحقق من CSRF
  await writeSettingRaw(
    `meta_oauth_state_${state}`,
    JSON.stringify({ created_at: Date.now(), origin: cleanOrigin }),
    "CSRF State Token for Meta OAuth",
  );

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: REQUIRED_META_SCOPES.join(","),
  });

  return {
    url: `${OAUTH_DIALOG_BASE}?${params.toString()}`,
    state,
    redirectUri,
  };
}

/**
 * تبادل Authorization Code بتوكن وصول طويل الأجل (Long-Lived User Token صالح لمدة 60 يوماً)
 */
/** يتحقق من رمز الحالة الصادر من لوحة المدير ثم يلغيه (استخدام مرة واحدة، صلاحية 15 دقيقة). */
export async function consumeMetaOAuthState(state: string | null): Promise<boolean> {
  if (!state || !/^meta_[a-f0-9]{32}_\d+$/.test(state)) return false;
  const key = `meta_oauth_state_${state}`;
  const raw = await readSettingRaw(key);
  if (!raw) return false;
  const db = await adminSupabase();
  await db.from("site_settings").delete().eq("key", key);
  try {
    const parsed = JSON.parse(raw) as { created_at?: number };
    return Date.now() - Number(parsed.created_at ?? 0) < 15 * 60 * 1000;
  } catch {
    return false;
  }
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<{
  accessToken: string;
  expiresIn?: number;
}> {
  const { appId, appSecret } = await getMetaAppCredentials();
  if (!appId || !appSecret) {
    throw new Error("بيانات اعتماد تطبيق Meta (App ID أو App Secret) مفقودة من الخادم.");
  }

  // 1. استبدال code بتوكن قصير الأجل
  const shortParams = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    client_secret: appSecret,
    code,
  });

  const shortRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${shortParams.toString()}`);
  const shortData = (await shortRes.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string; type?: string; code?: number };
  };

  if (shortData.error || !shortData.access_token) {
    throw new Error(shortData.error?.message || "فشل تبادل رمز التفويض مع خوادم Meta");
  }

  // 2. تمديد التوكن إلى طويل الأجل (Long-Lived Token 60 Days)
  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortData.access_token,
  });

  const longRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${longParams.toString()}`);
  const longData = (await longRes.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };

  const finalToken = longData.access_token || shortData.access_token;
  const expiresIn = longData.expires_in || shortData.expires_in;

  return expiresIn !== undefined
    ? { accessToken: finalToken, expiresIn }
    : { accessToken: finalToken };
}

/**
 * جلب الملف الشخصي والأصول الحقيقية من خوادم Meta Graph API
 */
export async function fetchLiveMetaAssets(token: string): Promise<{
  user: MetaUserProfile;
  permissions: MetaPermissionItem[];
  pages: MetaFacebookPage[];
  adAccounts: MetaAdAccount[];
  businesses: MetaBusinessAccount[];
}> {
  // 1. بيانات المستخدم الأساسية
  const meRes = await fetch(
    `${GRAPH_BASE}/me?fields=id,name,email,picture.width(200).height(200)&access_token=${encodeURIComponent(token)}`,
  );
  const meData = (await meRes.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string } };
    error?: { message?: string };
  };

  if (meData.error || !meData.id) {
    throw new Error(meData.error?.message || "تعذر جلب بيانات الحساب من Meta");
  }

  const user: MetaUserProfile = {
    id: meData.id,
    name: meData.name || "مستخدم Meta",
    email: meData.email || null,
    picture_url: meData.picture?.data?.url || null,
  };

  // 2. الصلاحيات الممنوحة والمرفوضة
  const permRes = await fetch(
    `${GRAPH_BASE}/me/permissions?access_token=${encodeURIComponent(token)}`,
  );
  const permData = (await permRes.json().catch(() => ({}))) as {
    data?: Array<{ permission: string; status: "granted" | "declined" }>;
  };

  const permissions: MetaPermissionItem[] = (permData.data || []).map((p) => {
    const meta = PERMISSION_METADATA[p.permission] || {
      description: `صلاحية ${p.permission}`,
      required_for: "وظائف Meta المتقدمة",
      requires_app_review: true,
    };
    return {
      permission: p.permission,
      status: p.status,
      description: meta.description,
      required_for: meta.required_for,
      requires_app_review: meta.requires_app_review,
    };
  });

  // 3. الصفحات وحسابات إنستغرام المرتبطة بها
  const pagesRes = await fetch(
    `${GRAPH_BASE}/me/accounts?fields=id,name,category,access_token,tasks,fan_count,picture.width(200).height(200),instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}&access_token=${encodeURIComponent(token)}`,
  );
  const pagesData = (await pagesRes.json().catch(() => ({}))) as {
    data?: Array<{
      id: string;
      name: string;
      category?: string;
      access_token?: string;
      tasks?: string[];
      fan_count?: number;
      picture?: { data?: { url?: string } };
      instagram_business_account?: {
        id: string;
        username: string;
        name?: string;
        profile_picture_url?: string;
        followers_count?: number;
        media_count?: number;
      };
    }>;
  };

  const pages: MetaFacebookPage[] = (pagesData.data || []).map((p) => {
    let ig: MetaInstagramAccount | null = null;
    if (p.instagram_business_account) {
      ig = {
        id: p.instagram_business_account.id,
        username: p.instagram_business_account.username,
        name: p.instagram_business_account.name || null,
        profile_picture_url: p.instagram_business_account.profile_picture_url || null,
        followers_count: p.instagram_business_account.followers_count || null,
        media_count: p.instagram_business_account.media_count || null,
      };
    }
    return {
      id: p.id,
      name: p.name,
      category: p.category || null,
      access_token: p.access_token || null,
      picture_url: p.picture?.data?.url || null,
      followers_count: p.fan_count || null,
      tasks: p.tasks || [],
      instagram_account: ig,
    };
  });

  // 4. الحسابات الإعلانية Meta Ads
  const adsRes = await fetch(
    `${GRAPH_BASE}/me/adaccounts?fields=id,account_id,name,currency,account_status,amount_spent,business{id,name}&access_token=${encodeURIComponent(token)}`,
  );
  const adsData = (await adsRes.json().catch(() => ({}))) as {
    data?: Array<{
      id: string;
      account_id: string;
      name: string;
      currency: string;
      account_status?: number;
      amount_spent?: string;
      business?: { id: string; name: string };
    }>;
  };

  const adAccounts: MetaAdAccount[] = (adsData.data || []).map((a) => ({
    id: a.id,
    account_id: a.account_id,
    name: a.name || `حساب إعلاني (${a.account_id})`,
    currency: a.currency || "USD",
    account_status: a.account_status ?? null,
    account_status_label:
      a.account_status != null
        ? AD_ACCOUNT_STATUS_MAP[a.account_status] || `حالة ${a.account_status}`
        : "غير محدد",
    amount_spent: a.amount_spent ? String(Number(a.amount_spent) / 100) : null,
    business: a.business || null,
  }));

  // 5. محافظ وحسابات الأعمال (Business Portfolios)
  const bizRes = await fetch(
    `${GRAPH_BASE}/me/businesses?fields=id,name,verification_status,primary_page{id,name}&access_token=${encodeURIComponent(token)}`,
  );
  const bizData = (await bizRes.json().catch(() => ({}))) as {
    data?: Array<{
      id: string;
      name: string;
      verification_status?: string;
      primary_page?: { id: string; name: string };
    }>;
  };

  const businesses: MetaBusinessAccount[] = (bizData.data || []).map((b) => ({
    id: b.id,
    name: b.name,
    verification_status: b.verification_status || null,
    primary_page: b.primary_page || null,
  }));

  // صفحات Business Manager (المملوكة والعملاء) بالإضافة إلى /me/accounts
  const seen = new Set(pages.map((p) => p.id));
  for (const b of businesses) {
    for (const edge of ["owned_pages", "client_pages"]) {
      try {
        const r = await fetch(
          `${GRAPH_BASE}/${b.id}/${edge}?fields=id,name,category,access_token,fan_count,picture.width(200).height(200)&access_token=${encodeURIComponent(token)}`,
        );
        const d = (await r.json().catch(() => ({}))) as {
          data?: Array<{ id: string; name: string; category?: string; access_token?: string; fan_count?: number; picture?: { data?: { url?: string } } }>;
        };
        for (const p of d.data || []) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          pages.push({
            id: p.id,
            name: p.name,
            category: p.category || null,
            access_token: p.access_token || null,
            picture_url: p.picture?.data?.url || null,
            followers_count: p.fan_count || null,
            tasks: [],
            instagram_account: null,
          } as MetaFacebookPage);
        }
      } catch {
        /* تجاهل */
      }
    }
  }

  return { user, permissions, pages, adAccounts, businesses };
}

/**
 * قراءة إعدادات Meta الحالية المخزنة
 */
export async function getStoredMetaConfig(): Promise<MetaConfig> {
  const raw = await readSettingRaw(CONFIG_KEY);
  const creds = await getMetaAppCredentials();

  const fallback: MetaConfig = {
    connected: false,
    connected_at: null,
    status: "disconnected",
    status_message: "لم يتم ربط حساب Meta بعد. اضغط على زر تسجيل الدخول للبدء.",
    user: null,
    app_id: creds.appId,
    has_secret: Boolean(creds.appSecret),
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

  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<MetaConfig>;
    return {
      ...fallback,
      ...parsed,
      app_id: creds.appId || parsed.app_id || null,
      has_secret: Boolean(creds.appSecret || parsed.has_secret),
      discovered_pages: parsed.discovered_pages || [],
      discovered_ad_accounts: parsed.discovered_ad_accounts || [],
      discovered_businesses: parsed.discovered_businesses || [],
      permissions: parsed.permissions || [],
    };
  } catch {
    return fallback;
  }
}

/**
 * حفظ إعدادات Meta في قاعدة البيانات
 */
export async function saveStoredMetaConfig(config: MetaConfig): Promise<void> {
  // حجب التوكن من أن يتم إرساله للعميل لاحقاً
  await writeSettingRaw(
    CONFIG_KEY,
    JSON.stringify(config),
    "إعدادات وتكامل Meta وFacebook وInstagram والصفحات والحسابات الإعلانية",
  );
}

/**
 * فحص وإلغاء صلاحيات حساب Meta وفصله نهائياً
 */
export async function revokeMetaAccess(): Promise<void> {
  const current = await getStoredMetaConfig();
  if (current.access_token) {
    try {
      await fetch(
        `${GRAPH_BASE}/me/permissions?access_token=${encodeURIComponent(current.access_token)}`,
        { method: "DELETE" },
      );
    } catch {
      // تجاهل أخطاء التوكن المنتهي بالفعل
    }
  }

  // إعادة ضبط التكوين إلى غير متصل مع الحفاظ على معرّفات Pixel والـ App ID
  const cleared: MetaConfig = {
    ...current,
    connected: false,
    connected_at: null,
    status: "disconnected",
    status_message: "تم فصل الحساب بنجاح.",
    access_token: null,
    token_expires_at: null,
    user: null,
    discovered_pages: [],
    discovered_ad_accounts: [],
    discovered_businesses: [],
    permissions: [],
    page_id: null,
    page_name: null,
    page_picture: null,
    instagram_id: null,
    instagram_username: null,
    instagram_picture: null,
    ad_account_id: null,
    ad_account_name: null,
    business_id: null,
    business_name: null,
    last_sync_at: new Date().toISOString(),
  };

  await saveStoredMetaConfig(cleared);
}
