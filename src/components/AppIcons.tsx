import { useEffect, useState } from "react";
import { useSettings, useSignedImages } from "@/lib/store";
import {
  getPwaDisplayPreference,
  getResolvedIsDark,
  registerServiceWorker,
  updateDynamicPwaManifest,
  type PwaDisplayMode,
} from "@/lib/pwa";
import { useActiveTheme } from "@/lib/theme";

function setLink(rel: string, href: string, type?: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-app-icon="1"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    el.dataset["appIcon"] = "1";
    document.head.appendChild(el);
  }
  if (type) el.type = type;
  if (el.href !== href) el.href = href;
}

function updateFavicon(href: string) {
  if (typeof document === "undefined") return;

  let type = "image/png";
  if (href.endsWith(".ico")) type = "image/x-icon";
  else if (href.endsWith(".svg")) type = "image/svg+xml";
  else if (href.includes(".webp")) type = "image/webp";

  setLink("icon", href, type);
  setLink("shortcut icon", href, type);
}

function updateAppleTouchIcon(href: string) {
  setLink("apple-touch-icon", href);
}

/**
 * The dashboard logo drives the browser tab icon, the iOS touch icon and the
 * PWA manifest icons. Dynamically updates manifest theme colors, background colors,
 * and display mode based on active theme, user dark/light preference, and system settings.
 */
export function AppIcons() {
  const { data: settings } = useSettings();
  const activeTheme = useActiveTheme();
  const logo = settings?.logo ?? null;
  const { data: urls } = useSignedImages(logo ? [logo] : []);
  const logoUrl = urls?.[0];
  const name = settings?.store_name ?? "إيهاب ستور للعناية والتجميل";
  const description =
    settings?.description ?? "منتجات أصلية للعناية بالبشرة والشعر والمكياج والعطور";

  const [isDark, setIsDark] = useState<boolean>(() => getResolvedIsDark());
  const [displayMode, setDisplayMode] = useState<PwaDisplayMode>(() => getPwaDisplayPreference());

  // Listen for dark/light mode switches, class mutations, system changes, and display mode changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkState = () => {
      setIsDark(getResolvedIsDark());
      setDisplayMode(getPwaDisplayPreference());
    };

    // 1. Observe class changes on <html> (.dark or .theme-dark)
    const observer = new MutationObserver(() => {
      checkState();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    // 2. Media query listener for OS-level theme switch
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handleMediaChange = () => checkState();
    mediaQuery?.addEventListener?.("change", handleMediaChange);

    // 3. Storage and custom event listeners
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "ehab-dark-mode" ||
        e.key === "ehab-pwa-display" ||
        e.key === "ehab-theme-mode" ||
        e.key === "ehab-active-theme"
      ) {
        checkState();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("pwa-config-changed", checkState);

    return () => {
      observer.disconnect();
      mediaQuery?.removeEventListener?.("change", handleMediaChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pwa-config-changed", checkState);
    };
  }, []);

  // Update favicon and Apple touch icon
  useEffect(() => {
    if (typeof document === "undefined") return;
    const icon = logoUrl ?? "/favicon.png";
    updateFavicon(icon);
    updateAppleTouchIcon(logoUrl ?? "/icon-192.png");
  }, [logoUrl]);

  // Dynamically generate and update the PWA manifest whenever dark mode, theme, or display mode changes
  useEffect(() => {
    if (typeof document === "undefined") return;

    // Determine target theme colors based on mode
    let targetThemeColor = activeTheme?.primary_color || "#c9a227";
    let targetBgColor = activeTheme?.background_color || "#ffffff";

    if (isDark) {
      targetThemeColor = activeTheme?.card_color || "#12161c";
      targetBgColor = "#0f172a";
    }

    updateDynamicPwaManifest({
      name,
      short_name: name.length > 12 ? "إيهاب ستور" : name,
      description,
      display: displayMode,
      theme_color: targetThemeColor,
      background_color: targetBgColor,
      logoUrl: logoUrl ?? null,
      isDark,
    });
  }, [name, description, logoUrl, activeTheme, isDark, displayMode]);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
