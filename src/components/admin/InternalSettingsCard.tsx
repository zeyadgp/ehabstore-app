import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminSettings } from "@/lib/admin";
import { Checkbox } from "@/components/ui/checkbox";
import { ADMIN_PAGES } from "@/lib/admin-navigation";
import {
  getAdminNavigationConfig,
  saveAdminNavigationConfig,
  type AdminNavigationConfig,
} from "@/lib/admin-navigation.functions";

/** Internal (non-store) controls: badge visibility and other private options. */
export function InternalSettingsCard() {
  const qc = useQueryClient();
  const { data: settings } = useAdminSettings();
  const [busy, setBusy] = useState(false);
  const hidden = settings?.hide_lovable_badge !== false;
  const fetchNavigation = useServerFn(getAdminNavigationConfig);
  const saveNavigation = useServerFn(saveAdminNavigationConfig);
  const { data: savedNavigation = {}, isLoading } = useQuery({
    queryKey: ["admin-navigation-config"],
    queryFn: () => fetchNavigation(),
  });
  const [draft, setDraft] = useState<AdminNavigationConfig | null>(null);
  const navigation = draft ?? savedNavigation;

  const toggle = async () => {
    if (!settings) return;
    setBusy(true);
    const { error } = await supabase
      .from("store_settings")
      .update({ hide_lovable_badge: !hidden } as never)
      .eq("id", settings.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(!hidden ? "تم إخفاء الشارة" : "تم إظهار الشارة");
    await qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    await qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const setPageOption = (path: string, option: "hidden" | "disabled", checked: boolean) => {
    setDraft((current) => {
      const source = current ?? savedNavigation;
      return {
        ...source,
        [path]: {
          hidden: source[path]?.hidden ?? false,
          disabled: source[path]?.disabled ?? false,
          [option]: checked,
        },
      };
    });
  };

  const savePages = async () => {
    setBusy(true);
    try {
      await saveNavigation({ data: navigation });
      await qc.invalidateQueries({ queryKey: ["admin-navigation-config"] });
      setDraft(null);
      toast.success("تم حفظ إعدادات صفحات لوحة التحكم");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر حفظ الإعدادات");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-5 rounded-2xl border border-border bg-secondary/30 p-3">
      <p className="text-xs font-extrabold">خيارات المنصة</p>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold">زر Edit with Lovable</p>
          <p className="text-[10px] text-muted-foreground">
            {hidden ? "مخفي حالياً" : "ظاهر حالياً"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy || !settings}
          aria-pressed={hidden}
          aria-label="تبديل إظهار زر Edit with Lovable"
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            hidden ? "bg-primary" : "bg-muted-foreground/40"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${
              hidden ? "right-0.5" : "right-[22px]"
            }`}
          />
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        الشارة مخفية افتراضياً في الموقع المنشور.
      </p>

      <div className="border-t border-border pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold">صفحات لوحة التحكم</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              الإخفاء يزيل الصفحة من القوائم، والتعطيل يمنع فتحها.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void savePages()}
            disabled={busy || isLoading || draft === null}
            className="rounded-lg bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
          >
            حفظ
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[480px] text-xs">
            <thead className="bg-secondary/70 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">القائمة / الصفحة</th>
                <th className="w-20 px-3 py-2 text-center">إخفاء</th>
                <th className="w-20 px-3 py-2 text-center">تعطيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ADMIN_PAGES.map((page) => (
                <tr key={page.path}>
                  <td className="px-3 py-2">
                    <span className="font-bold text-foreground">{page.label}</span>
                    <span className="me-2 text-[10px] text-muted-foreground">{page.group}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Checkbox
                      checked={navigation[page.path]?.hidden ?? false}
                      onCheckedChange={(value) =>
                        setPageOption(page.path, "hidden", value === true)
                      }
                      aria-label={`إخفاء ${page.label}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Checkbox
                      checked={navigation[page.path]?.disabled ?? false}
                      onCheckedChange={(value) =>
                        setPageOption(page.path, "disabled", value === true)
                      }
                      aria-label={`تعطيل ${page.label}`}
                    />
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
