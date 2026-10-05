import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  FolderPlus,
  HelpCircle,
  Plus,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import { supabase } from "@/integrations/supabase/client";
import { RequirePermission } from "@/components/admin/RequirePermission";
import { WhatsappBusinessSettings } from "@/components/admin/WhatsappBusinessSettings";

export const Route = createFileRoute("/admin/site-settings")({
  head: () => ({
    meta: [
      { title: "إعدادات الموقع المتقدمة | لوحة التحكم" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SiteSettingsPage,
});

type SiteSetting = {
  id: string;
  key: string;
  value: string | null;
  group: string;
  description: string | null;
};

const sb = () => supabase as never as { from: (t: string) => any };

const SUGGESTED_KEYS = [
  {
    key: "support_whatsapp",
    group: "support",
    description: "رقم الواتساب المباشر لخدمة العملاء (مع الرمز الدولي)",
  },
  { key: "support_phone", group: "support", description: "رقم هاتف الاتصال المباشر" },
  { key: "support_email", group: "support", description: "البريد الإلكتروني الرسمي لخدمة العملاء" },
  {
    key: "top_banner_announcement",
    group: "marketing",
    description: "النص الترويجي في الشريط العلوي للمتجر",
  },
  {
    key: "return_policy_days",
    group: "policies",
    description: "مدة الاسترجاع والاستبدال المسموحة بالأيام",
  },
  {
    key: "order_auto_cancel_hours",
    group: "orders",
    description: "ساعات الانتظار قبل إلغاء الطلبات المعلقة تلقائياً",
  },
  {
    key: "store_working_hours",
    group: "general",
    description: "ساعات وأيام عمل المتجر وخدمة العملاء",
  },
];

function SiteSettingsPage() {
  return (
    <RequirePermission permission="edit_settings">
      <SiteSettings />
    </RequirePermission>
  );
}

function SiteSettings() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newGroup, setNewGroup] = useState("general");
  const [newDescription, setNewDescription] = useState("");
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "site-settings"],
    queryFn: async (): Promise<SiteSetting[]> => {
      const { data, error } = await sb()
        .from("site_settings")
        .select("*")
        .order("group")
        .order("key");
      if (error) throw error;
      return (data as SiteSetting[]) ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (row: SiteSetting) => {
      const { error } = await sb()
        .from("site_settings")
        .update({ value: draft[row.id] ?? row.value ?? "" })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("تم حفظ الإعداد بنجاح");
      await qc.invalidateQueries({ queryKey: ["admin", "site-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذر الحفظ"),
  });

  const add = useMutation({
    mutationFn: async (settingObj?: { key: string; group: string; description?: string }) => {
      const k = (settingObj?.key || newKey).trim();
      const g = (settingObj?.group || newGroup).trim() || "general";
      const d = settingObj?.description || newDescription.trim() || null;

      if (!k) throw new Error("اسم مفتاح الإعداد مطلوب");

      const { error } = await sb()
        .from("site_settings")
        .insert({ key: k, value: "", group: g, description: d });
      if (error) throw error;
    },
    onSuccess: async () => {
      setNewKey("");
      setNewDescription("");
      toast.success("تمت إضافة الإعداد بنجاح");
      await qc.invalidateQueries({ queryKey: ["admin", "site-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذرت الإضافة"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("site_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("تم حذف الإعداد");
      await qc.invalidateQueries({ queryKey: ["admin", "site-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذر الحذف"),
  });

  const allGroups = useMemo(() => [...new Set(rows.map((r) => r.group))], [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        r.key.toLowerCase().includes(search.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(search.toLowerCase())) ||
        (r.value && r.value.toLowerCase().includes(search.toLowerCase()));
      const matchGroup = selectedGroup === "all" || r.group === selectedGroup;
      return matchSearch && matchGroup;
    });
  }, [rows, search, selectedGroup]);

  return (
    <div className="space-y-6">
      {/* الترويسة الرئيسية */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl flex items-center gap-2.5">
            <Settings2 className="h-7 w-7 text-primary" />
            <span>إعدادات وتكوين المتجر المتقدمة</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            مفاتيح الإعدادات المركزية للمتجر (ارقام الدعم، روابط التواصل، السياسات العامة، والرسائل
            الترويجية).
          </p>
        </div>
      </div>

      <WhatsappBusinessSettings />

      {/* Bento Grid للإحصائيات السريعة */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <span className="text-xs font-bold text-muted-foreground">إجمالي المفاتيح</span>
          <p className="mt-1 text-2xl font-display font-extrabold text-foreground">{rows.length}</p>
          <span className="text-[10px] text-muted-foreground">إعدادات مسجلة</span>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <span className="text-xs font-bold text-muted-foreground">المجموعات المصنفة</span>
          <p className="mt-1 text-2xl font-display font-extrabold text-primary">
            {allGroups.length}
          </p>
          <span className="text-[10px] text-muted-foreground">أقسام إعدادات</span>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <span className="text-xs font-bold text-muted-foreground">المفاتيح المكتملة</span>
          <p className="mt-1 text-2xl font-display font-extrabold text-emerald-600">
            {rows.filter((r) => !!r.value?.trim()).length}
          </p>
          <span className="text-[10px] text-muted-foreground">تحتوي على قيم مخصصة</span>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <span className="text-xs font-bold text-muted-foreground">المفاتيح الفارغة</span>
          <p className="mt-1 text-2xl font-display font-extrabold text-amber-600">
            {rows.filter((r) => !r.value?.trim()).length}
          </p>
          <span className="text-[10px] text-muted-foreground">بانتظار الإدخال</span>
        </div>
      </div>

      {/* الاقتراحات السريعة للمفاتيح الشائعة */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm font-extrabold text-foreground flex items-center gap-2">
            <StoreLogo className="h-4 w-4 text-primary" />
            <span>مفاتيح شائعة مقترحة (إضافة سريعة)</span>
          </h2>
          <span className="text-[11px] text-muted-foreground">
            انقر للإضافة الفورية للمجموعة المناسبة
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTED_KEYS.map((s) => {
            const exists = rows.some((r) => r.key === s.key);
            return (
              <button
                key={s.key}
                type="button"
                disabled={exists || add.isPending}
                onClick={() => add.mutate(s)}
                className={`flex items-center gap-1.5 rounded-2xl border px-3.5 py-1.5 text-xs font-bold transition-all ${
                  exists
                    ? "border-border/50 bg-secondary/50 text-muted-foreground opacity-60 cursor-not-allowed"
                    : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-secondary active:scale-95"
                }`}
              >
                <span dir="ltr" className="font-mono text-[11px]">
                  {s.key}
                </span>
                {exists ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Plus className="h-3 w-3 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* نموذج إضافة مفتاح جديد */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-sm font-extrabold text-foreground flex items-center gap-2 mb-3">
          <FolderPlus className="h-4 w-4 text-primary" />
          <span>إضافة مفتاح إعداد جديد</span>
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="اسم المفتاح (مثال: support_whatsapp)"
            dir="ltr"
            className="rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-mono font-bold outline-none focus:border-primary"
          />

          <input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="المجموعة (مثال: support, general)"
            dir="ltr"
            className="rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-mono font-bold outline-none focus:border-primary"
          />

          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="الوصف التوضيحي (اختياري)"
            className="rounded-2xl border border-border bg-background px-4 py-2.5 text-xs outline-none focus:border-primary"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => add.mutate(undefined)}
            disabled={!newKey || add.isPending}
            className="flex items-center gap-1.5 rounded-2xl gradient-gold px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft transition-transform hover:opacity-95 active:scale-95 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>{add.isPending ? "جاري الإضافة..." : "إضافة الإعداد"}</span>
          </button>
        </div>
      </div>

      {/* شريط البحث وتصفية المجموعات */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في المفاتيح أو الوصف أو القيم..."
            className="w-full rounded-2xl border border-border bg-background py-2.5 pe-4 ps-10 text-xs font-medium outline-none transition-all focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card p-1 shadow-soft">
          <button
            type="button"
            onClick={() => setSelectedGroup("all")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              selectedGroup === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            كافة المجموعات ({rows.length})
          </button>
          {allGroups.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setSelectedGroup(g)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedGroup === g
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span dir="ltr">{g}</span>
            </button>
          ))}
        </div>
      </div>

      {/* قائمة بطاقات الإعدادات المصنفة */}
      <div className="space-y-4">
        {allGroups
          .filter((g) => selectedGroup === "all" || selectedGroup === g)
          .map((g) => {
            const groupRows = filteredRows.filter((r) => r.group === g);
            if (groupRows.length === 0) return null;

            return (
              <div key={g} className="rounded-3xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                    <h3 className="font-mono text-sm font-extrabold text-foreground" dir="ltr">
                      [{g}]
                    </h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-bold">
                    {groupRows.length} إعدادات
                  </span>
                </div>

                <div className="space-y-3">
                  {groupRows.map((r) => {
                    const hasChanged = draft[r.id] !== undefined && draft[r.id] !== (r.value ?? "");
                    return (
                      <div
                        key={r.id}
                        className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/50 p-3.5 sm:flex-row sm:items-center sm:gap-4 transition hover:border-primary/40"
                      >
                        <div className="min-w-[200px] sm:max-w-xs">
                          <p className="font-mono text-xs font-extrabold text-foreground" dir="ltr">
                            {r.key}
                          </p>
                          {r.description && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {r.description}
                            </p>
                          )}
                        </div>

                        <div className="flex-1">
                          <input
                            value={draft[r.id] ?? r.value ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                            placeholder="قيمة الإعداد..."
                            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                          />
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => save.mutate(r)}
                            disabled={save.isPending}
                            className={`flex items-center gap-1 rounded-xl px-4 py-2 text-xs font-bold transition ${
                              hasChanged
                                ? "gradient-gold text-primary-foreground shadow-xs animate-pulse"
                                : "border border-border bg-card text-foreground hover:bg-secondary"
                            }`}
                          >
                            <Save className="h-3.5 w-3.5" />
                            <span>حفظ</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`حذف الإعداد "${r.key}" نهائياً؟`)) {
                                remove.mutate(r.id);
                              }
                            }}
                            className="rounded-xl bg-destructive/10 p-2 text-destructive hover:bg-destructive/20"
                            title="حذف المفتاح"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        {filteredRows.length === 0 && !isLoading && (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
            <Settings2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-xs font-bold">لا توجد إعدادات تطابق البحث المحدد</p>
          </div>
        )}
      </div>
    </div>
  );
}
