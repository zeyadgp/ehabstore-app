import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { BackupIndicator } from "@/components/admin/BackupIndicator";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useSettings } from "@/lib/store";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import type { StoreSettingsFull } from "@/lib/store";
import {
  AdminNavigationProvider,
  matchesAdminPath,
  useAdminNavigation,
} from "@/lib/admin-navigation";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة التحكم | إيهاب ستور" },
      {
        name: "description",
        content: "لوحة تحكم إدارة متجر إيهاب ستور: المنتجات والطلبات والإعدادات.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "لوحة التحكم | إيهاب ستور" },
      { property: "og:description", content: "إدارة متجر إيهاب ستور للعناية والتجميل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLayout,
});

/** صفحات لا تتطلب تسجيل دخول مدير. */
const PUBLIC_ADMIN_PATHS = ["/admin/login"];

function AdminLayout() {
  const { loading, isAdmin, isRestrictedStaff, email } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("admin-sidebar-collapsed") === "true";
  });

  const isPublicPath = PUBLIC_ADMIN_PATHS.includes(pathname);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (loading || isPublicPath) return;
    if (!isAdmin) {
      void navigate({ to: "/admin/login", replace: true });
      return;
    }

    // إذا كان المستخدم محرر أو مشاهد، يتم توجيهه إلى الأقسام المسموحة فقط
    if (isRestrictedStaff) {
      const allowedPaths = [
        "/admin/orders",
        "/admin/products",
        "/admin/delivery",
        "/admin/payments",
        "/admin/content",
        "/admin/banners",
        "/admin/currencies",
      ];
      const isAllowed = allowedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (!isAllowed) {
        void navigate({ to: "/admin/orders", replace: true });
      }
    }
  }, [loading, isAdmin, isRestrictedStaff, isPublicPath, pathname, navigate]);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin-sidebar-collapsed", String(next));
      return next;
    });
  };

  if (isPublicPath) {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-bold text-muted-foreground">جاري التحقق من صلاحيات المشرف…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/admin/login", replace: true });
  };

  return (
    <AdminNavigationProvider>
      <AuthenticatedAdminLayout
        email={email ?? ""}
        settings={settings}
        sidebarCollapsed={sidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        toggleSidebarCollapse={toggleSidebarCollapse}
        signOut={signOut}
      />
    </AdminNavigationProvider>
  );
}

function AuthenticatedAdminLayout({
  email,
  settings,
  sidebarCollapsed,
  mobileMenuOpen,
  setMobileMenuOpen,
  toggleSidebarCollapse,
  signOut,
}: {
  email: string;
  settings: StoreSettingsFull | null | undefined;
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleSidebarCollapse: () => void;
  signOut: () => Promise<void>;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { config, loading } = useAdminNavigation();

  useEffect(() => {
    if (loading || pathname === "/admin/internal-settings") return;
    const disabled = Object.entries(config).some(
      ([path, state]) => state.disabled && matchesAdminPath(pathname, path),
    );
    if (disabled) void navigate({ to: "/admin", replace: true });
  }, [config, loading, navigate, pathname]);

  return (
    <div className="flex min-h-screen bg-muted/20 text-foreground transition-colors dark:bg-background">
      {/* Modern Responsive Sidebar */}
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        logo={settings?.logo ?? undefined}
        storeName={settings?.store_name ?? ""}
        email={email}
        onSignOut={signOut}
      />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Modern Sticky Header */}
        <AdminHeader
          email={email}
          storeName={settings?.store_name ?? ""}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapse={toggleSidebarCollapse}
          onOpenMobileSidebar={() => setMobileMenuOpen(true)}
        />

        {/* Page Body Container */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <BackupIndicator />
    </div>
  );
}
