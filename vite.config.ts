// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  nitro: {
    preset: "node-server",
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("node_modules/recharts") ||
              id.includes("node_modules/d3-") ||
              id.includes("node_modules/victory-vendor")
            ) {
              return "vendor-charts";
            }
            if (id.includes("node_modules/leaflet")) {
              return "vendor-maps";
            }
            return undefined;
          },
        },
      },
    },
    plugins: [
      mcpPlugin(),
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        // Registration happens through src/lib/pwa.ts, which refuses to register
        // inside the Lovable preview iframe and in dev.
        injectRegister: null,
        filename: "sw.js",
        // The browser-facing bundle lives in dist/client; the SW must ship there.
        outDir: "dist/client",

        manifest: false,
        devOptions: { enabled: false },
        workbox: {
          globPatterns: ["**/*.{js,css,ico,png,svg,webp,woff2}"],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          // Never let the SW touch server routes, OAuth or the MCP endpoint.
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/mcp/, /^\/\./],
          runtimeCaching: [
            {
              // HTML navigations: try network first with short 2.5s timeout, fall back to cache offline immediately.
              urlPattern: ({ request, url }: { request: Request; url: URL }) =>
                request.mode === "navigate" &&
                !url.pathname.startsWith("/~oauth") &&
                !url.pathname.startsWith("/api/") &&
                !url.pathname.startsWith("/mcp") &&
                !url.pathname.startsWith("/."),
              handler: "NetworkFirst",
              options: {
                cacheName: "pages-v2",
                networkTimeoutSeconds: 2.5,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Media & Images (including Supabase Storage bucket URLs): CacheFirst
              urlPattern: ({ request, url }: { request: Request; url: URL }) =>
                request.destination === "image" ||
                request.destination === "font" ||
                (url.hostname.includes("supabase.co") && url.pathname.includes("/storage/v1/")),
              handler: "CacheFirst",
              options: {
                cacheName: "media-v2",
                expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Supabase REST catalog data queries: NetworkFirst with quick fallback for weak signals
              urlPattern: ({ url }: { url: URL }) =>
                url.hostname.includes("supabase.co") &&
                url.pathname.includes("/rest/v1/") &&
                (url.pathname.includes("products") ||
                  url.pathname.includes("categories") ||
                  url.pathname.includes("brands") ||
                  url.pathname.includes("product_categories") ||
                  url.pathname.includes("store_settings") ||
                  url.pathname.includes("site_settings")),
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-catalog-cache",
                networkTimeoutSeconds: 2,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 14 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // JavaScript and CSS bundles
              urlPattern: ({ request }: { request: Request }) =>
                request.destination === "script" || request.destination === "style",
              handler: "StaleWhileRevalidate",
              options: { cacheName: "assets-v2" },
            },
            {
              // Google Fonts
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
