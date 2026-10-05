import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Download, Info, KeyRound, Loader2, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import {
  createCustomerRecoveryLink,
  exportCustomers,
  setCustomerPasswordDirectly,
  type CustomerExportRow,
} from "@/lib/customers-export.functions";

const HEADERS = [
  "الاسم",
  "البريد الإلكتروني",
  "رقم الهاتف",
  "العنوان",
  "كلمة المرور",
  "تاريخ التسجيل",
];

function csvCell(value: string) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** تصدير قائمة العملاء وإدارة كلمات المرور. */
export function CustomersExportCard() {
  const run = useServerFn(exportCustomers);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<CustomerExportRow[] | null>(null);

  const makeRecovery = useServerFn(createCustomerRecoveryLink);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  const setDirectPwd = useServerFn(setCustomerPasswordDirectly);
  const [targetEmail, setTargetEmail] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const handleSetDirectPassword = async () => {
    if (!targetEmail.trim() || !directPassword.trim()) {
      toast.error("يرجى إدخال البريد الإلكتروني وكلمة المرور الجديدة");
      return;
    }
    setPwdBusy(true);
    try {
      const res = await setDirectPwd({
        data: { email: targetEmail, newPassword: directPassword },
      });
      toast.success(res.message);
      setDirectPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تعيين كلمة المرور");
    } finally {
      setPwdBusy(false);
    }
  };

  const makeLink = async () => {
    setLinkBusy(true);
    setLink("");
    try {
      const out = await makeRecovery({
        data: { email, redirectTo: `${window.location.origin}/reset-password` },
      });
      setLink(out.link);
      toast.success("تم إنشاء رابط تعيين كلمة مرور جديدة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إنشاء الرابط");
    } finally {
      setLinkBusy(false);
    }
  };

  const load = async () => {
    setBusy(true);
    try {
      const data = await run();
      setRows(data);
      toast.success(`تم تجهيز ${data.length} عميلاً`);
      return data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر جلب بيانات العملاء");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    const data = rows ?? (await load());
    if (!data) return;
    const lines = [
      HEADERS.join(","),
      ...data.map((r) =>
        [r.name, r.email, r.phone, r.address, r.password, r.created_at.slice(0, 10)]
          .map(csvCell)
          .join(","),
      ),
    ].join("\n");
    download(
      `customers-${new Date().toISOString().slice(0, 10)}.csv`,
      "\uFEFF" + lines,
      "text/csv",
    );
  };

  const exportJson = async () => {
    const data = rows ?? (await load());
    if (!data) return;
    download(
      `customers-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
  };

  return (
    <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h2 className="flex items-center gap-2 text-sm font-extrabold">
        <Users className="h-4 w-4 text-primary" /> تصدير ملف العملاء وإدارة كلمات المرور
      </h2>

      {/* تنبيه هندسي لتوضيح آلية تشفير كلمات المرور */}
      <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-[11px] leading-relaxed text-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <span className="font-bold">توضيح تقني حول كلمات المرور:</span>
          <p className="mt-0.5 text-muted-foreground">
            تُحفظ كلمات المرور في قاعدة البيانات بتقنية التجزئة غير العكسية (One-Way Hash عبر
            خوارزمية bcrypt)، وهي معيار أمان عالمي يمنع استرجاع كلمة المرور كنص صريح حتى من قبل
            إدارة النظام. لإعطاء العميل كلمة مرور معروفة، يمكنك استخدام خيار «تعيين كلمة مرور محددة»
            بالأسفل أو إنشاء رابط استعادة فوري.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          تصدير Excel/CSV
        </button>
        <button
          type="button"
          onClick={() => void exportJson()}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> تصدير JSON
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="rounded-xl bg-secondary px-4 py-2 text-primary disabled:opacity-50"
        >
          معاينة العدد
        </button>
      </div>

      {rows && (
        <p className="mt-2 text-[11px] font-bold text-muted-foreground">
          عدد العملاء المسجّلين: {rows.length}
        </p>
      )}

      {/* تعيين كلمة مرور محددة لحساب عميل */}
      <div className="mt-5 border-t border-border pt-4">
        <p className="flex items-center gap-2 text-xs font-extrabold text-foreground">
          <Lock className="h-4 w-4 text-primary" /> تعيين كلمة مرور محددة لعميل
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          أدخلي بريد العميل وكلمة المرور الجديدة المراد تعيينها مباشرة (بدون تشفير من قبلك)، وسيتم
          تحديثها فوراً في حسابه.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="email"
            dir="ltr"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="customer@email.com"
            className="min-w-[180px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
          />
          <input
            type="text"
            dir="ltr"
            value={directPassword}
            onChange={(e) => setDirectPassword(e.target.value)}
            placeholder="كلمة المرور الجديدة (مثال: 123456)"
            className="min-w-[160px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => void handleSetDirectPassword()}
            disabled={pwdBusy || !targetEmail.trim() || !directPassword.trim()}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {pwdBusy ? "جاري التعيين…" : "تعيين كلمة المرور فوراً"}
          </button>
        </div>
      </div>

      {/* رابط استعادة كلمة المرور */}
      <div className="mt-5 border-t border-border pt-4">
        <p className="flex items-center gap-2 text-xs font-extrabold">
          <KeyRound className="h-4 w-4 text-primary" /> إنشاء رابط استعادة كلمة مرور
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          أدخلي بريد العميل لإنشاء رابط خاص يفتح له صفحة تعيين كلمة مرور جديدة، وأرسليه له عبر
          واتساب أو البريد.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@email.com"
            className="min-w-[200px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => void makeLink()}
            disabled={linkBusy || !email.trim()}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {linkBusy ? "جاري الإنشاء…" : "إنشاء رابط"}
          </button>
        </div>
        {link && (
          <div className="mt-2 rounded-xl border border-border bg-secondary/40 p-2">
            <p dir="ltr" className="break-all text-[10px]">
              {link}
            </p>
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard.writeText(link).then(() => toast.success("تم نسخ الرابط"))
              }
              className="mt-2 rounded-lg bg-card px-3 py-1.5 text-[11px] font-bold text-primary"
            >
              نسخ الرابط
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
