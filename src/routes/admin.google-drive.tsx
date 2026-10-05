import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  exportFullDatabaseToDriveAction,
  listDriveBackupsAction,
  restoreDriveBackupAction,
  deleteDriveBackupAction,
  syncStoreToDriveAction,
  getAutoSyncAction,
  saveAutoSyncAction,
  getSyncLogAction,
  restoreImagesFromDriveAction,
  type DriveBackupItem,
} from "@/lib/google-drive-sync.server";
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  FolderLock,
  ShieldCheck,
  HardDrive,
  DownloadCloud,
  UploadCloud,
  Database,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Copy,
  Check,
  FileJson,
  Layers,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { DriveAccountCard } from "@/components/admin/DriveAccountCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/google-drive")({
  head: () => ({
    meta: [
      { title: "النسخ الاحتياطي السحابي وGoogle Drive | لوحة الإدارة" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GoogleDriveManagementView,
});

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 بايت";
  const k = 1024;
  const sizes = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function GoogleDriveManagementView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"export" | "backups" | "sync">("backups");

  // Server functions
  const runExport = useServerFn(exportFullDatabaseToDriveAction);
  const runListBackups = useServerFn(listDriveBackupsAction);
  const runRestore = useServerFn(restoreDriveBackupAction);
  const runDelete = useServerFn(deleteDriveBackupAction);
  const runSync = useServerFn(syncStoreToDriveAction);

  // States
  const [isExporting, setIsExporting] = useState(false);
  const [exportReport, setExportReport] = useState<any>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<any>(null);
  const [batchSize, setBatchSize] = useState(100);
  const [syncProgress, setSyncProgress] = useState<{ uploaded: number; total: number; done: number } | null>(null);
  const stopRef = useRef(false);
  const fetchAuto = useServerFn(getAutoSyncAction);
  const saveAutoFn = useServerFn(saveAutoSyncAction);
  const [auto, setAuto] = useState<{ enabled: boolean; hours: number; batchSize: number; lastRun?: string | null }>({
    enabled: false,
    hours: 24,
    batchSize: 200,
  });
  const restoreImgs = useServerFn(restoreImagesFromDriveAction);
  const [imgRestore, setImgRestore] = useState<string | null>(null);
  const handleRestoreImages = async () => {
    let total = 0;
    setImgRestore("جاري البدء…");
    try {
      while (true) {
        const r = await restoreImgs();
        total += r.restored;
        setImgRestore(`استُعيدت ${total} صورة — المتبقي ${r.remaining}`);
        if (r.remaining === 0 || r.restored === 0) break;
      }
      toast.success(`اكتملت استعادة الصور (${total})`);
    } catch (e: any) {
      toast.error("فشلت الاستعادة: " + e.message);
    }
    setTimeout(() => setImgRestore(null), 8000);
  };
  const fetchLog = useServerFn(getSyncLogAction);
  const [syncLog, setSyncLog] = useState<any[]>([]);
  useEffect(() => {
    fetchLog().then(setSyncLog).catch(() => {});
  }, [fetchLog, isSyncing]);
  useEffect(() => {
    fetchAuto().then(setAuto).catch(() => {});
  }, [fetchAuto]);
  const handleSaveAuto = async () => {
    try {
      const r = await saveAutoFn({ data: { enabled: auto.enabled, hours: auto.hours, batchSize } });
      setAuto(r);
      toast.success(r.enabled ? `المزامنة التلقائية مفعلة كل ${r.hours} ساعة` : "تم تعطيل المزامنة التلقائية");
    } catch (e: any) {
      toast.error("تعذر الحفظ: " + e.message);
    }
  };

  const [restoreTarget, setRestoreTarget] = useState<DriveBackupItem | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreReport, setRestoreReport] = useState<any>(null);

  const [copiedCron, setCopiedCron] = useState(false);

  // Queries
  const {
    data: backups = [],
    isLoading: isLoadingBackups,
    isRefetching: isRefetchingBackups,
    refetch: refetchBackups,
  } = useQuery({
    queryKey: ["drive-backups"],
    queryFn: () => runListBackups(),
    staleTime: 60_000,
  });

  // Export full database to drive handler
  const handleExportDatabase = async () => {
    setIsExporting(true);
    try {
      const result = await runExport();
      setExportReport(result);
      toast.success("تم تصدير قاعدة البيانات كاملة إلى Google Drive بنجاح!");
      queryClient.invalidateQueries({ queryKey: ["drive-backups"] });
    } catch (err: any) {
      toast.error("فشل التصدير إلى Google Drive: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // مزامنة متسلسلة: دفعة تلو الأخرى حتى اكتمال الصور
  const handleSyncStore = async () => {
    setIsSyncing(true);
    stopRef.current = false;
    let uploaded = 0;
    let first = true;
    try {
      while (true) {
        const result = await runSync({ data: { batchSize, skipDb: !first } });
        if (first) setSyncReport(result);
        first = false;
        uploaded += result.newUploadedImages;
        setSyncProgress({
          uploaded,
          total: result.totalImages,
          done: result.totalImages - result.remainingImages,
        });
        if (result.remainingImages === 0) {
          toast.success("اكتمل رفع كافة صور المتجر بنجاح");
          break;
        }
        if (result.newUploadedImages === 0) {
          toast.error("توقف الرفع: تعذر رفع بعض الصور، حاول لاحقاً");
          break;
        }
        if (stopRef.current) {
          toast("تم الإيقاف المؤقت، اضغط مجدداً للإكمال");
          break;
        }
      }
      setSyncReport((r: any) => (r ? { ...r, newUploadedImages: uploaded } : r));
    } catch (err: any) {
      toast.error("فشل المزامنة: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Restore backup mutation
  const restoreMutation = useMutation({
    mutationFn: async (item: DriveBackupItem) => {
      setIsRestoring(true);
      return runRestore({ data: { fileId: item.id, fileName: item.name } });
    },
    onSuccess: (result) => {
      setRestoreReport(result);
      setRestoreTarget(null);
      toast.success(`تم استيراد واستعادة النسخة بنجاح (${result.totalRecordsRestored} سجل)!`);
    },
    onError: (err: any) => {
      toast.error("فشلت استعادة النسخة: " + err.message);
    },
    onSettled: () => {
      setIsRestoring(false);
    },
  });

  // Delete backup mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return runDelete({ data: { fileId } });
    },
    onSuccess: () => {
      toast.success("تم حذف ملف النسخة من Google Drive");
      queryClient.invalidateQueries({ queryKey: ["drive-backups"] });
    },
    onError: (err: any) => {
      toast.error("فشل حذف النسخة: " + err.message);
    },
  });

  const cronUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/cron/drive-sync?secret=store-backup-safe-key`
    : "/api/cron/drive-sync?secret=store-backup-safe-key";

  const handleCopyCron = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(cronUrl);
      setCopiedCron(true);
      setTimeout(() => setCopiedCron(false), 2000);
      toast.success("تم نسخ رابط الجدولة إلى الحافظة");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 text-right" dir="rtl">
      <DriveAccountCard />
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-foreground">
                النسخ الاحتياطي والاستعادة السحابية (Google Drive)
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                تصدير واستيراد كامل لقاعدة البيانات ومزامنة دورية للصور والملفات على Google Drive
              </p>
            </div>
          </div>
        </div>

        {/* Quick status badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            سيرفر المزامنة متصل 24/7
          </span>
        </div>
      </div>

      {/* Top Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">النسخ الكاملة في Drive</div>
            <div className="text-base font-bold text-foreground">
              {isLoadingBackups ? "جاري الفحص…" : `${backups.length} نسخة احتياطية`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">حماية استعادة البيانات</div>
            <div className="text-base font-bold text-foreground">مفعلة (UPSERT ذكي)</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <FolderLock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">المجلد السحابي المعتمد</div>
            <div className="text-sm font-bold text-foreground font-mono truncate max-w-[180px]">
              نسخ_احتياطي_متجر_إيهاب
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("backups")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
            activeTab === "backups"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          }`}
        >
          <DownloadCloud className="h-4 w-4" />
          مكتبة النسخ الاحتياطية والاستعادة ({backups.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("export")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
            activeTab === "export"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          }`}
        >
          <UploadCloud className="h-4 w-4" />
          تصدير ونسخ فوري إلى Drive
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sync")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
            activeTab === "sync"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          الجدولة التلقائية والمزامنة
        </button>
      </div>

      {/* TAB 1: BACKUPS LIBRARY & RESTORE */}
      {activeTab === "backups" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                النسخ الاحتياطية المتوفرة على Google Drive
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                يمكنك استعادة أي نسخة سابقة بكامل بياناتها وجداولها بضغطة زر واحدة
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => refetchBackups()}
                disabled={isRefetchingBackups}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-secondary/60 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefetchingBackups ? "animate-spin" : ""}`} />
                تحديث القائمة
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("export")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                إنشاء نسخة جديدة الآن
              </button>
            </div>
          </div>

          {/* Restore Success Report */}
          {restoreReport && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                تمت استعادة وتحديث قاعدة البيانات بنجاح تام!
              </div>
              <div className="text-xs sm:text-sm space-y-1">
                <div>اسم ملف النسخة المستعادة: <span className="font-mono font-bold">{restoreReport.fileName}</span></div>
                <div>إجمالي السجلات المستعادة: <b>{restoreReport.totalRecordsRestored.toLocaleString()}</b> سجل</div>
                <div>عدد الجداول التي تم تحديثها: <b>{restoreReport.restoredTables}</b> جدول</div>
                <div>توقيت إتمام العملية: {new Date(restoreReport.timestamp).toLocaleString("ar-SA")}</div>
              </div>
            </div>
          )}

          {/* Backups List Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {isLoadingBackups ? (
              <div className="flex flex-col items-center justify-center p-12 gap-3 text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs sm:text-sm font-bold">جاري فحص وقراءة النسخ من Google Drive…</p>
              </div>
            ) : backups.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <FileJson className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-foreground">لا توجد نسخ احتياطية مسجلة بعد في Drive</h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
                  ابدأ بإنشاء أول نسخة احتياطية كاملة لقاعدة بيانات المتجر ليتم حفظها وتأمينها تلقائياً على Google Drive.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("export")}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm"
                >
                  <UploadCloud className="h-4 w-4" />
                  إنشاء وتصدير أول نسخة
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="p-3.5 font-bold">اسم النسخة الاحتياطية</th>
                      <th className="p-3.5 font-bold">الحجم</th>
                      <th className="p-3.5 font-bold">تاريخ الإنشاء</th>
                      <th className="p-3.5 font-bold text-center">الإجراءات والتحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {backups.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3.5 font-bold text-foreground">
                          <div className="flex items-center gap-2.5">
                            <FileJson className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="font-mono text-xs truncate max-w-[280px] sm:max-w-md" title={item.name}>
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 font-medium text-muted-foreground whitespace-nowrap">
                          {formatBytes(item.size)}
                        </td>
                        <td className="p-3.5 text-muted-foreground whitespace-nowrap text-xs">
                          {new Date(item.createdTime).toLocaleString("ar-SA")}
                        </td>
                        <td className="p-3.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Restore Button */}
                            <button
                              type="button"
                              onClick={() => setRestoreTarget(item)}
                              disabled={isRestoring}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              <DownloadCloud className="h-3.5 w-3.5" />
                              استيراد واستعادة
                            </button>

                            {/* View in Drive link if available */}
                            {item.webViewLink && (
                              <a
                                href={item.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                                title="عرض في Google Drive"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف النسخة "${item.name}" من Google Drive؟`)) {
                                  deleteMutation.mutate(item.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              className="inline-flex items-center justify-center rounded-lg border border-red-500/20 p-1.5 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                              title="حذف من Drive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EXPORT TO DRIVE */}
      {activeTab === "export" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Full Database Export */}
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">تصدير كامل قاعدة البيانات</h2>
                    <p className="text-xs text-muted-foreground">تصدير كافة الجداول والسجلات إلى ملف JSON في Drive</p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  يقوم هذا الإجراء بسحب كافة جداول المتجر (المنتجات، الطلبات، المستخدمين، الأسعار، الإعدادات، والمخزون)
                  بشكل كامل مع الترقيم لتفادي حدود الـ 1000 سجل، ورفعها مشفرة ومؤرخة باليوم والساعة في مجلد النسخ الاحتياطية على Google Drive.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExportDatabase}
                  disabled={isExporting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  <UploadCloud className={`h-4 w-4 ${isExporting ? "animate-spin" : ""}`} />
                  {isExporting ? "جاري تصدير ورفع قاعدة البيانات إلى Drive…" : "تصدير قاعدة البيانات كاملة إلى Drive الآن"}
                </button>
              </div>
            </div>

            {/* Card 2: Media and Storage Sync */}
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">مزامنة صور وبيانات المتجر</h2>
                    <p className="text-xs text-muted-foreground">مزامنة الصور الجديدة في التخزين دون تكرار</p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  يقوم بفحص الصور في كافة المجلدات الفرعية (`products/`, `categories/`, `brands/`, `banners/`)
                  ومقارنتها بالملفات المرفوعة سابقاً، ورفع الصور الجديدة فقط مع نسخة سريعة من البيانات لتوفير المساحة والوقت.
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold">عدد الصور في كل دفعة:</span>
                  {[50, 100, 200].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBatchSize(n)}
                      className={`rounded-lg border px-3 py-1.5 font-bold ${batchSize === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))}
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1.5"
                    aria-label="عدد مخصص"
                  />
                </div>
                {syncProgress && (
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${syncProgress.total ? Math.round((syncProgress.done / syncProgress.total) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      تم رفع {syncProgress.uploaded} صورة في هذه الجلسة — المتبقي {syncProgress.total - syncProgress.done} من {syncProgress.total}
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSyncStore}
                    disabled={isSyncing}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/80 px-5 py-3 text-xs sm:text-sm font-bold text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "جاري رفع الصور تلقائياً حتى الاكتمال…" : "بدء المزامنة الشاملة"}
                  </button>
                  {isSyncing && (
                    <button
                      type="button"
                      onClick={() => (stopRef.current = true)}
                      className="rounded-xl border border-border bg-card px-4 text-xs font-bold"
                    >
                      إيقاف مؤقت
                    </button>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-card p-3 space-y-2 text-xs">
                  <label className="flex items-center justify-between font-bold">
                    المزامنة التلقائية
                    <input
                      type="checkbox"
                      checked={auto.enabled}
                      onChange={(e) => setAuto({ ...auto, enabled: e.target.checked })}
                      className="h-4 w-4"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>كل</span>
                    {[6, 12, 24, 168].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setAuto({ ...auto, hours: h })}
                        className={`rounded-lg border px-2 py-1 ${auto.hours === h ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                      >
                        {h === 168 ? "أسبوع" : `${h} س`}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={auto.hours}
                      onChange={(e) => setAuto({ ...auto, hours: Math.max(1, Math.min(720, Number(e.target.value) || 1)) })}
                      className="w-16 rounded-lg border border-border bg-background px-2 py-1"
                      aria-label="ساعات مخصصة"
                    />
                    <span>ساعة</span>
                  </div>
                  {auto.lastRun && (
                    <p className="text-muted-foreground">آخر مزامنة تلقائية: {new Date(auto.lastRun).toLocaleString("ar-SA")}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveAuto}
                    className="w-full rounded-lg bg-primary py-2 font-bold text-primary-foreground"
                  >
                    حفظ إعدادات المزامنة التلقائية
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreImages}
                  disabled={!!imgRestore}
                  className="w-full rounded-xl border border-border bg-card py-2.5 text-xs font-bold disabled:opacity-50"
                >
                  {imgRestore ?? "استعادة الصور من Google Drive إلى المتجر"}
                </button>
                {syncLog.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-3 text-[11px] space-y-1 max-h-48 overflow-auto">
                    <p className="font-bold text-xs">سجل المزامنة</p>
                    {syncLog.slice(0, 20).map((l, i) => (
                      <div key={i} className="flex justify-between gap-2 border-b border-border/50 py-1">
                        <span>{new Date(l.at).toLocaleString("ar-SA")}</span>
                        <span className={l.error ? "text-destructive" : "text-muted-foreground"}>
                          {l.error ? "فشل: " + String(l.error).slice(0, 40) : `رُفع ${l.uploaded} — فشل ${l.failed} — متبقٍ ${l.remaining}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Export Report Output */}
          {exportReport && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-800 dark:text-emerald-300 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                تم تصدير وحفظ النسخة الاحتياطية في Google Drive بنجاح!
              </div>
              <div className="text-xs sm:text-sm space-y-1">
                <div>اسم الملف المنشأ: <span className="font-mono font-bold">{exportReport.fileName}</span></div>
                <div>عدد الجداول المكتملة: <b>{exportReport.totalTables}</b> جدول</div>
                <div>إجمالي السجلات المصدرة: <b>{exportReport.totalRecords.toLocaleString()}</b> سجل</div>
                <div>توقيت العملية: {new Date(exportReport.timestamp).toLocaleString("ar-SA")}</div>
              </div>
            </div>
          )}

          {/* Sync Report Output */}
          {syncReport && (
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 text-sm text-blue-800 dark:text-blue-300 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-base">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                اكتملت مزامنة الصور والبيانات بنجاح!
              </div>
              <div className="text-xs sm:text-sm space-y-1">
                <div>ملف البيانات المنشأ: <span className="font-mono font-bold">{syncReport.databaseFile}</span></div>
                <div>عدد الصور الجديدة المرفوعة: <b>{syncReport.newUploadedImages}</b> صورة</div>
                <div>توقيت المزامنة: {new Date(syncReport.timestamp).toLocaleString("ar-SA")}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CRON & AUTO-SYNC */}
      {activeTab === "sync" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                الجدولة التلقائية للنسخ الاحتياطي (Cron Job)
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                يمكنك ربط هذا الرابط مع أي خدمة جدولة سحابية خارجية (مثل Google Cloud Scheduler، أو cron-job.org) لتشغيل النسخ في الخلفية دورياً.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">رابط الـ Webhook المباشر مع الرمز السري:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={cronUrl}
                  className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-xs font-mono text-foreground focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyCron}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2.5 text-xs font-bold text-foreground hover:bg-secondary/80 shrink-0"
                >
                  {copiedCron ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  {copiedCron ? "تم النسخ" : "نسخ الرابط"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                تعليمات أمان الجدولة:
              </div>
              <p>
                - يتم حماية هذا الرابط برمز سري `secret` ولا يمكن لأي زائر تشغيله دون الرمز الصحيح.
                <br />
                - عند استدعاء الرابط بواسطة المجدول، يقوم السيرفر بأخذ نسخة من قاعدة البيانات ومزامنة الصور الجديدة إلى Google Drive في الخلفية تماماً.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE CONFIRMATION DIALOG */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent className="text-right" dir="rtl">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <AlertDialogTitle>تأكيد استعادة النسخة الاحتياطية</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 text-xs sm:text-sm text-muted-foreground pt-2">
              <p>
                أنت على وشك استعادة بيانات المتجر من النسخة:
                <br />
                <span className="font-mono font-bold text-foreground">{restoreTarget?.name}</span>
              </p>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-amber-800 dark:text-amber-300 text-xs">
                ⚠️ <b>تنبيه هام:</b> سيتم استيراد وتحديث كافة السجلات والجداول (المنتجات، التصنيفات، الأسعار، الإعدادات)
                بناءً على محتوى هذه النسخة عبر خوارزمية عدم التعارض (UPSERT).
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2 sm:gap-0 pt-4">
            <AlertDialogAction
              onClick={() => {
                if (restoreTarget) {
                  restoreMutation.mutate(restoreTarget);
                }
              }}
              disabled={isRestoring}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isRestoring ? "جاري الاستيراد والتحديث…" : "نعم، استعادة النسخة الآن"}
            </AlertDialogAction>
            <AlertDialogCancel disabled={isRestoring}>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
