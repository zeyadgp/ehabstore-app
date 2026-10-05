import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/admin";
import { fetchProductOptions, type OptionKind } from "@/lib/options";
import { useProductColors } from "@/lib/colors";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";

export type ColorRow = {
  id?: string;
  name: string;
  swatch: string;
  images: string[];
  price: string;
  stock: string;
  sku: string;
  color_id?: string | null;
  is_available: boolean;
};

export type SizeRow = {
  id?: string;
  name: string;
  price: string;
  stock: string;
  sku: string;
  is_available: boolean;
};

const emptyColor = (): ColorRow => ({
  name: "",
  swatch: "#E11D48",
  images: [],
  price: "",
  stock: "10",
  sku: "",
  color_id: null,
  is_available: true,
});

const emptySize = (): SizeRow => ({
  name: "",
  price: "",
  stock: "10",
  sku: "",
  is_available: true,
});

/** ألوان مستحضرات وتجميل شائعة للإضافة السريعة بنقرة واحدة */
const QUICK_COLOR_PRESETS = [
  { name: "أحمر كلاسيكي", hex: "#DC2626" },
  { name: "وردي ناعم", hex: "#F472B6" },
  { name: "كشميري / بيري", hex: "#9D174D" },
  { name: "نيود طبيعي", hex: "#D4B895" },
  { name: "عنابي ملكي", hex: "#881337" },
  { name: "مشمشي خوخي", hex: "#FB923C" },
  { name: "بني شوكولاته", hex: "#78350F" },
  { name: "برونزي دافئ", hex: "#B45309" },
  { name: "بنفسجي جذاب", hex: "#7E22CE" },
  { name: "أسود فاحم", hex: "#18181B" },
  { name: "أبيض لؤلؤي", hex: "#F8FAFC" },
  { name: "ذهبي متألق", hex: "#EAB308" },
];

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-1 focus:ring-primary";

export function ProductOptionsEditor({
  productId,
  productImages = [],
}: {
  productId: string;
  productImages?: string[];
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"colors" | "sizes">("colors");
  const [colors, setColors] = useState<ColorRow[]>([]);
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [colorToDelete, setColorToDelete] = useState<{ idx: number; name: string } | null>(null);
  const [sizeToDelete, setSizeToDelete] = useState<{ idx: number; name: string } | null>(null);
  const [pickingFromGeneralIdx, setPickingFromGeneralIdx] = useState<number | null>(null);

  const { data: palette = [] } = useProductColors();

  // تحميل خيارات المنتج الحالية
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const options = await fetchProductOptions(productId);
        if (!alive) return;
        const colorOpts = options.find((o) => o.kind === "color")?.values ?? [];
        const sizeOpts = options.find((o) => o.kind === "size")?.values ?? [];

        setColors(
          colorOpts.map((v) => ({
            id: v.id,
            name: v.name,
            swatch: v.swatch || "#E11D48",
            images: Array.isArray(v.images) ? v.images : [],
            color_id: v.color_id ?? null,
            price: v.price != null && Number(v.price) > 0 ? String(v.price) : "",
            stock: String(v.stock ?? 0),
            sku: v.sku ?? "",
            is_available: v.is_available ?? true,
          })),
        );

        setSizes(
          sizeOpts.map((v) => ({
            id: v.id,
            name: v.name,
            price: v.price != null && Number(v.price) > 0 ? String(v.price) : "",
            stock: String(v.stock ?? 0),
            sku: v.sku ?? "",
            is_available: v.is_available ?? true,
          })),
        );
      } catch (err) {
        console.error("Failed to load options", err);
        toast.error("تعذر تحميل ألوان وخيارات المنتج");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [productId]);

  // فحص تكرار الألوان داخل نفس المنتج لمنع التكرار
  const duplicates = useMemo(() => {
    const nameMap = new Map<string, number[]>();
    const hexMap = new Map<string, number[]>();

    colors.forEach((c, idx) => {
      const cleanName = c.name.trim().toLowerCase();
      const cleanHex = c.swatch.trim().toLowerCase();

      if (cleanName) {
        const arr = nameMap.get(cleanName) ?? [];
        arr.push(idx);
        nameMap.set(cleanName, arr);
      }
      if (cleanHex) {
        const arr = hexMap.get(cleanHex) ?? [];
        arr.push(idx);
        hexMap.set(cleanHex, arr);
      }
    });

    const dupIndices = new Set<number>();
    nameMap.forEach((indices) => {
      if (indices.length > 1) indices.forEach((i) => dupIndices.add(i));
    });
    hexMap.forEach((indices) => {
      if (indices.length > 1) indices.forEach((i) => dupIndices.add(i));
    });

    return dupIndices;
  }, [colors]);

  const hasDuplicates = duplicates.size > 0;

  // إضافة لون سريع من قائمة الاقتراحات
  const addPresetColor = (preset: { name: string; hex: string }) => {
    const exists = colors.some(
      (c) =>
        c.name.trim().toLowerCase() === preset.name.toLowerCase() ||
        c.swatch.trim().toLowerCase() === preset.hex.toLowerCase(),
    );
    if (exists) {
      toast.warning(`اللون "${preset.name}" مضاف بالفعل في هذا المنتج`);
      return;
    }
    setColors([
      ...colors,
      {
        ...emptyColor(),
        name: preset.name,
        swatch: preset.hex,
      },
    ]);
    toast.success(`تمت إضافة ${preset.name}`);
  };

  // اختيار لون من كتالوج ألوان المتجر
  const addFromPalette = (paletteColorId: string) => {
    const picked = palette.find((c) => c.id === paletteColorId);
    if (!picked) return;

    const exists = colors.some(
      (c) =>
        c.name.trim().toLowerCase() === picked.display_name.toLowerCase() ||
        c.swatch.trim().toLowerCase() === picked.hex_code.toLowerCase(),
    );
    if (exists) {
      toast.warning(`اللون "${picked.display_name}" مضاف بالفعل`);
      return;
    }

    setColors([
      ...colors,
      {
        ...emptyColor(),
        name: picked.display_name,
        swatch: picked.hex_code,
        color_id: picked.id,
      },
    ]);
    toast.success(`تمت إضافة ${picked.display_name}`);
  };

  // تحديث كود HEX مع فحص التنسيق
  const updateHex = (idx: number, rawVal: string) => {
    let hex = rawVal.trim();
    if (!hex.startsWith("#") && hex.length > 0) {
      hex = `#${hex}`;
    }
    setColors(colors.map((c, i) => (i === idx ? { ...c, swatch: hex } : c)));
  };

  // رفع صور خاصة بلون معين
  const onUploadColorImages = async (idx: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingIdx(idx);
    try {
      const paths: string[] = [];
      for (const file of Array.from(files)) {
        const path = await uploadImage(file);
        if (path) paths.push(path);
      }
      if (paths.length > 0) {
        setColors((prev) =>
          prev.map((c, i) => (i === idx ? { ...c, images: [...c.images, ...paths] } : c)),
        );
        toast.success(`تم رفع ${paths.length} صورة للون بنجاح`);
      }
    } catch (err) {
      toast.error("تعذر رفع بعض الصور");
    } finally {
      setUploadingIdx(null);
    }
  };

  // حذف صورة معينة من لون
  const removeColorImage = (colorIdx: number, imgPath: string) => {
    setColors((prev) =>
      prev.map((c, i) =>
        i === colorIdx ? { ...c, images: c.images.filter((img) => img !== imgPath) } : c,
      ),
    );
  };

  // إضافة أو إزالة صورة من صور المنتج العامة إلى هذا اللون
  const toggleGeneralImageToColor = (colorIdx: number, imgPath: string) => {
    setColors((prev) =>
      prev.map((c, i) => {
        if (i !== colorIdx) return c;
        const exists = c.images.includes(imgPath);
        return {
          ...c,
          images: exists ? c.images.filter((img) => img !== imgPath) : [...c.images, imgPath],
        };
      }),
    );
  };

  // إعادة ترتيب الألوان
  const moveColor = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= colors.length) return;
    const next = [...colors];
    const [moved] = next.splice(fromIndex, 1);
    if (moved === undefined) return;
    next.splice(toIndex, 0, moved);
    setColors(next);
  };

  // تأكيد وحذف لون
  const confirmDeleteColor = () => {
    if (!colorToDelete) return;
    const { idx } = colorToDelete;
    const row = colors[idx];
    if (row?.id) {
      setRemoved((p) => [...p, row.id as string]);
    }
    setColors(colors.filter((_, i) => i !== idx));
    setColorToDelete(null);
    toast.success("تم حذف اللون");
  };

  // تأكيد وحذف مقاس
  const confirmDeleteSize = () => {
    if (!sizeToDelete) return;
    const { idx } = sizeToDelete;
    const row = sizes[idx];
    if (row?.id) {
      setRemoved((p) => [...p, row.id as string]);
    }
    setSizes(sizes.filter((_, i) => i !== idx));
    setSizeToDelete(null);
    toast.success("تم حذف المقاس");
  };

  // حفظ الخيارات والألوان في قاعدة البيانات
  const save = async () => {
    if (hasDuplicates) {
      toast.error("يرجى حل تكرار الألوان أو كود HEX أولاً قبل الحفظ");
      return;
    }

    setBusy(true);
    try {
      // 1. حذف السجلات التي تم إزالتها
      if (removed.length > 0) {
        await supabase.from("product_option_values").delete().in("id", removed);
      }

      // 2. حفظ الألوان
      const cleanColors = colors.filter((c) => c.name.trim());
      if (cleanColors.length === 0) {
        await supabase
          .from("product_options")
          .delete()
          .eq("product_id", productId)
          .eq("kind", "color");
      } else {
        const { data: existingColorOpt } = await supabase
          .from("product_options")
          .select("id")
          .eq("product_id", productId)
          .eq("kind", "color")
          .maybeSingle();

        let optionId = existingColorOpt?.id ?? null;
        if (!optionId) {
          const { data: created, error } = await supabase
            .from("product_options")
            .insert({ product_id: productId, kind: "color", name: "اللون", sort_order: 0 })
            .select("id")
            .single();
          if (error) throw error;
          optionId = created.id;
        }

        for (let i = 0; i < cleanColors.length; i++) {
          const c = cleanColors[i]!;
          const payload = {
            option_id: optionId,
            product_id: productId,
            name: c.name.trim(),
            swatch: c.swatch.trim() || "#000000",
            color_id: c.color_id || null,
            images: c.images,
            price: c.price && Number(c.price) > 0 ? Number(c.price) : null,
            stock: Number(c.stock || 0),
            sku: c.sku.trim() || null,
            is_available: c.is_available,
            sort_order: i,
          };

          if (c.id) {
            const { error } = await supabase
              .from("product_option_values")
              .update(payload)
              .eq("id", c.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("product_option_values").insert(payload);
            if (error) throw error;
          }
        }
      }

      // 3. حفظ المقاسات
      const cleanSizes = sizes.filter((s) => s.name.trim());
      if (cleanSizes.length === 0) {
        await supabase
          .from("product_options")
          .delete()
          .eq("product_id", productId)
          .eq("kind", "size");
      } else {
        const { data: existingSizeOpt } = await supabase
          .from("product_options")
          .select("id")
          .eq("product_id", productId)
          .eq("kind", "size")
          .maybeSingle();

        let optionId = existingSizeOpt?.id ?? null;
        if (!optionId) {
          const { data: created, error } = await supabase
            .from("product_options")
            .insert({ product_id: productId, kind: "size", name: "المقاس", sort_order: 1 })
            .select("id")
            .single();
          if (error) throw error;
          optionId = created.id;
        }

        for (let i = 0; i < cleanSizes.length; i++) {
          const s = cleanSizes[i]!;
          const payload = {
            option_id: optionId,
            product_id: productId,
            name: s.name.trim(),
            price: s.price && Number(s.price) > 0 ? Number(s.price) : null,
            stock: Number(s.stock || 0),
            sku: s.sku.trim() || null,
            is_available: s.is_available,
            sort_order: i,
          };

          if (s.id) {
            const { error } = await supabase
              .from("product_option_values")
              .update(payload)
              .eq("id", s.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("product_option_values").insert(payload);
            if (error) throw error;
          }
        }
      }

      setRemoved([]);
      // تحديث الكاش
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["product-options", productId] }),
        qc.invalidateQueries({ queryKey: ["products-with-options"] }),
        qc.invalidateQueries({ queryKey: ["product-color-links"] }),
        qc.invalidateQueries({ queryKey: ["admin", "products"] }),
      ]);

      toast.success("تم حفظ ألوان وخيارات المنتج بنجاح");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "تعذر حفظ الخيارات");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> جاري تحميل خيارات المنتج…
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
      {/* الترويسة وأزرار التبديل */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
            <Palette className="h-4 w-4 text-primary" /> خيارات وألوان المنتج المتقدمة
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            تحكمي بسهولة في ألوان المنتج، رموز HEX، صور كل لون ومخزونه مع خاصية السحب والإفلات.
          </p>
        </div>

        {/* شريط تبديل التبويبات */}
        <div className="flex rounded-xl border border-border bg-secondary/50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("colors")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === "colors"
                ? "bg-card text-primary shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>الألوان</span>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-extrabold text-primary">
              {colors.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sizes")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === "sizes"
                ? "bg-card text-primary shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>المقاسات / السعة</span>
            <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-extrabold text-muted-foreground">
              {sizes.length}
            </span>
          </button>
        </div>
      </div>

      {/* تحذير التكرار */}
      {hasDuplicates && activeTab === "colors" && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-bold text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            تنبيه: يوجد ألوان مكررة بنفس الاسم أو كود HEX! يرجى تصحيحها لضمان تجربة ممتازة للعملاء.
          </span>
        </div>
      )}

      {/* ===================== قسم الألوان ===================== */}
      {activeTab === "colors" && (
        <div className="mt-5 space-y-4">
          {/* شريط الإضافة السريعة والاقتراحات */}
          <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-bold text-foreground">
                إضافة سريعة من الدرجات الأكثر طلباً:
              </span>
              {palette.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground">من الكتالوج:</span>
                  <select
                    className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs outline-none focus:border-primary"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addFromPalette(e.target.value);
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">اختر من كتالوج المتجر…</option>
                    {palette.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} ({p.family})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* فقاعات الألوان السريعة */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {QUICK_COLOR_PRESETS.map((p) => (
                <button
                  key={p.hex + p.name}
                  type="button"
                  onClick={() => addPresetColor(p)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2 py-1 text-[11px] font-medium text-foreground transition hover:border-primary/60 hover:bg-secondary active:scale-95"
                  title={`إضافة ${p.name}`}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-black/20 shadow-xs"
                    style={{ backgroundColor: p.hex }}
                  />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* قائمة كروت الألوان */}
          {colors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-8 text-center">
              <Palette className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-2 text-xs font-bold text-foreground">
                لا توجد ألوان مضافة لهذا المنتج بعد
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                اختر من الألوان المقترحة بالأعلى، أو اضغط على زر "إضافة لون مخصص".
              </p>
              <button
                type="button"
                onClick={() => setColors([...colors, emptyColor()])}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> إضافة لون مخصص
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {colors.map((c, i) => {
                const isDup = duplicates.has(i);
                return (
                  <div
                    key={c.id ?? `color-${i}`}
                    draggable
                    onDragStart={() => setDraggedIdx(i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedIdx !== null && draggedIdx !== i) {
                        moveColor(draggedIdx, i);
                        setDraggedIdx(i);
                      }
                    }}
                    onDragEnd={() => setDraggedIdx(null)}
                    className={`group relative rounded-2xl border transition-all ${
                      isDup
                        ? "border-destructive bg-destructive/5"
                        : "border-border bg-card shadow-soft hover:border-primary/50"
                    } p-3 sm:p-4`}
                  >
                    {/* الصف العلوي: مقبض السحب، Color Picker، اسم اللون، HEX، المخزون، وأزرار الحذف/الترتيب */}
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                      {/* مقبض السحب وأزرار الترتيب */}
                      <div className="flex items-center gap-0.5">
                        <div
                          className="cursor-grab text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
                          title="اسحبي لإعادة الترتيب"
                        >
                          <GripVertical className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={i === 0}
                            onClick={() => moveColor(i, i - 1)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                            title="تحريك لأعلى"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={i === colors.length - 1}
                            onClick={() => moveColor(i, i + 1)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                            title="تحريك لأسفل"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Color Picker الدائري الذكي */}
                      <label
                        className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-border shadow-soft transition hover:scale-105 active:scale-95"
                        style={{ backgroundColor: c.swatch || "#000000" }}
                        title="اختر اللون من منتقي الألوان"
                      >
                        <input
                          type="color"
                          value={
                            c.swatch?.startsWith("#") && c.swatch.length === 7
                              ? c.swatch
                              : "#E11D48"
                          }
                          onChange={(e) =>
                            setColors(
                              colors.map((x, ix) =>
                                ix === i ? { ...x, swatch: e.target.value.toUpperCase() } : x,
                              ),
                            )
                          }
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        <span className="sr-only">Color Picker</span>
                      </label>

                      {/* اسم اللون */}
                      <div className="min-w-[130px] flex-1">
                        <label className="mb-0.5 block text-[10px] font-bold text-muted-foreground">
                          اسم اللون / الدرجة
                        </label>
                        <input
                          className={inputCls}
                          placeholder="مثال: أحمر مخملي 01"
                          value={c.name}
                          onChange={(e) =>
                            setColors(
                              colors.map((x, ix) =>
                                ix === i ? { ...x, name: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>

                      {/* كود HEX */}
                      <div className="w-24 shrink-0 sm:w-28">
                        <label className="mb-0.5 block text-[10px] font-bold text-muted-foreground">
                          كود HEX
                        </label>
                        <input
                          className={`${inputCls} font-mono uppercase`}
                          placeholder="#E11D48"
                          maxLength={7}
                          value={c.swatch}
                          onChange={(e) => updateHex(i, e.target.value)}
                        />
                      </div>

                      {/* المخزون */}
                      <div className="w-16 shrink-0 sm:w-20">
                        <label className="mb-0.5 block text-[10px] font-bold text-muted-foreground">
                          المخزون
                        </label>
                        <input
                          type="number"
                          min="0"
                          className={inputCls}
                          placeholder="0"
                          value={c.stock}
                          onChange={(e) =>
                            setColors(
                              colors.map((x, ix) =>
                                ix === i ? { ...x, stock: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>

                      {/* رمز SKU اختياري */}
                      <div className="w-20 shrink-0 sm:w-24">
                        <label className="mb-0.5 block text-[10px] font-bold text-muted-foreground">
                          SKU (اختياري)
                        </label>
                        <input
                          className={inputCls}
                          placeholder="RED-01"
                          value={c.sku}
                          onChange={(e) =>
                            setColors(
                              colors.map((x, ix) => (ix === i ? { ...x, sku: e.target.value } : x)),
                            )
                          }
                        />
                      </div>

                      {/* سعر خاص (اختياري) */}
                      <div className="w-20 shrink-0 sm:w-24">
                        <label className="mb-0.5 block text-[10px] font-bold text-muted-foreground">
                          سعر خاص
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={inputCls}
                          placeholder="افتراضي"
                          value={c.price}
                          onChange={(e) =>
                            setColors(
                              colors.map((x, ix) =>
                                ix === i ? { ...x, price: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>

                      {/* زر الحذف مع تأكيد */}
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() =>
                            setColorToDelete({ idx: i, name: c.name || `اللون ${i + 1}` })
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-destructive transition hover:bg-destructive/10 active:scale-95"
                          title="حذف هذا اللون"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* الصف السفلي داخل بطاقة اللون: معرض صور هذا اللون */}
                    <div className="mt-3 border-t border-border/70 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-foreground">
                            <ImageIcon className="h-3.5 w-3.5 text-primary" /> صور اللون الخاص (
                            {c.images.length})
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            — تظهر تلقائياً في صفحة المنتج عند اختيار هذا اللون
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {productImages.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPickingFromGeneralIdx(pickingFromGeneralIdx === i ? null : i)
                              }
                              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition active:scale-95 ${
                                pickingFromGeneralIdx === i
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-secondary/50 text-foreground hover:bg-secondary"
                              }`}
                              title="اختيار صور من صور المنتج المرفوعة مسبقاً"
                            >
                              <Layers className="h-3.5 w-3.5 text-primary" />
                              <span>من صور المنتج ({productImages.length})</span>
                            </button>
                          )}

                          {/* زر رفع صور لهذا اللون */}
                          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-[11px] font-bold text-foreground transition hover:border-primary/60 hover:bg-secondary active:scale-95">
                            {uploadingIdx === i ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : (
                              <Upload className="h-3.5 w-3.5 text-primary" />
                            )}
                            <span>{uploadingIdx === i ? "جاري الرفع…" : "رفع صور"}</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={uploadingIdx !== null}
                              className="hidden"
                              onChange={(e) => void onUploadColorImages(i, e.target.files)}
                            />
                          </label>
                        </div>
                      </div>

                      {/* لوحة اختيار صور من صور المنتج العامة لهذا اللون */}
                      {pickingFromGeneralIdx === i && productImages.length > 0 && (
                        <div className="mt-2.5 rounded-2xl border border-primary/40 bg-secondary/20 p-2.5 animate-fade-in">
                          <p className="text-[11px] font-bold text-foreground">
                            انقري على أي صورة لإضافتها أو إزالتها من هذا اللون:
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {productImages.map((pImg, pIdx) => {
                              const selected = c.images.includes(pImg);
                              return (
                                <button
                                  key={pImg + pIdx}
                                  type="button"
                                  onClick={() => toggleGeneralImageToColor(i, pImg)}
                                  className={`relative h-14 w-14 overflow-hidden rounded-xl border-2 transition active:scale-95 ${
                                    selected
                                      ? "border-primary ring-2 ring-primary/40"
                                      : "border-border/80 opacity-70 hover:opacity-100"
                                  }`}
                                >
                                  <SmartImage
                                    paths={[pImg]}
                                    fallback={fallbackFor()}
                                    alt="صورة المنتج"
                                    className="h-full w-full object-cover"
                                  />
                                  {selected && (
                                    <span className="absolute inset-0 flex items-center justify-center bg-primary/30 text-white font-extrabold text-xs">
                                      ✓
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* معرض صور اللون */}
                      {c.images.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {c.images.map((img, imgIdx) => (
                            <div
                              key={img + imgIdx}
                              className="group/img relative h-16 w-16 overflow-hidden rounded-xl border border-border bg-secondary/30 shadow-xs"
                            >
                              <SmartImage
                                paths={[img]}
                                fallback={fallbackFor()}
                                alt={c.name}
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeColorImage(i, img)}
                                className="absolute start-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white opacity-90 shadow-sm transition hover:opacity-100 group-hover/img:scale-110"
                                title="حذف الصورة"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* زر إضافة لون جديد في نهاية القائمة */}
          <button
            type="button"
            onClick={() => setColors([...colors, emptyColor()])}
            className="flex items-center gap-2 rounded-xl border border-dashed border-primary/50 bg-secondary/20 px-4 py-2.5 text-xs font-bold text-primary transition hover:bg-secondary/40 active:scale-98"
          >
            <Plus className="h-4 w-4" /> إضافة لون آخر
          </button>
        </div>
      )}

      {/* ===================== قسم المقاسات ===================== */}
      {activeTab === "sizes" && (
        <div className="mt-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            أضف مقاسات المنتج أو السعة (مثل: 50ml, 100ml, S, M, L) مع تحديد السعر والمخزون لكل مقاس.
          </p>

          {sizes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-8 text-center">
              <p className="text-xs font-bold text-foreground">لا توجد مقاسات مضافة لهذا المنتج</p>
              <button
                type="button"
                onClick={() => setSizes([...sizes, emptySize()])}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> إضافة مقاس / سعة
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sizes.map((s, i) => (
                <div
                  key={s.id ?? `size-${i}`}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft"
                >
                  <div className="min-w-[120px] flex-1">
                    <label className="mb-0.5 block text-[10px] font-bold text-muted-foreground">
                      المقاس / السعة
                    </label>
                    <input
                      className={inputCls}
                      placeholder="مثال: 50ml أو L"
                      value={s.name}
                      onChange={(e) =>
                        setSizes(
                          sizes.map((x, ix) => (ix === i ? { ...x, name: e.target.value } : x)),
                        )
                      }
                    />
                  </div>

                  <div className="w-24 shrink-0 sm:w-28">
                    <label className="mb-0.5 block text-[10px] font-bold text-muted-foreground">
                      السعر الخاص
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputCls}
                      placeholder="سعر افتراضي"
                      value={s.price}
                      onChange={(e) =>
                        setSizes(
                          sizes.map((x, ix) => (ix === i ? { ...x, price: e.target.value } : x)),
                        )
                      }
                    />
                  </div>

                  <div className="w-20 shrink-0 sm:w-24">
                    <label className="mb-0.5 block text-[10px] font-bold text-muted-foreground">
                      المخزون
                    </label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      placeholder="0"
                      value={s.stock}
                      onChange={(e) =>
                        setSizes(
                          sizes.map((x, ix) => (ix === i ? { ...x, stock: e.target.value } : x)),
                        )
                      }
                    />
                  </div>

                  <div className="w-24 shrink-0 sm:w-28">
                    <label className="mb-0.5 block text-[10px] font-bold text-muted-foreground">
                      SKU
                    </label>
                    <input
                      className={inputCls}
                      placeholder="SIZE-50ML"
                      value={s.sku}
                      onChange={(e) =>
                        setSizes(
                          sizes.map((x, ix) => (ix === i ? { ...x, sku: e.target.value } : x)),
                        )
                      }
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => setSizeToDelete({ idx: i, name: s.name || `المقاس ${i + 1}` })}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-destructive transition hover:bg-destructive/10 active:scale-95"
                      title="حذف هذا المقاس"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setSizes([...sizes, emptySize()])}
                className="flex items-center gap-1.5 rounded-xl border border-dashed border-primary/50 bg-secondary/20 px-3 py-2 text-xs font-bold text-primary transition hover:bg-secondary/40"
              >
                <Plus className="h-4 w-4" /> إضافة مقاس آخر
              </button>
            </div>
          )}
        </div>
      )}

      {/* زر الحفظ النهائي */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-[11px] text-muted-foreground">
          {hasDuplicates ? (
            <span className="font-bold text-destructive">
              ⚠️ يرجى إزالة التكرار لتفعيل زر الحفظ.
            </span>
          ) : (
            <span>اضغط على "حفظ الخيارات والألوان" لاعتماد التعديلات فوراً في المتجر.</span>
          )}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={busy || hasDuplicates}
          className="flex items-center gap-2 rounded-xl gradient-gold px-6 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft transition hover:opacity-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> حفظ الخيارات والألوان
            </>
          )}
        </button>
      </div>

      {/* نافذة تأكيد حذف اللون */}
      {colorToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <h4 className="text-sm font-extrabold text-foreground">تأكيد حذف اللون</h4>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              هل أنتِ متأكدة من حذف اللون{" "}
              <span className="font-bold text-foreground">"{colorToDelete.name}"</span>؟ سيتم حذف
              الصور والمخزون المرتبط به من هذا المنتج.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setColorToDelete(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={confirmDeleteColor}
                className="rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-white shadow-soft transition hover:bg-destructive/90"
              >
                نعم، احذف اللون
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تأكيد حذف المقاس */}
      {sizeToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <h4 className="text-sm font-extrabold text-foreground">تأكيد حذف المقاس</h4>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              هل أنتِ متأكدة من حذف المقاس{" "}
              <span className="font-bold text-foreground">"{sizeToDelete.name}"</span> من هذا
              المنتج؟
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSizeToDelete(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={confirmDeleteSize}
                className="rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-white shadow-soft transition hover:bg-destructive/90"
              >
                نعم، احذف المقاس
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
