import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { getDriveAccountAction } from "@/lib/google-drive-sync.server";

export function DriveAccountCard() {
  const fn = useServerFn(getDriveAccountAction);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["drive-account"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
  const ok = data?.connected;
  const pct = data?.limitBytes ? Math.min(100, ((data.usedBytes || 0) / data.limitBytes) * 100) : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {data?.photo ? (
            <img src={data.photo} alt="" className="h-11 w-11 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-lg font-black">G</div>
          )}
          <div>
            <p className="text-sm font-black">{ok ? data?.name || "حساب Google" : "الحساب غير متصل"}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">{ok ? data?.email : "اربط حساب Google Drive"}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
          {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {isFetching ? "جارٍ الفحص…" : ok ? "متصل" : "غير متصل"}
        </span>
      </div>
      {ok && data?.limitBytes ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">المساحة المستخدمة: {pct.toFixed(1)}%</p>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => refetch()} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث الحالة
        </button>
        <details className="text-xs">
          <summary className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-border px-3 py-2 font-bold">
            <LogOut className="h-3.5 w-3.5" /> تبديل / فصل الحساب
          </summary>
          <p className="mt-2 max-w-md leading-6 text-muted-foreground">
            لأمان المتجر، يتم تبديل الحساب من إعدادات المشروع ← Connectors ← Google Drive، أو اطلب من المساعد «تغيير حساب قوقل درايف». بعد التبديل اضغط «تحديث الحالة».
          </p>
        </details>
      </div>
    </div>
  );
}
