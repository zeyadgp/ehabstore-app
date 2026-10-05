import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Loader2, Smartphone, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { convertAllImagesToWebp, type WebpProgress } from "@/lib/webpify";
import { BUCKET } from "@/lib/store";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/** أدوات الوسائط: تحويل كل الصور إلى WebP، ورفع ملف تطبيق أندرويد (APK). */
export function MediaToolsCard() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<WebpProgress | null>(null);
  const [uploading, setUploading] = useState(false);
  const apkRef = useRef<HTMLInputElement>(null);

  const runWebp = async () => {
    setBusy(true);
    setProgress(null);
    try {
      const result = await convertAllImagesToWebp((p) => setProgress(p));
      await qc.invalidateQueries();
      toast.success(
        result.converted > 0
          ? `تم تحويل ${result.converted} صورة إلى WebP`
          : "كل الصور محوّلة مسبقاً — لا حاجة لأي تغيير",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تحويل الصور");
    } finally {
      setBusy(false);
    }
  };

  const uploadApk = async (file: File) => {
    setUploading(true);
    try {
      const path = `apps/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: "application/vnd.android.package-archive",
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, TEN_YEARS, { download: file.name });
      if (signError || !data?.signedUrl) throw signError ?? new Error("تعذّر إنشاء الرابط");
      const { data: row } = await supabase
        .from("store_settings")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!row?.id) throw new Error("إعدادات المتجر غير موجودة");
      const { error: updateError } = await supabase
        .from("store_settings")
        .update({ app_download_url: data.signedUrl })
        .eq("id", row.id);
      if (updateError) throw updateError;
      await qc.invalidateQueries();
      toast.success("تم رفع ملف التطبيق وتفعيل زر التحميل في المتجر");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر رفع الملف");
    } finally {
      setUploading(false);
    }
  };

  const percent =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div>
        <p className="flex items-center gap-2 text-sm font-extrabold">
          <ImageIcon className="h-4 w-4 text-primary" /> تحويل كل صور المتجر إلى WebP
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          يضغط الصور القديمة ويحوّلها لصيغة أخف، فتصبح الصفحات أسرع دون تغيير شكل الصور.
        </p>
        <button
          type="button"
          onClick={runWebp}
          disabled={busy}
          className="mt-3 flex items-center gap-2 rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          تحويل جميع الصور الآن
        </button>
        {progress && (
          <p className="mt-2 text-[11px] font-bold text-muted-foreground">
            {progress.done} من {progress.total} ({percent}%) — تم تحويل {progress.converted}
          </p>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <p className="flex items-center gap-2 text-sm font-extrabold">
          <Smartphone className="h-4 w-4 text-primary" /> ملف تطبيق أندرويد (APK)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ارفعي ملف التطبيق هنا، وسيظهر زر «تحميل التطبيق» للعملاء تلقائياً.
        </p>
        <button
          type="button"
          onClick={() => apkRef.current?.click()}
          disabled={uploading}
          className="mt-3 flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold text-primary disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          رفع ملف APK
        </button>
        <input
          ref={apkRef}
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadApk(file);
          }}
        />
      </div>
    </div>
  );
}
