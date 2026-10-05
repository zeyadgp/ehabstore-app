import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Heart,
  Bot,
  LogOut,
  Menu,
  Megaphone,
  Moon,
  Scale,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useCurrency } from "@/lib/currency";
import { BrandMark } from "@/components/BrandMark";
import { useFavorites } from "@/lib/favorites";
import { useAdmin } from "@/hooks/useAdmin";
import { WELCOME_KEY, useCustomerProfile, useSessionUser } from "@/lib/account";
import { OrderBell } from "@/components/admin/OrderBell";
import { NotificationBell } from "@/components/NotificationBell";
import { checkCartReminder } from "@/lib/notifications";
import { useSettings } from "@/lib/store";
import { useColorMode } from "@/lib/color-mode";
import { InstantSearchModal } from "@/components/InstantSearchModal";
import { useStudioSettings } from "@/lib/studio-settings";

const accountLinks = [
  { to: "/account", label: "ملفي الشخصي" },
  { to: "/loyalty", label: "نقاطي" },
  { to: "/favorites", label: "قائمة الأمنيات" },
] as const;

const navLinks = [
  { to: "/", label: "الرئيسية" },
  { to: "/products", label: "المنتجات" },
  { to: "/categories", label: "الأقسام" },
  { to: "/studio", label: "استوديو المكياج" },
  { to: "/favorites", label: "قائمة الأمنيات" },
  { to: "/about", label: "من نحن" },
  { to: "/contact", label: "تواصل معنا" },
] as const;

const sideOnlyLinks = [
  { to: "/influencer", label: "برنامج المؤثرين", icon: Megaphone },
  { to: "/connect", label: "ربط المساعد الذكي", icon: Bot },
  { to: "/compare", label: "مقارنة المنتجات", icon: Scale },
  { to: "/policy", label: "سياسة الإلغاء والإرجاع", icon: ShieldCheck },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { count } = useCart();
  const { code, setCode, currencies } = useCurrency();
  const { ids: favIds } = useFavorites();
  const { userId } = useSessionUser();
  const { data: profile } = useCustomerProfile(userId);
  const { isAdmin } = useAdmin();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inAdmin = pathname.startsWith("/admin");
  const { data: storeSettings } = useSettings();
  const { data: studioSettings } = useStudioSettings();

  const visibleNavLinks = useMemo(() => {
    const shouldHideStudio = studioSettings?.hideFromHeader || studioSettings?.disabled;
    return shouldHideStudio ? navLinks.filter((l) => l.to !== "/studio") : navLinks;
  }, [studioSettings?.hideFromHeader, studioSettings?.disabled]);

  const shopLinks = [
    { href: storeSettings?.meta_shop_url, label: "متجرنا على فيسبوك", icon: ShoppingBag },
    { href: storeSettings?.instagram_shop_url, label: "متجرنا على إنستغرام", icon: Store },
  ].filter((l) => Boolean(l.href));

  const { isDark, toggle: toggleDarkMode } = useColorMode();

  // رسالة ترحيب تظهر مرة واحدة بعد تسجيل الدخول
  useEffect(() => {
    if (!userId) return;
    try {
      if (sessionStorage.getItem(WELCOME_KEY) === userId) return;
      sessionStorage.setItem(WELCOME_KEY, userId);
    } catch {
      return;
    }
    const name = profile?.full_name?.trim();
    toast.success(`أهلًا عزيزي ${name || "بك في متجرنا"}`);
  }, [userId, profile?.full_name]);

  // فحص تنبيه السلة المتروكة عبر إشعارات الويب
  useEffect(() => {
    if (count > 0) {
      checkCartReminder(count, storeSettings?.store_name);
    }
  }, [count, storeSettings?.store_name]);

  // اختصار لوحة المفاتيح لفتح البحث الفوري
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setOpen(false);
    toast.success("تم تسجيل الخروج");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-3 sm:px-4 md:h-20">
        <BrandMark size="md" />

        <nav className="hidden items-center gap-7 md:flex" aria-label="روابط المتجر الرئيسية">
          {(inAdmin ? [] : visibleNavLinks).map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeProps={{ className: "text-primary font-extrabold after:scale-x-100" }}
              className="relative text-sm font-bold text-foreground transition-colors hover:text-primary after:absolute after:-bottom-1 after:start-0 after:h-0.5 after:w-full after:scale-x-0 after:bg-primary after:transition-transform after:duration-200"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {inAdmin ? (
            <OrderBell />
          ) : (
            <>
              {currencies.length > 1 && (
                <div className="relative hidden sm:block">
                  <select
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    aria-label="اختيار العملة"
                    className="h-10 cursor-pointer rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground shadow-soft transition-all hover:border-primary/60 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <NotificationBell />
              <Link
                to="/favorites"
                className="relative hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lift active:scale-95 sm:flex"
                aria-label="قائمة الأمنيات"
              >
                <Heart
                  className={`h-4.5 w-4.5 ${favIds.length > 0 ? "fill-rose text-rose" : "text-foreground"}`}
                />
                {favIds.length > 0 && (
                  <span className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose px-1 text-[11px] font-extrabold tabular-nums text-white shadow-soft animate-in zoom-in-50 duration-200">
                    {favIds.length}
                  </span>
                )}
              </Link>
              <Link
                to="/account"
                className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lift active:scale-95 sm:flex"
                aria-label="حسابي"
              >
                <UserRound className="h-4.5 w-4.5 text-foreground" />
              </Link>
              <Link
                to="/cart"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lift active:scale-95"
                aria-label="سلة المشتريات"
              >
                <ShoppingBag className="h-4.5 w-4.5 text-foreground" />
                {count > 0 && (
                  <span className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full gradient-gold px-1 text-[11px] font-extrabold tabular-nums text-primary-foreground shadow-soft animate-in zoom-in-50 duration-200">
                    {count}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-soft transition-all duration-200 hover:border-primary/60 active:scale-95 md:hidden"
                aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <nav
          className="border-t border-border bg-card shadow-lift md:hidden animate-in slide-in-from-top-2 duration-200"
          aria-label="قائمة الجوال"
        >
          <div className="mx-auto flex max-w-6xl flex-col px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setIsSearchOpen(true);
                }}
                className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-background py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
              >
                <Search className="h-4 w-4 text-primary" />
                <span>ابحث عن منتج، ماركة، كود...</span>
              </button>
              <button
                type="button"
                onClick={toggleDarkMode}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-foreground transition-colors hover:border-primary"
              >
                {isDark ? (
                  <Sun className="h-4 w-4 text-amber-500" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-700" />
                )}
              </button>
              {currencies.length > 1 && (
                <select
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  aria-label="اختيار العملة"
                  className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground shadow-soft outline-none focus:border-primary"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.symbol})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-col divide-y divide-border/60">
              {visibleNavLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="py-3 text-sm font-bold text-foreground transition-colors hover:text-primary active:text-primary"
                >
                  {l.label}
                </Link>
              ))}
              {sideOnlyLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 py-3 text-sm font-bold text-foreground transition-colors hover:text-primary active:text-primary"
                >
                  <l.icon className="h-4 w-4 text-primary" />
                  {l.label}
                </Link>
              ))}
              {shopLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href as string}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 py-3 text-sm font-bold text-foreground transition-colors hover:text-primary active:text-primary"
                >
                  <l.icon className="h-4 w-4 text-primary" />
                  {l.label}
                </a>
              ))}
            </div>
            {userId ? (
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                <div className="grid grid-cols-3 gap-2">
                  {accountLinks.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-center rounded-xl border border-border bg-background py-2 text-center text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-secondary py-2.5 text-xs font-bold text-primary transition-colors hover:bg-secondary/80"
                  >
                    <ShieldCheck className="h-4 w-4" /> لوحة التحكم الإدارية
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 py-2.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" /> تسجيل الخروج
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="mt-3 flex items-center justify-center gap-2 rounded-xl gradient-gold py-2.5 text-xs font-bold text-primary-foreground shadow-soft transition-opacity hover:opacity-95"
              >
                <ShieldCheck className="h-4 w-4" /> تسجيل الدخول أو إنشاء حساب
              </Link>
            )}
          </div>
        </nav>
      )}

      <InstantSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}
