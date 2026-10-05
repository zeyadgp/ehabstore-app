import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { generateProductCopy } from "@/lib/product-copy.functions";

export const Route = createFileRoute("/admin/ai-copy")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "كاتب وصف المنتجات الذكي | إيهاب ستور" },
      {
        name: "description",
        content: "توليد وصف تسويقي منسّق واقتراحات لتحسين بيانات المنتج من الاسم أو الصورة.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "كاتب وصف المنتجات الذكي" },
      {
        property: "og:description",
        content: "وصف تسويقي واقتراحات تحسين لبيانات منتجات المتجر.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiCopyPage,
});

function AiCopyPage() {
  const generate = useServerFn(generateProductCopy);
  const fileRef = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const pickImage = (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("الصورة كبيرة، اختر صورة أصغر من 4 ميجابايت");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const run = async () => {
    setBusy(true);
    setResult("");
    try {
      const out = await generate({
        data: { info, ...(image ? { imageDataUrl: image } : {}) },
      });
      setResult(out.text);
      toast.success("تم إنشاء الوصف");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إنشاء الوصف");
    } finally {
      setBusy(false);
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(result);
      toast.success("تم نسخ النص");
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h1 className="flex items-center gap-2 text-lg font-extrabold">
          <Sparkles className="h-5 w-5 text-primary" /> كاتب وصف المنتجات الذكي
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          اكتب اسم المنتج ومعلوماته، أو ارفع صورته، وسيُنشئ لك المساعد وصفاً تسويقياً منسّقاً مع
          اقتراحات لتحسين بيانات المنتج.
        </p>

        <textarea
          value={info}
          onChange={(e) => setInfo(e.target.value)}
          rows={5}
          placeholder="مثال: سيروم فيتامين سي 30 مل، للبشرة الباهتة، يفتّح ويوحّد اللون، السعر 8500 ريال"
          className="mt-4 w-full rounded-2xl border border-border bg-background p-3 text-xs leading-relaxed outline-none focus:border-primary"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2"
          >
            <ImagePlus className="h-4 w-4" /> رفع صورة المنتج
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy || (!info.trim() && !image)}
            className="flex items-center gap-2 rounded-xl gradient-gold px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            إنشاء الوصف والاقتراحات
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) pickImage(f);
            }}
          />
        </div>

        {image && (
          <div className="relative mt-3 inline-block">
            <img
              src={image}
              alt="صورة المنتج"
              className="h-28 w-28 rounded-2xl border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => setImage(null)}
              aria-label="إزالة الصورة"
              className="absolute -top-2 -left-2 rounded-full bg-destructive p-1 text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {busy && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          جاري التحليل والكتابة… قد يستغرق حتى دقيقة.
        </p>
      )}

      {result && (
        <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold">النتيجة</h2>
            <button
              type="button"
              onClick={() => void copyAll()}
              className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-[11px] font-bold text-primary"
            >
              <Copy className="h-3.5 w-3.5" /> نسخ الكل
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
