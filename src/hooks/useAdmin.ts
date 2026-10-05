import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminRole =
  | "super_admin"
  | "admin"
  | "editor" // إضافة وتعديل
  | "editor_add_only" // إضافة فقط
  | "viewer" // مشاهد
  | "user";

export type AdminState = {
  loading: boolean;
  /** يملك صلاحية دخول اللوحة (مدير أعلى / مدير / محرر / مشاهد) */
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isRegularAdmin: boolean;
  isEditor: boolean;
  isAddOnly: boolean;
  isViewer: boolean;
  isRestrictedStaff: boolean;
  roles: AdminRole[];
  permissions: string[];
  email: string | null;
  userId: string | null;

  can: (permission: string) => boolean;
  refresh: () => void;
};

const PANEL_ROLES: AdminRole[] = ["super_admin", "admin", "editor", "editor_add_only", "viewer"];

/** الصلاحيات الافتراضية لكل دور */
const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: [
    "view_dashboard",
    "view_orders",
    "manage_orders",
    "delete_orders",
    "view_products",
    "add_products",
    "edit_products",
    "manage_products",
    "delete_products",
    "view_categories",
    "manage_categories",
    "view_inventory",
    "manage_inventory",
    "view_marketing",
    "manage_marketing",
    "view_profits",
    "view_suppliers",
    "manage_suppliers",
    "view_delivery",
    "add_delivery",
    "manage_delivery",
    "delete_delivery",
    "view_payments",
    "manage_payments",
    "view_currencies",
    "manage_currencies",
    "edit_settings",
    "manage_users",
    "view_content",
    "add_content",
    "manage_content",
    "delete_content",
    "reset_data",
  ],
  admin: [
    "view_dashboard",
    "view_orders",
    "manage_orders",
    "delete_orders",
    "view_products",
    "add_products",
    "edit_products",
    "manage_products",
    "delete_products",
    "view_categories",
    "manage_categories",
    "view_inventory",
    "manage_inventory",
    "view_marketing",
    "manage_marketing",
    "view_profits",
    "view_suppliers",
    "manage_suppliers",
    "view_delivery",
    "add_delivery",
    "manage_delivery",
    "delete_delivery",
    "view_payments",
    "manage_payments",
    "view_currencies",
    "manage_currencies",
    "edit_settings",
    "manage_users",
    "view_content",
    "add_content",
    "manage_content",
    "delete_content",
  ],
  editor: [
    // إضافة وتعديل: يسمح بإضافة وتعديل المنتجات ومناطق التوصيل والآراء والمحتوى ولكن يمنع الحذف
    "view_orders",
    "view_products",
    "add_products",
    "edit_products",
    "manage_products",
    "view_delivery",
    "add_delivery",
    "manage_delivery",
    "view_payments",
    "view_content",
    "add_content",
    "manage_content",
    "view_currencies",
  ],
  editor_add_only: [
    // إضافة فقط: يسمح فقط بإضافة عناصر جديدة دون تعديل أو حذف أي شيء موجود
    "view_orders",
    "view_products",
    "add_products",
    "view_delivery",
    "add_delivery",
    "view_payments",
    "view_content",
    "add_content",
    "view_currencies",
  ],
  viewer: [
    // مشاهد / قراءة فقط: عرض واستعراض فقط دون أي إضافة أو تعديل أو حذف
    "view_orders",
    "view_products",
    "view_delivery",
    "view_payments",
    "view_content",
    "view_currencies",
  ],
  user: [],
};

export function useAdmin(): AdminState {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        const user = data.user;
        setEmail(user?.email ?? null);
        setUserId(user?.id ?? null);
        if (!user) {
          setRoles([]);
          setPermissions([]);
          setLoading(false);
          return;
        }
        const sb = supabase as never as {
          from: (t: string) => any;
          rpc: (n: string, p?: unknown) => Promise<{ data: unknown; error: unknown }>;
        };

        const rolesRes = await sb.from("user_roles").select("role").eq("user_id", user.id);

        let perms: string[] = [];
        try {
          const permsRes = await sb.rpc("my_permissions");
          if (Array.isArray(permsRes.data)) {
            perms = permsRes.data as string[];
          }
        } catch {
          // RPC may fail if unmigrated or unprivileged, fallback safely to role defaults
        }

        if (!active) return;
        const userRoles = ((rolesRes.data ?? []) as { role: AdminRole }[]).map(
          (r) => r.role,
        ) as AdminRole[];
        setRoles(userRoles);
        setPermissions(perms);
      } catch (err) {
        console.warn("Failed to check admin permissions:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void check();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [tick]);

  const isSuperAdmin = useMemo(() => roles.includes("super_admin"), [roles]);
  const isRegularAdmin = useMemo(() => roles.includes("admin"), [roles]);
  const isEditor = useMemo(
    () => roles.includes("editor") || roles.includes("editor_add_only"),
    [roles],
  );
  const isAddOnly = useMemo(() => roles.includes("editor_add_only"), [roles]);
  const isViewer = useMemo(
    () =>
      roles.includes("viewer") &&
      !isSuperAdmin &&
      !isRegularAdmin &&
      !roles.includes("editor") &&
      !roles.includes("editor_add_only"),
    [roles, isSuperAdmin, isRegularAdmin],
  );
  const isRestrictedStaff = useMemo(
    () => !isSuperAdmin && !isRegularAdmin && (isEditor || isViewer),
    [isSuperAdmin, isRegularAdmin, isEditor, isViewer],
  );
  const isAdmin = useMemo(() => roles.some((r) => PANEL_ROLES.includes(r)), [roles]);

  const can = useCallback(
    (permission: string) => {
      // 1. المدير الأعلى يملك كل الصلاحيات بدون استثناء
      if (isSuperAdmin) return true;

      // 2. إذا كانت الصلاحية موجودة في صلاحيات RPC المباشرة
      if (permissions.includes(permission)) return true;

      // 3. التحقق من الصلاحيات الافتراضية للأدوار الممنوحة للمستخدم
      return roles.some((r) => ROLE_PERMISSIONS[r]?.includes(permission));
    },
    [isSuperAdmin, permissions, roles],
  );

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return useMemo(
    () => ({
      loading,
      isAdmin,
      isSuperAdmin,
      isRegularAdmin,
      isEditor,
      isAddOnly,
      isViewer,
      isRestrictedStaff,
      roles,
      permissions,
      email,
      userId,
      can,
      refresh,
    }),
    [
      loading,
      isAdmin,
      isSuperAdmin,
      isRegularAdmin,
      isEditor,
      isAddOnly,
      isViewer,
      isRestrictedStaff,
      roles,
      permissions,
      email,
      userId,
      can,
      refresh,
    ],
  );
}
