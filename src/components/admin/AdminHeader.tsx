import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Check,
  ChevronDown,
  ExternalLink,
  KeyRound,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SlidersHorizontal,
  Sun,
  User,
  X,
  Package,
  ShoppingBag,
  Layers,
  Globe,
  Palette,
  Target,
  Ticket,
  ArrowRight,
} from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import { useOrderAlerts } from "@/lib/order-alerts";
import { useAdminCurrency } from "@/lib/admin";
import { formatMoney } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useColorMode } from "@/lib/color-mode";
import { useAdminNavigation } from "@/lib/admin-navigation";

type AdminHeaderProps = {
  email?: string;
  storeName?: string;
  sidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
  onOpenMobileSidebar: () => void;
};

// Route name mapping for clear breadcrumbs
const routeNames: Record<string, { title: string; section: string }> = {
  "/admin": { title: "لوحة المؤشرات والإحصائيات", section: "الرئيسية" },
  "/admin/orders": { title: "إدارة الطلبات", section: "المبيعات" },
  "/admin/products": { title: "إدارة المنتجات والألوان", section: "الكتالوج" },
  "/admin/categories": { title: "إدارة التصنيفات والماركات", section: "الكتالوج" },
  "/admin/colors": { title: "الألوان والدرجات الجاهزة", section: "الكتالوج" },
  "/admin/customers": { title: "سجل وقائمة العملاء", section: "المبيعات" },
  "/admin/inventory": { title: "إدارة المخزون والتنبيهات", section: "المستودع" },
  "/admin/invoices": { title: "الفواتير وسندات الطباعة", section: "المبيعات" },
  "/admin/meta": { title: "تكامل Meta (Facebook & Instagram)", section: "التسويق" },
  "/admin/ad-products": { title: "منتجات الحملات الإعلانية", section: "التسويق" },
  "/admin/ads": { title: "إدارة إعلانات Meta والإنشاء", section: "التسويق" },
  "/admin/banners": { title: "العروض والبانرات الترويجية", section: "التسويق" },
  "/admin/coupons": { title: "كوبونات وقسائم الخصم", section: "التسويق" },
  "/admin/loyalty": { title: "برنامج نقاط الولاء والمكافآت", section: "التسويق" },
  "/admin/content": { title: "محتوى المتجر والآراء", section: "المحتوى" },
  "/admin/payments": { title: "طرق وبوابات الدفع", section: "الإعدادات" },
  "/admin/delivery": { title: "خيارات وتكاليف التوصيل", section: "الإعدادات" },
  "/admin/currencies": { title: "العملات وأسعار الصرف", section: "الإعدادات" },
  "/admin/appearance": { title: "المظهر والهوية البصرية", section: "الإعدادات" },
  "/admin/site-settings": { title: "الإعدادات العامة للمتجر", section: "الإعدادات" },
  "/admin/data": { title: "النسخ الاحتياطي والاستيراد", section: "النظام" },
  "/admin/users": { title: "فريق العمل والمشرفين", section: "النظام" },
  "/admin/change-password": { title: "تغيير كلمة المرور", section: "الحساب" },
};

export function AdminHeader({
  email,
  storeName = "إيهاب ستور",
  sidebarCollapsed,
  onToggleSidebarCollapse,
  onOpenMobileSidebar,
}: AdminHeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { label } = useAdminCurrency();
  const { config } = useAdminNavigation();

  const { isDark, toggle: toggleDarkMode } = useColorMode();

  // Dropdowns state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { unread, count: unreadCount, markRead, markAllRead } = useOrderAlerts();

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut (Ctrl+K or /) for quick search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/admin/login", replace: true });
  };

  const currentInfo = routeNames[pathname] || {
    title: "لوحة التحكم",
    section: "لوحة التحكم",
  };

  // Quick navigation search items
  const searchableLinks = [
    { title: "الرئيسية والإحصائيات", path: "/admin", icon: StoreLogo, group: "عام" },
    { title: "الطلبات والمبيعات", path: "/admin/orders", icon: ShoppingBag, group: "المبيعات" },
    { title: "إدارة المنتجات والألوان", path: "/admin/products", icon: Package, group: "المنتجات" },
    { title: "التصنيفات والماركات", path: "/admin/categories", icon: Layers, group: "المنتجات" },
    { title: "سجل العملاء", path: "/admin/customers", icon: User, group: "المبيعات" },
    {
      title: "إعلانات Meta (Facebook & Instagram)",
      path: "/admin/meta",
      icon: Globe,
      group: "التسويق",
    },
    { title: "إدارة الإعلانات", path: "/admin/ads", icon: Target, group: "التسويق" },
    { title: "المخزون والتنبيهات", path: "/admin/inventory", icon: Package, group: "المستودع" },
    { title: "الفواتير والطباعة", path: "/admin/invoices", icon: ShoppingBag, group: "المبيعات" },
    { title: "كوبونات الخصم", path: "/admin/coupons", icon: Ticket, group: "التسويق" },
    {
      title: "المظهر والهوية البصرية",
      path: "/admin/appearance",
      icon: SlidersHorizontal,
      group: "الإعدادات",
    },
    {
      title: "إعدادات الموقع العامة",
      path: "/admin/site-settings",
      icon: SlidersHorizontal,
      group: "الإعدادات",
    },
  ];

  const filteredLinks = searchableLinks.filter(
    (item) =>
      !config[item.path]?.hidden &&
      !config[item.path]?.disabled &&
      item.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/80 bg-card/85 px-4 backdrop-blur-md transition-colors sm:px-6">
        {/* Left / Start Section: Mobile menu button + Page Breadcrumbs & Title */}
        <div className="flex items-center gap-3">
          {/* Mobile open drawer button */}
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="فتح القائمة"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary/50 text-foreground transition hover:bg-secondary active:scale-95 lg:hidden"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleSidebarCollapse}
            aria-label={sidebarCollapsed ? "توسيع القائمة" : "تصغير القائمة"}
            title={sidebarCollapsed ? "توسيع القائمة" : "تصغير القائمة"}
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-secondary/40 text-muted-foreground transition hover:bg-secondary hover:text-foreground active:scale-95 lg:flex"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>

          {/* Breadcrumbs & Title */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="text-primary font-bold">{currentInfo.section}</span>
              <span>/</span>
              <span className="truncate">{currentInfo.title}</span>
            </div>
            <h1 className="truncate text-sm font-extrabold text-foreground sm:text-base">
              {currentInfo.title}
            </h1>
          </div>
        </div>

        {/* Center / Search bar (Clickable trigger for quick jump) */}
        <div className="hidden md:flex flex-1 max-w-sm mx-4">
          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-secondary/40 px-3.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:bg-secondary/70 shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span>بحث سريع في النظام والصفحات…</span>
            </span>
            <kbd className="hidden sm:inline-block rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right / End Section: Actions, Notifications, Dark Mode, Profile & Sign Out */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile search button */}
          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            aria-label="بحث"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-secondary/40 text-foreground transition hover:bg-secondary active:scale-95 md:hidden"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* View live store link */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="معاينة المتجر المباشر"
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border/70 bg-secondary/30 px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-primary/50 hover:bg-secondary hover:text-primary active:scale-95"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>المتجر</span>
          </a>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
            title={isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card text-foreground transition hover:border-primary hover:bg-secondary active:scale-95"
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0 scale-100" />
            ) : (
              <Moon className="h-4 w-4 text-muted-foreground transition-transform rotate-0 scale-100" />
            )}
          </button>

          {/* Notifications Bell Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="الإشعارات والتنبيهات"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card text-foreground transition hover:border-primary hover:bg-secondary active:scale-95"
            >
              <Bell className="h-4 w-4 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-extrabold text-destructive-foreground animate-pulse">
                  {unreadCount > 99 ? "+99" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute end-0 top-11 z-50 w-80 sm:w-96 overflow-hidden rounded-2xl border border-border bg-card shadow-lift animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-border/80 bg-secondary/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-foreground">إشعارات الطلبات</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {unreadCount} جديد
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllRead()}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      تحديد الكل كمقروء
                    </button>
                  )}
                </div>

                <div className="max-h-80 divide-y divide-border/60 overflow-y-auto">
                  {unread.length === 0 ? (
                    <div className="p-8 text-center">
                      <Check className="mx-auto h-8 w-8 text-emerald-500/80 mb-2" />
                      <p className="text-xs font-bold text-foreground">لا توجد طلبات جديدة معلقة</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        كافة الطلبات الواردة تمت مراجعتها
                      </p>
                    </div>
                  ) : (
                    unread.slice(0, 8).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          markRead(o.id);
                          setNotifOpen(false);
                          void navigate({ to: "/admin/orders", search: { order: o.id } });
                        }}
                        className="flex w-full items-start justify-between gap-3 p-3.5 text-right transition hover:bg-secondary/60"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ShoppingBag className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-extrabold text-foreground">
                              #{o.order_number} — {o.customer_name}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                              {o.city ? `${o.city} • ` : ""}
                              {formatMoney(Number(o.total), label)}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(o.created_at).toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <div className="border-t border-border/80 bg-secondary/20 p-2.5 text-center">
                  <Link
                    to="/admin/orders"
                    onClick={() => setNotifOpen(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary hover:underline"
                  >
                    <span>عرض كافة الطلبات</span>
                    <ArrowRight className="h-3 w-3 rotate-180" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-label="قائمة المستخدم"
              className="flex items-center gap-2 rounded-xl border border-border/80 bg-card p-1 ps-2.5 transition hover:border-primary hover:bg-secondary active:scale-95"
            >
              <div className="hidden text-end sm:block">
                <span className="block text-xs font-extrabold leading-tight text-foreground">
                  مدير المتجر
                </span>
                <span
                  dir="ltr"
                  className="block max-w-[120px] truncate text-[10px] text-muted-foreground"
                >
                  {email ? email.split("@")[0] : "Admin"}
                </span>
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-gold text-primary-foreground font-bold text-xs shadow-xs">
                {email ? email[0]!.toUpperCase() : "A"}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {userMenuOpen && (
              <div className="absolute end-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-lift animate-in fade-in zoom-in-95 duration-150">
                <div className="border-b border-border/60 px-3 py-2.5">
                  <p className="text-xs font-extrabold text-foreground">حساب المشرف</p>
                  <p dir="ltr" className="truncate text-[11px] text-muted-foreground">
                    {email}
                  </p>
                </div>

                <div className="py-1">
                  {!config["/admin/site-settings"]?.hidden && (
                    <Link
                      to={
                        config["/admin/site-settings"]?.disabled ? "/admin" : "/admin/site-settings"
                      }
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-foreground transition hover:bg-secondary"
                    >
                      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                      <span>إعدادات المتجر</span>
                    </Link>
                  )}

                  {!config["/admin/change-password"]?.hidden && (
                    <Link
                      to={
                        config["/admin/change-password"]?.disabled
                          ? "/admin"
                          : "/admin/change-password"
                      }
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-foreground transition hover:bg-secondary"
                    >
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      <span>تغيير كلمة المرور</span>
                    </Link>
                  )}

                  <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-foreground transition hover:bg-secondary"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <span>زيارة المتجر</span>
                  </a>
                </div>

                <div className="border-t border-border/60 pt-1">
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Direct Sign Out Button */}
          <button
            type="button"
            onClick={signOut}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive transition hover:bg-destructive hover:text-destructive-foreground active:scale-95"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Global Quick Search Modal */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 animate-in fade-in duration-150">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSearchModalOpen(false)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن قسم، صفحة، أو إجراء سريع…"
                className="flex-1 bg-transparent text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="rounded-lg bg-secondary px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
              >
                ESC
              </button>
            </div>

            {/* Search Results List */}
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredLinks.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  لا توجد نتائج مطابقة لـ &quot;{searchQuery}&quot;
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSearchModalOpen(false)}
                        className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground transition hover:bg-secondary active:scale-98"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span>{item.title}</span>
                        </div>
                        <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {item.group}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
