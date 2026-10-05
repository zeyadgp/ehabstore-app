/**
 * Facebook Business Extension (FBE)
 * تسجيل دخول تلقائي بحساب فيسبوك للأعمال للحصول على رمز الوصول
 * دون الحاجة لنسخ التوكن يدوياً.
 */

declare global {
  interface Window {
    FB?: {
      init: (opts: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        cb: (res: { status?: string; authResponse?: { accessToken?: string } | null }) => void,
        opts: { scope: string; return_scopes?: boolean; extras?: Record<string, unknown> },
      ) => void;
      logout?: (cb: () => void) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export const FBE_SCOPES = [
  "public_profile",
  "email",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "ads_management",
  "ads_read",
  "catalog_management",
  "instagram_basic",
].join(",");

const SDK_SCRIPT_ID = "facebook-jssdk";
const GRAPH_VERSION = "v21.0";

let sdkPromise: Promise<void> | null = null;

/** تحميل حزمة فيسبوك في المتصفح مرة واحدة فقط */
export function loadFacebookSdk(appId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("المتصفح فقط"));
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const finish = () => {
      try {
        window.FB?.init({ appId, cookie: true, xfbml: false, version: GRAPH_VERSION });
        resolve();
      } catch {
        reject(new Error("تعذر تهيئة تطبيق فيسبوك، تأكدي من معرّف التطبيق"));
      }
    };

    if (window.FB) {
      finish();
      return;
    }

    window.fbAsyncInit = finish;

    if (document.getElementById(SDK_SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = SDK_SCRIPT_ID;
    script.src = "https://connect.facebook.net/ar_AR/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("تعذر تحميل نافذة فيسبوك، تحققي من اتصال الإنترنت"));
    };
    document.body.appendChild(script);
  });

  return sdkPromise;
}

/** فتح نافذة تسجيل الدخول بفيسبوك وإرجاع رمز الوصول */
export async function loginWithFacebookBusiness(
  appId: string,
): Promise<{ token?: string; error?: string }> {
  const id = (appId || "").trim();
  if (!/^\d{8,}$/.test(id)) {
    return { error: "أدخل معرّف تطبيق فيسبوك (App ID) الصحيح أولاً" };
  }

  try {
    await loadFacebookSdk(id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذر فتح نافذة فيسبوك" };
  }

  return new Promise((resolve) => {
    if (!window.FB) {
      resolve({ error: "تعذر فتح نافذة فيسبوك" });
      return;
    }
    window.FB.login(
      (res) => {
        const token = res?.authResponse?.accessToken;
        if (token) resolve({ token });
        else resolve({ error: "تم إلغاء تسجيل الدخول أو رُفضت الصلاحيات المطلوبة" });
      },
      { scope: FBE_SCOPES, return_scopes: true },
    );
  });
}
