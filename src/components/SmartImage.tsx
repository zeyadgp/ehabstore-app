import { useState, useEffect, useMemo } from "react";
import { useSignedImages } from "@/lib/store";
import { defaultProductImage } from "@/lib/images";

const LOGO = defaultProductImage;

/**
 * تحسين رابط الصورة لتسريع التحميل وتوليد صيغة مضغوطة متوافقة مع المتصفح
 */
function getOptimizedImageUrl(rawUrl: string, targetWidth?: number): string {
  if (!rawUrl || rawUrl.startsWith("data:") || rawUrl.endsWith(".svg")) {
    return rawUrl;
  }

  // تحسين روابط التخزين في Supabase إذا كانت تدعم التحويلات
  if (rawUrl.includes("supabase.co/storage/v1/object/public/")) {
    const w = targetWidth ? Math.min(targetWidth * 2, 1200) : 480;
    // إضافة معاملات التحجيم لتسريع التحميل على شبكات الجوال
    const separator = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${separator}width=${w}&quality=80`;
  }

  return rawUrl;
}

export function SmartImage({
  paths,
  fallback,
  src: directSrc,
  alt,
  className = "",
  wrapperClassName,
  index = 0,
  eager = false,
  width,
  height,
  sizes,
}: {
  paths?: string[] | undefined;
  fallback?: string | undefined;
  /** رابط صورة جاهز عندما لا تكون الصورة مخزّنة داخل المتجر */
  src?: string | undefined;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  index?: number;
  eager?: boolean;
  /** أبعاد تقريبية تمنع اهتزاز الصفحة أثناء التحميل وتساعد المتصفح على تخصيص المساحة */
  width?: number;
  height?: number;
  sizes?: string;
}) {
  const { data } = useSignedImages(paths);
  const [hasError, setHasError] = useState(false);
  const [triedRaw, setTriedRaw] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const rawSrc = data?.[index] || directSrc || fallback || "";

  // إعادة ضبط الحالة عند تغير المسار
  useEffect(() => {
    setHasError(false);
    setTriedRaw(false);
    setIsLoaded(false);
  }, [rawSrc]);

  // توليد الرابط المحسّن
  const optimizedSrc = useMemo(() => {
    if (!rawSrc) return "";
    return getOptimizedImageUrl(rawSrc, width);
  }, [rawSrc, width]);

  // تحديد الرابط الفعلي (المحسن أولاً، ثم الأصلي في حال فشل المحسن، ثم الشعار)
  const currentSrc = useMemo(() => {
    if (hasError || !rawSrc) return LOGO;
    if (triedRaw) return rawSrc;
    return optimizedSrc;
  }, [hasError, rawSrc, triedRaw, optimizedSrc]);

  return (
    <div className={wrapperClassName ?? "relative h-full w-full overflow-hidden bg-secondary/30"}>
      {/* خلفية هيكلية ناعمة أثناء التحميل الأولي */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 animate-pulse bg-muted/40" aria-hidden="true" />
      )}
      <img
        src={currentSrc}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${
          isLoaded || hasError ? "opacity-100" : "opacity-0"
        }`}
        width={width}
        height={height}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          // إذا فشل الرابط المحسّن وكان مختلفاً عن الأصلي، نجرب الأصلي أولاً قبل التحويل للشعار
          if (!triedRaw && optimizedSrc !== rawSrc) {
            setTriedRaw(true);
          } else {
            setHasError(true);
            setIsLoaded(true);
          }
        }}
      />
    </div>
  );
}
