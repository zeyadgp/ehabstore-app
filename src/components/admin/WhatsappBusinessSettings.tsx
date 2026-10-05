import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Save } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_WHATSAPP_AUTOMATION,
  getWhatsappAutomation,
  saveWhatsappAutomation,
} from "@/lib/whatsapp-automation.functions";

export function WhatsappBusinessSettings() {
  const queryClient = useQueryClient();
  const load = useServerFn(getWhatsappAutomation);
  const save = useServerFn(saveWhatsappAutomation);
  const { data = DEFAULT_WHATSAPP_AUTOMATION, isLoading } = useQuery({
    queryKey: ["admin", "whatsapp-automation"],
    queryFn: () => load(),
  });
  const [saving, setSaving] = useState(false);

  const update = async (key: "confirm" | "status" | "abandoned", checked: boolean) => {
    setSaving(true);
    try {
      await save({ data: { ...data, [key]: checked } });
      await queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp-automation"] });
      toast.success("تم حفظ إعداد واتساب");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر حفظ إعداد واتساب");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3 border-b border-border/60 pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-extrabold text-foreground">واتساب للأعمال</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            إعداد الرسائل التلقائية للعملاء عند الطلب وتغيّر حالته.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {(
          [
            ["confirm", "تأكيد الطلب"],
            ["status", "تحديث حالة الطلب"],
            ["abandoned", "تذكير السلة المتروكة"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-3 text-xs font-bold"
          >
            <span>{label}</span>
            <input
              type="checkbox"
              checked={data[key]}
              disabled={saving || isLoading}
              onChange={(event) => void update(key, event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Save className="h-3.5 w-3.5" /> تُحفظ الخيارات هنا، ويبدأ الإرسال بعد إكمال ربط حساب واتساب
        للأعمال.
      </p>
    </section>
  );
}
