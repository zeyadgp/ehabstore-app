import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAdminNavigationConfig,
  type AdminNavigationConfig,
} from "@/lib/admin-navigation.functions";

export const ADMIN_PAGES = [
  { path: "/admin/orders", label: "الطلبات", group: "الرئيسية والمبيعات" },
  { path: "/admin/profits", label: "الأرباح والمحاسبة", group: "الرئيسية والمبيعات" },
  { path: "/admin/invoices", label: "الفواتير وسندات القبض", group: "الرئيسية والمبيعات" },
  { path: "/admin/abandoned-carts", label: "السلات المتروكة", group: "الرئيسية والمبيعات" },
  { path: "/admin/customers", label: "العملاء", group: "الرئيسية والمبيعات" },
  { path: "/admin/products", label: "المنتجات", group: "الكتالوج والمخزون" },
  { path: "/admin/categories", label: "التصنيفات", group: "الكتالوج والمخزون" },
  { path: "/admin/inventory", label: "إدارة المخزون", group: "الكتالوج والمخزون" },
  { path: "/admin/bulk-editor", label: "التعديل الجماعي", group: "الكتالوج والمخزون" },
  { path: "/admin/suppliers", label: "الموردون والتكاليف", group: "الكتالوج والمخزون" },
  { path: "/admin/ai-copy", label: "كاتب الوصف الذكي", group: "الكتالوج والمخزون" },
  { path: "/admin/meta", label: "Meta Pixel وCAPI", group: "التسويق والإعلانات" },
  { path: "/admin/ads", label: "الحملات الإعلانية", group: "التسويق والإعلانات" },
  { path: "/admin/ad-products", label: "منتجات الإعلانات", group: "التسويق والإعلانات" },
  { path: "/admin/coupons", label: "الكوبونات والخصومات", group: "التسويق والإعلانات" },
  { path: "/admin/banners", label: "العروض والبانرات", group: "التسويق والإعلانات" },
  { path: "/admin/loyalty", label: "برنامج الولاء", group: "التسويق والإعلانات" },
  { path: "/admin/influencers", label: "إدارة المؤثرين", group: "التسويق والإعلانات" },
  { path: "/admin/content", label: "الآراء والمحتوى", group: "التسويق والإعلانات" },
  { path: "/admin/reviews", label: "إدارة المراجعات", group: "التسويق والإعلانات" },
  { path: "/admin/notifications", label: "إشعارات الويب", group: "التسويق والإعلانات" },
  { path: "/admin/site-settings", label: "إعدادات المتجر", group: "الإعدادات والنظام" },
  { path: "/admin/appearance", label: "المظهر والواجهة", group: "الإعدادات والنظام" },
  { path: "/admin/payments", label: "طرق الدفع", group: "الإعدادات والنظام" },
  { path: "/admin/delivery", label: "مناطق التوصيل", group: "الإعدادات والنظام" },
  { path: "/admin/currencies", label: "العملات والصرف", group: "الإعدادات والنظام" },
  { path: "/admin/data", label: "النسخ والاستيراد", group: "الإعدادات والنظام" },
  { path: "/admin/google-drive", label: "مزامنة Google Drive", group: "الإعدادات والنظام" },
  { path: "/admin/users", label: "المستخدمون والصلاحيات", group: "الإعدادات والنظام" },
  { path: "/admin/audit", label: "سجل العمليات الإدارية", group: "الإعدادات والنظام" },
  { path: "/admin/change-password", label: "تغيير كلمة المرور", group: "الإعدادات والنظام" },
] as const;

const AdminNavigationContext = createContext<{
  config: AdminNavigationConfig;
  loading: boolean;
}>({ config: {}, loading: true });

export function AdminNavigationProvider({ children }: { children: ReactNode }) {
  const fetchConfig = useServerFn(getAdminNavigationConfig);
  const { data = {}, isLoading } = useQuery({
    queryKey: ["admin-navigation-config"],
    queryFn: () => fetchConfig(),
    staleTime: 30_000,
  });
  return (
    <AdminNavigationContext.Provider value={{ config: data, loading: isLoading }}>
      {children}
    </AdminNavigationContext.Provider>
  );
}

export function useAdminNavigation() {
  return useContext(AdminNavigationContext);
}

export function matchesAdminPath(pathname: string, configuredPath: string) {
  return pathname === configuredPath || pathname.startsWith(`${configuredPath}/`);
}
