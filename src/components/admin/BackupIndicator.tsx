import { Loader2 } from "lucide-react";
import { useBackupTask } from "@/lib/backup";

/** مؤشّر عائم يبيّن أن التصدير/الاستيراد يعمل في الخلفية. */
export function BackupIndicator() {
  const task = useBackupTask();
  if (!task.running) return null;
  return (
    <div className="fixed bottom-24 left-4 z-50 w-60 rounded-2xl border border-border bg-card p-3 shadow-lift md:bottom-6">
      <p className="flex items-center gap-2 text-[11px] font-bold">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        {task.kind === "export" ? "تصدير" : "استيراد"} قاعدة البيانات
      </p>
      <p className="mt-1 truncate text-[10px] text-muted-foreground">{task.progress}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full gradient-gold transition-all"
          style={{ width: `${task.percent}%` }}
        />
      </div>
    </div>
  );
}
