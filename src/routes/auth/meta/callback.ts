import { createFileRoute } from "@tanstack/react-router";
import {
  consumeMetaOAuthState,
  exchangeCodeForTokens,
  fetchLiveMetaAssets,
  getStoredMetaConfig,
  saveStoredMetaConfig,
} from "@/lib/meta/server";
import type { MetaConfig, MetaConnectionStatus } from "@/lib/meta/types";

function renderHtmlResponse(status: "success" | "error", message: string) {
  const isSuccess = status === "success";
  const postMsgType = isSuccess ? "META_AUTH_SUCCESS" : "META_AUTH_ERROR";
  const safeMessage = JSON.stringify(String(message)).slice(1, -1).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  const htmlMessage = String(message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  return new Response(
    `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isSuccess ? "تم التفويض بنجاح" : "تعذر إكمال التفويض"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0f172a;
      color: #f8fafc;
      text-align: center;
      padding: 1.5rem;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      padding: 2.25rem 2rem;
      border-radius: 1.5rem;
      border: 1px solid ${isSuccess ? "#10b981" : "#ef4444"};
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .icon { font-size: 42px; margin-bottom: 0.75rem; }
    h2 { margin: 0 0 0.5rem; font-size: 1.25rem; color: ${isSuccess ? "#34d399" : "#f87171"}; }
    p { margin: 0; font-size: 0.875rem; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? "✓" : "⚠️"}</div>
    <h2>${isSuccess ? "تم الاتصال بحساب Meta بنجاح!" : "فشل الاتصال بـ Meta"}</h2>
    <p>${htmlMessage}</p>
  </div>
  <script>
    (function() {
      try {
        if (window.opener) {
          window.opener.postMessage({ type: "${postMsgType}", message: "${safeMessage}" }, window.location.origin);
          setTimeout(function() { window.close(); }, 800);
        } else {
          setTimeout(function() { window.location.href = "/admin/meta"; }, 1500);
        }
      } catch (err) {
        window.location.href = "/admin/meta";
      }
    })();
  </script>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/auth/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDescription =
          url.searchParams.get("error_description") || url.searchParams.get("error_reason");

        if (error) {
          return renderHtmlResponse(
            "error",
            errorDescription || "قام المستخدم بإلغاء التفويض أو رفض الصلاحيات المطلوبة.",
          );
        }

        if (!code) {
          return renderHtmlResponse("error", "رمز التفويض (Authorization Code) مفقود من الطلب.");
        }

        if (!(await consumeMetaOAuthState(url.searchParams.get("state")))) {
          return renderHtmlResponse(
            "error",
            "طلب الربط غير صالح أو منتهي. ابدأ الربط من لوحة التحكم.",
          );
        }

        try {
          const origin = url.origin;
          const redirectUri = `${origin}/auth/meta/callback`;

          const { accessToken, expiresIn } = await exchangeCodeForTokens(code, redirectUri);
          const assets = await fetchLiveMetaAssets(accessToken);

          const essentialPermissions = ["pages_show_list", "public_profile"];
          const granted = new Set(
            assets.permissions.filter((p) => p.status === "granted").map((p) => p.permission),
          );
          const missingEssential = essentialPermissions.some((ep) => !granted.has(ep));

          const status: MetaConnectionStatus = missingEssential
            ? "insufficient_permissions"
            : "connected";

          const currentConfig = await getStoredMetaConfig();
          const firstPage = assets.pages[0] || null;
          const firstAdAccount = assets.adAccounts[0] || null;
          const firstBiz = assets.businesses[0] || null;

          const updatedConfig: MetaConfig = {
            ...currentConfig,
            connected: true,
            connected_at: new Date().toISOString(),
            status,
            status_message: missingEssential
              ? "تم الاتصال ولكن هناك صلاحيات ناقصة قد تمنع بعض الميزات."
              : "تم الاتصال بحساب Meta بنجاح وجلب كافة الأصول والصفحات.",
            access_token: accessToken,
            token_expires_at: expiresIn
              ? new Date(Date.now() + expiresIn * 1000).toISOString()
              : null,
            user: assets.user,
            discovered_pages: assets.pages,
            discovered_ad_accounts: assets.adAccounts,
            discovered_businesses: assets.businesses,
            permissions: assets.permissions,
            page_id: currentConfig.page_id || firstPage?.id || null,
            page_name: currentConfig.page_name || firstPage?.name || null,
            page_picture: currentConfig.page_picture || firstPage?.picture_url || null,
            instagram_id: currentConfig.instagram_id || firstPage?.instagram_account?.id || null,
            instagram_username:
              currentConfig.instagram_username || firstPage?.instagram_account?.username || null,
            instagram_picture:
              currentConfig.instagram_picture ||
              firstPage?.instagram_account?.profile_picture_url ||
              null,
            ad_account_id: currentConfig.ad_account_id || firstAdAccount?.id || null,
            ad_account_name: currentConfig.ad_account_name || firstAdAccount?.name || null,
            ad_account_currency:
              firstAdAccount?.currency || currentConfig.ad_account_currency || "USD",
            business_id: currentConfig.business_id || firstBiz?.id || null,
            business_name: currentConfig.business_name || firstBiz?.name || null,
            last_sync_at: new Date().toISOString(),
          };

          await saveStoredMetaConfig(updatedConfig);

          return renderHtmlResponse(
            "success",
            `أهلاً ${assets.user.name}، تم ربط حسابك وجلب ${assets.pages.length} صفحة و ${assets.adAccounts.length} حساب إعلاني بنجاح.`,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء معالجة التفويض";
          return renderHtmlResponse("error", msg);
        }
      },
    },
  },
});
