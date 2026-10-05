import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useNavEntries } from "@/lib/nav-items";
import { DEFAULT_NAV, useActiveTheme, type NavKey } from "@/lib/theme";

const SMART_REPLACEMENTS: Record<NavKey, NavKey[]> = {
  home: ["products", "search", "account"],
  categories: ["search", "products", "account"],
  orders: ["account", "products", "cart"],
  compare: ["cart", "products", "account"],
  favorites: ["account", "products", "search"],
  products: ["search", "account", "contact"],
  search: ["products", "account", "contact"],
  cart: ["products", "account", "contact"],
  account: ["products", "search", "contact"],
  contact: ["account", "products", "search"],
};

function isCurrentPage(key: NavKey, pathname: string) {
  if (key === "home") return pathname === "/";
  if (key === "products" || key === "search") {
    return pathname === "/products" || pathname.startsWith("/product/");
  }
  if (key === "account") {
    return pathname === "/account" || pathname === "/auth" || pathname === "/loyalty";
  }
  if (key === "cart") return pathname === "/cart" || pathname === "/checkout";
  return pathname === `/${key}` || pathname.startsWith(`/${key}/`);
}

/**
 * Fixed icon navigation. Order, position and shape all come from the
 * active theme, so the dashboard can redesign it without code changes.
 */
export function AppNav() {
  const activeTheme = useActiveTheme();
  // The theme only applies after hydration so server and client render the same first pass.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const theme = hydrated ? activeTheme : null;
  // «طلباتي» زر ثابت، والسلة تم استبدالها بالمقارنة، والحساب بقائمة الأمنيات.
  const rawConfigured = theme?.nav_items?.length ? theme.nav_items : DEFAULT_NAV;
  const configured = rawConfigured.map((k) =>
    k === "cart" ? "compare" : k === "account" ? "favorites" : k,
  );
  const navKeysWithOrders = configured.includes("orders")
    ? configured
    : ([...configured.slice(0, 1), "orders", ...configured.slice(1)] as typeof configured);
  const baseNavKeys = navKeysWithOrders.includes("compare")
    ? navKeysWithOrders
    : ([
        ...navKeysWithOrders.slice(0, 3),
        "compare",
        ...navKeysWithOrders.slice(3),
      ] as typeof configured);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const uniqueBaseKeys = [...new Set(baseNavKeys)] as NavKey[];
  const activeKey = uniqueBaseKeys.find((key) => isCurrentPage(key, pathname));
  const visibleKeys = activeKey
    ? uniqueBaseKeys.filter((key) => key !== activeKey)
    : uniqueBaseKeys;
  if (activeKey) {
    const replacement = SMART_REPLACEMENTS[activeKey].find(
      (key) => !visibleKeys.includes(key) && !isCurrentPage(key, pathname),
    );
    if (replacement) visibleKeys.push(replacement);
  }
  const entries = useNavEntries(visibleKeys);

  if (pathname.startsWith("/admin")) return null;

  const position = theme?.nav_position ?? "bottom";
  const style = theme?.nav_style ?? "pill";
  const labels = theme?.show_labels !== false;

  const shape =
    style === "round" ? "rounded-full" : style === "flat" ? "rounded-lg" : "rounded-2xl";

  const shell =
    position === "top"
      ? "fixed inset-x-0 top-[64px] z-40 md:top-[80px]"
      : position === "floating"
        ? "fixed inset-x-0 bottom-4 z-40 px-4"
        : "fixed inset-x-0 bottom-0 z-40";

  const box =
    position === "floating"
      ? "mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-[28px] border border-border bg-card p-2 shadow-lift"
      : "mx-auto flex max-w-2xl items-stretch justify-between gap-1 border-t border-border bg-card px-2 py-1.5 md:mb-3 md:rounded-[26px] md:border md:shadow-lift";

  return (
    <nav aria-label="التنقل السريع" className={`${shell} pb-[env(safe-area-inset-bottom)]`}>
      <div className={box}>
        {entries.map((item) => {
          return (
            <Link
              key={item.key}
              to={item.to}
              search={item.search as never}
              aria-label={item.label}
              className="group flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-transform active:scale-95"
            >
              <span
                className={`relative flex h-10 w-10 items-center justify-center ${shape} bg-secondary/70 text-muted-foreground transition-all duration-200 group-hover:bg-secondary group-hover:text-primary`}
              >
                <item.icon className="h-[19px] w-[19px] transition-transform group-hover:scale-110" />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[10px] font-extrabold tabular-nums text-white shadow-soft">
                    {item.badge}
                  </span>
                )}
              </span>
              {labels && (
                <span className="whitespace-nowrap text-[10px] font-bold leading-none text-muted-foreground transition-colors group-hover:text-primary">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
