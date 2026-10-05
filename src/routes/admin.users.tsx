import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Eye,
  Edit3,
  UserPlus,
  Plus,
  Copy,
  Check,
  Lock,
  CheckCircle2,
  XCircle,
  KeyRound,
  Sparkles,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { listAdminUsers, setUserRole, createAdminUserManual } from "@/lib/admin-users.functions";
import { useAdmin, type AdminRole } from "@/hooks/useAdmin";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "المستخدمون والأدوار والصلاحيات | لوحة التحكم" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUsers,
});

const ROLES_INFO: Record<
  AdminRole,
  { label: string; desc: string; badge: string; icon: typeof Shield }
> = {
  super_admin: {
    label: "المدير الأعلى",
    desc: "صلاحية مطلقة: إدارة المشرفين، تعديل كافة الإعدادات، وحذف وتهيئة البيانات",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: ShieldAlert,
  },
  admin: {
    label: "مدير النظام",
    desc: "إدارة المنتجات، الطلبات، التصنيفات، الكوبونات، والمخزون والإعدادات العامة",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: ShieldCheck,
  },
  editor: {
    label: "إضافة وتعديل",
    desc: "إضافة وتعديل المنتجات ومناطق التوصيل والمحتوى والعملات (دون حذف أو تعديل الإعدادات الحساسة)",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: Edit3,
  },
  editor_add_only: {
    label: "إضافة فقط",
    desc: "إضافة منتجات ومحتوى جديد فقط، مع تعطيل وإخفاء أي إمكانية لتعديل أو حذف العناصر الموجودة",
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    icon: Plus,
  },
  viewer: {
    label: "مشاهد / قراءة فقط",
    desc: "استعراض وقراءة الطلبات والمنتجات والمحتوى فقط دون أي إضافة أو تعديل أو حذف",
    badge: "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    icon: Eye,
  },
  user: {
    label: "مستخدم عادي",
    desc: "عميل متجر مسجل لا يملك صلاحية دخول للوحة التحكم",
    badge: "bg-muted text-muted-foreground",
    icon: UserX,
  },
};

const PERMISSION_MATRIX = [
  {
    name: "عرض قائمة الطلبات وتفاصيلها",
    super: true,
    admin: true,
    editor: true,
    addOnly: true,
    viewer: true,
  },
  {
    name: "إضافة منتجات ومحتوى ومناطق جديدة",
    super: true,
    admin: true,
    editor: true,
    addOnly: true,
    viewer: false,
  },
  {
    name: "تعديل المنتجات والمحتوى والأسعار الحالية",
    super: true,
    admin: true,
    editor: true,
    addOnly: false,
    viewer: false,
  },
  {
    name: "حذف المنتجات أو مناطق التوصيل أو المحتوى",
    super: true,
    admin: true,
    editor: false,
    addOnly: false,
    viewer: false,
  },
  {
    name: "حذف وإلغاء الطلبات نهائياً",
    super: true,
    admin: true,
    editor: false,
    addOnly: false,
    viewer: false,
  },
  {
    name: "إدارة المخزون والتصنيفات والتسويق",
    super: true,
    admin: true,
    editor: false,
    addOnly: false,
    viewer: false,
  },
  {
    name: "تعديل إعدادات المتجر العامة والمظهر",
    super: true,
    admin: true,
    editor: false,
    addOnly: false,
    viewer: false,
  },
  {
    name: "إدارة وتعيين صلاحيات فريق العمل",
    super: true,
    admin: true,
    editor: false,
    addOnly: false,
    viewer: false,
  },
];

function generateRandomPass() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const nums = "23456789";
  const specials = "!@#$%&*";
  const r = crypto.getRandomValues(new Uint32Array(14));
  let pass = "";
  for (let i = 0; i < 8; i++) pass += letters.charAt(r[i]! % letters.length);
  for (let i = 8; i < 12; i++) pass += nums.charAt(r[i]! % nums.length);
  for (let i = 12; i < 14; i++) pass += specials.charAt(r[i]! % specials.length);
  return `Admin_${pass}`;
}

function AdminUsers() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listAdminUsers);
  const changeRole = useServerFn(setUserRole);
  const createManual = useServerFn(createAdminUserManual);
  const { isSuperAdmin, userId: currentUserId } = useAdmin();

  // Manual admin addition state
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPass, setManualPass] = useState("");
  const [manualRole, setManualRole] = useState<AdminRole>("editor");
  const [createdInfo, setCreatedInfo] = useState<{
    email: string;
    pass: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
  });

  const mutation = useMutation({
    mutationFn: (vars: { email: string; role: AdminRole }) => changeRole({ data: vars }),
    onSuccess: async () => {
      toast.success("تم تحديث مستوى الصلاحية بنجاح");
      await qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذر التحديث"),
  });

  const manualCreateMutation = useMutation({
    mutationFn: async () => {
      if (!manualEmail.trim()) throw new Error("يرجى كتابة البريد الإلكتروني");
      return createManual({
        data: {
          email: manualEmail.trim(),
          name: manualName.trim() || undefined,
          password: manualPass.trim() || undefined,
          role: manualRole as "super_admin" | "admin" | "editor" | "editor_add_only" | "viewer",
        },
      });
    },
    onSuccess: async (res) => {
      toast.success("تم إنشاء الحساب وتعيين الصلاحية بنجاح بدون الحاجة لتسجيل مسبق");
      setCreatedInfo({
        email: res.email,
        pass: res.password,
        role: ROLES_INFO[res.role as AdminRole]?.label || res.role,
      });
      setManualEmail("");
      setManualName("");
      setManualPass("");
      await qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذر إضافة العضو"),
  });

  const copyCredentials = () => {
    if (!createdInfo) return;
    const text = `بيانات الدخول للوحة التحكم:\nالبريد: ${createdInfo.email}\nكلمة المرور: ${createdInfo.pass}\nالصلاحية: ${createdInfo.role}`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("تم نسخ بيانات الحساب للحافظة");
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter out any super_admin accounts completely from the table
  const visibleUsers = users.filter((u) => !u.roles.includes("super_admin"));

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="border-b border-border/60 pb-4">
        <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl flex items-center gap-2.5">
          <Shield className="h-7 w-7 text-primary" />
          <span>المستخدمون وإدارة الصلاحيات والأدوار</span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          إدارة حسابات فريق العمل، تعيين مستويات الوصول المخصصة (إضافة فقط / إضافة وتعديل / مشاهد)،
          وتعطيل أزرار التعديل والحذف لغير المخولين.
        </p>
      </div>

      {/* Manual Admin Creation Form */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft space-y-4">
        <div className="flex items-center gap-2 border-b border-border/50 pb-3">
          <UserPlus className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-extrabold text-foreground">
              إضافة عضو إداري يدوياً (بدون تسجيل مسبق)
            </h2>
            <p className="text-[11px] text-muted-foreground">
              يمكنك إنشاء وتفعيل حسابات المشرفين والمحررين والمشاهدين مباشرة فوراً مع كلمة مرور.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-foreground">
              البريد الإلكتروني <span className="text-destructive">*</span>
            </label>
            <input
              dir="ltr"
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder="staff@store.com"
              className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-xs outline-none transition focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-foreground">
              الاسم / المسمى (اختياري)
            </label>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="مثال: مسؤول المحتوى"
              className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-xs outline-none transition focus:border-primary"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">كلمة المرور</label>
              <button
                type="button"
                onClick={() => setManualPass(generateRandomPass())}
                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-primary hover:underline"
              >
                <Sparkles className="h-3 w-3" /> توليد تلقائي
              </button>
            </div>
            <div className="relative">
              <input
                dir="ltr"
                type="text"
                value={manualPass}
                onChange={(e) => setManualPass(e.target.value)}
                placeholder="اتركها فارغة للتوليد التلقائي"
                className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-xs outline-none transition focus:border-primary"
              />
              <KeyRound className="pointer-events-none absolute end-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-foreground">
              مستوى الصلاحية المخصص
            </label>
            <select
              value={manualRole}
              onChange={(e) => setManualRole(e.target.value as AdminRole)}
              className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-xs font-extrabold outline-none transition focus:border-primary"
            >
              {isSuperAdmin && <option value="super_admin">المدير الأعلى</option>}
              <option value="admin">مدير النظام (صلاحيات شاملة)</option>
              <option value="editor">إضافة وتعديل (محرر)</option>
              <option value="editor_add_only">إضافة فقط (مخصص)</option>
              <option value="viewer">مشاهد / قراءة فقط</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={() => manualCreateMutation.mutate()}
            disabled={manualCreateMutation.isPending || !manualEmail.trim()}
            className="flex items-center gap-2 rounded-2xl gradient-gold px-6 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft transition-all hover:opacity-95 active:scale-95 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            <span>
              {manualCreateMutation.isPending
                ? "جاري الإنشاء والحفظ…"
                : "إضافة الحساب وتعيين الصلاحية"}
            </span>
          </button>
        </div>

        {/* Success dialog for newly created credentials */}
        {createdInfo && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 text-xs">
                <p className="font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>تم إنشاء وتفعيل الحساب بنجاح</span>
                </p>
                <p className="text-muted-foreground">
                  البريد:{" "}
                  <span dir="ltr" className="font-bold text-foreground">
                    {createdInfo.email}
                  </span>{" "}
                  | كلمة المرور:{" "}
                  <span
                    dir="ltr"
                    className="font-mono font-bold text-foreground bg-background px-2 py-0.5 rounded border border-border"
                  >
                    {createdInfo.pass}
                  </span>{" "}
                  | الصلاحية: <span className="font-bold text-foreground">{createdInfo.role}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={copyCredentials}
                className="flex items-center gap-1.5 rounded-xl bg-card border border-border px-3.5 py-2 text-xs font-bold text-foreground hover:bg-secondary transition shadow-xs"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span>{copied ? "تم النسخ!" : "نسخ بيانات الدخول"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-bold text-destructive">
          تعذر تحميل المستخدمين: {error instanceof Error ? error.message : "خطأ"}
        </p>
      )}

      {/* Users Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-foreground">
            جدول أعضاء فريق العمل والصلاحيات
          </h2>
          <span className="text-xs text-muted-foreground">العدد: {visibleUsers.length} عضو</span>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[620px] text-right text-xs">
            <thead className="border-b border-border/60 bg-secondary/50 font-extrabold text-muted-foreground">
              <tr>
                <th className="p-3.5">البريد الإلكتروني</th>
                <th className="p-3.5">الدور الحالي</th>
                <th className="p-3.5">وصف الصلاحيات والقيود</th>
                <th className="p-3.5">آخر تسجيل دخول</th>
                <th className="p-3.5 text-center">تغيير الصلاحية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {visibleUsers.map((u) => {
                const currentRole: AdminRole = u.roles.includes("admin")
                  ? "admin"
                  : u.roles.includes("editor_add_only")
                    ? "editor_add_only"
                    : u.roles.includes("editor")
                      ? "editor"
                      : u.roles.includes("viewer")
                        ? "viewer"
                        : "user";

                const info = ROLES_INFO[currentRole] || ROLES_INFO.user;
                const isMe = u.id === currentUserId;

                return (
                  <tr key={u.id} className="transition-colors hover:bg-secondary/30">
                    <td className="p-3.5 font-bold text-foreground" dir="ltr">
                      <div className="flex items-center gap-1.5">
                        <span>{u.email}</span>
                        {isMe && (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-extrabold text-primary">
                            حسابك
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-extrabold ${info.badge}`}
                      >
                        <info.icon className="h-3.5 w-3.5" />
                        <span>{info.label}</span>
                      </span>
                    </td>
                    <td className="p-3.5 text-[11px] text-muted-foreground max-w-xs truncate">
                      {info.desc}
                    </td>
                    <td className="p-3.5 text-[11px] text-muted-foreground">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString("ar-EG")
                        : "لم يسجل بعد"}
                    </td>
                    <td className="p-3.5 text-center">
                      <select
                        value={currentRole}
                        disabled={mutation.isPending}
                        onChange={(e) =>
                          mutation.mutate({
                            email: u.email,
                            role: e.target.value as AdminRole,
                          })
                        }
                        className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold transition hover:border-primary focus:border-primary disabled:opacity-50"
                      >
                        {isSuperAdmin && <option value="super_admin">المدير الأعلى</option>}
                        <option value="admin">مدير النظام (Admin)</option>
                        <option value="editor">إضافة وتعديل (Editor)</option>
                        <option value="editor_add_only">إضافة فقط (Add Only)</option>
                        <option value="viewer">مشاهد / قراءة فقط (Viewer)</option>
                        <option value="user">مستخدم عادي (إلغاء الصلاحية)</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
              {isLoading && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-xs text-muted-foreground">
                    جاري تحميل قائمة المستخدمين والصلاحيات…
                  </td>
                </tr>
              )}
              {!isLoading && visibleUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-xs text-muted-foreground">
                    لا يوجد أعضاء مضافون حالياً. استخدم النموذج أعلاه لإضافة فريق العمل.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Matrix Explanation */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft space-y-4">
        <div className="border-b border-border/60 pb-3">
          <h2 className="font-display text-sm font-extrabold text-foreground">
            مصفوفة الصلاحيات حسب الأدوار
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            توضيح دقيق للعمليات والأقسام المتاحة لكل دور داخل لوحة الإدارة.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center">
            <thead>
              <tr className="border-b border-border/60 bg-secondary/30">
                <th className="p-3 text-start font-extrabold text-muted-foreground">
                  العملية / القسم
                </th>
                {isSuperAdmin && (
                  <th className="p-3 font-extrabold text-amber-600 dark:text-amber-400">
                    المدير الأعلى
                  </th>
                )}
                <th className="p-3 font-extrabold text-emerald-600 dark:text-emerald-400">
                  مدير النظام
                </th>
                <th className="p-3 font-extrabold text-blue-600 dark:text-blue-400">
                  إضافة وتعديل
                </th>
                <th className="p-3 font-extrabold text-cyan-600 dark:text-cyan-400">إضافة فقط</th>
                <th className="p-3 font-extrabold text-purple-600 dark:text-purple-400">
                  مشاهد (قراءة)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {PERMISSION_MATRIX.map((row) => (
                <tr key={row.name} className="hover:bg-secondary/20">
                  <td className="p-3 text-start font-bold text-foreground">{row.name}</td>
                  {isSuperAdmin && (
                    <td className="p-3">
                      {row.super ? (
                        <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="mx-auto h-4 w-4 text-muted-foreground/40" />
                      )}
                    </td>
                  )}
                  <td className="p-3">
                    {row.admin ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-muted-foreground/40" />
                    )}
                  </td>
                  <td className="p-3">
                    {row.editor ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-muted-foreground/40" />
                    )}
                  </td>
                  <td className="p-3">
                    {row.addOnly ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-muted-foreground/40" />
                    )}
                  </td>
                  <td className="p-3">
                    {row.viewer ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-muted-foreground/40" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
