import { useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type NavKey =
  | "home"
  | "search"
  | "categories"
  | "cart"
  | "account"
  | "favorites"
  | "products"
  | "contact"
  | "orders"
  | "compare";

export type Theme = {
  id: string;
  name: string;
  is_default: boolean;
  primary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
  card_color: string;
  radius: string;
  nav_position: "bottom" | "floating" | "top";
  nav_style: "pill" | "round" | "flat";
  show_labels: boolean;
  nav_items: NavKey[];
  sort_order: number;
  thumbnail?: string | null;
};

export const DEFAULT_NAV: NavKey[] = ["home", "orders", "categories", "compare", "favorites"];

export async function fetchThemes(): Promise<Theme[]> {
  const { data } = await supabase.from("themes").select("*").order("sort_order");
  return ((data as unknown as Theme[] | null) ?? []).map((t) => ({
    ...t,
    nav_items: Array.isArray(t.nav_items) ? (t.nav_items as NavKey[]) : DEFAULT_NAV,
  }));
}

export const themesQuery = {
  queryKey: ["themes"],
  queryFn: fetchThemes,
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
};

export function useThemes() {
  return useQuery(themesQuery);
}

/** The theme marked as default drives the whole storefront look. */
export function useActiveTheme(): Theme | null {
  const { data = [] } = useThemes();
  return data.find((t) => t.is_default) ?? data[0] ?? null;
}

export function useInvalidateThemes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["themes"] });
}

/** True when the theme background is dark (so text/surfaces must flip). */
function isDark(color: string) {
  const m = color.match(/oklch\(\s*([0-9.]+)/i);
  if (m) return Number(m[1]) < 0.5;
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1] as string, 16);
    const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    return lum < 0.5;
  }
  return false;
}

/** All CSS custom properties a theme controls — shared by SSR and the client. */
export function themeVars(theme: Theme): Record<string, string> {
  const bg = theme.background_color;
  const fg = theme.foreground_color;
  const pc = theme.primary_color;
  const ac = theme.accent_color;
  const primaryDark = isDark(pc);
  return {
    "--primary": pc,
    "--primary-foreground": primaryDark ? "oklch(0.99 0.003 85)" : "oklch(0.18 0.02 280)",
    "--ring": pc,
    "--gold": pc,
    "--gold-soft": `color-mix(in oklab, ${pc} 22%, ${bg})`,
    "--accent": `color-mix(in oklab, ${ac} 35%, ${bg})`,
    "--accent-foreground": fg,
    "--rose": ac,
    "--rose-soft": `color-mix(in oklab, ${ac} 18%, ${bg})`,
    "--secondary": `color-mix(in oklab, ${ac} 22%, ${bg})`,
    "--secondary-foreground": fg,
    "--muted": `color-mix(in oklab, ${fg} 7%, ${bg})`,
    "--muted-foreground": `color-mix(in oklab, ${fg} 62%, ${bg})`,
    "--border": `color-mix(in oklab, ${fg} 14%, ${bg})`,
    "--input": `color-mix(in oklab, ${fg} 14%, ${bg})`,
    "--background": bg,
    "--foreground": fg,
    "--card": theme.card_color,
    "--card-foreground": fg,
    "--popover": theme.card_color,
    "--popover-foreground": fg,
    "--sidebar": theme.card_color,
    "--sidebar-foreground": fg,
    "--sidebar-primary": pc,
    "--sidebar-accent": `color-mix(in oklab, ${ac} 25%, ${bg})`,
    "--sidebar-accent-foreground": fg,
    "--sidebar-border": `color-mix(in oklab, ${fg} 14%, ${bg})`,
    "--radius": theme.radius,
    "--gradient-gold": `linear-gradient(135deg, ${pc}, ${ac})`,
    "--gradient-soft": `linear-gradient(160deg, ${bg}, color-mix(in oklab, ${ac} 18%, ${bg}))`,
  };
}

/**
 * Server-rendered stylesheet for the active theme.
 * Doubling `:root` beats the default palette in styles.css, so the first paint
 * already uses the selected theme — no gold flash before hydration.
 */
export function themeCss(theme: Theme): string {
  const body = Object.entries(themeVars(theme))
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `:root:root{${body}}`;
}

/** Applies theme colours as CSS variables on <html> (used live and for preview). */
export function applyThemeVars(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(theme))) root.style.setProperty(k, v);
  root.classList.toggle("theme-dark", isDark(theme.background_color));
  const chosenMode = localStorage.getItem("ehab-dark-mode");
  if (chosenMode !== null) root.classList.toggle("dark", chosenMode === "true");
}
export const THEME_CACHE_KEY = "ehab-active-theme";

/** Persists the active theme so the next visit paints instantly, before the DB responds. */
export function cacheTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(theme));
  } catch {
    /* storage unavailable */
  }
}

export function readCachedTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(THEME_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Theme) : null;
  } catch {
    return null;
  }
}

/** Applies a theme immediately, skipping the colour transition (used on first paint). */
export function applyThemeInstantly(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-switching-off");
  applyThemeVars(theme);
  requestAnimationFrame(() => root.classList.remove("theme-switching-off"));
}

/** Applies the active theme colours as CSS variables on <html>. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useActiveTheme();

  useEffect(() => {
    if (!theme) return;
    applyThemeVars(theme);
    cacheTheme(theme);
  }, [theme]);

  return <>{children}</>;
}
