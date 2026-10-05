import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  Gift,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDeliveryZones, type DeliveryZone } from "@/lib/delivery";
import { useAdminSettings, useAdminCurrency } from "@/lib/admin";
import { useAdmin } from "@/hooks/useAdmin";
import { YEMEN_GOVERNORATES } from "@/lib/yemen";
import { formatMoney } from "@/lib/store";

export const Route = createFileRoute("/admin/delivery")({
  head: () => ({
    meta: [
      { title: "إعدادات ومناطق التوصيل | لوحة التحكم" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDelivery,
});

function AdminDelivery() {
  const qc = useQueryClient();
  const { data: zones = [], isLoading } = useDeliveryZones();
  const { data: settings } = useAdminSettings();
  const { label: currency } = useAdminCurrency();
  const { can, isViewer, isAddOnly } = useAdmin();
  const canAdd = can("add_delivery") && !isViewer;
  const canEdit = can("manage_delivery") && !isViewer && !isAddOnly;
  const canDelete = can("delete_delivery") && !isViewer && !isAddOnly;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [gov, setGov] = useState<string>(YEMEN_GOVERNORATES[0] ?? "");
  const [fee, setFee] = useState("2000");
  const [addingBatch, setAddingBatch] = useState(false);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["delivery-zones"] });
    await qc.invalidateQueries({ queryKey: ["admin", "settings"] });
  };

  const addZone = async () => {
    if (!gov.trim()) {
      toast.error("يرجى اختيار المحافظة");
      return;
    }
    const exists = zones.some((z) => z.governorate.trim() === gov.trim());
    if (exists) {
      toast.error(`منطقة ${gov} مضافة مسبقاً`);
      return;
    }

    const { error } = await supabase.from("delivery_zones").insert({
      governorate: gov,
      fee: Number(fee) || 0,
      sort_order: zones.length,
      is_active: true,
    });

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`تمت إضافة منطقة ${gov} بنجاح`);
    await refresh();
  };

  const updateZone = async (z: DeliveryZone, patch: Partial<DeliveryZone>) => {
    const { error } = await supabase
      .from("delivery_zones")
      .update(patch as never)
      .eq("id", z.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  };

  const removeZone = async (z: DeliveryZone) => {
    if (!confirm(`هل أنت متأكد من حذف منطقة "${z.governorate}"؟`)) return;
    const { error } = await supabase.from("delivery_zones").delete().eq("id", z.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حذف المنطقة");
    await refresh();
  };

  const saveGeneral = async (patch: Record<string, unknown>) => {
    if (!settings?.id) {
      toast.error("لا يوجد سجل إعدادات بعد");
      return;
    }
    const { error } = await supabase
      .from("store_settings")
      .update(patch as never)
      .eq("id", settings.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حفظ إعدادات التوصيل");
    await refresh();
  };

  // استيراد كافة المحافظات اليمنية غير الموجودة دفعة واحدة
  const importAllGovernorates = async () => {
    const existing = new Set(zones.map((z) => z.governorate.trim()));
    const missing = YEMEN_GOVERNORATES.filter((g) => !existing.has(g));

    if (missing.length === 0) {
      toast.info("كافة المحافظات اليمنية مضافة بالفعل");
      return;
    }

    setAddingBatch(true);
    const toInsert = missing.map((g, idx) => ({
      governorate: g,
      fee: g.includes("صنعاء") ? 1500 : 2500,
      sort_order: zones.length + idx,
      is_active: true,
    }));

    const { error } = await supabase.from("delivery_zones").insert(toInsert);
    setAddingBatch(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`تم استيراد ${toInsert.length} محافظة يمنية بنجاح`);
    await refresh();
  };

  const s = settings as unknown as {
    delivery_enabled?: boolean;
    delivery_default_fee?: number;
    free_delivery_until?: string | null;
  } | null;

  // الإحصائيات
  const activeCount = zones.filter((z) => z.is_active).length;
  const avgFee =
    zones.length > 0 ? Math.round(zones.reduce((s, z) => s + Number(z.fee), 0) / zones.length) : 0;
  const isFreeDeliveryActive = !!(
    s?.free_delivery_until && new Date(s.free_delivery_until) > new Date()
  );

  // التصفية والبحث
  const filteredZones = useMemo(() => {
    return zones.filter((z) => {
      const matchQuery = z.governorate.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" ? true : statusFilter === "active" ? z.is_active : !z.is_active;
      return matchQuery && matchStatus;
    });
  }, [zones, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* الترويسة الرئيسية */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl flex items-center gap-2.5">
            <Truck className="h-7 w-7 text-primary" />
            <span>إدارة الشحن ومناطق التوصيل</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            تحديد رسوم التوصيل لكل محافظة، تفعيل أو إيقاف التوصيل، وإدارة عروض الشحن المجاني
            المؤقتة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={addingBatch}
            onClick={importAllGovernorates}
            className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-soft transition-all hover:bg-secondary hover:text-primary active:scale-95 disabled:opacity-50"
          >
            <StoreLogo className="h-4 w-4 text-primary" />
            <span>{addingBatch ? "جاري الاستيراد..." : "استيراد جميع المحافظات"}</span>
          </button>
        </div>
      </div>

      {/* بطاقات Bento للإحصائيات */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">حالة التوصيل</span>
            <div
              className={`rounded-xl p-2 ${s?.delivery_enabled !== false ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}
            >
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-display font-extrabold text-foreground">
            {s?.delivery_enabled !== false ? "خدمة مفعلة" : "شحن مجاني للكل"}
          </p>
          <span className="text-[10px] text-muted-foreground">حسب إعدادات المتجر العامة</span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">المناطق النشطة</span>
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-display font-extrabold text-foreground">
            {activeCount}{" "}
            <span className="text-xs text-muted-foreground font-normal">من أصل {zones.length}</span>
          </p>
          <span className="text-[10px] text-emerald-600 font-bold">جاهزة لاستقبال الطلبات</span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">متوسط الرسوم</span>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-display font-extrabold text-foreground">
            {formatMoney(avgFee, currency)}
          </p>
          <span className="text-[10px] text-muted-foreground">
            الافتراضي: {formatMoney(Number(s?.delivery_default_fee ?? 2000), currency)}
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">حملة الشحن المجاني</span>
            <div
              className={`rounded-xl p-2 ${isFreeDeliveryActive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
            >
              <Gift className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-display font-extrabold text-foreground">
            {isFreeDeliveryActive ? "عرض نشط حالياً" : "لا يوجد عرض"}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {s?.free_delivery_until
              ? `ينتهي في ${new Date(s.free_delivery_until).toLocaleDateString("ar-EG")}`
              : "غير محدد"}
          </span>
        </div>
      </div>

      {/* لوحة الإعدادات العامة للشحن */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-sm font-extrabold text-foreground flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span>السياسات العامة للشحن والتوصيل</span>
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">
              نظام احتساب الرسوم
            </label>
            <select
              value={s?.delivery_enabled === false ? "off" : "on"}
              onChange={(e) => void saveGeneral({ delivery_enabled: e.target.value === "on" })}
              className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold outline-none focus:border-primary"
            >
              <option value="on">مفعّل (يتم احتساب الرسوم حسب المنطقة)</option>
              <option value="off">موقوف بالكامل (توصيل مجاني لجميع الطلبات)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">
              الرسوم الافتراضية للمناطق غير المحددة
            </label>
            <div className="relative">
              <input
                type="number"
                defaultValue={String(s?.delivery_default_fee ?? 2000)}
                onBlur={(e) =>
                  void saveGeneral({ delivery_default_fee: Number(e.target.value) || 0 })
                }
                className="w-full rounded-2xl border border-border bg-background py-2.5 pe-12 ps-4 text-xs font-extrabold outline-none focus:border-primary"
              />
              <span className="absolute inset-y-0 end-3 flex items-center text-[10px] font-bold text-muted-foreground">
                {currency}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">
              توصيل مجاني ترويجي حتى تاريخ
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                defaultValue={s?.free_delivery_until ? s.free_delivery_until.slice(0, 10) : ""}
                onChange={(e) =>
                  void saveGeneral({
                    free_delivery_until: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
                className="flex-1 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-bold outline-none focus:border-primary"
              />
              {s?.free_delivery_until && (
                <button
                  type="button"
                  onClick={() => void saveGeneral({ free_delivery_until: null })}
                  className="rounded-2xl border border-border px-3 text-xs font-bold text-destructive hover:bg-destructive/10"
                  title="إلغاء الحملة"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* نموذج إضافة منطقة جديدة */}
      {canAdd && (
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-sm font-extrabold text-foreground flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <span>إضافة منطقة توصيل جديدة</span>
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="min-w-[200px] flex-1">
              <select
                value={gov}
                onChange={(e) => setGov(e.target.value)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold outline-none focus:border-primary"
              >
                {YEMEN_GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-36">
              <input
                type="number"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="الرسوم"
                className="w-full rounded-2xl border border-border bg-background py-2.5 pe-12 ps-4 text-xs font-extrabold outline-none focus:border-primary"
              />
              <span className="absolute inset-y-0 end-3 flex items-center text-[10px] font-bold text-muted-foreground">
                {currency}
              </span>
            </div>

            <button
              type="button"
              onClick={addZone}
              className="flex items-center gap-1.5 rounded-2xl gradient-gold px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft transition-transform hover:opacity-95 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة المنطقة</span>
            </button>
          </div>
        </div>
      )}

      {/* شريط البحث وتصفية قائمة المناطق */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم المحافظة..."
            className="w-full rounded-2xl border border-border bg-background py-2.5 pe-4 ps-10 text-xs font-medium outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card p-1 shadow-soft">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              statusFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            جميع المناطق ({zones.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              statusFilter === "active"
                ? "bg-emerald-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            النشطة ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("inactive")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              statusFilter === "inactive"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            الموقوفة ({zones.length - activeCount})
          </button>
        </div>
      </div>

      {/* قائمة بطاقات المناطق بتصميم Bento Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredZones.map((z) => {
          return (
            <div
              key={z.id}
              className="rounded-3xl border border-border bg-card p-4 shadow-soft transition-all duration-200 hover:border-primary/40 hover:shadow-lift"
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl ${z.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-extrabold text-foreground">
                      {z.governorate}
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      ترتيب العرض: #{z.sort_order}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => canEdit && void updateZone(z, { is_active: !z.is_active })}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold transition-colors ${
                    z.is_active
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20"
                      : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                  } ${!canEdit ? "opacity-75 cursor-not-allowed" : ""}`}
                >
                  {z.is_active ? "مفعّلة" : "موقوفة"}
                </button>
              </div>

              <div className="mt-3.5 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">رسوم الشحن</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {canEdit ? (
                      <input
                        type="number"
                        defaultValue={String(z.fee)}
                        onBlur={(e) => void updateZone(z, { fee: Number(e.target.value) || 0 })}
                        className="w-24 rounded-xl border border-border bg-background px-2.5 py-1 text-xs font-extrabold outline-none focus:border-primary"
                      />
                    ) : (
                      <span className="px-2 py-1 text-xs font-extrabold text-foreground">
                        {z.fee}
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-primary">{currency}</span>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void updateZone(z, { fee: Math.max(0, Number(z.fee) - 500) })}
                      className="rounded-lg border border-border bg-secondary/50 px-2 py-1 text-xs font-bold text-foreground hover:bg-secondary"
                      title="تخفيض 500"
                    >
                      -500
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateZone(z, { fee: Number(z.fee) + 500 })}
                      className="rounded-lg border border-border bg-secondary/50 px-2 py-1 text-xs font-bold text-foreground hover:bg-secondary"
                      title="زيادة 500"
                    >
                      +500
                    </button>
                  </div>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void removeZone(z)}
                    className="rounded-lg bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
                    title="حذف المنطقة"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredZones.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
            <Truck className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-xs font-bold">لا توجد مناطق تطابق خيارات البحث</p>
            <button
              type="button"
              onClick={importAllGovernorates}
              className="mt-3 inline-flex items-center gap-1.5 rounded-2xl border border-border px-4 py-2 text-xs font-bold text-primary hover:bg-secondary"
            >
              <StoreLogo className="h-3.5 w-3.5 text-primary" /> استيراد المحافظات اليمنية الآن
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
