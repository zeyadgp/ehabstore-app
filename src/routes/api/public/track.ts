import { createFileRoute } from "@tanstack/react-router";

/** يسجل زيارة صفحة: الدولة من ترويسة الشبكة ونوع الجهاز من المتصفح */
export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            path?: string;
            referrer?: string;
            sessionId?: string;
          } | null;
          const path = (body?.path ?? "").slice(0, 300);
          if (!path || path.startsWith("/admin")) {
            return new Response("skipped", { status: 200 });
          }

          const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
          const device = /tablet|ipad/.test(ua)
            ? "تابلت"
            : /mobile|android|iphone|ipod/.test(ua)
              ? "جوال"
              : "كمبيوتر";
          const countryHeader =
            request.headers.get("cf-ipcountry") ?? request.headers.get("x-country-code") ?? "";
          const country = /^[A-Z]{2}$/.test(countryHeader) ? countryHeader : null;

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("page_views").insert({
            path,
            referrer: (body?.referrer ?? "").slice(0, 500) || null,
            session_id: (body?.sessionId ?? "").slice(0, 64) || null,
            country,
            device,
          });
          return new Response("ok", { status: 200 });
        } catch {
          return new Response("ok", { status: 200 });
        }
      },
    },
  },
});
