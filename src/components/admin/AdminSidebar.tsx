import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BellRing,
  Boxes,
  Sparkles,
  Building2,
  CreditCard,
  Database,
  FileSpreadsheet,
  FileText,
  Gift,
  Globe,
  Layers,
  LayoutGrid,
  LogOut,
  Megaphone,
  Package,
  Palette,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Heart,
  Target,
  Ticket,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Coins,
  ChevronLeft,
  X,
  ExternalLink,
  Cloud,
} from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { useOrderAlerts } from "@/lib/order-alerts";

import { useAdmin } from "@/hooks/useAdmin";
import { useAdminNavigation } from "@/lib/admin-navigation";

export type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: number | string | undefined;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export function getAdminNavGroups(
  unreadOrdersCount: number,
  isRestrictedStaff = false,
): NavGroup[] {
  if (isRestrictedStaff) {
    return [
      {
        title: "الطلبات والمنتجات",
        items: [
          {
            to: "/admin/orders",
            label: "الطلبات",
            icon: ShoppingBag,
            badge: unreadOrdersCount > 0 ? unreadOrdersCount : undefined,
          },
          { to: "/admin/products", label: "المنتجات", icon: Package },
        ],
      },
      {
        title: "الإعدادات والخدمات المتاحة",
        items: [
          { to: "/admin/delivery", label: "مناطق التوصيل", icon: Truck },
          { to: "/admin/payments", label: "طرق الدفع", icon: CreditCard },
          { to: "/admin/content", label: "الآراء والمحتوى", icon: FileText },
          { to: "/admin/reviews", label: "إدارة المراجعات", icon: Heart },
          { to: "/admin/currencies", label: "العملات والصرف", icon: Coins },
        ],
      },
    ];
  }

  return [
    {
      title: "الرئيسية والمبيعات",
      items: [
        { to: "/admin", label: "الرئيسية", icon: BarChart3, exact: true },
        {
          to: "/admin/orders",
          label: "الطلبات",
          icon: ShoppingBag,
          badge: unreadOrdersCount > 0 ? unreadOrdersCount : undefined,
        },
        { to: "/admin/profits", label: "الأرباح والمحاسبة", icon: TrendingUp },
        { to: "/admin/invoices", label: "الفواتير وسندات القبض", icon: Receipt },
        { to: "/admin/abandoned-carts", label: "السلات المتروكة", icon: ShoppingCart },
        { to: "/admin/customers", label: "العملاء", icon: Users },
      ],
    },
    {
      title: "الكتالوج والمخزون",
      items: [
        { to: "/admin/products", label: "المنتجات", icon: Package },
        { to: "/admin/categories", label: "التصنيفات", icon: LayoutGrid },
        { to: "/admin/inventory", label: "إدارة المخزون", icon: Boxes },
        { to: "/admin/bulk-editor", label: "التعديل الجماعي", icon: FileSpreadsheet },
        { to: "/admin/suppliers", label: "الموردون والتكاليف", icon: Building2 },
        { to: "/admin/ai-copy", label: "كاتب الوصف الذكي", icon: Sparkles },
      ],
    },
    {
      title: "التسويق والإعلانات",
      items: [
        { to: "/admin/meta", label: "Meta Pixel & CAPI", icon: Globe },
        { to: "/admin/ads", label: "الحملات الإعلانية", icon: Target },
        { to: "/admin/coupons", label: "الكوبونات والخصومات", icon: Ticket },
        { to: "/admin/banners", label: "العروض والبانرات", icon: Megaphone },
        { to: "/admin/loyalty", label: "برنامج الولاء", icon: Gift },
        { to: "/admin/influencers", label: "إدارة المؤثرين", icon: Users },
        { to: "/admin/content", label: "الآراء والمحتوى", icon: FileText },
        { to: "/admin/reviews", label: "إدارة المراجعات", icon: Heart },
        { to: "/admin/notifications", label: "إشعارات الويب", icon: BellRing },
      ],
    },
    {
      title: "الإعدادات والنظام",
      items: [
        { to: "/admin/site-settings", label: "إعدادات المتجر", icon: SlidersHorizontal },
        { to: "/admin/appearance", label: "المظهر والواجهة", icon: Palette },
        { to: "/admin/payments", label: "طرق الدفع", icon: CreditCard },
        { to: "/admin/delivery", label: "مناطق التوصيل", icon: Truck },
        { to: "/admin/currencies", label: "العملات والصرف", icon: Coins },
        { to: "/admin/data", label: "النسخ والاستيراد", icon: Database },
        { to: "/admin/google-drive", label: "مزامنة Google Drive", icon: Cloud },
        { to: "/admin/users", label: "المستخدمون والصلاحيات", icon: UserCog },
      ],
    },
  ];
}

type AdminSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  logo?: string | undefined;
  storeName?: string | undefined;
  email?: string | undefined;
  onSignOut: () => void;
};

export function AdminSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  logo,
  storeName = "إيهاب ستور",
  email,
  onSignOut,
}: AdminSidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isRestrictedStaff } = useAdmin();
  const { count: unreadCount } = useOrderAlerts();
  const { config } = useAdminNavigation();
  const navGroups = getAdminNavGroups(unreadCount, isRestrictedStaff)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !config[item.to]?.hidden),
    }))
    .filter((group) => group.items.length > 0);

  const renderNavContent = (isMobileView = false) => {
    const isMini = collapsed && !isMobileView;

    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* Top: Logo & Branding */}
        <div
          className={`shrink-0 flex items-center gap-3 border-b border-border/80 px-4 py-3.5 transition-all ${
            isMini ? "justify-center px-2" : ""
          }`}
        >
          <div className="relative shrink-0">
            <SmartImage
              paths={logo ? [logo] : []}
              fallback="/favicon.png"
              alt={storeName}
              className="h-9 w-9 rounded-xl object-contain shadow-xs ring-1 ring-border"
            />
            <span className="absolute -bottom-0.5 -end-0.5 flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>

          {!isMini && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-extrabold text-foreground">{storeName}</p>
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-extrabold text-primary">
                  لوحة الإدارة
                </span>
              </div>
              <p dir="ltr" className="truncate text-[10px] text-muted-foreground">
                {email || "admin@store.com"}
              </p>
            </div>
          )}

          {isMobileView && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation Items List - Scrollable */}
        <nav className="flex-1 min-h-0 space-y-4 px-2 py-3 overflow-y-auto no-scrollbar">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {!isMini && (
                <p className="px-3 pb-1 text-[10px] font-extrabold tracking-wider text-muted-foreground/70 uppercase">
                  {group.title}
                </p>
              )}

              {group.items.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                const Icon = item.icon;
                const disabled = config[item.to]?.disabled ?? false;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={(event) => {
                      if (disabled) {
                        event.preventDefault();
                        return;
                      }
                      if (isMobileView) onCloseMobile();
                    }}
                    aria-disabled={disabled}
                    title={isMini ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                      isMini ? "justify-center px-2 py-2.5" : ""
                    } ${
                      disabled
                        ? "pointer-events-none cursor-not-allowed opacity-40"
                        : active
                          ? "bg-primary text-primary-foreground shadow-soft"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-98"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        active
                          ? "text-primary-foreground"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />

                    {!isMini && <span className="truncate flex-1">{item.label}</span>}

                    {item.badge !== undefined && !isMini && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          active
                            ? "bg-background/20 text-primary-foreground"
                            : "bg-destructive text-destructive-foreground animate-pulse"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Small badge dot for mini sidebar */}
                    {item.badge !== undefined && isMini && (
                      <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-destructive" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom: Storefront link, Collapse button, Sign out */}
        <div className="shrink-0 border-t border-border/80 p-2 space-y-1 bg-card/60">
          {!isMini && (
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground transition"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <span>زيارة المتجر</span>
              </span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </a>
          )}

          <button
            type="button"
            onClick={onSignOut}
            title="تسجيل الخروج"
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition active:scale-95 ${
              isMini ? "justify-center px-2" : ""
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isMini && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar (Sticky, Collapsible) */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="sticky top-0 h-screen border-e border-border/80 bg-card shadow-xs">
          {renderNavContent(false)}
        </div>
      </aside>

      {/* Mobile Drawer (Slide-in with backdrop) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          {/* Drawer content (slides from right for RTL) */}
          <div className="fixed inset-y-0 end-0 w-72 max-w-[85vw] bg-card border-s border-border shadow-2xl animate-in slide-in-from-right duration-250">
            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
