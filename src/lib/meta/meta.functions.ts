import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MetaConfig, MetaConnectionStatus } from "./types";
import {
  getStoredMetaConfig,
  saveStoredMetaConfig,
  generateMetaAuthUrl,
  saveMetaAppCredentials,
  getMetaAppCredentials,
  fetchLiveMetaAssets,
  revokeMetaAccess,
  readSettingRaw,
  writeSettingRaw,
  GRAPH_BASE,
} from "./server";

const CONFIG_KEY = "meta_integration_config";
const CAMPAIGNS_KEY = "meta_campaigns_list";

async function assertAdmin(context: { supabase: any; userId: string }) {
  for (const role of ["admin", "super_admin"]) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (data) return;
  }
  throw new Error("غير مصرح لك بالوصول لإعدادات Meta");
}

function sanitizeConfigForClient(c: MetaConfig): MetaConfig {
  return {
    ...c,
    access_token: null, // عدم إرسال التوكن للواجهة أبداً
    discovered_pages: (c.discovered_pages || []).map((p) => ({ ...p, access_token: null })),
  };
}

/** الإعدادات العامة الآمنة فقط (معرّف البيكسل وخيارات التتبع) — متاحة للزوار */
export const getMetaPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const raw = await readSettingRaw(CONFIG_KEY);
    if (!raw) {
      return {
        pixel_id: null as string | null,
        track_purchases: true,
        track_add_to_cart: true,
        track_view_content: true,
      };
    }
    const c = JSON.parse(raw) as Record<string, unknown>;
    return {
      pixel_id: (c["pixel_id"] as string | null) ?? null,
      track_purchases: c["track_purchases"] !== false,
      track_add_to_cart: c["track_add_to_cart"] !== false,
      track_view_content: c["track_view_content"] !== false,
    };
  } catch {
    return {
      pixel_id: null as string | null,
      track_purchases: true,
      track_add_to_cart: true,
      track_view_content: true,
    };
  }
});

/** إعدادات Meta الكاملة والمأمونة — للوحة التحكم */
export const getMetaAdminConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const cfg = await getStoredMetaConfig();
    return { value: JSON.stringify(sanitizeConfigForClient(cfg)) };
  });

/** حفظ إعدادات Meta العامة مثل Pixel وخيارات التتبع */
export const saveMetaAdminConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { value: string }) => {
    if (!input?.value) throw new Error("لا توجد بيانات للحفظ");
    return { value: input.value.slice(0, 300_000) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const current = await getStoredMetaConfig();
    const raw = JSON.parse(data.value) as Record<string, unknown>;
    // قبول المفاتيح المعروفة فقط ومنع تعديل الحقول الحساسة
    const blocked = new Set(["access_token", "app_secret", "has_secret", "token_expires_at"]);
    const allowed = new Set(Object.keys(current));
    const incoming = Object.fromEntries(
      Object.entries(raw && typeof raw === "object" ? raw : {}).filter(
        ([k]) => allowed.has(k) && !blocked.has(k),
      ),
    ) as Partial<MetaConfig>;

    const merged: MetaConfig = {
      ...current,
      ...incoming,
      // الحفاظ على الأسرار والتوكنات المخزنة سلفاً
      access_token: current.access_token ?? null,
      app_id: incoming.app_id || current.app_id,
      has_secret: current.has_secret,
    };

    await saveStoredMetaConfig(merged);
    return { ok: true };
  });

/** حفظ بيانات اعتماد تطبيق Meta (App ID و App Secret) */
export const saveMetaAppKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appId: string; appSecret?: string | null }) => {
    const id = (input?.appId ?? "").trim();
    if (!id || !/^\d{6,30}$/.test(id)) {
      throw new Error("معرّف التطبيق (App ID) يجب أن يتكون من أرقام فقط");
    }
    return {
      appId: id,
      appSecret: (input.appSecret ?? "").trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const res = await saveMetaAppCredentials(data.appId, data.appSecret);
    return res;
  });

/** إنشاء رابط تسجيل الدخول الرسمي عبر Meta Dialog */
export const getMetaAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin?: string }) => {
    const origin = (input?.origin ?? "").trim() || "https://ehabstore.app";
    return { origin: origin.replace(/\/+$/, "") };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const authData = await generateMetaAuthUrl(data.origin);
    return authData;
  });

/** مزامنة الأصول فورياً من Meta Graph API */
export const syncMetaAssetsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const current = await getStoredMetaConfig();

    if (!current.access_token) {
      return {
        ok: false,
        status: "disconnected" as MetaConnectionStatus,
        message: "حساب Meta غير متصل. يرجى تسجيل الدخول أولاً.",
      };
    }

    try {
      const assets = await fetchLiveMetaAssets(current.access_token);

      // تحديد حالة الصلاحيات الأساسية
      const essentialPermissions = ["pages_show_list", "ads_read", "public_profile"];
      const granted = new Set(
        assets.permissions.filter((p) => p.status === "granted").map((p) => p.permission),
      );
      const missingEssential = essentialPermissions.some((ep) => !granted.has(ep));

      const newStatus: MetaConnectionStatus = missingEssential
        ? "insufficient_permissions"
        : "connected";

      // إذا كانت الصفحة المختارة ما تزال موجودة، حدث بياناتها
      let selectedPage = assets.pages.find((p) => p.id === current.page_id) || null;
      if (!selectedPage && assets.pages.length === 1) {
        selectedPage = assets.pages[0] ?? null;
      }

      // إذا كان الحساب الإعلاني ما زال موجوداً
      let selectedAdAccount = assets.adAccounts.find((a) => a.id === current.ad_account_id) || null;
      if (!selectedAdAccount && assets.adAccounts.length === 1) {
        selectedAdAccount = assets.adAccounts[0] ?? null;
      }

      const updated: MetaConfig = {
        ...current,
        connected: true,
        status: newStatus,
        status_message: missingEssential
          ? "تم الاتصال ولكن هناك بعض الصلاحيات الناقصة. يمكنك مراجعتها في قسم الصلاحيات."
          : "تم الاتصال بحسابك وبكافة الأصول بنجاح.",
        user: assets.user,
        discovered_pages: assets.pages,
        discovered_ad_accounts: assets.adAccounts,
        discovered_businesses: assets.businesses,
        permissions: assets.permissions,
        page_id: selectedPage?.id || current.page_id,
        page_name: selectedPage?.name || current.page_name,
        page_picture: selectedPage?.picture_url || current.page_picture,
        instagram_id: selectedPage?.instagram_account?.id || current.instagram_id,
        instagram_username: selectedPage?.instagram_account?.username || current.instagram_username,
        instagram_picture:
          selectedPage?.instagram_account?.profile_picture_url || current.instagram_picture,
        ad_account_id: selectedAdAccount?.id || current.ad_account_id,
        ad_account_name: selectedAdAccount?.name || current.ad_account_name,
        ad_account_currency: selectedAdAccount?.currency || current.ad_account_currency,
        last_sync_at: new Date().toISOString(),
      };

      await saveStoredMetaConfig(updated);
      return {
        ok: true,
        status: newStatus,
        message: `تم تحديث البيانات بنجاح: ${assets.pages.length} صفحة و ${assets.adAccounts.length} حساب إعلاني`,
        config: sanitizeConfigForClient(updated),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشلت المزامنة مع Meta";
      const isExpired =
        msg.includes("Session has expired") || msg.includes("Error validating access token");

      const errorConfig: MetaConfig = {
        ...current,
        status: isExpired ? "needs_reauth" : current.status,
        status_message: isExpired
          ? "انتهت صلاحية جلسة التفويض. يرجى الضغط على «إعادة التفويض» لتجديد الاتصال."
          : `خطأ أثناء المزامنة: ${msg}`,
      };
      await saveStoredMetaConfig(errorConfig);

      return {
        ok: false,
        status: errorConfig.status,
        message: errorConfig.status_message || msg,
        config: sanitizeConfigForClient(errorConfig),
      };
    }
  });

/** اختيار صفحة كصفحة رئيسية للمتجر */
export const selectMetaPageAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pageId: string }) => {
    const id = (input?.pageId ?? "").trim();
    if (!id) throw new Error("معرّف الصفحة مطلوب");
    return { pageId: id };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const current = await getStoredMetaConfig();
    const page = current.discovered_pages.find((p) => p.id === data.pageId);
    if (!page) {
      throw new Error("الصفحة المحددة غير موجودة في قائمة صفحاتك");
    }

    const updated: MetaConfig = {
      ...current,
      page_id: page.id,
      page_name: page.name,
      page_picture: page.picture_url || null,
      instagram_id: page.instagram_account?.id || null,
      instagram_username: page.instagram_account?.username || null,
      instagram_picture: page.instagram_account?.profile_picture_url || null,
      last_sync_at: new Date().toISOString(),
    };

    await saveStoredMetaConfig(updated);
    return { ok: true, page: sanitizeConfigForClient(updated) };
  });

/** اختيار حساب إعلاني للمتجر */
export const selectMetaAdAccountAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { adAccountId: string }) => {
    const id = (input?.adAccountId ?? "").trim();
    if (!id) throw new Error("معرّف الحساب الإعلاني مطلوب");
    return { adAccountId: id };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const current = await getStoredMetaConfig();
    const account = current.discovered_ad_accounts.find((a) => a.id === data.adAccountId);
    if (!account) {
      throw new Error("الحساب الإعلاني المحدد غير موجود");
    }

    const updated: MetaConfig = {
      ...current,
      ad_account_id: account.id,
      ad_account_name: account.name,
      ad_account_currency: account.currency,
      last_sync_at: new Date().toISOString(),
    };

    await saveStoredMetaConfig(updated);
    return { ok: true, config: sanitizeConfigForClient(updated) };
  });

/** فصل حساب Meta وإلغاء الصلاحيات */
export const disconnectMetaAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    await revokeMetaAccess();
    return { ok: true };
  });

/** إرسال حدث Conversions API من الخادم */
export const sendMetaCapiEvent = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      event_name: string;
      event_id: string;
      event_source_url?: string;
      user_agent?: string;
      fbp?: string;
      fbc?: string;
      email?: string;
      phone?: string;
      custom_data?: Record<string, unknown>;
    }) => {
      const name = (input?.event_name ?? "").trim();
      if (!name) throw new Error("اسم الحدث مطلوب");
      return {
        event_name: name.slice(0, 60),
        event_id: (input.event_id ?? "").slice(0, 80),
        event_source_url: (input.event_source_url ?? "").slice(0, 500),
        user_agent: (input.user_agent ?? "").slice(0, 400),
        fbp: (input.fbp ?? "").slice(0, 200),
        fbc: (input.fbc ?? "").slice(0, 300),
        email: (input.email ?? "").trim().toLowerCase().slice(0, 200),
        phone: (input.phone ?? "").replace(/\D/g, "").slice(0, 20),
        custom_data: input.custom_data ?? {},
      };
    },
  )
  .handler(async ({ data }) => {
    const current = await getStoredMetaConfig();
    const pixelId = current.pixel_id;
    // نفضل capi_token، وإن لم يتوفر نستخدم user access token
    const token = current.capi_token || current.access_token;

    if (!pixelId || !token) {
      return {
        ok: false,
        message: "معرّف البيكسل (Pixel ID) أو رمز وصول Conversions API غير مضبوط",
      };
    }

    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      (getRequestHeader("x-forwarded-for") || "").split(",")[0]!.trim() ||
      getRequestHeader("x-real-ip") ||
      undefined;
    const ua = getRequestHeader("user-agent") || data.user_agent;
    const sha = async (v: string) => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    };
    const user_data: Record<string, unknown> = { client_user_agent: ua };
    if (ip) user_data["client_ip_address"] = ip;
    if (data.fbp) user_data["fbp"] = data.fbp;
    if (data.fbc) user_data["fbc"] = data.fbc;
    if (data.email) user_data["em"] = [await sha(data.email)];
    if (data.phone) user_data["ph"] = [await sha(data.phone)];

    const payload = {
      data: [
        {
          event_name: data.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: data.event_id,
          event_source_url: data.event_source_url,
          action_source: "website",
          user_data,
          custom_data: data.custom_data,
        },
      ],
      ...(current.test_event_code ? { test_event_code: current.test_event_code } : {}),
    };

    try {
      const res = await fetch(
        `${GRAPH_BASE}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        events_received?: number;
        error?: { message?: string };
      };

      if (json.error?.message) {
        return { ok: false, message: `خطأ Meta CAPI: ${json.error.message}` };
      }

      // تحديث حالة آخر إرسال
      current.last_capi_event_at = new Date().toISOString();
      current.last_capi_status = "active";
      await saveStoredMetaConfig(current);

      return {
        ok: true,
        message: `تم استلام الحدث بنجاح في Events Manager (${json.events_received ?? 1} حدث)`,
      };
    } catch {
      return { ok: false, message: "تعذر الاتصال بخوادم Meta Conversions API" };
    }
  });

/** فحص تشخيصي شامل لتكامل Meta */
export const runMetaDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const current = await getStoredMetaConfig();
    const creds = await getMetaAppCredentials();

    const results: {
      hasAppId: boolean;
      hasSecret: boolean;
      tokenValid: boolean;
      pixelConfigured: boolean;
      capiConfigured: boolean;
      pagesCount: number;
      adAccountsCount: number;
      issues: string[];
      recommendations: string[];
    } = {
      hasAppId: Boolean(creds.appId),
      hasSecret: Boolean(creds.appSecret),
      tokenValid: false,
      pixelConfigured: Boolean(current.pixel_id),
      capiConfigured: Boolean(current.capi_token || current.access_token),
      pagesCount: current.discovered_pages.length,
      adAccountsCount: current.discovered_ad_accounts.length,
      issues: [],
      recommendations: [],
    };

    if (!results.hasAppId) {
      results.issues.push("معرّف تطبيق Meta (App ID) غير مضبوط");
      results.recommendations.push("أنشئ تطبيقاً في developers.facebook.com ثم أدخل المعرّف هنا.");
    }

    if (!results.hasSecret) {
      results.issues.push("الرمز السري لتطبيق Meta (App Secret) غير مضبوط");
      results.recommendations.push("احصل على App Secret من لوحة Meta وضعها في إعدادات التطبيق.");
    }

    if (current.access_token) {
      try {
        const checkRes = await fetch(
          `${GRAPH_BASE}/me?fields=id,name&access_token=${encodeURIComponent(current.access_token)}`,
        );
        const checkData = (await checkRes.json().catch(() => ({}))) as {
          id?: string;
          error?: { message?: string };
        };
        if (checkData.id) {
          results.tokenValid = true;
        } else {
          results.issues.push(`رمز الوصول غير صالح أو منتهي: ${checkData.error?.message || ""}`);
          results.recommendations.push("اضغط على «إعادة التفويض» لتجديد الجلسة.");
        }
      } catch {
        results.issues.push("تعذر فحص رمز الوصول عبر الإنترنت");
      }
    } else {
      results.issues.push("الحساب غير متصل برمز وصول صالح");
    }

    if (!results.pixelConfigured) {
      results.issues.push("معرّف Meta Pixel مفقود");
      results.recommendations.push("أنشئ Pixel أو Dataset في Events Manager وأدخل المعرّف.");
    }

    return results;
  });

/** قائمة الحملات الإعلانية المخزنة */
export const getMetaAdminCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const raw = await readSettingRaw(CAMPAIGNS_KEY);
    return { value: raw };
  });

export const saveMetaAdminCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { value: string }) => {
    if (typeof input?.value !== "string") throw new Error("لا توجد بيانات للحفظ");
    return { value: input.value.slice(0, 500_000) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    await writeSettingRaw(CAMPAIGNS_KEY, data.value, "قائمة حملات Meta الإعلانية");
    return { ok: true };
  });

/** حفظ روابط متجر ميتا */
export const saveMetaShopLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { facebook_shop_url?: string; instagram_shop_url?: string }) => ({
    facebook_shop_url: (input?.facebook_shop_url ?? "").trim().slice(0, 500),
    instagram_shop_url: (input?.instagram_shop_url ?? "").trim().slice(0, 500),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("store_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    const payload = {
      meta_shop_url: data.facebook_shop_url || null,
      instagram_shop_url: data.instagram_shop_url || null,
      updated_at: new Date().toISOString(),
    };
    if (row?.id) {
      await supabaseAdmin.from("store_settings").update(payload).eq("id", row.id);
    }
    return { ok: true };
  });

/** تحديث صفحة فيسبوك بمعلومات المتجر الحالية */
export const syncMetaPageProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin?: string }) => ({
    origin: (input?.origin ?? "https://ehabstore.app").replace(/\/+$/, "").slice(0, 200),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const current = await getStoredMetaConfig();
    const token = current.access_token;
    const pageId = current.page_id;
    if (!token || !pageId) {
      return { ok: false, message: "اربط حساب Meta واختر الصفحة الرئيسية أولاً" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("store_settings")
      .select(
        "store_name,about,description,seo_description,logo,store_image,og_image,phone,email,address",
      )
      .limit(1)
      .maybeSingle();
    const settings = (s ?? {}) as Record<string, string | null>;

    const storeName = settings["store_name"] || "إيهاب ستور";
    const about = settings["about"] || settings["description"] || storeName;

    try {
      const page = current.discovered_pages.find((p) => p.id === pageId);
      const pageToken = page?.access_token || token;

      const res = await fetch(
        `${GRAPH_BASE}/${pageId}?access_token=${encodeURIComponent(pageToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            about: about.slice(0, 200),
            website: data.origin,
            description: `${about}\n${data.origin}`.slice(0, 4500),
          }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (json.error?.message) return { ok: false, message: `خطأ Meta: ${json.error.message}` };

      current.last_page_update_at = new Date().toISOString();
      await saveStoredMetaConfig(current);

      return { ok: true, message: `تم تحديث صفحة ${current.page_name || storeName} بنجاح` };
    } catch {
      return { ok: false, message: "تعذر الاتصال بخوادم Meta لتحديث الصفحة" };
    }
  });
