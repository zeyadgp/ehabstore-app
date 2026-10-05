import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  KeyRound,
  ShieldAlert,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { InternalSettingsCard } from "@/components/admin/InternalSettingsCard";
import { StudioSettingsCard } from "@/components/admin/StudioSettingsCard";
import { StoreAssistantSettingsCard } from "@/components/admin/StoreAssistantSettingsCard";
import { CustomersExportCard } from "@/components/admin/CustomersExportCard";
import { useSettings } from "@/lib/store";
import { useActiveTheme } from "@/lib/theme";
import { startExport, startImport, useBackupTask } from "@/lib/backup";
import { getInternalSecrets, SECRET_NAMES, type SecretItem } from "@/lib/secrets.functions";

export const Route = createFileRoute("/admin/internal-settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الإعدادات الداخلية | إيهاب ستور" },
      {
        name: "description",
        content: "الإعدادات الداخلية المحمية للمشروع ولوحة التحكم.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "الإعدادات الداخلية" },
      { property: "og:description", content: "الإعدادات الداخلية المحمية للمشروع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsIn,
});

/**
 * إعدادات داخلية محمية ضمن لوحة التحكم، ولا يظهر لها اختصار في القائمة.
 */
function SettingsIn() {
  const { data: settings } = useSettings();
  const theme = useActiveTheme();
  const task = useBackupTask();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showKey, setShowKey] = useState(false);

  const fetchSecrets = useServerFn(getInternalSecrets);
  const { data: rawSecrets } = useQuery({
    queryKey: ["internal-secrets"],
    queryFn: () => fetchSecrets(),
  });

  const secretList: SecretItem[] =
    rawSecrets ??
    SECRET_NAMES.map((name) => ({
      name,
      hasValue: false,
    }));

  const projectUrl = (import.meta.env["VITE_SUPABASE_URL"] as string) ?? "—";
  const publishableKey = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string) ?? "—";

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`تم نسخ ${label}`);
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  const rows: { label: string; value: string }[] = [
    { label: "اسم المتجر", value: settings?.store_name ?? "—" },
    { label: "المظهر المفعّل", value: theme?.name ?? "—" },
    { label: "العملة الافتراضية", value: settings?.currency ?? "—" },
    {
      label: "زر Edit with Lovable",
      value: settings?.hide_lovable_badge === false ? "ظاهر" : "مخفي",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="flex items-start gap-3 rounded-3xl border border-destructive/30 bg-destructive/5 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <h1 className="text-lg font-extrabold">الإعدادات الداخلية</h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            صفحة داخلية محمية ضمن لوحة التحكم، ولا تظهر في قوائم المتجر أو محركات البحث.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-extrabold">خيارات Lovable</h2>
        <InternalSettingsCard />
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          إخفاء أو إظهار زر «Edit with Lovable» يطبّق على الموقع المنشور والمعاينة معاً.
        </p>
      </div>

      <div className="mt-5">
        <StudioSettingsCard />
      </div>

      <div className="mt-5">
        <StoreAssistantSettingsCard />
      </div>

      <CustomersExportCard />

      <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-extrabold">حالة المشروع</h2>
        <dl className="mt-3 divide-y divide-border text-xs">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="font-bold">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="flex items-center gap-2 text-sm font-extrabold">
          <Database className="h-4 w-4 text-primary" /> النسخ الاحتياطي والاسترجاع
        </h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <button
            type="button"
            disabled={task.running}
            onClick={() => startExport(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> تصدير نسخة كاملة
          </button>
          <button
            type="button"
            disabled={task.running}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" /> استرجاع من ملف
          </button>
          <Link to="/admin/data" className="rounded-xl bg-secondary px-4 py-2 text-primary">
            خيارات متقدمة
          </Link>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) startImport(f);
            }}
          />
        </div>
        {(task.running || task.progress) && (
          <p className="mt-3 text-[11px] font-bold text-muted-foreground">
            {task.error ? `خطأ: ${task.error}` : task.progress}{" "}
            {task.running ? `(${task.percent}%)` : ""}
          </p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          التصدير يشمل بيانات الجداول والصور، والاسترجاع يستبدل البيانات الحالية — استخدمه بحذر.
        </p>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-extrabold">بيانات الاتصال بقاعدة البيانات</h2>
        <div className="mt-3 space-y-3 text-xs">
          <div>
            <div className="text-muted-foreground">رابط المشروع (Project URL)</div>
            <div className="mt-1 flex items-center gap-2">
              <code
                className="flex-1 truncate rounded-xl bg-secondary px-3 py-2 font-bold"
                dir="ltr"
              >
                {projectUrl}
              </code>
              <button
                type="button"
                onClick={() => void copy(projectUrl, "الرابط")}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border"
                aria-label="نسخ الرابط"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">المفتاح العام (Publishable / anon key)</div>
            <div className="mt-1 flex items-center gap-2">
              <code
                className="flex-1 truncate rounded-xl bg-secondary px-3 py-2 font-bold"
                dir="ltr"
              >
                {showKey ? publishableKey : "•".repeat(28)}
              </code>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="rounded-xl border border-border px-3 py-2 font-bold"
              >
                {showKey ? "إخفاء" : "إظهار"}
              </button>
              <button
                type="button"
                onClick={() => void copy(publishableKey, "المفتاح")}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border"
                aria-label="نسخ المفتاح"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
            يمكنك الاطلاع على المفتاح السري (Service Role Key) وبقية مفاتيح الخدمات في قسم المفاتيح
            السرية أدناه وتصديرها بصيغة .env أو JSON بنقرة واحدة.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground">
                حالة المفاتيح السرية والمتغيرات البيئية
              </h2>
              <p className="text-[11px] text-muted-foreground">
                التحقق من توفر متغيرات الخادم السحابية بأمان تام
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>قائمة المتغيرات المعتمدة وحالة إعدادها</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 font-bold text-muted-foreground">
                <tr>
                  <th className="px-3.5 py-2.5 text-start">اسم المتغير (Name)</th>
                  <th className="px-3.5 py-2.5 text-start">حالة التوفر (Status)</th>
                  <th className="w-24 px-3.5 py-2.5 text-center">نسخ الاسم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {secretList.map((s) => (
                  <tr key={s.name} className="hover:bg-muted/20">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-foreground" dir="ltr">
                      {s.name}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {s.hasValue ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>معرّف ومفعّل</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <XCircle className="h-3 w-3" />
                          <span>غير معرّف / افتراضي</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => void copy(s.name, `اسم المتغير ${s.name}`)}
                        className="inline-flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        title="نسخ اسم المتغير"
                        aria-label={`نسخ اسم ${s.name}`}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-extrabold">روابط سريعة</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <Link to="/admin" className="rounded-xl bg-secondary px-4 py-2 text-primary">
            لوحة التحكم
          </Link>
          <Link to="/admin/appearance" className="rounded-xl bg-secondary px-4 py-2 text-primary">
            إعدادات المظهر
          </Link>
          <Link to="/" className="rounded-xl bg-secondary px-4 py-2 text-primary">
            المتجر
          </Link>
          <a
            href="https://docs.lovable.dev"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-xl border border-border px-4 py-2"
          >
            وثائق Lovable <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
