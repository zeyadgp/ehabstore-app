import type { ReactNode } from "react";
import { useAdmin } from "@/hooks/useAdmin";

/** يعرض المحتوى فقط لمن يملك الصلاحية المطلوبة. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { loading, can } = useAdmin();
  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">جاري التحقق…</div>;
  }
  if (!can(permission)) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-sm font-bold">لا تملك صلاحية الوصول لهذه الصفحة</p>
        <p className="mt-1 text-xs text-muted-foreground">
          تواصل مع المدير الأعلى لمنحك الصلاحية المناسبة.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
