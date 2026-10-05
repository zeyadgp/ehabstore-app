import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  HelpCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { slugify, type Product } from "@/lib/store";
import { uploadImage } from "@/lib/admin";

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Array<{ id: string; name: string }>;
  costs: Record<string, { cost_price: number; supplier_id?: string | undefined }>;
  saveProductCosts: (costs: Record<string, any>) => Promise<void>;
  onSuccess: () => Promise<void>;
}

type ParsedProductRow = {
  id?: string | undefined;
  sku: string;
  name: string;
  description: string;
  price: number;
  discount_price: number | null;
  cost_price: number;
  stock: number;
  category_name?: string | undefined;
  category_id?: string | undefined;
  image_url?: string | undefined;
  status: boolean;
  action: "update" | "create";
};

export function ProductImportModal({
  isOpen,
  onClose,
  products,
  categories,
  costs,
  saveProductCosts,
  onSuccess,
}: ProductImportModalProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const parseCsvLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === "," && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsing(true);
    setErrorMsg(null);

    try {
      const raw = await selectedFile.text();
      const normalized = raw
        .replace(/^\uFEFF/, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");
      const lines = normalized.split("\n").filter((l) => l.trim());

      if (lines.length <= 1) {
        throw new Error("الملف فارغ أو لا يحتوي على صفوف بيانات بعد الترويسة");
      }

      const rows: ParsedProductRow[] = [];
      const productMapById = new Map(products.map((p) => [p.id, p]));
      const productMapBySku = new Map(
        products.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase().trim(), p]),
      );
      const productMapByName = new Map(products.map((p) => [p.name.toLowerCase().trim(), p]));
      const categoryMapByName = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));

      for (let i = 1; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i] || "");
        if (parts.length < 3) continue;

        // Columns: 0: المعرف, 1: رمز SKU, 2: اسم المنتج, 3: الوصف, 4: سعر البيع, 5: سعر الخصم, 6: سعر التكلفة, 7: المخزون, 8: القسم, 9: الصورة, 10: الحالة
        const idCol = parts[0]?.trim();
        const skuCol = parts[1]?.trim();
        const nameCol = parts[2]?.replace(/^"|"$/g, "").trim();
        const descCol = parts[3]?.replace(/^"|"$/g, "").trim() || "";

        if (!nameCol && !skuCol && !idCol) continue;

        // Strict Matching: Only by ID or SKU
        const target =
          (idCol ? productMapById.get(idCol) : null) ||
          (skuCol ? productMapBySku.get(skuCol.toLowerCase()) : null);

        const rawPrice = parts[4]?.replace(/[^\d.]/g, "");
        const rawDiscount = parts[5]?.replace(/[^\d.]/g, "");
        const rawCost = parts[6]?.replace(/[^\d.]/g, "");
        const rawStock = parts[7]?.replace(/[^\d.]/g, "");
        const catCol = parts[8]?.replace(/^"|"$/g, "").trim();
        const imageCol = parts[9]?.replace(/^"|"$/g, "").trim();
        const statusCol = parts[10]?.trim();

        const price = rawPrice ? Number(rawPrice) : target ? Number(target.price || 0) : 0;
        const discount_price = rawDiscount
          ? Number(rawDiscount)
          : target?.discount_price
            ? Number(target.discount_price)
            : null;
        const cost_price = rawCost
          ? Number(rawCost)
          : target && costs[target.id]?.cost_price
            ? costs[target.id]!.cost_price
            : Math.round(price * 0.65);
        const stock = rawStock
          ? Math.max(0, Math.floor(Number(rawStock)))
          : target
            ? Number(target.stock || 0)
            : 0;

        const status = statusCol
          ? !["معطل", "لا", "0", "false", "inactive"].includes(statusCol.toLowerCase())
          : target
            ? Boolean(target.status)
            : true;

        let category_id = target?.category_id;
        if (catCol && categoryMapByName.has(catCol.toLowerCase())) {
          category_id = categoryMapByName.get(catCol.toLowerCase());
        }

        rows.push({
          id: target?.id || (idCol && idCol.length > 20 ? idCol : undefined),
          sku: skuCol || target?.sku || "",
          name: nameCol || target?.name || "منتج جديد",
          description: descCol || target?.description || "",
          price: isNaN(price) ? 0 : price,
          discount_price: discount_price && !isNaN(discount_price) ? discount_price : null,
          cost_price: isNaN(cost_price) ? 0 : cost_price,
          stock: isNaN(stock) ? 0 : stock,
          category_name: catCol,
          category_id: category_id ?? undefined,
          image_url: imageCol,
          status,
          action: target ? "update" : "create",
        });
      }

      if (rows.length === 0) {
        throw new Error("لم يتم العثور على أي صفوف صالحة للاستيراد في الملف");
      }

      setParsedRows(rows);
    } catch (err: any) {
      setErrorMsg(err.message || "فشل قراءة الملف");
      setParsedRows([]);
    } finally {
      setParsing(false);
    }
  };

  const handleApplyImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    let successful = 0;
    let failedImages = 0;

    const downloadAndConvertImage = async (url: string, name: string): Promise<File | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch");
        const blob = await response.blob();
        return new File([blob], name, { type: blob.type });
      } catch (e) {
        console.error("Failed to download image:", e);
        return null;
      }
    };

    try {
      for (const row of parsedRows) {
        let images: string[] = [];
        if (row.image_url) {
          if (row.image_url.startsWith("http")) {
            const file = await downloadAndConvertImage(row.image_url, `${row.sku || row.name}.jpg`);
            if (file) {
              const uploadedPath = await uploadImage(file);
              if (uploadedPath) {
                images = [uploadedPath];
              } else {
                failedImages++;
              }
            } else {
              failedImages++;
            }
          } else {
            images = [row.image_url];
          }
        }

        if (row.action === "update" && row.id) {
          const updateData: any = {
            price: row.price,
            discount_price: row.discount_price,
            stock: row.stock,
            status: row.status,
            updated_at: new Date().toISOString(),
            ...(row.sku ? { sku: row.sku } : {}),
            ...(row.description ? { description: row.description } : {}),
            ...(row.category_id ? { category_id: row.category_id } : {}),
          };
          if (images.length > 0) updateData.images = images;

          await supabase.from("products").update(updateData).eq("id", row.id);
        } else {
          const slug = slugify(row.name) + "-" + Math.random().toString(36).slice(2, 6);
          await supabase.from("products").insert({
            name: row.name,
            slug,
            sku: row.sku || null,
            description: row.description,
            price: row.price,
            discount_price: row.discount_price,
            stock: row.stock,
            status: row.status,
            images,
            category_id: row.category_id || categories[0]?.id || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        successful++;
      }

      // Update costs
      const updatedCosts: Record<string, any> = { ...costs };
      parsedRows.forEach((r) => {
        if (r.id) {
          updatedCosts[r.id] = {
            product_id: r.id,
            cost_price: r.cost_price,
            supplier_id: costs[r.id]?.supplier_id,
            updated_at: new Date().toISOString(),
          };
        }
      });
      await saveProductCosts(updatedCosts);

      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await onSuccess();

      let message = `تم استيراد ${successful} منتج بنجاح.`;
      if (failedImages > 0) message += ` (فشل تحميل ${failedImages} صورة).`;
      toast.success(message);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "حدث خطأ أثناء الاستيراد");
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleCsv = () => {
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
      "رابط الصورة",
      "الحالة",
    ];
    const sampleRows = [
      [
        "",
        "SER-001",
        `"سيروم فيتامين سي للوجه 30 مل"`,
        `"سيروم تفتيح ونضارة طبيعي غني بمضادات الأكسدة"`,
        "4500",
        "3900",
        "2500",
        "25",
        categories[0]?.name || "العناية بالبشرة",
        "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800",
        "نشط",
      ],
      [
        "",
        "LIP-002",
        `"أحمر شفاه مات مخملي رقم 05"`,
        `"لون ثابت ومقاوم للماء يدوم طويلاً"`,
        "2800",
        "",
        "1400",
        "15",
        categories[1]?.name || "المكياج",
        "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800",
        "نشط",
      ],
    ];

    const content =
      "\uFEFF" + [headers.join(","), ...sampleRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل نموذج ملف المنتجات التجريبي");
  };

  const updatesCount = parsedRows.filter((r) => r.action === "update").length;
  const createsCount = parsedRows.filter((r) => r.action === "create").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-50">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-foreground sm:text-lg">
                الاستيراد الجماعي للمنتجات عبر Excel / CSV
              </h2>
              <p className="text-xs text-muted-foreground">
                إضافة منتجات جديدة أو تحديث الأسعار والمخزون الحالي بنقرة زر واحدة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top helper & sample download */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <HelpCircle className="h-4 w-4 text-primary shrink-0" />
              <span>هل تود معرفة التنسيق الصحيح للملف؟ حمل نموذج CSV الجاهز واملأ به منتجاتك.</span>
            </div>
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-card px-3 py-1.5 text-xs font-bold text-primary shadow-sm hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" /> تحميل نموذج Excel/CSV التجريبي
            </button>
          </div>

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition hover:border-primary/60 hover:bg-muted/50"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, text/csv, application/vnd.ms-excel"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-110">
              <Upload className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-extrabold text-foreground">
              {file ? file.name : "اضغط لاختيار ملف CSV أو أسقطه هنا"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              يدعم ملفات CSV بترميز UTF-8 المتوافقة مع Microsoft Excel و Google Sheets
            </p>
          </div>

          {parsing && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-primary">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>جاري قراءة ومعالجة الملف...</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-bold text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-2">
                <h3 className="text-xs font-extrabold text-foreground">
                  معاينة البيانات قبل الحفظ ({parsedRows.length} صف تم التعرف عليه):
                </h3>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="rounded-lg bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-400">
                    تحديث {updatesCount} منتج حالي
                  </span>
                  <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                    إضافة {createsCount} منتج جديد
                  </span>
                </div>
              </div>

              <div className="max-h-60 overflow-x-auto overflow-y-auto rounded-2xl border border-border">
                <table className="w-full text-start text-xs">
                  <thead className="sticky top-0 bg-muted text-muted-foreground font-bold border-b border-border">
                    <tr>
                      <th className="p-2.5 text-start">الإجراء</th>
                      <th className="p-2.5 text-start">رمز SKU</th>
                      <th className="p-2.5 text-start">اسم المنتج</th>
                      <th className="p-2.5 text-start">سعر البيع</th>
                      <th className="p-2.5 text-start">سعر الخصم</th>
                      <th className="p-2.5 text-start">التكلفة</th>
                      <th className="p-2.5 text-start">المخزون</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {parsedRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="p-2.5">
                          {row.action === "update" ? (
                            <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                              تحديث
                            </span>
                          ) : (
                            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              جديد
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-muted-foreground">
                          {row.sku || "—"}
                        </td>
                        <td className="p-2.5 font-bold text-foreground max-w-[200px] truncate">
                          {row.name}
                        </td>
                        <td className="p-2.5 font-extrabold text-foreground">{row.price}</td>
                        <td className="p-2.5 text-muted-foreground">{row.discount_price ?? "—"}</td>
                        <td className="p-2.5 text-muted-foreground">{row.cost_price}</td>
                        <td className="p-2.5 font-bold">{row.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <p className="text-[11px] text-muted-foreground text-center">
                  يتم عرض أول 50 صفاً للمعاينة، وسيتم استيراد كافة {parsedRows.length} صفاً بالكامل.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border/80 bg-muted/20 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-muted"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleApplyImport}
            disabled={importing || parsedRows.length === 0}
            className="flex items-center gap-2 rounded-xl gradient-gold px-6 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-50"
          >
            {importing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> تأكيد واستيراد {parsedRows.length} منتج الآن
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
