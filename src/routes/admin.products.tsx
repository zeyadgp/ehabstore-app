import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpDown,
  Check as CheckIcon,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/admin/ui/AdminUI";
import { enhanceProductImage } from "@/lib/ai-image.functions";
import { generateProductCopy } from "@/lib/product-copy.functions";
import { SmartImage } from "@/components/SmartImage";
import { uploadImage, useAdminCategories, useAllProducts, useAdminCurrency } from "@/lib/admin";
import { fallbackFor } from "@/lib/images";
import { flattenCategories, formatMoney, slugify, type Product } from "@/lib/store";
import { useCurrencies } from "@/lib/currency";
import { webpifyStoredImage } from "@/lib/image-optimize";
import { ProductOptionsEditor } from "@/components/admin/ProductOptionsEditor";
import { useProductsWithOptions } from "@/lib/options";
import { getMetaConfig } from "@/lib/meta/storage";
import { syncProductsToMeta } from "@/lib/meta/api";
import { useProductCosts } from "@/lib/suppliers";
import { useAdmin } from "@/hooks/useAdmin";
import { ProductImportModal } from "@/components/admin/ProductImportModal";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

export const Route = createFileRoute("/admin/products")({
  head: () => ({
    meta: [{ title: "المنتجات | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminProducts,
});

type Draft = {
  id?: string;
  name: string;
  sku: string;
  description: string;
  ingredients: string;
  usage_instructions: string;
  price: string;
  discount_price: string;
  cost_price: string;
  category_id: string;
  brand_id: string;
  show_brand_only: boolean;
  stock: string;
  status: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  images: string[];
  prices: Record<string, { price: string; discount_price: string }>;
  extra: string[];
};

const emptyDraft: Draft = {
  name: "",
  sku: "",
  description: "",
  ingredients: "",
  usage_instructions: "",
  price: "",
  discount_price: "",
  cost_price: "",
  category_id: "",
  brand_id: "",
  show_brand_only: false,
  stock: "0",
  status: true,
  is_featured: false,
  is_bestseller: false,
  images: [],
  prices: {},
  extra: [],
};

/** Keeps the many-to-many product↔category links in sync with the draft. */
async function saveLinks(productId: string, mainId: string, extra: string[]) {
  const ids = Array.from(new Set([mainId, ...extra].filter(Boolean)));
  await supabase.from("product_categories").delete().eq("product_id", productId);
  if (ids.length > 0) {
    await supabase
      .from("product_categories")
      .insert(ids.map((category_id) => ({ product_id: productId, category_id })));
  }
}

async function saveOverrides(productId: string, draft: Draft) {
  const entries = Object.entries(draft.prices);
  for (const [code, v] of entries) {
    const price = v.price.trim() === "" ? null : Number(v.price);
    const discount = v.discount_price.trim() === "" ? null : Number(v.discount_price);
    if (price == null && discount == null) {
      await supabase
        .from("product_prices")
        .delete()
        .eq("product_id", productId)
        .eq("currency_code", code);
      continue;
    }
    await supabase
      .from("product_prices")
      .upsert(
        { product_id: productId, currency_code: code, price, discount_price: discount },
        { onConflict: "product_id,currency_code" },
      );
  }
}

function AdminProducts() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useAllProducts();
  const { data: categories = [] } = useAdminCategories();
  const { data: currencies = [] } = useCurrencies();
  const { label } = useAdminCurrency();
  const { data: productsWithOptions } = useProductsWithOptions();
  const { costs, saveProductCosts } = useProductCosts();
  const { can, isViewer, isAddOnly } = useAdmin();
  const canAdd = can("add_products") && !isViewer;
  const canEdit = can("edit_products") && !isViewer && !isAddOnly;
  const canDelete = can("delete_products") && !isViewer && !isAddOnly;
  const canManage = canEdit;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [modalTab, setModalTab] = useState<"basic" | "pricing" | "images" | "options">("basic");
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "price_desc" | "price_asc" | "stock_desc" | "stock_asc" | "name"
  >("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [enhancing, setEnhancing] = useState<string | null>(null);
  const [aiCopyBusy, setAiCopyBusy] = useState(false);
  const generateCopy = useServerFn(generateProductCopy);

  /** توليد وصف المنتج بالذكاء الاصطناعي من اسمه وصورته وتعبئته في خانة الوصف. */
  const aiWriteDescription = async () => {
    if (!draft) return;
    if (!draft.name.trim() && draft.images.length === 0) {
      toast.error("اكتب اسم المنتج أو أضف صورته أولاً");
      return;
    }
    setAiCopyBusy(true);
    try {
      let imageDataUrl: string | undefined;
      const firstImage = draft.images[0];
      if (firstImage) {
        try {
          if (firstImage.startsWith("data:image/")) {
            imageDataUrl = firstImage;
          } else {
            const blob = await (await fetch(firstImage)).blob();
            if (blob.size <= 4 * 1024 * 1024 && blob.type.startsWith("image/")) {
              imageDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error("read failed"));
                reader.readAsDataURL(blob);
              });
            }
          }
        } catch {
          /* نكمل بدون الصورة */
        }
      }
      const info = [
        `اسم المنتج: ${draft.name || "غير محدد"}`,
        draft.price ? `السعر: ${draft.price}` : "",
        draft.discount_price ? `سعر الخصم: ${draft.discount_price}` : "",
        draft.description ? `الوصف الحالي: ${draft.description}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const out = await generateCopy({
        data: { info, ...(imageDataUrl ? { imageDataUrl } : {}) },
      });
      const descriptionMatch = out.text.match(/## وصف تسويقي[^\n]*\n([\s\S]*?)(?=\n## |$)/);
      const ingredientsMatch = out.text.match(/## المكونات[^\n]*\n([\s\S]*?)(?=\n## |$)/);
      const usageMatch = out.text.match(/## طريقة الاستخدام[^\n]*\n([\s\S]*?)(?=\n## |$)/);
      const description = (descriptionMatch?.[1] ?? out.text).trim();
      setDraft({
        ...draft,
        description,
        ingredients: ingredientsMatch?.[1]?.trim() ?? draft.ingredients,
        usage_instructions: usageMatch?.[1]?.trim() ?? draft.usage_instructions,
      });
      toast.success("تم إنشاء تفاصيل المنتج وتعبئتها");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إنشاء الوصف");
    } finally {
      setAiCopyBusy(false);
    }
  };
  const enhance = useServerFn(enhanceProductImage);

  const exportAllProductsCsv = () => {
    try {
      const headers = [
        "المعرف",
        "رمز SKU",
        "اسم المنتج",
        "الوصف",
        "سعر البيع",
        "سعر الخصم",
        "سعر التكلفة",
        "الكمية في المخزون",
        "القسم",
        "الصور",
        "الحالة",
      ];
      const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
      const rows = products.map((p) => {
        const costVal = costs[p.id]?.cost_price ?? Math.round(Number(p.price || 0) * 0.65);
        const catName = p.category_id ? categoryMap.get(p.category_id) || "" : "";
        const descSafe = (p.description || "").replace(/"/g, '""').replace(/\n/g, " ");
        const nameSafe = (p.name || "").replace(/"/g, '""');
        const imagesSafe = (p.images || []).join(" | ");

        return [
          p.id,
          p.sku || "",
          `"${nameSafe}"`,
          `"${descSafe}"`,
          p.price ?? 0,
          p.discount_price ?? "",
          costVal,
          p.stock ?? 0,
          `"${catName}"`,
          `"${imagesSafe}"`,
          p.status ? "نشط" : "معطل",
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ehab-products-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `تم تصدير كتالوج المنتجات بالكامل (${products.length} منتج) بنجاح بصيغة Excel/CSV`,
      );
    } catch {
      toast.error("تعذر تصدير ملف المنتجات");
    }
  };

  const brandCats = categories
    .filter((c) => c.kind === "brand")
    .sort((a, b) => a.sort_order - b.sort_order);
  const brandIds = new Set(brandCats.map((c) => c.id));
  const mainCats = flattenCategories(categories).filter(
    ({ category }) => !brandIds.has(category.id),
  );

  const onEnhance = async (path: string) => {
    if (!draft) return;
    setEnhancing(path);
    try {
      const res = await enhance({ data: { path } });
      const optimized = await webpifyStoredImage(res.path, "products");
      setDraft((prev) =>
        prev ? { ...prev, images: prev.images.map((i) => (i === path ? optimized : i)) } : prev,
      );
      toast.success("تم تحسين الصورة بالذكاء الاصطناعي");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تحسين الصورة");
    } finally {
      setEnhancing(null);
    }
  };

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "products"] });
    await qc.invalidateQueries({ queryKey: ["products"] });
    await qc.invalidateQueries({ queryKey: ["product-prices"] });
    await qc.invalidateQueries({ queryKey: ["products-with-options"] });
    await qc.invalidateQueries({ queryKey: ["product-categories"] });
    await qc.invalidateQueries({ queryKey: ["product-category-links"] });
    await qc.invalidateQueries({ queryKey: ["brands"] });
  };

  const openNew = () => {
    setDraft({ ...emptyDraft });
    setModalTab("basic");
  };

  const openEdit = async (
    p: Product,
    tab: "basic" | "pricing" | "images" | "options" = "basic",
  ) => {
    const { data: rows } = await supabase
      .from("product_prices")
      .select("currency_code, price, discount_price")
      .eq("product_id", p.id);
    const { data: linkRows } = await supabase
      .from("product_categories")
      .select("category_id")
      .eq("product_id", p.id);
    const prices: Draft["prices"] = {};
    (rows ?? []).forEach((r) => {
      prices[r.currency_code] = {
        price: r.price != null ? String(r.price) : "",
        discount_price: r.discount_price != null ? String(r.discount_price) : "",
      };
    });
    const linkedIds = (linkRows ?? []).map((r) => r.category_id);
    const linkedBrandId = linkedIds.find((id) => brandIds.has(id));
    let detectedBrandId = linkedBrandId ?? "";
    if (!detectedBrandId && p.brand_id) {
      const match = brandCats.find((c) => c.id === p.brand_id || c.slug === (p as any).brand_slug);
      if (match) detectedBrandId = match.id;
    }
    const showBrandOnly = false;
    const existingCost = costs[p.id]?.cost_price ?? (p as any).cost_price;
    setDraft({
      id: p.id,
      name: p.name,
      sku: p.sku ?? "",
      description: p.description ?? "",
      ingredients: p.ingredients ?? "",
      usage_instructions: p.usage_instructions ?? "",
      price: String(p.price),
      discount_price: p.discount_price != null ? String(p.discount_price) : "",
      cost_price: existingCost != null ? String(existingCost) : "",
      category_id: p.category_id ?? "",
      brand_id: detectedBrandId,
      show_brand_only: showBrandOnly,
      stock: String(p.stock),
      status: p.status,
      is_featured: p.is_featured,
      is_bestseller: p.is_bestseller,
      images: (p.images ?? []).slice(0, 5),
      prices,
      extra: linkedIds.filter((id) => id !== p.category_id && !brandIds.has(id)),
    });
    setModalTab(tab);
  };

  const save = async (continueToOptions = false) => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("اسم المنتج مطلوب");
      setModalTab("basic");
      return;
    }
    setBusy(true);
    let createdId: string | null = null;
    try {
      // مزامنة الماركة مع جدول الماركات المستقل
      let brandRowId: string | null = null;
      const brandCat = brandCats.find((c) => c.id === draft.brand_id);
      if (brandCat) {
        const { data: brandRow } = await supabase
          .from("brands")
          .select("id")
          .eq("slug", brandCat.slug)
          .maybeSingle();
        if (brandRow?.id) brandRowId = brandRow.id;
        else {
          const { data: newBrand } = await supabase
            .from("brands")
            .insert({ name: brandCat.name, slug: brandCat.slug, image: brandCat.image })
            .select("id")
            .single();
          brandRowId = newBrand?.id ?? null;
        }
      }
      const payload = {
        brand_id: brandRowId,
        name: draft.name.trim(),
        sku: draft.sku.trim() || null,
        slug: slugify(draft.name),
        description: draft.description.trim() || null,
        ingredients: draft.ingredients.trim() || null,
        usage_instructions: draft.usage_instructions.trim() || null,
        price: Number(draft.price || 0),
        discount_price: draft.discount_price ? Number(draft.discount_price) : null,
        category_id: draft.category_id || null,
        stock: Number(draft.stock || 0),
        status: draft.status,
        is_featured: draft.is_featured,
        is_bestseller: draft.is_bestseller,
        images: draft.images.slice(0, 5),
      };

      const brandCatToLink = !draft.show_brand_only && draft.brand_id ? [draft.brand_id] : [];

      if (draft.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", draft.id);
        if (error) throw error;
        await saveOverrides(draft.id, draft);
        await saveLinks(draft.id, draft.category_id, [...draft.extra, ...brandCatToLink]);
      } else {
        const { data: created, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        createdId = created?.id ?? null;
        if (created?.id) {
          await saveOverrides(created.id, draft);
          await saveLinks(created.id, draft.category_id, [...draft.extra, ...brandCatToLink]);
        }
      }

      // حفظ سعر التكلفة/الشراء إن وُجد (اختياري)
      const targetId = draft.id || createdId;
      if (targetId) {
        const updatedCosts = { ...costs };
        if (draft.cost_price && draft.cost_price.trim() !== "") {
          updatedCosts[targetId] = {
            product_id: targetId,
            cost_price: Number(draft.cost_price),
            supplier_id: costs[targetId]?.supplier_id,
            updated_at: new Date().toISOString(),
          };
        } else {
          delete updatedCosts[targetId];
        }
        await saveProductCosts(updatedCosts);
      }

      toast.success("تم حفظ بيانات المنتج بنجاح");
      await refresh();

      // مزامنة تلقائية فورية مع Meta Catalog إن كانت مفعلة
      try {
        const metaCfg = await getMetaConfig();
        if (metaCfg.auto_sync_enabled) {
          const origin =
            typeof window !== "undefined" ? window.location.origin : "https://ehabstore.app";
          void syncProductsToMeta(
            [
              {
                id: createdId || draft.id || "",
                name: draft.name,
                description: draft.description,
                price: Number(draft.price || 0),
                discount_price: draft.discount_price ? Number(draft.discount_price) : null,
                slug: (draft.name || "").trim().toLowerCase().replace(/\s+/g, "-"),
                images: draft.images,
                stock: Number(draft.stock || 0),
                sku: draft.sku,
                status: draft.status,
              },
            ],
            origin,
          );
        }
      } catch {
        /* ignore */
      }

      if (!draft.id && createdId) {
        // منتج جديد: نُبقي النافذة مفتوحة ونضبط الـ id وننتقل إلى تبويب الألوان
        setDraft({ ...draft, id: createdId });
        if (continueToOptions) {
          setModalTab("options");
          toast.info("تم حفظ المسودة! يمكنك الآن إضافة وتخصيص الألوان فوراً");
        } else {
          setModalTab("options");
        }
      } else if (!continueToOptions) {
        setDraft(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    const { error } = await supabase.from("products").delete().eq("id", productToDelete.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`تم حذف المنتج "${productToDelete.name}" بنجاح`);
    setProductToDelete(null);
    await refresh();
  };

  const toggleStatus = async (p: Product) => {
    const { error } = await supabase.from("products").update({ status: !p.status }).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(p.status ? "تم إخفاء المنتج من المتجر" : "تم عرض المنتج في المتجر");
    await refresh();

    try {
      const metaCfg = await getMetaConfig();
      if (metaCfg.auto_sync_enabled) {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "https://ehabstore.app";
        void syncProductsToMeta([{ ...p, status: !p.status }], origin);
      }
    } catch {
      /* ignore */
    }
  };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length || !draft) return;
    const remaining = Math.max(0, 5 - draft.images.length);
    if (remaining === 0) {
      toast.error("الحد الأقصى خمس صور لكل منتج");
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      toast.info(`تم اختيار أول ${remaining} صور فقط — الحد الأقصى خمس صور`);
    }
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of selected) paths.push(await uploadImage(f));
      setDraft({ ...draft, images: [...draft.images, ...paths].slice(0, 5) });
      toast.success("تم رفع الصور بنجاح");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر رفع الصورة");
    } finally {
      setBusy(false);
    }
  };

  const needle = q.trim().toLowerCase();
  const list = useMemo(() => {
    return products
      .filter(
        (p) =>
          !needle ||
          p.name.toLowerCase().includes(needle) ||
          (p.sku ?? "").toLowerCase().includes(needle),
      )
      .filter((p) => !cat || p.category_id === cat)
      .filter((p) =>
        stockFilter === "all"
          ? true
          : stockFilter === "out"
            ? p.stock === 0
            : stockFilter === "low"
              ? p.stock > 0 && p.stock <= 3
              : p.stock > 3,
      );
  }, [products, needle, cat, stockFilter]);

  const sortedList = useMemo(() => {
    return [...list].sort((a, b) => {
      if (sortBy === "newest") {
        return (b.created_at || "").localeCompare(a.created_at || "");
      }
      if (sortBy === "oldest") {
        return (a.created_at || "").localeCompare(b.created_at || "");
      }
      if (sortBy === "price_desc") {
        const pA = Number(a.discount_price ?? a.price);
        const pB = Number(b.discount_price ?? b.price);
        return pB - pA;
      }
      if (sortBy === "price_asc") {
        const pA = Number(a.discount_price ?? a.price);
        const pB = Number(b.discount_price ?? b.price);
        return pA - pB;
      }
      if (sortBy === "stock_desc") {
        return (b.stock || 0) - (a.stock || 0);
      }
      if (sortBy === "stock_asc") {
        return (a.stock || 0) - (b.stock || 0);
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, "ar");
      }
      return 0;
    });
  }, [list, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedList.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedList.slice(start, start + pageSize);
  }, [sortedList, currentPage, pageSize]);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedList.length && paginatedList.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedList.map((p) => p.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkSetStatus = async (status: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("products").update({ status }).in("id", ids);
      if (error) throw error;
      toast.success(status ? "تم عرض المنتجات المحددة في المتجر" : "تم إخفاء المنتجات المحددة");
      setSelectedIds(new Set());
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإجراء الجماعي");
    } finally {
      setBulkBusy(false);
    }
  };

  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const executeBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
      toast.success(`تم حذف ${ids.length} منتج بنجاح.`);
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      await refresh();
    } catch {
      toast.error("تعذر حذف المنتجات المحددة. حاول مرة أخرى.");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setShowBulkDeleteConfirm(true);
  };

  const stats = [
    { label: "إجمالي المنتجات", value: products.length, tone: "bg-secondary text-foreground" },
    {
      label: "متوفر",
      value: products.filter((p) => p.status && p.stock > 3).length,
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "مخزون منخفض",
      value: products.filter((p) => p.stock > 0 && p.stock <= 3).length,
      tone: "bg-amber-100 text-amber-700",
    },
    {
      label: "نفد المخزون",
      value: products.filter((p) => p.stock === 0).length,
      tone: "bg-rose-100 text-rose-700",
    },
  ];

  return (
    <div className="space-y-5">
      {/* الترويسة وزر منتج جديد */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">إدارة المنتجات والألوان</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            تصفح المنتجات، تعديل الأسعار والمخزون، وإدارة درجات الألوان وصورها الخاصة بكل احترافية.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportAllProductsCsv}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-foreground shadow-soft transition hover:border-primary/60 hover:bg-muted active:scale-95"
            title="تصدير جميع المنتجات إلى ملف Excel أو CSV"
          >
            <Download className="h-4 w-4 text-primary" /> تصدير Excel/CSV
          </button>

          {canAdd && (
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-foreground shadow-soft transition hover:border-primary/60 hover:bg-muted active:scale-95"
              title="استيراد وتحديث المنتجات من ملف Excel أو CSV"
            >
              <Upload className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> استيراد منتجات
            </button>
          )}

          {canAdd && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 rounded-xl gradient-gold px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-soft transition hover:opacity-95 active:scale-95"
            >
              <Plus className="h-4 w-4" /> إضافة منتج جديد
            </button>
          )}
        </div>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-3.5 shadow-soft">
            <p className="text-[11px] font-bold text-muted-foreground">{s.label}</p>
            <span
              className={`mt-1.5 inline-flex rounded-lg px-2.5 py-1 text-sm font-extrabold ${s.tone}`}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* شريط الإجراءات الجماعية عند تحديد منتجات */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3.5 shadow-soft animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-xs font-black text-primary-foreground">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold text-foreground">
              منتجات محددة من أصل {paginatedList.length} في هذه الصفحة
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => bulkSetStatus(true)}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
            >
              عرض في المتجر
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => bulkSetStatus(false)}
              className="rounded-xl bg-secondary px-3 py-1.5 text-xs font-bold text-foreground transition hover:bg-secondary/80 disabled:opacity-50"
            >
              إخفاء من المتجر
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={bulkDeleteSelected}
              className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> حذف المحدد
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition hover:text-foreground"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* شريط البحث، الفلترة، الترتيب ونمط العرض */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="بحث بالاسم أو SKU…"
              className="w-full rounded-xl border border-border bg-background py-2 pe-3 ps-9 text-xs outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            value={cat}
            onChange={(e) => {
              setCat(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold outline-none focus:border-primary"
          >
            <option value="">كل التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value as typeof stockFilter);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold outline-none focus:border-primary"
          >
            <option value="all">كل المخزون</option>
            <option value="in">متوفر (&gt; 3)</option>
            <option value="low">مخزون منخفض (1 - 3)</option>
            <option value="out">نفد المخزون (0)</option>
          </select>

          <div className="flex items-center gap-1">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold outline-none focus:border-primary"
            >
              <option value="newest">الأحدث أولاً</option>
              <option value="oldest">الأقدم أولاً</option>
              <option value="price_desc">السعر: الأعلى للأقل</option>
              <option value="price_asc">السعر: الأقل للأعلى</option>
              <option value="stock_desc">المخزون: الأعلى للأقل</option>
              <option value="stock_asc">المخزون: الأقل للأعلى</option>
              <option value="name">الاسم: أ - ي</option>
            </select>
          </div>
        </div>

        {/* أزرار تبديل نمط العرض (جدول / كروت) */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/30 p-1 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
              viewMode === "table"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="عرض الجدول"
          >
            <List className="h-3.5 w-3.5" /> جدول
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
              viewMode === "cards"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="عرض الكروت"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> كروت
          </button>
        </div>
      </div>

      {/* المحتوى: جدول أو كروت */}
      {viewMode === "table" ? (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-secondary/30 text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={
                        paginatedList.length > 0 && selectedIds.size === paginatedList.length
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded accent-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3 text-start font-bold">صورة</th>
                  <th className="px-3 py-3 text-start font-bold">المنتج و SKU</th>
                  <th className="px-3 py-3 text-start font-bold">التصنيف</th>
                  <th className="px-3 py-3 text-start font-bold">السعر</th>
                  <th className="px-3 py-3 text-start font-bold">الألوان</th>
                  <th className="px-3 py-3 text-start font-bold">المخزون</th>
                  <th className="px-3 py-3 text-start font-bold">الحالة</th>
                  <th className="px-3 py-3 text-start font-bold">تاريخ الإضافة</th>
                  <th className="px-3 py-3 text-end font-bold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedList.map((p) => {
                  const catName = categories.find((c) => c.id === p.category_id)?.name;
                  const hasOptions = productsWithOptions?.has(p.id);
                  const isSelected = selectedIds.has(p.id);
                  const tone =
                    p.stock === 0
                      ? "bg-rose-100 text-rose-700"
                      : p.stock <= 3
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700";

                  const formattedDate = p.created_at
                    ? new Date(p.created_at).toLocaleDateString("ar-EG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr
                      key={p.id}
                      className={`transition hover:bg-secondary/20 ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(p.id)}
                          className="h-4 w-4 rounded accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="relative h-12 w-12 shrink-0">
                          <SmartImage
                            paths={p.images}
                            fallback={fallbackFor(
                              categories.find((c) => c.id === p.category_id)?.slug,
                            )}
                            alt={p.name}
                            className="h-12 w-12 rounded-xl object-cover"
                          />
                          {hasOptions && (
                            <span
                              className="absolute -bottom-1 -start-1 flex h-4 w-4 items-center justify-center rounded-full gradient-gold text-[8px] text-primary-foreground shadow-xs"
                              title="له خيارات ألوان ومقاسات"
                            >
                              🎨
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-extrabold text-foreground line-clamp-1 max-w-[200px]">
                          {p.name}
                        </div>
                        <div dir="ltr" className="text-[10px] text-muted-foreground text-start">
                          SKU: {p.sku ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-foreground">
                          {catName ?? "بدون تصنيف"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-extrabold text-primary">
                          {formatMoney(Number(p.discount_price ?? p.price), label)}
                        </div>
                        {p.discount_price != null && (
                          <div className="text-[10px] text-muted-foreground line-through">
                            {formatMoney(Number(p.price), label)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {hasOptions ? (
                          <button
                            type="button"
                            onClick={() => openEdit(p, "options")}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/20"
                          >
                            <Palette className="h-3 w-3" /> ألوان ومقاسات
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">افتراضي</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
                          {p.stock === 0 ? "نفد" : p.stock}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleStatus(p)}
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
                            p.status
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {p.status ? "معروض" : "مخفي"}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-muted-foreground">
                        {formattedDate}
                      </td>
                      <td className="px-3 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(p, "options")}
                                className="rounded-lg p-1.5 text-primary hover:bg-primary/10"
                                title="إدارة الألوان"
                              >
                                <Palette className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(p, "basic")}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                title="تعديل المنتج"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setProductToDelete(p)}
                              className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                              title="حذف المنتج"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* قائمة كروت المنتجات */
        <div className="grid gap-3.5 lg:grid-cols-2 2xl:grid-cols-3">
          {paginatedList.map((p) => {
            const catName = categories.find((c) => c.id === p.category_id)?.name;
            const hasOptions = productsWithOptions?.has(p.id);
            const isSelected = selectedIds.has(p.id);
            const tone =
              p.stock === 0
                ? "bg-rose-100 text-rose-700"
                : p.stock <= 3
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700";

            return (
              <div
                key={p.id}
                className={`flex flex-col justify-between rounded-3xl border bg-card p-3.5 shadow-soft transition hover:border-primary/40 hover:shadow-lift ${
                  isSelected ? "border-primary ring-1 ring-primary/50" : "border-border"
                }`}
              >
                <div>
                  <div className="flex items-start gap-3">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(p.id)}
                        className="h-4 w-4 rounded accent-primary cursor-pointer"
                      />
                    </div>
                    <div className="relative shrink-0">
                      <SmartImage
                        paths={p.images}
                        fallback={fallbackFor(categories.find((c) => c.id === p.category_id)?.slug)}
                        alt={p.name}
                        className="h-20 w-20 rounded-2xl object-cover"
                      />
                      {hasOptions && (
                        <span
                          className="absolute -bottom-1 -start-1 flex h-6 w-6 items-center justify-center rounded-full gradient-gold text-[10px] text-primary-foreground shadow-xs"
                          title="له خيارات ألوان ومقاسات"
                        >
                          🎨
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className="line-clamp-1 text-sm font-extrabold text-foreground">
                          {p.name}
                        </p>
                      </div>

                      <p dir="ltr" className="mt-0.5 text-start text-[11px] text-muted-foreground">
                        SKU: {p.sku ?? "—"}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-foreground">
                          {catName ?? "بدون تصنيف"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
                          {p.stock === 0 ? "نفد المخزون" : `المخزون: ${p.stock}`}
                        </span>
                        {p.is_featured && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            مميز
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm font-extrabold text-primary">
                        {formatMoney(Number(p.discount_price ?? p.price), label)}
                        {p.discount_price != null && (
                          <span className="ms-2 text-[11px] font-bold text-muted-foreground line-through">
                            {formatMoney(Number(p.price), label)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* أزرار الإجراءات */}
                <div className="mt-3.5 grid grid-cols-4 gap-1.5 border-t border-border/60 pt-3">
                  <button
                    type="button"
                    onClick={() => toggleStatus(p)}
                    className={`flex items-center justify-center rounded-xl px-2 py-2 text-[11px] font-bold transition active:scale-95 ${
                      p.status
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    title={p.status ? "معروض في المتجر" : "مخفي عن العملاء"}
                  >
                    {p.status ? "معروض" : "مخفي"}
                  </button>

                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(p, "options")}
                        className="flex items-center justify-center gap-1 rounded-xl bg-primary/10 px-2 py-2 text-[11px] font-bold text-primary transition hover:bg-primary/20 active:scale-95"
                        title="إدارة ألوان ومقاسات المنتج"
                      >
                        <Palette className="h-3.5 w-3.5" /> الألوان
                      </button>

                      <button
                        type="button"
                        onClick={() => openEdit(p, "basic")}
                        className="flex items-center justify-center gap-1 rounded-xl bg-secondary px-2 py-2 text-[11px] font-bold text-foreground transition hover:bg-secondary/80 active:scale-95"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> تعديل
                      </button>
                    </>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setProductToDelete(p)}
                      className="flex items-center justify-center gap-1 rounded-xl bg-destructive/10 px-2 py-2 text-[11px] font-bold text-destructive transition hover:bg-destructive/20 active:scale-95"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> حذف
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* حالة عدم وجود منتجات */}
      {!isLoading && paginatedList.length === 0 && (
        <div className="rounded-3xl border border-border bg-card p-6">
          <EmptyState
            icon={Search}
            title="لا توجد منتجات مطابقة"
            hint="جرّب تغيير كلمة البحث أو الفلاتر، أو أضف منتجاً جديداً."
          />
        </div>
      )}

      {/* شريط التنقل بين الصفحات (Pagination) */}
      {sortedList.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              عرض {Math.min((currentPage - 1) * pageSize + 1, sortedList.length)} إلى{" "}
              {Math.min(currentPage * pageSize, sortedList.length)} من إجمالي {sortedList.length}{" "}
              منتج
            </span>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1">
              <span>لكل صفحة:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-bold outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground transition hover:bg-secondary disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" /> السابق
            </button>

            <span className="px-2 text-xs font-bold text-muted-foreground">
              صفحة {currentPage} من {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground transition hover:bg-secondary disabled:opacity-40"
            >
              التالي <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===================== نافذة إضافة / تعديل المنتج ===================== */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-fade-in">
          <div className="my-4 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-card p-4 shadow-2xl sm:p-6">
            {/* رأس النافذة */}
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div>
                <h2 className="text-base font-extrabold text-foreground sm:text-lg">
                  {draft.id ? `تعديل منتج: ${draft.name || "بدون اسم"}` : "إضافة منتج جديد"}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {draft.id
                    ? "تعديل بيانات المنتج وخياراته وصوره"
                    : "أدخل تفاصيل المنتج الجديد وألوانه"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* شريط تبويبات النافذة الأربعة */}
            <div className="mt-4 flex flex-wrap gap-1 rounded-2xl border border-border bg-secondary/40 p-1">
              <button
                type="button"
                onClick={() => setModalTab("basic")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  modalTab === "basic"
                    ? "bg-card text-primary shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> البيانات الأساسية
              </button>

              <button
                type="button"
                onClick={() => setModalTab("pricing")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  modalTab === "pricing"
                    ? "bg-card text-primary shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Coins className="h-3.5 w-3.5" /> الأسعار والمخزون
              </button>

              <button
                type="button"
                onClick={() => setModalTab("images")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  modalTab === "images"
                    ? "bg-card text-primary shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" /> الصور العامة ({draft.images.length})
              </button>

              <button
                type="button"
                onClick={() => setModalTab("options")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  modalTab === "options"
                    ? "bg-card text-primary shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Palette className="h-3.5 w-3.5" /> الألوان والمقاسات
              </button>
            </div>

            {/* محتوى التبويب 1: البيانات الأساسية */}
            {modalTab === "basic" && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="اسم المنتج *">
                    <input
                      className={inputCls}
                      placeholder="مثال: روج سائل مطفي فيلفت"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                  </Field>

                  <Field label="رمز المنتج SKU (تلقائي إن تُرِك فارغاً)">
                    <input
                      dir="ltr"
                      placeholder="يُولَّد تلقائياً مثل PR-1001"
                      className={inputCls}
                      value={draft.sku}
                      onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                    />
                  </Field>

                  <Field label="التصنيف الأساسي">
                    <select
                      className={inputCls}
                      value={draft.category_id}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          category_id: e.target.value,
                          extra: draft.extra.filter((id) => id !== e.target.value),
                        })
                      }
                    >
                      <option value="">بدون تصنيف</option>
                      {mainCats.map(({ category: c, depth }) => (
                        <option key={c.id} value={c.id}>
                          {`${"— ".repeat(depth)}${c.name}`}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="الماركة">
                    <select
                      className={inputCls}
                      value={draft.brand_id}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          brand_id: e.target.value,
                          show_brand_only: e.target.value ? draft.show_brand_only : false,
                        })
                      }
                    >
                      <option value="">بدون ماركة</option>
                      {brandCats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {draft.brand_id && (
                    <div className="sm:col-span-2">
                      <label className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 p-3 cursor-pointer transition hover:bg-primary/10">
                        <input
                          type="checkbox"
                          checked={draft.show_brand_only}
                          onChange={(e) =>
                            setDraft({ ...draft, show_brand_only: e.target.checked })
                          }
                          className="mt-0.5 h-4 w-4 rounded accent-primary cursor-pointer shrink-0"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-foreground block">
                            ظهور الماركة في المنتج فقط (بدون إدراج المنتج في تصفح الماركات)
                          </span>
                          <span className="text-[11px] text-muted-foreground block mt-0.5 leading-relaxed">
                            يظهر شعار واسم الماركة على بطاقة وتفاصيل المنتج فقط، دون أن يظهر في صفحة
                            وتصنيف الماركة عند تصفح المتجر.
                          </span>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <Field label="أقسام إضافية (يظهر المنتج فيها أيضًا)">
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border bg-secondary/20 p-2">
                    {mainCats
                      .map(({ category }) => category)
                      .filter((c) => c.id !== draft.category_id)
                      .map((c) => {
                        const on = draft.extra.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                extra: on
                                  ? draft.extra.filter((x) => x !== c.id)
                                  : [...draft.extra, c.id],
                              })
                            }
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                              on
                                ? "gradient-gold text-primary-foreground shadow-xs"
                                : "bg-secondary text-foreground hover:bg-secondary/80"
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                  </div>
                </Field>

                <Field label="وصف المنتج">
                  <button
                    type="button"
                    onClick={() => void aiWriteDescription()}
                    disabled={aiCopyBusy}
                    className="mb-2 flex items-center gap-2 rounded-xl gradient-gold px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-xs disabled:opacity-50"
                  >
                    {aiCopyBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {aiCopyBusy ? "جاري كتابة التفاصيل…" : "كتابة التفاصيل بالذكاء الاصطناعي"}
                  </button>
                  <textarea
                    rows={4}
                    className={inputCls}
                    placeholder="اكتب وصفاً جذاباً ومفصلاً لخصائص ومميزات المنتج وطريقة الاستخدام…"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="المكوّنات">
                    <textarea
                      rows={4}
                      className={inputCls}
                      placeholder="اكتب مكوّنات المنتج، كل مكوّن في سطر عند الإمكان"
                      value={draft.ingredients}
                      onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })}
                    />
                  </Field>
                  <Field label="طريقة الاستخدام">
                    <textarea
                      rows={4}
                      className={inputCls}
                      placeholder="اكتب خطوات الاستخدام والتنبيهات المهمة"
                      value={draft.usage_instructions}
                      onChange={(e) => setDraft({ ...draft, usage_instructions: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* محتوى التبويب 2: الأسعار والمخزون */}
            {modalTab === "pricing" && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="السعر الأساسي للبيع *">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className={inputCls}
                      value={draft.price}
                      onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                    />
                  </Field>

                  <Field label="سعر الخصم (اختياري)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="اتركه فارغاً إن لم يكن هناك خصم"
                      className={inputCls}
                      value={draft.discount_price}
                      onChange={(e) => setDraft({ ...draft, discount_price: e.target.value })}
                    />
                  </Field>

                  <Field label="سعر الشراء / التكلفة (اختياري)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="اختياري — لحساب الأرباح"
                      className={inputCls}
                      value={draft.cost_price}
                      onChange={(e) => setDraft({ ...draft, cost_price: e.target.value })}
                    />
                  </Field>

                  <Field label="إجمالي المخزون *">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      className={inputCls}
                      value={draft.stock}
                      onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                    />
                  </Field>
                </div>

                {/* معاينة هامش الربح المحاسبي الفعلي إن تم تحديد سعر التكلفة */}
                {draft.cost_price &&
                  draft.cost_price.trim() !== "" &&
                  !isNaN(Number(draft.cost_price)) &&
                  Number(draft.cost_price) > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold">المؤشر المالي للقطعة:</span>
                        <span>
                          سعر البيع المعتمد:{" "}
                          <strong>
                            {Number(draft.discount_price || draft.price || 0)} {label}
                          </strong>{" "}
                          - سعر الشراء:{" "}
                          <strong>
                            {Number(draft.cost_price)} {label}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-emerald-700 dark:text-emerald-300">
                          صافي الربح:{" "}
                          {Math.max(
                            0,
                            Number(draft.discount_price || draft.price || 0) -
                              Number(draft.cost_price),
                          )}{" "}
                          {label}
                        </span>
                        {Number(draft.discount_price || draft.price || 0) > 0 && (
                          <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-black">
                            هامش{" "}
                            {Math.round(
                              ((Number(draft.discount_price || draft.price || 0) -
                                Number(draft.cost_price)) /
                                Number(draft.discount_price || draft.price || 1)) *
                                100,
                            )}
                            %
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                {/* خيارات العرض والظهور */}
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs font-bold text-foreground">حالة العرض والترويج:</p>
                  <div className="mt-3 flex flex-wrap gap-5 text-xs font-bold">
                    <Check
                      label="معروض في المتجر"
                      value={draft.status}
                      onChange={(v) => setDraft({ ...draft, status: v })}
                    />
                    <Check
                      label="منتج مميز (يظهر في الواجهة)"
                      value={draft.is_featured}
                      onChange={(v) => setDraft({ ...draft, is_featured: v })}
                    />
                    <Check
                      label="الأكثر مبيعاً"
                      value={draft.is_bestseller}
                      onChange={(v) => setDraft({ ...draft, is_bestseller: v })}
                    />
                  </div>
                </div>

                {/* أسعار العملات الأخرى */}
                {currencies.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs font-bold text-foreground">
                      أسعار مخصصة لكل عملة (اختياري)
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      اتركها فارغة ليتم التحويل تلقائياً من السعر الأساسي بناءً على سعر الصرف.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {currencies
                        .filter((c) => !c.is_default)
                        .map((c) => {
                          const v = draft.prices[c.code] ?? { price: "", discount_price: "" };
                          const setV = (patch: Partial<typeof v>) =>
                            setDraft({
                              ...draft,
                              prices: { ...draft.prices, [c.code]: { ...v, ...patch } },
                            });
                          return (
                            <div key={c.code} className="rounded-xl bg-secondary/40 p-3">
                              <p className="text-[11px] font-bold">
                                {c.name} ({c.symbol})
                              </p>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="السعر"
                                  className={inputCls}
                                  value={v.price}
                                  onChange={(e) => setV({ price: e.target.value })}
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="سعر الخصم"
                                  className={inputCls}
                                  value={v.discount_price}
                                  onChange={(e) => setV({ discount_price: e.target.value })}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* محتوى التبويب 3: صور المنتج العامة */}
            {modalTab === "images" && (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-center">
                  <ImageIcon className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-2 text-xs font-bold text-foreground">
                    رفع صور المنتج العامة (تظهر كمعرض رئيسي)
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    يمكنك رفع حتى خمس صور بجودة عالية ({draft.images.length}/5).
                  </p>
                  <label
                    className={`mt-3 inline-flex items-center gap-2 rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground shadow-soft transition hover:opacity-95 ${draft.images.length >= 5 ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                  >
                    <Plus className="h-4 w-4" /> اختيار صور من الجهاز
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={draft.images.length >= 5}
                      onChange={(e) => onUpload(e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>

                {draft.images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      يمكنك تحسين أي صورة بالذكاء الاصطناعي بالضغط على أيقونة ✨ أو حذفها بالضغط على
                      ❌.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {draft.images.map((img) => (
                        <div key={img} className="relative">
                          <SmartImage
                            paths={[img]}
                            fallback={fallbackFor()}
                            alt="صورة المنتج"
                            className="h-20 w-20 rounded-xl object-cover"
                          />
                          <button
                            type="button"
                            title="تحسين بالذكاء الاصطناعي"
                            disabled={enhancing !== null}
                            onClick={() => onEnhance(img)}
                            className="absolute -bottom-2 -left-2 rounded-full gradient-gold p-1.5 text-primary-foreground disabled:opacity-60 shadow-xs"
                          >
                            <Wand2
                              className={`h-3.5 w-3.5 ${enhancing === img ? "animate-pulse" : ""}`}
                            />
                          </button>
                          <button
                            onClick={() =>
                              setDraft({ ...draft, images: draft.images.filter((i) => i !== img) })
                            }
                            className="absolute -top-2 -left-2 rounded-full bg-destructive p-1 text-white shadow-xs"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* محتوى التبويب 4: الألوان والمقاسات المتقدمة */}
            {modalTab === "options" && (
              <div className="mt-4">
                {draft.id ? (
                  <ProductOptionsEditor productId={draft.id} productImages={draft.images} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-primary/50 bg-secondary/30 p-6 text-center">
                    <Palette className="mx-auto h-10 w-10 text-primary" />
                    <h4 className="mt-2 text-sm font-extrabold text-foreground">
                      إدارة درجات الألوان وصور كل لون
                    </h4>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                      لحفظ وإضافة الألوان وصورها الخاصة، يرجى حفظ مسودة المنتج أولاً بنقرة واحدة
                      وستفتح لك لوحة الألوان مباشرة في نفس النافذة.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => save(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl gradient-gold px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft transition hover:opacity-95"
                    >
                      <CheckIcon className="h-4 w-4" /> حفظ مسودة المنتج والمتابعة إلى الألوان
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* أزرار الحفظ والإغلاق السفلية */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-xl border border-border px-5 py-2.5 text-xs font-bold text-foreground transition hover:bg-secondary"
              >
                إغلاق
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => save(false)}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-xl gradient-gold px-6 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft transition hover:opacity-95 active:scale-95 disabled:opacity-60"
                >
                  <CheckIcon className="h-4 w-4" /> {draft.id ? "حفظ كل التعديلات" : "حفظ المنتج"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== نافذة تأكيد حذف المنتج ===================== */}
      {productToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-foreground">تأكيد حذف المنتج نهائياً</h3>
                <p className="text-[11px] text-muted-foreground">
                  هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-secondary/30 p-3">
              <SmartImage
                paths={productToDelete.images}
                fallback={fallbackFor()}
                alt={productToDelete.name}
                className="h-14 w-14 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground">{productToDelete.name}</p>
                <p dir="ltr" className="text-start text-[10px] text-muted-foreground">
                  SKU: {productToDelete.sku ?? "—"}
                </p>
                <p className="text-[11px] font-extrabold text-primary">
                  {formatMoney(Number(productToDelete.price), label)}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              هل أنتِ متأكدة من حذف هذا المنتج؟ سيتم حذف جميع الصور والبيانات وخيارات الألوان
              والمقاسات التابعة له فوراً.
            </p>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground transition hover:bg-secondary"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                className="flex items-center gap-1.5 rounded-xl bg-destructive px-5 py-2 text-xs font-bold text-white shadow-soft transition hover:bg-destructive/90 active:scale-95"
              >
                <Trash2 className="h-4 w-4" /> نعم، احذف المنتج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الاستيراد الجماعي للمنتجات */}
      <ProductImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        products={products}
        categories={categories}
        costs={costs}
        saveProductCosts={saveProductCosts}
        onSuccess={async () => {
          await refresh();
        }}
      />

      <ConfirmDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        title="تأكيد الحذف الجماعي"
        description={`هل أنت متأكد من رغبتك في حذف ${selectedIds.size} منتج محدد نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel={`حذف ${selectedIds.size} منتج`}
        cancelLabel="إلغاء"
        isLoading={bulkBusy}
        onConfirm={executeBulkDelete}
      />
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-1 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-foreground">{label}</span>
      {children}
    </label>
  );
}

function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 select-none">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border text-primary accent-primary"
      />
      <span className="text-xs text-foreground">{label}</span>
    </label>
  );
}
