import { createFileRoute } from "@tanstack/react-router";
import { buildPwaManifest, type PwaDisplayMode } from "@/lib/pwa";

export const Route = createFileRoute("/manifest.json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const modeParam = url.searchParams.get("mode") || url.searchParams.get("theme");
        const displayParam = (url.searchParams.get("display") as PwaDisplayMode) || "standalone";

        const isDark = modeParam === "dark";
        let storeName = "إيهاب ستور للعناية والتجميل";
        let description = "منتجات أصلية للعناية بالبشرة والشعر والمكياج والعطور";
        let logoUrl: string | null = null;
        let themeColor = isDark ? "#12161c" : "#c9a227";
        let bgColor = isDark ? "#0f172a" : "#ffffff";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Load store settings
          const { data: settings } = await supabaseAdmin
            .from("store_settings")
            .select("store_name, description, logo")
            .limit(1)
            .maybeSingle();

          if (settings) {
            if (settings.store_name) storeName = settings.store_name;
            if (settings.description) description = settings.description;
            if (settings.logo) logoUrl = settings.logo;
          }

          // Load active theme
          const { data: themes } = await supabaseAdmin
            .from("themes")
            .select("*")
            .order("sort_order");

          const activeTheme = themes?.find((t) => t.is_default) || themes?.[0];
          if (activeTheme) {
            if (!isDark) {
              themeColor = activeTheme.primary_color || "#c9a227";
              bgColor = activeTheme.background_color || "#ffffff";
            } else {
              themeColor = activeTheme.card_color || "#12161c";
              bgColor = "#0f172a";
            }
          }
        } catch {
          /* use fallback values */
        }

        const manifest = buildPwaManifest({
          name: storeName,
          short_name: storeName.length > 12 ? "إيهاب ستور" : storeName,
          description,
          logoUrl,
          display: displayParam,
          isDark,
          theme_color: themeColor,
          background_color: bgColor,
        });

        return new Response(JSON.stringify(manifest, null, 2), {
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
