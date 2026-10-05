import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload, Image as ImageIcon, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MediaToolsCard } from "@/components/admin/MediaToolsCard";
import { resetDatabase, type ResetScope } from "@/lib/reset-db.functions";
import {
  startExport,
  startImport,
  useBackupTask,
  clearBackupTask,
  startImagesZipExport,
  startImagesZipImport,
  BACKUP_TABLES,
  type TableName,
} from "@/lib/backup";

export const Route = createFileRoute("/admin/data")({
  head: () => ({
    meta: [{ title: "إدارة البيانات | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminData,
});

const tableLabels: Record<TableName, string> = {
  store_settings: "إعدادات المتجر العامة",
  site_settings: "بيانات النظام والإضافات (الموردون، التكاليف، السلات المتروكة، الربط)",
  currencies: "العملات وأسعار الصرف",
  themes: "الثيمات وتخصيص المظهر",
  brands: "الماركات التجارية",
  categories: "أقسام وتصنيفات المنتجات",
  product_colors: "الألوان وتدرجات المنتجات",
  products: "المنتجات والمخزون",
  product_categories: "روابط وتصنيفات المنتجات",
  product_prices: "أسعار المنتجات بالعملات",
  product_options: "الخيارات (ألوان/مقاسات)",
  product_option_values: "قيم الخيارات والخصائص",
  product_reviews: "تقييمات وآراء المنتجات",
  banners: "البانرات الإعلانية",
  payment_methods: "طرق وبوابات الدفع",
  delivery_zones: "مناطق وتكاليف التوصيل",
  testimonials: "آراء وشهادات العملاء",
  profiles: "الملفات الشخصية للمستخدمين",
  user_roles: "أدوار وصلاحيات المشرفين",
  permissions: "قائمة الأذونات والصلاحيات",
  role_permissions: "ربط أذونات الأدوار",
  orders: "الطلبات والمبيعات",
  order_items: "أصناف وسجلات الطلبات",
  invoices: "الفواتير الإلكترونية",
  whatsapp_messages: "سجلات رسائل الواتساب",
  discount_coupons: "كوبونات الخصم والعروض",
  coupon_redemptions: "سجلات استخدام الكوبونات",
  loyalty_settings: "إعدادات برنامج الولاء",
  loyalty_rewards: "مكافآت برنامج الولاء",
  loyalty_accounts: "حسابات ونقاط الولاء",
  loyalty_transactions: "حركات وسجلات النقاط",
  loyalty_coupons: "كوبونات برنامج الولاء",
  loyalty_checkins: "سجلات الدخول اليومي للولاء",
  admin_audit_log: "سجل العمليات الإدارية والرقابية",
  influencers: "المؤثرون والمسوقون",
  affiliate_earnings: "أرباح وعمولات المؤثرين",
  affiliate_withdrawals: "طلبات سحب الأرباح",
  developer_commissions: "عمولات التطوير",
  page_views: "سجل الزيارات",
};

const presets: { label: string; tables: TableName[] }[] = [
  { label: "الكل (نسخة كاملة شاملة كافة الإضافات)", tables: [...BACKUP_TABLES] },
  {
    label: "المتجر والمنتجات والأقسام",
    tables: [
      "store_settings",
      "currencies",
      "themes",
      "brands",
      "categories",
      "product_colors",
      "products",
      "product_categories",
      "product_prices",
      "product_options",
      "product_option_values",
      "banners",
    ],
  },
  {
    label: "الموردون والإضافات وتكاليف المنتجات",
    tables: ["site_settings", "store_settings", "products", "product_prices"],
  },
  {
    label: "الطلبات والمبيعات والفواتير",
    tables: ["orders", "order_items", "invoices", "whatsapp_messages", "delivery_zones"],
  },
  {
    label: "الولاء والكوبونات",
    tables: [
      "discount_coupons",
      "coupon_redemptions",
      "loyalty_settings",
      "loyalty_rewards",
      "loyalty_accounts",
      "loyalty_transactions",
      "loyalty_coupons",
      "loyalty_checkins",
    ],
  },
  {
    label: "المستخدمون والصلاحيات والأمان",
    tables: ["profiles", "user_roles", "permissions", "role_permissions", "admin_audit_log"],
  },
];

const resetScopes: { key: ResetScope; label: string; hint: string }[] = [
  {
    key: "orders",
    label: "الطلبات والمبيعات والفواتير",
    hint: "الطلبات، الأصناف، الفواتير الإلكترونية، رسائل الواتساب",
  },
  {
    key: "catalog",
    label: "المنتجات والتصنيفات والمخزون",
    hint: "المنتجات، الأقسام، الأسعار، الخيارات، الماركات، والألوان",
  },
  {
    key: "loyalty",
    label: "برنامج الولاء والكوبونات",
    hint: "حسابات وسجلات نقاط الولاء، المكافآت، وكوبونات الخصم",
  },
  {
    key: "content",
    label: "البانرات والواجهة الترويجية",
    hint: "البانرات الإعلانية وآراء وشهادات العملاء",
  },
  { key: "reviews", label: "تقييمات وآراء المنتجات فقط", hint: "تقييمات العملاء لجميع المنتجات" },
  {
    key: "audit",
    label: "سجلات العمليات والرقابة الإدارية",
    hint: "تفريغ سجل العمليات الإدارية (Audit Log)",
  },
];

function DangerZone() {
  const [open, setOpen] = useState(false);
  const [scopes, setScopes] = useState<ResetScope[]>([]);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const reset = useServerFn(resetDatabase);
  const qc = useQueryClient();

  const toggleScope = (s: ResetScope) =>
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const run = async () => {
    setBusy(true);
    try {
      await reset({ data: { scopes, confirm: "حذف" as const } });
      await qc.invalidateQueries();
      toast.success("تمت تهيئة قاعدة البيانات");
      setOpen(false);
      setScopes([]);
      setWord("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تنفيذ الحذف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-3xl border border-destructive/40 bg-destructive/5 p-4">
      <p className="flex items-center gap-2 text-sm font-extrabold text-destructive">
        <AlertTriangle className="h-4 w-4" /> منطقة خطر — حذف وتهيئة قاعدة البيانات
      </p>
      <p className="text-xs text-muted-foreground">
        يحذف البيانات المختارة نهائيًا ولا يمكن التراجع. لا تُمس حسابات المستخدمين ولا الصلاحيات ولا
        إعدادات المتجر. يُنصح بأخذ نسخة احتياطية أولاً.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-destructive px-4 py-2 text-xs font-bold text-destructive"
        >
          <Trash2 className="h-4 w-4" /> حذف وتهيئة قاعدة البيانات
        </button>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {resetScopes.map((s) => (
              <label
                key={s.key}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-[11px] font-bold ${
                  scopes.includes(s.key) ? "border-destructive bg-card" : "border-border bg-card"
                }`}
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(s.key)}
                  onChange={() => toggleScope(s.key)}
                  disabled={busy}
                />
                <span>
                  {s.label}
                  <span className="block font-normal text-muted-foreground">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <label className="block text-xs font-bold">
            اكتب كلمة «حذف» للتأكيد
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              disabled={busy}
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-normal"
              placeholder="حذف"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || scopes.length === 0 || word.trim() !== "حذف"}
              onClick={run}
              className="flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              تأكيد الحذف النهائي
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setScopes([]);
                setWord("");
              }}
              className="rounded-xl border border-border px-4 py-2 text-xs font-bold"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminData() {
  const [withImages, setWithImages] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [selected, setSelected] = useState<TableName[]>([...BACKUP_TABLES]);
  const task = useBackupTask();
  const busy = task.running;

  const toggle = (t: TableName) =>
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">استيراد وتصدير قاعدة البيانات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          اختر الجداول التي تريد تصديرها أو استيرادها، مع إمكانية تضمين الصور. العملية تعمل في
          الخلفية — يمكنك التنقّل بين صفحات لوحة التحكم أثناء تنفيذها.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold">
          <input
            type="checkbox"
            checked={withImages}
            onChange={(e) => setWithImages(e.target.checked)}
            disabled={busy}
          />
          <ImageIcon className="h-4 w-4 text-primary" /> تضمين الصور
        </label>
        <label className="flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            disabled={busy}
          />
          فحص تجريبي للاستيراد (بدون حفظ)
        </label>
      </div>

      <div className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-extrabold">تخصيص الجداول</p>
          <span className="text-[11px] text-muted-foreground">
            {selected.length} من {BACKUP_TABLES.length}
          </span>
          <div className="ms-auto flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={busy}
                onClick={() => setSelected(p.tables)}
                className="rounded-full border border-border px-3 py-1 text-[11px] font-bold hover:border-primary"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelected([])}
              className="rounded-full border border-border px-3 py-1 text-[11px] font-bold text-muted-foreground hover:border-primary"
            >
              إلغاء الكل
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {BACKUP_TABLES.map((t) => (
            <label
              key={t}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold ${
                selected.includes(t) ? "border-primary bg-secondary text-primary" : "border-border"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(t)}
                disabled={busy}
                onChange={() => toggle(t)}
              />
              {tableLabels[t]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            if (selected.length === 0) {
              toast.error("اختر جدولاً واحداً على الأقل");
              return;
            }
            clearBackupTask();
            startExport(withImages, selected);
            toast.info("بدأ التصدير في الخلفية");
          }}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          <Download className="h-4 w-4" /> تصدير نسخة احتياطية
        </button>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold text-primary">
          <Upload className="h-4 w-4" /> استيراد ملف JSON
          <input
            type="file"
            accept="application/json"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (selected.length === 0) {
                toast.error("اختر جدولاً واحداً على الأقل");
                return;
              }
              clearBackupTask();
              startImport(file, { only: selected, withImages, dryRun });
              toast.info("بدأ الاستيراد في الخلفية");
              e.target.value = "";
            }}
          />
        </label>
        <button
          onClick={() => {
            clearBackupTask();
            startImagesZipExport();
          }}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold text-primary disabled:opacity-60"
        >
          <ImageIcon className="h-4 w-4" /> تصدير الصور (ZIP)
        </button>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold text-primary">
          <Upload className="h-4 w-4" /> استيراد الصور (ZIP)
          <input
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              clearBackupTask();
              startImagesZipImport(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {(busy || task.percent > 0) && (
        <div className="space-y-2 rounded-3xl border border-border bg-card p-4 shadow-soft">
          <p className="flex items-center gap-2 text-sm font-bold">
            {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {task.progress || (task.error ? "توقفت العملية" : "جاهز")}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full gradient-gold transition-all"
              style={{ width: `${task.percent}%` }}
            />
          </div>
          {task.error && <p className="text-xs font-bold text-destructive">{task.error}</p>}
        </div>
      )}

      <MediaToolsCard />

      <DangerZone />

      {task.log.length > 0 && (
        <ul className="space-y-1 rounded-3xl border border-border bg-card p-4 text-xs shadow-soft">
          {task.log.map((l) => (
            <li key={l} dir="auto">
              {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
