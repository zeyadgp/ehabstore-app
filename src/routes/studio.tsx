import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShoppingBag,
  Aperture,
  Camera,
  Check,
  Download,
  Eye,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ScanFace,
  Wand2,
  Trash2,
  Upload,
  Video,
  X,
  Pipette,
  Sun,
  Moon,
  Flame,
  ShieldCheck,
  ArrowLeft,
  ArrowUpRight,
  Tag,
  Layers,
  Filter,
  PowerOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import studioModel from "@/assets/studio-default-model.jpg";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { useCurrency } from "@/lib/currency";
import { useProducts, useCategories, type Product } from "@/lib/store";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
const modelAsset = { url: studioModel };
import { Button } from "@/components/ui/button";
import { streamImage } from "@/lib/stream-image";
import { cn } from "@/lib/utils";
import { useStudioSettings } from "@/lib/studio-settings";

const title = "استوديو المكياج الافتراضي | إيهاب ستور";
const description =
  "جرّب إطلالات مكياج واقعية على صورتك بالذكاء الاصطناعي مع مقارنة قبل وبعد، وأضف المنتجات المطابقة إلى السلة مباشرة.";
export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ehabstore.app/studio" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/studio" }],
  }),
  component: VirtualArtist,
});

type LookKey = "natural" | "rose" | "bronze" | "evening";
type Zone = "full" | "cheeks" | "eyes" | "lips";
type Texture = "natural" | "matte" | "dewy" | "satin";
type Coverage = "light" | "medium" | "full";
type SavedLook = {
  id: string;
  name: string;
  look: LookKey;
  zone: Zone;
  intensity: number;
  skinTone: string;
  coverage: Coverage;
  texture: Texture;
  lens: string;
  lipstick: string;
};

const looks: { key: LookKey; name: string; note: string; swatches: string[]; prompt: string }[] = [
  {
    key: "natural",
    name: "طبيعي ناعم",
    note: "توحيد خفيف ولمعة صحية",
    swatches: ["bg-swatch-nude", "bg-swatch-rose", "bg-swatch-cocoa"],
    prompt:
      "natural no-makeup makeup, subtle peach blush, softly defined brows, brown mascara and nude satin lips",
  },
  {
    key: "rose",
    name: "وردي يومي",
    note: "خدود وشفاه وردية هادئة",
    swatches: ["bg-swatch-pink", "bg-swatch-mauve", "bg-swatch-plum"],
    prompt:
      "soft rose makeup, fresh rosy blush, mauve eyeshadow, softly defined lashes and muted rose satin lipstick",
  },
  {
    key: "bronze",
    name: "برونزي دافئ",
    note: "دفء ذهبي وتحديد رقيق",
    swatches: ["bg-swatch-gold", "bg-swatch-bronze", "bg-swatch-brown"],
    prompt:
      "warm bronze makeup, subtle golden eyelids, gentle bronzer, refined brows, brown liner and caramel nude lips",
  },
  {
    key: "evening",
    name: "مسائي أنيق",
    note: "عيون محددة وشفاه عميقة",
    swatches: ["bg-swatch-wine", "bg-swatch-charcoal", "bg-swatch-red"],
    prompt:
      "elegant evening makeup, softly smoked eyes, precise black-brown liner, defined lashes, sculpted blush and deep berry satin lips",
  },
];
const zones: { key: Zone; name: string; prompt: string }[] = [
  { key: "full", name: "كامل الوجه", prompt: "the full makeup look across the face" },
  { key: "cheeks", name: "الوجنتان", prompt: "only blush, bronzer and highlight on both cheeks" },
  { key: "eyes", name: "العينان", prompt: "only eye makeup, brows and contact lenses" },
  { key: "lips", name: "الشفاه", prompt: "only lipstick on the lips" },
];
const skinTones = [
  { key: "fair", name: "فاتحة", color: "bg-tone-fair" },
  { key: "light", name: "قمحية فاتحة", color: "bg-tone-light" },
  { key: "medium", name: "متوسطة", color: "bg-tone-medium" },
  { key: "tan", name: "سمراء", color: "bg-tone-tan" },
  { key: "deep", name: "داكنة", color: "bg-tone-deep" },
];
const lenses = [
  { key: "none", name: "بدون" },
  { key: "hazel", name: "عسلي" },
  { key: "green", name: "أخضر" },
  { key: "gray", name: "رمادي" },
];
const lipsticks = [
  { key: "nude", name: "نيود" },
  { key: "rose", name: "وردي" },
  { key: "red", name: "أحمر" },
  { key: "berry", name: "توتي" },
];
const coverageOptions: { key: Coverage; name: string }[] = [
  { key: "light", name: "خفيفة" },
  { key: "medium", name: "متوسطة" },
  { key: "full", name: "كاملة" },
];
const textures: { key: Texture; name: string }[] = [
  { key: "natural", name: "طبيعي" },
  { key: "matte", name: "مطفي" },
  { key: "dewy", name: "ندي" },
  { key: "satin", name: "ساتان" },
];
const initialSaved: SavedLook[] = looks.map((item, index) => ({
  id: `ready-${item.key}`,
  name: item.name,
  look: item.key,
  zone: "full",
  intensity: 45 + index * 10,
  skinTone: "medium",
  coverage: "medium",
  texture: index === 2 ? "dewy" : "natural",
  lens: "none",
  lipstick: item.key === "evening" ? "berry" : item.key === "rose" ? "rose" : "nude",
}));

type Lighting = "daylight" | "studio" | "warm";
type ColorIQ = {
  tone: string;
  undertone: "warm" | "cool" | "neutral";
  foundation: string;
  concealer: string;
  hex: string;
};
const lightings: { key: Lighting; name: string; icon: typeof Sun; filter: string }[] = [
  {
    key: "daylight",
    name: "ضوء النهار",
    icon: Sun,
    filter: "brightness(1.06) contrast(1.02) saturate(1.03)",
  },
  {
    key: "studio",
    name: "مساء / استوديو",
    icon: Moon,
    filter: "brightness(0.9) contrast(1.16) saturate(0.9) hue-rotate(-6deg)",
  },
  {
    key: "warm",
    name: "إضاءة دافئة",
    icon: Flame,
    filter: "brightness(1.02) sepia(0.22) saturate(1.14) hue-rotate(-8deg)",
  },
];
const undertoneNames = { warm: "دافئة (ذهبية)", cool: "باردة (وردية)", neutral: "محايدة" } as const;
const IDLE_WIPE_MS = 10 * 60 * 1000;

async function analyzeSkin(file: Blob): Promise<ColorIQ | null> {
  const bitmap = await createImageBitmap(file);
  const w = 80,
    h = 100;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const scale = Math.max(w / bitmap.width, h / bitmap.height);
  const dw = bitmap.width * scale,
    dh = bitmap.height * scale;
  ctx.drawImage(bitmap, (w - dw) / 2, (h - dh) / 2, dw, dh);
  bitmap.close();
  const regions: [number, number][] = [
    [0.36, 0.56],
    [0.64, 0.56],
    [0.5, 0.33],
    [0.5, 0.62],
  ];
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (const [cx, cy] of regions) {
    const data = ctx.getImageData(Math.round(cx * w) - 5, Math.round(cy * h) - 5, 10, 10).data;
    for (let i = 0; i < data.length; i += 4) {
      const R = data[i] ?? 0,
        G = data[i + 1] ?? 0,
        B = data[i + 2] ?? 0;
      if (R > G && G > B && R - B > 12 && R > 50) {
        r += R;
        g += G;
        b += B;
        n++;
      }
    }
  }
  if (n < 40) return null;
  r /= n;
  g /= n;
  b /= n;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const tone =
    lum > 195 ? "fair" : lum > 170 ? "light" : lum > 140 ? "medium" : lum > 105 ? "tan" : "deep";
  const depth = { fair: 1, light: 2, medium: 3, tan: 4, deep: 5 }[tone];
  const yellow = g - b,
    red = r - g;
  const undertone = yellow > red * 1.1 ? "warm" : red > yellow * 1.35 ? "cool" : "neutral";
  const letter = { warm: "W", cool: "C", neutral: "N" }[undertone];
  const hex = "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  return {
    tone,
    undertone,
    foundation: `${depth}.${lum % 10 > 5 ? 5 : 0}${letter}`,
    concealer: `${Math.max(1, depth - 0.5).toFixed(1)}${letter}`,
    hex,
  };
}

const ZONE_KEYWORDS: Record<Zone, string[]> = {
  full: [
    "مكياج",
    "أساس",
    "فاونديشن",
    "روج",
    "بلاشر",
    "ظلال",
    "ماسكرا",
    "foundation",
    "lip",
    "blush",
  ],
  cheeks: ["خدود", "بلاشر", "برونزر", "هايلايتر", "blush", "bronzer", "highlight"],
  eyes: [
    "عيون",
    "ظلال",
    "آيشادو",
    "ماسكرا",
    "كحل",
    "آيلاينر",
    "عدس",
    "eyeshadow",
    "mascara",
    "liner",
    "lens",
  ],
  lips: ["شفاه", "شفايف", "روج", "قلوس", "lip", "gloss"],
};

type StudioProductsProps = {
  lookKey: LookKey;
  lookName: string;
  zone: Zone;
  lipstick: string;
  lens: string;
  coverage: Coverage;
  texture: Texture;
  skinTone: string;
};

type StepKey = "base" | "cheeks" | "eyes" | "lips" | "tools";

interface StepConfig {
  id: StepKey;
  title: string;
  stepNum: number;
  badge: string;
  recommendedShade: string;
  keywords: string[];
}

function StudioProducts({
  lookKey,
  lookName,
  zone,
  lipstick,
  lens,
  coverage,
  texture,
  skinTone,
}: StudioProductsProps) {
  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategories();
  const { add } = useCart();
  const { format } = useCurrency();
  const [activeTab, setActiveTab] = useState<"all" | StepKey>("all");
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  // Sync active tab when user changes zone in the studio
  useEffect(() => {
    if (zone === "lips") setActiveTab("lips");
    else if (zone === "eyes") setActiveTab("eyes");
    else if (zone === "cheeks") setActiveTab("cheeks");
    else if (zone === "full") setActiveTab("all");
  }, [zone]);

  // Translate options for shade advice
  const lipName = lipsticks.find((l) => l.key === lipstick)?.name ?? "نيود";
  const lensName = lenses.find((l) => l.key === lens)?.name ?? "طبيعية";
  const covName = coverageOptions.find((c) => c.key === coverage)?.name ?? "طبيعية";
  const texName = textures.find((t) => t.key === texture)?.name ?? "طبيعي";
  const toneName = skinTones.find((s) => s.key === skinTone)?.name ?? "قمحية";

  // Step definitions tailored to current look
  const steps: StepConfig[] = useMemo(() => {
    const baseShade = `درجة ${toneName} (${covName} - ${texName})`;

    let cheeksShade = "خوخي هادئ (Peach Nude)";
    let eyesShade = "ماسكارا تكثيف وبني طبيعي";
    let lipsShade = `درجة ${lipName} ساتان`;

    if (lookKey === "rose") {
      cheeksShade = "وردي ناعم (Fresh Rosy Pink)";
      eyesShade = "ظلال روز وماسكارا فوليوم";
      lipsShade = `درجة ${lipName} زهرية ناعمة`;
    } else if (lookKey === "bronze") {
      cheeksShade = "برونزي مشمس وهايلايتر ذهبي";
      eyesShade = "ظلال ذهبية ونحاسية دافئة";
      lipsShade = `درجة ${lipName} كراميلية دافئة`;
    } else if (lookKey === "evening") {
      cheeksShade = "كونتور محدد وبلاشر منحوت";
      eyesShade = `آيلاينر كحل أسود دقيق ${lens !== "none" ? `مع عدسات ${lensName}` : ""}`;
      lipsShade = `درجة ${lipName} توتية مخملية جريئة`;
    }

    return [
      {
        id: "base",
        title: "الأساس وتوحيد البشرة",
        stepNum: 1,
        badge: "توحيد البشرة",
        recommendedShade: baseShade,
        keywords: [
          "فونديشن",
          "فاونديشن",
          "أساس",
          "اساس",
          "بي بي",
          "كونسيلر",
          "بودرة",
          "برايمر",
          "كريم",
          "foundation",
          "powder",
          "primer",
          "concealer",
          "bb",
        ],
      },
      {
        id: "cheeks",
        title: "الوجنتان والإشراق",
        stepNum: 2,
        badge: "توريد الخدود",
        recommendedShade: cheeksShade,
        keywords: [
          "بلاشر",
          "خدود",
          "أحمر خدود",
          "برونزر",
          "هايلايتر",
          "إضاءة",
          "blush",
          "bronzer",
          "highlighter",
          "glow",
        ],
      },
      {
        id: "eyes",
        title: "تحديد العيون والرموش",
        stepNum: 3,
        badge: "مكياج العيون",
        recommendedShade: eyesShade,
        keywords: [
          "مسكرة",
          "ماسكارا",
          "ماسكرا",
          "ايلاينر",
          "آيلاينر",
          "كحل",
          "ظلال",
          "ايشادو",
          "آيشادو",
          "حواجب",
          "عدسات",
          "mascara",
          "liner",
          "eyeshadow",
          "brows",
          "lens",
        ],
      },
      {
        id: "lips",
        title: "تلوين الشفاه",
        stepNum: 4,
        badge: "الشفاه والروج",
        recommendedShade: lipsShade,
        keywords: [
          "روج",
          "شفاه",
          "شفايف",
          "قلوس",
          "غلوس",
          "تنت",
          "محدد",
          "lip",
          "lipstick",
          "gloss",
          "tint",
        ],
      },
      {
        id: "tools",
        title: "فرش وأدوات التطبيق",
        stepNum: 5,
        badge: "أدوات وتثبيت",
        recommendedShade: "أدوات مخصصة للدمج الاحترافي",
        keywords: [
          "فرشاة",
          "فرش",
          "اسفنجة",
          "إسفنجة",
          "بلندر",
          "تثبيت",
          "بخاخ",
          "brush",
          "sponge",
          "blender",
          "spray",
        ],
      },
    ];
  }, [
    lookKey,
    lipstick,
    lens,
    lensName,
    lipName,
    coverage,
    texture,
    skinTone,
    toneName,
    covName,
    texName,
  ]);

  // Map products to steps
  const stepProductsMap = useMemo(() => {
    const map = new Map<StepKey, Product[]>();
    const usedIds = new Set<string>();

    steps.forEach((st) => {
      const catIds = new Set(
        categories
          .filter((c) => st.keywords.some((k) => c.name.toLowerCase().includes(k)))
          .map((c) => c.id),
      );

      const matched = products.filter((p) => {
        if (p.status === false || usedIds.has(p.id)) return false;
        const nameMatch = st.keywords.some((k) => p.name.toLowerCase().includes(k));
        const catMatch = p.category_id && catIds.has(p.category_id);
        return nameMatch || catMatch;
      });

      // Take up to 3 best products per step
      const stepItems = matched.slice(0, 3);
      stepItems.forEach((p) => usedIds.add(p.id));
      map.set(st.id, stepItems);
    });

    // If some steps are empty, fill with general makeup/skincare products from store
    const fallbackPool = products.filter((p) => p.status !== false && !usedIds.has(p.id));
    let poolIdx = 0;
    steps.forEach((st) => {
      const current = map.get(st.id) || [];
      if (current.length === 0 && fallbackPool[poolIdx]) {
        map.set(st.id, [fallbackPool[poolIdx]!]);
        usedIds.add(fallbackPool[poolIdx]!.id);
        poolIdx++;
      }
    });

    return map;
  }, [products, categories, steps]);

  // Flattened products with their step metadata
  const lookProductsList = useMemo(() => {
    const list: Array<{
      product: Product;
      step: StepConfig;
    }> = [];

    steps.forEach((st) => {
      const items = stepProductsMap.get(st.id) || [];
      items.forEach((p) => {
        list.push({ product: p, step: st });
      });
    });

    return list;
  }, [steps, stepProductsMap]);

  // Filtered list based on activeTab
  const visibleList = useMemo(() => {
    if (activeTab === "all") return lookProductsList;
    return lookProductsList.filter((item) => item.step.id === activeTab);
  }, [lookProductsList, activeTab]);

  // Bundle pricing
  const bundleRawTotal = useMemo(() => {
    return lookProductsList.reduce((sum, item) => {
      const p = item.product;
      const price = p.discount_price && p.discount_price > 0 ? p.discount_price : p.price;
      return sum + Number(price || 0);
    }, 0);
  }, [lookProductsList]);

  // 10% Bundle Discount
  const bundleDiscountRate = 0.1;
  const bundleFinalTotal = bundleRawTotal * (1 - bundleDiscountRate);

  // Add individual product to cart
  const handleAddToCart = (p: Product, stepBadge: string) => {
    const finalPrice = p.discount_price && p.discount_price > 0 ? p.discount_price : p.price;
    add({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: finalPrice,
      image: p.images?.[0] ?? null,
      color: `إطلالة ${lookName} · ${stepBadge}`,
      colorSwatch: null,
      sku: p.sku,
    });
    setAddedIds((prev) => ({ ...prev, [p.id]: true }));
    toast.success(`تمت إضافة "${p.name}" إلى السلة بنجاح`);
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [p.id]: false }));
    }, 2500);
  };

  // Add all products of this look to cart at once
  const handleAddEntireLookToCart = () => {
    if (lookProductsList.length === 0) return;
    let addedCount = 0;
    lookProductsList.forEach(({ product: p, step: st }) => {
      if (p.stock > 0) {
        const finalPrice = p.discount_price && p.discount_price > 0 ? p.discount_price : p.price;
        add(
          {
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: finalPrice,
            image: p.images?.[0] ?? null,
            color: `إطلالة ${lookName} · ${st.badge}`,
            colorSwatch: null,
            sku: p.sku,
          },
          1,
        );
        addedCount++;
      }
    });
    toast.success(
      `تمت إضافة كامل باقة الإطلالة (${addedCount} مستحضرات) إلى سلة التسوق مع خصم الإطلالة المتكاملة!`,
    );
  };

  return (
    <section className="mx-auto max-w-[1500px] px-4 pb-28 pt-8 md:px-8">
      {/* 1. Header Section */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl gradient-gold text-primary-foreground shadow-2xs">
              <Layers className="h-5 w-5" />
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-black text-foreground">
              مستحضرات إطلالة: {lookName}
            </h2>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
              مطابقة لملامحك
            </span>
          </div>
          <p className="mt-2 text-xs sm:text-sm font-medium text-muted-foreground">
            جدول المستحضرات الأصلية المنسقة خصيصاً من المتجر لتطبيق هذه الإطلالة باحترافية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/cart"
            className="flex items-center gap-2 rounded-xl border border-primary/30 bg-card px-4 py-2 text-xs font-bold text-primary shadow-soft transition-colors hover:bg-primary/10"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>عرض السلة</span>
          </Link>
          <Link
            to="/products"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground shadow-soft transition-colors hover:border-primary/50"
          >
            <span>جميع المنتجات</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* 2. Look Bundle Summary Card (شراء الباقة كاملة) */}
      <div className="mb-6 rounded-3xl border border-primary/20 bg-linear-to-r from-primary/10 via-card to-card p-5 sm:p-6 shadow-soft">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl gradient-gold text-primary-foreground shadow-soft text-center select-none">
              <Tag className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] font-black leading-none">وفر 10%</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-foreground">
                  باقة الإطلالة المتكاملة ({lookProductsList.length} مستحضرات)
                </h3>
                <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  خصم الباقة مفعّل
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                احصلي على كريم الأساس، أحمر الشفاه، محدد العيون وبلاشر الإطلالة معاً بضمان الأصالة
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 border-border/70 pt-4 lg:pt-0">
            <div className="text-right">
              <span className="block text-[11px] font-bold text-muted-foreground">
                إجمالي الباقة كاملة
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-xl sm:text-2xl font-black text-primary">
                  {format(bundleFinalTotal)}
                </span>
                {bundleRawTotal > bundleFinalTotal && (
                  <span className="text-xs font-bold text-muted-foreground line-through">
                    {format(bundleRawTotal)}
                  </span>
                )}
              </div>
            </div>

            <Button
              onClick={handleAddEntireLookToCart}
              disabled={lookProductsList.length === 0}
              className="h-12 rounded-2xl px-6 text-sm font-black gradient-gold text-primary-foreground shadow-soft transition-all duration-200 hover:opacity-95 active:scale-95"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>إضافة كامل الباقة للسلة</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Filter Tabs (أزرار تصفية الخطوات) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-150 active:scale-95 ${
            activeTab === "all"
              ? "border border-primary bg-primary text-primary-foreground shadow-soft"
              : "border border-border bg-card text-foreground hover:border-primary/50"
          }`}
        >
          <span>الكل</span>
          <span className="rounded-full bg-black/15 px-1.5 py-0.2 text-[10px] font-black">
            {lookProductsList.length}
          </span>
        </button>

        {steps.map((st) => {
          const count = (stepProductsMap.get(st.id) || []).length;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => setActiveTab(st.id)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-150 active:scale-95 ${
                activeTab === st.id
                  ? "border border-primary bg-primary text-primary-foreground shadow-soft"
                  : "border border-border bg-card text-foreground hover:border-primary/50"
              }`}
            >
              <span>{st.badge}</span>
              <span className="rounded-full bg-black/15 px-1.5 py-0.2 text-[10px] font-black">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. The Organized Table (جدول المنتجات المنظم بدون طول أفقي) */}
      <div className="w-full overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        {visibleList.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              لا توجد مستحضرات متطابقة مع هذا القسم حالياً في المتجر.
            </p>
            <Link
              to="/products"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <span>تصفح كافة منتجات المكياج بالمتجر</span>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table: Fits 100% of container width with zero horizontal sprawl */}
            <div className="hidden md:block w-full overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30 text-xs font-black text-muted-foreground">
                    <th className="py-4 px-5 text-right">المستحضر والمواصفات</th>
                    <th className="py-4 px-4 text-right">خطوة التطبيق</th>
                    <th className="py-4 px-4 text-right">الدرجة المقترحة للإطلالة</th>
                    <th className="py-4 px-4 text-right">السعر</th>
                    <th className="py-4 px-5 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {visibleList.map(({ product: p, step: st }) => {
                    const price =
                      p.discount_price && p.discount_price > 0 ? p.discount_price : p.price;
                    const hasDiscount = Boolean(p.discount_price && p.discount_price < p.price);
                    const isAdded = Boolean(addedIds[p.id]);
                    const isOutOfStock = p.stock <= 0;

                    return (
                      <tr key={p.id} className="transition-colors hover:bg-muted/20">
                        {/* 1. Thumbnail + Title + Link */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3.5">
                            <Link
                              to="/product/$slug"
                              params={{ slug: p.slug }}
                              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-white shadow-2xs transition-transform hover:scale-105"
                            >
                              <SmartImage
                                paths={p.images}
                                fallback={fallbackFor(p.slug)}
                                alt={p.name}
                                className="h-full w-full object-cover"
                              />
                            </Link>
                            <div className="min-w-0">
                              <Link
                                to="/product/$slug"
                                params={{ slug: p.slug }}
                                className="block font-bold text-sm text-foreground transition-colors hover:text-primary line-clamp-1"
                                title={p.name}
                              >
                                {p.name}
                              </Link>
                              <span className="block text-[11px] font-medium text-muted-foreground mt-0.5">
                                {st.title}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Step Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-extrabold text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            خطوة {st.stepNum}: {st.badge}
                          </span>
                        </td>

                        {/* 3. Recommended Shade */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block max-w-[200px] truncate rounded-xl bg-secondary/80 px-2.5 py-1 text-xs font-bold text-foreground">
                            {st.recommendedShade}
                          </span>
                        </td>

                        {/* 4. Price */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-display text-sm font-black tabular-nums text-primary">
                              {format(price)}
                            </span>
                            {hasDiscount && (
                              <span className="text-[11px] font-bold text-muted-foreground line-through">
                                {format(p.price)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Action Button */}
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          <Button
                            size="sm"
                            onClick={() => handleAddToCart(p, st.badge)}
                            disabled={isOutOfStock}
                            className={`h-9 min-w-28 rounded-xl px-4 text-xs font-bold shadow-soft transition-all duration-200 active:scale-95 ${
                              isAdded
                                ? "bg-emerald-600 text-white"
                                : "gradient-gold text-primary-foreground"
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                                <span>تمت الإضافة</span>
                              </>
                            ) : isOutOfStock ? (
                              <span>نفدت الكمية</span>
                            ) : (
                              <>
                                <ShoppingBag className="h-3.5 w-3.5" />
                                <span>أضف للسلة</span>
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View: Compact, non-sprawling card rows fitting 100% width with no horizontal scroll */}
            <div className="md:hidden flex flex-col divide-y divide-border/60">
              {visibleList.map(({ product: p, step: st }) => {
                const price = p.discount_price && p.discount_price > 0 ? p.discount_price : p.price;
                const hasDiscount = Boolean(p.discount_price && p.discount_price < p.price);
                const isAdded = Boolean(addedIds[p.id]);
                const isOutOfStock = p.stock <= 0;

                return (
                  <div key={p.id} className="p-3.5 space-y-2.5">
                    {/* Top Row: Step Tag + Stock */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-extrabold text-primary">
                        خطوة {st.stepNum}: {st.badge}
                      </span>
                      {isOutOfStock ? (
                        <span className="text-[10px] font-bold text-destructive">
                          نفد من المخزون
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          ✓ متوفر بالمخزون
                        </span>
                      )}
                    </div>

                    {/* Middle Row: Image + Name + Recommended Shade */}
                    <div className="flex items-center gap-3">
                      <Link
                        to="/product/$slug"
                        params={{ slug: p.slug }}
                        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-white"
                      >
                        <SmartImage
                          paths={p.images}
                          fallback={fallbackFor(p.slug)}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link
                          to="/product/$slug"
                          params={{ slug: p.slug }}
                          className="block text-xs font-extrabold text-foreground line-clamp-1 hover:text-primary"
                        >
                          {p.name}
                        </Link>
                        <span className="mt-1 block truncate text-[11px] font-medium text-muted-foreground">
                          الدرجة: {st.recommendedShade}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Price + Add Button */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-sm font-black text-primary">
                          {format(price)}
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] font-bold text-muted-foreground line-through">
                            {format(p.price)}
                          </span>
                        )}
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(p, st.badge)}
                        disabled={isOutOfStock}
                        className={`h-8 rounded-xl px-3.5 text-xs font-bold shadow-soft active:scale-95 ${
                          isAdded
                            ? "bg-emerald-600 text-white"
                            : "gradient-gold text-primary-foreground"
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="h-3 w-3 stroke-[3]" />
                            <span>تمت الإضافة</span>
                          </>
                        ) : isOutOfStock ? (
                          <span>نفد</span>
                        ) : (
                          <>
                            <ShoppingBag className="h-3 w-3" />
                            <span>أضف للسلة</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function VirtualArtist() {
  const { data: studioSettings } = useStudioSettings();
  const [sourceUrl, setSourceUrl] = useState(modelAsset.url);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<"photo" | "camera">("photo");
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [look, setLook] = useState<LookKey>("natural");
  const [zone, setZone] = useState<Zone>("full");
  const [intensity, setIntensity] = useState(55);
  const [skinTone, setSkinTone] = useState("medium");
  const [coverage, setCoverage] = useState<Coverage>("medium");
  const [texture, setTexture] = useState<Texture>("natural");
  const [lens, setLens] = useState("none");
  const [lipstick, setLipstick] = useState("nude");
  const [comparison, setComparison] = useState(50);
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>(initialSaved);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [newLookName, setNewLookName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFinal, setIsFinal] = useState(true);
  const [error, setError] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [lighting, setLighting] = useState<Lighting>("daylight");
  const [colorIQ, setColorIQ] = useState<ColorIQ | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [wipedNotice, setWipedNotice] = useState(false);
  const blobUrlsRef = useRef<string[]>([]);
  const trackUrl = (url: string) => {
    if (url.startsWith("blob:")) blobUrlsRef.current.push(url);
    return url;
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("miraa-saved-looks");
      if (stored) setSavedLooks(JSON.parse(stored) as SavedLook[]);
    } catch {
      /* keep defaults */
    }
  }, []);
  const persistLooks = (next: SavedLook[]) => {
    setSavedLooks(next);
    localStorage.setItem("miraa-saved-looks", JSON.stringify(next));
  };
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  };
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const wipeSession = (notify = true) => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
    if (fileRef.current) fileRef.current.value = "";
    setSourceFile(null);
    setSourceUrl(modelAsset.url);
    setResultUrl(null);
    setColorIQ(null);
    setError("");
    setMode("photo");
    if (notify) setWipedNotice(true);
  };
  const wipeRef = useRef(wipeSession);
  wipeRef.current = wipeSession;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => wipeRef.current(), IDLE_WIPE_MS);
    };
    const onHide = () => wipeRef.current(false);
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, []);

  const runColorIQ = async () => {
    setError("");
    setAnalyzing(true);
    try {
      let image: Blob | null = sourceFile;
      if (cameraOn) image = await captureCamera();
      if (!image) image = await getDefaultFile();
      const res = await analyzeSkin(image);
      if (!res) {
        setError("لم نتمكن من قراءة البشرة بوضوح. استخدم صورة أمامية بإضاءة جيدة.");
        return;
      }
      setColorIQ(res);
      setSkinTone(res.tone);
    } catch {
      setError("تعذّر فحص درجة البشرة.");
    } finally {
      setAnalyzing(false);
    }
  };

  const zoneTransform = useMemo(() => {
    if (zone === "eyes") return "scale(1.55) translateY(13%)";
    if (zone === "lips") return "scale(1.7) translateY(-18%)";
    if (zone === "cheeks") return "scale(1.42) translateY(-1%)";
    return "scale(1)";
  }, [zone]);

  const applySaved = (item: SavedLook) => {
    setLook(item.look);
    setZone(item.zone);
    setIntensity(item.intensity);
    setSkinTone(item.skinTone);
    setCoverage(item.coverage);
    setTexture(item.texture);
    setLens(item.lens);
    setLipstick(item.lipstick);
  };
  const saveCurrentLook = () => {
    const name = newLookName.trim();
    if (!name) return;
    persistLooks([
      ...savedLooks,
      {
        id: crypto.randomUUID(),
        name,
        look,
        zone,
        intensity,
        skinTone,
        coverage,
        texture,
        lens,
        lipstick,
      },
    ]);
    setNewLookName("");
    setSaveOpen(false);
  };
  const commitRename = (id: string) => {
    const name = renameValue.trim();
    if (name) persistLooks(savedLooks.map((item) => (item.id === id ? { ...item, name } : item)));
    setRenamingId(null);
  };

  const selectPhoto = (file: File) => {
    stopCamera();
    setMode("photo");
    setSourceFile(file);
    setSourceUrl(trackUrl(URL.createObjectURL(file)));
    setResultUrl(null);
    setError("");
    setColorIQ(null);
    setWipedNotice(false);
    setComparison(50);
  };
  const startCamera = async () => {
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 1280 },
        audio: false,
      });
      streamRef.current = media;
      setMode("camera");
      setCameraOn(true);
      setResultUrl(null);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = media;
      });
    } catch {
      setError("تعذّر تشغيل الكاميرا. اسمح بالوصول إليها أو ارفع صورة.");
    }
  };
  const captureCamera = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return null;
    const file = new File([blob], "camera-portrait.jpg", { type: "image/jpeg" });
    setSourceFile(file);
    setSourceUrl(trackUrl(URL.createObjectURL(file)));
    stopCamera();
    setWipedNotice(false);
    setMode("photo");
    return file;
  };
  const getDefaultFile = async () => {
    const response = await fetch(modelAsset.url);
    const blob = await response.blob();
    return new File([blob], "portrait.png", { type: blob.type || "image/png" });
  };
  const applyMakeup = async () => {
    setError("");
    let image = sourceFile;
    if (cameraOn) image = await captureCamera();
    if (!image) image = await getDefaultFile();
    const selectedLook = looks.find((item) => item.key === look);
    const selectedZone = zones.find((item) => item.key === zone);
    const lensText =
      zone === "eyes" && lens !== "none"
        ? `realistic ${lens} contact lenses preserving natural iris detail`
        : "no contact lens change";
    const lipText =
      zone === "lips" || zone === "full" ? `${lipstick} lipstick` : "no lip color change";
    const form = new FormData();
    form.append("image", image);
    form.append(
      "prompt",
      `Edit this exact portrait directly. Apply ${selectedLook?.prompt ?? "natural makeup"} at ${intensity}% intensity, limited to ${selectedZone?.prompt ?? "the full face"}. Foundation: ${coverage} coverage, ${texture} finish, matched precisely to the person's real ${skinTone} skin undertone without lightening or darkening it. Add ${lensText} and ${lipText}. Simulate physically realistic cosmetic texture: visible natural pores, fine skin detail, powder dispersion, cream blending, subtle specular highlights and correct pigment translucency. Match the original light direction, color temperature, shadows and reflections. Preserve exact identity, facial geometry, skin tone, eye shape, nose, lips, hair, expression, pose, clothing, background, framing and lighting. Never smooth into plastic skin, reshape, beautify, age or reconstruct the face. No overlays, masks, annotations, split screen or text. Output one natural photorealistic portrait of the same person.`,
    );
    setLoading(true);
    setIsFinal(false);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error("يرجى تسجيل الدخول لاستخدام الاستوديو.");
      await streamImage(
        "/api/edit-makeup",
        form,
        (url, final) => {
          setResultUrl(trackUrl(url));
          setIsFinal(final);
          if (final) setComparison(50);
        },
        undefined,
        { Authorization: `Bearer ${accessToken}` },
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.replace(/^Image generation failed:\s*/i, "")
          : "تعذّر تطبيق الإطلالة.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (studioSettings?.disabled) {
    return (
      <main
        className="min-h-[70vh] bg-background py-16 px-4 text-center flex flex-col items-center justify-center"
        dir="rtl"
      >
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <PowerOff className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-extrabold text-foreground">
            استوديو المكياج الافتراضي غير متاح حالياً
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            تم تعطيل خدمة تجربة المكياج مؤقتاً لأعمال التحديث والصيانة. نعتذر عن أي إزعاج، وندعوكم
            لتصفح منتجاتنا المميزة.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-soft transition-transform hover:opacity-90 active:scale-95"
            >
              <span>تصفح المنتجات</span>
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary active:scale-95"
            >
              <span>الرئيسية</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background text-foreground" dir="rtl">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <Aperture size={21} />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">مرآة</h1>
              <p className="text-xs text-muted-foreground">استوديو الفنان الافتراضي</p>
            </div>
          </div>
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-success" />
            صورتك تُحذف تلقائياً بانتهاء الجلسة
          </span>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 md:px-8 xl:grid-cols-[260px_minmax(0,1fr)_350px]">
        <aside className="order-2 min-w-0 border-border xl:order-1 xl:border-l xl:pl-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">مكتبة الإطلالات</h2>
            <Button
              size="icon"
              variant="ghost"
              className="size-9"
              aria-label={libraryOpen ? "إغلاق المكتبة" : "فتح المكتبة"}
              onClick={() => setLibraryOpen(!libraryOpen)}
            >
              {libraryOpen ? <X size={18} /> : <Eye size={18} />}
            </Button>
          </div>
          {libraryOpen && (
            <>
              <div className="grid gap-2">
                {savedLooks.map((item) => (
                  <div key={item.id} className="rounded-md border border-border bg-card p-3">
                    {renamingId === item.id ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(item.id);
                          }}
                          className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                          aria-label="اسم الإطلالة"
                        />
                        <Button
                          size="icon"
                          className="size-9"
                          onClick={() => commitRename(item.id)}
                        >
                          <Check size={16} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="w-full text-right"
                          onClick={() => applySaved(item)}
                        >
                          <strong className="block text-sm">{item.name}</strong>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {zones.find((z) => z.key === item.zone)?.name} · {item.intensity}%
                          </span>
                        </button>
                        <div className="mt-2 flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="إعادة تسمية"
                            onClick={() => {
                              setRenamingId(item.id);
                              setRenameValue(item.name);
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive"
                            aria-label="حذف الإطلالة"
                            onClick={() =>
                              persistLooks(savedLooks.filter((lookItem) => lookItem.id !== item.id))
                            }
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-3 w-full" onClick={() => setSaveOpen(true)}>
                <Plus size={17} />
                حفظ الإعدادات الحالية
              </Button>
            </>
          )}
        </aside>

        <div className="order-1 min-w-0 xl:order-2">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold">جرّب الإطلالة على ملامحك</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                اختر منطقة الوجه وستقترب المعاينة إليها تلقائياً.
              </p>
            </div>
            <div className="flex rounded-md border border-border bg-card p-1">
              <Button
                size="sm"
                variant={view === "2d" ? "default" : "ghost"}
                onClick={() => setView("2d")}
              >
                2D
              </Button>
              <Button
                size="sm"
                variant={view === "3d" ? "default" : "ghost"}
                onClick={() => setView("3d")}
              >
                <ScanFace size={15} />
                3D
              </Button>
            </div>
          </div>
          <div
            className="relative mx-auto aspect-[4/5] max-h-[73vh] w-full touch-none overflow-hidden rounded-md bg-stage shadow-stage"
            onPointerMove={(event) => {
              if (view !== "3d") return;
              const rect = event.currentTarget.getBoundingClientRect();
              setTilt({
                x: ((event.clientY - rect.top) / rect.height - 0.5) * -7,
                y: ((event.clientX - rect.left) / rect.width - 0.5) * 9,
              });
            }}
            onPointerLeave={() => setTilt({ x: 0, y: 0 })}
          >
            {cameraOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full scale-x-[-1] object-cover"
              />
            ) : (
              <div
                className={cn(
                  "relative h-full w-full transition-transform duration-700",
                  view === "3d" && "portrait-3d",
                )}
                style={{
                  filter: lightings.find((l) => l.key === lighting)?.filter,
                  transform:
                    view === "3d" && (tilt.x || tilt.y)
                      ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.025)`
                      : undefined,
                }}
              >
                <img
                  src={sourceUrl}
                  alt="الصورة الأصلية قبل المكياج"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700"
                  style={{ transform: zoneTransform }}
                />
                {resultUrl && (
                  <div
                    className="absolute inset-y-0 left-0 overflow-hidden"
                    style={{ width: `${comparison}%` }}
                  >
                    <img
                      src={resultUrl}
                      alt="النتيجة بعد المكياج"
                      className={cn(
                        "absolute inset-y-0 left-0 h-full max-w-none object-cover transition-[filter,transform] duration-700",
                        !isFinal && "blur-xl",
                      )}
                      style={{ width: "100cqw", transform: zoneTransform }}
                    />
                  </div>
                )}
              </div>
            )}
            {resultUrl && !cameraOn && (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-card shadow"
                  style={{ left: `${comparison}%` }}
                >
                  <span className="absolute top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground">
                    ↔
                  </span>
                </div>
                <input
                  aria-label="تحريك المقارنة بين قبل وبعد"
                  type="range"
                  min="0"
                  max="100"
                  value={comparison}
                  onChange={(e) => setComparison(Number(e.target.value))}
                  className="comparison-range absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0"
                />
                <span className="absolute right-3 top-3 z-10 rounded-md bg-card/85 px-3 py-2 text-xs font-bold">
                  قبل
                </span>
                <span className="absolute left-3 top-3 z-10 rounded-md bg-card/85 px-3 py-2 text-xs font-bold">
                  بعد
                </span>
              </>
            )}
            {loading && (
              <>
                <div className="absolute inset-x-0 top-0 z-40 h-0.5 bg-primary scan-line" />
                <div className="absolute inset-0 z-30 grid place-items-center bg-foreground/10">
                  <span className="flex items-center gap-2 rounded-md bg-card/90 px-4 py-3 text-sm font-bold shadow">
                    <LoaderCircle className="animate-spin" size={18} />
                    محاكاة الملمس والإضاءة…
                  </span>
                </div>
              </>
            )}
            {!resultUrl && !loading && (
              <div className="absolute right-3 top-3 rounded-md bg-card/85 px-3 py-2 text-xs font-bold">
                <span className="ml-2 inline-block size-2 rounded-full bg-success" />
                {cameraOn ? "الكاميرا مباشرة" : "الصورة الأصلية"}
              </div>
            )}
            {view === "3d" && !cameraOn && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-foreground/75 px-3 py-2 text-xs text-background">
                عرض متحرك — حرّك المؤشر للتحكم
              </div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) selectPhoto(file);
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload size={17} />
              رفع صورة
            </Button>
            {!cameraOn ? (
              <Button variant="outline" onClick={startCamera}>
                <Video size={17} />
                فتح الكاميرا
              </Button>
            ) : (
              <Button variant="secondary" onClick={captureCamera}>
                <Camera size={17} />
                التقاط
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setResultUrl(null);
                setError("");
              }}
              disabled={!resultUrl}
            >
              <RotateCcw size={17} />
              الأصل
            </Button>
            {resultUrl && (
              <Button variant="ghost" asChild>
                <a href={resultUrl} download="miraa-makeup.png">
                  <Download size={17} />
                  حفظ الصورة
                </a>
              </Button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">الإضاءة:</span>
            <div className="flex flex-wrap rounded-md border border-border bg-card p-1">
              {lightings.map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant={lighting === item.key ? "default" : "ghost"}
                  onClick={() => setLighting(item.key)}
                >
                  <item.icon size={15} />
                  {item.name}
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck size={16} className="text-success" />
              لا تُخزَّن صورك على أي خادم، وتُمحى عند إغلاق الصفحة أو بعد 10 دقائق من عدم النشاط.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => wipeSession()}
            >
              <Trash2 size={15} />
              إنهاء الجلسة وحذف الصور
            </Button>
          </div>
          {wipedNotice && (
            <p
              role="status"
              className="mt-3 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm"
            >
              تم حذف صورك ونتائجك من هذه الجلسة بالكامل.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        <aside className="order-3 min-w-0 border-t border-border pt-5 xl:border-r xl:border-t-0 xl:pr-5 xl:pt-0">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-extrabold">نطاق التطبيق</h3>
              <ScanFace size={18} className="text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {zones.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={zone === item.key ? "default" : "outline"}
                  onClick={() => setZone(item.key)}
                >
                  {item.name}
                </Button>
              ))}
            </div>
          </section>
          <section className="mt-5 border-t border-border pt-5">
            <h3 className="mb-3 font-extrabold">الإطلالة</h3>
            <div className="grid grid-cols-2 gap-2">
              {looks.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant="ghost"
                  onClick={() => setLook(item.key)}
                  className={cn(
                    "h-auto min-h-16 justify-start border p-2 text-right",
                    look === item.key ? "border-primary ring-1 ring-primary" : "border-border",
                  )}
                >
                  <span className="flex -space-x-2 space-x-reverse">
                    {item.swatches.slice(0, 2).map((s) => (
                      <span key={s} className={cn("size-6 rounded-full border-2 border-card", s)} />
                    ))}
                  </span>
                  <span className="text-xs">{item.name}</span>
                </Button>
              ))}
            </div>
          </section>
          {(zone === "eyes" || zone === "full") && (
            <section className="mt-5 border-t border-border pt-5">
              <h3 className="mb-2 text-sm font-bold">العدسات</h3>
              <div className="grid grid-cols-4 gap-1">
                {lenses.map((item) => (
                  <Button
                    key={item.key}
                    size="sm"
                    variant={lens === item.key ? "secondary" : "ghost"}
                    className="px-1"
                    onClick={() => setLens(item.key)}
                  >
                    {item.name}
                  </Button>
                ))}
              </div>
            </section>
          )}
          {(zone === "lips" || zone === "full") && (
            <section className="mt-4">
              <h3 className="mb-2 text-sm font-bold">لون الروج</h3>
              <div className="grid grid-cols-4 gap-1">
                {lipsticks.map((item) => (
                  <Button
                    key={item.key}
                    size="sm"
                    variant={lipstick === item.key ? "secondary" : "ghost"}
                    className="px-1"
                    onClick={() => setLipstick(item.key)}
                  >
                    {item.name}
                  </Button>
                ))}
              </div>
            </section>
          )}
          <section className="mt-5 border-t border-border pt-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-extrabold">البشرة وكريم الأساس</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={runColorIQ}
                disabled={analyzing || loading}
              >
                {analyzing ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <Pipette size={15} />
                )}
                فحص تلقائي
              </Button>
            </div>
            {colorIQ && (
              <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <div className="flex items-center gap-3">
                  <span
                    className="size-10 shrink-0 rounded-full border-2 border-card shadow"
                    style={{ backgroundColor: colorIQ.hex }}
                    aria-hidden
                  />
                  <div>
                    <strong className="block">
                      نتيجة الفحص: {skinTones.find((t) => t.key === colorIQ.tone)?.name}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      الدرجة التحتية: {undertoneNames[colorIQ.undertone]}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-md bg-card p-2">
                    <span className="block text-xs text-muted-foreground">كريم الأساس</span>
                    <strong>{colorIQ.foundation}</strong>
                  </div>
                  <div className="rounded-md bg-card p-2">
                    <span className="block text-xs text-muted-foreground">الكونسيلر</span>
                    <strong>{colorIQ.concealer}</strong>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  الكونسيلر أفتح بنصف درجة لإضاءة ما تحت العين. تم الفحص على جهازك فقط.
                </p>
              </div>
            )}
            <div className="flex justify-between gap-2">
              {skinTones.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  title={item.name}
                  aria-label={item.name}
                  onClick={() => setSkinTone(item.key)}
                  className={cn(
                    "size-10 rounded-full border-2 transition-transform",
                    item.color,
                    skinTone === item.key
                      ? "scale-110 border-primary ring-2 ring-primary/20"
                      : "border-card shadow",
                  )}
                />
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {skinTones.find((item) => item.key === skinTone)?.name}
            </p>
            <label className="mt-4 block text-sm font-bold">التغطية</label>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {coverageOptions.map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant={coverage === item.key ? "secondary" : "ghost"}
                  onClick={() => setCoverage(item.key)}
                >
                  {item.name}
                </Button>
              ))}
            </div>
            <label className="mt-4 block text-sm font-bold">ملمس المستحضر</label>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {textures.map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant={texture === item.key ? "secondary" : "ghost"}
                  className="px-1"
                  onClick={() => setTexture(item.key)}
                >
                  {item.name}
                </Button>
              ))}
            </div>
          </section>
          <section className="mt-5 border-t border-border pt-5">
            <div className="mb-2 flex justify-between">
              <label htmlFor="intensity" className="text-sm font-bold">
                قوة التطبيق
              </label>
              <span className="text-sm font-extrabold text-primary">{intensity}%</span>
            </div>
            <input
              id="intensity"
              type="range"
              min="20"
              max="90"
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </section>
          <div className="mt-5 rounded-md bg-muted p-3">
            <div className="flex gap-2">
              <ImagePlus size={17} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs leading-5 text-muted-foreground">
                تُطابق الإضاءة والدرجة والملمس مع إبقاء المسام والملامح الطبيعية.
              </p>
            </div>
          </div>
          <Button className="mt-4 h-12 w-full" onClick={applyMakeup} disabled={loading}>
            {loading ? <LoaderCircle className="animate-spin" size={19} /> : <Wand2 size={19} />}
            طبّق الإطلالة
          </Button>
        </aside>
      </section>

      {saveOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="حفظ الإطلالة"
        >
          <div className="w-full max-w-sm rounded-md bg-card p-5 shadow-stage">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">حفظ الإطلالة</h2>
              <Button
                size="icon"
                variant="ghost"
                aria-label="إغلاق"
                onClick={() => setSaveOpen(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <label htmlFor="look-name" className="mt-4 block text-sm font-bold">
              اسم الإطلالة
            </label>
            <input
              id="look-name"
              autoFocus
              value={newLookName}
              onChange={(e) => setNewLookName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrentLook();
              }}
              placeholder="مثلاً: إطلالتي اليومية"
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              className="mt-4 w-full"
              onClick={saveCurrentLook}
              disabled={!newLookName.trim()}
            >
              <Save size={17} />
              حفظ في المكتبة
            </Button>
          </div>
        </div>
      )}
      <StudioProducts
        lookKey={look}
        lipstick={lipstick}
        lens={lens}
        coverage={coverage}
        texture={texture}
        skinTone={skinTone}
        zone={zone}
        lookName={looks.find((l) => l.key === look)?.name ?? ""}
      />
    </main>
  );
}
