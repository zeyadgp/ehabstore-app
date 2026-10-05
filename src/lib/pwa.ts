/**
 * Progressive Web App (PWA) configuration and dynamic manifest management.
 *
 * Dynamically synchronizes the PWA Web App Manifest, theme color, background color,
 * and display mode based on user/system dark or light mode preferences and theme changes.
 */

export type PwaDisplayMode = "standalone" | "fullscreen" | "minimal-ui" | "browser";
export type PwaThemeMode = "light" | "dark" | "system";

export interface PwaManifestConfig {
  id?: string;
  name?: string;
  short_name?: string;
  description?: string;
  start_url?: string;
  scope?: string;
  display?: PwaDisplayMode;
  orientation?: "portrait" | "landscape" | "any";
  theme_color?: string;
  background_color?: string;
  logoUrl?: string | null;
  icons?: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }>;
}

export const PWA_DISPLAY_KEY = "ehab-pwa-display";
export const PWA_THEME_MODE_KEY = "ehab-theme-mode";
export const DARK_MODE_KEY = "ehab-dark-mode";

let currentManifestBlobUrl: string | null = null;

/**
 * Single guarded service-worker registration.
 *
 * The SW is only registered on the real published site: never in dev, never in
 * the Lovable preview (which runs the app inside an iframe on a *.lovable.app
 * preview host), and never when the browser has no SW support.
 */
function isPreviewSurface(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  const framed = window.parent && window.parent !== window;
  const previewHost =
    host.includes("lovableproject.com") ||
    host.includes("lovable.dev") ||
    host.includes("gptengineer") ||
    /(^|\.)id-preview/.test(host) ||
    host.endsWith("-dev.lovable.app") ||
    host === "localhost" ||
    host === "127.0.0.1";
  return Boolean(framed) || previewHost;
}

/**
 * Clears old, unused caches during the PWA service worker update process
 * to keep the user's local storage clean.
 */
async function clearOldCaches() {
  if (typeof caches === "undefined") return;
  const validPrefixes = [
    "pages",
    "media",
    "assets",
    "workbox",
    "ehab-store",
    "supabase-catalog",
    "google-fonts",
  ];
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.map(async (key) => {
        const isValid = validPrefixes.some((prefix) => key.includes(prefix));
        if (!isValid || key.includes("old-") || key.includes("v1-")) {
          await caches.delete(key);
        }
      }),
    );
  } catch {
    /* ignore cache clearance errors */
  }
}

async function unregisterAll() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
  await clearOldCaches();
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (import.meta.env.DEV || isPreviewSurface()) {
    void unregisterAll().catch(() => {});
    return;
  }

  const start = () => {
    void (async () => {
      try {
        await clearOldCaches();
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        /* offline or unsupported — nothing to do */
      }
    })();
  };

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

/**
 * Gets user preference for PWA display mode ("standalone" | "fullscreen" | "minimal-ui" | "browser")
 */
export function getPwaDisplayPreference(): PwaDisplayMode {
  if (typeof window === "undefined") return "standalone";
  try {
    const stored = localStorage.getItem(PWA_DISPLAY_KEY);
    if (
      stored === "fullscreen" ||
      stored === "minimal-ui" ||
      stored === "browser" ||
      stored === "standalone"
    ) {
      return stored;
    }
  } catch {
    /* storage inaccessible */
  }
  return "standalone";
}

/**
 * Sets and saves user preference for PWA display mode
 */
export function setPwaDisplayPreference(mode: PwaDisplayMode) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PWA_DISPLAY_KEY, mode);
    window.dispatchEvent(new CustomEvent("pwa-config-changed", { detail: { display: mode } }));
  } catch {
    /* storage inaccessible */
  }
}

/**
 * Checks if dark mode is currently active based on DOM classes, localStorage, or system media query
 */
export function getResolvedIsDark(): boolean {
  if (typeof window === "undefined") return false;
  if (
    document.documentElement.classList.contains("dark") ||
    document.documentElement.classList.contains("theme-dark")
  ) {
    return true;
  }
  try {
    const darkStored = localStorage.getItem(DARK_MODE_KEY);
    if (darkStored !== null) return darkStored === "true";
    const modeStored = localStorage.getItem(PWA_THEME_MODE_KEY);
    if (modeStored === "dark") return true;
    if (modeStored === "light") return false;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/**
 * Resolves optimal PWA theme color and splash background color based on active dark/light preference
 */
export function resolvePwaColors(
  isDark: boolean,
  customThemeColor?: string,
  customBgColor?: string,
) {
  if (isDark) {
    return {
      themeColor: customThemeColor || "#12161c",
      backgroundColor: customBgColor || "#0f172a",
    };
  }
  return {
    themeColor: customThemeColor || "#c9a227",
    backgroundColor: customBgColor || "#ffffff",
  };
}

/**
 * Builds a compliant W3C Web App Manifest object
 */
export function buildPwaManifest(config: PwaManifestConfig & { isDark?: boolean }) {
  const isDark = config.isDark ?? getResolvedIsDark();
  const colors = resolvePwaColors(isDark, config.theme_color, config.background_color);
  const display = config.display || getPwaDisplayPreference();
  const name = config.name || "إيهاب ستور للعناية والتجميل";
  const shortName = config.short_name || (name.length > 12 ? "إيهاب ستور" : name);

  const defaultIcons = [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];

  const logoIcons = config.logoUrl
    ? [
        { src: config.logoUrl, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: config.logoUrl, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: config.logoUrl, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ]
    : defaultIcons;

  return {
    id: config.id || "/",
    name,
    short_name: shortName,
    description: config.description || "منتجات أصلية للعناية بالبشرة والشعر والمكياج والعطور",
    lang: "ar",
    dir: "rtl",
    start_url: config.start_url || "/",
    scope: config.scope || "/",
    display,
    orientation: config.orientation || "portrait",
    background_color: colors.backgroundColor,
    theme_color: colors.themeColor,
    icons: config.icons || logoIcons,
  };
}

/**
 * Updates DOM head elements (link[rel="manifest"], meta[name="theme-color"], and status bar)
 * dynamically whenever dark/light mode or display configuration changes.
 */
export function updateDynamicPwaManifest(config: PwaManifestConfig & { isDark?: boolean }) {
  if (typeof document === "undefined") return;

  const isDark = config.isDark ?? getResolvedIsDark();
  const manifestObj = buildPwaManifest({ ...config, isDark });

  // 1. Update <meta name="theme-color">
  let themeColorMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]:not([media])',
  );
  if (!themeColorMeta) {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.name = "theme-color";
    document.head.appendChild(themeColorMeta);
  }
  themeColorMeta.content = manifestObj.theme_color;

  // 2. Update apple status bar style for iOS
  let statusBarMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-status-bar-style"]',
  );
  if (!statusBarMeta) {
    statusBarMeta = document.createElement("meta");
    statusBarMeta.name = "apple-mobile-web-app-status-bar-style";
    document.head.appendChild(statusBarMeta);
  }
  statusBarMeta.content = isDark ? "black-translucent" : "default";

  // 3. Create blob URL and update <link rel="manifest">
  try {
    const jsonStr = JSON.stringify(manifestObj, null, 2);
    const blob = new Blob([jsonStr], { type: "application/manifest+json" });
    const newUrl = URL.createObjectURL(blob);

    const existingManifestLinks =
      document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]');
    if (existingManifestLinks.length > 0) {
      // نحدّث الروابط الموجودة فقط — حذفها يكسر شجرة React لأنها مُدارة من الجذر.
      existingManifestLinks.forEach((link) => {
        link.href = newUrl;
      });
    } else {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = newUrl;
      document.head.appendChild(link);
    }

    if (currentManifestBlobUrl) {
      URL.revokeObjectURL(currentManifestBlobUrl);
    }
    currentManifestBlobUrl = newUrl;

    window.dispatchEvent(
      new CustomEvent("pwa-manifest-updated", {
        detail: {
          manifest: manifestObj,
          isDark,
          themeColor: manifestObj.theme_color,
          display: manifestObj.display,
        },
      }),
    );
  } catch {
    /* ignore blob creation error */
  }
}
