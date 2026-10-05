import {
  Home,
  Heart,
  LayoutGrid,
  Search,
  ShoppingBag,
  Store,
  UserRound,
  MessageCircle,
  Truck,
  Scale,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { useCompare } from "@/lib/compare";
import type { NavKey } from "@/lib/theme";

export type NavEntry = {
  key: NavKey;
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  search?: Record<string, string>;
  badge: number;
};

export const NAV_LABELS: Record<NavKey, string> = {
  home: "الرئيسية",
  search: "البحث",
  categories: "الأقسام",
  cart: "السلة",
  account: "الحساب",
  favorites: "قائمة الأمنيات",
  products: "المتجر",
  contact: "تواصل",
  orders: "طلباتي",
  compare: "المقارنة",
};

/** Builds the navigation entries in the order the active theme defines. */
export function useNavEntries(keys: NavKey[]): NavEntry[] {
  const { count } = useCart();
  const { ids } = useFavorites();
  const compareIds = useCompare();

  const all: Record<NavKey, NavEntry> = {
    home: { key: "home", to: "/", label: NAV_LABELS.home, icon: Home, badge: 0 },
    search: {
      key: "search",
      to: "/products",
      label: NAV_LABELS.search,
      icon: Search,
      search: { filter: "1" },
      badge: 0,
    },
    categories: {
      key: "categories",
      to: "/categories",
      label: NAV_LABELS.categories,
      icon: LayoutGrid,
      badge: 0,
    },
    cart: { key: "cart", to: "/cart", label: NAV_LABELS.cart, icon: ShoppingBag, badge: count },
    compare: {
      key: "compare",
      to: "/compare",
      label: NAV_LABELS.compare,
      icon: Scale,
      badge: compareIds.length,
    },
    account: {
      key: "account",
      to: "/account",
      label: NAV_LABELS.account,
      icon: UserRound,
      badge: 0,
    },
    favorites: {
      key: "favorites",
      to: "/favorites",
      label: NAV_LABELS.favorites,
      icon: Heart,
      badge: ids.length,
    },
    products: {
      key: "products",
      to: "/products",
      label: NAV_LABELS.products,
      icon: Store,
      badge: 0,
    },
    contact: {
      key: "contact",
      to: "/contact",
      label: NAV_LABELS.contact,
      icon: MessageCircle,
      badge: 0,
    },
    orders: { key: "orders", to: "/orders", label: NAV_LABELS.orders, icon: Truck, badge: 0 },
  };

  return keys.map((k) => all[k]).filter(Boolean);
}
